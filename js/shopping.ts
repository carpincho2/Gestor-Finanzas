// @ts-nocheck
import { showToast } from './utils/utils.ts';
import { state, IS_SERVER } from './store/store.ts';
import { TransactionService } from './services/transactionService.ts';
import { ShoppingService } from './services/shoppingService.ts';

let currentShoppingTab = 'link'; // 'link' | 'search' | 'barcode'
let lastAnalyzedData = null;
let cameraStream = null;
let barcodeInterval = null;

export function initShopping() {
  const container = document.getElementById('shoppingView');
  if (!container) return;

  setupShoppingInputs();
  renderShoppingHistory();
  renderPinnedComparison();
}

export function switchShoppingTab(tab) {
  currentShoppingTab = tab;
  const tabLink = document.getElementById('shoppingTabLink');
  const tabSearch = document.getElementById('shoppingTabSearch');
  const tabBarcode = document.getElementById('shoppingTabBarcode');

  const panelLink = document.getElementById('shoppingPanelLink');
  const panelSearch = document.getElementById('shoppingPanelSearch');
  const panelBarcode = document.getElementById('shoppingPanelBarcode');
  const analyzeBtn = document.getElementById('shoppingAnalyzeBtn');

  if (!tabLink) return;

  // Actualizar estilos de tabs
  [tabLink, tabSearch, tabBarcode].forEach(t => {
    if (t) {
      t.classList.remove('active');
      t.style.background = 'transparent';
      t.style.color = 'var(--muted)';
    }
  });

  if (panelLink) panelLink.style.display = 'none';
  if (panelSearch) panelSearch.style.display = 'none';
  if (panelBarcode) panelBarcode.style.display = 'none';

  if (tab === 'link') {
    tabLink.classList.add('active');
    tabLink.style.background = 'var(--accent)';
    tabLink.style.color = '#000';
    if (panelLink) panelLink.style.display = 'block';
    if (analyzeBtn) analyzeBtn.style.display = 'flex';
  } else if (tab === 'search') {
    tabSearch.classList.add('active');
    tabSearch.style.background = 'var(--accent)';
    tabSearch.style.color = '#000';
    if (panelSearch) panelSearch.style.display = 'block';
    if (analyzeBtn) analyzeBtn.style.display = 'flex';
  } else if (tab === 'barcode') {
    tabBarcode.classList.add('active');
    tabBarcode.style.background = 'var(--accent)';
    tabBarcode.style.color = '#000';
    if (panelBarcode) panelBarcode.style.display = 'block';
    if (analyzeBtn) analyzeBtn.style.display = 'none';
  }
}

export function toggleAdvancedShoppingOptions() {
  const panel = document.getElementById('shoppingAdvancedOptions');
  const icon = document.getElementById('shoppingAdvToggleIcon');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'grid' : 'none';
  if (icon) icon.textContent = isHidden ? '▲' : '▼';
}

function setupShoppingInputs() {
  const inputEl = document.getElementById('shoppingUrl');
  const previewBadge = document.getElementById('shoppingTitlePreview');
  let lastFetchedUrl = '';
  let debounceTimer = null;

  const triggerPriceFetch = (val) => {
    if (!val || val === lastFetchedUrl) return;
    if (/^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(val)) {
      lastFetchedUrl = val;
      fetchProductPrice(val);
    }
  };

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      const val = inputEl.value.trim();
      if (!val) {
        if (previewBadge) previewBadge.style.display = 'none';
        return;
      }
      try {
        const fullUrl = val.startsWith('http') ? val : 'https://' + val;
        const u = new URL(fullUrl);
        const domain = u.hostname.replace(/^www\./, '');
        const pathParts = u.pathname.split('/').filter(p => p && p !== 'p' && !p.endsWith('.html') && !p.endsWith('.htm'));

        let clean = '';
        if (pathParts.length > 0) {
          let rawPart = pathParts[pathParts.length - 1];
          if (/^\d+$/.test(rawPart) && pathParts.length > 1) {
            rawPart = pathParts[pathParts.length - 2];
          }
          clean = decodeURIComponent(rawPart)
            .replace(/^ML[A-Z]-?\d+-?/i, '')
            .replace(/_JM$/i, '')
            .replace(/[\-_]+/g, ' ')
            .trim();
        }

        if (clean.length > 3) {
          clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          if (previewBadge) {
            previewBadge.innerHTML = `📦 <strong>${clean}</strong> <span style="font-size:11px;color:var(--muted);font-weight:400;margin-left:6px;">(${domain} - Consultando precio...)</span>`;
            previewBadge.style.display = 'block';
          }
        }
      } catch (_) {}

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => triggerPriceFetch(val), 500);
    });

    inputEl.addEventListener('paste', () => {
      setTimeout(() => {
        const val = inputEl.value.trim();
        triggerPriceFetch(val);
      }, 80);
    });
  }
}

/**
 * Consulta precio y metadatos de producto de cualquier tienda web.
 */
