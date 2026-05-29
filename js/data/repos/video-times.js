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

const videoTimesRepo = {
  async list() {
    const all = await _cache.getAll('video_times');
    return Object.values(all).filter(r => !r.deleted_at);
  },

  async findByLink(link) {
    const all = await _cache.getAll('video_times');
    for (const r of Object.values(all)) {
      if (!r.deleted_at && r.link === link) return r;
    }
    return null;
  },

  async upsertPosition({ link, title = null, course_name = null, seconds, duration } = {}) {
    if (!link) throw new Error('link required');
    if (typeof seconds !== 'number' || seconds < 0) throw new Error('seconds must be non-negative number');
    // HTML5 video.currentTime / video.duration return floats but the
    // Postgres columns are INT — round here so we never enqueue a value
    // Postgres will reject (error 22P02).
    const secondsInt = Math.round(seconds);
    const durationInt = (typeof duration === 'number' && isFinite(duration))
      ? Math.round(duration)
      : (duration ?? null);
    const userId = await _currentUserId();
    const existing = await videoTimesRepo.findByLink(link);
    const now = new Date().toISOString();
    const row = existing
      ? {
          ...existing,
          title: title ?? existing.title,
          course_name: course_name ?? existing.course_name,
          seconds: secondsInt,
          duration: durationInt ?? existing.duration,
          updated_at: now,
        }
      : {
          id: _uuid(), user_id: userId, link, title, course_name,
          seconds: secondsInt, duration: durationInt, updated_at: now,
        };
    await _sync.write('video_times', 'upsert', row);
    return row;
  },

  async remove(link) {
    const existing = await videoTimesRepo.findByLink(link);
    if (!existing) return;
    const now = new Date().toISOString();
    await _sync.write('video_times', 'upsert', { ...existing, deleted_at: now, updated_at: now });
  },

  async getAllAsMap() {
    const all = await _cache.getAll('video_times');
    const map = {};
    for (const r of Object.values(all)) {
      if (!r.deleted_at) {
        map[r.link] = { seconds: r.seconds, duration: r.duration, title: r.title, course: r.course_name };
      }
    }
    return map;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { videoTimesRepo };
}
globalThis.videoTimesRepo = videoTimesRepo;

})();
