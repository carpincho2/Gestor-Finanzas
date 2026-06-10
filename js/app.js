/* =====================================================
   STATE
   ===================================================== */

// ---- Per-user data isolation ----
let currentUserEmail = null;
function userKey(k) { return currentUserEmail ? k + '_' + currentUserEmail : k; }

const IS_SERVER = window.location.protocol !== 'file:';
const API_BASE = IS_SERVER
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://' + window.location.hostname + ':8000/api'
      : window.location.origin + '/api')
  : null;

async function apiFetchLocal(path, options = {}) {
  if (typeof apiFetch !== 'undefined') {
    return apiFetch(path, options);
  }
  const url = API_BASE + path;
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  return r.json();
}

async function loadUserData() {
  if (IS_SERVER) {
    try {
      const [resAcc, resTx, resBgt, resGoal] = await Promise.all([
        apiFetchLocal('/accounts'),
        apiFetchLocal('/transactions'),
        apiFetchLocal('/budgets'),
        apiFetchLocal('/goals')
      ]);
      
      if (resAcc && resAcc.ok) accounts = resAcc.accounts;
      if (resTx && resTx.ok) transactions = resTx.transactions;
      if (resBgt && resBgt.ok) budgets = resBgt.budgets;
      if (resGoal && resGoal.ok) goals = resGoal.goals;
      
      scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
    } catch (err) {
      console.error("Error cargando datos del backend:", err);
      showToast("⚠️ Error al sincronizar con el servidor", true);
    }
  } else {
    transactions = JSON.parse(localStorage.getItem(userKey('flujo_tx')) || '[]');
    budgets = JSON.parse(localStorage.getItem(userKey('flujo_budgets')) || '[]');
    accounts = JSON.parse(localStorage.getItem(userKey('flujo_accounts')) || '[]');
    goals = JSON.parse(localStorage.getItem(userKey('flujo_goals')) || '[]');
    scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
  }
}

let transactions = [];
let currentType = 'expense';
let mCurrentType = 'expense';
let chartInstance = null;
let chartPeriod = 'semana';

const BUDGETS = [
  { cat: 'Supermercado / Almacén', limit: 30000, color: '#00e5a0' },
  { cat: 'Salidas / Restaurantes', limit: 15000, color: '#ffb84a' },
  { cat: 'Transporte', limit: 12000, color: '#5b8cff' },
  { cat: 'Hogar / Servicios', limit: 40000, color: '#a78bfa' },
];

const CAT_ICONS = {
  'Supermercado / Almacén': '🛒',
  'Salidas / Restaurantes': '🍕',
  'Transporte': '🚗',
  'Hogar / Servicios': '🏠',
  'Entretenimiento / Suscripciones': '🎬',
  'Salud / Farmacia': '💊',
  'Compras / Ropa': '🛍️',
  'Educación': '📚',
  'Ingresos (Sueldo/Freelance)': '💼',
  'Ahorro / Inversiones': '📈',
  'Otros': '📦'
};

const CAT_COLORS = {
  'Supermercado / Almacén': '#00e5a0',
  'Salidas / Restaurantes': '#ffb84a',
  'Transporte': '#5b8cff',
  'Hogar / Servicios': '#a78bfa',
  'Entretenimiento / Suscripciones': '#ff6b4a',
  'Salud / Farmacia': '#f43f5e',
  'Compras / Ropa': '#ec4899',
  'Educación': '#3b82f6',
  'Ingresos (Sueldo/Freelance)': '#10b981',
  'Ahorro / Inversiones': '#06b6d4',
  'Otros': '#64748b'
};

/* =====================================================
   INIT
   ===================================================== */
async function init() {
  await loadUserData();

  // Si no está corriendo en servidor, sembramos datos en localStorage
  if (!IS_SERVER) {
    if (transactions.length === 0) {
      const demo = [
        { id: 1, type: 'income', desc: 'Sueldo', amount: 150000, cat: 'Ingresos (Sueldo/Freelance)', date: '2025-04-01' },
        { id: 2, type: 'expense', desc: 'Alquiler', amount: 55000, cat: 'Hogar / Servicios', date: '2025-04-03' },
        { id: 3, type: 'expense', desc: 'Supermercado', amount: 12300, cat: 'Supermercado / Almacén', date: '2025-04-05' },
        { id: 4, type: 'expense', desc: 'UberEats', amount: 4200, cat: 'Salidas / Restaurantes', date: '2025-04-07' },
        { id: 5, type: 'income', desc: 'Freelance web', amount: 35000, cat: 'Ingresos (Sueldo/Freelance)', date: '2025-04-08' },
        { id: 6, type: 'expense', desc: 'SUBE + taxi', amount: 3100, cat: 'Transporte', date: '2025-04-09' },
        { id: 7, type: 'expense', desc: 'Netflix + Spotify', amount: 3200, cat: 'Entretenimiento / Suscripciones', date: '2025-04-10' },
        { id: 8, type: 'expense', desc: 'Farmacia', amount: 2800, cat: 'Salud / Farmacia', date: '2025-04-11' },
      ];
      transactions = demo;
      save();
    }

    initBudgets();
    initAccounts();
    initGoals();
  }

  setDate();
  renderAll();
}

function setDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('pageDate').textContent =
    d.toLocaleDateString('es-AR', opts).replace(/^\w/, c => c.toUpperCase());

  // Set modal date default
  document.getElementById('mDate').value = d.toISOString().split('T')[0];
}

function save() {
  if (!IS_SERVER) {
    localStorage.setItem(userKey('flujo_tx'), JSON.stringify(transactions));
  }
}

/* =====================================================
   RENDER
   ===================================================== */
function renderAll() {
  renderStats();
  renderTransactions();
  renderChart();
  renderBudgets();
}

function renderStats() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;

  const allIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const allExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = allIncome - allExpenses;

  const fmt = n => '$' + n.toLocaleString('es-AR');

  document.getElementById('statBalance').textContent = fmt(balance);
  document.getElementById('statIncome').textContent = fmt(income);
  document.getElementById('statExpenses').textContent = fmt(expenses);
  document.getElementById('statSavings').textContent = fmt(savings);

  const savEl = document.getElementById('savingsChange');
  if (savings >= 0) {
    savEl.className = 'up';
    savEl.textContent = '↑ ahorro positivo';
  } else {
    savEl.className = 'down';
    savEl.textContent = '↓ déficit este mes';
  }
}

function renderTransactions() {
  const list = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  const el = document.getElementById('txList');
  document.getElementById('txCount').textContent = transactions.length + ' registros';

  if (list.length === 0) {
    el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin transacciones aún.</div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="tx-item">
      <div class="tx-icon" style="background:${CAT_COLORS[t.cat]}22;">
        ${CAT_ICONS[t.cat] || '📦'}
      </div>
      <div class="tx-info">
        <div class="tx-name">${t.desc}</div>
        <div class="tx-cat">${t.cat}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString('es-AR')}</div>
        <div class="tx-date">${formatDate(t.date)}</div>
      </div>
    </div>
  `).join('');
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/* =====================================================
   CHART
   ===================================================== */
function renderChart() {
  const ctx = document.getElementById('mainChart').getContext('2d');
  const { labels, incomeData, expenseData } = getChartData();

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
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

  if (chartPeriod === 'semana') {
    const labels = [], incomeData = [], expenseData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('es-AR', { weekday: 'short' }));
      const day = transactions.filter(t => t.date === str);
      incomeData.push(day.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenseData.push(day.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    }
    return { labels, incomeData, expenseData };
  }

  if (chartPeriod === 'mes') {
    const labels = [], incomeData = [], expenseData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      labels.push(i % 5 === 0 ? d.getDate() + '/' + (d.getMonth() + 1) : '');
      const day = transactions.filter(t => t.date === str);
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
    const mo = transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === m && td.getFullYear() === y; });
    incomeData.push(mo.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    expenseData.push(mo.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }
  return { labels, incomeData, expenseData };
}

function setChartPeriod(btn, period) {
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  chartPeriod = period;
  renderChart();
}

/* =====================================================
   BUDGETS
   ===================================================== */
function renderBudgets() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const el = document.getElementById('budgetList');
  if (!budgets || budgets.length === 0) {
    el.innerHTML = `<div style="padding:16px 0;text-align:center;font-size:11px;font-family:var(--font-mono);color:var(--muted);">Sin presupuestos creados.</div>`;
    return;
  }

  el.innerHTML = budgets.slice(0, 5).map(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.cat === b.cat)
      .filter(t => { const d = new Date(t.date); return d.getMonth() === month && d.getFullYear() === year; })
      .reduce((s, t) => s + t.amount, 0);

    const pct = Math.min((spent / b.limit) * 100, 100);
    const over = spent > b.limit;

    return `
      <div class="budget-item">
        <div class="budget-head">
          <span class="budget-name">${b.icon || '📦'} ${b.name}</span>
          <span class="budget-nums">$${spent.toLocaleString('es-AR')} / $${b.limit.toLocaleString('es-AR')}</span>
        </div>
        <div class="budget-bar-bg">
          <div class="budget-bar-fill" style="width:${pct}%;background:${over ? 'var(--danger)' : b.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* =====================================================
   QUICK ADD
   ===================================================== */
function setType(type) {
  currentType = type;
  const expBtn = document.getElementById('typeExpBtn');
  const incBtn = document.getElementById('typeIncBtn');
  expBtn.className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  incBtn.className = 'type-btn' + (type === 'income' ? ' active-income' : '');
}

function quickAdd() {
  const desc = document.getElementById('qDesc').value.trim();
  const amount = parseFloat(document.getElementById('qAmount').value);
  const cat = document.getElementById('qCat').value;

  if (!desc) { showToast('⚠️ Ingresá una descripción', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }

  addTransaction({ type: currentType, desc, amount, cat, date: new Date().toISOString().split('T')[0] });
  document.getElementById('qDesc').value = '';
  document.getElementById('qAmount').value = '';
  showToast('✅ Transacción registrada');
}

/* =====================================================
   MODAL
   ===================================================== */
function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target.id === 'modalOverlay') {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function setModalType(type) {
  mCurrentType = type;
  const expBtn = document.getElementById('mTypeExpBtn');
  const incBtn = document.getElementById('mTypeIncBtn');
  expBtn.className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  incBtn.className = 'type-btn' + (type === 'income' ? ' active-income' : '');
}

function addFromModal() {
  const desc = document.getElementById('mDesc').value.trim();
  const amount = parseFloat(document.getElementById('mAmount').value);
  const cat = document.getElementById('mCat').value;
  const date = document.getElementById('mDate').value;

  if (!desc) { showToast('⚠️ Ingresá una descripción', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }
  if (!date) { showToast('⚠️ Seleccioná una fecha', true); return; }

  addTransaction({ type: mCurrentType, desc, amount, cat, date });
  document.getElementById('mDesc').value = '';
  document.getElementById('mAmount').value = '';
  closeModal();
  showToast('✅ Transacción registrada');
}

async function addTransaction(tx) {
  if (IS_SERVER) {
    try {
      await apiFetchLocal('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: tx.account_id || null,
          type: tx.type,
          desc: tx.desc,
          amount: tx.amount,
          cat: tx.cat,
          date: tx.date,
          transfer_id: tx.transfer_id || null
        })
      });
      await loadUserData();
      renderAll();
      if (currentPage === 'transacciones') renderTxView();
    } catch (err) {
      console.error("Error al guardar transacción:", err);
      showToast("Error al guardar la transacción en el servidor", true);
    }
  } else {
    tx.id = Date.now();
    transactions.unshift(tx);
    save();
    renderAll();
    if (currentPage === 'transacciones') renderTxView();
  }
}

/* =====================================================
   NAV
   ===================================================== */
let currentPage = 'dashboard';

/* =====================================================
   SIDEBAR TOGGLE (Mobile hamburger)
   ===================================================== */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent scroll behind overlay
  }
}

// Close sidebar on window resize if going back to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
});

function setPage(el, page) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Detener cámara y limpiar worker si salimos del scanner
  if (currentPage === 'scanner' && page !== 'scanner') {
    if (scCameraStream) scStopCamera();
    scCleanupWorker();
  }

  currentPage = page;

  const titles = {
    dashboard: 'Dashboard', transacciones: 'Transacciones', presupuestos: 'Presupuestos',
    cuentas: 'Cuentas', reportes: 'Reportes', objetivos: 'Objetivos', scanner: 'Escanear Ticket',
    insights: 'IA Insights'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Helper: ocultar todas las vistas
  function hideAll() {
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('txView').style.display = 'none';
    document.getElementById('budgetView').style.display = 'none';
    document.getElementById('cuentasView').style.display = 'none';
    document.getElementById('reportesView').style.display = 'none';
    document.getElementById('objetivosView').style.display = 'none';
    document.getElementById('scannerView').style.display = 'none';
    document.getElementById('insightsView').style.display = 'none';
    document.getElementById('pageDate').style.display = 'none';
  }

  if (page === 'dashboard') {
    hideAll();
    document.getElementById('dashboardView').style.display = '';
    document.getElementById('pageDate').style.display = '';
    renderAll();
  } else if (page === 'transacciones') {
    hideAll();
    document.getElementById('txView').style.display = '';
    txFilter = { type: 'all', cat: 'all', search: '', dateFrom: '', dateTo: '' };
    txSort = { field: 'date', dir: 'desc' };
    txPage = 1;
    syncTxFilterUI();
    renderTxView();
  } else if (page === 'presupuestos') {
    hideAll();
    enterBudgetView();
  } else if (page === 'cuentas') {
    hideAll();
    document.getElementById('cuentasView').style.display = '';
    enterCuentasView();
  } else if (page === 'reportes') {
    hideAll();
    document.getElementById('reportesView').style.display = '';
    enterReportesView();
  } else if (page === 'objetivos') {
    hideAll();
    document.getElementById('objetivosView').style.display = '';
    enterObjetivosView();
  } else if (page === 'scanner') {
    hideAll();
    document.getElementById('scannerView').style.display = '';
    enterScannerView();
  } else if (page === 'insights') {
    hideAll();
    document.getElementById('insightsView').style.display = '';
    enterInsightsView();
  } else {
    hideAll();
    document.getElementById('dashboardView').style.display = '';
    document.getElementById('pageDate').style.display = '';
    showToast('🚧 Sección en construcción — próximamente');
  }
}

/* =====================================================
   TRANSACTIONS VIEW
   ===================================================== */
const TX_PER_PAGE = 12;
let txFilter = { type: 'all', cat: 'all', search: '', dateFrom: '', dateTo: '' };
let txSort = { field: 'date', dir: 'desc' };
let txPage = 1;
let editingId = null;

function getFilteredTx() {
  let list = [...transactions];

  if (txFilter.type !== 'all') list = list.filter(t => t.type === txFilter.type);
  if (txFilter.cat !== 'all') list = list.filter(t => t.cat === txFilter.cat);
  if (txFilter.search) {
    const q = txFilter.search.toLowerCase();
    list = list.filter(t => t.desc.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q));
  }
  if (txFilter.dateFrom) list = list.filter(t => t.date >= txFilter.dateFrom);
  if (txFilter.dateTo) list = list.filter(t => t.date <= txFilter.dateTo);

  list.sort((a, b) => {
    let va = a[txSort.field], vb = b[txSort.field];
    if (txSort.field === 'amount') { va = +va; vb = +vb; }
    if (va < vb) return txSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return txSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function renderTxView() {
  const all = getFilteredTx();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / TX_PER_PAGE));
  if (txPage > pages) txPage = pages;
  const slice = all.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  // Summary strip
  const income = all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const fmt = n => '$' + n.toLocaleString('es-AR');

  document.getElementById('txSumTotal').textContent = total + ' transacciones';
  document.getElementById('txSumIncome').textContent = fmt(income);
  document.getElementById('txSumExpense').textContent = fmt(expenses);
  document.getElementById('txSumNet').textContent = fmt(income - expenses);
  document.getElementById('txSumNet').className = 'txsum-val ' + (income - expenses >= 0 ? 'green' : 'red');

  // Table body
  const tbody = document.getElementById('txTableBody');
  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin resultados para los filtros aplicados.</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(t => `
      <tr class="tx-row" data-id="${t.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="tx-icon" style="background:${CAT_COLORS[t.cat]}22;width:32px;height:32px;font-size:14px;">
              ${CAT_ICONS[t.cat] || '📦'}
            </div>
            <div>
              <div style="font-weight:600;font-size:13.5px;">${escHtml(t.desc)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="cat-chip" style="background:${CAT_COLORS[t.cat]}18;color:${CAT_COLORS[t.cat]};">
            ${t.cat}
          </span>
        </td>
        <td>
          <span class="type-chip ${t.type}">${t.type === 'income' ? 'Ingreso' : 'Gasto'}</span>
        </td>
        <td style="font-family:var(--font-mono);font-size:13px;color:var(--muted);">${formatDateLong(t.date)}</td>
        <td style="font-family:var(--font-mono);font-weight:700;font-size:14px;text-align:right;" class="${t.type}">
          ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
        </td>
        <td style="text-align:right;">
          <div style="display:flex;gap:4px;justify-content:flex-end;">
            <button class="row-btn edit-btn" onclick="openEditModal(${t.id})" title="Editar">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" onclick="confirmDelete(${t.id})" title="Eliminar">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Sort indicators
  document.querySelectorAll('.th-sort').forEach(th => {
    th.classList.toggle('sorted', th.dataset.field === txSort.field);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow && th.dataset.field === txSort.field) {
      arrow.textContent = txSort.dir === 'asc' ? '↑' : '↓';
    } else if (arrow) {
      arrow.textContent = '↕';
    }
  });

  // Pagination
  renderTxPagination(total, pages);
}

function renderTxPagination(total, pages) {
  const el = document.getElementById('txPagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = `<span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);margin-right:8px;">${total} resultados</span>`;

  html += `<button class="pg-btn" onclick="goTxPage(${txPage - 1})" ${txPage === 1 ? 'disabled' : ''}>‹</button>`;

  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - txPage) > 1) {
      if (i === 3 || i === pages - 2) html += `<span style="color:var(--muted);padding:0 4px;">…</span>`;
      continue;
    }
    html += `<button class="pg-btn ${i === txPage ? 'active' : ''}" onclick="goTxPage(${i})">${i}</button>`;
  }

  html += `<button class="pg-btn" onclick="goTxPage(${txPage + 1})" ${txPage === pages ? 'disabled' : ''}>›</button>`;
  el.innerHTML = html;
}

