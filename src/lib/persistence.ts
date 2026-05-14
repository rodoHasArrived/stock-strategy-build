import { Strategy, ExecutionTrace, BacktestResult } from './types'

const STORAGE_PREFIX = '_private_strategy_'
const TRACE_PREFIX = '_private_trace_'
const BACKTEST_PREFIX = '_private_backtest_'

export class PrivatePersistence {
  private getUserPrefix(): string {
    return STORAGE_PREFIX
  }

  async saveStrategy(strategy: Strategy): Promise<void> {
    const key = `${this.getUserPrefix()}${strategy.id}`
    await window.spark.kv.set(key, strategy)
  }

  async loadStrategy(strategyId: string): Promise<Strategy | undefined> {
    const key = `${this.getUserPrefix()}${strategyId}`
    return await window.spark.kv.get<Strategy>(key)
  }

  async listStrategies(): Promise<Strategy[]> {
    const keys = await window.spark.kv.keys()
    const prefix = this.getUserPrefix()
    const strategyKeys = keys.filter((k: string) => k.startsWith(prefix))
    
    const strategies: Strategy[] = []
    for (const key of strategyKeys) {
      const strategy = await window.spark.kv.get<Strategy>(key)
      if (strategy) {
        strategies.push(strategy)
      }
    }
    
    return strategies.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async deleteStrategy(strategyId: string): Promise<void> {
    const key = `${this.getUserPrefix()}${strategyId}`
    await window.spark.kv.delete(key)
  }

  async saveExecutionTrace(strategyId: string, trace: ExecutionTrace): Promise<void> {
    const key = `${TRACE_PREFIX}${strategyId}_${Date.now()}`
    await window.spark.kv.set(key, trace)
  }

  async getExecutionTraces(strategyId: string, limit: number = 10): Promise<ExecutionTrace[]> {
    const keys = await window.spark.kv.keys()
    const prefix = `${TRACE_PREFIX}${strategyId}_`
    const traceKeys = keys
      .filter((k: string) => k.startsWith(prefix))
      .sort()
      .reverse()
      .slice(0, limit)
    
    const traces: ExecutionTrace[] = []
    for (const key of traceKeys) {
      const trace = await window.spark.kv.get<ExecutionTrace>(key)
      if (trace) {
        traces.push(trace)
      }
    }
    
    return traces
  }

  async saveBacktestResult(strategyId: string, result: BacktestResult): Promise<void> {
    const key = `${BACKTEST_PREFIX}${strategyId}_${Date.now()}`
    await window.spark.kv.set(key, result)
  }

  async getBacktestResults(strategyId: string, limit: number = 5): Promise<BacktestResult[]> {
    const keys = await window.spark.kv.keys()
    const prefix = `${BACKTEST_PREFIX}${strategyId}_`
    const backtestKeys = keys
      .filter((k: string) => k.startsWith(prefix))
      .sort()
      .reverse()
      .slice(0, limit)
    
    const results: BacktestResult[] = []
    for (const key of backtestKeys) {
      const result = await window.spark.kv.get<BacktestResult>(key)
      if (result) {
        results.push(result)
      }
    }
    
    return results
  }

  async clearAllPrivateData(): Promise<void> {
    const keys = await window.spark.kv.keys()
    const privateKeys = keys.filter((k: string) => 
      k.startsWith(STORAGE_PREFIX) || 
      k.startsWith(TRACE_PREFIX) || 
      k.startsWith(BACKTEST_PREFIX)
    )
    
    for (const key of privateKeys) {
      await window.spark.kv.delete(key)
    }
  }
}

export const privatePersistence = new PrivatePersistence()
