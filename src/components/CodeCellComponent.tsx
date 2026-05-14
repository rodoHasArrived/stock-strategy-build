import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { CodeCell as CodeCellType, CellMode, Condition, CellComment, CellContract } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Play, CheckCircle, XCircle, Clock, ArrowRight, Shapes, Function as FunctionIcon, Code as CodeIcon, ChatCircle, NoteBlank, DotsSixVertical, Article, CopySimple, CaretDown, CaretRight, Rows, Table } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { VisualBuilder } from '@/components/VisualBuilder'
import { DataFieldSelector } from '@/components/DataFieldSelector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CellComments } from '@/components/CellComments'
import { Input } from '@/components/ui/input'
import { FormulaAutocomplete } from '@/components/FormulaAutocomplete'
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { CellContractEditor } from '@/components/CellContractEditor'
import { CellContractDisplay } from '@/components/CellContractDisplay'
import type { OnMount } from '@monaco-editor/react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

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
  isActive = false
}: CodeCellProps) {
  const [cellLabel, setCellLabel] = useState(cell.label || '')
  const [showContractEditor, setShowContractEditor] = useState(false)
  const [isCodeDropTarget, setIsCodeDropTarget] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  
  const cellComments = comments.filter(c => c.cellId === cell.id)
  const unresolvedComments = cellComments.filter(c => !c.parentId && !c.resolved).length

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
    <Card 
      id={`cell-${cell.index}`}
      onClick={() => setActiveMode(cell.mode)}
      onFocusCapture={() => setActiveMode(cell.mode)}
      className={cn(
        'p-4 transition-all scroll-mt-6',
        isActive && 'ring-2 ring-accent/35 border-accent/60',
        cell.status === 'error' && 'border-destructive',
        cell.status === 'success' && 'border-success',
        cell.status === 'running' && 'ring-2 ring-accent'
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0">
              <DotsSixVertical size={20} weight="bold" className="text-muted-foreground hover:text-foreground transition-colors" />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 flex-shrink-0"
              onClick={() => onCellChange({ collapsed: !cell.collapsed })}
              title={cell.collapsed ? 'Expand cell' : 'Collapse cell'}
            >
              {cell.collapsed
                ? <CaretRight size={14} className="text-muted-foreground" />
                : <CaretDown size={14} className="text-muted-foreground" />
              }
            </Button>
            <span className="text-sm font-mono font-medium text-muted-foreground flex-shrink-0">
              [{cell.index}]
            </span>
            
            {cellLabel ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <NoteBlank size={14} className="text-accent flex-shrink-0" weight="fill" />
                <Input
                  value={cellLabel}
                  onChange={(e) => setCellLabel(e.target.value)}
                  onBlur={() => {
                    onCellChange({ label: cellLabel })
                  }}
                  placeholder="Cell label..."
                  className="h-7 text-sm font-medium max-w-xs"
                />
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCellLabel('Cell Label')}
              >
                <NoteBlank size={14} className="mr-1" />
                Add Label
              </Button>
            )}
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge()}
              {cell.executionTime != null && (
                <span className="text-xs text-muted-foreground">
                  {cell.executionTime.toFixed(2)}ms
                </span>
              )}
              {cell.rowCountDelta != null && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs gap-1',
                    cell.rowCountDelta > 0 && 'text-success border-success/30',
                    cell.rowCountDelta < 0 && 'text-destructive border-destructive/30',
                    cell.rowCountDelta === 0 && 'text-muted-foreground'
                  )}
                >
                  <Rows size={12} />
                  {cell.rowCountDelta > 0 ? '+' : ''}{cell.rowCountDelta} rows
                </Badge>
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
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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

        {cell.collapsed ? null : (
          <>
            {showContractEditor && (
              <div className="mb-3">
                <CellContractEditor
                  contract={cell.contract}
                  onChange={handleContractChange}
                  onClose={() => setShowContractEditor(false)}
                />
              </div>
            )}

            {!showContractEditor && cell.contract && (
              <div className="mb-3">
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
                  <FormulaAutocomplete
                     value={cell.code}
                     onChange={onCodeChange}
                     onRun={onRun}
                     onActivate={() => setActiveMode('formula')}
                     placeholder="Enter formula... (e.g., current_yield = )"
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
                   <div
                     className={cn(
                       'overflow-hidden rounded-md border border-border bg-[#111827] transition-colors',
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
                        defaultLanguage="python"
                        path={`${cell.id}.py`}
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
                  <div className="text-xs text-muted-foreground">
                     Code editor with syntax highlighting. Drag fields in or press Cmd/Ctrl+Enter to run.
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {cell.output && cell.status !== 'error' && (
              <div className="border-l-4 border-success pl-3 py-2">
                <div className="text-xs text-muted-foreground mb-1">Output:</div>
                <pre className="font-mono text-sm whitespace-pre-wrap">{cell.output}</pre>
              </div>
            )}

            {cell.sampleOutput && cell.status === 'success' && cell.sampleOutput.startsWith('[') && (
              <div className="border-l-4 border-accent/50 pl-3 py-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Table size={12} />
                  Sample output (first 3 rows):
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground max-h-[120px] overflow-auto">
                  {cell.sampleOutput}
                </pre>
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
          </>
        )}
      </div>
    </Card>
  )
}
