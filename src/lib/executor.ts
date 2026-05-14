import { CodeCell, ExecutionContext, Parameter, RunTraceEntry, Security } from './types'
import { mockSecurities } from './mockData'
import { ErrorAnalyzer, formatSmartError } from './errorAnalyzer'

export interface LoopGuardViolation {
  cellIndex: number
  message: string
}

export function validateLoopGuards(cells: CodeCell[]): LoopGuardViolation[] {
  const violations: LoopGuardViolation[] = []

  cells.forEach((cell) => {
    // Detect explicit goto-based backward jumps
    if (
      cell.controlFlow &&
      cell.controlFlow.type === 'goto' &&
      cell.controlFlow.target != null &&
      cell.controlFlow.target <= cell.index
    ) {
      violations.push({
        cellIndex: cell.index,
        message: `Cell [${cell.index}] jumps backward to cell [${cell.controlFlow.target}] but has no loop guards. Add maxIterations and an exitCondition via the Transition Editor.`
      })
    }

    // Detect inline loop DSL in code (loop from … to …)
    if (cell.code && /\bloop\s+from\b/i.test(cell.code)) {
      const hasMax = /max_iterations\s*:/i.test(cell.code)
      const hasExit = /exit_when\s*:/i.test(cell.code)
      if (!hasMax || !hasExit) {
        violations.push({
          cellIndex: cell.index,
          message: `Cell [${cell.index}] declares a loop but is missing ${!hasMax ? 'max_iterations' : ''}${!hasMax && !hasExit ? ' and ' : ''}${!hasExit ? 'exit_when' : ''}. Loops must have both guards.`
        })
      }
    }
  })

  return violations
}

export class StrategyExecutor {
  private context: ExecutionContext
  private cells: CodeCell[]
  private parameters: Parameter[]
  private securities: Security[]
  private runTrace: RunTraceEntry[] = []

  constructor(cells: CodeCell[], parameters: Parameter[], securities: Security[] = mockSecurities) {
    this.cells = cells
    this.parameters = parameters
    this.securities = securities
    this.context = {
      variables: {},
      currentCell: 0,
      maxIterations: 1000,
      iterationCount: 0
    }
    
    this.initializeParameters()
    this.initializeMarketDataFunctions()
  }

  public getRunTrace(): RunTraceEntry[] {
    return [...this.runTrace]
  }

  private initializeParameters() {
    this.parameters.forEach(param => {
      this.context.variables[param.name] = param.value
    })
  }

  private initializeMarketDataFunctions() {
    this.context.variables['PRICE'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.price ?? null
    }

    this.context.variables['YIELD'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.yield ?? null
    }

    this.context.variables['COUPON'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.coupon ?? null
    }

    this.context.variables['DURATION'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.duration ?? null
    }

    this.context.variables['SPREAD'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.spread ?? null
    }

    this.context.variables['RATING'] = (cusip: string) => {
      const security = this.securities.find(s => s.cusip === cusip)
      return security?.rating ?? null
    }

    this.context.variables['securities'] = this.securities
  }

  private createSafeFunction(code: string): Function {
    const varDeclarations = Object.keys(this.context.variables)
      .map(key => `let ${key} = __context__.${key}`)
      .join(';\n')

    const fullCode = `
      ${varDeclarations};
      
      let __result__ = null;
      let __controlFlow__ = { type: 'none' };
      
      ${code}
      
      return {
        result: __result__,
        controlFlow: __controlFlow__,
        variables: {${Object.keys(this.context.variables).join(',')}}
      };
    `

    return new Function('__context__', fullCode)
  }

