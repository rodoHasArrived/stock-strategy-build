export type CellValue = string | number | boolean | null | any

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export type ControlFlowType = 'next' | 'goto' | 'if' | 'none'

export interface Cell {
  id: string
  row: number
  col: number
  value: CellValue
  displayValue: string
  type: 'value' | 'formula' | 'error'
  formula?: string
  error?: string
  isCalculating?: boolean
}

export interface CodeCell {
  id: string
  index: number
  code: string
  output: string
  error?: string
  status: ExecutionStatus
  executionTime?: number
  controlFlow?: {
    type: ControlFlowType
    target?: number
    condition?: string
  }
}

export interface ExecutionContext {
  variables: Record<string, any>
  currentCell: number
  maxIterations: number
  iterationCount: number
}

export interface Parameter {
  id: string
  name: string
  value: number | string
  type: 'number' | 'text' | 'boolean'
  description?: string
}

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'between'
export type ConditionLogic = 'AND' | 'OR'

export interface Condition {
  id: string
  field: string
  operator: ConditionOperator
  value: number | string
  value2?: number
  logic?: ConditionLogic
}

export interface Security {
  cusip: string
  name: string
  price: number
  yield: number
  coupon: number
  maturity: string
  duration: number
  rating: string
  spread?: number
}

export interface Strategy {
  id: string
  name: string
  description: string
  cells: CodeCell[]
  parameters: Parameter[]
  createdAt: number
  updatedAt: number
}

export interface StrategyTemplate {
  id: string
  name: string
  description: string
  category: string
  strategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>
}
