import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
// (Imports cruzados inyectados por refactor)

/* =====================================================
   state.BUDGETS
   ===================================================== */
function renderBudgets() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const el = document.getElementById('budgetList');
  if (!state.budgets || state.budgets.length === 0) {
    el.innerHTML = `<div style="padding:16px 0;text-align:center;font-size:11px;font-family:var(--font-mono);color:var(--muted);">Sin presupuestos creados.</div>`;
    return;
  }

  el.innerHTML = state.budgets.slice(0, 5).map(b => {
    const spent = state.transactions
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
   PRESUPUESTOS
   ===================================================== */

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
  localStorage.setItem(userKey('flujo_budgets'), JSON.stringify(state.budgets));
}

function initBudgets() {
  if (state.budgets.length === 0) {
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
  const monthTx = state.transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date);
    return d.getMonth() === budgetViewMonth && d.getFullYear() === budgetViewYear;
  });

  const spentByCat = {};
  monthTx.forEach(t => { spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount; });

  // Summary header
  const totalLimit = state.budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = state.budgets.reduce((s, b) => s + (spentByCat[b.cat] || 0), 0);
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

  if (state.budgets.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:48px 24px;text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">🎯</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px;">Sin presupuestos todavía</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">Creá tu primer presupuesto para empezar a controlar tus gastos.</div>
        <button class="btn btn-primary" onclick="openBudgetModal()">+ Nuevo Presupuesto</button>
      </div>`;
    return;
  }

  el.innerHTML = state.budgets.map(b => {
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

  const data = state.budgets.map(b => spentByCat[b.cat] || 0);
  const labels = state.budgets.map(b => b.name);
  const colors = state.budgets.map(b => b.color);
  const total = data.reduce((s, v) => s + v, 0);

  document.getElementById('bvDonutTotal').textContent = '$' + total.toLocaleString('es-AR');

  if (budgetDonutInstance) budgetDonutInstance.destroy();

  budgetDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: total === 0 ? state.budgets.map(() => 1) : data,
        backgroundColor: total === 0 ? state.budgets.map(() => '#1a2030') : colors.map(c => c + 'cc'),
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
  leg.innerHTML = state.budgets.map((b, i) => {
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

  state.budgets.forEach(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    if (pct > 100) tips.push(`⚠️ Superaste el presupuesto de <strong>${b.name}</strong> en $${(spent - b.limit).toLocaleString('es-AR')}.`);
    else if (pct > 80) tips.push(`🔶 Te queda poco presupuesto en <strong>${b.name}</strong> — solo el ${Math.round(100 - pct)}% disponible.`);
  });

  const allSpent = state.budgets.reduce((s, b) => s + (spentByCat[b.cat] || 0), 0);
  const allLimit = state.budgets.reduce((s, b) => s + b.limit, 0);
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
    const b = state.budgets.find(x => x.id === id);
    if (!b) return;
    document.getElementById('budgetModalTitle').textContent = 'Editar Presupuesto';
    document.getElementById('bmSaveBtn').textContent = 'Guardar cambios';
    const hasCat = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Ropa', 'Otros'].includes(b.cat);
    document.getElementById('bmCat').value = b.cat;
    updateCustomSelectDisplay(document.getElementById('bmCat'));
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
    updateCustomSelectDisplay(document.getElementById('bmCat'));
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
        await apiFetch(`/budgets/${bmEditingId}`, {
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
        await apiFetch('/budgets', {
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
      const idx = state.budgets.findIndex(x => x.id === bmEditingId);
      if (idx > -1) {
        state.budgets[idx] = { ...state.budgets[idx], cat, name: cat, limit, icon, color: bmSelectedColor, notes };
        saveBudgets();
        renderBudgetView();
        renderBudgets();
        showToast('Presupuesto actualizado');
      }
    } else {
      const newB = { id: Date.now(), cat, name: cat, limit, icon, color: bmSelectedColor, notes };
      state.budgets.push(newB);
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
  const b = state.budgets.find(x => x.id === id);
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
      await apiFetch(`/budgets/${bmEditingId}`, {
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
    state.budgets = state.budgets.filter(x => x.id !== bmEditingId);
    saveBudgets();
    renderBudgetView();
    renderBudgets();
    showToast('Presupuesto eliminado');
  }
  closeBudgetDeleteModal();
}



// --- WINDOW ATTACHMENTS ---
window.changeBudgetMonth = changeBudgetMonth;
window.enterBudgetView = enterBudgetView;
window.onBmCatChange = onBmCatChange;
window.closeBudgetDeleteModal = closeBudgetDeleteModal;
window.openBudgetModal = openBudgetModal;
window.initBudgets = initBudgets;
window.toggleBvCard = toggleBvCard;
window.confirmDeleteBudget = confirmDeleteBudget;
window.renderBudgetView = renderBudgetView;
window.renderBvTip = renderBvTip;
window.renderBudgets = renderBudgets;
window.closeBudgetModal = closeBudgetModal;
window.renderBudgetDonut = renderBudgetDonut;
window.fmt2 = fmt2;
window.doDeleteBudget = doDeleteBudget;
window.renderBvCards = renderBvCards;
window.saveBudgets = saveBudgets;
window.saveBudget = saveBudget;
window.selectBmColor = selectBmColor;
