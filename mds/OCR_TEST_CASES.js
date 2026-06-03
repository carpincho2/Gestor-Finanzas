/* =====================================================
   CASOS DE PRUEBA — Suite de Testing OCR
   ===================================================== 
   Contiene casos de prueba reales con tickets argentinos
   en diferentes condiciones de captura.
===================================================== */

const OCR_TEST_CASES = [
  {
    id: 'test_01_perfecto',
    name: '✅ Ticket perfecto - bien iluminado, centrado',
    description: 'Condiciones ideales de captura',
    expectedFields: {
      nombre_local: 'Carrefour',
      total: 1850.50,
      fecha: '2025-05-28',
      forma_pago: 'Tarjeta Visa',
      categoria: 'Alimentación'
    },
    expectedConfidence: '> 95%',
    rawOCROutput: `
CARREFOUR EXPRESS
AV. CORRIENTES 1234
Tel: 4555-5555

TICKET 00001
FECHA: 28/05/2025 HORA: 14:35

PRODUCTOS:
Pan integral 250g        125.00
Leche descremada 1L      245.00
Queso fresco           450.00
Verduras varias        580.00
Frutas                 305.00

SUBTOTAL:               1705.00
IVA (21%):              357.50
─────────────────────────────
TOTAL:                 1850.50
─────────────────────────────

PAGO: TARJETA VISA
TERMINAL: POS001
APROBADO

Gracias por su compra
    `,
    notes: 'Caso base - sin errores de OCR esperados'
  },

  {
    id: 'test_02_rotado_15',
    name: '⚠️ Ticket rotado 15° - sin ajustar cámara',
    description: 'Captura de ángulo, sin perpendicular',
    expectedFields: {
      nombre_local: 'Coto Supermercados',
      total: 2345.99,
      fecha: '2025-05-27',
      forma_pago: 'Mercado Pago',
      categoria: 'Alimentación'
    },
    expectedConfidence: '80-90%',
    rawOCROutput: `
COTO
SU0ERMERCA00S
AV. 9 00 JULIO 2567
C1425 BUEN05 AIRE5

TICKET #00567
FECH@: 27/05/2025  H0R@: 11:20

COMPRA5:
Art1culo5 varios..........1900.00
00bre5 a granel...........300.00
B3b1das...................145.99

TOTAL @ P@G@R: 2345.99

M3RC@D0 P@G0 - ACEPTADO
GRACIAS!
    `,
    notes: 'OCR confunde O→0, @→, 1→l. Deskew debería arreglar rotación'
  },

  {
    id: 'test_03_mala_iluminacion',
    name: '🌑 Ticket con sombras - mala iluminación',
    description: 'Foto capturada con sombra de la mano, bajo contraste',
    expectedFields: {
      nombre_local: 'YPF Estación',
      total: 3500.00,
      fecha: '2025-05-26',
      forma_pago: 'Tarjeta de débito',
      categoria: 'Transporte'
    },
    expectedConfidence: '70-80%',
    rawOCROutput: `
...Vvvv...vpF...vvvv...
...Estacion...de...Servicio...

COMPROBANTE DE VENTA

Fecha: 26/05/2025
Hora: 09:15

NAFTA SUPER 97
CANTIDAD: 44,3 lts
PRECIO UNITARIO: 79,00
SUBTOTAL: 3497,70

DESCUENTO: 0,00
TOTAL: 3500,00

PAGO: TARJETA DE DÉBITO
OPERACIÓN APROBADA

Gracias
    `,
    notes: 'CLAHE y binarización adaptativa son críticas aquí'
  },

  {
    id: 'test_04_viejo_fotocopiado',
    name: '📄 Ticket viejo, fotocopiado 3 veces - tinta borrosa',
    description: 'Ticket muy gastado, texto borroso',
    expectedFields: {
      nombre_local: 'Farmacia del Dr. Ahorro',
      total: 850.00,
      fecha: '2025-05-25',
      forma_pago: 'Efectivo',
      categoria: 'Salud'
    },
    expectedConfidence: '60-75%',
    rawOCROutput: `
FFAARRMMAACCIIAA
DDEELL DDRR.. AAHHOORRRROO

Domicilio: Av. Belgrano 1500

Fecha: 25/05/2025  Hora: 16:45

Medicamentos:
Ibuprofeno 600mg....... 280
Vitaminas............. 320
Crema antiprurito..... 250

TOTAL.................850,00

MEDIO DE PAGO: EFECTIVO
VUELTO: 150,00

Muchas gracias
    `,
    notes: 'Ocurren muchas duplicaciones de letras. Morphological ops deben limpiar'
  },

  {
    id: 'test_05_caracteres_especiales',
    name: '🔤 Ticket con caracteres especiales corrupto',
    description: 'OCR lee caracteres aleatorios en lugar de letras',
    expectedFields: {
      nombre_local: 'Netflix',
      total: 299.99,
      fecha: '2025-05-24',
      forma_pago: 'Tarjeta Mastercard',
      categoria: 'Entretenimiento'
    },
    expectedConfidence: '50-70%',
    rawOCROutput: `
N3TFl!X
5U5CRIPCION DE E5TREAMING

COMPROBANTE

Fecha: 24/05/2025

Concepto: Suscripción mensual
Plan: Premium 4 pantallas
Monto: 299,99

Forma de pago: TARJETA MASTERCARD
Últimos dígitos: 4532

Autorización aprobada.

Próximo pago: 24/06/2025
    `,
    notes: 'Validaciones de nombre deberían rechazar "N3TFl!X" e intentar fuzzy match'
  },

  {
    id: 'test_06_multiples_montos',
    name: '💰 Ticket con MUCHOS números decimales - difícil de distinguir total',
    description: '20+ números en el ticket, confusión entre precios, impuestos, totales',
    expectedFields: {
      nombre_local: 'Disco Supermercados',
      total: 12847.35,
      fecha: '2025-05-23',
      forma_pago: 'QR',
      categoria: 'Alimentación'
    },
    expectedConfidence: '75-85%',
    rawOCROutput: `
DISCO - La tienda que querés

AV. CORRIENTES 3456
Tel: 0800-00-DISCO

Ticket: 00234567
Fecha: 23/05/2025  Hora: 18:50

Artículos:
--- Alimentos frescos ---
Lechuga 350g 195,00 1 = 195,00
Tomates 1kg 285,00 1 = 285,00
Queso de máquina 300g 1950,00 1 = 1950,00

--- Bebidas ---
Gaseosa 2L 165,00 3 = 495,00
Jugo natural 1L 285,00 2 = 570,00

--- Básicos ---
Fideos 500g 95,00 5 = 475,00
Arroz integral 1kg 325,00 2 = 650,00
Aceite de oliva 500ml 1850,00 1 = 1850,00

--- Higiene ---
Jabón antibacterial 250ml 285,00 4 = 1140,00
Papel higiénico 4 rollos 325,00 3 = 975,00

SUBTOTAL:                        9635,00
DESCUENTO CLIENTE FRECUENTE:     -150,00
SUBTOTAL DESPUÉS DESCUENTO:      9485,00

IVA 21% (parcial):               1992,70
OTROS IMPUESTOS:                 369,65

─────────────────────────────────
TOTAL A PAGAR:                  12847,35
─────────────────────────────────

PAGO: QR - CÓDIGO DINÁMICO
REFERENCIA: 123ABC456DEF

Gracias por comprar en DISCO
Próxima compra con 10% desc
    `,
    notes: 'Clustering espacial y scoring contextual SON CRÍTICOS. Hay ~25 números decimales'
  },

  {
    id: 'test_07_fecha_futura_error',
    name: '📅 Fecha leída en futuro - OCR confundió año',
    description: 'OCR leyó 2026 en lugar de 2025. Validación debe corregir',
    expectedFields: {
      nombre_local: 'Shell Estación',
      total: 2100.00,
      fecha: '2025-05-22', // Debería corregir de 2026-05-22
      forma_pago: 'Tarjeta de crédito',
      categoria: 'Transporte'
    },
    expectedConfidence: '70%',
    rawOCROutput: `
SHELL
ESTACIÓN DE SERVICIO

Comprobante de venta

Fecha: 22/05/2026  <-- ERROR: AÑO FUTURO
Hora: 08:30

Nafta Premium
Litros: 35,0
Precio/lt: 60,00
Total: 2100,00

Pago: TARJETA DE CRÉDITO
Aprobado

Gracias
    `,
    notes: 'Validador de fecha debe detectar futuro y retroceder 1 año'
  },

  {
    id: 'test_08_nombre_corrupto',
    name: '🔤 Nombre del local completamente corrupto (caso "24nfwiaji")',
    description: 'OCR no puede leer el nombre, genera basura',
    expectedFields: {
      nombre_local: 'Coto', // O null - CRÍTICO
      total: 1500.00,
      fecha: '2025-05-21',
      forma_pago: 'Mercado Pago',
      categoria: 'Alimentación'
    },
    expectedConfidence: '40-50% (será bajo porque nombre está mal)',
    rawOCROutput: `
24NFW1AJ1
SUPERMERCADO

Dirección: Zona centro

Ticket: 2024
Fecha: 21/05/2025
Hora: 12:45

COMPRAS:
Alimentos varios........1250,00
Bebidas.................250,00

TOTAL:           1500,00

MERCADO PAGO ACEPTADO
    `,
    notes: '⚠️ CRÍTICO: Validador debe rechazar "24NFW1AJ1" pero usar contexto de "SUPERMERCADO" para intuir que es un almacén'
  },

  {
    id: 'test_09_vuelto_confundido_como_total',
    name: '💸 Confusión: OCR piensa que "vuelto" es el total',
    description: 'Estructura del ticket confunde parser',
    expectedFields: {
      nombre_local: 'Almacén de Barrio',
      total: 385.00,
      fecha: '2025-05-20',
      forma_pago: 'Efectivo',
      categoria: 'Alimentación'
    },
    expectedConfidence: '60-70%',
    rawOCROutput: `
ALMACÉN LA ESQUINA
Av. San Martín 789

Ticket #1234
Fecha: 20/05/2025 Hora: 19:00

Pan tostado.........150.00
Café molido.........180.00
Té........................... 55.00

TOTAL: 385.00

Pago: EFECTIVO
Efectivo entregado: 400.00
VUELTO: 15.00

Gracias!
    `,
    notes: 'El parser debe evitar confundir "vuelto" (15.00) con total (385.00). El scoring contextual debería penalizar línea de vuelto'
  },

  {
    id: 'test_10_sin_nombre',
    name: '❓ Ticket sin nombre del local legible',
    description: 'Primeras líneas son código o no contienen nombre',
    expectedFields: {
      nombre_local: null, // O intuir de la dirección
      total: 650.50,
      fecha: '2025-05-19',
      forma_pago: 'Tarjeta Visa',
      categoria: 'Alimentación'
    },
    expectedConfidence: '50-60% (bajo por falta de nombre)',
    rawOCROutput: `
CUIT: 20-12345678-9
IVA RESPONSABLE
LOCAL 0567

Domicilio: Acoyte 2000, CABA

COMPROBANTE

Fecha: 19/05/2025
Hora: 15:20

Artículos: 500.00
Impuestos: 150.50

TOTAL: 650.50

VISA DÉBITO
Operación OK

    `,
    notes: 'Validador debe marcar nombre como "no encontrado" pero seguir procesando. Categoría podría inferirse del contexto'
  }
];

