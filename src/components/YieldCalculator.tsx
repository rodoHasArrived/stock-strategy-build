import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calculator, Info } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface YieldCalculatorProps {
  onGenerateFormula?: (formula: string) => void
}

export function YieldCalculator({ onGenerateFormula }: YieldCalculatorProps) {
  const [yieldMethod, setYieldMethod] = useState<'current' | 'ytm' | 'ytc' | 'ytw' | 'custom'>('current')
  const [priceType, setPriceType] = useState<'clean' | 'dirty'>('clean')
  const [faceValue, setFaceValue] = useState('1000')
  const [frequency, setFrequency] = useState<'annual' | 'semiannual' | 'quarterly'>('semiannual')
  const [dayCount, setDayCount] = useState<'30/360' | 'actual/365' | 'actual/actual'>('30/360')

  const generateFormula = () => {
    let formula = ''
    
    switch (yieldMethod) {
      case 'current':
        formula = `# Current Yield Calculation
# Annual coupon divided by current market price
face_value = FACE_VALUE(cusip) or ${faceValue}
coupon_rate = COUPON(cusip)
market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}

annual_coupon = face_value * coupon_rate
current_yield = annual_coupon / market_price

__result__ = current_yield`
        break
        
      case 'ytm':
        formula = `# Yield to Maturity Calculation
# Internal rate of return on bond held to maturity
market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}
face_value = FACE_VALUE(cusip) or ${faceValue}
coupon_rate = COUPON(cusip)
maturity_date = MATURITY(cusip)
frequency = "${frequency}"
day_count = "${dayCount}"

# YTM solver (approximation using Newton-Raphson)
ytm = YTM(cusip)

__result__ = ytm`
        break
        
      case 'ytc':
        formula = `# Yield to Call Calculation
# Yield if bond is called at earliest call date
market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}
call_date = CALL_DATE(cusip)
call_price = CALL_PRICE(cusip)
coupon_rate = COUPON(cusip)
frequency = "${frequency}"

ytc = YTC(cusip)

__result__ = ytc`
        break
        
      case 'ytw':
        formula = `# Yield to Worst Calculation
# Lowest yield considering all call dates
ytm = YTM(cusip)
ytc = YTC(cusip)

yield_to_worst = min(ytm, ytc)

__result__ = yield_to_worst`
        break
        
      case 'custom':
        formula = `# Custom Yield Formula
# Define your own yield calculation
market_price = CLEAN_PRICE(cusip)
coupon_rate = COUPON(cusip)

# Add your custom logic here
custom_yield = 0

__result__ = custom_yield`
        break
    }
    
    return formula
  }

  const handleGenerate = () => {
    const formula = generateFormula()
    onGenerateFormula?.(formula)
  }

  const getYieldDescription = () => {
    switch (yieldMethod) {
      case 'current':
        return 'Annual coupon income divided by current market price. Does not consider time value or principal repayment.'
      case 'ytm':
        return 'Total return anticipated if bond is held until maturity. Considers all future coupon payments and principal repayment.'
      case 'ytc':
        return 'Yield if the bond is called at the earliest call date. Important for callable bonds trading above par.'
      case 'ytw':
        return 'Lowest potential yield among all possible call dates and maturity. Conservative measure for callable bonds.'
      case 'custom':
        return 'Define your own yield calculation using available AMX data fields.'
    }
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calculator size={20} className="text-accent" weight="duotone" />
          <h3 className="font-semibold">Yield Calculator</h3>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Yield Method</Label>
            <Select value={yieldMethod} onValueChange={(v: any) => setYieldMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Yield</SelectItem>
                <SelectItem value="ytm">Yield to Maturity (YTM)</SelectItem>
                <SelectItem value="ytc">Yield to Call (YTC)</SelectItem>
                <SelectItem value="ytw">Yield to Worst (YTW)</SelectItem>
                <SelectItem value="custom">Custom Formula</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>{getYieldDescription()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Price Type</Label>
              <Select value={priceType} onValueChange={(v: any) => setPriceType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clean">Clean Price</SelectItem>
                  <SelectItem value="dirty">Dirty Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Face Value</Label>
              <Input
                type="number"
                value={faceValue}
                onChange={(e) => setFaceValue(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {yieldMethod !== 'current' && yieldMethod !== 'custom' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Coupon Frequency</Label>
                <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="semiannual">Semiannual</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Day Count Convention</Label>
                <Select value={dayCount} onValueChange={(v: any) => setDayCount(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30/360">30/360</SelectItem>
                    <SelectItem value="actual/365">Actual/365</SelectItem>
                    <SelectItem value="actual/actual">Actual/Actual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Assumptions</Label>
            <Badge variant="outline" className="text-xs">Preview</Badge>
          </div>
          <div className="p-3 bg-muted/30 rounded-md text-xs space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price:</span>
              <span>{priceType === 'clean' ? 'Clean' : 'Dirty'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Face Value:</span>
              <span>{faceValue}</span>
            </div>
            {yieldMethod !== 'current' && yieldMethod !== 'custom' && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frequency:</span>
                  <span className="capitalize">{frequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Day Count:</span>
                  <span>{dayCount}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <Button onClick={handleGenerate} className="w-full" size="sm">
          <Calculator size={16} className="mr-2" />
          Generate Formula
        </Button>
      </div>
    </Card>
  )
}
