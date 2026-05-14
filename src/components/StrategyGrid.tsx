import { useState, useCallback, type ReactNode } from 'react'
import { Cell, Parameter, Security } from '@/lib/types'
import { GridCell } from './GridCell'
import { columnToLetter, getCellId, evaluateFormula, formatCellValue, detectCircularReference } from '@/lib/formula'
import { ScrollArea } from '@/components/ui/scroll-area'

interface StrategyGridProps {
  cells: Record<string, Cell>
  parameters: Parameter[]
  securities: Security[]
  onCellsChange: (cells: Record<string, Cell>) => void
  rows?: number
  cols?: number
}

export function StrategyGrid({ 
  cells, 
  parameters, 
  securities, 
  onCellsChange,
  rows = 15,
  cols = 10
}: StrategyGridProps) {
  const [activeCell, setActiveCell] = useState<string | null>(null)

  const paramMap = parameters.reduce((acc, p) => {
    acc[p.name] = p.value
    return acc
  }, {} as Record<string, number | string>)

  const updateCell = useCallback((cellId: string, newValue: string) => {
    const newCells = { ...cells }
    const cellPos = getCellId(
      parseInt(cellId.match(/\d+/)?.[0] || '1') - 1,
      cellId.charCodeAt(0) - 65
    )

    const isFormula = newValue.startsWith('=')
    
    if (isFormula) {
      if (detectCircularReference(cellId, newValue, newCells)) {
        newCells[cellId] = {
          ...newCells[cellId],
          type: 'error',
          error: 'Circular reference detected',
          formula: newValue,
          displayValue: '#CIRCULAR',
          value: null
        }
        onCellsChange(newCells)
        return
      }

      const result = evaluateFormula(newValue, newCells, paramMap, securities)
      
      newCells[cellId] = {
        id: cellId,
        row: parseInt(cellId.match(/\d+/)?.[0] || '1') - 1,
        col: cellId.charCodeAt(0) - 65,
        formula: newValue,
        value: result.value,
        displayValue: result.error ? `#ERROR` : formatCellValue(result.value),
        type: result.error ? 'error' : 'formula',
        error: result.error
      }
    } else {
      const numValue = parseFloat(newValue)
      const value = isNaN(numValue) ? newValue : numValue
      
      newCells[cellId] = {
        id: cellId,
        row: parseInt(cellId.match(/\d+/)?.[0] || '1') - 1,
        col: cellId.charCodeAt(0) - 65,
        value,
        displayValue: newValue,
        type: 'value'
      }
    }

    const cellsToRecalc = Object.keys(newCells).filter(id => 
      newCells[id].formula?.includes(cellId)
    )

    cellsToRecalc.forEach(id => {
      const cell = newCells[id]
      if (cell.formula) {
        const result = evaluateFormula(cell.formula, newCells, paramMap, securities)
        newCells[id] = {
          ...cell,
          value: result.value,
          displayValue: result.error ? '#ERROR' : formatCellValue(result.value),
          type: result.error ? 'error' : 'formula',
          error: result.error
        }
      }
    })

    onCellsChange(newCells)
  }, [cells, parameters, securities, onCellsChange, paramMap])

  const renderGrid = () => {
    const grid: ReactNode[] = []

    grid.push(
      <div key="header" className="flex sticky top-0 bg-secondary z-10">
        <div className="w-12 h-9 border border-border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground" />
        {Array.from({ length: cols }, (_, colIndex) => (
          <div
            key={`col-${colIndex}`}
            className="w-32 h-9 border border-border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {columnToLetter(colIndex)}
          </div>
        ))}
      </div>
    )

    for (let row = 0; row < rows; row++) {
      const rowCells: ReactNode[] = []
      
      rowCells.push(
        <div
          key={`row-${row}`}
          className="w-12 h-9 border border-border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground sticky left-0 z-10"
        >
          {row + 1}
        </div>
      )

      for (let col = 0; col < cols; col++) {
        const cellId = getCellId(row, col)
        const cell = cells[cellId] || {
          id: cellId,
          row,
          col,
          value: null,
          displayValue: '',
          type: 'value' as const
        }

        rowCells.push(
          <div key={cellId} className="w-32">
            <GridCell
              cell={cell}
              isActive={activeCell === cellId}
              onCellClick={() => setActiveCell(cellId)}
              onCellChange={(value) => updateCell(cellId, value)}
              onCellBlur={() => setActiveCell(null)}
            />
          </div>
        )
      }

      grid.push(
        <div key={`row-content-${row}`} className="flex">
          {rowCells}
        </div>
      )
    }

    return grid
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="inline-block min-w-full">
          {renderGrid()}
        </div>
      </ScrollArea>
    </div>
  )
}
