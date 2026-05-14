import { useState, useEffect, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CodeCell, Parameter, RunTraceEntry, Strategy, ExecutionContext, PortfolioConstraint, OptimizationConfig, Trade, TimeSeriesConfig, CellComment, StrategyTemplate, BacktestConfig, BacktestResult, TransitionRule, GovernanceConfig } from '@/lib/types'
import { CodeCellComponent } from '@/components/CodeCellComponent'
import { ParameterPanel } from '@/components/ParameterPanel'
import { ContextInspector } from '@/components/ContextInspector'
import { FlowDiagram } from '@/components/FlowDiagram'
import { StrategyExecutor } from '@/lib/executor'
import { AMXDataCatalog, AMXDataField } from '@/components/AMXDataCatalog'
import { YieldCalculator } from '@/components/YieldCalculator'
import { TransitionEditor } from '@/components/TransitionEditor'
import { ConstraintBuilder } from '@/components/ConstraintBuilder'
import { OptimizationCell } from '@/components/OptimizationCell'
import { TradeList } from '@/components/TradeList'
import { TimeSeriesTools } from '@/components/TimeSeriesTools'
import { CellComments } from '@/components/CellComments'
import { TemplateGallery } from '@/components/TemplateGallery'
import { BacktestBuilder } from '@/components/BacktestBuilder'
import { RunTraceViewer } from '@/components/RunTraceViewer'
import { GovernancePanel } from '@/components/GovernancePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FloppyDisk, Code, Plus, PlayCircle, FlowArrow, Database, Calculator, SidebarSimple, ChartLine, DownloadSimple, Columns, Shield, Rocket, Sparkle, ArrowsOutSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { BacktestEngine } from '@/lib/backtestEngine'
import { DataFrame, readJSON, toDatetime, toNumeric } from '@/lib/dataFrame'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { cn } from '@/lib/utils'
import { saveStrategyExternal, saveRunLog, downloadJSON } from '@/lib/persistence'
import { strategyTemplates } from '@/lib/templates'
import { trackRetentionVisit, trackInitialValueRealization, trackAdvancedFeatureUsage, trackStrategyComplexity, trackEvent } from '@/lib/telemetry'

type ActiveInsertionTarget = {
  cellIndex: number
  mode: 'visual' | 'formula' | 'code'
}

const createDefaultCell = (index: number, code: string = ''): CodeCell => ({
  id: `cell-${index}`,
  index,
  code,
  output: '',
  status: 'idle',
  mode: 'code',
  purpose: 'general'
})

const createDefaultGovernance = (): GovernanceConfig => ({
  reviewStatus: 'draft',
  version: 1,
  auditLog: [],
})

const createDefaultStrategy = (): Strategy => ({
  id: 'default',
  name: 'New Strategy',
  description: '',
  cells: [createDefaultCell(0)],
  parameters: [],
  transitions: {},
  governance: createDefaultGovernance(),
  createdAt: Date.now(),
  updatedAt: Date.now()
})

const getFieldInsertSeparator = (code: string, mode: ActiveInsertionTarget['mode']) => {
  if (code.trim().length === 0) return ''
  if (mode === 'code') {
    return code.endsWith('\n') ? '' : '\n'
  }
  return ' '
}

type WorkspacePath = 'quick' | 'advanced'

type QuickSummary =
  | { type: 'cells'; successCount: number; errorCount: number; traceCount: number }
  | { type: 'backtest'; finalValue: number; cagr: number; trades: number }

const UI_STORAGE_KEYS = {
  path: 'ui-workspace-path-v1',
  showAdvanced: 'ui-show-advanced-v1',
  onboardingDone: 'ui-onboarding-done-v1',
}

const CELL_PRESETS = [
  {
    id: 'universe-filter-rank-portfolio',
    name: 'Universe → Filter → Rank → Portfolio',
    description: 'Starter flow for selection and portfolio construction',
    cells: [
      { label: 'Universe', purpose: 'universe' as const, code: 'universe = securities\n__result__ = universe.length + " securities"' },
      { label: 'Filter', purpose: 'condition' as const, code: 'filtered = universe.filter(s => s.yield >= 4.5)\n__result__ = filtered.length + " passed filter"' },
      { label: 'Rank', purpose: 'ranking' as const, code: 'ranked = filtered.sort((a, b) => b.yield - a.yield)\n__result__ = "Ranked " + ranked.length' },
      { label: 'Portfolio', purpose: 'portfolio' as const, code: 'portfolio = ranked.slice(0, 25)\n__result__ = "Selected " + portfolio.length' },
    ],
    parameters: [
      { name: 'min_yield', value: 4.5, type: 'number' as const, description: 'Minimum acceptable yield (%)' },
      { name: 'target_count', value: 25, type: 'number' as const, description: 'Target number of positions' },
    ],
  },
  {
    id: 'risk-check-trade',
    name: 'Risk Check → Trade Generation',
    description: 'Starter flow for compliance and order generation',
    cells: [
      { label: 'Risk Check', purpose: 'risk' as const, code: 'breaches = securities.filter(s => s.duration > 7)\n__result__ = breaches.length + " breaches"' },
      { label: 'Trade Generation', purpose: 'trade' as const, code: 'trades = breaches.map(s => ({ cusip: s.cusip, action: "reduce", reason: "RISK_BREACH" }))\n__result__ = "Generated " + trades.length + " trades"' },
    ],
    parameters: [
      { name: 'max_duration', value: 7, type: 'number' as const, description: 'Maximum duration threshold' },
    ],
  },
]

