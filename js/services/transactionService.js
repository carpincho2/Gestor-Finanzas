import { state, IS_SERVER } from '../store/store.js';
import { apiFetch } from '../api/apiClient.js';
import { loadUserData, save } from '../app.js';

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
      save();
    }
  },

  async updateTransaction(editingId, txData, orig) {
    if (IS_SERVER) {
      await apiFetch(`/transactions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          account_id: orig ? orig.account_id : null,
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
        state.transactions[idx] = { ...state.transactions[idx], ...txData };
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
