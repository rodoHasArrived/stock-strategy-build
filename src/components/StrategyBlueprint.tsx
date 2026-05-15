import { CellPurpose, CodeCell } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Circle, Plus, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface StrategyBlueprintProps {
  cells: CodeCell[]
  highlightedCell?: number
  onCellClick?: (index: number) => void
  onAddPurpose?: (purpose: CellPurpose) => void
}

const requiredStages: Array<{ purpose: CellPurpose; label: string; contract: string }> = [
  { purpose: 'universe', label: 'Universe', contract: 'Filtered universe' },
  { purpose: 'data', label: 'Data', contract: 'Enriched dataset' },
  { purpose: 'ranking', label: 'Signal', contract: 'Score or ranked candidates' },
  { purpose: 'risk', label: 'Risk', contract: 'Risk pass/fail' },
  { purpose: 'portfolio', label: 'Portfolio', contract: 'Selected holdings' },
  { purpose: 'trade', label: 'Output', contract: 'Trade signal or target allocation' },
]

const stageMatches = (cell: CodeCell, purpose: CellPurpose) => {
  if (purpose === 'ranking') return ['ranking', 'calculation', 'condition'].includes(cell.purpose)
  if (purpose === 'trade') return ['trade', 'allocation'].includes(cell.purpose)
  return cell.purpose === purpose
}

export function StrategyBlueprint({ cells, highlightedCell, onCellClick, onAddPurpose }: StrategyBlueprintProps) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-base">Strategy Blueprint</CardTitle>
        <p className="text-xs text-muted-foreground">Purpose-first view of the investment process and expected output contracts.</p>
      </CardHeader>
      <CardContent className="h-full overflow-auto p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {requiredStages.map((stage, stageIndex) => {
            const cell = cells.find(item => stageMatches(item, stage.purpose))
            const contractName = cell?.contract?.description ?? stage.contract
            const isHighlighted = cell && highlightedCell === cell.index
            return (
              <div
                key={stage.purpose}
                className={cn(
                  'rounded-lg border bg-card p-4 transition-colors',
                  isHighlighted && 'border-accent ring-2 ring-accent/25',
                  !cell && 'border-dashed bg-muted/20'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{stageIndex + 1}</Badge>
                      <div className="font-medium">{stage.label}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{contractName}</div>
                  </div>
                  {cell ? (
                    cell.contract ? <CheckCircle size={18} weight="fill" className="text-success" /> : <WarningCircle size={18} weight="fill" className="text-warning" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground" />
                  )}
                </div>

                {cell ? (
                  <Button
                    variant="ghost"
                    className="mt-3 h-auto w-full justify-start px-2 py-2 text-left"
                    onClick={() => onCellClick?.(cell.index)}
                  >
                    <div>
                      <div className="text-sm font-medium">Cell {cell.index}: {cell.label ?? cell.purpose}</div>
                      <div className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">{cell.code || 'No code defined'}</div>
                    </div>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onAddPurpose?.(stage.purpose)}
                  >
                    <Plus size={14} className="mr-2" />
                    Add {stage.label}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
