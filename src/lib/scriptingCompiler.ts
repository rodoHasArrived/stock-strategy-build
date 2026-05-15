export type ScriptDiagnosticLevel = 'warning' | 'error'

export interface ScriptDiagnostic {
  level: ScriptDiagnosticLevel
  line: number
  message: string
}

export interface CompileScriptOptions {
  availableCusips?: string[]
}

export interface CompileScriptResult {
  code: string
  diagnostics: ScriptDiagnostic[]
  capturedVariables: string[]
}

interface ParsedBasket {
  name: string
  cusips: Array<{ value: string; line: number }>
  weights: Array<{ cusip: string; value: number; line: number }>
  tags: string[]
  notes: string
  startLine: number
}

type BasketSection = 'cusips' | 'weights' | 'tags' | 'notes'
type ScriptBlockKind = 'if' | 'for' | 'while' | 'select'

interface CompiledScriptLine {
  code: string
  opens?: ScriptBlockKind
  closes?: ScriptBlockKind
  captures?: string[]
}

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const identifierSource = '([A-Za-z_$][A-Za-z0-9_$]*)'
const assignmentPattern = new RegExp(`^\\s*(?:(?:let|const|var)\\s+)?${identifierSource}\\s*=`)
const declarationPattern = new RegExp(`^\\s*(?:let|const|var)\\s+${identifierSource}\\b`)
const reservedCaptures = new Set([
  '__result__',
  '__controlFlow__',
  'if',
  'for',
  'while',
  'return',
  'const',
  'let',
  'var',
  'result',
  'next',
  'goto',
  'stop',
  'pass',
  'fail',
  'missingData'
])

const splitInlineList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeFStrings = (expression: string) =>
  expression
    .replace(/\bf"([^"`\\]*(?:\\.[^"`\\]*)*)"/g, (_, body: string) => (
      `\`${body.replace(/\{([^}]+)\}/g, '${$1}')}\``
    ))
    .replace(/\bf'([^'`\\]*(?:\\.[^'`\\]*)*)'/g, (_, body: string) => (
      `\`${body.replace(/\{([^}]+)\}/g, '${$1}')}\``
    ))

const normalizeExpression = (expression: string) =>
  normalizeFStrings(expression)
    .replace(/\b([A-Za-z_$][A-Za-z0-9_$.\[\]]*)\s+is\s+not\s+nothing\b/gi, '$1 != null')
    .replace(/\b([A-Za-z_$][A-Za-z0-9_$.\[\]]*)\s+is\s+nothing\b/gi, '$1 == null')
    .replace(/\bAnd\b/gi, '&&')
    .replace(/\bOr\b/gi, '||')
    .replace(/\bNot\b/gi, '!')
    .replace(/\bMod\b/gi, '%')
    .replace(/\bTrue\b/gi, 'true')
    .replace(/\bFalse\b/gi, 'false')
    .replace(/\bNothing\b/gi, 'null')
    .replace(/\bNull\b/gi, 'null')
    .replace(/<>/g, '!==')
    .replace(/\s&\s/g, ' + ')

const normalizeCondition = (condition: string) =>
  normalizeExpression(condition)
    .replace(/(^|[^<>=!])=(?![=>])/g, '$1===')

