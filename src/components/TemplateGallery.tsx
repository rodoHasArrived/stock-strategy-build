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

interface TemplateGalleryProps {
  onLoadTemplate: (template: StrategyTemplate) => void
}

export function TemplateGallery({ onLoadTemplate }: TemplateGalleryProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const categories = getAllCategories()

  const filteredTemplates = selectedCategory === 'all' 
    ? strategyTemplates 
    : strategyTemplates.filter(t => t.category === selectedCategory)

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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <ChartLine size={24} weight="duotone" className="text-accent" />
            Strategy Templates
          </DialogTitle>
          <DialogDescription>
            Load a pre-built strategy template to get started quickly. All templates are fully editable after creation.
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
            <ScrollArea className="h-[calc(85vh-200px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="hover:border-accent transition-all hover:shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2 mb-2">
                            {getCategoryIcon(template.category)}
                            {template.name}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {template.category}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-sm line-clamp-2">
                        {template.description}
                      </CardDescription>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-muted-foreground">Cells</span>
                          <span className="font-mono font-semibold">{template.strategy.cells.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-muted-foreground">Parameters</span>
                          <span className="font-mono font-semibold">{template.strategy.parameters.length}</span>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleLoadTemplate(template)} 
                        className="w-full gap-2"
                        size="sm"
                      >
                        <CheckCircle size={16} weight="fill" />
                        Load Strategy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ChartBar size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No templates found in this category</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
