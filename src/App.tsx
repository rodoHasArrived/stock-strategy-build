import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Cell, Parameter, Strategy, StrategyTemplate } from '@/lib/types'
import { StrategyGrid } from '@/components/StrategyGrid'
import { ParameterPanel } from '@/components/ParameterPanel'
import { TemplateGallery } from '@/components/TemplateGallery'
import { mockSecurities } from '@/lib/mockData'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FloppyDisk, Table, Function } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { evaluateFormula, formatCellValue } from '@/lib/formula'

function App() {
  const [strategy, setStrategy] = useKV<Strategy>('current-strategy', {
    id: 'default',
    name: 'New Strategy',
    description: '',
    cells: {},
    parameters: [],
    conditions: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  useEffect(() => {
    if (strategy && Object.keys(strategy.cells).length > 0) {
      recalculateAllCells()
    }
  }, [strategy?.parameters])

  const recalculateAllCells = () => {
    if (!strategy) return

    const paramMap = strategy.parameters.reduce((acc, p) => {
      acc[p.name] = p.value
      return acc
    }, {} as Record<string, number | string>)

    const newCells: Record<string, Cell> = {}
    
    Object.entries(strategy.cells).forEach(([id, cell]) => {
      if (cell.formula) {
        const result = evaluateFormula(cell.formula, strategy.cells, paramMap, mockSecurities)
        newCells[id] = {
          ...cell,
          value: result.value,
          displayValue: result.error ? '#ERROR' : formatCellValue(result.value),
          type: result.error ? 'error' : 'formula',
          error: result.error
        }
      } else {
        newCells[id] = cell
      }
    })

    setStrategy((current) => ({
      ...current!,
      cells: newCells,
      updatedAt: Date.now()
    }))
  }

  const handleCellsChange = (cells: Record<string, Cell>) => {
    setStrategy((current) => ({
      ...current!,
      cells,
      updatedAt: Date.now()
    }))
  }

  const handleParametersChange = (parameters: Parameter[]) => {
    setStrategy((current) => ({
      ...current!,
      parameters,
      updatedAt: Date.now()
    }))
  }

  const handleLoadTemplate = (template: StrategyTemplate) => {
    setStrategy((current) => ({
      id: `template-${Date.now()}`,
      name: template.strategy.name,
      description: template.strategy.description,
      cells: template.strategy.cells,
      parameters: template.strategy.parameters,
      conditions: template.strategy.conditions,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
    toast.success(`Loaded template: ${template.name}`)
  }

  const handleSaveStrategy = () => {
    toast.success('Strategy saved successfully')
  }

  const handleNameChange = (name: string) => {
    setStrategy((current) => ({
      ...current!,
      name,
      updatedAt: Date.now()
    }))
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
              <Table size={28} weight="duotone" className="text-accent" />
              <h1 className="text-xl font-semibold tracking-tight">Strategy Builder</h1>
            </div>
            <Input
              value={strategy.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-64 h-9 bg-background"
              placeholder="Strategy name"
            />
          </div>
          <div className="flex items-center gap-2">
            <TemplateGallery onLoadTemplate={handleLoadTemplate} />
            <Button onClick={handleSaveStrategy} size="sm">
              <FloppyDisk size={16} className="mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        <Tabs defaultValue="grid" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="grid">
              <Table size={16} className="mr-2" />
              Strategy Grid
            </TabsTrigger>
            <TabsTrigger value="parameters">
              <Function size={16} className="mr-2" />
              Parameters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <StrategyGrid
                  cells={strategy.cells}
                  parameters={strategy.parameters}
                  securities={mockSecurities}
                  onCellsChange={handleCellsChange}
                  rows={20}
                  cols={8}
                />
              </div>
              <div className="lg:col-span-1">
                <ParameterPanel
                  parameters={strategy.parameters}
                  onParametersChange={handleParametersChange}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parameters">
            <div className="max-w-2xl mx-auto">
              <ParameterPanel
                parameters={strategy.parameters}
                onParametersChange={handleParametersChange}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="text-sm font-medium mb-3">Formula Functions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="font-mono">
              <span className="text-accent font-semibold">PRICE(cusip)</span>
              <p className="text-muted-foreground mt-1">Get security price</p>
            </div>
            <div className="font-mono">
              <span className="text-accent font-semibold">YIELD(cusip)</span>
              <p className="text-muted-foreground mt-1">Get security yield</p>
            </div>
            <div className="font-mono">
              <span className="text-accent font-semibold">COUPON(cusip)</span>
              <p className="text-muted-foreground mt-1">Get coupon rate</p>
            </div>
            <div className="font-mono">
              <span className="text-accent font-semibold">DURATION(cusip)</span>
              <p className="text-muted-foreground mt-1">Get duration</p>
            </div>
            <div className="font-mono">
              <span className="text-accent font-semibold">SPREAD(cusip)</span>
              <p className="text-muted-foreground mt-1">Get credit spread</p>
            </div>
            <div className="font-mono">
              <span className="text-accent font-semibold">IF(cond,true,false)</span>
              <p className="text-muted-foreground mt-1">Conditional logic</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App