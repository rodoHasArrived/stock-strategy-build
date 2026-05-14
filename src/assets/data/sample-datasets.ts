export const sampleDatasets = {
  'PCG Preferreds (PA/PB)': {
    description: 'Pacific Gas & Electric preferred stocks with quarterly dividends - ideal for yield spread strategies',
    securities: ['PA', 'PB'],
    period: '2023 full year',
    dataType: 'Daily bars with volume',
    useCase: 'Mean reversion, yield spread trading',
    coupons: { PA: 1.50, PB: 1.375 },
    files: {
      PA: '/src/assets/data/PCG-PA_daily_bars.json',
      PB: '/src/assets/data/PCG-PB_daily_bars.json'
    }
  },
  'Corporate Bond Index': {
    description: 'Sample corporate bond prices with credit ratings and duration - test credit quality filters',
    securities: ['IG_CORP', 'HY_CORP'],
    period: '2022-2023',
    dataType: 'Daily prices + fundamentals',
    useCase: 'Credit spread analysis, duration management',
    coupons: { IG_CORP: 4.25, HY_CORP: 6.75 },
    files: {
      IG_CORP: '/src/assets/data/ig-corp-bond.json',
      HY_CORP: '/src/assets/data/hy-corp-bond.json'
    }
  },
  'Equity Momentum': {
    description: 'Large cap stocks with different momentum profiles - test trend following strategies',
    securities: ['MOMENTUM', 'VALUE'],
    period: '2023',
    dataType: 'Daily OHLCV',
    useCase: 'Momentum strategies, factor rotation',
    coupons: {},
    files: {
      MOMENTUM: '/src/assets/data/momentum-equity.json',
      VALUE: '/src/assets/data/value-equity.json'
    }
  },
  'Sector Rotation': {
    description: 'Technology and utilities sector ETFs - test sector rotation logic',
    securities: ['TECH', 'UTIL'],
    period: '2023',
    dataType: 'Daily prices',
    useCase: 'Sector rotation, defensive vs growth allocation',
    coupons: {},
    files: {
      TECH: '/src/assets/data/tech-sector.json',
      UTIL: '/src/assets/data/util-sector.json'
    }
  }
}

export type DatasetKey = keyof typeof sampleDatasets

export function getDatasetInfo(key: DatasetKey) {
  return sampleDatasets[key]
}

export function getAllDatasetKeys(): DatasetKey[] {
  return Object.keys(sampleDatasets) as DatasetKey[]
}
