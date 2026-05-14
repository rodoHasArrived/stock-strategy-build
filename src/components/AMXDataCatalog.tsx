import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MagnifyingGlass, CurrencyDollar, ChartLine, CreditCard, TrendUp, DotsSixVertical, CaretDown, CaretRight, Code } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface AMXDataField {
  id: string
  name: string
  function: string
  category: 'identity' | 'market' | 'fixed-income' | 'fundamental' | 'risk'
  type: 'number' | 'text' | 'date' | 'percentage'
  description: string
  example: string
  frequency: 'real-time' | 'daily' | 'static'
  fallback?: string
  lineage?: string
  samplePayload?: Record<string, unknown>
}

const AMX_FIELDS: AMXDataField[] = [
  {
    id: 'cusip',
    name: 'CUSIP',
    function: 'CUSIP',
    category: 'identity',
    type: 'text',
    description: 'Committee on Uniform Securities Identification Procedures identifier',
    example: '912828YK0',
    frequency: 'static'
  },
  {
    id: 'ticker',
    name: 'Ticker',
    function: 'TICKER',
    category: 'identity',
    type: 'text',
    description: 'Trading symbol',
    example: 'AAPL',
    frequency: 'static'
  },
  {
    id: 'issuer',
    name: 'Issuer',
    function: 'ISSUER',
    category: 'identity',
    type: 'text',
    description: 'Security issuing entity',
    example: 'Apple Inc.',
    frequency: 'static'
  },
  {
    id: 'sector',
    name: 'Sector',
    function: 'SECTOR',
    category: 'identity',
    type: 'text',
    description: 'Industry sector classification',
    example: 'Technology',
    frequency: 'static'
  },
  {
    id: 'price',
    name: 'Last Price',
    function: 'PRICE',
    category: 'market',
    type: 'number',
    description: 'Most recent trading price',
    example: '175.43',
    frequency: 'real-time',
    fallback: 'CLEAN_PRICE if unavailable',
    lineage: 'AMX Market Feed → Pricing Engine → PRICE',
    samplePayload: {
      cusip: '912828YK0',
      timestamp: '2025-05-14T15:45:00Z',
      value: 175.43,
      source: 'AMX_REALTIME',
      currency: 'USD',
      staleness_seconds: 1
    }
  },
  {
    id: 'clean_price',
    name: 'Clean Price',
    function: 'CLEAN_PRICE',
    category: 'market',
    type: 'number',
    description: 'Bond price excluding accrued interest',
    example: '98.75',
    frequency: 'real-time',
    fallback: 'Last known clean price (T-1)',
    lineage: 'AMX Bond Pricing → CLEAN_PRICE',
    samplePayload: {
      cusip: '912828YK0',
      timestamp: '2025-05-14T15:45:00Z',
      clean_price: 98.75,
      accrued_interest: 0.57,
      dirty_price: 99.32,
      settlement_date: '2025-05-16'
    }
  },
  {
    id: 'dirty_price',
    name: 'Dirty Price',
    function: 'DIRTY_PRICE',
    category: 'market',
    type: 'number',
    description: 'Bond price including accrued interest',
    example: '99.32',
    frequency: 'real-time'
  },
  {
    id: 'bid',
    name: 'Bid Price',
    function: 'BID',
    category: 'market',
    type: 'number',
    description: 'Current bid price',
    example: '98.50',
    frequency: 'real-time'
  },
  {
    id: 'ask',
    name: 'Ask Price',
    function: 'ASK',
    category: 'market',
    type: 'number',
    description: 'Current ask price',
    example: '98.75',
    frequency: 'real-time'
  },
  {
    id: 'spread',
    name: 'Bid-Ask Spread',
    function: 'SPREAD',
    category: 'market',
    type: 'number',
    description: 'Difference between bid and ask',
    example: '0.25',
    frequency: 'real-time'
  },
  {
    id: 'volume',
    name: 'Volume',
    function: 'VOLUME',
    category: 'market',
    type: 'number',
    description: 'Trading volume',
    example: '1250000',
    frequency: 'real-time'
  },
  {
    id: 'coupon_rate',
    name: 'Coupon Rate',
    function: 'COUPON',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Annual interest rate paid by bond',
    example: '5.25%',
    frequency: 'static'
  },
  {
    id: 'coupon_frequency',
    name: 'Coupon Frequency',
    function: 'COUPON_FREQ',
    category: 'fixed-income',
    type: 'text',
    description: 'Payment frequency (Annual, Semiannual, Quarterly)',
    example: 'Semiannual',
    frequency: 'static'
  },
  {
    id: 'maturity',
    name: 'Maturity Date',
    function: 'MATURITY',
    category: 'fixed-income',
    type: 'date',
    description: 'Date when principal is repaid',
    example: '2030-05-15',
    frequency: 'static'
  },
  {
    id: 'face_value',
    name: 'Face Value',
    function: 'FACE_VALUE',
    category: 'fixed-income',
    type: 'number',
    description: 'Par value of bond',
    example: '1000',
    frequency: 'static'
  },
  {
    id: 'call_date',
    name: 'Call Date',
    function: 'CALL_DATE',
    category: 'fixed-income',
    type: 'date',
    description: 'Earliest date issuer can redeem bond',
    example: '2027-05-15',
    frequency: 'static'
  },
  {
    id: 'call_price',
    name: 'Call Price',
    function: 'CALL_PRICE',
    category: 'fixed-income',
    type: 'number',
    description: 'Price at which bond can be called',
    example: '102.50',
    frequency: 'static'
  },
  {
    id: 'ytm',
    name: 'Yield to Maturity',
    function: 'YTM',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Total return if held to maturity',
    example: '5.61%',
    frequency: 'real-time',
    fallback: 'Approximation via coupon + spread',
    lineage: 'AMX Analytics → Newton-Raphson solver → YTM',
    samplePayload: {
      cusip: '912828YK0',
      ytm: 0.0561,
      calculation_date: '2025-05-14',
      settlement_date: '2025-05-16',
      price_used: 98.75,
      face_value: 1000,
      coupon_rate: 0.0525,
      maturity: '2030-05-15',
      day_count: 'ACT/ACT',
      compounding: 'semiannual'
    }
  },
  {
    id: 'ytc',
    name: 'Yield to Call',
    function: 'YTC',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Yield if called at earliest call date',
    example: '5.12%',
    frequency: 'real-time',
    fallback: 'null if no call schedule',
    lineage: 'AMX Analytics → Call Schedule → YTC'
  },
  {
    id: 'ytw',
    name: 'Yield to Worst',
    function: 'YTW',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Lowest potential yield considering all call dates',
    example: '5.12%',
    frequency: 'real-time',
    fallback: 'YTM if no call schedule exists',
    lineage: 'AMX Analytics → min(YTM, YTC) → YTW'
  },
  {
    id: 'current_yield',
    name: 'Current Yield',
    function: 'CURRENT_YIELD',
    category: 'fixed-income',
    type: 'percentage',
    description: 'Annual coupon divided by current price',
    example: '5.32%',
    frequency: 'real-time',
    fallback: 'Calculated from COUPON / PRICE',
    lineage: 'AMX Analytics → coupon / market_price → CURRENT_YIELD'
  },
  {
    id: 'duration',
    name: 'Duration',
    function: 'DURATION',
    category: 'risk',
    type: 'number',
    description: 'Macaulay duration in years',
    example: '4.25',
    frequency: 'daily'
  },
  {
    id: 'mod_duration',
    name: 'Modified Duration',
    function: 'MOD_DURATION',
    category: 'risk',
    type: 'number',
    description: 'Price sensitivity to yield changes',
    example: '4.11',
    frequency: 'daily'
  },
  {
    id: 'convexity',
    name: 'Convexity',
    function: 'CONVEXITY',
    category: 'risk',
    type: 'number',
    description: 'Curvature of price-yield relationship',
    example: '18.45',
    frequency: 'daily'
  },
  {
    id: 'rating',
    name: 'Credit Rating',
    function: 'RATING',
    category: 'risk',
    type: 'text',
    description: 'Credit quality rating',
    example: 'AA-',
    frequency: 'daily',
    fallback: 'NR (not rated) if unavailable',
    lineage: 'Moody\'s / S&P / Fitch → AMX Rating Service → RATING',
    samplePayload: {
      cusip: '912828YK0',
      moodys: 'Aaa',
      sp: 'AA+',
      fitch: 'AA',
      composite: 'AA+',
      outlook: 'stable',
      last_action: 'affirmed',
      action_date: '2025-01-15'
    }
  },
  {
    id: 'spread_to_treasury',
    name: 'Spread to Treasury',
    function: 'SPREAD_TSY',
    category: 'risk',
    type: 'number',
    description: 'Yield spread over comparable Treasury',
    example: '125',
    frequency: 'real-time',
    fallback: 'OAS spread if TSY spread unavailable',
    lineage: 'AMX Market Feed → Treasury Curve → SPREAD_TSY',
    samplePayload: {
      cusip: '912828YK0',
      spread_bps: 125,
      benchmark_cusip: '91282CGT0',
      benchmark_tenor: '5Y',
      benchmark_yield: 0.0436,
      bond_yield: 0.0561,
      timestamp: '2025-05-14T15:45:00Z'
    }
  },
  {
    id: 'eps',
    name: 'Earnings Per Share',
    function: 'EPS',
    category: 'fundamental',
    type: 'number',
    description: 'Earnings divided by shares outstanding',
    example: '6.15',
    frequency: 'daily'
  },
  {
    id: 'revenue',
    name: 'Revenue',
    function: 'REVENUE',
    category: 'fundamental',
    type: 'number',
    description: 'Total revenue',
    example: '394328000000',
    frequency: 'daily'
  },
  {
    id: 'pe_ratio',
    name: 'P/E Ratio',
    function: 'PE_RATIO',
    category: 'fundamental',
    type: 'number',
    description: 'Price to earnings ratio',
    example: '28.5',
    frequency: 'real-time'
  },
  {
    id: 'debt_to_ebitda',
    name: 'Debt to EBITDA',
    function: 'DEBT_EBITDA',
    category: 'fundamental',
    type: 'number',
    description: 'Total debt divided by EBITDA',
    example: '2.35',
    frequency: 'daily'
  }
]

