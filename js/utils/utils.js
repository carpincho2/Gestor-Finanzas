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
