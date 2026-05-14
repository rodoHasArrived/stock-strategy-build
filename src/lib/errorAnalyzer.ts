import { CodeCell, ExecutionContext } from './types'

export interface SmartError {
  message: string
  why?: string
  suggestedFixes?: string[]
  context?: {
    cellIndex: number
    cellLabel?: string
    availableVariables?: string[]
    missingVariable?: string
    createdInCell?: number
  }
}

export class ErrorAnalyzer {
  private cells: CodeCell[]
  private context: ExecutionContext
  private currentCellIndex: number

  constructor(cells: CodeCell[], context: ExecutionContext, currentCellIndex: number) {
    this.cells = cells
    this.context = context
    this.currentCellIndex = currentCellIndex
  }

  public analyzeError(error: Error | string): SmartError {
    const errorMessage = error instanceof Error ? error.message : error
    
    if (this.isUndefinedVariableError(errorMessage)) {
      return this.handleUndefinedVariable(errorMessage)
    }
    
    if (this.isTypeError(errorMessage)) {
      return this.handleTypeError(errorMessage)
    }
    
    if (this.isSyntaxError(errorMessage)) {
      return this.handleSyntaxError(errorMessage)
    }
    
    if (this.isReferenceError(errorMessage)) {
      return this.handleReferenceError(errorMessage)
    }

    return {
      message: errorMessage,
      suggestedFixes: ['Check your code syntax', 'Review available variables']
    }
  }

  private isUndefinedVariableError(message: string): boolean {
    return message.includes('is not defined') || 
           message.includes('undefined') ||
           message.includes('Cannot read')
  }

  private isTypeError(message: string): boolean {
    return message.includes('TypeError') || 
           message.includes('is not a function') ||
           message.includes('Cannot read properties')
  }

  private isSyntaxError(message: string): boolean {
    return message.includes('SyntaxError') ||
           message.includes('Unexpected token')
  }

  private isReferenceError(message: string): boolean {
    return message.includes('ReferenceError') ||
           message.includes('not defined')
  }

  private handleUndefinedVariable(errorMessage: string): SmartError {
    const variableMatch = errorMessage.match(/(\w+) is not defined/)
    if (!variableMatch) {
      return { message: errorMessage }
    }

    const missingVariable = variableMatch[1]
    const currentCell = this.cells[this.currentCellIndex]
    const cellLabel = currentCell?.label || `Cell ${this.currentCellIndex.toString().padStart(2, '0')}`
    
    const createdInCell = this.findVariableDefinition(missingVariable)
    const availableVariables = Object.keys(this.context.variables).filter(v => 
      !v.startsWith('__') && typeof this.context.variables[v] !== 'function'
    )

    let why: string | undefined
    const suggestedFixes: string[] = []

    if (createdInCell !== undefined && createdInCell > this.currentCellIndex) {
      why = `${missingVariable} is created in Cell ${createdInCell.toString().padStart(2, '0')}, which runs after this cell.`
      suggestedFixes.push(
        `Move Cell ${createdInCell.toString().padStart(2, '0')} before ${cellLabel}`,
        `Create ${missingVariable} in an earlier cell`,
        `Change this condition to use a variable already available`
      )
    } else if (createdInCell === undefined) {
      why = `${missingVariable} has not been created in any previous cell.`
      suggestedFixes.push(
        `Create ${missingVariable} in a cell before ${cellLabel}`,
        `Check for typos in the variable name`,
        availableVariables.length > 0 
          ? `Use one of these available variables: ${availableVariables.slice(0, 5).join(', ')}`
          : 'Define variables in earlier cells first'
      )
    } else {
      why = `${missingVariable} may have been overwritten or cleared.`
      suggestedFixes.push(
        `Check Cell ${createdInCell.toString().padStart(2, '0')} to ensure ${missingVariable} is set correctly`,
        `Verify no cells between ${createdInCell} and ${this.currentCellIndex} clear this variable`
      )
    }

    return {
      message: `The variable '${missingVariable}' is not available in ${cellLabel}.`,
      why,
      suggestedFixes,
      context: {
        cellIndex: this.currentCellIndex,
        cellLabel,
        availableVariables,
        missingVariable,
        createdInCell
      }
    }
  }

