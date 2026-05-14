import { Cell, CellValue, Security } from './types'

export function columnToLetter(col: number): string {
  let letter = ''
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter
    col = Math.floor(col / 26) - 1
  }
  return letter
}

export function letterToColumn(letter: string): number {
  let col = 0
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + letter.charCodeAt(i) - 64
  }
  return col - 1
}

export function getCellId(row: number, col: number): string {
  return `${columnToLetter(col)}${row + 1}`
}

export function parseCellId(cellId: string): { row: number; col: number } | null {
  const match = cellId.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  const col = letterToColumn(match[1])
  const row = parseInt(match[2]) - 1
  return { row, col }
}

export function evaluateFormula(
  formula: string,
  cells: Record<string, Cell>,
  parameters: Record<string, number | string>,
  securities: Security[]
): { value: CellValue; error?: string } {
  try {
    let expression = formula.trim()
    
    if (expression.startsWith('=')) {
      expression = expression.substring(1)
    }

    expression = expression.replace(/\$\{(\w+)\}/g, (_, paramName) => {
      const value = parameters[paramName]
      if (value === undefined) {
        throw new Error(`Parameter ${paramName} not found`)
      }
      return typeof value === 'string' ? `"${value}"` : String(value)
    })

    expression = expression.replace(/([A-Z]+\d+)/g, (cellRef) => {
      const cell = cells[cellRef]
      if (!cell) return '0'
      if (cell.type === 'error') {
        throw new Error(`Reference to error cell ${cellRef}`)
      }
      const val = cell.value
      return typeof val === 'string' ? `"${val}"` : String(val ?? 0)
    })

    expression = expression.replace(/PRICE\(["']([^"']+)["']\)/gi, (_, cusip) => {
      const security = securities.find(s => s.cusip === cusip)
      return security ? String(security.price) : '0'
    })

    expression = expression.replace(/YIELD\(["']([^"']+)["']\)/gi, (_, cusip) => {
      const security = securities.find(s => s.cusip === cusip)
      return security ? String(security.yield) : '0'
    })

    expression = expression.replace(/COUPON\(["']([^"']+)["']\)/gi, (_, cusip) => {
      const security = securities.find(s => s.cusip === cusip)
      return security ? String(security.coupon) : '0'
    })

    expression = expression.replace(/DURATION\(["']([^"']+)["']\)/gi, (_, cusip) => {
      const security = securities.find(s => s.cusip === cusip)
      return security ? String(security.duration) : '0'
    })

    expression = expression.replace(/SPREAD\(["']([^"']+)["']\)/gi, (_, cusip) => {
      const security = securities.find(s => s.cusip === cusip)
      return security ? String(security.spread ?? 0) : '0'
    })

    expression = expression.replace(/IF\s*\((.*?),(.*?),(.*?)\)/gi, (_, condition, trueVal, falseVal) => {
      return `(${condition}) ? (${trueVal}) : (${falseVal})`
    })

    expression = expression.replace(/SUM\s*\((.*?)\)/gi, (_, range) => {
      const values = range.split(',').map((v: string) => v.trim())
      return `(${values.join('+')})`
    })

    expression = expression.replace(/AVG\s*\((.*?)\)/gi, (_, range) => {
      const values = range.split(',').map((v: string) => v.trim())
      return `((${values.join('+')}) / ${values.length})`
    })

    expression = expression.replace(/MAX\s*\((.*?)\)/gi, (_, range) => {
      const values = range.split(',').map((v: string) => v.trim())
      return `Math.max(${values.join(',')})`
    })

    expression = expression.replace(/MIN\s*\((.*?)\)/gi, (_, range) => {
      const values = range.split(',').map((v: string) => v.trim())
      return `Math.min(${values.join(',')})`
    })

    const result = new Function(`return ${expression}`)()

    return { value: result }
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'Invalid formula'
    }
  }
}

export function formatCellValue(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    return value.toFixed(4).replace(/\.?0+$/, '')
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

export function detectCircularReference(
  cellId: string,
  formula: string,
  cells: Record<string, Cell>,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(cellId)) return true
  visited.add(cellId)

  const cellRefs = formula.match(/[A-Z]+\d+/g) || []
  
  for (const ref of cellRefs) {
    const refCell = cells[ref]
    if (refCell?.formula) {
      if (detectCircularReference(ref, refCell.formula, cells, new Set(visited))) {
        return true
      }
    }
  }

  return false
}
