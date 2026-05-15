import { DataFrame, readJSON, toDatetime, toNumeric } from './dataFrame'
import { BacktestSignal } from './types'

export type BacktestStrategyExecutor = (df: DataFrame, state: Record<string, unknown>) => BacktestSignal

export function createBacktestStrategyExecutor(strategyCode: string): BacktestStrategyExecutor {
  const fn = new Function(
    'df',
    'state',
    'DataFrame',
    'readJSON',
    'toDatetime',
    'toNumeric',
    strategyCode
  )

  return (df, state) => fn(df, state, DataFrame, readJSON, toDatetime, toNumeric) as BacktestSignal
}

