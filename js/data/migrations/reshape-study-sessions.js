(function () {

// One-time reshape of the legacy chrome.storage.local `analyticsStudySessions`
// key (nested object: { date: { courseName: { totalSeconds } } }) into
// individual rows (one per date × course pair) in cache:study_sessions and
// enqueue for Supabase sync.
//
// Idempotent: dedupes by (date, course_name) tuple against rows already in
// cache:study_sessions. Running twice produces the same state.
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

async function reshapeStudySessions(userId) {
  if (!userId) throw new Error('reshapeStudySessions: userId required');

  const legacy = await _getLegacy('analyticsStudySessions');

  // Guard empty / wrong type
  if (
    !legacy ||
    typeof legacy !== 'object' ||
    Array.isArray(legacy) ||
    Object.keys(legacy).length === 0
  ) {
    return { reshaped: false, reason: 'no legacy data' };
  }

  // Build seen set from existing cache for idempotency
  // Dedupe key: `${date}::${course_name}`
  const existing = await _cache.getAll('study_sessions');
  const seen = new Set();
  for (const r of Object.values(existing)) {
    if (!r.deleted_at) seen.add(`${r.date}::${r.course_name}`);
  }

  const now = new Date().toISOString();
  const newRows = [];

  for (const [date, courses] of Object.entries(legacy)) {
    if (!date || !courses || typeof courses !== 'object') continue;
    for (const [courseName, data] of Object.entries(courses)) {
      if (!courseName || !data) continue;
      const key = `${date}::${courseName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      newRows.push({
        id: _uuid(),
        user_id: userId,
        date,
        course_name: courseName,
        total_seconds: data.totalSeconds || 0,
        updated_at: now,
      });
    }
  }

  if (newRows.length === 0) return { reshaped: false, reason: 'nothing new' };

  await _cache.upsertMany('study_sessions', newRows);
  for (const row of newRows) {
    await _queue.enqueue({ table: 'study_sessions', op: 'upsert', row });
  }

  return { reshaped: true, count: newRows.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeStudySessions };
}
globalThis.reshapeStudySessions = reshapeStudySessions;

})();
