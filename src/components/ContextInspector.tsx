import { CodeCell, ExecutionContext } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, Circle, Function as FunctionIcon, PlayCircle, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ContextInspectorProps {
  context: ExecutionContext
  cells?: CodeCell[]
}

export function ContextInspector({ context, cells = [] }: ContextInspectorProps) {
  const filterUserVariables = () => {
    return Object.entries(context.variables).filter(
      ([key]) => !['PRICE', 'YIELD', 'COUPON', 'DURATION', 'SPREAD', 'RATING', 'securities'].includes(key)
    )
  }

  const userVariables = filterUserVariables()
  const orderedCells = [...cells].sort((a, b) => a.index - b.index)
  const currentCell = orderedCells.find(cell => cell.index === context.currentCell)
  const currentPosition = currentCell
    ? orderedCells.findIndex(cell => cell.index === currentCell.index) + 1
    : 0

  const getCellGate = (cell: CodeCell) => {
    if (cell.status === 'running') {
      return {
        label: 'Running',
        icon: <PlayCircle size={13} weight="fill" className="text-accent" />,
        className: 'border-accent text-accent',
      }
    }

    if (cell.status === 'error') {
      return {
        label: 'Failed',
        icon: <WarningCircle size={13} weight="fill" className="text-destructive" />,
        className: 'border-destructive text-destructive',
      }
    }

    if (cell.contract) {
      return {
        label: 'Gate ready',
        icon: <CheckCircle size={13} weight="fill" className="text-success" />,
        className: 'border-success text-success',
      }
    }

    return {
      label: 'Needs gate',
      icon: <Circle size={13} className="text-muted-foreground" />,
      className: 'text-muted-foreground',
    }
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FunctionIcon size={20} weight="duotone" className="text-accent" />
          <h3 className="font-semibold">Execution Context</h3>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Cell:</span>
            <Badge variant="secondary">
              {currentCell ? `${currentPosition}/${orderedCells.length} · Cell ${context.currentCell}` : context.currentCell}
            </Badge>
          </div>
          {currentCell && (
            <div className="rounded-md border bg-muted/25 p-2 text-xs">
              <div className="font-medium">{currentCell.label ?? currentCell.purpose}</div>
              <div className="mt-1 text-muted-foreground">
                Next gate: {currentCell.contract?.description ?? 'Define the expected output contract'}
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Iterations:</span>
            <Badge variant="outline">
              {context.iterationCount} / {context.maxIterations}
            </Badge>
          </div>
        </div>

        {orderedCells.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Execution Order & Gates</h4>
            <div className="space-y-1.5">
              {orderedCells.map((cell, index) => {
                const gate = getCellGate(cell)
                const isCurrent = cell.index === context.currentCell

                return (
                  <div
                    key={cell.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors',
                      isCurrent ? 'border-accent bg-accent/10' : 'bg-muted/20'
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
                        isCurrent ? 'border-accent bg-accent text-accent-foreground' : 'bg-card text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">Cell {cell.index}: {cell.label ?? cell.purpose}</span>
                      <span className="block truncate text-muted-foreground">{cell.purpose}</span>
                    </span>
                    <Badge variant="outline" className={cn('h-5 text-[10px]', gate.className)}>
                      {gate.icon}
                      {gate.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          <h4 className="text-sm font-medium mb-2">Variables</h4>
          {userVariables.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No variables defined yet
            </p>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {userVariables.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-start gap-2 p-2 bg-muted/30 rounded text-xs font-mono"
                  >
                    <span className="text-accent font-semibold">{key}:</span>
                    <span className="text-right truncate max-w-[120px]">
                      {typeof value === 'function' 
                        ? '<function>' 
                        : typeof value === 'object'
                        ? JSON.stringify(value, null, 2).slice(0, 50) + '...'
                        : String(value)
                      }
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="border-t pt-3">
          <h4 className="text-sm font-medium mb-2">Available Functions</h4>
          <div className="space-y-1 text-xs font-mono text-muted-foreground">
            <div>PRICE(cusip)</div>
            <div>PRICE(basket)</div>
            <div>YIELD(cusip)</div>
            <div>YIELD(basket)</div>
            <div>COUPON(cusip)</div>
            <div>DURATION(cusip)</div>
            <div>SPREAD(cusip)</div>
            <div>RATING(cusip)</div>
            <div>basket.avg('YIELD')</div>
            <div>basket.weightedAvg('DURATION')</div>
            <div>Result = value, Next, GoTo 5, Stop</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
