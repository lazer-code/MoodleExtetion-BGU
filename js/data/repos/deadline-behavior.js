(function () {

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

const deadlineBehaviorRepo = {
  async list() {
    const all = await _cache.getAll('deadline_behavior');
    return Object.values(all).filter(r => !r.deleted_at);
  },

  async record({ task_name, course_name = null, deadline = null, completed_at = null, hours_before_deadline = null } = {}) {
    if (!task_name) throw new Error('task_name required');
    const userId = await _currentUserId();
    const now = new Date().toISOString();
    const row = {
      id: _uuid(),
      user_id: userId,
      task_name,
      course_name,
      deadline,
      completed_at,
      hours_before_deadline,
      created_at: completed_at || now,
      updated_at: now,
    };
    await _sync.write('deadline_behavior', 'upsert', row);
    return row;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { deadlineBehaviorRepo };
}
globalThis.deadlineBehaviorRepo = deadlineBehaviorRepo;

})();
