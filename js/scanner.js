/* =====================================================
   SCANNER — Estado
   ===================================================== */
let scCameraStream = null;
let scCapturedBlob = null;
let scCapturedDataUrl = null;
let scCurrentTab = 'camera';
let scScanHistory = [];
let scCurrentParsedData = null;

/* =====================================================
   SCANNER — Internacionalización y Patrones Dinámicos (Universal)
   ===================================================== */
let scActivePatterns = null;
let scUserCountry = 'AR';
let scCurrencySymbol = '$';
let scDecimalSeparator = ',';
let scThousandsSeparator = '.';
let scIsHighDenomination = false;

function scDetectUserCountry() {
  const langs = navigator.languages || [navigator.language || 'es-AR'];
  for (const lang of langs) {
    const parts = lang.split('-');
    if (parts.length > 1) {
      return parts[1].toUpperCase();
    }
  }
  const mainLang = (navigator.language || 'es-AR').split('-')[0].toUpperCase();
  // Fallbacks de idioma comunes a país
  const langToCountry = { 'ES': 'ES', 'FR': 'FR', 'IT': 'IT', 'DE': 'DE', 'JA': 'JP', 'KO': 'KR', 'EN': 'US' };
  return langToCountry[mainLang] || 'AR';
}

async function scLoadOCRPatterns() {
  if (scActivePatterns) return;
  try {
    const res = await fetch('data/OCR_PATTERNS.json');
    scActivePatterns = await res.json();
    scUserCountry = scDetectUserCountry();
    console.log('País detectado automáticamente para OCR:', scUserCountry);

    const locale = navigator.language || 'es-AR';
    scIsHighDenomination = scActivePatterns.high_denomination_currencies.codes.includes(scUserCountry) ||
      ['CL', 'CO', 'JP', 'KR', 'VN', 'ID', 'HU', 'PY'].includes(scUserCountry);

    try {
      const numFormat = new Intl.NumberFormat(locale);
      const formatted = numFormat.format(1.2);
      scDecimalSeparator = formatted.includes(',') ? ',' : '.';
      scThousandsSeparator = scDecimalSeparator === ',' ? '.' : ',';

      const currencyMap = {
        'AR': 'ARS', 'ES': 'EUR', 'CL': 'CLP', 'CO': 'COP', 'MX': 'MXN',
        'US': 'USD', 'UY': 'UYU', 'PE': 'PEN', 'BR': 'BRL', 'PY': 'PYG',
        'VE': 'VES', 'BO': 'BOB', 'EC': 'USD', 'GT': 'GTQ', 'HN': 'HNL'
      };
      const currencyCode = currencyMap[scUserCountry] || 'USD';
      const currencyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
      const parts = currencyFormat.formatToParts(100);
      const symbolPart = parts.find(p => p.type === 'currency');
      scCurrencySymbol = symbolPart ? symbolPart.value : '$';

      console.log(`[OCR] Configuración regional cargada: Símbolo = ${scCurrencySymbol}, Decimal = ${scDecimalSeparator}, Es alta denominación = ${scIsHighDenomination}`);
    } catch (intlErr) {
      console.warn('Error configurando Intl para moneda, usando fallbacks:', intlErr);
      if (['AR', 'ES', 'UY', 'CL', 'BR'].includes(scUserCountry)) {
        scDecimalSeparator = ',';
        scThousandsSeparator = '.';
        scCurrencySymbol = scUserCountry === 'ES' ? '€' : '$';
      } else {
        scDecimalSeparator = '.';
        scThousandsSeparator = ',';
        scCurrencySymbol = '$';
      }
    }
  } catch (err) {
    console.error('Error al cargar OCR_PATTERNS.json, inicializando fallback local:', err);
    scActivePatterns = {
      global_brands: { supermarkets: [], gas_stations: [], fast_food_and_cafes: [], services_and_entertainment: [], clothing_and_home: [] },
      multilingual_categories: [],
      payment_methods: [
        { name: "Mercado Pago", keywords: ["mercadopago", "mp"], code: "mercado_pago" },
        { name: "Efectivo", keywords: ["efectivo", "cash"], code: "cash" }
      ],
      common_ocr_errors: [],
      validation_settings: {
        store_name: { min_length: 3, max_length: 80, reject_patterns: ["^\\d+$"] },
        amount_ranges: { standard: { min: 0.1, max: 10000 }, high_denomination: { min: 100, max: 5000000 } }
      }
    };
  }
}

/* =====================================================
   SCANNER — Nav & View
   ===================================================== */
function enterScannerView() {
  scRenderHistory();
  // Pre-inicializar worker y cargar patrones en segundo plano
  scLoadOCRPatterns().catch(err => console.warn('Carga de patrones fallida:', err));
  scInitWorker().catch(err => console.warn('Pre-inicialización de Tesseract fallida:', err));
}

/* =====================================================
   SCANNER — Tabs
   ===================================================== */
function scSwitchTab(tab) {
  scCurrentTab = tab;
  document.getElementById('scTabCamera').classList.toggle('active', tab === 'camera');
  document.getElementById('scTabUpload').classList.toggle('active', tab === 'upload');
  document.getElementById('scCameraPanel').style.display = tab === 'camera' ? '' : 'none';
  document.getElementById('scUploadPanel').style.display = tab === 'upload' ? '' : 'none';
  if (tab !== 'camera' && scCameraStream) scStopCamera();
}

/* =====================================================
   SCANNER — Camara
   ===================================================== */
function scToggleCamera() {
  scCameraStream ? scStopCamera() : scStartCamera();
}

async function scStartCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    scCameraStream = stream;
    const video = document.getElementById('scVideo');
    video.srcObject = stream;
    document.getElementById('scBtnCapture').disabled = false;
    document.getElementById('scCamBtnLabel').textContent = 'Detener Camara';
    document.getElementById('scScanLine').classList.add('active');
    showToast('Camara activada');
  } catch (err) {
    showToast('No se pudo acceder a la camara: ' + err.message, true);
  }
}

function scStopCamera() {
  if (scCameraStream) { scCameraStream.getTracks().forEach(t => t.stop()); scCameraStream = null; }
  const video = document.getElementById('scVideo');
  video.srcObject = null;
  document.getElementById('scBtnCapture').disabled = true;
  document.getElementById('scCamBtnLabel').textContent = 'Activar Camara';
  document.getElementById('scScanLine').classList.remove('active');
}

function scCapturePhoto() {
  const video = document.getElementById('scVideo');
  const canvas = document.getElementById('scCanvas');
  if (!scCameraStream || video.readyState < 2) { showToast('La camara aun no esta lista', true); return; }
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  scCapturedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  scShowPreview(scCapturedDataUrl);
  scStopCamera();
  setTimeout(scScanTicket, 300);
}

