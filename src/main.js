import { LocalStorageTransactionRepository } from './infrastructure/adapters/LocalStorageTransactionRepository.js';
import { LocalStorageAccountRepository } from './infrastructure/adapters/LocalStorageAccountRepository.js';
import { LocalStorageBudgetRepository } from './infrastructure/adapters/LocalStorageBudgetRepository.js';
import { ChartService } from './shared/ChartService.js';

// --- Application / Use Cases ---
import { AddTransactionUseCase } from './application/usecases/AddTransactionUseCase.js';
import { GetFinancialSummaryUseCase } from './application/usecases/GetFinancialSummaryUseCase.js';

// --- UI / Entry Adapters ---
import { WebUIAdapter } from './ui/WebUIAdapter.js';
import { UIManager } from './shared/UIManager.js';
import { ErrorHandler } from './shared/ErrorHandler.js';

class App {
  constructor() {
    // 1. Iniciar Infraestructura
    this.txRepo = new LocalStorageTransactionRepository();
    this.accRepo = new LocalStorageAccountRepository();
    this.budgetRepo = new LocalStorageBudgetRepository();
    this.chartService = new ChartService('mainChart');

    // 2. Iniciar Casos de Uso (Inyección de Dependencias)
    this.useCases = {
      addTransaction: new AddTransactionUseCase(this.txRepo),
      getSummary: new GetFinancialSummaryUseCase(this.txRepo, this.accRepo, this.budgetRepo)
    };

    // 3. Estado de la UI
    this.currentPage = 'dashboard';
    this.currentType = 'expense';
    this.chartPeriod = 'semana';

    this.init();
  }

  init() {
    ErrorHandler.runSafe(() => {
      this.renderAll();
      
      // Inicializar Adaptador de UI (Puertos de entrada)
      this.uiAdapter = new WebUIAdapter(this, this.useCases);
      
      const now = new Date().toISOString().split('T')[0];
      const mDate = document.getElementById('mDate');
      if (mDate) mDate.value = now;
    }, 'Inicialización');
  }

  renderAll() {
    ErrorHandler.runSafe(() => {
      const now = new Date();
      const summary = this.useCases.getSummary.execute(now.getMonth(), now.getFullYear());

      UIManager.renderStats(summary.stats);
      UIManager.renderTransactionList(summary.recentTransactions, 'txList');
      UIManager.renderBudgetWidget(document.getElementById('budgetList'), summary.budgets, summary.spentByCat);
      
      this.renderChart();
    }, 'Renderizado');
  }

  renderChart() {
    // Aquí podrías crear un GetChartDataUseCase si quisieras ser estricto
    this.chartService.render(this.getDummyChartData());
  }

  getDummyChartData() {
    return {
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
      datasets: [
        { label: 'Ingresos', data: [1200, 1900, 300, 500, 2000, 3000, 1500], borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.1)' },
        { label: 'Gastos', data: [800, 1500, 1200, 400, 1000, 2100, 900], borderColor: '#ff4a6b', backgroundColor: 'rgba(255,74,107,0.1)' }
      ]
    };
  }

  setPage(el, page) {
    const titles = { dashboard:'Dashboard', transacciones:'Transacciones', presupuestos:'Presupuestos', cuentas:'Cuentas' };
    UIManager.setPage(page, titles);
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    if (el) el.classList.add('active');
    if (page === 'dashboard') this.renderAll();
  }

  setChartPeriod(el, period) {
    this.chartPeriod = period;
    document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active'));
    el.classList.add('active');
    this.renderChart();
  }

  setType(type) {
    this.currentType = type;
    document.getElementById('typeExpBtn').classList.toggle('active-expense', type === 'expense');
    document.getElementById('typeIncBtn').classList.toggle('active-income', type === 'income');
  }

  openModal(id) { document.getElementById(id).classList.add('open'); }
  closeModal(id) { document.getElementById(id).classList.remove('open'); }

  openIaModal() {
    const modal = document.getElementById('iaModalOverlay');
    document.getElementById('iaMockupImg').src = 'ai_insights.png';
    modal.classList.add('open');
  }
}

// Iniciar aplicación
new App();
