import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
// (Imports cruzados inyectados por refactor)

/* =====================================================
   CHART
   ===================================================== */
function renderChart() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  const { labels, incomeData, expenseData } = getChartData();

  if (state.chartInstance) state.chartInstance.destroy();

  state.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          backgroundColor: 'rgba(0,229,160,.25)',
          borderColor: '#00e5a0',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Gastos',
          data: expenseData,
          backgroundColor: 'rgba(255,74,107,.2)',
          borderColor: '#ff4a6b',
          borderWidth: 2,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#5a6478', font: { family: "'DM Mono'", size: 11 }, boxWidth: 10, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#131720',
          borderColor: '#232b3a',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#5a6478',
          padding: 10,
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toLocaleString('es-AR')}`
          }
        }
      },
      scales: {
        x: { grid: { color: '#232b3a', drawBorder: false }, ticks: { color: '#5a6478', font: { family: "'DM Mono'", size: 10 } } },
        y: { grid: { color: '#1a2030', drawBorder: false }, ticks: { color: '#5a6478', font: { family: "'DM Mono'", size: 10 }, callback: v => '$' + v.toLocaleString('es-AR') } }
      }
    }
  });
}

function getChartData() {
  const now = new Date();

  if (state.chartPeriod === 'semana') {
    const labels = [], incomeData = [], expenseData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('es-AR', { weekday: 'short' }));
      const day = state.transactions.filter(t => t.date === str);
      incomeData.push(day.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenseData.push(day.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    }
    return { labels, incomeData, expenseData };
  }

  if (state.chartPeriod === 'mes') {
    const labels = [], incomeData = [], expenseData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      labels.push(i % 5 === 0 ? d.getDate() + '/' + (d.getMonth() + 1) : '');
      const day = state.transactions.filter(t => t.date === str);
      incomeData.push(day.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenseData.push(day.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    }
    return { labels, incomeData, expenseData };
  }

  // año
  const labels = [], incomeData = [], expenseData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('es-AR', { month: 'short' }));
    const m = d.getMonth(), y = d.getFullYear();
    const mo = state.transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m && td.getFullYear() === y; });
    incomeData.push(mo.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expenseData.push(mo.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }
  return { labels, incomeData, expenseData };
}

function setChartPeriod(btn, period) {
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.chartPeriod = period;
  renderChart();
}

/* =====================================================
   REPORTES
   ===================================================== */
let rvPeriod = 'mes';
let rvChartLine = null;
let rvChartDonut = null;

/* ---- Nav entry ---- */
function enterReportesView() {
  const now = new Date();
  document.getElementById('rvFrom').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('rvTo').value = now.toISOString().split('T')[0];
  renderReportesView();
}

/* ---- Period ---- */
function setRvPeriod(btn, period) {
  rvPeriod = period;
  document.querySelectorAll('.rv-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rvCustomRange').style.display = period === 'custom' ? 'flex' : 'none';
  renderReportesView();
}

function getRvDateRange() {
  const now = new Date();
  if (rvPeriod === 'mes') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  }
  if (rvPeriod === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  }
  if (rvPeriod === 'anio') {
    return {
      from: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  }
  // custom
  return {
    from: document.getElementById('rvFrom').value || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: document.getElementById('rvTo').value || now.toISOString().split('T')[0]
  };
}

function getRvTx() {
  const { from, to } = getRvDateRange();
  return state.transactions.filter(t => t.date >= from && t.date <= to);
}

/* ---- Main render ---- */
function renderReportesView() {
  const { from, to } = getRvDateRange();
  const tx = getRvTx();

  const label = `${formatDate(from)} — ${formatDate(to)}`;
  document.getElementById('rvLineLabel').textContent = label;
  document.getElementById('rvDonutLabel').textContent = label;

  renderRvKpis(tx, from, to);
  renderRvLineChart(tx, from, to);
  renderRvDonut(tx);
  renderRvCatTable(tx);
  renderRvMonthTable();
}

/* ---- KPIs ---- */
function renderRvKpis(tx, from, to) {
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;
  const rate = income > 0 ? ((net / income) * 100).toFixed(1) : 0;
  const avgDaily = (() => {
    const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1);
    return Math.round(expenses / days);
  })();

  // Previous period for comparison
  const span = Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - span + 1);
  const prevTx = state.transactions.filter(t => t.date >= prevFrom.toISOString().split('T')[0] && t.date <= prevTo.toISOString().split('T')[0]);
  const prevExp = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevInc = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  const pctChange = (curr, prev) => {
    if (prev === 0 && curr === 0) return `<span class="flat">—</span>`;
    if (prev === 0) return `<span class="up">nuevo</span>`;
    const d = ((curr - prev) / prev * 100).toFixed(1);
    return d >= 0
      ? `<span class="up">▲ ${d}%</span>`
      : `<span class="down">▼ ${Math.abs(d)}%</span>`;
  };

  const fmt = n => '$' + Math.abs(n).toLocaleString('es-AR');

  const kpis = [
    { label: 'Ingresos', val: fmt(income), sub: pctChange(income, prevInc), color: 'var(--accent)', bar: '#00e5a0' },
    { label: 'Gastos', val: fmt(expenses), sub: pctChange(expenses, prevExp), color: 'var(--danger)', bar: '#ff4a6b' },
    { label: 'Ahorro neto', val: (net < 0 ? '-' : '') + fmt(net), sub: net >= 0 ? '<span class="up">superávit</span>' : '<span class="down">déficit</span>', color: net >= 0 ? 'var(--accent)' : 'var(--danger)', bar: net >= 0 ? '#00e5a0' : '#ff4a6b' },
    { label: 'Tasa de ahorro', val: `${rate}%`, sub: rate >= 20 ? '<span class="up">excelente</span>' : rate >= 10 ? '<span class="up">buena</span>' : '<span class="down">mejorable</span>', color: 'var(--accent3)', bar: '#5b8cff' },
    { label: 'Gasto diario', val: fmt(avgDaily), sub: `<span style="color:var(--muted);">${tx.filter(t => t.type === 'expense').length} gastos</span>`, color: 'var(--warn)', bar: '#ffb84a' },
  ];

  document.getElementById('rvKpis').innerHTML = kpis.map(k => `
    <div class="rv-kpi">
      <div class="rv-kpi-label">${k.label}</div>
      <div class="rv-kpi-val" style="color:${k.color};">${k.val}</div>
      <div class="rv-kpi-sub">${k.sub}</div>
      <div class="rv-kpi-bar" style="background:${k.bar};opacity:.6;"></div>
    </div>
  `).join('');
}

/* ---- Line Chart ---- */
function renderRvLineChart(tx, from, to) {
  const ctx = document.getElementById('rvLineChart').getContext('2d');

  // Build daily buckets between from→to
  const days = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) { days.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }

  // If > 60 days, group by week; if > 180 days, group by month
  let labels, incData, expData;

  if (days.length <= 60) {
    labels = days.map(s => { const d = new Date(s + 'T00:00:00'); return d.getDate() + '/' + (d.getMonth() + 1); });
    incData = days.map(s => tx.filter(t => t.date === s && t.type === 'income').reduce((a, t) => a + t.amount, 0));
    expData = days.map(s => tx.filter(t => t.date === s && t.type === 'expense').reduce((a, t) => a + t.amount, 0));
  } else if (days.length <= 180) {
    // weekly
    const weeks = {};
    days.forEach(s => {
      const d = new Date(s + 'T00:00:00');
      const wk = `${d.getFullYear()}-W${String(getWeekNum(d)).padStart(2, '0')}`;
      if (!weeks[wk]) weeks[wk] = { label: `Sem ${getWeekNum(d)}`, inc: 0, exp: 0 };
      const dayTx = tx.filter(t => t.date === s);
      weeks[wk].inc += dayTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      weeks[wk].exp += dayTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    });
    labels = Object.values(weeks).map(w => w.label);
    incData = Object.values(weeks).map(w => w.inc);
    expData = Object.values(weeks).map(w => w.exp);
  } else {
    // monthly
    const months = {};
    days.forEach(s => {
      const d = new Date(s + 'T00:00:00');
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[mk]) months[mk] = { label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), inc: 0, exp: 0 };
      const dayTx = tx.filter(t => t.date === s);
      months[mk].inc += dayTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      months[mk].exp += dayTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    });
    labels = Object.values(months).map(m => m.label);
    incData = Object.values(months).map(m => m.inc);
    expData = Object.values(months).map(m => m.exp);
  }

  if (rvChartLine) rvChartLine.destroy();

  rvChartLine = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incData,
          borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,.08)',
          borderWidth: 2, pointRadius: days.length <= 31 ? 3 : 0,
          pointHoverRadius: 5, tension: 0.35, fill: true,
        },
        {
          label: 'Gastos',
          data: expData,
          borderColor: '#ff4a6b', backgroundColor: 'rgba(255,74,107,.06)',
          borderWidth: 2, pointRadius: days.length <= 31 ? 3 : 0,
          pointHoverRadius: 5, tension: 0.35, fill: true,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#5a6478', font: { family: "'DM Mono'", size: 11 }, boxWidth: 10, padding: 16 } },
        tooltip: {
          backgroundColor: '#131720', borderColor: '#232b3a', borderWidth: 1,
          titleColor: '#e8edf5', bodyColor: '#5a6478', padding: 10,
          callbacks: { label: c => ` $${c.parsed.y.toLocaleString('es-AR')}` }
        }
      },
      scales: {
        x: { grid: { color: '#1a2030' }, ticks: { color: '#5a6478', font: { family: "'DM Mono'", size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: '#1a2030' }, ticks: { color: '#5a6478', font: { family: "'DM Mono'", size: 10 }, callback: v => '$' + v.toLocaleString('es-AR') } }
      }
    }
  });
}

function getWeekNum(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

/* ---- Donut ---- */
function renderRvDonut(tx) {
  const ctx = document.getElementById('rvDonutChart').getContext('2d');
  const expenses = tx.filter(t => t.type === 'expense');

  const bycat = {};
  expenses.forEach(t => { bycat[t.cat] = (bycat[t.cat] || 0) + t.amount; });
  const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v);
  const colors = sorted.map(([k]) => state.CAT_COLORS[k] || '#94a3b8');

  if (rvChartDonut) rvChartDonut.destroy();

  rvChartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: total === 0 ? [1] : data, backgroundColor: total === 0 ? ['#1a2030'] : colors.map(c => c + 'cc'), borderColor: total === 0 ? ['#232b3a'] : colors, borderWidth: 2, hoverOffset: 5 }] },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131720', borderColor: '#232b3a', borderWidth: 1,
          titleColor: '#e8edf5', bodyColor: '#5a6478', padding: 10,
          callbacks: { label: c => total === 0 ? ' Sin gastos' : ` $${c.parsed.toLocaleString('es-AR')} (${((c.parsed / total) * 100).toFixed(1)}%)` }
        }
      }
    }
  });

  const leg = document.getElementById('rvDonutLegend');
  if (sorted.length === 0) {
    leg.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:10px 0;">Sin gastos en este período.</div>`;
    return;
  }
  leg.innerHTML = sorted.slice(0, 6).map(([cat, amt]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:2px;background:${state.CAT_COLORS[cat] || '#94a3b8'};flex-shrink:0;"></div>
        <span style="font-size:12px;font-weight:600;">${state.CAT_ICONS[cat] || '📦'} ${cat}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">$${amt.toLocaleString('es-AR')}</span>
        <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);min-width:32px;text-align:right;">${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</span>
      </div>
    </div>
  `).join('');
}

/* ---- Category table ---- */
function renderRvCatTable(tx) {
  const expenses = tx.filter(t => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  const bycat = {};
  expenses.forEach(t => {
    if (!bycat[t.cat]) bycat[t.cat] = { amount: 0, count: 0 };
    bycat[t.cat].amount += t.amount;
    bycat[t.cat].count++;
  });

  const sorted = Object.entries(bycat).sort((a, b) => b[1].amount - a[1].amount);
  const el = document.getElementById('rvCatTable');

  if (sorted.length === 0) {
    el.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin gastos en este período.</td></tr>`;
    return;
  }

  el.innerHTML = sorted.map(([cat, { amount, count }]) => {
    const pct = total > 0 ? (amount / total) * 100 : 0;
    const color = state.CAT_COLORS[cat] || '#94a3b8';
    return `
      <tr class="rv-cat-row">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:30px;height:30px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:14px;">${state.CAT_ICONS[cat] || '📦'}</div>
            <div>
              <div style="font-weight:600;">${cat}</div>
              <div class="rv-cat-mini-bar" style="width:80px;">
                <div class="rv-cat-mini-fill" style="width:${pct}%;background:${color};"></div>
              </div>
            </div>
          </div>
        </td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${count} transacciones</td>
        <td style="text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--danger);">-$${amount.toLocaleString('es-AR')}</td>
        <td style="text-align:right;">
          <span style="font-family:var(--font-mono);font-size:12px;color:${color};font-weight:600;">${pct.toFixed(1)}%</span>
        </td>
      </tr>
    `;
  }).join('');
}