function goTxPage(p) {
  const pages = Math.max(1, Math.ceil(getFilteredTx().length / TX_PER_PAGE));
  if (p < 1 || p > pages) return;
  txPage = p;
  renderTxView();
  document.getElementById('txView').scrollTo(0, 0);
}

function sortTx(field) {
  if (txSort.field === field) {
    txSort.dir = txSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    txSort.field = field;
    txSort.dir = field === 'amount' ? 'desc' : 'desc';
  }
  txPage = 1;
  renderTxView();
}

function syncTxFilterUI() {
  document.getElementById('txSearch').value = txFilter.search;
  document.getElementById('txFilterType').value = txFilter.type;
  document.getElementById('txFilterCat').value = txFilter.cat;
  document.getElementById('txFilterFrom').value = txFilter.dateFrom;
  document.getElementById('txFilterTo').value = txFilter.dateTo;
}

function applyTxFilter() {
  txFilter.search = document.getElementById('txSearch').value.trim();
  txFilter.type = document.getElementById('txFilterType').value;
  txFilter.cat = document.getElementById('txFilterCat').value;
  txFilter.dateFrom = document.getElementById('txFilterFrom').value;
  txFilter.dateTo = document.getElementById('txFilterTo').value;
  txPage = 1;
  renderTxView();
}

function clearTxFilters() {
  txFilter = { type: 'all', cat: 'all', search: '', dateFrom: '', dateTo: '' };
  txPage = 1;
  syncTxFilterUI();
  renderTxView();
}

function exportCSV() {
  const list = getFilteredTx();
  const rows = [['ID', 'Descripción', 'Categoría', 'Tipo', 'Fecha', 'Monto']];
  list.forEach(t => rows.push([t.id, t.desc, t.cat, t.type === 'income' ? 'Ingreso' : 'Gasto', t.date, t.amount]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flujo_transacciones.csv';
  a.click();
  showToast('📥 CSV exportado');
}

/* Edit */
function openEditModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  editingId = id;

  document.getElementById('editModalTitle').textContent = 'Editar Transacción';
  document.getElementById('eDesc').value = t.desc;
  document.getElementById('eAmount').value = t.amount;
  document.getElementById('eCat').value = t.cat;
  document.getElementById('eDate').value = t.date;
  setEditType(t.type);

  document.getElementById('editModalOverlay').classList.add('open');
}

function setEditType(type) {
  const expBtn = document.getElementById('eTypeExpBtn');
  const incBtn = document.getElementById('eTypeIncBtn');
  expBtn.className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  incBtn.className = 'type-btn' + (type === 'income' ? ' active-income' : '');
  expBtn.dataset.active = type === 'expense' ? '1' : '';
  incBtn.dataset.active = type === 'income' ? '1' : '';
  document.getElementById('editModalOverlay').dataset.type = type;
}

async function saveEdit() {
  const type = document.getElementById('editModalOverlay').dataset.type || 'expense';
  const desc = document.getElementById('eDesc').value.trim();
  const amount = parseFloat(document.getElementById('eAmount').value);
  const cat = document.getElementById('eCat').value;
  const date = document.getElementById('eDate').value;

  if (!desc) { showToast('⚠️ Ingresá una descripción', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Monto inválido', true); return; }
  if (!date) { showToast('⚠️ Seleccioná una fecha', true); return; }

  if (IS_SERVER) {
    try {
      const orig = transactions.find(x => x.id === editingId);
      await apiFetchLocal(`/transactions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          account_id: orig ? orig.account_id : null,
          type,
          desc,
          amount,
          cat,
          date,
          transfer_id: orig ? orig.transfer_id : null
        })
      });
      await loadUserData();
      renderAll();
      if (currentPage === 'transacciones') renderTxView();
      showToast('Transacción actualizada');
    } catch (err) {
      console.error("Error al actualizar transacción:", err);
      showToast("Error al actualizar la transacción en el servidor", true);
    }
  } else {
    const idx = transactions.findIndex(x => x.id === editingId);
    if (idx > -1) {
      transactions[idx] = { ...transactions[idx], type, desc, amount, cat, date };
      save();
      renderAll();
      if (currentPage === 'transacciones') renderTxView();
      showToast('Transacción actualizada');
    }
  }
  closeEditModal();
}

function closeEditModal(e) {
  if (!e || e.target.id === 'editModalOverlay') {
    document.getElementById('editModalOverlay').classList.remove('open');
    editingId = null;
  }
}

/* Delete */
function confirmDelete(id) {
  editingId = id;
  const t = transactions.find(x => x.id === id);
  document.getElementById('deleteModalDesc').textContent = t ? `"${t.desc}" — $${t.amount.toLocaleString('es-AR')}` : '';
  document.getElementById('deleteModalOverlay').classList.add('open');
}

function closeDeleteModal(e) {
  if (!e || e.target.id === 'deleteModalOverlay') {
    document.getElementById('deleteModalOverlay').classList.remove('open');
    editingId = null;
  }
}

async function doDelete() {
  if (IS_SERVER) {
    try {
      await apiFetchLocal(`/transactions/${editingId}`, {
        method: 'DELETE'
      });
      await loadUserData();
      renderAll();
      if (currentPage === 'transacciones') renderTxView();
      showToast('Transacción eliminada');
    } catch (err) {
      console.error("Error al eliminar transacción:", err);
      showToast("Error al eliminar la transacción en el servidor", true);
    }
  } else {
    transactions = transactions.filter(x => x.id !== editingId);
    save();
    renderAll();
    if (currentPage === 'transacciones') renderTxView();
    showToast('Transacción eliminada');
  }
  closeDeleteModal();
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateLong(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* =====================================================
   PRESUPUESTOS
   ===================================================== */
let budgets = [];
let budgetViewMonth = new Date().getMonth();
let budgetViewYear = new Date().getFullYear();
let editingBudgetId = null;
let budgetDonutInstance = null;

const BM_COLORS = [
  '#00e5a0', '#5b8cff', '#ff6b4a', '#ffb84a', '#a78bfa',
  '#fb7185', '#34d399', '#38bdf8', '#f472b6', '#facc15',
  '#4ade80', '#f97316', '#e879f9', '#22d3ee', '#a3e635', '#ff4a6b'
];

let bmSelectedColor = BM_COLORS[0];
let bmEditingId = null;

function saveBudgets() {
  localStorage.setItem(userKey('flujo_budgets'), JSON.stringify(budgets));
}

function initBudgets() {
  if (budgets.length === 0) {
    budgets = [
      { id: 1, cat: 'Alimentación', name: 'Alimentación', icon: '🍔', limit: 20000, color: '#00e5a0', notes: 'Súper, delivery y cafés' },
      { id: 2, cat: 'Transporte', name: 'Transporte', icon: '🚗', limit: 8000, color: '#5b8cff', notes: 'SUBE, taxi, nafta' },
      { id: 3, cat: 'Entretenimiento', name: 'Entretenimiento', icon: '🎬', limit: 5000, color: '#ffb84a', notes: 'Streaming, salidas' },
      { id: 4, cat: 'Hogar', name: 'Hogar', icon: '🏠', limit: 60000, color: '#ff6b4a', notes: 'Alquiler y servicios' },
      { id: 5, cat: 'Salud', name: 'Salud', icon: '💊', limit: 6000, color: '#a78bfa', notes: 'Farmacia y médicos' },
    ];
    saveBudgets();
  }
}

/* --- Nav entry --- */
function enterBudgetView() {
  document.getElementById('budgetView').style.display = '';
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('txView').style.display = 'none';
  document.getElementById('pageDate').style.display = 'none';
  budgetViewMonth = new Date().getMonth();
  budgetViewYear = new Date().getFullYear();
  renderBudgetView();
}

function changeBudgetMonth(delta) {
  budgetViewMonth += delta;
  if (budgetViewMonth > 11) { budgetViewMonth = 0; budgetViewYear++; }
  if (budgetViewMonth < 0) { budgetViewMonth = 11; budgetViewYear--; }
  renderBudgetView();
}

/* --- Main render --- */
function renderBudgetView() {
  const monthName = new Date(budgetViewYear, budgetViewMonth, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());

  document.getElementById('bvMonthLabel').textContent = monthName;
  document.getElementById('bvDonutMonth').textContent = monthName;

  // Get spending per category for this month
  const monthTx = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date);
    return d.getMonth() === budgetViewMonth && d.getFullYear() === budgetViewYear;
  });

  const spentByCat = {};
  monthTx.forEach(t => { spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount; });

  // Summary header
  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentByCat[b.cat] || 0), 0);
  const totalLeft = totalLimit - totalSpent;
  const fmt = n => '$' + Math.abs(n).toLocaleString('es-AR');

  document.getElementById('bvTotalLimit').textContent = fmt(totalLimit);
  document.getElementById('bvTotalSpent').textContent = fmt(totalSpent);
  const leftEl = document.getElementById('bvTotalLeft');
  leftEl.textContent = (totalLeft < 0 ? '-' : '') + fmt(totalLeft);
  leftEl.style.color = totalLeft >= 0 ? 'var(--accent)' : 'var(--danger)';

  // Cards
  renderBvCards(spentByCat, monthTx);

  // Donut
  renderBudgetDonut(spentByCat);

  // Tip
  renderBvTip(spentByCat);
}

function renderBvCards(spentByCat, monthTx) {
  const el = document.getElementById('bvCards');

  if (budgets.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:48px 24px;text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">🎯</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px;">Sin presupuestos todavía</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">Creá tu primer presupuesto para empezar a controlar tus gastos.</div>
        <button class="btn btn-primary" onclick="openBudgetModal()">+ Nuevo Presupuesto</button>
      </div>`;
    return;
  }

  el.innerHTML = budgets.map(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
    const left = b.limit - spent;
    const over = spent > b.limit;
    const warn = pct >= 80 && !over;

    const barColor = over ? 'var(--danger)' : warn ? 'var(--warn)' : b.color;

    let statusHtml;
    if (spent === 0) statusHtml = `<span class="bv-status empty"><span class="bv-dot"></span>Sin gastos</span>`;
    else if (over) statusHtml = `<span class="bv-status danger"><span class="bv-dot"></span>Excedido ${fmt2(spent - b.limit)}</span>`;
    else if (warn) statusHtml = `<span class="bv-status warn"><span class="bv-dot"></span>Casi al límite</span>`;
    else statusHtml = `<span class="bv-status ok"><span class="bv-dot"></span>En presupuesto</span>`;

    // Last 3 txs for this category in this month
    const catTx = monthTx.filter(t => t.cat === b.cat).sort((a, c) => new Date(c.date) - new Date(a.date)).slice(0, 3);
    const txRows = catTx.map(t => `
      <div class="bv-tx-item">
        <div>
          <div class="bv-tx-desc">${escHtml(t.desc)}</div>
          <div class="bv-tx-date">${formatDate(t.date)}</div>
        </div>
        <div class="bv-tx-amt">-$${t.amount.toLocaleString('es-AR')}</div>
      </div>
    `).join('');

    return `
      <div class="bv-card" id="bvc-${b.id}">
        <div class="bv-card-top">
          <div class="bv-card-left">
            <div class="bv-card-icon" style="background:${b.color}18;">${b.icon || '📦'}</div>
            <div>
              <div class="bv-card-name">${escHtml(b.name)}</div>
              <div class="bv-card-sub">${b.notes ? escHtml(b.notes) : b.cat}</div>
            </div>
          </div>
          <div class="bv-card-right">
            <div class="bv-card-pct" style="color:${barColor};">${Math.round(pct)}%</div>
            <div class="bv-card-actions">
              <button class="row-btn edit-btn" onclick="openBudgetModal(${b.id})" title="Editar">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="row-btn delete-btn" onclick="confirmDeleteBudget(${b.id})" title="Eliminar">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="bv-bar-wrap">
          <div class="bv-bar-bg">
            <div class="bv-bar-fill" style="width:${pct}%;background:${barColor};"></div>
          </div>
          <div class="bv-bar-labels">
            <span class="spent" style="color:${barColor};">$${spent.toLocaleString('es-AR')} gastado</span>
            <span>${over ? '<span style="color:var(--danger)">-' + fmt2(Math.abs(left)) + '</span>' : fmt2(left) + ' disponible'}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${statusHtml}
          <span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">Límite: $${b.limit.toLocaleString('es-AR')}</span>
        </div>

        ${catTx.length > 0 ? `
          <div class="bv-tx-list" id="bvtx-${b.id}">
            ${txRows}
          </div>
          <button class="bv-expand-btn" onclick="toggleBvCard(${b.id})" id="bvexp-${b.id}">
            <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            Ver ${catTx.length} movimiento${catTx.length > 1 ? 's' : ''}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function fmt2(n) { return '$' + Math.abs(n).toLocaleString('es-AR'); }

function toggleBvCard(id) {
  const card = document.getElementById('bvc-' + id);
  const txList = document.getElementById('bvtx-' + id);
  const btn = document.getElementById('bvexp-' + id);
  const expanded = card.classList.toggle('expanded');
  if (btn) {
    btn.innerHTML = expanded
      ? `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg> Ocultar movimientos`
      : `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> Ver movimientos`;
  }
}

/* --- Donut chart --- */
function renderBudgetDonut(spentByCat) {
  const canvas = document.getElementById('budgetDonut');
  const ctx = canvas.getContext('2d');

  const data = budgets.map(b => spentByCat[b.cat] || 0);
  const labels = budgets.map(b => b.name);
  const colors = budgets.map(b => b.color);
  const total = data.reduce((s, v) => s + v, 0);

  document.getElementById('bvDonutTotal').textContent = '$' + total.toLocaleString('es-AR');

  if (budgetDonutInstance) budgetDonutInstance.destroy();

  budgetDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: total === 0 ? budgets.map(() => 1) : data,
        backgroundColor: total === 0 ? budgets.map(() => '#1a2030') : colors.map(c => c + 'cc'),
        borderColor: total === 0 ? '#232b3a' : colors,
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131720', borderColor: '#232b3a', borderWidth: 1,
          titleColor: '#e8edf5', bodyColor: '#5a6478', padding: 10,
          callbacks: {
            label: ctx => total === 0 ? ' Sin datos' : ` $${ctx.parsed.toLocaleString('es-AR')}`
          }
        }
      }
    }
  });

  // Legend
  const leg = document.getElementById('bvLegend');
  leg.innerHTML = budgets.map((b, i) => {
    const spent = spentByCat[b.cat] || 0;
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    return `
      <div class="bv-legend-item">
        <div class="bv-legend-left">
          <div class="bv-legend-dot" style="background:${b.color};"></div>
          <span class="bv-legend-name">${b.icon} ${escHtml(b.name)}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="bv-legend-val">$${spent.toLocaleString('es-AR')}</span>
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);min-width:28px;text-align:right;">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

/* --- Tips --- */
function renderBvTip(spentByCat) {
  const tips = [];

  budgets.forEach(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    if (pct > 100) tips.push(`⚠️ Superaste el presupuesto de <strong>${b.name}</strong> en $${(spent - b.limit).toLocaleString('es-AR')}.`);
    else if (pct > 80) tips.push(`🔶 Te queda poco presupuesto en <strong>${b.name}</strong> — solo el ${Math.round(100 - pct)}% disponible.`);
  });

  const allSpent = budgets.reduce((s, b) => s + (spentByCat[b.cat] || 0), 0);
  const allLimit = budgets.reduce((s, b) => s + b.limit, 0);
  if (allSpent === 0) tips.push('📭 Aún no hay gastos registrados para este mes.');
  else if (allSpent / allLimit < 0.5) tips.push('✅ Vas muy bien — llevás menos del 50% del presupuesto total gastado.');

  if (tips.length === 0) tips.push('💪 Todo bajo control. Seguís respetando tus presupuestos.');
  document.getElementById('bvTip').innerHTML = tips[0];
}

/* --- Budget Modal --- */
function openBudgetModal(id) {
  bmEditingId = id || null;
  bmSelectedColor = BM_COLORS[0];

  // Build color grid
  const grid = document.getElementById('bmColorGrid');
  grid.innerHTML = BM_COLORS.map(c => `
    <div class="bv-color-swatch ${c === bmSelectedColor ? 'selected' : ''}"
         style="background:${c};"
         onclick="selectBmColor('${c}')">
    </div>
  `).join('');

  if (id) {
    const b = budgets.find(x => x.id === id);
    if (!b) return;
    document.getElementById('budgetModalTitle').textContent = 'Editar Presupuesto';
    document.getElementById('bmSaveBtn').textContent = 'Guardar cambios';
    const hasCat = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Ropa', 'Otros'].includes(b.cat);
    document.getElementById('bmCat').value = hasCat ? b.cat : 'custom';
    if (!hasCat) {
      document.getElementById('bmCustomWrap').style.display = '';
      document.getElementById('bmCustomName').value = b.name;
    } else {
      document.getElementById('bmCustomWrap').style.display = 'none';
    }
    document.getElementById('bmLimit').value = b.limit;
    document.getElementById('bmIcon').value = b.icon || '';
    document.getElementById('bmNotes').value = b.notes || '';
    bmSelectedColor = b.color;
    // Update swatch selection
    grid.querySelectorAll('.bv-color-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.style.background === b.color || sw.style.backgroundColor === b.color);
    });
  } else {
    document.getElementById('budgetModalTitle').textContent = 'Nuevo Presupuesto';
    document.getElementById('bmSaveBtn').textContent = 'Crear Presupuesto';
    document.getElementById('bmCat').value = 'Alimentación';
    document.getElementById('bmCustomWrap').style.display = 'none';
    document.getElementById('bmCustomName').value = '';
    document.getElementById('bmLimit').value = '';
    document.getElementById('bmIcon').value = '';
    document.getElementById('bmNotes').value = '';
  }

  document.getElementById('budgetModalOverlay').classList.add('open');
}

function selectBmColor(color) {
  bmSelectedColor = color;
  document.querySelectorAll('.bv-color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.style.background === color || sw.style.backgroundColor === color);
  });
}

function onBmCatChange() {
  const val = document.getElementById('bmCat').value;
  document.getElementById('bmCustomWrap').style.display = val === 'custom' ? '' : 'none';
  // Auto-fill icon
  const icons = { 'Alimentación': '🍔', 'Transporte': '🚗', 'Entretenimiento': '🎬', 'Salud': '💊', 'Hogar': '🏠', 'Ropa': '👕', 'Otros': '📦' };
  if (icons[val]) document.getElementById('bmIcon').value = icons[val];
}

function closeBudgetModal(e) {
  if (!e || e.target.id === 'budgetModalOverlay') {
    document.getElementById('budgetModalOverlay').classList.remove('open');
    bmEditingId = null;
  }
}

async function saveBudget() {
  const catSel = document.getElementById('bmCat').value;
  const cat = catSel === 'custom' ? document.getElementById('bmCustomName').value.trim() : catSel;
  const limit = parseFloat(document.getElementById('bmLimit').value);
  const icon = document.getElementById('bmIcon').value.trim() || '📦';
  const notes = document.getElementById('bmNotes').value.trim();

  if (!cat) { showToast('⚠️ Ingresá un nombre de categoría', true); return; }
  if (!limit || limit <= 0) { showToast('⚠️ Ingresá un límite válido', true); return; }

  if (IS_SERVER) {
    try {
      if (bmEditingId) {
        await apiFetchLocal(`/budgets/${bmEditingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            cat,
            name: cat,
            limit,
            icon,
            color: bmSelectedColor,
            notes: notes || null
          })
        });
        showToast('Presupuesto actualizado');
      } else {
        await apiFetchLocal('/budgets', {
          method: 'POST',
          body: JSON.stringify({
            cat,
            name: cat,
            limit,
            icon,
            color: bmSelectedColor,
            notes: notes || null
          })
        });
        showToast('Presupuesto creado');
      }
      await loadUserData();
      renderBudgetView();
      renderBudgets();
    } catch (err) {
      console.error("Error al guardar presupuesto:", err);
      showToast("Error al guardar presupuesto en el servidor", true);
    }
  } else {
    if (bmEditingId) {
      const idx = budgets.findIndex(x => x.id === bmEditingId);
      if (idx > -1) {
        budgets[idx] = { ...budgets[idx], cat, name: cat, limit, icon, color: bmSelectedColor, notes };
        saveBudgets();
        renderBudgetView();
        renderBudgets();
        showToast('Presupuesto actualizado');
      }
    } else {
      const newB = { id: Date.now(), cat, name: cat, limit, icon, color: bmSelectedColor, notes };
      budgets.push(newB);
      saveBudgets();
      renderBudgetView();
      renderBudgets();
      showToast('Presupuesto creado');
    }
  }
  closeBudgetModal();
}

