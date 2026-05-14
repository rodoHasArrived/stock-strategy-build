export type CellValue = string | number | boolean | null

export type CellType = 'value' | 'formula' | 'parameter' | 'error'

export interface Cell {
  id: string
  row: number
  col: number
  value: CellValue
  displayValue: string
  formula?: string
  type: CellType
  error?: string
  isCalculating?: boolean
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
  cells: Record<string, Cell>
  parameters: Parameter[]
  conditions: Condition[]
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
