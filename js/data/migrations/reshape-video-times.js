(function () {

// One-time reshape of the legacy chrome.storage.local `videoTimes` key
// (object keyed by URL: { seconds, duration, course, title }) into unified rows
// in cache:video_times and enqueue for Supabase sync.
//
// Idempotent: dedupes by `link` against rows already in cache:video_times.
// Running twice produces the same state.
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

async function reshapeVideoTimes(userId) {
  if (!userId) throw new Error('reshapeVideoTimes: userId required');

  const legacy = await _getLegacy('videoTimes');

  // Guard empty / wrong type
  if (
    !legacy ||
    typeof legacy !== 'object' ||
    Array.isArray(legacy) ||
    Object.keys(legacy).length === 0
  ) {
    return { reshaped: false, reason: 'no legacy data' };
  }

  // Build seen set from existing cache for idempotency (dedupe key: link)
  const existing = await _cache.getAll('video_times');
  const seen = new Set();
  for (const r of Object.values(existing)) {
    if (!r.deleted_at) seen.add(r.link);
  }

  const now = new Date().toISOString();
  const newRows = [];

  for (const [url, value] of Object.entries(legacy)) {
    if (!url || !value) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    newRows.push({
      id: _uuid(),
      user_id: userId,
      link: url,
      title: value.title || null,
      course_name: value.course || null,
      seconds: value.seconds || 0,
      duration: value.duration || null,
      updated_at: now,
    });
  }

  if (newRows.length === 0) return { reshaped: false, reason: 'nothing new' };

  await _cache.upsertMany('video_times', newRows);
  for (const row of newRows) {
    await _queue.enqueue({ table: 'video_times', op: 'upsert', row });
  }

  return { reshaped: true, count: newRows.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeVideoTimes };
}
globalThis.reshapeVideoTimes = reshapeVideoTimes;

})();
