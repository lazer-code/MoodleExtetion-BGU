(function () {

// One-time reshape of the legacy chrome.storage.local `watchedVideos` key
// (array of { title, link, course, watchedAt }) into unified rows in
// cache:watched_videos and enqueue for Supabase sync.
//
// Idempotent: dedupes by `link` against rows already in cache:watched_videos.
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

async function reshapeWatchedVideos(userId) {
  if (!userId) throw new Error('reshapeWatchedVideos: userId required');

  const legacy = await _getLegacy('watchedVideos');

  // Guard empty / wrong type
  if (
    !legacy ||
    (Array.isArray(legacy) && legacy.length === 0) ||
    (!Array.isArray(legacy) && typeof legacy === 'object' && Object.keys(legacy).length === 0)
  ) {
    return { reshaped: false, reason: 'no legacy data' };
  }

  // Build seen set from existing cache for idempotency (dedupe key: link)
  const existing = await _cache.getAll('watched_videos');
  const seen = new Set();
  for (const r of Object.values(existing)) {
    if (!r.deleted_at) seen.add(r.link);
  }

  const now = new Date().toISOString();
  const newRows = [];

  for (const item of legacy) {
    if (!item || !item.link) continue;
    if (seen.has(item.link)) continue;
    seen.add(item.link);

    newRows.push({
      id: _uuid(),
      user_id: userId,
      link: item.link,
      title: item.title || null,
      course_name: item.course || null,
      watched_at: item.watchedAt || now,
      updated_at: now,
    });
  }

  if (newRows.length === 0) return { reshaped: false, reason: 'nothing new' };

  await _cache.upsertMany('watched_videos', newRows);
  for (const row of newRows) {
    await _queue.enqueue({ table: 'watched_videos', op: 'upsert', row });
  }

  return { reshaped: true, count: newRows.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeWatchedVideos };
}
globalThis.reshapeWatchedVideos = reshapeWatchedVideos;

})();
