import { Security, StrategyTemplate } from './types'

export const mockSecurities: Security[] = [
  {
    cusip: 'US912828Z770',
    name: 'US Treasury 2.5% 2025',
    price: 99.75,
    yield: 2.65,
    coupon: 2.5,
    maturity: '2025-03-31',
    duration: 1.8,
    rating: 'AAA',
    spread: 0
  },
  {
    cusip: 'US037833DK62',
    name: 'Apple Inc 3.0% 2027',
    price: 101.25,
    yield: 2.75,
    coupon: 3.0,
    maturity: '2027-06-15',
    duration: 3.2,
    rating: 'AA+',
    spread: 65
  },
  {
    cusip: 'US594918BW44',
    name: 'Microsoft Corp 2.65% 2028',
    price: 98.50,
    yield: 2.95,
    coupon: 2.65,
    maturity: '2028-11-03',
    duration: 4.1,
    rating: 'AAA',
    spread: 72
  },
  {
    cusip: 'US172967MX75',
    name: 'Citigroup 4.45% 2027',
    price: 103.80,
    yield: 3.55,
    coupon: 4.45,
    maturity: '2027-09-29',
    duration: 3.5,
    rating: 'A+',
    spread: 145
  },
  {
    cusip: 'US46625HJQ41',
    name: 'JPMorgan 3.875% 2032',
    price: 97.20,
    yield: 4.15,
    coupon: 3.875,
    maturity: '2032-02-01',
    duration: 6.8,
    rating: 'A',
    spread: 168
  },
  {
    cusip: 'US912828ZG89',
    name: 'US Treasury 5.0% 2030',
    price: 105.50,
    yield: 4.25,
    coupon: 5.0,
    maturity: '2030-05-15',
    duration: 5.4,
    rating: 'AAA',
    spread: 0
  }
]

