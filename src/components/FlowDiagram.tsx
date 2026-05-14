import { useMemo, useState } from 'react'
import { CodeCell } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ArrowRight, 
  ArrowBendDownRight, 
  ArrowUUpLeft,
  CheckCircle,
  XCircle,
  Circle,
  PlayCircle,
  Minus
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface FlowDiagramProps {
  cells: CodeCell[]
  onCellClick?: (index: number) => void
  highlightedCell?: number
}

interface FlowEdge {
  from: number
  to: number
  type: 'sequential' | 'conditional' | 'goto' | 'loop'
  condition?: string
  label?: string
}

interface FlowNode {
  index: number
  cell: CodeCell
  x: number
  y: number
  edges: FlowEdge[]
}

const CELL_HEIGHT = 80
const CELL_WIDTH = 200
const HORIZONTAL_GAP = 100
const VERTICAL_GAP = 40

export function FlowDiagram({ cells, onCellClick, highlightedCell }: FlowDiagramProps) {
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  const { nodes, edges, width, height } = useMemo(() => {
    const flowEdges: FlowEdge[] = []
    const nodeMap = new Map<number, { x: number; y: number; edges: FlowEdge[] }>()

    cells.forEach((cell, index) => {
      const edge: FlowEdge | null = (() => {
        if (cell.controlFlow) {
          if (cell.controlFlow.type === 'goto' && cell.controlFlow.target != null) {
            const target = cell.controlFlow.target
            if (target < index) {
              return {
                from: index,
                to: target,
                type: 'loop',
                label: `goto ${target}`
              }
            } else {
              return {
                from: index,
                to: target,
                type: 'goto',
                label: `goto ${target}`
              }
            }
          } else if (cell.controlFlow.type === 'next') {
            return {
              from: index,
              to: index + 1,
              type: 'conditional',
              condition: cell.controlFlow.condition,
              label: 'next'
            }
          } else if (cell.controlFlow.type === 'if') {
            return {
              from: index,
              to: cell.controlFlow.target ?? index + 1,
              type: 'conditional',
              condition: cell.controlFlow.condition,
              label: cell.controlFlow.condition
            }
          }
        }
        
        if (index < cells.length - 1) {
          return {
            from: index,
            to: index + 1,
            type: 'sequential'
          }
        }
        
        return null
      })()

      if (edge) {
        flowEdges.push(edge)
      }
    })

    const columns: number[][] = []
    const visited = new Set<number>()
    
    const assignColumn = (cellIndex: number, col: number) => {
      if (visited.has(cellIndex) || cellIndex >= cells.length || cellIndex < 0) return
      
      visited.add(cellIndex)
      
      if (!columns[col]) {
        columns[col] = []
      }
      columns[col].push(cellIndex)
      
      const outgoingEdges = flowEdges.filter(e => e.from === cellIndex && e.type !== 'loop')
      outgoingEdges.forEach(edge => {
        const nextCol = edge.type === 'goto' ? col + 2 : col + 1
        assignColumn(edge.to, nextCol)
      })
    }

    assignColumn(0, 0)

    cells.forEach((_, index) => {
      if (!visited.has(index)) {
        assignColumn(index, columns.length)
      }
    })

    columns.forEach((column, colIndex) => {
      column.forEach((cellIndex, rowIndex) => {
        nodeMap.set(cellIndex, {
          x: colIndex * (CELL_WIDTH + HORIZONTAL_GAP),
          y: rowIndex * (CELL_HEIGHT + VERTICAL_GAP),
          edges: flowEdges.filter(e => e.from === cellIndex)
        })
      })
    })

    const flowNodes: FlowNode[] = cells.map((cell, index) => {
      const position = nodeMap.get(index) || { x: 0, y: index * (CELL_HEIGHT + VERTICAL_GAP), edges: [] }
      return {
        index,
        cell,
        x: position.x,
        y: position.y,
        edges: position.edges
      }
    })

    const maxX = Math.max(...flowNodes.map(n => n.x)) + CELL_WIDTH
    const maxY = Math.max(...flowNodes.map(n => n.y)) + CELL_HEIGHT

    return {
      nodes: flowNodes,
      edges: flowEdges,
      width: maxX + 100,
      height: maxY + 100
    }
  }, [cells])

  const getStatusIcon = (status: CodeCell['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle weight="fill" className="text-success" size={16} />
      case 'error':
        return <XCircle weight="fill" className="text-destructive" size={16} />
      case 'running':
        return <PlayCircle weight="fill" className="text-accent animate-pulse" size={16} />
      case 'skipped':
        return <Minus weight="bold" className="text-muted-foreground" size={16} />
      default:
        return <Circle weight="regular" className="text-muted-foreground" size={16} />
    }
  }

  const getPurposeColor = (purpose: CodeCell['purpose']) => {
    const colors: Record<CodeCell['purpose'], string> = {
      universe: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
      data: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
      calculation: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
      condition: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
      ranking: 'bg-chart-5/20 text-chart-5 border-chart-5/30',
      portfolio: 'bg-accent/20 text-accent border-accent/30',
      risk: 'bg-destructive/20 text-destructive border-destructive/30',
      trade: 'bg-success/20 text-success border-success/30',
      general: 'bg-muted text-muted-foreground border-border'
    }
    return colors[purpose] || colors.general
  }

  const renderEdge = (edge: FlowEdge, nodes: FlowNode[]) => {
    const fromNode = nodes.find(n => n.index === edge.from)
    const toNode = nodes.find(n => n.index === edge.to)
    
    if (!fromNode || !toNode) return null

    const startX = fromNode.x + CELL_WIDTH / 2
    const startY = fromNode.y + CELL_HEIGHT
    const endX = toNode.x + CELL_WIDTH / 2
    const endY = toNode.y

    const isLoop = edge.type === 'loop'
    const isConditional = edge.type === 'conditional'
    const isGoto = edge.type === 'goto'

    let pathD: string
    let color: string
    let strokeWidth = 2
    let strokeDasharray = '0'

    if (isLoop) {
      const controlX1 = startX + 80
      const controlY1 = startY + 30
      const controlX2 = endX + 80
      const controlY2 = endY - 30
      
      pathD = `M ${startX} ${startY} 
               C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`
      color = 'oklch(0.7 0.15 300)'
      strokeDasharray = '5,5'
    } else if (isGoto) {
      const midY = (startY + endY) / 2
      pathD = `M ${startX} ${startY} 
               L ${startX} ${midY} 
               L ${endX} ${midY} 
               L ${endX} ${endY}`
      color = 'oklch(0.65 0.2 45)'
      strokeWidth = 2.5
    } else if (isConditional) {
      const midY = (startY + endY) / 2
      pathD = `M ${startX} ${startY} 
               Q ${startX} ${midY} ${endX} ${endY}`
      color = 'oklch(0.60 0.18 245)'
      strokeDasharray = '4,4'
    } else {
      pathD = `M ${startX} ${startY} L ${endX} ${endY}`
      color = 'oklch(0.50 0.02 250)'
    }

    const labelX = (startX + endX) / 2
    const labelY = (startY + endY) / 2

    return (
      <g key={`edge-${edge.from}-${edge.to}`}>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          markerEnd="url(#arrowhead)"
          opacity={0.7}
        />
        {edge.label && (
          <text
            x={labelX}
            y={labelY - 5}
            textAnchor="middle"
            className="text-xs font-mono fill-muted-foreground"
            style={{ fontSize: '10px' }}
          >
            {edge.label}
          </text>
        )}
      </g>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Execution Flow</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-foreground/50" />
              <span>Sequential</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-accent" />
              <span>Conditional</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-[oklch(0.7_0.15_300)]" />
              <span>Loop</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-6" style={{ minWidth: width, minHeight: height }}>
            <svg width={width} height={height} className="absolute top-0 left-0 pointer-events-none">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill="currentColor" opacity="0.7" />
                </marker>
              </defs>
              {edges.map(edge => renderEdge(edge, nodes))}
            </svg>

            {nodes.map(node => (
              <div
                key={node.index}
                className={cn(
                  "absolute transition-all duration-200",
                  hoveredNode === node.index && "z-10 scale-105"
                )}
                style={{
                  left: node.x,
                  top: node.y,
                  width: CELL_WIDTH,
                  height: CELL_HEIGHT
                }}
                onMouseEnter={() => setHoveredNode(node.index)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-full flex flex-col items-start justify-between p-3 hover:shadow-lg transition-shadow",
                    highlightedCell === node.index && "ring-2 ring-accent ring-offset-2",
                    getPurposeColor(node.cell.purpose)
                  )}
                  onClick={() => onCellClick?.(node.index)}
                >
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono px-1.5 py-0">
                        {node.index}
                      </Badge>
                      {getStatusIcon(node.cell.status)}
                    </div>
                    {node.cell.executionTime && (
                      <span className="text-[10px] text-muted-foreground">
                        {node.cell.executionTime.toFixed(1)}ms
                      </span>
                    )}
                  </div>

                  <div className="w-full">
                    <div className="text-xs font-medium truncate text-left">
                      {node.cell.label || `Cell ${node.index}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {node.cell.purpose}
                    </div>
                  </div>

                  {node.cell.controlFlow && (
                    <div className="w-full flex items-center gap-1 text-[10px] mt-1">
                      {node.cell.controlFlow.type === 'goto' && (
                        <>
                          <ArrowBendDownRight size={12} />
                          <span>→ {node.cell.controlFlow.target}</span>
                        </>
                      )}
                      {node.cell.controlFlow.type === 'next' && (
                        <>
                          <ArrowRight size={12} />
                          <span>next</span>
                        </>
                      )}
                      {node.cell.controlFlow.type === 'loop' && (
                        <>
                          <ArrowUUpLeft size={12} />
                          <span>loop</span>
                        </>
                      )}
                    </div>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
