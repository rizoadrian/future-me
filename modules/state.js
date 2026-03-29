export const STATE = {
  transactions: [],            // ALL transactions, all files, all flags
  transferPairs: [],
  duplicatesRemoved: 0,
  recurringItems: [],          // from Pipeline B (checking only)
  categoryMonthlyAverages: {}, // from Pipeline A (spending, all accounts)
  categoryOverrides: {},       // user edits
  openingBalance: null,        // sum of all checking opening balances
  openingBalanceDate: null,    // date of the row used for opening balance
  openingBalanceBank: null,    // bank name for display
  startBalanceForProjection: 0,
  hasCheckingData: false,      // true if ≥1 checking file uploaded
  hasBalanceData: false,       // true if checking file has balance column
  dateRange: { start: null, end: null },
  checkingDateRange: { start: null, end: null },
  files: [],
  otherTransactions: [],
};

/**
 * Pipeline A — all accounts, transfers excluded, duplicates excluded.
 * Powers spending charts: categories, donut, monthly breakdown.
 */
export function getSpendingTransactions() {
  return STATE.transactions.filter(tx => !tx.isTransfer && !tx.isDuplicate);
}

/**
 * Pipeline B — checking only, CC payment debits included (they're real cashflow),
 * duplicates excluded.
 * Powers cashflow chart and projection.
 */
export function getCheckingCashflowTransactions() {
  return STATE.transactions.filter(tx =>
    tx.accountType === 'checking'
    && !tx.isDuplicate
    // CC payment debits: isTransfer=true but accountType=checking → INCLUDE
    // They represent real money leaving the checking account
  );
}

export function resetState() {
  STATE.transactions = [];
  STATE.transferPairs = [];
  STATE.duplicatesRemoved = 0;
  STATE.recurringItems = [];
  STATE.categoryMonthlyAverages = {};
  STATE.categoryOverrides = {};
  STATE.openingBalance = null;
  STATE.openingBalanceDate = null;
  STATE.openingBalanceBank = null;
  STATE.startBalanceForProjection = 0;
  STATE.hasCheckingData = false;
  STATE.hasBalanceData = false;
  STATE.dateRange = { start: null, end: null };
  STATE.checkingDateRange = { start: null, end: null };
  STATE.files = [];
  STATE.otherTransactions = [];
}
