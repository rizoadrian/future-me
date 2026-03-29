// ── Credit card payment detection ─────────────────────────────────────────────

const DEBIT_KEYWORDS = [
  'autopay', 'auto pay', 'credit card payment', 'card payment', 'online payment',
  'bill payment', 'payment to ', 'citi payment', 'chase payment', 'amex payment',
  'capital one payment', 'discover payment', 'synchrony payment', 'barclays payment',
  'apple card payment', 'transfer to', 'xfer to', 'payment - thank you',
];

const CREDIT_KEYWORDS = [
  'payment received', 'payment thank you', 'thank you payment', 'autopay payment',
  'mobile payment', 'online pmt', 'electronic payment', 'payment - thank you',
  'web payment', 'phone payment', 'auto payment', 'direct debit payment', 'ach payment',
];

// Phrases that should NOT be flagged as CC payments even if they match above
const EXCLUSION_PATTERNS = [
  /venmo.*?(to|from|payment)\s+[a-z]/i,
  /zelle.*?(to|from)\s+[a-z]/i,
  /paypal.*?(to|from)\s+[a-z]/i,
];

function normalizeDesc(description) {
  return description.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isCCPaymentCandidate(tx) {
  // Check exclusions first
  for (const re of EXCLUSION_PATTERNS) {
    if (re.test(tx.description)) return false;
  }

  const desc = normalizeDesc(tx.description);

  if (tx.accountType === 'checking' || tx.accountType === 'savings') {
    if (tx.amount >= 0) return false; // debits are negative
    return DEBIT_KEYWORDS.some(kw => desc.includes(kw));
  }

  if (tx.accountType === 'credit_card') {
    if (tx.amount <= 0) return false; // credits are positive
    return CREDIT_KEYWORDS.some(kw => desc.includes(kw));
  }

  return false;
}

// ── Intra-account transfer detection ──────────────────────────────────────────

const TRANSFER_KEYWORDS = [
  'transfer', 'xfer', 'internal transfer', 'account transfer', 'wire transfer',
];

function isIntraTransfer(tx) {
  const desc = normalizeDesc(tx.description);
  return TRANSFER_KEYWORDS.some(kw => desc.includes(kw));
}

// ── Pair matching ──────────────────────────────────────────────────────────────

export function findTransferPairs(transactions) {
  const candidates = transactions.filter(tx => isCCPaymentCandidate(tx));
  const pairs = [];
  const used = new Set();

  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const a = candidates[i];

    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const b = candidates[j];

      // Must be different account types
      const aIsChecking = a.accountType === 'checking' || a.accountType === 'savings';
      const bIsChecking = b.accountType === 'checking' || b.accountType === 'savings';
      if (aIsChecking === bIsChecking) continue;

      // Amounts within 2% of each other (absolute values)
      const absA = Math.abs(a.amount);
      const absB = Math.abs(b.amount);
      if (absA === 0 || absB === 0) continue;
      const diff = Math.abs(absA - absB) / Math.max(absA, absB);
      if (diff > 0.02) continue;

      // Dates within 5 calendar days
      const daysDiff = Math.abs((a.date - b.date) / 86400000);
      if (daysDiff > 5) continue;

      pairs.push([a, b]);
      used.add(i);
      used.add(j);
      break;
    }
  }

  return pairs;
}

// ── Main detection function ────────────────────────────────────────────────────

export function detectTransfers(transactions) {
  const pairs = findTransferPairs(transactions);

  // Mark both sides of CC payment pairs
  for (const [a, b] of pairs) {
    a.isTransfer = true;
    b.isTransfer = true;
  }

  // Mark intra-account transfers (matching opposite transaction within 3 days)
  const byKey = new Map();
  transactions.forEach(tx => {
    if (!tx.isTransfer && isIntraTransfer(tx)) {
      const key = Math.round(Math.abs(tx.amount) * 100).toString();
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(tx);
    }
  });

  byKey.forEach(group => {
    // Find opposite-sign pairs within 3 days on the same account type
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.accountType !== b.accountType) continue; // different accounts = not same-account transfer
        const daysDiff = Math.abs((a.date - b.date) / 86400000);
        if (daysDiff <= 3 && a.amount * b.amount < 0) {
          a.isTransfer = true;
          b.isTransfer = true;
        }
      }
    }
  });

  return { transactions, transferPairs: pairs };
}

export function processTransfers(transactions) {
  const { transactions: tagged } = detectTransfers(transactions);
  return tagged;
}
