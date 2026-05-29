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

const watchedVideosRepo = {
  async list() {
    const all = await _cache.getAll('watched_videos');
    return Object.values(all)
      .filter(r => !r.deleted_at)
      .sort((a, b) => (b.watched_at || '').localeCompare(a.watched_at || ''));
  },

  async findByLink(link) {
    const all = await _cache.getAll('watched_videos');
    for (const r of Object.values(all)) {
      if (!r.deleted_at && r.link === link) return r;
    }
    return null;
  },

  async markWatched({ link, title, course_name = null } = {}) {
    if (!link) throw new Error('link required');
    const userId = await _currentUserId();
    const existing = await watchedVideosRepo.findByLink(link);
    const now = new Date().toISOString();
    const row = existing
      ? { ...existing, title: title || existing.title, course_name: course_name || existing.course_name, updated_at: now }
      : {
          id: _uuid(), user_id: userId, link, title: title || null, course_name,
          watched_at: now, updated_at: now,
        };
    await _sync.write('watched_videos', 'upsert', row);
    return row;
  },

  async remove(link) {
    const existing = await watchedVideosRepo.findByLink(link);
    if (!existing) return;
    const now = new Date().toISOString();
    await _sync.write('watched_videos', 'upsert', { ...existing, deleted_at: now, updated_at: now });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { watchedVideosRepo };
}
globalThis.watchedVideosRepo = watchedVideosRepo;

})();
