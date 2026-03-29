import { parseCSV } from './modules/csvParser.js';
import { detectTransfers } from './modules/transferDetector.js';
import { deduplicate, getDuplicatesRemoved } from './modules/deduplicator.js';
import { categorizeAll, computeCategoryMonthlyAverages, CATEGORY_COLORS, ALL_CATEGORIES, fuzzyMatch } from './modules/categorizer.js';
import {
  buildHistoricalBalance,
  buildProjection,
  detectRecurring,
  calcMonthlyIncome,
  calcMonthlyExpenses,
  findZeroCrossing,
  formatDate,
  formatDateFull,
} from './modules/projections.js';
import {
  renderSpendingHistory,
  renderCashflowHistory,
  renderDonut,
  renderProjection,
} from './modules/charts.js';
import { STATE, getSpendingTransactions, getCheckingCashflowTransactions, resetState } from './modules/state.js';

// ── Screen transitions ─────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.classList.add('fade-in');
  }
}

// ── Welcome screen ─────────────────────────────────────────────────────────────

const consentCheckbox = document.getElementById('consent-checkbox');
const btnGetStarted = document.getElementById('btn-get-started');

consentCheckbox.addEventListener('change', () => {
  btnGetStarted.disabled = !consentCheckbox.checked;
  if (consentCheckbox.checked) {
    btnGetStarted.classList.add('enabled-anim');
    setTimeout(() => btnGetStarted.classList.remove('enabled-anim'), 400);
  }
});

btnGetStarted.addEventListener('click', () => {
  showScreen('screen-upload');
});

// ── File upload handling ───────────────────────────────────────────────────────

const pendingFiles = []; // { file, section }

function setupDropZone(dropZoneEl, inputEl, section) {
  if (!dropZoneEl || !inputEl) return;

  dropZoneEl.addEventListener('dragover', e => {
    e.preventDefault();
    dropZoneEl.classList.add('drag-over');
  });
  dropZoneEl.addEventListener('dragleave', () => {
    dropZoneEl.classList.remove('drag-over');
  });
  dropZoneEl.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneEl.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files), section);
  });
  inputEl.addEventListener('change', () => {
    handleFiles(Array.from(inputEl.files), section);
    inputEl.value = '';
  });
}

// Set up all drop zones
setupDropZone(
  document.getElementById('drop-zone-cashflow-inner'),
  document.getElementById('upload-cashflow'),
  'cashflow'
);
setupDropZone(
  document.getElementById('drop-zone-spending-inner'),
  document.getElementById('upload-spending'),
  'spending'
);
setupDropZone(
  document.getElementById('drop-zone-warn'),
  document.getElementById('upload-warn'),
  'cashflow'
);
setupDropZone(
  document.getElementById('drop-zone-cashflow-placeholder'),
  document.getElementById('upload-cashflow-placeholder'),
  'cashflow'
);
setupDropZone(
  document.getElementById('drop-zone-projection-placeholder'),
  document.getElementById('upload-projection-placeholder'),
  'cashflow'
);

// Page-level drag and drop
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
  if (files.length) handleFiles(files, 'spending');
});

async function handleFiles(files, hintSection) {
  const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
  if (!csvFiles.length) return;

  for (const file of csvFiles) {
    await processFile(file, hintSection);
  }

  finalizePipeline();
}