async function fetchProductPrice(urlText) {
  const priceEl = document.getElementById('shoppingPrice');
  const previewBadge = document.getElementById('shoppingTitlePreview');
  if (!priceEl) return;

  if (priceEl.value.trim() && !priceEl.dataset.autoFilled) return;

  try {
    let price = 0;
    let title = null;
    let domain = 'Tienda';
    let hasMpToken = false;

    // 1. Extraer slug y params locales
    try {
      const fullUrl = urlText.startsWith('http') ? urlText : 'https://' + urlText;
      const u = new URL(fullUrl);
      domain = u.hostname.replace(/^www\./, '');

      const qp = u.searchParams.get('price') || u.searchParams.get('precio') || u.searchParams.get('p') || u.searchParams.get('amount');
      if (qp) {
        const pNum = parseFloat(qp.replace(/[^0-9.]/g, ''));
        if (pNum > 0) price = pNum;
      }

      const parts = u.pathname.split('/').filter(p => p && p !== 'p' && !p.endsWith('.html') && !p.endsWith('.htm'));
      if (parts.length > 0) {
        let rawPart = parts[parts.length - 1];
        if (/^\d+$/.test(rawPart) && parts.length > 1) {
          rawPart = parts[parts.length - 2];
        }
        let clean = decodeURIComponent(rawPart)
          .replace(/^ML[A-Z]-?\d+-?/i, '')
          .replace(/_JM$/i, '')
          .replace(/[\-_]+/g, ' ')
          .trim();
        if (clean.length > 3) {
          title = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }
    } catch (_) {}

    // 2. Extraer item_id de Mercado Libre
    let itemId = null;
    const queryMatch = urlText.match(/(?:item_id|wid)(?:%3A|=)(MLA-?\d+)/i);
    const catalogMatch = urlText.match(/\/p\/(ML[A-Z]-?\d+)/i);
    const generalMatch = urlText.match(/(ML[A-Z]-?\d{6,})/i);
    if (queryMatch) itemId = queryMatch[1].replace(/-/g, '').toUpperCase();
    else if (catalogMatch) itemId = catalogMatch[1].replace(/-/g, '').toUpperCase();
    else if (generalMatch) itemId = generalMatch[1].replace(/-/g, '').toUpperCase();

    if (price === 0 && itemId) {
      try {
        const resp = await fetch(`https://api.mercadolibre.com/items/${itemId}`, { signal: AbortSignal.timeout(1200) });
        if (resp.ok) {
          const data = await resp.json();
          if (data.price && data.price > 0) {
            price = data.price;
            if (data.title) title = data.title;
          }
        }
      } catch (_) {}
    }

    // 3. Consultar backend a través de ShoppingService
    if (price === 0 && IS_SERVER) {
      try {
        const serverData = await ShoppingService.fetchPrice(urlText);
        if (serverData) {
          hasMpToken = Boolean(serverData.has_mp_token);
          if (serverData.domain) domain = serverData.domain;
          if (serverData.price && serverData.price > 0) price = serverData.price;
          if (serverData.title && !serverData.title.toLowerCase().includes('tienda web')) title = serverData.title;
        }
      } catch (backendErr) {
        console.warn('Consulta backend shopping:', backendErr);
      }
    }

    // 4. Feedback visual
    if (previewBadge && (title || domain)) {
      const displayTitle = title || `Producto en ${domain}`;
      let extraInfo = '';
      if (price > 0) {
        const tokenTag = hasMpToken
          ? `<span style="font-size:11px;color:var(--accent);font-weight:600;display:block;margin-top:2px;">✨ Precio obtenido con tu Mercado Pago vinculado</span>`
          : `<span style="font-size:11px;color:var(--accent);font-weight:600;display:block;margin-top:2px;">✨ Precio autodetectado desde ${domain}</span>`;
        extraInfo = ` <span style="margin-left:8px;color:var(--text);font-weight:700;">($${Math.round(price).toLocaleString('es-AR')})</span>${tokenTag}`;
      } else {
        const helpMsg = hasMpToken
          ? `Cuenta vinculada. Si la publicación requiere precio manual, ingresalo abajo para calcular cuotas vs inflación.`
          : `Por políticas de seguridad de ${domain}, ingresá el precio publicado abajo para calcular cuotas vs inflación.`;
        extraInfo = `<div style="font-size:11px;color:var(--muted);font-weight:400;margin-top:3px;">${helpMsg}</div>`;
      }
      previewBadge.innerHTML = `📦 <strong>${displayTitle}</strong>${extraInfo}`;
      previewBadge.style.display = 'block';
    }

    if (price > 0) {
      priceEl.value = Math.round(price).toString();
      priceEl.dataset.autoFilled = 'true';
      priceEl.style.border = '2px solid var(--accent)';
      priceEl.style.boxShadow = '0 0 12px rgba(0, 229, 160, 0.4)';
      setTimeout(() => { priceEl.style.boxShadow = 'none'; }, 3000);
    } else {
      priceEl.placeholder = 'Ingresá el precio (ej: 194799)';
      priceEl.style.border = '2px solid var(--accent)';
      priceEl.focus();
    }
  } catch (err) {
    console.warn('Error en fetchProductPrice:', err);
    priceEl.placeholder = 'Ingresá el precio (ej: 194799)';
  }
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'shoppingPrice') {
    delete e.target.dataset.autoFilled;
  }
});

