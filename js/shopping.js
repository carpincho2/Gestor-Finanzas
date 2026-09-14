import { apiFetch } from './api/apiClient.js';
import { showToast } from './utils/utils.js';

export function initShopping() {
  const container = document.getElementById('shoppingView');

  // Evitar re-renderizar si ya existe el formulario (preserva datos del usuario)
  if (container.querySelector('#shoppingUrl')) return;
  
  container.innerHTML = `
    <div style="max-width: 750px; margin: 0 auto; padding-bottom: 40px;">
      
      <!-- Main Glassmorphism Panel -->
      <div class="panel" style="padding: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border);">
          <div style="width: 48px; height: 48px; background: rgba(0, 229, 160, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0;">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </div>
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px;">Asistente de Compras Inteligente</h2>
            <p style="color: var(--muted); font-size: 13px; margin: 0;">
              Pegá el link de Mercado Libre para analizar con qué tarjeta o cuenta te conviene pagar y ganarle a la inflación.
            </p>
          </div>
        </div>

        <!-- Form -->
        <div style="margin-bottom: 20px;">
          <label class="field-label" style="margin-bottom: 8px;">Link de Mercado Libre</label>
          <input type="text" id="shoppingUrl" class="field-input" placeholder="Ej: https://articulo.mercadolibre.com.ar/MLA-..." style="width: 100%; font-size: 14px; padding: 12px 14px;">
          <div id="shoppingTitlePreview" style="display: none; margin-top: 8px; padding: 8px 12px; background: rgba(0, 229, 160, 0.1); border: 1px solid rgba(0, 229, 160, 0.25); border-radius: 8px; color: var(--accent); font-size: 12px; font-weight: 600;"></div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
          
          <div>
            <label class="field-label" style="margin-bottom: 8px;">Precio del producto ($) <span style="font-size: 11px; color: var(--accent); font-weight: 600;">(Ingresalo para calcular cuotas)</span></label>
            <input type="text" id="shoppingPrice" inputmode="decimal" class="field-input" placeholder="Ej: 194799" style="width: 100%; border: 1px solid var(--accent); font-weight: 600;">
          </div>

          <div>
            <label class="field-label" style="margin-bottom: 8px;">Cuotas sin interés</label>
            <select id="shoppingInstallments" class="field-select" style="width: 100%;">
              <option value="0" selected>✨ Autodetectar mejor cuota (Recomendado)</option>
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
            <label class="field-label" style="margin-bottom: 8px;">Descuento Extra Banco (%) <span style="font-size: 11px; color: var(--muted);">(Opcional)</span></label>
            <input type="number" id="shoppingDiscount" class="field-input" placeholder="0" min="0" max="100" value="0" style="width: 100%;">
          </div>

          <div>
            <label class="field-label" style="margin-bottom: 8px;">TNA Estimada (%) <span style="font-size: 11px; color: var(--accent);">(Rendimiento)</span></label>
            <input type="number" id="shoppingTna" class="field-input" placeholder="40" min="0" max="200" value="40" style="width: 100%;">
          </div>
          
        </div>

        <button class="btn btn-primary" onclick="analyzeShoppingUrl()" id="shoppingAnalyzeBtn" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 600; justify-content: center; gap: 8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Analizar Opciones de Pago
        </button>

      </div>

      <!-- Results Container -->
      <div id="shoppingResultsContainer" style="display: none; margin-top: 24px; transition: all 0.3s ease;">
        <!-- Filled by JS -->
      </div>
      
    </div>
  `;

  const inputEl = container.querySelector('#shoppingUrl');
  const previewBadge = container.querySelector('#shoppingTitlePreview');
  let lastFetchedUrl = '';

  if (inputEl) {
    inputEl.addEventListener('input', () => {
      const val = inputEl.value.trim();
      if (!val) {
        if (previewBadge) previewBadge.style.display = 'none';
        return;
      }
      try {
        const u = new URL(val);
        const parts = u.pathname.split('/').filter(p => p && p !== 'p');
        if (parts.length > 0) {
          let clean = decodeURIComponent(parts[0])
            .replace(/^ML[A-Z]-?\d+-?/i, '')
            .replace(/_JM$/i, '')
            .replace(/[\-_]+/g, ' ')
            .trim();
          if (clean.length > 3) {
            clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (previewBadge) {
              previewBadge.textContent = `📦 Producto: ${clean}`;
              previewBadge.style.display = 'block';
            }
          }
        }
      } catch (e) {}

      // Auto-fetch precio desde el navegador del usuario (evita bloqueo de ML a IPs de datacenter)
      if (val.includes('mercadolibre') && val !== lastFetchedUrl) {
        lastFetchedUrl = val;
        fetchPriceFromClient(val);
      }
    });
  }
}

/**
 * Obtiene el precio de un producto de MercadoLibre directamente desde el navegador del usuario.
 * Esto evita el bloqueo que ML hace a IPs de datacenters (como Render).
 *
 * IMPORTANTE: Solo usa las APIs JSON de ML (api.mercadolibre.com) que tienen CORS habilitado.
 * NO intenta scrapear HTML porque las páginas de ML (articulo.mercadolibre.com.ar) bloquean CORS.
 *
 * Estrategia:
 *   1. API /items/{id} — items individuales
 *   2. API /products/{id} — catálogo (URLs tipo /p/MLA...)
 *   3. API /sites/MLA/search?q={titulo} — búsqueda por nombre extraído del slug
 */
