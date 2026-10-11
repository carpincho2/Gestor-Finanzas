import { userKey } from '../store/store.ts';
import { ShoppingListItem } from '../types.ts';

type Listener = (items: ShoppingListItem[]) => void;

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
