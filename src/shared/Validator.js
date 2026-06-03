export class Validator {
  static validateTransaction(tx) {
    const errors = [];
    if (!tx.desc || typeof tx.desc !== 'string' || tx.desc.trim().length === 0) errors.push('Descripción requerida');
    if (isNaN(tx.amount) || tx.amount <= 0) errors.push('Monto debe ser un número positivo');
    if (!['income', 'expense'].includes(tx.type)) errors.push('Tipo de transacción inválido');
    if (!tx.date || isNaN(Date.parse(tx.date))) errors.push('Fecha inválida');
    
    if (errors.length > 0) throw new Error(errors.join(', '));
    return true;
  }

  static validateBudget(budget) {
    if (!budget.name || budget.name.trim().length === 0) throw new Error('Nombre de presupuesto requerido');
    if (isNaN(budget.limit) || budget.limit <= 0) throw new Error('Límite debe ser positivo');
    return true;
  }

  static validateAccount(acc) {
    if (!acc.name || acc.name.trim().length === 0) throw new Error('Nombre de cuenta requerido');
    if (isNaN(acc.balance)) throw new Error('Saldo inicial inválido');
    return true;
  }
}
