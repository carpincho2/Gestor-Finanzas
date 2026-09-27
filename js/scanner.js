import { state, IS_SERVER, API_BASE, userKey } from './store/store.js';
import { showToast, formatCurrency, formatDateLong, escHtml, updateCustomSelectDisplay, addTransaction } from './utils/utils.js';
import { apiFetch } from './api/apiClient.js';
import { cameraService } from './services/cameraService.js';
import * as scannerService from './services/scannerService.js';

let scCapturedBlob = null;
let scCapturedDataUrl = null;
let scCurrentTab = 'camera';
let scCurrentParsedData = null;

function enterScannerView() {
  scRenderHistory();
  scannerService.scLoadOCRPatterns().catch(err => console.warn('Carga de patrones fallida:', err));
  scannerService.scInitWorker().catch(err => console.warn('Pre-inicialización de Tesseract fallida:', err));
}

function scSwitchTab(tab) {
  scCurrentTab = tab;
  document.getElementById('scTabCamera').classList.toggle('active', tab === 'camera');
  document.getElementById('scTabUpload').classList.toggle('active', tab === 'upload');
  document.getElementById('scCameraPanel').style.display = tab === 'camera' ? '' : 'none';
  document.getElementById('scUploadPanel').style.display = tab === 'upload' ? '' : 'none';
  if (tab !== 'camera' && cameraService.isStreaming()) scStopCamera();
}

function scToggleCamera() {
  cameraService.isStreaming() ? scStopCamera() : scStartCamera();
}

async function scStartCamera() {
  try {
    const video = document.getElementById('scVideo');
    await cameraService.startCamera(video);
    document.getElementById('scBtnCapture').disabled = false;
    document.getElementById('scCamBtnLabel').textContent = 'Detener Camara';
    document.getElementById('scScanLine').classList.add('active');
    showToast('Camara activada');
  } catch (err) {
    showToast('No se pudo acceder a la camara: ' + err.message, true);
  }
}

function scStopCamera() {
  const video = document.getElementById('scVideo');
  cameraService.stopCamera(video);
  document.getElementById('scBtnCapture').disabled = true;
  document.getElementById('scCamBtnLabel').textContent = 'Activar Camara';
  document.getElementById('scScanLine').classList.remove('active');
}

function scCapturePhoto() {
  const video = document.getElementById('scVideo');
  const canvas = document.getElementById('scCanvas');
  try {
    scCapturedDataUrl = cameraService.captureFrame(video, canvas);
    scShowPreview(scCapturedDataUrl);
    scStopCamera();
    setTimeout(scScanTicket, 300);
  } catch(e) {
    showToast('La camara aun no esta lista', true);
  }
}

function scDragOver(e) { e.preventDefault(); document.getElementById('scDropzone').classList.add('drag-over'); }
function scDragLeave() { document.getElementById('scDropzone').classList.remove('drag-over'); }

function scDrop(e) {
  e.preventDefault();
  document.getElementById('scDropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) scProcessFile(file);
}

function scFileSelected(e) {
  const file = e.target.files[0];
  if (file) scProcessFile(file);
}

function scProcessFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Solo se aceptan imagenes', true); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Max. 10MB', true); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    scCapturedDataUrl = ev.target.result;
    scShowPreview(scCapturedDataUrl);
    setTimeout(scScanTicket, 300);
  };
  reader.readAsDataURL(file);
}

function scShowPreview(dataUrl) {
  document.getElementById('scCameraPanel').style.display = 'none';
  document.getElementById('scUploadPanel').style.display = 'none';
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = 'none';

  const previewImg = document.getElementById('scPreviewImg');
  if (previewImg) previewImg.src = dataUrl;

  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = '';
}

function scResetCapture() {
  scCapturedDataUrl = null;
  scCapturedBlob = null;
  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = 'none';
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = '';
  scSwitchTab(scCurrentTab);
}

function scShowLoading(msg) {
  document.getElementById('scLoadingMsg').textContent = msg || 'Procesando...';
  document.getElementById('scLoadingOverlay').style.display = 'flex';
}
function scHideLoading() {
  document.getElementById('scLoadingOverlay').style.display = 'none';
}

async function scScanTicket() {
  if (!scCapturedDataUrl) { showToast('No hay imagen lista', true); return; }
  scShowLoading('Iniciando motor de IA...');
  
  try {
    const finalResult = await scannerService.scProcessScan(scCapturedDataUrl, (m) => {
      const loadingMsg = document.getElementById('scLoadingMsg');
      if (!loadingMsg) return;
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        loadingMsg.textContent = 'Reconociendo texto... ' + pct + '%';
      } else if (m.status === 'loading tesseract core') {
        loadingMsg.textContent = 'Cargando motor de IA...';
      } else if (m.status === 'initializing api') {
        loadingMsg.textContent = 'Inicializando motor OCR...';
      } else {
        loadingMsg.textContent = 'Procesando...';
      }
    }, IS_SERVER);
    
    scHideLoading();
    scShowResultModal(finalResult);
  } catch(err) {
    scHideLoading();
    showToast(err.message, true);
  }
}

