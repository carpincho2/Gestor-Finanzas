import { Storage } from './Storage.js';

export class BudgetService {
  constructor() {
    this.budgets = Storage.get('flujo_budgets', '[]');
    if (this.budgets.length === 0) {
      this._seedDemoData();
    }
  }

  _seedDemoData() {
    this.budgets = [
      { id:1, cat:'Alimentación', name:'Alimentación', icon:'🍔', limit:20000, color:'#00e5a0', notes:'Súper, delivery y cafés' },
      { id:2, cat:'Transporte',   name:'Transporte',   icon:'🚗', limit:8000,  color:'#5b8cff', notes:'SUBE, taxi, nafta' },
      { id:3, cat:'Entretenimiento', name:'Entretenimiento', icon:'🎬', limit:5000, color:'#ffb84a', notes:'Streaming, salidas' },
      { id:4, cat:'Hogar',        name:'Hogar',        icon:'🏠', limit:60000, color:'#ff6b4a', notes:'Alquiler y servicios' },
      { id:5, cat:'Salud',        name:'Salud',        icon:'💊', limit:6000,  color:'#a78bfa', notes:'Farmacia y médicos' },
    ];
    this.save();
  }

  save() {
    Storage.save('flujo_budgets', this.budgets);
  }

  getAll() {
    return this.budgets;
  }

  getById(id) {
    return this.budgets.find(b => b.id === id);
  }

  add(budget) {
    budget.id = Date.now();
    this.budgets.push(budget);
    this.save();
    return budget;
  }

  update(id, updatedBudget) {
    const idx = this.budgets.findIndex(b => b.id === id);
    if (idx > -1) {
      this.budgets[idx] = { ...this.budgets[idx], ...updatedBudget };
      this.save();
    }
  }

  delete(id) {
    this.budgets = this.budgets.filter(b => b.id !== id);
    this.save();
  }

  calculateSpending(transactions, month, year) {
    const monthTx = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const spentByCat = {};
    monthTx.forEach(t => {
      spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
    });

    return spentByCat;
  }
}
