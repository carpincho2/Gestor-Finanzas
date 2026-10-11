import { userKey } from '../store/store.ts';
import { ShoppingListItem } from '../types.ts';
import { SepaService } from './sepaService.ts';

type Listener = (items: ShoppingListItem[]) => void;

export interface BasketSummaryByChain {
  comercio: string;
  totalEstimado: number;
  productosEncontrados: number;
  totalProductos: number;
  esMasBarato: boolean;
  detalles: Array<{ producto: string; precio: number }>;
}

export interface FullBasketComparisonResult {
  totalProductos: number;
  supermercadoGanador: BasketSummaryByChain | null;
  cadenas: BasketSummaryByChain[];
  totalCompraDividida: number;
  ahorroDividido: number;
  ahorroDivididoPct: number;
  itemsDivididos: Array<{ producto: string; mejorComercio: string; mejorPrecio: number }>;
}

export class ShoppingListService {
  private static listeners: Listener[] = [];

  private static getStorageKey(): string {
    return userKey('flujo_shopping_list');
  }

  /**
   * Obtiene todos los ítems de la lista de compras del usuario.
   */
  static getItems(): ShoppingListItem[] {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (!data) {
        // Semilla inicial amigable si es la primera vez que se usa
        const defaultItems: ShoppingListItem[] = [
          { id: 'item_1', name: 'Leche entera', quantity: '2L', category: 'Lácteos', completed: false, addedAt: new Date().toISOString() },
          { id: 'item_2', name: 'Aceite de girasol', quantity: '1 botella', category: 'Almacén', completed: false, addedAt: new Date().toISOString() },
          { id: 'item_3', name: 'Yerba mate', quantity: '1kg', category: 'Almacén', completed: false, addedAt: new Date().toISOString() }
        ];
        this.saveItems(defaultItems);
        return defaultItems;
      }
      return JSON.parse(data) || [];
    } catch {
      return [];
    }
  }

  /**
   * Obtiene únicamente los ítems pendientes (no comprados).
   */
  static getActiveItems(): ShoppingListItem[] {
    return this.getItems().filter(item => !item.completed);
  }

  /**
   * Agrega un nuevo ítem a la lista de compras.
   */
  static addItem(name: string, quantity: string = '1', category: string = 'Almacén'): ShoppingListItem {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('El nombre del producto no puede estar vacío');
    }

    const items = this.getItems();
    // Si ya existe activo, actualizamos la cantidad
    const existingIndex = items.findIndex(
      i => i.name.toLowerCase() === trimmed.toLowerCase() && !i.completed
    );

    let createdOrUpdated: ShoppingListItem;

    if (existingIndex > -1) {
      items[existingIndex].quantity = quantity || items[existingIndex].quantity;
      createdOrUpdated = items[existingIndex];
    } else {
      createdOrUpdated = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed,
        quantity: quantity.trim() || '1',
        category: category || 'Almacén',
        completed: false,
        addedAt: new Date().toISOString(),
      };
      items.unshift(createdOrUpdated);
    }

    this.saveItems(items);
    return createdOrUpdated;
  }

  /**
   * Alterna el estado de comprado/pendiente de un ítem.
   */
  static toggleItem(id: string): void {
    const items = this.getItems();
    const item = items.find(i => i.id === id);
    if (item) {
      item.completed = !item.completed;
      this.saveItems(items);
    }
  }

  /**
   * Elimina un ítem específico de la lista.
   */
  static removeItem(id: string): void {
    const items = this.getItems().filter(i => i.id !== id);
    this.saveItems(items);
  }

  /**
   * Elimina todos los ítems marcados como completados.
   */
  static clearCompleted(): void {
    const items = this.getItems().filter(i => !i.completed);
    this.saveItems(items);
  }

  /**
   * Vacía toda la lista de compras.
   */
  static clearAll(): void {
    this.saveItems([]);
  }

  /**
   * Carga una canasta básica rápida según la temática.
   */
  static addPreset(presetName: 'basica' | 'limpieza' | 'desayuno'): void {
    const presets: Record<string, Array<{ name: string; quantity: string; category: string }>> = {
      basica: [
        { name: 'Leche entera', quantity: '2L', category: 'Lácteos' },
        { name: 'Aceite de girasol', quantity: '1 botella', category: 'Almacén' },
        { name: 'Arroz largo fino', quantity: '1kg', category: 'Almacén' },
        { name: 'Fideos guiseros', quantity: '2 paquetes', category: 'Almacén' },
        { name: 'Harina 000', quantity: '1kg', category: 'Almacén' },
      ],
      limpieza: [
        { name: 'Detergente para vajilla', quantity: '1 botella', category: 'Limpieza' },
        { name: 'Lavandina común', quantity: '1L', category: 'Limpieza' },
        { name: 'Jabón líquido para ropa', quantity: '3L', category: 'Limpieza' },
        { name: 'Papel higiénico', quantity: '4 rollos', category: 'Limpieza' },
      ],
      desayuno: [
        { name: 'Café tostado molido', quantity: '250g', category: 'Desayuno' },
        { name: 'Yerba mate suave', quantity: '1kg', category: 'Desayuno' },
        { name: 'Azúcar común', quantity: '1kg', category: 'Almacén' },
        { name: 'Galletitas de agua', quantity: '3 paquetes', category: 'Desayuno' },
      ],
    };

    const toAdd = presets[presetName] || [];
    toAdd.forEach(p => {
      this.addItem(p.name, p.quantity, p.category);
    });
  }

  /**
   * Realiza la comparativa de la canasta completa de productos activos en supermercados cercanos.
   * Calcula el total acumulado por cadena y la estrategia de compra dividida (split shopping).
   */
  static async compareFullBasket(
    lat: number = -34.6037,
    lng: number = -58.3816,
    radio: number = 10
  ): Promise<FullBasketComparisonResult | null> {
    const activeItems = this.getActiveItems();
    if (activeItems.length === 0) return null;

    // Buscar precios para cada producto en paralelo
    const queries = activeItems.map(async (item) => {
      try {
        const res = await SepaService.searchMultiProduct({
          query: item.name,
          lat,
          lng,
          radio,
        });
        if (res && res.productos && res.productos.length > 0) {
          return {
            item,
            product: res.productos[0],
          };
        }
      } catch (err) {
        console.warn(`No se pudo cotizar ${item.name}:`, err);
      }
      return { item, product: null };
    });

    const results = await Promise.all(queries);

    // Mapear por comercio/cadena
    const chainTotals: Record<string, { total: number; count: number; items: Array<{ producto: string; precio: number }> }> = {};
    const splitItems: Array<{ producto: string; mejorComercio: string; mejorPrecio: number }> = [];

    results.forEach(({ item, product }) => {
      if (!product || !product.sucursales || product.sucursales.length === 0) {
        return;
      }

      // Mejor precio global para split shopping
      let bestPrice = Infinity;
      let bestStore = '';

      // Registrar el mejor precio de este producto en cada cadena
      const chainMinForProduct: Record<string, number> = {};

      product.sucursales.forEach((s) => {
        const chainName = s.comercio;
        if (!chainMinForProduct[chainName] || s.precio_final < chainMinForProduct[chainName]) {
          chainMinForProduct[chainName] = s.precio_final;
        }

        if (s.precio_final < bestPrice) {
          bestPrice = s.precio_final;
          bestStore = s.comercio;
        }
      });

      if (bestPrice < Infinity) {
        splitItems.push({
          producto: item.name,
          mejorComercio: bestStore,
          mejorPrecio: bestPrice,
        });
      }

      for (const [chainName, price] of Object.entries(chainMinForProduct)) {
        if (!chainTotals[chainName]) {
          chainTotals[chainName] = { total: 0, count: 0, items: [] };
        }
        chainTotals[chainName].total += price;
        chainTotals[chainName].count += 1;
        chainTotals[chainName].items.push({ producto: item.name, precio: price });
      }
    });

    const totalCompraDividida = splitItems.reduce((acc, i) => acc + i.mejorPrecio, 0);

    const cadenas: BasketSummaryByChain[] = Object.entries(chainTotals).map(([comercio, data]) => ({
      comercio,
      totalEstimado: Math.round(data.total * 100) / 100,
      productosEncontrados: data.count,
      totalProductos: activeItems.length,
      esMasBarato: false,
      detalles: data.items,
    }));

    // Ordenar cadenas por mayor cantidad de productos y menor precio
    cadenas.sort((a, b) => {
      if (b.productosEncontrados !== a.productosEncontrados) {
        return b.productosEncontrados - a.productosEncontrados;
      }
      return a.totalEstimado - b.totalEstimado;
    });

    if (cadenas.length > 0) {
      cadenas[0].esMasBarato = true;
    }

    const ganador = cadenas.length > 0 ? cadenas[0] : null;
    const baseTotal = ganador ? ganador.totalEstimado : totalCompraDividida;
    const ahorroDividido = Math.max(0, Math.round((baseTotal - totalCompraDividida) * 100) / 100);
    const ahorroDivididoPct = baseTotal > 0 ? Math.round((ahorroDividido / baseTotal) * 100) : 0;

    return {
      totalProductos: activeItems.length,
      supermercadoGanador: ganador,
      cadenas,
      totalCompraDividida: Math.round(totalCompraDividida * 100) / 100,
      ahorroDividido,
      ahorroDivididoPct,
      itemsDivididos: splitItems,
    };
  }

  /**
   * Suscribe un callback a cualquier modificación en la lista.
   */
  static subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private static saveItems(items: ShoppingListItem[]): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
    this.notifyListeners(items);
  }

  private static notifyListeners(items: ShoppingListItem[]): void {
    this.listeners.forEach(fn => {
      try {
        fn(items);
      } catch (e) {
        console.error('Error en listener de shopping list:', e);
      }
    });
  }
}
