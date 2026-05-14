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
  | 'optimization'
  | 'constraint'
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

export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'dataframe' | 'series' | 'any'

export type FailureBehavior = 'halt' | 'skip' | 'retry' | 'default' | 'warn'

export interface TypedField {
  name: string
  type: DataType
  required: boolean
  description?: string
  default?: any
  validation?: ValidationRule[]
}

export interface ValidationRule {
  id: string
  type: 'range' | 'pattern' | 'custom' | 'required' | 'type' | 'length'
  value?: any
  value2?: any
  customFn?: string
  message?: string
}

export interface CellContract {
  inputs: TypedField[]
  outputs: TypedField[]
  requiredContext: string[]
  requiredFields: string[]
  validation: ValidationRule[]
  failureBehavior: FailureBehavior
  retryConfig?: {
    maxRetries: number
    backoff: 'linear' | 'exponential'
    fallbackValue?: any
  }
  description?: string
  tags?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    rule: string
    message: string
  }>
  warnings: Array<{
    field: string
    message: string
  }>
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
  collapsed?: boolean
  rowCountDelta?: number
  sampleOutput?: string
  contract?: CellContract
  validationResult?: ValidationResult
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
  action: 'next' | 'goto' | 'stop' | 'loop' | 'while' | 'pass' | 'fail' | 'missing_data' | 'error'
  target?: number
  label?: string
  backwardJumpJustification?: string
  loopConfig?: {
    startCell: number
    endCell: number
    maxIterations: number
    exitCondition?: string
  }
}

export interface RunTraceEntry {
  cellIndex: number
  cellLabel?: string
  action: string
  condition?: string
  result?: string
  timestamp: number
  branchTaken?: string
  reasonCode?: string
}

export interface ExecutionPath {
  fromCell: number
  toCell: number
  condition?: string
  type: 'default' | 'conditional' | 'loop' | 'branch'
  probability?: number
}

export type ConstraintType = 'hard' | 'soft'
export type ConstraintLevel = 'position' | 'issuer' | 'sector' | 'credit' | 'duration' | 'liquidity' | 'custom'

export interface PortfolioConstraint {
  id: string
  name: string
  type: ConstraintType
  level: ConstraintLevel
  operator: '>' | '<' | '>=' | '<=' | '=' | 'between'
  value: number
  value2?: number
  unit?: '%' | '$' | 'years' | 'score' | 'rating'
  penalty?: number
  description?: string
  enabled: boolean
}

export type OptimizationObjective = 
  | 'maximize_yield'
  | 'maximize_return'
  | 'minimize_risk'
  | 'minimize_tracking_error'
  | 'custom_score'

export interface OptimizationConfig {
  objective: OptimizationObjective
  customObjective?: string
  constraints: string[]
  secondaryObjective?: string
  turnoverLimit?: number
  enabled: boolean
}

export type TradeAction = 'buy' | 'sell' | 'hold' | 'reduce' | 'increase'
export type TradeReason = 
  | 'BUY_HIGH_SCORE'
  | 'SELL_FAILED_RATING'
  | 'SELL_DURATION_LIMIT'
  | 'HOLD_WITHIN_TOLERANCE'
  | 'REDUCE_ISSUER_EXPOSURE'
  | 'REDUCE_SECTOR_EXPOSURE'
  | 'INCREASE_TO_TARGET'
  | 'REBALANCE'
  | 'OPTIMIZATION'

export interface Trade {
  id: string
  security: string
  cusip: string
  action: TradeAction
  quantity?: number
  price?: number
  reason: TradeReason
  reasonDetails?: string
  score?: number
}

export type TimeWindow = '1M' | '3M' | '6M' | '1Y' | 'custom'
export type RollingCalculation = 
  | 'rolling_average'
  | 'rolling_volatility'
  | 'rolling_yield'
  | 'rolling_spread'
  | 'rolling_return'
  | 'price_momentum'
  | 'spread_change'

export interface TimeSeriesConfig {
  window: TimeWindow
  customDays?: number
  calculation: RollingCalculation
  field: string
}

export interface CellComment {
  id: string
  cellId: string
  author: string
  authorAvatar?: string
  text: string
  timestamp: number
  parentId?: string
  resolved?: boolean
}

export interface BacktestConfig {
  startCapital: number
  startDate?: Date
  endDate?: Date
  transactionCost: number
  volumeCapPct: number
  slippageModel: 'fixed' | 'adaptive' | 'custom'
  customSlippageFn?: string
}

export interface BacktestPosition {
  symbol: string
  shares: number
  entryPrice: number
  entryDate: Date
}

export interface BacktestTrade {
  date: Date
  symbol: string
  action: 'buy' | 'sell'
  shares: number
  price: number
  executionPrice: number
  slippage: number
  commission: number
  reason: string
}

export interface BacktestMetrics {
  CAGR: number
  Sharpe: number
  Sortino: number
  Calmar: number
  MaxDD: number
  Vol: number
  Trades_Yr: number
  Final: number
  Years: number
  totalReturn: number
}

export interface BacktestResult {
  equity: Array<{ date: Date; value: number; holding?: string; [key: string]: any }>
  trades: BacktestTrade[]
  metrics: BacktestMetrics
  positions: BacktestPosition[]
}

export interface TimeSeriesData {
  symbol: string
  data: Array<{
    date: Date
    open?: number
    high?: number
    low?: number
    close: number
    volume?: number
    [key: string]: any
  }>
}

export interface StrategySignal {
  date: Date
  action: 'buy' | 'sell' | 'hold'
  symbol?: string
  reason?: string
  [key: string]: any
}
