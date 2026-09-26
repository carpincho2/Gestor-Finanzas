import { state, IS_SERVER, userKey } from '../store/store.js';
import { apiFetch } from '../api/apiClient.js';

// Asumiendo que loadUserData está en el scope global o en store
// Para mantener compatibilidad con el diseño original
const reloadUserData = async () => {
    if (window.loadUserData) {
        await window.loadUserData();
    }
};

export function saveBudgetsLocal() {
    localStorage.setItem(userKey('flujo_budgets'), JSON.stringify(state.budgets));
}

export function initBudgets() {
    if (state.budgets.length === 0) {
        saveBudgetsLocal();
    }
}

export async function createBudget(budgetData) {
    if (IS_SERVER) {
        await apiFetch('/budgets', {
            method: 'POST',
            body: JSON.stringify(budgetData)
        });
        await reloadUserData();
    } else {
        const newB = { id: Date.now(), ...budgetData };
        state.budgets.push(newB);
        saveBudgetsLocal();
    }
}

export async function updateBudget(id, budgetData) {
    if (IS_SERVER) {
        await apiFetch(`/budgets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(budgetData)
        });
        await reloadUserData();
    } else {
        const idx = state.budgets.findIndex(x => x.id === id);
        if (idx > -1) {
            state.budgets[idx] = { ...state.budgets[idx], ...budgetData };
            saveBudgetsLocal();
        }
    }
}

export async function deleteBudget(id) {
    if (IS_SERVER) {
        await apiFetch(`/budgets/${id}`, {
            method: 'DELETE'
        });
        await reloadUserData();
    } else {
        state.budgets = state.budgets.filter(x => x.id !== id);
        saveBudgetsLocal();
    }
}
