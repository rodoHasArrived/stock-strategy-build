import { DataFrame } from './dataFrame'
import { BacktestConfig, BacktestResult, BacktestMetrics, BacktestTrade, TimeSeriesData } from './types'

export class BacktestEngine {
  private config: BacktestConfig
  private timeSeriesData: Map<string, TimeSeriesData>

  constructor(config: Partial<BacktestConfig> = {}) {
    this.config = {
      startCapital: config.startCapital ?? 1000,
      transactionCost: config.transactionCost ?? 0.003,
      volumeCapPct: config.volumeCapPct ?? 0.25,
      slippageModel: config.slippageModel ?? 'adaptive',
      startDate: config.startDate,
      endDate: config.endDate,
      ...config
    }
    this.timeSeriesData = new Map()
  }

  loadTimeSeries(symbol: string, data: TimeSeriesData['data']): void {
    this.timeSeriesData.set(symbol, { symbol, data })
  }

  calculateSlippage(
    advDollars: number | null | undefined,
    floorBps: number = 5,
    capBps: number = 150,
    k: number = 0.20
  ): number {
    if (advDollars == null || isNaN(advDollars) || advDollars <= 0) {
      return capBps / 10000.0
    }
    const sp = k / Math.sqrt(advDollars)
    let bps = sp * 10000
    bps = Math.min(Math.max(bps, floorBps), capBps)
    return bps / 10000.0
  }

