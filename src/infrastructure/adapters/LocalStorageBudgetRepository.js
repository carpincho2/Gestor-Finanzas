import { Storage } from '../../shared/Storage.js';
import { Budget } from '../../domain/entities/Budget.js';

export class LocalStorageBudgetRepository {
  constructor() {
    this.key = 'flujo_budgets';
  }

  save(budgets) {
    Storage.save(this.key, budgets);
  }

  findAll() {
    const data = Storage.get(this.key, '[]');
    return data.map(b => new Budget(b));
  }
}