function scShowResultModal(data) {
  scCurrentParsedData = data;
  const fName = document.getElementById('scfName');
  const fDate = document.getElementById('scfDate');
  const fTime = document.getElementById('scfTime');
  const fAmount = document.getElementById('scfAmount');
  const fPayment = document.getElementById('scfPayment');
  const fAddress = document.getElementById('scfAddress');
  const fDesc = document.getElementById('scfDesc');
  const fCat = document.getElementById('scfCat');

  fName.value = data.nombre_local || '';
  fDate.value = data.fecha || new Date().toISOString().split('T')[0];
  fTime.value = data.hora || '';
  fAmount.value = data.total != null ? data.total : '';
  fAddress.value = data.direccion || '';
  fDesc.value = data.descripcion || '';
  document.getElementById('scRawText').textContent = data.texto_crudo || '(sin texto)';

  const cats = [
    'Supermercado / Almacén', 'Salidas / Restaurantes', 'Transporte', 'Hogar / Servicios',
    'Entretenimiento / Suscripciones', 'Salud / Farmacia', 'Compras / Ropa', 'Educación',
    'Ingresos (Sueldo/Freelance)', 'Ahorro / Inversiones', 'Otros'
  ];
  fCat.value = cats.includes(data.categoria) ? data.categoria : 'Otros';
  if (typeof updateCustomSelectDisplay !== "undefined") updateCustomSelectDisplay(fCat);

  const pays = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Tarjeta Visa', 'Tarjeta Mastercard',
    'Tarjeta Amex', 'Transferencia', 'Mercado Pago', 'Cuenta DNI', 'MODO', 'Naranja X', 'QR', 'No especificado'];
  fPayment.value = pays.includes(data.forma_pago) ? data.forma_pago : 'No especificado';
  if (typeof updateCustomSelectDisplay !== "undefined") updateCustomSelectDisplay(fPayment);

  const confRow = document.getElementById('scConfidenceRow');
  const confBar = document.getElementById('scConfidenceBar');
  const confVal = document.getElementById('scConfidenceVal');
  if (confRow && confBar && confVal) {
    confRow.style.display = 'none';
    confBar.style.width = data.confianza + '%';
    confVal.textContent = data.confianza + '%';
    if (data.confianza >= 70) {
      confBar.style.background = 'var(--accent)';
      confVal.style.color = 'var(--accent)';
    } else if (data.confianza >= 40) {
      confBar.style.background = 'var(--warn)';
      confVal.style.color = 'var(--warn)';
    } else {
      confBar.style.background = 'var(--danger)';
      confVal.style.color = 'var(--danger)';
    }
  }

  const fieldList = [
    { id: 'scfName', statusId: 'scStatusName', conf: data.fieldConfidence?.nombre_local },
    { id: 'scfDate', statusId: 'scStatusDate', conf: data.fieldConfidence?.fecha },
    { id: 'scfTime', statusId: 'scStatusTime', conf: data.fieldConfidence?.hora },
    { id: 'scfAmount', statusId: 'scStatusAmount', conf: data.fieldConfidence?.total },
    { id: 'scfPayment', statusId: 'scStatusPayment', conf: data.fieldConfidence?.forma_pago },
    { id: 'scfCat', statusId: 'scStatusCat', conf: data.fieldConfidence?.categoria },
    { id: 'scfAddress', statusId: 'scStatusAddress', conf: data.fieldConfidence?.direccion }
  ];

  fieldList.forEach(f => {
    const inputEl = document.getElementById(f.id);
    const statusEl = document.getElementById(f.statusId);
    if (!inputEl || !statusEl) return;
    inputEl.classList.remove('sc-field-warning', 'sc-field-danger');
    statusEl.innerHTML = '';
    const confVal = f.conf || 0;
    if (confVal < 35) {
      if (inputEl.tagName === 'SELECT') {
        inputEl.selectedIndex = 0;
        if (typeof updateCustomSelectDisplay !== "undefined") updateCustomSelectDisplay(inputEl);
      } else {
        inputEl.value = '';
      }
    }
  });

  const itemsWrap = document.getElementById('scItemsWrap');
  const itemsCount = document.getElementById('scItemsCount');
  const itemsList = document.getElementById('scItemsList');
  if (itemsWrap && itemsCount && itemsList) {
    if (data.articulos && data.articulos.length > 0) {
      itemsWrap.style.display = 'block';
      itemsCount.textContent = data.articulos.length;
      itemsList.innerHTML = data.articulos.map(it => `
        <div style="display:flex;justify-content:space-between;width:100%;">
          <span>${it.qty}x ${it.desc}</span>
          <span style="font-family:var(--font-mono);">$${it.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      `).join('');
    } else {
      itemsWrap.style.display = 'none';
    }
  }

  document.getElementById('scResultOverlay').classList.add('open');
}

