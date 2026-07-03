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
   GLOBAL KEYBOARD SHORTCUTS
   ===================================================== */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
      // 1. Chat AI
      if (active.id === 'aiInput') {
        const btn = document.getElementById('aiSendBtn');
        if (btn && !btn.disabled) aiSendMessage();
        return;
      }

      // 2. Modals en main.html
      const overlays = [
        { id: 'goalModalOverlay', fn: () => saveGoal() },
        { id: 'contribModalOverlay', fn: () => saveContrib() },
        { id: 'accModalOverlay', fn: () => saveAccount() },
        { id: 'budgetModalOverlay', fn: () => saveBudget() },
        { id: 'editModalOverlay', fn: () => saveEdit() },
        { id: 'modalOverlay', fn: () => addFromModal() },
        { id: 'scResultOverlay', fn: () => { const b = document.getElementById('scSaveTicketBtn'); if(b) b.click(); else scSaveTicket(); } }
      ];

      for (const ov of overlays) {
        const el = document.getElementById(ov.id);
        if (el && el.style.display === 'flex') {
          e.preventDefault(); // Prevenir submit por defecto si estuviese en un form
          ov.fn();
          return;
        }
      }
    }
  }
});

