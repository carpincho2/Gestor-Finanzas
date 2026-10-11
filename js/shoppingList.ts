import {
  ShoppingListService,
  FullBasketComparisonResult,
} from './services/shoppingListService.ts';
import { ShoppingListItem } from './types.ts';
import { showToast } from './utils/utils.ts';

/**
 * Inicializa y renderiza la vista completa de la Lista de Compras.
 */
export function initShoppingListView(): void {
  renderShoppingList();
}

/**
 * Agrega un nuevo ítem a la lista desde el formulario.
 */
export function addShoppingListItem(): void {
  const input = document.getElementById('shoppingItemInput') as HTMLInputElement | null;
  const qtyInput = document.getElementById('shoppingItemQty') as HTMLInputElement | null;
  const catSelect = document.getElementById('shoppingItemCat') as HTMLSelectElement | null;

  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    showToast('Por favor, ingresá el nombre del producto que necesitás', true);
    input.focus();
    return;
  }

  const qty = qtyInput && qtyInput.value.trim() ? qtyInput.value.trim() : '1';
  const cat = catSelect && catSelect.value ? catSelect.value : 'Almacén';

  try {
    ShoppingListService.addItem(name, qty, cat);
    input.value = '';
    if (qtyInput) qtyInput.value = '1';
    input.focus();
    renderShoppingList();
    showToast(`🛒 "${name}" agregado a tu lista de compras`);
  } catch (err: any) {
    showToast(err.message || 'Error al agregar el ítem', true);
  }
}

/**
 * Alterna el estado de comprado/pendiente de un producto.
 */
export function toggleShoppingListItem(id: string): void {
  ShoppingListService.toggleItem(id);
  renderShoppingList();
}

/**
 * Elimina un producto de la lista.
 */
export function removeShoppingListItem(id: string): void {
  ShoppingListService.removeItem(id);
  renderShoppingList();
  showToast('Ítem eliminado de la lista');
}

/**
 * Elimina todos los ítems marcados como completados.
 */
export function clearCompletedShoppingList(): void {
  ShoppingListService.clearCompleted();
  renderShoppingList();
  showToast('Ítems completados eliminados');
}

/**
 * Carga una canasta básica temática en la lista.
 */
export function addShoppingPreset(preset: 'basica' | 'limpieza' | 'desayuno'): void {
  ShoppingListService.addPreset(preset);
  renderShoppingList();
  showToast(`✅ Canasta "${preset}" agregada a tu lista`);
}

/**
 * Conexión directa con el Buscador SEPA:
 * Abre la sección SEPA y ejecuta la búsqueda inmediata de este ítem en los supermercados cercanos.
 */
export function searchItemInSepa(itemName: string): void {
  const win = window as any;
  if (win.setPage) {
    const navItem = document.getElementById('navSupermercadosItem');
    win.setPage(navItem, 'supermercados');
  }

  setTimeout(() => {
    const searchInput = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = itemName;
    }
    if (win.searchSepa) {
      win.searchSepa();
    }
    showToast(`🔍 Buscando mejores precios para "${itemName}"`);
  }, 100);
}

/**
 * Compara toda la lista de compras activa en el Buscador SEPA.
 */
export function compareEntireListInSepa(): void {
  const activeItems = ShoppingListService.getActiveItems();
  if (activeItems.length === 0) {
    showToast('Tu lista de compras no tiene productos pendientes para comparar', true);
    return;
  }

  const win = window as any;
  if (win.setPage) {
    const navItem = document.getElementById('navSupermercadosItem');
    win.setPage(navItem, 'supermercados');
  }

  setTimeout(() => {
    // Si hay un primer ítem, iniciar la búsqueda con él
    const firstItem = activeItems[0];
    const searchInput = document.getElementById('sepaSearchInput') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = firstItem.name;
    }
    if (win.searchSepa) {
      win.searchSepa();
    }
    showToast(`🛒 Comparando "${firstItem.name}" y productos de tu lista en SEPA`);
  }, 100);
}

