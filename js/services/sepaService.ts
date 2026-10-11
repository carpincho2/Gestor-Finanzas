import { apiFetch } from '../api/apiClient.ts';

export interface StoreSummary {
  sucursal_id: number;
  comercio: string;
  sucursal: string | null;
  direccion: string | null;
  lat: number;
  lng: number;
  distancia_km: number;
  precio_lista: number;
  precio_final: number;
  ahorro_pct: number;
  promo_tag: string | null;
  es_mejor: boolean;
}

export interface ProductWithPrices {
  ean: string;
  nombre: string;
  marca: string | null;
  mejor_precio: number;
  precio_promedio: number;
  total_sucursales: number;
  sucursales: StoreSummary[];
}

export interface MultiProductResponse {
  query: string;
  total_productos: number;
  productos: ProductWithPrices[];
}

export interface SingleStoreDetail {
  sucursal_id: number;
  comercio: string;
  sucursal: string | null;
  direccion: string | null;
  localidad: string | null;
  lat: number;
  lng: number;
  distancia_km: number;
  precios: {
    precio_lista: number;
    precio_promo_a: number | null;
    precio_promo_b: number | null;
    precio_bancario: number | null;
    precio_minimo: number;
    promo_bancaria_desc: string | null;
    promo_bancaria_tag: string | null;
    ahorro_pct: number;
  };
  valor_total: number;
  es_precio_mas_bajo: boolean;
  es_mejor_valor: boolean;
}

export interface SingleProductResponse {
  producto: {
    ean?: string;
    nombre?: string;
    marca?: string | null;
  };
  total_sucursales: number;
  precio_mas_bajo: number;
  precio_mas_alto: number;
  resultados: SingleStoreDetail[];
}

export interface StoreChain {
  key: string;
  nombre: string;
}

export interface CityLocation {
  name: string;
  lat: number;
  lng: number;
}

export const PRESET_CITIES: CityLocation[] = [
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
  static async searchMultiProduct(params: {
    query: string;
    lat: number;
    lng: number;
    radio?: number;
    cadena?: string;
    orden?: string;
  }): Promise<MultiProductResponse> {
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
  static async searchSingleProduct(params: {
    ean?: string;
    query?: string;
    lat: number;
    lng: number;
    radio?: number;
  }): Promise<SingleProductResponse> {
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
  static async fetchStoreChains(): Promise<StoreChain[]> {
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
  static async fetchPopularSuggestions(): Promise<string[]> {
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
  static async reverseGeocode(lat: number, lng: number): Promise<string> {
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
