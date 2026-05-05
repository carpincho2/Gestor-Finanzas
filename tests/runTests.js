import { Transaction } from '../src/domain/entities/Transaction.js';
import { FinanceCalculator } from '../src/domain/services/FinanceCalculator.js';
import { ReceiptParser } from '../src/domain/services/ReceiptParser.js';

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

  // ===== TESTS EXISTENTES =====

  const tx = new Transaction({ desc: 'Test', amount: 100, type: 'expense', date: '2025-01-01' });
  assert(tx.isValid(), 'Entidad de transacción válida reconocida correctamente');

  const invalidTx = new Transaction({ desc: '', amount: -10, type: 'income', date: '2025-01-01' });
  assert(!invalidTx.isValid(), 'Entidad de transacción inválida detectada correctamente');

  const demoTxs = [
    { type: 'income', amount: 1000, date: '2025-04-01' },
    { type: 'expense', amount: 400, date: '2025-04-05' }
  ];
  const stats = FinanceCalculator.calculateMonthlyStats(demoTxs, 3, 2025);
  assert(stats.monthly.income === 1000, 'Cálculo de ingresos correcto');
  assert(stats.monthly.expenses === 400, 'Cálculo de gastos correcto');
  assert(stats.monthly.savings === 600, 'Cálculo de ahorros correcto');

  // ===== TESTS OCR v2 =====
  console.log('%c\n🧾 Tests de OCR v2 (ReceiptParser mejorado)...', 'color: #ff7e5f; font-weight: bold; font-size: 13px;');

  // --- Parseo de números ---
  assert(ReceiptParser.parseArgentineNumber('15.430,50') === 15430.50, 'ARG: $15.430,50');
  assert(ReceiptParser.parseArgentineNumber('1.234') === 1234, 'ARG: $1.234 (miles)');
  assert(ReceiptParser.parseArgentineNumber('99,90') === 99.90, 'ARG: $99,90 (decimal)');
  assert(ReceiptParser.parseSmartNumber('15,430.50') === 15430.50, 'USA: $15,430.50');
  assert(ReceiptParser.parseSmartNumber('29303.25') === 29303.25, 'INT: 29303.25');
  assert(ReceiptParser.parseSmartNumber('3000') === 3000, 'Simple: 3000');

  // --- Extracción de montos ---
  assert(ReceiptParser.extractAmount('TOTAL: $15.430,50') === 15430.50, 'Monto: TOTAL ARG');
  assert(ReceiptParser.extractAmount('Total    29303.25') === 29303.25, 'Monto: Total USA');
  assert(ReceiptParser.extractAmount('Subtotal 26700.00\nTotal 29303.25') === 29303.25, 'Monto: último TOTAL');
  assert(ReceiptParser.extractAmount('Pan $150\nLeche $230\nTOTAL $380') === 380, 'Monto: items + total');

  // --- Extracción de fechas ---
  assert(ReceiptParser.extractDate('Fecha: 28/04/2025') === '2025-04-28', 'Fecha: DD/MM/YYYY');
  assert(ReceiptParser.extractDate('15-03-2025 COTO') === '2025-03-15', 'Fecha: DD-MM-YYYY');
  assert(ReceiptParser.extractDate('5/1/25') === '2025-01-05', 'Fecha: D/M/YY');

  // --- Tickets viejos (rango ampliado) ---
  assert(ReceiptParser.extractDate('12/01/2009') !== null, 'Fecha vieja: 2009 se parsea');

  // --- Detección de categoría con word boundary ---
  assert(ReceiptParser.detectCategory('coto cicsa\nsuc 42') === 'Alimentación', 'Cat: COTO');
  assert(ReceiptParser.detectCategory('ypf autopista') === 'Transporte', 'Cat: YPF');
  assert(ReceiptParser.detectCategory('farmacity palermo') === 'Salud', 'Cat: Farmacity');
  assert(ReceiptParser.detectCategory('tiffany and co') === 'Ropa', 'Cat: Tiffany');
  assert(ReceiptParser.detectCategory('random desconocido') === 'Otros', 'Cat: desconocido');

  // --- Ticket Tiffany (real) ---
  const tiffanyText = 'Tiffany & Co.\nCENTURY CITY\n(310) 557-0840\n12/01/2009\nPLAT EMERALD CUT DIAMOND\n26700.00\nSubtotal  26700.00\n9.750% 2603.25\nTotal  29303.25\nVISA  3000.00';
  const tiffany = ReceiptParser.parse(tiffanyText);
  assert(tiffany.amount === 29303.25, 'Tiffany: monto $29303.25');
  assert(tiffany.desc.toLowerCase().includes('tiffany'), 'Tiffany: comercio detectado');
  assert(tiffany.date === '2009-01-12', 'Tiffany: fecha 2009');

  // --- Ticket argentino típico ---
  const cotoText = 'COTO CICSA\nSuc 42 - Caballito\n28/04/2025\nPan $150,00\nLeche $320,50\nTOTAL $470,50';
  const coto = ReceiptParser.parse(cotoText);
  assert(coto.amount === 470.50, 'COTO: monto $470,50');
  assert(coto.cat === 'Alimentación', 'COTO: categoría Alimentación');
  assert(coto.date === '2025-04-28', 'COTO: fecha');

  // --- Input vacío/null ---
  assert(ReceiptParser.parse('').amount === null, 'Input vacío: null');
  assert(ReceiptParser.parse(null).cat === 'Otros', 'Input null: no explota');

  console.log(`%c\nResumen: ${passed} pasados, ${failed} fallidos.`, `color: ${failed > 0 ? '#ff4a6b' : '#00e5a0'}; font-weight: bold;`);
}
