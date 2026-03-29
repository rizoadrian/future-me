// ── Helpers ───────────────────────────────────────────────────────────────────

export function isBiweeklyFriday(date, referenceDate) {
  if (date.getDay() !== 5) return false;
  // Anchor to the first Friday on or after the reference date
  const firstFriday = new Date(referenceDate);
  while (firstFriday.getDay() !== 5) {
    firstFriday.setDate(firstFriday.getDate() + 1);
  }
  const diff = Math.round((date - firstFriday) / 86400000);
  return diff >= 0 && diff % 14 === 0;
}

export function fmtTick(d) {
  return d.toLocaleString('default', { month: 'short' }) + ' ' + d.getDate();
}

// ── Historical running balance ─────────────────────────────────────────────────

export function buildHistoricalBalance(transactions, openingBalance, openingDate) {
  if (openingBalance === null || openingBalance === undefined || !openingDate) return null;

  const active = transactions.filter(tx => !tx.isTransfer && !tx.isDuplicate);
  const sorted = [...active].sort((a, b) => a.date - b.date);
  if (sorted.length === 0) return null;

  const inRange = sorted.filter(tx => tx.date >= openingDate);
  if (inRange.length === 0) return null;

  const startDate = openingDate;
  const endDate = inRange[inRange.length - 1].date;
  const days = Math.round((endDate - startDate) / 86400000) + 1;
  if (days <= 0) return null;

  const dailyMap = {};
  inRange.forEach(tx => {
    const key = tx.date.toISOString().slice(0, 10);
    dailyMap[key] = (dailyMap[key] || 0) + tx.amount;
  });

  const labels = [], data = [], dateObjs = [];
  let balance = openingBalance;
  const d = new Date(startDate);
  const spanDays = days;

  for (let i = 0; i < days; i++) {
    const key = d.toISOString().slice(0, 10);
    balance += (dailyMap[key] || 0);
    dateObjs.push(new Date(d));

    let label = '';
    if (spanDays <= 186) {
      label = isBiweeklyFriday(d, startDate) ? fmtTick(d) : '';
    } else {
      label = d.getDate() === 15 ? fmtTick(d) : '';
    }
    labels.push(label);
    data.push(Math.round(balance));
    d.setDate(d.getDate() + 1);
  }

  return { labels, data, dateObjs, spanDays };
}

// Build label array helper for tests
export function buildLabelArray(days, startDate) {
  const spanDays = days;
  const labels = [];
  const d = new Date(startDate);
  for (let i = 0; i < days; i++) {
    let label = '';
    if (spanDays <= 186) {
      label = isBiweeklyFriday(d, startDate) ? fmtTick(d) : '';
    } else {
      label = d.getDate() === 15 ? fmtTick(d) : '';
    }
    labels.push(label);
    d.setDate(d.getDate() + 1);
  }
  return labels;
}

// ── 6-month forward projection ─────────────────────────────────────────────────

export function buildProjection(recurringItems, categoryOverrides, startBalance, startDate) {
  const DAYS = 182;
  const labels = [], data = [], dateObjs = [];
  let balance = startBalance;
  const d = new Date(startDate);

  for (let i = 0; i < DAYS; i++) {
    const dom = d.getDate();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    let dailyNet = 0;

    recurringItems.forEach(item => {
      if (item.frequency === 'monthly' && dom === item.typicalDayOfMonth) {
        dailyNet += item.averageAmount;
      }
      if (item.frequency === 'biweekly') {
        const daysSince = Math.round((d - item.firstDate) / 86400000);
        if (daysSince >= 0 && daysSince % 14 === 0) dailyNet += item.averageAmount;
      }
      if (item.frequency === 'weekly') {
        const daysSince = Math.round((d - item.firstDate) / 86400000);
        if (daysSince >= 0 && daysSince % 7 === 0) dailyNet += item.averageAmount;
      }
    });

    const recurringCats = new Set(recurringItems.map(r => r.category));
    Object.entries(categoryOverrides).forEach(([cat, monthlyAmt]) => {
      if (!recurringCats.has(cat)) dailyNet += monthlyAmt / daysInMonth;
    });

    balance += dailyNet;
    dateObjs.push(new Date(d));
    labels.push(isBiweeklyFriday(d, startDate) ? fmtTick(d) : '');
    data.push(Math.round(balance));
    d.setDate(d.getDate() + 1);
  }

  return { labels, data, dateObjs };
}

// ── Recurring transaction detection ───────────────────────────────────────────

export function detectRecurring(transactions) {
  const groups = {};
  transactions
    .filter(tx => !tx.isTransfer && !tx.isDuplicate)
    .forEach(tx => {
      const key = tx.description.toLowerCase().replace(/[^a-z]/g, '').slice(0, 18);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });

  const recurring = [];
  Object.values(groups).forEach(txs => {
    if (txs.length < 3) return;
    const months = new Set(txs.map(tx => tx.date.toISOString().slice(0, 7)));
    if (months.size < 2) return;

    const sorted = [...txs].sort((a, b) => a.date - b.date);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(Math.round((sorted[i].date - sorted[i-1].date) / 86400000));
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];

    let frequency;
    if (medianGap <= 8) frequency = 'weekly';
    else if (medianGap <= 16) frequency = 'biweekly';
    else if (medianGap <= 35) frequency = 'monthly';
    else if (medianGap >= 330) frequency = 'annual';
    else return;

    const avgAmount = txs.reduce((sum, tx) => sum + tx.amount, 0) / txs.length;
    const days = txs.map(tx => tx.date.getDate());
    const sortedDays = [...days].sort((a, b) => a - b);
    const typicalDay = sortedDays[Math.floor(sortedDays.length / 2)];

    recurring.push({
      description: sorted[0].description,
      category: sorted[0].category,
      frequency,
      averageAmount: avgAmount,
      typicalDayOfMonth: typicalDay,
      firstDate: sorted[0].date,
      occurrences: txs.length,
    });
  });

  return recurring;
}

// ── Monthly income / expense calculators (for stat cards & tests) ──────────────

export function calcMonthlyIncome(transactions) {
  const active = transactions.filter(tx => !tx.isTransfer && !tx.isDuplicate && tx.amount > 0);
  if (!active.length) return 0;
  const earliest = active.reduce((a, b) => a.date < b.date ? a : b);
  const latest = active.reduce((a, b) => a.date > b.date ? a : b);
  const months = Math.max(1,
    (latest.date.getFullYear() - earliest.date.getFullYear()) * 12
    + (latest.date.getMonth() - earliest.date.getMonth()) + 1
  );
  const total = active.reduce((sum, tx) => sum + tx.amount, 0);
  return total / months;
}

export function calcMonthlyExpenses(transactions) {
  const active = transactions.filter(tx => !tx.isTransfer && !tx.isDuplicate && tx.amount < 0);
  if (!active.length) return 0;
  const earliest = active.reduce((a, b) => a.date < b.date ? a : b);
  const latest = active.reduce((a, b) => a.date > b.date ? a : b);
  const months = Math.max(1,
    (latest.date.getFullYear() - earliest.date.getFullYear()) * 12
    + (latest.date.getMonth() - earliest.date.getMonth()) + 1
  );
  const total = active.reduce((sum, tx) => sum + tx.amount, 0);
  return total / months;
}

// ── Find zero-crossing date ───────────────────────────────────────────────────

export function findZeroCrossing(data, dateObjs) {
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 0) {
      return dateObjs[i];
    }
  }
  return null;
}

export function formatDate(d) {
  if (!d) return 'Never';
  return d.toLocaleDateString('default', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateFull(d) {
  if (!d) return '';
  return d.toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
