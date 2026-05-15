import {
  CellContract,
  CellContractPreset,
  CellPurpose,
  CodeCell,
  DesignPreviewResult,
  Parameter,
  Strategy,
  StrategyChecklistItem,
  StrategySetupDraft,
} from './types'
import { mockSecurities } from './mockData'

const field = (
  name: string,
  type: CellContract['outputs'][number]['type'],
  required = true,
  description?: string
) => ({ name, type, required, description })

const contract = (
  description: string,
  outputs: CellContract['outputs'],
  options: Partial<CellContract> = {}
): CellContract => ({
  inputs: options.inputs ?? [],
  outputs,
  requiredContext: options.requiredContext ?? [],
  requiredFields: options.requiredFields ?? [],
  validation: options.validation ?? [],
  failureBehavior: options.failureBehavior ?? 'halt',
  description,
  tags: options.tags,
})

export const CONTRACT_PRESETS: CellContractPreset[] = [
  {
    id: 'filtered-universe',
    name: 'Filtered universe',
    description: 'Returns a security list after eligibility filters.',
    contract: contract(
      'Produces a filtered list of securities for downstream ranking or portfolio construction.',
      [field('universe', 'array', true, 'Eligible securities')],
      { inputs: [field('securities', 'array', true)], requiredContext: ['securities'], tags: ['universe', 'filter'] }
    ),
  },
  {
    id: 'enriched-dataset',
    name: 'Enriched dataset',
    description: 'Adds calculated fields to each security row.',
    contract: contract(
      'Adds derived market, yield, spread, or factor fields to a securities collection.',
      [field('enriched', 'array', true, 'Securities with derived fields')],
      { inputs: [field('universe', 'array', true)], requiredContext: ['universe'], tags: ['data', 'enrichment'] }
    ),
  },
  {
    id: 'score-column',
    name: 'Score column',
    description: 'Creates a score used for ranking candidates.',
    contract: contract(
      'Adds a numeric score that can be sorted, filtered, or optimized.',
      [field('scored', 'array', true, 'Rows with score'), field('score', 'number', false)],
      { inputs: [field('enriched', 'array', false), field('universe', 'array', false)], tags: ['score', 'ranking'] }
    ),
  },
  {
    id: 'ranked-candidates',
    name: 'Ranked candidates',
    description: 'Returns candidates ordered by investment preference.',
    contract: contract(
      'Sorts candidates by score, yield, spread, momentum, or another signal.',
      [field('ranked', 'array', true, 'Ordered candidate list')],
      { inputs: [field('scored', 'array', true)], requiredContext: ['scored'], tags: ['ranked', 'candidates'] }
    ),
  },
  {
    id: 'risk-pass-fail',
    name: 'Risk pass/fail',
    description: 'Returns an explicit risk decision with reason.',
    contract: contract(
      'Checks duration, rating, concentration, or liquidity before portfolio/trade output.',
      [field('risk_pass', 'boolean', true), field('risk_reason', 'string', true)],
      { inputs: [field('ranked', 'array', false), field('selected', 'array', false)], tags: ['risk', 'guardrail'], failureBehavior: 'warn' }
    ),
  },
  {
    id: 'trade-signal',
    name: 'Buy/sell/hold signal',
    description: 'Returns a concrete trade signal with a reason.',
    contract: contract(
      'Produces a buy, sell, or hold decision for the backtest engine.',
      [field('action', 'string', true), field('symbol', 'string', false), field('reason', 'string', true)],
      { tags: ['signal', 'trade'] }
    ),
  },
  {
    id: 'target-allocation',
    name: 'Target allocation',
    description: 'Returns desired portfolio weights by symbol or sleeve.',
    contract: contract(
      'Produces target weights for allocation and rebalancing workflows.',
      [field('target_allocation', 'object', true), field('rebalance_reason', 'string', true)],
      { inputs: [field('ranked', 'array', false)], tags: ['allocation', 'portfolio'] }
    ),
  },
]

