import { Transaction } from '../src/domain/entities/Transaction.js';
import { FinanceCalculator } from '../src/domain/services/FinanceCalculator.js';

export function runTests() {
  console.log('%c🚀 Iniciando Tests Hexagonales...', 'color: #00e5a0; font-weight: bold; font-size: 14px;');
  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`%c✅ PASSED: ${message}`, 'color: #34d399');
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  };

  // Test 1: Dominio puro (Transaction Entity)
  const tx = new Transaction({ desc: 'Test', amount: 100, type: 'expense', date: '2025-01-01' });
  assert(tx.isValid(), 'Entidad de transacción válida reconocida correctamente');

  const invalidTx = new Transaction({ desc: '', amount: -10, type: 'income', date: '2025-01-01' });
  assert(!invalidTx.isValid(), 'Entidad de transacción inválida detectada correctamente');

  // Test 2: Dominio puro (Finance Calculator)
  const demoTxs = [
    { type: 'income', amount: 1000, date: '2025-04-01' },
    { type: 'expense', amount: 400, date: '2025-04-05' }
  ];
  const stats = FinanceCalculator.calculateMonthlyStats(demoTxs, 3, 2025);
  assert(stats.monthly.income === 1000, 'Cálculo de ingresos correcto');
  assert(stats.monthly.expenses === 400, 'Cálculo de gastos correcto');
  assert(stats.monthly.savings === 600, 'Cálculo de ahorros correcto');

  console.log(`%c\nResumen: ${passed} pasados, ${failed} fallidos.`, `color: ${failed > 0 ? '#ff4a6b' : '#00e5a0'}; font-weight: bold;`);
}
