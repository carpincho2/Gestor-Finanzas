import { state, IS_SERVER, userKey } from '../store/store.js';
import { apiFetch } from '../api/apiClient.js';

export const accountService = {
  saveAccounts() {
    if (!IS_SERVER) {
      localStorage.setItem(userKey('flujo_accounts'), JSON.stringify(state.accounts));
    }
  },

  initAccounts() {
    if (state.accounts.length === 0) {
      this.saveAccounts();
    }
  },

  async saveMpToken(accountId, tokenVal) {
    const res = await apiFetch(`/accounts/${accountId}/token`, {
      method: 'PUT',
      body: JSON.stringify({ mp_token: tokenVal })
    });
    if (res && res.ok) {
      const acc = state.accounts.find(x => x.id === accountId);
      if (acc) {
        acc.mp_token = tokenVal;
      }
    }
    return res;
  },

  async syncWallet(accountId) {
    const res = await apiFetch(`/accounts/${accountId}/sync`, {
      method: 'POST'
    });
    if (res && res.ok) {
      const acc = state.accounts.find(x => x.id === accountId);
      if (acc && res.balance !== undefined) {
        acc.balance = res.balance;
      }
    }
    return res;
  },

  async updateAccountBalance(accountId, newBalance) {
    const acc = state.accounts.find(a => a.id === parseInt(accountId));
    if (!acc) throw new Error("Account not found");
    
    acc.balance = newBalance;
    if (IS_SERVER) {
      return await apiFetch(`/accounts/${acc.id}`, {
        method: 'PUT',
        body: JSON.stringify(acc)
      });
    } else {
      this.saveAccounts();
      return { ok: true };
    }
  },

  async getWalletStatus(accountId) {
    return await apiFetch(`/wallets/status/${accountId}`);
  },

  async disconnectWallet(accountId, provider) {
    const res = await apiFetch(`/wallets/${provider}/disconnect/${accountId}`, {
      method: 'POST'
    });
    if (res && res.ok) {
      const acc = state.accounts.find(x => x.id === accountId);
      if (acc) acc.mp_token = null;
    }
    return res;
  },

  async cleanupDuplicates() {
    return await apiFetch("/transactions/cleanup-duplicates", { method: "POST" });
  },

  async getSuggestedExchangeRate(currFrom, currTo) {
    if ((currFrom === 'USD' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'USD')) {
      const res = await fetch('https://dolarapi.com/v1/dolares/blue');
      if (!res.ok) throw new Error('API no disponible');
      const data = await res.json();
      if (currFrom === 'USD') return { rate: data.compra || data.venta || 1350, label: `Dólar Blue Compra ($${data.compra || data.venta || 1350})` };
      else return { rate: data.venta || data.compra || 1350, label: `Dólar Blue Venta ($${data.venta || data.compra || 1350})` };
    } else if ((currFrom === 'EUR' && currTo === 'ARS') || (currFrom === 'ARS' && currTo === 'EUR')) {
      const res = await fetch('https://dolarapi.com/v1/cotizaciones/eur');
      if (!res.ok) throw new Error('API no disponible');
      const data = await res.json();
      const rate = currFrom === 'EUR' ? (data.compra || data.venta) : (data.venta || data.compra);
      return { rate, label: `Euro Oficial ($${rate})` };
    } else if ((currFrom === 'USD' && currTo === 'EUR') || (currFrom === 'EUR' && currTo === 'USD')) {
      const rate = currFrom === 'USD' ? 0.92 : 1.08;
      return { rate, label: `Referencia (${rate})` };
    }
    return { rate: 0, label: '' };
  },

  async doTransfer(fromId, toId, amountFrom, amountTo, descExpense, descIncome) {
    const fromAcc = state.accounts.find(x => x.id === fromId);
    const toAcc = state.accounts.find(x => x.id === toId);
    if (!fromAcc || !toAcc) throw new Error("Account not found");

    if (IS_SERVER) {
      const dateStr = new Date().toISOString().split('T')[0];
      const linkId = Date.now();

      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: fromId,
          type: 'expense',
          desc: descExpense,
          amount: amountFrom,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });

      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: toId,
          type: 'income',
          desc: descIncome,
          amount: amountTo,
          cat: 'Otros',
          date: dateStr,
          transfer_id: linkId
        })
      });
      return { ok: true };
    } else {
      fromAcc.balance -= amountFrom;
      toAcc.balance += amountTo;
      this.saveAccounts();

      const dateStr = new Date().toISOString().split('T')[0];
      const linkId = Date.now();
      state.transactions.unshift({ id: linkId, type: 'expense', desc: descExpense, amount: amountFrom, cat: 'Otros', date: dateStr, accountId: fromId, transferId: linkId });
      state.transactions.unshift({ id: linkId + 1, type: 'income', desc: descIncome, amount: amountTo, cat: 'Otros', date: dateStr, accountId: toId, transferId: linkId });
      // In a pure service layer we'd probably have transactionService, but this suffices for separating logic from DOM.
      
      // we need to call global window.save() or equivalent for local mode?
      // but the original code did `save();` so we might need to expose it or trust the caller to do it.
      // Let's rely on the caller to call save() in local mode.
      return { ok: true, local: true };
    }
  },

  async saveAccount(payload, editingAccountId) {
    if (IS_SERVER) {
      if (editingAccountId) {
        const res = await apiFetch(`/accounts/${editingAccountId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          const idx = state.accounts.findIndex(x => x.id === editingAccountId);
          if (idx > -1) {
            state.accounts[idx] = res.account;
          }
        }
        return res;
      } else {
        const res = await apiFetch('/accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          state.accounts.push(res.account);
        }
        return res;
      }
    } else {
      if (editingAccountId) {
        const idx = state.accounts.findIndex(x => x.id === editingAccountId);
        if (idx > -1) {
          state.accounts[idx] = { ...state.accounts[idx], ...payload };
          this.saveAccounts();
        }
        return { ok: true, account: state.accounts[idx] };
      } else {
        const newA = { id: Date.now(), ...payload };
        state.accounts.push(newA);
        this.saveAccounts();
        return { ok: true, account: newA };
      }
    }
  },

  async deleteAccount(id) {
    if (IS_SERVER) {
      return await apiFetch(`/accounts/${id}`, { method: 'DELETE' });
    } else {
      state.accounts = state.accounts.filter(x => x.id !== id);
      this.saveAccounts();
      return { ok: true };
    }
  }
};
