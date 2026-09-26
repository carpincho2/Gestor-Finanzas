/**
 * @typedef {Object} Account
 * @property {number} id
 * @property {number} user_id
 * @property {string} name
 * @property {string} type - 'efectivo', 'banco', 'billetera', 'tarjeta_credito'
 * @property {string|null} bank
 * @property {number} balance
 * @property {string} currency - 'ARS', 'USD', 'EUR', 'BRL', 'UYU'
 * @property {number} limit
 * @property {string|null} notes
 * @property {string|null} mp_token
 */

/**
 * @typedef {Object} Transaction
 * @property {number} id
 * @property {number} user_id
 * @property {number} account_id
 * @property {string} type - 'income' o 'expense'
 * @property {string} desc
 * @property {number} amount
 * @property {string} cat
 * @property {string} date - Formato YYYY-MM-DD
 * @property {string|null} transfer_id
 * @property {string|null} external_id
 */

/**
 * @typedef {Object} Budget
 * @property {number} id
 * @property {number} user_id
 * @property {string} cat
 * @property {number} limit
 * @property {string} color
 */

/**
 * @typedef {Object} Goal
 * @property {number} id
 * @property {number} user_id
 * @property {string} title
 * @property {number} target
 * @property {number} current
 * @property {string} deadline - Formato YYYY-MM-DD
 * @property {string} color
 */

/**
 * @typedef {Object} AppState
 * @property {string|null} currentUserEmail
 * @property {Transaction[]} transactions
 * @property {Account[]} accounts
 * @property {Budget[]} budgets
 * @property {Goal[]} goals
 * @property {any[]} scScanHistory
 * @property {string} currentType
 * @property {string} mCurrentType
 * @property {any} chartInstance
 * @property {string} chartPeriod
 * @property {Budget[]} BUDGETS
 * @property {Record<string, string>} CAT_ICONS
 * @property {Record<string, string>} CAT_COLORS
 */

/**
 * Estado global de la aplicación (Encapsulado mediante JSDoc).
 * @type {AppState}
 */
const _initialState = {
  currentUserEmail: null,
  transactions: [],
  accounts: [],
  budgets: [],
  goals: [],
  scScanHistory: [],
  currentType: 'expense',
  mCurrentType: 'expense',
  chartInstance: null,
  chartPeriod: 'semana',
  
  // Constantes globales de categorías
  BUDGETS: [
    { cat: 'Supermercado / Almacén', limit: 30000, color: '#00e5a0' },
    { cat: 'Salidas / Restaurantes', limit: 15000, color: '#ffb84a' },
    { cat: 'Transporte', limit: 12000, color: '#5b8cff' },
    { cat: 'Hogar / Servicios', limit: 40000, color: '#a78bfa' },
  ],
  CAT_ICONS: {
    'Supermercado / Almacén': '🛒',
    'Salidas / Restaurantes': '🍕',
    'Transporte': '🚗',
    'Hogar / Servicios': '🏠',
    'Entretenimiento / Suscripciones': '🎬',
    'Salud / Farmacia': '💊',
    'Compras / Ropa': '🛍️',
    'Educación': '📚',
    'Ingresos (Sueldo/Freelance)': '💼',
    'Ahorro / Inversiones': '📈',
    'Otros': '📦'
  },
  CAT_COLORS: {
    'Supermercado / Almacén': '#00e5a0',
    'Salidas / Restaurantes': '#ffb84a',
    'Transporte': '#5b8cff',
    'Hogar / Servicios': '#a78bfa',
    'Entretenimiento / Suscripciones': '#ff6b4a',
    'Salud / Farmacia': '#f43f5e',
    'Compras / Ropa': '#ec4899',
    'Educación': '#3b82f6',
    'Ingresos (Sueldo/Freelance)': '#10b981',
    'Ahorro / Inversiones': '#06b6d4',
    'Otros': '#64748b'
  }
};

/**
 * Estado global de la aplicación (Encapsulado mediante JSDoc y Proxy).
 * @type {AppState}
 */
export const state = new Proxy(_initialState, {
  set(target, prop, value) {
    // Validaciones de tipado estricto en tiempo de ejecución (Runtime Type Safety)
    if (prop === 'transactions' || prop === 'accounts' || prop === 'budgets' || prop === 'goals') {
      if (!Array.isArray(value)) {
        console.error(`[Store Error] Se intentó asignar un tipo no-Array a state.${prop}`);
        return false;
      }
    }
    if (prop === 'currentType' && value !== 'expense' && value !== 'income') {
      console.warn(`[Store Warning] Tipo de transacción desconocido: ${value}`);
    }
    
    target[prop] = value;
    return true;
  }
});

export const IS_SERVER = window.location.protocol !== 'file:';
export const API_BASE = IS_SERVER
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://' + window.location.hostname + ':8000/api'
      : window.location.origin + '/api')
  : null;

/**
 * Retorna la clave para localStorage asociada al usuario actual.
 * @param {string} k - Clave base
 * @returns {string} - Clave única por usuario
 */
export function userKey(k) { 
  return state.currentUserEmail ? k + '_' + state.currentUserEmail : k; 
}