/* =====================================================
   SCANNER — Upload / Drag & Drop
   ===================================================== */
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
  // Ocultar paneles de captura y pestañas
  document.getElementById('scCameraPanel').style.display = 'none';
  document.getElementById('scUploadPanel').style.display = 'none';
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = 'none';

  // Mostrar la sección de vista previa con la imagen cargada
  const previewImg = document.getElementById('scPreviewImg');
  if (previewImg) previewImg.src = dataUrl;

  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = '';
}

function scResetCapture() {
  scCapturedDataUrl = null;
  scCapturedBlob = null;

  // Ocultar sección de vista previa
  const previewSection = document.getElementById('scPreviewSection');
  if (previewSection) previewSection.style.display = 'none';

  // Volver a mostrar las pestañas y el panel según la pestaña actual
  const tabs = document.querySelector('.sc-tabs');
  if (tabs) tabs.style.display = '';

  scSwitchTab(scCurrentTab);
}

/* =====================================================
   SCANNER — Tesseract.js Worker Persistente (Fase 2)
   ===================================================== */
let scTesseractWorker = null;

async function scInitWorker() {
  if (scTesseractWorker) return scTesseractWorker;

  try {
    scTesseractWorker = await Tesseract.createWorker('spa+eng', 1, {
      logger: m => {
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
      }
    });

    await scTesseractWorker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,:/\\-() ÁÉÍÓÚÑáéíóúñ%#'
    });
  } catch (err) {
    console.error('Error al inicializar Tesseract Worker:', err);
    scTesseractWorker = null;
    throw err;
  }
  return scTesseractWorker;
}

async function scCleanupWorker() {
  if (scTesseractWorker) {
    const worker = scTesseractWorker;
    scTesseractWorker = null;
    try {
      await worker.terminate();
      console.log('Tesseract Worker terminado.');
    } catch (err) {
      console.error('Error al terminar Tesseract Worker:', err);
    }
  }
}

/* =====================================================
   SCANNER — Preprocesamiento de Imagen (Fase 1)
   ===================================================== */