/**
 * Calcula la optimización de changuito completo y split shopping para toda la lista.
 */
export async function calculateBasketOptimization(): Promise<void> {
  const panel = document.getElementById('shoppingBasketPanel');
  const btn = document.getElementById('shoppingBasketCalcBtn') as HTMLButtonElement | null;
  const content = document.getElementById('shoppingBasketContent');

  if (!panel || !content) return;

  const activeItems = ShoppingListService.getActiveItems();
  if (activeItems.length === 0) {
    showToast('Tu lista no tiene productos pendientes para cotizar', true);
    return;
  }

  panel.style.display = 'block';
  content.innerHTML = `
    <div style="text-align: center; padding: 24px; color: var(--muted); font-size: 13px;">
      <div class="sc-loading-spinner" style="width: 24px; height: 24px; margin: 0 auto 10px; border-width: 2px;"></div>
      Cotizando ${activeItems.length} producto${activeItems.length !== 1 ? 's' : ''} en supermercados cercanos...
    </div>
  `;
  if (btn) btn.disabled = true;

  try {
    const res = await ShoppingListService.compareFullBasket();
    if (!res || res.cadenas.length === 0) {
      content.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--muted); font-size: 13px;">
          No se encontraron precios en la zona para los productos de tu lista. Probá buscando nombres más genéricos (ej: "leche", "aceite").
        </div>
      `;
      return;
    }

    renderBasketComparisonResult(res);
  } catch (err: any) {
    content.innerHTML = `
      <div style="padding: 14px; color: var(--danger); font-size: 13px;">
        Error al cotizar la canasta: ${err.message || 'Error de conexión'}
      </div>
    `;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderBasketComparisonResult(res: FullBasketComparisonResult): void {
  const content = document.getElementById('shoppingBasketContent');
  if (!content) return;

  const chainsHtml = res.cadenas
    .map((c, idx) => {
      const isWinner = idx === 0;
      return `
        <div style="
          padding: 12px 14px;
          background: ${isWinner ? 'rgba(0, 229, 160, 0.08)' : 'var(--surface2)'};
          border: 1px solid ${isWinner ? 'rgba(0, 229, 160, 0.4)' : 'var(--border)'};
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        ">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 6px;">
              ${isWinner ? '🏆' : `${idx + 1}.`} <span>${c.comercio}</span>
              ${isWinner ? '<span class="badge" style="background: rgba(0, 229, 160, 0.2); color: var(--accent); font-size: 10px; padding: 2px 6px;">Mejor opción única</span>' : ''}
            </div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
              ${c.productosEncontrados} de ${c.totalProductos} productos encontrados
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 800; color: ${isWinner ? 'var(--green)' : 'var(--text)'};">
              $${c.totalEstimado.toLocaleString('es-AR')}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  let splitHtml = '';
  if (res.ahorroDividido > 0 && res.itemsDivididos.length > 1) {
    const details = res.itemsDivididos
      .map(
        (i) =>
          `<span style="display:inline-block; margin-right:8px; margin-bottom:4px; font-size:11px; background:var(--surface); border:1px solid var(--border); padding:2px 8px; border-radius:6px;"><strong>${i.producto}</strong> en ${i.mejorComercio} ($${i.mejorPrecio.toLocaleString('es-AR')})</span>`
      )
      .join('');

    splitHtml = `
      <div style="
        margin-top: 14px;
        padding: 14px;
        background: rgba(34, 197, 94, 0.06);
        border: 1px dashed rgba(34, 197, 94, 0.35);
        border-radius: 10px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
          <div style="font-weight: 700; font-size: 13px; color: #22c55e; display: flex; align-items: center; gap: 6px;">
            <span>⚡</span> Estrategia de Compra Dividida (Split Shopping)
          </div>
          <div style="font-weight: 800; font-size: 15px; color: #22c55e;">
            $${res.totalCompraDividida.toLocaleString('es-AR')}
            <span style="font-size: 11px; opacity: 0.85;">(Ahorrás $${res.ahorroDividido.toLocaleString('es-AR')} extra)</span>
          </div>
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
          Si dividís la compra entre los comercios más baratos para cada producto:
        </div>
        <div>${details}</div>
      </div>
    `;
  }

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${chainsHtml}
    </div>
    ${splitHtml}
  `;
}

/**
 * Renderiza el DOM de la lista de compras.
 */
function renderShoppingList(): void {
  const items = ShoppingListService.getItems();
  const activeContainer = document.getElementById('shoppingActiveList');
  const completedContainer = document.getElementById('shoppingCompletedList');
  const completedSection = document.getElementById('shoppingCompletedSection');
  const countBadge = document.getElementById('shoppingPendingCount');
  const clearBtn = document.getElementById('shoppingClearCompletedBtn');

  if (!activeContainer) return;

  const activeItems = items.filter((i) => !i.completed);
  const completedItems = items.filter((i) => i.completed);

  if (countBadge) {
    countBadge.textContent = `${activeItems.length} pendiente${activeItems.length !== 1 ? 's' : ''}`;
  }

  if (clearBtn) {
    clearBtn.style.display = completedItems.length > 0 ? 'inline-flex' : 'none';
  }

  if (completedSection) {
    completedSection.style.display = completedItems.length > 0 ? 'block' : 'none';
  }

  // Renderizar ítems pendientes
  if (activeItems.length === 0) {
    activeContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted); background: var(--surface2); border: 1px dashed var(--border); border-radius: 14px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🛒</div>
        <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px;">No tenés productos pendientes</div>
        <div style="font-size: 13px;">Agregá lo que te falte comprar arriba o elegí una canasta básica sugerida.</div>
      </div>
    `;
  } else {
    activeContainer.innerHTML = activeItems
      .map((item) => createItemCardHtml(item))
      .join('');
  }

  // Renderizar ítems completados
  if (completedContainer && completedItems.length > 0) {
    completedContainer.innerHTML = completedItems
      .map((item) => createItemCardHtml(item))
      .join('');
  }
}

