(function () {

// One-time reshape of the legacy chrome.storage.local `analyticsDeadlineBehavior`
// key (array of { taskName, course, deadline, completedAt, hoursBeforeDeadline })
// into unified rows in cache:deadline_behavior and enqueue for Supabase sync.
//
// Idempotent: dedupes by (task_name, completed_at) tuple against rows already
// in cache:deadline_behavior. Running twice produces the same state.
//
// This does NOT delete the legacy key. A later migration banner handles
// user-visible cleanup.

let _cache, _queue;
try {
  _cache = require('../cache.js').cache;
  _queue = require('../queue.js').queue;
} catch (_e) {
  _cache = globalThis.cache;
  _queue = globalThis.queue;
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

async function _getLegacy(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (d) => resolve(d[key] ?? null));
  });
}

async function reshapeDeadlineBehavior(userId) {
  if (!userId) throw new Error('reshapeDeadlineBehavior: userId required');

  const legacy = await _getLegacy('analyticsDeadlineBehavior');

  // Guard empty / wrong type
  if (
    !legacy ||
    (Array.isArray(legacy) && legacy.length === 0) ||
    (!Array.isArray(legacy) && typeof legacy === 'object' && Object.keys(legacy).length === 0)
  ) {
    return { reshaped: false, reason: 'no legacy data' };
  }

  // Build seen set from existing cache for idempotency
  // Dedupe key: `${task_name}::${completed_at}`
  const existing = await _cache.getAll('deadline_behavior');
  const seen = new Set();
  for (const r of Object.values(existing)) {
    if (!r.deleted_at) seen.add(`${r.task_name}::${r.completed_at}`);
  }

  const now = new Date().toISOString();
  const newRows = [];

  for (const item of legacy) {
    if (!item || !item.taskName) continue;
    const completedAt = item.completedAt || null;
    const key = `${item.taskName}::${completedAt}`;
    if (seen.has(key)) continue;
    seen.add(key);

    newRows.push({
      id: _uuid(),
      user_id: userId,
      task_name: item.taskName,
      course_name: item.course || null,
      deadline: item.deadline || null,
      completed_at: completedAt,
      hours_before_deadline: item.hoursBeforeDeadline ?? null,
      created_at: completedAt || now,
      updated_at: now,
    });
  }

  if (newRows.length === 0) return { reshaped: false, reason: 'nothing new' };

  await _cache.upsertMany('deadline_behavior', newRows);
  for (const row of newRows) {
    await _queue.enqueue({ table: 'deadline_behavior', op: 'upsert', row });
  }

  return { reshaped: true, count: newRows.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeDeadlineBehavior };
}
globalThis.reshapeDeadlineBehavior = reshapeDeadlineBehavior;

})();
