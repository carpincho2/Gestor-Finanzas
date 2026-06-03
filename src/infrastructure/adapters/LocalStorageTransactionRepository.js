import { Storage } from '../../shared/Storage.js';
import { Transaction } from '../../domain/entities/Transaction.js';

export class LocalStorageTransactionRepository {
  constructor() {
    this.key = 'flujo_tx';
  }

  save(transactions) {
    Storage.save(this.key, transactions);
  }

  findAll() {
    const data = Storage.get(this.key, '[]');
    return data.map(tx => new Transaction(tx));
  }

  add(transaction) {
    const all = this.findAll();
    all.unshift(transaction);
    this.save(all);
    return transaction;
  }
}
