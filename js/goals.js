import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
// (Imports cruzados inyectados por refactor)

/* =====================================================
   OBJETIVOS
   ===================================================== */

let editingGoalId = null;
let contribGoalId = null;
let ovDonutChart = null;
let gmSelectedColor = '#00e5a0';
let gmSelectedEmoji = '🎯';

const GOAL_EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💰', '📚', '💻', '🏖️', '💍', '🎓', '🏋️', '🎸', '📈', '💊', '🛍️', '🐾'];
const GOAL_CAT_EMOJIS = { 'Viaje': '✈️', 'Ahorro': '💰', 'Hogar': '🏠', 'Vehículo': '🚗', 'Educación': '📚', 'Tecnología': '💻', 'Inversión': '📈', 'Salud': '💊', 'Otro': '🎯' };

function saveGoals() { localStorage.setItem(userKey('flujo_goals'), JSON.stringify(state.goals)); }

function initGoals() {
  if (state.goals.length === 0) {
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
  const total = state.goals.length;
  const completed = state.goals.filter(isCompleted).length;
  const totalSaved = state.goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = state.goals.reduce((s, g) => s + g.target, 0);
  const avgPct = total > 0 ? Math.round(state.goals.reduce((s, g) => s + goalPct(g), 0) / total) : 0;
  const overdue = state.goals.filter(g => { const dl = daysLeft(g); return dl !== null && dl < 0 && !isCompleted(g); }).length;
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
      <div class="ov-stat-sub">${state.goals.filter(g => daysLeft(g) !== null && daysLeft(g) <= 30 && daysLeft(g) > 0 && !isCompleted(g)).length} próximos a vencer</div>
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
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6;">Creá tu primer objetivo de ahorro y empezá a seguir tu progreso.</div>
        <button class="btn btn-primary" onclick="openGoalModal()">+ Nuevo Objetivo</button>
      </div>`;
    return;
  }

  // Sort: active first, then completed, then overdue
  const sorted = [...state.goals].sort((a, b) => {
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
  const active = state.goals.filter(g => !isCompleted(g));
  const done = state.goals.filter(isCompleted);

  const labels = state.goals.map(g => g.name);
  const data = state.goals.map(g => g.current);
  const colors = state.goals.map(g => g.color + 'cc');
  const borders = state.goals.map(g => g.color);

  const totalSaved = state.goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = state.goals.reduce((s, g) => s + g.target, 0);
  const globalPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  document.getElementById('ovDonutPct').textContent = globalPct + '%';
  document.getElementById('ovDonutBadge').textContent = state.goals.length + ' objetivo' + (state.goals.length !== 1 ? 's' : '');

  if (ovDonutChart) ovDonutChart.destroy();

  ovDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: state.goals.length === 0 ? [1] : data,
        backgroundColor: state.goals.length === 0 ? ['#1a2030'] : colors,
        borderColor: state.goals.length === 0 ? ['#232b3a'] : borders,
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
  if (state.goals.length === 0) { leg.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:8px 0;">Sin objetivos.</div>'; return; }
  leg.innerHTML = state.goals.map(g => `
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

  const upcoming = state.goals
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
  state.goals.forEach(g => {
    const dl = daysLeft(g);
    const m = monthlyNeeded(g);
    if (isCompleted(g)) tips.push(`🏆 ¡Felicitaciones por cumplir tu objetivo <strong>${g.name}</strong>!`);
    else if (dl !== null && dl < 0) tips.push(`⏰ El objetivo <strong>${g.name}</strong> venció. Considerá actualizarlo o marcarlo como completado.`);
    else if (dl !== null && dl <= 30 && !isCompleted(g)) tips.push(`🔔 <strong>${g.name}</strong> vence en ${dl} días — necesitás ahorrar $${m.toLocaleString('es-AR')} más.`);
  });
  if (!tips.length) {
    const totalLeft = state.goals.reduce((s, g) => s + goalLeft(g), 0);
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
    const g = state.goals.find(x => x.id === id);
    if (!g) return;
    document.getElementById('goalModalTitle').textContent = 'Editar Objetivo';
    document.getElementById('gmSaveBtn').textContent = 'Guardar cambios';
    document.getElementById('gmName').value = g.name;
    document.getElementById('gmTarget').value = g.target;
    document.getElementById('gmCurrent').value = g.current;
    document.getElementById('gmDeadline').value = g.deadline || '';
    document.getElementById('gmCat').value = g.cat;
    updateCustomSelectDisplay(document.getElementById('gmCat'));
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
    updateCustomSelectDisplay(document.getElementById('gmCat'));
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
        await apiFetch(`/goals/${editingGoalId}`, {
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
        await apiFetch('/goals', {
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
      const idx = state.goals.findIndex(x => x.id === editingGoalId);
      if (idx > -1) {
        state.goals[idx] = { ...state.goals[idx], name, target, current, deadline, cat, notes, emoji: gmSelectedEmoji, color: gmSelectedColor };
        saveGoals(); renderObjetivosView();
        showToast('Objetivo actualizado');
      }
    } else {
      state.goals.push({ id: Date.now(), name, target, current, deadline, cat, notes, emoji: gmSelectedEmoji, color: gmSelectedColor, contributions: [], status: 'active' });
      saveGoals(); renderObjetivosView();
      showToast('Objetivo creado');
    }
  }
  closeGoalModal();
}

/* ---- Contribute modal ---- */
function openContribModal(id) {
  contribGoalId = id;
  const g = state.goals.find(x => x.id === id);
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

  const idx = state.goals.findIndex(x => x.id === contribGoalId);
  if (idx < 0) return;

  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${contribGoalId}/contributions`, {
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
    if (!state.goals[idx].contributions) state.goals[idx].contributions = [];
    state.goals[idx].contributions.push({ id: Date.now(), amount, date, note });
    state.goals[idx].current += amount;

    saveGoals();
    renderObjetivosView();
    openContribModal(contribGoalId); // refresh history in modal
    showToast(`Aportado $${amount.toLocaleString('es-AR')}`);
  }
}

async function deleteContrib(goalId, contribId) {
  const idx = state.goals.findIndex(x => x.id === goalId);
  if (idx < 0) return;

  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${goalId}/contributions/${contribId}`, {
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
    const c = state.goals[idx].contributions.find(x => x.id === contribId);
    if (!c) return;
    state.goals[idx].current = Math.max(state.goals[idx].current - c.amount, 0);
    state.goals[idx].contributions = state.goals[idx].contributions.filter(x => x.id !== contribId);
    saveGoals();
    renderObjetivosView();
    openContribModal(goalId);
    showToast('Aporte eliminado');
  }
}

/* ---- Delete goal ---- */
function openGoalDeleteModal(id) {
  editingGoalId = id;
  const g = state.goals.find(x => x.id === id);
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
      await apiFetch(`/goals/${editingGoalId}`, {
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
    state.goals = state.goals.filter(x => x.id !== editingGoalId);
    saveGoals(); renderObjetivosView();
    showToast('Objetivo eliminado');
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
window.saveGoals = saveGoals;
window.saveContrib = saveContrib;
window.selectGmEmoji = selectGmEmoji;
window.renderOvCards = renderOvCards;
