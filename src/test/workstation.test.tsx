import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BacktestEngine } from '@/lib/backtestEngine'
import { normalizeBacktestDataFiles } from '@/lib/backtestData'
import { createBacktestStrategyExecutor } from '@/lib/strategyExecutionAdapter'
import { fixtureStrategyDataProvider } from '@/lib/strategyDataProvider'
import { StrategyChecklist } from '@/components/StrategyChecklist'

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

async function main() {
  await test('normalizes fixture rows with preserved fields and derived yield aliases', () => {
    const dataset = fixtureStrategyDataProvider.loadDataset('pcg-preferreds')
    assert.ok(dataset)

    const normalized = normalizeBacktestDataFiles(dataset.data, dataset)
    const firstRow = normalized.seriesBySymbol.PA[0] as Record<string, unknown>

    assert.equal(normalized.diagnostics.filter(d => d.severity === 'error').length, 0)
    assert.equal(firstRow.Close, 24.15)
    assert.equal(firstRow.close, 24.15)
    assert.equal(firstRow.Volume, 125000)
    assert.equal(firstRow.volume, 125000)
    assert.equal(typeof firstRow['ADV$'], 'number')
    assert.equal(Number(firstRow.Yield).toFixed(2), '6.21')
    assert.ok(normalized.normalizedFieldMap.PA.includes('Yield'))
  })

  await test('fixture strategy generates trades instead of silent hold-only proof', async () => {
    const dataset = fixtureStrategyDataProvider.loadDataset('pcg-preferreds')
    assert.ok(dataset)

    const normalized = normalizeBacktestDataFiles(dataset.data, dataset)
    const engine = new BacktestEngine({
      startCapital: 1000,
      startDate: new Date('2023-01-03'),
      endDate: new Date('2023-12-29'),
      transactionCost: 0.003,
      volumeCapPct: 0.25,
      slippageModel: 'adaptive',
    })

    Object.entries(normalized.seriesBySymbol).forEach(([symbol, rows]) => engine.loadTimeSeries(symbol, rows))
    const result = await engine.runBacktest(createBacktestStrategyExecutor(dataset.strategyTemplate))

    assert.ok(result.equity.length > 0)
    assert.ok(result.trades.length > 0)
    assert.equal(result.diagnostics?.some(d => d.id.startsWith('unsupported-action')), false)
  })

  await test('target allocation output creates order events and position snapshots', async () => {
    const engine = new BacktestEngine({
      startCapital: 1000,
      startDate: new Date('2024-01-02'),
      endDate: new Date('2024-01-02'),
      transactionCost: 0,
      volumeCapPct: 1,
      slippageModel: 'adaptive',
    })
    engine.loadTimeSeries('AAA', [{ date: new Date('2024-01-02'), close: 10, volume: 1000, 'ADV$': 10000 }])
    engine.loadTimeSeries('BBB', [{ date: new Date('2024-01-02'), close: 20, volume: 1000, 'ADV$': 20000 }])

    const result = await engine.runBacktest(() => ({
      targetAllocation: { AAA: 0.5, BBB: 0.5 },
      reason: 'equal weight proof',
    }))

    assert.equal(result.trades.length, 2)
    assert.equal(result.orderEvents?.some(event => event.action === 'target_allocation'), true)
    assert.equal(result.positionSnapshots?.length, 1)
    assert.ok(result.positionSnapshots?.[0].weights.AAA)
  })

  await test('strategy checklist renders actionable proof state', () => {
    const html = renderToStaticMarkup(
      <StrategyChecklist
        items={[
          {
            id: 'proof',
            label: 'Backtest proof current',
            status: 'warning',
            detail: 'Backtest proof is stale after edits.',
            action: 'run-backtest',
          },
        ]}
      />
    )

    assert.match(html, /Strategy Checklist/)
    assert.match(html, /Backtest proof current/)
    assert.match(html, /Backtest proof is stale after edits/)
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
