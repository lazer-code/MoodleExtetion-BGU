(function () {

// One-time reshape of the legacy chrome.storage.local.weeklyTracker blob
// into the new normalized cache shape (cache:user_courses + cache:tracker_cells)
// and enqueue the rows for cloud sync.
//
// Idempotent by (course_name, user_course_id, row_type, row_index, week) uniqueness
// handled by repo/cache semantics — running it twice produces the same state.
//
// This does NOT delete the legacy blob. Plan 4's migration banner handles the
// user-visible cleanup and the "upload legacy data" flow in full.

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

async function _getLegacy() {
  return new Promise((resolve) => {
    chrome.storage.local.get('weeklyTracker', (d) => resolve(d.weeklyTracker || null));
  });
}

async function reshapeWeeklyTracker(userId) {
  if (!userId) throw new Error('reshapeWeeklyTracker: userId required');
  const legacy = await _getLegacy();
  if (!legacy || typeof legacy !== 'object') {
    return { reshaped: false, reason: 'no legacy data' };
  }

  const existingCourses = await _cache.getAll('user_courses');
  const existingCourseByName = Object.fromEntries(
    Object.values(existingCourses).map((c) => [c.course_name, c])
  );

  const now = new Date().toISOString();
  let coursesReshaped = 0;

  for (const [courseName, courseData] of Object.entries(legacy)) {
    if (!courseData || !Array.isArray(courseData.rows)) continue;

    // Find or create user_course row
    let uc = existingCourseByName[courseName];
    const isNewCourse = !uc;
    if (isNewCourse) {
      uc = {
        id: _uuid(),
        user_id: userId,
        course_name: courseName,
        is_hidden: false,
        color_index: null,
        tracker_preset: courseData.preset || null,
        tracker_current_week: courseData.currentWeek || 1,
        updated_at: now,
      };
      await _cache.upsert('user_courses', uc);
      await _queue.enqueue({ table: 'user_courses', op: 'upsert', row: uc });
    }
    coursesReshaped++;

    // Only write cells for newly created courses; existing courses already have cells
    if (!isNewCourse) continue;

    // Reshape each row's weeks[] into tracker_cells
    const typeCounter = { lecture: 0, tirgul: 0 };
    for (const row of courseData.rows) {
      const type = row.type === 'tirgul' ? 'tirgul' : 'lecture';
      typeCounter[type]++;
      const rowIndex = typeCounter[type];
      if (rowIndex > 2) continue; // defensive: only up to 2 rows per type

      const cellRows = [];
      for (let w = 1; w <= 13; w++) {
        const weeksArr = row.weeks || [];
        const completed = !!weeksArr[w - 1];
        cellRows.push({
          id: _uuid(),
          user_id: userId,
          user_course_id: uc.id,
          row_type: type,
          row_index: rowIndex,
          week: w,
          completed,
          updated_at: now,
        });
      }
      await _cache.upsertMany('tracker_cells', cellRows);
      for (const cell of cellRows) {
        await _queue.enqueue({ table: 'tracker_cells', op: 'upsert', row: cell });
      }
    }
  }

  return { reshaped: coursesReshaped > 0, coursesReshaped };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeWeeklyTracker };
}
globalThis.reshapeWeeklyTracker = reshapeWeeklyTracker;

})();
