export class Transaction {
  constructor({ id, type, desc, amount, cat, date }) {
    this.id = id || Date.now();
    this.type = type; // 'income' | 'expense'
    this.desc = desc;
    this.amount = Number(amount);
    this.cat = cat;
    this.date = date;
  }

  isValid() {
    return (
      this.desc && 
      this.desc.trim().length > 0 && 
      !isNaN(this.amount) && 
      this.amount > 0 &&
      ['income', 'expense'].includes(this.type)
    );
  }
}