/**
 * FUNCIÓN DE TESTING
 * Ejecutar todos los casos de prueba y retornar reporte
 */
function runOCRTestSuite() {
  console.group('🧪 OCR TEST SUITE - Iniciando...');
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const testCase of OCR_TEST_CASES) {
    console.group(`Test: ${testCase.name}`);
    
    try {
      // Simular OCR
      const parsed = scParseTicketText_IMPROVED(testCase.rawOCROutput);
      
      // Validar campos
      const fieldResults = validateTestCase(testCase, parsed);
      
      const testResult = {
        id: testCase.id,
        name: testCase.name,
        passed: fieldResults.allPassed,
        details: fieldResults.details,
        actualConfidence: parsed.confianza,
        expectedConfidence: testCase.expectedConfidence,
        parsed
      };
      
      results.push(testResult);
      
      if (fieldResults.allPassed) {
        console.log('✅ PASÓ');
        passed++;
      } else {
        console.log('❌ FALLÓ');
        console.log('Errores:', fieldResults.errors);
        failed++;
      }
    } catch (err) {
      console.error('💥 ERROR:', err.message);
      results.push({
        id: testCase.id,
        name: testCase.name,
        passed: false,
        error: err.message
      });
      failed++;
    }
    
    console.groupEnd();
  }
  
  // Resumen
  const summary = {
    total: OCR_TEST_CASES.length,
    passed,
    failed,
    successRate: (passed / OCR_TEST_CASES.length * 100).toFixed(2) + '%',
    results
  };
  
  console.log('═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log(`Total: ${summary.total} | Pasaron: ${summary.passed} | Fallaron: ${summary.failed}`);
  console.log(`Tasa de éxito: ${summary.successRate}`);
  console.log('═'.repeat(60));
  
  console.groupEnd();
  
  return summary;
}

