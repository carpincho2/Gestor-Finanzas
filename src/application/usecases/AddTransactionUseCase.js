import { Transaction } from '../../domain/entities/Transaction.js';

export class AddTransactionUseCase {
  constructor(transactionRepository) {
    this.repository = transactionRepository;
  }

  execute(txData) {
    const transaction = new Transaction(txData);
    
    if (!transaction.isValid()) {
      throw new Error('Datos de transacción inválidos');
    }

    return this.repository.add(transaction);
  }
}