function otsuThreshold(grayArray) {
  const hist = new Int32Array(256);
  const total = grayArray.length;
  for (let i = 0; i < total; i++) hist[grayArray[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, wF = 0, varMax = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

function detectSkewAngle(grayArray, width, height) {
  const sampleWidth = 300;
  const sampleHeight = Math.round((height * sampleWidth) / width);
  const scale = width / sampleWidth;
  const binarizedSample = new Uint8Array(sampleWidth * sampleHeight);

  for (let y = 0; y < sampleHeight; y++) {
    for (let x = 0; x < sampleWidth; x++) {
      const origX = Math.floor(x * scale);
      const origY = Math.floor(y * scale);
      binarizedSample[y * sampleWidth + x] = grayArray[origY * width + origX] < 128 ? 1 : 0;
    }
  }

  let bestAngle = 0, maxVariance = 0;
  for (let angle = -10; angle <= 10; angle += 1) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const projections = new Int32Array(sampleHeight);
    const midX = sampleWidth / 2, midY = sampleHeight / 2;

    for (let y = 0; y < sampleHeight; y++) {
      for (let x = 0; x < sampleWidth; x++) {
        if (binarizedSample[y * sampleWidth + x] === 1) {
          const rotY = Math.round((x - midX) * sin + (y - midY) * cos + midY);
          if (rotY >= 0 && rotY < sampleHeight) projections[rotY]++;
        }
      }
    }

    let mean = 0;
    for (let i = 0; i < sampleHeight; i++) mean += projections[i];
    mean /= sampleHeight;

    let variance = 0;
    for (let i = 0; i < sampleHeight; i++) {
      const diff = projections[i] - mean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

async function scPreprocessImage(dataUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width, height = img.height;
      if (width < 1500) {
        width *= 2;
        height *= 2;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      let imgData = ctx.getImageData(0, 0, width, height);
      let data = imgData.data;
      const totalPixels = width * height;

      const gray = new Uint8Array(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }

      if (!options.noDeskew) {
        const skewAngle = detectSkewAngle(gray, width, height);
        if (skewAngle !== 0) {
          const rad = (skewAngle * Math.PI) / 180;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d');

          tempCtx.translate(width / 2, height / 2);
          tempCtx.rotate(rad);
          tempCtx.drawImage(canvas, -width / 2, -height / 2);

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(tempCanvas, 0, 0);

          imgData = ctx.getImageData(0, 0, width, height);
          data = imgData.data;
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          }
        }
      }

      if (options.clahe) {
        let min = 255, max = 0;
        for (let i = 0; i < totalPixels; i++) {
          if (gray[i] < min) min = gray[i];
          if (gray[i] > max) max = gray[i];
        }
        const range = max - min || 1;
        for (let i = 0; i < totalPixels; i++) {
          gray[i] = Math.round(((gray[i] - min) / range) * 255);
        }
      }

      let finalGray = gray;
      if (!options.noDenoise) {
        finalGray = new Uint8Array(totalPixels);
        finalGray.set(gray);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const n0 = gray[idx - width - 1], n1 = gray[idx - width], n2 = gray[idx - width + 1];
            const n3 = gray[idx - 1], n4 = gray[idx], n5 = gray[idx + 1];
            const n6 = gray[idx + width - 1], n7 = gray[idx + width], n8 = gray[idx + width + 1];
            const arr = [n0, n1, n2, n3, n4, n5, n6, n7, n8];
            arr.sort((a, b) => a - b);
            finalGray[idx] = arr[4];
          }
        }
      }

      if (options.grayscaleOnly) {
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const val = finalGray[i];
          data[idx] = val; data[idx + 1] = val; data[idx + 2] = val; data[idx + 3] = 255;
        }
      } else {
        const threshold = otsuThreshold(finalGray);
        let blackCount = 0;
        for (let i = 0; i < totalPixels; i++) {
          const val = finalGray[i] > threshold ? 255 : 0;
          if (val === 0) blackCount++;
          const idx = i * 4;
          data[idx] = val; data[idx + 1] = val; data[idx + 2] = val; data[idx + 3] = 255;
        }

        if (blackCount > totalPixels * 0.5) {
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const val = data[idx] === 0 ? 255 : 0;
            data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
    img.onerror = err => reject(err);
    img.src = dataUrl;
  });
}

/* =====================================================
   SCANNER — OCR con Tesseract.js (Fase 2 & Fase 6)
   ===================================================== */
function scMergeScannerResults(res1, res2) {
  const merged = {};
  merged.fieldConfidence = {};

  const fields = ['nombre_local', 'fecha', 'hora', 'total', 'forma_pago', 'direccion', 'categoria'];
  for (const f of fields) {
    const conf1 = (res1.fieldConfidence && res1.fieldConfidence[f]) || 0;
    const conf2 = (res2.fieldConfidence && res2.fieldConfidence[f]) || 0;

    if (conf1 >= conf2) {
      merged[f] = res1[f];
      merged.fieldConfidence[f] = conf1;
    } else {
      merged[f] = res2[f];
      merged.fieldConfidence[f] = conf2;
    }
  }

  merged.descripcion = merged.nombre_local ? 'Compra en ' + merged.nombre_local : 'Ticket escaneado';
  merged.texto_crudo = (res1.texto_crudo || '') + '\n\n--- SEGUNDA PASADA (PSM 4) ---\n\n' + (res2.texto_crudo || '');
  merged.articulos = (res1.articulos && res1.articulos.length >= (res2.articulos ? res2.articulos.length : 0)) ? res1.articulos : res2.articulos;

  let totalScore = 0, count = 0;
  totalScore += merged.fieldConfidence.nombre_local; count++;
  totalScore += merged.fieldConfidence.fecha; count++;
  totalScore += merged.fieldConfidence.total; count++;
  if (merged.hora) { totalScore += merged.fieldConfidence.hora; count++; }
  if (merged.forma_pago !== 'No especificado') { totalScore += merged.fieldConfidence.forma_pago; count++; }

  merged.confianza = Math.max(Math.round(totalScore / count), 10);
  return merged;
}

async function scScanTicket() {
  if (!scCapturedDataUrl) { showToast('No hay imagen lista', true); return; }

  scShowLoading('Iniciando motor de IA...');
  let worker;
  try {
    worker = await scInitWorker();
  } catch (err) {
    scHideLoading();
    showToast('Error al iniciar motor OCR: ' + err.message, true);
    return;
  }

  scShowLoading('Procesando imagen (Pasada 1)...');
  let processedUrl1 = scCapturedDataUrl;
  try {
    processedUrl1 = await scPreprocessImage(scCapturedDataUrl, { clahe: false, grayscaleOnly: false });
  } catch (err) {
    console.warn('Fallo preprocesamiento 1:', err);
  }

  scShowLoading('Analizando texto (Pasada 1)...');
  let text1 = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const { data: { text } } = await worker.recognize(processedUrl1);
    text1 = text;
  } catch (err) {
    console.error('Error pasada 1:', err);
  }

  const result1 = scParseTicketText(text1);

  scShowLoading('Optimizando imagen (Pasada 2)...');
  let processedUrl2 = scCapturedDataUrl;
  try {
    processedUrl2 = await scPreprocessImage(scCapturedDataUrl, { clahe: true, grayscaleOnly: true, noDenoise: true });
  } catch (err) {
    console.warn('Fallo preprocesamiento 2:', err);
  }

  scShowLoading('Analizando texto (Pasada 2)...');
  let text2 = '';
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    const { data: { text } } = await worker.recognize(processedUrl2);
    text2 = text;
  } catch (err) {
    console.error('Error pasada 2:', err);
  }

  const result2 = scParseTicketText(text2);
  const mergedResult = scMergeScannerResults(result1, result2);

  let finalResult = mergedResult;

  if (IS_SERVER) {
    scShowLoading('Analizando ticket con IA...');
    try {
      const aiData = await apiFetch('/ocr/parse', {
        method: 'POST',
        body: JSON.stringify({ text: mergedResult.texto_crudo })
      });

      if (aiData && !aiData.fallback) {
        finalResult = {
          nombre_local: aiData.nombre_local || mergedResult.nombre_local,
          fecha: aiData.fecha || mergedResult.fecha,
          hora: aiData.hora || mergedResult.hora,
          total: aiData.total != null ? aiData.total : mergedResult.total,
          forma_pago: aiData.forma_pago || mergedResult.forma_pago,
          direccion: aiData.direccion || mergedResult.direccion,
          categoria: aiData.categoria || mergedResult.categoria,
          descripcion: aiData.nombre_local ? 'Compra en ' + aiData.nombre_local : 'Ticket escaneado (IA)',
          texto_crudo: mergedResult.texto_crudo,
          confianza: aiData.confianza || 95,
          fieldConfidence: aiData.fieldConfidence || {
            nombre_local: aiData.nombre_local ? 95 : 30,
            fecha: aiData.fecha ? 95 : 30,
            hora: aiData.hora ? 95 : 30,
            total: aiData.total != null ? 95 : 30,
            forma_pago: aiData.forma_pago ? 95 : 30,
            direccion: aiData.direccion ? 95 : 30,
            categoria: aiData.categoria ? 95 : 30
          },
          articulos: aiData.articulos || mergedResult.articulos
        };
      }
    } catch (err) {
      console.warn('Fallo el parseo por IA, usando fallback heuristico:', err);
    }
  }

  scHideLoading();
  scShowResultModal(finalResult);
}

/* =====================================================
   SCANNER — Algoritmos auxiliares de Lógica Difusa
   ===================================================== */
function getLevenshteinDistance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findKeywordFuzzy(lines, keywords, maxDistance = 2) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();
    const words = line.split(/[^\w\u00C0-\u024F]+/).filter(Boolean);
    for (const word of words) {
      if (word.length < 3) continue;
      for (const kw of keywords) {
        const allowedDist = (kw.length <= 4 || word.length <= 4) ? 0 : maxDistance;
        const dist = getLevenshteinDistance(word, kw);
        if (dist <= allowedDist) {
          return { lineIndex: i, word, matchedKeyword: kw, fullLine: lines[i] };
        }
      }
    }
  }
  return null;
}

/* =====================================================
   SCANNER — Parser de ticket argentino (Fase 3)
   ===================================================== */