function scCloseResultModal(e) {
  if (!e || e.target.id === 'scResultOverlay')
    document.getElementById('scResultOverlay').classList.remove('open');
}

function scToggleRaw() {
  const el = document.getElementById('scRawText');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function scToggleItems() {
  const el = document.getElementById('scItemsList');
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function scSaveTicket() {
  const name = document.getElementById('scfName').value.trim();
  const amount = parseFloat(document.getElementById('scfAmount').value);
  const date = document.getElementById('scfDate').value;
  const cat = document.getElementById('scfCat').value;
  const payment = document.getElementById('scfPayment').value;
  const address = document.getElementById('scfAddress').value.trim();
  const desc = document.getElementById('scfDesc').value.trim();
  const time = document.getElementById('scfTime').value;

  if (!amount || amount <= 0) { showToast('Ingresa un monto valido', true); return; }
  if (!date) { showToast('Selecciona una fecha', true); return; }

  scannerService.scLearnFromTicket(name, cat, payment);

  const txDesc = desc || (name ? 'Compra en ' + name : 'Ticket escaneado');
  addTransaction({
    type: 'expense', desc: txDesc, amount, cat, date,
    ticket: { nombre_local: name, hora: time, forma_pago: payment, direccion: address, escaneado: new Date().toISOString() }
  });

  state.scScanHistory.unshift({ id: Date.now(), name: name || txDesc, amount, cat, date, payment });
  if (state.scScanHistory.length > 20) state.scScanHistory = state.scScanHistory.slice(0, 20);
  localStorage.setItem(userKey('flujo_scan_history'), JSON.stringify(state.scScanHistory));

  if (IS_SERVER && scCurrentParsedData && scCurrentParsedData.articulos && scCurrentParsedData.articulos.length > 0) {
    apiFetch('/ocr/save', {
      method: 'POST',
      body: JSON.stringify({
        nombre_local: name,
        fecha: date,
        articulos: scCurrentParsedData.articulos
      })
    }).then(res => {
      console.log('Artículos guardados en base de datos:', res);
    }).catch(err => {
      console.error('Error al guardar artículos en base de datos:', err);
    });
  }

  scCloseResultModal();
  scResetCapture();
  scRenderHistory();
  showToast('Ticket guardado: -$' + amount.toLocaleString('es-AR') + ' en ' + cat);
}

function scRenderHistory() {
  const el = document.getElementById('scHistoryList');
  if (!state.scScanHistory || state.scScanHistory.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:16px 0;">Aun no escaneaste ningun ticket.</div>';
    return;
  }
  el.innerHTML = state.scScanHistory.slice(0, 8).map(h =>
    '<div class="sc-history-item">' +
    '<div class="sc-history-icon">' + (state.CAT_ICONS[h.cat] || '🧾') + '</div>' +
    '<div class="sc-history-info">' +
    '<div class="sc-history-name">' + escHtml(h.name) + '</div>' +
    '<div class="sc-history-meta">' + formatDateLong(h.date) + (h.payment ? ' · ' + h.payment : '') + '</div>' +
    '</div>' +
    '<div class="sc-history-amt">-$' + h.amount.toLocaleString('es-AR') + '</div>' +
    '</div>'
  ).join('');
}

window.scShowResultModal = scShowResultModal;
window.scCapturePhoto = scCapturePhoto;
window.scShowLoading = scShowLoading;
window.scToggleItems = scToggleItems;
window.scStopCamera = scStopCamera;
window.scDragLeave = scDragLeave;
window.scFileSelected = scFileSelected;
window.scCloseResultModal = scCloseResultModal;
window.scDragOver = scDragOver;
window.scScanTicket = scScanTicket;
window.scSaveTicket = scSaveTicket;
window.scStartCamera = scStartCamera;
window.scSwitchTab = scSwitchTab;
window.scDrop = scDrop;
window.scProcessFile = scProcessFile;
window.scRenderHistory = scRenderHistory;
window.scToggleCamera = scToggleCamera;
window.enterScannerView = enterScannerView;
window.scShowPreview = scShowPreview;
window.scToggleRaw = scToggleRaw;
window.scResetCapture = scResetCapture;
window.scHideLoading = scHideLoading;
