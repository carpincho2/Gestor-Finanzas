// @ts-nocheck
import { apiFetch } from '../api/apiClient.ts';

export const PRESET_CITIES = [
  { name: 'Buenos Aires (CABA)', lat: -34.6037, lng: -58.3816 },
  { name: 'GBA Norte (San Isidro)', lat: -34.4716, lng: -58.5284 },
  { name: 'GBA Sur (Quilmes)', lat: -34.7242, lng: -58.2525 },
  { name: 'GBA Oeste (Morón)', lat: -34.6534, lng: -58.6198 },
  { name: 'La Plata', lat: -34.9205, lng: -57.9536 },
  { name: 'Rosario', lat: -32.9468, lng: -60.6393 },
  { name: 'Córdoba Capital', lat: -31.4201, lng: -64.1888 },
  { name: 'Mendoza', lat: -32.8895, lng: -68.8458 },
  { name: 'Mar del Plata', lat: -38.0055, lng: -57.5562 },
];

export class SepaService {
  /**
   * Busca productos por nombre con filtros de radio, cadena y ordenamiento.
   */
  static async searchMultiProduct(params) {
    const qParams = new URLSearchParams({
      q: params.query,
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radio: (params.radio || 10).toString(),
    });

    if (params.cadena && params.cadena !== 'todas') {
      qParams.append('cadena', params.cadena);
    }
    if (params.orden) {
      qParams.append('orden', params.orden);
    }

    return await apiFetch(`/precios/buscar?${qParams.toString()}`);
  }

  /**
   * Busca precios de un único producto por EAN o consulta específica con cálculo de costo de viaje.
   */
  static async searchSingleProduct(params) {
    const qParams = new URLSearchParams({
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radio: (params.radio || 10).toString(),
    });

    if (params.ean) qParams.append('ean', params.ean);
    if (params.query) qParams.append('q', params.query);

    return await apiFetch(`/precios?${qParams.toString()}`);
  }

  /**
   * Obtiene la lista de cadenas de supermercados registradas.
   */
  static async fetchStoreChains() {
    try {
      const data = await apiFetch('/precios/comercios');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        { key: 'coto', nombre: 'Coto' },
        { key: 'carrefour', nombre: 'Carrefour' },
        { key: 'dia', nombre: 'Día' },
        { key: 'jumbo', nombre: 'Jumbo' },
        { key: 'changomas', nombre: 'ChangoMás' },
      ];
    }
  }

  /**
   * Obtiene sugerencias rápidas de la canasta básica.
   */
  static async fetchPopularSuggestions() {
    try {
      const data = await apiFetch('/precios/sugerencias');
      return Array.isArray(data) ? data : [];
    } catch {
      return ['Leche', 'Aceite', 'Café', 'Yerba', 'Arroz', 'Fideos', 'Azúcar'];
    }
  }

  /**
   * Geocodificación inversa con OpenStreetMap Nominatim.
   */
  static async reverseGeocode(lat, lng) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=es`,
        { headers: { 'User-Agent': 'GestorFinanzas/1.0' } }
      );
      if (!resp.ok) return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      const data = await resp.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.state ||
        'Ubicación detectada';
      const state = data.address?.state || '';
      return state && state !== city ? `${city}, ${state}` : city;
    } catch {
      return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    }
  }
}
