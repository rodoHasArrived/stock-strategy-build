import { CellContract, ValidationResult, ExecutionContext, CodeCell } from '@/lib/types'

export class ContractValidator {
  static validateContract(
    contract: CellContract,
    context: ExecutionContext,
    cell: CodeCell
  ): ValidationResult {
    const errors: ValidationResult['errors'] = []
    const warnings: ValidationResult['warnings'] = []

    for (const input of contract.inputs) {
      if (input.required && !(input.name in context.variables)) {
        errors.push({
          field: input.name,
          rule: 'required',
          message: `Required input "${input.name}" is missing from context`
        })
      }

      if (input.name in context.variables) {
        const value = context.variables[input.name]
        const actualType = this.inferType(value)
        
        if (input.type !== 'any' && actualType !== input.type && !this.isCompatibleType(actualType, input.type)) {
          errors.push({
            field: input.name,
            rule: 'type',
            message: `Input "${input.name}" expected type ${input.type}, but got ${actualType}`
          })
        }

        for (const validation of input.validation || []) {
          const validationError = this.validateRule(input.name, value, validation)
          if (validationError) {
            errors.push(validationError)
          }
        }
      }
    }

    for (const ctx of contract.requiredContext) {
      if (!(ctx in context.variables)) {
        errors.push({
          field: ctx,
          rule: 'required',
          message: `Required context variable "${ctx}" is missing`
        })
      }
    }

    for (const field of contract.requiredFields) {
      if (!this.checkFieldAvailability(field, context)) {
        warnings.push({
          field,
          message: `Required field "${field}" may not be available`
        })
      }
    }

    for (const validation of contract.validation) {
      const validationError = this.validateRule('cell', cell, validation)
      if (validationError) {
        errors.push(validationError)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  static validateOutput(
    contract: CellContract,
    output: any,
    context: ExecutionContext
  ): ValidationResult {
    const errors: ValidationResult['errors'] = []
    const warnings: ValidationResult['warnings'] = []

    if (typeof output === 'object' && output !== null) {
      for (const outputSpec of contract.outputs) {
        if (outputSpec.required && !(outputSpec.name in output)) {
          errors.push({
            field: outputSpec.name,
            rule: 'required',
            message: `Required output "${outputSpec.name}" is missing`
          })
        }

        if (outputSpec.name in output) {
          const value = output[outputSpec.name]
          const actualType = this.inferType(value)
          
          if (outputSpec.type !== 'any' && actualType !== outputSpec.type && !this.isCompatibleType(actualType, outputSpec.type)) {
            errors.push({
              field: outputSpec.name,
              rule: 'type',
              message: `Output "${outputSpec.name}" expected type ${outputSpec.type}, but got ${actualType}`
            })
          }

          for (const validation of outputSpec.validation || []) {
            const validationError = this.validateRule(outputSpec.name, value, validation)
            if (validationError) {
              errors.push(validationError)
            }
          }
        }
      }
    } else if (contract.outputs.length > 0) {
      const singleOutput = contract.outputs[0]
      const actualType = this.inferType(output)
      
      if (singleOutput.type !== 'any' && actualType !== singleOutput.type && !this.isCompatibleType(actualType, singleOutput.type)) {
        errors.push({
          field: singleOutput.name,
          rule: 'type',
          message: `Output expected type ${singleOutput.type}, but got ${actualType}`
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  private static validateRule(fieldName: string, value: any, rule: any): ValidationResult['errors'][0] | null {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field: fieldName,
            rule: 'required',
            message: rule.message || `${fieldName} is required`
          }
        }
        break

      case 'type':
        const actualType = this.inferType(value)
        if (actualType !== rule.value) {
          return {
            field: fieldName,
            rule: 'type',
            message: rule.message || `Expected type ${rule.value}, got ${actualType}`
          }
        }
        break

      case 'range':
        const numValue = Number(value)
        if (!isNaN(numValue)) {
          const min = rule.value !== undefined ? Number(rule.value) : -Infinity
          const max = rule.value2 !== undefined ? Number(rule.value2) : Infinity
          if (numValue < min || numValue > max) {
            return {
              field: fieldName,
              rule: 'range',
              message: rule.message || `Value must be between ${min} and ${max}`
            }
          }
        }
        break

      case 'length':
        const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0
        const minLen = rule.value !== undefined ? Number(rule.value) : 0
        const maxLen = rule.value2 !== undefined ? Number(rule.value2) : Infinity
        if (length < minLen || length > maxLen) {
          return {
            field: fieldName,
            rule: 'length',
            message: rule.message || `Length must be between ${minLen} and ${maxLen}`
          }
        }
        break

      case 'pattern':
        if (typeof value === 'string' && rule.value) {
          try {
            const regex = new RegExp(rule.value)
            if (!regex.test(value)) {
              return {
                field: fieldName,
                rule: 'pattern',
                message: rule.message || `Value does not match pattern ${rule.value}`
              }
            }
          } catch (e) {
            return {
              field: fieldName,
              rule: 'pattern',
              message: `Invalid regex pattern: ${rule.value}`
            }
          }
        }
        break

      case 'custom':
        if (rule.customFn) {
          try {
            const fn = new Function('value', 'context', rule.customFn)
            const result = fn(value, {})
            if (!result) {
              return {
                field: fieldName,
                rule: 'custom',
                message: rule.message || 'Custom validation failed'
              }
            }
          } catch (e) {
            return {
              field: fieldName,
              rule: 'custom',
              message: `Custom validation error: ${e}`
            }
          }
        }
        break
    }

    return null
  }

  private static inferType(value: any): string {
    if (value === null || value === undefined) return 'any'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') {
      if (value.constructor && value.constructor.name === 'DataFrame') return 'dataframe'
      if (value.constructor && value.constructor.name === 'Series') return 'series'
      return 'object'
    }
    return typeof value
  }

  private static isCompatibleType(actualType: string, expectedType: string): boolean {
    if (expectedType === 'any') return true
    if (actualType === 'any') return true
    
    const numberTypes = ['number', 'series']
    if (numberTypes.includes(expectedType) && numberTypes.includes(actualType)) return true
    
    const objectTypes = ['object', 'dataframe', 'array']
    if (objectTypes.includes(expectedType) && objectTypes.includes(actualType)) return true
    
    return false
  }

  private static checkFieldAvailability(field: string, context: ExecutionContext): boolean {
    return field in context.variables
  }

  static generateContractFromCode(code: string): Partial<CellContract> {
    const contract: Partial<CellContract> = {
      inputs: [],
      outputs: [],
      requiredContext: [],
      requiredFields: [],
      validation: [],
      failureBehavior: 'halt'
    }

    const variablePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
    const matches = code.matchAll(variablePattern)
    const variables = new Set<string>()
    
    for (const match of matches) {
      variables.add(match[1])
    }

    const assignmentPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g
    const assignments = code.matchAll(assignmentPattern)
    
    for (const assignment of assignments) {
      const varName = assignment[1]
      if (varName !== '__result__') {
        contract.outputs?.push({
          name: varName,
          type: 'any',
          required: false
        })
      }
    }

    return contract
  }
}
