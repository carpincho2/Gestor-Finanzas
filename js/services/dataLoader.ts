// @ts-nocheck
import { IS_SERVER, state, userKey } from '../store/store.ts';
import { apiFetch } from '../api/apiClient.ts';

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
      console.warn("Backend no disponible o sesión local activa, cargando almacenamiento local:", err);
      state.transactions = JSON.parse(localStorage.getItem(userKey('flujo_tx')) || '[]');
      state.budgets = JSON.parse(localStorage.getItem(userKey('flujo_budgets')) || '[]');
      state.accounts = JSON.parse(localStorage.getItem(userKey('flujo_accounts')) || '[]');
      state.goals = JSON.parse(localStorage.getItem(userKey('flujo_goals')) || '[]');
      state.scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
    }
  } else {
    state.transactions = JSON.parse(localStorage.getItem(userKey('flujo_tx')) || '[]');
    state.budgets = JSON.parse(localStorage.getItem(userKey('flujo_budgets')) || '[]');
    state.accounts = JSON.parse(localStorage.getItem(userKey('flujo_accounts')) || '[]');
    state.goals = JSON.parse(localStorage.getItem(userKey('flujo_goals')) || '[]');
    state.scScanHistory = JSON.parse(localStorage.getItem(userKey('flujo_scan_history')) || '[]');
  }
}

if (typeof window !== 'undefined') {
  window.loadUserData = loadUserData;
}
