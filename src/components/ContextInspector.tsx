import { ExecutionContext } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Function as FunctionIcon } from '@phosphor-icons/react'

interface ContextInspectorProps {
  context: ExecutionContext
}

export function ContextInspector({ context }: ContextInspectorProps) {
  const filterUserVariables = () => {
    return Object.entries(context.variables).filter(
      ([key]) => !['PRICE', 'YIELD', 'COUPON', 'DURATION', 'SPREAD', 'RATING', 'securities'].includes(key)
    )
  }

  const userVariables = filterUserVariables()

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
            <Badge variant="secondary">{context.currentCell}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Iterations:</span>
            <Badge variant="outline">
              {context.iterationCount} / {context.maxIterations}
            </Badge>
          </div>
        </div>

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
            <div>YIELD(cusip)</div>
            <div>COUPON(cusip)</div>
            <div>DURATION(cusip)</div>
            <div>SPREAD(cusip)</div>
            <div>RATING(cusip)</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
