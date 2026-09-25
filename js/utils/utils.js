let toastTimer;

export function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show', 'error'); }, 3000);
}

export function formatCurrency(amount) {
  return amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function getCurrencySymbol(curr) {
  if (curr === 'USD') return 'US$';
  if (curr === 'EUR') return '€';
  return '$';
}

export function formatMoney(amount, curr = 'ARS') {
  const sym = getCurrencySymbol(curr);
  const formatted = Math.abs(amount || 0).toLocaleString('es-AR', {
    minimumFractionDigits: curr === 'ARS' ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `${(amount || 0) < 0 ? '-' : ''}${sym} ${formatted}`;
}

export function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDate(str) {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return str;
}

export function formatDateLong(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Inicialización de shortcuts globales
export function initGlobalShortcuts(callbacks) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
        // Chat AI
        if (active.id === 'aiInput') {
          const btn = document.getElementById('aiSendBtn');
          if (btn && !btn.disabled && callbacks.aiSendMessage) callbacks.aiSendMessage();
          return;
        }

        // Modals
        const overlays = [
          { id: 'goalModalOverlay', fn: callbacks.saveGoal },
          { id: 'contribModalOverlay', fn: callbacks.saveContrib },
          { id: 'accModalOverlay', fn: callbacks.saveAccount },
          { id: 'budgetModalOverlay', fn: callbacks.saveBudget },
          { id: 'editModalOverlay', fn: callbacks.saveEdit },
          { id: 'modalOverlay', fn: callbacks.addFromModal },
          { id: 'scResultOverlay', fn: () => { 
              const b = document.getElementById('scSaveTicketBtn'); 
              if (b) b.click(); else if (callbacks.scSaveTicket) callbacks.scSaveTicket(); 
            } 
          }
        ];

        for (const ov of overlays) {
          const el = document.getElementById(ov.id);
          if (el && el.style.display === 'flex') {
            e.preventDefault();
            if (ov.fn) ov.fn();
            return;
          }
        }
      }
    }
  });
}

window.getCurrencySymbol = getCurrencySymbol;
window.formatMoney = formatMoney;
window.formatCurrency = formatCurrency;
window.escHtml = escHtml;

