import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { CodeCell, Parameter, Strategy, ExecutionContext } from '@/lib/types'
import { CodeCellComponent } from '@/components/CodeCellComponent'
import { ParameterPanel } from '@/components/ParameterPanel'
import { ContextInspector } from '@/components/ContextInspector'
import { StrategyExecutor } from '@/lib/executor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FloppyDisk, Code, Plus, PlayCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

function App() {
  const [strategy, setStrategy] = useKV<Strategy>('current-strategy', {
    id: 'default',
    name: 'New Strategy',
    description: '',
    cells: [{
      id: 'cell-0',
      index: 0,
      code: '',
      output: '',
      status: 'idle'
    }],
    parameters: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  const [executionContext, setExecutionContext] = useState<ExecutionContext>({
    variables: {},
    currentCell: 0,
    maxIterations: 1000,
    iterationCount: 0
  })

  const handleCellCodeChange = (index: number, code: string) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code,
            output: '',
            status: 'idle'
          }],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
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

  const handleDeleteCell = (index: number) => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code: '',
            output: '',
            status: 'idle'
          }],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      const newCells = current.cells.filter((_, i) => i !== index)
      const reindexedCells = newCells.map((cell, i) => ({
        ...cell,
        id: `cell-${i}`,
        index: i
      }))
      return {
        ...current,
        cells: reindexedCells.length > 0 ? reindexedCells : [{
          id: 'cell-0',
          index: 0,
          code: '',
          output: '',
          status: 'idle'
        }],
        updatedAt: Date.now()
      }
    })
  }

  const handleAddCell = () => {
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code: '',
            output: '',
            status: 'idle'
          }, {
            id: 'cell-1',
            index: 1,
            code: '',
            output: '',
            status: 'idle'
          }],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      const newIndex = current.cells.length
      const newCell: CodeCell = {
        id: `cell-${newIndex}`,
        index: newIndex,
        code: '',
        output: '',
        status: 'idle'
      }
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
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code: '',
            output: '',
            status: 'idle'
          }],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      const newCells = [...current.cells]
      newCells[index] = { ...newCells[index], status: 'running' }
      return { ...current, cells: newCells }
    })

    const result = await executor.executeCell(index)
    
    setStrategy((current) => {
      if (!current || !Array.isArray(current.cells)) {
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [result],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
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
      const defaultStrategy: Strategy = {
        id: 'default',
        name: 'New Strategy',
        description: '',
        cells: [{
          id: 'cell-0',
          index: 0,
          code: '',
          output: '',
          status: 'idle'
        }],
        parameters: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      
      if (!current || !Array.isArray(current.cells)) return defaultStrategy
      return {
        ...current,
        cells: current.cells.map(cell => ({ ...cell, status: 'running' as const }))
      }
    })

    const results = await executor.executeAll()
    
    setStrategy((current) => {
      const defaultStrategy: Strategy = {
        id: 'default',
        name: 'New Strategy',
        description: '',
        cells: results,
        parameters: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      
      if (!current) return defaultStrategy
      return {
        ...current,
        cells: results,
        updatedAt: Date.now()
      }
    })

    setExecutionContext(executor.getContext())
    toast.success('Execution complete')
  }

  const handleParametersChange = (parameters: Parameter[]) => {
    setStrategy((current) => {
      if (!current) {
        return {
          id: 'default',
          name: 'New Strategy',
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code: '',
            output: '',
            status: 'idle'
          }],
          parameters,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
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
        return {
          id: 'default',
          name,
          description: '',
          cells: [{
            id: 'cell-0',
            index: 0,
            code: '',
            output: '',
            status: 'idle'
          }],
          parameters: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      return {
        ...current,
        name,
        updatedAt: Date.now()
      }
    })
  }

  const handleSaveStrategy = () => {
    toast.success('Strategy saved successfully')
  }

  if (!strategy) return null

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      <div 
        className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20"
        style={{
          background: 'repeating-linear-gradient(45deg, oklch(0.97 0.005 250), oklch(0.97 0.005 250) 10px, oklch(0.96 0.005 250) 10px, oklch(0.96 0.005 250) 20px)'
        }}
      >
        <div className="container mx-auto h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Code size={28} weight="duotone" className="text-accent" />
              <h1 className="text-xl font-semibold tracking-tight">Strategy Executor</h1>
            </div>
            <Input
              value={strategy.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-64 h-9 bg-background"
              placeholder="Strategy name"
              id="strategy-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRunAll} size="sm" variant="default">
              <PlayCircle size={16} className="mr-2" weight="fill" />
              Run All
            </Button>
            <Button onClick={handleSaveStrategy} size="sm" variant="secondary">
              <FloppyDisk size={16} className="mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Code Cells</h2>
                <Button onClick={handleAddCell} size="sm" variant="outline">
                  <Plus size={16} className="mr-2" />
                  Add Cell
                </Button>
              </div>

              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-4 pr-4">
                  {strategy.cells.map((cell) => (
                    <CodeCellComponent
                      key={cell.id}
                      cell={cell}
                      onCodeChange={(code) => handleCellCodeChange(cell.index, code)}
                      onRun={() => handleRunCell(cell.index)}
                      onDelete={() => handleDeleteCell(cell.index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <ContextInspector context={executionContext} />
            <ParameterPanel
              parameters={strategy.parameters}
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
  )
}

export default App
