import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Function, Lightbulb } from '@phosphor-icons/react'

interface FormulaSuggestion {
  id: string
  formula: string
  description: string
  category: 'calculation' | 'comparison' | 'yield' | 'risk' | 'common'
  context?: string[]
}

const FORMULA_SUGGESTIONS: FormulaSuggestion[] = [
  {
    id: 'current-yield-1',
    formula: 'annual_coupon / market_price',
    description: 'Current yield calculation',
    category: 'yield',
    context: ['current_yield', 'yield']
  },
  {
    id: 'current-yield-2',
    formula: 'face_value * coupon_rate / clean_price',
    description: 'Current yield from face value',
    category: 'yield',
    context: ['current_yield', 'yield']
  },
  {
    id: 'current-yield-3',
    formula: 'COUPON(cusip) / PRICE(cusip)',
    description: 'Current yield using AMX data',
    category: 'yield',
    context: ['current_yield', 'yield']
  },
  {
    id: 'ytm-calc',
    formula: 'YTM(cusip)',
    description: 'Yield to maturity',
    category: 'yield',
    context: ['ytm', 'yield_to_maturity']
  },
  {
    id: 'spread-calc',
    formula: 'SPREAD_TSY(cusip)',
    description: 'Spread to Treasury',
    category: 'yield',
    context: ['spread']
  },
  {
    id: 'price-comparison',
    formula: 'PRICE(cusip) > threshold',
    description: 'Price above threshold',
    category: 'comparison',
    context: ['price']
  },
  {
    id: 'rating-check',
    formula: 'RATING(cusip) >= "A"',
    description: 'Minimum rating filter',
    category: 'comparison',
    context: ['rating']
  },
  {
    id: 'duration-range',
    formula: 'DURATION(cusip) >= min_duration And DURATION(cusip) <= max_duration',
    description: 'Duration range filter',
    category: 'comparison',
    context: ['duration']
  },
  {
    id: 'total-return',
    formula: '(price_change + coupon_income) / initial_price',
    description: 'Total return calculation',
    category: 'calculation',
    context: ['return', 'total_return']
  },
  {
    id: 'weighted-score',
    formula: 'yield_weight * ytm + duration_weight * duration + spread_weight * spread',
    description: 'Weighted scoring formula',
    category: 'calculation',
    context: ['score', 'weighted']
  },
  {
    id: 'accrued-interest',
    formula: 'face_value * coupon_rate * days_since_payment / days_in_period',
    description: 'Accrued interest calculation',
    category: 'calculation',
    context: ['accrued', 'interest']
  },
  {
    id: 'clean-price',
    formula: 'dirty_price - accrued_interest',
    description: 'Clean price from dirty price',
    category: 'calculation',
    context: ['clean_price', 'price']
  },
  {
    id: 'modified-duration',
    formula: 'macaulay_duration / (1 + ytm / coupon_freq)',
    description: 'Modified duration formula',
    category: 'risk',
    context: ['mod_duration', 'modified_duration']
  },
  {
    id: 'price-change',
    formula: '-mod_duration * yield_change',
    description: 'Estimated price change from yield change',
    category: 'risk',
    context: ['price_change', 'sensitivity']
  },
  {
    id: 'conditional-next',
    formula: 'If condition Then\n  Next\nEnd If',
    description: 'Skip to next cell if condition true',
    category: 'common',
    context: ['if', 'next', 'condition']
  },
  {
    id: 'conditional-goto',
    formula: 'If condition Then\n  GoTo cell_index\nEnd If',
    description: 'Jump to cell if condition true',
    category: 'common',
    context: ['if', 'goto']
  },
  {
    id: 'assign-result',
    formula: 'Result = calculated_value',
    description: 'Set cell output',
    category: 'common',
    context: ['result', 'output']
  },
  {
    id: 'basket-core',
    formula: `basket IG_Core:\n  cusips:\n    US037833DK62\n    US594918BW44\n  weights:\n    US037833DK62: 0.55\n    US594918BW44: 0.45\n  tags: investment_grade, core`,
    description: 'Create a weighted basket with multiple CUSIPs',
    category: 'common',
    context: ['basket', 'cusip', 'portfolio', 'core']
  },
  {
    id: 'basket-weighted-yield',
    formula: `Let avg_yield = IG_Core.weightedAvg("YIELD")\nResult = avg_yield`,
    description: 'Calculate weighted average yield for a basket',
    category: 'yield',
    context: ['basket', 'weighted', 'yield']
  }
]

interface FormulaAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  onActivate?: () => void
}

