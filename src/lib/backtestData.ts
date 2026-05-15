import { BacktestDiagnostic, StrategyDataset, TimeSeriesData } from './types'

type RawRow = Record<string, unknown>

export interface NormalizedBacktestInput {
  seriesBySymbol: Record<string, TimeSeriesData['data']>
  normalizedFieldMap: Record<string, string[]>
  diagnostics: BacktestDiagnostic[]
}

const DATE_FIELDS = ['SessionDate', 'Date', 'date', 'timestamp']
const CLOSE_FIELDS = ['Close', 'close', 'Adj Close', 'adjClose', 'price', 'Price']
const VOLUME_FIELDS = ['Volume', 'volume', 'Vol', 'vol']
const ADV_FIELDS = ['ADV$', 'adv$', 'advDollars', 'ADV_Dollars', 'dollarVolume', 'DollarVolume']

const getRows = (data: unknown): RawRow[] => {
  if (Array.isArray(data)) return data as RawRow[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: RawRow[] }).data
  }
  return []
}

const firstPresent = (row: RawRow, fields: string[]) => {
  for (const field of fields) {
    if (field in row) return row[field]
  }
  return undefined
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : undefined
  }
  return undefined
}

const diagnostic = (
  severity: BacktestDiagnostic['severity'],
  id: string,
  message: string,
  symbol: string,
  date?: string
): BacktestDiagnostic => ({
  id,
  severity,
  message,
  symbol,
  date,
})

const withAliases = (
  symbol: string,
  row: RawRow,
  date: Date,
  close?: number,
  volume?: number,
  coupon?: number
) => {
  const normalized: Record<string, unknown> = { ...row }
  const dateText = date.toISOString().slice(0, 10)
  const advFromRow = toFiniteNumber(firstPresent(row, ADV_FIELDS))
  const dollarVolume = advFromRow ?? (close != null && volume != null ? close * volume : undefined)
  const derivedYield = coupon != null && close != null && close > 0
    ? (coupon / close) * 100
    : undefined

  normalized.date = date
  normalized.Date = normalized.Date ?? dateText
  normalized.SessionDate = normalized.SessionDate ?? dateText

  if (close != null) {
    normalized.close = close
    normalized.Close = close
    normalized.price = normalized.price ?? close
    normalized.Price = normalized.Price ?? close
  }

  if (volume != null) {
    normalized.volume = volume
    normalized.Volume = volume
  }

  if (dollarVolume != null) {
    normalized['ADV$'] = dollarVolume
    normalized.advDollars = dollarVolume
    normalized.dollarVolume = dollarVolume
  }

  if (coupon != null) {
    normalized.Coupon = coupon
    normalized.coupon = coupon
  }

  if (derivedYield != null) {
    normalized.Yield = derivedYield
    normalized.yield = derivedYield
    normalized.CurrentYield = derivedYield
    normalized.current_yield = derivedYield
  }

  normalized.Symbol = normalized.Symbol ?? symbol
  normalized.symbol = normalized.symbol ?? symbol

  return normalized
}

export function normalizeBacktestDataFiles(
  dataFiles: Record<string, unknown>,
  dataset?: StrategyDataset | null
): NormalizedBacktestInput {
  const diagnostics: BacktestDiagnostic[] = []
  const seriesBySymbol: Record<string, TimeSeriesData['data']> = {}
  const normalizedFieldMap: Record<string, string[]> = {}

  Object.entries(dataFiles).forEach(([rawSymbol, data]) => {
    const symbol = rawSymbol.trim().toUpperCase()
    const rows = getRows(data)

    if (rows.length === 0) {
      diagnostics.push(diagnostic('error', `empty-${symbol}`, `${symbol} has no rows to normalize.`, symbol))
      seriesBySymbol[symbol] = []
      normalizedFieldMap[symbol] = []
      return
    }

    const coupon = dataset?.coupons?.[symbol] ?? dataset?.coupons?.[rawSymbol]
    const normalizedRows: TimeSeriesData['data'] = []
    const fields = new Set<string>()

    rows.forEach((row, rowIndex) => {
      const rawDate = firstPresent(row, DATE_FIELDS)
      const date = toDate(rawDate)
      const close = toFiniteNumber(firstPresent(row, CLOSE_FIELDS))
      const volume = toFiniteNumber(firstPresent(row, VOLUME_FIELDS))
      const rowDate = typeof rawDate === 'string' ? rawDate : undefined

      if (!date) {
        diagnostics.push(diagnostic(
          'error',
          `invalid-date-${symbol}-${rowIndex}`,
          `${symbol} row ${rowIndex + 1} has no valid date.`,
          symbol
        ))
        return
      }

      if (close == null || close <= 0) {
        diagnostics.push(diagnostic(
          'error',
          `invalid-close-${symbol}-${rowIndex}`,
          `${symbol} row ${rowIndex + 1} has no positive close price.`,
          symbol,
          rowDate
        ))
      }

      if (volume == null || volume <= 0) {
        diagnostics.push(diagnostic(
          'warning',
          `invalid-volume-${symbol}-${rowIndex}`,
          `${symbol} row ${rowIndex + 1} has no positive volume; volume caps may block fills.`,
          symbol,
          rowDate
        ))
      }

      const normalized = withAliases(symbol, row, date, close, volume, coupon)
      Object.keys(normalized).forEach(field => fields.add(field))
      normalizedRows.push(normalized as TimeSeriesData['data'][number])
    })

    seriesBySymbol[symbol] = normalizedRows
    normalizedFieldMap[symbol] = Array.from(fields).sort()
  })

  return {
    seriesBySymbol,
    normalizedFieldMap,
    diagnostics,
  }
}

