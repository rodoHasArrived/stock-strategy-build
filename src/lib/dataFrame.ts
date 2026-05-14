export interface DataFrameRow {
  [key: string]: any
}

export class DataFrame {
  private data: DataFrameRow[]
  private _columns: string[]

  constructor(data: DataFrameRow[] | Record<string, any[]>) {
    if (Array.isArray(data)) {
      this.data = [...data]
      this._columns = data.length > 0 ? Object.keys(data[0]) : []
    } else {
      const keys = Object.keys(data)
      const length = keys.length > 0 ? data[keys[0]].length : 0
      this.data = []
      for (let i = 0; i < length; i++) {
        const row: DataFrameRow = {}
        keys.forEach(key => {
          row[key] = data[key][i]
        })
        this.data.push(row)
      }
      this._columns = keys
    }
  }

  get columns(): string[] {
    return [...this._columns]
  }

  get length(): number {
    return this.data.length
  }

  get shape(): [number, number] {
    return [this.data.length, this._columns.length]
  }

  iloc(index: number): DataFrameRow | undefined {
    return this.data[index]
  }

  loc(condition: (row: DataFrameRow) => boolean): DataFrame {
    return new DataFrame(this.data.filter(condition))
  }

  head(n: number = 5): DataFrame {
    return new DataFrame(this.data.slice(0, n))
  }

  tail(n: number = 5): DataFrame {
    return new DataFrame(this.data.slice(-n))
  }

  select(columns: string[]): DataFrame {
    const newData = this.data.map(row => {
      const newRow: DataFrameRow = {}
      columns.forEach(col => {
        if (col in row) {
          newRow[col] = row[col]
        }
      })
      return newRow
    })
    return new DataFrame(newData)
  }

  assign(columnName: string, values: any[] | ((row: DataFrameRow, index: number) => any)): DataFrame {
    const newData = this.data.map((row, index) => {
      const value = typeof values === 'function' ? values(row, index) : values[index]
      return { ...row, [columnName]: value }
    })
    return new DataFrame(newData)
  }

  dropna(subset?: string[]): DataFrame {
    const cols = subset || this._columns
    const filtered = this.data.filter(row => {
      return cols.every(col => row[col] != null && !Number.isNaN(row[col]))
    })
    return new DataFrame(filtered)
  }

  fillna(value: any, columns?: string[]): DataFrame {
    const cols = columns || this._columns
    const newData = this.data.map(row => {
      const newRow = { ...row }
      cols.forEach(col => {
        if (newRow[col] == null || Number.isNaN(newRow[col])) {
          newRow[col] = value
        }
      })
      return newRow
    })
    return new DataFrame(newData)
  }

  ffill(columns?: string[]): DataFrame {
    const cols = columns || this._columns
    const newData: DataFrameRow[] = []
    const lastValues: Record<string, any> = {}
    
    this.data.forEach(row => {
      const newRow = { ...row }
      cols.forEach(col => {
        if (newRow[col] == null || Number.isNaN(newRow[col])) {
          if (lastValues[col] !== undefined) {
            newRow[col] = lastValues[col]
          }
        } else {
          lastValues[col] = newRow[col]
        }
      })
      newData.push(newRow)
    })
    
    return new DataFrame(newData)
  }

  sortValues(column: string, ascending: boolean = true): DataFrame {
    const sorted = [...this.data].sort((a, b) => {
      const aVal = a[column]
      const bVal = b[column]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return ascending ? comparison : -comparison
    })
    return new DataFrame(sorted)
  }

  resetIndex(): DataFrame {
    return new DataFrame(this.data.map((row, index) => ({ index, ...row })))
  }

  rename(columnMap: Record<string, string>): DataFrame {
    const newData = this.data.map(row => {
      const newRow: DataFrameRow = {}
      Object.keys(row).forEach(key => {
        const newKey = columnMap[key] || key
        newRow[newKey] = row[key]
      })
      return newRow
    })
    return new DataFrame(newData)
  }

  merge(other: DataFrame, on: string, how: 'inner' | 'left' | 'right' | 'outer' = 'inner'): DataFrame {
    const result: DataFrameRow[] = []
    
    if (how === 'inner' || how === 'left') {
      this.data.forEach(leftRow => {
        const matches = other.data.filter(rightRow => rightRow[on] === leftRow[on])
        if (matches.length > 0) {
          matches.forEach(rightRow => {
            result.push({ ...leftRow, ...rightRow })
          })
        } else if (how === 'left') {
          result.push({ ...leftRow })
        }
      })
    }
    
    if (how === 'outer') {
      const leftKeys = new Set(this.data.map(row => row[on]))
      const rightKeys = new Set(other.data.map(row => row[on]))
      const allKeys = new Set([...leftKeys, ...rightKeys])
      
      allKeys.forEach(key => {
        const leftRows = this.data.filter(row => row[on] === key)
        const rightRows = other.data.filter(row => row[on] === key)
        
        if (leftRows.length > 0 && rightRows.length > 0) {
          leftRows.forEach(leftRow => {
            rightRows.forEach(rightRow => {
              result.push({ ...leftRow, ...rightRow })
            })
          })
        } else if (leftRows.length > 0) {
          leftRows.forEach(leftRow => result.push({ ...leftRow }))
        } else {
          rightRows.forEach(rightRow => result.push({ ...rightRow }))
        }
      })
    }
    
    return new DataFrame(result)
  }

