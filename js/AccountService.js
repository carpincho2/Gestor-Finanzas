import { Storage } from './Storage.js';

export class AccountService {
  constructor() {
    this.accounts = Storage.get('flujo_accounts', '[]');
    if (this.accounts.length === 0) {
      this._seedDemoData();
    }
  }

  _seedDemoData() {
    this.accounts = [
      { id:1, name:'Cuenta Corriente', type:'banco',    bank:'Galicia',      balance:85000,  currency:'ARS', limit:0,      notes:'Cuenta principal' },
      { id:2, name:'Caja de Ahorro',   type:'ahorro',   bank:'Galicia',      balance:42000,  currency:'ARS', limit:0,      notes:'Fondo de emergencia' },
      { id:3, name:'Efectivo',         type:'efectivo', bank:'',             balance:12500,  currency:'ARS', limit:0,      notes:'' },
      { id:4, name:'Mercado Pago',     type:'digital',  bank:'Mercado Pago', balance:8300,   currency:'ARS', limit:0,      notes:'Para compras online' },
      { id:5, name:'Visa Naranja X',   type:'tarjeta',  bank:'Naranja X',    balance:-15200, currency:'ARS', limit:100000, notes:'Vence el 10 de cada mes' },
    ];
    this.save();
  }

  save() {
    Storage.save('flujo_accounts', this.accounts);
  }

  getAll() {
    return this.accounts;
  }

  getById(id) {
    return this.accounts.find(a => a.id === id);
  }

  add(acc) {
    acc.id = Date.now();
    this.accounts.push(acc);
    this.save();
    return acc;
  }

  update(id, updatedAcc) {
    const idx = this.accounts.findIndex(a => a.id === id);
    if (idx > -1) {
      this.accounts[idx] = { ...this.accounts[idx], ...updatedAcc };
      this.save();
    }
  }

  delete(id) {
    this.accounts = this.accounts.filter(a => a.id !== id);
    this.save();
  }

  updateBalance(id, amount) {
    const acc = this.getById(id);
    if (acc) {
      acc.balance += amount;
      this.save();
    }
  }

  transfer(fromId, toId, amount) {
    const fromAcc = this.getById(fromId);
    const toAcc = this.getById(toId);
    if (fromAcc && toAcc) {
      fromAcc.balance -= amount;
      toAcc.balance += amount;
      this.save();
      return true;
    }
    return false;
  }
}
