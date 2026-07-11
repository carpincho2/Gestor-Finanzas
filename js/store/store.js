export const state = {
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

export const IS_SERVER = window.location.protocol !== 'file:';
export const API_BASE = IS_SERVER
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://' + window.location.hostname + ':8000/api'
      : window.location.origin + '/api')
  : null;

export function userKey(k) { 
  return state.currentUserEmail ? k + '_' + state.currentUserEmail : k; 
}