  pctChange(column?: string): number[] {
    if (column) {
      const values = this.data.map(row => row[column])
      return values.map((val, i) => {
        if (i === 0) return NaN
        const prev = values[i - 1]
        if (prev == null || prev === 0) return NaN
        return (val - prev) / prev
      })
    }
    return []
  }

  rolling(window: number, minPeriods: number = 1) {
    return {
      mean: (column: string): number[] => {
        return this.data.map((_, index) => {
          const start = Math.max(0, index - window + 1)
          const slice = this.data.slice(start, index + 1)
          if (slice.length < minPeriods) return NaN
          const values = slice.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
          if (values.length === 0) return NaN
          return values.reduce((sum, v) => sum + v, 0) / values.length
        })
      },
      std: (column: string): number[] => {
        return this.data.map((_, index) => {
          const start = Math.max(0, index - window + 1)
          const slice = this.data.slice(start, index + 1)
          if (slice.length < minPeriods) return NaN
          const values = slice.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
          if (values.length === 0) return NaN
          const mean = values.reduce((sum, v) => sum + v, 0) / values.length
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
          return Math.sqrt(variance)
        })
      },
      sum: (column: string): number[] => {
        return this.data.map((_, index) => {
          const start = Math.max(0, index - window + 1)
          const slice = this.data.slice(start, index + 1)
          if (slice.length < minPeriods) return NaN
          const values = slice.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
          return values.reduce((sum, v) => sum + v, 0)
        })
      }
    }
  }

  toArray(): DataFrameRow[] {
    return [...this.data]
  }

  toDict(): Record<string, any[]> {
    const result: Record<string, any[]> = {}
    this._columns.forEach(col => {
      result[col] = this.data.map(row => row[col])
    })
    return result
  }

  copy(): DataFrame {
    return new DataFrame(this.data.map(row => ({ ...row })))
  }

  map(fn: (row: DataFrameRow, index: number) => DataFrameRow): DataFrame {
    return new DataFrame(this.data.map(fn))
  }

  filter(fn: (row: DataFrameRow, index: number) => boolean): DataFrame {
    return new DataFrame(this.data.filter(fn))
  }

  forEach(fn: (row: DataFrameRow, index: number) => void): void {
    this.data.forEach(fn)
  }

  apply(column: string, fn: (value: any, row: DataFrameRow, index: number) => any): DataFrame {
    return new DataFrame(this.data.map((row, index) => ({
      ...row,
      [column]: fn(row[column], row, index)
    })))
  }

  cummax(column: string): number[] {
    let max = -Infinity
    return this.data.map(row => {
      const val = row[column]
      if (val != null && !Number.isNaN(val)) {
        max = Math.max(max, val)
      }
      return max
    })
  }

  min(column: string): number {
    const values = this.data.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
    return values.length > 0 ? Math.min(...values) : NaN
  }

  max(column: string): number {
    const values = this.data.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
    return values.length > 0 ? Math.max(...values) : NaN
  }

  mean(column: string): number {
    const values = this.data.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : NaN
  }

  std(column: string): number {
    const values = this.data.map(row => row[column]).filter(v => v != null && !Number.isNaN(v))
    if (values.length === 0) return NaN
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    return Math.sqrt(variance)
  }

  getColumn(column: string): any[] {
    return this.data.map(row => row[column])
  }
}

export function readJSON(jsonData: any): DataFrame {
  if (Array.isArray(jsonData)) {
    return new DataFrame(jsonData)
  }
  if (jsonData.data && Array.isArray(jsonData.data)) {
    return new DataFrame(jsonData.data)
  }
  return new DataFrame(jsonData)
}

export function toDatetime(values: any[], format?: string): Date[] {
  return values.map(v => {
    if (v instanceof Date) return v
    if (typeof v === 'string') return new Date(v)
    if (typeof v === 'number') return new Date(v)
    return new Date(NaN)
  })
}

export function toNumeric(values: any[]): number[] {
  return values.map(v => {
    const num = Number(v)
    return Number.isNaN(num) ? NaN : num
  })
}
