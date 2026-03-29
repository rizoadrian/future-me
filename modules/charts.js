import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(
  CategoryScale, LinearScale,
  BarController, BarElement,
  LineController, LineElement, PointElement,
  DoughnutController, ArcElement,
  Tooltip, Legend, Filler
);

import { CATEGORY_COLORS, ALL_CATEGORIES } from './categorizer.js';
import { fmtTick, formatDateFull, findZeroCrossing } from './projections.js';

// ── Chart instances registry ──────────────────────────────────────────────────

const charts = {};

function getOrCreate(id, type, data, options) {
  if (charts[id]) {
    charts[id].destroy();
  }
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  charts[id] = new Chart(ctx, { type, data, options });
  return charts[id];
}

// ── Dollar formatting ─────────────────────────────────────────────────────────

function fmt(n, opts = {}) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) {
    return sign + '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Zero-line plugin ──────────────────────────────────────────────────────────

const zeroLinePlugin = {
  id: 'zeroLine',
  afterDraw(chart) {
    const { ctx, scales } = chart;
    if (!scales.y) return;
    const y = scales.y.getPixelForValue(0);
    if (y < scales.y.top || y > scales.y.bottom) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(192,57,43,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(scales.x ? scales.x.left : chart.chartArea.left, y);
    ctx.lineTo(scales.x ? scales.x.right : chart.chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(zeroLinePlugin);

// ── Common tick config ────────────────────────────────────────────────────────

function xTickConfig() {
  return {
    maxRotation: 45,
    minRotation: 45,
    font: { size: 9, family: 'DM Sans' },
    color: '#6b6b67',
    autoSkip: false,
    callback(val) {
      const label = this.getLabelForValue(val);
      return label || null;
    },
  };
}

// ── Historical spending bar chart ─────────────────────────────────────────────

export function renderSpendingHistory(transactions, dateRange) {
  // Build month list spanning the full date range
  const months = [];
  if (!dateRange.start || !dateRange.end) return;

  const start = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
  const end = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), 1);
  const d = new Date(start);
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    d.setMonth(d.getMonth() + 1);
  }

  // Expense categories (exclude Income)
  const expenseCats = ALL_CATEGORIES.filter(c => c !== 'Income');

  // Build data by category and month
  const catMonthTotals = {};
  for (const cat of expenseCats) {
    catMonthTotals[cat] = {};
    for (const m of months) catMonthTotals[cat][m] = 0;
  }

  for (const tx of transactions) {
    if (tx.isTransfer || tx.isDuplicate || tx.amount >= 0) continue;
    const m = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
    if (!catMonthTotals[tx.category]) continue;
    if (!catMonthTotals[tx.category][m] && catMonthTotals[tx.category][m] !== 0) continue;
    catMonthTotals[tx.category][m] += Math.abs(tx.amount);
  }

  // Only include categories with data
  const activeCats = expenseCats.filter(cat =>
    months.some(m => catMonthTotals[cat][m] > 0)
  );

  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo)-1, 1)
      .toLocaleString('default', { month: 'short', year: '2-digit' });
  });

  const datasets = activeCats.map(cat => ({
    label: cat,
    data: months.map(m => Math.round(catMonthTotals[cat][m])),
    backgroundColor: CATEGORY_COLORS[cat] || '#B4B2A9',
    borderWidth: 0,
  }));

  getOrCreate('chart-spending-history', 'bar', { labels, datasets }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: { size: 11, family: 'DM Sans' },
          boxWidth: 12,
          padding: 8,
          color: '#3d3d3a',
          filter: (item) => item.text !== 'undefined',
        },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
        },
        bodyFont: { family: 'DM Sans', size: 12 },
        titleFont: { family: 'DM Sans', size: 12 },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { ...xTickConfig(), maxRotation: 45, minRotation: 0, autoSkip: true, font: { size: 10 } },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          font: { size: 10, family: 'DM Sans' },
          color: '#6b6b67',
          callback: v => '$' + v.toLocaleString(),
        },
      },
    },
  });
}

