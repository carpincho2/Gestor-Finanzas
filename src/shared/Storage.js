export class Storage {
  static save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        throw new Error('Almacenamiento lleno: QuotaExceededError');
      }
      throw e;
    }
  }

  static get(key, defaultValue = '[]') {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : JSON.parse(defaultValue);
    } catch (e) {
      console.error('Error leyendo localStorage:', e);
      return JSON.parse(defaultValue);
    }
  }
}