function scParseTicketText(raw) {
  debugLog('Parse - Entrada', { textLength: raw ? raw.length : 0 });
  const text = raw || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const rxExclude = /ITEMS|SOLD|RETURNEO|RETURN|CHANGE|VUELTO|VUELT|CHANGE|CANTIDAD|CANT|PRICE|UNIT|FEE|TEL|PHONE|CUIT|RUT|NIF|VAT|TAX|RFC|NIT|FECHA|HORA|CASHIER|CAJERA/i;
  const rxTotal = /TOTAL|PAGAR|IMPORTE|NETO|FINAL|AMOUNT|EBT|CASH|EFECTIVO|VISA|DEBITO|CREDITO|TRANSFERENCIA|PAGO|TOTAL DUE|BALANCE DUE/i;
  const rxSubtotal = /SUBTOTAL|SUB-OTAL|SUB TOTAL/i;

  // Cargar rangos de montos dinámicos según el tipo de moneda del país
  const amountLimits = scActivePatterns ?
    (scIsHighDenomination ? scActivePatterns.validation_settings.amount_ranges.high_denomination : scActivePatterns.validation_settings.amount_ranges.standard) :
    { min: 0.10, max: 1000000 };

  // 1. EXTRAER ARTÍCULOS
  const items = [];
  const rxItemLine = /^\s*(?:(\d+(?:[.,]\d+)?)\s*(?:x|unid|un)?\s+)?([A-Z0-9\s&.\-\/]{4,30})\s+[$€£¥]?\s*([\d.,OoSsBbIiLl|]+)\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (rxExclude.test(line) || rxTotal.test(line) || rxSubtotal.test(line) ||
      /cuit|rut|nif|vat|tax|rfc|nit|fecha|hora|telefono|tel:|cajera|factura/i.test(line)) {
      continue;
    }
    const m = line.match(rxItemLine);
    if (m) {
      const qty = m[1] ? parseFloat(m[1].replace(',', '.')) : 1;
      const desc = m[2].trim();
      const priceVal = scParseAmount(m[3]);
      if (priceVal && priceVal > 0 && priceVal < amountLimits.max && desc.length >= 3) {
        items.push({ qty, desc, price: priceVal, total: qty * priceVal });
      }
    }
  }
  const sumItems = items.reduce((s, it) => s + it.total, 0);

  // 2. EXTRAER EL TOTAL CON SCORING CONTEXTUAL
  let total = null;
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].toUpperCase();
    line = line.replace(/\b\d{2,4}[\/\-\.]\d{2}[\/\-\.]\d{2,4}\b/g, '');
    line = line.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
    line = line.replace(/\b\d{3}[-\.]\d{3}[-\.]\d{4}\b/g, '');
    line = line.replace(/\b(?:20|23|24|27|30|33|34)\-?\d{8}\-?\d\b/g, ''); // CUITs / RUTs

    const numMatches = line.match(/[\d.,OoIiLlSsBb|]{3,}/g);
    if (!numMatches) continue;

    for (const numStr of numMatches) {
      const val = scParseAmount(numStr);
      if (!val || val < amountLimits.min || val > amountLimits.max || /^\d{11}$/.test(String(val))) continue;

      let score = 0;
      if (rxTotal.test(lines[i])) score += 100;
      if (rxSubtotal.test(lines[i])) score += 40;
      if (lines[i].includes(scCurrencySymbol)) score += 30;
      if (i > lines.length * 0.6) score += 30;
      if (/[.,]\d{2}$/.test(numStr)) score += 20;
      if (sumItems > 0 && Math.abs(val - sumItems) / sumItems <= 0.05) score += 150;
      if (rxExclude.test(lines[i])) score -= 200;

      candidates.push({ value: val, score: score, line: lines[i] });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    total = candidates[0].value;
  }

  // 3. EXTRAER LA FECHA (Tolerancia multiformato)
  let fecha = null;
  const cleanTextForDate = text
    .replace(/(\d|[Oo])(\d|[Oo])[\/\-\.](\d|[Oo])(\d|[Oo])[\/\-\.](\d|[Oo]|[IiLl]){2,4}/g, m => {
      return m.replace(/[Oo]/g, '0').replace(/[IiLl]/g, '1');
    });

  let dateRxList = [];
  if (scActivePatterns && scActivePatterns.date_formats) {
    scActivePatterns.date_formats.forEach(f => {
      let fn;
      if (f.name === 'YYYY_MM_DD') {
        fn = m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      } else if (f.name === 'MM_DD_YYYY') {
        fn = m => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      } else if (f.name === 'DD_MM_YY') {
        fn = m => `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      } else { // DD_MM_YYYY
        fn = m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      dateRxList.push({ rx: new RegExp(f.regex), fn: fn });
    });
  } else {
    dateRxList = [
      { rx: /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/, fn: m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
      { rx: /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/, fn: m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
      { rx: /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2})/, fn: m => `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    ];
  }

  for (const { rx, fn } of dateRxList) {
    const m = cleanTextForDate.match(rx);
    if (m) {
      const d = fn(m);
      if (!isNaN(Date.parse(d))) { fecha = d; break; }
    }
  }

  const hoy = new Date().toISOString().split('T')[0];
  const dateFormattedSlash = hoy.split('-').reverse().join('/');
  const dateFormattedDash = hoy.split('-').reverse().join('-');
  const textRawUpper = text.toUpperCase();
  const containsTodayDate = textRawUpper.includes(hoy) || textRawUpper.includes(dateFormattedSlash) || textRawUpper.includes(dateFormattedDash);
  if (!fecha) fecha = hoy;

  // 4. EXTRAER LA HORA
  let hora = null;
  const cleanTextForTime = text
    .replace(/(\d|[Oo])?(\d|[Oo]):(\d|[Oo])(\d|[Oo])(?::(\d|[Oo])(\d|[Oo]))?/g, m => {
      return m.replace(/[Oo]/g, '0').replace(/[IiLl]/g, '1');
    });
  const tm = cleanTextForTime.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
  if (tm) {
    const h = parseInt(tm[1]), mn = parseInt(tm[2]);
    if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
      hora = String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
    }
  }

  // 5. FORMA DE PAGO (Detección dinámica)
  let forma_pago = 'No especificado';
  let payKeywords = [];
  if (scActivePatterns && scActivePatterns.payment_methods) {
    payKeywords = scActivePatterns.payment_methods.map(p => ({ keys: p.keywords.map(k => k.toUpperCase()), label: p.name }));
  } else {
    payKeywords = [
      { keys: ['MERCADOPAGO', 'MPAGO', 'MERCADO PAGO', 'MP'], label: 'Mercado Pago' },
      { keys: ['VISA'], label: 'Tarjeta Visa' },
      { keys: ['EFECTIVO', 'CASH', 'CONTADO'], label: 'Efectivo' }
    ];
  }
  for (const item of payKeywords) {
    const match = findKeywordFuzzy(lines, item.keys, 1);
    if (match) { forma_pago = item.label; break; }
  }

  // 6. NOMBRE DEL LOCAL (Algoritmo Heurístico Universal + Diccionario Global)
  let nombre_local = '';
  let bestNameScore = -100;

  const rxStoreSuffix = /\b(S\.A\.|S\.R\.L\.|S\.A\.S|S\.A|SRL|SAS|MARKET|SUPERMERCADO|EXPRESS|ALMACEN|DESPENSA|PANADERIA|CARNICERIA|KIOSCO|FARMACIA|CAFE|BAR|RESTAURANTE|RESTAURANT|SHELL|YPF|AXION|PUMA|STORE|SHOP|GROCERY|HYPERMARKET|MALL|SUPER)\b/i;

  let globalBrandsList = [];
  if (scActivePatterns && scActivePatterns.global_brands) {
    Object.keys(scActivePatterns.global_brands).forEach(key => {
      scActivePatterns.global_brands[key].forEach(brand => {
        globalBrandsList.push(...brand.keywords);
      });
    });
  }
  const rxGlobalBrands = globalBrandsList.length > 0 ?
    new RegExp('\\b(' + globalBrandsList.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|').toUpperCase() + ')\\b', 'i') :
    /\b(COTO|CARREFOUR|DIA|JUMBO|DISCO|VEA|CHANGOMAS|YPF|SHELL|AXION|PUMA|MCDONALD|STARBUCKS|BURGER KING|MOSTAZA|ZARA|HM|NETFLIX|SPOTIFY|STEAM|EASY|SODIMAC)\b/i;

  for (let idx = 0; idx < Math.min(8, lines.length); idx++) {
    const l = lines[idx];
    const cleanL = l.replace(/[^\w\s\u00C0-\u024F&.,\-]/g, '').trim();
    if (cleanL.length <= 3 || /^\d+$/.test(cleanL) || /^[.\-_]/.test(cleanL) ||
      /cuit|rut|nif|vat|tax|rfc|nit|ticket|factura|responsable|monotributo|telefono|tel:|email|fecha|hora/i.test(cleanL)) {
      continue;
    }

    let nameScore = 0;
    nameScore += (8 - idx) * 3;
    if (cleanL.length >= 5 && cleanL.length <= 30) nameScore += 10;
    if (rxStoreSuffix.test(cleanL)) nameScore += 45;
    if (rxGlobalBrands.test(cleanL)) nameScore += 130; // Boost para marcas globales conocidas

    if (/\b(total|subtotal|neto|pagar|pago|vuelto|importe|visa|mastercard|debito|efectivo|cambio|items|fiscal|duplicado|original|tax|vat|invoice|receipt)\b/i.test(cleanL)) {
      nameScore -= 150;
    }

    const digits = cleanL.replace(/\D/g, '');
    if (digits.length > 0) {
      nameScore -= digits.length * 15;
    }

    const upperCount = (cleanL.match(/[A-Z]/g) || []).length;
    const letterCount = (cleanL.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 0 && (upperCount / letterCount) > 0.8) nameScore += 15;

    if (nameScore > bestNameScore) {
      bestNameScore = nameScore;
      nombre_local = cleanL;
    }
  }

  // 7. DIRECCIÓN
  let direccion = null;
  const addrM = text.match(/\b(AV\.|AVDA|CALLE|RUTA|PASAJE|BVAR|BLVD|DIAGONAL|PEATONAL|STREET|ST|AVE|ROAD|RD|BOULEVARD)\b\.?\s+[\w\sñáéíóúÁÉÍÓÚ]+(?:\bN°?\s*\d+|\d+)/i);
  if (addrM) direccion = addrM[0].trim();

  // 8. CATEGORÍA (Búsqueda multilingüe)
  let categoria = 'Otros';
  let catKeywords = [];
  if (scActivePatterns && scActivePatterns.multilingual_categories) {
    catKeywords = scActivePatterns.multilingual_categories.map(c => ({ cat: c.category, keys: c.keywords.map(k => k.toUpperCase()) }));
  } else {
    catKeywords = [
      { cat: 'Salud / Farmacia', keys: ['FARMACIA', 'FARMA', 'DROGUERIA', 'OPTICA', 'MEDICO', 'CLINICA', 'PHARMACY', 'DRUGSTORE'] },
      { cat: 'Transporte', keys: ['NAFTA', 'YPF', 'SHELL', 'AXION', 'PUMA', 'SUBE', 'PEAJE', 'TAXI', 'UBER', 'CABIFY', 'GAS', 'STATION', 'FUEL'] },
      { cat: 'Entretenimiento / Suscripciones', keys: ['CINE', 'TEATRO', 'NETFLIX', 'SPOTIFY', 'STEAM', 'PLAYSTATION', 'GAME', 'SHOW', 'MOVIE'] },
      { cat: 'Compras / Ropa', keys: ['ROPA', 'ZARA', 'HM', 'SHOPPING', 'ELECTRONICA', 'CLOTHING', 'WEAR', 'SHOES', 'BOUTIQUE'] },
      { cat: 'Hogar / Servicios', keys: ['FERRETERIA', 'EASY', 'SODIMAC', 'MUEBLE', 'LUZ', 'AGUA', 'GAS', 'EXPENSAS', 'RENT', 'HARDWARE', 'IKEA'] },
      { cat: 'Salidas / Restaurantes', keys: ['CAFETERIA', 'CAFE', 'DELIVERY', 'BURGER', 'MCDON', 'PIZZA', 'RESTAURANT', 'BAR', 'COFFEE', 'STARBUCKS'] },
      { cat: 'Supermercado / Almacén', keys: ['SUPER', 'MARKET', 'MERCADO', 'CARREFOUR', 'DISCO', 'JUMBO', 'COTO', 'DIA', 'VERDULERIA', 'ALMACEN', 'GROCERY'] }
    ];
  }
  const linesWithLocal = [...lines, nombre_local];
  for (const item of catKeywords) {
    const match = findKeywordFuzzy(linesWithLocal, item.keys, 1);
    if (match) { categoria = item.cat; break; }
  }

  // 9. VALIDAR CADA CAMPO E INTEGRAR SISTEMA DE CONFIANZA
  debugLog('Datos parseados preliminares', { nombre_local, total, fecha, hora, forma_pago, categoria });

  // 10. APRENDIZAJE PREVIO
  const learned = scGetLearnedData(nombre_local);
  if (learned) {
    nombre_local = learned.nombre_local;
    categoria = learned.categoria;
    forma_pago = learned.forma_pago;
  }

  // 11. VALIDAR CADA CAMPO
  const validations = {
    nombre_local: validateLocalName(nombre_local, text),
    total: validateTotal(total, candidates, text, lines),
    fecha: validateDate(fecha, text),
    hora: { valid: !!hora, confidence: hora ? 80 : 20 },
    forma_pago: validatePaymentMethod(forma_pago, text),
    categoria: { valid: !!categoria, confidence: categoria ? 75 : 30 }
  };

  debugLog('Validaciones de campo', validations);

  // Sobrescribir confianzas si hay aprendizaje previo
  if (learned) {
    validations.nombre_local.confidence = 99;
    validations.categoria.confidence = 99;
    validations.forma_pago.confidence = 99;
  }

  // Si la fecha fue corregida en la validación, la adoptamos
  if (validations.fecha.corrected) {
    fecha = validations.fecha.corrected;
  }

  // 12. CALCULAR CONFIANZA PONDERADA
  const confidenceData = calculateConfidencePerField({
    nombre_local, total, fecha, hora, forma_pago, categoria, texto_crudo: raw
  });

  // Si hay aprendizaje previo, forzamos que la confianza de esos campos sea 99 en el objeto de salida
  confidenceData.fields.nombre_local.confidence = validations.nombre_local.confidence;
  confidenceData.fields.categoria.confidence = validations.categoria.confidence;
  confidenceData.fields.forma_pago.confidence = validations.forma_pago.confidence;

  // Recalcular globalConfidence si es necesario, o usar el general calculado
  const finalConfidence = confidenceData.overall;

  debugLog('Resultado de confianza y recomendaciones', { finalConfidence, fields: confidenceData.fields, recs: confidenceData.recommendations });

  // Mapeamos fieldConfidence para compatibilidad con el resto del código
  const fieldConfidence = {
    nombre_local: confidenceData.fields.nombre_local.confidence,
    fecha: confidenceData.fields.fecha.confidence,
    hora: confidenceData.fields.hora.confidence,
    total: confidenceData.fields.total.confidence,
    forma_pago: confidenceData.fields.forma_pago.confidence,
    categoria: confidenceData.fields.categoria.confidence,
    direccion: direccion ? 85 : 0
  };

  return {
    nombre_local, fecha, hora, total, forma_pago, direccion, categoria,
    descripcion: nombre_local ? 'Compra en ' + nombre_local : 'Ticket escaneado',
    texto_crudo: raw,
    confianza: finalConfidence,
    fieldConfidence: fieldConfidence,
    validations: validations,
    recommendations: confidenceData.recommendations,
    articulos: items
  };
}

