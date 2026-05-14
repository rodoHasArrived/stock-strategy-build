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
  },
  
  {
    id: 'high-yield-credit-rotation',
    name: 'High-Yield Credit Rotation Strategy',
    description: 'Advanced multi-stage strategy that rotates between high-yield bonds based on credit trends, yield spreads, and sector momentum with iterative optimization',
    category: 'Fixed Income',
    strategy: {
      name: 'High-Yield Credit Rotation Strategy',
      description: 'Advanced multi-stage strategy that rotates between high-yield bonds based on credit trends, yield spreads, and sector momentum with iterative optimization',
      cells: [
        createCell(0, `min_yield = 6.0
max_yield = 12.0
min_spread = 300
max_spread = 700
target_duration = 4.5
duration_tolerance = 1.5
max_position_weight = 3.0
max_sector_weight = 25.0
max_issuer_weight = 5.0
target_portfolio_size = 30
min_liquidity_score = 50
rebalance_threshold = 2.5
max_iterations = 5`, 'general', 'Strategy Parameters'),
        
        createCell(1, `high_yield_universe = securities.filter(s => 
  s.rating >= 'BB' && 
  s.rating <= 'B' &&
  s.yield >= min_yield &&
  s.yield <= max_yield
)
universe_count = high_yield_universe.length
__result__ = 'Universe: ' + universe_count + ' high-yield bonds (BB to B rating)'`, 'universe', 'Define High-Yield Universe'),
        
        createCell(2, `if (universe_count === 0) {
  __result__ = 'ERROR: No securities in universe - stopping execution'
  goto: 'stop'
} else if (universe_count < target_portfolio_size) {
  __result__ = 'WARNING: Only ' + universe_count + ' securities available (target: ' + target_portfolio_size + ')'
  next
} else {
  __result__ = 'Sufficient universe size - continuing to analysis'
  next
}`, 'condition', 'Validate Universe Size'),
        
        createCell(3, `enriched_universe = high_yield_universe.map(s => {
  const annual_coupon = s.coupon * 1000
  const current_yield = (annual_coupon / s.price) * 100
  const ytm_estimate = current_yield + ((1000 - s.price) / (s.duration || 5)) / s.price * 100
  const spread_to_benchmark = s.spread || (s.yield - 3.5) * 100
  
  return {
    ...s,
    current_yield: current_yield,
    ytm_estimate: ytm_estimate,
    spread_bps: spread_to_benchmark,
    duration_adjusted_yield: s.yield / (s.duration || 4.5)
  }
})
__result__ = 'Calculated yield metrics for ' + enriched_universe.length + ' securities'`, 'calculation', 'Calculate Yield Metrics'),
        
        createCell(4, `spread_filtered = enriched_universe.filter(s => 
  s.spread_bps >= min_spread && 
  s.spread_bps <= max_spread
)
duration_filtered = spread_filtered.filter(s =>
  Math.abs(s.duration - target_duration) <= duration_tolerance
)
__result__ = 'After filters: ' + duration_filtered.length + ' securities (spread: ' + spread_filtered.length + ', duration: ' + duration_filtered.length + ')'`, 'condition', 'Apply Spread & Duration Filters'),
        
        createCell(5, `scored_securities = duration_filtered.map(s => {
  const yield_score = (s.yield - min_yield) / (max_yield - min_yield) * 40
  const spread_score = (s.spread_bps - min_spread) / (max_spread - min_spread) * 30
  const duration_score = (1 - Math.abs(s.duration - target_duration) / duration_tolerance) * 15
  const liquidity_score = Math.min(s.yield / max_yield * 100, 100) * 0.15
  
  const composite_score = yield_score + spread_score + duration_score + liquidity_score
  
  return {
    ...s,
    yield_score,
    spread_score,
    duration_score,
    liquidity_score,
    composite_score
  }
})

ranked_securities = scored_securities.sort((a, b) => b.composite_score - a.composite_score)
__result__ = 'Scored and ranked ' + ranked_securities.length + ' securities by composite metric'`, 'ranking', 'Multi-Factor Scoring'),
        
        createCell(6, `top_securities = ranked_securities.slice(0, target_portfolio_size * 2)

sector_exposures = {}
issuer_exposures = {}

top_securities.forEach(s => {
  const sector = s.name.split(' ')[0]
  const issuer = s.name.split(' ')[0]
  sector_exposures[sector] = (sector_exposures[sector] || 0) + 1
  issuer_exposures[issuer] = (issuer_exposures[issuer] || 0) + 1
})

overweight_sectors = Object.keys(sector_exposures).filter(sector => 
  (sector_exposures[sector] / top_securities.length * 100) > max_sector_weight
)
overweight_issuers = Object.keys(issuer_exposures).filter(issuer => 
  (issuer_exposures[issuer] / top_securities.length * 100) > max_issuer_weight
)

__result__ = 'Pre-check: ' + overweight_sectors.length + ' overweight sectors, ' + overweight_issuers.length + ' overweight issuers'`, 'risk', 'Pre-Allocation Risk Check'),
        
        createCell(7, `iteration = 0
max_iterations_reached = false
portfolio_compliant = false
current_portfolio = []`, 'general', 'Initialize Optimization Loop'),
        
        createCell(8, `iteration = iteration + 1

if (iteration > max_iterations) {
  max_iterations_reached = true
  __result__ = 'Max iterations (' + max_iterations + ') reached - using best available portfolio'
} else {
  current_portfolio = []
  sector_weights = {}
  issuer_weights = {}
  
  for (let i = 0; i < ranked_securities.length && current_portfolio.length < target_portfolio_size; i++) {
    const security = ranked_securities[i]
    const sector = security.name.split(' ')[0]
    const issuer = security.name.split(' ')[0]
    
    const projected_sector_weight = ((sector_weights[sector] || 0) + 1) / (current_portfolio.length + 1) * 100
    const projected_issuer_weight = ((issuer_weights[issuer] || 0) + 1) / (current_portfolio.length + 1) * 100
    
    if (projected_sector_weight <= max_sector_weight && projected_issuer_weight <= max_issuer_weight) {
      current_portfolio.push(security)
      sector_weights[sector] = (sector_weights[sector] || 0) + 1
      issuer_weights[issuer] = (issuer_weights[issuer] || 0) + 1
    }
  }
  
  __result__ = 'Iteration ' + iteration + ': Built portfolio with ' + current_portfolio.length + ' securities'
}`, 'optimization', 'Construct Constrained Portfolio'),
        
        createCell(9, `if (max_iterations_reached || current_portfolio.length >= target_portfolio_size * 0.9) {
  portfolio_compliant = true
  __result__ = 'Portfolio construction complete with ' + current_portfolio.length + ' securities'
} else {
  __result__ = 'Portfolio only has ' + current_portfolio.length + ' securities - adjusting constraints'
  max_sector_weight = max_sector_weight + 2.5
  max_issuer_weight = max_issuer_weight + 1.0
  goto: 8
}`, 'condition', 'Validate Portfolio & Loop'),
        
        createCell(10, `equal_weight = 100 / current_portfolio.length
position_weights = {}

final_portfolio = current_portfolio.map(s => {
  position_weights[s.cusip] = equal_weight
  return {
    cusip: s.cusip,
    name: s.name,
    weight: equal_weight,
    yield: s.yield,
    duration: s.duration,
    rating: s.rating,
    score: s.composite_score
  }
})

portfolio_duration = final_portfolio.reduce((sum, p) => sum + (p.duration * p.weight / 100), 0)
portfolio_yield = final_portfolio.reduce((sum, p) => sum + (p.yield * p.weight / 100), 0)

__result__ = 'Allocated equal weight (' + equal_weight.toFixed(2) + '%) to ' + final_portfolio.length + ' positions'`, 'portfolio', 'Allocate Portfolio Weights'),
        
        createCell(11, `duration_breach = Math.abs(portfolio_duration - target_duration) > duration_tolerance
sector_breach = false
issuer_breach = false

final_sector_weights = {}
final_issuer_weights = {}

final_portfolio.forEach(p => {
  const sector = p.name.split(' ')[0]
  const issuer = p.name.split(' ')[0]
  final_sector_weights[sector] = (final_sector_weights[sector] || 0) + p.weight
  final_issuer_weights[issuer] = (final_issuer_weights[issuer] || 0) + p.weight
})

Object.values(final_sector_weights).forEach(w => {
  if (w > max_sector_weight) sector_breach = true
})

Object.values(final_issuer_weights).forEach(w => {
  if (w > max_issuer_weight) issuer_breach = true
})

risk_status = 'PASS'
if (duration_breach || sector_breach || issuer_breach) {
  risk_status = 'FAIL'
}

__result__ = 'Risk Check: ' + risk_status + ' | Duration: ' + portfolio_duration.toFixed(2) + ' | Yield: ' + portfolio_yield.toFixed(2) + '%'`, 'risk', 'Final Risk Validation'),
        
        createCell(12, `buy_list = final_portfolio.map(p => ({
  id: 'trade-' + p.cusip,
  security: p.name,
  cusip: p.cusip,
  action: 'buy',
  quantity: 1000000 * (p.weight / 100),
  price: 0,
  reason: 'BUY_HIGH_SCORE',
  score: p.score
}))

excluded_securities = ranked_securities.slice(current_portfolio.length).slice(0, 10)
exclude_list = excluded_securities.map(s => ({
  cusip: s.cusip,
  name: s.name,
  reason: 'Score too low or concentration breach',
  score: s.composite_score
}))

__result__ = 'Generated ' + buy_list.length + ' buy orders | Excluded: ' + exclude_list.length + ' securities'`, 'trade', 'Generate Trade List'),
        
        createCell(13, `portfolio_summary = {
  security_count: final_portfolio.length,
  total_weight: final_portfolio.reduce((sum, p) => sum + p.weight, 0),
  avg_yield: portfolio_yield,
  avg_duration: portfolio_duration,
  avg_rating: final_portfolio[0]?.rating || 'N/A',
  iterations_used: iteration,
  risk_compliant: risk_status === 'PASS'
}

sector_summary = Object.entries(final_sector_weights).map(([sector, weight]) => ({
  sector,
  weight: weight.toFixed(2) + '%',
  breach: weight > max_sector_weight
}))

__result__ = JSON.stringify(portfolio_summary, null, 2) + '\\n\\nSector Exposures:\\n' + JSON.stringify(sector_summary, null, 2)`, 'general', 'Portfolio Summary Report')
      ],
      parameters: [
        { id: 'p1', name: 'min_yield', value: 6.0, type: 'number', description: 'Minimum acceptable yield %' },
        { id: 'p2', name: 'max_yield', value: 12.0, type: 'number', description: 'Maximum yield threshold %' },
        { id: 'p3', name: 'min_spread', value: 300, type: 'number', description: 'Minimum credit spread (bps)' },
        { id: 'p4', name: 'max_spread', value: 700, type: 'number', description: 'Maximum credit spread (bps)' },
        { id: 'p5', name: 'target_duration', value: 4.5, type: 'number', description: 'Target portfolio duration' },
        { id: 'p6', name: 'max_sector_weight', value: 25.0, type: 'number', description: 'Max sector concentration %' },
        { id: 'p7', name: 'max_issuer_weight', value: 5.0, type: 'number', description: 'Max issuer concentration %' },
        { id: 'p8', name: 'target_portfolio_size', value: 30, type: 'number', description: 'Target number of holdings' }
      ]
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
