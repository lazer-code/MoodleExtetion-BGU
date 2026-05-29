(function () {

// Wipes all per-user data from chrome.storage on sign-out (and defensively on
// sign-in if a different user's data is detected). Preserves profile-scoped
// settings: feature toggles, BGU autoLogin credentials, UI dismissals.
//
// Load order: must come before auth.js (which calls wipeUserData).

const LOCAL_KEYS_TO_WIPE = [
  // Sync infrastructure
  'syncQueue', 'lastPullTime', 'lastSyncError',
  // Submissions scraper throttle: a stashed snapshot from User A would
  // otherwise drain as User B's data (the alarm calls applyScrapedSnapshot
  // which hashes IDs with whoever is currently signed in).
  'pendingSubmissionsSnapshot', 'lastSubmissionsSyncAt',
  // Legacy per-user data (predate cache:* layer)
  'courses', 'availableCourses', 'watchedVideos', 'videoTimes',
  'weeklyTracker', 'analyticsStudySessions', 'analyticsDeadlineBehavior',
  'analyticsEngagement', 'hiddenCourses', 'notifiedDeadlines',
  'calendarEvents', 'lastActiveTab',
  // Auth marker for cross-user detection
  '_lastSignedInUserId',
];

const SYNC_KEYS_TO_WIPE = [
  'taskItUp', 'doneItems', 'watchLater',
];

function _getAllLocal() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (data) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(data || {});
    });
  });
}

function _removeLocal(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

function _removeSync(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

async function wipeUserData() {
  // Discover cache:* keys dynamically — the set of synced entities grows
  // over time and a hardcoded list would silently rot.
  const allLocal = await _getAllLocal();
  const cacheKeys = Object.keys(allLocal).filter((k) => k.startsWith('cache:'));
  const localKeys = LOCAL_KEYS_TO_WIPE.concat(cacheKeys);

  await Promise.all([
    _removeLocal(localKeys),
    _removeSync(SYNC_KEYS_TO_WIPE),
  ]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wipeUserData, LOCAL_KEYS_TO_WIPE, SYNC_KEYS_TO_WIPE };
}
globalThis.wipeUserData = wipeUserData;

})();
