import { API_BASE } from '../store/store.js';

export async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const r = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  
  if (r.redirected) {
    throw new Error(`La petición fue redirigida por el servidor a: ${r.url}. Asegúrate de acceder a la app usando la URL exacta configurada en el servidor.`);
  }
  
  let data = null;
  const contentType = r.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await r.json();
    } catch (e) {
      console.warn('Error al decodificar la respuesta JSON del servidor:', e);
    }
  }
  
  if (!r.ok) {
    let errorMsg = `Error de servidor backend (HTTP ${r.status}).`;
    if (data) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        errorMsg = data.detail[0].msg;
      } else if (data.error) {
        errorMsg = data.error + (data.message ? `: ${data.message}` : '');
      }
    }
    throw new Error(errorMsg);
  }
  
  if (data === null) {
    const text = await r.text();
    throw new Error(`Respuesta inválida del servidor (HTTP ${r.status}). Contenido: ${text.slice(0, 150)}...`);
  }
  
  return data;
}