/* --- Delete --- */
function confirmDeleteBudget(id) {
  bmEditingId = id;
  const b = budgets.find(x => x.id === id);
  document.getElementById('bdName').textContent = b ? b.name : '';
  document.getElementById('budgetDeleteOverlay').classList.add('open');
}

function closeBudgetDeleteModal(e) {
  if (!e || e.target.id === 'budgetDeleteOverlay') {
    document.getElementById('budgetDeleteOverlay').classList.remove('open');
    bmEditingId = null;
  }
}

async function doDeleteBudget() {
  if (IS_SERVER) {
    try {
      await apiFetchLocal(`/budgets/${bmEditingId}`, {
        method: 'DELETE'
      });
      await loadUserData();
      renderBudgetView();
      renderBudgets();
      showToast('Presupuesto eliminado');
    } catch (err) {
      console.error("Error al eliminar presupuesto:", err);
      showToast("Error al eliminar presupuesto en el servidor", true);
    }
  } else {
    budgets = budgets.filter(x => x.id !== bmEditingId);
    saveBudgets();
    renderBudgetView();
    renderBudgets();
    showToast('Presupuesto eliminado');
  }
  closeBudgetDeleteModal();
}

/* =====================================================
   CUENTAS
   ===================================================== */
let accounts = [];
let selectedAccountId = null;
let editingAccountId = null;

const ACC_TYPE_LABELS = {
  banco: 'Banco', ahorro: 'Ahorro', efectivo: 'Efectivo',
  tarjeta: 'Tarjeta', inversion: 'Inversión', digital: 'Digital', custom: 'Otro'
};

const ACC_TYPE_ICONS = {
  banco: '🏦', ahorro: '�function saveAccounts() {
  if (!IS_SERVER) {
    localStorage.setItem(userKey('flujo_accounts'), JSON.stringify(accounts));
  }
}

function initAccounts() {
  if (accounts.length === 0) {
    accounts = [
      { id: 1, name: 'Cuenta Corriente', type: 'banco', bank: 'Galicia', balance: 85000, currency: 'ARS', limit: 0, notes: 'Cuenta principal' },
      { id: 2, name: 'Caja de Ahorro', type: 'ahorro', bank: 'Galicia', balance: 42000, currency: 'ARS', limit: 0, notes: 'Fondo de emergencia' },
      { id: 3, name: 'Efectivo', type: 'efectivo', bank: '', balance: 12500, currency: 'ARS', limit: 0, notes: '' },
      { id: 4, name: 'Mercado Pago', type: 'digital', bank: 'Mercado Pago', balance: 8300, currency: 'ARS', limit: 0, notes: 'Para compras online' },
      { id: 5, name: 'Visa Naranja X', type: 'tarjeta', bank: 'Naranja X', balance: -15200, currency: 'ARS', limit: 100000, notes: 'Vence el 10 de cada mes' },
    ];
    saveAccounts();
  }
}

/* ---- Nav entry ---- */
function enterCuentasView() {
  selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
  renderCuentasView();
}

/* ---- Main render ---- */
function renderCuentasView() {
  renderCvWorth();
  renderCvCards();
  renderCvTransferSelects();
  renderCvDetail();
  renderCvTxList();
}

/* Net worth */
function renderCvWorth() {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  document.getElementById('cvNetWorth').textContent = '$' + total.toLocaleString('es-AR');

  document.getElementById('cvWorthBreakdown').innerHTML = accounts.map(a => `
    <div class="cv-worth-chip">
      <div class="cv-worth-chip-dot" style="background:${ACC_TYPE_COLORS[a.type]};"></div>
      <span style="color:var(--muted);">${escHtml(a.name)}</span>
      <span style="color:${a.balance < 0 ? 'var(--danger)' : 'var(--text)'}; font-weight:600;">
        $${a.balance.toLocaleString('es-AR')}
      </span>
    </div>
  `).join('');
}

/* Account cards */
function renderCvCards() {
  const el = document.getElementById('cvCards');

  const cards = accounts.map(a => {
    const color = ACC_TYPE_COLORS[a.type];
    const cls = 'acc-' + a.type;
    const sel = a.id === selectedAccountId ? 'selected' : '';

    // month change
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      const tAccId = t.account_id || t.accountId;
      return (tAccId === a.id) && d.getMonth() === m && d.getFullYear() === y;
    });
    const mInc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return `
      <div class="acc-card ${cls} ${sel}" onclick="selectAccount(${a.id})">
        <div class="acc-card-shine"></div>
        <div class="acc-card-actions">
          <button class="acc-action-btn" onclick="event.stopPropagation();openAccModal(${a.id})" title="Editar">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="acc-action-btn" onclick="event.stopPropagation();confirmDeleteAccount(${a.id})" title="Eliminar">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="acc-card-type">${ACC_TYPE_ICONS[a.type]} ${ACC_TYPE_LABELS[a.type]}${a.currency !== 'ARS' ? ' · ' + a.currency : ''}</div>
        <div class="acc-card-name">${escHtml(a.name)}</div>
        <div class="acc-card-bank">${escHtml(a.bank || '—')}</div>
        <div class="acc-card-balance">$${a.balance.toLocaleString('es-AR')}</div>
        <div class="acc-card-change">
          ${a.type === 'tarjeta' && a.limit ? `Disponible: $${(a.limit + a.balance).toLocaleString('es-AR')}` : `Este mes: +$${mInc.toLocaleString('es-AR')} / -$${mExp.toLocaleString('es-AR')}`}
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = cards + `
    <div class="acc-add-card" onclick="openAccModal()">
      <div class="acc-add-icon">+</div>
      <div style="font-size:13px;font-weight:600;">Agregar cuenta</div>
      <div style="font-size:11px;font-family:var(--font-mono);">banco, efectivo, digital…</div>
    </div>
  `;
}

/* Account detail panel */
function renderCvDetail() {
  const el = document.getElementById('cvDetailBody');
  if (!selectedAccountId) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;padding:20px 0;">Seleccioná una cuenta.</div>`;
    return;
  }

  const a = accounts.find(x => x.id === selectedAccountId);
  if (!a) return;

  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const accTx = transactions.filter(t => (t.account_id || t.accountId) === a.id);
  const monthTx = accTx.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });

  const totalIn = accTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = accTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthIn = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const color = ACC_TYPE_COLORS[a.type];
  const fmt = n => '$' + n.toLocaleString('es-AR');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:44px;height:44px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:22px;">
        ${ACC_TYPE_ICONS[a.type]}
      </div>
      <div>
        <div style="font-size:15px;font-weight:800;">${escHtml(a.name)}</div>
        <div style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">${escHtml(a.bank || ACC_TYPE_LABELS[a.type])}</div>
      </div>
    </div>

    <div style="background:${color}12;border:1px solid ${color}30;border-radius:10px;padding:14px 16px;margin-bottom:16px;text-align:center;">
      <div style="font-size:11px;font-family:var(--font-mono);color:${color};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Saldo actual</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:-1.5px;color:${a.balance < 0 ? 'var(--danger)' : color};">
        ${fmt(a.balance)}
      </div>
      ${a.currency !== 'ARS' ? `<div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);margin-top:2px;">${a.currency}</div>` : ''}
    </div>

    ${a.type === 'tarjeta' && a.limit ? `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-family:var(--font-mono);color:var(--muted);margin-bottom:6px;">
          <span>Límite usado</span>
          <span>${fmt(Math.abs(a.balance))} / ${fmt(a.limit)}</span>
        </div>
        <div class="bv-bar-bg">
          <div class="bv-bar-fill" style="width:${Math.min((Math.abs(a.balance) / a.limit) * 100, 100)}%;background:${(Math.abs(a.balance) / a.limit) > 0.8 ? 'var(--danger)' : 'var(--danger)'};"></div>
        </div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);margin-top:4px;text-align:right;">Disponible: ${fmt(a.limit + a.balance)}</div>
      </div>
    ` : ''}

    <div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Ingresos este mes</span>
        <span class="cv-detail-stat-val" style="color:var(--accent);">+${fmt(monthIn)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Gastos este mes</span>
        <span class="cv-detail-stat-val" style="color:var(--danger);">${fmt(-monthOut)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Total ingresos</span>
        <span class="cv-detail-stat-val" style="color:var(--accent);">+${fmt(totalIn)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Total gastos</span>
        <span class="cv-detail-stat-val" style="color:var(--danger);">${fmt(-totalOut)}</span>
      </div>
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Transacciones</span>
        <span class="cv-detail-stat-val">${accTx.length}</span>
      </div>
      ${a.notes ? `
      <div class="cv-detail-stat">
        <span class="cv-detail-stat-label">Notas</span>
        <span class="cv-detail-stat-val" style="font-weight:400;color:var(--muted);text-align:right;max-width:180px;">${escHtml(a.notes)}</span>
      </div>` : ''}
    </div>

    <div style="margin-top:16px;display:flex;gap:8px;">
      <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:12px;" onclick="openAccModal(${a.id})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button class="btn" style="flex:1;justify-content:center;font-size:12px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);" onclick="openModal()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Registrar
      </button>
    </div>
  `;
}

/* Tx list for selected account */
function renderCvTxList() {
  const el = document.getElementById('cvTxList');

  if (!selectedAccountId) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Seleccioná una cuenta.</div>`;
    document.getElementById('cvTxPanelTitle').textContent = 'Movimientos';
    document.getElementById('cvTxCount').textContent = '—';
    return;
  }

  const a = accounts.find(x => x.id === selectedAccountId);
  const list = transactions.filter(t => (t.account_id || t.accountId) === selectedAccountId)
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

  document.getElementById('cvTxPanelTitle').textContent = a ? `Movimientos — ${a.name}` : 'Movimientos';
  document.getElementById('cvTxCount').textContent = list.length + ' recientes';

  if (list.length === 0) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin movimientos en esta cuenta.<br>Registrá una transacción y asignala a esta cuenta.</div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="cv-tx-item">
      <div class="tx-icon" style="background:${CAT_COLORS[t.cat] || '#ffffff'}22;width:34px;height:34px;font-size:14px;border-radius:8px;flex-shrink:0;">
        ${CAT_ICONS[t.cat] || '📦'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${escHtml(t.desc)}</div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);">${t.cat} · ${formatDate(t.date)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-mono);font-weight:700;font-size:13px;" class="${t.type}">
          ${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString('es-AR')}
        </div>
      </div>
    </div>
  `).join('');
}

/* Transfer selects */
function renderCvTransferSelects() {
  const fromEl = document.getElementById('cvTransferFrom');
  const toEl = document.getElementById('cvTransferTo');
  const opts = accounts.map(a => `<option value="${a.id}">${ACC_TYPE_ICONS[a.type]} ${escHtml(a.name)} ($${a.balance.toLocaleString('es-AR')})</option>`).join('');
  fromEl.innerHTML = opts;
  toEl.innerHTML = opts;
  if (accounts.length > 1) toEl.selectedIndex = 1;
}

function swapTransfer() {
  const f = document.getElementById('cvTransferFrom');
  const t = document.getElementById('cvTransferTo');
  [f.value, t.value] = [t.value, f.value];
}

async function doTransfer() {
  const fromId = parseInt(document.getElementById('cvTransferFrom').value);
  const toId = parseInt(document.getElementById('cvTransferTo').value);
  const amount = parseFloat(document.getElementById('cvTransferAmount').value);
  const desc = document.getElementById('cvTransferDesc').value.trim() || 'Transferencia';

  if (fromId === toId) { showToast('⚠️ Seleccioná cuentas distintas', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }

  const fromAcc = accounts.find(x => x.id === fromId);
  const toAcc = accounts.find(x => x.id === toId);
  if (!fromAcc || !toAcc) return;

  if (IS_SERVER) {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const linkId = Date.now();
      
      await apiFetchLocal('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: fromId,
          type: 'expense',
          desc: `${desc} → ${toAcc.name}`,
          amount,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });
      
      await apiFetchLocal('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: toId,
          type: 'income',
          desc: `${desc} ← ${fromAcc.name}`,
          amount,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });
      
      await loadUserData();
      
      document.getElementById('cvTransferAmount').value = '';
      document.getElementById('cvTransferDesc').value = '';
      renderCuentasView();
      showToast(`✅ Transferidos $${amount.toLocaleString('es-AR')} de ${fromAcc.name} a ${toAcc.name}`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al realizar la transferencia en el servidor', true);
    }
  } else {
    fromAcc.balance -= amount;
    toAcc.balance += amount;
    saveAccounts();

    const dateStr = new Date().toISOString().split('T')[0];
    const linkId = Date.now();
    transactions.unshift({ id: linkId, type: 'expense', desc: `${desc} → ${toAcc.name}`, amount, cat: 'Otros', date: dateStr, accountId: fromId, transferId: linkId });
    transactions.unshift({ id: linkId + 1, type: 'income', desc: `${desc} ← ${fromAcc.name}`, amount, cat: 'Otros', date: dateStr, accountId: toId, transferId: linkId });
    save();

    document.getElementById('cvTransferAmount').value = '';
    document.getElementById('cvTransferDesc').value = '';

    renderCuentasView();
    showToast(`✅ Transferidos $${amount.toLocaleString('es-AR')} de ${fromAcc.name} a ${toAcc.name}`);
  }
}

function selectAccount(id) {
  selectedAccountId = id;
  renderCvCards();
  renderCvDetail();
  renderCvTxList();
}

/* ---- Account Modal ---- */
function openAccModal(id) {
  editingAccountId = id || null;
  document.getElementById('amLimitWrap').style.display = 'none';

  if (id) {
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    document.getElementById('accModalTitle').textContent = 'Editar Cuenta';
    document.getElementById('amSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('amName').value = a.name;
    document.getElementById('amType').value = a.type;
    document.getElementById('amBank').value = a.bank || '';
    document.getElementById('amBalance').value = a.balance;
    document.getElementById('amCurrency').value = a.currency || 'ARS';
    document.getElementById('amNotes').value = a.notes || '';
    if (a.type === 'tarjeta') {
      document.getElementById('amLimitWrap').style.display = '';
      document.getElementById('amLimit').value = a.limit || 0;
    }
  } else {
    document.getElementById('accModalTitle').textContent = 'Nueva Cuenta';
    document.getElementById('amSaveBtn').textContent = 'Crear Cuenta';
    document.getElementById('amName').value = '';
    document.getElementById('amType').value = 'banco';
    document.getElementById('amBank').value = '';
    document.getElementById('amBalance').value = '';
    document.getElementById('amCurrency').value = 'ARS';
    document.getElementById('amNotes').value = '';
    document.getElementById('amLimit').value = '';
  }
  document.getElementById('accModalOverlay').classList.add('open');
}

function onAmTypeChange() {
  const t = document.getElementById('amType').value;
  document.getElementById('amLimitWrap').style.display = t === 'tarjeta' ? '' : 'none';
}

function closeAccModal(e) {
  if (!e || e.target.id === 'accModalOverlay') {
    document.getElementById('accModalOverlay').classList.remove('open');
    editingAccountId = null;
  }
}

async function saveAccount() {
  const name = document.getElementById('amName').value.trim();
  const type = document.getElementById('amType').value;
  const bank = document.getElementById('amBank').value.trim();
  const balance = parseFloat(document.getElementById('amBalance').value) || 0;
  const currency = document.getElementById('amCurrency').value;
  const limit = parseFloat(document.getElementById('amLimit').value) || 0;
  const notes = document.getElementById('amNotes').value.trim();

  if (!name) { showToast('⚠️ Ingresá un nombre para la cuenta', true); return; }

  const payload = { name, type, bank, balance, currency, limit, notes };

  if (IS_SERVER) {
    try {
      if (editingAccountId) {
        const res = await apiFetchLocal(`/accounts/${editingAccountId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          const idx = accounts.findIndex(x => x.id === editingAccountId);
          if (idx > -1) {
            accounts[idx] = res.account;
            renderCuentasView();
            showToast('✏️ Cuenta actualizada');
          }
        }
      } else {
        const res = await apiFetchLocal('/accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          accounts.push(res.account);
          selectedAccountId = res.account.id;
          renderCuentasView();
          showToast('✅ Cuenta creada');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al guardar en el servidor', true);
    }
  } else {
    if (editingAccountId) {
      const idx = accounts.findIndex(x => x.id === editingAccountId);
      if (idx > -1) {
        accounts[idx] = { ...accounts[idx], name, type, bank, balance, currency, limit, notes };
        saveAccounts();
        renderCuentasView();
        showToast('✏️ Cuenta actualizada');
      }
    } else {
      const newA = { id: Date.now(), name, type, bank, balance, currency, limit, notes };
      accounts.push(newA);
      selectedAccountId = newA.id;
      saveAccounts();
      renderCuentasView();
      showToast('✅ Cuenta creada');
    }
  }
  closeAccModal();
}