async function fetchPriceFromClient(urlText) {
  const priceEl = document.getElementById('shoppingPrice');
  if (!priceEl) return;

  // Si el usuario ya ingresó un precio manualmente, no pisar
  if (priceEl.value.trim() && !priceEl.dataset.autoFilled) return;

  // Mostrar indicador de carga
  priceEl.placeholder = '⏳ Buscando precio...';
  priceEl.style.border = '1px solid var(--accent)';

  try {
    let price = 0;
    let title = null;

    // 1. Extraer item_id del link (soporta MLA-123456789, MLA123456789, pdp_filters, wid)
    let itemId = null;
    const queryMatch = urlText.match(/(?:item_id|wid)(?:%3A|=)(MLA-?\d+)/i);
    const catalogMatch = urlText.match(/\/p\/(ML[A-Z]-?\d+)/i);
    const generalMatch = urlText.match(/(ML[A-Z]-?\d{6,})/i);
    
    if (queryMatch) itemId = queryMatch[1].replace(/-/g, '').toUpperCase();
    else if (catalogMatch) itemId = catalogMatch[1].replace(/-/g, '').toUpperCase();
    else if (generalMatch) itemId = generalMatch[1].replace(/-/g, '').toUpperCase();

    // 2. Intentar API /items/{id} (funciona para publicaciones individuales)
    if (itemId) {
      try {
        const resp = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.price && data.price > 0) {
            price = data.price;
            title = data.title;
          }
        }
      } catch (_) {}
    }

    // 3. Intentar API /products/{id} (funciona para URLs de catálogo /p/MLA...)
    if (price === 0 && itemId) {
      try {
        const resp = await fetch(`https://api.mercadolibre.com/products/${itemId}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (resp.ok) {
          const data = await resp.json();
          const buyBox = data.buy_box_winner || {};
          const p = buyBox.price || data.price;
          if (p && p > 0) {
            price = p;
            title = data.name || data.title;
          }
        }
      } catch (_) {}
    }

    // 4. Fallback: Buscar por título del slug en la API de búsqueda de ML
    if (price === 0) {
      let slugTitle = null;
      try {
        const u = new URL(urlText);
        const parts = u.pathname.split('/').filter(p => p && p !== 'p');
        if (parts.length > 0) {
          let clean = decodeURIComponent(parts[0])
            .replace(/^ML[A-Z]-?\d+-?/i, '')
            .replace(/_JM$/i, '')
            .replace(/[\-_]+/g, ' ')
            .trim();
          if (clean.length > 3) slugTitle = clean;
        }
      } catch (_) {}

      if (slugTitle) {
        try {
          const resp = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(slugTitle)}&limit=1`, {
            signal: AbortSignal.timeout(5000)
          });
          if (resp.ok) {
            const data = await resp.json();
            const results = data.results || [];
            if (results.length > 0 && results[0].price > 0) {
              price = results[0].price;
              title = results[0].title;
            }
          }
        } catch (_) {}
      }
    }

    // 4. Autocompletar el campo si encontramos precio
    if (price > 0) {
      priceEl.value = Math.round(price).toString();
      priceEl.dataset.autoFilled = 'true';
      priceEl.style.border = '2px solid var(--green)';
      priceEl.style.boxShadow = '0 0 10px rgba(0, 229, 160, 0.3)';
      priceEl.placeholder = 'Ej: 194799';

      // Actualizar preview con título real si lo obtuvimos
      const previewBadge = document.getElementById('shoppingTitlePreview');
      if (previewBadge && title && title.length > 3) {
        previewBadge.textContent = `📦 ${title}`;
        previewBadge.style.display = 'block';
      }

      // Quitar estilo verde después de 3 segundos
      setTimeout(() => {
        priceEl.style.border = '1px solid var(--accent)';
        priceEl.style.boxShadow = 'none';
      }, 3000);
    } else {
      priceEl.placeholder = 'Ingresá el precio manualmente';
      priceEl.style.border = '1px solid var(--accent)';
    }
  } catch (err) {
    console.warn('Auto-fetch precio falló:', err.message);
    priceEl.placeholder = 'Ingresá el precio manualmente';
    priceEl.style.border = '1px solid var(--accent)';
  }
}

// Limpiar flag de auto-fill cuando el usuario edita el precio manualmente
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'shoppingPrice') {
    delete e.target.dataset.autoFilled;
  }
});

