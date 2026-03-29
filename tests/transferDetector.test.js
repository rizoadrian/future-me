import { describe, test, expect } from 'vitest';
import {
  isCCPaymentCandidate,
  findTransferPairs,
  processTransfers,
} from '../modules/transferDetector.js';
import { detectRecurring } from '../modules/projections.js';

function makeTestTx(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date(2024, 2, 15),
    description: 'TEST MERCHANT',
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

// ── Credit card payment detection ─────────────────────────────────────────────

describe('Credit card payment detection', () => {
  test('detects autopay from checking as transfer candidate', () => {
    const tx = makeTestTx({ description: 'CITI AUTOPAY PAYMENT', amount: -1840, accountType: 'checking' })
    expect(isCCPaymentCandidate(tx)).toBe(true)
  })
  test('detects payment received on credit card as transfer candidate', () => {
    const tx = makeTestTx({ description: 'PAYMENT RECEIVED THANK YOU', amount: 1840, accountType: 'credit_card' })
    expect(isCCPaymentCandidate(tx)).toBe(true)
  })
  test('does NOT flag regular grocery purchase', () => {
    const tx = makeTestTx({ description: 'WHOLE FOODS #123', amount: -67.42, accountType: 'credit_card' })
    expect(isCCPaymentCandidate(tx)).toBe(false)
  })
  test('does NOT flag Venmo payment to a person', () => {
    const tx = makeTestTx({ description: 'VENMO PAYMENT TO JOHN S', amount: -45, accountType: 'checking' })
    expect(isCCPaymentCandidate(tx)).toBe(false)
  })
  test('does NOT flag Zelle to a named person', () => {
    const tx = makeTestTx({ description: 'ZELLE TO SARAH JONES', amount: -200, accountType: 'checking' })
    expect(isCCPaymentCandidate(tx)).toBe(false)
  })
})

// ── Transfer pair matching ─────────────────────────────────────────────────────

describe('Transfer pair matching', () => {
  test('matches CC payment pair within 5 days and 2%', () => {
    const checking = makeTestTx({ description: 'CITI AUTOPAY', amount: -1840,
      accountType: 'checking', date: new Date(2024,2,15) })
    const cc = makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1840,
      accountType: 'credit_card', date: new Date(2024,2,16) })
    expect(findTransferPairs([checking, cc]).length).toBe(1)
  })
  test('matches within 2% tolerance', () => {
    const checking = makeTestTx({ description: 'CHASE AUTOPAY', amount: -1840,
      accountType: 'checking', date: new Date(2024,2,15) })
    const cc = makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1838,
      accountType: 'credit_card', date: new Date(2024,2,14) })
    expect(findTransferPairs([checking, cc]).length).toBe(1)
  })
  test('does NOT match transactions > 5 days apart', () => {
    const checking = makeTestTx({ description: 'CHASE AUTOPAY', amount: -1840,
      accountType: 'checking', date: new Date(2024,2,1) })
    const cc = makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1840,
      accountType: 'credit_card', date: new Date(2024,2,10) })
    expect(findTransferPairs([checking, cc]).length).toBe(0)
  })
  test('does NOT match two transactions on the same account type', () => {
    const cc1 = makeTestTx({ description: 'PAYMENT', amount: -500, accountType: 'credit_card' })
    const cc2 = makeTestTx({ description: 'PAYMENT RECEIVED', amount: 500, accountType: 'credit_card' })
    expect(findTransferPairs([cc1, cc2]).length).toBe(0)
  })
  test('active transactions after exclusion = only real income and expenses', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL DIRECT DEPOSIT', amount: 3500, accountType: 'checking' }),
      makeTestTx({ description: 'CITI AUTOPAY', amount: -1200, accountType: 'checking' }),
      makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1200, accountType: 'credit_card' }),
      makeTestTx({ description: 'WHOLE FOODS', amount: -87, accountType: 'credit_card' }),
    ]
    const result = processTransfers(txs)
    const active = result.filter(tx => !tx.isTransfer)
    expect(active.length).toBe(2)
    expect(active.some(tx => tx.amount === -1200)).toBe(false)
    expect(active.some(tx => tx.amount === 1200)).toBe(false)
  })
})

// ── Two-pipeline architecture ──────────────────────────────────────────────────

