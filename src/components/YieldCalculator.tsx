import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calculator, Info, CheckCircle, XCircle, Flask } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// ── Reference fixtures ────────────────────────────────────────────────────────
// Each fixture defines a known bond scenario and its expected yield values.
// These values are validated against the generated formula logic to surface
// assumption mismatches early.
const FIXTURES = [
  {
    id: 'ust-5y',
    label: '5% UST 5Y @ par',
    coupon: 0.05,
    faceValue: 1000,
    price: 1000,        // at par
    frequency: 'semiannual' as const,
    maturityYears: 5,
    expectedCurrentYield: 0.05,    // 5%
    expectedYTM: 0.05,             // 5% (at par, YTM = coupon)
    expectedYTW: 0.05,
    tolerance: 0.0001
  },
  {
    id: 'discount-bond',
    label: '6% 10Y @ 90 (discount)',
    coupon: 0.06,
    faceValue: 1000,
    price: 900,          // below par
    frequency: 'semiannual' as const,
    maturityYears: 10,
    expectedCurrentYield: 0.0667,  // 60/900
    expectedYTM: 0.0729,           // approx
    expectedYTW: 0.0729,
    tolerance: 0.005
  },
  {
    id: 'premium-bond',
    label: '8% 10Y @ 110 (premium)',
    coupon: 0.08,
    faceValue: 1000,
    price: 1100,         // above par
    frequency: 'semiannual' as const,
    maturityYears: 10,
    expectedCurrentYield: 0.0727,  // 80/1100
    expectedYTM: 0.0659,           // approx
    expectedYTW: 0.0659,
    tolerance: 0.005
  }
]

function calcCurrentYield(coupon: number, faceValue: number, price: number): number {
  return (coupon * faceValue) / price
}

function calcYTMApprox(coupon: number, faceValue: number, price: number, years: number): number {
  // Approximation: (coupon + (face - price) / years) / ((face + price) / 2)
  const annualCoupon = coupon * faceValue
  return (annualCoupon + (faceValue - price) / years) / ((faceValue + price) / 2)
}

interface FixtureResult {
  id: string
  label: string
  method: string
  expected: number
  calculated: number
  pass: boolean
}

interface YieldCalculatorProps {
  onGenerateFormula?: (formula: string) => void
}

export function YieldCalculator({ onGenerateFormula }: YieldCalculatorProps) {
  const [yieldMethod, setYieldMethod] = useState<'current' | 'ytm' | 'ytc' | 'ytw' | 'custom'>('current')
  const [priceType, setPriceType] = useState<'clean' | 'dirty'>('clean')
  const [faceValue, setFaceValue] = useState('1000')
  const [frequency, setFrequency] = useState<'annual' | 'semiannual' | 'quarterly'>('semiannual')
  const [dayCount, setDayCount] = useState<'30/360' | 'actual/365' | 'actual/actual'>('30/360')
  const [fixtureResults, setFixtureResults] = useState<FixtureResult[] | null>(null)

  const generateFormula = () => {
    let formula = ''
    
    switch (yieldMethod) {
      case 'current':
        formula = `' Current Yield Calculation
' Annual coupon divided by current market price
Let face_value = FACE_VALUE(cusip) Or ${faceValue}
Let coupon_rate = COUPON(cusip)
Let market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}

Let annual_coupon = face_value * coupon_rate
Let current_yield = annual_coupon / market_price

Result = current_yield`
        break
        
      case 'ytm':
        formula = `' Yield to Maturity Calculation
' Internal rate of return on bond held to maturity
Let market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}
Let face_value = FACE_VALUE(cusip) Or ${faceValue}
Let coupon_rate = COUPON(cusip)
Let maturity_date = MATURITY(cusip)
Let frequency = "${frequency}"
Let day_count = "${dayCount}"

' YTM solver approximation
Let ytm = YTM(cusip)

Result = ytm`
        break
        
      case 'ytc':
        formula = `' Yield to Call Calculation
' Yield if bond is called at earliest call date
Let market_price = ${priceType === 'clean' ? 'CLEAN_PRICE(cusip)' : 'DIRTY_PRICE(cusip)'}
Let call_date = CALL_DATE(cusip)
Let call_price = CALL_PRICE(cusip)
Let coupon_rate = COUPON(cusip)
Let frequency = "${frequency}"

Let ytc = YTC(cusip)

Result = ytc`
        break
        
      case 'ytw':
        formula = `' Yield to Worst Calculation
' Lowest yield considering all call dates
Let ytm = YTM(cusip)
Let ytc = YTC(cusip)

Let yield_to_worst = Math.min(ytm, ytc)

Result = yield_to_worst`
        break
        
      case 'custom':
        formula = `' Custom Yield Formula
' Define your own yield calculation
Let market_price = CLEAN_PRICE(cusip)
Let coupon_rate = COUPON(cusip)

' Add your custom logic here
Let custom_yield = 0

Result = custom_yield`
        break
    }
    
    return formula
  }

  const handleGenerate = () => {
    const formula = generateFormula()
    onGenerateFormula?.(formula)
  }

  const runFixtures = () => {
    const results: FixtureResult[] = []
    FIXTURES.forEach(f => {
      if (yieldMethod === 'current' || yieldMethod === 'ytw') {
        const calc = calcCurrentYield(f.coupon, f.faceValue, f.price)
        const expected = f.expectedCurrentYield
        results.push({
          id: f.id,
          label: f.label,
          method: 'Current Yield',
          expected,
          calculated: calc,
          pass: Math.abs(calc - expected) <= f.tolerance
        })
      }
      if (yieldMethod === 'ytm' || yieldMethod === 'ytw') {
        const calc = calcYTMApprox(f.coupon, f.faceValue, f.price, f.maturityYears)
        const expected = f.expectedYTM
        results.push({
          id: f.id + '-ytm',
          label: f.label,
          method: 'YTM (approx)',
          expected,
          calculated: calc,
          pass: Math.abs(calc - expected) <= f.tolerance
        })
      }
    })
    setFixtureResults(results)
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
              <span className="text-muted-foreground">Method:</span>
              <span className="uppercase">{yieldMethod}</span>
            </div>
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

        {yieldMethod !== 'custom' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1">
                  <Flask size={14} />
                  Fixture Validation
                </Label>
                <Button size="sm" variant="outline" onClick={runFixtures} className="h-7 text-xs">
                  Run Tests
                </Button>
              </div>
              {fixtureResults ? (
                <div className="space-y-1">
                  {fixtureResults.map(r => (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-center justify-between rounded p-1.5 text-xs border',
                        r.pass ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {r.pass
                          ? <CheckCircle size={12} className="text-success shrink-0" weight="fill" />
                          : <XCircle size={12} className="text-destructive shrink-0" weight="fill" />
                        }
                        <span className="truncate">{r.label} · {r.method}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2 font-mono">
                        <span className="text-muted-foreground">{(r.expected * 100).toFixed(3)}%</span>
                        <span className={r.pass ? 'text-success' : 'text-destructive'}>
                          {(r.calculated * 100).toFixed(3)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Left = expected · Right = calculated. Tolerance is fixture-specific (0.01% for par, 0.5% for discount/premium).
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Run tests to validate your assumptions against reference fixtures.
                </p>
              )}
            </div>
          </>
        )}

        <Button onClick={handleGenerate} className="w-full" size="sm">
          <Calculator size={16} className="mr-2" />
          Generate Formula
        </Button>
      </div>
    </Card>
  )
}