// ── Historical cashflow line chart ─────────────────────────────────────────────

export function renderCashflowHistory(historicalData) {
  if (!historicalData) return;
  const { labels, data, dateObjs } = historicalData;

  getOrCreate('chart-cashflow-history', 'line', {
    labels,
    datasets: [{
      label: 'Balance',
      data,
      borderColor: '#1D9E75',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: {
        target: { value: 0 },
        above: 'rgba(29,158,117,0.07)',
        below: 'rgba(192,57,43,0.12)',
      },
      tension: 0.1,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            const d = dateObjs[idx];
            return formatDateFull(d);
          },
          label: ctx => ` Balance: ${fmt(ctx.parsed.y)}`,
        },
        bodyFont: { family: 'DM Sans', size: 12 },
        titleFont: { family: 'DM Sans', size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: xTickConfig(),
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          font: { size: 9, family: 'DM Sans' },
          color: '#6b6b67',
          callback: v => '$' + v.toLocaleString(),
        },
      },
    },
  });
}

// ── Donut chart ────────────────────────────────────────────────────────────────

export function renderDonut(transactions, currentMonth) {
  const catTotals = {};
  for (const tx of transactions) {
    if (tx.isTransfer || tx.isDuplicate || tx.amount >= 0) continue;
    const txMonth = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
    if (txMonth !== currentMonth) continue;
    if (!catTotals[tx.category]) catTotals[tx.category] = 0;
    catTotals[tx.category] += Math.abs(tx.amount);
  }

  const entries = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const labels = entries.map(([k]) => k);
  const data = entries.map(([, v]) => Math.round(v));
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#B4B2A9');

  getOrCreate('chart-donut', 'doughnut', {
    labels,
    datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
  }, {
    responsive: true,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
        },
        bodyFont: { family: 'DM Sans', size: 12 },
      },
    },
  });

  // Render legend
  const legendEl = document.getElementById('donut-legend');
  if (legendEl) {
    legendEl.innerHTML = labels.map((l, i) => `
      <div class="donut-legend-item">
        <div class="donut-legend-swatch" style="background:${colors[i]}"></div>
        <span>${l} (${fmt(data[i])})</span>
      </div>
    `).join('');
  }
}

// ── Projection chart ──────────────────────────────────────────────────────────

export function renderProjection(baseData, editedData, startDate, onWarning) {
  if (!baseData || !editedData) return;
  const { labels, data: baseVals, dateObjs } = baseData;
  const { data: editedVals } = editedData;

  // Find zero crossing on edited line
  const zeroCross = findZeroCrossing(editedVals, dateObjs);
  if (onWarning) onWarning(zeroCross);

  getOrCreate('chart-projection', 'line', {
    labels,
    datasets: [
      {
        label: 'If nothing changes',
        data: baseVals,
        borderColor: '#9c9a92',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
      },
      {
        label: 'With your edits',
        data: editedVals,
        borderColor: '#1a4a7a',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: {
          target: { value: 0 },
          above: 'rgba(26,74,122,0.07)',
          below: 'rgba(192,57,43,0.15)',
        },
        tension: 0.1,
      },
    ],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            return formatDateFull(dateObjs[idx]);
          },
          label: ctx => {
            const v = ctx.parsed.y;
            const label = ` ${ctx.dataset.label}: ${fmt(v)}`;
            return label;
          },
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            if (editedVals[idx] < 0) return '⚠ Balance in negative territory';
            return '';
          },
        },
        bodyFont: { family: 'DM Sans', size: 12 },
        titleFont: { family: 'DM Sans', size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: xTickConfig(),
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          font: { size: 9, family: 'DM Sans' },
          color: '#6b6b67',
          callback: v => '$' + v.toLocaleString(),
        },
      },
    },
  });
}

export function destroyAll() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e) {} });
  Object.keys(charts).forEach(k => delete charts[k]);
}
