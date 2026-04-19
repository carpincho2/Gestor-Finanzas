import { UIManager } from '../shared/UIManager.js';
import { ErrorHandler } from '../shared/ErrorHandler.js';

export class WebUIAdapter {
  constructor(app, useCases) {
    this.app = app;
    this.useCases = useCases;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Nav
    document.getElementById('mainNav').addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item) this.app.setPage(item, item.dataset.page);
    });

    // Modals
    document.getElementById('openModalBtn').addEventListener('click', () => this.app.openModal('modalOverlay'));
    document.getElementById('openIaModalBtn').addEventListener('click', () => this.app.openIaModal());
    document.getElementById('closeIaModalBtn').addEventListener('click', () => this.app.closeModal('iaModalOverlay'));

    // Quick Add
    document.getElementById('quickAddSubmitBtn').addEventListener('click', () => this.handleAddTransaction());

    // Chart Tabs
    document.getElementById('chartTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.chart-tab');
      if (tab) this.app.setChartPeriod(tab, tab.dataset.period);
    });

    // Modal Overlays
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.app.closeModal(overlay.id);
      });
    });
  }

  handleAddTransaction() {
    ErrorHandler.runSafe(() => {
      const txData = {
        type: this.app.currentType,
        desc: document.getElementById('qDesc').value.trim(),
        amount: parseFloat(document.getElementById('qAmount').value),
        cat: document.getElementById('qCat').value,
        date: new Date().toISOString().split('T')[0]
      };

      this.useCases.addTransaction.execute(txData);
      
      // Feedback & Refresh
      document.getElementById('qDesc').value = '';
      document.getElementById('qAmount').value = '';
      this.app.renderAll();
      UIManager.showToast('✅ Transacción registrada (Full Hexagonal)');
    }, 'Registro');
  }
}
