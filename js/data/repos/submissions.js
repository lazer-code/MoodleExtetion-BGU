(function () {

// Repo for the `submissions` table — Moodle assignment timeline events
// ("מטלות להגשה") scraped from the dashboard. Replaces the legacy
// chrome.storage.local.courses array and the parallel hiddenCourses list.
//
// Anti-spam contract: applyScrapedSnapshot MUST return without calling
// _sync.write when the scraped snapshot matches what's already in
// cache:submissions on tracked fields. The scraper fires this on every
// dashboard visit; without the diff, we'd flood Supabase.

const TRACKED_FIELDS = ['name', 'description', 'event_date', 'event_time', 'late_label'];

let _cache, _sync;
try {
  _cache = require('../cache.js').cache;
  _sync = require('../sync.js').sync;
} catch (_e) {
  _cache = globalThis.cache;
  _sync = globalThis.sync;
}

async function _currentUserId() {
  return globalThis.authModule.getCurrentUserId();
}

// Deterministic UUIDv8 derived from SHA-256(user_id | link). Same Moodle
// link → same row id across devices and rescrapes, so plain upserts are
// idempotent without needing onConflict support in the sync engine.
async function _deterministicId(userId, link) {
  const data = new TextEncoder().encode(userId + '|' + link);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const b = new Uint8Array(buf, 0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // version = 8
  b[8] = (b[8] & 0x3f) | 0x80; // variant = RFC 4122
  const hex = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function _norm(v) {
  return String(v ?? '').trim();
}

// Parse Moodle's dd/mm/yyyy event_date for ordering. Missing/invalid
// dates sink to the bottom (Infinity).
function _parseDdMmYyyy(s) {
  if (!s) return Infinity;
  const parts = String(s).split('/');
  if (parts.length !== 3) return Infinity;
  const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  const ts = d.getTime();
  return isNaN(ts) ? Infinity : ts;
}

function _rowFromScraped(userId, id, src, now) {
  return {
    id,
    user_id: userId,
    link: _norm(src.link),
    name: _norm(src.name),
    description: _norm(src.desc),
    event_date: _norm(src.date),
    event_time: _norm(src.time),
    late_label: _norm(src.late),
    is_hidden: false,
    updated_at: now,
  };
}

function _trackedFieldsDiffer(a, b) {
  for (const f of TRACKED_FIELDS) {
    if (_norm(a[f]) !== _norm(b[f])) return true;
  }
  return false;
}

const submissionsRepo = {
  async list({ includeHidden = false } = {}) {
    const all = await _cache.getAll('submissions');
    return Object.values(all)
      .filter((r) => !r.deleted_at && (includeHidden || !r.is_hidden))
      .sort((a, b) => _parseDdMmYyyy(a.event_date) - _parseDdMmYyyy(b.event_date));
  },

  async findByLink(link) {
    const all = await _cache.getAll('submissions');
    const target = _norm(link);
    for (const r of Object.values(all)) {
      if (!r.deleted_at && _norm(r.link) === target) return r;
    }
    return null;
  },

  async setHidden(id, hidden) {
    const existing = await _cache.get('submissions', id);
    if (!existing) return;
    if (!!existing.is_hidden === !!hidden) return; // no-op, no Supabase write
    const now = new Date().toISOString();
    await _sync.write('submissions', 'upsert', {
      ...existing,
      is_hidden: !!hidden,
      updated_at: now,
    });
  },

  // Apply a scraped snapshot from scrapeCourses.js. Diff against cache and
  // write only what changed. Returns a summary so the caller can log /
  // count without re-counting.
  async applyScrapedSnapshot(scrapedRows) {
    if (!Array.isArray(scrapedRows)) {
      return { adds: 0, updates: 0, deletions: 0, skipped: true };
    }
    const userId = await _currentUserId();
    const now = new Date().toISOString();

    // Build new map keyed by deterministic id
    const incoming = new Map();
    for (const src of scrapedRows) {
      const link = _norm(src && src.link);
      if (!link || link === '#') continue; // Moodle uses '#' as a placeholder
      const id = await _deterministicId(userId, link);
      incoming.set(id, _rowFromScraped(userId, id, src, now));
    }

    // Live rows currently in cache, scoped to this user. Soft-deleted rows
    // are tracked separately so we can resurrect them with is_hidden intact
    // when Moodle shows them again — the scrape isn't authoritative enough
    // to discard the user's prior hide choice.
    const cacheMap = await _cache.getAll('submissions');
    const liveById = new Map();
    const archivedById = new Map();
    for (const row of Object.values(cacheMap)) {
      if (row.user_id && row.user_id !== userId) continue;
      if (row.deleted_at) {
        archivedById.set(row.id, row);
      } else {
        liveById.set(row.id, row);
      }
    }

    // An empty scrape against a non-empty cache is almost always a scraper
    // glitch (Moodle slow, "more events" race, content-script timing).
    // Refuse to propagate the wipe — the next good scrape will reconcile.
    if (incoming.size === 0 && liveById.size > 0) {
      return { adds: 0, updates: 0, deletions: 0, skipped: true };
    }

    const writes = [];

    // Adds + updates
    for (const [id, next] of incoming) {
      const prev = liveById.get(id);
      if (!prev) {
        const dead = archivedById.get(id);
        if (dead) {
          writes.push({
            ...dead,
            ...next,
            is_hidden: !!dead.is_hidden,
            deleted_at: null,
            updated_at: now,
          });
        } else {
          writes.push(next);
        }
        continue;
      }
      if (_trackedFieldsDiffer(prev, next)) {
        // Preserve is_hidden from cache; only refresh tracked fields + updated_at
        writes.push({
          ...prev,
          name: next.name,
          description: next.description,
          event_date: next.event_date,
          event_time: next.event_time,
          late_label: next.late_label,
          updated_at: now,
        });
      }
    }

    // Soft-deletions: in cache, not in incoming
    const deletions = [];
    for (const [id, prev] of liveById) {
      if (!incoming.has(id)) {
        deletions.push({ ...prev, deleted_at: now, updated_at: now });
      }
    }

    const adds = writes.filter((r) => !liveById.has(r.id)).length;
    const updates = writes.length - adds;

    if (writes.length === 0 && deletions.length === 0) {
      return { adds: 0, updates: 0, deletions: 0, skipped: false };
    }

    for (const row of writes) {
      await _sync.write('submissions', 'upsert', row);
    }
    for (const row of deletions) {
      await _sync.write('submissions', 'upsert', row);
    }

    return { adds, updates, deletions: deletions.length, skipped: false };
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { submissionsRepo, _deterministicId };
}
globalThis.submissionsRepo = submissionsRepo;

})();
