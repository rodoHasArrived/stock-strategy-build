import { useState, useRef, useEffect } from 'react'
import { CodeCell as CodeCellType, CellMode, Condition } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Play, CheckCircle, XCircle, Clock, ArrowRight, Shapes, Function as FunctionIcon, Code as CodeIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { VisualBuilder } from '@/components/VisualBuilder'
import { DataFieldSelector } from '@/components/DataFieldSelector'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CodeCellProps {
  cell: CodeCellType
  onCodeChange: (code: string) => void
  onRun: () => void
  onDelete: () => void
  onCellChange: (updates: Partial<CodeCellType>) => void
}

export function CodeCellComponent({ cell, onCodeChange, onRun, onDelete, onCellChange }: CodeCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  const getStatusBadge = () => {
    switch (cell.status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle size={14} className="mr-1" weight="fill" />
            Success
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle size={14} className="mr-1" weight="fill" />
            Error
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Clock size={14} className="mr-1" />
            Running
          </Badge>
        )
      case 'skipped':
        return (
          <Badge variant="outline">
            <ArrowRight size={14} className="mr-1" />
            Skipped
          </Badge>
        )
      default:
        return <Badge variant="secondary">Idle</Badge>
    }
  }

  const handleConditionsChange = (conditions: Condition[]) => {
    const visualConfig = { ...cell.visualConfig, conditions }
    onCellChange({ visualConfig })
    
    const conditionCode = conditions.map((c, i) => {
      const logic = i > 0 && c.logic ? ` ${c.logic.toLowerCase()} ` : ''
      const condition = c.operator === 'between'
        ? `${c.field}(cusip) >= ${c.value} and ${c.field}(cusip) <= ${c.value2}`
        : `${c.field}(cusip) ${c.operator} ${typeof c.value === 'string' ? `"${c.value}"` : c.value}`
      return `${i > 0 ? '\n' : ''}${logic}${condition}`
    }).join('')
    
    onCodeChange(`if ${conditionCode}:\n  __result__ = "Match"`)
  }

  const handleDataFieldsChange = (dataFields: string[]) => {
    const visualConfig = { ...cell.visualConfig, dataFields }
    onCellChange({ visualConfig })
    
    const fieldsCode = dataFields.map(field => `${field.toLowerCase()} = ${field}(cusip)`).join('\n')
    onCodeChange(fieldsCode)
  }

  const handleModeChange = (mode: CellMode) => {
    onCellChange({ mode })
  }

  return (
    <Card className={cn(
      'p-4 transition-all',
      cell.status === 'error' && 'border-destructive',
      cell.status === 'success' && 'border-success',
      cell.status === 'running' && 'ring-2 ring-accent'
    )}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-medium text-muted-foreground">
              [{cell.index}]
            </span>
            {getStatusBadge()}
            {cell.executionTime != null && (
              <span className="text-xs text-muted-foreground">
                {cell.executionTime.toFixed(2)}ms
              </span>
            )}
            {cell.controlFlow && (
              <Badge variant="outline" className="text-xs">
                {cell.controlFlow.type === 'goto' 
                  ? `→ cell ${cell.controlFlow.target}`
                  : cell.controlFlow.type
                }
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onRun}
              disabled={cell.status === 'running'}
            >
              <Play size={16} className="mr-1" weight="fill" />
              Run
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>

        <Tabs value={cell.mode} onValueChange={(value) => handleModeChange(value as CellMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="visual" className="text-xs">
              <Shapes size={14} className="mr-1" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="formula" className="text-xs">
              <FunctionIcon size={14} className="mr-1" />
              Formula
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs">
              <CodeIcon size={14} className="mr-1" />
              Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visual" className="space-y-3 mt-3">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 pr-3">
                <VisualBuilder
                  conditions={cell.visualConfig?.conditions || []}
                  onConditionsChange={handleConditionsChange}
                />
                
                <div className="border-t pt-4">
                  <DataFieldSelector
                    selectedFields={cell.visualConfig?.dataFields || []}
                    onFieldsChange={handleDataFieldsChange}
                    aggregation={cell.visualConfig?.aggregation}
                    onAggregationChange={(agg) => {
                      const visualConfig = { ...cell.visualConfig, aggregation: agg }
                      onCellChange({ visualConfig })
                    }}
                    sortBy={cell.visualConfig?.sortBy}
                    sortOrder={cell.visualConfig?.sortOrder}
                    onSortChange={(sortBy, sortOrder) => {
                      const visualConfig = { ...cell.visualConfig, sortBy, sortOrder }
                      onCellChange({ visualConfig })
                    }}
                  />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="formula" className="mt-3">
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={cell.code}
                onChange={(e) => onCodeChange(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                placeholder="Enter formula... (e.g., PRICE(cusip) > 100)"
                className="font-mono text-sm min-h-[80px] resize-y bg-muted/30"
                id={`cell-formula-${cell.index}`}
              />
              <div className="text-xs text-muted-foreground">
                Use functions: PRICE(), YIELD(), COUPON(), DURATION(), SPREAD(), RATING(), SECTOR()
              </div>
            </div>
          </TabsContent>

          <TabsContent value="code" className="mt-3">
            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                value={cell.code}
                onChange={(e) => onCodeChange(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                placeholder="Enter code... (use 'if condition: next', 'goto n', etc.)"
                className="font-mono text-sm min-h-[80px] resize-y bg-muted/30"
                id={`cell-code-${cell.index}`}
              />
            </div>
          </TabsContent>
        </Tabs>

        {cell.output && cell.status !== 'error' && (
          <div className="border-l-4 border-success pl-3 py-2">
            <div className="text-xs text-muted-foreground mb-1">Output:</div>
            <pre className="font-mono text-sm whitespace-pre-wrap">{cell.output}</pre>
          </div>
        )}

        {cell.error && (
          <div className="border-l-4 border-destructive pl-3 py-2">
            <div className="text-xs text-destructive mb-1">Error:</div>
            <pre className="font-mono text-sm text-destructive whitespace-pre-wrap">
              {cell.error}
            </pre>
          </div>
        )}
      </div>
    </Card>
  )
}