function createItemCardHtml(item: ShoppingListItem): string {
  const isDone = item.completed;
  const safeName = item.name.replace(/'/g, "\\'");

  const categoryEmojis: Record<string, string> = {
    Lácteos: '🥛',
    Almacén: '🌾',
    Bebidas: '🥤',
    Limpieza: '🧼',
    Desayuno: '☕',
    Carnicería: '🥩',
    Verdulería: '🥑',
    Otros: '📦',
  };

  const emoji = categoryEmojis[item.category || ''] || '🛒';

  return `
    <div class="shopping-item-card" style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 8px;
      opacity: ${isDone ? '0.6' : '1'};
      transition: all 0.2s ease;
    ">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
        <input
          type="checkbox"
          ${isDone ? 'checked' : ''}
          onchange="toggleShoppingListItem('${item.id}')"
          style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;"
        />
        <div style="font-size: 20px; line-height: 1;">${emoji}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 14px;
            font-weight: 600;
            color: var(--text);
            text-decoration: ${isDone ? 'line-through' : 'none'};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${item.name}
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            Cant: <strong style="color:var(--text);">${item.quantity || '1'}</strong> · ${item.category || 'Almacén'}
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        ${
          !isDone
            ? `
          <button
            type="button"
            class="btn btn-secondary"
            onclick="searchItemInSepa('${safeName}')"
            title="Comparar mejores precios en supermercados SEPA"
            style="padding: 6px 10px; font-size: 11px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px; color: var(--accent); border-color: rgba(0, 229, 160, 0.3);"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Precios SEPA
          </button>
        `
            : ''
        }

        <button
          type="button"
          class="btn btn-ghost"
          onclick="removeShoppingListItem('${item.id}')"
          title="Eliminar de la lista"
          style="padding: 6px; font-size: 12px; color: var(--muted); border-radius: 8px;"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}