/* ---- Delete ---- */
function confirmDeleteAccount(id) {
  editingAccountId = id;
  const a = accounts.find(x => x.id === id);
  document.getElementById('adName').textContent = a ? a.name : '';
  document.getElementById('accDeleteOverlay').classList.add('open');
}

function closeAccDeleteModal(e) {
  if (!e || e.target.id === 'accDeleteOverlay') {
    document.getElementById('accDeleteOverlay').classList.remove('open');
    editingAccountId = null;
  }
}

async function doDeleteAccount() {
  if (IS_SERVER) {
    try {
      const res = await apiFetchLocal(`/accounts/${editingAccountId}`, {
        method: 'DELETE'
      });
      if (res && res.ok) {
        transactions.forEach(t => {
          if (t.account_id === editingAccountId || t.accountId === editingAccountId) {
            t.account_id = null;
            t.accountId = null;
          }
        });
        accounts = accounts.filter(x => x.id !== editingAccountId);
        if (selectedAccountId === editingAccountId) selectedAccountId = accounts[0]?.id || null;
        renderCuentasView();
        showToast('🗑️ Cuenta eliminada');
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Error al eliminar en el servidor', true);
    }
  } else {
    accounts = accounts.filter(x => x.id !== editingAccountId);
    if (selectedAccountId === editingAccountId) selectedAccountId = accounts[0]?.id || null;
    saveAccounts();
    renderCuentasView();
    showToast('🗑️ Cuenta eliminada');
  }
  closeAccDeleteModal();
}itingAccountId = null;
  }
}

function doDeleteAccount() {
  accounts = accounts.filter(x => x.id !== editingAccountId);
  if (selectedAccountId === editingAccountId) selectedAccountId = accounts[0]?.id || null;
  saveAccounts();
  renderCuentasView();
  closeAccDeleteModal();
  showToast('🗑️ Cuenta eliminada');
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
  return transactions.filter(t => t.date >= from && t.date <= to);
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
  const prevTx = transactions.filter(t => t.date >= prevFrom.toISOString().split('T')[0] && t.date <= prevTo.toISOString().split('T')[0]);
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
  const colors = sorted.map(([k]) => CAT_COLORS[k] || '#94a3b8');

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
        <div style="width:8px;height:8px;border-radius:2px;background:${CAT_COLORS[cat] || '#94a3b8'};flex-shrink:0;"></div>
        <span style="font-size:12px;font-weight:600;">${CAT_ICONS[cat] || '📦'} ${cat}</span>
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
    const color = CAT_COLORS[cat] || '#94a3b8';
    return `
      <tr class="rv-cat-row">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:30px;height:30px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:14px;">${CAT_ICONS[cat] || '📦'}</div>
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
    const monthTx = transactions.filter(t => {
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
function exportReportCSV() {
  const { from, to } = getRvDateRange();
  const tx = getRvTx();
  const rows = [['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto']];
  tx.sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(t => rows.push([t.date, t.desc, t.cat, t.type === 'income' ? 'Ingreso' : 'Gasto', t.amount]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `flujo_reporte_${from}_${to}.csv`; a.click();
  showToast('📥 Reporte exportado');
}

/* =====================================================
   OBJETIVOS
   ===================================================== */
let goals = [];
let editingGoalId = null;
let contribGoalId = null;
let ovDonutChart = null;
let gmSelectedColor = '#00e5a0';
let gmSelectedEmoji = '🎯';

const GOAL_EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💰', '📚', '💻', '🏖️', '💍', '🎓', '🏋️', '🎸', '📈', '💊', '🛍️', '🐾'];
const GOAL_CAT_EMOJIS = { 'Viaje': '✈️', 'Ahorro': '💰', 'Hogar': '🏠', 'Vehículo': '🚗', 'Educación': '📚', 'Tecnología': '💻', 'Inversión': '📈', 'Salud': '💊', 'Otro': '🎯' };

function saveGoals() { localStorage.setItem(userKey('flujo_goals'), JSON.stringify(goals)); }

function initGoals() {
  if (goals.length === 0) {
    const now = new Date();
    goals = [
      {
        id: 1, name: 'Fondo de emergencia', cat: 'Ahorro', emoji: '💰', color: '#00e5a0',
        target: 300000, current: 120000, contributions: [
          { id: 1, amount: 60000, date: new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString().split('T')[0], note: 'Primer aporte' },
          { id: 2, amount: 60000, date: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString().split('T')[0], note: 'Mes 2' },
        ],
        deadline: new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString().split('T')[0],
        notes: '3 meses de gastos cubiertos', status: 'active'
      },
      {
        id: 2, name: 'Vacaciones en Bariloche', cat: 'Viaje', emoji: '✈️', color: '#5b8cff',
        target: 150000, current: 45000, contributions: [
          { id: 1, amount: 45000, date: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().split('T')[0], note: 'Inicio' },
        ],
        deadline: new Date(now.getFullYear(), now.getMonth() + 6, 15).toISOString().split('T')[0],
        notes: 'Esquí en julio', status: 'active'
      },
      {
        id: 3, name: 'Notebook nueva', cat: 'Tecnología', emoji: '💻', color: '#ffb84a',
        target: 800000, current: 800000, contributions: [
          { id: 1, amount: 400000, date: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0], note: '' },
          { id: 2, amount: 400000, date: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0], note: '' },
        ],
        deadline: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
        notes: '', status: 'active'
      },
    ];
    saveGoals();
  }
}

/* ---- Entry ---- */
function enterObjetivosView() { renderObjetivosView(); }

/* ---- Main render ---- */
function renderObjetivosView() {
  renderOvSummary();
  renderOvCards();
  renderOvDonut();
  renderOvTimeline();
  renderOvTip();
}

/* ---- Helpers ---- */
function goalPct(g) { return g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0; }
function goalLeft(g) { return Math.max(g.target - g.current, 0); }
function daysLeft(g) { if (!g.deadline) return null; return Math.ceil((new Date(g.deadline + ' 00:00:00') - new Date()) / 86400000); }
function isCompleted(g) { return g.current >= g.target; }

function goalStatus(g) {
  if (isCompleted(g)) return { key: 'completed', label: '✅ Completado', cls: 'completed' };
  if (g.status === 'paused') return { key: 'paused', label: '⏸ Pausado', cls: 'paused' };
  const dl = daysLeft(g);
  if (dl !== null && dl < 0) return { key: 'overdue', label: '⚠️ Vencido', cls: 'overdue' };
  // monthly needed
  if (dl !== null && dl > 0) {
    const months = Math.max(dl / 30, 1);
    const needed = goalLeft(g) / months;
    if (needed < 0) return { key: 'ontrack', label: '✅ En camino', cls: 'ontrack' };
  }
  return { key: 'ontrack', label: '🔵 En camino', cls: 'ontrack' };
}

function monthlyNeeded(g) {
  const dl = daysLeft(g);
  if (!dl || dl <= 0 || isCompleted(g)) return 0;
  return Math.ceil(goalLeft(g) / Math.max(dl / 30, 1));
}

/* ---- Summary stats ---- */
function renderOvSummary() {
  const total = goals.length;
  const completed = goals.filter(isCompleted).length;
  const totalSaved = goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const avgPct = total > 0 ? Math.round(goals.reduce((s, g) => s + goalPct(g), 0) / total) : 0;
  const overdue = goals.filter(g => { const dl = daysLeft(g); return dl !== null && dl < 0 && !isCompleted(g); }).length;
  const fmt = n => '$' + n.toLocaleString('es-AR');

  document.getElementById('ovSummary').innerHTML = `
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--accent3);"></div>
      <div class="ov-stat-lbl">Objetivos activos</div>
      <div class="ov-stat-val" style="color:var(--accent3);">${total}</div>
      <div class="ov-stat-sub">${completed} completado${completed !== 1 ? 's' : ''}</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--accent);"></div>
      <div class="ov-stat-lbl">Total ahorrado</div>
      <div class="ov-stat-val" style="color:var(--accent);">${fmt(totalSaved)}</div>
      <div class="ov-stat-sub">de ${fmt(totalTarget)}</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--warn);"></div>
      <div class="ov-stat-lbl">Progreso promedio</div>
      <div class="ov-stat-val" style="color:var(--warn);">${avgPct}%</div>
      <div class="ov-stat-sub">${fmt(totalTarget - totalSaved)} restante</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:${overdue > 0 ? 'var(--danger)' : 'var(--accent)'};"></div>
      <div class="ov-stat-lbl">Estado</div>
      <div class="ov-stat-val" style="color:${overdue > 0 ? 'var(--danger)' : 'var(--accent)'};">${overdue > 0 ? overdue + ' vencido' + (overdue > 1 ? 's' : '') : 'Todo OK'}</div>
      <div class="ov-stat-sub">${goals.filter(g => daysLeft(g) !== null && daysLeft(g) <= 30 && daysLeft(g) > 0 && !isCompleted(g)).length} próximos a vencer</div>
    </div>
  `;
}

/* ---- Goal cards ---- */
function renderOvCards() {
  const el = document.getElementById('ovCards');
  if (goals.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:52px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🎯</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:6px;">Sin objetivos todavía</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6;">Creá tu primer objetivo de ahorro y empezá a seguir tu progreso.</div>
        <button class="btn btn-primary" onclick="openGoalModal()">+ Nuevo Objetivo</button>
      </div>`;
    return;
  }

  // Sort: active first, then completed, then overdue
  const sorted = [...goals].sort((a, b) => {
    const sa = goalStatus(a).key, sb = goalStatus(b).key;
    const order = { ontrack: 0, behind: 1, paused: 2, overdue: 3, completed: 4 };
    return (order[sa] || 0) - (order[sb] || 0);
  });

  el.innerHTML = sorted.map(g => {
    const pct = goalPct(g);
    const left = goalLeft(g);
    const dl = daysLeft(g);
    const status = goalStatus(g);
    const monthly = monthlyNeeded(g);
    const completed = isCompleted(g);
    const fmt = n => '$' + n.toLocaleString('es-AR');

    // SVG ring
    const R = 38, CX = 44, CY = 44, STROKE = 6;
    const circumference = 2 * Math.PI * R;
    const offset = circumference * (1 - pct / 100);
    const ringColor = completed ? 'var(--accent)' : pct >= 80 ? 'var(--warn)' : g.color;

    // deadline text
    let deadlineHtml = '';
    if (dl !== null) {
      if (dl < 0) deadlineHtml = `<span style="color:var(--danger);">Venció hace ${Math.abs(dl)} días</span>`;
      else if (dl === 0) deadlineHtml = `<span style="color:var(--warn);">Vence hoy</span>`;
      else if (dl <= 30) deadlineHtml = `<span style="color:var(--warn);">${dl} días restantes</span>`;
      else deadlineHtml = `<span>${dl} días · ${formatDateLong(g.deadline)}</span>`;
    }

    return `
      <div class="ov-card ${completed ? 'completed-card' : ''}" id="ovc-${g.id}">
        <div class="ov-card-accent" style="background:${g.color};"></div>

        <div class="ov-card-header">
          <div class="ov-card-left">
            <div class="ov-card-icon" style="background:${g.color}18;">${g.emoji || '🎯'}</div>
            <div>
              <div class="ov-card-name">${escHtml(g.name)}</div>
              <div class="ov-card-cat">${g.cat}${g.notes ? ` · ${escHtml(g.notes)}` : ''}</div>
            </div>
          </div>
          <div class="ov-card-actions">
            <button class="row-btn edit-btn"   onclick="openGoalModal(${g.id})"     title="Editar">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" onclick="openGoalDeleteModal(${g.id})" title="Eliminar">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>

        <!-- Ring + amounts -->
        <div class="ov-ring-wrap">
          <div class="ov-ring" style="width:88px;height:88px;">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle class="ov-ring-bg"   cx="${CX}" cy="${CY}" r="${R}" stroke-width="${STROKE}"/>
              <circle class="ov-ring-fill" cx="${CX}" cy="${CY}" r="${R}" stroke-width="${STROKE}"
                stroke="${ringColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"
                transform="rotate(-90 ${CX} ${CY})"/>
            </svg>
            <div class="ov-ring-pct">
              <div class="ov-ring-num" style="color:${ringColor};">${Math.round(pct)}%</div>
              <div class="ov-ring-label">logrado</div>
            </div>
          </div>

          <div class="ov-amounts">
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Ahorrado</span>
              <span class="ov-amount-val" style="color:${g.color};">${fmt(g.current)}</span>
            </div>
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Meta</span>
              <span class="ov-amount-val">${fmt(g.target)}</span>
            </div>
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Falta</span>
              <span class="ov-amount-val" style="color:${left > 0 ? 'var(--muted)' : 'var(--accent)'};">${left > 0 ? fmt(left) : '¡Meta alcanzada!'}</span>
            </div>
            ${monthly > 0 ? `
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Necesitás/mes</span>
              <span class="ov-amount-val" style="color:var(--warn);">${fmt(monthly)}</span>
            </div>`: ''}
          </div>
        </div>

        <!-- Bar -->
        <div class="ov-bar-wrap">
          <div class="ov-bar-bg">
            <div class="ov-bar-fill" style="width:${pct}%;background:${ringColor};"></div>
          </div>
          <div class="ov-bar-labels">
            <span>${fmt(g.current)} ahorrado</span>
            <span>${fmt(g.target)} meta</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="ov-footer">
          <span class="ov-status-chip ${status.cls}">${status.label}</span>
          <span class="ov-deadline">${deadlineHtml}</span>
        </div>

        ${completed
        ? `<div class="ov-completed-banner">🎉 ¡Objetivo completado! Felicitaciones.</div>`
        : `<button class="ov-contrib-btn" onclick="openContribModal(${g.id})">
               <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
               Agregar aporte
             </button>`
      }
      </div>
    `;
  }).join('');
}

