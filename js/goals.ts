// @ts-nocheck
import { state } from './store/store.ts';
import { showToast, formatMoney, escHtml, formatDate, formatDateLong } from './utils/utils.ts';
import * as goalService from './services/goalService.ts';
import { Goal, GoalContribution } from './types.ts';

/* =====================================================
   OBJETIVOS DE AHORRO CON INTELIGENCIA FINANCIERA
   ===================================================== */

let editingGoalId: number | null = null;
let contribGoalId: number | null = null;
let ovDonutChart: any = null;
let gmSelectedColor = '#00e5a0';
let gmSelectedEmoji = '🎯';

// Estado de filtrado y orden
const goalFilterState = {
  status: 'all',     // 'all' | 'active' | 'behind' | 'completed' | 'paused'
  currency: 'all',   // 'all' | 'ARS' | 'USD' | 'EUR'
  sort: 'deadline_asc',
  search: ''
};

const GOAL_COLORS = ['#00e5a0', '#00c8ff', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];
const GOAL_EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💰', '📚', '💻', '🏖️', '💍', '🎓', '🏋️', '🎸', '📈', '💊', '🛍️', '🐾'];
const GOAL_CAT_EMOJIS: Record<string, string> = { 
  'Viaje': '✈️', 'Ahorro': '💰', 'Hogar': '🏠', 'Vehículo': '🚗', 
  'Educación': '📚', 'Tecnología': '💻', 'Inversión': '📈', 'Salud': '💊', 'Otro': '🎯' 
};

function initGoals() {
  goalService.initGoals();
}

/* ---- Entry ---- */
function enterObjetivosView() { 
  renderObjetivosView(); 
}

/* ---- Main render ---- */
function renderObjetivosView() {
  renderOvSummary();
  renderOvCards();
  renderOvDonut();
  renderOvProjections();
  renderOvTimeline();
  renderOvTip();
}

/* ---- Helpers de Cálculo Financiero ---- */
function goalPct(g: Goal): number { 
  return g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0; 
}

function goalLeft(g: Goal): number { 
  return Math.max(g.target - g.current, 0); 
}

function daysLeft(g: Goal): number | null { 
  if (!g.deadline) return null; 
  return Math.ceil((new Date(g.deadline + ' 00:00:00').getTime() - new Date().getTime()) / 86400000); 
}

function isCompleted(g: Goal): boolean { 
  return g.current >= g.target; 
}

