import { FinanceCalculator } from '../../domain/services/FinanceCalculator.js';

export class GetFinancialSummaryUseCase {
  constructor(transactionRepo, accountRepo, budgetRepo) {
    this.txRepo = transactionRepo;
    this.accRepo = accountRepo;
    this.budgetRepo = budgetRepo;
  }

  execute(month, year) {
    const transactions = this.txRepo.findAll();
    const stats = FinanceCalculator.calculateMonthlyStats(transactions, month, year);
    const spentByCat = FinanceCalculator.calculateBudgetSpending(transactions, month, year);
    const budgets = this.budgetRepo.findAll();
    const accounts = this.accRepo.findAll();

    return {
      stats,
      spentByCat,
      budgets,
      accounts,
      recentTransactions: transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
    };
  }
}