function scParseAmount(str) {
  if (!str) return null;
  let s = str.trim().replace(/\s+/g, '');
  s = s.replace(/(?<=\d)[Oo](?=\d)/g, '0').replace(/(?<=\d)[Oo]$/g, '0').replace(/^[Oo](?=\d)/g, '0');
  s = s.replace(/(?<=\d)[Ss](?=\d)/g, '5').replace(/(?<=\d)[Ss]$/g, '5').replace(/^[Ss](?=\d)/g, '5');
  s = s.replace(/(?<=\d)B(?=\d)/g, '8').replace(/(?<=\d)B$/g, '8').replace(/^B(?=\d)/g, '8');
  s = s.replace(/(?<=\d)[IiLl|](?=\d)/g, '1').replace(/(?<=\d)[IiLl|]$/g, '1').replace(/^[IiLl|](?=\d)/g, '1');
  s = s.replace(/[^\d.,-]/g, '');
  if (!s) return null;

  const decMatch = s.match(/[.,](\d{2})$/);
  if (decMatch) {
    const decimalPart = decMatch[1];
    const integerPart = s.substring(0, s.length - 3).replace(/[.,]/g, '');
    return parseFloat(`${integerPart}.${decimalPart}`) || null;
  }
  const countCommas = (s.match(/,/g) || []).length;
  const countDots = (s.match(/\./g) || []).length;
  if (countCommas === 1 && countDots === 0) s = s.replace(',', '.');
  else if (countDots === 1 && countCommas === 0) { }
  else s = s.replace(/[.,]/g, '');
  return parseFloat(s) || null;
}

