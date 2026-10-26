import { state, IS_SERVER, userKey } from '../store/store.ts';
import { apiFetch } from '../api/apiClient.ts';

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
        try {
            await apiFetch('/budgets', {
                method: 'POST',
                body: JSON.stringify(budgetData)
            });
            await reloadUserData();
            return;
        } catch (err) {
            console.warn('Fallback local en createBudget:', err);
        }
    }
    const newB = { id: Date.now(), ...budgetData };
    state.budgets.push(newB);
    saveBudgetsLocal();
}

export async function updateBudget(id, budgetData) {
    if (IS_SERVER) {
        try {
            await apiFetch(`/budgets/${id}`, {
                method: 'PUT',
                body: JSON.stringify(budgetData)
            });
            await reloadUserData();
            return;
        } catch (err) {
            console.warn('Fallback local en updateBudget:', err);
        }
    }
    const idx = state.budgets.findIndex(x => x.id === id);
    if (idx > -1) {
        state.budgets[idx] = { ...state.budgets[idx], ...budgetData };
        saveBudgetsLocal();
    }
}

export async function deleteBudget(id) {
    if (IS_SERVER) {
        try {
            await apiFetch(`/budgets/${id}`, {
                method: 'DELETE'
            });
            await reloadUserData();
            return;
        } catch (err) {
            console.warn('Fallback local en deleteBudget:', err);
        }
    }
    state.budgets = state.budgets.filter(x => x.id !== id);
    saveBudgetsLocal();
}