describe('Two-pipeline architecture', () => {
  test('Pipeline A excludes CC payment debit from checking', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', isTransfer: false }),
      makeTestTx({ description: 'CITI AUTOPAY', amount: -1200, accountType: 'checking', isTransfer: true }),
      makeTestTx({ description: 'WHOLE FOODS', amount: -87, accountType: 'credit_card', isTransfer: false }),
    ]
    const pipelineA = txs.filter(tx => !tx.isTransfer && !tx.isDuplicate)
    expect(pipelineA.length).toBe(2)
    expect(pipelineA.some(tx => tx.description === 'CITI AUTOPAY')).toBe(false)
  })

  test('Pipeline A excludes CC payment credit from credit card', () => {
    const txs = [
      makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1200, accountType: 'credit_card', isTransfer: true }),
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, accountType: 'credit_card', isTransfer: false }),
    ]
    const pipelineA = txs.filter(tx => !tx.isTransfer && !tx.isDuplicate)
    expect(pipelineA.length).toBe(1)
    expect(pipelineA[0].description).toBe('STARBUCKS')
  })

  test('Pipeline B includes CC payment debit from checking', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', isTransfer: false }),
      makeTestTx({ description: 'CITI AUTOPAY', amount: -1200, accountType: 'checking', isTransfer: true }),
      makeTestTx({ description: 'WHOLE FOODS', amount: -87, accountType: 'credit_card', isTransfer: false }),
    ]
    const pipelineB = txs.filter(tx =>
      tx.accountType === 'checking' && !tx.isDuplicate
    )
    expect(pipelineB.length).toBe(2)
    expect(pipelineB.some(tx => tx.description === 'CITI AUTOPAY')).toBe(true)
  })

  test('Pipeline B excludes all credit card transactions', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', isTransfer: false }),
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, accountType: 'credit_card', isTransfer: false }),
      makeTestTx({ description: 'PAYMENT RECEIVED', amount: 1200, accountType: 'credit_card', isTransfer: true }),
    ]
    const pipelineB = txs.filter(tx =>
      tx.accountType === 'checking' && !tx.isDuplicate
    )
    expect(pipelineB.length).toBe(1)
    expect(pipelineB[0].description).toBe('PAYROLL')
  })

  test('category averages use Pipeline A (all accounts, no transfers)', () => {
    const txs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', isTransfer: false, category: 'Income' }),
      makeTestTx({ description: 'CITI AUTOPAY', amount: -1200, accountType: 'checking', isTransfer: true, category: 'Other' }),
      makeTestTx({ description: 'WHOLE FOODS', amount: -87, accountType: 'credit_card', isTransfer: false, category: 'Groceries' }),
      makeTestTx({ description: 'STARBUCKS', amount: -6.50, accountType: 'credit_card', isTransfer: false, category: 'Coffee' }),
    ]
    const spendingTxs = txs.filter(tx => !tx.isTransfer && !tx.isDuplicate)
    const groceryTotal = spendingTxs
      .filter(tx => tx.category === 'Groceries')
      .reduce((sum, tx) => sum + tx.amount, 0)
    expect(groceryTotal).toBeCloseTo(-87, 0)
    expect(spendingTxs.some(tx => tx.description === 'CITI AUTOPAY')).toBe(false)
  })

  test('projection uses Pipeline B recurring patterns, not credit card patterns', () => {
    const checkingTxs = [
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', date: new Date(2024,0,1) }),
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', date: new Date(2024,1,1) }),
      makeTestTx({ description: 'PAYROLL', amount: 3500, accountType: 'checking', date: new Date(2024,2,1) }),
    ]
    const ccTxs = [
      makeTestTx({ description: 'NETFLIX', amount: -15.99, accountType: 'credit_card', date: new Date(2024,0,15) }),
      makeTestTx({ description: 'NETFLIX', amount: -15.99, accountType: 'credit_card', date: new Date(2024,1,15) }),
      makeTestTx({ description: 'NETFLIX', amount: -15.99, accountType: 'credit_card', date: new Date(2024,2,15) }),
    ]
    const pipelineBTxs = [...checkingTxs, ...ccTxs].filter(tx => tx.accountType === 'checking')
    const recurring = detectRecurring(pipelineBTxs)
    expect(recurring.some(r => r.description.toLowerCase().includes('payroll'))).toBe(true)
    expect(recurring.some(r => r.description.toLowerCase().includes('netflix'))).toBe(false)
  })
})
