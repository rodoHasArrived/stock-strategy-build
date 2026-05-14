import { memo, useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { CodeCell } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowBendDownRight,
  ArrowRight,
  ArrowUUpLeft,
  CheckCircle,
  Circle,
  Minus,
  PlayCircle,
  XCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface FlowDiagramProps {
  cells: CodeCell[]
  onCellClick?: (index: number) => void
  highlightedCell?: number
}

type FlowEdgeKind = 'sequential' | 'conditional' | 'goto' | 'loop'

interface FlowNodeData extends Record<string, unknown> {
  cell: CodeCell
  isHighlighted: boolean
  onCellClick?: (index: number) => void
}

interface FlowEdgeDefinition {
  from: number
  to: number
  type: FlowEdgeKind
  condition?: string
  label?: string
}

const CELL_HEIGHT = 132
const CELL_WIDTH = 248
const HORIZONTAL_GAP = 140
const VERTICAL_GAP = 56

const EDGE_STYLES: Record<FlowEdgeKind, { color: string; dasharray?: string; sourceHandle: string }> = {
  sequential: { color: 'oklch(0.50 0.02 250)', sourceHandle: 'source-next' },
  conditional: { color: 'oklch(0.60 0.18 245)', dasharray: '5 5', sourceHandle: 'source-branch' },
  goto: { color: 'oklch(0.65 0.2 45)', sourceHandle: 'source-branch' },
  loop: { color: 'oklch(0.7 0.15 300)', dasharray: '6 4', sourceHandle: 'source-loop' },
}

const PURPOSE_COLORS: Record<CodeCell['purpose'], string> = {
  universe: 'bg-chart-1/20 text-chart-1 border-chart-1/40',
  data: 'bg-chart-2/20 text-chart-2 border-chart-2/40',
  calculation: 'bg-chart-3/20 text-chart-3 border-chart-3/40',
  condition: 'bg-chart-4/20 text-chart-4 border-chart-4/40',
  ranking: 'bg-chart-5/20 text-chart-5 border-chart-5/40',
  portfolio: 'bg-accent/20 text-accent border-accent/40',
  risk: 'bg-destructive/15 text-destructive border-destructive/35',
  trade: 'bg-success/15 text-success border-success/35',
  optimization: 'bg-warning/15 text-warning border-warning/35',
  constraint: 'bg-destructive/15 text-destructive border-destructive/35',
  general: 'bg-muted text-muted-foreground border-border',
}

const StrategyFlowNode = memo(({ data }: NodeProps<Node<FlowNodeData>>) => {
  const { cell, isHighlighted, onCellClick } = data

  const statusIcon = (() => {
    switch (cell.status) {
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
  })()

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} id="target-top" className="strategy-flow-handle" />
      <Handle type="source" position={Position.Bottom} id="source-next" className="strategy-flow-handle" />
      <Handle type="source" position={Position.Right} id="source-branch" className="strategy-flow-handle" />
      <Handle type="source" position={Position.Left} id="source-loop" className="strategy-flow-handle" />

      <button
        type="button"
        onClick={() => onCellClick?.(cell.index)}
        className={cn(
          'strategy-flow-node flex h-[132px] w-[248px] flex-col justify-between rounded-xl border bg-card/95 p-4 text-left shadow-[6px_6px_0_0_rgba(10,10,10,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(10,10,10,0.12)]',
          PURPOSE_COLORS[cell.purpose] ?? PURPOSE_COLORS.general,
          isHighlighted && 'ring-2 ring-accent ring-offset-4 ring-offset-background'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
              {cell.index}
            </Badge>
            {statusIcon}
          </div>
          {cell.executionTime != null && (
            <span className="text-[10px] text-muted-foreground">{cell.executionTime.toFixed(1)}ms</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="truncate text-sm font-semibold">{cell.label || `Cell ${cell.index}`}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{cell.purpose}</div>
          <div className="line-clamp-3 font-mono text-[11px] text-muted-foreground/90">
            {cell.code?.trim() || 'No code defined'}
          </div>
        </div>

        {cell.controlFlow && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {cell.controlFlow.type === 'goto' && (
              <>
                <ArrowBendDownRight size={12} />
                <span>goto {cell.controlFlow.target}</span>
              </>
            )}
            {cell.controlFlow.type === 'next' && (
              <>
                <ArrowRight size={12} />
                <span>next</span>
              </>
            )}
            {cell.controlFlow.type === 'loop' && (
              <>
                <ArrowUUpLeft size={12} />
                <span>loop</span>
              </>
            )}
            {cell.controlFlow.type === 'if' && <span>if {cell.controlFlow.condition}</span>}
          </div>
        )}
      </button>
    </div>
  )
})

StrategyFlowNode.displayName = 'StrategyFlowNode'

const nodeTypes = {
  strategyCell: StrategyFlowNode,
}

export function FlowDiagram({ cells, onCellClick, highlightedCell }: FlowDiagramProps) {
  const { nodes, edges, viewportHeight } = useMemo(() => {
    const flowEdges: FlowEdgeDefinition[] = []
    const nodeMap = new Map<number, { x: number; y: number }>()

    cells.forEach((cell, index) => {
      const edge: FlowEdgeDefinition | null = (() => {
        if (cell.controlFlow) {
          if (cell.controlFlow.type === 'goto' && cell.controlFlow.target != null) {
            const target = cell.controlFlow.target
            if (target < index) {
              return {
                from: index,
                to: target,
                type: 'loop',
                label: `goto ${target}`,
              }
            }

            return {
              from: index,
              to: target,
              type: 'goto',
              label: `goto ${target}`,
            }
          }

          if (cell.controlFlow.type === 'next') {
            return {
              from: index,
              to: index + 1,
              type: 'conditional',
              condition: cell.controlFlow.condition,
              label: 'next',
            }
          }

          if (cell.controlFlow.type === 'if') {
            return {
              from: index,
              to: cell.controlFlow.target ?? index + 1,
              type: 'conditional',
              condition: cell.controlFlow.condition,
              label: cell.controlFlow.condition,
            }
          }
        }

        if (index < cells.length - 1) {
          return {
            from: index,
            to: index + 1,
            type: 'sequential',
          }
        }

        return null
      })()

      if (edge && edge.from >= 0 && edge.from < cells.length && edge.to >= 0 && edge.to < cells.length) {
        flowEdges.push(edge)
      }
    })

    const columns: number[][] = []
    const visited = new Set<number>()

    const assignColumn = (cellIndex: number, columnIndex: number) => {
      if (visited.has(cellIndex) || cellIndex >= cells.length || cellIndex < 0) return

      visited.add(cellIndex)
      columns[columnIndex] ??= []
      columns[columnIndex].push(cellIndex)

      const outgoingEdges = flowEdges.filter((edge) => edge.from === cellIndex && edge.type !== 'loop')
      outgoingEdges.forEach((edge) => {
        const nextColumn = edge.type === 'goto' ? columnIndex + 2 : columnIndex + 1
        assignColumn(edge.to, nextColumn)
      })
    }

    assignColumn(0, 0)

    cells.forEach((_, index) => {
      if (!visited.has(index)) {
        assignColumn(index, columns.length)
      }
    })

    columns.forEach((column, columnIndex) => {
      column.forEach((cellIndex, rowIndex) => {
        nodeMap.set(cellIndex, {
          x: columnIndex * (CELL_WIDTH + HORIZONTAL_GAP),
          y: rowIndex * (CELL_HEIGHT + VERTICAL_GAP),
        })
      })
    })

    const flowNodes: Node<FlowNodeData>[] = cells.map((cell, index) => {
      const position = nodeMap.get(index) ?? { x: 0, y: index * (CELL_HEIGHT + VERTICAL_GAP) }
      return {
        id: String(index),
        type: 'strategyCell',
        position,
        data: {
          cell,
          isHighlighted: highlightedCell === index,
          onCellClick,
        },
        draggable: false,
        selectable: true,
      }
    })

    const flowEdgesOutput: Edge[] = flowEdges.map((edge) => {
      const edgeStyle = EDGE_STYLES[edge.type]
      return {
        id: `${edge.from}-${edge.to}-${edge.type}`,
        source: String(edge.from),
        target: String(edge.to),
        sourceHandle: edgeStyle.sourceHandle,
        targetHandle: 'target-top',
        type: edge.type === 'loop' ? 'bezier' : 'smoothstep',
        label: edge.label,
        animated: edge.type !== 'sequential',
        labelStyle: { fill: 'var(--color-muted-foreground)', fontSize: 11, fontWeight: 500 },
        style: {
          stroke: edgeStyle.color,
          strokeDasharray: edgeStyle.dasharray,
          strokeWidth: edge.type === 'goto' ? 2.5 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeStyle.color,
          width: 20,
          height: 20,
        },
      }
    })

    const maxY = flowNodes.reduce((largest, node) => Math.max(largest, node.position.y), 0)

    return {
      nodes: flowNodes,
      edges: flowEdgesOutput,
      viewportHeight: Math.max(560, maxY + CELL_HEIGHT + 180),
    }
  }, [cells, highlightedCell, onCellClick])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Execution Flow</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 bg-foreground/50" />
              <span>Sequential</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-[oklch(0.60_0.18_245)]" />
              <span>Conditional</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-[oklch(0.7_0.15_300)]" />
              <span>Loop</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full" style={{ height: viewportHeight }}>
          <ReactFlow
            fitView
            minZoom={0.35}
            maxZoom={1.4}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            fitViewOptions={{ padding: 0.18 }}
            proOptions={{ hideAttribution: true }}
            className="bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(248,248,248,0.95))]"
          >
            <MiniMap pannable zoomable className="!bg-card/95 !border !border-border" />
            <Controls showInteractive={false} />
            <Background gap={18} size={1.2} color="rgba(15, 23, 42, 0.08)" />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  )
}
