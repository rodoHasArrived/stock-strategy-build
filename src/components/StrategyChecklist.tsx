import { StrategyChecklistItem } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, WarningCircle, XCircle, ListChecks } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface StrategyChecklistProps {
  items: StrategyChecklistItem[]
  onItemClick?: (item: StrategyChecklistItem) => void
}

export function StrategyChecklist({ items, onItemClick }: StrategyChecklistProps) {
  const completeCount = items.filter(item => item.status === 'complete').length

  const iconForStatus = (status: StrategyChecklistItem['status']) => {
    if (status === 'complete') return <CheckCircle size={16} weight="fill" className="text-success" />
    if (status === 'warning') return <WarningCircle size={16} weight="fill" className="text-warning" />
    return <XCircle size={16} weight="fill" className="text-destructive" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks size={18} className="text-accent" weight="duotone" />
            Strategy Checklist
          </CardTitle>
          <Badge variant="secondary">{completeCount}/{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(item => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            className={cn(
              'h-auto w-full justify-start rounded-md border px-3 py-2 text-left',
              item.status === 'complete' && 'border-success/20 bg-success/5',
              item.status === 'warning' && 'border-warning/25 bg-warning/5',
              item.status === 'missing' && 'border-destructive/25 bg-destructive/5'
            )}
            onClick={() => onItemClick?.(item)}
          >
            <div className="flex w-full items-start gap-2">
              <div className="mt-0.5">{iconForStatus(item.status)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="mt-0.5 whitespace-normal text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
