export class FinanceCalculator {
  static calculateMonthlyStats(transactions, month, year) {
    const thisMonth = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const allIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const allExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return {
      monthly: { income, expenses, savings: income - expenses },
      total: { balance: allIncome - allExpenses }
    };
  }

  static calculateBudgetSpending(transactions, month, year) {
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
