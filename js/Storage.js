export class Storage {
  static save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  static get(key, defaultValue = '[]') {
    return JSON.parse(localStorage.getItem(key) || defaultValue);
  }
}