  private handleTypeError(errorMessage: string): SmartError {
    const functionMatch = errorMessage.match(/(\w+) is not a function/)
    const propertyMatch = errorMessage.match(/Cannot read propert(?:y|ies) of (\w+)/)
    
    const currentCell = this.cells[this.currentCellIndex]
    const cellLabel = currentCell?.label || `Cell ${this.currentCellIndex.toString().padStart(2, '0')}`

    if (functionMatch) {
      const attemptedFunction = functionMatch[1]
      return {
        message: `'${attemptedFunction}' is not a function in ${cellLabel}.`,
        why: `You're trying to call ${attemptedFunction}() but it's not a function or doesn't exist.`,
        suggestedFixes: [
          `Check if ${attemptedFunction} is a valid AMX function (PRICE, YIELD, COUPON, etc.)`,
          `Verify ${attemptedFunction} was defined correctly in a previous cell`,
          `Check for typos in the function name`
        ],
        context: {
          cellIndex: this.currentCellIndex,
          cellLabel
        }
      }
    }

    if (propertyMatch) {
      const nullValue = propertyMatch[1]
      return {
        message: `Cannot access property of ${nullValue} in ${cellLabel}.`,
        why: `You're trying to access a property on ${nullValue}, which doesn't have properties.`,
        suggestedFixes: [
          `Add a null check: if (${nullValue}) { ... }`,
          `Ensure the variable is initialized before use`,
          `Check if a previous cell failed to set this value`
        ],
        context: {
          cellIndex: this.currentCellIndex,
          cellLabel
        }
      }
    }

    return {
      message: `Type error in ${cellLabel}: ${errorMessage}`,
      suggestedFixes: [
        'Check that variables are the expected type',
        'Add type validation before operations'
      ],
      context: {
        cellIndex: this.currentCellIndex,
        cellLabel
      }
    }
  }

  private handleSyntaxError(errorMessage: string): SmartError {
    const currentCell = this.cells[this.currentCellIndex]
    const cellLabel = currentCell?.label || `Cell ${this.currentCellIndex.toString().padStart(2, '0')}`

    return {
      message: `Syntax error in ${cellLabel}.`,
      why: errorMessage,
      suggestedFixes: [
        'Check for missing parentheses, brackets, or quotes',
        'Verify correct operator usage (=, ==, ===)',
        'Ensure proper line breaks and semicolons'
      ],
      context: {
        cellIndex: this.currentCellIndex,
        cellLabel
      }
    }
  }

  private handleReferenceError(errorMessage: string): SmartError {
    return this.handleUndefinedVariable(errorMessage)
  }

  private findVariableDefinition(variableName: string): number | undefined {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i]
      if (!cell.code) continue
      
      const assignmentPattern = new RegExp(`(let|const|var)?\\s*${variableName}\\s*=`)
      if (assignmentPattern.test(cell.code)) {
        return i
      }
    }
    return undefined
  }

  public getAvailableVariables(): string[] {
    return Object.keys(this.context.variables).filter(v => 
      !v.startsWith('__') && typeof this.context.variables[v] !== 'function'
    )
  }

  public getAvailableFunctions(): string[] {
    return Object.keys(this.context.variables).filter(v => 
      typeof this.context.variables[v] === 'function'
    )
  }
}

export function formatSmartError(smartError: SmartError): string {
  let output = `❌ ${smartError.message}\n`
  
  if (smartError.why) {
    output += `\n💡 Why:\n  ${smartError.why}\n`
  }
  
  if (smartError.suggestedFixes && smartError.suggestedFixes.length > 0) {
    output += `\n🔧 Suggested fixes:\n`
    smartError.suggestedFixes.forEach((fix, idx) => {
      output += `  ${idx + 1}. ${fix}\n`
    })
  }
  
  return output
}
