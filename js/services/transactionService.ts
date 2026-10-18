import { state, IS_SERVER } from '../store/store.ts';
import { apiFetch } from '../api/apiClient.ts';
import { loadUserData, save } from '../app.ts';

export const TransactionService = {
  async addTransaction(tx) {
    if (IS_SERVER) {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: tx.account_id || null,
          type: tx.type,
          desc: tx.desc,
          amount: tx.amount,
          cat: tx.cat,
          date: tx.date,
          transfer_id: tx.transfer_id || null
        })
      });
      await loadUserData();
    } else {
      tx.id = Date.now();
      state.transactions.unshift(tx);
      if (tx.account_id) {
        const acc = (state.accounts || []).find(a => a.id === tx.account_id);
        if (acc) {
          acc.balance = (acc.balance || 0) + (tx.type === 'income' ? tx.amount : -tx.amount);
        }
      }
      save();
    }
  },

  async updateTransaction(editingId, txData, orig) {
    const resolvedAccountId = txData.account_id !== undefined
      ? txData.account_id
      : (orig ? orig.account_id : null);

    if (IS_SERVER) {
      await apiFetch(`/transactions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          account_id: resolvedAccountId,
          type: txData.type,
          desc: txData.desc,
          amount: txData.amount,
          cat: txData.cat,
          date: txData.date,
          transfer_id: orig ? orig.transfer_id : null
        })
      });
      await loadUserData();
    } else {
      const idx = state.transactions.findIndex(x => x.id === editingId);
      if (idx > -1) {
        if (orig && orig.account_id) {
          const oldAcc = (state.accounts || []).find(a => a.id === orig.account_id);
          if (oldAcc) {
            oldAcc.balance = (oldAcc.balance || 0) + (orig.type === 'income' ? -orig.amount : orig.amount);
          }
        }
        if (resolvedAccountId) {
          const newAcc = (state.accounts || []).find(a => a.id === resolvedAccountId);
          if (newAcc) {
            newAcc.balance = (newAcc.balance || 0) + (txData.type === 'income' ? txData.amount : -txData.amount);
          }
        }
        state.transactions[idx] = { ...state.transactions[idx], ...txData, account_id: resolvedAccountId };
        save();
      }
    }
  },

  async deleteTransaction(editingId) {
    if (IS_SERVER) {
      await apiFetch(`/transactions/${editingId}`, {
        method: 'DELETE'
      });
      await loadUserData();
    } else {
      state.transactions = state.transactions.filter(x => x.id !== editingId);
      save();
    }
  }
};