export const cloneContractPreset = (presetId: string): CellContract => {
  const preset = CONTRACT_PRESETS.find(item => item.id === presetId) ?? CONTRACT_PRESETS[0]
  return structuredClone(preset.contract)
}

export const getContractPresetForPurpose = (purpose: CellPurpose) => {
  const map: Partial<Record<CellPurpose, string>> = {
    universe: 'filtered-universe',
    data: 'enriched-dataset',
    calculation: 'score-column',
    condition: 'risk-pass-fail',
    ranking: 'ranked-candidates',
    risk: 'risk-pass-fail',
    portfolio: 'target-allocation',
    allocation: 'target-allocation',
    trade: 'trade-signal',
  }
  return map[purpose] ?? 'enriched-dataset'
}

export const PURPOSE_OPTIONS: Array<{ purpose: CellPurpose; label: string; description: string }> = [
  { purpose: 'universe', label: 'Universe', description: 'Choose eligible securities.' },
  { purpose: 'data', label: 'Data', description: 'Attach or enrich market data.' },
  { purpose: 'calculation', label: 'Calculation', description: 'Compute yield, spread, return, or factor values.' },
  { purpose: 'condition', label: 'Condition', description: 'Create pass/fail logic.' },
  { purpose: 'ranking', label: 'Ranking', description: 'Score and sort candidates.' },
  { purpose: 'risk', label: 'Risk', description: 'Check limits before trades or allocations.' },
  { purpose: 'portfolio', label: 'Portfolio', description: 'Select holdings or portfolio candidates.' },
  { purpose: 'trade', label: 'Trade', description: 'Generate buy, sell, or hold decisions.' },
  { purpose: 'allocation', label: 'Allocation', description: 'Generate target weights and rebalance intent.' },
  { purpose: 'general', label: 'General', description: 'Start with a blank strategy cell.' },
]

const starterCode: Record<CellPurpose, string> = {
  universe: `universe = securities.filter(s => s.rating >= 'A' && s.yield >= min_yield)
result(universe)`,
  data: `enriched = universe.map(s => ({
  ...s,
  current_yield: (s.coupon / s.price) * 100,
  spread_score: s.spread ?? 0
}))
result(enriched)`,
  calculation: `scored = enriched.map(s => ({
  ...s,
  score: (s.current_yield * 0.7) - (s.duration * 0.2) + ((s.spread ?? 0) / 100)
}))
result(scored)`,
  condition: `risk_pass = ranked.length > 0
risk_reason = risk_pass ? 'Candidates available' : 'No candidates passed filters'
result({ risk_pass, risk_reason })`,
  ranking: `scored = enriched.map(s => ({
  ...s,
  score: (s.current_yield * 0.7) - (s.duration * 0.2) + ((s.spread ?? 0) / 100)
}))
ranked = scored.sort((a, b) => b.score - a.score)
result(ranked)`,
  risk: `selected = ranked.slice(0, target_holding_count)
risk_pass = selected.every(s => s.duration <= max_duration)
risk_reason = risk_pass ? 'All holdings within duration cap' : 'One or more holdings breach duration cap'
result({ risk_pass, risk_reason, selected })`,
  portfolio: `selected = ranked.slice(0, target_holding_count)
portfolio = selected.map((s, index) => ({
  ...s,
  target_weight: Number((1 / selected.length).toFixed(4)),
  rank: index + 1
}))
result(portfolio)`,
  trade: `best = selected?.[0] ?? ranked?.[0]
if (best && risk_pass !== false) {
  result({ action: 'buy', symbol: best.cusip, reason: 'Top ranked candidate passed risk checks' })
} else {
  result({ action: 'hold', reason: risk_reason ?? 'No eligible candidate' })
}`,
  allocation: `target_allocation = Object.fromEntries(
  selected.slice(0, target_holding_count).map(s => [s.cusip, Number((1 / target_holding_count).toFixed(4))])
)
result({ target_allocation, rebalance_reason: 'Equal-weight target from ranked candidates' })`,
  optimization: `objective = 'maximize risk-adjusted yield'
result({ objective })`,
  constraint: `constraint_pass = true
result({ constraint_pass })`,
  general: '',
}

