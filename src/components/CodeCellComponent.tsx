import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { CodeCell as CodeCellType, CellMode, Condition, CellComment, CellContract, DesignPreviewResult } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Play, CheckCircle, XCircle, Clock, ArrowRight, Shapes, Function as FunctionIcon, Code as CodeIcon, ChatCircle, NoteBlank, DotsSixVertical, Article, CopySimple, CaretDown, CaretRight, Table } from '@phosphor-icons/react'
import { VisualBuilder } from '@/components/VisualBuilder'
import { DataFieldSelector } from '@/components/DataFieldSelector'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CellComments } from '@/components/CellComments'
import { Input } from '@/components/ui/input'
import { FormulaAutocomplete } from '@/components/FormulaAutocomplete'
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { CellContractEditor } from '@/components/CellContractEditor'
import { CellContractDisplay } from '@/components/CellContractDisplay'
import { DesignPreviewRows } from '@/components/DesignPreviewRows'
import type { OnMount } from '@monaco-editor/react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const MODE_META: Record<CellMode, { label: string; description: string }> = {
  visual: {
    label: 'Visual builder',
    description: 'Build filters and field selections without typing syntax'
  },
  formula: {
    label: 'Formula editor',
    description: 'Compose calculations with autocomplete and AMX functions'
  },
  code: {
    label: 'Strategy code',
    description: 'Use VBA-style strategy steps with basket and control-flow helpers'
  }
}

const PURPOSE_LABELS: Record<CodeCellType['purpose'], string> = {
  universe: 'Universe',
  data: 'Data',
  calculation: 'Calculation',
  condition: 'Condition',
  ranking: 'Ranking',
  portfolio: 'Portfolio',
  risk: 'Risk',
  trade: 'Trade',
  allocation: 'Allocation',
  optimization: 'Optimization',
  constraint: 'Constraint',
  general: 'General'
}

interface CodeCellProps {
  cell: CodeCellType
  onCodeChange: (code: string) => void
  onRun: () => void
  onDelete: () => void
  onDuplicate?: () => void
  onCellChange: (updates: Partial<CodeCellType>) => void
  comments?: CellComment[]
  onAddComment?: (cellId: string, text: string, parentId?: string) => void
  onDeleteComment?: (commentId: string) => void
  onResolveComment?: (commentId: string) => void
  currentUser?: {
    login: string
    avatarUrl: string
  }
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  onActivate?: (mode: CellMode) => void
  isActive?: boolean
  designPreview?: DesignPreviewResult
}

