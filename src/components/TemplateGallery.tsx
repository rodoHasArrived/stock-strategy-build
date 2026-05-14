import { StrategyTemplate } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, ChartLine } from '@phosphor-icons/react'
import { strategyTemplates } from '@/lib/mockData'

interface TemplateGalleryProps {
  onLoadTemplate: (template: StrategyTemplate) => void
}

export function TemplateGallery({ onLoadTemplate }: TemplateGalleryProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen size={16} className="mr-2" />
          Load Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Strategy Templates</DialogTitle>
          <DialogDescription>
            Load a pre-built strategy template to get started quickly
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {strategyTemplates.map((template) => (
            <Card key={template.id} className="hover:border-accent transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ChartLine size={18} weight="duotone" />
                      {template.name}
                    </CardTitle>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {template.category}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground mb-4">
                  <div className="flex justify-between">
                    <span>Cells:</span>
                    <span className="font-mono">{Object.keys(template.strategy.cells).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parameters:</span>
                    <span className="font-mono">{template.strategy.parameters.length}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => onLoadTemplate(template)} 
                  className="w-full"
                  size="sm"
                >
                  Load Strategy
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