/* ---- Monthly comparison ---- */
function renderRvMonthTable() {
  const now = new Date();
  const rows = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    const monthTx = state.transactions.filter(t => {
      const td = new Date(t.date); return td.getMonth() === m && td.getFullYear() === y;
    });
    const inc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = inc - exp;
    const rate = inc > 0 ? ((net / inc) * 100).toFixed(1) : 0;
    rows.push({ label: d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()), inc, exp, net, rate, count: monthTx.length });
  }

  const fmt = n => '$' + Math.abs(n).toLocaleString('es-AR');

  document.getElementById('rvMonthTableBody').innerHTML = rows.map((r, i) => {
    const prev = rows[i - 1];
    let trendHtml = '<span class="rv-trend flat">—</span>';
    if (prev) {
      const diff = r.exp - prev.exp;
      const pct = prev.exp > 0 ? ((diff / prev.exp) * 100).toFixed(1) : 0;
      if (diff > 0) trendHtml = `<span class="rv-trend down">▲ ${pct}%</span>`;
      else if (diff < 0) trendHtml = `<span class="rv-trend up">▼ ${Math.abs(pct)}%</span>`;
      else trendHtml = `<span class="rv-trend flat">=</span>`;
    }

    const isCurrentMonth = i === rows.length - 1;

    return `
      <tr style="${isCurrentMonth ? 'background:rgba(0,229,160,.04);' : ''}">
        <td style="font-weight:${isCurrentMonth ? '700' : '500'};${isCurrentMonth ? 'color:var(--accent);' : ''}">
          ${r.label}${isCurrentMonth ? ' <span style="font-size:10px;font-family:var(--font-mono);background:rgba(0,229,160,.12);color:var(--accent);padding:1px 6px;border-radius:4px;margin-left:4px;">actual</span>' : ''}
        </td>
        <td class="mono" style="color:var(--accent);">+${fmt(r.inc)}</td>
        <td class="mono" style="color:var(--danger);">-${fmt(r.exp)}</td>
        <td class="mono" style="color:${r.net >= 0 ? 'var(--accent)' : 'var(--danger)'};">${r.net >= 0 ? '+' : '-'}${fmt(r.net)}</td>
        <td>
          <span style="font-family:var(--font-mono);font-size:12px;font-weight:600;color:${r.rate >= 20 ? 'var(--accent)' : r.rate >= 10 ? 'var(--warn)' : 'var(--danger)'};">${r.rate}%</span>
        </td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${r.count}</td>
        <td>${trendHtml}</td>
      </tr>
    `;
  }).join('');
}