  calculateMetrics(
    equityCurve: Array<{ date: Date; value: number }>,
    numTrades: number,
    riskFreeRate: number = 3.5
  ): BacktestMetrics {
    if (equityCurve.length === 0) {
      return {
        CAGR: NaN,
        Sharpe: NaN,
        Sortino: NaN,
        Calmar: NaN,
        MaxDD: NaN,
        Vol: NaN,
        Trades_Yr: NaN,
        Final: this.config.startCapital,
        Years: 0,
        totalReturn: 0
      }
    }

    const df = new DataFrame(equityCurve.map(e => ({ Date: e.date, PortfolioValue: e.value })))
    const returns = df.pctChange('PortfolioValue')
    const validReturns = returns.filter((r, i) => i > 0 && !isNaN(r))

    const days = (equityCurve[equityCurve.length - 1].date.getTime() - equityCurve[0].date.getTime()) / (1000 * 60 * 60 * 24)
    const years = days / 365.25

    const finalValue = equityCurve[equityCurve.length - 1].value
    const initialValue = equityCurve[0].value
    const totalReturn = ((finalValue / initialValue) - 1) * 100

    const cagr = years > 0 ? (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100 : NaN

    const annualVol = validReturns.length > 0
      ? this.std(validReturns) * Math.sqrt(252) * 100
      : NaN

    const sharpe = annualVol > 0 ? (cagr - riskFreeRate) / annualVol : NaN

    const downsideReturns = validReturns.filter(r => r < 0)
    const downsideVol = downsideReturns.length > 0
      ? this.std(downsideReturns) * Math.sqrt(252) * 100
      : NaN
    const sortino = downsideVol > 0 ? (cagr - riskFreeRate) / downsideVol : NaN

    const cummax = df.cummax('PortfolioValue')
    const drawdowns = equityCurve.map((e, i) => (e.value - cummax[i]) / cummax[i])
    const maxDD = Math.min(...drawdowns) * 100

    const calmar = maxDD !== 0 ? cagr / Math.abs(maxDD) : NaN

    const tradesPerYear = years > 0 ? numTrades / years : NaN

    return {
      CAGR: cagr,
      Sharpe: sharpe,
      Sortino: sortino,
      Calmar: calmar,
      MaxDD: maxDD,
      Vol: annualVol,
      Trades_Yr: tradesPerYear,
      Final: finalValue,
      Years: years,
      totalReturn
    }
  }

  private std(values: number[]): number {
    if (values.length === 0) return NaN
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }

  async runBacktest(strategyFn: (data: DataFrame, state: any) => any): Promise<BacktestResult> {
    const equity: Array<{ date: Date; value: number; [key: string]: any }> = []
    const trades: BacktestTrade[] = []
    const positions = new Map<string, number>()
    let cash = this.config.startCapital

    const allDates = new Set<number>()
    this.timeSeriesData.forEach(ts => {
      ts.data.forEach(row => allDates.add(row.date.getTime()))
    })
    const sortedDates = Array.from(allDates).sort((a, b) => a - b).map(t => new Date(t))

    const filteredDates = sortedDates.filter(date => {
      const afterStart = !this.config.startDate || date >= this.config.startDate
      const beforeEnd = !this.config.endDate || date <= this.config.endDate
      return afterStart && beforeEnd
    })

    for (const date of filteredDates) {
      const marketData: any = { date }
      this.timeSeriesData.forEach((ts, symbol) => {
        const row = ts.data.find(r => r.date.getTime() === date.getTime())
        if (row) {
          Object.keys(row).forEach(key => {
            if (key !== 'date') {
              marketData[`${symbol}_${key}`] = row[key]
            }
          })
        }
      })

      const state = {
        cash,
        positions: Object.fromEntries(positions),
        date
      }

      const signal = await strategyFn(new DataFrame([marketData]), state)

      if (signal?.action === 'buy' && signal?.symbol) {
        const tsData = this.timeSeriesData.get(signal.symbol)
        if (tsData) {
          const row = tsData.data.find(r => r.date.getTime() === date.getTime())
          if (row && row.close && row.volume) {
            const maxShares = Math.floor(this.config.volumeCapPct * row.volume)
            const desiredShares = signal.shares || Math.floor(cash / row.close)
            const sharesToBuy = Math.min(desiredShares, maxShares)

            if (sharesToBuy > 0) {
              const slippage = this.calculateSlippage(marketData[`${signal.symbol}_ADV$`])
              const executionPrice = row.close * (1 + slippage / 2)
              const commission = executionPrice * sharesToBuy * this.config.transactionCost
              const totalCost = executionPrice * sharesToBuy + commission

              if (totalCost <= cash) {
                cash -= totalCost
                positions.set(signal.symbol, (positions.get(signal.symbol) || 0) + sharesToBuy)
                trades.push({
                  date,
                  symbol: signal.symbol,
                  action: 'buy',
                  shares: sharesToBuy,
                  price: row.close,
                  executionPrice,
                  slippage: slippage / 2,
                  commission,
                  reason: signal.reason || 'strategy_signal'
                })
              }
            }
          }
        }
      } else if (signal?.action === 'sell' && signal?.symbol) {
        const currentPos = positions.get(signal.symbol) || 0
        if (currentPos > 0) {
          const tsData = this.timeSeriesData.get(signal.symbol)
          if (tsData) {
            const row = tsData.data.find(r => r.date.getTime() === date.getTime())
            if (row && row.close && row.volume) {
              const maxShares = Math.floor(this.config.volumeCapPct * row.volume)
              const sharesToSell = Math.min(signal.shares || currentPos, currentPos, maxShares)

              if (sharesToSell > 0) {
                const slippage = this.calculateSlippage(marketData[`${signal.symbol}_ADV$`])
                const executionPrice = row.close * (1 - slippage / 2)
                const proceeds = executionPrice * sharesToSell
                const commission = proceeds * this.config.transactionCost

                cash += proceeds - commission
                positions.set(signal.symbol, currentPos - sharesToSell)
                trades.push({
                  date,
                  symbol: signal.symbol,
                  action: 'sell',
                  shares: sharesToSell,
                  price: row.close,
                  executionPrice,
                  slippage: slippage / 2,
                  commission,
                  reason: signal.reason || 'strategy_signal'
                })
              }
            }
          }
        }
      }

      let portfolioValue = cash
      positions.forEach((shares, symbol) => {
        const tsData = this.timeSeriesData.get(symbol)
        if (tsData) {
          const row = tsData.data.find(r => r.date.getTime() === date.getTime())
          if (row && row.close) {
            portfolioValue += shares * row.close
          }
        }
      })

      equity.push({
        date,
        value: portfolioValue,
        cash,
        ...Object.fromEntries(Array.from(positions.entries()).map(([k, v]) => [`${k}_shares`, v])),
        ...signal
      })
    }

    const metrics = this.calculateMetrics(equity, trades.length)

    return {
      equity,
      trades,
      metrics,
      positions: Array.from(positions.entries()).map(([symbol, shares]) => ({
        symbol,
        shares,
        entryPrice: 0,
        entryDate: new Date()
      }))
    }
  }
}

export function createDividendSchedule(
  months: number[],
  day: number,
  annualAmount: number
): (date: Date) => number {
  const quarterlyAmount = annualAmount / 4
  return (date: Date) => {
    if (months.includes(date.getMonth() + 1) && date.getDate() === day) {
      return quarterlyAmount
    }
    return 0
  }
}
