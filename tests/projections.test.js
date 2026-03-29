import { describe, test, expect } from 'vitest';
import {
  buildHistoricalBalance,
  buildProjection,
  buildLabelArray,
  detectRecurring,
  calcMonthlyIncome,
  calcMonthlyExpenses,
} from '../modules/projections.js';

function makeTestTx(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date(2024, 2, 15),
    description: 'TEST',
    amount: -10,
    category: 'Other',
    accountType: 'checking',
    bank: 'Test',
    sourceFile: 'test.csv',
    isTransfer: false,
    isDuplicate: false,
    ...overrides,
  };
}

describe('Adaptive x-axis label logic', () => {
  test('span ≤ 186 days: labels every biweekly Friday', () => {
    const startDate = new Date(2024, 0, 1)
    const days = 180
    const labels = buildLabelArray(days, startDate)
    const nonEmpty = labels.filter(l => l !== '')
    expect(nonEmpty.length).toBeGreaterThanOrEqual(12)
    expect(nonEmpty.length).toBeLessThanOrEqual(14)
    // All labeled days should be Fridays
    nonEmpty.forEach((label, i) => {
      const idx = labels.findIndex((l, j) => j >= (i > 0 ? labels.indexOf(nonEmpty[i-1]) + 1 : 0) && l === label)
      const d = new Date(startDate)
      d.setDate(d.getDate() + idx)
      expect(d.getDay()).toBe(5)
    })
  })

  test('span ≥ 187 days: labels on 15th of each month', () => {
    const startDate = new Date(2024, 0, 1)
    const days = 365
    const labels = buildLabelArray(days, startDate)
    const nonEmpty = labels.filter(l => l !== '')
    expect(nonEmpty.length).toBeGreaterThanOrEqual(11)
    expect(nonEmpty.length).toBeLessThanOrEqual(13)
    nonEmpty.forEach((label) => {
      expect(label).toMatch(/\w+ 15/)
    })
  })

  test('projection always uses biweekly Friday labels regardless of span', () => {
    const startDate = new Date(2024, 0, 1)
    const { labels } = buildProjection([], {}, 5000, startDate)
    const nonEmpty = labels.filter(l => l !== '')
    expect(nonEmpty.length).toBeGreaterThanOrEqual(12)
    expect(nonEmpty.length).toBeLessThanOrEqual(14)
  })
})

describe('Opening balance anchoring', () => {
  test('historical balance starts from openingBalance, not zero', () => {
    const openingBalance = 4750
    const openingDate = new Date(2024, 0, 1)
    const txs = [
      makeTestTx({ date: new Date(2024,0,1), amount: -50, description: 'GROCERY', accountType: 'checking' }),
    ]
    const result = buildHistoricalBalance(txs, openingBalance, openingDate)
    expect(result).not.toBeNull()
    expect(result.data[0]).toBe(4700)
  })

  test('null openingBalance returns null (triggers placeholder card)', () => {
    const result = buildHistoricalBalance([], null, null)
    expect(result).toBeNull()
  })
})

describe('Recurring transaction detection', () => {
  test('detects monthly recurring', () => {
    const txs = [
      makeTestTx({ description: 'NETFLIX', amount: -15.99, date: new Date(2024,0,15) }),
      makeTestTx({ description: 'NETFLIX', amount: -15.99, date: new Date(2024,1,15) }),
      makeTestTx({ description: 'NETFLIX', amount: -15.99, date: new Date(2024,2,15) }),
    ]
    const result = detectRecurring(txs)
    expect(result[0].frequency).toBe('monthly')
    expect(result[0].typicalDayOfMonth).toBe(15)
  })
  test('detects biweekly paycheck', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL DIRECT DEP', amount: 2800, date: new Date(2024,0,5) }),
      makeTestTx({ description: 'PAYROLL DIRECT DEP', amount: 2800, date: new Date(2024,0,19) }),
      makeTestTx({ description: 'PAYROLL DIRECT DEP', amount: 2800, date: new Date(2024,1,2) }),
    ]
    expect(detectRecurring(txs)[0].frequency).toBe('biweekly')
  })
  test('does NOT flag one-time transaction as recurring', () => {
    const txs = [makeTestTx({ description: 'DELTA AIRLINES', amount: -389, date: new Date(2024,0,15) })]
    expect(detectRecurring(txs).length).toBe(0)
  })
  test('does NOT flag same merchant in only one month', () => {
    const txs = [
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, date: new Date(2024,2,1) }),
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, date: new Date(2024,2,5) }),
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, date: new Date(2024,2,10) }),
    ]
    expect(detectRecurring(txs).length).toBe(0)
  })
})

describe('Projection accuracy', () => {
  test('stays positive with surplus', () => {
    const overrides = { 'Income': 5000, 'Housing': -1500, 'Groceries': -400 }
    const { data } = buildProjection([], overrides, 2000, new Date())
    expect(data[data.length - 1]).toBeGreaterThan(0)
  })
  test('goes negative with deficit', () => {
    const overrides = { 'Income': 2000, 'Housing': -3000 }
    const { data } = buildProjection([], overrides, 500, new Date())
    expect(data.some(v => v < 0)).toBe(true)
  })
  test('produces exactly 182 data points', () => {
    const { data } = buildProjection([], {}, 1000, new Date())
    expect(data.length).toBe(182)
  })
  test('negative date detection accurate within 1 day', () => {
    // $500 balance, spending $100/day = goes negative around day 5
    const overrides = { 'Housing': -100 * 30 }
    const { data } = buildProjection([], overrides, 500, new Date())
    const negIdx = data.findIndex(v => v < 0)
    expect(negIdx).toBeGreaterThanOrEqual(4)
    expect(negIdx).toBeLessThanOrEqual(7)
  })
})

describe('Transfer exclusion in income/expense totals', () => {
  test('income excludes CC payment credits', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', isTransfer: false }),
      makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1200, accountType: 'credit_card', isTransfer: true }),
    ]
    expect(calcMonthlyIncome(txs)).toBeCloseTo(3500, 0)
  })
  test('expenses exclude CC payment debits', () => {
    const txs = [
      makeTestTx({ description: 'WHOLE FOODS', amount: -87, accountType: 'credit_card', isTransfer: false }),
      makeTestTx({ description: 'CITI AUTOPAY', amount: -1200, accountType: 'checking', isTransfer: true }),
    ]
    expect(calcMonthlyExpenses(txs)).toBeCloseTo(-87, 0)
  })
})
