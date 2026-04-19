import { CAT_COLORS, CAT_ICONS } from './Constants.js';

export class UIManager {
  static formatCurrency(amount) {
    return '$' + amount.toLocaleString('es-AR');
  }

  static formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }

  static formatDateLong(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  static renderStats(stats) {
    document.getElementById('statBalance').textContent  = this.formatCurrency(stats.total.balance);
    document.getElementById('statIncome').textContent   = this.formatCurrency(stats.monthly.income);
    document.getElementById('statExpenses').textContent = this.formatCurrency(stats.monthly.expenses);
    document.getElementById('statSavings').textContent  = this.formatCurrency(stats.monthly.savings);

    const savEl = document.getElementById('savingsChange');
    if (stats.monthly.savings >= 0) {
      savEl.className = 'up';
      savEl.textContent = '↑ ahorro positivo';
    } else {
      savEl.className = 'down';
      savEl.textContent = '↓ déficit este mes';
    }
  }

  static renderTransactionList(transactions, elementId) {
    const el = document.getElementById(elementId);
    if (transactions.length === 0) {
      el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:12px;">Sin transacciones aún.</div>`;
      return;
    }

    el.innerHTML = transactions.map(t => `
      <div class="tx-item">
        <div class="tx-icon" style="background:${CAT_COLORS[t.cat]}22;">
          ${CAT_ICONS[t.cat] || '📦'}
        </div>
        <div class="tx-info">
          <div class="tx-name">${t.desc}</div>
          <div class="tx-cat">${t.cat}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${this.formatCurrency(t.amount)}</div>
          <div class="tx-date">${this.formatDate(t.date)}</div>
        </div>
      </div>
    `).join('');
  }

  static showToast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show' + (isError ? ' error' : '');
    setTimeout(() => { el.classList.remove('show', 'error'); }, 3000);
  }

  static setPage(page, titles) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    // El llamador debe manejar la activación visual del link si es necesario o pasar el elemento.
    
    document.getElementById('pageTitle').textContent = titles[page] || page;

    const views = ['dashboardView', 'txView', 'budgetView', 'cuentasView'];
    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.style.display = 'none';
    });

    const currentViewId = page === 'dashboard' ? 'dashboardView' : (page === 'transacciones' ? 'txView' : (page === 'presupuestos' ? 'budgetView' : (page === 'cuentas' ? 'cuentasView' : 'dashboardView')));
    const currentView = document.getElementById(currentViewId);
    if (currentView) currentView.style.display = '';

    document.getElementById('pageDate').style.display = page === 'dashboard' ? '' : 'none';
  }
}