/**
 * Búsqueda directa por palabra clave en catálogo.
 */
export async function executeShoppingSearch() {
  const input = document.getElementById('shoppingSearchInput');
  const btn = document.getElementById('shoppingSearchBtn');
  const resultsBox = document.getElementById('shoppingSearchResults');
  if (!input || !resultsBox || !btn) return;

  const q = input.value.trim();
  if (!q) {
    showToast('Ingresá un término para buscar', true);
    return;
  }

  const origBtnText = btn.innerHTML;
  btn.innerHTML = `<span class="sc-loading-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent;display:inline-block;"></span>`;
  btn.disabled = true;

  try {
    const items = await ShoppingService.searchCatalog(q);
    if (items.length === 0) {
      resultsBox.innerHTML = `<div style="padding: 14px; text-align: center; color: var(--muted); font-size: 13px;">No se encontraron productos para "${q}".</div>`;
      resultsBox.style.display = 'block';
      return;
    }

    resultsBox.innerHTML = `
      <div style="font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 10px; text-transform: uppercase;">Resultados encontrados (${items.length}):</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${items.map(item => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px;">
            ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" style="width: 44px; height: 44px; object-fit: contain; border-radius: 6px; background: #fff;">` : ''}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--accent); margin-top: 2px;">$ ${Math.round(item.price).toLocaleString('es-AR')}</div>
            </div>
            <button type="button" class="btn btn-primary" onclick="selectSearchProduct('${encodeURIComponent(item.permalink || '')}', ${item.price}, '${encodeURIComponent(item.title)}')" style="padding: 8px 14px; font-size: 12px; font-weight: 600; flex-shrink: 0;">
              ⚡ Analizar Cuotas
            </button>
          </div>
        `).join('')}
      </div>
    `;
    resultsBox.style.display = 'block';
  } catch (err) {
    showToast('Error al buscar productos: ' + (err.message || ''), true);
  } finally {
    btn.innerHTML = origBtnText;
    btn.disabled = false;
  }
}

export function selectSearchProduct(encodedUrl, price, encodedTitle) {
  const url = decodeURIComponent(encodedUrl);
  const title = decodeURIComponent(encodedTitle);

  switchShoppingTab('link');
  const urlEl = document.getElementById('shoppingUrl');
  const priceEl = document.getElementById('shoppingPrice');
  const previewEl = document.getElementById('shoppingTitlePreview');

  if (urlEl) urlEl.value = url;
  if (priceEl) {
    priceEl.value = Math.round(price).toString();
    priceEl.dataset.autoFilled = 'true';
  }
  if (previewEl) {
    previewEl.innerHTML = `📦 <strong>${title}</strong> <span style="margin-left:8px;color:var(--text);font-weight:700;">($${Math.round(price).toLocaleString('es-AR')})</span>`;
    previewEl.style.display = 'block';
  }

  analyzeShoppingUrl();
}

/**
 * Consulta de producto por código de barras.
 */