/* ---- Donut ---- */
function renderOvDonut() {
  const ctx = document.getElementById('ovDonutChart').getContext('2d');
  const active = goals.filter(g => !isCompleted(g));
  const done = goals.filter(isCompleted);

  const labels = goals.map(g => g.name);
  const data = goals.map(g => g.current);
  const colors = goals.map(g => g.color + 'cc');
  const borders = goals.map(g => g.color);

  const totalSaved = goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const globalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  document.getElementById('ovDonutPct').textContent = globalPct + '%';
  document.getElementById('ovDonutBadge').textContent = goals.length + ' objetivo' + (goals.length !== 1 ? 's' : '');

  if (ovDonutChart) ovDonutChart.destroy();

  ovDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: goals.length === 0 ? [1] : data,
        backgroundColor: goals.length === 0 ? ['#1a2030'] : colors,
        borderColor: goals.length === 0 ? ['#232b3a'] : borders,
        borderWidth: 2, hoverOffset: 5
      }]
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131720', borderColor: '#232b3a', borderWidth: 1,
          titleColor: '#e8edf5', bodyColor: '#5a6478', padding: 10,
          callbacks: { label: c => ` $${c.parsed.toLocaleString('es-AR')}` }
        }
      }
    }
  });

  const leg = document.getElementById('ovDonutLegend');
  if (goals.length === 0) { leg.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:8px 0;">Sin objetivos.</div>'; return; }
  leg.innerHTML = goals.map(g => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:8px;height:8px;border-radius:2px;background:${g.color};flex-shrink:0;"></div>
        <span style="font-size:12px;font-weight:600;">${g.emoji} ${escHtml(g.name)}</span>
      </div>
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">${Math.round(goalPct(g))}%</span>
    </div>
  `).join('');
}

/* ---- Timeline ---- */
function renderOvTimeline() {
  const el = document.getElementById('ovTimeline');

  const upcoming = goals
    .filter(g => !isCompleted(g) && g.deadline)
    .map(g => ({ ...g, dl: daysLeft(g) }))
    .sort((a, b) => a.dl - b.dl)
    .slice(0, 5);

  if (upcoming.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:12px 0;">Sin vencimientos próximos.</div>`;
    return;
  }

  el.innerHTML = upcoming.map((g, i) => {
    const cls = g.dl < 0 ? 'future' : i === 0 ? 'active' : 'done';
    const clr = g.dl < 0 ? 'var(--danger)' : i === 0 ? 'var(--accent3)' : 'var(--accent)';
    let dlText = g.dl < 0 ? `Venció hace ${Math.abs(g.dl)}d` : g.dl === 0 ? 'Vence hoy' : `${g.dl} días`;
    return `
      <div class="ov-tl-item">
        <div class="ov-tl-dot ${cls}" style="border-color:${clr};color:${clr};">${g.emoji}</div>
        <div class="ov-tl-content">
          <div class="ov-tl-title">${escHtml(g.name)}</div>
          <div class="ov-tl-meta">${dlText} · ${Math.round(goalPct(g))}% completado · falta $${goalLeft(g).toLocaleString('es-AR')}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ---- Tips ---- */
function renderOvTip() {
  const tips = [];
  goals.forEach(g => {
    const dl = daysLeft(g);
    const m = monthlyNeeded(g);
    if (isCompleted(g)) tips.push(`🏆 ¡Felicitaciones por cumplir tu objetivo <strong>${g.name}</strong>!`);
    else if (dl !== null && dl < 0) tips.push(`⏰ El objetivo <strong>${g.name}</strong> venció. Considerá actualizarlo o marcarlo como completado.`);
    else if (dl !== null && dl <= 30 && !isCompleted(g)) tips.push(`🔔 <strong>${g.name}</strong> vence en ${dl} días — necesitás ahorrar $${m.toLocaleString('es-AR')} más.`);
  });
  if (!tips.length) {
    const totalLeft = goals.reduce((s, g) => s + goalLeft(g), 0);
    tips.push(totalLeft > 0 ? `💪 Seguís en camino. Te faltan $${totalLeft.toLocaleString('es-AR')} para completar todos tus objetivos.` : `✨ Sin objetivos activos. ¡Creá uno nuevo para empezar a ahorrar!`);
  }
  document.getElementById('ovTip').innerHTML = tips[0];
}

/* ---- Goal modal ---- */
function openGoalModal(id) {
  editingGoalId = id || null;
  gmSelectedColor = '#00e5a0';
  gmSelectedEmoji = '🎯';

  // Build emoji grid
  document.getElementById('gmEmojiGrid').innerHTML = GOAL_EMOJIS.map(e => `
    <button class="ov-emoji-btn ${e === gmSelectedEmoji ? 'active' : ''}" onclick="selectGmEmoji('${e}')">${e}</button>
  `).join('');

  // Build color grid
  document.getElementById('gmColorGrid').innerHTML = BM_COLORS.map(c => `
    <div class="bv-color-swatch ${c === gmSelectedColor ? 'selected' : ''}" style="background:${c};" onclick="selectGmColor('${c}')"></div>
  `).join('');

  if (id) {
    const g = goals.find(x => x.id === id);
    if (!g) return;
    document.getElementById('goalModalTitle').textContent = 'Editar Objetivo';
    document.getElementById('gmSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('gmName').value = g.name;
    document.getElementById('gmTarget').value = g.target;
    document.getElementById('gmCurrent').value = g.current;
    document.getElementById('gmDeadline').value = g.deadline || '';
    document.getElementById('gmCat').value = g.cat;
    document.getElementById('gmNotes').value = g.notes || '';
    gmSelectedColor = g.color;
    gmSelectedEmoji = g.emoji || '🎯';
    // Refresh grids with correct selection
    document.getElementById('gmEmojiGrid').innerHTML = GOAL_EMOJIS.map(e => `
      <button class="ov-emoji-btn ${e === gmSelectedEmoji ? 'active' : ''}" onclick="selectGmEmoji('${e}')">${e}</button>
    `).join('');
    document.getElementById('gmColorGrid').innerHTML = BM_COLORS.map(c => `
      <div class="bv-color-swatch ${c === gmSelectedColor ? 'selected' : ''}" style="background:${c};" onclick="selectGmColor('${c}')"></div>
    `).join('');
  } else {
    document.getElementById('goalModalTitle').textContent = 'Nuevo Objetivo';
    document.getElementById('gmSaveBtn').textContent = 'Crear Objetivo';
    document.getElementById('gmName').value = '';
    document.getElementById('gmTarget').value = '';
    document.getElementById('gmCurrent').value = '0';
    document.getElementById('gmDeadline').value = '';
    document.getElementById('gmCat').value = 'Viaje';
    document.getElementById('gmNotes').value = '';
  }
  document.getElementById('goalModalOverlay').classList.add('open');
}

function selectGmEmoji(e) {
  gmSelectedEmoji = e;
  document.querySelectorAll('.ov-emoji-btn').forEach(b => b.classList.toggle('active', b.textContent === e));
}

function selectGmColor(c) {
  gmSelectedColor = c;
  document.querySelectorAll('#gmColorGrid .bv-color-swatch').forEach(s => {
    s.classList.toggle('selected', s.style.background === c || s.style.backgroundColor === c);
  });
}

function closeGoalModal(e) {
  if (!e || e.target.id === 'goalModalOverlay') {
    document.getElementById('goalModalOverlay').classList.remove('open');
    editingGoalId = null;
  }
}

async function saveGoal() {
  const name = document.getElementById('gmName').value.trim();
  const target = parseFloat(document.getElementById('gmTarget').value);
  const current = parseFloat(document.getElementById('gmCurrent').value) || 0;
  const deadline = document.getElementById('gmDeadline').value;
  const cat = document.getElementById('gmCat').value;
  const notes = document.getElementById('gmNotes').value.trim();

  if (!name) { showToast('⚠️ Ingresá un nombre', true); return; }
  if (!target || target <= 0) { showToast('⚠️ Ingresá una meta válida', true); return; }

  if (IS_SERVER) {
    try {
      if (editingGoalId) {
        await apiFetchLocal(`/goals/${editingGoalId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            target,
            current,
            deadline: deadline || null,
            cat,
            notes: notes || null,
            emoji: gmSelectedEmoji,
            color: gmSelectedColor,
            status: 'active'
          })
        });
        showToast('Objetivo actualizado');
      } else {
        await apiFetchLocal('/goals', {
          method: 'POST',
          body: JSON.stringify({
            name,
            target,
            current,
            deadline: deadline || null,
            cat,
            notes: notes || null,
            emoji: gmSelectedEmoji,
            color: gmSelectedColor,
            status: 'active'
          })
        });
        showToast('Objetivo creado');
      }
      await loadUserData();
      renderObjetivosView();
    } catch (err) {
      console.error("Error al guardar objetivo:", err);
      showToast("Error al guardar objetivo en el servidor", true);
    }
  } else {
    if (editingGoalId) {
      const idx = goals.findIndex(x => x.id === editingGoalId);
      if (idx > -1) {
        goals[idx] = { ...goals[idx], name, target, current, deadline, cat, notes, emoji: gmSelectedEmoji, color: gmSelectedColor };
        saveGoals(); renderObjetivosView();
        showToast('Objetivo actualizado');
      }
    } else {
      goals.push({ id: Date.now(), name, target, current, deadline, cat, notes, emoji: gmSelectedEmoji, color: gmSelectedColor, contributions: [], status: 'active' });
      saveGoals(); renderObjetivosView();
      showToast('Objetivo creado');
    }
  }
  closeGoalModal();
}

/* ---- Contribute modal ---- */
function openContribModal(id) {
  contribGoalId = id;
  const g = goals.find(x => x.id === id);
  if (!g) return;

  document.getElementById('contribModalTitle').textContent = `Aportar a: ${g.name}`;
  document.getElementById('contribGoalInfo').textContent = `Ahorrado: $${g.current.toLocaleString('es-AR')} / $${g.target.toLocaleString('es-AR')} — Falta: $${goalLeft(g).toLocaleString('es-AR')}`;
  document.getElementById('cmAmount').value = '';
  document.getElementById('cmDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('cmNote').value = '';

  // History
  const hist = document.getElementById('cmHistory');
  const contribs = (g.contributions || []).slice().reverse();
  hist.innerHTML = contribs.length === 0
    ? `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:12px 0;">Sin aportes previos.</div>`
    : `<div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;padding:10px 0 6px;">Historial de aportes</div>`
    + contribs.map(c => `
        <div class="ov-contrib-row">
          <div>
            <div style="font-weight:600;">$${c.amount.toLocaleString('es-AR')}</div>
            <div style="color:var(--muted);font-size:10px;">${formatDate(c.date)}${c.note ? ' · ' + escHtml(c.note) : ''}</div>
          </div>
          <button class="row-btn delete-btn" onclick="deleteContrib(${id},${c.id})" title="Eliminar">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      `).join('');

  document.getElementById('contribModalOverlay').classList.add('open');
}

function closeContribModal(e) {
  if (!e || e.target.id === 'contribModalOverlay') {
    document.getElementById('contribModalOverlay').classList.remove('open');
    contribGoalId = null;
  }
}

async function saveContrib() {
  const amount = parseFloat(document.getElementById('cmAmount').value);
  const date = document.getElementById('cmDate').value;
  const note = document.getElementById('cmNote').value.trim();

  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }
  if (!date) { showToast('⚠️ Seleccioná una fecha', true); return; }

  const idx = goals.findIndex(x => x.id === contribGoalId);
  if (idx < 0) return;

  if (IS_SERVER) {
    try {
      await apiFetchLocal(`/goals/${contribGoalId}/contributions`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          date,
          note: note || null
        })
      });
      await loadUserData();
      renderObjetivosView();
      openContribModal(contribGoalId);
      showToast(`Aportado $${amount.toLocaleString('es-AR')}`);
    } catch (err) {
      console.error("Error al guardar aporte:", err);
      showToast("Error al registrar aporte en el servidor", true);
    }
  } else {
    if (!goals[idx].contributions) goals[idx].contributions = [];
    goals[idx].contributions.push({ id: Date.now(), amount, date, note });
    goals[idx].current += amount;

    saveGoals();
    renderObjetivosView();
    openContribModal(contribGoalId); // refresh history in modal
    showToast(`Aportado $${amount.toLocaleString('es-AR')}`);
  }
}

async function deleteContrib(goalId, contribId) {
  const idx = goals.findIndex(x => x.id === goalId);
  if (idx < 0) return;

  if (IS_SERVER) {
    try {
      await apiFetchLocal(`/goals/${goalId}/contributions/${contribId}`, {
        method: 'DELETE'
      });
      await loadUserData();
      renderObjetivosView();
      openContribModal(goalId);
      showToast('Aporte eliminado');
    } catch (err) {
      console.error("Error al eliminar aporte:", err);
      showToast("Error al eliminar aporte en el servidor", true);
    }
  } else {
    const c = goals[idx].contributions.find(x => x.id === contribId);
    if (!c) return;
    goals[idx].current = Math.max(goals[idx].current - c.amount, 0);
    goals[idx].contributions = goals[idx].contributions.filter(x => x.id !== contribId);
    saveGoals();
    renderObjetivosView();
    openContribModal(goalId);
    showToast('Aporte eliminado');
  }
}

/* ---- Delete goal ---- */
function openGoalDeleteModal(id) {
  editingGoalId = id;
  const g = goals.find(x => x.id === id);
  document.getElementById('gdName').textContent = g ? g.name : '';
  document.getElementById('goalDeleteOverlay').classList.add('open');
}

function closeGoalDeleteModal(e) {
  if (!e || e.target.id === 'goalDeleteOverlay') {
    document.getElementById('goalDeleteOverlay').classList.remove('open');
    editingGoalId = null;
  }
}

async function doDeleteGoal() {
  if (IS_SERVER) {
    try {
      await apiFetchLocal(`/goals/${editingGoalId}`, {
        method: 'DELETE'
      });
      await loadUserData();
      renderObjetivosView();
      showToast('Objetivo eliminado');
    } catch (err) {
      console.error("Error al eliminar objetivo:", err);
      showToast("Error al eliminar objetivo en el servidor", true);
    }
  } else {
    goals = goals.filter(x => x.id !== editingGoalId);
    saveGoals(); renderObjetivosView();
    showToast('Objetivo eliminado');
  }
  closeGoalDeleteModal();
}

/* =====================================================
   TOAST
   ===================================================== */
let toastTimer;
function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show', 'error'); }, 3000);
}

/* =====================================================
   SCANNER — Estado
   ===================================================== */
let scCameraStream = null;
let scCapturedBlob = null;
let scCapturedDataUrl = null;
let scCurrentTab = 'camera';
let scScanHistory = [];
let scCurrentParsedData = null;

/* =====================================================
   SCANNER — Internacionalización y Patrones Dinámicos (Universal)
   ===================================================== */
let scActivePatterns = null;
let scUserCountry = 'AR';
let scCurrencySymbol = '$';
let scDecimalSeparator = ',';
let scThousandsSeparator = '.';
let scIsHighDenomination = false;

function scDetectUserCountry() {
  const langs = navigator.languages || [navigator.language || 'es-AR'];
  for (const lang of langs) {
    const parts = lang.split('-');
    if (parts.length > 1) {
      return parts[1].toUpperCase();
    }
  }
  const mainLang = (navigator.language || 'es-AR').split('-')[0].toUpperCase();
  // Fallbacks de idioma comunes a país
  const langToCountry = { 'ES': 'ES', 'FR': 'FR', 'IT': 'IT', 'DE': 'DE', 'JA': 'JP', 'KO': 'KR', 'EN': 'US' };
  return langToCountry[mainLang] || 'AR';
}

async function scLoadOCRPatterns() {
  if (scActivePatterns) return;
  try {
    const res = await fetch('data/OCR_PATTERNS.json');
    scActivePatterns = await res.json();
    scUserCountry = scDetectUserCountry();
    console.log('País detectado automáticamente para OCR:', scUserCountry);

    const locale = navigator.language || 'es-AR';
    scIsHighDenomination = scActivePatterns.high_denomination_currencies.codes.includes(scUserCountry) ||
      ['CL', 'CO', 'JP', 'KR', 'VN', 'ID', 'HU', 'PY'].includes(scUserCountry);

    try {
      const numFormat = new Intl.NumberFormat(locale);
      const formatted = numFormat.format(1.2);
      scDecimalSeparator = formatted.includes(',') ? ',' : '.';
      scThousandsSeparator = scDecimalSeparator === ',' ? '.' : ',';

      const currencyMap = {
        'AR': 'ARS', 'ES': 'EUR', 'CL': 'CLP', 'CO': 'COP', 'MX': 'MXN',
        'US': 'USD', 'UY': 'UYU', 'PE': 'PEN', 'BR': 'BRL', 'PY': 'PYG',
        'VE': 'VES', 'BO': 'BOB', 'EC': 'USD', 'GT': 'GTQ', 'HN': 'HNL'
      };
      const currencyCode = currencyMap[scUserCountry] || 'USD';
      const currencyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
      const parts = currencyFormat.formatToParts(100);
      const symbolPart = parts.find(p => p.type === 'currency');
      scCurrencySymbol = symbolPart ? symbolPart.value : '$';

      console.log(`[OCR] Configuración regional cargada: Símbolo = ${scCurrencySymbol}, Decimal = ${scDecimalSeparator}, Es alta denominación = ${scIsHighDenomination}`);
    } catch (intlErr) {
      console.warn('Error configurando Intl para moneda, usando fallbacks:', intlErr);
      if (['AR', 'ES', 'UY', 'CL', 'BR'].includes(scUserCountry)) {
        scDecimalSeparator = ',';
        scThousandsSeparator = '.';
        scCurrencySymbol = scUserCountry === 'ES' ? '€' : '$';
      } else {
        scDecimalSeparator = '.';
        scThousandsSeparator = ',';
        scCurrencySymbol = '$';
      }
    }
  } catch (err) {
    console.error('Error al cargar OCR_PATTERNS.json, inicializando fallback local:', err);
    scActivePatterns = {
      global_brands: { supermarkets: [], gas_stations: [], fast_food_and_cafes: [], services_and_entertainment: [], clothing_and_home: [] },
      multilingual_categories: [],
      payment_methods: [
        { name: "Mercado Pago", keywords: ["mercadopago", "mp"], code: "mercado_pago" },
        { name: "Efectivo", keywords: ["efectivo", "cash"], code: "cash" }
      ],
      common_ocr_errors: [],
      validation_settings: {
        store_name: { min_length: 3, max_length: 80, reject_patterns: ["^\\d+$"] },
        amount_ranges: { standard: { min: 0.1, max: 10000 }, high_denomination: { min: 100, max: 5000000 } }
      }
    };
  }
}

/* =====================================================
   SCANNER — Nav & View
   ===================================================== */
function enterScannerView() {
  scRenderHistory();
  // Pre-inicializar worker y cargar patrones en segundo plano
  scLoadOCRPatterns().catch(err => console.warn('Carga de patrones fallida:', err));
  scInitWorker().catch(err => console.warn('Pre-inicialización de Tesseract fallida:', err));
}

/* =====================================================
   SCANNER — Tabs
   ===================================================== */
function scSwitchTab(tab) {
  scCurrentTab = tab;
  document.getElementById('scTabCamera').classList.toggle('active', tab === 'camera');
  document.getElementById('scTabUpload').classList.toggle('active', tab === 'upload');
  document.getElementById('scCameraPanel').style.display = tab === 'camera' ? '' : 'none';
  document.getElementById('scUploadPanel').style.display = tab === 'upload' ? '' : 'none';
  if (tab !== 'camera' && scCameraStream) scStopCamera();
}

/* =====================================================
   SCANNER — Camara
   ===================================================== */
function scToggleCamera() {
  scCameraStream ? scStopCamera() : scStartCamera();
}

