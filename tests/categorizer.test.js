import { describe, test, expect } from 'vitest';
import { categorize, fuzzyMatch } from '../modules/categorizer.js';

describe('Pass 1 — Exact matching', () => {
  test('Income: payroll deposit', () =>
    expect(categorize('GUSTO PAYROLL DIRECT DEP', 3500)).toBe('Income'))
  test('Groceries: Whole Foods', () =>
    expect(categorize('WHOLEFDS #1234 AUSTIN TX', -67)).toBe('Groceries'))
  test('Coffee: Starbucks goes to Coffee NOT Dining out', () =>
    expect(categorize('STARBUCKS STORE 12345', -6.50)).toBe('Coffee'))
  test('Coffee: Dunkin', () =>
    expect(categorize('DUNKIN #334455', -4.75)).toBe('Coffee'))
  test('Coffee: Dutch Bros', () =>
    expect(categorize('DUTCH BROS COFFEE', -5.25)).toBe('Coffee'))
  test('Coffee: generic cafe', () =>
    expect(categorize('BLUE SKY COFFEE ROASTERS', -7.00)).toBe('Coffee'))
  test('Drinks: Total Wine', () =>
    expect(categorize('TOTAL WINE & MORE', -45.00)).toBe('Drinks'))
  test('Drinks: local brewery', () =>
    expect(categorize('AUSTIN BEERWORKS TAPROOM', -18.00)).toBe('Drinks'))
  test('Drinks: winery', () =>
    expect(categorize('BECKER VINEYARDS WINERY', -65.00)).toBe('Drinks'))
  test('Dining out: DoorDash', () =>
    expect(categorize('DOORDASH*MCDONALDS', -14.50)).toBe('Dining out'))
  test('Dining out: restaurant (no coffee/bar keywords)', () =>
    expect(categorize('TORCHYS TACOS AUSTIN', -22.00)).toBe('Dining out'))
  test('Subscriptions: Netflix', () =>
    expect(categorize('NETFLIX.COM', -15.99)).toBe('Subscriptions'))
  test('Transportation: Shell gas', () =>
    expect(categorize('SHELL OIL 57442891', -52.00)).toBe('Transportation'))
  test('Healthcare: CVS', () =>
    expect(categorize('CVS PHARMACY #4521', -23.00)).toBe('Healthcare'))
  test('Travel: Marriott', () =>
    expect(categorize('MARRIOTT AUSTIN DOWNTOWN', -289.00)).toBe('Travel'))
  test('Shopping: Amazon', () =>
    expect(categorize('AMAZON.COM*AB12CD34', -45.00)).toBe('Shopping'))
  test('Pets: Chewy', () =>
    expect(categorize('CHEWY.COM', -67.00)).toBe('Pets'))
  test('Housing: rent', () =>
    expect(categorize('RENT PAYMENT PROPERTY MGMT', -1950)).toBe('Housing'))
  test('does NOT categorize CC payment as Income', () =>
    expect(categorize('CITI PAYMENT RECEIVED', 1840)).not.toBe('Income'))
  test('returns Other for unknown merchant', () =>
    expect(categorize('XYZ CORP 394821', -45)).toBe('Other'))
  test('ATM withdrawal goes to Other', () =>
    expect(categorize('ATM WITHDRAWAL', -100)).toBe('Other'))
})

describe('Category ordering — Coffee beats Dining out', () => {
  test('Starbucks never categorized as Dining out', () => {
    expect(categorize('STARBUCKS DRIVE THRU', -5.75)).not.toBe('Dining out')
  })
  test('brewery never categorized as Dining out', () => {
    expect(categorize('HOPS AND GRAIN BREWING CO', -14.00)).not.toBe('Dining out')
  })
  test('restaurant without coffee/bar keywords stays Dining out', () => {
    expect(categorize('THE GROVE RESTAURANT AUSTIN', -85.00)).toBe('Dining out')
  })
})

describe('Pass 2 — Fuzzy matching', () => {
  test('fuzzy-matches truncated merchant name', () =>
    expect(fuzzyMatch('WHOLEFDS 1234') || categorize('WHOLEFDS 1234', -45)).toBe('Groceries'))
  test('fuzzy-matches Starbucks with store number', () =>
    expect(categorize('STARBUCKS STORE 12345 AUSTIN TX', -6.50)).toBe('Coffee'))
  test('fuzzy-matches DoorDash order', () =>
    expect(categorize('SQ PAYPAL DOORDASH ORDER', -22.00)).toBe('Dining out'))
})

describe('Edge cases', () => {
  test('empty description returns Other', () =>
    expect(categorize('', -45)).toBe('Other'))
  test('all-caps normalizes correctly', () =>
    expect(categorize('WHOLE FOODS MARKET', -89)).toBe('Groceries'))
  test('asterisk in description handled', () =>
    expect(categorize('AMAZON*PRIME', -14.99)).toBe('Subscriptions'))
  test('small positive from refund NOT categorized as Income', () =>
    expect(categorize('REFUND FROM MERCHANT', 5)).not.toBe('Income'))
})