/* =====================================================
   SCANNER — Loading overlay
   ===================================================== */
function scShowLoading(msg) {
  document.getElementById('scLoadingMsg').textContent = msg || 'Procesando...';
  document.getElementById('scLoadingOverlay').style.display = 'flex';
}
function scHideLoading() {
  document.getElementById('scLoadingOverlay').style.display = 'none';
}

/* =====================================================
   SCANNER — Modal de resultado (Fase 4)
   ===================================================== */
function scShowResultModal(data) {
  // Debug Log: Imprimir en consola de desarrollo de forma agrupada
  console.group('📊 Resultado OCR - Debug Info');
  console.log('Datos completos de lectura:', data);
  console.log('Validaciones de campos individuales:', data.validations ? data.validations : 'No disponible');
  console.log('Recomendaciones de corrección:', data.recommendations ? data.recommendations : 'No disponible');
  console.groupEnd();

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
  updateCustomSelectDisplay(fCat);

  const pays = ['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Tarjeta Visa', 'Tarjeta Mastercard',
    'Tarjeta Amex', 'Transferencia', 'Mercado Pago', 'Cuenta DNI', 'MODO', 'Naranja X', 'QR', 'No especificado'];
  fPayment.value = pays.includes(data.forma_pago) ? data.forma_pago : 'No especificado';
  updateCustomSelectDisplay(fPayment);

  // 1. Barra de confianza global (Oculta para Enfoque de Producto Premium)
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

  // 2. Indicadores individuales por campo
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
    statusEl.innerHTML = ''; // Keep UI clean: no green/yellow/red circles

    // Clear input if confidence is very low (below 35%) so it remains blank
    const confVal = f.conf || 0;
    if (confVal < 35) {
      if (inputEl.tagName === 'SELECT') {
        inputEl.selectedIndex = 0; // Default option
        updateCustomSelectDisplay(inputEl);
      } else {
        inputEl.value = '';
      }
    }
  });

  // 3. Preview de artículos detectados
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

/* =====================================================
   SCANNER — Módulo de Aprendizaje (Fase 5)
   ===================================================== */
