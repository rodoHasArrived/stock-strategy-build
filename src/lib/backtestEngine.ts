import { DataFrame } from './dataFrame'
import {
  BacktestConfig,
  BacktestDiagnostic,
  BacktestOrder,
  BacktestOrderEvent,
  BacktestResult,
  BacktestMetrics,
  BacktestSignal,
  BacktestPositionSnapshot,
  BacktestTrade,
  TimeSeriesData,
} from './types'

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

  private diagnostic(
    diagnostics: BacktestDiagnostic[],
    severity: BacktestDiagnostic['severity'],
    id: string,
    message: string,
    symbol?: string,
    date?: Date
  ): BacktestDiagnostic {
    const entry: BacktestDiagnostic = {
      id,
      severity,
      message,
      symbol,
      date: date?.toISOString(),
    }
    diagnostics.push(entry)
    return entry
  }

  private rowForDate(symbol: string, date: Date) {
    const tsData = this.timeSeriesData.get(symbol)
    return tsData?.data.find(r => r.date.getTime() === date.getTime())
  }

  private numberField(row: Record<string, any> | undefined, fields: string[]): number | undefined {
    if (!row) return undefined
    for (const field of fields) {
      const value = row[field]
      if (value == null || value === '') continue
      const numeric = Number(value)
      if (Number.isFinite(numeric)) return numeric
    }
    return undefined
  }

  private closeFor(symbol: string, date: Date): number | undefined {
    return this.numberField(this.rowForDate(symbol, date), ['close', 'Close', 'price', 'Price'])
  }

  private volumeFor(symbol: string, date: Date): number | undefined {
    return this.numberField(this.rowForDate(symbol, date), ['volume', 'Volume'])
  }

  private advFor(symbol: string, date: Date): number | undefined {
    const row = this.rowForDate(symbol, date)
    const explicit = this.numberField(row, ['ADV$', 'advDollars', 'dollarVolume', 'DollarVolume'])
    if (explicit != null) return explicit

    const close = this.closeFor(symbol, date)
    const volume = this.volumeFor(symbol, date)
    return close != null && volume != null ? close * volume : undefined
  }

  private portfolioValue(cash: number, positions: Map<string, number>, date: Date): number {
    let value = cash
    positions.forEach((shares, symbol) => {
      const close = this.closeFor(symbol, date)
      if (close != null) value += shares * close
    })
    return value
  }

  private positionWeights(positions: Map<string, number>, portfolioValue: number, date: Date): Record<string, number> {
    if (portfolioValue <= 0) return {}
    return Object.fromEntries(
      Array.from(positions.entries()).map(([symbol, shares]) => {
        const close = this.closeFor(symbol, date) ?? 0
        return [symbol, (shares * close) / portfolioValue]
      })
    )
  }

  private normalizeAllocation(rawAllocation: Record<string, number>) {
    const entries = Object.entries(rawAllocation)
      .map(([symbol, value]) => [symbol.trim().toUpperCase(), Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value) && value >= 0)
    const total = entries.reduce((sum, [, value]) => sum + value, 0)
    const divisor = total > 1.5 ? 100 : 1
    return Object.fromEntries(entries.map(([symbol, value]) => [symbol, value / divisor]))
  }

  private allocationOrders(
    allocation: Record<string, number>,
    reason: string,
    positions: Map<string, number>,
    portfolioValue: number,
    date: Date,
    diagnostics: BacktestDiagnostic[]
  ): BacktestOrder[] {
    const normalized = this.normalizeAllocation(allocation)
    const symbols = new Set([...Object.keys(normalized), ...Array.from(positions.keys())])
    const orders: BacktestOrder[] = []

    symbols.forEach(symbol => {
      const close = this.closeFor(symbol, date)
      if (close == null || close <= 0) {
        this.diagnostic(diagnostics, 'warning', `allocation-missing-price-${symbol}-${date.getTime()}`, `Allocation target for ${symbol} skipped because no close price was available.`, symbol, date)
        return
      }

      const targetWeight = normalized[symbol] ?? 0
      const targetValue = portfolioValue * targetWeight
      const currentValue = (positions.get(symbol) ?? 0) * close
      const valueDelta = targetValue - currentValue
      const shares = Math.floor(Math.abs(valueDelta) / close)

      if (shares <= 0) return
      orders.push({
        id: `allocation-${symbol}-${date.getTime()}`,
        symbol,
        action: valueDelta > 0 ? 'buy' : 'sell',
        shares,
        targetWeight,
        targetValue,
        reason,
      })
    })

    return orders
  }

  private ordersFromSignal(
    signal: BacktestSignal,
    positions: Map<string, number>,
    portfolioValue: number,
    date: Date,
    diagnostics: BacktestDiagnostic[],
    orderEvents: BacktestOrderEvent[]
  ): BacktestOrder[] {
    if (signal == null) return []

    if (Array.isArray(signal)) {
      return signal
        .filter(order => order && typeof order === 'object' && 'symbol' in order && 'action' in order)
        .map(order => ({
          ...order,
          symbol: String(order.symbol).toUpperCase(),
          action: order.action,
        }))
    }

    if (typeof signal !== 'object') {
      this.diagnostic(diagnostics, 'warning', `unsupported-signal-${date.getTime()}`, `Unsupported signal shape "${typeof signal}"; expected hold, order, orders, or target allocation.`, undefined, date)
      return []
    }

    if ('orders' in signal && Array.isArray(signal.orders)) {
      return signal.orders.map(order => ({
        ...order,
        symbol: String(order.symbol).toUpperCase(),
      }))
    }

    const allocation = 'targetAllocation' in signal
      ? signal.targetAllocation
      : 'target_allocation' in signal
        ? signal.target_allocation
        : undefined

    if (allocation && typeof allocation === 'object') {
      orderEvents.push({
        id: `allocation-signal-${date.getTime()}`,
        date,
        action: 'target_allocation',
        status: 'filled',
        reason: signal.reason ?? ('rebalance_reason' in signal ? signal.rebalance_reason : undefined) ?? 'target_allocation',
      })
      return this.allocationOrders(
        allocation,
        signal.reason ?? ('rebalance_reason' in signal ? signal.rebalance_reason : undefined) ?? 'target_allocation',
        positions,
        portfolioValue,
        date,
        diagnostics
      )
    }

    if ('action' in signal) {
      if (signal.action === 'hold') {
        orderEvents.push({
          id: `hold-${date.getTime()}`,
          date,
          action: 'hold',
          status: 'skipped',
          reason: signal.reason ?? 'hold',
        })
        return []
      }

      if ((signal.action === 'buy' || signal.action === 'sell') && signal.symbol) {
        const order: BacktestOrder = {
          id: `signal-${signal.action}-${String(signal.symbol).toUpperCase()}-${date.getTime()}`,
          action: signal.action,
          symbol: String(signal.symbol).toUpperCase(),
          shares: signal.shares,
          reason: signal.reason ?? 'strategy_signal',
        }

        if (signal.action === 'buy' && order.shares == null) {
          const rotationSells = Array.from(positions.entries())
            .filter(([symbol, shares]) => symbol !== order.symbol && shares > 0)
            .map(([symbol, shares]) => ({
              id: `rotation-sell-${symbol}-${date.getTime()}`,
              action: 'sell' as const,
              symbol,
              shares,
              reason: `Rotate to ${order.symbol}`,
            }))
          return [...rotationSells, order]
        }

        return [order]
      }

      this.diagnostic(diagnostics, 'warning', `unsupported-action-${date.getTime()}`, `Unsupported signal action "${String(signal.action)}"; expected buy, sell, hold, orders, or target allocation.`, undefined, date)
      return []
    }

    this.diagnostic(diagnostics, 'warning', `unsupported-signal-object-${date.getTime()}`, 'Signal object did not include action, orders, or target allocation.', undefined, date)
    return []
  }

  private recordOrderEvent(
    orderEvents: BacktestOrderEvent[],
    date: Date,
    order: BacktestOrder,
    status: BacktestOrderEvent['status'],
    reason: string,
    requestedShares?: number,
    filledShares?: number,
    diagnosticId?: string
  ) {
    orderEvents.push({
      id: `${order.id ?? `${order.action}-${order.symbol}`}-${orderEvents.length}`,
      date,
      symbol: order.symbol,
      action: order.action,
      requestedShares,
      filledShares,
      targetWeight: order.targetWeight,
      targetValue: order.targetValue,
      status,
      reason,
      diagnosticId,
    })
  }

  private executeOrder(
    order: BacktestOrder,
    date: Date,
    positions: Map<string, number>,
    cashRef: { cash: number },
    trades: BacktestTrade[],
    diagnostics: BacktestDiagnostic[],
    orderEvents: BacktestOrderEvent[]
  ) {
    const close = this.closeFor(order.symbol, date)
    const volume = this.volumeFor(order.symbol, date)

    if (close == null || close <= 0) {
      const diagnostic = this.diagnostic(diagnostics, 'warning', `missing-price-${order.symbol}-${date.getTime()}`, `${order.action} order for ${order.symbol} skipped because close price was unavailable.`, order.symbol, date)
      this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, order.shares, 0, diagnostic.id)
      return
    }

    if (volume == null || volume <= 0) {
      const diagnostic = this.diagnostic(diagnostics, 'warning', `missing-volume-${order.symbol}-${date.getTime()}`, `${order.action} order for ${order.symbol} skipped because volume was unavailable.`, order.symbol, date)
      this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, order.shares, 0, diagnostic.id)
      return
    }

    const maxShares = Math.floor(this.config.volumeCapPct * volume)
    if (maxShares <= 0) {
      const diagnostic = this.diagnostic(diagnostics, 'info', `volume-cap-zero-${order.symbol}-${date.getTime()}`, `${order.action} order for ${order.symbol} produced zero shares after the volume cap.`, order.symbol, date)
      this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, order.shares, 0, diagnostic.id)
      return
    }

    const slippage = this.calculateSlippage(this.advFor(order.symbol, date))

    if (order.action === 'sell') {
      const currentPosition = positions.get(order.symbol) ?? 0
      if (currentPosition <= 0) {
        const diagnostic = this.diagnostic(diagnostics, 'info', `no-position-sell-${order.symbol}-${date.getTime()}`, `Sell order for ${order.symbol} skipped because no position was held.`, order.symbol, date)
        this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, order.shares, 0, diagnostic.id)
        return
      }

      const requestedShares = Math.floor(order.shares ?? currentPosition)
      const sharesToSell = Math.min(requestedShares, currentPosition, maxShares)
      if (sharesToSell <= 0) {
        const diagnostic = this.diagnostic(diagnostics, 'info', `zero-sell-${order.symbol}-${date.getTime()}`, `Sell order for ${order.symbol} produced zero shares.`, order.symbol, date)
        this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, requestedShares, 0, diagnostic.id)
        return
      }

      const executionPrice = close * (1 - slippage / 2)
      const proceeds = executionPrice * sharesToSell
      const commission = proceeds * this.config.transactionCost

      cashRef.cash += proceeds - commission
      const nextPosition = currentPosition - sharesToSell
      if (nextPosition <= 0) {
        positions.delete(order.symbol)
      } else {
        positions.set(order.symbol, nextPosition)
      }

      trades.push({
        date,
        symbol: order.symbol,
        action: 'sell',
        shares: sharesToSell,
        price: close,
        executionPrice,
        slippage: slippage / 2,
        commission,
        reason: order.reason || 'strategy_signal',
        orderId: order.id,
      })
      this.recordOrderEvent(orderEvents, date, order, sharesToSell < requestedShares ? 'partial' : 'filled', order.reason || 'strategy_signal', requestedShares, sharesToSell)
      return
    }

    const executionPrice = close * (1 + slippage / 2)
    const requestedShares = Math.floor(
      order.shares
        ?? (order.targetValue != null ? order.targetValue / executionPrice : cashRef.cash / (executionPrice * (1 + this.config.transactionCost)))
    )
    const affordableShares = Math.floor(cashRef.cash / (executionPrice * (1 + this.config.transactionCost)))
    const sharesToBuy = Math.min(requestedShares, maxShares, affordableShares)

    if (sharesToBuy <= 0) {
      const diagnostic = this.diagnostic(diagnostics, 'info', `zero-buy-${order.symbol}-${date.getTime()}`, `Buy order for ${order.symbol} produced zero shares after cash and volume constraints.`, order.symbol, date)
      this.recordOrderEvent(orderEvents, date, order, 'skipped', diagnostic.message, requestedShares, 0, diagnostic.id)
      return
    }

    const grossCost = executionPrice * sharesToBuy
    const commission = grossCost * this.config.transactionCost
    cashRef.cash -= grossCost + commission
    positions.set(order.symbol, (positions.get(order.symbol) || 0) + sharesToBuy)

    trades.push({
      date,
      symbol: order.symbol,
      action: 'buy',
      shares: sharesToBuy,
      price: close,
      executionPrice,
      slippage: slippage / 2,
      commission,
      reason: order.reason || 'strategy_signal',
      orderId: order.id,
    })
    this.recordOrderEvent(orderEvents, date, order, sharesToBuy < requestedShares ? 'partial' : 'filled', order.reason || 'strategy_signal', requestedShares, sharesToBuy)
  }

  async runBacktest(strategyFn: (data: DataFrame, state: any) => BacktestSignal): Promise<BacktestResult> {
    const equity: Array<{ date: Date; value: number; [key: string]: any }> = []
    const trades: BacktestTrade[] = []
    const diagnostics: BacktestDiagnostic[] = []
    const orderEvents: BacktestOrderEvent[] = []
    const positionSnapshots: BacktestPositionSnapshot[] = []
    const positions = new Map<string, number>()
    const cashRef = { cash: this.config.startCapital }

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

      const startingPortfolioValue = this.portfolioValue(cashRef.cash, positions, date)
      const state = {
        cash: cashRef.cash,
        positions: Object.fromEntries(positions),
        portfolioValue: startingPortfolioValue,
        weights: this.positionWeights(positions, startingPortfolioValue, date),
        date
      }

      const signal = await strategyFn(new DataFrame([marketData]), state)
      const orders = this.ordersFromSignal(signal, positions, startingPortfolioValue, date, diagnostics, orderEvents)
      const sortedOrders = [
        ...orders.filter(order => order.action === 'sell'),
        ...orders.filter(order => order.action === 'buy'),
      ]

      sortedOrders.forEach(order => this.executeOrder(order, date, positions, cashRef, trades, diagnostics, orderEvents))

      const portfolioValue = this.portfolioValue(cashRef.cash, positions, date)
      const weights = this.positionWeights(positions, portfolioValue, date)

      equity.push({
        date,
        value: portfolioValue,
        cash: cashRef.cash,
        ...Object.fromEntries(Array.from(positions.entries()).map(([k, v]) => [`${k}_shares`, v])),
        signalReason: signal && typeof signal === 'object' && !Array.isArray(signal) && 'reason' in signal ? signal.reason : undefined,
      })

      positionSnapshots.push({
        date,
        cash: cashRef.cash,
        portfolioValue,
        positions: Object.fromEntries(positions),
        weights,
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
      })),
      diagnostics,
      orderEvents,
      positionSnapshots,
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
