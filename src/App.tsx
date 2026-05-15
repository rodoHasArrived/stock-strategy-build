import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { CodeCell, Parameter, RunTraceEntry, Strategy, ExecutionContext, PortfolioConstraint, OptimizationConfig, Trade, TimeSeriesConfig, CellComment, StrategyTemplate, BacktestConfig, BacktestResult, TransitionRule, GovernanceConfig, BacktestRunRecord, StrategyVersionRecord } from '@/lib/types'
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
import { FloppyDisk, Code, Plus, PlayCircle, FlowArrow, Database, Calculator, SidebarSimple, ChartLine, DownloadSimple, Columns, Shield } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { BacktestEngine } from '@/lib/backtestEngine'
import { DataFrame, readJSON, toDatetime, toNumeric } from '@/lib/dataFrame'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { cn } from '@/lib/utils'
import { saveStrategyExternal, saveRunLog, downloadJSON, listStrategyVersionRecords, saveStrategyVersionRecord } from '@/lib/persistence'

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

function App() {
  const [strategy, setStrategy] = useKV<Strategy>('current-strategy', createDefaultStrategy())
  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl: string } | undefined>(undefined)
  const [runTrace, setRunTrace] = useState<RunTraceEntry[]>([])
  const [currentBacktestRun, setCurrentBacktestRun] = useState<BacktestRunRecord | null>(null)
  const [isBacktestProofStale, setIsBacktestProofStale] = useState(false)
  const [versionHistory, setVersionHistory] = useState<StrategyVersionRecord[]>(() => listStrategyVersionRecords())
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string | undefined>(undefined)

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
  const [cellComments, setCellComments] = useKV<CellComment[]>('cell-comments', [])

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
    const nextVersion = (safeStrategy.governance?.version ?? 0) + 1
    const auditEntry = {
      id: `audit-${Date.now()}`,
      timestamp: Date.now(),
      actor: currentUser?.login ?? 'local-user',
      action: `Saved local version ${nextVersion}`,
      details: currentBacktestRun
        ? `Linked proof ${currentBacktestRun.id}${isBacktestProofStale ? ' (stale)' : ''}`
        : 'No linked backtest proof'
    }
    const versionedStrategy: Strategy = {
      ...safeStrategy,
      governance: {
        ...(safeStrategy.governance ?? createDefaultGovernance()),
        version: nextVersion,
        auditLog: [auditEntry, ...((safeStrategy.governance ?? createDefaultGovernance()).auditLog ?? [])],
      },
      updatedAt: Date.now(),
    }
    const versionRecord: StrategyVersionRecord = {
      id: `version-${Date.now()}`,
      strategyId: versionedStrategy.id,
      strategyName: versionedStrategy.name,
      version: nextVersion,
      label: `${versionedStrategy.name} v${nextVersion}`,
      author: currentUser?.login ?? 'local-user',
      timestamp: Date.now(),
      strategy: versionedStrategy,
      linkedRunIds: currentBacktestRun && !isBacktestProofStale ? [currentBacktestRun.id] : [],
      audit: versionedStrategy.governance?.auditLog ?? [],
    }
    saveStrategyExternal(versionedStrategy)
    saveStrategyVersionRecord(versionRecord)
    setVersionHistory(listStrategyVersionRecords())
    setStrategy(versionedStrategy)
    toast.success(`Saved local version ${nextVersion}`)
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
  }

  const activeInsertionCell = safeStrategy.cells[activeInsertionTarget.cellIndex]
  const activeCatalogSelection = activeInsertionTarget.mode === 'visual'
    ? activeInsertionCell?.visualConfig?.dataFields || []
    : []

  const activeInsertionSummary = activeInsertionCell
    ? `Cell ${activeInsertionCell.index} · ${activeInsertionTarget.mode === 'visual' ? 'Visual fields' : activeInsertionTarget.mode === 'formula' ? 'Formula editor' : 'Code editor'}`
    : 'Choose a cell to insert fields'

  const latestVersion = versionHistory.find(record => record.strategyId === safeStrategy.id)
  const derivedTrades: Trade[] = currentBacktestRun?.result.trades.map((trade, index) => ({
    id: `backtest-trade-${index}`,
    security: trade.symbol,
    cusip: trade.symbol,
    action: trade.action,
    quantity: trade.shares,
    price: trade.executionPrice,
    reason: 'REBALANCE',
    reasonDetails: trade.reason,
  })) ?? []

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
      transitions: template.strategy.transitions || {},
      governance: template.strategy.governance || createDefaultGovernance(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setStrategy(loadedStrategy)
    setSelectedTemplateCategory(template.category)
    setCurrentBacktestRun(null)
    setIsBacktestProofStale(false)
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

    return result
  }

  const handleBacktestRunRecordChange = (record: BacktestRunRecord | null, isStale: boolean) => {
    setCurrentBacktestRun(record)
    setIsBacktestProofStale(isStale)
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster />
      
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

                <AccordionItem value="constraints" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <span className="text-base font-medium">Portfolio Constraints</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ConstraintBuilder 
                      constraints={constraints || []} 
                      onConstraintsChange={setConstraints} 
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
                      onConfigChange={setOptimizationConfig} 
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trades" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <span className="text-base font-medium">Trade List</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TradeList 
                      trades={derivedTrades}
                      onExport={() => toast.success('Trade list exported')}
                    />
                  </AccordionContent>
                </AccordionItem>
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

                    <Button onClick={handleAddCell} size="default" variant="outline">
                      <Plus size={18} className="mr-2" />
                      <span className="text-sm">Add Cell</span>
                    </Button>
                  </div>

                  {/* Cells / Backtest content */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
                    <div className="hidden">
                      <TabsList>
                        <TabsTrigger value="cells">Cells</TabsTrigger>
                        <TabsTrigger value="backtest">Backtest</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="backtest" className="flex-1 min-h-0 mt-0">
                      <ScrollArea className="h-full">
                        <BacktestBuilder
                          onRun={handleBacktestRun}
                          strategyId={safeStrategy.id}
                          strategyName={safeStrategy.name}
                          templateCategory={selectedTemplateCategory}
                          onRunRecordChange={handleBacktestRunRecordChange}
                        />
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="cells" className="flex-1 min-h-0 mt-0">
                      <div className={cn("h-full", viewMode === 'split' ? "flex gap-4" : "")}>
                        {/* Notebook pane */}
                        {(viewMode === 'notebook' || viewMode === 'split') && (
                          <div className={cn("flex flex-col min-h-0", viewMode === 'split' ? "flex-1 min-w-0" : "h-full")}>
                            <DragDropContext onDragEnd={handleDragEnd}>
                              <ScrollArea className="h-full pr-2">
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

                                              {index < safeStrategy.cells.length - 1 && (
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
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Right panel with tabbed sections */}
                <div className="lg:col-span-1 flex flex-col gap-0 min-h-0">
                  <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex flex-col flex-1 min-h-0">
                    <TabsList className="w-full grid grid-cols-3 h-9 mb-3 flex-shrink-0">
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
                      <TabsTrigger value="governance" className="text-xs gap-1">
                        <Shield size={12} />
                        Gov
                      </TabsTrigger>
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

                    <TabsContent value="governance" className="mt-0 flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="pr-2">
                          <GovernancePanel
                            governance={safeStrategy.governance ?? createDefaultGovernance()}
                            onGovernanceChange={handleGovernanceChange}
                            currentUser={currentUser?.login}
                            currentRunRecord={currentBacktestRun}
                            proofIsStale={isBacktestProofStale}
                            latestVersion={latestVersion}
                          />
                        </div>
                      </ScrollArea>
                    </TabsContent>
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
                  <span className="text-accent font-semibold text-base">if (cond) &#123; next() &#125;</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Skip to next cell if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">if (cond) &#123; goto(5) &#125;</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Jump to cell 5 if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">goto(3)</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Jump to cell 3</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">basket IG_Core:</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Declare a multi-CUSIP basket</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">result(value)</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Set cell output</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold text-base">IG_Core.weightedAvg('YIELD')</span>
                  <p className="text-muted-foreground mt-1.5 leading-relaxed">Analyze a multi-CUSIP basket</p>
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
