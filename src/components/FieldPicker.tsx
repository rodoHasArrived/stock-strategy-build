import { useState, useRef, useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaretDown, Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface FieldOption {
  id: string
  name: string
  function: string
  category: 'identity' | 'market' | 'fixed-income' | 'fundamental' | 'risk'
  type: 'number' | 'text' | 'date' | 'percentage'
  description: string
  example: string
}

const FIELD_OPTIONS: FieldOption[] = [
  {
    id: 'cusip',
    name: 'CUSIP',
    function: 'CUSIP',
    category: 'identity',
    type: 'text',
    description: 'Security identifier',
    example: '912828YK0'
  },
  {
    id: 'ticker',
    name: 'Ticker',
    function: 'TICKER',
    category: 'identity',
    type: 'text',
    description: 'Trading symbol',
    example: 'AAPL'
  },
  {
    id: 'issuer',
    name: 'Issuer',
    function: 'ISSUER',
    category: 'identity',
    type: 'text',
    description: 'Issuing entity',
    example: 'Apple Inc.'
  },
  {
    id: 'sector',
    name: 'Sector',
    function: 'SECTOR',
    category: 'identity',
    type: 'text',
    description: 'Industry sector',
    example: 'Technology'
  },
  {
    id: 'price',
    name: 'Last Price',
    function: 'PRICE',
    category: 'market',
    type: 'number',
    description: 'Most recent trading price',
    example: '175.43'
  },
  {
    id: 'clean_price',
    name: 'Clean Price',
    function: 'CLEAN_PRICE',
    category: 'market',
    type: 'number',
    description: 'Price excluding accrued interest',
    example: '98.75'
  },
  {
    id: 'bid',
    name: 'Bid Price',
    function: 'BID',
    category: 'market',
    type: 'number',
    description: 'Current bid',
    example: '98.50'
  },
  {
    id: 'ask',
    name: 'Ask Price',
    function: 'ASK',
    category: 'market',
    type: 'number',
    description: 'Current ask',
    example: '98.75'
  },
  {
    id: 'coupon_rate',
    name: 'Coupon Rate',
    function: 'COUPON',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Annual interest rate',
    example: '5.25%'
  },
  {
    id: 'coupon_frequency',
    name: 'Coupon Frequency',
    function: 'COUPON_FREQ',
    category: 'fixed-income',
    type: 'text',
    description: 'Payment frequency',
    example: 'Semiannual'
  },
  {
    id: 'next_coupon_date',
    name: 'Next Coupon Date',
    function: 'NEXT_COUPON',
    category: 'fixed-income',
    type: 'date',
    description: 'Next payment date',
    example: '2024-06-15'
  },
  {
    id: 'accrued_interest',
    name: 'Accrued Interest',
    function: 'ACCRUED_INT',
    category: 'fixed-income',
    type: 'number',
    description: 'Interest accumulated since last payment',
    example: '0.57'
  },
  {
    id: 'maturity',
    name: 'Maturity Date',
    function: 'MATURITY',
    category: 'fixed-income',
    type: 'date',
    description: 'Principal repayment date',
    example: '2030-05-15'
  },
  {
    id: 'face_value',
    name: 'Face Value',
    function: 'FACE_VALUE',
    category: 'fixed-income',
    type: 'number',
    description: 'Par value',
    example: '1000'
  },
  {
    id: 'ytm',
    name: 'Yield to Maturity',
    function: 'YTM',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Return if held to maturity',
    example: '5.61%'
  },
  {
    id: 'current_yield',
    name: 'Current Yield',
    function: 'CURRENT_YIELD',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Annual coupon / current price',
    example: '5.32%'
  },
  {
    id: 'duration',
    name: 'Duration',
    function: 'DURATION',
    category: 'risk',
    type: 'number',
    description: 'Macaulay duration',
    example: '4.25'
  },
  {
    id: 'mod_duration',
    name: 'Modified Duration',
    function: 'MOD_DURATION',
    category: 'risk',
    type: 'number',
    description: 'Price sensitivity',
    example: '4.11'
  },
  {
    id: 'rating',
    name: 'Credit Rating',
    function: 'RATING',
    category: 'risk',
    type: 'text',
    description: 'Credit quality',
    example: 'AA-'
  },
  {
    id: 'spread_to_treasury',
    name: 'Spread to Treasury',
    function: 'SPREAD_TSY',
    category: 'risk',
    type: 'number',
    description: 'Yield spread over Treasury',
    example: '125'
  },
  {
    id: 'market_price',
    name: 'Market Price',
    function: 'MARKET_PRICE',
    category: 'market',
    type: 'number',
    description: 'Current market price',
    example: '99.50'
  },
  {
    id: 'annual_coupon',
    name: 'Annual Coupon',
    function: 'ANNUAL_COUPON',
    category: 'fixed-income',
    type: 'number',
    description: 'Total annual coupon payment',
    example: '52.50'
  }
]

interface FieldPickerProps {
  value?: string
  onSelect: (field: FieldOption) => void
  placeholder?: string
  className?: string
  triggerClassName?: string
}

export function FieldPicker({ 
  value, 
  onSelect, 
  placeholder = 'Select field...', 
  className,
  triggerClassName 
}: FieldPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const selectedField = FIELD_OPTIONS.find(f => f.function === value)

  const getTypeColor = (type: FieldOption['type']) => {
    switch (type) {
      case 'number': return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'percentage': return 'bg-purple-500/10 text-purple-700 border-purple-200'
      case 'text': return 'bg-gray-500/10 text-gray-700 border-gray-200'
      case 'date': return 'bg-orange-500/10 text-orange-700 border-orange-200'
    }
  }

  const getCategoryLabel = (category: FieldOption['category']) => {
    switch (category) {
      case 'identity': return 'Identity'
      case 'market': return 'Market'
      case 'fixed-income': return 'Fixed Income'
      case 'fundamental': return 'Fundamental'
      case 'risk': return 'Risk'
    }
  }

  const groupedFields = FIELD_OPTIONS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, FieldOption[]>)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", triggerClassName)}
        >
          <span className="truncate">
            {selectedField ? (
              <span className="flex items-center gap-2">
                <code className="font-mono text-xs">{selectedField.function}</code>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  ({selectedField.name})
                </span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[400px] p-0", className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search fields (e.g., 'coupon')..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            {Object.entries(groupedFields).map(([category, fields]) => {
              const filteredFields = fields.filter(field => {
                const searchLower = search.toLowerCase()
                return (
                  field.name.toLowerCase().includes(searchLower) ||
                  field.function.toLowerCase().includes(searchLower) ||
                  field.description.toLowerCase().includes(searchLower)
                )
              })

              if (filteredFields.length === 0) return null

              return (
                <CommandGroup 
                  key={category} 
                  heading={getCategoryLabel(category as FieldOption['category'])}
                >
                  {filteredFields.map((field) => (
                    <CommandItem
                      key={field.id}
                      value={field.id}
                      onSelect={() => {
                        onSelect(field)
                        setOpen(false)
                        setSearch('')
                      }}
                      className="flex items-start gap-2 py-2"
                    >
                      <Check
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0",
                          value === field.function ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-accent font-medium">
                            {field.function}
                          </code>
                          <Badge 
                            variant="outline" 
                            className={cn('text-[10px] px-1 py-0 h-4', getTypeColor(field.type))}
                          >
                            {field.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {field.description}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { FIELD_OPTIONS }
