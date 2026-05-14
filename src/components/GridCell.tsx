import { useState, useRef, useEffect } from 'react'
import { Cell } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

interface GridCellProps {
  cell: Cell
  isActive: boolean
  onCellClick: () => void
  onCellChange: (value: string) => void
  onCellBlur: () => void
}

export function GridCell({ cell, isActive, onCellClick, onCellChange, onCellBlur }: GridCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(cell.formula || cell.displayValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isActive && !isEditing) {
      setIsEditing(true)
    }
  }, [isActive])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(cell.formula || cell.displayValue)
  }, [cell.formula, cell.displayValue])

  const handleDoubleClick = () => {
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    onCellChange(editValue)
    onCellBlur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditValue(cell.formula || cell.displayValue)
      setIsEditing(false)
      onCellBlur()
    }
  }

  const getCellBackground = () => {
    if (cell.type === 'error') return 'bg-destructive/10'
    if (cell.type === 'formula') return 'bg-accent/5'
    if (cell.isCalculating) return 'cell-loading'
    return 'bg-card'
  }

  const getCellBorder = () => {
    if (isActive || isEditing) return 'ring-2 ring-accent shadow-md'
    if (cell.type === 'error') return 'border-destructive'
    return 'border-border'
  }

  const cellContent = isEditing ? (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 py-1 bg-transparent font-mono text-sm outline-none"
    />
  ) : (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className={cn(
        'flex-1 truncate text-sm',
        cell.type === 'formula' ? 'font-mono' : '',
        cell.type === 'error' ? 'text-destructive' : 'text-foreground'
      )}>
        {cell.type === 'error' ? '#ERROR' : cell.displayValue}
      </span>
      {cell.type === 'formula' && !isEditing && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">fx</Badge>
      )}
    </div>
  )

  const tooltipContent = cell.error 
    ? cell.error 
    : cell.formula 
    ? `Formula: ${cell.formula}\nValue: ${cell.displayValue}` 
    : cell.displayValue

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onCellClick}
            onDoubleClick={handleDoubleClick}
            className={cn(
              'border transition-all cursor-pointer relative min-h-[36px]',
              getCellBackground(),
              getCellBorder(),
              cell.isCalculating && 'cell-updating'
            )}
          >
            {cellContent}
          </div>
        </TooltipTrigger>
        {!isEditing && tooltipContent && (
          <TooltipContent side="bottom" className="max-w-xs whitespace-pre-wrap font-mono text-xs">
            {tooltipContent}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
