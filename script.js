import { TransactionService } from './js/TransactionService.js';
import { AccountService } from './js/AccountService.js';
import { BudgetService } from './js/BudgetService.js';
import { UIManager } from './js/UIManager.js';
import { ChartService } from './js/ChartService.js';
import { BUDGETS, CAT_COLORS, CAT_ICONS } from './js/Constants.js';

class App {
  constructor() {
    this.txService = new TransactionService();
    this.accService = new AccountService();
    this.budgetService = new BudgetService();
    this.chartService = new ChartService('mainChart');
    
    this.currentPage = 'dashboard';
    this.currentType = 'expense';
    this.chartPeriod = 'semana';

    this.init();
  }

  init() {
    UIManager.renderStats(this.txService.getStats(new Date().getMonth(), new Date().getFullYear()));
    this.renderAll();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Aquí se podrían añadir listeners dinámicos si se desea desacoplar totalmente del HTML
  }

  renderAll() {
    this.renderStats();
    this.renderTransactions();
    this.renderChart();
    this.renderBudgets();
  }

  renderStats() {
    const stats = this.txService.getStats(new Date().getMonth(), new Date().getFullYear());
    UIManager.renderStats(stats);
  }

  renderTransactions() {
    const list = [...this.txService.getAll()].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
    UIManager.renderTransactionList(list, 'txList');
    document.getElementById('txCount').textContent = this.txService.getAll().length + ' registros';
  }

  renderChart() {
    const data = this.getChartData();
    this.chartService.render(data);
  }

  renderBudgets() {
    const now = new Date();
    const spentByCat = this.budgetService.calculateSpending(this.txService.getAll(), now.getMonth(), now.getFullYear());
    const budgets = this.budgetService.getAll();
    
    const el = document.getElementById('budgetList');
    if (!budgets || budgets.length === 0) {
      el.innerHTML = `<div style="padding:16px 0;text-align:center;font-size:11px;font-family:var(--font-mono);color:var(--muted);">Sin presupuestos creados.</div>`;
      return;
    }

    el.innerHTML = budgets.slice(0,5).map(b => {
      const spent = spentByCat[b.cat] || 0;
      const pct = Math.min((spent / b.limit) * 100, 100);
      const over = spent > b.limit;

      return `
        <div class="budget-item">
          <div class="budget-head">
            <span class="budget-name">${b.icon || '📦'} ${b.name}</span>
            <span class="budget-nums">$${spent.toLocaleString('es-AR')} / $${b.limit.toLocaleString('es-AR')}</span>
          </div>
          <div class="budget-bar-bg">
            <div class="budget-bar-fill" style="width:${pct}%;background:${over ? 'var(--danger)' : b.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  getChartData() {
    const now = new Date();
    const transactions = this.txService.getAll();
    const labels = [], incomeData = [], expenseData = [];

    if (this.chartPeriod === 'semana') {
      for (let i=6; i>=0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate()-i);
        const str = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('es-AR',{weekday:'short'}));
        const day = transactions.filter(t=>t.date===str);
        incomeData.push(day.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
        expenseData.push(day.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
      }
    } else if (this.chartPeriod === 'mes') {
      for (let i=29; i>=0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate()-i);
        const str = d.toISOString().split('T')[0];
        labels.push(i%5===0 ? d.getDate()+'/' + (d.getMonth()+1) : '');
        const day = transactions.filter(t=>t.date===str);
        incomeData.push(day.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
        expenseData.push(day.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
      }
    } else {
      for (let i=11; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        labels.push(d.toLocaleDateString('es-AR',{month:'short'}));
        const m = d.getMonth(), y = d.getFullYear();
        const mo = transactions.filter(t => { const td=new Date(t.date); return td.getMonth()===m && td.getFullYear()===y; });
        incomeData.push(mo.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
        expenseData.push(mo.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
      }
    }

    return {
      labels,
      datasets: [
        { label: 'Ingresos', data: incomeData, backgroundColor: 'rgba(0,229,160,.25)', borderColor: '#00e5a0', borderWidth: 2, borderRadius: 6 },
        { label: 'Gastos', data: expenseData, backgroundColor: 'rgba(255,74,107,.2)', borderColor: '#ff4a6b', borderWidth: 2, borderRadius: 6 }
      ]
    };
  }

  // Métodos que serán llamados desde el HTML (Expuestos vía window)
  setPage(el, page) {
    const titles = {
      dashboard:'Dashboard', transacciones:'Transacciones', presupuestos:'Presupuestos',
      cuentas:'Cuentas', reportes:'Reportes', objetivos:'Objetivos'
    };
    UIManager.setPage(page, titles);
    this.currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    if (el) el.classList.add('active');

    if (page === 'dashboard') this.renderAll();
    // Otros casos según sea necesario...
  }

  openIaModal() {
    const modal = document.getElementById('iaModalOverlay');
    const img = document.getElementById('iaMockupImg');
    img.src = 'ai_insights.png';
    modal.classList.add('open');
  }

  closeIaModal() {
    document.getElementById('iaModalOverlay').classList.remove('open');
  }
}

// Inicialización de la aplicación
const app = new App();

// Exponer funciones globales para mantener compatibilidad con onclick del HTML
window.setPage = (el, page) => app.setPage(el, page);
window.openIaModal = () => app.openIaModal();
window.closeIaModal = () => app.closeIaModal();
window.showToast = (msg, err) => UIManager.showToast(msg, err);
window.openModal = () => document.getElementById('modalOverlay').classList.add('open');
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('open');

// Exponer App para debugging si es necesario
window.flujoApp = app;
