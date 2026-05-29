(function () {

// One-time reshape of legacy chrome.storage.local.courses (and hiddenCourses)
// into the new submissions table. Idempotent — applyScrapedSnapshot's diff
// makes re-runs cheap; the per-user flag avoids the work entirely on
// subsequent loads.
//
// Does NOT delete the legacy keys. The dashboard scraper keeps writing
// chrome.storage.local.courses for the duration of the dual-write rollout
// so the previous extension version (and unmigrated read sites in this
// build) keep working unchanged.

let _submissionsRepo;
try {
  _submissionsRepo = require('../repos/submissions.js').submissionsRepo;
} catch (_e) {
  _submissionsRepo = globalThis.submissionsRepo;
}

function _getLegacy() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['courses', 'hiddenCourses'], (d) =>
      resolve({
        courses: Array.isArray(d.courses) ? d.courses : [],
        hiddenCourses: Array.isArray(d.hiddenCourses) ? d.hiddenCourses : [],
      })
    );
  });
}

async function reshapeSubmissions(userId) {
  if (!userId) throw new Error('reshapeSubmissions: userId required');
  const repo = _submissionsRepo || globalThis.submissionsRepo;
  if (!repo) throw new Error('reshapeSubmissions: submissionsRepo not loaded');

  const { courses, hiddenCourses } = await _getLegacy();
  if (courses.length === 0 && hiddenCourses.length === 0) {
    return { reshaped: false, reason: 'no legacy data' };
  }

  // Seed the cache + queue writes for any new submissions.
  const result = await repo.applyScrapedSnapshot(courses);

  // Apply legacy hide flags. Each setHidden() is a no-op when state already
  // matches, so re-runs don't churn.
  let hiddenApplied = 0;
  for (const link of hiddenCourses) {
    const row = await repo.findByLink(link);
    if (row && !row.is_hidden) {
      await repo.setHidden(row.id, true);
      hiddenApplied += 1;
    }
  }

  return {
    reshaped: result.adds > 0 || result.updates > 0 || hiddenApplied > 0,
    seeded: result.adds,
    updated: result.updates,
    hiddenApplied,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reshapeSubmissions };
}
globalThis.reshapeSubmissions = reshapeSubmissions;

})();
