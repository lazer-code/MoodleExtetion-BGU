(function () {

// Repo for user_courses table. All reads go through cache; all writes go
// through sync.write (which handles optimistic cache update + queue).

const VALID_PRESETS = ['1L_1T', '1L_2T', '2L_1T', '2L_2T', '1L'];

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

async function _findArchivedByName(userId, courseName) {
  const all = await _cache.getAll('user_courses');
  for (const row of Object.values(all)) {
    if (row.user_id === userId && row.course_name === courseName && row.deleted_at) {
      return row;
    }
  }
  return null;
}

const userCoursesRepo = {
  async findByName(courseName) {
    const all = await _cache.getAll('user_courses');
    for (const row of Object.values(all)) {
      if (row.course_name === courseName && !row.deleted_at) return row;
    }
    return null;
  },

  async getAll() {
    const all = await _cache.getAll('user_courses');
    return Object.values(all)
      .filter((r) => !r.deleted_at)
      .sort((a, b) => (a.course_name || '').localeCompare(b.course_name || ''));
  },

  async upsertSettings(courseName, settings) {
    if (settings.tracker_preset != null && !VALID_PRESETS.includes(settings.tracker_preset)) {
      throw new Error(`invalid preset: ${settings.tracker_preset}`);
    }
    const userId = await _currentUserId();
    const existing = await userCoursesRepo.findByName(courseName);
    // Resurrect a soft-deleted row when re-tracking — inserting a fresh UUID
    // would collide with the (user_id, course_name) UNIQUE constraint.
    const archived = existing ? null : await _findArchivedByName(userId, courseName);
    const now = new Date().toISOString();
    const row = existing
      ? { ...existing, ...settings, updated_at: now }
      : archived
        ? { ...archived, ...settings, deleted_at: null, updated_at: now }
        : {
            id: _uuid(),
            user_id: userId,
            course_name: courseName,
            is_hidden: false,
            color_index: null,
            tracker_preset: null,
            tracker_current_week: 1,
            ...settings,
            updated_at: now,
          };
    await _sync.write('user_courses', 'upsert', row);
    return row;
  },

  async markDeleted(courseName) {
    const existing = await userCoursesRepo.findByName(courseName);
    if (!existing) return;
    const now = new Date().toISOString();
    await _sync.write('user_courses', 'upsert', { ...existing, deleted_at: now, updated_at: now });
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { userCoursesRepo };
}
globalThis.userCoursesRepo = userCoursesRepo;

})();
