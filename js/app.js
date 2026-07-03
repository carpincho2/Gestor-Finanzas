/* =====================================================
   INIT
   ===================================================== */
async function loadViews() {
  const viewsMap = {
    'dashboardView': 'dashboard',
    'txView': 'transactions',
    'budgetView': 'budgets',
    'cuentasView': 'cuentas',
    'reportesView': 'reportes',
    'objetivosView': 'objetivos',
    'scannerView': 'scanner',
    'insightsView': 'insights',
    'perfilView': 'perfil'
  };
  
  for (const [id, file] of Object.entries(viewsMap)) {
    try {
      const el = document.getElementById(id);
      if (el) {
        const res = await fetch(`html/views/${file}.html`);
        el.innerHTML = await res.text();
      }
    } catch (e) {
      console.error(`Error loading view ${file}:`, e);
    }
  }
}

async function init() {
  await loadViews();
  await loadUserData();

  // Si no está corriendo en servidor, sembramos datos en localStorage
  if (!IS_SERVER) {
    if (transactions.length === 0) {
      // Demo data removida para iniciar en cero
      save();
    }

    initBudgets();
    initAccounts();
    initGoals();
  }

  // Detectar redirecciones de OAuth
  let hashStr = window.location.hash;
  if (hashStr.includes('?')) {
    const [path, queryString] = hashStr.split('?');
    const urlParams = new URLSearchParams(queryString);
    if (urlParams.get('wallet_connected') === '1') {
      setTimeout(() => showToast('Billetera conectada exitosamente (OAuth)'), 500);
      window.history.replaceState({}, document.title, window.location.pathname + path);
    } else if (urlParams.get('wallet_error')) {
      setTimeout(() => showToast('Error al conectar billetera: ' + urlParams.get('wallet_error'), true), 500);
      window.history.replaceState({}, document.title, window.location.pathname + path);
    }
  } else {
    // Fallback por si acaso
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('wallet_connected') === '1') {
      setTimeout(() => showToast('Billetera conectada exitosamente (OAuth)'), 500);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (urlParams.get('wallet_error')) {
      setTimeout(() => showToast('Error al conectar billetera: ' + urlParams.get('wallet_error'), true), 500);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }

  setDate();
  renderAll();
}

function setDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('pageDate').textContent =
    d.toLocaleDateString('es-AR', opts).replace(/^\w/, c => c.toUpperCase());

  // Set modal date default
  document.getElementById('mDate').value = d.toISOString().split('T')[0];
}

function save() {
  if (!IS_SERVER) {
    localStorage.setItem(userKey('flujo_tx'), JSON.stringify(transactions));
  }
}

/* =====================================================
   START
   ===================================================== */
authCheckSession();

/* =====================================================
   OCR TEST SUITE — Verificación (Fase 3 & 4)
   ===================================================== */
function scOCRTestSuite() {
  const tests = [
    {
      name: "Carrefour Supermarket",
      raw: `CARREFOUR EXPRESS
CUIT: 30-12345678-9
AV. CABILDO 2000, CABA
15/05/2026 14:32
1x PAN LACTAL   $450.00
2x COCA COLA   $1400.00
SUBTOTAL: $1850.00
TOTAL: $1850.00
PAGO EFECTIVO
GRACIAS POR SU COMPRA!`,
      expected: { nombre_local: "CARREFOUR EXPRESS", total: 1850, fecha: "2026-05-15", categoria: "Alimentación", forma_pago: "Efectivo" }
    },
    {
      name: "YPF petrol station",
      raw: `YPF OPESSA S.A.
AV. LIBERTADOR 5000, CABA
FECHA: 20-04-2026 HORA: 08:15
CANT. 10L INFINIA GASOIL
P. UNIT: $1240.00
TOTAL A PAGAR: $12400.00
TARJETA DEBITO
FACTURA B N° 0001-0002934`,
      expected: { nombre_local: "YPF OPESSA S.A.", total: 12400, fecha: "2026-04-20", categoria: "Transporte", forma_pago: "Tarjeta de débito" }
    },
    {
      name: "Farmacia con OCR imperfecto",
      raw: `FARMACIA SOCIAL
DIAGONAL 74 N 1250, LA PLATA
CUIT: 27-98765432-1
O3/I2/2O25 21:05
TOTAL A PACAR: 4.520,OO
MODO MP`,
      expected: { nombre_local: "FARMACIA SOCIAL", total: 4520, fecha: "2025-12-03", categoria: "Salud", forma_pago: "MODO" }
    }
  ];

  console.log("%c--- RUNNING OCR TEST SUITE ---", "color:#00e5a0; font-weight:bold; font-size:14px;");
  let passed = 0;

  tests.forEach((t, idx) => {
    const res = scParseTicketText(t.raw);
    let ok = true;
    const errors = [];

    for (const key in t.expected) {
      if (res[key] !== t.expected[key]) {
        ok = false;
        errors.push(`${key}: expected "${t.expected[key]}" but got "${res[key]}"`);
      }
    }

    if (ok) {
      console.log(`%c[PASS] Test ${idx + 1}: ${t.name}`, "color:#00e5a0;");
      passed++;
    } else {
      console.log(`%c[FAIL] Test ${idx + 1}: ${t.name}`, "color:#ff4a6b; font-weight:bold;");
      errors.forEach(e => console.log(`   -> ${e}`));
    }
  });

  console.log(`%cTests passed: ${passed}/${tests.length}`, "font-weight:bold; font-size:12px; margin-top:8px;");
}