function scLearnFromTicket(name, cat, payment) {
  if (!name || name.length < 3) return;
  const key = userKey('flujo_ocr_dictionary');
  let dict = {};
  try { dict = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { dict = {}; }

  const norm = name.trim().toUpperCase();
  if (!dict[norm]) {
    dict[norm] = { originalName: name.trim(), categories: {}, payments: {}, count: 0 };
  }
  const entry = dict[norm];
  entry.count++;
  entry.categories[cat] = (entry.categories[cat] || 0) + 1;
  entry.payments[payment] = (entry.payments[payment] || 0) + 1;
  localStorage.setItem(key, JSON.stringify(dict));
}

function scGetLearnedData(name) {
  if (!name || name.length < 3) return null;
  const key = userKey('flujo_ocr_dictionary');
  let dict = {};
  try { dict = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return null; }

  const norm = name.trim().toUpperCase();
  if (dict[norm]) return scExtractLearnedFields(dict[norm]);

  let best = null, minDist = 3;
  for (const k in dict) {
    const d = getLevenshteinDistance(norm, k);
    if (d < minDist) { minDist = d; best = dict[k]; }
  }
  return best ? scExtractLearnedFields(best) : null;
}

function scExtractLearnedFields(entry) {
  let bestCat = 'Otros', maxCat = 0;
  for (const c in entry.categories) {
    if (entry.categories[c] > maxCat) { maxCat = entry.categories[c]; bestCat = c; }
  }
  let bestPay = 'Efectivo', maxPay = 0;
  for (const p in entry.payments) {
    if (entry.payments[p] > maxPay) { maxPay = entry.payments[p]; bestPay = p; }
  }
  return { nombre_local: entry.originalName, categoria: bestCat, forma_pago: bestPay };
}

/* =====================================================
   SCANNER — Guardar como transaccion
   ===================================================== */
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

  scLearnFromTicket(name, cat, payment);

  const txDesc = desc || (name ? 'Compra en ' + name : 'Ticket escaneado');
  addTransaction({
    type: 'expense', desc: txDesc, amount, cat, date,
    ticket: { nombre_local: name, hora: time, forma_pago: payment, direccion: address, escaneado: new Date().toISOString() }
  });

  scScanHistory.unshift({ id: Date.now(), name: name || txDesc, amount, cat, date, payment });
  if (scScanHistory.length > 20) scScanHistory = scScanHistory.slice(0, 20);
  localStorage.setItem(userKey('flujo_scan_history'), JSON.stringify(scScanHistory));

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

/* =====================================================
   SCANNER — Historial
   ===================================================== */
function scRenderHistory() {
  const el = document.getElementById('scHistoryList');
  if (!scScanHistory || scScanHistory.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:11px;padding:16px 0;">Aun no escaneaste ningun ticket.</div>';
    return;
  }
  el.innerHTML = scScanHistory.slice(0, 8).map(h =>
    '<div class="sc-history-item">' +
    '<div class="sc-history-icon">' + (CAT_ICONS[h.cat] || '🧾') + '</div>' +
    '<div class="sc-history-info">' +
    '<div class="sc-history-name">' + escHtml(h.name) + '</div>' +
    '<div class="sc-history-meta">' + formatDateLong(h.date) + (h.payment ? ' · ' + h.payment : '') + '</div>' +
    '</div>' +
    '<div class="sc-history-amt">-$' + h.amount.toLocaleString('es-AR') + '</div>' +
    '</div>'
  ).join('');
}

/* ===== VALIDACIONES MEJORADAS DE OCR (Silenciosas) ===== */

const DEBUG_CONFIG = {
  enabled: localStorage.getItem('ocr_debug_enabled') === '1',
  level: parseInt(localStorage.getItem('ocr_debug_level') || '2'), // 0-5
  logToConsole: true,
  logToFile: false,
  timestamps: true
};

function debugLog(stage, data, level = 2) {
  if (!DEBUG_CONFIG.enabled || level > DEBUG_CONFIG.level) return;
  
  const timestamp = DEBUG_CONFIG.timestamps ? `[${new Date().toISOString()}]` : '';
  const prefix = `${timestamp} [OCR] ${stage}`;
  
  if (DEBUG_CONFIG.logToConsole) {
    console.group(prefix);
    console.log(data);
    console.groupEnd();
  }
}

function enableDebugMode() {
  localStorage.setItem('ocr_debug_enabled', '1');
  localStorage.setItem('ocr_debug_level', '4');
  console.log('✅ Debug mode activado. Nivel: 4 (INFO)');
  location.reload();
}

function disableDebugMode() {
  localStorage.setItem('ocr_debug_enabled', '0');
  console.log('❌ Debug mode desactivado.');
  location.reload();
}

function validateLocalName(name, fullText) {
  // NIVEL 1: Filtros básicos
  if (!name || name.length < 3) {
    console.debug('Nombre rechazado: muy corto');
    return { valid: false, confidence: 0, reason: 'Muy corto' };
  }
  
  if (/^\d+$/.test(name)) {
    console.debug('Nombre rechazado: solo números');
    return { valid: false, confidence: 0, reason: 'Solo números' };
  }
  
  if (!/[a-záéíóúñ]/i.test(name)) {
    console.debug('Nombre rechazado: sin letras');
    return { valid: false, confidence: 0, reason: 'Sin letras' };
  }
  
  // NIVEL 2: Detectar corrupción de OCR
  const corruptPatterns = [
    /([nfwjkqb]{3,})/i,      // Secuencias como "fjwkj"
    /(\d{2,}[a-z]{2,})/i,    // Mezcla de números y letras como "24nf"
    /([^a-záéíóúñ&.,\-\s]{4,})/i // Caracteres especiales raros
  ];
  
  for (const pattern of corruptPatterns) {
    if (pattern.test(name)) {
      console.debug('Nombre rechazado: OCR corrupto detectado -', pattern);
      return { valid: false, confidence: 5, reason: 'OCR corrupto' };
    }
  }
  
  // NIVEL 3: Validación contextual
  // Cargar diccionario de marcas conocidas (desde OCR_PATTERNS.json)
  let knownBrands = [
    'coto', 'disco', 'carrefour', 'jumbo', 'dia', 'walmart',
    'farmacia', 'ypf', 'shell', 'netflix', 'spotify', 'mercado',
    'easy', 'sodimac', 'ferreteria', 'cafe', 'restaurant'
  ];
  
  if (typeof scActivePatterns !== 'undefined' && scActivePatterns && scActivePatterns.global_brands) {
    const brands = [];
    Object.keys(scActivePatterns.global_brands).forEach(key => {
      scActivePatterns.global_brands[key].forEach(brand => {
        brands.push(...brand.keywords);
      });
    });
    if (brands.length > 0) knownBrands = brands.map(b => b.toLowerCase());
  }
  
  const nameLower = name.toLowerCase();
  const hasKnownWord = knownBrands.some(brand => nameLower.includes(brand));
  
  // Si no es marca conocida y es muy corta, dudoso
  if (!hasKnownWord && name.length < 5) {
    console.debug('Nombre sospechoso: corto y no es marca conocida');
    return { valid: true, confidence: 40, reason: 'Corto, revisar' };
  }
  
  // Si es marca conocida, muy confiable
  if (hasKnownWord) {
    return { valid: true, confidence: 95, reason: 'Marca reconocida' };
  }
  
  // Default: aceptar con confianza media-alta
  return { valid: true, confidence: 75, reason: 'Parece válido' };
}

function validateTotal(amount, candidates, fullText, lines) {
  // Cargar rangos de montos dinámicos
  const minAmount = 10;
  const isHighDenom = typeof scIsHighDenomination !== 'undefined' && scIsHighDenomination;
  const maxAmount = isHighDenom ? 5000000 : 100000;
  
  // NIVEL 1: Rango realista
  if (amount < minAmount || amount > maxAmount) {
    return { valid: false, confidence: 0, reason: `Monto fuera de rango (${minAmount}-${maxAmount})` };
  }
  
  // NIVEL 2: Scoring contextual mejorado
  let contextScore = 0;
  
  // Buscar si la línea contiene palabras de "TOTAL"
  const totalPatterns = [
    /total\s*[:\$]?\s*[\d.,]+/i,
    /pagar\s*[:\$]?\s*[\d.,]+/i,
    /importe\s*[:\$]?\s*[\d.,]+/i,
    /neto\s*[:\$]?\s*[\d.,]+/i,
    /amount\s*[:\$]?\s*[\d.,]+/i,
  ];
  
  let foundInTotalLine = false;
  for (const pattern of totalPatterns) {
    if (pattern.test(fullText)) {
      foundInTotalLine = true;
      contextScore += 50;
      break;
    }
  }
  
  // NIVEL 3: Penalizar si está en línea de "no-total"
  const dangerPatterns = [
    /unitario/i,
    /precio\s+u/i,
    /cant(?:idad)?/i,
    /item/i,
    /lote/i,
    /peso/i,
    /vuelto/i,
    /change/i
  ];
  
  let isDangerous = false;
  for (const pattern of dangerPatterns) {
    if (pattern.test(fullText)) {
      contextScore -= 50;
      isDangerous = true;
      break;
    }
  }
  
  // NIVEL 4: Coherencia con otros candidatos
  const confidence = foundInTotalLine ? 90 : (isDangerous ? 30 : 65);
  
  // NIVEL 5: Retornar validación
  return {
    valid: amount >= minAmount && amount <= maxAmount,
    confidence: Math.max(0, Math.min(100, confidence)),
    reason: foundInTotalLine ? 'En línea de total' : (isDangerous ? 'En contexto peligroso' : 'Contextualmente válido')
  };
}

function validateDate(date, fullText) {
  if (!date) {
    return { valid: false, confidence: 0, reason: 'Fecha nula' };
  }
  
  try {
    const parsed = new Date(date);
    const now = new Date();
    
    // ¿La fecha está en el futuro? Probablemente error de OCR
    if (parsed > now) {
      console.warn('Fecha en futuro detectada, intentando corregir...');
      
      // Intentar hace 1 o 2 años
      const y = now.getFullYear();
      const alternatives = [
        date.replace(/(\d{4})/, String(y - 1)),
        date.replace(/(\d{4})/, String(y - 2))
      ];
      
      const distances = alternatives.map(d => Math.abs(new Date(d) - now));
      const bestAlt = alternatives[distances.indexOf(Math.min(...distances))];
      
      return {
        valid: true,
        confidence: 60,
        corrected: bestAlt,
        reason: 'Corregida (estaba en futuro)'
      };
    }
    
    // ¿Es demasiado vieja? (más de 10 años)
    if (now - parsed > 10 * 365 * 24 * 60 * 60 * 1000) {
      return { valid: false, confidence: 10, reason: 'Demasiado vieja (>10 años)' };
    }
    
    // Válida
    return {
      valid: true,
      confidence: 95,
      reason: 'Fecha válida'
    };
  } catch (err) {
    return { valid: false, confidence: 0, reason: 'Fecha inválida (parse error)' };
  }
}

function validatePaymentMethod(method, fullText) {
  const validMethods = [
    'Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Tarjeta Visa', 'Tarjeta Mastercard',
    'Tarjeta Amex', 'Transferencia', 'Mercado Pago', 'Cuenta DNI', 'MODO', 'Naranja X', 'QR', 'No especificado'
  ];
  
  if (validMethods.includes(method)) {
    // Si fue detectada por fuzzy matching (no es "No especificado"), confianza alta
    if (method !== 'No especificado') {
      return { valid: true, confidence: 85, reason: 'Detectada en ticket' };
    }
    // Si no se detectó nada, confianza baja pero válida
    return { valid: true, confidence: 40, reason: 'No especificada en ticket' };
  }
  
  return { valid: false, confidence: 0, reason: 'Método desconocido' };
}

function calculateConfidencePerField(parseResult) {
  const fields = {
    nombre_local: validateLocalName(parseResult.nombre_local, parseResult.texto_crudo),
    total: validateTotal(parseResult.total, [], parseResult.texto_crudo, []),
    fecha: validateDate(parseResult.fecha, parseResult.texto_crudo),
    hora: { valid: !!parseResult.hora, confidence: parseResult.hora ? 80 : 20 },
    forma_pago: validatePaymentMethod(parseResult.forma_pago, parseResult.texto_crudo),
    categoria: { valid: !!parseResult.categoria, confidence: parseResult.categoria ? 75 : 30 }
  };
  
  // Calcular promedio ponderado
  const weights = {
    nombre_local: 0.25,
    total: 0.35,
    fecha: 0.20,
    hora: 0.05,
    forma_pago: 0.10,
    categoria: 0.05
  };
  
  let totalConfidence = 0;
  for (const [field, weight] of Object.entries(weights)) {
    totalConfidence += fields[field].confidence * weight;
  }
  
  return {
    fields,
    overall: Math.round(totalConfidence),
    recommendations: generateRecommendations(fields)
  };
}

function generateRecommendations(fields) {
  const recommendations = [];
  
  if (fields.nombre_local.confidence < 60) {
    recommendations.push({
      field: 'nombre_local',
      level: 'error',
      message: 'Revisa el nombre del local - OCR podría haber fallado'
    });
  }
  
  if (fields.total.confidence < 70) {
    recommendations.push({
      field: 'total',
      level: 'warning',
      message: 'Verifica el monto - hay dudas sobre cuál es el total'
    });
  }
  
  if (fields.fecha.confidence < 60) {
    recommendations.push({
      field: 'fecha',
      level: 'error',
      message: 'Revisa la fecha - podría estar corrupta'
    });
  }
  
  return recommendations;
}

// Alias para compatibilidad con suites de pruebas
const scParseTicketText_IMPROVED = scParseTicketText;