function makeFileCard(file) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.id = `file-card-${sanitizeId(file.name)}`;
  card.innerHTML = `
    <div class="file-progress-wrap"><div class="file-progress-bar" id="prog-${sanitizeId(file.name)}"></div></div>
    <div class="file-card-top" style="margin-top:10px">
      <div class="file-card-status" id="status-${sanitizeId(file.name)}">
        <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
          <circle cx="12" cy="12" r="10" stroke="#e5e2dc" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke="#9c9a92" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="file-card-meta">
        <div class="file-card-name">${escapeHtml(file.name)}</div>
        <div class="file-card-details" id="details-${sanitizeId(file.name)}">Parsing…</div>
      </div>
    </div>
  `;
  document.getElementById('file-list').appendChild(card);

  // Animate progress bar
  setTimeout(() => {
    const bar = document.getElementById(`prog-${sanitizeId(file.name)}`);
    if (bar) bar.style.width = '85%';
  }, 50);

  return card;
}

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function processFile(file, hintSection) {
  const card = makeFileCard(file);

  try {
    const { transactions, fileMeta } = await parseCSV(file);

    // Check if dropped in wrong section — gently correct
    let correctionNote = '';
    if (hintSection === 'cashflow' && fileMeta.accountType === 'credit_card') {
      correctionNote = `<div class="correction-notice">Looks like this is a credit card — we've moved it to your spending accounts.</div>`;
    } else if (hintSection === 'spending' && fileMeta.accountType === 'checking') {
      correctionNote = `<div class="correction-notice">This looks like a checking account — we'll use it to power your cashflow charts.</div>`;
    }

    // Merge into STATE
    STATE.transactions.push(...transactions);
    STATE.files.push(fileMeta);

    // Update opening balance if checking with balance column
    if (fileMeta.accountType === 'checking' && fileMeta.openingBalance !== null) {
      if (STATE.openingBalance === null) {
        STATE.openingBalance = fileMeta.openingBalance;
        STATE.openingBalanceDate = fileMeta.openingBalanceDate;
        STATE.openingBalanceBank = fileMeta.bank;
      } else {
        // Multiple checking accounts: sum opening balances; use earliest date
        STATE.openingBalance += fileMeta.openingBalance;
        if (fileMeta.openingBalanceDate < STATE.openingBalanceDate) {
          STATE.openingBalanceDate = fileMeta.openingBalanceDate;
          STATE.openingBalanceBank = fileMeta.bank;
        }
      }
    }

    // Complete progress bar
    const bar = document.getElementById(`prog-${sanitizeId(file.name)}`);
    if (bar) bar.style.width = '100%';

    // Build success UI
    const typeLabel = fileMeta.accountType === 'checking' ? 'Checking' :
                      fileMeta.accountType === 'credit_card' ? 'Credit Card' :
                      fileMeta.accountType === 'savings' ? 'Savings' : 'Account';
    const badgeClass = fileMeta.accountType === 'checking' ? 'badge-checking' : 'badge-credit';

    const dateRangeTxt = `${fileMeta.dateRange.start.toLocaleDateString('default',{month:'short',year:'numeric'})} – ${fileMeta.dateRange.end.toLocaleDateString('default',{month:'short',year:'numeric'})}`;

    let extraBadges = '';
    if (fileMeta.openingBalance !== null) {
      extraBadges += `<div class="file-card-balance">Opening balance: ${fmtDollar(fileMeta.openingBalance)} detected</div>`;
    }

    const statusEl = document.getElementById(`status-${sanitizeId(file.name)}`);
    if (statusEl) {
      statusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#e8f2ed" stroke="#2a5c45" stroke-width="1.5"/><path d="M7 12l3.5 3.5L17 8" stroke="#2a5c45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    const detailsEl = document.getElementById(`details-${sanitizeId(file.name)}`);
    if (detailsEl) {
      detailsEl.innerHTML = `
        <span class="badge ${badgeClass}">${typeLabel}</span>
        <span>${escapeHtml(fileMeta.bank)}</span>
        <span>${fileMeta.transactionCount} transactions</span>
        <span>${dateRangeTxt}</span>
      `;
    }

    const metaEl = card.querySelector('.file-card-meta');
    if (metaEl && extraBadges) {
      metaEl.insertAdjacentHTML('beforeend', extraBadges);
    }
    if (correctionNote && metaEl) {
      metaEl.insertAdjacentHTML('beforeend', correctionNote);
    }

  } catch (err) {
    const bar = document.getElementById(`prog-${sanitizeId(file.name)}`);
    if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--danger)'; }
    card.classList.add('error');

    const statusEl = document.getElementById(`status-${sanitizeId(file.name)}`);
    if (statusEl) {
      statusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#fdf0ef" stroke="#c0392b" stroke-width="1.5"/><path d="M8 8l8 8M16 8l-8 8" stroke="#c0392b" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    }
    const detailsEl = document.getElementById(`details-${sanitizeId(file.name)}`);
    if (detailsEl) {
      detailsEl.innerHTML = `<span class="file-card-error">${escapeHtml(err.message)} — check file format and try again.</span>`;
    }
  }
}

// ── Pipeline execution ─────────────────────────────────────────────────────────

function finalizePipeline() {
  if (!STATE.transactions.length) return;

  // Build file ranges for deduplicator
  const fileRanges = {};
  STATE.files.forEach(f => { fileRanges[f.filename] = f.dateRange; });

  // Run pipeline
  deduplicate(STATE.transactions, fileRanges);
  STATE.duplicatesRemoved = getDuplicatesRemoved(STATE.transactions);

  const { transferPairs } = detectTransfers(STATE.transactions);
  STATE.transferPairs = transferPairs;

  // Categorize Pipeline A transactions
  const spendingTxs = getSpendingTransactions();
  categorizeAll(spendingTxs);
  // Also copy categories back (they're the same objects)

  // Category averages from Pipeline A
  STATE.categoryMonthlyAverages = computeCategoryMonthlyAverages(spendingTxs);

  // Pipeline B
  const checkingTxs = getCheckingCashflowTransactions();
  STATE.hasCheckingData = STATE.files.some(f => f.accountType === 'checking');
  STATE.hasBalanceData = STATE.hasCheckingData && STATE.openingBalance !== null;

  if (STATE.hasBalanceData) {
    STATE.startBalanceForProjection = STATE.openingBalance;
  }

  // Recurring detection from Pipeline B
  STATE.recurringItems = detectRecurring(checkingTxs);

  // Category overrides = copy of averages as starting point
  if (Object.keys(STATE.categoryOverrides).length === 0) {
    STATE.categoryOverrides = { ...STATE.categoryMonthlyAverages };
  }

  // Date ranges
  if (STATE.transactions.length) {
    const sorted = [...STATE.transactions].sort((a, b) => a.date - b.date);
    STATE.dateRange.start = sorted[0].date;
    STATE.dateRange.end = sorted[sorted.length - 1].date;
  }
  if (checkingTxs.length) {
    const ckSorted = [...checkingTxs].sort((a, b) => a.date - b.date);
    STATE.checkingDateRange.start = ckSorted[0].date;
    STATE.checkingDateRange.end = ckSorted[ckSorted.length - 1].date;
  }

  // Other transactions
  STATE.otherTransactions = spendingTxs
    .filter(tx => tx.category === 'Other')
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  updateDataQualitySummary();
  updateAnalyzeButton();
  updateNoCheckingWarning();
}

function updateNoCheckingWarning() {
  const warn = document.getElementById('no-checking-warning');
  if (!warn) return;
  const hasFiles = STATE.files.length > 0;
  const hasChecking = STATE.hasCheckingData;
  if (hasFiles && !hasChecking) {
    warn.style.display = 'flex';
  } else {
    warn.style.display = 'none';
  }
}

function updateDataQualitySummary() {
  const el = document.getElementById('data-quality');
  if (!el || !STATE.files.length) return;

  const totalTx = getSpendingTransactions().length;
  const transfersExcluded = STATE.transferPairs.length * 2;

  let openingBalHtml = '';
  if (STATE.openingBalance !== null) {
    openingBalHtml = `<div class="dq-row">
      <span class="dq-label">Opening balance</span>
      <span class="dq-value accent">Detected from ${escapeHtml(STATE.openingBalanceBank)}: ${fmtDollar(STATE.openingBalance)}</span>
    </div>`;
  } else if (STATE.hasCheckingData) {
    openingBalHtml = `<div class="dq-row">
      <span class="dq-label">Opening balance</span>
      <span class="dq-value">Not detected — enter on next screen</span>
    </div>`;
  }

  const dateRangeTxt = STATE.dateRange.start
    ? `${STATE.dateRange.start.toLocaleDateString('default',{month:'short',year:'numeric'})} – ${STATE.dateRange.end.toLocaleDateString('default',{month:'short',year:'numeric'})}`
    : '—';

  el.innerHTML = `
    <div class="dq-row">
      <span class="dq-label">Total transactions loaded</span>
      <span class="dq-value">${totalTx.toLocaleString()}</span>
    </div>
    <div class="dq-row">
      <span class="dq-label">Date range</span>
      <span class="dq-value">${dateRangeTxt}</span>
    </div>
    ${openingBalHtml}
    ${transfersExcluded ? `<div class="dq-row">
      <span class="dq-label">CC payments excluded</span>
      <span class="dq-value">${transfersExcluded} (prevents double-counting)</span>
    </div>` : ''}
    ${STATE.duplicatesRemoved ? `<div class="dq-row">
      <span class="dq-label">Duplicates removed</span>
      <span class="dq-value">${STATE.duplicatesRemoved}</span>
    </div>` : ''}
  `;
  el.style.display = 'flex';
}

function updateAnalyzeButton() {
  const btn = document.getElementById('btn-analyze');
  if (!btn) return;
  if (!STATE.files.length) { btn.style.display = 'none'; return; }

  const successCount = STATE.files.length;
  if (successCount === 0) { btn.style.display = 'none'; return; }

  btn.style.display = 'inline-flex';

  if (!STATE.hasCheckingData) {
    btn.innerHTML = `Continue with spending data only →
      <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    btn.innerHTML = `Analyze my finances →
      <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
}

document.getElementById('btn-analyze').addEventListener('click', () => {
  showScreen('screen-dashboard');
  renderDashboard();
});

// ── Dollar formatting ─────────────────────────────────────────────────────────

function fmtDollar(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDollarFull(n) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Dashboard rendering ───────────────────────────────────────────────────────

function renderDashboard() {
  renderNavMeta();
  renderStatCards();
  renderSpendingHistoryPanel();
  renderCashflowPanel();
  renderDonutPanel();
  renderCategoryEditor();
  renderOtherPanel();
  renderProjectionPanel();
}

function renderNavMeta() {
  const el = document.getElementById('nav-meta');
  if (!el) return;
  const files = STATE.files.length;
  const txs = getSpendingTransactions().length;
  const range = STATE.dateRange.start
    ? `${STATE.dateRange.start.toLocaleDateString('default',{month:'short',year:'numeric'})} – ${STATE.dateRange.end.toLocaleDateString('default',{month:'short',year:'numeric'})}`
    : '';
  el.textContent = `${range} · ${files} file${files!==1?'s':''} · ${txs.toLocaleString()} transactions`;
}

function renderStatCards() {
  const spendingTxs = getSpendingTransactions();

  const avgIncome = calcMonthlyIncome(spendingTxs);
  const avgExpenses = calcMonthlyExpenses(spendingTxs);
  const net = avgIncome + avgExpenses; // expenses are negative

  // Zero-crossing from projection
  const zeroCrossDate = computeZeroCrossDate();

  const statIncome = document.getElementById('stat-income');
  const statExpenses = document.getElementById('stat-expenses');
  const statNet = document.getElementById('stat-net');
  const statNeg = document.getElementById('stat-negative');

  if (statIncome) {
    statIncome.querySelector('.stat-value').textContent = fmtDollar(avgIncome);
    statIncome.querySelector('.stat-value').className = 'stat-value positive';
  }
  if (statExpenses) {
    statExpenses.querySelector('.stat-value').textContent = fmtDollar(Math.abs(avgExpenses));
    statExpenses.querySelector('.stat-value').className = 'stat-value';
  }
  if (statNet) {
    const v = statNet.querySelector('.stat-value');
    v.textContent = (net >= 0 ? '+' : '') + fmtDollar(net);
    v.className = 'stat-value ' + (net >= 0 ? 'positive' : 'negative');
  }
  if (statNeg) {
    const v = statNeg.querySelector('.stat-value');
    if (zeroCrossDate) {
      v.textContent = formatDate(zeroCrossDate);
      v.className = 'stat-value negative';
    } else {
      v.textContent = 'Never';
      v.className = 'stat-value positive';
    }
  }
}

function computeZeroCrossDate() {
  if (!STATE.hasCheckingData) return null;
  const overrides = Object.keys(STATE.categoryOverrides).length
    ? STATE.categoryOverrides
    : STATE.categoryMonthlyAverages;
  const startBal = STATE.startBalanceForProjection || 0;
  const proj = buildProjection(STATE.recurringItems, overrides, startBal, new Date());
  return findZeroCrossing(proj.data, proj.dateObjs);
}

function renderSpendingHistoryPanel() {
  const spendingTxs = getSpendingTransactions();
  renderSpendingHistory(spendingTxs, STATE.dateRange);
}

function renderCashflowPanel() {
  const cashflowWrap = document.getElementById('cashflow-chart-wrap');
  const placeholder = document.getElementById('cashflow-placeholder');

  if (!STATE.hasBalanceData) {
    if (cashflowWrap) cashflowWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    return;
  }

  if (cashflowWrap) cashflowWrap.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';

  const checkingTxs = getCheckingCashflowTransactions();
  const historicalData = buildHistoricalBalance(
    checkingTxs,
    STATE.openingBalance,
    STATE.openingBalanceDate
  );

  if (!historicalData) {
    if (cashflowWrap) cashflowWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    return;
  }

  // Set canvas height based on span
  const canvas = document.getElementById('chart-cashflow-history');
  if (canvas) canvas.parentElement.style.height = '280px';

  renderCashflowHistory(historicalData);
}

function renderDonutPanel() {
  const spendingTxs = getSpendingTransactions();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const monthLabel = document.getElementById('current-month-label');
  if (monthLabel) {
    monthLabel.textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  renderDonut(spendingTxs, currentMonth);
}

function renderCategoryEditor() {
  const el = document.getElementById('category-editor');
  if (!el) return;

  const averages = STATE.categoryMonthlyAverages;
  const overrides = STATE.categoryOverrides;

  const income = ['Income'];
  const expenses = ALL_CATEGORIES.filter(c => c !== 'Income' && c !== 'Other');

  function buildSection(cats, label) {
    let html = `<div class="cat-section-head">${label}</div>`;
    for (const cat of cats) {
      const base = averages[cat] || 0;
      const current = overrides[cat] !== undefined ? overrides[cat] : base;
      const delta = current - base;
      const deltaHtml = delta !== 0
        ? `<span class="cat-delta ${delta > 0 ? 'pos' : 'neg'}">${delta > 0 ? '+' : ''}${fmtDollar(delta)}/mo</span>`
        : `<span class="cat-delta"></span>`;
      const isModified = Math.abs(current - base) > 0.5;
      html += `
        <div class="cat-row" data-cat="${cat}">
          <span class="cat-name">${cat}</span>
          ${deltaHtml}
          <input type="text"
            class="cat-input${isModified ? ' modified' : ''}"
            data-cat="${cat}"
            value="${fmtDollar(current).replace('$','').replace('−','').replace('-','')}"
            data-sign="${current >= 0 ? 1 : -1}"
          />
        </div>`;
    }
    return html;
  }

  el.innerHTML = buildSection(income, 'Income') + buildSection(expenses, 'Expenses');

  // Event listeners
  el.querySelectorAll('.cat-input').forEach(input => {
    input.addEventListener('change', () => {
      const cat = input.dataset.cat;
      const sign = parseFloat(input.dataset.sign) || 1;
      const raw = input.value.replace(/[$,]/g, '');
      const val = parseFloat(raw) * sign;
      if (!isNaN(val)) {
        STATE.categoryOverrides[cat] = val;
        renderCategoryEditor();
        rebuildProjection();
      }
    });
  });
}

document.getElementById('btn-reset-categories').addEventListener('click', () => {
  STATE.categoryOverrides = { ...STATE.categoryMonthlyAverages };
  renderCategoryEditor();
  rebuildProjection();
  renderStatCards();
});

// ── Other panel ────────────────────────────────────────────────────────────────

let otherDisplayCount = 15;

function renderOtherPanel() {
  const panel = document.getElementById('panel-other');
  const other = STATE.otherTransactions;

  if (!other || other.length === 0) {
    if (panel) panel.style.display = 'none';
    return;
  }

  if (panel) panel.style.display = 'block';

  // Badge
  const badge = document.getElementById('other-badge');
  if (badge) badge.textContent = other.length;

  // Suggestions
  const hasSuggestions = other.some(tx => {
    const s = fuzzyMatch(tx.description);
    return s && s !== 'Other';
  });
  const actionsEl = document.getElementById('other-actions');
  if (actionsEl) actionsEl.style.display = hasSuggestions ? 'block' : 'none';

  renderOtherTable();
}

function renderOtherTable() {
  const tbody = document.getElementById('other-table-body');
  if (!tbody) return;

  const other = STATE.otherTransactions;
  const displayed = other.slice(0, otherDisplayCount);

  tbody.innerHTML = '';
  displayed.forEach(tx => {
    const suggestion = fuzzyMatch(tx.description);
    const tr = document.createElement('tr');
    tr.dataset.txId = tx.id;

    const amtClass = tx.amount < 0 ? 'other-amount-neg' : 'other-amount-pos';
    const cats = ALL_CATEGORIES.filter(c => c !== 'Income' || tx.amount > 0);

    tr.innerHTML = `
      <td>${tx.date.toLocaleDateString('default',{month:'short',day:'numeric',year:'numeric'})}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td class="${amtClass}">${fmtDollarFull(tx.amount)}</td>
      <td class="other-suggestion">${suggestion && suggestion !== 'Other' ? suggestion : '—'}</td>
      <td>
        <select data-tx-id="${tx.id}">
          ${ALL_CATEGORIES.map(c => `<option value="${c}"${c === (suggestion || 'Other') ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Load more
  const loadMore = document.getElementById('other-load-more');
  if (loadMore) loadMore.style.display = other.length > otherDisplayCount ? 'block' : 'none';

  // Bind dropdowns
  tbody.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const txId = sel.dataset.txId;
      const tx = STATE.transactions.find(t => t.id === txId);
      if (!tx) return;
      tx.category = sel.value;
      STATE.otherTransactions = STATE.otherTransactions.filter(t => t.id !== txId);
      // Update state
      STATE.categoryMonthlyAverages = computeCategoryMonthlyAverages(getSpendingTransactions());
      if (Object.keys(STATE.categoryOverrides).length === 0 || true) {
        // Merge new averages into overrides (keep user edits)
        for (const [cat, avg] of Object.entries(STATE.categoryMonthlyAverages)) {
          if (STATE.categoryOverrides[cat] === undefined) {
            STATE.categoryOverrides[cat] = avg;
          }
        }
      }
      rebuildAll();
    });
  });
}

document.getElementById('btn-load-more').addEventListener('click', () => {
  otherDisplayCount += 15;
  renderOtherTable();
});

document.getElementById('btn-apply-suggestions').addEventListener('click', () => {
  const other = STATE.otherTransactions;
  const withSuggestions = other.filter(tx => {
    const s = fuzzyMatch(tx.description);
    return s && s !== 'Other';
  });

  if (withSuggestions.length === 0) return;

  const confirmed = confirm(`This will recategorize ${withSuggestions.length} transactions — apply?`);
  if (!confirmed) return;

  withSuggestions.forEach(tx => {
    const s = fuzzyMatch(tx.description);
    if (s) tx.category = s;
  });

  STATE.otherTransactions = STATE.otherTransactions.filter(tx => {
    const s = fuzzyMatch(tx.description);
    return !s || s === 'Other';
  });

  STATE.categoryMonthlyAverages = computeCategoryMonthlyAverages(getSpendingTransactions());

  rebuildAll();

  if (STATE.otherTransactions.length === 0) {
    const allDone = document.getElementById('other-all-done');
    const tbody = document.getElementById('other-table-body');
    if (tbody) tbody.innerHTML = '';
    if (allDone) allDone.style.display = 'flex';
    setTimeout(() => {
      const panel = document.getElementById('panel-other');
      if (panel) panel.style.display = 'none';
    }, 3000);
  }
});

// ── Projection panel ──────────────────────────────────────────────────────────

function renderProjectionPanel() {
  const content = document.getElementById('projection-content');
  const placeholder = document.getElementById('projection-placeholder');

  if (!STATE.hasCheckingData) {
    if (content) content.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    return;
  }

  if (content) content.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';

  // Starting balance input
  const balInput = document.getElementById('starting-balance-input');
  const helpEl = document.getElementById('balance-input-help');

  if (balInput && !balInput.dataset.initialized) {
    balInput.dataset.initialized = 'true';

    if (STATE.openingBalance !== null) {
      balInput.value = Math.round(STATE.openingBalance).toLocaleString();
      if (helpEl) {
        helpEl.textContent = `Detected from your ${STATE.openingBalanceBank} checking account. Adjust this if your balance has changed since your last export.`;
      }
    } else {
      if (helpEl) {
        helpEl.textContent = 'Enter your current checking balance for an accurate projection. Leave blank to start from $0.';
      }
    }

    balInput.addEventListener('input', () => {
      const raw = balInput.value.replace(/[$,]/g, '');
      const val = parseFloat(raw);
      STATE.startBalanceForProjection = isNaN(val) ? 0 : val;
      rebuildProjection();
      renderStatCards();
    });
  }

  // Render legend
  const projContent = document.getElementById('projection-content');
  if (projContent && !projContent.querySelector('.projection-legend')) {
    const legend = document.createElement('div');
    legend.className = 'projection-legend';
    legend.innerHTML = `
      <div class="proj-legend-item">
        <div class="proj-legend-line dashed"></div>
        <span>If nothing changes</span>
      </div>
      <div class="proj-legend-item">
        <div class="proj-legend-line solid"></div>
        <span>With your edits</span>
      </div>
    `;
    const chartWrap = projContent.querySelector('.chart-wrap-projection');
    if (chartWrap) projContent.insertBefore(legend, chartWrap);
  }

  rebuildProjection();
}

function rebuildProjection() {
  if (!STATE.hasCheckingData) return;

  const startBal = STATE.startBalanceForProjection || 0;
  const baseOverrides = { ...STATE.categoryMonthlyAverages };
  const editedOverrides = { ...STATE.categoryOverrides };

  const startDate = new Date();

  const baseData = buildProjection(STATE.recurringItems, baseOverrides, startBal, startDate);
  const editedData = buildProjection(STATE.recurringItems, editedOverrides, startBal, startDate);

  renderProjection(baseData, editedData, startDate, (zeroCross) => {
    const warn = document.getElementById('projection-warning');
    if (!warn) return;
    if (zeroCross) {
      warn.style.display = 'flex';
      warn.textContent = `Based on your current numbers, your balance is projected to go negative on ${formatDate(zeroCross)} — hover the chart to explore.`;
    } else {
      warn.style.display = 'none';
    }
  });

  // Update stat card zero date
  const statNeg = document.getElementById('stat-negative');
  if (statNeg) {
    const zeroCross = findZeroCrossing(editedData.data, editedData.dateObjs);
    const v = statNeg.querySelector('.stat-value');
    if (zeroCross) {
      v.textContent = formatDate(zeroCross);
      v.className = 'stat-value negative';
    } else {
      v.textContent = 'Never';
      v.className = 'stat-value positive';
    }
  }
}

function rebuildAll() {
  renderStatCards();
  renderSpendingHistoryPanel();
  renderDonutPanel();
  renderCategoryEditor();
  renderOtherPanel();
  rebuildProjection();
}

// ── Screenshot tip modal ──────────────────────────────────────────────────────

document.getElementById('btn-screenshot-tip').addEventListener('click', () => {
  document.getElementById('screenshot-modal').style.display = 'flex';
});
document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('screenshot-modal').style.display = 'none';
});
document.getElementById('screenshot-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// ── Placeholder drop zones on dashboard ──────────────────────────────────────

setupDropZone(
  document.getElementById('drop-zone-cashflow-placeholder'),
  document.getElementById('upload-cashflow-placeholder'),
  'cashflow'
);

async function handleDashboardUpload(files, section) {
  const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
  if (!csvFiles.length) return;

  for (const file of csvFiles) {
    try {
      const { transactions, fileMeta } = await parseCSV(file);

      STATE.transactions.push(...transactions);
      STATE.files.push(fileMeta);

      if (fileMeta.accountType === 'checking' && fileMeta.openingBalance !== null) {
        if (STATE.openingBalance === null) {
          STATE.openingBalance = fileMeta.openingBalance;
          STATE.openingBalanceDate = fileMeta.openingBalanceDate;
          STATE.openingBalanceBank = fileMeta.bank;
        } else {
          STATE.openingBalance += fileMeta.openingBalance;
          if (fileMeta.openingBalanceDate < STATE.openingBalanceDate) {
            STATE.openingBalanceDate = fileMeta.openingBalanceDate;
          }
        }
      }
    } catch (err) {
      console.error('Dashboard upload error:', err);
    }
  }

  // Re-run full pipeline
  finalizePipeline();
  renderDashboard();
}

// Bind dashboard placeholder drop zones
document.getElementById('upload-cashflow-placeholder').addEventListener('change', (e) => {
  handleDashboardUpload(Array.from(e.target.files), 'cashflow');
  e.target.value = '';
});
document.getElementById('upload-projection-placeholder').addEventListener('change', (e) => {
  handleDashboardUpload(Array.from(e.target.files), 'cashflow');
  e.target.value = '';
});