export async function analyzeShoppingUrl() {
  const urlEl = document.getElementById('shoppingUrl');
  const url = urlEl ? urlEl.value.trim() : '';
  
  let priceStr = (document.getElementById('shoppingPrice')?.value || '').trim();
  let priceVal = null;
  if (priceStr) {
    // Sanitizar punto de miles si fue ingresado como 194.799
    if (priceStr.includes('.') && !priceStr.includes(',')) {
      const parts = priceStr.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) {
        priceStr = priceStr.replace(/\./g, '');
      }
    } else if (priceStr.includes('.')) {
      priceStr = priceStr.replace(/\./g, '').replace(',', '.');
    }
    priceVal = parseFloat(priceStr) || null;
  }
  const installments = parseInt(document.getElementById('shoppingInstallments')?.value);
  const selectedInstallments = isNaN(installments) ? 0 : installments;
  const discount = parseFloat(document.getElementById('shoppingDiscount')?.value) || 0;
  const tna = parseFloat(document.getElementById('shoppingTna')?.value) || 40;
  
  if (!url) {
    showToast('Por favor, ingresá un link válido de Mercado Libre', true);
    return;
  }
  
  const btn = document.getElementById('shoppingAnalyzeBtn');
  const origContent = btn.innerHTML;
  btn.innerHTML = `<span class="sc-loading-spinner" style="width:18px;height:18px;border-width:2px;border-top-color:transparent;display:inline-block;"></span> Analizando...`;
  btn.disabled = true;
  document.getElementById('shoppingResultsContainer').style.display = 'none';

  try {
    const bodyPayload = {
      url: url,
      installments_without_interest: selectedInstallments,
      discount_percentage: discount,
      custom_tna: tna
    };
    if (priceVal && priceVal > 0) {
      bodyPayload.price = priceVal;
    }

    const data = await apiFetch('/shopping/analyze-url', {
      method: 'POST',
      body: JSON.stringify(bodyPayload)
    });
    
    renderShoppingResults(data);
    
  } catch (err) {
    console.error(err);
    showToast(err.message, true);
    if (err.message && (err.message.includes('precio') || err.message.includes('manual'))) {
      const priceEl = document.getElementById('shoppingPrice');
      if (priceEl) {
        priceEl.style.border = '2px solid var(--amber)';
        priceEl.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.4)';
        priceEl.focus();
        priceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } finally {
    btn.innerHTML = origContent;
    btn.disabled = false;
  }
}

function renderShoppingResults(data) {
  const container = document.getElementById('shoppingResultsContainer');
  const { item, recommendation } = data;
  
  const formatMoney = (val) => '$ ' + parseFloat(val).toLocaleString('es-AR', {minimumFractionDigits: 2});
  
  const winner = recommendation.find(r => r.is_winner);
  const others = recommendation.filter(r => !r.is_winner);
  
  let html = `
    <!-- Producto Card -->
    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px;">
      <div style="width: 52px; height: 52px; background: rgba(0, 229, 160, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0;">
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Producto detectado</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.title}">${item.title}</div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Precio Lista</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text);">${formatMoney(item.price)}</div>
      </div>
    </div>
  `;
  
  if (winner) {
    const savings = winner.nominal_cost - winner.real_cost;
    
    html += `
      <!-- Winner Card -->
      <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        La mejor opción para vos
      </h3>
      
      <div style="background: linear-gradient(145deg, rgba(0, 229, 160, 0.1), rgba(0, 229, 160, 0.02)); border: 1px solid rgba(0, 229, 160, 0.3); border-radius: 16px; padding: 24px; margin-bottom: 24px; position: relative; overflow: hidden;">
        
        <div style="position: relative; z-index: 1;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-block; padding: 4px 10px; background: rgba(0, 229, 160, 0.2); color: var(--accent); border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Recomendado</div>
              <div style="font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 2px;">${winner.account_name}</div>
              <div style="font-size: 13px; color: var(--muted);">${winner.type}</div>
            </div>
            
            <div style="text-align: right;">
              <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">Costo Real Estimado</div>
              <div style="font-size: 28px; font-weight: 800; color: var(--accent);">${formatMoney(winner.real_cost)}</div>
              ${savings > 0 ? `<div style="font-size: 13px; color: var(--accent); font-weight: 600; margin-top: 4px;">Ahorrás ${formatMoney(savings)} vs contado</div>` : ''}
            </div>
          </div>
          
          <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 16px; display: flex; align-items: flex-start; gap: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <svg width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div style="font-size: 13px; color: var(--text); line-height: 1.5;">
              ${winner.reason}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  if (others.length > 0) {
    html += `
      <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 14px;">Otras opciones en tu billetera</h3>
      <div style="display: flex; flex-direction: column; gap: 12px;">
    `;
    
    for (const opt of others) {
      const isViable = opt.is_viable;
      const opacity = isViable ? '1' : '0.6';
      
      html += `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; opacity: ${opacity};">
          <div style="flex: 1;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              ${opt.account_name}
              ${!isViable ? '<span style="font-size: 11px; background: rgba(244,63,94,0.15); color: var(--danger); padding: 2px 8px; border-radius: 4px; font-weight: 600;">No recomendable</span>' : ''}
            </div>
            <div style="font-size: 13px; color: var(--muted);">${opt.reason}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 11px; color: var(--muted); margin-bottom: 2px; text-transform: uppercase;">Costo Real</div>
            <div style="font-size: 16px; font-weight: 700; color: var(--text);">${formatMoney(opt.real_cost)}</div>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
  }
  
  container.innerHTML = html;
  container.style.display = 'block';
}