  public async executeCell(cellIndex: number): Promise<CodeCell> {
    const cell = this.cells[cellIndex]
    
    if (!cell || !cell.code.trim()) {
      return {
        ...cell,
        status: 'skipped',
        output: ''
      }
    }

    this.context.currentCell = cellIndex
    const startTime = performance.now()

    try {
      const parsedCode = this.parseControlFlow(cell.code)
      const fn = this.createSafeFunction(parsedCode.code)
      const execution = fn(this.context.variables)

      Object.keys(execution.variables).forEach(key => {
        if (this.context.variables[key] !== execution.variables[key]) {
          this.context.variables[key] = execution.variables[key]
        }
      })

      const result = execution.result
      const controlFlow = execution.controlFlow || parsedCode.controlFlow

      const executionTime = performance.now() - startTime

      // Compute row-count delta and sample output
      let rowCountDelta: number | undefined
      let sampleOutput: string | undefined

      if (result != null) {
        if (Array.isArray(result)) {
          const prevLen = (cell as any)._prevRowCount ?? 0
          rowCountDelta = result.length - prevLen
          sampleOutput = JSON.stringify(result.slice(0, 3), null, 2)
        } else if (typeof result === 'object' && result !== null && 'data' in result && Array.isArray((result as any).data)) {
          const df = result as any
          const prevLen = (cell as any)._prevRowCount ?? 0
          rowCountDelta = df.data.length - prevLen
          sampleOutput = JSON.stringify(df.data.slice(0, 3), null, 2)
        } else {
          sampleOutput = String(result).slice(0, 500)
        }
      }

      // Record trace entry
      const reasonCode = controlFlow && controlFlow.type !== 'none'
        ? controlFlow.type === 'goto'
          ? `GOTO_${controlFlow.target}`
          : controlFlow.type.toUpperCase()
        : 'FALL_THROUGH'

      this.runTrace.push({
        cellIndex,
        cellLabel: cell.label,
        action: controlFlow?.type !== 'none' ? controlFlow?.type ?? 'next' : 'next',
        condition: controlFlow?.condition,
        result: result != null ? String(result).slice(0, 100) : undefined,
        timestamp: Date.now(),
        branchTaken: controlFlow?.type !== 'none' && controlFlow?.type
          ? controlFlow.type === 'goto' ? `→ cell ${controlFlow.target}` : controlFlow.type
          : 'next',
        reasonCode
      })

      return {
        ...cell,
        status: 'success',
        output: result != null ? String(result) : '',
        executionTime,
        rowCountDelta,
        sampleOutput,
        controlFlow: controlFlow.type !== 'none' ? controlFlow : undefined
      }
    } catch (error) {
      const executionTime = performance.now() - startTime
      
      const errorAnalyzer = new ErrorAnalyzer(this.cells, this.context, cellIndex)
      const smartError = errorAnalyzer.analyzeError(error as Error)
      const formattedError = formatSmartError(smartError)

      this.runTrace.push({
        cellIndex,
        cellLabel: cell.label,
        action: 'error',
        timestamp: Date.now(),
        reasonCode: 'EXECUTION_ERROR'
      })
      
      return {
        ...cell,
        status: 'error',
        output: '',
        error: formattedError,
        executionTime
      }
    }
  }

  private parseControlFlow(code: string): { code: string; controlFlow: any } {
    const lines = code.split('\n')
    let modifiedCode = ''
    let controlFlow = { type: 'none' }

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('if ')) {
        const match = trimmed.match(/if\s+(.+):\s*(\w+)(?:\s+(.+))?/)
        if (match) {
          const [, condition, command, target] = match
          if (command === 'next') {
            modifiedCode += `if (${condition}) { __controlFlow__ = { type: 'next' }; __result__ = null; }\n`
          } else if (command === 'goto') {
            modifiedCode += `if (${condition}) { __controlFlow__ = { type: 'goto', target: ${target} }; __result__ = null; }\n`
          }
          continue
        }
      }

      if (trimmed === 'next') {
        modifiedCode += `__controlFlow__ = { type: 'next' }; __result__ = null;\n`
        continue
      }

      if (trimmed.startsWith('goto ')) {
        const target = trimmed.replace('goto ', '').trim()
        modifiedCode += `__controlFlow__ = { type: 'goto', target: ${target} }; __result__ = null;\n`
        continue
      }

      modifiedCode += line + '\n'
    }

    return { code: modifiedCode, controlFlow }
  }

  public async executeAll(): Promise<{ cells: CodeCell[]; runTrace: RunTraceEntry[] }> {
    // Enforce loop guards before any cell runs
    const violations = validateLoopGuards(this.cells)
    if (violations.length > 0) {
      const errorMsg = violations.map(v => v.message).join('\n')
      const errorCells = this.cells.map((cell, idx) => {
        const v = violations.find(x => x.cellIndex === idx)
        if (v) {
          return { ...cell, status: 'error' as const, error: v.message }
        }
        return { ...cell, status: 'skipped' as const }
      })
      this.runTrace.push({
        cellIndex: -1,
        action: 'error',
        result: errorMsg,
        timestamp: Date.now(),
        reasonCode: 'LOOP_GUARD_VIOLATION'
      })
      return { cells: errorCells, runTrace: this.getRunTrace() }
    }

    const results: CodeCell[] = [...this.cells]
    let currentIndex = 0
    this.context.iterationCount = 0
    this.runTrace = []

    while (currentIndex < this.cells.length && this.context.iterationCount < this.context.maxIterations) {
      this.context.iterationCount++

      const result = await this.executeCell(currentIndex)
      results[currentIndex] = result

      if (result.controlFlow) {
        if (result.controlFlow.type === 'next') {
          currentIndex++
        } else if (result.controlFlow.type === 'goto' && result.controlFlow.target != null) {
          currentIndex = result.controlFlow.target
        } else {
          currentIndex++
        }
      } else {
        currentIndex++
      }
    }

    if (this.context.iterationCount >= this.context.maxIterations) {
      results[currentIndex] = {
        ...results[currentIndex],
        status: 'error',
        error: 'Maximum iteration limit reached (possible infinite loop)'
      }
      this.runTrace.push({
        cellIndex: currentIndex,
        action: 'error',
        timestamp: Date.now(),
        reasonCode: 'MAX_ITERATIONS_EXCEEDED'
      })
    }

    return { cells: results, runTrace: this.getRunTrace() }
  }

  public getContext(): ExecutionContext {
    return { ...this.context }
  }
}