const withStatementTerminator = (statement: string) => {
  const trimmed = statement.trim()
  if (!trimmed || /[;{}:,]$/.test(trimmed) || /[([{]$/.test(trimmed)) {
    return statement
  }
  return `${statement};`
}

const actionToCall = (action: string, target?: string) => {
  switch (action) {
    case 'next':
      return 'next();'
    case 'stop':
      return target ? `stop(${JSON.stringify(target)});` : 'stop();'
    case 'pass':
      return target ? `pass(${JSON.stringify(target)});` : 'pass();'
    case 'fail':
      return target ? `fail(${JSON.stringify(target)});` : 'fail();'
    case 'missing_data':
      return target ? `missingData(${JSON.stringify(target)});` : 'missingData();'
    case 'goto':
      if (!target) return 'goto();'
      if (/^['"]?stop['"]?$/i.test(target)) return 'stop();'
      return `goto(${target.replace(/['"]/g, '')});`
    default:
      return ''
  }
}

const compileSimpleStatement = (statement: string): string | null => {
  const trimmed = statement.trim()
  if (!trimmed) return ''

  const callResult = trimmed.match(/^call\s+result\s*\((.*)\)$/i)
  if (callResult) {
    return `result(${normalizeExpression(callResult[1])});`
  }

  const resultCall = trimmed.match(/^result\s*\((.*)\)$/i)
  if (resultCall) {
    return `result(${normalizeExpression(resultCall[1])});`
  }

  const resultAssignment = trimmed.match(/^(?:result|output|__result__)\s*=\s*(.+)$/i)
  if (resultAssignment) {
    return `result(${normalizeExpression(resultAssignment[1])});`
  }

  const resultStatement = trimmed.match(/^(?:result|output)\s+(.+)$/i)
  if (resultStatement) {
    return `result(${normalizeExpression(resultStatement[1])});`
  }

  const gotoLabel = trimmed.match(/^(?:go\s*to|goto)\s*:?\s*(.+)$/i)
  if (gotoLabel) {
    return actionToCall('goto', gotoLabel[1].trim())
  }

  const callAction = trimmed.match(/^call\s+(next|stop|pass|fail|missing_data|missing\s+data)\s*(?:\((.*)\))?$/i)
  if (callAction) {
    return actionToCall(callAction[1].toLowerCase().replace(/\s+/g, '_'), callAction[2]?.trim())
  }

  const bareAction = trimmed.match(/^(next|stop|pass|fail|missing_data|missing\s+data)(?:\s+(.+))?$/i)
  if (bareAction) {
    return actionToCall(bareAction[1].toLowerCase().replace(/\s+/g, '_'), bareAction[2]?.trim())
  }

  const exitStatement = trimmed.match(/^exit\s+(?:strategy|sub|function|for|do)$/i)
  if (exitStatement) {
    return /\b(?:for|do)$/i.test(trimmed) ? 'break;' : 'stop();'
  }

  const dimDeclaration = trimmed.match(new RegExp(`^dim\\s+${identifierSource}(?:\\s+as\\s+[A-Za-z][A-Za-z0-9_]*)?(?:\\s*=\\s*(.+))?$`, 'i'))
  if (dimDeclaration) {
    const [, name, initialValue] = dimDeclaration
    return initialValue ? `${name} = ${normalizeExpression(initialValue)};` : `// ${trimmed}`
  }

  const prefixedAssignment = trimmed.match(new RegExp(`^(?:let|set|const|var)\\s+${identifierSource}\\s*=\\s*(.+)$`, 'i'))
  if (prefixedAssignment) {
    const [, name, value] = prefixedAssignment
    return withStatementTerminator(`${name} = ${normalizeExpression(value)}`)
  }

  const simpleAssignment = trimmed.match(new RegExp(`^${identifierSource}\\s*=\\s*(.+)$`))
  if (simpleAssignment) {
    const [, name, value] = simpleAssignment
    return withStatementTerminator(`${name} = ${normalizeExpression(value)}`)
  }

  return null
}

const compileCompatibilityLine = (line: string, openBlock?: ScriptBlockKind): CompiledScriptLine => {
  const indent = line.match(/^\s*/)?.[0] ?? ''
  const trimmed = line.trim()

  if (trimmed === '') return { code: line }

  if (/^(?:'|#|rem\b)/i.test(trimmed)) {
    return { code: `${indent}// ${trimmed.replace(/^(?:'|#|rem\b)\s*/i, '')}` }
  }

  if (/^end\s+if$/i.test(trimmed)) {
    return { code: `${indent}}`, closes: 'if' }
  }

  const elseIf = trimmed.match(/^else\s*if\s+(.+?)\s+then(?:\s+(.+))?$/i) ?? trimmed.match(/^elseif\s+(.+?)\s+then(?:\s+(.+))?$/i)
  if (elseIf) {
    const [, condition, inlineAction] = elseIf
    const compiledAction = inlineAction ? compileSimpleStatement(inlineAction) : null
    return {
      code: compiledAction != null
        ? `${indent}} else if (${normalizeCondition(condition)}) { ${compiledAction} }`
        : `${indent}} else if (${normalizeCondition(condition)}) {`
    }
  }

  const elseLine = trimmed.match(/^else(?:\s*:\s*(.+)|\s+(.+))?$/i)
  if (elseLine) {
    const inlineAction = elseLine[1] ?? elseLine[2]
    if (inlineAction?.trim() === '{') {
      return { code: line }
    }
    const compiledAction = inlineAction ? compileSimpleStatement(inlineAction) : null
    return {
      code: compiledAction != null ? `${indent}} else { ${compiledAction} }` : `${indent}} else {`
    }
  }

  const ifThen = trimmed.match(/^if\s+(.+?)\s+then(?:\s+(.+))?$/i)
  if (ifThen) {
    const [, condition, inlineAction] = ifThen
    const compiledAction = inlineAction ? compileSimpleStatement(inlineAction) : null
    return {
      code: compiledAction != null
        ? `${indent}if (${normalizeCondition(condition)}) { ${compiledAction} }`
        : `${indent}if (${normalizeCondition(condition)}) {`,
      opens: compiledAction == null ? 'if' : undefined
    }
  }

  const pythonInlineIf = trimmed.match(/^if\s+(.+):\s*(.+)$/i)
  if (pythonInlineIf) {
    const [, condition, inlineAction] = pythonInlineIf
    const compiledAction = compileSimpleStatement(inlineAction) ?? inlineAction
    return { code: `${indent}if (${normalizeCondition(condition)}) { ${compiledAction} }` }
  }

  const conditional = trimmed.match(/^if\s+(.+):\s*(next|goto|stop|pass|fail|missing_data)(?:\s+(.+))?$/i)
  if (conditional) {
    const [, condition, action, target] = conditional
    return { code: `${indent}if (${normalizeCondition(condition)}) { ${actionToCall(action.toLowerCase(), target?.trim())} }` }
  }

  const whileGoto = trimmed.match(/^while\s+(.+):\s*goto\s+(.+)$/i)
  if (whileGoto) {
    const [, condition, target] = whileGoto
    return { code: `${indent}if (${normalizeCondition(condition)}) { ${actionToCall('goto', target.trim())} }` }
  }

  const doWhile = trimmed.match(/^do\s+while\s+(.+)$/i)
  if (doWhile) {
    return { code: `${indent}while (${normalizeCondition(doWhile[1])}) {`, opens: 'while' }
  }

  const doUntil = trimmed.match(/^do\s+until\s+(.+)$/i)
  if (doUntil) {
    return { code: `${indent}while (!(${normalizeCondition(doUntil[1])})) {`, opens: 'while' }
  }

  const whileBlock = trimmed.match(/^while\s+(.+)$/i)
  if (whileBlock && !/^while\s*\(/i.test(trimmed)) {
    return { code: `${indent}while (${normalizeCondition(whileBlock[1])}) {`, opens: 'while' }
  }

  if (/^loop$/i.test(trimmed)) {
    return { code: `${indent}}`, closes: 'while' }
  }

  const forEach = trimmed.match(new RegExp(`^for\\s+each\\s+${identifierSource}\\s+in\\s+(.+)$`, 'i'))
  if (forEach) {
    const [, itemName, collection] = forEach
    return {
      code: `${indent}for (${itemName} of ${normalizeExpression(collection)}) {`,
      opens: 'for',
      captures: [itemName]
    }
  }

  const forLoop = trimmed.match(new RegExp(`^for\\s+${identifierSource}\\s*=\\s*(.+)\\s+to\\s+(.+)$`, 'i'))
  if (forLoop) {
    const [, itemName, start, end] = forLoop
    return {
      code: `${indent}for (${itemName} = ${normalizeExpression(start)}; ${itemName} <= ${normalizeExpression(end)}; ${itemName}++) {`,
      opens: 'for',
      captures: [itemName]
    }
  }

  if (/^next(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?$/i.test(trimmed)) {
    return openBlock === 'for'
      ? { code: `${indent}}`, closes: 'for' }
      : { code: `${indent}${actionToCall('next')}` }
  }

  const selectCase = trimmed.match(/^select\s+case\s+(.+)$/i)
  if (selectCase) {
    return { code: `${indent}switch (${normalizeExpression(selectCase[1])}) {`, opens: 'select' }
  }

  const caseElse = trimmed.match(/^case\s+else$/i)
  if (caseElse) {
    return { code: `${indent}default:` }
  }

  const caseLine = trimmed.match(/^case\s+(.+)$/i)
  if (caseLine) {
    return { code: `${indent}case ${normalizeExpression(caseLine[1])}:` }
  }

  if (/^end\s+select$/i.test(trimmed)) {
    return { code: `${indent}}`, closes: 'select' }
  }

  const gotoLabel = trimmed.match(/^goto\s*:\s*(.+)$/i)
  if (gotoLabel) {
    return { code: `${indent}${actionToCall('goto', gotoLabel[1].trim())}` }
  }

  const bareGoto = trimmed.match(/^(?:go\s*to|goto)\s+(.+)$/i)
  if (bareGoto) {
    return { code: `${indent}${actionToCall('goto', bareGoto[1].trim())}` }
  }

  const simpleStatement = compileSimpleStatement(trimmed)
  if (simpleStatement != null) {
    const dimCapture = trimmed.match(new RegExp(`^dim\\s+${identifierSource}\\b`, 'i'))
    const assignmentCapture = simpleStatement.match(assignmentPattern)
    const captures = [
      dimCapture?.[1],
      assignmentCapture?.[1]
    ].filter(Boolean) as string[]

    return { code: `${indent}${simpleStatement}`, captures }
  }

  const bareAction = trimmed.match(/^(stop|pass|fail|missing_data)$/i)
  if (bareAction) {
    return { code: `${indent}${actionToCall(bareAction[1].toLowerCase())}` }
  }

  return { code: line }
}

function parseBasketBlock(lines: string[], startIndex: number, diagnostics: ScriptDiagnostic[], availableCusips: Set<string>) {
  const startLine = lines[startIndex]
  const basketMatch = startLine.match(/^(\s*)basket\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*$/i)
  if (!basketMatch) return null

  const baseIndent = basketMatch[1].length
  const basket: ParsedBasket = {
    name: basketMatch[2],
    cusips: [],
    weights: [],
    tags: [],
    notes: '',
    startLine: startIndex + 1
  }

  let index = startIndex + 1
  let section: BasketSection | null = null

  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      index++
      continue
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0
    if (indent <= baseIndent) break

    const trimmed = line.trim()
    const sectionMatch = trimmed.match(/^(cusips|weights|tags|notes)\s*:\s*(.*)$/i)
    if (sectionMatch) {
      section = sectionMatch[1].toLowerCase() as BasketSection
      const inline = sectionMatch[2].trim()

      if (section === 'cusips' && inline) {
        splitInlineList(inline).forEach((cusip) => basket.cusips.push({ value: cusip, line: index + 1 }))
      } else if (section === 'tags' && inline) {
        basket.tags.push(...splitInlineList(inline))
      } else if (section === 'notes' && inline) {
        basket.notes = inline
      }

      index++
      continue
    }

    if (section === 'cusips') {
      splitInlineList(trimmed).forEach((cusip) => basket.cusips.push({ value: cusip, line: index + 1 }))
    } else if (section === 'weights') {
      const weightMatch = trimmed.match(/^([^:]+):\s*(-?\d+(?:\.\d+)?)$/)
      if (weightMatch) {
        basket.weights.push({ cusip: weightMatch[1].trim(), value: Number(weightMatch[2]), line: index + 1 })
      } else {
        diagnostics.push({ level: 'error', line: index + 1, message: `Invalid basket weight line: "${trimmed}"` })
      }
    } else if (section === 'tags') {
      basket.tags.push(...splitInlineList(trimmed))
    } else if (section === 'notes') {
      basket.notes = basket.notes ? `${basket.notes}\n${trimmed}` : trimmed
    } else {
      diagnostics.push({ level: 'warning', line: index + 1, message: `Ignored basket line outside a section: "${trimmed}"` })
    }

    index++
  }

  const seen = new Set<string>()
  basket.cusips.forEach(({ value, line }) => {
    const normalized = value.toUpperCase()
    if (seen.has(normalized)) {
      diagnostics.push({ level: 'warning', line, message: `Duplicate CUSIP "${value}" was deduped in basket ${basket.name}.` })
    }
    seen.add(normalized)

    if (availableCusips.size > 0 && !availableCusips.has(normalized)) {
      diagnostics.push({ level: 'warning', line, message: `CUSIP "${value}" is not in the current security universe.` })
    }
  })

  if (basket.weights.length > 0) {
    const totalWeight = basket.weights.reduce((sum, entry) => sum + entry.value, 0)
    if (Math.abs(totalWeight - 1) > 0.0001) {
      diagnostics.push({
        level: 'warning',
        line: basket.startLine,
        message: `Weights for basket ${basket.name} sum to ${totalWeight.toFixed(4)} instead of 1.0000.`
      })
    }
  }

  const compiledBasket = [
    `${basket.name} = __createBasket__(${JSON.stringify({
      name: basket.name,
      cusips: Array.from(seen),
      weights: Object.fromEntries(basket.weights.map((entry) => [entry.cusip.toUpperCase(), entry.value])),
      tags: basket.tags,
      notes: basket.notes
    })});`,
    `__setVar__(${JSON.stringify(basket.name)}, ${basket.name});`
  ].join('\n')

  return { nextIndex: index, compiledBasket, variableName: basket.name }
}

function compilePythonInlineIfElse(lines: string[], startIndex: number): { compiledLine: CompiledScriptLine; nextIndex: number } | null {
  const ifLine = lines[startIndex]
  const elseLine = lines[startIndex + 1]
  if (!elseLine) return null

  const ifMatch = ifLine.trim().match(/^if\s+(.+):\s*(.+)$/i)
  const elseMatch = elseLine.trim().match(/^else:\s*(.+)$/i)
  if (!ifMatch || !elseMatch) return null

  const indent = ifLine.match(/^\s*/)?.[0] ?? ''
  const [, condition, ifAction] = ifMatch
  const [, elseAction] = elseMatch
  const compiledIfAction = compileSimpleStatement(ifAction) ?? ifAction
  const compiledElseAction = compileSimpleStatement(elseAction) ?? elseAction

  return {
    compiledLine: {
      code: `${indent}if (${normalizeCondition(condition)}) { ${compiledIfAction} } else { ${compiledElseAction} }`
    },
    nextIndex: startIndex + 2
  }
}

export function compileScriptingCode(code: string, options: CompileScriptOptions = {}): CompileScriptResult {
  const diagnostics: ScriptDiagnostic[] = []
  const capturedVariables = new Set<string>()
  const availableCusips = new Set((options.availableCusips ?? []).map((cusip) => cusip.toUpperCase()))
  const lines = code.split('\n')
  const compiledLines: string[] = []
  const blockStack: ScriptBlockKind[] = []

  let index = 0
  while (index < lines.length) {
    const basketBlock = parseBasketBlock(lines, index, diagnostics, availableCusips)
    if (basketBlock) {
      compiledLines.push(basketBlock.compiledBasket)
      capturedVariables.add(basketBlock.variableName)
      index = basketBlock.nextIndex
      continue
    }

    const pythonInlineIfElse = compilePythonInlineIfElse(lines, index)
    if (pythonInlineIfElse) {
      compiledLines.push(pythonInlineIfElse.compiledLine.code)
      index = pythonInlineIfElse.nextIndex
      continue
    }

    const compiledLine = compileCompatibilityLine(lines[index], blockStack[blockStack.length - 1])
    compiledLines.push(compiledLine.code)

    if (compiledLine.closes) {
      const openBlock = blockStack.pop()
      if (openBlock && openBlock !== compiledLine.closes) {
        diagnostics.push({
          level: 'warning',
          line: index + 1,
          message: `Closed ${compiledLine.closes} block while ${openBlock} block was still open.`
        })
      }
    }

    if (compiledLine.opens) {
      blockStack.push(compiledLine.opens)
    }

    const assignment = compiledLine.code.match(assignmentPattern)
    if (assignment && identifierPattern.test(assignment[1]) && !reservedCaptures.has(assignment[1])) {
      capturedVariables.add(assignment[1])
    }

    const declaration = compiledLine.code.match(declarationPattern)
    if (declaration && identifierPattern.test(declaration[1]) && !reservedCaptures.has(declaration[1])) {
      capturedVariables.add(declaration[1])
    }

    compiledLine.captures?.forEach((name) => {
      if (identifierPattern.test(name) && !reservedCaptures.has(name)) {
        capturedVariables.add(name)
      }
    })

    index++
  }

  blockStack.forEach((block) => {
    diagnostics.push({
      level: 'warning',
      line: lines.length,
      message: `Unclosed ${block} block. Add ${block === 'if' ? 'End If' : block === 'for' ? 'Next' : block === 'while' ? 'Loop' : 'End Select'}.`
    })
  })

  return {
    code: compiledLines.join('\n'),
    diagnostics,
    capturedVariables: Array.from(capturedVariables)
  }
}
