/* =====================================================
   NAV
   ===================================================== */
let currentPage = 'dashboard';

/* =====================================================
   SIDEBAR TOGGLE (Mobile hamburger)
   ===================================================== */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent scroll behind overlay
  }
}

// Close sidebar on window resize if going back to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
});

function setPage(el, page) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Detener cámara y limpiar worker si salimos del scanner
  if (currentPage === 'scanner' && page !== 'scanner') {
    if (scCameraStream) scStopCamera();
    scCleanupWorker();
  }

  currentPage = page;

  const titles = {
    dashboard: 'Dashboard', transacciones: 'Transacciones', presupuestos: 'Presupuestos',
    cuentas: 'Cuentas', reportes: 'Reportes', objetivos: 'Objetivos', scanner: 'Escanear Ticket',
    insights: 'IA Insights', perfil: 'Mi Perfil'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Helper: ocultar todas las vistas
  function hideAll() {
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('txView').style.display = 'none';
    document.getElementById('budgetView').style.display = 'none';
    document.getElementById('cuentasView').style.display = 'none';
    document.getElementById('reportesView').style.display = 'none';
    document.getElementById('objetivosView').style.display = 'none';
    document.getElementById('scannerView').style.display = 'none';
    document.getElementById('insightsView').style.display = 'none';
    document.getElementById('perfilView').style.display = 'none';
    document.getElementById('pageDate').style.display = 'none';
  }

  if (page === 'dashboard') {
    hideAll();
    document.getElementById('dashboardView').style.display = '';
    document.getElementById('pageDate').style.display = '';
    renderAll();
  } else if (page === 'transacciones') {
    hideAll();
    document.getElementById('txView').style.display = '';
    txFilter = { type: 'all', cat: 'all', search: '', dateFrom: '', dateTo: '' };
    txSort = { field: 'date', dir: 'desc' };
    txPage = 1;
    syncTxFilterUI();
    renderTxView();
  } else if (page === 'presupuestos') {
    hideAll();
    enterBudgetView();
  } else if (page === 'cuentas') {
    hideAll();
    document.getElementById('cuentasView').style.display = '';
    enterCuentasView();
  } else if (page === 'reportes') {
    hideAll();
    document.getElementById('reportesView').style.display = '';
    enterReportesView();
  } else if (page === 'objetivos') {
    hideAll();
    document.getElementById('objetivosView').style.display = '';
    enterObjetivosView();
  } else if (page === 'scanner') {
    hideAll();
    document.getElementById('scannerView').style.display = '';
    enterScannerView();
  } else if (page === 'insights') {
    hideAll();
    document.getElementById('insightsView').style.display = '';
    enterInsightsView();
  } else if (page === 'perfil') {
    hideAll();
    document.getElementById('perfilView').style.display = '';
    enterPerfilView();
  } else {
    hideAll();
    document.getElementById('dashboardView').style.display = '';
    document.getElementById('pageDate').style.display = '';
    showToast('🚧 Sección en construcción — próximamente');
  }
}

/* =====================================================
   CUSTOM SELECT UI (GLASSMORPHISM)
   ===================================================== */

function initCustomSelects(container = document) {
  const selects = container.querySelectorAll('.field-select');
  selects.forEach(select => {
    // Si ya está inicializado, lo eliminamos para reconstruirlo fresco (útil si cambiaron los options)
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-wrapper')) {
      select.nextElementSibling.remove();
    }
    
    // Ocultar select original
    select.style.display = 'none';
    
    // Crear contenedor wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    // Heredar anchos y márgenes para que no rompa flexbox
    if (select.style.width) wrapper.style.width = select.style.width;
    else wrapper.style.width = '100%'; // Default behavior for modals
    
    if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;
    if (select.style.flex) wrapper.style.flex = select.style.flex;
    if (select.style.margin) wrapper.style.margin = select.style.margin;
    
    // Crear botón visual
    const btn = document.createElement('div');
    btn.className = 'custom-select-button';
    const selectedOption = select.options[select.selectedIndex];
    btn.innerHTML = `<span>${selectedOption ? selectedOption.text : ''}</span>`;
    
    // Crear lista desplegable
    const list = document.createElement('ul');
    list.className = 'custom-select-list';
    
    // Llenar lista de opciones
    Array.from(select.options).forEach((opt, idx) => {
      const li = document.createElement('li');
      li.className = 'custom-select-option';
      if (idx === select.selectedIndex) li.classList.add('selected');
      li.innerHTML = opt.text;
      
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        select.selectedIndex = idx;
        btn.querySelector('span').innerHTML = opt.text;
        
        // Actualizar UI
        list.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        li.classList.add('selected');
        wrapper.classList.remove('open');
        
        // Disparar evento de cambio original para que el resto de la app reaccione (filtros, modales, etc)
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      });
      list.appendChild(li);
    });
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Cerrar otros abiertos
      document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });
    
    wrapper.appendChild(btn);
    wrapper.appendChild(list);
    
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    
    // Guardar referencia
    select._customSelectBtn = btn;
    select._customSelectList = list;
    select._customSelectWrapper = wrapper;
  });
}


function updateCustomSelectDisplay(select) {
  if (!select._customSelectBtn) return;
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption) {
    select._customSelectBtn.querySelector('span').innerHTML = selectedOption.text;
    const lis = select._customSelectList.querySelectorAll('li');
    lis.forEach((li, idx) => {
      if (idx === select.selectedIndex) li.classList.add('selected');
      else li.classList.remove('selected');
    });
  }
}

// Cerrar select al hacer click fuera
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
});

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initCustomSelects(), 100);
});