export async function analyzeShoppingBarcode() {
  const input = document.getElementById('shoppingBarcodeInput');
  const btn = document.getElementById('shoppingBarcodeBtn');
  if (!input) return;

  const barcode = input.value.trim();
  if (!barcode) {
    showToast('Ingresá un código de barras válido', true);
    return;
  }

  const installments = parseInt(document.getElementById('shoppingInstallments')?.value) || 0;
  const discount = parseFloat(document.getElementById('shoppingDiscount')?.value) || 0;
  const maxDiscount = parseFloat(document.getElementById('shoppingMaxDiscount')?.value) || null;
  const tna = parseFloat(document.getElementById('shoppingTna')?.value) || 40;
  const surcharge = parseFloat(document.getElementById('shoppingSurcharge')?.value) || 0;

  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<span class="sc-loading-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent;display:inline-block;"></span>`;
    btn.disabled = true;
  }

  try {
    const res = await ShoppingService.analyzeBarcode({
      barcode,
      installments,
      discount,
      tna,
      surcharge,
      maxDiscount
    });

    if (res && res.ok) {
      ShoppingService.saveHistory({
        title: res.item.title,
        price: res.item.price,
        domain: 'Código de Barras: ' + barcode,
        url: ''
      });
      renderShoppingHistory();
      renderShoppingResults(res);
      showToast('✅ Producto analizado por código de barras');
    }
  } catch (err) {
    showToast(err.message || 'No se encontró el código de barras', true);
  } finally {
    if (btn) {
      btn.innerHTML = origBtnText;
      btn.disabled = false;
    }
  }
}

/**
 * Escáner de código de barras con la cámara en vivo del dispositivo.
 */
export async function openShoppingCameraModal() {
  const modal = document.getElementById('shoppingBarcodeModal');
  const video = document.getElementById('shoppingBarcodeVideo');
  const statusEl = document.getElementById('shoppingCamStatus');
  if (!modal) return;

  modal.style.display = 'flex';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (statusEl) statusEl.textContent = 'Cámara no soportada en este navegador. Ingresá el código manualmente.';
    return;
  }

  try {
    if (statusEl) statusEl.textContent = 'Iniciando cámara trasera...';
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    if (video) {
      video.srcObject = cameraStream;
      await video.play();
    }

    if (statusEl) statusEl.textContent = 'Apuntá el código de barras al recuadro.';

    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
      });

      barcodeInterval = setInterval(async () => {
        if (!video || video.readyState < 2) return;
        try {
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              if (navigator.vibrate) navigator.vibrate(100);
              closeShoppingCameraModal();
              const input = document.getElementById('shoppingBarcodeInput');
              if (input) input.value = code;
              showToast(`🔍 Código detectado: ${code}`);
              analyzeShoppingBarcode();
            }
          }
        } catch (_) {}
      }, 250);
    } else {
      if (statusEl) statusEl.textContent = 'Cámara activa. Si tu navegador no tiene BarcodeDetector, podés ingresar los números.';
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Permiso denegado o cámara no disponible.';
  }
}

export function closeShoppingCameraModal() {
  const modal = document.getElementById('shoppingBarcodeModal');
  if (modal) modal.style.display = 'none';

  if (barcodeInterval) {
    clearInterval(barcodeInterval);
    barcodeInterval = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

/**
 * Analiza la URL del producto o el precio manual y calcula la recomendación financiera.
 */
export async function analyzeShoppingUrl() {
  const urlEl = document.getElementById('shoppingUrl');
  const url = urlEl ? urlEl.value.trim() : '';

  let priceStr = (document.getElementById('shoppingPrice')?.value || '').trim();
  let priceVal = null;
  if (priceStr) {
    if (priceStr.includes('.') && !priceStr.includes(',')) {
      const parts = priceStr.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) priceStr = priceStr.replace(/\./g, '');
    } else if (priceStr.includes('.')) {
      priceStr = priceStr.replace(/\./g, '').replace(',', '.');
    }
    priceVal = parseFloat(priceStr) || null;
  }

  const installments = parseInt(document.getElementById('shoppingInstallments')?.value);
  const selectedInstallments = isNaN(installments) ? 0 : installments;
  const discount = parseFloat(document.getElementById('shoppingDiscount')?.value) || 0;
  const maxDiscount = parseFloat(document.getElementById('shoppingMaxDiscount')?.value) || null;
  const tna = parseFloat(document.getElementById('shoppingTna')?.value) || 40;
  const surcharge = parseFloat(document.getElementById('shoppingSurcharge')?.value) || 0;

  let installmentTotalStr = (document.getElementById('shoppingInstallmentTotal')?.value || '').trim();
  let installmentTotalVal = null;
  if (installmentTotalStr) {
    installmentTotalVal = parseFloat(installmentTotalStr.replace(/\./g, '').replace(',', '.')) || null;
  }

  if (!url && (!priceVal || priceVal <= 0)) {
    showToast('Por favor, ingresá el link de la publicación o el precio del producto', true);
    return;
  }

  const btn = document.getElementById('shoppingAnalyzeBtn');
  const origContent = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<span class="sc-loading-spinner" style="width:18px;height:18px;border-width:2px;border-top-color:transparent;display:inline-block;"></span> Analizando...`;
    btn.disabled = true;
  }

  const resultsEl = document.getElementById('shoppingResultsContainer');
  if (resultsEl) resultsEl.style.display = 'none';

  let detectedTitle = "Producto seleccionado";
  try {
    const previewEl = document.getElementById('shoppingTitlePreview');
    if (previewEl && previewEl.textContent) {
      detectedTitle = previewEl.textContent.replace('📦', '').split('(')[0].trim();
    }
  } catch (_) {}

  try {
    let data = null;
    if (IS_SERVER) {
      try {
        data = await ShoppingService.analyzeUrl({
          url: url || 'https://tienda-online.com/producto',
          price: priceVal,
          installments: selectedInstallments,
          discount,
          tna,
          surcharge,
          installmentTotal: installmentTotalVal,
          maxDiscount
        });
      } catch (apiErr) {
        if (!priceVal) {
          showToast(apiErr.message || '⚠️ Ingresá el precio del producto para calcular las opciones de pago', true);
          const priceEl = document.getElementById('shoppingPrice');
          if (priceEl) {
            priceEl.style.border = '2px solid var(--amber)';
            priceEl.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.4)';
            priceEl.focus();
          }
          return;
        }
        console.warn("Backend /shopping/analyze-url no disponible, usando cálculo local:", apiErr);
      }
    }

    if (!data && priceVal && priceVal > 0) {
      data = ShoppingService.localEvaluateShopping({
        url,
        title: detectedTitle,
        price: priceVal,
        installments: selectedInstallments,
        discount,
        tna,
        surcharge,
        installmentTotal: installmentTotalVal,
        maxDiscount,
        accounts: state.accounts || []
      });
    }

    if (data) {
      if (data.item?.price) {
        const priceEl = document.getElementById('shoppingPrice');
        if (priceEl && !priceEl.value) {
          priceEl.value = Math.round(data.item.price).toString();
          priceEl.dataset.autoFilled = 'true';
        }
      }

      ShoppingService.saveHistory({
        title: data.item.title,
        price: data.item.price,
        domain: data.item.domain || 'Tienda',
        url: url
      });
      renderShoppingHistory();
      renderShoppingResults(data);
    }

  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al analizar el producto', true);
  } finally {
    if (btn) {
      btn.innerHTML = origContent;
      btn.disabled = false;
    }
  }
}

