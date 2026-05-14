import { useState, useRef, useEffect } from 'react'
import { CodeCell as CodeCellType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Play, CheckCircle, XCircle, Clock, ArrowRight } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

interface CodeCellProps {
  cell: CodeCellType
  onCodeChange: (code: string) => void
  onRun: () => void
  onDelete: () => void
}

export function CodeCellComponent({ cell, onCodeChange, onRun, onDelete }: CodeCellProps) {
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

        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={cell.code}
            onChange={(e) => onCodeChange(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            placeholder="Enter code... (use 'if condition: next', 'goto n', etc.)"
            className="font-mono text-sm min-h-[80px] resize-y bg-muted/30"
            id={`cell-${cell.index}`}
          />
        </div>

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
