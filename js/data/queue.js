(function () {

// Persistent FIFO of pending cloud writes. Stored in chrome.storage.local.syncQueue.
// Survives service worker restart. Flushed by sync.js.
//
// Entry shape: {
//   id: string,              // random, for remove()
//   enqueuedAt: number,      // Date.now() when queued
//   table: string,           // supabase table name
//   op: 'upsert' | 'delete', // operation type
//   row: object,             // full row payload (includes id, updated_at set by caller)
//   attempts: number,        // incremented on each failure
//   nextAttemptAt: number,   // earliest time to retry (ms since epoch)
// }

const QUEUE_KEY = 'syncQueue';
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function _randomId() {
  // Good enough for queue entry IDs; not security-sensitive
  return 'q_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function _get() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(QUEUE_KEY, (data) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(Array.isArray(data[QUEUE_KEY]) ? data[QUEUE_KEY] : []);
    });
  });
}

function _set(list) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [QUEUE_KEY]: list }, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

const queue = {
  async getAll() {
    return _get();
  },

  async enqueue({ table, op, row }) {
    if (!table || !op || !row) throw new Error('queue.enqueue: table, op, row are required');
    const entries = await _get();
    const id = _randomId();
    entries.push({
      id,
      enqueuedAt: Date.now(),
      table,
      op,
      row,
      attempts: 0,
      nextAttemptAt: 0,
    });
    await _set(entries);
    return id;
  },

  async remove(id) {
    const entries = await _get();
    await _set(entries.filter((e) => e.id !== id));
  },

  async bumpFailure(id, now = Date.now()) {
    const entries = await _get();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const attempts = (entries[idx].attempts || 0) + 1;
    // 2^attempts * 1000 ms, capped at MAX_BACKOFF_MS
    const delay = Math.min(Math.pow(2, attempts) * 1000, MAX_BACKOFF_MS);
    entries[idx].attempts = attempts;
    entries[idx].nextAttemptAt = now + delay;
    await _set(entries);
  },

  async hasPendingForRow(table, rowId) {
    const entries = await _get();
    return entries.some((e) => e.table === table && e.row && e.row.id === rowId);
  },

  async size() {
    return (await _get()).length;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { queue };
}
globalThis.queue = queue;

})();