/**
 * Validar un caso de prueba específico
 */
function validateTestCase(testCase, parsed) {
  const details = {};
  const errors = [];
  
  for (const [field, expected] of Object.entries(testCase.expectedFields)) {
    const actual = parsed[field];
    
    let matches = false;
    
    if (typeof expected === 'string') {
      // Comparación fuzzy para strings
      matches = actual?.toLowerCase().includes(expected.toLowerCase()) || 
                expected.toLowerCase().includes(actual?.toLowerCase());
    } else if (typeof expected === 'number') {
      // Comparación con tolerancia para números (monto)
      matches = Math.abs(actual - expected) < 1; // Tolerancia de 1 peso
    }
    
    details[field] = {
      expected,
      actual,
      matches
    };
    
    if (!matches) {
      errors.push(`Campo "${field}": esperado "${expected}", recibido "${actual}"`);
    }
  }
  
  return {
    allPassed: errors.length === 0,
    details,
    errors
  };
}

/**
 * Exportar reporte a JSON
 */
function exportTestReport() {
  const report = runOCRTestSuite();
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr_test_report_${Date.now()}.json`;
  a.click();
  
  console.log('📥 Reporte exportado');
}

// =====================================================
// CÓMO USAR
// =====================================================
/*

1. En DevTools console, ejecutar:
   runOCRTestSuite()

2. Verás un reporte completo con:
   - Qué tests pasaron
   - Qué tests fallaron
   - Qué campos estaban mal

3. Para exportar reporte:
   exportTestReport()

4. Para un test específico:
   scParseTicketText_IMPROVED(OCR_TEST_CASES[0].rawOCROutput)

*/