async function scStartCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    scCameraStream = stream;
    const video = document.getElementById('scVideo');
    video.srcObject = stream;
    document.getElementById('scBtnCapture').disabled = false;
    document.getElementById('scCamBtnLabel').textContent = 'Detener Camara';
    document.getElementById('scScanLine').classList.add('active');
    showToast('Camara activada');
  } catch (err) {
    showToast('No se pudo acceder a la camara: ' + err.message, true);
  }
}

function scStopCamera() {
  if (scCameraStream) { scCameraStream.getTracks().forEach(t => t.stop()); scCameraStream = null; }
  const video = document.getElementById('scVideo');
  video.srcObject = null;
  document.getElementById('scBtnCapture').disabled = true;
  document.getElementById('scCamBtnLabel').textContent = 'Activar Camara';
  document.getElementById('scScanLine').classList.remove('active');
}

function scCapturePhoto() {
  const video = document.getElementById('scVideo');
  const canvas = document.getElementById('scCanvas');
  if (!scCameraStream || video.readyState < 2) { showToast('La camara aun no esta lista', true); return; }
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  scCapturedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  scShowPreview(scCapturedDataUrl);
  scStopCamera();
  setTimeout(scScanTicket, 300);
}

/* =====================================================
   SCANNER — Upload / Drag & Drop
   ===================================================== */
function scDragOver(e) { e.preventDefault(); document.getElementById('scDropzone').classList.add('drag-over'); }
function scDragLeave() { document.getElementById('scDropzone').classList.remove('drag-over'); }

function scDrop(e) {
  e.preventDefault();
  document.getElementById('scDropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) scProcessFile(file);
}

function scFileSelected(e) {
  const file = e.target.files[0];
  if (file) scProcessFile(file);
}

function scProcessFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Solo se aceptan imagenes', true); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Max. 10MB', true); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    scCapturedDataUrl = ev.target.result;
    scShowPreview(scCapturedDataUrl);
    setTimeout(scScanTicket, 300);
  };
  reader.readAsDataURL(file);
}

function scShowPreview(dataUrl) {
  // Ocultar paneles de captura y pestañas
  document.getElementById('scCameraPanel').style.display = 'none';
  document.getElementById('scUploadPanel').style.display = 'none';
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = 'none';

  // Mostrar la sección de vista previa con la imagen cargada
  const previewImg = document.getElementById('scPreviewImg');
  if (previewImg) previewImg.src = dataUrl;

  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = '';
}

function scResetCapture() {
  scCapturedDataUrl = null;
  scCapturedBlob = null;

  // Ocultar sección de vista previa
  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = 'none';

  // Volver a mostrar las pestañas y el panel según la pestaña actual
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = '';

  scSwitchTab(scCurrentTab);
}

/* =====================================================
   SCANNER — Tesseract.js Worker Persistente (Fase 2)
   ===================================================== */
let scTesseractWorker = null;

async function scInitWorker() {
  if (scTesseractWorker) return scTesseractWorker;

  try {
    scTesseractWorker = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => {
        const loadingMsg = document.getElementById('scLoadingMsg');
        if (!loadingMsg) return;

        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          loadingMsg.textContent = 'Reconociendo texto... ' + pct + '%';
        } else if (m.status === 'loading tesseract core') {
          loadingMsg.textContent = 'Cargando motor de IA...';
        } else if (m.status === 'initializing api') {
          loadingMsg.textContent = 'Inicializando motor OCR...';
        } else {
          loadingMsg.textContent = 'Procesando...';
        }
      }
    });

    await scTesseractWorker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,:/\\-() ÁÉÍÓÚÑáéíóúñ%#'
    });
  } catch (err) {
    console.error('Error al inicializar Tesseract Worker:', err);
    scTesseractWorker = null;
    throw err;
  }
  return scTesseractWorker;
}

async function scCleanupWorker() {
  if (scTesseractWorker) {
    const worker = scTesseractWorker;
    scTesseractWorker = null;
    try {
      await worker.terminate();
      console.log('Tesseract Worker terminado.');
    } catch (err) {
      console.error('Error al terminar Tesseract Worker:', err);
    }
  }
}

/* =====================================================
   SCANNER — Preprocesamiento de Imagen (Fase 1)
   ===================================================== */
function otsuThreshold(grayArray) {
  const hist = new Int32Array(256);
  const total = grayArray.length;
  for (let i = 0; i < total; i++) hist[grayArray[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

function detectSkewAngle(grayArray, width, height) {
  const sampleWidth = 300;
  const sampleHeight = Math.round((height * sampleWidth) / width);
  const scale = width / sampleWidth;
  const binarizedSample = new Uint8Array(sampleWidth * sampleHeight);

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const origX = Math.floor(x * scale);
      const origY = Math.floor(y * scale);
      binarizedSample[y * sampleWidth + x] = grayArray[origY * width + origX] < 128 ? 1 : 0;
    }
  }

  let bestAngle = 0, maxVariance = 0;
  for (let angle = -10; angle <= 10; angle += 1) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const projections = new Int32Array(sampleHeight);
    const midX = sampleWidth / 2, midY = sampleHeight / 2;

    for (let y = 0; y < sampleHeight; y++) {
      for (let x = 0; x < sampleWidth; x++) {
        if (binarizedSample[y * sampleWidth + x] === 1) {
          const rotY = Math.round((x - midX) * sin + (y - midY) * cos + midY);
          if (rotY >= 0 && rotY < sampleHeight) projections[rotY]++;
        }
      }
    }

    let mean = 0;
    for (let i = 0; i < sampleHeight; i++) mean += projections[i];
    mean /= sampleHeight;

    let variance = 0;
    for (let i = 0; i < sampleHeight; i++) {
      const diff = projections[i] - mean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

async function scPreprocessImage(dataUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width, height = img.height;
      if (width < 1500) {
        width *= 2;
        height *= 2;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      let imgData = ctx.getImageData(0, 0, width, height);
      let data = imgData.data;
      const totalPixels = width * height;

      const gray = new Uint8Array(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }

      if (!options.noDeskew) {
        const skewAngle = detectSkewAngle(gray, width, height);
        if (skewAngle !== 0) {
          const rad = (skewAngle * Math.PI) / 180;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d');

          tempCtx.translate(width / 2, height / 2);
          tempCtx.rotate(rad);
          tempCtx.drawImage(canvas, -width / 2, -height / 2);

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(tempCanvas, 0, 0);

          imgData = ctx.getImageData(0, 0, width, height);
          data = imgData.data;
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          }
        }
      }

      if (options.clahe) {
        let min = 255, max = 0;
        for (let i = 0; i < totalPixels; i++) {
          if (gray[i] < min) min = gray[i];
          if (gray[i] > max) max = gray[i];
        }
        const range = max - min || 1;
        for (let i = 0; i < totalPixels; i++) {
          gray[i] = Math.round(((gray[i] - min) / range) * 255);
        }
      }

      let finalGray = gray;
      if (!options.noDenoise) {
        finalGray = new Uint8Array(totalPixels);
        finalGray.set(gray);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const n0 = gray[idx - width - 1], n1 = gray[idx - width], n2 = gray[idx - width + 1];
            const n3 = gray[idx - 1], n4 = gray[idx], n5 = gray[idx + 1];
            const n6 = gray[idx + width - 1], n7 = gray[idx + width], n8 = gray[idx + width + 1];
            const arr = [n0, n1, n2, n3, n4, n5, n6, n7, n8];
            arr.sort((a, b) => a - b);
            finalGray[idx] = arr[4];
          }
        }
      }

      if (options.grayscaleOnly) {
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const val = finalGray[i];
          data[idx] = val; data[idx + 1] = val; data[idx + 2] = val; data[idx + 3] = 255;
        }
      } else {
        const threshold = otsuThreshold(finalGray);
        let blackCount = 0;
        for (let i = 0; i < totalPixels; i++) {
          const val = finalGray[i] > threshold ? 255 : 0;
          if (val === 0) blackCount++;
          const idx = i * 4;
          data[idx] = val; data[idx + 1] = val; data[idx + 2] = val; data[idx + 3] = 255;
        }

        if (blackCount > totalPixels * 0.5) {
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const val = data[idx] === 0 ? 255 : 0;
            data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.onerror = err => reject(err);
    img.src = dataUrl;
  });
}

/* =====================================================
   SCANNER — OCR con Tesseract.js (Fase 2 & Fase 6)
   ===================================================== */
function scMergeScannerResults(res1, res2) {
  const merged = {};
  merged.fieldConfidence = {};

  const fields = ['nombre_local', 'fecha', 'hora', 'total', 'forma_pago', 'direccion', 'categoria'];
  for (const f of fields) {
    const conf1 = (res1.fieldConfidence && res1.fieldConfidence[f]) || 0;
    const conf2 = (res2.fieldConfidence && res2.fieldConfidence[f]) || 0;

    if (conf1 >= conf2) {
      merged[f] = res1[f];
      merged.fieldConfidence[f] = conf1;
    } else {
      merged[f] = res2[f];
      merged.fieldConfidence[f] = conf2;
    }
  }

  merged.descripcion = merged.nombre_local ? 'Compra en ' + merged.nombre_local : 'Ticket escaneado';
  merged.texto_crudo = (res1.texto_crudo || '') + '\n\n--- SEGUNDA PASADA (PSM 4) ---\n\n' + (res2.texto_crudo || '');
  merged.articulos = (res1.articulos && res1.articulos.length >= (res2.articulos ? res2.articulos.length : 0)) ? res1.articulos : res2.articulos;

  let totalScore = 0, count = 0;
  totalScore += merged.fieldConfidence.nombre_local; count++;
  totalScore += merged.fieldConfidence.fecha; count++;
  totalScore += merged.fieldConfidence.total; count++;
  if (merged.hora) { totalScore += merged.fieldConfidence.hora; count++; }
  if (merged.forma_pago !== 'No especificado') { totalScore += merged.fieldConfidence.forma_pago; count++; }

  merged.confianza = Math.max(Math.round(totalScore / count), 10);
  return merged;
}

async function scScanTicket() {
  if (!scCapturedDataUrl) { showToast('No hay imagen lista', true); return; }

  scShowLoading('Iniciando motor de IA...');
  let worker;
  try {
    worker = await scInitWorker();
  } catch (err) {
    scHideLoading();
    showToast('Error al iniciar motor OCR: ' + err.message, true);
    return;
  }

  scShowLoading('Procesando imagen (Pasada 1)...');
  let processedUrl1 = scCapturedDataUrl;
  try {
    processedUrl1 = await scPreprocessImage(scCapturedDataUrl, { clahe: false, grayscaleOnly: false });
  } catch (err) {
    console.warn('Fallo preprocesamiento 1:', err);
  }

  scShowLoading('Analizando texto (Pasada 1)...');
  let text1 = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const { data: { text } } = await worker.recognize(processedUrl1);
    text1 = text;
  } catch (err) {
    console.error('Error pasada 1:', err);
  }

  const result1 = scParseTicketText(text1);

  scShowLoading('Optimizando imagen (Pasada 2)...');
  let processedUrl2 = scCapturedDataUrl;
  try {
    processedUrl2 = await scPreprocessImage(scCapturedDataUrl, { clahe: true, grayscaleOnly: true, noDenoise: true });
  } catch (err) {
    console.warn('Fallo preprocesamiento 2:', err);
  }

  scShowLoading('Analizando texto (Pasada 2)...');
  let text2 = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    const { data: { text } } = await worker.recognize(processedUrl2);
    text2 = text;
  } catch (err) {
    console.error('Error pasada 2:', err);
  }

  const result2 = scParseTicketText(text2);
  const mergedResult = scMergeScannerResults(result1, result2);

  let finalResult = mergedResult;

  if (IS_SERVER) {
    scShowLoading('Analizando ticket con IA...');
    try {
      const aiData = await apiFetch('/ocr/parse', {
        method: 'POST',
        body: JSON.stringify({ text: mergedResult.texto_crudo })
      });

      if (aiData && !aiData.fallback) {
        finalResult = {
          nombre_local: aiData.nombre_local || mergedResult.nombre_local,
          fecha: aiData.fecha || mergedResult.fecha,
          hora: aiData.hora || mergedResult.hora,
          total: aiData.total != null ? aiData.total : mergedResult.total,
          forma_pago: aiData.forma_pago || mergedResult.forma_pago,
          direccion: aiData.direccion || mergedResult.direccion,
          categoria: aiData.categoria || mergedResult.categoria,
          descripcion: aiData.nombre_local ? 'Compra en ' + aiData.nombre_local : 'Ticket escaneado (IA)',
          texto_crudo: mergedResult.texto_crudo,
          confianza: aiData.confianza || 95,
          fieldConfidence: aiData.fieldConfidence || {
            nombre_local: aiData.nombre_local ? 95 : 30,
            fecha: aiData.fecha ? 95 : 30,
            hora: aiData.hora ? 95 : 30,
            total: aiData.total != null ? 95 : 30,
            forma_pago: aiData.forma_pago ? 95 : 30,
            direccion: aiData.direccion ? 95 : 30,
            categoria: aiData.categoria ? 95 : 30
          },
          articulos: aiData.articulos || mergedResult.articulos
        };
      }
    } catch (err) {
      console.warn('Fallo el parseo por IA, usando fallback heuristico:', err);
    }
  }

  scHideLoading();
  scShowResultModal(finalResult);
}

/* =====================================================
   SCANNER — Algoritmos auxiliares de Lógica Difusa
   ===================================================== */
function getLevenshteinDistance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findKeywordFuzzy(lines, keywords, maxDistance = 2) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    const words = line.split(/[^\w\u00C0-\u024F]+/).filter(Boolean);
    for (const word of words) {
      if (word.length < 3) continue;
      for (const kw of keywords) {
        const allowedDist = (kw.length <= 4 || word.length <= 4) ? 0 : maxDistance;
        const dist = getLevenshteinDistance(word, kw);
        if (dist <= allowedDist) {
          return { lineIndex: i, word, matchedKeyword: kw, fullLine: lines[i] };
        }
      }
    }
  }
  return null;
}

/* =====================================================
   SCANNER — Parser de ticket argentino (Fase 3)
   ===================================================== */