/**
 * Renderizado reactivo de resultados de la simulación.
 */
function renderShoppingResults(data) {
  const container = document.getElementById('shoppingResultsContainer');
  if (!container) return;
  lastAnalyzedData = data;
  const { item, recommendation } = data;

  const formatMoney = (val) => '$ ' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const winner = recommendation.find(r => r.is_winner);
  const others = recommendation.filter(r => !r.is_winner);

  // --- ANÁLISIS DE IMPACTO EN PRESUPUESTOS (SELECTOR DINÁMICO) ---
  let budgetImpactHtml = '';
  const budgets = state.budgets || [];
  if (budgets.length > 0) {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const selectedBudgetId = window._selectedShoppingBudgetId || budgets[0].id;
    let targetBudget = budgets.find(b => b.id === selectedBudgetId) || budgets[0];

    const spent = (state.transactions || [])
      .filter(t => t.type === 'expense' && t.cat === targetBudget.cat)
      .filter(t => { const d = new Date(t.date); return d.getMonth() === curMonth && d.getFullYear() === curYear; })
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const available = Math.max(0, targetBudget.limit - spent);
    const purchaseAmount = (winner && winner.installments > 1) ? winner.monthly_installment : item.price;
    const pctOfRemaining = available > 0 ? Math.round((purchaseAmount / available) * 100) : 100;

    let badgeBg = 'rgba(0, 229, 160, 0.15)';
    let badgeColor = 'var(--accent)';
    let alertIcon = '✅';
    let alertMsg = `Esta compra representa el ${pctOfRemaining}% de tu presupuesto disponible en "${targetBudget.name}" ($${Math.round(available).toLocaleString('es-AR')}).`;

    if (pctOfRemaining > 75 || available < purchaseAmount) {
      badgeBg = 'rgba(244, 63, 94, 0.15)';
      badgeColor = 'var(--danger)';
      alertIcon = '🚨';
      alertMsg = `Atención: Esta compra supera o compromete el ${pctOfRemaining}% de tu presupuesto disponible en "${targetBudget.name}" ($${Math.round(available).toLocaleString('es-AR')}).`;
    } else if (pctOfRemaining > 35) {
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      badgeColor = 'var(--amber)';
      alertIcon = '⚠️';
      alertMsg = `Esta compra consumirá el ${pctOfRemaining}% de tu presupuesto disponible en "${targetBudget.name}".`;
    }

    budgetImpactHtml = `
      <div style="background: ${badgeBg}; border: 1px solid ${badgeColor}; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; gap: 12px; align-items: center; flex: 1; min-width: 260px;">
          <span style="font-size: 24px;">${alertIcon}</span>
          <div style="font-size: 13px; color: var(--text); line-height: 1.4;">
            <strong>Impacto en Presupuesto:</strong> ${alertMsg}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Evaluar en:</span>
          <select id="shoppingBudgetSelect" onchange="onShoppingBudgetChange(this.value)" class="field-select" style="padding: 4px 8px; font-size: 12px; height: 32px;">
            ${budgets.map(b => `<option value="${b.id}" ${b.id === targetBudget.id ? 'selected' : ''}>${b.icon || '📦'} ${b.name}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  }

  let html = `
    <!-- Producto Card -->
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px;">
      <div style="width: 52px; height: 52px; background: rgba(0, 229, 160, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0;">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${item.domain ? 'Tienda: ' + item.domain : 'Producto detectado'}</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.title}">${item.title}</div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Precio Lista / Base</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text);">${formatMoney(item.price)}</div>
      </div>
    </div>

    <!-- Impacto en Presupuesto -->
    ${budgetImpactHtml}
  `;

  if (winner) {
    const savings = winner.nominal_cost - winner.real_cost;
    const graceAdvantageTag = winner.has_grace_advantage
      ? `<div class="shopping-grace-badge">⭐ ¡Días de gracia! Cerró recientemente: ${winner.days_to_first_payment} días hasta el 1° pago</div>`
      : '';
    const breakEvenTag = winner.break_even_tna
      ? `<div class="shopping-break-even-badge">⚖️ TNA de equilibrio: ${winner.break_even_tna}%</div>`
      : '';

    html += `
      <!-- Winner Card -->
      <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
        <span style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          La mejor opción financiera para vos
        </span>
        <button type="button" class="btn btn-ghost" onclick="pinCurrentOffer()" style="padding: 6px 12px; font-size: 12px; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
          📌 Fijar para Comparar
        </button>
      </h3>

      <div style="background: linear-gradient(145deg, rgba(0, 229, 160, 0.12), rgba(0, 229, 160, 0.02)); border: 1px solid rgba(0, 229, 160, 0.35); border-radius: 16px; padding: 24px; margin-bottom: 24px; position: relative; overflow: hidden;">

        <div style="position: relative; z-index: 1;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-block; padding: 4px 10px; background: rgba(0, 229, 160, 0.2); color: var(--accent); border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Recomendación Ganadora</div>
              <div style="font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 2px;">${winner.account_name}</div>
              <div style="font-size: 13px; color: var(--muted);">${winner.type} ${winner.installments > 1 ? `(${winner.installments} cuotas de $${Math.round(winner.monthly_installment).toLocaleString('es-AR')})` : ''}</div>
              ${graceAdvantageTag}
              ${breakEvenTag}
            </div>

            <div style="text-align: right;">
              <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Costo Real Estimado (VPN)</div>
              <div style="font-size: 28px; font-weight: 800; color: var(--accent);">${formatMoney(winner.real_cost)}</div>
              ${savings > 0 ? `<div style="font-size: 13px; color: var(--accent); font-weight: 600; margin-top: 4px;">Ahorrás ${formatMoney(savings)} vs contado</div>` : ''}
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 18px;">
            <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div style="font-size: 13px; color: var(--text); line-height: 1.5;">
              ${winner.reason}
            </div>
          </div>

          <!-- BOTÓN DESPLEGABLE DE CRONOGRAMA DE CUOTAS -->
          ${winner.installments > 1 && winner.installments_breakdown && winner.installments_breakdown.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <button type="button" class="shopping-schedule-toggle" onclick="toggleInstallmentsSchedule('winnerSchedule')">
                <span>📉 Ver cronograma de licuación cuota a cuota (${winner.installments} cuotas)</span>
                <span id="winnerScheduleIcon">▼</span>
              </button>
              <div id="winnerSchedule" class="shopping-schedule-wrap" style="display: none;">
                <table class="shopping-schedule-table">
                  <thead>
                    <tr>
                      <th>Cuota</th>
                      <th>Fecha Estimada</th>
                      <th>Cuota Nominal</th>
                      <th>Valor Presente (VPN)</th>
                      <th>Licuación</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${winner.installments_breakdown.map(inst => `
                      <tr>
                        <td>Cuota ${inst.installment_number}/${winner.installments}</td>
                        <td>${inst.estimated_date} (${inst.days_until_payment} días)</td>
                        <td>$ ${inst.nominal_amount.toLocaleString('es-AR')}</td>
                        <td style="color: var(--accent); font-weight: 600;">$ ${inst.present_value.toLocaleString('es-AR')}</td>
                        <td style="color: var(--accent); font-weight: 700;">-${inst.depreciation_pct}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- BOTÓN DIRECTO DE REGISTRAR GASTO -->
          <button type="button" class="btn btn-primary" onclick="quickRegisterShoppingExpense(0)" style="width: 100%; padding: 12px; font-size: 14px; font-weight: 700; justify-content: center; gap: 8px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            💳 Registrar esta Compra como Gasto en el Gestor
          </button>
        </div>
      </div>
    `;
  }

  if (others.length > 0) {
    html += `
      <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 14px;">Otras opciones evaluadas en tu billetera</h3>
      <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    others.forEach((opt, idx) => {
      const isViable = opt.is_viable;
      const opacity = isViable ? '1' : '0.6';
      const actualIdx = recommendation.indexOf(opt);
      const scheduleId = `otherSchedule_${idx}`;

      html += `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; opacity: ${opacity};">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="flex: 1;">
              <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${opt.account_name}
                ${!isViable ? '<span style="font-size: 11px; background: rgba(244,63,94,0.15); color: var(--danger); padding: 2px 8px; border-radius: 4px; font-weight: 600;">No recomendable</span>' : ''}
                ${opt.has_grace_advantage ? '<span class="shopping-grace-badge">⭐ Cierre reciente</span>' : ''}
              </div>
              <div style="font-size: 13px; color: var(--muted);">${opt.reason}</div>
            </div>
            <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
              <div>
                <div style="font-size: 11px; color: var(--muted); margin-bottom: 2px; text-transform: uppercase;">Costo Real</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text);">${formatMoney(opt.real_cost)}</div>
              </div>
              ${isViable ? `
                <button type="button" class="btn" onclick="quickRegisterShoppingExpense(${actualIdx})" style="padding: 6px 12px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 6px; color: var(--text);">
                  Registrar
                </button>
              ` : ''}
            </div>
          </div>

          ${opt.installments > 1 && opt.installments_breakdown && opt.installments_breakdown.length > 0 ? `
            <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
              <button type="button" class="shopping-schedule-toggle" onclick="toggleInstallmentsSchedule('${scheduleId}')">
                <span>📉 Ver desglose (${opt.installments} cuotas)</span>
                <span id="${scheduleId}Icon">▼</span>
              </button>
              <div id="${scheduleId}" class="shopping-schedule-wrap" style="display: none;">
                <table class="shopping-schedule-table">
                  <thead>
                    <tr>
                      <th>Cuota</th>
                      <th>Fecha</th>
                      <th>Nominal</th>
                      <th>VPN</th>
                      <th>Licuación</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${opt.installments_breakdown.map(inst => `
                      <tr>
                        <td>Cuota ${inst.installment_number}/${opt.installments}</td>
                        <td>${inst.estimated_date}</td>
                        <td>$ ${inst.nominal_amount.toLocaleString('es-AR')}</td>
                        <td style="color: var(--accent);">$ ${inst.present_value.toLocaleString('es-AR')}</td>
                        <td style="color: var(--accent);">-${inst.depreciation_pct}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
  }

  container.innerHTML = html;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function onShoppingBudgetChange(budgetId) {
  window._selectedShoppingBudgetId = parseInt(budgetId) || null;
  if (lastAnalyzedData) {
    renderShoppingResults(lastAnalyzedData);
  }
}

export function toggleInstallmentsSchedule(containerId) {
  const el = document.getElementById(containerId);
  const icon = document.getElementById(containerId + 'Icon');
  if (!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  if (icon) icon.textContent = isHidden ? '▲' : '▼';
}

/**
 * Registra directamente la opción elegida como transacción en el gestor.
 */
export async function quickRegisterShoppingExpense(optionIndex) {
  if (!lastAnalyzedData || !lastAnalyzedData.recommendation) {
    showToast('No hay datos de simulación disponibles', true);
    return;
  }

  const opt = lastAnalyzedData.recommendation[optionIndex];
  const item = lastAnalyzedData.item;
  if (!opt || !item) return;

  const amountToRegister = (opt.installments > 1 && opt.monthly_installment) ? opt.monthly_installment : opt.nominal_cost;
  const descText = opt.installments > 1
    ? `Compra: ${item.title.slice(0, 35)} (Cuota 1/${opt.installments})`
    : `Compra: ${item.title.slice(0, 45)}`;

  // Categoría según el presupuesto evaluado o 'Compras'
  const selectedBudgetId = window._selectedShoppingBudgetId;
  const matchingBudget = (state.budgets || []).find(b => b.id === selectedBudgetId);
  const finalCat = matchingBudget ? matchingBudget.cat : 'Compras';

  try {
    const tx = {
      type: 'expense',
      desc: descText,
      amount: Math.round(amountToRegister * 100) / 100,
      cat: finalCat,
      account_id: opt.account_id || null,
      date: new Date().toISOString().split('T')[0]
    };

    await TransactionService.addTransaction(tx);
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
    showToast(`✅ Gasto de $${Math.round(amountToRegister).toLocaleString('es-AR')} registrado en ${opt.account_name}`);
  } catch (err) {
    console.error('Error al registrar compra:', err);
    showToast('Error al registrar el gasto: ' + (err.message || ''), true);
  }
}

// --- MODO COMPARADOR FIJADO ---

export function pinCurrentOffer() {
  if (!lastAnalyzedData || !lastAnalyzedData.recommendation) return;
  const winner = lastAnalyzedData.recommendation.find(r => r.is_winner);
  if (!winner) return;

  const pinned = {
    title: lastAnalyzedData.item.title,
    domain: lastAnalyzedData.item.domain || 'Tienda A',
    price: lastAnalyzedData.item.price,
    winner: winner
  };

  ShoppingService.setPinnedOffer(pinned);
  renderPinnedComparison();
  showToast('📌 Oferta fijada para comparar contra otra tienda o producto');
}

export function clearPinnedOffer() {
  ShoppingService.clearPinnedOffer();
  renderPinnedComparison();
  showToast('Comparación fijada eliminada');
}

function renderPinnedComparison() {
  const container = document.getElementById('shoppingPinnedComparisonContainer');
  if (!container) return;

  const pinned = ShoppingService.getPinnedOffer();
  if (!pinned) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const currentWinner = (lastAnalyzedData && lastAnalyzedData.recommendation)
    ? lastAnalyzedData.recommendation.find(r => r.is_winner)
    : null;

  let comparisonText = '';
  if (currentWinner) {
    const diff = pinned.winner.real_cost - currentWinner.real_cost;
    if (Math.abs(diff) < 1) {
      comparisonText = `<div style="font-size: 13px; color: var(--accent); font-weight: 600;">⚖️ Ambas opciones tienen prácticamente el mismo costo real (VPN).</div>`;
    } else if (diff > 0) {
      comparisonText = `<div style="font-size: 13px; color: var(--accent); font-weight: 700;">🏆 ¡La opción actual es más económica! Ahorrás $${Math.round(diff).toLocaleString('es-AR')} en costo real frente a la oferta fijada.</div>`;
    } else {
      comparisonText = `<div style="font-size: 13px; color: var(--amber); font-weight: 700;">💡 La oferta fijada (${pinned.domain}) sigue siendo más conveniente por $${Math.round(Math.abs(diff)).toLocaleString('es-AR')} en costo real.</div>`;
    }
  }

  container.innerHTML = `
    <div class="shopping-pinned-panel">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed rgba(56,189,248,0.3); padding-bottom: 10px;">
        <span style="font-size: 13px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
          📌 Comparador de Ofertas (Lado a Lado)
        </span>
        <button type="button" onclick="clearPinnedOffer()" style="background: none; border: none; font-size: 12px; color: var(--muted); cursor: pointer; text-decoration: underline;">
          Quitar fijado
        </button>
      </div>

      <div class="shopping-compare-grid">
        <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px;">
          <div style="font-size: 11px; color: #38bdf8; text-transform: uppercase; font-weight: 700;">Oferta A (Fijada)</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text); margin: 4px 0;">${pinned.title}</div>
          <div style="font-size: 12px; color: var(--muted);">${pinned.domain} — Precio: $${Math.round(pinned.price).toLocaleString('es-AR')}</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--accent); margin-top: 6px;">
            Costo Real: $${Math.round(pinned.winner.real_cost).toLocaleString('es-AR')}
          </div>
          <div style="font-size: 11px; color: var(--muted);">${pinned.winner.account_name} (${pinned.winner.installments > 1 ? pinned.winner.installments + ' cuotas' : 'Contado'})</div>
        </div>

        <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px;">
          <div style="font-size: 11px; color: var(--accent); text-transform: uppercase; font-weight: 700;">Oferta B (Actual)</div>
          ${currentWinner ? `
            <div style="font-size: 14px; font-weight: 600; color: var(--text); margin: 4px 0;">${lastAnalyzedData.item.title}</div>
            <div style="font-size: 12px; color: var(--muted);">${lastAnalyzedData.item.domain || 'Tienda B'} — Precio: $${Math.round(lastAnalyzedData.item.price).toLocaleString('es-AR')}</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--accent); margin-top: 6px;">
              Costo Real: $${Math.round(currentWinner.real_cost).toLocaleString('es-AR')}
            </div>
            <div style="font-size: 11px; color: var(--muted);">${currentWinner.account_name} (${currentWinner.installments > 1 ? currentWinner.installments + ' cuotas' : 'Contado'})</div>
          ` : `
            <div style="font-size: 13px; color: var(--muted); padding: 12px 0;">Analizá otro producto arriba para contrastarlo contra la Oferta A.</div>
          `}
        </div>
      </div>

      ${comparisonText ? `<div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(56,189,248,0.2);">${comparisonText}</div>` : ''}
    </div>
  `;
  container.style.display = 'block';
}

// --- HISTORIAL ---

function renderShoppingHistory() {
  const container = document.getElementById('shoppingRecentHistoryContainer');
  const chips = document.getElementById('shoppingRecentHistoryChips');
  if (!container || !chips) return;

  try {
    const hist = ShoppingService.getHistory();
    if (hist.length === 0) {
      container.style.display = 'none';
      return;
    }

    chips.innerHTML = hist.map(h => `
      <div onclick="loadShoppingHistoryItem('${encodeURIComponent(h.url || '')}', ${h.price || 0}, '${encodeURIComponent(h.title || '')}')" style="cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 12px; color: var(--text); display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
        <span>🛍️</span>
        <span style="max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${h.title}</span>
        <span style="color: var(--accent); font-weight: 700;">$${Math.round(h.price || 0).toLocaleString('es-AR')}</span>
      </div>
    `).join('');

    container.style.display = 'block';
  } catch (_) {
    container.style.display = 'none';
  }
}

export function loadShoppingHistoryItem(encodedUrl, price, encodedTitle) {
  const url = decodeURIComponent(encodedUrl);
  const title = decodeURIComponent(encodedTitle);

  switchShoppingTab('link');
  const urlEl = document.getElementById('shoppingUrl');
  const priceEl = document.getElementById('shoppingPrice');
  const previewEl = document.getElementById('shoppingTitlePreview');

  if (urlEl) urlEl.value = url;
  if (priceEl) {
    priceEl.value = Math.round(price).toString();
    priceEl.dataset.autoFilled = 'true';
  }
  if (previewEl) {
    previewEl.innerHTML = `📦 <strong>${title}</strong> <span style="margin-left:8px;color:var(--text);font-weight:700;">($${Math.round(price).toLocaleString('es-AR')})</span>`;
    previewEl.style.display = 'block';
  }

  analyzeShoppingUrl();
}

export function clearShoppingHistory() {
  ShoppingService.clearHistory();
  renderShoppingHistory();
  showToast('Historial de compras limpiado');
}
