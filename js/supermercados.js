import { apiFetch } from './api/apiClient.js';
import { showToast } from './utils/utils.js';

export async function searchSepa() {
  const input = document.getElementById('sepaSearchInput');
  const query = input.value.trim();
  
  if (!query) {
    showToast("Por favor, ingresá un nombre de producto para buscar", true);
    return;
  }

  const loading = document.getElementById('sepaLoading');
  const errorEl = document.getElementById('sepaError');
  const resultsWrap = document.getElementById('sepaResultsWrap');
  const btn = document.getElementById('sepaSearchBtn');
  
  loading.style.display = 'block';
  errorEl.style.display = 'none';
  resultsWrap.style.display = 'none';
  btn.disabled = true;

  try {
    // Check location permission and get coordinates
    if (!navigator.geolocation) {
      throw new Error("Tu navegador no soporta geolocalización.");
    }

    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Auto-detectar si es EAN o nombre
    const isEan = /^\d{8,14}$/.test(query);

    let res;
    if (isEan) {
      // EAN: usar endpoint original (un solo producto)
      res = await apiFetch(`/precios?ean=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radio=10`);
      // Convertir al formato multi-producto para renderizar igual
      res = convertSingleToMulti(query, res);
    } else {
      // Nombre: usar nuevo endpoint multi-producto
      res = await apiFetch(`/precios/buscar?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radio=10`);
    }

    if (!res || res.total_productos === 0) {
      throw new Error(`No se encontraron productos que coincidan con "${query}".`);
    }
    
    renderMultiProductResults(res);
    
  } catch (error) {
    let msg = error.message;
    if (error.code === 1) {
      msg = "Permiso de ubicación denegado. Necesitamos tu ubicación para mostrar supermercados cercanos.";
    } else if (msg.includes("404") || msg.includes("no encontrado") || msg.includes("coincida")) {
      msg = `🔍 ${msg} <br/><span style="opacity:0.8; font-size:12px; margin-top:4px; display:inline-block;">Tip: Probá buscar con nombres simples como "leche", "coca", "aceite" o "arroz".</span>`;
    }
    errorEl.innerHTML = msg;
    errorEl.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    btn.disabled = false;
  }
}

/**
 * Convierte respuesta del endpoint viejo (1 producto → N sucursales)
 * al formato multi-producto para renderizar con la misma UI.
 */
function convertSingleToMulti(query, data) {
  return {
    query: query,
    total_productos: 1,
    productos: [{
      ean: data.producto?.ean || '',
      nombre: data.producto?.nombre || 'Producto',
      marca: data.producto?.marca || null,
      mejor_precio: data.precio_mas_bajo || 0,
      precio_promedio: data.resultados?.length
        ? data.resultados.reduce((s, r) => s + r.precios.precio_minimo, 0) / data.resultados.length
        : 0,
      total_sucursales: data.total_sucursales || 0,
      sucursales: (data.resultados || []).map(r => ({
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
    }],
  };
}

function renderMultiProductResults(data) {
  const list = document.getElementById('sepaResultsList');
  const count = document.getElementById('sepaResultsCount');
  const queryInfo = document.getElementById('sepaQueryInfo');
  const wrap = document.getElementById('sepaResultsWrap');
  
  list.innerHTML = '';
  count.textContent = `${data.total_productos} producto${data.total_productos !== 1 ? 's' : ''} encontrado${data.total_productos !== 1 ? 's' : ''}`;
  queryInfo.textContent = `Búsqueda: "${data.query}"`;

  if (data.productos.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:13px;">No se encontraron productos con precios disponibles.</div>';
    wrap.style.display = 'block';
    return;
  }

  data.productos.forEach((producto, idx) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.2s;
    `;

    const marca = producto.marca ? ` · ${producto.marca}` : '';
    const mejorPrecio = producto.mejor_precio > 0 ? `$${producto.mejor_precio.toFixed(2)}` : 'Sin precio';
    
    // Header del producto (siempre visible)
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

    // Lista de sucursales (colapsable)
    let sucursalesHtml = '';
    if (producto.sucursales && producto.sucursales.length > 0) {
      const items = producto.sucursales.map(s => {
        const isBest = s.es_mejor;
        let promoHtml = '';
        if (s.promo_tag) {
          promoHtml = `
            <span style="
              display: inline-flex; align-items: center; gap: 4px;
              padding: 2px 8px; background: var(--primary)15; border-radius: 4px;
              font-size: 11px; color: var(--primary); margin-left: 8px;
            ">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              ${s.promo_tag} -${s.ahorro_pct}%
            </span>`;
        }

        let tachadoHtml = '';
        if (s.precio_lista > s.precio_final) {
          tachadoHtml = `<span style="text-decoration:line-through; font-size:12px; color:var(--muted); margin-right:6px;">$${s.precio_lista.toFixed(2)}</span>`;
        }

        return `
          <div style="
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 18px;
            border-top: 1px solid var(--border);
            ${isBest ? 'background: rgba(0, 229, 160, 0.04);' : ''}
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                ${isBest ? '<span style="color: var(--green); font-size: 12px;">🏆</span>' : ''}
                <span style="font-weight: 600; font-size: 14px; color: var(--text);">${s.comercio}</span>
                ${promoHtml}
              </div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                ${s.sucursal || ''} ${s.direccion ? '· ' + s.direccion : ''} · ${s.distancia_km.toFixed(1)} km
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0; margin-left: 12px;">
              ${tachadoHtml}
              <span style="font-size: 17px; font-weight: 800; color: ${isBest ? 'var(--green)' : 'var(--primary)'};">
                $${s.precio_final.toFixed(2)}
              </span>
            </div>
          </div>
        `;
      }).join('');

      sucursalesHtml = `<div class="sepa-sucursales-${idx}" style="display: none;">${items}</div>`;
    }

    card.innerHTML = headerHtml + sucursalesHtml;
    list.appendChild(card);

    // Click handler para expandir/colapsar
    const header = card.querySelector(`.sepa-product-header`);
    header.addEventListener('click', () => {
      const body = card.querySelector(`.sepa-sucursales-${idx}`);
      const chevron = card.querySelector(`.sepa-chevron-${idx}`);
      if (!body) return;

      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      card.style.borderColor = isOpen ? 'var(--border)' : 'var(--primary)';
    });

    // Auto-expandir el primer producto
    if (idx === 0) {
      const body = card.querySelector(`.sepa-sucursales-${idx}`);
      const chevron = card.querySelector(`.sepa-chevron-${idx}`);
      if (body) {
        body.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        card.style.borderColor = 'var(--primary)';
      }
    }
  });

  wrap.style.display = 'block';
}