function scParseTicketText(raw) {
  const text = raw || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const rxExclude = /ITEMS|SOLD|RETURNEO|RETURN|CHANGE|VUELTO|VUELT|CHANGE|CANTIDAD|CANT|PRICE|UNIT|FEE|TEL|PHONE|CUIT|RUT|NIF|VAT|TAX|RFC|NIT|FECHA|HORA|CASHIER|CAJERA/i;
  const rxTotal = /TOTAL|PAGAR|IMPORTE|NETO|FINAL|AMOUNT|EBT|CASH|EFECTIVO|VISA|DEBITO|CREDITO|TRANSFERENCIA|PAGO|TOTAL DUE|BALANCE DUE/i;
  const rxSubtotal = /SUBTOTAL|SUB-OTAL|SUB TOTAL/i;

  // Cargar rangos de montos dinámicos según el tipo de moneda del país
  const amountLimits = scActivePatterns ?
    (scIsHighDenomination ? scActivePatterns.validation_settings.amount_ranges.high_denomination : scActivePatterns.validation_settings.amount_ranges.standard) :
    { min: 0.10, max: 1000000 };

  // 1. EXTRAER ARTÍCULOS
  const items = [];
  const rxItemLine = /^\s*(?:(\d+(?:[.,]\d+)?)\s*(?:x|unid|un)?\s+)?([A-Z0-9\s&.\-\/]{4,30})\s+[$€£¥]?\s*([\d.,OoSsBbIiLl|]+)\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (rxExclude.test(line) || rxTotal.test(line) || rxSubtotal.test(line) ||
      /cuit|rut|nif|vat|tax|rfc|nit|fecha|hora|telefono|tel:|cajera|factura/i.test(line)) {
      continue;
    }
    const m = line.match(rxItemLine);
    if (m) {
      const qty = m[1] ? parseFloat(m[1].replace(',', '.')) : 1;
      const desc = m[2].trim();
      const priceVal = scParseAmount(m[3]);
      if (priceVal && priceVal > 0 && priceVal < amountLimits.max && desc.length >= 3) {
        items.push({ qty, desc, price: priceVal, total: qty * priceVal });
      }
    }
  }
  const sumItems = items.reduce((s, it) => s + it.total, 0);

  // 2. EXTRAER EL TOTAL CON SCORING CONTEXTUAL
  let total = null;
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].toUpperCase();
    line = line.replace(/\b\d{2,4}[\/\-\.]\d{2}[\/\-\.]\d{2,4}\b/g, '');
    line = line.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
    line = line.replace(/\b\d{3}[-\.]\d{3}[-\.]\d{4}\b/g, '');
    line = line.replace(/\b(?:20|23|24|27|30|33|34)\-?\d{8}\-?\d\b/g, ''); // CUITs / RUTs

    const numMatches = line.match(/[\d.,OoIiLlSsBb|]{3,}/g);
    if (!numMatches) continue;

    for (const numStr of numMatches) {
      const val = scParseAmount(numStr);
      if (!val || val < amountLimits.min || val > amountLimits.max || /^\d{11}$/.test(String(val))) continue;

      let score = 0;
      if (rxTotal.test(lines[i])) score += 100;
      if (rxSubtotal.test(lines[i])) score += 40;
      if (lines[i].includes(scCurrencySymbol)) score += 30;
      if (i > lines.length * 0.6) score += 30;
      if (/[.,]\d{2}$/.test(numStr)) score += 20;
      if (sumItems > 0 && Math.abs(val - sumItems) / sumItems <= 0.05) score += 150;
      if (rxExclude.test(lines[i])) score -= 200;

      candidates.push({ value: val, score: score, line: lines[i] });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    total = candidates[0].value;
  }

  // 3. EXTRAER LA FECHA (Tolerancia multiformato)
  let fecha = null;
  const cleanTextForDate = text
    .replace(/(\d|[Oo])(\d|[Oo])[\/\-\.](\d|[Oo])(\d|[Oo])[\/\-\.](\d|[Oo]|[IiLl]){2,4}/g, m => {
      return m.replace(/[Oo]/g, '0').replace(/[IiLl]/g, '1');
    });

  let dateRxList = [];
  if (scActivePatterns && scActivePatterns.date_formats) {
    scActivePatterns.date_formats.forEach(f => {
      let fn;
      if (f.name === 'YYYY_MM_DD') {
        fn = m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      } else if (f.name === 'MM_DD_YYYY') {
        fn = m => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      } else if (f.name === 'DD_MM_YY') {
        fn = m => `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      } else { // DD_MM_YYYY
        fn = m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      dateRxList.push({ rx: new RegExp(f.regex), fn: fn });
    });
  } else {
    dateRxList = [
      { rx: /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/, fn: m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
      { rx: /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/, fn: m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
      { rx: /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2})/, fn: m => `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    ];
  }

  for (const { rx, fn } of dateRxList) {
    const m = cleanTextForDate.match(rx);
    if (m) {
      const d = fn(m);
      if (!isNaN(Date.parse(d))) { fecha = d; break; }
    }
  }

  const hoy = new Date().toISOString().split('T')[0];
  const dateFormattedSlash = hoy.split('-').reverse().join('/');
  const dateFormattedDash = hoy.split('-').reverse().join('-');
  const textRawUpper = text.toUpperCase();
  const containsTodayDate = textRawUpper.includes(hoy) || textRawUpper.includes(dateFormattedSlash) || textRawUpper.includes(dateFormattedDash);
  if (!fecha) fecha = hoy;

  // 4. EXTRAER LA HORA
  let hora = null;
  const cleanTextForTime = text
    .replace(/(\d|[Oo])?(\d|[Oo]):(\d|[Oo])(\d|[Oo])(?::(\d|[Oo])(\d|[Oo]))?/g, m => {
      return m.replace(/[Oo]/g, '0').replace(/[IiLl]/g, '1');
    });
  const tm = cleanTextForTime.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (tm) {
    const h = parseInt(tm[1]), mn = parseInt(tm[2]);
    if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
      hora = String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
    }
  }

  // 5. FORMA DE PAGO (Detección dinámica)
  let forma_pago = 'No especificado';
  let payKeywords = [];
  if (scActivePatterns && scActivePatterns.payment_methods) {
    payKeywords = scActivePatterns.payment_methods.map(p => ({ keys: p.keywords.map(k => k.toUpperCase()), label: p.name }));
  } else {
    payKeywords = [
      { keys: ['MERCADOPAGO', 'MPAGO', 'MERCADO PAGO', 'MP'], label: 'Mercado Pago' },
      { keys: ['VISA'], label: 'Tarjeta Visa' },
      { keys: ['EFECTIVO', 'CASH', 'CONTADO'], label: 'Efectivo' }
    ];
  }
  for (const item of payKeywords) {
    const match = findKeywordFuzzy(lines, item.keys, 1);
    if (match) { forma_pago = item.label; break; }
  }

  // 6. NOMBRE DEL LOCAL (Algoritmo Heurístico Universal + Diccionario Global)
  let nombre_local = '';
  let bestNameScore = -100;

  const rxStoreSuffix = /\b(S\.A\.|S\.R\.L\.|S\.A\.S|S\.A|SRL|SAS|MARKET|SUPERMERCADO|EXPRESS|ALMACEN|DESPENSA|PANADERIA|CARNICERIA|KIOSCO|FARMACIA|CAFE|BAR|RESTAURANTE|RESTAURANT|SHELL|YPF|AXION|PUMA|STORE|SHOP|GROCERY|HYPERMARKET|MALL|SUPER)\b/i;

  let globalBrandsList = [];
  if (scActivePatterns && scActivePatterns.global_brands) {
    Object.keys(scActivePatterns.global_brands).forEach(key => {
      scActivePatterns.global_brands[key].forEach(brand => {
        globalBrandsList.push(...brand.keywords);
      });
    });
  }
  const rxGlobalBrands = globalBrandsList.length > 0 ?
    new RegExp('\\b(' + globalBrandsList.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|').toUpperCase() + ')\\b', 'i') :
    /\b(COTO|CARREFOUR|DIA|JUMBO|DISCO|VEA|CHANGOMAS|YPF|SHELL|AXION|PUMA|MCDONALD|STARBUCKS|BURGER KING|MOSTAZA|ZARA|HM|NETFLIX|SPOTIFY|STEAM|EASY|SODIMAC)\b/i;

  for (let idx = 0; idx < Math.min(8, lines.length); idx++) {
    const l = lines[idx];
    const cleanL = l.replace(/[^\w\s\u00C0-\u024F&.,\-]/g, '').trim();
    if (cleanL.length <= 3 || /^\d+$/.test(cleanL) || /^[.\-_]/.test(cleanL) ||
      /cuit|rut|nif|vat|tax|rfc|nit|ticket|factura|responsable|monotributo|telefono|tel:|email|fecha|hora/i.test(cleanL)) {
      continue;
    }

    let nameScore = 0;
    nameScore += (8 - idx) * 3;
    if (cleanL.length >= 5 && cleanL.length <= 30) nameScore += 10;
    if (rxStoreSuffix.test(cleanL)) nameScore += 45;
    if (rxGlobalBrands.test(cleanL)) nameScore += 130; // Boost para marcas globales conocidas

    if (/\b(total|subtotal|neto|pagar|pago|vuelto|importe|visa|mastercard|debito|efectivo|cambio|items|fiscal|duplicado|original|tax|vat|invoice|receipt)\b/i.test(cleanL)) {
      nameScore -= 150;
    }

    const digits = cleanL.replace(/\D/g, '');
    if (digits.length > 0) {
      nameScore -= digits.length * 15;
    }

    const upperCount = (cleanL.match(/[A-Z]/g) || []).length;
    const letterCount = (cleanL.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 0 && (upperCount / letterCount) > 0.8) nameScore += 15;

    if (nameScore > bestNameScore) {
      bestNameScore = nameScore;
      nombre_local = cleanL;
    }
  }

  // 7. DIRECCIÓN
  let direccion = null;
  const addrM = text.match(/\b(AV\.|AVDA|CALLE|RUTA|PASAJE|BVAR|BLVD|DIAGONAL|PEATONAL|STREET|ST|AVE|ROAD|RD|BOULEVARD)\b\.?\s+[\w\sñáéíóúÁÉÍÓÚ]+(?:\bN°?\s*\d+|\d+)/i);
  if (addrM) direccion = addrM[0].trim();

  // 8. CATEGORÍA (Búsqueda multilingüe)
  let categoria = 'Otros';
  let catKeywords = [];
  if (scActivePatterns && scActivePatterns.multilingual_categories) {
    catKeywords = scActivePatterns.multilingual_categories.map(c => ({ cat: c.category, keys: c.keywords.map(k => k.toUpperCase()) }));
  } else {
    catKeywords = [
      { cat: 'Salud / Farmacia', keys: ['FARMACIA', 'FARMA', 'DROGUERIA', 'OPTICA', 'MEDICO', 'CLINICA', 'PHARMACY', 'DRUGSTORE'] },
      { cat: 'Transporte', keys: ['NAFTA', 'YPF', 'SHELL', 'AXION', 'PUMA', 'SUBE', 'PEAJE', 'TAXI', 'UBER', 'CABIFY', 'GAS', 'STATION', 'FUEL'] },
      { cat: 'Entretenimiento / Suscripciones', keys: ['CINE', 'TEATRO', 'NETFLIX', 'SPOTIFY', 'STEAM', 'PLAYSTATION', 'GAME', 'SHOW', 'MOVIE'] },
      { cat: 'Compras / Ropa', keys: ['ROPA', 'ZARA', 'HM', 'SHOPPING', 'ELECTRONICA', 'CLOTHING', 'WEAR', 'SHOES', 'BOUTIQUE'] },
      { cat: 'Hogar / Servicios', keys: ['FERRETERIA', 'EASY', 'SODIMAC', 'MUEBLE', 'LUZ', 'AGUA', 'GAS', 'EXPENSAS', 'RENT', 'HARDWARE', 'IKEA'] },
      { cat: 'Salidas / Restaurantes', keys: ['CAFETERIA', 'CAFE', 'DELIVERY', 'BURGER', 'MCDON', 'PIZZA', 'RESTAURANT', 'BAR', 'COFFEE', 'STARBUCKS'] },
      { cat: 'Supermercado / Almacén', keys: ['SUPER', 'MARKET', 'MERCADO', 'CARREFOUR', 'DISCO', 'JUMBO', 'COTO', 'DIA', 'VERDULERIA', 'ALMACEN', 'GROCERY'] }
    ];
  }
  const linesWithLocal = [...lines, nombre_local];
  for (const item of catKeywords) {
    const match = findKeywordFuzzy(linesWithLocal, item.keys, 1);
    if (match) { categoria = item.cat; break; }
  }

  // 9. CONFIANZA POR CAMPO
  const confidence = {
    nombre_local: nombre_local ? Math.min(Math.max(bestNameScore + 30, 20), 98) : 0,
    fecha: (fecha === hoy && !containsTodayDate) ? 35 : 95,
    hora: hora ? 90 : 0,
    total: total ? (candidates[0].score > 100 ? 98 : 65) : 0,
    forma_pago: forma_pago !== 'No especificado' ? 95 : 0,
    direccion: direccion ? 85 : 0,
    categoria: categoria !== 'Otros' ? 90 : 40
  };

  // 10. APRENDIZAJE PREVIO
  const learned = scGetLearnedData(nombre_local);
  if (learned) {
    nombre_local = learned.nombre_local;
    categoria = learned.categoria;
    forma_pago = learned.forma_pago;
    confidence.nombre_local = 99;
    confidence.categoria = 99;
    confidence.forma_pago = 99;
  }

  let totalScore = 0, count = 0;
  totalScore += confidence.nombre_local; count++;
  totalScore += confidence.fecha; count++;
  totalScore += confidence.total; count++;
  if (hora) { totalScore += confidence.hora; count++; }
  if (forma_pago !== 'No especificado') { totalScore += confidence.forma_pago; count++; }
  const globalConfidence = Math.max(Math.round(totalScore / count), 10);

  return {
    nombre_local, fecha, hora, total, forma_pago, direccion, categoria,
    descripcion: nombre_local ? 'Compra en ' + nombre_local : 'Ticket escaneado',
    texto_crudo: raw, confianza: globalConfidence, fieldConfidence: confidence, articulos: items
  };
}

function scParseAmount(str) {
  if (!str) return null;
  let s = str.trim().replace(/\s+/g, '');
  s = s.replace(/(?<=\d)[Oo](?=\d)/g, '0').replace(/(?<=\d)[Oo]$/g, '0').replace(/^[Oo](?=\d)/g, '0');
  s = s.replace(/(?<=\d)[Ss](?=\d)/g, '5').replace(/(?<=\d)[Ss]$/g, '5').replace(/^[Ss](?=\d)/g, '5');
  s = s.replace(/(?<=\d)B(?=\d)/g, '8').replace(/(?<=\d)B$/g, '8').replace(/^B(?=\d)/g, '8');
  s = s.replace(/(?<=\d)[IiLl|](?=\d)/g, '1').replace(/(?<=\d)[IiLl|]$/g, '1').replace(/^[IiLl|](?=\d)/g, '1');
  s = s.replace(/[^\d.,-]/g, '');
  if (!s) return null;

  const decMatch = s.match(/[.,](\d{2})$/);
  if (decMatch) {
    const decimalPart = decMatch[1];
    const integerPart = s.substring(0, s.length - 3).replace(/[.,]/g, '');
    return parseFloat(`${integerPart}.${decimalPart}`) || null;
  }
  const countCommas = (s.match(/,/g) || []).length;
  const countDots = (s.match(/\./g) || []).length;
  if (countCommas === 1 && countDots === 0) s = s.replace(',', '.');
  else if (countDots === 1 && countCommas === 0) { }
  else s = s.replace(/[.,]/g, '');
  return parseFloat(s) || null;
}

/* =====================================================
   SCANNER — Loading overlay
   ===================================================== */
function scShowLoading(msg) {
  document.getElementById('scLoadingMsg').textContent = msg || 'Procesando...';
  document.getElementById('scLoadingOverlay').style.display = 'flex';
}
function scHideLoading() {
  document.getElementById('scLoadingOverlay').style.display = 'none';
}

/* =====================================================
   SCANNER — Modal de resultado (Fase 4)
   ===================================================== */
function scShowResultModal(data) {
  scCurrentParsedData = data;
  const fName = document.getElementById('scfName');
  const fDate = document.getElementById('scfDate');
  const fTime = document.getElementById('scfTime');
  const fAmount = document.getElementById('scfAmount');
  const fPayment = document.getElementById('scfPayment');
  const fAddress = document.getElementById('scfAddress');
  const fDesc = document.getElementById('scfDesc');
  const fCat = document.getElementById('scfCat');

  fName.value = data.nombre_local || '';
  fDate.value = data.fecha || new Date().toISOString().split('T')[0];
  fTime.value = data.hora || '';
  fAmount.value = data.total != null ? data.total : '';
  fAddress.value = data.direccion || '';
  fDesc.value = data.descripcion || '';
  document.getElementById('scRawText').textContent = data.texto_crudo || '(sin texto)';

  const cats = [
    'Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios',
    'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación',
    'Ingresos (Sueldo/Freelance)', 'Ahorro / Inversiones', 'Otros'
  ];
  fCat.value = cats.includes(data.categoria) ? data.categoria : 'Otros';

  const pays = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Tarjeta Visa', 'Tarjeta Mastercard',
    'Tarjeta Amex', 'Transferencia', 'Mercado Pago', 'Cuenta DNI', 'MODO', 'Naranja X', 'QR', 'No especificado'];
  fPayment.value = pays.includes(data.forma_pago) ? data.forma_pago : 'No especificado';

  // 1. Barra de confianza global
  const confRow = document.getElementById('scConfidenceRow');
  const confBar = document.getElementById('scConfidenceBar');
  const confVal = document.getElementById('scConfidenceVal');
  if (confRow && confBar && confVal) {
    confRow.style.display = 'flex';
    confBar.style.width = data.confianza + '%';
    confVal.textContent = data.confianza + '%';
    if (data.confianza >= 70) {
      confBar.style.background = 'var(--accent)';
      confVal.style.color = 'var(--accent)';
    } else if (data.confianza >= 40) {
      confBar.style.background = 'var(--warn)';
      confVal.style.color = 'var(--warn)';
    } else {
      confBar.style.background = 'var(--danger)';
      confVal.style.color = 'var(--danger)';
    }
  }

  // 2. Indicadores individuales por campo
  const fieldList = [
    { id: 'scfName', statusId: 'scStatusName', conf: data.fieldConfidence?.nombre_local },
    { id: 'scfDate', statusId: 'scStatusDate', conf: data.fieldConfidence?.fecha },
    { id: 'scfTime', statusId: 'scStatusTime', conf: data.fieldConfidence?.hora },
    { id: 'scfAmount', statusId: 'scStatusAmount', conf: data.fieldConfidence?.total },
    { id: 'scfPayment', statusId: 'scStatusPayment', conf: data.fieldConfidence?.forma_pago },
    { id: 'scfCat', statusId: 'scStatusCat', conf: data.fieldConfidence?.categoria },
    { id: 'scfAddress', statusId: 'scStatusAddress', conf: data.fieldConfidence?.direccion }
  ];

  fieldList.forEach(f => {
    const inputEl = document.getElementById(f.id);
    const statusEl = document.getElementById(f.statusId);
    if (!inputEl || !statusEl) return;

    inputEl.classList.remove('sc-field-warning', 'sc-field-danger');
    statusEl.innerHTML = ''; // Keep UI clean: no green/yellow/red circles

    // Clear input if confidence is very low (below 35%) so it remains blank
    const confVal = f.conf || 0;
    if (confVal < 35) {
      if (inputEl.tagName === 'SELECT') {
        inputEl.selectedIndex = 0; // Default option
      } else {
        inputEl.value = '';
      }
    }
  });

  // 3. Preview de artículos detectados
  const itemsWrap = document.getElementById('scItemsWrap');
  const itemsCount = document.getElementById('scItemsCount');
  const itemsList = document.getElementById('scItemsList');
  if (itemsWrap && itemsCount && itemsList) {
    if (data.articulos && data.articulos.length > 0) {
      itemsWrap.style.display = 'block';
      itemsCount.textContent = data.articulos.length;
      itemsList.innerHTML = data.articulos.map(it => `
        <div style="display:flex;justify-content:space-between;width:100%;">
          <span>${it.qty}x ${it.desc}</span>
          <span style="font-family:var(--font-mono);">$${it.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      `).join('');
    } else {
      itemsWrap.style.display = 'none';
    }
  }

  document.getElementById('scResultOverlay').classList.add('open');
}

function scCloseResultModal(e) {
  if (!e || e.target.id === 'scResultOverlay')
    document.getElementById('scResultOverlay').classList.remove('open');
}

