import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChartLine, CurrencyDollar, Star, CalendarBlank, TrendUp } from '@phosphor-icons/react'

interface DataFieldSelectorProps {
  selectedFields: string[]
  onFieldsChange: (fields: string[]) => void
  aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count'
  onAggregationChange?: (agg: 'sum' | 'avg' | 'max' | 'min' | 'count') => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
}

const DATA_FIELDS = [
  { value: 'PRICE', label: 'Price', category: 'Market', icon: CurrencyDollar },
  { value: 'YIELD', label: 'Yield', category: 'Market', icon: TrendUp },
  { value: 'COUPON', label: 'Coupon', category: 'Fundamental', icon: Star },
  { value: 'DURATION', label: 'Duration', category: 'Fundamental', icon: ChartLine },
  { value: 'SPREAD', label: 'Spread', category: 'Market', icon: ChartLine },
  { value: 'RATING', label: 'Rating', category: 'Fundamental', icon: Star },
  { value: 'SECTOR', label: 'Sector', category: 'Fundamental', icon: Star },
  { value: 'MATURITY', label: 'Maturity', category: 'Fundamental', icon: CalendarBlank },
  { value: 'CUSIP', label: 'CUSIP', category: 'Identity', icon: Star },
  { value: 'NAME', label: 'Security Name', category: 'Identity', icon: Star },
]

const CATEGORIES = ['Market', 'Fundamental', 'Identity']

export function DataFieldSelector({
  selectedFields,
  onFieldsChange,
  aggregation,
  onAggregationChange,
  sortBy,
  sortOrder,
  onSortChange,
}: DataFieldSelectorProps) {
  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      onFieldsChange(selectedFields.filter((f) => f !== field))
    } else {
      onFieldsChange([...selectedFields, field])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-3">Select Data Fields</h4>
        {CATEGORIES.map((category) => (
          <div key={category} className="mb-4">
            <Badge variant="outline" className="mb-2">
              {category}
            </Badge>
            <div className="grid grid-cols-2 gap-2">
              {DATA_FIELDS.filter((f) => f.category === category).map((field) => {
                const Icon = field.icon
                const isSelected = selectedFields.includes(field.value)
                return (
                  <Card
                    key={field.value}
                    className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-accent bg-accent/5' : ''
                    }`}
                    onClick={() => toggleField(field.value)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                      <Icon size={16} className="text-muted-foreground" />
                      <Label className="text-sm cursor-pointer flex-1">
                        {field.label}
                      </Label>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedFields.length > 0 && (
        <div className="space-y-3">
          {onAggregationChange && (
            <div>
              <Label className="text-sm mb-2 block">Aggregation</Label>
              <Select value={aggregation} onValueChange={onAggregationChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select aggregation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="max">Maximum</SelectItem>
                  <SelectItem value="min">Minimum</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {onSortChange && selectedFields.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm mb-2 block">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => onSortChange(value, sortOrder || 'asc')}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sort field" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFields.map((field) => {
                      const fieldData = DATA_FIELDS.find((f) => f.value === field)
                      return (
                        <SelectItem key={field} value={field}>
                          {fieldData?.label || field}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Order</Label>
                <Select
                  value={sortOrder}
                  onValueChange={(value: 'asc' | 'desc') =>
                    onSortChange(sortBy || selectedFields[0], value)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedFields.length > 0 && (
        <Card className="p-3 bg-muted/50">
          <div className="text-xs">
            <span className="text-muted-foreground">Selected fields:</span>
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedFields.map((field) => {
                const fieldData = DATA_FIELDS.find((f) => f.value === field)
                return (
                  <Badge key={field} variant="secondary">
                    {fieldData?.label || field}
                  </Badge>
                )
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
