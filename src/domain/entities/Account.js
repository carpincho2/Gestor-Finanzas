export class Account {
  constructor({ id, name, type, bank, balance, currency, limit, notes }) {
    this.id = id || Date.now();
    this.name = name;
    this.type = type;
    this.bank = bank || '';
    this.balance = Number(balance);
    this.currency = currency || 'ARS';
    this.limit = Number(limit || 0);
    this.notes = notes || '';
  }

  updateBalance(amount) {
    this.balance += amount;
  }

  isValid() {
    return this.name && this.name.trim().length > 0 && !isNaN(this.balance);
  }
}