function scToggleRaw() {
  const el = document.getElementById('scRawText');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function scToggleItems() {
  const el = document.getElementById('scItemsList');
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

/* =====================================================
   SCANNER — Módulo de Aprendizaje (Fase 5)
   ===================================================== */
function scLearnFromTicket(name, cat, payment) {
  if (!name || name.length < 3) return;
  const key = userKey('flujo_ocr_dictionary');
  let dict = {};
  try { dict = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { dict = {}; }

  const norm = name.trim().toUpperCase();
  if (!dict[norm]) {
    dict[norm] = { originalName: name.trim(), categories: {}, payments: {}, count: 0 };
  }
  const entry = dict[norm];
  entry.count++;
  entry.categories[cat] = (entry.categories[cat] || 0) + 1;
  entry.payments[payment] = (entry.payments[payment] || 0) + 1;
  localStorage.setItem(key, JSON.stringify(dict));
}

function scGetLearnedData(name) {
  if (!name || name.length < 3) return null;
  const key = userKey('flujo_ocr_dictionary');
  let dict = {};
  try { dict = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return null; }

  const norm = name.trim().toUpperCase();
  if (dict[norm]) return scExtractLearnedFields(dict[norm]);

  let best = null, minDist = 3;
  for (const k in dict) {
    const d = getLevenshteinDistance(norm, k);
    if (d < minDist) { minDist = d; best = dict[k]; }
  }
  return best ? scExtractLearnedFields(best) : null;
}

function scExtractLearnedFields(entry) {
  let bestCat = 'Otros', maxCat = 0;
  for (const c in entry.categories) {
    if (entry.categories[c] > maxCat) { maxCat = entry.categories[c]; bestCat = c; }
  }
  let bestPay = 'Efectivo', maxPay = 0;
  for (const p in entry.payments) {
    if (entry.payments[p] > maxPay) { maxPay = entry.payments[p]; bestPay = p; }
  }
  return { nombre_local: entry.originalName, categoria: bestCat, forma_pago: bestPay };
}

/* =====================================================
   SCANNER — Guardar como transaccion
   ===================================================== */
function scSaveTicket() {
  const name = document.getElementById('scfName').value.trim();
  const amount = parseFloat(document.getElementById('scfAmount').value);
  const date = document.getElementById('scfDate').value;
  const cat = document.getElementById('scfCat').value;
  const payment = document.getElementById('scfPayment').value;
  const address = document.getElementById('scfAddress').value.trim();
  const desc = document.getElementById('scfDesc').value.trim();
  const time = document.getElementById('scfTime').value;

  if (!amount || amount <= 0) { showToast('Ingresa un monto valido', true); return; }
  if (!date) { showToast('Selecciona una fecha', true); return; }

  scLearnFromTicket(name, cat, payment);

  const txDesc = desc || (name ? 'Compra en ' + name : 'Ticket escaneado');
  addTransaction({
    type: 'expense', desc: txDesc, amount, cat, date,
    ticket: { nombre_local: name, hora: time, forma_pago: payment, direccion: address, escaneado: new Date().toISOString() }
  });

  scScanHistory.unshift({ id: Date.now(), name: name || txDesc, amount, cat, date, payment });
  if (scScanHistory.length > 20) scScanHistory = scScanHistory.slice(0, 20);
  localStorage.setItem(userKey('flujo_scan_history'), JSON.stringify(scScanHistory));

  if (IS_SERVER && scCurrentParsedData && scCurrentParsedData.articulos && scCurrentParsedData.articulos.length > 0) {
    apiFetch('/ocr/save', {
      method: 'POST',
      body: JSON.stringify({
        nombre_local: name,
        fecha: date,
        articulos: scCurrentParsedData.articulos
      })
    }).then(res => {
      console.log('Artículos guardados en base de datos:', res);
    }).catch(err => {
      console.error('Error al guardar artículos en base de datos:', err);
    });
  }

  scCloseResultModal();
  scResetCapture();
  scRenderHistory();
  showToast('Ticket guardado: -$' + amount.toLocaleString('es-AR') + ' en ' + cat);
}

/* =====================================================
   SCANNER — Historial
   ===================================================== */
function scRenderHistory() {
  const el = document.getElementById('scHistoryList');
  if (!scScanHistory || scScanHistory.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:16px 0;">Aun no escaneaste ningun ticket.</div>';
    return;
  }
  el.innerHTML = scScanHistory.slice(0, 8).map(h =>
    '<div class="sc-history-item">' +
    '<div class="sc-history-icon">' + (CAT_ICONS[h.cat] || '🧾') + '</div>' +
    '<div class="sc-history-info">' +
    '<div class="sc-history-name">' + escHtml(h.name) + '</div>' +
    '<div class="sc-history-meta">' + formatDateLong(h.date) + (h.payment ? ' · ' + h.payment : '') + '</div>' +
    '</div>' +
    '<div class="sc-history-amt">-$' + h.amount.toLocaleString('es-AR') + '</div>' +
    '</div>'
  ).join('');
}

/* =====================================================
   AUTH SYSTEM — Main Dashboard Session Check
   ===================================================== */

const AUTH_KEY = 'flujo_auth_user';

// Modo servidor vs. archivo local
const IS_SERVER = window.location.protocol !== 'file:';

// Base URL de la API (si está en localhost apunta al puerto 8000 de FastAPI)
const API_BASE = IS_SERVER
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://' + window.location.hostname + ':8000/api'
    : window.location.origin + '/api')
  : null;

// Helper: llamadas a la API
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (r.redirected) {
    throw new Error(`La petición fue redirigida por el servidor a: ${r.url}. Esto convierte la petición POST en GET y causa el error 405 en el backend. Asegúrate de acceder a la app usando la URL exacta configurada en el servidor.`);
  }

  let data = null;
  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await r.json();
    } catch (e) {
      console.warn('Error al decodificar la respuesta JSON del servidor:', e);
    }
  }

  if (!r.ok) {
    const errorMsg = (data && data.error)
      ? data.error + (data.message ? `: ${data.message}` : '')
      : `Error de servidor backend (HTTP ${r.status}).`;
    throw new Error(errorMsg);
  }

  if (data === null) {
    const text = await r.text();
    throw new Error(`Respuesta inválida del servidor (HTTP ${r.status}). Contenido: ${text.slice(0, 150)}...`);
  }

  return data;
}

/* ---- Check session on main.html load ---- */
async function authCheckSession() {
  if (IS_SERVER) {
    try {
      const data = await apiFetch('/auth/me');
      if (data.user) {
        authFinishLogin(data.user);
        return;
      }
    } catch (e) { /* no hay sesión activa */ }
  }

  // Fallback / client check using localStorage
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) {
    try {
      const user = JSON.parse(stored);
      authFinishLogin(user);
      return;
    } catch (e) {
      localStorage.removeItem(AUTH_KEY);
    }
  }

  // Si no hay sesión válida, redirigir a index.html
  window.location.href = 'index.html';
}

/* ---- Finish login: update UI and initialize data ---- */
function authFinishLogin(user) {
  currentUserEmail = user.email;
  loadUserData();

  // Actualizar sidebar con los datos del usuario
  const initials = user.avatar ||
    (user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'JP');

  const avatarEl = document.querySelector('.user-avatar');
  const nameEl = document.querySelector('.user-name');
  const planEl = document.querySelector('.user-plan');

  if (avatarEl) {
    if (user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${initials}">`;
    } else {
      avatarEl.textContent = initials;
    }
  }
  if (nameEl) nameEl.textContent = user.name || 'Usuario';
  if (planEl) planEl.textContent = user.email || '';

  // Guardar siempre en localStorage para consistencia
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));

  // Inicializar la aplicación
  init();
}

/* ---- Logout ---- */
async function authLogout() {
  // Revocar sesión de Google si se usó
  if (typeof google !== 'undefined' && google.accounts && currentUserEmail) {
    try { google.accounts.id.revoke(currentUserEmail, () => { }); } catch (e) { }
  }

  if (IS_SERVER) {
    try { await apiFetch('/auth/me', { method: 'POST' }); } catch (e) { }
  }

  currentUserEmail = null;
  localStorage.removeItem(AUTH_KEY);

  // Redirigir a index.html
  window.location.href = 'index.html';
}

/* =====================================================
   START
   ===================================================== */
authCheckSession();

/* =====================================================
   OCR TEST SUITE — Verificación (Fase 3 & 4)
   ===================================================== */
function scOCRTestSuite() {
  const tests = [
    {
      name: "Carrefour Supermarket",
      raw: `CARREFOUR EXPRESS
CUIT: 30-12345678-9
AV. CABILDO 2000, CABA
15/05/2026 14:32
1x PAN LACTAL   $450.00
2x COCA COLA   $1400.00
SUBTOTAL: $1850.00
TOTAL: $1850.00
PAGO EFECTIVO
GRACIAS POR SU COMPRA!`,
      expected: { nombre_local: "CARREFOUR EXPRESS", total: 1850, fecha: "2026-05-15", categoria: "Alimentación", forma_pago: "Efectivo" }
    },
    {
      name: "YPF petrol station",
      raw: `YPF OPESSA S.A.
AV. LIBERTADOR 5000, CABA
FECHA: 20-04-2026 HORA: 08:15
CANT. 10L INFINIA GASOIL
P. UNIT: $1240.00
TOTAL A PAGAR: $12400.00
TARJETA DEBITO
FACTURA B N° 0001-0002934`,
      expected: { nombre_local: "YPF OPESSA S.A.", total: 12400, fecha: "2026-04-20", categoria: "Transporte", forma_pago: "Tarjeta de débito" }
    },
    {
      name: "Farmacia con OCR imperfecto",
      raw: `FARMACIA SOCIAL
DIAGONAL 74 N 1250, LA PLATA
CUIT: 27-98765432-1
O3/I2/2O25 21:05
TOTAL A PACAR: 4.520,OO
MODO MP`,
      expected: { nombre_local: "FARMACIA SOCIAL", total: 4520, fecha: "2025-12-03", categoria: "Salud", forma_pago: "MODO" }
    }
  ];

  console.log("%c--- RUNNING OCR TEST SUITE ---", "color:#00e5a0; font-weight:bold; font-size:14px;");
  let passed = 0;

  tests.forEach((t, idx) => {
    const res = scParseTicketText(t.raw);
    let ok = true;
    const errors = [];

    for (const key in t.expected) {
      if (res[key] !== t.expected[key]) {
        ok = false;
        errors.push(`${key}: expected "${t.expected[key]}" but got "${res[key]}"`);
      }
    }

    if (ok) {
      console.log(`%c[PASS] Test ${idx + 1}: ${t.name}`, "color:#00e5a0;");
      passed++;
    } else {
      console.log(`%c[FAIL] Test ${idx + 1}: ${t.name}`, "color:#ff4a6b; font-weight:bold;");
      errors.forEach(e => console.log(`   -> ${e}`));
    }
  });

  console.log(`%cTests passed: ${passed}/${tests.length}`, "font-weight:bold; font-size:12px; margin-top:8px;");
}

/* =====================================================
   IA INSIGHTS LOGIC
   ===================================================== */
let aiChatHistory = [];
let aiIsLoading = false;

function enterInsightsView() {
  // Nada especial que resetear al entrar
}

/* ---- Build financial context string for the AI ---- */
function aiBuildContext() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // Category breakdown
  const catMap = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.cat] = (catMap[t.cat] || 0) + t.amount;
  });
  const catBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `${c}: $${v.toLocaleString('es-AR')}`)
    .join(', ');

  // Budgets status
  const budgetStatus = budgets.map(b => {
    const spent = thisMonth.filter(t => t.type === 'expense' && t.cat === b.name)
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.limit > 0 ? Math.round(spent / b.limit * 100) : 0;
    return `${b.name}: gastado $${spent.toLocaleString('es-AR')} de $${b.limit.toLocaleString('es-AR')} (${pct}%)`;
  }).join('; ');

  // Goals
  const goalStatus = goals.map(g => {
    const saved = (g.contributions || []).reduce((s, c) => s + c.amount, 0) + (g.initial || 0);
    const pct = g.target > 0 ? Math.round(saved / g.target * 100) : 0;
    return `${g.name}: $${saved.toLocaleString('es-AR')} de $${g.target.toLocaleString('es-AR')} (${pct}%)`;
  }).join('; ');

  // Last 3 months trend
  const last3 = [0, 1, 2].map(offset => {
    const m = (month - offset + 12) % 12;
    const y = month - offset < 0 ? year - 1 : year;
    const tx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const inc = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const mName = new Date(y, m, 1).toLocaleString('es-AR', { month: 'long' });
    return `${mName}: ingresos $${inc.toLocaleString('es-AR')}, gastos $${exp.toLocaleString('es-AR')}`;
  }).reverse().join(' | ');

  return `CONTEXTO FINANCIERO DEL USUARIO (${now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}):
- Ingresos del mes: $${income.toLocaleString('es-AR')}
- Gastos del mes: $${expense.toLocaleString('es-AR')}
- Balance neto: $${balance.toLocaleString('es-AR')}
- Tasa de ahorro: ${income > 0 ? Math.round((balance / income) * 100) : 0}%
- Gastos por categoría: ${catBreakdown || 'Sin datos'}
- Estado presupuestos: ${budgetStatus || 'Sin presupuestos'}
- Objetivos de ahorro: ${goalStatus || 'Sin objetivos'}
- Tendencia últimos 3 meses: ${last3}
- Total transacciones históricas: ${transactions.length}`;
}

/* ---- Quick prompt shortcuts ---- */
const AI_QUICK_PROMPTS = {
  resumen: 'Dame un resumen detallado de mis finanzas de este mes. ¿Cómo estoy?',
  gastos: '¿En qué categorías gasto más? ¿Hay algo que debería reducir?',
  ahorro: 'Basándote en mis gastos actuales, ¿qué consejos concretos me das para ahorrar más?',
  presupuesto: '¿Cómo estoy con mis presupuestos? ¿Alguno en riesgo de superar?',
  tendencias: '¿Qué tendencias ves en mis finanzas en los últimos meses? ¿Mejoro o empeoro?',
  alerta: '¿Hay alguna alerta o riesgo financiero que debería atender urgente?',
};

function aiQuickPrompt(btn, key) {
  const q = AI_QUICK_PROMPTS[key];
  if (!q) return;
  document.getElementById('aiChatInput').value = q;
  btn.classList.add('ai-quick-btn--active');
  setTimeout(() => btn.classList.remove('ai-quick-btn--active'), 600);
  aiSendMessage();
}

/* ---- Send message ---- */
async function aiSendMessage() {
  if (aiIsLoading) return;
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  aiAppendMessage('user', text);
  aiChatHistory.push({ role: 'user', content: text });

  aiSetLoading(true);

  try {
    const context = aiBuildContext();

    // Llamar de forma segura al endpoint de FastAPI en Python
    const res = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        contexto_financiero: context,
        pregunta: text,
        historial: aiChatHistory.slice(0, -1) // Enviamos el historial sin la última pregunta
      })
    });

    if (res.error) {
      throw new Error(res.error);
    }

    const reply = res.reply || 'Sin respuesta.';
    aiChatHistory.push({ role: 'assistant', content: reply });
    aiAppendMessage('bot', reply);
  } catch (err) {
    aiAppendMessage('bot', '❌ Hubo un error al conectar con la IA. ' + (err.message || 'Intentá de nuevo.'));
    console.error('AI error:', err);
  } finally {
    aiSetLoading(false);
  }
}

/* ---- Loading state spinner in chat ---- */
function aiSetLoading(loading) {
  aiIsLoading = loading;
  const btn = document.getElementById('aiSendBtn');
  const messagesDiv = document.getElementById('aiChatMessages');

  if (btn) btn.disabled = loading;

  if (loading) {
    const div = document.createElement('div');
    div.id = 'aiChatTypingIndicator';
    div.className = 'ai-msg ai-msg-bot';
    div.innerHTML = `
      <div class="ai-msg-avatar">✦</div>
      <div class="ai-msg-bubble">
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
        <span class="ai-dot"></span>
      </div>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  } else {
    const indicator = document.getElementById('aiChatTypingIndicator');
    if (indicator) indicator.remove();
  }
}

/* ---- Append a message bubble ---- */
function aiAppendMessage(who, text) {
  const el = document.getElementById('aiChatMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${who}`;

  if (who === 'bot') {
    div.innerHTML = `
      <div class="ai-msg-avatar">✦</div>
      <div class="ai-msg-bubble">${aiFormatText(text)}</div>`;
  } else {
    div.innerHTML = `<div class="ai-msg-bubble ai-msg-bubble-user">${escHtml(text)}</div>`;
  }

  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

/* ---- Simple markdown formatter for bold and newlines ---- */
function aiFormatText(text) {
  let html = escHtml(text);
  // Reemplazar saltos de línea por <br>
  html = html.replace(/\n/g, '<br>');
  // Reemplazar **texto** por <strong>texto</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Reemplazar listados simples de asteriscos '* ' o '- ' por viñetas
  html = html.replace(/^(?:\s*[-*]\s+)(.*?)(?:<br>|$)/gm, '• $1<br>');
  return html;
}

/* ---- Generate 4 AI Insights cards ---- */
async function aiGenerateCards() {
  const list = document.getElementById('aiCardsList');
  const btn = document.getElementById('aiRefreshBtn');
  if (!list || !btn) return;

  btn.disabled = true;
  btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="ai-spin" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generando…`;

  list.innerHTML = `
    <div class="ai-cards-loading">
      <div class="ai-cards-skeleton"></div>
      <div class="ai-cards-skeleton"></div>
      <div class="ai-cards-skeleton"></div>
    </div>`;

  try {
    const context = aiBuildContext();
    const res = await apiFetch('/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ contexto_financiero: context })
    });

    if (res.error) {
      throw new Error(res.error);
    }

    const cards = res.cards;
    if (!cards || !Array.isArray(cards)) {
      throw new Error('Formato de respuesta incorrecto.');
    }

    list.innerHTML = cards.map(c => `
      <div class="ai-insight-card ai-insight-card--${c.tipo}">
        <div class="ai-insight-card-top">
          <span class="ai-insight-icon">${c.icono}</span>
          <span class="ai-insight-badge ai-insight-badge--${c.tipo}">${c.tipo === 'positivo' ? 'Positivo' : c.tipo === 'negativo' ? 'Atención' : c.tipo === 'alerta' ? '⚠ Alerta' : 'Info'
      }</span>
        </div>
        <div class="ai-insight-title">${escHtml(c.titulo)}</div>
        <div class="ai-insight-desc">${escHtml(c.descripcion)}</div>
      </div>
    `).join('');

  } catch (err) {
    list.innerHTML = `<div style="text-align:center;color:var(--danger);font-family:var(--font-mono);font-size:12px;padding:24px;">
      Error al generar insights.<br>${escHtml(err.message || 'Intentá de nuevo.')}
    </div>`;
    console.error('AI cards error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Actualizar`;
  }
}
