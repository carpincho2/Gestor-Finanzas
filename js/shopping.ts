// @ts-nocheck
import { apiFetch } from './api/apiClient.ts';
import { showToast } from './utils/utils.ts';
import { state, IS_SERVER } from './store/store.ts';
import { TransactionService } from './services/transactionService.ts';

let currentShoppingTab = 'link'; // 'link' | 'search' | 'barcode'
let lastAnalyzedData = null;

export function initShopping() {
  const container = document.getElementById('shoppingView');
  if (!container) return;

  // Evitar re-renderizar si ya existe el formulario inicial
  if (container.querySelector('#shoppingUrl')) return;

  container.innerHTML = `
    <div style="max-width: 780px; margin: 0 auto; padding-bottom: 40px;">
      
      <!-- Main Glassmorphism Panel -->
      <div class="panel" style="padding: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--border);">
          <div style="width: 48px; height: 48px; background: rgba(0, 229, 160, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0;">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px;">Asistente de Compras Inteligente</h2>
            <p style="color: var(--muted); font-size: 13px; margin: 0;">
              Analizá cualquier compra online o presencial y descubrí matemáticamente con qué tarjeta o cuenta te conviene pagar para ganarle a la inflación.
            </p>
          </div>
        </div>

        <!-- Mode Selector Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 22px; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 12px; border: 1px solid var(--border);">
          <button type="button" class="btn" id="shoppingTabLink" onclick="switchShoppingTab('link')" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; justify-content: center; gap: 6px; background: var(--accent); color: #000; border: none;">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Link Web
          </button>
          <button type="button" class="btn" id="shoppingTabSearch" onclick="switchShoppingTab('search')" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; justify-content: center; gap: 6px; background: transparent; color: var(--muted); border: none;">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Buscar Producto
          </button>
          <button type="button" class="btn" id="shoppingTabBarcode" onclick="switchShoppingTab('barcode')" style="flex: 1; padding: 10px; font-size: 13px; font-weight: 600; border-radius: 8px; justify-content: center; gap: 6px; background: transparent; color: var(--muted); border: none;">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="11" y1="8" x2="11" y2="16"/><line x1="15" y1="8" x2="15" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>
            Código de Barras
          </button>
        </div>

        <!-- PANEL 1: LINK WEB -->
        <div id="shoppingPanelLink">
          <div style="margin-bottom: 20px;">
            <label class="field-label" style="margin-bottom: 8px;">Link del producto (Mercado Libre, Frávega, Amazon, etc.)</label>
            <input type="text" id="shoppingUrl" class="field-input" placeholder="Ej: https://... (Cualquier tienda online)" style="width: 100%; font-size: 14px; padding: 12px 14px;">
            <div id="shoppingTitlePreview" style="display: none; margin-top: 8px; padding: 8px 12px; background: rgba(0, 229, 160, 0.1); border: 1px solid rgba(0, 229, 160, 0.25); border-radius: 8px; color: var(--accent); font-size: 12px; font-weight: 600;"></div>
          </div>
        </div>

        <!-- PANEL 2: BUSCAR PRODUCTO -->
        <div id="shoppingPanelSearch" style="display: none; margin-bottom: 20px;">
          <label class="field-label" style="margin-bottom: 8px;">Buscador de catálogo</label>
          <div style="display: flex; gap: 10px;">
            <input type="text" id="shoppingSearchInput" class="field-input" placeholder="Ej: Smart TV 50, Auriculares Sony, Freidora de aire..." style="flex: 1; font-size: 14px; padding: 12px 14px;" onkeydown="if(event.key==='Enter') executeShoppingSearch()">
            <button type="button" class="btn btn-primary" onclick="executeShoppingSearch()" id="shoppingSearchBtn" style="padding: 12px 20px; font-weight: 600; gap: 6px;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Buscar
            </button>
          </div>
          <div id="shoppingSearchResults" style="margin-top: 14px; display: none;"></div>
        </div>

        <!-- PANEL 3: CODIGO DE BARRAS -->
        <div id="shoppingPanelBarcode" style="display: none; margin-bottom: 20px;">
          <label class="field-label" style="margin-bottom: 8px;">Código de barras (GTIN / EAN)</label>
          <div style="display: flex; gap: 10px;">
            <input type="text" id="shoppingBarcodeInput" class="field-input" placeholder="Ej: 7791234567890" style="flex: 1; font-size: 14px; padding: 12px 14px;" onkeydown="if(event.key==='Enter') analyzeShoppingBarcode()">
            <button type="button" class="btn btn-primary" onclick="analyzeShoppingBarcode()" id="shoppingBarcodeBtn" style="padding: 12px 20px; font-weight: 600; gap: 6px;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Consultar
            </button>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 6px;">💡 Ingresá los números del código de barras de cualquier producto en góndola o caja.</div>
        </div>
        
        <!-- PARÁMETROS FINANCIEROS (COMUNES A TODOS LOS MODOS) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 20px;">
          
          <div>
            <label class="field-label" style="margin-bottom: 8px;">Precio del producto ($) <span style="font-size: 11px; color: var(--accent); font-weight: 600;">(Autocompletable)</span></label>
            <input type="text" id="shoppingPrice" inputmode="decimal" class="field-input" placeholder="Ej: 194799" style="width: 100%; border: 1px solid var(--accent); font-weight: 600;">
          </div>

          <div>
            <label class="field-label" style="margin-bottom: 8px;">Cuotas deseadas</label>
            <select id="shoppingInstallments" class="field-select" style="width: 100%;">
              <option value="0" selected>✨ Autodetectar mejor cuota</option>
              <option value="1">1 pago (Contado)</option>
              <option value="3">Hasta 3 cuotas</option>
              <option value="6">Hasta 6 cuotas</option>
              <option value="9">Hasta 9 cuotas</option>
              <option value="12">Hasta 12 cuotas</option>
              <option value="18">Hasta 18 cuotas</option>
              <option value="24">Hasta 24 cuotas</option>
            </select>
          </div>

          <div>
            <label class="field-label" style="margin-bottom: 8px;">Descuento Contado (%) <span style="font-size: 11px; color: var(--muted);">(Opcional)</span></label>
            <input type="number" id="shoppingDiscount" class="field-input" placeholder="0" min="0" max="100" value="0" style="width: 100%;">
          </div>

          <div>
            <label class="field-label" style="margin-bottom: 8px;">TNA Rendimiento (%) <span style="font-size: 11px; color: var(--accent);">(FCI / Plazo Fijo)</span></label>
            <input type="number" id="shoppingTna" class="field-input" placeholder="40" min="0" max="200" value="40" style="width: 100%;">
          </div>
          
        </div>

        <!-- Parámetros Avanzados: Cuotas con recargo -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="toggleAdvancedShoppingOptions()">
            <span style="font-size: 12px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 6px;">
              ⚖️ Comparador: Cuotas con Interés / Recargo vs Contado
            </span>
            <span id="shoppingAdvToggleIcon" style="font-size: 12px; color: var(--muted);">▼</span>
          </div>
          <div id="shoppingAdvancedOptions" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            <div>
              <label class="field-label" style="margin-bottom: 6px;">Recargo en cuotas (%)</label>
              <input type="number" id="shoppingSurcharge" class="field-input" placeholder="Ej: 25" min="0" max="200" value="0" style="width: 100%;">
              <span style="font-size: 10px; color: var(--muted);">Si te cobran un % extra por financiar.</span>
            </div>
            <div>
              <label class="field-label" style="margin-bottom: 6px;">O Precio Total en Cuotas ($)</label>
              <input type="text" id="shoppingInstallmentTotal" inputmode="decimal" class="field-input" placeholder="Ej: 245000" style="width: 100%;">
              <span style="font-size: 10px; color: var(--muted);">Si el precio financiado es un monto cerrado.</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" onclick="analyzeShoppingUrl()" id="shoppingAnalyzeBtn" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 600; justify-content: center; gap: 8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Analizar Opciones de Pago (VPN vs Inflación)
        </button>

        <!-- Historial Rápido de Consultas -->
        <div id="shoppingRecentHistoryContainer" style="display: none; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">🕒 Consultas Recientes</span>
            <button type="button" onclick="clearShoppingHistory()" style="background: none; border: none; font-size: 11px; color: var(--muted); cursor: pointer; text-decoration: underline;">Limpiar</button>
          </div>
          <div id="shoppingRecentHistoryChips" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
        </div>

      </div>

      <!-- Results Container -->
      <div id="shoppingResultsContainer" style="display: none; margin-top: 24px; transition: all 0.3s ease;">
        <!-- Filled by JS -->
      </div>
      
    </div>
  `;

  setupShoppingInputs();
  renderShoppingHistory();
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
    t.style.background = 'transparent';
    t.style.color = 'var(--muted)';
  });

  panelLink.style.display = 'none';
  panelSearch.style.display = 'none';
  panelBarcode.style.display = 'none';

  if (tab === 'link') {
    tabLink.style.background = 'var(--accent)';
    tabLink.style.color = '#000';
    panelLink.style.display = 'block';
    analyzeBtn.style.display = 'flex';
  } else if (tab === 'search') {
    tabSearch.style.background = 'var(--accent)';
    tabSearch.style.color = '#000';
    panelSearch.style.display = 'block';
    analyzeBtn.style.display = 'flex';
  } else if (tab === 'barcode') {
    tabBarcode.style.background = 'var(--accent)';
    tabBarcode.style.color = '#000';
    panelBarcode.style.display = 'block';
    analyzeBtn.style.display = 'none'; // El panel barcode tiene su propio botón
  }
}

