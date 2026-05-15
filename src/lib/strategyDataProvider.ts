import type { StrategyDataProvider, StrategyDataset } from './types'
import paData from '@/assets/data/PCG-PA_daily_bars.json'
import pbData from '@/assets/data/PCG-PB_daily_bars.json'
import igCorpData from '@/assets/data/ig-corp-bond.json'
import hyCorpData from '@/assets/data/hy-corp-bond.json'
import momentumData from '@/assets/data/momentum-equity.json'
import valueData from '@/assets/data/value-equity.json'
import techData from '@/assets/data/tech-sector.json'
import utilData from '@/assets/data/util-sector.json'

type DatasetSeed = Omit<StrategyDataset, 'fields' | 'rowCounts' | 'startDate' | 'endDate' | 'fingerprint' | 'provenance'>

const getRows = (data: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: Array<Record<string, unknown>> }).data
  }
  return []
}

const getDateValue = (row: Record<string, unknown>): string | undefined => {
  const value = row.SessionDate ?? row.Date ?? row.date
  return typeof value === 'string' ? value : undefined
}

const buildDataset = (seed: DatasetSeed): StrategyDataset => {
  const rowCounts = Object.fromEntries(
    Object.entries(seed.data).map(([symbol, data]) => [symbol, getRows(data).length])
  )
  const fields = Array.from(
    new Set(Object.values(seed.data).flatMap(data => getRows(data)[0] ? Object.keys(getRows(data)[0]) : []))
  ).sort()
  const dates = Object.values(seed.data)
    .flatMap(data => getRows(data).map(getDateValue))
    .filter((date): date is string => Boolean(date))
    .sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  const fingerprint = [
    seed.id,
    seed.symbols.join(','),
    Object.entries(rowCounts).map(([symbol, count]) => `${symbol}:${count}`).join('|'),
    startDate ?? 'no-start',
    endDate ?? 'no-end',
    fields.join(','),
  ].join('::')

  return {
    ...seed,
    fields,
    rowCounts,
    startDate,
    endDate,
    fingerprint,
    provenance: {
      provider: 'fixture',
      source: 'Bundled research fixtures',
      asOf: endDate ?? new Date().toISOString(),
      notes: 'Client-side fixture provider shaped for future AMX data integration.',
    },
  }
}

