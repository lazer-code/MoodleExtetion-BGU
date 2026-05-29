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

const studySessionsRepo = {
  async getByDateAndCourse(date, courseName) {
    const all = await _cache.getAll('study_sessions');
    for (const r of Object.values(all)) {
      if (!r.deleted_at && r.date === date && r.course_name === courseName) return r;
    }
    return null;
  },

  async addSeconds(date, courseName, seconds) {
    if (!date || !courseName) throw new Error('date and courseName required');
    if (seconds <= 0) return;
    const userId = await _currentUserId();
    const existing = await studySessionsRepo.getByDateAndCourse(date, courseName);
    const now = new Date().toISOString();
    if (existing) {
      await _sync.write('study_sessions', 'upsert', {
        ...existing,
        total_seconds: (existing.total_seconds || 0) + seconds,
        updated_at: now,
      });
    } else {
      await _sync.write('study_sessions', 'upsert', {
        id: _uuid(), user_id: userId, date, course_name: courseName,
        total_seconds: seconds, updated_at: now,
      });
    }
  },

  async getAllByDate(date) {
    const all = await _cache.getAll('study_sessions');
    return Object.values(all).filter(r => !r.deleted_at && r.date === date);
  },

  async listRange(fromDate, toDate) {
    const all = await _cache.getAll('study_sessions');
    return Object.values(all).filter(r => !r.deleted_at && r.date >= fromDate && r.date <= toDate);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { studySessionsRepo };
}
globalThis.studySessionsRepo = studySessionsRepo;

})();