const purposeLabel = (purpose: CellPurpose) => PURPOSE_OPTIONS.find(item => item.purpose === purpose)?.label ?? 'General'

export const createPurposeCell = (index: number, purpose: CellPurpose): CodeCell => {
  const presetId = getContractPresetForPurpose(purpose)
  return {
    id: `cell-${index}`,
    index,
    code: starterCode[purpose],
    output: '',
    status: 'idle',
    mode: purpose === 'general' ? 'code' : purpose === 'universe' || purpose === 'condition' ? 'visual' : 'code',
    purpose,
    label: purpose === 'general' ? `Cell ${index}` : `${purposeLabel(purpose)} Step`,
    contract: purpose === 'general' ? undefined : cloneContractPreset(presetId),
  }
}

const parametersForDraft = (draft: StrategySetupDraft): Parameter[] => {
  if (draft.family === 'equity-momentum') {
    return [
      { id: 'p-min-momentum', name: 'min_momentum', value: 10, type: 'number', description: 'Minimum momentum threshold' },
      { id: 'p-target-holdings', name: 'target_holding_count', value: 3, type: 'number', description: 'Target number of holdings' },
      { id: 'p-max-duration', name: 'max_duration', value: 10, type: 'number', description: 'Compatibility guard for mixed fixtures' },
    ]
  }

  return [
    { id: 'p-min-yield', name: 'min_yield', value: 3.0, type: 'number', description: 'Minimum yield threshold' },
    { id: 'p-max-duration', name: 'max_duration', value: 6.5, type: 'number', description: 'Maximum duration years' },
    { id: 'p-target-holdings', name: 'target_holding_count', value: 3, type: 'number', description: 'Target number of holdings' },
  ]
}

export const defaultStrategySetupDraft = (): StrategySetupDraft => ({
  family: 'fixed-income-yield',
  universe: 'investment-grade',
  datasetFit: 'fixture',
  outputMode: 'trade-signal',
  includeRiskControls: true,
  rebalanceCadence: 'weekly',
})

