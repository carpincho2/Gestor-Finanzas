// @ts-nocheck
import { state } from './store/store.ts';
import { showToast, formatCurrency } from './utils/utils.ts';
import * as budgetService from './services/budgetService.ts';

/* =====================================================
   DASHBOARD MINI BUDGETS WIDGET
   ===================================================== */
function renderBudgets() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const el = document.getElementById('budgetList');
  if (!el) return;
  if (!state.budgets || state.budgets.length === 0) {
    el.innerHTML = `<div style="padding:16px 0;text-align:center;font-size:11px;font-family:var(--font-mono);color:var(--muted);">Sin presupuestos creados.</div>`;
    return;
  }

  el.innerHTML = state.budgets.slice(0, 5).map(b => {
    const spent = state.transactions
      .filter(t => t.type === 'expense' && t.cat === b.cat)
      .filter(t => { const d = new Date(t.date); return d.getMonth() === month && d.getFullYear() === year; })
      .reduce((s, t) => s + t.amount, 0);

    const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
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
   VISTA DE PRESUPUESTOS (ESTADO Y CONTROLADORES)
   ===================================================== */

let budgetViewMonth = new Date().getMonth();
let budgetViewYear = new Date().getFullYear();
let editingBudgetId = null;
let budgetDonutInstance = null;
let currentBudgetFilter = 'all'; // 'all' | 'warning' | 'ok'
let currentBudgetSort = 'pct_desc'; // 'pct_desc' | 'spent_desc' | 'limit_desc' | 'name_asc'

const BM_COLORS = [
  '#00e5a0', '#5b8cff', '#ff6b4a', '#ffb84a', '#a78bfa',
  '#fb7185', '#34d399', '#38bdf8', '#f472b6', '#facc15',
  '#4ade80', '#f97316', '#e879f9', '#22d3ee', '#a3e635', '#ff4a6b'
];

let bmSelectedColor = BM_COLORS[0];
let bmSelectedIcon = '📦';
let bmEditingId = null;

const BUDGET_EMOJIS = ['🛒', '🍕', '🚗', '🏠', '🎬', '💊', '🛍️', '📚', '📦', '🍔', '☕', '🏋️', '💡', '🎮', '🐾', '✈️'];

function saveBudgets() {
  budgetService.saveBudgetsLocal();
}

function initBudgets() {
  budgetService.initBudgets();
}

/* --- Navegación de vista --- */
function enterBudgetView() {
  const bView = document.getElementById('budgetView');
  const dView = document.getElementById('dashboardView');
  const tView = document.getElementById('txView');
  const pDate = document.getElementById('pageDate');
  if (bView) bView.style.display = '';
  if (dView) dView.style.display = 'none';
  if (tView) tView.style.display = 'none';
  if (pDate) pDate.style.display = 'none';

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

function setBudgetFilter(filter) {
  currentBudgetFilter = filter;
  document.querySelectorAll('.bv-filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'bvFilter' + (filter === 'all' ? 'All' : filter === 'warning' ? 'Warning' : 'Ok'));
  });
  renderBudgetView();
}

function changeBudgetSort(sort) {
  currentBudgetSort = sort;
  renderBudgetView();
}

/* --- Render Principal --- */
function renderBudgetView() {
  const monthName = new Date(budgetViewYear, budgetViewMonth, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());

  const monthLabel = document.getElementById('bvMonthLabel');
  const donutMonth = document.getElementById('bvDonutMonth');
  if (monthLabel) monthLabel.textContent = monthName;
  if (donutMonth) donutMonth.textContent = monthName;

  // Lógica temporal del mes (ritmo / burn rate)
  const now = new Date();
  const isCurrentMonth = now.getMonth() === budgetViewMonth && now.getFullYear() === budgetViewYear;
  const daysInMonth = new Date(budgetViewYear, budgetViewMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : (budgetViewYear < now.getFullYear() || (budgetViewYear === now.getFullYear() && budgetViewMonth < now.getMonth()) ? daysInMonth : 1);
  const timeElapsedPct = Math.min(Math.round((currentDay / daysInMonth) * 100), 100);

  const pacePill = document.getElementById('bvMonthPace');
  if (pacePill) {
    if (isCurrentMonth) {
      pacePill.innerHTML = `⏱️ Día ${currentDay} de ${daysInMonth} (${timeElapsedPct}% del mes)`;
    } else {
      pacePill.innerHTML = `📅 ${daysInMonth} días totales`;
    }
  }

  // Filtrar transacciones de gastos de este mes
  const monthTx = state.transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date);
    return d.getMonth() === budgetViewMonth && d.getFullYear() === budgetViewYear;
  });

  // Mapear gastos por categoría
  const spentByCat = {};
  monthTx.forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });

  // Identificar gastos no presupuestados
  const budgetedCats = new Set((state.budgets || []).map(b => b.cat));
  const unbudgetedByCat = {};
  let totalUnbudgeted = 0;

  monthTx.forEach(t => {
    if (!budgetedCats.has(t.cat)) {
      unbudgetedByCat[t.cat] = (unbudgetedByCat[t.cat] || 0) + t.amount;
      totalUnbudgeted += t.amount;
    }
  });

  // Totales de presupuestos asignados
  const totalLimit = (state.budgets || []).reduce((s, b) => s + b.limit, 0);
  const totalSpent = (state.budgets || []).reduce((s, b) => s + (spentByCat[b.cat] || 0), 0);
  const totalLeft = totalLimit - totalSpent - totalUnbudgeted;
  const fmt = n => '$' + Math.abs(n).toLocaleString('es-AR');

  const elLimit = document.getElementById('bvTotalLimit');
  const elSpent = document.getElementById('bvTotalSpent');
  const elUnbudgeted = document.getElementById('bvTotalUnbudgeted');
  const leftEl = document.getElementById('bvTotalLeft');

  if (elLimit) elLimit.textContent = fmt(totalLimit);
  if (elSpent) elSpent.textContent = fmt(totalSpent);
  if (elUnbudgeted) elUnbudgeted.textContent = fmt(totalUnbudgeted);

  if (leftEl) {
    leftEl.textContent = (totalLeft < 0 ? '-' : '') + fmt(totalLeft);
    leftEl.style.color = totalLeft >= 0 ? 'var(--accent)' : 'var(--danger)';
  }

  // Renderizar sección de no presupuestados
  renderUnbudgetedSection(unbudgetedByCat, totalUnbudgeted);

  // Renderizar tarjetas de presupuestos
  renderBvCards(spentByCat, monthTx, { isCurrentMonth, currentDay, daysInMonth, timeElapsedPct });

  // Renderizar Donut Chart
  renderBudgetDonut(spentByCat, unbudgetedByCat, totalUnbudgeted);

  // Renderizar Consejos Inteligentes
  renderBvTip(spentByCat, unbudgetedByCat, totalUnbudgeted, totalLimit, totalSpent, { isCurrentMonth, currentDay, daysInMonth });
}

