// @ts-nocheck
import { state, IS_SERVER, userKey } from '../store/store.ts';
import { apiFetch } from '../api/apiClient.ts';

function saveGoalsToLocal() {
  localStorage.setItem(userKey('flujo_goals'), JSON.stringify(state.goals));
}

function saveAccountsToLocal() {
  localStorage.setItem(userKey('flujo_accounts'), JSON.stringify(state.accounts));
}

export function initGoals() {
  if (state.goals.length === 0) {
    saveGoalsToLocal();
  }
}

export async function createGoal(goalData) {
  const payload = {
    ...goalData,
    currency: (goalData.currency || 'ARS').toUpperCase(),
    start_date: goalData.start_date || new Date().toISOString().split('T')[0],
    status: goalData.status || 'active'
  };

  if (IS_SERVER) {
    try {
      await apiFetch('/goals', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en createGoal:', err);
    }
  }
  state.goals.push({
    id: Date.now(),
    ...payload,
    contributions: []
  });
  saveGoalsToLocal();
}

export async function updateGoal(id, goalData) {
  const payload = {
    ...goalData,
    currency: (goalData.currency || 'ARS').toUpperCase(),
    status: goalData.status || 'active'
  };

  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en updateGoal:', err);
    }
  }
  const idx = state.goals.findIndex(x => x.id === id);
  if (idx > -1) {
    state.goals[idx] = { ...state.goals[idx], ...payload };
    saveGoalsToLocal();
  }
}

export async function toggleGoalStatus(id, newStatus) {
  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en toggleGoalStatus:', err);
    }
  }
  const g = state.goals.find(x => x.id === id);
  if (g) {
    if (newStatus) {
      g.status = newStatus;
    } else {
      g.status = g.status === 'paused' ? 'active' : 'paused';
    }
    saveGoalsToLocal();
  }
}

export async function deleteGoal(id) {
  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${id}`, { method: 'DELETE' });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en deleteGoal:', err);
    }
  }
  state.goals = state.goals.filter(x => x.id !== id);
  saveGoalsToLocal();
}

export async function addContribution(
  goalId,
  amount,
  date,
  note,
  accountId = null,
  type = 'deposit'
) {
  const contribPayload = {
    amount,
    date,
    note: note || null,
    account_id: accountId ? Number(accountId) : null,
    type: type || 'deposit'
  };

  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${goalId}/contributions`, {
        method: 'POST',
        body: JSON.stringify(contribPayload)
      });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en addContribution:', err);
    }
  }
  const idx = state.goals.findIndex(x => x.id === goalId);
  if (idx > -1) {
    if (!state.goals[idx].contributions) state.goals[idx].contributions = [];
    const newContrib = {
      id: Date.now(),
      goal_id: goalId,
      amount,
      date,
      note: note || null,
      account_id: accountId ? Number(accountId) : null,
      type
    };
    state.goals[idx].contributions.push(newContrib);

    if (type === 'withdraw') {
      state.goals[idx].current = Math.max(0, state.goals[idx].current - amount);
    } else {
      state.goals[idx].current += amount;
    }
    saveGoalsToLocal();

    if (accountId) {
      const acc = state.accounts.find(a => a.id === Number(accountId));
      if (acc) {
        if (type === 'withdraw') {
          acc.balance += amount;
        } else {
          acc.balance -= amount;
        }
        saveAccountsToLocal();
      }
    }
  }
}

export async function removeContribution(goalId, contribId) {
  if (IS_SERVER) {
    try {
      await apiFetch(`/goals/${goalId}/contributions/${contribId}`, { method: 'DELETE' });
      if (window.loadUserData) await window.loadUserData();
      return;
    } catch (err) {
      console.warn('Fallback local en removeContribution:', err);
    }
  }
  const idx = state.goals.findIndex(x => x.id === goalId);
  if (idx > -1 && state.goals[idx].contributions) {
    const c = state.goals[idx].contributions.find(x => x.id === contribId);
    if (c) {
      const cType = c.type || 'deposit';
      if (cType === 'withdraw') {
        state.goals[idx].current += c.amount;
      } else {
        state.goals[idx].current = Math.max(state.goals[idx].current - c.amount, 0);
      }

      if (c.account_id) {
        const acc = state.accounts.find(a => a.id === Number(c.account_id));
        if (acc) {
          if (cType === 'withdraw') {
            acc.balance -= c.amount;
          } else {
            acc.balance += c.amount;
          }
          saveAccountsToLocal();
        }
      }

      state.goals[idx].contributions = state.goals[idx].contributions.filter(x => x.id !== contribId);
      saveGoalsToLocal();
    }
  }
}