export function FormulaAutocomplete({
  value,
  onChange,
  onRun,
  placeholder = 'Enter formula...',
  className,
  disabled = false,
  id,
  onActivate
}: FormulaAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const getCurrentContext = (text: string, position: number): string => {
    const beforeCursor = text.substring(0, position)
    const lines = beforeCursor.split('\n')
    const currentLine = lines[lines.length - 1]
    
    const assignmentMatch = currentLine.match(/(\w+)\s*=\s*$/)
    if (assignmentMatch) {
      return assignmentMatch[1].toLowerCase()
    }
    
    const wordMatch = currentLine.match(/\b(\w+)$/)
    if (wordMatch) {
      return wordMatch[1].toLowerCase()
    }
    
    return ''
  }

  const getRelevantSuggestions = (): FormulaSuggestion[] => {
    const context = getCurrentContext(value, cursorPosition)
    
    if (!context || context.length < 2) {
      return []
    }

    const suggestions = FORMULA_SUGGESTIONS.filter(suggestion => {
      if (suggestion.context) {
        return suggestion.context.some(ctx => 
          ctx.toLowerCase().includes(context.toLowerCase()) ||
          context.toLowerCase().includes(ctx.toLowerCase())
        )
      }
      return suggestion.formula.toLowerCase().includes(context.toLowerCase()) ||
             suggestion.description.toLowerCase().includes(context.toLowerCase())
    })

    return suggestions.slice(0, 6)
  }

  const relevantSuggestions = getRelevantSuggestions()

  const commitInsertion = (nextValue: string, nextPosition: number) => {
    onChange(nextValue)
    setCursorPosition(nextPosition)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(nextPosition, nextPosition)
      }
    }, 0)
  }

  useEffect(() => {
    if (relevantSuggestions.length > 0) {
      setShowSuggestions(true)
      setSelectedIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }, [value, cursorPosition])

  const insertSuggestion = (suggestion: FormulaSuggestion) => {
    if (!textareaRef.current) return

    const beforeCursor = value.substring(0, cursorPosition)
    const afterCursor = value.substring(cursorPosition)
    
    const lines = beforeCursor.split('\n')
    const currentLine = lines[lines.length - 1]
    
    const assignmentMatch = currentLine.match(/(\w+)\s*=\s*$/)
    
    let newValue: string
    let newPosition: number
    
    if (assignmentMatch) {
      const beforeAssignment = lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : '')
      newValue = beforeAssignment + assignmentMatch[0] + suggestion.formula + afterCursor
      newPosition = (beforeAssignment + assignmentMatch[0] + suggestion.formula).length
    } else {
      const wordMatch = currentLine.match(/\b\w+$/)
      if (wordMatch) {
        const beforeWord = beforeCursor.substring(0, beforeCursor.length - wordMatch[0].length)
        newValue = beforeWord + suggestion.formula + afterCursor
        newPosition = (beforeWord + suggestion.formula).length
      } else {
        newValue = beforeCursor + suggestion.formula + afterCursor
        newPosition = cursorPosition + suggestion.formula.length
      }
    }
    
    commitInsertion(newValue, newPosition)
    setShowSuggestions(false)
  }

  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) {
      onChange(`${value}${text}`)
      return
    }

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = textarea.value
    const nextValue = `${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`
    const nextPosition = start + text.length

    commitInsertion(nextValue, nextPosition)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || relevantSuggestions.length === 0) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onRun) {
        e.preventDefault()
        onRun()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev < relevantSuggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : relevantSuggestions.length - 1
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertSuggestion(relevantSuggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowSuggestions(false)
    }
  }

  const handleCursorChange = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const droppedText = e.dataTransfer.getData('text/plain').trim()
    setIsDragOver(false)

    if (!droppedText) return

    onActivate?.()
    insertAtCursor(droppedText)
  }

  const getCategoryColor = (category: FormulaSuggestion['category']) => {
    switch (category) {
      case 'yield': return 'bg-green-500/10 text-green-700 border-green-200'
      case 'risk': return 'bg-orange-500/10 text-orange-700 border-orange-200'
      case 'calculation': return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'comparison': return 'bg-purple-500/10 text-purple-700 border-purple-200'
      case 'common': return 'bg-gray-500/10 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        data-insertion-surface="formula"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onActivate}
        onKeyDown={handleKeyDown}
        onKeyUp={handleCursorChange}
        onClick={handleCursorChange}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setIsDragOver(true)
          onActivate?.()
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        placeholder={placeholder}
        className={cn(
          'font-mono text-sm resize-none transition-colors',
          isDragOver && 'border-accent bg-accent/5 ring-2 ring-accent/30',
          className
        )}
        disabled={disabled}
        rows={4}
      />
      
      {showSuggestions && relevantSuggestions.length > 0 && (
        <Card 
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full max-w-2xl p-0 border-2 border-accent/20 shadow-lg"
        >
          <div className="p-2 bg-accent/5 border-b border-border flex items-center gap-2">
            <Lightbulb size={14} weight="fill" className="text-accent" />
            <span className="text-xs font-medium text-muted-foreground">
              Formula suggestions
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              ↑↓ navigate • Enter/Tab select • Esc dismiss
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {relevantSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                className={cn(
                  'w-full text-left p-3 transition-colors border-b border-border last:border-0',
                  index === selectedIndex 
                    ? 'bg-accent/10 border-l-4 border-l-accent' 
                    : 'hover:bg-muted/50 border-l-4 border-l-transparent'
                )}
                onClick={() => insertSuggestion(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Function size={14} className="text-accent mt-0.5 flex-shrink-0" />
                    <code className="font-mono text-xs text-foreground flex-1 whitespace-pre-wrap">
                      {suggestion.formula}
                    </code>
                    <Badge 
                      variant="outline" 
                      className={cn('text-[10px] px-1.5 py-0 h-5', getCategoryColor(suggestion.category))}
                    >
                      {suggestion.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    {suggestion.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
