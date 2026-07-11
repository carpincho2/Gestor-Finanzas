import { IS_SERVER, state, userKey } from './store/store.js';
import { apiFetch } from './api/apiClient.js';
import { showToast, initGlobalShortcuts } from './utils/utils.js';

import * as ui from './ui.js';
import * as profile from './profile.js';
import * as transactions from './transactions.js';
import * as accounts from './accounts.js';
import * as budgets from './budgets.js';
import * as goals from './goals.js';
import * as reports from './reports.js';
import * as scanner from './scanner.js';
import * as ai from './ai.js';
import * as imp from './import.js';
import * as shopping from './shopping.js';

// Expose to window for inline onclicks in HTML
Object.assign(window, ui);
Object.assign(window, profile);
Object.assign(window, transactions);
Object.assign(window, accounts);
Object.assign(window, budgets);
Object.assign(window, goals);
Object.assign(window, reports);
Object.assign(window, scanner);
Object.assign(window, ai);
Object.assign(window, imp);
Object.assign(window, shopping);

/* =====================================================
   INIT
   ===================================================== */
export async function loadViews() {
  const viewsMap = {
    'dashboardView': 'dashboard',
    'txView': 'transactions',
    'budgetView': 'budgets',
    'cuentasView': 'cuentas',
    'reportesView': 'reportes',
    'objetivosView': 'objetivos',
    'scannerView': 'scanner',
    'insightsView': 'insights',
    'perfilView': 'perfil'
  };
  
  for (const [id, file] of Object.entries(viewsMap)) {
    try {
      const el = document.getElementById(id);
      if (el) {
        const res = await fetch(`html/views/${file}.html?v=${Date.now()}`);
        el.innerHTML = await res.text();
      }
    } catch (e) {
      console.error(`Error loading view ${file}:`, e);
    }
  }
}

export async function loadUserData() {
  if (IS_SERVER) {
    try {
      const [resAcc, resTx, resBgt, resGoal] = await Promise.all([
        apiFetch('/accounts'),
        apiFetch('/transactions'),
        apiFetch('/budgets'),
        apiFetch('/goals')
      ]);
      
      if (resAcc && resAcc.ok) state.accounts = resAcc.accounts;
      if (resTx && resTx.ok) state.transactions = resTx.transactions;
      if (resBgt && resBgt.ok) state.budgets = resBgt.budgets;
      if (resGoal && resGoal.ok) state.goals = resGoal.goals;
      
      state.scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
    } catch (err) {
      console.error("Error cargando datos del backend:", err);
      showToast("⚠️ Error al sincronizar con el servidor", true);
    }
  } else {
    state.transactions = JSON.parse(localStorage.getItem(userKey('flujo_tx')) || '[]');
    state.budgets = JSON.parse(localStorage.getItem(userKey('flujo_budgets')) || '[]');
    state.accounts = JSON.parse(localStorage.getItem(userKey('flujo_accounts')) || '[]');
    state.goals = JSON.parse(localStorage.getItem(userKey('flujo_goals')) || '[]');
    state.scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
  }
}

export async function init() {
  await loadViews();
  await loadUserData();

  if (!IS_SERVER) {
    if (state.transactions.length === 0) save();
    if (window.initBudgets) window.initBudgets();
    if (window.initAccounts) window.initAccounts();
    if (window.initGoals) window.initGoals();
  }

  // Initialize Shopping UI
  if (window.initShopping) window.initShopping();

  let hashStr = window.location.hash;
  const urlParams = new URLSearchParams(hashStr.includes('?') ? hashStr.split('?')[1] : window.location.search);
  
  if (urlParams.get('wallet_connected') === '1') {
    const accId = urlParams.get('account_id');
    setTimeout(() => {
      window.setPage(document.querySelector('[onclick*="\'cuentas\'"]'), 'cuentas');
      showToast('Billetera conectada exitosamente (OAuth)');
      if (accId && typeof window.promptInitialBalance === 'function') window.promptInitialBalance(accId);
    }, 500);
    window.history.replaceState({}, document.title, window.location.pathname + (hashStr.includes('?') ? hashStr.split('?')[0] : window.location.hash));
  } else if (urlParams.get('wallet_error')) {
    setTimeout(() => {
      window.setPage(document.querySelector('[onclick*="\'cuentas\'"]'), 'cuentas');
      showToast('Error al conectar billetera: ' + urlParams.get('wallet_error'), true);
    }, 500);
    window.history.replaceState({}, document.title, window.location.pathname + (hashStr.includes('?') ? hashStr.split('?')[0] : window.location.hash));
  }

  setDate();
  if (window.renderAll) window.renderAll();
  
  initGlobalShortcuts({
    aiSendMessage: window.aiSendMessage,
    saveGoal: window.saveGoal,
    saveContrib: window.saveContrib,
    saveAccount: window.saveAccount,
    saveBudget: window.saveBudget,
    saveEdit: window.saveEdit,
    addFromModal: window.addFromModal,
    scSaveTicket: window.scSaveTicket
  });
}

export function setDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const elDate = document.getElementById('pageDate');
  if (elDate) elDate.textContent = d.toLocaleDateString('es-AR', opts).replace(/^\w/, c => c.toUpperCase());

  const elMDate = document.getElementById('mDate');
  if (elMDate) elMDate.value = d.toISOString().split('T')[0];
}

export function save() {
  if (!IS_SERVER) {
    localStorage.setItem(userKey('flujo_tx'), JSON.stringify(state.transactions));
  }
}

export function scOCRTestSuite() {
  console.log("Suite moved or not executed");
}

window.loadViews = loadViews;
window.init = init;
window.setDate = setDate;
window.save = save;
window.scOCRTestSuite = scOCRTestSuite;
window.loadUserData = loadUserData;

// INICIAR LA APP
if (typeof window.authCheckSession === 'function') {
  window.authCheckSession();
} else {
  // Try directly from profile
  profile.authCheckSession();
}
