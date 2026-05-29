(function () {

// One-time reshape of the 4 legacy chrome.storage.sync task keys
// (taskItUp, watchLater, readingList, doneItems) into unified rows in
// cache:tasks and enqueue for Supabase sync.
//
// Idempotent: dedupes by (kind, title) against rows already in cache:tasks.
// Running twice produces the same state.
//
// This does NOT delete the legacy keys. A later migration banner handles
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

async function _getLegacySync() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['taskItUp', 'watchLater', 'readingList', 'doneItems'],
      (d) => resolve({
        taskItUp: d.taskItUp || [],
        watchLater: d.watchLater || [],
        readingList: d.readingList || [],
        doneItems: d.doneItems || [],
      })
    );
  });
}

async function reshapeTasks(userId) {
  if (!userId) throw new Error('reshapeTasks: userId required');
  const legacy = await _getLegacySync();
  const totalLegacy =
    legacy.taskItUp.length + legacy.watchLater.length +
    legacy.readingList.length + legacy.doneItems.length;
  if (totalLegacy === 0) return { reshaped: false, reason: 'no legacy data' };

  // Idempotency: dedupe by (kind, title) against existing cache rows
  const existing = await _cache.getAll('tasks');
  const seen = new Set();
  const existingByTitleKind = {};
  for (const r of Object.values(existing)) {
    if (!r.deleted_at) {
      const key = `${r.kind}::${r.title}`;
      seen.add(key);
      existingByTitleKind[key] = r;
    }
  }

  const now = new Date().toISOString();
  const byTitleKind = {}; // title+kind → new row, to apply done flags later
  const newRows = [];

  function pushRow(kind, src) {
    if (!src || !src.title) return;
    const key = `${kind}::${src.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    const row = {
      id: _uuid(),
      user_id: userId,
      kind,
      title: String(src.title).trim(),
      link: src.link || null,
      course_name: src.course || null,
      deadline: src.deadline || null,
      done: false,
      done_at: null,
      added_at: src.addedAt || now,
      updated_at: now,
    };
    newRows.push(row);
    byTitleKind[key] = row;
  }

  legacy.taskItUp.forEach((it) => pushRow('task', it));
  legacy.watchLater.forEach((it) => pushRow('watch_later', it));
  legacy.readingList.forEach((it) => pushRow('reading', it));

  // Apply doneItems: match by title against newly built rows or existing cache.
  // If no match anywhere, create a stub task row with done=true.
  for (const d of legacy.doneItems) {
    const title = typeof d === 'string' ? d : d?.title;
    const doneAt = typeof d === 'string' ? now : (d?.doneAt || now);
    if (!title) continue;

    let match =
      byTitleKind[`task::${title}`] ||
      byTitleKind[`watch_later::${title}`] ||
      byTitleKind[`reading::${title}`] ||
      existingByTitleKind[`task::${title}`] ||
      existingByTitleKind[`watch_later::${title}`] ||
      existingByTitleKind[`reading::${title}`] ||
      null;

    if (match) {
      match.done = true;
      match.done_at = doneAt;
      match.updated_at = now;
      // If the match came from existing cache (not a new row), include it in writes
      if (!newRows.includes(match)) newRows.push(match);
    } else {
      const key = `task::${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      newRows.push({
        id: _uuid(),
        user_id: userId,
        kind: 'task',
        title,
        link: null,
        course_name: null,
        deadline: null,
        done: true,
        done_at: doneAt,
        added_at: now,
        updated_at: now,
      });
    }
  }

  if (newRows.length === 0) return { reshaped: false, reason: 'nothing new' };

  await _cache.upsertMany('tasks', newRows);
  for (const row of newRows) {
    await _queue.enqueue({ table: 'tasks', op: 'upsert', row });
  }

  return { reshaped: true, count: newRows.length };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeTasks };
}
globalThis.reshapeTasks = reshapeTasks;

})();
