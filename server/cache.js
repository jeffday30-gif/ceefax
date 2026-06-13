// In-memory key/payload cache. Replaces the SQLite store from the original
// spec - on Render free the disk is ephemeral anyway, so SQLite would just
// be an in-memory store with extra steps. Cold-start scrapers repopulate.

class Cache {
  constructor() {
    this.store = new Map();
  }

  set(key, payload) {
    this.store.set(key, { payload, fetchedAt: Date.now() });
  }

  get(key) {
    return this.store.get(key);
  }

  has(key) {
    return this.store.has(key);
  }

  payload(key) {
    const entry = this.store.get(key);
    return entry ? entry.payload : null;
  }

  age(key) {
    const entry = this.store.get(key);
    return entry ? Date.now() - entry.fetchedAt : Infinity;
  }
}

module.exports = new Cache();
