(function () {

const VALID_KINDS = ['task', 'watch_later', 'reading'];

let _cache, _sync;
try {
  _cache = require('../cache.js').cache;
  _sync = require('../sync.js').sync;
} catch (_e) {
  _cache = globalThis.cache;
  _sync = globalThis.sync;
}

function _uuid() {
  return globalThis.crypto && globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

async function _currentUserId() {
  return globalThis.authModule.getCurrentUserId();
}

const tasksRepo = {
  async list(kind, { includeDone = false } = {}) {
    if (!VALID_KINDS.includes(kind)) throw new Error(`invalid kind: ${kind}`);
    const all = await _cache.getAll('tasks');
    return Object.values(all)
      .filter((r) => !r.deleted_at && r.kind === kind && (includeDone || !r.done))
      .sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''));
  },

  async listAll() {
    const all = await _cache.getAll('tasks');
    return Object.values(all).filter((r) => !r.deleted_at);
  },

  async findByTitleAndKind(title, kind) {
    const all = await _cache.getAll('tasks');
    for (const r of Object.values(all)) {
      if (!r.deleted_at && r.kind === kind && r.title === title) return r;
    }
    return null;
  },

  async add(kind, { title, link = null, course_name = null, deadline = null } = {}) {
    if (!VALID_KINDS.includes(kind)) throw new Error(`invalid kind: ${kind}`);
    if (!title || !String(title).trim()) throw new Error('title required');
    const userId = await _currentUserId();
    const now = new Date().toISOString();
    const row = {
      id: _uuid(),
      user_id: userId,
      kind,
      title: String(title).trim(),
      link,
      course_name,
      deadline,
      done: false,
      done_at: null,
      added_at: now,
      updated_at: now,
    };
    await _sync.write('tasks', 'upsert', row);
    return row;
  },

  async _getById(id) {
    return _cache.get('tasks', id);
  },

  async update(id, patch) {
    const existing = await tasksRepo._getById(id);
    if (!existing) throw new Error(`task not found: ${id}`);
    const now = new Date().toISOString();
    const row = { ...existing, ...patch, updated_at: now };
    await _sync.write('tasks', 'upsert', row);
    return row;
  },

  async markDone(id) {
    const existing = await tasksRepo._getById(id);
    if (!existing) throw new Error(`task not found: ${id}`);
    const now = new Date().toISOString();
    await _sync.write('tasks', 'upsert', { ...existing, done: true, done_at: now, updated_at: now });
  },

  async markUndone(id) {
    const existing = await tasksRepo._getById(id);
    if (!existing) throw new Error(`task not found: ${id}`);
    const now = new Date().toISOString();
    await _sync.write('tasks', 'upsert', { ...existing, done: false, done_at: null, updated_at: now });
  },

  async remove(id) {
    const existing = await tasksRepo._getById(id);
    if (!existing) return;
    const now = new Date().toISOString();
    await _sync.write('tasks', 'upsert', { ...existing, deleted_at: now, updated_at: now });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tasksRepo };
}
globalThis.tasksRepo = tasksRepo;

})();