export function toggleAdvancedShoppingOptions() {
  const panel = document.getElementById('shoppingAdvancedOptions');
  const icon = document.getElementById('shoppingAdvToggleIcon');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'grid' : 'none';
  icon.textContent = isHidden ? '▲' : '▼';
}

function setupShoppingInputs() {
  const container = document.getElementById('shoppingView');
  if (!container) return;

  const inputEl = container.querySelector('#shoppingUrl');
  const previewBadge = container.querySelector('#shoppingTitlePreview');
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
      } catch (e) {}

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
 * Obtiene el precio y metadatos de un producto de cualquier tienda web.
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

    // 1. Extraer slug y posibles params locales
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

    // 3. Consultar backend
    if (price === 0 && IS_SERVER) {
      try {
        const serverData = await apiFetch(`/shopping/fetch-price?url=${encodeURIComponent(urlText)}`);
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
          : `Por políticas de seguridad o antibot de ${domain}, ingresá el precio publicado abajo para calcular cuotas vs inflación.`;
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

// Limpiar flag de auto-fill cuando el usuario edita el precio manualmente
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
  if (!input || !resultsBox) return;

  const q = input.value.trim();
  if (!q) {
    showToast('Ingresá un término para buscar', true);
    return;
  }

  const origBtnText = btn.innerHTML;
  btn.innerHTML = `<span class="sc-loading-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent;display:inline-block;"></span>`;
  btn.disabled = true;

  try {
    const res = await apiFetch(`/shopping/search?q=${encodeURIComponent(q)}`);
    const items = res.results || [];
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
            <button type="button" class="btn btn-primary" onclick="selectSearchProduct('${encodeURIComponent(item.permalink)}', ${item.price}, '${encodeURIComponent(item.title)}')" style="padding: 8px 14px; font-size: 12px; font-weight: 600; flex-shrink: 0;">
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
  const tna = parseFloat(document.getElementById('shoppingTna')?.value) || 40;
  const surcharge = parseFloat(document.getElementById('shoppingSurcharge')?.value) || 0;

  const origBtnText = btn.innerHTML;
  btn.innerHTML = `<span class="sc-loading-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent;display:inline-block;"></span>`;
  btn.disabled = true;

  try {
    const res = await apiFetch('/shopping/analyze-barcode', {
      method: 'POST',
      body: JSON.stringify({
        barcode: barcode,
        installments_without_interest: installments,
        discount_percentage: discount,
        custom_tna: tna,
        surcharge_percentage: surcharge
      })
    });

    if (res && res.ok) {
      saveToShoppingHistory({
        title: res.item.title,
        price: res.item.price,
        domain: 'Código de Barras: ' + barcode,
        url: ''
      });
      renderShoppingResults(res);
      showToast('✅ Producto analizado por código de barras');
    }
  } catch (err) {
    showToast(err.message || 'No se encontró el código de barras', true);
  } finally {
    btn.innerHTML = origBtnText;
    btn.disabled = false;
  }
}

/**
 * Analiza la URL del producto y evalúa opciones financieras de pago.
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

  if ((!priceVal || priceVal <= 0) && !IS_SERVER) {
    showToast('⚠️ Ingresá el precio del producto para calcular las opciones de pago', true);
    const priceEl = document.getElementById('shoppingPrice');
    if (priceEl) {
      priceEl.style.border = '2px solid var(--amber)';
      priceEl.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.4)';
      priceEl.focus();
    }
    return;
  }

  const btn = document.getElementById('shoppingAnalyzeBtn');
  const origContent = btn.innerHTML;
  btn.innerHTML = `<span class="sc-loading-spinner" style="width:18px;height:18px;border-width:2px;border-top-color:transparent;display:inline-block;"></span> Analizando...`;
  btn.disabled = true;
  document.getElementById('shoppingResultsContainer').style.display = 'none';

  let detectedTitle = "Producto seleccionado";
  try {
    const previewEl = document.getElementById('shoppingTitlePreview');
    if (previewEl && previewEl.textContent) {
      detectedTitle = previewEl.textContent.replace('📦', '').split('(')[0].trim();
    }
  } catch (_) {}

  try {
    const bodyPayload = {
      url: url || 'https://tienda-online.com/producto',
      installments_without_interest: selectedInstallments,
      discount_percentage: discount,
      custom_tna: tna,
      price: priceVal,
      surcharge_percentage: surcharge,
      installment_total_price: installmentTotalVal
    };

    let data = null;
    if (IS_SERVER) {
      try {
        data = await apiFetch('/shopping/analyze-url', {
          method: 'POST',
          body: JSON.stringify(bodyPayload)
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
      data = localEvaluateShopping(url, detectedTitle, priceVal, selectedInstallments, discount, tna, surcharge, installmentTotalVal);
    }
    
    if (data) {
      if (data.item?.price) {
        const priceEl = document.getElementById('shoppingPrice');
        if (priceEl && !priceEl.value) {
          priceEl.value = Math.round(data.item.price).toString();
          priceEl.dataset.autoFilled = 'true';
        }
      }

      // Guardar en historial reciente
      saveToShoppingHistory({
        title: data.item.title,
        price: data.item.price,
        domain: data.item.domain || 'Tienda',
        url: url
      });

      renderShoppingResults(data);
    }
    
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al analizar el producto', true);
  } finally {
    btn.innerHTML = origContent;
    btn.disabled = false;
  }
}

/**
 * Cálculo local de VPN cuando no hay backend o como fallback offline.
 */
function localEvaluateShopping(url, title, price, installments, discount, tna, surcharge = 0, installmentTotal = null) {
  const cashPrice = price * (1 - (discount / 100));
  const tem = (tna / 100) / 12;
  const cuotas = installments > 0 ? [installments] : [1, 3, 6, 9, 12, 18, 24];

  let totalCredit = cashPrice;
  if (installmentTotal && installmentTotal > 0) {
    totalCredit = installmentTotal;
  } else if (surcharge > 0) {
    totalCredit = cashPrice * (1 + (surcharge / 100));
  }
  
  const options = [];
  const accounts = state.accounts || [];

  if (accounts.length === 0) {
    for (const n of cuotas) {
      const vpn = (n > 1 && tem > 0) ? (totalCredit / n) * ((1 - Math.pow(1 + tem, -n)) / tem) : totalCredit;
      const ahorro = cashPrice - vpn;
      const ahorroPct = cashPrice > 0 ? Math.round((ahorro / cashPrice) * 1000) / 10 : 0;
      options.push({
        account_name: n > 1 ? `Tarjeta de Crédito (${n} cuotas)` : 'Efectivo / Débito',
        type: n > 1 ? 'Crédito' : 'Contado',
        nominal_cost: totalCredit,
        real_cost: Math.round(vpn * 100) / 100,
        installments: n,
        monthly_installment: Math.round((totalCredit / n) * 100) / 100,
        inflation_adjusted_savings: Math.round(ahorro * 100) / 100,
        reason: n > 1 
          ? `Pagando en ${n} cuotas de $${Math.round(totalCredit / n).toLocaleString('es-AR')}, tu costo real ajustado por inflación (${tna}% TNA) es $${Math.round(vpn).toLocaleString('es-AR')} (${ahorro >= 0 ? 'ahorro' : 'sobrecosto'} del ${Math.abs(ahorroPct)}% vs contado).`
          : `Pago al contado de $${Math.round(cashPrice).toLocaleString('es-AR')}.`
      });
    }
  } else {
    for (const acc of accounts) {
      const accType = (acc.type || '').toLowerCase();
      const isCredit = accType.includes('crédit') || accType.includes('credit') || (acc.limit && acc.limit > 0);
      
      if (isCredit) {
        if (!acc.limit || acc.limit >= totalCredit) {
          for (const n of cuotas) {
            const vpn = (n > 1 && tem > 0) ? (totalCredit / n) * ((1 - Math.pow(1 + tem, -n)) / tem) : totalCredit;
            const ahorro = cashPrice - vpn;
            const ahorroPct = cashPrice > 0 ? Math.round((ahorro / cashPrice) * 1000) / 10 : 0;
            options.push({
              account_id: acc.id,
              account_name: `${acc.name} (${n} ${n > 1 ? 'cuotas' : 'pago'})`,
              type: 'Tarjeta de Crédito',
              nominal_cost: totalCredit,
              real_cost: Math.round(vpn * 100) / 100,
              installments: n,
              monthly_installment: Math.round((totalCredit / n) * 100) / 100,
              inflation_adjusted_savings: Math.round(ahorro * 100) / 100,
              reason: n > 1
                ? `En ${n} cuotas de $${Math.round(totalCredit / n).toLocaleString('es-AR')}, tu costo real ajustado por TNA (${tna}%) es $${Math.round(vpn).toLocaleString('es-AR')} (${ahorro >= 0 ? 'ahorrás' : 'pagás un extra de'} ${Math.abs(ahorroPct)}% vs contado).`
                : `Pago en 1 cuota con tu tarjeta ${acc.name}.`
            });
          }
        }
      } else {
        options.push({
          account_id: acc.id,
          account_name: acc.name,
          type: accType.includes('cash') || accType.includes('efectivo') ? 'Efectivo' : 'Débito / Cuenta',
          nominal_cost: cashPrice,
          real_cost: cashPrice,
          installments: 1,
          monthly_installment: cashPrice,
          inflation_adjusted_savings: 0,
          reason: `Pago directo con ${acc.name}. Abonás $${Math.round(cashPrice).toLocaleString('es-AR')} al contado.`
        });
      }
    }
  }

  options.sort((a, b) => a.real_cost - b.real_cost);
  if (options.length > 0) options[0].is_winner = true;

  return {
    item: {
      title: title || 'Producto seleccionado',
      price: price,
      permalink: url,
      domain: 'Tienda Online'
    },
    recommendation: options
  };
}

/**
 * Renderizado de resultados de la simulación.
 */
function renderShoppingResults(data) {
  const container = document.getElementById('shoppingResultsContainer');
  if (!container) return;
  lastAnalyzedData = data;
  const { item, recommendation } = data;
  
  const formatMoney = (val) => '$ ' + parseFloat(val).toLocaleString('es-AR', {minimumFractionDigits: 2});
  const winner = recommendation.find(r => r.is_winner);
  const others = recommendation.filter(r => !r.is_winner);

  // --- ANÁLISIS DE IMPACTO EN PRESUPUESTOS ---
  let budgetImpactHtml = '';
  if (state.budgets && state.budgets.length > 0) {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    // Buscar presupuesto de 'Compras', 'Ocio', 'Tecnología' o el más representativo
    let targetBudget = state.budgets.find(b => ['compras', 'shopping', 'tecnologia', 'ocio'].includes((b.cat || '').toLowerCase())) || state.budgets[0];

    if (targetBudget) {
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
        <div style="background: ${badgeBg}; border: 1px solid ${badgeColor}; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">${alertIcon}</span>
          <div style="font-size: 13px; color: var(--text); line-height: 1.4;">
            <strong>Impacto en Presupuesto (${targetBudget.name}):</strong> ${alertMsg}
          </div>
        </div>
      `;
    }
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
    
    html += `
      <!-- Winner Card -->
      <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        La mejor opción financiera para vos
      </h3>
      
      <div style="background: linear-gradient(145deg, rgba(0, 229, 160, 0.12), rgba(0, 229, 160, 0.02)); border: 1px solid rgba(0, 229, 160, 0.35); border-radius: 16px; padding: 24px; margin-bottom: 24px; position: relative; overflow: hidden;">
        
        <div style="position: relative; z-index: 1;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-block; padding: 4px 10px; background: rgba(0, 229, 160, 0.2); color: var(--accent); border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Recomendación Ganadora</div>
              <div style="font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 2px;">${winner.account_name}</div>
              <div style="font-size: 13px; color: var(--muted);">${winner.type} ${winner.installments > 1 ? `(${winner.installments} cuotas de $${Math.round(winner.monthly_installment).toLocaleString('es-AR')})` : ''}</div>
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
      
      html += `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; opacity: ${opacity};">
          <div style="flex: 1;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              ${opt.account_name}
              ${!isViable ? '<span style="font-size: 11px; background: rgba(244,63,94,0.15); color: var(--danger); padding: 2px 8px; border-radius: 4px; font-weight: 600;">No recomendable</span>' : ''}
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
      `;
    });
    
    html += `</div>`;
  }
  
  container.innerHTML = html;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  try {
    const tx = {
      type: 'expense',
      desc: descText,
      amount: Math.round(amountToRegister * 100) / 100,
      cat: 'Compras',
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

/**
 * Persistencia de consultas recientes en localStorage.
 */
function saveToShoppingHistory(entry) {
  try {
    let hist = JSON.parse(localStorage.getItem('gestor_shopping_history') || '[]');
    // Eliminar duplicados si existe el mismo título
    hist = hist.filter(h => h.title !== entry.title);
    hist.unshift({
      title: entry.title,
      price: entry.price,
      domain: entry.domain,
      url: entry.url || '',
      date: new Date().toLocaleDateString('es-AR')
    });
    // Guardar max 6
    localStorage.setItem('gestor_shopping_history', JSON.stringify(hist.slice(0, 6)));
    renderShoppingHistory();
  } catch (_) {}
}

function renderShoppingHistory() {
  const container = document.getElementById('shoppingRecentHistoryContainer');
  const chips = document.getElementById('shoppingRecentHistoryChips');
  if (!container || !chips) return;

  try {
    const hist = JSON.parse(localStorage.getItem('gestor_shopping_history') || '[]');
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
  localStorage.removeItem('gestor_shopping_history');
  renderShoppingHistory();
  showToast('Historial de compras limpiado');
}
