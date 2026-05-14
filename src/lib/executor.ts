import { CodeCell, ExecutionContext, Parameter, Security } from './types'
import { mockSecurities } from './mockData'

export class StrategyExecutor {
  private context: ExecutionContext
  private cells: CodeCell[]
  private parameters: Parameter[]
  private securities: Security[]

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

      return {
        ...cell,
        status: 'success',
        output: result != null ? String(result) : '',
        executionTime,
        controlFlow: controlFlow.type !== 'none' ? controlFlow : undefined
      }
    } catch (error) {
      const executionTime = performance.now() - startTime
      return {
        ...cell,
        status: 'error',
        output: '',
        error: error instanceof Error ? error.message : String(error),
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

  public async executeAll(): Promise<CodeCell[]> {
    const results: CodeCell[] = [...this.cells]
    let currentIndex = 0
    this.context.iterationCount = 0

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
    }

    return results
  }

  public getContext(): ExecutionContext {
    return { ...this.context }
  }
}
