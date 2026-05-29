(function () {

// Repo for tracker_cells table. One row per (user_course, row_type, row_index, week).
// Grid shape returned by getByCourse: { 'lecture:1': {1: cell, 2: cell, ...}, 'tirgul:1': ... }

const VALID_ROW_TYPES = ['lecture', 'tirgul'];

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

function _validate(rowType, rowIndex, week) {
  if (!VALID_ROW_TYPES.includes(rowType)) throw new Error(`invalid row_type: ${rowType}`);
  if (![1, 2].includes(rowIndex)) throw new Error(`invalid row_index: ${rowIndex}`);
  if (week < 1 || week > 13) throw new Error(`invalid week: ${week}`);
}

const trackerCellsRepo = {
  async getByCourse(userCourseId) {
    const all = await _cache.getAll('tracker_cells');
    const grid = {};
    for (const row of Object.values(all)) {
      if (row.user_course_id !== userCourseId) continue;
      if (row.deleted_at) continue;
      const key = `${row.row_type}:${row.row_index}`;
      if (!grid[key]) grid[key] = {};
      grid[key][row.week] = row;
    }
    return grid;
  },

  async _findCell(userCourseId, rowType, rowIndex, week) {
    const all = await _cache.getAll('tracker_cells');
    for (const row of Object.values(all)) {
      if (
        row.user_course_id === userCourseId &&
        row.row_type === rowType &&
        row.row_index === rowIndex &&
        row.week === week &&
        !row.deleted_at
      ) return row;
    }
    return null;
  },

  async setCompleted(userCourseId, rowType, rowIndex, week, completed) {
    _validate(rowType, rowIndex, week);
    const userId = await _currentUserId();
    const existing = await trackerCellsRepo._findCell(userCourseId, rowType, rowIndex, week);
    const now = new Date().toISOString();
    const row = existing
      ? { ...existing, completed: !!completed, updated_at: now }
      : {
          id: _uuid(),
          user_id: userId,
          user_course_id: userCourseId,
          row_type: rowType,
          row_index: rowIndex,
          week,
          completed: !!completed,
          updated_at: now,
        };
    await _sync.write('tracker_cells', 'upsert', row);
    return row;
  },

  async deleteByCourse(userCourseId) {
    // Used when user switches preset and old rows become irrelevant.
    // Soft-delete each cell via sync (so Supabase sees the deletion).
    const all = await _cache.getAll('tracker_cells');
    const now = new Date().toISOString();
    for (const row of Object.values(all)) {
      if (row.user_course_id === userCourseId && !row.deleted_at) {
        await _sync.write('tracker_cells', 'upsert', { ...row, deleted_at: now, updated_at: now });
      }
    }
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { trackerCellsRepo };
}
globalThis.trackerCellsRepo = trackerCellsRepo;

})();