export const strategyTemplates: StrategyTemplate[] = [
  {
    id: 'carry-trade',
    name: 'Carry Trade Strategy',
    description: 'Identify bonds with positive carry by comparing coupon income to financing cost',
    category: 'Income',
    strategy: {
      name: 'Carry Trade Strategy',
      description: 'Identify bonds with positive carry',
      cells: {
        'A1': { id: 'A1', row: 0, col: 0, value: 'Security', displayValue: 'Security', type: 'value' },
        'B1': { id: 'B1', row: 0, col: 1, value: 'Coupon', displayValue: 'Coupon', type: 'value' },
        'C1': { id: 'C1', row: 0, col: 2, value: 'Price', displayValue: 'Price', type: 'value' },
        'D1': { id: 'D1', row: 0, col: 3, value: 'Carry', displayValue: 'Carry', type: 'value' },
        'E1': { id: 'E1', row: 0, col: 4, value: 'Action', displayValue: 'Action', type: 'value' },
        
        'A2': { id: 'A2', row: 1, col: 0, value: 'US912828Z770', displayValue: 'US912828Z770', type: 'value' },
        'B2': { id: 'B2', row: 1, col: 1, value: null, displayValue: '=COUPON(A2)', formula: '=COUPON(A2)', type: 'formula' },
        'C2': { id: 'C2', row: 1, col: 2, value: null, displayValue: '=PRICE(A2)', formula: '=PRICE(A2)', type: 'formula' },
        'D2': { id: 'D2', row: 1, col: 3, value: null, displayValue: '=B2-${fundingCost}', formula: '=B2-${fundingCost}', type: 'formula' },
        'E2': { id: 'E2', row: 1, col: 4, value: null, displayValue: '=IF(D2>0,"BUY","PASS")', formula: '=IF(D2>0,"BUY","PASS")', type: 'formula' },
        
        'A3': { id: 'A3', row: 2, col: 0, value: 'US037833DK62', displayValue: 'US037833DK62', type: 'value' },
        'B3': { id: 'B3', row: 2, col: 1, value: null, displayValue: '=COUPON(A3)', formula: '=COUPON(A3)', type: 'formula' },
        'C3': { id: 'C3', row: 2, col: 2, value: null, displayValue: '=PRICE(A3)', formula: '=PRICE(A3)', type: 'formula' },
        'D3': { id: 'D3', row: 2, col: 3, value: null, displayValue: '=B3-${fundingCost}', formula: '=B3-${fundingCost}', type: 'formula' },
        'E3': { id: 'E3', row: 2, col: 4, value: null, displayValue: '=IF(D3>0,"BUY","PASS")', formula: '=IF(D3>0,"BUY","PASS")', type: 'formula' },
      },
      parameters: [
        { id: 'funding-cost', name: 'fundingCost', value: 2.0, type: 'number', description: 'Cost of financing (%)' }
      ],
      conditions: []
    }
  },
  {
    id: 'yield-curve',
    name: 'Yield Curve Steepener',
    description: 'Profit from yield curve steepening by going long duration and short near-term',
    category: 'Rates',
    strategy: {
      name: 'Yield Curve Steepener',
      description: 'Profit from yield curve steepening',
      cells: {
        'A1': { id: 'A1', row: 0, col: 0, value: 'Security', displayValue: 'Security', type: 'value' },
        'B1': { id: 'B1', row: 0, col: 1, value: 'Duration', displayValue: 'Duration', type: 'value' },
        'C1': { id: 'C1', row: 0, col: 2, value: 'Yield', displayValue: 'Yield', type: 'value' },
        'D1': { id: 'D1', row: 0, col: 3, value: 'Position', displayValue: 'Position', type: 'value' },
        
        'A2': { id: 'A2', row: 1, col: 0, value: 'US912828Z770', displayValue: 'US912828Z770', type: 'value' },
        'B2': { id: 'B2', row: 1, col: 1, value: null, displayValue: '=DURATION(A2)', formula: '=DURATION(A2)', type: 'formula' },
        'C2': { id: 'C2', row: 1, col: 2, value: null, displayValue: '=YIELD(A2)', formula: '=YIELD(A2)', type: 'formula' },
        'D2': { id: 'D2', row: 1, col: 3, value: null, displayValue: '=IF(B2<${shortDuration},"SHORT","HOLD")', formula: '=IF(B2<${shortDuration},"SHORT","HOLD")', type: 'formula' },
        
        'A3': { id: 'A3', row: 2, col: 0, value: 'US912828ZG89', displayValue: 'US912828ZG89', type: 'value' },
        'B3': { id: 'B3', row: 2, col: 1, value: null, displayValue: '=DURATION(A3)', formula: '=DURATION(A3)', type: 'formula' },
        'C3': { id: 'C3', row: 2, col: 2, value: null, displayValue: '=YIELD(A3)', formula: '=YIELD(A3)', type: 'formula' },
        'D3': { id: 'D3', row: 2, col: 3, value: null, displayValue: '=IF(B3>${longDuration},"LONG","HOLD")', formula: '=IF(B3>${longDuration},"LONG","HOLD")', type: 'formula' },
      },
      parameters: [
        { id: 'short-duration', name: 'shortDuration', value: 3, type: 'number', description: 'Short leg duration threshold' },
        { id: 'long-duration', name: 'longDuration', value: 5, type: 'number', description: 'Long leg duration threshold' }
      ],
      conditions: []
    }
  },
  {
    id: 'credit-spread',
    name: 'Credit Spread Compression',
    description: 'Capitalize on credit spread narrowing by targeting investment grade bonds with wide spreads',
    category: 'Credit',
    strategy: {
      name: 'Credit Spread Compression',
      description: 'Target IG bonds with wide spreads',
      cells: {
        'A1': { id: 'A1', row: 0, col: 0, value: 'Security', displayValue: 'Security', type: 'value' },
        'B1': { id: 'B1', row: 0, col: 1, value: 'Spread', displayValue: 'Spread', type: 'value' },
        'C1': { id: 'C1', row: 0, col: 2, value: 'Yield', displayValue: 'Yield', type: 'value' },
        'D1': { id: 'D1', row: 0, col: 3, value: 'Signal', displayValue: 'Signal', type: 'value' },
        
        'A2': { id: 'A2', row: 1, col: 0, value: 'US172967MX75', displayValue: 'US172967MX75', type: 'value' },
        'B2': { id: 'B2', row: 1, col: 1, value: null, displayValue: '=SPREAD(A2)', formula: '=SPREAD(A2)', type: 'formula' },
        'C2': { id: 'C2', row: 1, col: 2, value: null, displayValue: '=YIELD(A2)', formula: '=YIELD(A2)', type: 'formula' },
        'D2': { id: 'D2', row: 1, col: 3, value: null, displayValue: '=IF(B2>${targetSpread},"BUY","WATCH")', formula: '=IF(B2>${targetSpread},"BUY","WATCH")', type: 'formula' },
        
        'A3': { id: 'A3', row: 2, col: 0, value: 'US46625HJQ41', displayValue: 'US46625HJQ41', type: 'value' },
        'B3': { id: 'B3', row: 2, col: 1, value: null, displayValue: '=SPREAD(A3)', formula: '=SPREAD(A3)', type: 'formula' },
        'C3': { id: 'C3', row: 2, col: 2, value: null, displayValue: '=YIELD(A3)', formula: '=YIELD(A3)', type: 'formula' },
        'D3': { id: 'D3', row: 2, col: 3, value: null, displayValue: '=IF(B3>${targetSpread},"BUY","WATCH")', formula: '=IF(B3>${targetSpread},"BUY","WATCH")', type: 'formula' },
      },
      parameters: [
        { id: 'target-spread', name: 'targetSpread', value: 140, type: 'number', description: 'Minimum spread threshold (bps)' }
      ],
      conditions: []
    }
  }
]
