import { CodeCell, ExecutionContext, Parameter, RunTraceEntry, Security } from './types'
import { mockSecurities } from './mockData'
import { ErrorAnalyzer, formatSmartError } from './errorAnalyzer'
import { Basket, createBasketFactory, isBasket } from './basket'
import { compileScriptingCode, ScriptDiagnostic } from './scriptingCompiler'

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
  private prevRowCounts: Map<number, number> = new Map()
  private readonly createBasket: (options: ConstructorParameters<typeof Basket>[0]) => Basket

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
    this.createBasket = createBasketFactory(securities)
    
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
    const getSecurity = (cusip: string) => this.securities.find(s => s.cusip.toUpperCase() === cusip.toUpperCase())
    const getBasketMetric = (basket: Basket, metricName: string) => basket.metric(metricName)

    this.context.variables['PRICE'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'PRICE')
      const security = getSecurity(target)
      return security?.price ?? null
    }

    this.context.variables['YIELD'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'YIELD')
      const security = getSecurity(target)
      return security?.yield ?? null
    }

    this.context.variables['COUPON'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'COUPON')
      const security = getSecurity(target)
      return security?.coupon ?? null
    }

    this.context.variables['DURATION'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'DURATION')
      const security = getSecurity(target)
      return security?.duration ?? null
    }

    this.context.variables['SPREAD'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'SPREAD')
      const security = getSecurity(target)
      return security?.spread ?? null
    }

    this.context.variables['RATING'] = (target: string | Basket) => {
      if (isBasket(target)) return getBasketMetric(target, 'RATING')
      const security = getSecurity(target)
      return security?.rating ?? null
    }

    this.context.variables['securities'] = this.securities
  }

  private createSafeFunction(code: string, capturedVariables: string[]): Function {
    const varDeclarations = Object.keys(this.context.variables)
      .map(key => `let ${key} = __context__.${key}`)
      .join(';\n')
    const snapshotNames = Array.from(new Set([...Object.keys(this.context.variables), ...capturedVariables]))

    const fullCode = `
      ${varDeclarations};
      
      let __result__ = null;
      let __controlFlow__ = { type: 'none' };
      const __snapshotNames__ = ${JSON.stringify(snapshotNames)};
      const __setVar__ = (name, value) => {
        __context__[name] = value;
        return value;
      };
      const __completeFlow__ = (flow, resultValue) => {
        __controlFlow__ = flow;
        if (resultValue !== undefined) {
          __result__ = resultValue;
        }
        throw { __strategyFlow__: true };
      };
      const __snapshotVariables__ = () => {
        const variables = {};
        for (const name of __snapshotNames__) {
          try {
            variables[name] = eval(name);
          } catch {
            if (name in __context__) {
              variables[name] = __context__[name];
            }
          }
        }
        return variables;
      };
      const __createBasket__ = (options) => __createBasketFactory__(options);
      function result(value) {
        __result__ = value;
        __setVar__('__lastResult__', value);
        return value;
      }
      function next() {
        __completeFlow__({ type: 'next' });
      }
      function goto(target) {
        __completeFlow__({ type: 'goto', target: Number(target) });
      }
      function stop(reason) {
        __completeFlow__({ type: 'stop', condition: reason });
      }
      function pass(reason) {
        __completeFlow__({ type: 'pass', condition: reason });
      }
      function fail(reason) {
        __completeFlow__({ type: 'fail', condition: reason });
      }
      function missingData(reason) {
        __completeFlow__({ type: 'missing_data', condition: reason });
      }
      
      try {
        ${code}
      } catch (error) {
        if (!error || error.__strategyFlow__ !== true) {
          throw error;
        }
      }
      
      return {
        result: __result__,
        controlFlow: __controlFlow__,
        variables: __snapshotVariables__()
      };
    `

    return new Function('__context__', '__createBasketFactory__', fullCode)
  }

  private formatDiagnostics(diagnostics: ScriptDiagnostic[]): string | undefined {
    if (diagnostics.length === 0) return undefined
    return diagnostics
      .map((diagnostic) => `${diagnostic.level.toUpperCase()} line ${diagnostic.line}: ${diagnostic.message}`)
      .join('\n')
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
      const compiledCode = compileScriptingCode(cell.code, {
        availableCusips: this.securities.map((security) => security.cusip)
      })

      const blockingDiagnostic = compiledCode.diagnostics.find((diagnostic) => diagnostic.level === 'error')
      if (blockingDiagnostic) {
        throw new Error(this.formatDiagnostics(compiledCode.diagnostics))
      }

      const fn = this.createSafeFunction(compiledCode.code, compiledCode.capturedVariables)
      const execution = fn(this.context.variables, this.createBasket)

      Object.keys(execution.variables).forEach(key => {
        if (this.context.variables[key] !== execution.variables[key]) {
          this.context.variables[key] = execution.variables[key]
        }
      })

      const result = execution.result
      const controlFlow = execution.controlFlow || { type: 'none' }

      const executionTime = performance.now() - startTime

      // Compute row-count delta and sample output
      let rowCountDelta: number | undefined
      let sampleOutput: string | undefined

      if (result != null) {
        if (Array.isArray(result)) {
          const prevLen = this.prevRowCounts.get(cellIndex) ?? 0
          rowCountDelta = result.length - prevLen
          this.prevRowCounts.set(cellIndex, result.length)
          sampleOutput = JSON.stringify(result.slice(0, 3), null, 2)
        } else if (typeof result === 'object' && result !== null && 'data' in result && Array.isArray((result as any).data)) {
          const df = result as any
          const prevLen = this.prevRowCounts.get(cellIndex) ?? 0
          rowCountDelta = df.data.length - prevLen
          this.prevRowCounts.set(cellIndex, df.data.length)
          sampleOutput = JSON.stringify(df.data.slice(0, 3), null, 2)
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
        result: result != null ? String(result).slice(0, 100) : this.formatDiagnostics(compiledCode.diagnostics),
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
        } else if (result.controlFlow.type === 'stop') {
          break
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
