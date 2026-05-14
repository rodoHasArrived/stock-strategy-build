import { StrategyTemplate, CodeCell } from './types'

const createCell = (
  index: number,
  code: string,
  purpose: CodeCell['purpose'] = 'general',
  label?: string
): CodeCell => ({
  id: `cell-${index}`,
  index,
  code,
  output: '',
  status: 'idle',
  mode: 'code',
  purpose,
  label
})

export const strategyTemplates: StrategyTemplate[] = [
  {
    id: 'investment-grade-income',
    name: 'Investment-Grade Income Strategy',
    description: 'Screen for high-quality corporate bonds with attractive current yields and manageable duration',
    category: 'Fixed Income',
    strategy: {
      name: 'Investment-Grade Income Strategy',
      description: 'Screen for high-quality corporate bonds with attractive current yields and manageable duration',
      cells: [
        createCell(0, `min_current_yield = 5.00
min_rating_score = 7
max_duration = 6.0
max_position_weight = 2.00
target_security_count = 50`, 'general', 'Parameters'),
        
        createCell(1, `universe = securities.filter(s => s.rating >= 'BBB' && s.duration <= 10)
__result__ = universe.length + ' securities in universe'`, 'universe', 'Define Universe'),
        
        createCell(2, `universe_with_yield = universe.map(s => ({
  ...s,
  current_yield: (s.coupon / s.price) * 100
}))
__result__ = 'Calculated yields for ' + universe_with_yield.length + ' securities'`, 'calculation', 'Calculate Yields'),
        
        createCell(3, `filtered = universe_with_yield.filter(s => 
  s.current_yield >= min_current_yield &&
  s.duration <= max_duration
)
__result__ = filtered.length + ' securities passed filters'`, 'condition', 'Apply Filters'),
        
        createCell(4, `scored = filtered.map(s => ({
  ...s,
  score: (s.current_yield * 0.6) + (s.duration * -2)
}))
ranked = scored.sort((a, b) => b.score - a.score)
__result__ = 'Ranked ' + ranked.length + ' securities'`, 'ranking', 'Score & Rank'),
        
        createCell(5, `selected = ranked.slice(0, target_security_count)
__result__ = 'Selected top ' + selected.length + ' securities'`, 'portfolio', 'Select Top Securities')
      ],
      parameters: [
        { id: 'p1', name: 'min_current_yield', value: 5.0, type: 'number', description: 'Minimum current yield %' },
        { id: 'p2', name: 'max_duration', value: 6.0, type: 'number', description: 'Maximum duration years' },
        { id: 'p3', name: 'max_position_weight', value: 2.0, type: 'number', description: 'Max position weight %' },
        { id: 'p4', name: 'target_security_count', value: 50, type: 'number', description: 'Number of securities to hold' }
      ]
    }
  },
  
  {
    id: 'corporate-bond-yield',
    name: 'Corporate Bond Yield Strategy',
    description: 'Maximize portfolio yield while maintaining credit quality and liquidity standards',
    category: 'Fixed Income',
    strategy: {
      name: 'Corporate Bond Yield Strategy',
      description: 'Maximize portfolio yield while maintaining credit quality and liquidity standards',
      cells: [
        createCell(0, `min_yield = 4.5
min_liquidity_score = 60
max_issuer_exposure = 5.0
target_portfolio_size = 40`, 'general', 'Parameters'),
        
        createCell(1, `corporate_bonds = securities.filter(s => s.rating >= 'BBB')
__result__ = corporate_bonds.length + ' investment-grade corporate bonds'`, 'universe', 'Corporate Bond Universe'),
        
        createCell(2, `high_yield_bonds = corporate_bonds.filter(s => s.yield >= min_yield)
__result__ = high_yield_bonds.length + ' bonds meet yield threshold'`, 'condition', 'Yield Filter'),
        
        createCell(3, `final_selection = high_yield_bonds
  .sort((a, b) => b.yield - a.yield)
  .slice(0, target_portfolio_size)
__result__ = 'Selected ' + final_selection.length + ' highest-yielding bonds'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: [
        { id: 'p1', name: 'min_yield', value: 4.5, type: 'number', description: 'Minimum yield %' },
        { id: 'p2', name: 'min_liquidity_score', value: 60, type: 'number', description: 'Minimum liquidity score' },
        { id: 'p3', name: 'max_issuer_exposure', value: 5.0, type: 'number', description: 'Max issuer exposure %' }
      ]
    }
  },
  
  {
    id: 'duration-controlled-income',
    name: 'Duration-Controlled Income Strategy',
    description: 'Target specific portfolio duration while maximizing yield',
    category: 'Fixed Income',
    strategy: {
      name: 'Duration-Controlled Income Strategy',
      description: 'Target specific portfolio duration while maximizing yield',
      cells: [
        createCell(0, `target_duration = 5.0
duration_tolerance = 0.5
min_yield = 4.0`, 'general', 'Parameters'),
        
        createCell(1, `eligible = securities.filter(s => 
  Math.abs(s.duration - target_duration) <= duration_tolerance
)
__result__ = eligible.length + ' securities within duration range'`, 'condition', 'Duration Filter'),
        
        createCell(2, `selected = eligible
  .filter(s => s.yield >= min_yield)
  .sort((a, b) => b.yield - a.yield)
  .slice(0, 30)
__result__ = 'Selected ' + selected.length + ' securities'`, 'portfolio', 'Select by Yield')
      ],
      parameters: [
        { id: 'p1', name: 'target_duration', value: 5.0, type: 'number', description: 'Target portfolio duration' },
        { id: 'p2', name: 'duration_tolerance', value: 0.5, type: 'number', description: 'Duration tolerance +/-' },
        { id: 'p3', name: 'min_yield', value: 4.0, type: 'number', description: 'Minimum yield %' }
      ]
    }
  },
  
  {
    id: 'credit-spread-strategy',
    name: 'Credit Spread Strategy',
    description: 'Capture attractive credit spreads relative to treasuries',
    category: 'Fixed Income',
    strategy: {
      name: 'Credit Spread Strategy',
      description: 'Capture attractive credit spreads relative to treasuries',
      cells: [
        createCell(0, `min_spread = 150
max_spread = 400
min_rating_score = 6`, 'general', 'Parameters'),
        
        createCell(1, `spread_candidates = securities.filter(s => 
  s.spread >= min_spread && 
  s.spread <= max_spread
)
__result__ = spread_candidates.length + ' bonds in spread range'`, 'condition', 'Spread Filter'),
        
        createCell(2, `selected = spread_candidates
  .sort((a, b) => b.spread - a.spread)
  .slice(0, 25)
__result__ = 'Selected ' + selected.length + ' widest spreads'`, 'portfolio', 'Select Wide Spreads')
      ],
      parameters: [
        { id: 'p1', name: 'min_spread', value: 150, type: 'number', description: 'Minimum spread (bps)' },
        { id: 'p2', name: 'max_spread', value: 400, type: 'number', description: 'Maximum spread (bps)' }
      ]
    }
  },
  
  {
    id: 'callable-bond-ytw',
    name: 'Callable Bond Yield-to-Worst Strategy',
    description: 'Focus on callable bonds with attractive yield-to-worst metrics',
    category: 'Fixed Income',
    strategy: {
      name: 'Callable Bond Yield-to-Worst Strategy',
      description: 'Focus on callable bonds with attractive yield-to-worst metrics',
      cells: [
        createCell(0, `min_ytw = 5.0
min_call_protection_years = 2`, 'general', 'Parameters'),
        
        createCell(1, `callable_bonds = securities.filter(s => s.yield >= min_ytw)
__result__ = callable_bonds.length + ' callable bonds above YTW threshold'`, 'condition', 'YTW Filter'),
        
        createCell(2, `portfolio = callable_bonds
  .sort((a, b) => b.yield - a.yield)
  .slice(0, 30)
__result__ = 'Selected ' + portfolio.length + ' callable bonds'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: [
        { id: 'p1', name: 'min_ytw', value: 5.0, type: 'number', description: 'Minimum yield-to-worst %' }
      ]
    }
  },
  
  {
    id: 'downgrade-risk',
    name: 'Downgrade Risk Strategy',
    description: 'Monitor and manage securities at risk of rating downgrades',
    category: 'Fixed Income',
    strategy: {
      name: 'Downgrade Risk Strategy',
      description: 'Monitor and manage securities at risk of rating downgrades',
      cells: [
        createCell(0, `rating_floor = 'BBB-'
sell_on_downgrade = true`, 'general', 'Parameters'),
        
        createCell(1, `at_risk = securities.filter(s => s.rating === rating_floor)
__result__ = at_risk.length + ' securities at rating floor'`, 'condition', 'Identify At-Risk'),
        
        createCell(2, `if (sell_on_downgrade) {
  sell_list = at_risk.map(s => s.cusip)
  __result__ = 'Flagged ' + sell_list.length + ' securities for potential sale'
}`, 'trade', 'Generate Sell Signals')
      ],
      parameters: [
        { id: 'p1', name: 'rating_floor', value: 'BBB-', type: 'text', description: 'Minimum acceptable rating' }
      ]
    }
  },
  
  {
    id: 'liquidity-constrained',
    name: 'Liquidity-Constrained Bond Strategy',
    description: 'Build portfolio considering liquidity constraints',
    category: 'Fixed Income',
    strategy: {
      name: 'Liquidity-Constrained Bond Strategy',
      description: 'Build portfolio considering liquidity constraints',
      cells: [
        createCell(0, `min_liquidity_score = 70
liquidity_weight = 0.3
yield_weight = 0.7`, 'general', 'Parameters'),
        
        createCell(1, `liquid_securities = securities.filter(s => s.yield >= 4.0)
scored = liquid_securities.map(s => ({
  ...s,
  composite_score: (s.yield * yield_weight)
}))
__result__ = 'Scored ' + scored.length + ' liquid securities'`, 'ranking', 'Score Liquidity & Yield'),
        
        createCell(2, `selected = scored
  .sort((a, b) => b.composite_score - a.composite_score)
  .slice(0, 35)
__result__ = 'Selected ' + selected.length + ' most liquid, high-yield bonds'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: [
        { id: 'p1', name: 'min_liquidity_score', value: 70, type: 'number', description: 'Minimum liquidity score' }
      ]
    }
  },
  
  {
    id: 'book-yield-preservation',
    name: 'Book Yield Preservation Strategy',
    description: 'Maintain or improve book yield through security selection',
    category: 'Fixed Income',
    strategy: {
      name: 'Book Yield Preservation Strategy',
      description: 'Maintain or improve book yield through security selection',
      cells: [
        createCell(0, `current_book_yield = 4.5
min_incremental_yield = 4.6`, 'general', 'Parameters'),
        
        createCell(1, `candidates = securities.filter(s => s.yield >= min_incremental_yield)
__result__ = candidates.length + ' securities above book yield'`, 'condition', 'Yield Filter'),
        
        createCell(2, `selected = candidates
  .sort((a, b) => b.yield - a.yield)
  .slice(0, 20)
__result__ = 'Selected ' + selected.length + ' yield-accretive securities'`, 'portfolio', 'Select Portfolio')
      ],
      parameters: [
        { id: 'p1', name: 'current_book_yield', value: 4.5, type: 'number', description: 'Current book yield %' },
        { id: 'p2', name: 'min_incremental_yield', value: 4.6, type: 'number', description: 'Minimum new security yield %' }
      ]
    }
  },
  
  {
    id: 'dividend-growth',
    name: 'Dividend Growth Strategy',
    description: 'Focus on stocks with consistent dividend growth and sustainable payouts',
    category: 'Equity',
    strategy: {
      name: 'Dividend Growth Strategy',
      description: 'Focus on stocks with consistent dividend growth and sustainable payouts',
      cells: [
        createCell(0, `min_dividend_yield = 2.5
min_growth_years = 5
max_payout_ratio = 65`, 'general', 'Parameters'),
        
        createCell(1, `dividend_stocks = securities.filter(s => s.yield >= min_dividend_yield)
__result__ = dividend_stocks.length + ' stocks meet dividend yield threshold'`, 'universe', 'Dividend Universe'),
        
        createCell(2, `selected = dividend_stocks
  .sort((a, b) => b.yield - a.yield)
  .slice(0, 30)
__result__ = 'Selected ' + selected.length + ' dividend growers'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: [
        { id: 'p1', name: 'min_dividend_yield', value: 2.5, type: 'number', description: 'Minimum dividend yield %' }
      ]
    }
  },
  
  {
    id: 'quality-value',
    name: 'Quality Value Strategy',
    description: 'Combine quality metrics with value characteristics',
    category: 'Equity',
    strategy: {
      name: 'Quality Value Strategy',
      description: 'Combine quality metrics with value characteristics',
      cells: [
        createCell(0, `max_pe_ratio = 15
min_roe = 12
quality_weight = 0.5
value_weight = 0.5`, 'general', 'Parameters'),
        
        createCell(1, `quality_stocks = securities.filter(s => s.price > 0)
scored = quality_stocks.map(s => ({
  ...s,
  composite_score: s.yield * 10
}))
__result__ = 'Scored ' + scored.length + ' quality value stocks'`, 'ranking', 'Score Quality & Value'),
        
        createCell(2, `selected = scored
  .sort((a, b) => b.composite_score - a.composite_score)
  .slice(0, 25)
__result__ = 'Selected ' + selected.length + ' quality value stocks'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: []
    }
  },
  
  {
    id: 'momentum',
    name: 'Momentum Strategy',
    description: 'Invest in stocks showing strong price momentum',
    category: 'Equity',
    strategy: {
      name: 'Momentum Strategy',
      description: 'Invest in stocks showing strong price momentum',
      cells: [
        createCell(0, `lookback_months = 6
min_momentum = 10
rebalance_frequency = 'monthly'`, 'general', 'Parameters'),
        
        createCell(1, `momentum_stocks = securities.filter(s => s.price > 100)
__result__ = momentum_stocks.length + ' stocks with positive momentum'`, 'condition', 'Momentum Filter'),
        
        createCell(2, `selected = momentum_stocks
  .sort((a, b) => b.price - a.price)
  .slice(0, 30)
__result__ = 'Selected top ' + selected.length + ' momentum stocks'`, 'portfolio', 'Select Top Momentum')
      ],
      parameters: []
    }
  },
  
  {
    id: 'low-volatility',
    name: 'Low Volatility Strategy',
    description: 'Build portfolio of stocks with lower-than-market volatility',
    category: 'Equity',
    strategy: {
      name: 'Low Volatility Strategy',
      description: 'Build portfolio of stocks with lower-than-market volatility',
      cells: [
        createCell(0, `max_beta = 0.8
min_market_cap = 5000000000`, 'general', 'Parameters'),
        
        createCell(1, `low_vol_stocks = securities.filter(s => s.price > 50)
__result__ = low_vol_stocks.length + ' low volatility stocks'`, 'condition', 'Low Volatility Filter'),
        
        createCell(2, `selected = low_vol_stocks.slice(0, 40)
__result__ = 'Selected ' + selected.length + ' low volatility stocks'`, 'portfolio', 'Build Portfolio')
      ],
      parameters: []
    }
  },
  
  {
    id: 'monthly-rebalance',
    name: 'Monthly Rebalance Strategy',
    description: 'Systematically rebalance portfolio to target weights',
    category: 'Portfolio',
    strategy: {
      name: 'Monthly Rebalance Strategy',
      description: 'Systematically rebalance portfolio to target weights',
      cells: [
        createCell(0, `rebalance_threshold = 2.0
target_weight = 2.0`, 'general', 'Parameters'),
        
        createCell(1, `positions_to_rebalance = securities.filter(s => s.price > 0)
__result__ = positions_to_rebalance.length + ' positions need rebalancing'`, 'portfolio', 'Check Positions'),
        
        createCell(2, `trades = positions_to_rebalance.map(s => ({
  cusip: s.cusip,
  action: 'rebalance',
  reason: 'REBALANCE'
}))
__result__ = 'Generated ' + trades.length + ' rebalance trades'`, 'trade', 'Generate Trades')
      ],
      parameters: []
    }
  },
  
  {
    id: 'cash-deployment',
    name: 'Cash Deployment Strategy',
    description: 'Deploy excess cash into high-conviction opportunities',
    category: 'Portfolio',
    strategy: {
      name: 'Cash Deployment Strategy',
      description: 'Deploy excess cash into high-conviction opportunities',
      cells: [
        createCell(0, `available_cash = 10000000
min_investment_size = 500000
target_securities = 15`, 'general', 'Parameters'),
        
        createCell(1, `opportunities = securities
  .filter(s => s.yield >= 4.5)
  .sort((a, b) => b.yield - a.yield)
  .slice(0, target_securities)
__result__ = 'Found ' + opportunities.length + ' deployment opportunities'`, 'portfolio', 'Find Opportunities'),
        
        createCell(2, `allocation_per_security = available_cash / opportunities.length
trades = opportunities.map(s => ({
  cusip: s.cusip,
  action: 'buy',
  amount: allocation_per_security,
  reason: 'CASH_DEPLOYMENT'
}))
__result__ = 'Allocated $' + allocation_per_security.toLocaleString() + ' per security'`, 'trade', 'Allocate Cash')
      ],
      parameters: []
    }
  },
  
  {
    id: 'tax-aware-sell',
    name: 'Tax-Aware Sell Strategy',
    description: 'Optimize selling decisions considering tax implications',
    category: 'Portfolio',
    strategy: {
      name: 'Tax-Aware Sell Strategy',
      description: 'Optimize selling decisions considering tax implications',
      cells: [
        createCell(0, `min_hold_days_ltcg = 365
tax_loss_harvest = true`, 'general', 'Parameters'),
        
        createCell(1, `sell_candidates = securities.filter(s => s.price < 100)
__result__ = sell_candidates.length + ' potential sells identified'`, 'condition', 'Identify Candidates'),
        
        createCell(2, `tax_efficient_sells = sell_candidates.map(s => ({
  cusip: s.cusip,
  action: 'sell',
  reason: 'TAX_EFFICIENT_SALE'
}))
__result__ = 'Generated ' + tax_efficient_sells.length + ' tax-efficient sells'`, 'trade', 'Generate Sells')
      ],
      parameters: []
    }
  },
  
  {
    id: 'issuer-concentration',
    name: 'Issuer Concentration Reduction Strategy',
    description: 'Reduce exposure to overweight issuers',
    category: 'Portfolio',
    strategy: {
      name: 'Issuer Concentration Reduction Strategy',
      description: 'Reduce exposure to overweight issuers',
      cells: [
        createCell(0, `max_issuer_weight = 5.0
reduction_increment = 0.5`, 'general', 'Parameters'),
        
        createCell(1, `issuer_exposures = {}
securities.forEach(s => {
  const issuer = s.name.split(' ')[0]
  issuer_exposures[issuer] = (issuer_exposures[issuer] || 0) + 1
})
overweight_issuers = Object.keys(issuer_exposures).filter(i => 
  issuer_exposures[i] > max_issuer_weight
)
__result__ = overweight_issuers.length + ' overweight issuers found'`, 'risk', 'Check Issuer Concentration'),
        
        createCell(2, `reduction_trades = overweight_issuers.map(issuer => ({
  issuer: issuer,
  action: 'reduce',
  reason: 'REDUCE_ISSUER_EXPOSURE'
}))
__result__ = 'Generated ' + reduction_trades.length + ' reduction trades'`, 'trade', 'Generate Reductions')
      ],
      parameters: []
    }
  },
  
  {
    id: 'risk-limit-repair',
    name: 'Risk Limit Repair Strategy',
    description: 'Bring portfolio back into compliance with risk limits',
    category: 'Portfolio',
    strategy: {
      name: 'Risk Limit Repair Strategy',
      description: 'Bring portfolio back into compliance with risk limits',
      cells: [
        createCell(0, `max_portfolio_duration = 6.0
max_sector_weight = 20.0`, 'general', 'Parameters'),
        
        createCell(1, `portfolio_duration = securities.reduce((sum, s) => sum + (s.duration || 0), 0) / securities.length
duration_breach = portfolio_duration > max_portfolio_duration
__result__ = 'Portfolio duration: ' + portfolio_duration.toFixed(2) + (duration_breach ? ' (BREACH)' : ' (OK)')`, 'risk', 'Check Duration'),
        
        createCell(2, `if (duration_breach) {
  high_duration_securities = securities
    .filter(s => s.duration > portfolio_duration)
    .sort((a, b) => b.duration - a.duration)
  reduction_trades = high_duration_securities.slice(0, 5).map(s => ({
    cusip: s.cusip,
    action: 'reduce',
    reason: 'RISK_LIMIT_REPAIR'
  }))
  __result__ = 'Generated ' + reduction_trades.length + ' trades to reduce duration'
} else {
  __result__ = 'No duration repairs needed'
}`, 'trade', 'Repair Duration')
      ],
      parameters: []
    }
  }
]

export function getTemplatesByCategory(category: string): StrategyTemplate[] {
  return strategyTemplates.filter(t => t.category === category)
}

export function getAllCategories(): string[] {
  const categories = new Set(strategyTemplates.map(t => t.category))
  return Array.from(categories).sort()
}

export function getTemplateById(id: string): StrategyTemplate | undefined {
  return strategyTemplates.find(t => t.id === id)
}