function timeProgressPct(g: Goal): number {
  if (!g.deadline) return 0;
  const startDateStr = g.start_date || (g.created_at ? g.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const start = new Date(startDateStr + ' 00:00:00').getTime();
  const end = new Date(g.deadline + ' 00:00:00').getTime();
  const now = new Date().getTime();

  if (end <= start) return 100;
  const total = end - start;
  const elapsed = now - start;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function goalStatus(g: Goal): { key: string; label: string; cls: string } {
  if (isCompleted(g)) return { key: 'completed', label: '✅ Completado', cls: 'completed' };
  if (g.status === 'paused') return { key: 'paused', label: '⏸ Pausado', cls: 'paused' };
  
  const dl = daysLeft(g);
  if (dl !== null && dl < 0) return { key: 'overdue', label: '⚠️ Vencido', cls: 'overdue' };
  
  // Ritmo de ahorro vs tiempo transcurrido
  const tPct = timeProgressPct(g);
  const sPct = goalPct(g);

  // Si ya pasó más del 15% del tiempo y el ahorro está rezagado por más de 12%
  if (g.deadline && tPct > 15 && sPct < (tPct - 12)) {
    return { key: 'behind', label: '⚠️ Demorado', cls: 'behind' };
  }

  // Si faltan menos de 30 días y el avance es menor al 60%
  if (dl !== null && dl <= 30 && sPct < 60) {
    return { key: 'behind', label: '⚠️ Demorado', cls: 'behind' };
  }

  return { key: 'ontrack', label: '🔵 En camino', cls: 'ontrack' };
}

function monthlyNeeded(g: Goal): number {
  const dl = daysLeft(g);
  if (!dl || dl <= 0 || isCompleted(g)) return 0;
  const months = Math.max(dl / 30, 0.5);
  return Math.ceil(goalLeft(g) / months);
}

function calcMonthlyAverageSavings(g: Goal): number {
  const contribs = g.contributions || [];
  if (contribs.length === 0) return 0;

  let totalNet = 0;
  contribs.forEach(c => {
    if (c.type === 'withdraw') {
      totalNet -= c.amount;
    } else {
      totalNet += c.amount;
    }
  });

  if (totalNet <= 0) return 0;

  // Rango de meses activos
  const startDateStr = g.start_date || (g.created_at ? g.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const daysActive = Math.max(1, (new Date().getTime() - new Date(startDateStr + ' 00:00:00').getTime()) / 86400000);
  const monthsActive = Math.max(daysActive / 30, 1);

  return Math.round(totalNet / monthsActive);
}

/* ---- Filtros y Ordenamiento ---- */
function setGoalFilter(status: string) {
  goalFilterState.status = status;
  document.querySelectorAll('.ov-filters-group .ov-filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.id === `ovFilter${status.charAt(0).toUpperCase() + status.slice(1)}`);
  });
  renderOvCards();
}

function setGoalCurrencyFilter(curr: string) {
  goalFilterState.currency = curr;
  renderOvCards();
  renderOvDonut();
  renderOvProjections();
}

function changeGoalSort(sortValue: string) {
  goalFilterState.sort = sortValue;
  renderOvCards();
}

function handleGoalSearch(val: string) {
  goalFilterState.search = val.trim().toLowerCase();
  renderOvCards();
}

/* ---- Summary stats ---- */
function renderOvSummary() {
  const total = state.goals.length;
  const completed = state.goals.filter(isCompleted).length;
  const paused = state.goals.filter(g => g.status === 'paused' && !isCompleted(g)).length;
  const activeCount = total - completed - paused;

  // Agrupación por divisas
  const totalsByCurrency: Record<string, { saved: number; target: number }> = {};
  state.goals.forEach(g => {
    const curr = (g.currency || 'ARS').toUpperCase();
    if (!totalsByCurrency[curr]) totalsByCurrency[curr] = { saved: 0, target: 0 };
    totalsByCurrency[curr].saved += g.current;
    totalsByCurrency[curr].target += g.target;
  });

  // Mostrar la divisa principal o desglose
  const currencies = Object.keys(totalsByCurrency);
  let savedSummaryText = '';
  let targetSummaryText = '';

  if (currencies.length === 0) {
    savedSummaryText = '$0';
    targetSummaryText = 'de $0';
  } else if (currencies.length === 1) {
    const c = currencies[0];
    savedSummaryText = formatMoney(totalsByCurrency[c].saved, c);
    targetSummaryText = `de ${formatMoney(totalsByCurrency[c].target, c)}`;
  } else {
    savedSummaryText = currencies.map(c => formatMoney(totalsByCurrency[c].saved, c)).join(' + ');
    targetSummaryText = currencies.map(c => formatMoney(totalsByCurrency[c].target, c)).join(' + ');
  }

  const avgPct = total > 0 ? Math.round(state.goals.reduce((s, g) => s + goalPct(g), 0) / total) : 0;
  const behindCount = state.goals.filter(g => goalStatus(g).key === 'behind').length;
  const overdueCount = state.goals.filter(g => goalStatus(g).key === 'overdue').length;

  document.getElementById('ovSummary').innerHTML = `
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--accent3);"></div>
      <div class="ov-stat-lbl">Objetivos activos</div>
      <div class="ov-stat-val" style="color:var(--accent3);">${activeCount}</div>
      <div class="ov-stat-sub">${completed} completado${completed !== 1 ? 's' : ''}${paused > 0 ? ` · ${paused} pausado${paused !== 1 ? 's' : ''}` : ''}</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--accent);"></div>
      <div class="ov-stat-lbl">Total acumulado</div>
      <div class="ov-stat-val" style="color:var(--accent); font-size:${currencies.length > 1 ? '16px' : '22px'};">${savedSummaryText}</div>
      <div class="ov-stat-sub" style="font-size:9px;">${targetSummaryText}</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:var(--warn);"></div>
      <div class="ov-stat-lbl">Progreso global</div>
      <div class="ov-stat-val" style="color:var(--warn);">${avgPct}%</div>
      <div class="ov-stat-sub">Promedio de cumplimiento</div>
    </div>
    <div class="ov-stat">
      <div class="ov-stat-bar" style="background:${overdueCount > 0 ? 'var(--danger)' : behindCount > 0 ? 'var(--warn)' : 'var(--accent)'};"></div>
      <div class="ov-stat-lbl">Estado predictivo</div>
      <div class="ov-stat-val" style="color:${overdueCount > 0 ? 'var(--danger)' : behindCount > 0 ? 'var(--warn)' : 'var(--accent)'};">
        ${overdueCount > 0 ? `${overdueCount} vencido${overdueCount > 1 ? 's' : ''}` : behindCount > 0 ? `${behindCount} demorado${behindCount > 1 ? 's' : ''}` : 'Al día'}
      </div>
      <div class="ov-stat-sub">${state.goals.filter(g => { const dl = daysLeft(g); return dl !== null && dl <= 30 && dl > 0 && !isCompleted(g); }).length} próximos a vencer (&lt;30d)</div>
    </div>
  `;
}

/* ---- Goal cards ---- */
function renderOvCards() {
  const el = document.getElementById('ovCards');
  if (state.goals.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:52px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🎯</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:6px;">Sin objetivos todavía</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6;">Creá tu primer objetivo de ahorro y empezá a seguir tu progreso con inteligencia financiera predictiva.</div>
        <button class="btn btn-primary" onclick="openGoalModal()">+ Nuevo Objetivo</button>
      </div>`;
    return;
  }

  // Filtrado
  let filtered = state.goals.filter(g => {
    // Filtro por estado
    const status = goalStatus(g).key;
    if (goalFilterState.status === 'active' && (status === 'completed' || status === 'paused')) return false;
    if (goalFilterState.status === 'behind' && status !== 'behind' && status !== 'overdue') return false;
    if (goalFilterState.status === 'completed' && status !== 'completed') return false;
    if (goalFilterState.status === 'paused' && status !== 'paused') return false;

    // Filtro por moneda
    if (goalFilterState.currency !== 'all' && (g.currency || 'ARS').toUpperCase() !== goalFilterState.currency) return false;

    // Filtro por texto
    if (goalFilterState.search) {
      const q = goalFilterState.search;
      const matchesName = g.name.toLowerCase().includes(q);
      const matchesCat = (g.cat || '').toLowerCase().includes(q);
      const matchesNotes = (g.notes || '').toLowerCase().includes(q);
      if (!matchesName && !matchesCat && !matchesNotes) return false;
    }

    return true;
  });

  // Ordenamiento
  filtered.sort((a, b) => {
    switch (goalFilterState.sort) {
      case 'deadline_asc': {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db;
      }
      case 'pct_desc':
        return goalPct(b) - goalPct(a);
      case 'left_desc':
        return goalLeft(b) - goalLeft(a);
      case 'target_desc':
        return b.target - a.target;
      case 'name_asc':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="panel" style="padding:40px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">
        No hay objetivos que coincidan con los filtros seleccionados.
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(g => {
    const pct = goalPct(g);
    const left = goalLeft(g);
    const dl = daysLeft(g);
    const status = goalStatus(g);
    const monthly = monthlyNeeded(g);
    const completed = isCompleted(g);
    const curr = (g.currency || 'ARS').toUpperCase();
    const tPct = timeProgressPct(g);
    const avgMonthly = calcMonthlyAverageSavings(g);

    // SVG ring
    const R = 38, CX = 44, CY = 44, STROKE = 6;
    const circumference = 2 * Math.PI * R;
    const offset = circumference * (1 - pct / 100);
    const ringColor = completed ? 'var(--accent)' : status.key === 'behind' || status.key === 'overdue' ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : g.color;

    // Texto de fecha límite
    let deadlineHtml = 'Sin fecha límite';
    if (dl !== null) {
      if (dl < 0) deadlineHtml = `<span style="color:var(--danger);font-weight:700;">Venció hace ${Math.abs(dl)} días</span>`;
      else if (dl === 0) deadlineHtml = `<span style="color:var(--warn);font-weight:700;">Vence hoy</span>`;
      else if (dl <= 30) deadlineHtml = `<span style="color:var(--warn);">${dl} días restantes · ${formatDateLong(g.deadline)}</span>`;
      else deadlineHtml = `<span>${dl} días · ${formatDateLong(g.deadline)}</span>`;
    }

    return `
      <div class="ov-card ${completed ? 'completed-card' : ''}" id="ovc-${g.id}">
        <div class="ov-card-accent" style="background:${g.color};"></div>

        <div class="ov-card-header">
          <div class="ov-card-left">
            <div class="ov-card-icon" style="background:${g.color}18;">${g.emoji || '🎯'}</div>
            <div>
              <div class="ov-card-name">
                ${escHtml(g.name)}
                <span class="ov-currency-badge">${curr}</span>
              </div>
              <div class="ov-card-cat">${escHtml(g.cat)}${g.notes ? ` · ${escHtml(g.notes)}` : ''}</div>
            </div>
          </div>
          <div class="ov-card-actions">
            <button class="row-btn" onclick="toggleGoalStatus(${g.id})" title="${g.status === 'paused' ? 'Reanudar objetivo' : 'Pausar objetivo'}">
              ${g.status === 'paused' ? '▶️' : '⏸'}
            </button>
            <button class="row-btn edit-btn" onclick="openGoalModal(${g.id})" title="Editar objetivo">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" onclick="openGoalDeleteModal(${g.id})" title="Eliminar objetivo">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>

        <!-- Ring + amounts -->
        <div class="ov-ring-wrap">
          <div class="ov-ring" style="width:88px;height:88px;">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle class="ov-ring-bg" cx="${CX}" cy="${CY}" r="${R}" stroke-width="${STROKE}"/>
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
              <span class="ov-amount-val" style="color:${g.color};">${formatMoney(g.current, curr)}</span>
            </div>
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Meta total</span>
              <span class="ov-amount-val">${formatMoney(g.target, curr)}</span>
            </div>
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Falta ahorrar</span>
              <span class="ov-amount-val" style="color:${left > 0 ? 'var(--muted)' : 'var(--accent)'};">${left > 0 ? formatMoney(left, curr) : '¡Meta alcanzada!'}</span>
            </div>
            ${monthly > 0 ? `
            <div class="ov-amount-row">
              <span class="ov-amount-lbl">Aporte sugerido/mes</span>
              <span class="ov-amount-val" style="color:${status.key === 'behind' ? 'var(--danger)' : 'var(--warn)'};">${formatMoney(monthly, curr)}</span>
            </div>`: ''}
          </div>
        </div>

        <!-- Progress Bar with Pace Marker -->
        <div class="ov-bar-wrap">
          <div class="ov-bar-bg">
            ${g.deadline && tPct > 0 && tPct < 100 ? `<div class="ov-pace-marker" style="left:${tPct}%;" title="Tiempo transcurrido (${tPct}%)"></div>` : ''}
            <div class="ov-bar-fill" style="width:${pct}%;background:${ringColor};"></div>
          </div>
          <div class="ov-bar-labels">
            <span>${formatMoney(g.current, curr)} ahorrado</span>
            ${g.deadline ? `<span>Paso temporal: ${tPct}%</span>` : ''}
            <span>${formatMoney(g.target, curr)} meta</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="ov-footer">
          <span class="ov-status-chip ${status.cls}">${status.label}</span>
          <span class="ov-deadline">${deadlineHtml}</span>
        </div>

        ${completed
          ? `<div class="ov-completed-banner">🎉 ¡Objetivo completado con éxito! Felicitaciones.</div>`
          : `
            <div class="ov-card-btn-group">
              <button class="ov-contrib-btn" onclick="openContribModal(${g.id}, 'deposit')">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Aportar
              </button>
              <button class="ov-btn-withdraw" onclick="openContribModal(${g.id}, 'withdraw')" title="Registrar retiro de este objetivo">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Retirar
              </button>
            </div>
          `
        }
      </div>
    `;
  }).join('');
}

/* ---- Donut ---- */
function renderOvDonut() {
  const canvas = document.getElementById('ovDonutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Filtrar objetivos según divisa seleccionada si aplica
  const visibleGoals = goalFilterState.currency === 'all'
    ? state.goals
    : state.goals.filter(g => (g.currency || 'ARS').toUpperCase() === goalFilterState.currency);

  const labels = visibleGoals.map(g => g.name);
  const data = visibleGoals.map(g => g.current);
  const colors = visibleGoals.map(g => g.color + 'cc');
  const borders = visibleGoals.map(g => g.color);

  const totalSaved = visibleGoals.reduce((s, g) => s + g.current, 0);
  const totalTarget = visibleGoals.reduce((s, g) => s + g.target, 0);
  const globalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  document.getElementById('ovDonutPct').textContent = globalPct + '%';
  document.getElementById('ovDonutBadge').textContent = visibleGoals.length + ' objetivo' + (visibleGoals.length !== 1 ? 's' : '');

  if (ovDonutChart) ovDonutChart.destroy();

  ovDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: visibleGoals.length === 0 ? [1] : data,
        backgroundColor: visibleGoals.length === 0 ? ['#1a2030'] : colors,
        borderColor: visibleGoals.length === 0 ? ['#232b3a'] : borders,
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
          callbacks: { 
            label: c => ` ${formatMoney(c.parsed, goalFilterState.currency !== 'all' ? goalFilterState.currency : 'ARS')}` 
          }
        }
      }
    }
  });

  const leg = document.getElementById('ovDonutLegend');
  if (visibleGoals.length === 0) { 
    leg.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:8px 0;">Sin objetivos.</div>'; 
    return; 
  }

  leg.innerHTML = visibleGoals.map(g => {
    const curr = (g.currency || 'ARS').toUpperCase();
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:7px;">
          <div style="width:8px;height:8px;border-radius:2px;background:${g.color};flex-shrink:0;"></div>
          <span style="font-size:12px;font-weight:600;">${g.emoji || '🎯'} ${escHtml(g.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);">${formatMoney(g.current, curr)}</span>
          <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${g.color};">${Math.round(goalPct(g))}%</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ---- Panel de Ritmo y Proyecciones ---- */
function renderOvProjections() {
  const el = document.getElementById('ovProjections');
  if (!el) return;

  const activeGoals = state.goals.filter(g => !isCompleted(g) && g.status !== 'paused');
  if (activeGoals.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:8px 0;">Sin metas activas en curso.</div>`;
    return;
  }

  // Aporte total sugerido este mes por moneda
  const neededByCurr: Record<string, number> = {};
  activeGoals.forEach(g => {
    const c = (g.currency || 'ARS').toUpperCase();
    neededByCurr[c] = (neededByCurr[c] || 0) + monthlyNeeded(g);
  });

  const neededSummary = Object.keys(neededByCurr)
    .map(c => formatMoney(neededByCurr[c], c))
    .join(' + ') || '$0';

  const behindGoals = activeGoals.filter(g => goalStatus(g).key === 'behind');
  const ontrackGoals = activeGoals.filter(g => goalStatus(g).key === 'ontrack');

  el.innerHTML = `
    <div class="ov-proj-item">
      <span class="ov-proj-lbl">Aporte mensual necesario:</span>
      <span class="ov-proj-val" style="color:var(--accent3);">${neededSummary}</span>
    </div>
    <div class="ov-proj-item">
      <span class="ov-proj-lbl">Metas al día:</span>
      <span class="ov-proj-val" style="color:var(--accent);">${ontrackGoals.length} meta${ontrackGoals.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="ov-proj-item">
      <span class="ov-proj-lbl">Metas que requieren atención:</span>
      <span class="ov-proj-val" style="color:${behindGoals.length > 0 ? 'var(--warn)' : 'var(--muted)'};">${behindGoals.length} demorada${behindGoals.length !== 1 ? 's' : ''}</span>
    </div>
  `;
}

/* ---- Timeline ---- */
function renderOvTimeline() {
  const el = document.getElementById('ovTimeline');
  if (!el) return;

  const upcoming = state.goals
    .filter(g => !isCompleted(g) && g.deadline)
    .map(g => ({ ...g, dl: daysLeft(g) }))
    .sort((a, b) => a.dl - b.dl)
    .slice(0, 5);

  if (upcoming.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:12px 0;">Sin vencimientos próximos programados.</div>`;
    return;
  }

  el.innerHTML = upcoming.map((g, i) => {
    const cls = g.dl < 0 ? 'future' : i === 0 ? 'active' : 'done';
    const clr = g.dl < 0 ? 'var(--danger)' : i === 0 ? 'var(--accent3)' : 'var(--accent)';
    const curr = (g.currency || 'ARS').toUpperCase();
    let dlText = g.dl < 0 ? `Venció hace ${Math.abs(g.dl)}d` : g.dl === 0 ? 'Vence hoy' : `${g.dl} días`;
    return `
      <div class="ov-tl-item">
        <div class="ov-tl-dot ${cls}" style="border-color:${clr};color:${clr};">${g.emoji || '🎯'}</div>
        <div class="ov-tl-content">
          <div class="ov-tl-title">${escHtml(g.name)} <span class="ov-currency-badge">${curr}</span></div>
          <div class="ov-tl-meta">${dlText} · ${Math.round(goalPct(g))}% completado · falta ${formatMoney(goalLeft(g), curr)}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ---- Tips ---- */
function renderOvTip() {
  const tips: string[] = [];
  state.goals.forEach(g => {
    const dl = daysLeft(g);
    const m = monthlyNeeded(g);
    const curr = (g.currency || 'ARS').toUpperCase();
    if (isCompleted(g)) {
      tips.push(`🏆 ¡Felicitaciones por cumplir tu objetivo <strong>${escHtml(g.name)}</strong>! Considerá transferirlo o crear uno nuevo.`);
    } else if (dl !== null && dl < 0) {
      tips.push(`⏰ El objetivo <strong>${escHtml(g.name)}</strong> venció. Podés ajustar la fecha límite o replanificar los aportes.`);
    } else if (goalStatus(g).key === 'behind') {
      tips.push(`⚠️ <strong>${escHtml(g.name)}</strong> avanza a un ritmo menor al planeado. Para llegar a tiempo necesitás aportar <strong>${formatMoney(m, curr)}/mes</strong>.`);
    } else if (dl !== null && dl <= 30 && !isCompleted(g)) {
      tips.push(`🔔 <strong>${escHtml(g.name)}</strong> vence en ${dl} días — necesitás ahorrar <strong>${formatMoney(m, curr)}</strong> más.`);
    }
  });

  if (!tips.length) {
    const totalGoals = state.goals.length;
    tips.push(totalGoals > 0 
      ? `💪 ¡Tus metas van a buen ritmo! Mantené la constancia en tus aportes mensuales para cumplir tus objetivos.`
      : `✨ Sin objetivos activos. ¡Creá una nueva meta para empezar a ahorrar con propósito!`
    );
  }
  document.getElementById('ovTip').innerHTML = tips[0];
}

/* ---- Goal modal ---- */
function openGoalModal(id?: number) {
  editingGoalId = id || null;
  gmSelectedColor = '#00e5a0';
  gmSelectedEmoji = '🎯';

  // Build emoji grid
  document.getElementById('gmEmojiGrid').innerHTML = GOAL_EMOJIS.map(e => `
    <button class="ov-emoji-btn ${e === gmSelectedEmoji ? 'active' : ''}" onclick="selectGmEmoji('${e}')">${e}</button>
  `).join('');

  // Build color grid
  document.getElementById('gmColorGrid').innerHTML = GOAL_COLORS.map(c => `
    <div class="bv-color-swatch ${c === gmSelectedColor ? 'selected' : ''}" style="background:${c};" onclick="selectGmColor('${c}')"></div>
  `).join('');

  if (id) {
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    document.getElementById('goalModalTitle').textContent = 'Editar Objetivo';
    document.getElementById('gmSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('gmName').value = g.name;
    document.getElementById('gmTarget').value = g.target;
    document.getElementById('gmCurrent').value = g.current;
    document.getElementById('gmCurrency').value = (g.currency || 'ARS').toUpperCase();
    document.getElementById('gmStartDate').value = g.start_date || (g.created_at ? g.created_at.slice(0, 10) : '');
    document.getElementById('gmDeadline').value = g.deadline || '';
    document.getElementById('gmCat').value = g.cat || 'Viaje';
    if (window.updateCustomSelectDisplay) {
      window.updateCustomSelectDisplay(document.getElementById('gmCat'));
      window.updateCustomSelectDisplay(document.getElementById('gmCurrency'));
    }
    document.getElementById('gmNotes').value = g.notes || '';
    gmSelectedColor = g.color || '#00e5a0';
    gmSelectedEmoji = g.emoji || '🎯';
    
    // Refresh grids with correct selection
    document.getElementById('gmEmojiGrid').innerHTML = GOAL_EMOJIS.map(e => `
      <button class="ov-emoji-btn ${e === gmSelectedEmoji ? 'active' : ''}" onclick="selectGmEmoji('${e}')">${e}</button>
    `).join('');
    document.getElementById('gmColorGrid').innerHTML = GOAL_COLORS.map(c => `
      <div class="bv-color-swatch ${c === gmSelectedColor ? 'selected' : ''}" style="background:${c};" onclick="selectGmColor('${c}')"></div>
    `).join('');
  } else {
    document.getElementById('goalModalTitle').textContent = 'Nuevo Objetivo';
    document.getElementById('gmSaveBtn').textContent = 'Crear Objetivo';
    document.getElementById('gmName').value = '';
    document.getElementById('gmTarget').value = '';
    document.getElementById('gmCurrent').value = '0';
    document.getElementById('gmCurrency').value = 'ARS';
    document.getElementById('gmStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('gmDeadline').value = '';
    document.getElementById('gmCat').value = 'Viaje';
    if (window.updateCustomSelectDisplay) {
      window.updateCustomSelectDisplay(document.getElementById('gmCat'));
      window.updateCustomSelectDisplay(document.getElementById('gmCurrency'));
    }
    document.getElementById('gmNotes').value = '';
  }
  document.getElementById('goalModalOverlay').classList.add('open');
}

function selectGmEmoji(e: string) {
  gmSelectedEmoji = e;
  document.querySelectorAll('.ov-emoji-btn').forEach(b => b.classList.toggle('active', b.textContent === e));
}

function selectGmColor(c: string) {
  gmSelectedColor = c;
  document.querySelectorAll('#gmColorGrid .bv-color-swatch').forEach(s => {
    s.classList.toggle('selected', s.style.background === c || s.style.backgroundColor === c);
  });
}

function closeGoalModal(e?: Event) {
  if (!e || (e.target as HTMLElement).id === 'goalModalOverlay') {
    document.getElementById('goalModalOverlay').classList.remove('open');
    editingGoalId = null;
  }
}

async function saveGoal() {
  const name = document.getElementById('gmName').value.trim();
  const target = parseFloat(document.getElementById('gmTarget').value);
  const current = parseFloat(document.getElementById('gmCurrent').value) || 0;
  const currency = (document.getElementById('gmCurrency').value || 'ARS').toUpperCase();
  const startDate = document.getElementById('gmStartDate').value;
  const deadline = document.getElementById('gmDeadline').value;
  const cat = document.getElementById('gmCat').value;
  const notes = document.getElementById('gmNotes').value.trim();

  if (!name) { showToast('⚠️ Ingresá un nombre para la meta', true); return; }
  if (!target || target <= 0) { showToast('⚠️ Ingresá un monto meta válido', true); return; }

  const goalData: Partial<Goal> = {
    name, target, current, currency,
    start_date: startDate || new Date().toISOString().split('T')[0],
    deadline: deadline || null,
    cat, notes: notes || null,
    emoji: gmSelectedEmoji, color: gmSelectedColor
  };

  try {
    if (editingGoalId) {
      await goalService.updateGoal(editingGoalId, goalData);
      showToast('Objetivo actualizado correctamente');
    } else {
      await goalService.createGoal(goalData);
      showToast('Objetivo creado con éxito');
    }
    renderObjetivosView();
    closeGoalModal();
  } catch (err) {
    console.error("Error al guardar objetivo:", err);
    showToast("Error al guardar objetivo", true);
  }
}

async function toggleGoalStatus(id: number) {
  try {
    await goalService.toggleGoalStatus(id);
    renderObjetivosView();
    showToast('Estado del objetivo actualizado');
  } catch (err) {
    console.error("Error al cambiar estado:", err);
    showToast("Error al cambiar estado del objetivo", true);
  }
}

/* ---- Contribute modal ---- */
function openContribModal(id: number, mode: 'deposit' | 'withdraw' = 'deposit') {
  contribGoalId = id;
  const g = state.goals.find(x => x.id === id);
  if (!g) return;

  const curr = (g.currency || 'ARS').toUpperCase();
  document.getElementById('contribModalTitle').textContent = mode === 'withdraw' ? `Registrar Retiro: ${g.name}` : `Aportar a: ${g.name}`;
  document.getElementById('contribGoalInfo').textContent = `Acumulado: ${formatMoney(g.current, curr)} / ${formatMoney(g.target, curr)} — Falta: ${formatMoney(goalLeft(g), curr)}`;
  document.getElementById('cmType').value = mode;
  document.getElementById('cmAmount').value = '';
  document.getElementById('cmDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('cmNote').value = '';

  // Poblar select de cuentas
  const accSelect = document.getElementById('cmAccount');
  accSelect.innerHTML = `<option value="">Ninguna (solo registrar en meta)</option>` + 
    state.accounts.map(a => `
      <option value="${a.id}">${escHtml(a.name)} (${formatMoney(a.balance, a.currency || 'ARS')})</option>
    `).join('');

  if (window.updateCustomSelectDisplay) {
    window.updateCustomSelectDisplay(document.getElementById('cmType'));
    window.updateCustomSelectDisplay(accSelect);
  }

  updateContribModalType();

  // Historial de movimientos
  const hist = document.getElementById('cmHistory');
  const contribs = (g.contributions || []).slice().reverse();
  hist.innerHTML = contribs.length === 0
    ? `<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:12px 0;">Sin movimientos registrados.</div>`
    : `<div style="font-size:10px;font-family:var(--font-mono);color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;padding:10px 0 6px;">Historial de movimientos</div>`
    + contribs.map(c => {
        const isWithdraw = c.type === 'withdraw';
        const linkedAccount = c.account_id ? state.accounts.find(a => a.id === c.account_id) : null;
        return `
          <div class="ov-contrib-row">
            <div>
              <div style="font-weight:600; display:flex; align-items:center;">
                <span class="ov-contrib-badge ${isWithdraw ? 'withdraw' : 'deposit'}">${isWithdraw ? 'Retiro' : 'Aporte'}</span>
                <span style="color:${isWithdraw ? 'var(--warn)' : 'var(--accent)'};">${isWithdraw ? '-' : '+'}${formatMoney(c.amount, curr)}</span>
              </div>
              <div style="color:var(--muted);font-size:10px; margin-top:2px;">
                ${formatDate(c.date)}${c.note ? ' · ' + escHtml(c.note) : ''}${linkedAccount ? ` · Cuenta: ${escHtml(linkedAccount.name)}` : ''}
              </div>
            </div>
            <button class="row-btn delete-btn" onclick="deleteContrib(${id},${c.id})" title="Eliminar movimiento">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        `;
      }).join('');

  document.getElementById('contribModalOverlay').classList.add('open');
}

function updateContribModalType() {
  const type = document.getElementById('cmType').value;
  const submitBtn = document.getElementById('cmSubmitBtn');
  if (type === 'withdraw') {
    submitBtn.textContent = 'Registrar Retiro';
  } else {
    submitBtn.textContent = 'Registrar Aporte';
  }
}

function closeContribModal(e?: Event) {
  if (!e || (e.target as HTMLElement).id === 'contribModalOverlay') {
    document.getElementById('contribModalOverlay').classList.remove('open');
    contribGoalId = null;
  }
}

async function saveContrib() {
  const amount = parseFloat(document.getElementById('cmAmount').value);
  const date = document.getElementById('cmDate').value;
  const note = document.getElementById('cmNote').value.trim();
  const accountId = document.getElementById('cmAccount').value ? parseInt(document.getElementById('cmAccount').value) : null;
  const type = document.getElementById('cmType').value as 'deposit' | 'withdraw';

  if (!amount || amount <= 0) { showToast('⚠️ Ingresá un monto válido', true); return; }
  if (!date) { showToast('⚠️ Seleccioná una fecha', true); return; }

  try {
    await goalService.addContribution(contribGoalId, amount, date, note, accountId, type);
    renderObjetivosView();
    openContribModal(contribGoalId, type);
    showToast(type === 'withdraw' ? `Retiro de $${amount.toLocaleString('es-AR')} registrado` : `Aporte de $${amount.toLocaleString('es-AR')} registrado`);
  } catch (err) {
    console.error("Error al registrar movimiento:", err);
    showToast("Error al registrar movimiento", true);
  }
}

async function deleteContrib(goalId: number, contribId: number) {
  try {
    await goalService.removeContribution(goalId, contribId);
    renderObjetivosView();
    openContribModal(goalId);
    showToast('Movimiento eliminado');
  } catch (err) {
    console.error("Error al eliminar aporte:", err);
    showToast("Error al eliminar movimiento", true);
  }
}

/* ---- Delete goal ---- */
function openGoalDeleteModal(id: number) {
  editingGoalId = id;
  const g = state.goals.find(x => x.id === id);
  document.getElementById('gdName').textContent = g ? g.name : '';
  document.getElementById('goalDeleteOverlay').classList.add('open');
}

function closeGoalDeleteModal(e?: Event) {
  if (!e || (e.target as HTMLElement).id === 'goalDeleteOverlay') {
    document.getElementById('goalDeleteOverlay').classList.remove('open');
    editingGoalId = null;
  }
}

async function doDeleteGoal() {
  try {
    await goalService.deleteGoal(editingGoalId!);
    renderObjetivosView();
    showToast('Objetivo eliminado');
  } catch (err) {
    console.error("Error al eliminar objetivo:", err);
    showToast("Error al eliminar objetivo", true);
  }
  closeGoalDeleteModal();
}

// --- WINDOW ATTACHMENTS ---
window.monthlyNeeded = monthlyNeeded;
window.renderOvDonut = renderOvDonut;
window.openGoalDeleteModal = openGoalDeleteModal;
window.isCompleted = isCompleted;
window.enterObjetivosView = enterObjetivosView;
window.closeContribModal = closeContribModal;
window.deleteContrib = deleteContrib;
window.goalPct = goalPct;
window.doDeleteGoal = doDeleteGoal;
window.renderObjetivosView = renderObjetivosView;
window.selectGmColor = selectGmColor;
window.openGoalModal = openGoalModal;
window.goalStatus = goalStatus;
window.openContribModal = openContribModal;
window.renderOvTimeline = renderOvTimeline;
window.closeGoalModal = closeGoalModal;
window.closeGoalDeleteModal = closeGoalDeleteModal;
window.initGoals = initGoals;
window.goalLeft = goalLeft;
window.renderOvTip = renderOvTip;
window.daysLeft = daysLeft;
window.saveGoal = saveGoal;
window.renderOvSummary = renderOvSummary;
window.saveContrib = saveContrib;
window.selectGmEmoji = selectGmEmoji;
window.renderOvCards = renderOvCards;
window.setGoalFilter = setGoalFilter;
window.setGoalCurrencyFilter = setGoalCurrencyFilter;
window.changeGoalSort = changeGoalSort;
window.handleGoalSearch = handleGoalSearch;
window.toggleGoalStatus = toggleGoalStatus;
window.updateContribModalType = updateContribModalType;