function App() {
  const [strategy, setStrategy] = useKV<Strategy>('current-strategy', createDefaultStrategy())
  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl: string } | undefined>(undefined)
  const [runTrace, setRunTrace] = useState<RunTraceEntry[]>([])

  const [executionContext, setExecutionContext] = useState<ExecutionContext>({
    variables: {},
    currentCell: 0,
    maxIterations: 1000,
    iterationCount: 0
  })

  const [highlightedCell, setHighlightedCell] = useState<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<string>('backtest')
  const [leftPanelTab, setLeftPanelTab] = useState<'data' | 'tools'>('data')
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'trace' | 'governance'>('inspector')
  /** 'notebook' = cells only, 'map' = flow only, 'split' = side-by-side */
  const [viewMode, setViewMode] = useState<'notebook' | 'map' | 'split'>('notebook')
  const [activeInsertionTarget, setActiveInsertionTarget] = useState<ActiveInsertionTarget>({
    cellIndex: 0,
    mode: 'formula'
  })
  
  const [constraints, setConstraints] = useKV<PortfolioConstraint[]>('portfolio-constraints', [])
  const [optimizationConfig, setOptimizationConfig] = useKV<OptimizationConfig>('optimization-config', {
    objective: 'maximize_yield',
    constraints: [],
    enabled: true
  })
  const [mockTrades] = useState<Trade[]>([
    {
      id: 'trade-1',
      security: 'ABC 5.25 2030',
      cusip: '12345ABC',
      action: 'buy',
      quantity: 1500000,
      price: 98.75,
      reason: 'BUY_HIGH_SCORE',
      score: 85.3
    },
    {
      id: 'trade-2',
      security: 'XYZ 4.80 2029',
      cusip: '67890XYZ',
      action: 'sell',
      quantity: 750000,
      price: 101.20,
      reason: 'SELL_FAILED_RATING',
      reasonDetails: 'Rating downgraded below BBB-',
      score: 32.1
    },
    {
      id: 'trade-3',
      security: 'DEF 6.10 2032',
      cusip: 'DEF123456',
      action: 'hold',
      price: 99.10,
      reason: 'HOLD_WITHIN_TOLERANCE',
      score: 68.9
    }
  ])
  const [cellComments, setCellComments] = useKV<CellComment[]>('cell-comments', [])
  const [workspacePath, setWorkspacePath] = useState<WorkspacePath>(() => {
    if (typeof window === 'undefined') return 'quick'
    const stored = window.localStorage.getItem(UI_STORAGE_KEYS.path)
    return stored === 'advanced' ? 'advanced' : 'quick'
  })
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(UI_STORAGE_KEYS.showAdvanced) === 'true'
  })
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(UI_STORAGE_KEYS.onboardingDone) !== 'true'
  })
  const [quickSummary, setQuickSummary] = useState<QuickSummary | null>(null)
  const [lastRunError, setLastRunError] = useState<string | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [backtestQuickRunRequest, setBacktestQuickRunRequest] = useState(0)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await window.spark.user()
        if (user) {
          setCurrentUser({
            login: user.login,
            avatarUrl: user.avatarUrl
          })
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }
    }
    fetchUser()
  }, [])

  const handleCellCodeChange = (index: number, code: string) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const newCells = [...current.cells]
      newCells[index] = { ...newCells[index], code }
      return {
        ...current,
        cells: newCells,
        updatedAt: Date.now()
      }
    })
  }

  const handleCellChange = (index: number, updates: Partial<CodeCell>) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const newCells = [...current.cells]
      newCells[index] = { ...newCells[index], ...updates }
      return {
        ...current,
        cells: newCells,
        updatedAt: Date.now()
      }
    })
  }

  const handleDeleteCell = (index: number) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const newCells = current.cells.filter((_, i) => i !== index)
      const reindexedCells = newCells.map((cell, i) => ({
        ...cell,
        id: `cell-${i}`,
        index: i
      }))
      return {
        ...current,
        cells: reindexedCells.length > 0 ? reindexedCells : [createDefaultCell(0)],
        updatedAt: Date.now()
      }
    })
  }

  const handleDuplicateCell = (index: number) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const source = current.cells[index]
      const newCells = [...current.cells]
      // Insert duplicate immediately after the source cell
      const duplicate: CodeCell = {
        ...source,
        status: 'idle',
        output: '',
        error: undefined,
        executionTime: undefined,
        rowCountDelta: undefined,
        sampleOutput: undefined,
        label: source.label ? `${source.label} (copy)` : undefined
      }
      newCells.splice(index + 1, 0, duplicate)
      const reindexedCells = newCells.map((cell, i) => ({ ...cell, index: i, id: `cell-${i}` }))
      return {
        ...current,
        cells: reindexedCells,
        updatedAt: Date.now()
      }
    })
    toast.info('Cell duplicated')
  }

  const handleAddCell = () => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const newIndex = current.cells.length
      const newCell: CodeCell = createDefaultCell(newIndex)
      return {
        ...current,
        cells: [...current.cells, newCell],
        updatedAt: Date.now()
      }
    })
  }

  const handleRunCell = async (index: number) => {
    if (!strategy || !Array.isArray(strategy.cells)) return

    const executor = new StrategyExecutor(strategy.cells, strategy.parameters)
    
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      const newCells = [...current.cells]
      newCells[index] = { ...newCells[index], status: 'running' }
      return { ...current, cells: newCells }
    })

    const result = await executor.executeCell(index)
    
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        const defaultStrat = createDefaultStrategy()
        defaultStrat.cells[0] = result
        return defaultStrat
      }
      const newCells = [...current.cells]
      newCells[index] = result
      return { ...current, cells: newCells, updatedAt: Date.now() }
    })

    setExecutionContext(executor.getContext())
    if (result.status === 'success') {
      trackInitialValueRealization('cells')
    } else if (result.error) {
      setLastRunError(result.error)
    }
  }

  const handleRunAll = async () => {
    if (!strategy || !Array.isArray(strategy.cells)) return

    toast.info('Running all cells...')
    
    const executor = new StrategyExecutor(strategy.cells, strategy.parameters)
    
    setStrategy((current) => {
      const defaultStrategy = createDefaultStrategy()
      
      if (!current || !Array.isArray(current.cells)) return defaultStrategy
      return {
        ...current,
        cells: current.cells.map(cell => ({ ...cell, status: 'running' as const }))
      }
    })

    const { cells: results, runTrace: trace } = await executor.executeAll()
    
    setRunTrace(trace)

    const runId = `run-${Date.now()}`
    saveRunLog(runId, {
      strategyId: strategy.id,
      strategyName: strategy.name,
      runId,
      timestamp: Date.now(),
      trace
    })
    
    setStrategy((current) => {
      const defaultStrategy = createDefaultStrategy()
      defaultStrategy.cells = results
      
      if (!current) return defaultStrategy
      return {
        ...current,
        cells: results,
        updatedAt: Date.now()
      }
    })

    setExecutionContext(executor.getContext())
    const errors = results.filter(c => c.status === 'error')
    const successes = results.filter(c => c.status === 'success')
    setQuickSummary({
      type: 'cells',
      successCount: successes.length,
      errorCount: errors.length,
      traceCount: trace.length,
    })
    if (errors.length > 0) {
      setLastRunError(errors[0].error || 'Execution failed in one or more cells')
    } else {
      setLastRunError(null)
      trackInitialValueRealization('cells')
    }
    if (errors.length > 0) {
      toast.error(`Execution finished with ${errors.length} error(s)`)
    } else {
      toast.success('Execution complete')
    }
    // Auto-switch right panel to trace tab so users immediately see results
    setRightPanelTab('trace')
  }

  const handleParametersChange = (parameters: Parameter[]) => {
    setStrategy((current) => {
      if (!current) {
        const defaultStrat = createDefaultStrategy()
        defaultStrat.parameters = parameters
        return defaultStrat
      }
      return {
        ...current,
        parameters,
        updatedAt: Date.now()
      }
    })
  }

  const handleTransitionsChange = (fromCell: number, rules: TransitionRule[]) => {
    trackAdvancedFeatureUsage('transitions')
    setStrategy((current) => {
      if (!current) return createDefaultStrategy()
      const transitions = { ...(current.transitions ?? {}) }
      if (rules.length === 0) {
        delete transitions[fromCell]
      } else {
        transitions[fromCell] = rules
      }
      return { ...current, transitions, updatedAt: Date.now() }
    })
  }

  const handleGovernanceChange = (governance: GovernanceConfig) => {
    trackAdvancedFeatureUsage('governance')
    setStrategy((current) => {
      if (!current) return createDefaultStrategy()
      return { ...current, governance, updatedAt: Date.now() }
    })
  }

  const handleNameChange = (name: string) => {
    setStrategy((current) => {
      if (!current) {
        const defaultStrat = createDefaultStrategy()
        defaultStrat.name = name
        return defaultStrat
      }
      return {
        ...current,
        name,
        updatedAt: Date.now()
      }
    })
  }

  const handleSaveStrategy = () => {
    // Persist strategy to external private store (localStorage) in addition to Spark KV
    saveStrategyExternal(strategy)
    toast.success('Strategy saved to private storage')
  }

  const handleApplyPreset = (presetId: string) => {
    const preset = CELL_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setStrategy((current) => {
      const base = (!current || !Array.isArray(current.cells)) ? createDefaultStrategy() : current
      const startIndex = base.cells.length
      const newCells = preset.cells.map((presetCell, i) => ({
        ...createDefaultCell(startIndex + i, presetCell.code),
        label: presetCell.label,
        purpose: presetCell.purpose,
      }))
      const existingNames = new Set((base.parameters || []).map((p) => p.name))
      const presetParams: Parameter[] = preset.parameters
        .filter((p) => !existingNames.has(p.name))
        .map((p, i) => ({
          id: `preset-${preset.id}-${Date.now()}-${i}`,
          name: p.name,
          value: p.value,
          type: p.type,
          description: p.description,
        }))

      return {
        ...base,
        cells: [...base.cells, ...newCells],
        parameters: [...(base.parameters || []), ...presetParams],
        updatedAt: Date.now(),
      }
    })
    toast.success(`Added preset: ${preset.name}`)
    trackEvent('preset_applied', { presetId })
  }

  const handleExportRunTrace = () => {
    if (runTrace.length === 0) {
      toast.info('No run trace available. Run the strategy first.')
      return
    }
    downloadJSON({
      strategyName: safeStrategy.name,
      exportedAt: new Date().toISOString(),
      trace: runTrace
    }, `run-trace-${Date.now()}.json`)
    toast.success('Run trace exported')
  }

  useEffect(() => {
    if (!strategy || !Array.isArray(strategy.cells)) {
      setStrategy(createDefaultStrategy())
    }
  }, [strategy, setStrategy])

  const safeStrategy = (!strategy || !Array.isArray(strategy.cells)) 
    ? createDefaultStrategy() 
    : {
        ...strategy,
        transitions: strategy.transitions ?? {},
        governance: strategy.governance ?? createDefaultGovernance(),
      }

  useEffect(() => {
    trackRetentionVisit()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(UI_STORAGE_KEYS.path, workspacePath)
  }, [workspacePath])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(UI_STORAGE_KEYS.showAdvanced, String(showAdvanced))
    trackEvent('advanced_visibility_changed', { showAdvanced })
  }, [showAdvanced])

  useEffect(() => {
    if (showAdvanced) return
    if (rightPanelTab === 'governance') {
      setRightPanelTab('inspector')
    }
  }, [showAdvanced, rightPanelTab])

  useEffect(() => {
    trackStrategyComplexity(
      safeStrategy.cells.length,
      Object.values(safeStrategy.transitions).reduce((sum, rules) => sum + rules.length, 0),
    )
  }, [safeStrategy.cells.length, safeStrategy.transitions])

  useEffect(() => {
    if (activeInsertionTarget.cellIndex < safeStrategy.cells.length) return

    setActiveInsertionTarget((current) => ({
      ...current,
      cellIndex: Math.max(0, safeStrategy.cells.length - 1)
    }))
  }, [safeStrategy.cells.length])

  const handleFieldSelect = (field: AMXDataField) => {
    const fieldReference = `${field.function}(cusip)`
    const targetCell = safeStrategy.cells[activeInsertionTarget.cellIndex]

    if (!targetCell) {
      toast.info('Select a cell to choose where fields should be inserted.')
      return
    }

    const nextCells = [...safeStrategy.cells]

    if (activeInsertionTarget.mode === 'visual') {
      const existingFields = targetCell.visualConfig?.dataFields || []
      const alreadySelected = existingFields.includes(field.function)
      nextCells[activeInsertionTarget.cellIndex] = {
        ...targetCell,
        visualConfig: {
          ...targetCell.visualConfig,
          dataFields: alreadySelected ? existingFields : [...existingFields, field.function]
        }
      }

      toast.success(
        alreadySelected
          ? `${field.name} is already selected in cell ${targetCell.index}`
          : `${field.name} added to cell ${targetCell.index}`
      )
    } else {
      nextCells[activeInsertionTarget.cellIndex] = {
        ...targetCell,
        code: `${targetCell.code}${getFieldInsertSeparator(targetCell.code, activeInsertionTarget.mode)}${fieldReference}`
      }

      toast.success(`${field.name} inserted into cell ${targetCell.index}`)
    }

    setStrategy({
      ...safeStrategy,
      cells: nextCells,
      updatedAt: Date.now()
    })
  }

  const handleActivateCell = (cellIndex: number, mode: 'visual' | 'formula' | 'code') => {
    const targetCell = safeStrategy.cells[cellIndex]
    if (!targetCell) return

    setActiveInsertionTarget({
      cellIndex,
      mode
    })
    if (mode === 'code') {
      trackAdvancedFeatureUsage('code_mode')
    }
  }

  const activeInsertionCell = safeStrategy.cells[activeInsertionTarget.cellIndex]
  const activeCatalogSelection = activeInsertionTarget.mode === 'visual'
    ? activeInsertionCell?.visualConfig?.dataFields || []
    : []

  const activeInsertionSummary = activeInsertionCell
    ? `Cell ${activeInsertionCell.index} · ${activeInsertionTarget.mode === 'visual' ? 'Visual fields' : activeInsertionTarget.mode === 'formula' ? 'Formula editor' : 'Code editor'}`
    : 'Choose a cell to insert fields'

  const renderInsertionTargetHint = () => (
    <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3">
      <div className="text-sm font-medium text-foreground">Insert target</div>
      <div className="mt-1.5 text-base">{activeInsertionSummary}</div>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Click a field to insert it, or drag it directly into a formula or code editor.
      </div>
    </div>
  )

  const handleYieldFormulaGenerate = (formula: string) => {
    const newIndex = safeStrategy.cells.length
    const newCell: CodeCell = createDefaultCell(newIndex, formula)
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      return {
        ...current,
        cells: [...current.cells, newCell],
        updatedAt: Date.now()
      }
    })
    toast.success('Yield formula cell added')
  }

  const handleTimeSeriesGenerate = (config: TimeSeriesConfig) => {
    const formula = `${config.calculation}(${config.field}, ${config.window})`
    const newIndex = safeStrategy.cells.length
    const newCell: CodeCell = createDefaultCell(newIndex, formula)
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }
      return {
        ...current,
        cells: [...current.cells, newCell],
        updatedAt: Date.now()
      }
    })
    toast.success('Time-series code cell added')
  }

  const handleAddComment = (cellId: string, text: string, parentId?: string) => {
    const newComment: CellComment = {
      id: `comment-${Date.now()}`,
      cellId,
      author: 'Current User',
      text,
      timestamp: Date.now(),
      parentId
    }
    setCellComments((current) => [...(current || []), newComment])
  }

  const handleDeleteComment = (commentId: string) => {
    setCellComments((current) => (current || []).filter(c => c.id !== commentId))
  }

  const handleResolveComment = (commentId: string) => {
    setCellComments((current) =>
      (current || []).map(c => c.id === commentId ? { ...c, resolved: true } : c)
    )
  }

  const handleLoadTemplate = (template: StrategyTemplate) => {
    const loadedStrategy: Strategy = {
      id: `strategy-${Date.now()}`,
      name: template.name,
      description: template.description,
      cells: template.strategy.cells,
      parameters: template.strategy.parameters,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setStrategy(loadedStrategy)
    setLastRunError(null)
    trackEvent('template_loaded', { templateId: template.id, templateName: template.name })
    toast.success(`Loaded template: ${template.name}`)
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destIndex = result.destination.index

    if (sourceIndex === destIndex) return

    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return createDefaultStrategy()
      }

      const newCells = Array.from(current.cells)
      const [removed] = newCells.splice(sourceIndex, 1)
      newCells.splice(destIndex, 0, removed)

      const reindexedCells = newCells.map((cell, i) => ({
        ...cell,
        id: `cell-${i}`,
        index: i
      }))

      return {
        ...current,
        cells: reindexedCells,
        updatedAt: Date.now()
      }
    })

    toast.info(`Cell moved from position ${sourceIndex} to ${destIndex}`)
  }

  const handleBacktestRun = async (
    config: BacktestConfig,
    strategyCode: string,
    dataFiles: Record<string, any>
  ): Promise<BacktestResult> => {
    const engine = new BacktestEngine(config)

    Object.entries(dataFiles).forEach(([symbol, data]) => {
      const df = readJSON(data)
      const dateCol = df.columns.includes('SessionDate') ? 'SessionDate' : 'Date'
      const dates = toDatetime(df.getColumn(dateCol))
      const closes = toNumeric(df.getColumn('Close'))
      const volumes = toNumeric(df.getColumn('Volume'))

      const timeSeriesData = dates.map((date, i) => ({
        date,
        close: closes[i],
        volume: volumes[i]
      }))

      engine.loadTimeSeries(symbol, timeSeriesData)
    })

    const strategyFn = new Function('df', 'state', 'DataFrame', 'readJSON', 'toDatetime', 'toNumeric', strategyCode)

    const result = await engine.runBacktest((df, state) => {
      return strategyFn(df, state, DataFrame, readJSON, toDatetime, toNumeric)
    })

    trackInitialValueRealization('backtest')
    return result
  }

  const selectWorkspacePath = (path: WorkspacePath) => {
    setWorkspacePath(path)
    if (path === 'advanced') {
      setShowAdvanced(true)
      setActiveTab('cells')
    } else {
      setActiveTab('backtest')
    }
    if (showOnboarding && typeof window !== 'undefined') {
      window.localStorage.setItem(UI_STORAGE_KEYS.onboardingDone, 'true')
      setShowOnboarding(false)
    }
    trackEvent('workspace_path_selected', { path })
  }

  const handleQuickTemplateRun = async () => {
    const starter = strategyTemplates[0]
    if (!starter) return
    handleLoadTemplate(starter)
    setActiveTab('cells')
    await handleRunAll()
  }

  const commandItems = useMemo(() => {
    const actions: Array<{ id: string; label: string; keywords: string; run: () => void }> = [
      { id: 'run-all', label: 'Run all cells', keywords: 'run execute cells trace', run: () => { void handleRunAll(); setCommandOpen(false) } },
      { id: 'open-cells', label: 'Open code cells workspace', keywords: 'cells notebook', run: () => { setActiveTab('cells'); setCommandOpen(false) } },
      { id: 'open-backtest', label: 'Open backtest workspace', keywords: 'backtest results', run: () => { setActiveTab('backtest'); setCommandOpen(false) } },
      { id: 'focus-data', label: 'Open AMX data catalog', keywords: 'fields data amx', run: () => { setLeftPanelTab('data'); setCommandOpen(false) } },
      { id: 'find-price', label: 'Find field: PRICE(cusip)', keywords: 'field price amx market', run: () => { setLeftPanelTab('data'); toast.info('Search "price" in AMX Data catalog'); setCommandOpen(false) } },
      { id: 'find-yield', label: 'Find field: YIELD(cusip)', keywords: 'field yield amx fixed income', run: () => { setLeftPanelTab('data'); toast.info('Search "yield" in AMX Data catalog'); setCommandOpen(false) } },
      { id: 'focus-tools', label: 'Open tools panel', keywords: 'tools calculator', run: () => { setLeftPanelTab('tools'); setCommandOpen(false) } },
      { id: 'show-advanced', label: showAdvanced ? 'Switch to essential view' : 'Show advanced features', keywords: 'advanced governance transitions constraints', run: () => { setShowAdvanced((current) => !current); setCommandOpen(false) } },
      ...strategyTemplates.slice(0, 8).map((template) => ({
        id: `template-${template.id}`,
        label: `Load template: ${template.name}`,
        keywords: `template ${template.category} ${template.description}`,
        run: () => { handleLoadTemplate(template); setCommandOpen(false) },
      })),
    ]
    return actions
  }, [showAdvanced])

  const [commandQuery, setCommandQuery] = useState('')
  const filteredCommands = commandItems.filter((item) =>
    `${item.label} ${item.keywords}`.toLowerCase().includes(commandQuery.toLowerCase().trim()),
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const transitionRuleCount = Object.values(safeStrategy.transitions).reduce((sum, rules) => sum + rules.length, 0)
  const hasRunTrace = runTrace.length > 0
  const isDefaultStrategy = safeStrategy.name === 'New Strategy' && safeStrategy.cells.length <= 1
  const nextAction = useMemo(() => {
    if (lastRunError) {
      return {
        title: 'Run failed — jump directly to fix',
        description: 'Use trace and code cells to resolve errors quickly, then rerun.',
        actions: [
          { label: 'Open Trace', onClick: () => { setRightPanelTab('trace'); setActiveTab('cells') } },
          { label: 'Open Cells', onClick: () => setActiveTab('cells') },
        ],
      }
    }
    if (isDefaultStrategy) {
      return {
        title: 'Get first value in one click',
        description: 'Load a starter template and run it immediately.',
        actions: [
          { label: 'Quick Start Template + Run', onClick: () => { void handleQuickTemplateRun() } },
          { label: 'Open Backtest Quick Run', onClick: () => { setActiveTab('backtest'); setBacktestQuickRunRequest((n) => n + 1) } },
        ],
      }
    }
    if (!hasRunTrace) {
      return {
        title: 'You have a strategy loaded',
        description: 'Run now to generate trace, outputs, and explainability data.',
        actions: [
          { label: 'Run All Cells', onClick: () => { void handleRunAll() } },
          { label: 'Open Backtest', onClick: () => setActiveTab('backtest') },
        ],
      }
    }
    return {
      title: 'Great — first value realized',
      description: 'Now refine complexity with presets, transitions, and governance.',
      actions: [
        { label: 'Add Purpose Preset', onClick: () => handleApplyPreset(CELL_PRESETS[0].id) },
        { label: showAdvanced ? 'Hide Advanced' : 'Show Advanced', onClick: () => setShowAdvanced((current) => !current) },
      ],
    }
  }, [lastRunError, isDefaultStrategy, hasRunTrace, showAdvanced])

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster />
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MagnifyingGlass size={18} />
              Command Center
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              placeholder="Search actions, templates, tools, fields..."
              autoFocus
            />
            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-2">
                {filteredCommands.map((item) => (
                  <Button key={item.id} variant="outline" className="w-full justify-start text-left h-auto py-2.5" onClick={item.run}>
                    {item.label}
                  </Button>
                ))}
                {filteredCommands.length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">No matches.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="hidden lg:flex lg:flex-col w-80 border-r border-border bg-card/30 flex-shrink-0">
        <div className="h-16 border-b border-border flex items-center px-4 flex-shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Database size={20} className="text-accent" />
            Data & Tools
          </h2>
        </div>
        <Tabs value={leftPanelTab} onValueChange={(v) => setLeftPanelTab(v as 'data' | 'tools')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-[calc(100%-2rem)] mx-4 mt-4 grid grid-cols-2 flex-shrink-0 h-10">
            <TabsTrigger value="data" className="text-sm">
              <Database size={16} className="mr-2" />
              AMX Data
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-sm">
              <Calculator size={16} className="mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-2">
            <TabsContent value="data" className="px-4 pb-4 mt-0">
              <div className="space-y-4">
                {renderInsertionTargetHint()}
                <AMXDataCatalog
                  onFieldSelect={handleFieldSelect}
                  selectedFields={activeCatalogSelection}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="tools" className="px-4 pb-4 mt-0 space-y-4">
              {!showAdvanced && (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Essential tools shown. Use <span className="font-medium text-foreground">Show advanced</span> to reveal constraints, optimization, and trade controls.
                </div>
              )}
              <Accordion type="multiple" defaultValue={['yield', 'timeseries']} className="space-y-3">
                <AccordionItem value="yield" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <span className="text-base font-medium">Yield Calculator</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <YieldCalculator onGenerateFormula={handleYieldFormulaGenerate} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="timeseries" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <span className="text-base font-medium">Time-Series Analysis</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TimeSeriesTools onGenerateCode={handleTimeSeriesGenerate} />
                  </AccordionContent>
                </AccordionItem>

                {showAdvanced && (
                  <>
                    <AccordionItem value="constraints" className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <span className="text-base font-medium">Portfolio Constraints</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ConstraintBuilder
                          constraints={constraints || []}
                          onConstraintsChange={(next) => {
                            setConstraints(next)
                            trackAdvancedFeatureUsage('constraints')
                          }}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="optimization" className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <span className="text-base font-medium">Optimization</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <OptimizationCell
                          config={optimizationConfig || { objective: 'maximize_yield', constraints: [], enabled: true }}
                          onConfigChange={(next) => {
                            setOptimizationConfig(next)
                            trackAdvancedFeatureUsage('optimization')
                          }}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="trades" className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <span className="text-base font-medium">Trade List</span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <TradeList
                          trades={mockTrades}
                          onExport={() => toast.success('Trade list exported')}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </>
                )}
              </Accordion>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      <div className="flex-1 flex flex-col">
        <div 
          className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20"
          style={{
            background: 'repeating-linear-gradient(45deg, oklch(0.97 0.005 250), oklch(0.97 0.005 250) 10px, oklch(0.96 0.005 250) 10px, oklch(0.96 0.005 250) 20px)'
          }}
        >
          <div className="h-full flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden">
                    <SidebarSimple size={20} />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <SheetHeader className="h-16 border-b px-4 flex flex-row items-center">
                    <SheetTitle>Data & Tools</SheetTitle>
                  </SheetHeader>
                  <Tabs value={leftPanelTab} onValueChange={(v) => setLeftPanelTab(v as 'data' | 'tools')} className="flex-1">
                    <TabsList className="w-full grid grid-cols-2 m-4 h-10">
                      <TabsTrigger value="data" className="text-sm">AMX Data</TabsTrigger>
                      <TabsTrigger value="tools" className="text-sm">Tools</TabsTrigger>
                    </TabsList>
                    
                    <ScrollArea className="h-[calc(100vh-160px)]">
                      <TabsContent value="data" className="px-4 pb-4 mt-0">
                        <div className="space-y-4">
                          {renderInsertionTargetHint()}
                          <AMXDataCatalog
                            onFieldSelect={handleFieldSelect}
                            selectedFields={activeCatalogSelection}
                          />
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="tools" className="px-4 pb-4 mt-0 space-y-4">
                        <YieldCalculator onGenerateFormula={handleYieldFormulaGenerate} />
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2">
                <Code size={28} weight="duotone" className="text-accent" />
                <h1 className="text-2xl font-semibold tracking-tight">Strategy Executor</h1>
              </div>
              <Input
                value={safeStrategy.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-64 h-10 text-base bg-background hidden md:block"
                placeholder="Strategy name"
                id="strategy-name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={workspacePath === 'quick' ? 'default' : 'outline'}
                onClick={() => selectWorkspacePath('quick')}
                className="hidden xl:inline-flex"
              >
                <Rocket size={16} className="mr-1.5" />
                Quick Start
              </Button>
              <Button
                size="sm"
                variant={workspacePath === 'advanced' ? 'default' : 'outline'}
                onClick={() => selectWorkspacePath('advanced')}
                className="hidden xl:inline-flex"
              >
                <ArrowsOutSimple size={16} className="mr-1.5" />
                Advanced
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCommandOpen(true)} title="Command center (Cmd/Ctrl+K)">
                <MagnifyingGlass size={16} className="mr-1.5" />
                <span className="hidden xl:inline">Search</span>
              </Button>
              <TemplateGallery onLoadTemplate={handleLoadTemplate} />
              <Button onClick={handleRunAll} size="default" variant="default">
                <PlayCircle size={18} className="mr-2" weight="fill" />
                <span className="hidden sm:inline text-sm">Run All</span>
              </Button>
              <Button
                onClick={handleExportRunTrace}
                size="default"
                variant="outline"
                title="Export run trace"
                className={cn(runTrace.length > 0 && 'border-accent text-accent')}
              >
                <DownloadSimple size={18} className="mr-1.5" />
                <span className="hidden sm:inline text-sm">Trace</span>
                {runTrace.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {runTrace.length}
                  </Badge>
                )}
              </Button>
              <Button onClick={handleSaveStrategy} size="default" variant="secondary">
                <FloppyDisk size={18} className="mr-2" />
                <span className="hidden sm:inline text-sm">Save</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto p-6 h-full">
              {showOnboarding && (
                <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <Sparkle size={16} className="text-accent" />
                        Choose your starting path
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Quick Start gets you first results fast; Advanced Workspace exposes full controls immediately.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => selectWorkspacePath('quick')}>
                        <Rocket size={15} className="mr-1.5" />
                        Quick Start
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => selectWorkspacePath('advanced')}>
                        <ArrowsOutSimple size={15} className="mr-1.5" />
                        Advanced Workspace
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-xl border bg-card/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{nextAction.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{nextAction.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary">Cells: {safeStrategy.cells.length}</Badge>
                      <Badge variant="secondary">Transitions: {transitionRuleCount}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextAction.actions.map((action) => (
                      <Button key={action.label} size="sm" variant="outline" onClick={action.onClick}>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {quickSummary && (
                <div className="mb-4 rounded-xl border border-success/30 bg-success/5 p-4">
                  <div className="text-sm font-semibold">What happened</div>
                  {quickSummary.type === 'cells' ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      {quickSummary.successCount} cells succeeded, {quickSummary.errorCount} failed, {quickSummary.traceCount} trace steps captured.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Backtest complete with final value ${quickSummary.finalValue.toFixed(2)}, CAGR {quickSummary.cagr.toFixed(2)}%, trades {quickSummary.trades}.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setRightPanelTab('trace'); setActiveTab('cells') }}>
                      Open Trace
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('cells')}>
                      Edit Cells
                    </Button>
                  </div>
                </div>
              )}

              {lastRunError && (
                <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="text-sm font-semibold text-destructive">Recovery guidance</div>
                  <p className="text-sm text-muted-foreground mt-1">{lastRunError}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setActiveTab('cells'); setRightPanelTab('trace') }}>
                      Open trace diagnostics
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('cells')}>
                      Go to code cells
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
                <div className="lg:col-span-3 flex flex-col min-h-0">
                  {/* Main view controls: tabs for backtest, view-mode toggle for cells/flow */}
                  <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                      <TabsList className="h-10">
                        <TabsTrigger value="cells" className="gap-2 text-sm" onClick={() => viewMode === 'map' && setViewMode('notebook')}>
                          <Code size={16} />
                          Code Cells
                        </TabsTrigger>
                        <TabsTrigger value="backtest" className="gap-2 text-sm">
                          <ChartLine size={16} />
                          Backtest
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {activeTab === 'cells' && (
                      <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                        <Button
                          size="sm"
                          variant={viewMode === 'notebook' ? 'secondary' : 'ghost'}
                          className="h-8 px-2.5 text-xs gap-1.5"
                          onClick={() => setViewMode('notebook')}
                          title="Notebook view"
                        >
                          <Code size={14} />
                          <span className="hidden sm:inline">Notebook</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                          className="h-8 px-2.5 text-xs gap-1.5"
                          onClick={() => setViewMode('split')}
                          title="Split view: notebook + map"
                        >
                          <Columns size={14} />
                          <span className="hidden sm:inline">Split</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                          className="h-8 px-2.5 text-xs gap-1.5"
                          onClick={() => setViewMode('map')}
                          title="Map view"
                        >
                          <FlowArrow size={14} />
                          <span className="hidden sm:inline">Map</span>
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={showAdvanced ? 'secondary' : 'outline'}
                        onClick={() => setShowAdvanced((current) => !current)}
                      >
                        {showAdvanced ? 'Advanced On' : 'Show Advanced'}
                      </Button>
                      {activeTab === 'cells' && (
                        <>
                          {CELL_PRESETS.map((preset) => (
                            <Button key={preset.id} size="sm" variant="outline" onClick={() => handleApplyPreset(preset.id)} className="hidden 2xl:inline-flex">
                              {preset.name}
                            </Button>
                          ))}
                        </>
                      )}
                      <Button onClick={handleAddCell} size="default" variant="outline">
                        <Plus size={18} className="mr-2" />
                        <span className="text-sm">Add Cell</span>
                      </Button>
                    </div>
                  </div>

                  {/* Cells / Backtest content */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'backtest' ? (
                      <ScrollArea className="h-full">
                        <BacktestBuilder
                          onRun={handleBacktestRun}
                          quickStartRequest={backtestQuickRunRequest}
                          compactDefault={workspacePath === 'quick'}
                          onSummary={(summary) => {
                            setQuickSummary({
                              type: 'backtest',
                              finalValue: summary.finalValue,
                              cagr: summary.cagr,
                              trades: summary.trades,
                            })
                            setLastRunError(summary.error ?? null)
                          }}
                        />
                      </ScrollArea>
                    ) : (
                      /* Cells view with optional split pane */
                      <div className={cn("h-full", viewMode === 'split' ? "flex gap-4" : "")}>
                        {/* Notebook pane */}
                        {(viewMode === 'notebook' || viewMode === 'split') && (
                          <div className={cn("flex flex-col min-h-0", viewMode === 'split' ? "flex-1 min-w-0" : "h-full")}>
                            <DragDropContext onDragEnd={handleDragEnd}>
                              <ScrollArea className="h-full pr-2">
                                {!showAdvanced && (
                                  <div className="mb-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                                    Transition rules are hidden in essential view.
                                    <Button size="sm" variant="link" className="px-1 h-auto" onClick={() => setShowAdvanced(true)}>
                                      Show advanced
                                    </Button>
                                  </div>
                                )}
                                <Droppable droppableId="cells-list">
                                  {(provided) => (
                                    <div
                                      {...provided.droppableProps}
                                      ref={provided.innerRef}
                                      className="space-y-4"
                                    >
                                      {safeStrategy.cells.map((cell, index) => (
                                        <Draggable key={cell.id} draggableId={cell.id} index={index}>
                                          {(provided, snapshot) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className="space-y-2"
                                            >
                                              <div
                                                className={cn(
                                                  "transition-shadow",
                                                  snapshot.isDragging && "shadow-lg"
                                                )}
                                              >
                                                <CodeCellComponent
                                                  cell={cell}
                                                  onCodeChange={(code) => handleCellCodeChange(cell.index, code)}
                                                  onCellChange={(updates) => handleCellChange(cell.index, updates)}
                                                  onRun={() => handleRunCell(cell.index)}
                                                  onDelete={() => handleDeleteCell(cell.index)}
                                                  onDuplicate={() => handleDuplicateCell(cell.index)}
                                                  comments={cellComments}
                                                  onAddComment={handleAddComment}
                                                  onDeleteComment={handleDeleteComment}
                                                  onResolveComment={handleResolveComment}
                                                  currentUser={currentUser}
                                                  dragHandleProps={provided.dragHandleProps}
                                                  onActivate={(mode) => handleActivateCell(cell.index, mode)}
                                                  isActive={activeInsertionTarget.cellIndex === cell.index}
                                                />
                                              </div>

                                              {showAdvanced && index < safeStrategy.cells.length - 1 && (
                                                <TransitionEditor
                                                  fromCell={cell.index}
                                                  toCell={cell.index + 1}
                                                  rules={safeStrategy.transitions[cell.index] ?? []}
                                                  onRulesChange={(rules) => handleTransitionsChange(cell.index, rules)}
                                                  cellCount={safeStrategy.cells.length}
                                                />
                                              )}
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </ScrollArea>
                            </DragDropContext>
                          </div>
                        )}

                        {/* Map pane */}
                        {(viewMode === 'map' || viewMode === 'split') && (
                          <div className={cn("flex flex-col min-h-0", viewMode === 'split' ? "flex-1 min-w-0 border-l border-border pl-4" : "h-full")}>
                            {viewMode === 'split' && (
                              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5 flex-shrink-0">
                                <FlowArrow size={13} />
                                Execution map — click a node to scroll to its cell
                              </p>
                            )}
                            <div className="flex-1 min-h-0">
                              <FlowDiagram
                                cells={safeStrategy.cells}
                                onCellClick={(index) => {
                                  setHighlightedCell(index)
                                  if (viewMode !== 'map') {
                                    setTimeout(() => {
                                      const element = document.getElementById(`cell-${index}`)
                                      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                    }, 100)
                                  }
                                }}
                                highlightedCell={highlightedCell}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right panel with tabbed sections */}
                <div className="lg:col-span-1 flex flex-col gap-0 min-h-0">
                  <Tabs
                    value={rightPanelTab}
                    onValueChange={(v) => {
                      const next = v as typeof rightPanelTab
                      setRightPanelTab(next)
                      if (next === 'governance') {
                        trackAdvancedFeatureUsage('governance_tab')
                      }
                    }}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    <TabsList className={cn('w-full grid h-9 mb-3 flex-shrink-0', showAdvanced ? 'grid-cols-3' : 'grid-cols-2')}>
                      <TabsTrigger value="inspector" className="text-xs gap-1">
                        Inspector
                      </TabsTrigger>
                      <TabsTrigger value="trace" className="text-xs gap-1 relative">
                        Trace
                        {runTrace.length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                            {runTrace.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      {showAdvanced && (
                        <TabsTrigger value="governance" className="text-xs gap-1">
                          <Shield size={12} />
                          Gov
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="inspector" className="mt-0 flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="space-y-4 pr-2">
                          <ContextInspector context={executionContext} />
                          <ParameterPanel
                            parameters={Array.isArray(safeStrategy.parameters) ? safeStrategy.parameters : []}
                            onParametersChange={handleParametersChange}
                          />
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="trace" className="mt-0 flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="pr-2 space-y-3">
                          {runTrace.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                              No trace yet — run the strategy to see execution steps here.
                            </div>
                          ) : (
                            <RunTraceViewer
                              trace={{
                                strategyId: safeStrategy.id,
                                strategyName: safeStrategy.name,
                                timestamp: Date.now(),
                                steps: runTrace.map((t, i) => ({
                                  cellIndex: t.cellIndex,
                                  cellLabel: t.cellLabel,
                                  code: '',
                                  result: t.result,
                                  executionTime: 0,
                                  timestamp: t.timestamp,
                                  reason: t.reasonCode,
                                })),
                                totalExecutionTime: runTrace.length > 1
                                  ? runTrace[runTrace.length - 1].timestamp - runTrace[0].timestamp
                                  : 0,
                                success: true,
                                finalVariables: executionContext.variables,
                                branchPath: runTrace.map(t => t.cellIndex),
                                loopIterations: {},
                              }}
                              onStepClick={(stepIndex) => {
                                const step = runTrace[stepIndex]
                                if (step) {
                                  setHighlightedCell(step.cellIndex)
                                  setActiveTab('cells')
                                  setViewMode('notebook')
                                  setTimeout(() => {
                                    const element = document.getElementById(`cell-${step.cellIndex}`)
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }, 100)
                                }
                              }}
                            />
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    {showAdvanced && (
                      <TabsContent value="governance" className="mt-0 flex-1 min-h-0 overflow-hidden">
                        <ScrollArea className="h-full">
                          <div className="pr-2">
                            <GovernancePanel
                              governance={safeStrategy.governance ?? createDefaultGovernance()}
                              onGovernanceChange={handleGovernanceChange}
                              currentUser={currentUser?.login}
                            />
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-6 pb-6">
            <div className="p-5 bg-muted/50 rounded-lg border border-border">
              <h3 className="text-base font-medium mb-4">Control Flow & Syntax</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">if cond: next</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Skip to next cell if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">if cond: goto 5</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Jump to cell 5 if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">goto 3</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Jump to cell 3</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">next</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Skip to next cell</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">__result__ = value</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Set cell output</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">PRICE(cusip)</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Get security price</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
