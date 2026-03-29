// ── Deduplication key ─────────────────────────────────────────────────────────

export function makeDedupeKey(tx) {
  const desc = tx.description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return `${tx.date.toISOString().slice(0,10)}|${Math.round(Math.abs(tx.amount)*100)}|${desc}`;
}

// ── Overlap date range ─────────────────────────────────────────────────────────

export function getOverlapRange(fileA, fileB) {
  const start = new Date(Math.max(fileA.start, fileB.start));
  const end = new Date(Math.min(fileA.end, fileB.end));
  return start <= end ? { start, end } : null;
}

// ── Main deduplicate function ─────────────────────────────────────────────────

/**
 * @param {Array} transactions  - flat array of all transactions from all files
 * @param {Object} fileRanges   - { filename: { start, end } } date ranges per file
 */
export function deduplicate(transactions, fileRanges) {
  const seen = new Map(); // key → tx
  let removed = 0;

  // Step 1: within-file deduplication (exact duplicate rows in same file)
  const byFile = new Map();
  transactions.forEach(tx => {
    if (!byFile.has(tx.sourceFile)) byFile.set(tx.sourceFile, []);
    byFile.get(tx.sourceFile).push(tx);
  });

  byFile.forEach(fileTxs => {
    const fileKeys = new Map();
    fileTxs.forEach(tx => {
      const key = makeDedupeKey(tx);
      if (fileKeys.has(key)) {
        tx.isDuplicate = true;
        removed++;
      } else {
        fileKeys.set(key, tx);
      }
    });
  });

  // Step 2: cross-file deduplication within overlap windows
  // Group by accountType, only cross-file dedup same accountType
  const fileNames = Object.keys(fileRanges);

  for (let i = 0; i < fileNames.length; i++) {
    for (let j = i + 1; j < fileNames.length; j++) {
      const fileA = fileRanges[fileNames[i]];
      const fileB = fileRanges[fileNames[j]];
      if (!fileA || !fileB) continue;

      const overlap = getOverlapRange(fileA, fileB);
      if (!overlap) continue;

      // Get non-duplicate transactions from each file within overlap
      const txA = transactions.filter(tx =>
        tx.sourceFile === fileNames[i]
        && !tx.isDuplicate
        && tx.date >= overlap.start
        && tx.date <= overlap.end
      );
      const txB = transactions.filter(tx =>
        tx.sourceFile === fileNames[j]
        && !tx.isDuplicate
        && tx.date >= overlap.start
        && tx.date <= overlap.end
      );

      // Index file B by dedupe key + accountType
      const bIndex = new Map();
      txB.forEach(tx => {
        const key = makeDedupeKey(tx) + '|' + tx.accountType;
        if (!bIndex.has(key)) bIndex.set(key, []);
        bIndex.get(key).push(tx);
      });

      txA.forEach(txA_item => {
        const key = makeDedupeKey(txA_item) + '|' + txA_item.accountType;
        const matches = bIndex.get(key);
        if (matches && matches.length > 0) {
          // Same key + same accountType → mark later-uploaded as duplicate
          const match = matches.shift(); // consume
          match.isDuplicate = true;
          removed++;
        }
      });
    }
  }

  return transactions;
}

export function getDuplicatesRemoved(transactions) {
  return transactions.filter(tx => tx.isDuplicate).length;
}
