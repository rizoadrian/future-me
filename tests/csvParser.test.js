import { describe, test, expect } from 'vitest';
import {
  parseDate,
  normalizeAmount,
  normalizeAmountFromRow,
  detectBank,
  extractOpeningBalance,
  shouldInclude,
  makeId,
} from '../modules/csvParser.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTestTx(overrides) {
  return {
    id: 'test',
    date: new Date(),
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

function normalizeAmountSplit(debit, credit) {
  return normalizeAmountFromRow(
    { Debit: debit, Credit: credit },
    { splitColumns: true, debitCol: 'Debit', creditCol: 'Credit' }
  );
}

function normalizeAmountAmex(str) {
  return normalizeAmountFromRow(
    { Amount: str },
    { splitColumns: false, amountCol: 'Amount', amountSign: 'amex' }
  );
}

// ── Date parsing ──────────────────────────────────────────────────────────────

describe('Date parsing', () => {
  test('parses MM/DD/YYYY', () =>
    expect(parseDate('03/15/2024')).toEqual(new Date(2024,2,15)))
  test('parses YYYY-MM-DD', () =>
    expect(parseDate('2024-03-15')).toEqual(new Date(2024,2,15)))
  test('parses MM/DD/YY short year', () =>
    expect(parseDate('03/15/24')).toEqual(new Date(2024,2,15)))
  test('parses "Mar 15, 2024"', () =>
    expect(parseDate('Mar 15, 2024')).toEqual(new Date(2024,2,15)))
  test('parses "15 Mar 2024"', () =>
    expect(parseDate('15 Mar 2024')).toEqual(new Date(2024,2,15)))
  test('parses YYYYMMDD', () =>
    expect(parseDate('20240315')).toEqual(new Date(2024,2,15)))
  test('returns null for empty string', () =>
    expect(parseDate('')).toBeNull())
  test('returns null for invalid date', () =>
    expect(parseDate('99/99/9999')).toBeNull())
  test('strips BOM character', () =>
    expect(parseDate('\uFEFF03/15/2024')).toEqual(new Date(2024,2,15)))
  test('strips surrounding quotes', () =>
    expect(parseDate('"03/15/2024"')).toEqual(new Date(2024,2,15)))
})

// ── Amount normalization ──────────────────────────────────────────────────────

describe('Amount normalization', () => {
  test('parses negative expense', () =>
    expect(normalizeAmount('-45.67')).toBe(-45.67))
  test('parses positive income', () =>
    expect(normalizeAmount('2500.00')).toBe(2500.00))
  test('strips dollar sign', () =>
    expect(normalizeAmount('$45.67')).toBe(45.67))
  test('handles comma thousands separator', () =>
    expect(normalizeAmount('1,234.56')).toBe(1234.56))
  test('handles parentheses as negative', () =>
    expect(normalizeAmount('(234.56)')).toBe(-234.56))
  test('handles European format', () =>
    expect(normalizeAmount('1.234,56')).toBe(1234.56))
  test('returns null for non-numeric', () =>
    expect(normalizeAmount('N/A')).toBeNull())
  test('split columns — debit only', () => {
    expect(normalizeAmountSplit('45.00', '')).toBe(-45.00)
  })
  test('split columns — credit only', () => {
    expect(normalizeAmountSplit('', '1840.00')).toBe(1840.00)
  })
  test('Amex positive charge becomes negative expense', () =>
    expect(normalizeAmountAmex('45.67')).toBe(-45.67))
  test('Amex negative payment becomes positive', () =>
    expect(normalizeAmountAmex('-1840.00')).toBe(1840.00))
})

// ── Bank fingerprinting ───────────────────────────────────────────────────────

describe('Bank fingerprinting', () => {
  test('detects Chase credit card', () => {
    const h = ['Transaction Date','Post Date','Description','Category','Type','Amount','Memo']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Chase')
  })
  test('detects Chase Checking (has balance column)', () => {
    const h = ['Details','Posting Date','Description','Amount','Type','Balance','Check or Slip #']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Chase Checking')
  })
  test('Chase Checking config has balanceCol set', () => {
    const h = ['Details','Posting Date','Description','Amount','Type','Balance','Check or Slip #']
    expect(detectBank(h.map(x=>x.toLowerCase())).balanceCol).toBe('Balance')
  })
  test('detects Citi', () => {
    const h = ['Date','Description','Debit','Credit']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Citi')
  })
  test('detects Capital One', () => {
    const h = ['Transaction Date','Posted Date','Card No.','Description','Category','Debit','Credit']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Capital One')
  })
  test('detects Amex', () => {
    const h = ['Date','Description','Amount','Extended Details','Appears On Your Statement As']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('American Express')
  })
  test('detects BofA checking (has Running Bal. column)', () => {
    const h = ['Date','Description','Amount','Running Bal.']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Bank of America')
    expect(detectBank(h.map(x=>x.toLowerCase())).balanceCol).toBe('Running Bal.')
  })
  test('detects Wells Fargo positional', () => {
    const h = ['field1','field2','field3','field4','field5']
    expect(detectBank(h).name).toBe('Wells Fargo')
  })
  test('falls back to generic for unknown headers', () => {
    const h = ['Date','Merchant Name','Transaction Amount']
    expect(detectBank(h.map(x=>x.toLowerCase())).name).toBe('Bank (auto-detected)')
  })
})

// ── Opening balance extraction ────────────────────────────────────────────────

describe('Opening balance extraction', () => {
  test('extracts balance from earliest row of Chase Checking', () => {
    const rows = [
      { 'Posting Date': '03/01/2024', 'Description': 'PAYROLL', 'Amount': '3500', 'Balance': '5340.00', 'Type': 'ACH_CREDIT', 'Details': 'CREDIT' },
      { 'Posting Date': '03/05/2024', 'Description': 'RENT', 'Amount': '-1950', 'Balance': '3390.00', 'Type': 'ACH_DEBIT', 'Details': 'DEBIT' },
    ]
    const result = extractOpeningBalance(rows, { balanceCol: 'Balance', dateCol: 'Posting Date' })
    expect(result.balance).toBe(5340.00)
    expect(result.date).toEqual(new Date(2024, 2, 1))
  })

  test('returns null when no balance column exists', () => {
    const rows = [
      { 'Date': '03/01/2024', 'Description': 'STARBUCKS', 'Debit': '6.50', 'Credit': '' }
    ]
    const result = extractOpeningBalance(rows, { balanceCol: null })
    expect(result).toBeNull()
  })

  test('uses earliest date row, not first row in array', () => {
    const rows = [
      { 'Posting Date': '03/15/2024', 'Balance': '3000.00', 'Amount': '-50', 'Description': 'GROCERY' },
      { 'Posting Date': '03/01/2024', 'Balance': '5000.00', 'Amount': '3500', 'Description': 'PAYROLL' },
    ]
    const result = extractOpeningBalance(rows, { balanceCol: 'Balance', dateCol: 'Posting Date' })
    expect(result.balance).toBe(5000.00)
  })
})

// ── Transaction filtering ─────────────────────────────────────────────────────

describe('Transaction filtering', () => {
  test('strips transactions > 24 months old', () => {
    const old = makeTestTx({ date: new Date(2020, 0, 1) })
    expect(shouldInclude(old)).toBe(false)
  })
  test('strips pending transactions > 5 days future', () => {
    const future = makeTestTx({ date: new Date(Date.now() + 10 * 86400000) })
    expect(shouldInclude(future)).toBe(false)
  })
  test('keeps transactions within valid range', () => {
    const valid = makeTestTx({ date: new Date() })
    expect(shouldInclude(valid)).toBe(true)
  })
})