/* ---- CSV export ---- */
async function exportReportExcel() {
  if (typeof ExcelJS === 'undefined') {
    showToast('⚠️ Librería de Excel no cargada aún', true);
    return;
  }
  const { from, to } = getRvDateRange();
  const tx = getRvTx();
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte');

  sheet.columns = [
    { header: 'Fecha', key: 'date', width: 15 },
    { header: 'Descripción', key: 'desc', width: 40 },
    { header: 'Categoría', key: 'cat', width: 25 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Monto', key: 'amount', width: 20 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF121212' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  tx.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    const row = sheet.addRow({
      date: t.date,
      desc: t.desc,
      cat: t.cat,
      type: t.type === 'income' ? 'Ingreso' : 'Gasto',
      amount: t.amount
    });
    row.getCell('amount').numFmt = '"$"#,##0.00';
    if (t.type === 'income') {
      row.getCell('type').font = { color: { argb: 'FF4CAF50' }, bold: true };
    } else {
      row.getCell('type').font = { color: { argb: 'FFF44336' }, bold: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `flujo_reporte_${from}_${to}.xlsx`;
  a.click();
  showToast('📥 Reporte exportado en Excel');
}



// --- WINDOW ATTACHMENTS ---
window.renderRvDonut = renderRvDonut;
window.setChartPeriod = setChartPeriod;
window.renderRvKpis = renderRvKpis;
window.renderRvLineChart = renderRvLineChart;
window.enterReportesView = enterReportesView;
window.renderRvCatTable = renderRvCatTable;
window.renderRvMonthTable = renderRvMonthTable;
window.getRvDateRange = getRvDateRange;
window.setRvPeriod = setRvPeriod;
window.renderChart = renderChart;
window.getWeekNum = getWeekNum;
window.renderReportesView = renderReportesView;
window.getRvTx = getRvTx;
window.exportReportExcel = exportReportExcel;
window.getChartData = getChartData;
