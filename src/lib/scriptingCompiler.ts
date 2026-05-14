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

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const assignmentPattern = /^\s*(?:(?:let|const|var)\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=/
const reservedCaptures = new Set([
  '__result__',
  '__controlFlow__',
  'if',
  'for',
  'while',
  'return',
  'const',
  'let',
  'var'
])

const splitInlineList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeCondition = (condition: string) =>
  condition
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')

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

const compileCompatibilityLine = (line: string) => {
  const indent = line.match(/^\s*/)?.[0] ?? ''
  const trimmed = line.trim()

  const conditional = trimmed.match(/^if\s+(.+):\s*(next|goto|stop|pass|fail|missing_data)(?:\s+(.+))?$/i)
  if (conditional) {
    const [, condition, action, target] = conditional
    return `${indent}if (${normalizeCondition(condition)}) { ${actionToCall(action.toLowerCase(), target?.trim())} }`
  }

  const whileGoto = trimmed.match(/^while\s+(.+):\s*goto\s+(.+)$/i)
  if (whileGoto) {
    const [, condition, target] = whileGoto
    return `${indent}if (${normalizeCondition(condition)}) { ${actionToCall('goto', target.trim())} }`
  }

  const gotoLabel = trimmed.match(/^goto\s*:\s*(.+)$/i)
  if (gotoLabel) {
    return `${indent}${actionToCall('goto', gotoLabel[1].trim())}`
  }

  const bareGoto = trimmed.match(/^goto\s+(.+)$/i)
  if (bareGoto) {
    return `${indent}${actionToCall('goto', bareGoto[1].trim())}`
  }

  const bareAction = trimmed.match(/^(next|stop|pass|fail|missing_data)$/i)
  if (bareAction) {
    return `${indent}${actionToCall(bareAction[1].toLowerCase())}`
  }

  return line
}

function parseBasketBlock(lines: string[], startIndex: number, diagnostics: ScriptDiagnostic[], availableCusips: Set<string>) {
  const startLine = lines[startIndex]
  const basketMatch = startLine.match(/^(\s*)basket\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*$/)
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

export function compileScriptingCode(code: string, options: CompileScriptOptions = {}): CompileScriptResult {
  const diagnostics: ScriptDiagnostic[] = []
  const capturedVariables = new Set<string>()
  const availableCusips = new Set((options.availableCusips ?? []).map((cusip) => cusip.toUpperCase()))
  const lines = code.split('\n')
  const compiledLines: string[] = []

  let index = 0
  while (index < lines.length) {
    const basketBlock = parseBasketBlock(lines, index, diagnostics, availableCusips)
    if (basketBlock) {
      compiledLines.push(basketBlock.compiledBasket)
      capturedVariables.add(basketBlock.variableName)
      index = basketBlock.nextIndex
      continue
    }

    const compiledLine = compileCompatibilityLine(lines[index])
    compiledLines.push(compiledLine)

    const assignment = compiledLine.match(assignmentPattern)
    if (assignment && identifierPattern.test(assignment[1]) && !reservedCaptures.has(assignment[1])) {
      capturedVariables.add(assignment[1])
    }

    index++
  }

  return {
    code: compiledLines.join('\n'),
    diagnostics,
    capturedVariables: Array.from(capturedVariables)
  }
}