/* --- Render Sección de Gastos No Presupuestados --- */
function renderUnbudgetedSection(unbudgetedByCat, totalUnbudgeted) {
  const container = document.getElementById('bvUnbudgetedSection');
  if (!container) return;

  const entries = Object.entries(unbudgetedByCat).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || totalUnbudgeted <= 0) {
    container.innerHTML = '';
    return;
  }

  const itemsHtml = entries.map(([cat, amt]) => {
    const icon = (state.CAT_ICONS && state.CAT_ICONS[cat]) || '📦';
    return `
      <div class="bv-unbudgeted-item">
        <div class="bv-unbudgeted-item-info">
          <span>${icon}</span>
          <span class="bv-unbudgeted-item-name" title="${escHtml(cat)}">${escHtml(cat)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="bv-unbudgeted-item-amt">-$${amt.toLocaleString('es-AR')}</span>
          <button class="bv-unbudgeted-btn" onclick="quickBudgetCat('${escHtml(cat)}', ${amt})">+ Presupuestar</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="bv-unbudgeted-box">
      <div class="bv-unbudgeted-head">
        <div class="bv-unbudgeted-title">
          <span>⚠️ Gastos No Presupuestados</span>
          <span class="bv-unbudgeted-badge">${entries.length} categorí${entries.length > 1 ? 'as' : 'a'}</span>
        </div>
        <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--warn);">
          Total: -$${totalUnbudgeted.toLocaleString('es-AR')}
        </span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
        Estos gastos fueron registrados en categorías que no tienen un presupuesto asignado. Podés convertirlos en presupuestos para tener un control integral.
      </div>
      <div class="bv-unbudgeted-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/* --- Render Cards --- */
function renderBvCards(spentByCat, monthTx, timeContext) {
  const el = document.getElementById('bvCards');
  if (!el) return;

  if (!state.budgets || state.budgets.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:48px 24px;text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">🎯</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px;">Sin presupuestos todavía</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">Creá tu primer presupuesto para empezar a controlar tus gastos con inteligencia financiera.</div>
        <button class="btn btn-primary" onclick="openBudgetModal()">+ Nuevo Presupuesto</button>
      </div>`;
    return;
  }

  const { isCurrentMonth, currentDay, daysInMonth, timeElapsedPct } = timeContext;

  // Enriquecer datos para ordenamiento y filtrado
  let budgetsWithData = state.budgets.map(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    const left = b.limit - spent;
    const over = spent > b.limit;
    const warn = pct >= 80 && !over;
    return { ...b, spent, pct, left, over, warn };
  });

  // Aplicar Filtro
  if (currentBudgetFilter === 'warning') {
    budgetsWithData = budgetsWithData.filter(b => b.over || b.warn);
  } else if (currentBudgetFilter === 'ok') {
    budgetsWithData = budgetsWithData.filter(b => !b.over && !b.warn);
  }

  // Aplicar Ordenamiento
  budgetsWithData.sort((a, b) => {
    switch (currentBudgetSort) {
      case 'pct_desc': return b.pct - a.pct;
      case 'spent_desc': return b.spent - a.spent;
      case 'limit_desc': return b.limit - a.limit;
      case 'name_asc': return a.name.localeCompare(b.name);
      default: return b.pct - a.pct;
    }
  });

  if (budgetsWithData.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:32px 20px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">
        No hay presupuestos que coincidan con el filtro seleccionado.
      </div>
    `;
    return;
  }

  el.innerHTML = budgetsWithData.map(b => {
    const displayPct = Math.min(b.pct, 100);
    const barColor = b.over ? 'var(--danger)' : b.warn ? 'var(--warn)' : b.color;

    // Ritmo de gasto
    let paceHtml = '';
    if (isCurrentMonth) {
      if (b.over) {
        paceHtml = `<span class="bv-pace-badge over">⚠️ Excedido</span>`;
      } else if (b.pct > timeElapsedPct + 15) {
        paceHtml = `<span class="bv-pace-badge fast">🔥 Ritmo acelerado</span>`;
      } else if (b.spent === 0) {
        paceHtml = `<span class="bv-pace-badge normal">🌱 Sin gastos</span>`;
      } else {
        paceHtml = `<span class="bv-pace-badge normal">⚡ A buen ritmo</span>`;
      }
    }

    // Proyección a fin de mes y saldo diario restante
    let projectionStripHtml = '';
    if (isCurrentMonth && currentDay > 0) {
      const projected = Math.round((b.spent / currentDay) * daysInMonth);
      const daysRemaining = Math.max(daysInMonth - currentDay, 1);
      const dailyLeft = b.left > 0 ? Math.round(b.left / daysRemaining) : 0;
      const isProjectedOver = projected > b.limit;

      projectionStripHtml = `
        <div class="bv-projection-strip">
          <div>
            Proyección fin de mes: 
            <span class="bv-projection-val" style="color:${isProjectedOver ? 'var(--danger)' : 'var(--accent)'}">
              $${projected.toLocaleString('es-AR')}
            </span>
          </div>
          <div>
            Disponible diario: 
            <span class="bv-projection-val">
              $${dailyLeft.toLocaleString('es-AR')}/día
            </span>
          </div>
        </div>
      `;
    }

    let statusHtml;
    if (b.spent === 0) statusHtml = `<span class="bv-status empty"><span class="bv-dot"></span>Sin gastos</span>`;
    else if (b.over) statusHtml = `<span class="bv-status danger"><span class="bv-dot"></span>Excedido ${fmt2(b.spent - b.limit)}</span>`;
    else if (b.warn) statusHtml = `<span class="bv-status warn"><span class="bv-dot"></span>Casi al límite</span>`;
    else statusHtml = `<span class="bv-status ok"><span class="bv-dot"></span>En presupuesto</span>`;

    // Movimientos recientes
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
              <div class="bv-card-name">
                ${escHtml(b.name)}
                <span class="bv-currency-tag">${b.currency || 'ARS'}</span>
              </div>
              <div class="bv-card-sub-wrap">
                <span class="bv-card-sub">${b.notes ? escHtml(b.notes) : b.cat}</span>
                ${paceHtml}
              </div>
            </div>
          </div>
          <div class="bv-card-right">
            <div class="bv-card-pct" style="color:${barColor};">${Math.round(b.pct)}%</div>
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
          <div class="bv-bar-container">
            <div class="bv-bar-bg">
              <div class="bv-bar-fill" style="width:${displayPct}%;background:${barColor};"></div>
            </div>
            ${isCurrentMonth ? `<div class="bv-pace-marker" style="left:${timeElapsedPct}%;" title="Día actual del mes (${timeElapsedPct}%)"></div>` : ''}
          </div>
          <div class="bv-bar-labels">
            <span class="spent" style="color:${barColor};">$${b.spent.toLocaleString('es-AR')} gastado</span>
            <span>${b.over ? '<span style="color:var(--danger)">-' + fmt2(Math.abs(b.left)) + '</span>' : fmt2(b.left) + ' disponible'}</span>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${statusHtml}
          <span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);">Límite: $${b.limit.toLocaleString('es-AR')}</span>
        </div>

        ${projectionStripHtml}

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
  const btn = document.getElementById('bvexp-' + id);
  if (!card) return;
  const expanded = card.classList.toggle('expanded');
  if (btn) {
    btn.innerHTML = expanded
      ? `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg> Ocultar movimientos`
      : `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> Ver movimientos`;
  }
}

/* --- Donut chart --- */
function renderBudgetDonut(spentByCat, unbudgetedByCat = {}, totalUnbudgeted = 0) {
  const canvas = document.getElementById('budgetDonut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = (state.budgets || []).map(b => b.name);
  const data = (state.budgets || []).map(b => spentByCat[b.cat] || 0);
  const colors = (state.budgets || []).map(b => b.color);

  // Si hay gastos no presupuestados, añadirlos a la dona para representar la realidad financiera
  if (totalUnbudgeted > 0) {
    labels.push('No Presupuestado');
    data.push(totalUnbudgeted);
    colors.push('#ffb84a');
  }

  const total = data.reduce((s, v) => s + v, 0);

  const donutTotalEl = document.getElementById('bvDonutTotal');
  if (donutTotalEl) donutTotalEl.textContent = '$' + total.toLocaleString('es-AR');

  if (budgetDonutInstance) budgetDonutInstance.destroy();

  budgetDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: total === 0 ? [1] : data,
        backgroundColor: total === 0 ? ['#1a2030'] : colors.map(c => c + 'cc'),
        borderColor: total === 0 ? ['#232b3a'] : colors,
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

  // Leyenda
  const leg = document.getElementById('bvLegend');
  if (!leg) return;

  const budgetItems = (state.budgets || []).map(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    return `
      <div class="bv-legend-item">
        <div class="bv-legend-left">
          <div class="bv-legend-dot" style="background:${b.color};"></div>
          <span class="bv-legend-name">${b.icon || '📦'} ${escHtml(b.name)}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="bv-legend-val">$${spent.toLocaleString('es-AR')}</span>
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--muted);min-width:28px;text-align:right;">${pct}%</span>
        </div>
      </div>
    `;
  });

  if (totalUnbudgeted > 0) {
    const unbudgetedPct = total > 0 ? Math.round((totalUnbudgeted / total) * 100) : 0;
    budgetItems.push(`
      <div class="bv-legend-item" style="border-top:1px dashed var(--border);margin-top:4px;padding-top:8px;">
        <div class="bv-legend-left">
          <div class="bv-legend-dot" style="background:#ffb84a;"></div>
          <span class="bv-legend-name" style="color:var(--warn);">⚠️ No Presupuestado</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="bv-legend-val" style="color:var(--warn);">$${totalUnbudgeted.toLocaleString('es-AR')}</span>
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--warn);min-width:28px;text-align:right;">${unbudgetedPct}%</span>
        </div>
      </div>
    `);
  }

  leg.innerHTML = budgetItems.join('');
}

/* --- Tips & Insights Financieros --- */
function renderBvTip(spentByCat, unbudgetedByCat, totalUnbudgeted, allLimit, allSpent, timeContext) {
  const tipEl = document.getElementById('bvTip');
  if (!tipEl) return;
  const tips = [];
  const { isCurrentMonth, currentDay, daysInMonth } = timeContext;

  // Tip de gastos no presupuestados
  if (totalUnbudgeted > 0) {
    tips.push(`⚠️ Tenés <strong>$${totalUnbudgeted.toLocaleString('es-AR')}</strong> en gastos fuera de presupuesto este mes. Creá presupuestos para esas categorías para tener control total.`);
  }

  // Tips por categoría
  (state.budgets || []).forEach(b => {
    const spent = spentByCat[b.cat] || 0;
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    if (pct > 100) {
      tips.push(`🚨 Superaste el límite en <strong>${b.name}</strong> por $${(spent - b.limit).toLocaleString('es-AR')}. Considerá ajustar gastos o redistribuir de otra categoría.`);
    } else if (isCurrentMonth && currentDay > 0) {
      const projected = (spent / currentDay) * daysInMonth;
      if (projected > b.limit && pct < 100) {
        tips.push(`📈 Al ritmo actual, en <strong>${b.name}</strong> terminarás gastando ~$${Math.round(projected).toLocaleString('es-AR')} ($${Math.round(projected - b.limit).toLocaleString('es-AR')} sobre el límite).`);
      }
    }
  });

  const allTotalSpent = allSpent + totalUnbudgeted;
  if (allTotalSpent === 0) {
    tips.push('📭 Aún no hay gastos registrados para este mes.');
  } else if (allLimit > 0 && (allTotalSpent / allLimit) < 0.5 && isCurrentMonth && currentDay > 15) {
    tips.push('🎯 ¡Excelente gestión! Pasada la mitad del mes, llevás menos del 50% de tu presupuesto consumido.');
  }

  if (tips.length === 0) {
    tips.push('💪 Todo en orden. Estás respetando tus metas presupuestarias y tu ritmo diario está controlado.');
  }

  tipEl.innerHTML = tips[0];
}

/* --- Quick Create Budget from Unbudgeted Spending --- */
function quickBudgetCat(catName, spentAmount) {
  openBudgetModal();
  const nameEl = document.getElementById('bmName');
  const catEl = document.getElementById('bmCat');
  const limitEl = document.getElementById('bmLimit');

  if (nameEl) nameEl.value = catName;
  if (catEl) {
    const optionExists = Array.from(catEl.options).some(o => o.value === catName);
    if (optionExists) {
      catEl.value = catName;
      document.getElementById('bmCustomWrap').style.display = 'none';
    } else {
      catEl.value = 'custom';
      document.getElementById('bmCustomWrap').style.display = '';
      document.getElementById('bmCustomName').value = catName;
    }
    if (window.updateCustomSelectDisplay) window.updateCustomSelectDisplay(catEl);
  }

  // Sugerir un límite redondeado un 15% arriba del gasto actual
  const suggested = Math.max(Math.ceil((spentAmount * 1.15) / 1000) * 1000, 5000);
  if (limitEl) limitEl.value = suggested;

  onBmCatChange();
}

/* --- Budget Modal --- */
function openBudgetModal(id) {
  if (typeof id === 'object') id = null;
  bmEditingId = id || null;
  bmSelectedColor = BM_COLORS[0];
  bmSelectedIcon = '📦';

  // Construir grilla de emojis
  const emojiGrid = document.getElementById('bmEmojiGrid');
  if (emojiGrid) {
    emojiGrid.innerHTML = BUDGET_EMOJIS.map(e => `
      <button class="ov-emoji-btn ${e === bmSelectedIcon ? 'active' : ''}" onclick="selectBmEmoji('${e}')">${e}</button>
    `).join('');
  }

  // Construir grilla de colores
  const grid = document.getElementById('bmColorGrid');
  if (grid) {
    grid.innerHTML = BM_COLORS.map(c => `
      <div class="bv-color-swatch ${c === bmSelectedColor ? 'selected' : ''}"
           style="background:${c};"
           onclick="selectBmColor('${c}')">
      </div>
    `).join('');
  }

  if (id) {
    const b = state.budgets.find(x => x.id === id);
    if (!b) return;
    document.getElementById('budgetModalTitle').textContent = 'Editar Presupuesto';
    document.getElementById('bmSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('bmName').value = b.name || b.cat;
    document.getElementById('bmCat').value = b.cat;
    if (window.updateCustomSelectDisplay) window.updateCustomSelectDisplay(document.getElementById('bmCat'));
    const isCustomCat = !['Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios', 'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación', 'Otros'].includes(b.cat);
    if (isCustomCat) {
      document.getElementById('bmCat').value = 'custom';
      if (window.updateCustomSelectDisplay) window.updateCustomSelectDisplay(document.getElementById('bmCat'));
      document.getElementById('bmCustomWrap').style.display = '';
      document.getElementById('bmCustomName').value = b.cat;
    } else {
      document.getElementById('bmCustomWrap').style.display = 'none';
    }
    document.getElementById('bmLimit').value = b.limit;
    const curEl = document.getElementById('bmCurrency');
    if (curEl) curEl.value = b.currency || 'ARS';
    document.getElementById('bmNotes').value = b.notes || '';
    bmSelectedColor = b.color;
    bmSelectedIcon = b.icon || '📦';

    if (emojiGrid) {
      emojiGrid.innerHTML = BUDGET_EMOJIS.map(e => `
        <button class="ov-emoji-btn ${e === bmSelectedIcon ? 'active' : ''}" onclick="selectBmEmoji('${e}')">${e}</button>
      `).join('');
    }
    if (grid) {
      grid.querySelectorAll('.bv-color-swatch').forEach(sw => {
        sw.classList.toggle('selected', sw.style.background === b.color || sw.style.backgroundColor === b.color);
      });
    }
  } else {
    document.getElementById('budgetModalTitle').textContent = 'Nuevo Presupuesto';
    document.getElementById('bmSaveBtn').textContent = 'Crear Presupuesto';
    document.getElementById('bmName').value = '';
    document.getElementById('bmCat').value = 'Supermercado / Almacén';
    if (window.updateCustomSelectDisplay) window.updateCustomSelectDisplay(document.getElementById('bmCat'));
    document.getElementById('bmCustomWrap').style.display = 'none';
    document.getElementById('bmCustomName').value = '';
    document.getElementById('bmLimit').value = '';
    const curEl = document.getElementById('bmCurrency');
    if (curEl) curEl.value = 'ARS';
    document.getElementById('bmNotes').value = '';
  }

  const modalOverlay = document.getElementById('budgetModalOverlay');
  if (modalOverlay) {
    modalOverlay.classList.add('open');
  } else {
    console.error("budgetModalOverlay not found in DOM");
  }
}

function selectBmColor(color) {
  bmSelectedColor = color;
  document.querySelectorAll('.bv-color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.style.background === color || sw.style.backgroundColor === color);
  });
}

function selectBmEmoji(e) {
  bmSelectedIcon = e;
  document.querySelectorAll('#bmEmojiGrid .ov-emoji-btn').forEach(b => b.classList.toggle('active', b.textContent === e));
}

function onBmCatChange() {
  const val = document.getElementById('bmCat').value;
  document.getElementById('bmCustomWrap').style.display = val === 'custom' ? '' : 'none';
  const icons = {
    'Supermercado / Almacén': '🛒',
    'Salidas / Restaurantes': '🍕',
    'Transporte': '🚗',
    'Hogar / Servicios': '🏠',
    'Entretenimiento / Suscripciones': '🎬',
    'Salud / Farmacia': '💊',
    'Compras / Ropa': '🛍️',
    'Educación': '📚',
    'Otros': '📦'
  };
  if (icons[val]) {
    bmSelectedIcon = icons[val];
    document.querySelectorAll('#bmEmojiGrid .ov-emoji-btn').forEach(b => b.classList.toggle('active', b.textContent === icons[val]));
  }
  const nameEl = document.getElementById('bmName');
  if (nameEl && !nameEl.value.trim() && val !== 'custom') {
    nameEl.value = val;
  }
}

function closeBudgetModal(e) {
  if (!e || e.target.id === 'budgetModalOverlay') {
    document.getElementById('budgetModalOverlay').classList.remove('open');
    bmEditingId = null;
  }
}

async function saveBudget() {
  const nameInput = document.getElementById('bmName').value.trim();
  const catSel = document.getElementById('bmCat').value;
  const cat = catSel === 'custom' ? document.getElementById('bmCustomName').value.trim() : catSel;
  const limit = parseFloat(document.getElementById('bmLimit').value);
  const icon = bmSelectedIcon || '📦';
  const notes = document.getElementById('bmNotes').value.trim();
  const curEl = document.getElementById('bmCurrency');
  const currency = curEl ? curEl.value : 'ARS';
  const name = nameInput || cat;

  if (!name) { showToast('⚠️ Ingresá un nombre para el presupuesto', true); return; }
  if (!cat) { showToast('⚠️ Seleccioná una categoría', true); return; }
  if (!limit || limit <= 0) { showToast('⚠️ Ingresá un límite válido', true); return; }

  try {
    const budgetData = {
      cat,
      name,
      limit,
      currency,
      icon,
      color: bmSelectedColor,
      notes: notes || null
    };

    if (bmEditingId) {
      await budgetService.updateBudget(bmEditingId, budgetData);
      showToast('Presupuesto actualizado');
    } else {
      await budgetService.createBudget(budgetData);
      showToast('Presupuesto creado');
    }
    renderBudgetView();
    renderBudgets();
  } catch (err) {
    console.error("Error al guardar presupuesto:", err);
    showToast("Error al guardar presupuesto", true);
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
  try {
    await budgetService.deleteBudget(bmEditingId);
    renderBudgetView();
    renderBudgets();
    showToast('Presupuesto eliminado');
  } catch (err) {
    console.error("Error al eliminar presupuesto:", err);
    showToast("Error al eliminar presupuesto", true);
  }
  closeBudgetDeleteModal();
}

// Helpers
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
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
window.selectBmEmoji = selectBmEmoji;
window.quickBudgetCat = quickBudgetCat;
window.setBudgetFilter = setBudgetFilter;
window.changeBudgetSort = changeBudgetSort;
window.BM_COLORS = BM_COLORS;