export const createStrategyFromDraft = (draft: StrategySetupDraft): Strategy => {
  const finalPurpose: CellPurpose = draft.outputMode === 'target-allocation' ? 'allocation' : 'trade'
  const purposes: CellPurpose[] = [
    'universe',
    'data',
    draft.family === 'equity-momentum' ? 'calculation' : 'ranking',
    ...(draft.includeRiskControls ? ['risk' as CellPurpose] : []),
    'portfolio',
    finalPurpose,
  ]
  const cells = purposes.map((purpose, index) => createPurposeCell(index, purpose))
  const familyName = draft.family === 'equity-momentum'
    ? 'Equity Momentum Strategy'
    : draft.family === 'allocation'
      ? 'Target Allocation Strategy'
      : 'Fixed-Income Yield Strategy'

  return {
    id: `strategy-${Date.now()}`,
    name: familyName,
    description: `${familyName} generated from the setup wizard with ${draft.rebalanceCadence} review cadence.`,
    cells,
    parameters: parametersForDraft(draft),
    transitions: {},
    governance: {
      reviewStatus: 'draft',
      version: 1,
      auditLog: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export const buildStrategyChecklist = (
  strategy: Strategy,
  proofIsStale: boolean
): StrategyChecklistItem[] => {
  const cells = Array.isArray(strategy.cells) ? strategy.cells : []
  const hasPurpose = (purpose: CellPurpose | CellPurpose[]) => {
    const purposes = Array.isArray(purpose) ? purpose : [purpose]
    return cells.find(cell => purposes.includes(cell.purpose))
  }
  const emptyCell = cells.find(cell => !cell.code.trim())
  const missingContract = cells.find(cell => cell.purpose !== 'general' && !cell.contract)
  const unsafeBackward = cells.find(cell =>
    cell.controlFlow?.type === 'goto' &&
    cell.controlFlow.target != null &&
    cell.controlFlow.target <= cell.index
  )
  const parameterNames = new Set((strategy.parameters ?? []).map(parameter => parameter.name))
  const usedParameters = new Set(
    cells.flatMap(cell => Array.from(parameterNames).filter(name => cell.code.includes(name)))
  )

  return [
    {
      id: 'strategy-name',
      label: 'Strategy named',
      status: strategy.name && strategy.name !== 'New Strategy' ? 'complete' : 'missing',
      detail: strategy.name && strategy.name !== 'New Strategy' ? strategy.name : 'Give this strategy a research-ready name.',
      action: 'name-strategy',
    },
    {
      id: 'universe',
      label: 'Universe defined',
      status: hasPurpose('universe') ? 'complete' : 'missing',
      detail: hasPurpose('universe') ? 'Universe cell is present.' : 'Add a Universe cell or run the setup wizard.',
      cellIndex: hasPurpose('universe')?.index,
      action: 'add-cell',
    },
    {
      id: 'data',
      label: 'Data step present',
      status: hasPurpose('data') ? 'complete' : 'warning',
      detail: hasPurpose('data') ? 'Data/enrichment cell is present.' : 'Add a Data cell if this strategy needs derived fields.',
      cellIndex: hasPurpose('data')?.index,
      action: 'add-cell',
    },
    {
      id: 'signal',
      label: 'Signal or ranking present',
      status: hasPurpose(['ranking', 'calculation', 'condition']) ? 'complete' : 'missing',
      detail: hasPurpose(['ranking', 'calculation', 'condition'])
        ? 'Strategy has a signal-building step.'
        : 'Add Ranking, Calculation, or Condition logic.',
      cellIndex: hasPurpose(['ranking', 'calculation', 'condition'])?.index,
      action: 'add-cell',
    },
    {
      id: 'risk',
      label: 'Risk rule present',
      status: hasPurpose('risk') ? 'complete' : 'warning',
      detail: hasPurpose('risk') ? 'Risk guardrail is present.' : 'Consider a Risk cell before portfolio output.',
      cellIndex: hasPurpose('risk')?.index,
      action: 'add-cell',
    },
    {
      id: 'output',
      label: 'Portfolio/trade output present',
      status: hasPurpose(['portfolio', 'trade', 'allocation']) ? 'complete' : 'missing',
      detail: hasPurpose(['portfolio', 'trade', 'allocation'])
        ? 'The strategy has a final output stage.'
        : 'Add Portfolio, Trade, or Allocation output.',
      cellIndex: hasPurpose(['portfolio', 'trade', 'allocation'])?.index,
      action: 'add-cell',
    },
    {
      id: 'contracts',
      label: 'Contracts attached',
      status: missingContract ? 'warning' : 'complete',
      detail: missingContract ? `Cell ${missingContract.index} has no output contract.` : 'Purpose cells have contracts.',
      cellIndex: missingContract?.index,
    },
    {
      id: 'parameters',
      label: 'Parameters used',
      status: parameterNames.size === 0 ? 'warning' : usedParameters.size === parameterNames.size ? 'complete' : 'warning',
      detail: parameterNames.size === 0
        ? 'No parameters defined yet.'
        : `${usedParameters.size} of ${parameterNames.size} parameters are referenced by cells.`,
    },
    {
      id: 'empty-cells',
      label: 'No empty cells',
      status: emptyCell ? 'warning' : 'complete',
      detail: emptyCell ? `Cell ${emptyCell.index} has no code yet.` : 'Every cell has starter logic.',
      cellIndex: emptyCell?.index,
    },
    {
      id: 'loop-safety',
      label: 'No unsafe backward jumps',
      status: unsafeBackward ? 'missing' : 'complete',
      detail: unsafeBackward ? `Cell ${unsafeBackward.index} jumps backward without a visible guard.` : 'No unsafe backward jumps detected.',
      cellIndex: unsafeBackward?.index,
    },
    {
      id: 'proof',
      label: 'Backtest proof current',
      status: proofIsStale ? 'warning' : 'complete',
      detail: proofIsStale ? 'Backtest proof is stale after edits.' : 'No stale proof warning.',
      action: 'run-backtest',
    },
  ]
}

const securityRows = () => mockSecurities.slice(0, 5).map(security => ({
  cusip: security.cusip,
  name: security.name,
  rating: security.rating,
  yield: security.yield,
  duration: security.duration,
  spread: security.spread ?? 0,
}))

export const buildDesignPreview = (cell: CodeCell, priorCells: CodeCell[]): DesignPreviewResult => {
  if (!cell.code.trim() && (!cell.visualConfig || Object.keys(cell.visualConfig).length === 0)) {
    return { status: 'empty', message: 'Add code or visual rules to preview this cell.', columns: [], rows: [] }
  }

  const requiredInputs = cell.contract?.inputs.filter(input => input.required).map(input => input.name) ?? []
  const availableOutputs = new Set(priorCells.flatMap(prior => prior.contract?.outputs.map(output => output.name) ?? []))
  const missingInputs = requiredInputs.filter(input => input !== 'securities' && !availableOutputs.has(input))
  if (missingInputs.length > 0) {
    return {
      status: 'blocked',
      message: `Waiting for upstream output: ${missingInputs.join(', ')}.`,
      columns: [],
      rows: [],
    }
  }

  if (/\bthrow\b|new Function|eval\s*\(/.test(cell.code)) {
    return { status: 'error', message: 'Preview skipped because this cell contains unsafe preview-only syntax.', columns: [], rows: [] }
  }

  const baseRows = securityRows()
  const rows = (() => {
    switch (cell.purpose) {
      case 'universe':
        return baseRows.filter(row => String(row.rating).startsWith('A')).slice(0, 5)
      case 'data':
        return baseRows.map(row => ({ ...row, current_yield: Number((Number(row.yield) + Number(row.spread) / 1000).toFixed(2)) }))
      case 'calculation':
      case 'ranking':
        return baseRows
          .map(row => ({ ...row, score: Number((Number(row.yield) * 0.7 - Number(row.duration) * 0.2).toFixed(2)) }))
          .sort((a, b) => Number(b.score) - Number(a.score))
      case 'risk':
      case 'condition':
        return baseRows.map(row => ({
          cusip: row.cusip,
          rating: row.rating,
          duration: row.duration,
          risk_pass: Number(row.duration) <= 6.5,
          risk_reason: Number(row.duration) <= 6.5 ? 'Within duration cap' : 'Duration cap breach',
        }))
      case 'portfolio':
        return baseRows.slice(0, 3).map((row, index) => ({ ...row, rank: index + 1, target_weight: '33.33%' }))
      case 'allocation':
        return baseRows.slice(0, 3).map(row => ({ cusip: row.cusip, target_weight: '33.33%', rebalance: 'buy_to_target' }))
      case 'trade':
        return [{ action: 'buy', symbol: baseRows[0]?.cusip ?? 'n/a', reason: 'Top ranked candidate passed risk checks' }]
      default:
        return baseRows.slice(0, 3)
    }
  })()

  return {
    status: rows.length > 0 ? 'ready' : 'empty',
    message: rows.length > 0 ? 'Preview uses mock securities and does not update run history.' : 'No preview rows matched this cell.',
    columns: rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [],
    rows,
  }
}
