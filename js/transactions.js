import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
// (Imports cruzados inyectados por refactor)

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

  const thisMonth = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;

  const allIncome = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const allExpenses = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  // El saldo total real es la suma de los saldos actuales de todas las cuentas,
  // no la resta histórica de ingresos - gastos (ya que el historial puede ser parcial).
  const balance = state.accounts.reduce((s, a) => s + (a.balance || 0), 0);

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
  const list = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  const el = document.getElementById('txList');
  document.getElementById('txCount').textContent = state.transactions.length + ' registros';

  if (list.length === 0) {
    el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin transacciones aún.</div>`;
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="tx-item">
      <div class="tx-icon" style="background:${state.CAT_COLORS[t.cat]}22;">
        ${state.CAT_ICONS[t.cat] || '📦'}
      </div>
      <div class="tx-info">
        <div class="tx-name">${escHtml(t.desc)}</div>
        <div class="tx-cat">${escHtml(t.cat)}</div>
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
   QUICK ADD
   ===================================================== */
function setType(type) {
  state.currentType = type;
  const expBtn = document.getElementById('typeExpBtn');
  const incBtn = document.getElementById('typeIncBtn');
  const catSelect = document.getElementById('qCat');

  if (type === 'expense') {
    expBtn.classList.add('active-expense');
    incBtn.classList.remove('active-income');
    catSelect.innerHTML = `
      <option value="Alimentación">🍔 Alimentación</option>
      <option value="Transporte">🚗 Transporte</option>
      <option value="Entretenimiento">🎬 Entretenimiento</option>
      <option value="Salud">💊 Salud</option>
      <option value="Hogar">🏠 Hogar</option>
      <option value="Ropa">👕 Ropa</option>
      <option value="Inversión">📈 Inversión</option>
      <option value="Otros">📦 Otros</option>
    `;
  } else {
    incBtn.classList.add('active-income');
    expBtn.classList.remove('active-expense');
    catSelect.innerHTML = `
      <option value="Sueldo">💼 Sueldo</option>
      <option value="Freelance">💻 Freelance</option>
      <option value="Ventas">🛒 Ventas</option>
      <option value="Inversión">📈 Inversión</option>
      <option value="Otros">📦 Otros</option>
    `;
  }
  initCustomSelects(catSelect.parentNode);
}

function quickAdd() {
  const desc = document.getElementById('qDesc').value.trim();
  const amount = parseFloat(document.getElementById('qAmount').value);
  const cat = document.getElementById('qCat').value;

  if (!desc) { showToast('⚠️ Ingresá una descripción', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }

  addTransaction({ type: state.currentType, desc, amount, cat, date: new Date().toISOString().split('T')[0] });
  document.getElementById('qAmount').value = '';
  updateCustomSelectDisplay(document.getElementById('qCat'));
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
  state.mCurrentType = type;
  const expBtn = document.getElementById('mTypeExpBtn');
  const incBtn = document.getElementById('mTypeIncBtn');
  const catSelect = document.getElementById('mCat');
  
  if (type === 'expense') {
    expBtn.classList.add('active-expense');
    incBtn.classList.remove('active-income');
    catSelect.innerHTML = `
      <option value="Alimentación">🍔 Alimentación</option>
      <option value="Transporte">🚗 Transporte</option>
      <option value="Entretenimiento">🎬 Entretenimiento</option>
      <option value="Salud">💊 Salud</option>
      <option value="Hogar">🏠 Hogar</option>
      <option value="Ropa">👕 Ropa</option>
      <option value="Inversión">📈 Inversión</option>
      <option value="Otros">📦 Otros</option>
    `;
  } else {
    incBtn.classList.add('active-income');
    expBtn.classList.remove('active-expense');
    catSelect.innerHTML = `
      <option value="Sueldo">💼 Sueldo</option>
      <option value="Freelance">💻 Freelance</option>
      <option value="Ventas">🛒 Ventas</option>
      <option value="Inversión">📈 Inversión</option>
      <option value="Otros">📦 Otros</option>
    `;
  }
  initCustomSelects(catSelect.parentNode);
}

function addFromModal() {
  const desc = document.getElementById('mDesc').value.trim();
  const amount = parseFloat(document.getElementById('mAmount').value);
  const cat = document.getElementById('mCat').value;
  const date = document.getElementById('mDate').value;

  if (!desc) { showToast('⚠️ Ingresá una descripción', true); return; }
  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }
  if (!date) { showToast('⚠️ Seleccioná una fecha', true); return; }

  addTransaction({ type: state.mCurrentType, desc, amount, cat, date });
  document.getElementById('mDesc').value = '';
  document.getElementById('mAmount').value = '';
  closeModal();
  showToast('✅ Transacción registrada');
}

async function addTransaction(tx) {
  if (IS_SERVER) {
    try {
      await apiFetch('/transactions', {
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
    state.transactions.unshift(tx);
    save();
    renderAll();
    if (currentPage === 'transacciones') renderTxView();
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
  let list = [...state.transactions];

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
            <div class="tx-icon" style="background:${state.CAT_COLORS[t.cat]}22;width:32px;height:32px;font-size:14px;">
              ${state.CAT_ICONS[t.cat] || '📦'}
            </div>
            <div>
              <div style="font-weight:600;font-size:13.5px;">${escHtml(t.desc)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="cat-chip" style="background:${state.CAT_COLORS[t.cat]}18;color:${state.CAT_COLORS[t.cat]};">
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

async function exportExcel() {
  if (typeof ExcelJS === 'undefined') {
    showToast('⚠️ Librería de Excel no cargada aún', true);
    return;
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transacciones');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Descripción', key: 'desc', width: 40 },
    { header: 'Categoría', key: 'cat', width: 25 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Fecha', key: 'date', width: 15 },
    { header: 'Monto', key: 'amount', width: 20 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF121212' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const list = getFilteredTx();
  list.forEach(t => {
    const row = sheet.addRow({
      id: t.id,
      desc: t.desc,
      cat: t.cat,
      type: t.type === 'income' ? 'Ingreso' : 'Gasto',
      date: t.date,
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
  a.download = 'flujo_transacciones.xlsx';
  a.click();
  showToast('📥 Excel exportado');
}

/* Edit */
function openEditModal(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  editingId = id;

  document.getElementById('editModalTitle').textContent = 'Editar Transacción';
  document.getElementById('eDesc').value = t.desc;
  document.getElementById('eAmount').value = t.amount;
  document.getElementById('eCat').value = t.cat;
  updateCustomSelectDisplay(document.getElementById('eCat'));
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
      const orig = state.transactions.find(x => x.id === editingId);
      await apiFetch(`/transactions/${editingId}`, {
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
    const idx = state.transactions.findIndex(x => x.id === editingId);
    if (idx > -1) {
      state.transactions[idx] = { ...state.transactions[idx], type, desc, amount, cat, date };
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
  const t = state.transactions.find(x => x.id === id);
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
      await apiFetch(`/transactions/${editingId}`, {
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
    state.transactions = state.transactions.filter(x => x.id !== editingId);
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



// --- WINDOW ATTACHMENTS ---
window.quickAdd = quickAdd;
window.applyTxFilter = applyTxFilter;
window.formatDate = formatDate;
window.closeEditModal = closeEditModal;
window.getFilteredTx = getFilteredTx;
window.closeModal = closeModal;
window.formatDateLong = formatDateLong;
window.clearTxFilters = clearTxFilters;
window.addFromModal = addFromModal;
window.confirmDelete = confirmDelete;
window.setType = setType;
window.addTransaction = addTransaction;
window.setEditType = setEditType;
window.renderAll = renderAll;
window.sortTx = sortTx;
window.doDelete = doDelete;
window.closeDeleteModal = closeDeleteModal;
window.setModalType = setModalType;
window.exportExcel = exportExcel;
window.renderTxView = renderTxView;
window.renderTransactions = renderTransactions;
window.openEditModal = openEditModal;
window.renderTxPagination = renderTxPagination;
window.escHtml = escHtml;
window.goTxPage = goTxPage;
window.saveEdit = saveEdit;
window.renderStats = renderStats;
window.openModal = openModal;
window.syncTxFilterUI = syncTxFilterUI;
