import { Storage } from '../../shared/Storage.js';
import { Account } from '../../domain/entities/Account.js';

export class LocalStorageAccountRepository {
  constructor() {
    this.key = 'flujo_accounts';
  }

  save(accounts) {
    Storage.save(this.key, accounts);
  }

  findAll() {
    const data = Storage.get(this.key, '[]');
    return data.map(acc => new Account(acc));
  }

  findById(id) {
    return this.findAll().find(a => a.id === id);
  }

  update(account) {
    const all = this.findAll();
    const idx = all.findIndex(a => a.id === account.id);
    if (idx > -1) {
      all[idx] = account;
      this.save(all);
    }
  }
}