const datasetSeeds: DatasetSeed[] = [
  {
    id: 'pcg-preferreds',
    name: 'PCG Preferreds (PA/PB)',
    description: 'Pacific Gas & Electric preferred stocks with quarterly dividends for yield-spread research.',
    symbols: ['PA', 'PB'],
    period: '2023 full year',
    dataType: 'Daily bars with volume',
    useCase: 'Mean reversion, yield spread trading',
    category: 'fixed-income',
    coupons: { PA: 1.50, PB: 1.375 },
    data: { PA: paData, PB: pbData },
    compatibleTemplateCategories: ['Fixed Income', 'Trading'],
    strategyTemplate: `// Preferred spread rotation
const marketData = df.data[0]
const paYield = marketData.PA_Yield
const pbYield = marketData.PB_Yield
const yieldSpread = paYield - pbYield
const holding = state.positions?.PA > 0 ? 'PA' : state.positions?.PB > 0 ? 'PB' : null

if (holding === null && yieldSpread > 0.2) {
  return { action: 'buy', symbol: 'PA', reason: \`Spread \${yieldSpread.toFixed(3)} favors PA\` }
}

if ((holding === null || holding === 'PA') && yieldSpread < -0.2) {
  return { action: 'buy', symbol: 'PB', reason: \`Spread \${yieldSpread.toFixed(3)} favors PB\` }
}

if (holding === 'PB' && yieldSpread > 0.2) {
  return { action: 'buy', symbol: 'PA', reason: \`Spread \${yieldSpread.toFixed(3)} favors PA\` }
}

return { action: 'hold', reason: \`Spread \${yieldSpread.toFixed(3)} neutral\` }`,
  },
  {
    id: 'corporate-bond-spread',
    name: 'Corporate Bond Spread',
    description: 'Investment grade vs high yield corporate bonds for credit-spread and flight-to-quality research.',
    symbols: ['IG_CORP', 'HY_CORP'],
    period: '2022-2023',
    dataType: 'Daily prices + fundamentals',
    useCase: 'Credit spread analysis, duration management',
    category: 'fixed-income',
    coupons: { IG_CORP: 4.25, HY_CORP: 6.75 },
    data: { IG_CORP: igCorpData, HY_CORP: hyCorpData },
    compatibleTemplateCategories: ['Fixed Income', 'Portfolio'],
    strategyTemplate: `// Credit spread rotation
const marketData = df.data[0]
const igYield = marketData.IG_CORP_Yield || 0
const hyYield = marketData.HY_CORP_Yield || 0
const spread = hyYield - igYield
const holding = state.positions?.IG_CORP > 0 ? 'IG_CORP' : state.positions?.HY_CORP > 0 ? 'HY_CORP' : null

if (spread > 2.5 && holding !== 'IG_CORP') {
  return { action: 'buy', symbol: 'IG_CORP', reason: \`Spread \${spread.toFixed(2)}% above threshold\` }
}

if (spread < 1.5 && holding !== 'HY_CORP') {
  return { action: 'buy', symbol: 'HY_CORP', reason: \`Spread \${spread.toFixed(2)}% compressed\` }
}

return { action: 'hold', reason: \`Spread \${spread.toFixed(2)}% neutral\` }`,
  },
  {
    id: 'momentum-value-factor',
    name: 'Momentum vs Value Factor',
    description: 'Large cap momentum vs value factors for style rotation research.',
    symbols: ['MOMENTUM', 'VALUE'],
    period: '2023',
    dataType: 'Daily OHLCV',
    useCase: 'Momentum strategies, factor rotation',
    category: 'factor',
    data: { MOMENTUM: momentumData, VALUE: valueData },
    compatibleTemplateCategories: ['Equity', 'Trading'],
    strategyTemplate: `// Factor rotation
const marketData = df.data[0]
const momClose = marketData.MOMENTUM_Close || 0
const valClose = marketData.VALUE_Close || 0
const priceRatio = momClose / valClose
const holding = state.positions?.MOMENTUM > 0 ? 'MOMENTUM' : state.positions?.VALUE > 0 ? 'VALUE' : null

if (priceRatio > 1.05 && holding !== 'MOMENTUM') {
  return { action: 'buy', symbol: 'MOMENTUM', reason: \`Momentum stronger, ratio \${priceRatio.toFixed(2)}\` }
}

if (priceRatio < 0.95 && holding !== 'VALUE') {
  return { action: 'buy', symbol: 'VALUE', reason: \`Value stronger, ratio \${priceRatio.toFixed(2)}\` }
}

return { action: 'hold', reason: \`Ratio \${priceRatio.toFixed(2)} neutral\` }`,
  },
  {
    id: 'sector-rotation',
    name: 'Sector Rotation (Tech/Utilities)',
    description: 'Technology and utilities sector ETFs for growth vs defensive allocation research.',
    symbols: ['TECH', 'UTIL'],
    period: '2023',
    dataType: 'Daily prices',
    useCase: 'Sector rotation, defensive vs growth allocation',
    category: 'sector',
    data: { TECH: techData, UTIL: utilData },
    compatibleTemplateCategories: ['Equity', 'Portfolio', 'Trading'],
    strategyTemplate: `// Sector rotation
const marketData = df.data[0]
const techClose = marketData.TECH_Close || 0
const utilClose = marketData.UTIL_Close || 0
const techUtilRatio = techClose / utilClose
const holding = state.positions?.TECH > 0 ? 'TECH' : state.positions?.UTIL > 0 ? 'UTIL' : null

if (techUtilRatio > 2.0 && holding !== 'TECH') {
  return { action: 'buy', symbol: 'TECH', reason: \`Tech outperforming, ratio \${techUtilRatio.toFixed(2)}\` }
}

if (techUtilRatio < 1.5 && holding !== 'UTIL') {
  return { action: 'buy', symbol: 'UTIL', reason: \`Utilities defensive, ratio \${techUtilRatio.toFixed(2)}\` }
}

return { action: 'hold', reason: \`Tech/Util ratio \${techUtilRatio.toFixed(2)} neutral\` }`,
  },
]

const datasets = datasetSeeds.map(buildDataset)

export const fixtureStrategyDataProvider: StrategyDataProvider = {
  id: 'fixture',
  name: 'Fixture Research Provider',
  listDatasets: () => datasets.map(dataset => ({ ...dataset, data: { ...dataset.data } })),
  loadDataset: (datasetId: string) => {
    const dataset = datasets.find(item => item.id === datasetId)
    return dataset ? { ...dataset, data: { ...dataset.data } } : undefined
  },
}
