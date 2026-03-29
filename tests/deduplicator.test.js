import { describe, test, expect } from 'vitest';
import { deduplicate } from '../modules/deduplicator.js';

function makeTestTx(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date(2024, 2, 15),
    description: 'TEST MERCHANT',
    amount: -45,
    category: 'Other',
    accountType: 'credit_card',
    bank: 'Test',
    sourceFile: 'file1.csv',
    isTransfer: false,
    isDuplicate: false,
    ...overrides,
  };
}

describe('Deduplication', () => {
  test('removes exact duplicate within same account type', () => {
    const tx1 = makeTestTx({ date: new Date(2024,2,15), amount: -45,
      description: 'STARBUCKS', accountType: 'credit_card', sourceFile: 'file1.csv' })
    const tx2 = makeTestTx({ date: new Date(2024,2,15), amount: -45,
      description: 'STARBUCKS', accountType: 'credit_card', sourceFile: 'file2.csv' })
    const result = deduplicate([tx1, tx2], {
      'file1.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
      'file2.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
    })
    expect(result.filter(tx => !tx.isDuplicate).length).toBe(1)
  })

  test('keeps same key from different account types', () => {
    const checking = makeTestTx({ date: new Date(2024,2,15), amount: -45,
      description: 'STARBUCKS', accountType: 'checking', sourceFile: 'file1.csv' })
    const cc = makeTestTx({ date: new Date(2024,2,15), amount: -45,
      description: 'STARBUCKS', accountType: 'credit_card', sourceFile: 'file2.csv' })
    const result = deduplicate([checking, cc], {
      'file1.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
      'file2.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
    })
    expect(result.filter(tx => !tx.isDuplicate).length).toBe(2)
  })

  test('does NOT deduplicate same merchant different dates', () => {
    const tx1 = makeTestTx({ description: 'NETFLIX', amount: -15.99,
      date: new Date(2024,2,15), accountType: 'credit_card', sourceFile: 'file1.csv' })
    const tx2 = makeTestTx({ description: 'NETFLIX', amount: -15.99,
      date: new Date(2024,3,15), accountType: 'credit_card', sourceFile: 'file2.csv' })
    const result = deduplicate([tx1, tx2], {
      'file1.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
      'file2.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
    })
    expect(result.filter(tx => !tx.isDuplicate).length).toBe(2)
  })

  test('does NOT deduplicate transactions outside the overlap window', () => {
    // file1: Jan–Mar. file2: Feb–May. A transaction on Jan 15 in file1
    // has no counterpart in file2 (before file2 starts) — not a duplicate.
    const tx1 = makeTestTx({ date: new Date(2024,0,15), amount: -45,
      description: 'NETFLIX', accountType: 'credit_card', sourceFile: 'file1.csv' })
    const tx2 = makeTestTx({ date: new Date(2024,0,15), amount: -45,
      description: 'NETFLIX', accountType: 'credit_card', sourceFile: 'file2.csv' })
    const fileRanges = {
      'file1.csv': { start: new Date(2024,0,1), end: new Date(2024,2,31) },
      'file2.csv': { start: new Date(2024,1,1), end: new Date(2024,4,31) },
    }
    const result = deduplicate([tx1, tx2], fileRanges)
    expect(result.filter(tx => !tx.isDuplicate).length).toBe(2)
  })

  test('reports correct duplicate count', () => {
    const txs = Array(3).fill(null).map((_, i) =>
      makeTestTx({ date: new Date(2024,2,15), amount: -45,
        description: 'STARBUCKS', accountType: 'credit_card',
        sourceFile: i === 0 ? 'file1.csv' : 'file2.csv' }))
    const result = deduplicate(txs, {
      'file1.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
      'file2.csv': { start: new Date(2024,0,1), end: new Date(2024,5,30) },
    })
    expect(result.filter(tx => tx.isDuplicate).length).toBe(2)
  })
})