const CATEGORIES = [
  { id: 'all', label: 'All Fields', icon: MagnifyingGlass },
  { id: 'identity', label: 'Identity', icon: CreditCard },
  { id: 'market', label: 'Market Data', icon: ChartLine },
  { id: 'fixed-income', label: 'Fixed Income', icon: CurrencyDollar },
  { id: 'fundamental', label: 'Fundamentals', icon: TrendUp },
  { id: 'risk', label: 'Risk & Analytics', icon: ChartLine }
] as const

interface AMXDataCatalogProps {
  onFieldSelect?: (field: AMXDataField) => void
  selectedFields?: string[]
}

export function AMXDataCatalog({ onFieldSelect, selectedFields = [] }: AMXDataCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [expandedPayloads, setExpandedPayloads] = useState<Set<string>>(new Set())

  const togglePayload = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedPayloads(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredFields = AMX_FIELDS.filter(field => {
    const matchesSearch = searchQuery === '' || 
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.function.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = activeCategory === 'all' || field.category === activeCategory
    
    return matchesSearch && matchesCategory
  })

  const getTypeColor = (type: AMXDataField['type']) => {
    switch (type) {
      case 'number': return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'percentage': return 'bg-purple-500/10 text-purple-700 border-purple-200'
      case 'text': return 'bg-gray-500/10 text-gray-700 border-gray-200'
      case 'date': return 'bg-orange-500/10 text-orange-700 border-orange-200'
    }
  }

  const getFrequencyBadge = (frequency: AMXDataField['frequency']) => {
    switch (frequency) {
      case 'real-time': return 'bg-success/10 text-success border-success/20'
      case 'daily': return 'bg-warning/10 text-warning border-warning/20'
      case 'static': return 'bg-muted text-muted-foreground border-border'
    }
  }

  const handleDragStart = (e: React.DragEvent, field: AMXDataField) => {
    e.dataTransfer.setData('text/plain', `${field.function}(cusip)`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Search AMX data fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs gap-1">
                <Icon size={14} />
                <span className="hidden lg:inline">{cat.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <div className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 pr-4">
              {filteredFields.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No fields match your search
                </div>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = selectedFields.includes(field.function)
                  return (
                    <Card
                      key={field.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field)}
                      className={cn(
                        'p-3 cursor-grab active:cursor-grabbing transition-all hover:border-accent',
                        isSelected && 'ring-2 ring-accent border-accent bg-accent/5'
                      )}
                      onClick={() => onFieldSelect?.(field)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <DotsSixVertical size={12} className="text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm">{field.name}</span>
                              <Badge 
                                variant="outline" 
                                className={cn('text-xs px-1.5 py-0', getTypeColor(field.type))}
                              >
                                {field.type}
                              </Badge>
                            </div>
                            <code className="text-xs font-mono text-accent">
                              {field.function}(cusip)
                            </code>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn('text-xs whitespace-nowrap', getFrequencyBadge(field.frequency))}
                          >
                            {field.frequency}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          {field.description}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Example:</span>
                          <code className="font-mono text-foreground">{field.example}</code>
                        </div>

                        {field.fallback && (
                          <div className="flex items-start gap-2 text-xs pt-1 border-t border-border/50">
                            <span className="text-muted-foreground shrink-0">Fallback:</span>
                            <span className="text-foreground/80">{field.fallback}</span>
                          </div>
                        )}

                        {field.lineage && (
                          <div className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Lineage:</span>
                            <code className="font-mono text-foreground/70 text-[10px] leading-4">{field.lineage}</code>
                          </div>
                        )}

                        {field.samplePayload && (
                          <div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                              onClick={(e) => togglePayload(field.id, e)}
                            >
                              {expandedPayloads.has(field.id) ? <CaretDown size={10} /> : <CaretRight size={10} />}
                              <Code size={10} />
                              Sample payload
                            </Button>
                            {expandedPayloads.has(field.id) && (
                              <pre className="mt-1.5 text-[10px] font-mono bg-muted/50 rounded p-2 overflow-x-auto text-foreground/80 leading-relaxed border border-border/50">
                                {JSON.stringify(field.samplePayload, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}

                        <div className="text-[10px] text-muted-foreground/60 italic">
                          Drag to insert into formula
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  )
}
