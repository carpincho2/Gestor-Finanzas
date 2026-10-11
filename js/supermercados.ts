import {
  SepaService,
  PRESET_CITIES,
  MultiProductResponse,
  SingleProductResponse,
  ProductWithPrices,
} from './services/sepaService.ts';
import { showToast } from './utils/utils.ts';

// Estado de ubicación en memoria
let currentLat = -34.6037;
let currentLng = -58.3816;
let isGpsActive = false;
let currentCityName = 'Buenos Aires (CABA)';

/**
 * Detecta la ubicación del usuario mediante geolocalización del navegador.
 * Si falla o el usuario la deniega, aplica un fallback elegante sin bloquear la app.
 */
export function detectLocation(): void {
  const textEl = document.getElementById('sepaLocationText');
  const coordsEl = document.getElementById('sepaLocationCoords');
  const banner = document.getElementById('sepaLocationBanner');
  const citySelect = document.getElementById('sepaCityPresetSelect') as HTMLSelectElement | null;

  if (!textEl || !banner) return;

  if (!navigator.geolocation) {
    applyFallbackLocation('Ubicación predeterminada: Buenos Aires (CABA)');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      isGpsActive = true;

      if (coordsEl) {
        coordsEl.textContent = `(${currentLat.toFixed(3)}, ${currentLng.toFixed(3)})`;
      }

      const locationName = await SepaService.reverseGeocode(currentLat, currentLng);
      currentCityName = locationName;
      textEl.innerHTML = `📍 Tu ubicación (GPS): <strong style="color:var(--text);">${locationName}</strong>`;
      banner.style.borderColor = 'rgba(0, 229, 160, 0.3)';
      banner.style.background = 'rgba(0, 229, 160, 0.08)';

      if (citySelect) {
        citySelect.value = 'gps';
      }
    },
    () => {
      // Fallback amigable cuando el permiso es denegado o no hay GPS
      applyFallbackLocation('Buenos Aires (CABA)');
      if (citySelect) {
        citySelect.value = 'caba';
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
  );
}

function applyFallbackLocation(name: string): void {
  const textEl = document.getElementById('sepaLocationText');
  const coordsEl = document.getElementById('sepaLocationCoords');
  const banner = document.getElementById('sepaLocationBanner');

  currentLat = -34.6037;
  currentLng = -58.3816;
  isGpsActive = false;
  currentCityName = name;

  if (textEl) {
    textEl.innerHTML = `📍 Ubicación seleccionada: <strong style="color:var(--text);">${name}</strong>`;
  }
  if (coordsEl) {
    coordsEl.textContent = `(${currentLat.toFixed(3)}, ${currentLng.toFixed(3)})`;
  }
  if (banner) {
    banner.style.borderColor = 'rgba(0, 229, 160, 0.2)';
    banner.style.background = 'rgba(0, 229, 160, 0.05)';
  }
}

/**
 * Permite cambiar la ubicación manualmente desde el selector de ciudades argentinas.
 */
export function onCityPresetChange(): void {
  const select = document.getElementById('sepaCityPresetSelect') as HTMLSelectElement | null;
  if (!select) return;

  const val = select.value;
  if (val === 'gps') {
    detectLocation();
    return;
  }

  const mapPresets: Record<string, { lat: number; lng: number; name: string }> = {
    caba: { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires (CABA)' },
    gba_norte: { lat: -34.4716, lng: -58.5284, name: 'GBA Norte (San Isidro)' },
    gba_sur: { lat: -34.7242, lng: -58.2525, name: 'GBA Sur (Quilmes)' },
    gba_oeste: { lat: -34.6534, lng: -58.6198, name: 'GBA Oeste (Morón)' },
    laplata: { lat: -34.9205, lng: -57.9536, name: 'La Plata' },
    rosario: { lat: -32.9468, lng: -60.6393, name: 'Rosario' },
    cordoba: { lat: -31.4201, lng: -64.1888, name: 'Córdoba Capital' },
    mendoza: { lat: -32.8895, lng: -68.8458, name: 'Mendoza' },
    mardelplata: { lat: -38.0055, lng: -57.5562, name: 'Mar del Plata' },
  };

  const chosen = mapPresets[val];
  if (chosen) {
    currentLat = chosen.lat;
    currentLng = chosen.lng;
    isGpsActive = false;
    currentCityName = chosen.name;

    const textEl = document.getElementById('sepaLocationText');
    const coordsEl = document.getElementById('sepaLocationCoords');
    if (textEl) {
      textEl.innerHTML = `📍 Ubicación: <strong style="color:var(--text);">${chosen.name}</strong>`;
    }
    if (coordsEl) {
      coordsEl.textContent = `(${currentLat.toFixed(3)}, ${currentLng.toFixed(3)})`;
    }

    // Si ya hay un producto buscado, refrescar automáticamente
    const input = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
    if (input && input.value.trim().length >= 2) {
      searchSepa();
    }
  }
}

/**
 * Re-ejecuta la búsqueda cuando el usuario cambia el radio, cadena o criterio de ordenamiento.
 */
export function onFilterChange(): void {
  const input = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
  if (input && input.value.trim().length >= 2) {
    searchSepa();
  }
}

/**
 * Búsqueda con un clic mediante los chips de productos esenciales.
 */
export function quickSearchSepa(term: string): void {
  const input = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
  if (input) {
    input.value = term;
    searchSepa();
  }
}

/**
 * Asistente para ingresar o escanear código EAN/GTIN.
 */
export function promptSepaBarcode(): void {
  const input = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
  if (!input) return;

  const ean = prompt('Ingresá el código de barras del producto (8 a 14 dígitos):');
  if (ean && ean.trim()) {
    input.value = ean.trim();
    searchSepa();
  }
}

/**
 * Conecta el producto encontrado en el SEPA directamente con el Asistente de Compras Inteligente.
 */
export function openShoppingFromSepa(nombre: string, precio: number, comercio: string): void {
  const win = window as any;
  if (win.setPage) {
    win.setPage(null, 'shopping');
  }
  if (win.initShopping) {
    win.initShopping();
  }

  setTimeout(() => {
    const priceEl = document.getElementById('shoppingPrice') as HTMLInputElement | null;
    const urlEl = document.getElementById('shoppingUrl') as HTMLInputElement | null;
    const previewBadge = document.getElementById('shoppingTitlePreview');

    if (priceEl) {
      priceEl.value = Math.round(precio).toString();
      priceEl.dataset.autoFilled = 'true';
    }
    if (urlEl) {
      urlEl.value = `${comercio} - ${nombre}`;
    }
    if (previewBadge) {
      previewBadge.innerHTML = `🛒 <strong>${nombre}</strong> <span style="margin-left:6px; color:var(--text); font-weight:700;">($${precio.toLocaleString('es-AR')})</span> en ${comercio}`;
      previewBadge.style.display = 'block';
    }
    if (win.analyzeShoppingUrl) {
      win.analyzeShoppingUrl();
    }
    showToast(`🛒 ${nombre} enviado al Asistente de Compras`);
  }, 120);
}

/**
 * Ejecuta la búsqueda principal de productos en el SEPA.
 */
export async function searchSepa(): Promise<void> {
  const input = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
  if (!input) return;

  const query = input.value.trim();
  if (!query) {
    showToast('Por favor, ingresá un nombre de producto o código EAN para buscar', true);
    return;
  }

  const loading = document.getElementById('sepaLoading');
  const errorEl = document.getElementById('sepaError');
  const resultsWrap = document.getElementById('sepaResultsWrap');
  const btn = document.getElementById('sepaSearchBtn') as HTMLButtonElement | null;
  const radiusSelect = document.getElementById('sepaRadiusSelect') as HTMLSelectElement | null;
  const chainSelect = document.getElementById('sepaChainSelect') as HTMLSelectElement | null;
  const sortSelect = document.getElementById('sepaSortSelect') as HTMLSelectElement | null;

  const radio = radiusSelect ? parseFloat(radiusSelect.value) || 10 : 10;
  const cadena = chainSelect ? chainSelect.value : 'todas';
  const orden = sortSelect ? sortSelect.value : 'precio';

  if (loading) loading.style.display = 'block';
  if (errorEl) errorEl.style.display = 'none';
  if (resultsWrap) resultsWrap.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const isEan = /^\d{8,14}$/.test(query);
    let multiData: MultiProductResponse;

    if (isEan) {
      const singleRes = await SepaService.searchSingleProduct({
        ean: query,
        lat: currentLat,
        lng: currentLng,
        radio: radio,
      });
      multiData = convertSingleToMulti(query, singleRes);
    } else {
      multiData = await SepaService.searchMultiProduct({
        query: query,
        lat: currentLat,
        lng: currentLng,
        radio: radio,
        cadena: cadena,
        orden: orden,
      });
    }

    if (!multiData || multiData.total_productos === 0 || multiData.productos.length === 0) {
      throw new Error(
        `No se encontraron productos para "${query}" en el radio de ${radio} km. ` +
        `Probá ampliando el radio a 25 km o seleccionando otra ciudad cercana.`
      );
    }

    renderMultiProductResults(multiData);
  } catch (error: any) {
    let msg = error?.message || 'Error al buscar productos';
    if (errorEl) {
      errorEl.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <span style="font-size:18px;">🔍</span>
          <div>
            <strong>${msg}</strong>
            <div style="margin-top:8px; font-size:12px; opacity:0.85;">
              Sugerencia: Podés probar con nombres genéricos como "leche", "aceite", "arroz", o ampliar el radio de búsqueda en el menú superior.
            </div>
          </div>
        </div>
      `;
      errorEl.style.display = 'block';
    }
  } finally {
    if (loading) loading.style.display = 'none';
    if (btn) btn.disabled = false;
  }
}

/**
 * Convierte el resultado de producto individual al formato multi-producto.
 */
function convertSingleToMulti(query: string, data: SingleProductResponse): MultiProductResponse {
  const preciosMinimos = (data.resultados || []).map((r) => r.precios.precio_minimo);
  const promedio =
    preciosMinimos.length > 0
      ? preciosMinimos.reduce((a, b) => a + b, 0) / preciosMinimos.length
      : 0;

  return {
    query: query,
    total_productos: 1,
    productos: [
      {
        ean: data.producto?.ean || query,
        nombre: data.producto?.nombre || 'Producto encontrado',
        marca: data.producto?.marca || null,
        mejor_precio: data.precio_mas_bajo || (preciosMinimos[0] ?? 0),
        precio_promedio: Math.round(promedio * 100) / 100,
        total_sucursales: data.total_sucursales || (data.resultados || []).length,
        sucursales: (data.resultados || []).map((r) => ({
          sucursal_id: r.sucursal_id,
          comercio: r.comercio,
          sucursal: r.sucursal,
          direccion: r.direccion,
          lat: r.lat,
          lng: r.lng,
          distancia_km: r.distancia_km,
          precio_lista: r.precios.precio_lista,
          precio_final: r.precios.precio_minimo,
          ahorro_pct: r.precios.ahorro_pct,
          promo_tag: r.precios.promo_bancaria_tag,
          es_mejor: r.es_mejor_valor,
        })),
      },
    ],
  };
}

/**
 * Renderiza los resultados en el DOM.
 */
function renderMultiProductResults(data: MultiProductResponse): void {
  const list = document.getElementById('sepaResultsList');
  const count = document.getElementById('sepaResultsCount');
  const queryInfo = document.getElementById('sepaQueryInfo');
  const wrap = document.getElementById('sepaResultsWrap');

  if (!list || !count || !queryInfo || !wrap) return;

  list.innerHTML = '';
  count.textContent = `${data.total_productos} producto${data.total_productos !== 1 ? 's' : ''} disponible${data.total_productos !== 1 ? 's' : ''}`;
  queryInfo.textContent = `Búsqueda: "${data.query}" en ${currentCityName}`;

  data.productos.forEach((producto: ProductWithPrices, idx: number) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    `;

    const marca = producto.marca ? ` · ${producto.marca}` : '';
    const mejorPrecio =
      producto.mejor_precio > 0 ? `$${producto.mejor_precio.toFixed(2)}` : 'Sin precio';

    // Header del producto
    const headerHtml = `
      <div class="sepa-product-header" data-idx="${idx}" style="
        padding: 16px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
      " onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background='transparent'">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 15px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${producto.nombre}
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
            ${producto.total_sucursales} supermercado${producto.total_sucursales !== 1 ? 's' : ''}${marca}
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0; margin-left: 16px; display: flex; align-items: center; gap: 12px;">
          <div>
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Desde</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--green);">${mejorPrecio}</div>
          </div>
          <svg class="sepa-chevron-${idx}" width="18" height="18" fill="none" stroke="var(--muted)" stroke-width="2" viewBox="0 0 24 24" style="transition: transform 0.25s;">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
    `;

    // Lista de sucursales con acciones interactivas
    let sucursalesHtml = '';
    if (producto.sucursales && producto.sucursales.length > 0) {
      const items = producto.sucursales
        .map((s) => {
          const isBest = s.es_mejor;
          let promoHtml = '';
          if (s.promo_tag) {
            promoHtml = `
            <span style="
              display: inline-flex; align-items: center; gap: 4px;
              padding: 2px 8px; background: rgba(0, 229, 160, 0.12); border-radius: 4px;
              font-size: 11px; font-weight: 600; color: var(--accent); margin-left: 8px;
            ">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              ${s.promo_tag} -${s.ahorro_pct}%
            </span>`;
          }

          let tachadoHtml = '';
          if (s.precio_lista > s.precio_final) {
            tachadoHtml = `<span style="text-decoration:line-through; font-size:12px; color:var(--muted); margin-right:6px;">$${s.precio_lista.toFixed(2)}</span>`;
          }

          const safeNombre = producto.nombre.replace(/'/g, "\\'");
          const safeComercio = s.comercio.replace(/'/g, "\\'");
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

          return `
          <div style="
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
            padding: 14px 18px;
            border-top: 1px solid var(--border);
            ${isBest ? 'background: rgba(0, 229, 160, 0.04);' : ''}
          ">
            <div style="flex: 1; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                ${isBest ? '<span style="color: var(--green); font-size: 13px;" title="Mejor precio de la zona">🏆</span>' : ''}
                <span style="font-weight: 700; font-size: 14px; color: var(--text);">${s.comercio}</span>
                ${promoHtml}
              </div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
                ${s.sucursal || ''} ${s.direccion ? '· ' + s.direccion : ''} · <strong style="color:var(--text);">${s.distancia_km.toFixed(1)} km</strong>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="text-align: right;">
                ${tachadoHtml}
                <span style="font-size: 17px; font-weight: 800; color: ${isBest ? 'var(--green)' : 'var(--accent)'};">
                  $${s.precio_final.toFixed(2)}
                </span>
              </div>

              <!-- Botones de acción directa -->
              <div style="display: flex; gap: 6px;">
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" title="Cómo llegar (Google Maps)" style="padding: 6px 10px; font-size: 11px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                  Mapa
                </a>
                <button type="button" class="btn btn-primary" onclick="openShoppingFromSepa('${safeNombre}', ${s.precio_final}, '${safeComercio}')" title="Calcular finanzas y cuotas con tus tarjetas" style="padding: 6px 10px; font-size: 11px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Calcular Cuotas
                </button>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      sucursalesHtml = `<div class="sepa-sucursales-${idx}" style="display: none;">${items}</div>`;
    }

    card.innerHTML = headerHtml + sucursalesHtml;
    list.appendChild(card);

    // Expandir/colapsar al hacer clic en el encabezado
    const header = card.querySelector('.sepa-product-header');
    if (header) {
      header.addEventListener('click', () => {
        const body = card.querySelector(`.sepa-sucursales-${idx}`) as HTMLElement | null;
        const chevron = card.querySelector(`.sepa-chevron-${idx}`) as HTMLElement | null;
        if (!body) return;

        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (chevron) {
          chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
        card.style.borderColor = isOpen ? 'var(--border)' : 'var(--primary)';
      });
    }

    // Auto-expandir el primer producto encontrado
    if (idx === 0) {
      const body = card.querySelector(`.sepa-sucursales-${idx}`) as HTMLElement | null;
      const chevron = card.querySelector(`.sepa-chevron-${idx}`) as HTMLElement | null;
      if (body) {
        body.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        card.style.borderColor = 'var(--primary)';
      }
    }
  });

  wrap.style.display = 'block';
}

// Cargar cadenas registradas y detectar ubicación inicial
export async function initSepaModule(): Promise<void> {
  detectLocation();

  try {
    const chains = await SepaService.fetchStoreChains();
    const chainSelect = document.getElementById('sepaChainSelect') as HTMLSelectElement | null;
    if (chainSelect && chains.length > 0) {
      const currentVal = chainSelect.value;
      chainSelect.innerHTML = '<option value="todas">Todas las cadenas</option>';
      chains.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.key;
        opt.textContent = c.nombre;
        chainSelect.appendChild(opt);
      });
      chainSelect.value = currentVal || 'todas';
    }
  } catch {
    // Si falla, el select conserva sus opciones por defecto
  }
}

// Inicializar al cargar
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSepaModule());
  } else {
    initSepaModule();
  }
}
