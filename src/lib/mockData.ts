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
      cells: [
        {
          id: 'cell-0',
          index: 0,
          code: 'cusip = "US912828Z770"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'data'
        },
        {
          id: 'cell-1',
          index: 1,
          code: 'coupon = COUPON(cusip)\nprice = PRICE(cusip)\ncarry = coupon - ${fundingCost}\n__result__ = f"Carry: {carry}"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'calculation'
        },
        {
          id: 'cell-2',
          index: 2,
          code: 'if carry > 0: __result__ = "BUY"\nelse: __result__ = "PASS"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'condition'
        }
      ],
      parameters: [
        { id: 'funding-cost', name: 'fundingCost', value: 2.0, type: 'number', description: 'Cost of financing (%)' }
      ]
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
      cells: [
        {
          id: 'cell-0',
          index: 0,
          code: 'short_cusip = "US912828Z770"\nlong_cusip = "US912828ZG89"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'data'
        },
        {
          id: 'cell-1',
          index: 1,
          code: 'short_duration = DURATION(short_cusip)\nlong_duration = DURATION(long_cusip)\n__result__ = f"Short: {short_duration}, Long: {long_duration}"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'calculation'
        },
        {
          id: 'cell-2',
          index: 2,
          code: 'if short_duration < ${shortDuration} and long_duration > ${longDuration}:\n  __result__ = "Execute steepener trade"\nelse:\n  __result__ = "Wait for better entry"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'condition'
        }
      ],
      parameters: [
        { id: 'short-duration', name: 'shortDuration', value: 3, type: 'number', description: 'Short leg duration threshold' },
        { id: 'long-duration', name: 'longDuration', value: 5, type: 'number', description: 'Long leg duration threshold' }
      ]
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
      cells: [
        {
          id: 'cell-0',
          index: 0,
          code: 'cusip = "US172967MX75"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'data'
        },
        {
          id: 'cell-1',
          index: 1,
          code: 'spread = SPREAD(cusip)\nyield_val = YIELD(cusip)\n__result__ = f"Spread: {spread}bps, Yield: {yield_val}%"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'calculation'
        },
        {
          id: 'cell-2',
          index: 2,
          code: 'if spread > ${targetSpread}:\n  __result__ = "BUY - Wide spread"\nelse:\n  __result__ = "WATCH - Spread too tight"',
          output: '',
          status: 'idle',
          mode: 'code',
          purpose: 'condition'
        }
      ],
      parameters: [
        { id: 'target-spread', name: 'targetSpread', value: 140, type: 'number', description: 'Minimum spread threshold (bps)' }
      ]
    }
  }
]
