import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { CodeCell, Parameter, RunTraceEntry, Strategy, ExecutionContext, PortfolioConstraint, OptimizationConfig, Trade, TimeSeriesConfig, CellComment, StrategyTemplate, BacktestConfig, BacktestResult } from '@/lib/types'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { FloppyDisk, Code, Plus, PlayCircle, FlowArrow, Database, Calculator, SidebarSimple, ChartLine, DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { BacktestEngine } from '@/lib/backtestEngine'
import { DataFrame, readJSON, toDatetime, toNumeric } from '@/lib/dataFrame'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { cn } from '@/lib/utils'
import { saveStrategyExternal, loadStrategyExternal, saveRunLog, downloadJSON } from '@/lib/persistence'

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

const createDefaultStrategy = (): Strategy => ({
  id: 'default',
  name: 'New Strategy',
  description: '',
  cells: [createDefaultCell(0)],
  parameters: [],
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

  const [executionContext, setExecutionContext] = useState<ExecutionContext>({
    variables: {},
    currentCell: 0,
    maxIterations: 1000,
    iterationCount: 0
  })

  const [highlightedCell, setHighlightedCell] = useState<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<string>('backtest')
  const [leftPanelTab, setLeftPanelTab] = useState<'data' | 'tools'>('data')
  const [selectedCellForTransition, setSelectedCellForTransition] = useState<number | undefined>(undefined)
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
    : strategy

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

  const renderInsertionTargetHint = () => (
    <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3">
      <div className="text-xs font-medium text-foreground">Insert target</div>
      <div className="mt-1 text-sm">{activeInsertionSummary}</div>
      <div className="mt-1 text-xs text-muted-foreground">
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

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster />
      
      <div className="hidden lg:block w-80 border-r border-border bg-card/30 flex-shrink-0">
        <div className="h-16 border-b border-border flex items-center px-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Database size={20} className="text-accent" />
            Data & Tools
          </h2>
        </div>
        <Tabs value={leftPanelTab} onValueChange={(v) => setLeftPanelTab(v as 'data' | 'tools')} className="flex-1">
          <TabsList className="w-[calc(100%-2rem)] mx-4 grid grid-cols-2">
            <TabsTrigger value="data">
              <Database size={14} className="mr-2" />
              AMX Data
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Calculator size={14} className="mr-2" />
              Tools
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[calc(100vh-120px)]">
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
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-sm font-medium">Yield Calculator</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <YieldCalculator onGenerateFormula={handleYieldFormulaGenerate} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="timeseries" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-sm font-medium">Time-Series Analysis</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TimeSeriesTools onGenerateCode={handleTimeSeriesGenerate} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="constraints" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-sm font-medium">Portfolio Constraints</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ConstraintBuilder 
                      constraints={constraints || []} 
                      onConstraintsChange={setConstraints} 
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="optimization" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-sm font-medium">Optimization</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <OptimizationCell 
                      config={optimizationConfig || { objective: 'maximize_yield', constraints: [], enabled: true }} 
                      onConfigChange={setOptimizationConfig} 
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trades" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="text-sm font-medium">Trade List</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TradeList 
                      trades={mockTrades}
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
                    <TabsList className="w-full grid grid-cols-2 m-4">
                      <TabsTrigger value="data">AMX Data</TabsTrigger>
                      <TabsTrigger value="tools">Tools</TabsTrigger>
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
                <h1 className="text-xl font-semibold tracking-tight">Strategy Executor</h1>
              </div>
              <Input
                value={safeStrategy.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-64 h-9 bg-background hidden md:block"
                placeholder="Strategy name"
                id="strategy-name"
              />
            </div>
            <div className="flex items-center gap-2">
              <TemplateGallery onLoadTemplate={handleLoadTemplate} />
              <Button onClick={handleRunAll} size="sm" variant="default">
                <PlayCircle size={16} className="mr-2" weight="fill" />
                <span className="hidden sm:inline">Run All</span>
              </Button>
              <Button
                onClick={handleExportRunTrace}
                size="sm"
                variant="outline"
                title="Export run trace"
                className={cn(runTrace.length > 0 && 'border-accent text-accent')}
              >
                <DownloadSimple size={16} className="mr-1" />
                <span className="hidden sm:inline">Trace</span>
                {runTrace.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {runTrace.length}
                  </Badge>
                )}
              </Button>
              <Button onClick={handleSaveStrategy} size="sm" variant="secondary">
                <FloppyDisk size={16} className="mr-2" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="flex items-center justify-between mb-4">
                    <TabsList>
                      <TabsTrigger value="cells" className="gap-2">
                        <Code size={16} />
                        Code Cells
                      </TabsTrigger>
                      <TabsTrigger value="flow" className="gap-2">
                        <FlowArrow size={16} />
                        Execution Flow
                      </TabsTrigger>
                      <TabsTrigger value="backtest" className="gap-2">
                        <ChartLine size={16} />
                        Backtest
                      </TabsTrigger>
                    </TabsList>
                    <Button onClick={handleAddCell} size="sm" variant="outline">
                      <Plus size={16} className="mr-2" />
                      Add Cell
                    </Button>
                  </div>

                  <TabsContent value="cells" className="mt-0">
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <div className="h-[calc(100vh-240px)] overflow-y-auto pr-4">
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
                                          rules={[]}
                                          onRulesChange={(rules) => {
                                            console.log('Transition rules updated:', rules)
                                          }}
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
                      </div>
                    </DragDropContext>
                  </TabsContent>

                  <TabsContent value="flow" className="mt-0">
                    <FlowDiagram
                      cells={safeStrategy.cells}
                      onCellClick={(index) => {
                        setHighlightedCell(index)
                        setActiveTab('cells')
                        setTimeout(() => {
                          const element = document.getElementById(`cell-${index}`)
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }, 100)
                      }}
                      highlightedCell={highlightedCell}
                    />
                  </TabsContent>

                  <TabsContent value="backtest" className="mt-0">
                    <BacktestBuilder onRun={handleBacktestRun} />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="lg:col-span-1 space-y-4">
                <ContextInspector context={executionContext} />
                <ParameterPanel
                  parameters={Array.isArray(safeStrategy.parameters) ? safeStrategy.parameters : []}
                  onParametersChange={handleParametersChange}
                />
              </div>
            </div>

            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
              <h3 className="text-sm font-medium mb-3">Control Flow & Syntax</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="font-mono">
                  <span className="text-accent font-semibold">if cond: next</span>
                  <p className="text-muted-foreground mt-1">Skip to next cell if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold">if cond: goto 5</span>
                  <p className="text-muted-foreground mt-1">Jump to cell 5 if true</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold">goto 3</span>
                  <p className="text-muted-foreground mt-1">Jump to cell 3</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold">next</span>
                  <p className="text-muted-foreground mt-1">Skip to next cell</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold">__result__ = value</span>
                  <p className="text-muted-foreground mt-1">Set cell output</p>
                </div>
                <div className="font-mono">
                  <span className="text-accent font-semibold">PRICE(cusip)</span>
                  <p className="text-muted-foreground mt-1">Get security price</p>
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
