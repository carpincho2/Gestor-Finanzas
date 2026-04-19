import { Storage } from './Storage.js';

export class TransactionService {
  constructor() {
    this.transactions = Storage.get('flujo_tx', '[]');
    if (this.transactions.length === 0) {
      this._seedDemoData();
    }
  }

  _seedDemoData() {
    const demo = [
      { id:1, type:'income',  desc:'Sueldo',        amount:150000, cat:'Sueldo',          date:'2025-04-01' },
      { id:2, type:'expense', desc:'Alquiler',       amount:55000,  cat:'Hogar',           date:'2025-04-03' },
      { id:3, type:'expense', desc:'Supermercado',   amount:12300,  cat:'Alimentación',    date:'2025-04-05' },
      { id:4, type:'expense', desc:'UberEats',       amount:4200,   cat:'Alimentación',    date:'2025-04-07' },
      { id:5, type:'income',  desc:'Freelance web',  amount:35000,  cat:'Freelance',       date:'2025-04-08' },
      { id:6, type:'expense', desc:'SUBE + taxi',    amount:3100,   cat:'Transporte',      date:'2025-04-09' },
      { id:7, type:'expense', desc:'Netflix + Spotify',amount:3200, cat:'Entretenimiento', date:'2025-04-10' },
      { id:8, type:'expense', desc:'Farmacia',       amount:2800,   cat:'Salud',           date:'2025-04-11' },
    ];
    this.transactions = demo;
    this.save();
  }

  save() {
    Storage.save('flujo_tx', this.transactions);
  }

  getAll() {
    return this.transactions;
  }

  add(tx) {
    tx.id = Date.now();
    this.transactions.unshift(tx);
    this.save();
    return tx;
  }

  update(id, updatedTx) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx > -1) {
      this.transactions[idx] = { ...this.transactions[idx], ...updatedTx };
      this.save();
    }
  }

  delete(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.save();
  }

  getFiltered(filters, sort) {
    let list = [...this.transactions];

    if (filters.type !== 'all') list = list.filter(t => t.type === filters.type);
    if (filters.cat !== 'all') list = list.filter(t => t.cat === filters.cat);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t => t.desc.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q));
    }
    if (filters.dateFrom) list = list.filter(t => t.date >= filters.dateFrom);
    if (filters.dateTo)   list = list.filter(t => t.date <= filters.dateTo);

    list.sort((a,b) => {
      let va = a[sort.field], vb = b[sort.field];
      if (sort.field === 'amount') { va = +va; vb = +vb; }
      if (va < vb) return sort.dir==='asc' ? -1 : 1;
      if (va > vb) return sort.dir==='asc' ? 1  : -1;
      return 0;
    });

    return list;
  }

  getStats(month, year) {
    const thisMonth = this.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const income   = thisMonth.filter(t => t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expenses = thisMonth.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount,0);
    
    const allIncome   = this.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const allExpenses = this.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

    return {
      monthly: { income, expenses, savings: income - expenses },
      total: { balance: allIncome - allExpenses }
    };
  }
}
