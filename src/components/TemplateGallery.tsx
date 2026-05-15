import { useState } from 'react'
import { StrategyTemplate } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FolderOpen, ChartLine, TrendUp, ChartBar, Briefcase, CheckCircle, Intersect } from '@phosphor-icons/react'
import { strategyTemplates, getAllCategories } from '@/lib/templates'
import { fixtureStrategyDataProvider } from '@/lib/strategyDataProvider'

interface TemplateGalleryProps {
  onLoadTemplate: (template: StrategyTemplate) => void
}

export function TemplateGallery({ onLoadTemplate }: TemplateGalleryProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(strategyTemplates[0]?.id ?? '')
  const categories = getAllCategories()
  const datasets = fixtureStrategyDataProvider.listDatasets()

  const filteredTemplates = selectedCategory === 'all' 
    ? strategyTemplates 
    : strategyTemplates.filter(t => t.category === selectedCategory)
  const selectedTemplate = filteredTemplates.find(template => template.id === selectedTemplateId) ?? filteredTemplates[0]
  const selectedDataset = selectedTemplate
    ? datasets.find(dataset => dataset.compatibleTemplateCategories.includes(selectedTemplate.category))
    : undefined

  const handleLoadTemplate = (template: StrategyTemplate) => {
    onLoadTemplate(template)
    setOpen(false)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Fixed Income':
        return <ChartLine size={16} weight="duotone" />
      case 'Equity':
        return <TrendUp size={16} weight="duotone" />
      case 'Portfolio':
        return <Briefcase size={16} weight="duotone" />
      case 'Trading':
        return <Intersect size={16} weight="duotone" />
      default:
        return <ChartBar size={16} weight="duotone" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen size={16} className="mr-2" />
          Load Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <ChartLine size={24} weight="duotone" className="text-accent" />
            Strategy Templates
          </DialogTitle>
          <DialogDescription>
            Browse templates by intent, confirm dataset fit, then load one editable strategy into the workstation.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all" className="gap-2">
              <ChartBar size={14} />
              All Templates
            </TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="gap-2">
                {getCategoryIcon(category)}
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="flex-1 mt-4">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ChartBar size={48} className="mx-auto mb-4 opacity-20" />
                <p>No templates found in this category</p>
              </div>
            ) : (
              <div className="grid min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="overflow-hidden">
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="text-base">Template Workbench</CardTitle>
                    <CardDescription>Select one template to inspect before loading.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[430px]">
                      <div className="space-y-2 p-3">
                        {filteredTemplates.map(template => {
                          const recommendedDataset = datasets.find(dataset =>
                            dataset.compatibleTemplateCategories.includes(template.category)
                          )
                          const selected = selectedTemplate?.id === template.id

                          return (
                            <button
                              key={template.id}
                              type="button"
                              className={`w-full rounded-md border p-3 text-left transition-colors hover:border-accent ${selected ? 'border-accent bg-accent/5' : 'bg-background'}`}
                              onClick={() => setSelectedTemplateId(template.id)}
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 text-accent">{getCategoryIcon(template.category)}</span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium leading-snug">{template.name}</span>
                                  <span className="mt-1 block truncate text-xs text-muted-foreground">{template.description}</span>
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                                <Badge variant={recommendedDataset ? 'default' : 'outline'} className="text-[10px]">
                                  {recommendedDataset ? 'Backtest-ready' : 'Needs data'}
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {selectedTemplate && (
                  <Card className="overflow-hidden">
                    <CardHeader className="border-b">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="flex items-center gap-2 text-xl">
                            {getCategoryIcon(selectedTemplate.category)}
                            {selectedTemplate.name}
                          </CardTitle>
                          <CardDescription>{selectedTemplate.description}</CardDescription>
                        </div>
                        <Button onClick={() => handleLoadTemplate(selectedTemplate)} className="gap-2">
                          <CheckCircle size={16} weight="fill" />
                          Load Strategy
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs uppercase text-muted-foreground">Category</div>
                          <div className="mt-1 font-medium">{selectedTemplate.category}</div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs uppercase text-muted-foreground">Cells</div>
                          <div className="mt-1 font-mono text-lg">{selectedTemplate.strategy.cells.length}</div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs uppercase text-muted-foreground">Parameters</div>
                          <div className="mt-1 font-mono text-lg">{selectedTemplate.strategy.parameters.length}</div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3">
                          <div className="text-xs uppercase text-muted-foreground">Signal Contract</div>
                          <div className="mt-1 font-medium">{selectedTemplate.category === 'Portfolio' ? 'Target/Orders' : 'Buy/Sell/Hold'}</div>
                        </div>
                      </div>

                      <div className="rounded-md border bg-background p-4">
                        <div className="mb-2 text-sm font-medium">Dataset Fit</div>
                        {selectedDataset ? (
                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                            <div>
                              <div className="text-xs uppercase text-muted-foreground">Recommended</div>
                              <div className="mt-1 font-medium">{selectedDataset.name}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase text-muted-foreground">Universe</div>
                              <div className="mt-1 font-mono text-xs">{selectedDataset.symbols.join(', ')}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase text-muted-foreground">Window</div>
                              <div className="mt-1">{selectedDataset.startDate} to {selectedDataset.endDate}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No bundled dataset matches this template. Load the strategy, then import a custom CSV/JSON dataset before proofing.</div>
                        )}
                      </div>

                      <div className="rounded-md border bg-muted/20 p-4">
                        <div className="mb-3 text-sm font-medium">Workflow Preview</div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {selectedTemplate.strategy.cells.slice(0, 6).map(cell => (
                            <div key={`${selectedTemplate.id}-${cell.index}`} className="rounded-md border bg-card p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{cell.label ?? `Cell ${cell.index}`}</span>
                                <Badge variant="outline" className="text-[10px]">{cell.purpose}</Badge>
                              </div>
                              <div className="mt-2 line-clamp-2 font-mono text-[11px] text-muted-foreground">{cell.code}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