export function CodeCellComponent({ 
  cell, 
  onCodeChange, 
  onRun, 
  onDelete, 
  onDuplicate,
  onCellChange, 
  comments = [],
  onAddComment,
  onDeleteComment,
  onResolveComment,
  currentUser,
  dragHandleProps,
  onActivate,
  isActive = false,
  designPreview
}: CodeCellProps) {
  const [cellLabel, setCellLabel] = useState(cell.label || '')
  const [showContractEditor, setShowContractEditor] = useState(false)
  const [isCodeDropTarget, setIsCodeDropTarget] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  
  const cellComments = comments.filter(c => c.cellId === cell.id)
  const unresolvedComments = cellComments.filter(c => !c.parentId && !c.resolved).length
  const modeMeta = MODE_META[cell.mode]
  const purposeLabel = PURPOSE_LABELS[cell.purpose] ?? cell.purpose
  const codeLineCount = cell.code.trim() ? cell.code.split('\n').length : 0
  const hasOutput = Boolean(cell.output && cell.status !== 'error')

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
      const logic = i > 0 && c.logic ? ` ${c.logic === 'AND' ? 'And' : 'Or'} ` : ''
      const operator = c.operator === '=' ? '=' : c.operator
      const condition = c.operator === 'between'
        ? `${c.field}(cusip) >= ${c.value} And ${c.field}(cusip) <= ${c.value2}`
        : `${c.field}(cusip) ${operator} ${typeof c.value === 'string' ? `"${c.value}"` : c.value}`
      return `${logic}${condition}`
    }).join('')
    
    onCodeChange(`If ${conditionCode} Then\n  Result = "Match"\nEnd If`)
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

  const setActiveMode = (mode: CellMode) => {
    onActivate?.(mode)
  }

  const handleContractChange = (contract: CellContract) => {
    onCellChange({ contract })
  }

  const handleCodeEditorMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun()
    })
  }, [onRun])

  const appendSnippetToCode = useCallback((snippet: string) => {
    onCodeChange(cell.code ? `${cell.code}${cell.code.endsWith('\n') ? '' : '\n'}${snippet}` : snippet)
  }, [cell.code, onCodeChange])

  const insertIntoCodeEditor = useCallback((snippet: string) => {
    const editor = editorRef.current
    if (!editor) {
      appendSnippetToCode(snippet)
      return
    }

    const selection = editor.getSelection()
    if (!selection) {
      appendSnippetToCode(snippet)
      return
    }

    editor.executeEdits('amx-field-drop', [
      {
        range: selection,
        text: snippet,
        forceMoveMarkers: true,
      },
    ])

    const model = editor.getModel()
    if (model) {
      onCodeChange(model.getValue())
    }
    editor.focus()
  }, [appendSnippetToCode, onCodeChange])

  return (
    <section 
      id={`cell-${cell.index}`}
      onClick={() => setActiveMode(cell.mode)}
      onFocusCapture={() => setActiveMode(cell.mode)}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all scroll-mt-6',
        isActive && 'ring-2 ring-accent/35 border-accent/60 shadow-md',
        cell.status === 'error' && 'border-destructive/70',
        cell.status === 'success' && 'border-success/70',
        cell.status === 'running' && 'ring-2 ring-accent'
      )}
    >
      <div className={cn(
        'absolute inset-y-0 left-0 w-1',
        cell.status === 'success' && 'bg-success',
        cell.status === 'error' && 'bg-destructive',
        cell.status === 'running' && 'bg-accent',
        (cell.status === 'idle' || cell.status === 'skipped') && 'bg-border'
      )} />

      <div className="space-y-0 pl-1">
        <div className="border-b bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing flex-shrink-0">
                <DotsSixVertical size={20} weight="bold" className="text-muted-foreground hover:text-foreground transition-colors" />
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="mt-0.5 h-7 w-7 p-0 flex-shrink-0"
                onClick={() => onCellChange({ collapsed: !cell.collapsed })}
                title={cell.collapsed ? 'Expand cell' : 'Collapse cell'}
              >
                {cell.collapsed
                  ? <CaretRight size={15} className="text-muted-foreground" />
                  : <CaretDown size={15} className="text-muted-foreground" />
                }
              </Button>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    CELL {cell.index}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px]">
                    {purposeLabel}
                  </Badge>
                  {getStatusBadge()}
                  {cell.controlFlow && (
                    <Badge variant="outline" className="text-xs">
                      {cell.controlFlow.type === 'goto' 
                        ? `→ cell ${cell.controlFlow.target}`
                        : cell.controlFlow.type
                      }
                    </Badge>
                  )}
                </div>

                {cellLabel ? (
                  <div className="flex max-w-2xl items-center gap-2">
                    <NoteBlank size={15} className="text-accent flex-shrink-0" weight="fill" />
                    <Input
                      value={cellLabel}
                      onChange={(e) => setCellLabel(e.target.value)}
                      onBlur={() => {
                        onCellChange({ label: cellLabel })
                      }}
                      placeholder="Cell label..."
                      className="h-8 min-w-0 border-transparent bg-background/80 text-sm font-medium shadow-none focus-visible:border-ring"
                    />
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setCellLabel('Cell Label')}
                  >
                    <NoteBlank size={14} className="mr-1" />
                    Add Label
                  </Button>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{modeMeta.label}</span>
                  <span className="hidden sm:inline">·</span>
                  <span>{codeLineCount} line{codeLineCount === 1 ? '' : 's'}</span>
                  {cell.executionTime != null && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span>{cell.executionTime.toFixed(2)}ms</span>
                    </>
                  )}
                  {cell.rowCountDelta != null && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span className={cn(
                        cell.rowCountDelta > 0 && 'text-success',
                        cell.rowCountDelta < 0 && 'text-destructive'
                      )}>
                        {cell.rowCountDelta > 0 ? '+' : ''}{cell.rowCountDelta} rows
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-shrink-0">
              <Button
                size="sm"
                variant={cell.contract ? "default" : "outline"}
                onClick={() => setShowContractEditor(!showContractEditor)}
                className="h-8"
              >
                <Article size={16} className="mr-1" weight={cell.contract ? "fill" : "regular"} />
                Contract
              </Button>
              {onAddComment && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      variant={unresolvedComments > 0 ? "default" : "outline"}
                      className={cn(
                        "h-8 relative",
                        unresolvedComments > 0 && "pr-7"
                      )}
                    >
                      <ChatCircle size={16} className="mr-1" weight={unresolvedComments > 0 ? "fill" : "regular"} />
                      {unresolvedComments > 0 ? (
                        <>
                          Notes
                          <Badge 
                            variant="secondary" 
                            className="ml-1.5 h-5 px-1.5 min-w-5 bg-background/50 absolute right-1"
                          >
                            {unresolvedComments}
                          </Badge>
                        </>
                      ) : (
                        'Notes'
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0">
                    <SheetHeader className="p-6 pb-4">
                      <SheetTitle>Cell [{cell.index}] Notes & Comments</SheetTitle>
                    </SheetHeader>
                    <div className="px-6 pb-6">
                      <CellComments
                        cellId={cell.id}
                        comments={comments}
                        onAddComment={(text, parentId) => onAddComment(cell.id, text, parentId)}
                        onDeleteComment={onDeleteComment || (() => {})}
                        onResolveComment={onResolveComment || (() => {})}
                        currentUser={currentUser}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              {onDuplicate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDuplicate}
                  title="Duplicate cell"
                  className="h-8"
                >
                  <CopySimple size={16} />
                </Button>
              )}
              <Button
                size="sm"
                onClick={onRun}
                disabled={cell.status === 'running'}
                className="h-8 min-w-20"
              >
                <Play size={16} className="mr-1" weight="fill" />
                Run
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-8 text-muted-foreground hover:text-destructive"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>

        {cell.collapsed ? null : (
          <div className="space-y-4 p-4">
            {showContractEditor && (
              <div>
                <CellContractEditor
                  contract={cell.contract}
                  onChange={handleContractChange}
                  onClose={() => setShowContractEditor(false)}
                />
              </div>
            )}

            {!showContractEditor && cell.contract && (
              <div>
                <CellContractDisplay
                  contract={cell.contract}
                  validationResult={cell.validationResult}
                  compact={true}
                />
              </div>
            )}

            <Tabs
              value={cell.mode}
              onValueChange={(value) => {
                const nextMode = value as CellMode
                handleModeChange(nextMode)
                setActiveMode(nextMode)
              }}
            >
              <div className="flex flex-col gap-3 rounded-md border bg-background/60 p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{modeMeta.label}</div>
                  <div className="text-xs text-muted-foreground">{modeMeta.description}</div>
                </div>
                <TabsList className="grid w-full grid-cols-3 md:w-[360px]">
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
              </div>

              <TabsContent value="visual" className="space-y-3 mt-3">
                <div className="max-h-[420px] overflow-y-auto rounded-md border bg-background/40">
                  <div className="space-y-4 p-3">
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
                </div>
              </TabsContent>

              <TabsContent value="formula" className="mt-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">AMX functions</Badge>
                    <Badge variant="outline">Autocomplete</Badge>
                    <Badge variant="outline">Cmd/Ctrl+Enter runs</Badge>
                  </div>
                  <FormulaAutocomplete
                     value={cell.code}
                     onChange={onCodeChange}
                     onRun={onRun}
                     onActivate={() => setActiveMode('formula')}
                     placeholder="Enter formula... (e.g., Let current_yield = )"
                     className="min-h-[80px] bg-muted/30"
                     id={`cell-formula-${cell.index}`}
                   />
                   <div className="text-xs text-muted-foreground">
                     Start typing for suggestions, or drag AMX fields here to insert them at the cursor
                   </div>
                 </div>
               </TabsContent>

               <TabsContent value="code" className="mt-3">
                 <div className="space-y-2">
                   <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex flex-wrap items-center gap-2 text-xs">
                       <Badge variant="outline">VBA-style</Badge>
                       <Badge variant="outline">Basket Name:</Badge>
                       <Badge variant="outline">Result = value</Badge>
                       <Badge variant="outline">GoTo 5</Badge>
                     </div>
                     <div className="text-xs text-muted-foreground">
                       Drag fields in or press Cmd/Ctrl+Enter to run
                     </div>
                   </div>
                   <div
                     className={cn(
                       'overflow-hidden rounded-md border border-border bg-slate-950 shadow-inner transition-colors',
                       isCodeDropTarget && 'border-accent ring-2 ring-accent/30'
                     )}
                     onDragOver={(e) => {
                       e.preventDefault()
                       e.dataTransfer.dropEffect = 'copy'
                       setIsCodeDropTarget(true)
                       setActiveMode('code')
                     }}
                     onDragLeave={() => setIsCodeDropTarget(false)}
                     onDrop={(e) => {
                       e.preventDefault()
                       const droppedText = e.dataTransfer.getData('text/plain').trim()
                       setIsCodeDropTarget(false)
                       if (!droppedText) return
                       insertIntoCodeEditor(droppedText)
                     }}
                   >
                     <Suspense fallback={<div role="status" aria-live="polite" className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">Loading code editor…</div>}>
                       <MonacoEditor
                         height="320px"
                        defaultLanguage="vb"
                        path={`${cell.id}.bas`}
                        value={cell.code}
                        onMount={handleCodeEditorMount}
                        onChange={(value) => onCodeChange(value ?? '')}
                        options={{
                          automaticLayout: true,
                          fontFamily: 'Space Mono, monospace',
                          fontLigatures: true,
                          fontSize: 13,
                          lineNumbersMinChars: 3,
                          minimap: { enabled: false },
                          padding: { top: 12, bottom: 12 },
                          quickSuggestions: true,
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          wordWrap: 'on',
                        }}
                        theme="vs-dark"
                      />
                    </Suspense>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {designPreview && (
              <DesignPreviewRows preview={designPreview} />
            )}

            {hasOutput && (
              <div className="overflow-hidden rounded-md border border-success/25 bg-success/5">
                <div className="flex items-center gap-2 border-b border-success/20 px-3 py-2 text-xs font-medium text-success">
                  <CheckCircle size={14} weight="fill" />
                  Output
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap p-3 font-mono text-sm">{cell.output}</pre>
              </div>
            )}

            {cell.sampleOutput && cell.status === 'success' && cell.sampleOutput.startsWith('[') && (
              <div className="overflow-hidden rounded-md border border-accent/25 bg-accent/5">
                <div className="flex items-center gap-1 border-b border-accent/20 px-3 py-2 text-xs font-medium text-accent">
                  <Table size={12} />
                  Sample output
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground max-h-[160px] overflow-auto p-3">
                  {cell.sampleOutput}
                </pre>
              </div>
            )}

            {cell.error && (
              <div className="overflow-hidden rounded-md border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 border-b border-destructive/20 px-3 py-2 text-xs font-medium text-destructive">
                  <XCircle size={14} weight="fill" />
                  Error
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-3 font-mono text-sm text-destructive">
                  {cell.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
