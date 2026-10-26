// @ts-nocheck
import { IS_SERVER, state, userKey } from './store/store.ts';
import { apiFetch } from './api/apiClient.ts';
import { showToast, initGlobalShortcuts } from './utils/utils.ts';

import * as ui from './ui.ts';
import * as profile from './profile.ts';
import * as transactions from './transactions.ts';
import * as accounts from './accounts.ts';
import * as budgets from './budgets.ts';
import * as goals from './goals.ts';
import * as reports from './reports.ts';
import * as scanner from './scanner.ts';
import * as ai from './ai.ts';
import * as imp from './import.ts';
import * as shopping from './shopping.ts';
import * as supermercados from './supermercados.ts';
import * as shoppingList from './shoppingList.ts';

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
Object.assign(window, supermercados);
Object.assign(window, shoppingList);

/* =====================================================
   INIT
   ===================================================== */
let viewsLoaded = false;

export async function loadViews() {
  if (viewsLoaded) return;
  const viewsMap = {
    'dashboardView': 'dashboard',
    'txView': 'transactions',
    'budgetView': 'budgets',
    'cuentasView': 'cuentas',
    'reportesView': 'reportes',
    'objetivosView': 'objetivos',
    'scannerView': 'scanner',
    'insightsView': 'insights',
    'perfilView': 'perfil',
    'supermercadosView': 'supermercados',
    'shoppingView': 'shopping',
    'listaComprasView': 'lista_compras'
  };

  await Promise.all(
    Object.entries(viewsMap).map(async ([id, file]) => {
      try {
        const el = document.getElementById(id);
        if (el) {
          const res = await fetch(`html/views/${file}.html?v=${Date.now()}`);
          if (res.ok) {
            el.innerHTML = await res.text();
          }
        }
      } catch (e) {
        console.error(`Error loading view ${file}:`, e);
      }
    })
  );
  viewsLoaded = true;
}

import { loadUserData } from './services/dataLoader.ts';
export { loadUserData };

export async function init() {
  await loadViews();
  if (window.initCustomSelects) window.initCustomSelects();
  if (window.initQuickAdd) window.initQuickAdd();
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
  if (window.initQuickAdd) window.initQuickAdd();
  if (window.initCustomSelects) window.initCustomSelects();
  
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

// Pre-cargar vistas en paralelo con la verificación de sesión para que el Dashboard aparezca instantáneamente
loadViews().then(() => {
  if (window.renderAll) window.renderAll();
});

// INICIAR LA APP
if (typeof window.authCheckSession === 'function') {
  window.authCheckSession();
} else {
  profile.authCheckSession();
}
