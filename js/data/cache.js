(function () {

// Cache: namespaced map-of-rows over chrome.storage.local.
// Each synced entity ('user_courses', 'tracker_cells', ...) lives under
// a 'cache:<entity>' key as { rowId: rowObject }.
// Every row MUST have `.id` — used as the map key.

const PREFIX = 'cache:';

function _key(entity) {
  return PREFIX + entity;
}

function _get(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (data) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(data[key] || {});
    });
  });
}

function _set(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

const cache = {
  async getAll(entity) {
    return _get(_key(entity));
  },

  async get(entity, id) {
    const all = await _get(_key(entity));
    return all[id] || null;
  },

  async upsert(entity, row) {
    if (!row.id) throw new Error('cache.upsert: row.id is required');
    const all = await _get(_key(entity));
    all[row.id] = row;
    await _set(_key(entity), all);
  },

  async upsertMany(entity, rows) {
    const all = await _get(_key(entity));
    for (const row of rows) {
      if (!row.id) throw new Error('cache.upsertMany: row.id is required');
      all[row.id] = row;
    }
    await _set(_key(entity), all);
  },

  async delete(entity, id) {
    const all = await _get(_key(entity));
    delete all[id];
    await _set(_key(entity), all);
  },

  async clear(entity) {
    await _set(_key(entity), {});
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cache };
}
globalThis.cache = cache;

})();
