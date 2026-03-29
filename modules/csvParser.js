import Papa from 'papaparse';

// ── Bank configs ──────────────────────────────────────────────────────────────

export const BANK_CONFIGS = [
  {
    name: 'Chase',
    accountType: 'credit_card',
    detect: h => h.includes('transaction date') && h.includes('post date')
                 && h.includes('description') && h.includes('amount')
                 && h.includes('type') && !h.includes('balance'),
    dateCol: 'Transaction Date',
    descCol: 'Description',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'standard',
    balanceCol: null,
  },
  {
    name: 'Chase Checking',
    accountType: 'checking',
    detect: h => h.includes('details') && h.includes('posting date')
                 && h.includes('description') && h.includes('amount')
                 && h.includes('type') && h.includes('balance'),
    dateCol: 'Posting Date',
    descCol: 'Description',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'standard',
    balanceCol: 'Balance',
  },
  {
    name: 'Bank of America',
    accountType: 'checking',
    detect: h => h.includes('date') && h.includes('description')
                 && h.includes('amount') && h.includes('running bal.'),
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'standard',
    balanceCol: 'Running Bal.',
  },
  {
    name: 'Bank of America Credit',
    accountType: 'credit_card',
    detect: h => h.includes('posted date') && h.includes('reference number')
                 && h.includes('payee') && h.includes('address') && h.includes('amount'),
    dateCol: 'Posted Date',
    descCol: 'Payee',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'bofa_credit',
    balanceCol: null,
  },
  {
    name: 'Wells Fargo',
    accountType: 'checking',
    positional: true,
    detect: (h, rows) => h.every(col => /^field\d+$/.test(col))
             || (rows && rows[0] && /^\d{2}\/\d{2}\/\d{4}$/.test(Object.values(rows[0])[0])),
    cols: { date: 0, amount: 1, balance: null, desc: 4 },
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'standard',
    balanceCol: null,
  },
  {
    name: 'Citi',
    accountType: 'credit_card',
    detect: h => h.includes('date') && h.includes('description')
                 && h.includes('debit') && h.includes('credit')
                 && !h.includes('card no.'),
    dateCol: 'Date',
    descCol: 'Description',
    debitCol: 'Debit',
    creditCol: 'Credit',
    splitColumns: true,
    dateFormat: 'MM/DD/YYYY',
    balanceCol: null,
  },
  {
    name: 'Capital One',
    accountType: 'credit_card',
    detect: h => h.includes('transaction date') && h.includes('posted date')
                 && h.includes('card no.') && h.includes('debit') && h.includes('credit'),
    dateCol: 'Transaction Date',
    descCol: 'Description',
    debitCol: 'Debit',
    creditCol: 'Credit',
    splitColumns: true,
    dateFormat: 'YYYY-MM-DD',
    balanceCol: null,
  },
  {
    name: 'American Express',
    accountType: 'credit_card',
    detect: h => h.includes('date') && h.includes('description')
                 && h.includes('amount') && h.includes('extended details'),
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'amex',
    balanceCol: null,
  },
  {
    name: 'Charles Schwab',
    accountType: 'checking',
    detect: h => h.includes('date') && h.includes('type')
                 && h.includes('check #') && h.includes('withdrawal (-)')
                 && h.includes('deposit (+)'),
    dateCol: 'Date',
    descCol: 'Description',
    debitCol: 'Withdrawal (-)',
    creditCol: 'Deposit (+)',
    splitColumns: true,
    dateFormat: 'MM/DD/YYYY',
    balanceCol: 'Ending Balance',
  },
  {
    name: 'Ally Bank',
    accountType: 'checking',
    detect: h => h.includes('date') && h.includes('time')
                 && h.includes('amount') && h.includes('type') && h.includes('description'),
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    dateFormat: 'YYYY-MM-DD',
    amountSign: 'standard',
    balanceCol: 'Balance',
  },
  {
    name: 'US Bank',
    accountType: 'checking',
    detect: h => h.includes('date') && h.includes('transaction')
                 && h.includes('name') && h.includes('memo') && h.includes('amount'),
    dateCol: 'Date',
    descCol: 'Name',
    amountCol: 'Amount',
    dateFormat: 'MM/DD/YYYY',
    amountSign: 'standard',
    balanceCol: null,
  },
  {
    name: 'Bank (auto-detected)',
    accountType: 'unknown',
    detect: () => true,
    balanceCol: null,
  },
];

