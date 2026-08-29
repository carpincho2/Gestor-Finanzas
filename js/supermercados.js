import { apiFetch } from './api/apiClient.js';
import { showToast } from './utils/utils.js';

export async function searchSepa() {
  const input = document.getElementById('sepaSearchInput');
  const query = input.value.trim();
  
  if (!query) {
    showToast("Por favor, ingresá un código EAN o nombre de producto", true);
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

    // Auto-detectar si es EAN (solo dígitos, 8-14 chars) o nombre de producto
    const isEan = /^\d{8,14}$/.test(query);
    const paramKey = isEan ? 'ean' : 'q';
    const encodedQuery = encodeURIComponent(query);

    const res = await apiFetch(`/precios?${paramKey}=${encodedQuery}&lat=${lat}&lng=${lng}&radio=10`);
    
    if (!res || !res.resultados) {
      throw new Error(res?.detail || "No se encontraron resultados.");
    }
    
    renderSepaResults(res);
    
  } catch (error) {
    let msg = error.message;
    if (error.code === 1) {
      msg = "Permiso de ubicación denegado. Necesitamos tu ubicación para mostrar supermercados cercanos.";
    } else if (msg.includes("404") || msg.includes("no encontrado") || msg.includes("coincida")) {
      msg = `🔍 ${msg} <br/><span style="opacity:0.8; font-size:12px; margin-top:4px; display:inline-block;">Tip: Probá buscar con nombres simples como "leche", "coca", "aceite" o mediante el código EAN.</span>`;
    }
    errorEl.innerHTML = msg;
    errorEl.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    btn.disabled = false;
  }
}

function renderSepaResults(data) {
  const list = document.getElementById('sepaResultsList');
  const count = document.getElementById('sepaResultsCount');
  const wrap = document.getElementById('sepaResultsWrap');
  const productInfo = document.getElementById('sepaProductInfo');
  
  list.innerHTML = '';
  count.textContent = `${data.total_sucursales} sucursales encontradas`;

  // Mostrar info del producto encontrado
  if (data.producto) {
    const nombre = data.producto.nombre || '';
    const marca = data.producto.marca ? ` — ${data.producto.marca}` : '';
    productInfo.textContent = `${nombre}${marca}`;
  }
  
  if (data.resultados.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:13px;">No hay sucursales con este producto a menos de 10km.</div>';
    wrap.style.display = 'block';
    return;
  }

  data.resultados.forEach(item => {
    const isBest = item.es_mejor_valor;
    const p = item.precios;
    
    let promoHtml = '';
    if (p.promo_bancaria_tag) {
      promoHtml = `
        <div style="margin-top:12px; padding:8px 10px; background:var(--primary)15; border-radius:6px; border:1px solid var(--primary)30; font-size:12px; color:var(--primary); display:flex; align-items:center; gap:8px;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          Incluye promo ${p.promo_bancaria_tag} (-${p.ahorro_pct}%)
        </div>
      `;
    }

    let tachadoHtml = '';
    if (p.precio_lista > p.precio_minimo) {
      tachadoHtml = `<span style="text-decoration:line-through; font-size:13px; color:var(--muted); margin-right:8px;">$${p.precio_lista.toFixed(2)}</span>`;
    }

    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--surface2);
      border: 1px solid ${isBest ? 'var(--green)' : 'var(--border)'};
      border-radius: 12px;
      padding: 16px;
      position: relative;
    `;
    
    let bestBadge = '';
    if (isBest) {
      bestBadge = `<div style="position:absolute; top:-10px; right:16px; background:var(--green); color:#000; font-size:11px; font-weight:700; padding:4px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">Mejor Opción</div>`;
    }

    card.innerHTML = `
      ${bestBadge}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        <div>
          <div style="font-weight:700; font-size:16px; color:var(--text); margin-bottom:4px;">${item.comercio}</div>
          <div style="font-size:12px; color:var(--muted);">${item.sucursal} • ${item.direccion}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;">A ${item.distancia_km.toFixed(1)} km</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Precio Final</div>
          <div>
            ${tachadoHtml}
            <span style="font-size:20px; font-weight:800; color:${isBest ? 'var(--green)' : 'var(--primary)'};">$${p.precio_minimo.toFixed(2)}</span>
          </div>
        </div>
      </div>
      ${promoHtml}
    `;
    list.appendChild(card);
  });

  wrap.style.display = 'block';
}
