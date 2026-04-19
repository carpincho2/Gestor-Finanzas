export class Budget {
  constructor({ id, cat, name, icon, limit, color, notes }) {
    this.id = id || Date.now();
    this.cat = cat;
    this.name = name || cat;
    this.icon = icon || '📦';
    this.limit = Number(limit);
    this.color = color || '#8a94a6';
    this.notes = notes || '';
  }

  isValid() {
    return this.name && this.name.trim().length > 0 && !isNaN(this.limit) && this.limit > 0;
  }
}