// ── Date parsing ──────────────────────────────────────────────────────────────

export function parseDate(str) {
  if (!str) return null;
  str = str.toString().trim()
    .replace(/^["'\uFEFF]+|["']+$/g, '')
    .replace(/\uFEFF/g, '');

  if (!str) return null;

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  const patterns = [
    { re: /^(\d{4})-(\d{2})-(\d{2})/, y:1, m:2, d:3 },
    { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, m:1, d:2, y:3 },
    { re: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, m:1, d:2, y2:3 },
    { re: /^(\d{2})-(\d{2})-(\d{4})/, m:1, d:2, y:3 },
    { re: /^(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/, mon:1, d:2, y:3 },
    { re: /^(\d{1,2})\s+(\w{3,})\s+(\d{4})/, d:1, mon:2, y:3 },
    { re: /^(\d{4})(\d{2})(\d{2})$/, y:1, m:2, d:3 },
  ];

  for (const p of patterns) {
    const match = str.match(p.re);
    if (!match) continue;
    let year = p.y ? parseInt(match[p.y]) : p.y2 ? 2000 + parseInt(match[p.y2]) : null;
    let month = p.m != null ? parseInt(match[p.m]) - 1
                    : p.mon ? MONTHS.indexOf(match[p.mon].toLowerCase().slice(0,3)) : null;
    let day = parseInt(match[p.d]);
    if (year === null || month === null || month < 0 || month > 11) continue;
    if (day < 1 || day > 31) continue;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getFullYear() === year) return date;
  }
  return null;
}

// ── Amount normalization ──────────────────────────────────────────────────────

export function normalizeAmount(str) {
  if (str === null || str === undefined || str === '') return null;
  let s = str.toString()
    .replace(/[$€£¥\s]/g, '')
    .replace(/\(([0-9.,]+)\)/, '-$1');

  // European format: 1.234,56 — dot is thousands sep, comma is decimal
  if (/^-?\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Standard: remove comma thousands separators, then parse
  s = s.replace(/,(?=\d{3})/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function normalizeAmountFromRow(row, config) {
  if (config.splitColumns) {
    const debitRaw = config.debitCol ? row[config.debitCol] : '';
    const creditRaw = config.creditCol ? row[config.creditCol] : '';
    const debit = normalizeAmount(debitRaw) || 0;
    const credit = normalizeAmount(creditRaw) || 0;
    return credit - debit;
  }
  const raw = row[config.amountCol];
  let amount = normalizeAmount(raw);
  if (amount === null) return null;
  switch (config.amountSign) {
    case 'amex':        return -amount;
    case 'bofa_credit': return -amount;
    default:            return amount;
  }
}

// ── Transaction ID ─────────────────────────────────────────────────────────────

export function makeId(date, amount, description) {
  const s = date.toISOString().slice(0,10)
    + '|' + Math.round(Math.abs(amount) * 100)
    + '|' + description.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── Bank fingerprinting ───────────────────────────────────────────────────────

export function detectBank(headers, rows) {
  const h = headers.map(x => (x || '').toString().toLowerCase().trim());
  for (const config of BANK_CONFIGS) {
    if (config.detect(h, rows)) return config;
  }
  return BANK_CONFIGS[BANK_CONFIGS.length - 1]; // fallback
}

// Generic fallback column detection
function autoDetectColumns(headers) {
  const h = headers.map(x => (x || '').toLowerCase().trim());
  const find = (candidates) => {
    for (const c of candidates) {
      const idx = h.findIndex(x => x.includes(c));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    dateCol: find(['transaction date', 'posted date', 'post date', 'trans date', 'date']),
    descCol: find(['description', 'merchant', 'payee', 'name', 'memo', 'details', 'narrative']),
    amountCol: find(['transaction amount', 'amount', 'value', 'debit/credit']),
    debitCol: find(['withdrawal (-)', 'withdrawal', 'debit', 'charge']),
    creditCol: find(['deposit (+)', 'deposit', 'credit', 'payment']),
    balanceCol: find(['running bal', 'running balance', 'ending balance', 'end balance',
      'ledger balance', 'available balance', 'account balance', 'balance']),
  };
}

// ── Opening balance extraction ────────────────────────────────────────────────

export function extractOpeningBalance(rows, config) {
  if (!config || !config.balanceCol) return null;

  const dated = rows
    .map(row => ({
      row,
      date: parseDate(row[config.dateCol]),
      balance: normalizeAmount(row[config.balanceCol]),
    }))
    .filter(r => r.date && r.balance !== null);

  if (dated.length === 0) return null;

  dated.sort((a, b) => a.date - b.date);
  const earliest = dated[0];
  return { balance: earliest.balance, date: earliest.date };
}

// ── Filter ─────────────────────────────────────────────────────────────────────

export function shouldInclude(tx) {
  const now = Date.now();
  const cutoffOld = now - 24 * 30 * 24 * 60 * 60 * 1000; // ~24 months
  const cutoffFuture = now + 5 * 24 * 60 * 60 * 1000;    // 5 days ahead
  const t = tx.date.getTime();
  return t >= cutoffOld && t <= cutoffFuture;
}

// ── Main parse function ────────────────────────────────────────────────────────

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      encoding: 'UTF-8',
      transformHeader: h => h.trim().replace(/^["'\uFEFF]+|["']+$/g, ''),
      complete: (results) => {
        try {
          const parsed = processResults(results, file.name);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

function processResults(results, filename) {
  const rows = results.data;
  if (!rows || rows.length === 0) {
    throw new Error('No data rows found in this file.');
  }

  const headers = Object.keys(rows[0]);
  let config = detectBank(headers, rows);

  // For generic fallback, auto-detect columns
  let effectiveConfig = { ...config };
  if (config.name === 'Bank (auto-detected)') {
    const auto = autoDetectColumns(headers);
    effectiveConfig.dateCol = auto.dateCol;
    effectiveConfig.descCol = auto.descCol;
    if (auto.debitCol && auto.creditCol) {
      effectiveConfig.debitCol = auto.debitCol;
      effectiveConfig.creditCol = auto.creditCol;
      effectiveConfig.splitColumns = true;
    } else {
      effectiveConfig.amountCol = auto.amountCol;
      effectiveConfig.amountSign = 'standard';
    }
    if (auto.balanceCol) effectiveConfig.balanceCol = auto.balanceCol;

    // Guess account type from balance col presence
    if (auto.balanceCol) effectiveConfig.accountType = 'checking';
    else effectiveConfig.accountType = 'credit_card';
  }

  const transactions = [];
  let parseErrors = 0;

  for (const row of rows) {
    let dateStr, descStr, amount;

    if (effectiveConfig.positional) {
      const vals = Object.values(row);
      dateStr = vals[0];
      amount = normalizeAmount(vals[1]);
      descStr = vals[4] || '';
    } else {
      dateStr = effectiveConfig.dateCol ? row[effectiveConfig.dateCol] : null;
      descStr = effectiveConfig.descCol ? row[effectiveConfig.descCol] : '';
      amount = normalizeAmountFromRow(row, effectiveConfig);
    }

    if (!dateStr || amount === null) { parseErrors++; continue; }
    const date = parseDate(dateStr);
    if (!date) { parseErrors++; continue; }
    const description = (descStr || '').toString().trim();
    if (!description) { parseErrors++; continue; }

    const tx = {
      id: makeId(date, amount, description),
      date,
      description,
      amount,
      category: 'Other',
      accountType: effectiveConfig.accountType,
      bank: effectiveConfig.name,
      sourceFile: filename,
      isTransfer: false,
      isDuplicate: false,
    };

    if (shouldInclude(tx)) {
      transactions.push(tx);
    }
  }

  if (transactions.length === 0) {
    throw new Error(`No valid transactions found. (${parseErrors} rows skipped)`);
  }

  // Extract opening balance
  const balInfo = extractOpeningBalance(rows, effectiveConfig);

  // Compute date range
  const sorted = [...transactions].sort((a, b) => a.date - b.date);
  const dateRange = {
    start: sorted[0].date,
    end: sorted[sorted.length - 1].date,
  };

  const fileMeta = {
    filename,
    bank: effectiveConfig.name,
    accountType: effectiveConfig.accountType,
    transactionCount: transactions.length,
    dateRange,
    openingBalance: balInfo ? balInfo.balance : null,
    openingBalanceDate: balInfo ? balInfo.date : null,
    hasBalanceColumn: !!effectiveConfig.balanceCol,
  };

  return { transactions, fileMeta };
}
