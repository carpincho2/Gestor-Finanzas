import { state, IS_SERVER, userKey } from '../store/store.js';
import { apiFetch } from '../api/apiClient.js';

function saveGoalsToLocal() {
  localStorage.setItem(userKey('flujo_goals'), JSON.stringify(state.goals));
}

export function initGoals() {
  if (state.goals.length === 0) {
    saveGoalsToLocal();
  }
}

export async function createGoal(goalData) {
  if (IS_SERVER) {
    await apiFetch('/goals', {
      method: 'POST',
      body: JSON.stringify({ ...goalData, status: 'active' })
    });
    if (window.loadUserData) await window.loadUserData();
  } else {
    state.goals.push({ id: Date.now(), ...goalData, contributions: [], status: 'active' });
    saveGoalsToLocal();
  }
}

export async function updateGoal(id, goalData) {
  if (IS_SERVER) {
    await apiFetch(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...goalData, status: 'active' })
    });
    if (window.loadUserData) await window.loadUserData();
  } else {
    const idx = state.goals.findIndex(x => x.id === id);
    if (idx > -1) {
      state.goals[idx] = { ...state.goals[idx], ...goalData };
      saveGoalsToLocal();
    }
  }
}

export async function deleteGoal(id) {
  if (IS_SERVER) {
    await apiFetch(`/goals/${id}`, { method: 'DELETE' });
    if (window.loadUserData) await window.loadUserData();
  } else {
    state.goals = state.goals.filter(x => x.id !== id);
    saveGoalsToLocal();
  }
}

export async function addContribution(goalId, amount, date, note) {
  if (IS_SERVER) {
    await apiFetch(`/goals/${goalId}/contributions`, {
      method: 'POST',
      body: JSON.stringify({ amount, date, note: note || null })
    });
    if (window.loadUserData) await window.loadUserData();
  } else {
    const idx = state.goals.findIndex(x => x.id === goalId);
    if (idx > -1) {
      if (!state.goals[idx].contributions) state.goals[idx].contributions = [];
      state.goals[idx].contributions.push({ id: Date.now(), amount, date, note });
      state.goals[idx].current += amount;
      saveGoalsToLocal();
    }
  }
}

export async function removeContribution(goalId, contribId) {
  if (IS_SERVER) {
    await apiFetch(`/goals/${goalId}/contributions/${contribId}`, { method: 'DELETE' });
    if (window.loadUserData) await window.loadUserData();
  } else {
    const idx = state.goals.findIndex(x => x.id === goalId);
    if (idx > -1) {
      const c = state.goals[idx].contributions.find(x => x.id === contribId);
      if (c) {
        state.goals[idx].current = Math.max(state.goals[idx].current - c.amount, 0);
        state.goals[idx].contributions = state.goals[idx].contributions.filter(x => x.id !== contribId);
        saveGoalsToLocal();
      }
    }
  }
}
