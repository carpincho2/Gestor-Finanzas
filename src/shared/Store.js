export class Store {
  constructor() {
    this.subscribers = [];
    this.state = {
      transactions: [],
      accounts: [],
      budgets: [],
      stats: {}
    };
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify(change) {
    this.subscribers.forEach(cb => cb(this.state, change));
  }

  setState(newState, changeType = 'update') {
    this.state = { ...this.state, ...newState };
    this.notify(changeType);
  }

  getState() {
    return this.state;
  }
}

export const globalStore = new Store();
