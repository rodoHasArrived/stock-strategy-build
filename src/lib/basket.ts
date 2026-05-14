import { Security, TradeAction } from './types'

export type BasketMetricName = 'PRICE' | 'YIELD' | 'COUPON' | 'DURATION' | 'SPREAD' | 'RATING' | string

export interface BasketOptions {
  name: string
  cusips?: string[]
  weights?: Record<string, number>
  tags?: string[]
  notes?: string
  createdAt?: number
}

export interface BasketRuntime {
  securities: Security[]
}

const normalizeCusip = (cusip: string) => cusip.trim().toUpperCase()

const securityFieldForMetric = (metricName: BasketMetricName): keyof Security | undefined => {
  switch (metricName.toUpperCase()) {
    case 'PRICE':
      return 'price'
    case 'YIELD':
      return 'yield'
    case 'COUPON':
      return 'coupon'
    case 'DURATION':
      return 'duration'
    case 'SPREAD':
      return 'spread'
    case 'RATING':
      return 'rating'
    case 'CUSIP':
      return 'cusip'
    case 'NAME':
      return 'name'
    case 'MATURITY':
      return 'maturity'
    default:
      return undefined
  }
}

export class Basket {
  public name: string
  public cusips: string[]
  public weights: Record<string, number>
  public tags: string[]
  public notes: string
  public createdAt: number

  private runtime: BasketRuntime

  constructor(options: BasketOptions, runtime: BasketRuntime) {
    this.name = options.name
    this.cusips = Array.from(new Set((options.cusips ?? []).map(normalizeCusip).filter(Boolean)))
    this.weights = Object.fromEntries(
      Object.entries(options.weights ?? {}).map(([cusip, weight]) => [normalizeCusip(cusip), weight])
    )
    this.tags = options.tags ?? []
    this.notes = options.notes ?? ''
    this.createdAt = options.createdAt ?? Date.now()
    this.runtime = runtime
  }

  public contains(cusip: string): boolean {
    return this.cusips.includes(normalizeCusip(cusip))
  }

  public add(cusip: string): Basket {
    const normalized = normalizeCusip(cusip)
    if (normalized && !this.contains(normalized)) {
      this.cusips.push(normalized)
    }
    return this
  }

  public remove(cusip: string): Basket {
    const normalized = normalizeCusip(cusip)
    this.cusips = this.cusips.filter((item) => item !== normalized)
    delete this.weights[normalized]
    return this
  }

  public weight(cusip: string, value: number): Basket {
    const normalized = normalizeCusip(cusip)
    if (normalized) {
      this.add(normalized)
      this.weights[normalized] = value
    }
    return this
  }

  public equalWeight(): Basket {
    const weight = this.cusips.length > 0 ? 1 / this.cusips.length : 0
    this.weights = Object.fromEntries(this.cusips.map((cusip) => [cusip, weight]))
    return this
  }

  public securities(): Security[] {
    const selected = new Set(this.cusips)
    return this.runtime.securities.filter((security) => selected.has(normalizeCusip(security.cusip)))
  }

  public metric(metricName: BasketMetricName): Record<string, unknown> {
    const field = securityFieldForMetric(metricName)
    if (!field) return {}

    return Object.fromEntries(
      this.securities().map((security) => [security.cusip, security[field] ?? null])
    )
  }

  public avg(metricName: BasketMetricName): number | null {
    const values = Object.values(this.metric(metricName)).filter((value): value is number => typeof value === 'number')
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  public weightedAvg(metricName: BasketMetricName): number | null {
    const metricValues = this.metric(metricName)
    const numericValues = this.cusips
      .map((cusip) => ({
        cusip,
        value: metricValues[cusip],
        weight: this.weights[cusip] ?? (this.cusips.length > 0 ? 1 / this.cusips.length : 0)
      }))
      .filter((entry): entry is { cusip: string; value: number; weight: number } => typeof entry.value === 'number')

    const weightTotal = numericValues.reduce((sum, entry) => sum + entry.weight, 0)
    if (numericValues.length === 0 || weightTotal === 0) return null

    return numericValues.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weightTotal
  }

  public exposureBy(metricName: BasketMetricName): Record<string, number> {
    const metricValues = this.metric(metricName)
    return this.cusips.reduce<Record<string, number>>((exposures, cusip) => {
      const bucket = String(metricValues[cusip] ?? 'Unknown')
      const weight = this.weights[cusip] ?? (this.cusips.length > 0 ? 1 / this.cusips.length : 0)
      exposures[bucket] = (exposures[bucket] ?? 0) + weight
      return exposures
    }, {})
  }

  public filter(predicate: (security: Security) => boolean): Basket {
    const nextCusips = this.securities().filter(predicate).map((security) => security.cusip)
    const nextWeights = Object.fromEntries(nextCusips.map((cusip) => [cusip, this.weights[cusip]]).filter(([, weight]) => weight != null))
    return new Basket(
      {
        name: `${this.name}_filtered`,
        cusips: nextCusips,
        weights: nextWeights,
        tags: [...this.tags],
        notes: this.notes
      },
      this.runtime
    )
  }

  public rank(scoreFn: (security: Security) => number): Array<Security & { score: number }> {
    return this.securities()
      .map((security) => ({ ...security, score: scoreFn(security) }))
      .sort((a, b) => b.score - a.score)
  }

  public top(n: number): Basket {
    return new Basket(
      {
        name: `${this.name}_top_${n}`,
        cusips: this.cusips.slice(0, n),
        weights: Object.fromEntries(this.cusips.slice(0, n).map((cusip) => [cusip, this.weights[cusip]]).filter(([, weight]) => weight != null)),
        tags: [...this.tags],
        notes: this.notes
      },
      this.runtime
    )
  }

  public toTrades(action: TradeAction | string, amount: number) {
    const defaultWeight = this.cusips.length > 0 ? 1 / this.cusips.length : 0
    return this.cusips.map((cusip) => ({
      id: `trade-${this.name}-${cusip}`,
      security: this.securities().find((security) => security.cusip === cusip)?.name ?? cusip,
      cusip,
      action,
      quantity: amount * (this.weights[cusip] ?? defaultWeight),
      reason: `BASKET_${this.name.toUpperCase()}`
    }))
  }

  public toJSON() {
    return {
      name: this.name,
      cusips: this.cusips,
      weights: this.weights,
      tags: this.tags,
      notes: this.notes,
      createdAt: this.createdAt
    }
  }
}

export function isBasket(value: unknown): value is Basket {
  return value instanceof Basket
}

export function createBasketFactory(securities: Security[]) {
  const runtime = { securities }
  return (options: BasketOptions) => new Basket(options, runtime)
}

