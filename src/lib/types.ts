export type CellValue = string | number | boolean | null | any

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export type ControlFlowType = 'next' | 'goto' | 'if' | 'loop' | 'while' | 'stop' | 'none'

export type CellMode = 'visual' | 'formula' | 'code'

export type CellPurpose = 
  | 'universe' 
  | 'data' 
  | 'calculation' 
  | 'condition' 
  | 'ranking' 
  | 'portfolio' 
  | 'risk' 
  | 'trade'
  | 'general'

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
  mode: CellMode
  purpose: CellPurpose
  label?: string
  controlFlow?: {
    type: ControlFlowType
    target?: number
    condition?: string
  }
  visualConfig?: {
    conditions?: Condition[]
    dataFields?: string[]
    aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count'
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
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
  value2?: number | string
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

export interface TransitionRule {
  id: string
  condition?: string
  action: 'next' | 'goto' | 'stop' | 'loop' | 'while'
  target?: number
  label?: string
  loopConfig?: {
    startCell: number
    endCell: number
    maxIterations: number
    exitCondition?: string
  }
}

export interface ExecutionPath {
  fromCell: number
  toCell: number
  condition?: string
  type: 'default' | 'conditional' | 'loop' | 'branch'
  probability?: number
}
