(function () {

// Sync orchestrator:
//  - write(table, op, row): cache optimistically, enqueue, try immediate flush
//  - flushQueue(): drain the queue (best-effort, stops on first stuck entry)
//  - pull(tables): fetch remote changes since lastPullTime, merge into cache
//  - getStatus(): 'synced' | 'pending' | 'error' for UI indicator
//
// Load order (HTML / importScripts): supabase.js -> storage-adapter.js ->
// client.js -> cache.js -> queue.js -> sync.js -> repos/*.js

const LAST_PULL_KEY = 'lastPullTime';
const LAST_ERROR_KEY = 'lastSyncError';
const FLUSH_DEBOUNCE_MS = 500;

function _setLastError(err, entry) {
  try {
    const message = (err && err.message) || String(err || 'unknown');
    const code = (err && err.code) || null;
    chrome.storage.local.set({
      [LAST_ERROR_KEY]: {
        message,
        code,
        table: entry?.table || null,
        op: entry?.op || null,
        at: Date.now(),
      },
    });
  } catch (_) { /* never let telemetry break sync */ }
}

function _clearLastError() {
  try { chrome.storage.local.remove(LAST_ERROR_KEY); } catch (_) {}
}

async function getLastError() {
  return new Promise((resolve) => {
    chrome.storage.local.get(LAST_ERROR_KEY, (d) => resolve(d[LAST_ERROR_KEY] || null));
  });
}

// Try to load deps either from CJS (tests) or globalThis (extension runtime)
let _cache, _queue;
try {
  _cache = require('./cache.js').cache;
  _queue = require('./queue.js').queue;
} catch (_e) {
  _cache = globalThis.cache;
  _queue = globalThis.queue;
}

function _client() {
  return globalThis.getSupabaseClient();
}

let _flushTimer = null;

async function write(table, op, row) {
  if (op === 'upsert') {
    if (!row || !row.id) throw new Error('sync.write: row.id required for upsert');
    await _cache.upsert(table, row);
  } else if (op === 'delete') {
    if (!row || !row.id) throw new Error('sync.write: row.id required for delete');
    await _cache.delete(table, row.id);
  } else {
    throw new Error('sync.write: unknown op ' + op);
  }
  await _queue.enqueue({ table, op, row });
  _scheduleFlush();
}

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushQueue().catch((e) => console.error('[sync] flush error', e));
  }, FLUSH_DEBOUNCE_MS);
}

async function flushQueue() {
  const entries = await _queue.getAll();
  const now = Date.now();
  let client;
  try {
    client = _client();
  } catch (e) {
    console.warn('[sync] client not ready', e);
    return;
  }

  for (const entry of entries) {
    if (entry.nextAttemptAt && entry.nextAttemptAt > now) continue;

    try {
      if (entry.op === 'upsert') {
        const payload = _normalizeRow(entry.table, entry.row);
        const { error } = await client.from(entry.table).upsert(payload);
        if (error) throw error;
      } else if (entry.op === 'delete') {
        const { error } = await client.from(entry.table).delete().eq('id', entry.row.id);
        if (error) throw error;
      }
      await _queue.remove(entry.id);
    } catch (err) {
      const message = (err && err.message) || String(err);
      const code = err && err.code;
      _setLastError(err, entry);
      // Auth failure: stop flushing entirely; user needs to re-auth
      if (message.includes('JWT') || code === 'PGRST301' || code === 401) {
        console.warn('[sync] auth error — stopping flush');
        return;
      }
      // Hard conflict (unique constraint, RLS deny, check constraint): drop, unretriable
      if (code === '23505' || code === '23514' || code === 'PGRST204') {
        console.error('[sync] hard conflict — dropping entry', entry.id, message);
        await _queue.remove(entry.id);
        continue;
      }
      // Network / transient: bump attempts and leave for next flush
      await _queue.bumpFailure(entry.id);
    }
  }

  // If the queue drained, the user is fully synced — clear stale error info.
  const remaining = await _queue.getAll();
  if (remaining.length === 0) _clearLastError();
}

async function pull(tables) {
  const client = _client();
  const { [LAST_PULL_KEY]: lastPullIso } = await new Promise((resolve) => {
    chrome.storage.local.get(LAST_PULL_KEY, resolve);
  });
  const since = lastPullIso || '1970-01-01T00:00:00.000Z';
  const pullStart = new Date().toISOString();

  for (const table of tables) {
    try {
      const { data, error } = await client
        .from(table)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .limit(1000);
      if (error) {
        console.warn('[sync] pull error for', table, error.message);
        continue;
      }
      if (!data || data.length === 0) continue;

      for (const row of data) {
        if (await _queue.hasPendingForRow(table, row.id)) continue;
        // Keep tombstones in cache. Every repo's read path filters by
        // deleted_at, and submissionsRepo.applyScrapedSnapshot needs the
        // tombstone to resurrect a row with is_hidden preserved when
        // Moodle shows it again.
        await _cache.upsert(table, row);
      }
    } catch (err) {
      console.warn('[sync] pull crashed for', table, err);
    }
  }

  await new Promise((resolve) => {
    chrome.storage.local.set({ [LAST_PULL_KEY]: pullStart }, resolve);
  });
}

async function getStatus() {
  const entries = await _queue.getAll();
  if (entries.length === 0) return 'synced';
  if (entries.some((e) => (e.attempts || 0) >= 3)) return 'error';
  return 'pending';
}

// Coerce a row to types Postgres will accept. Mirrors the column types
// declared in the supabase migrations. Defensive layer for queue entries
// enqueued before the per-repo normalization was in place (or for any
// future repo that forgets to round). Currently only video_times has
// integer columns coming from float-y JS APIs (HTMLVideoElement).
function _normalizeRow(table, row) {
  if (!row || typeof row !== 'object') return row;
  if (table === 'video_times') {
    const out = { ...row };
    if (typeof out.seconds === 'number' && !Number.isInteger(out.seconds)) {
      out.seconds = Math.round(out.seconds);
    }
    if (typeof out.duration === 'number' && !Number.isInteger(out.duration)) {
      out.duration = Math.round(out.duration);
    }
    return out;
  }
  return row;
}

async function clearQueue() {
  await new Promise((resolve) => {
    chrome.storage.local.remove('syncQueue', resolve);
  });
  _clearLastError();
}

const sync = { write, flushQueue, pull, getStatus, getLastError, clearQueue };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sync };
}
globalThis.sync = sync;

})();
