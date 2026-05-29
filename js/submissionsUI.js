/**
 * BGU Spark - Submissions UI helper
 *
 * Single read-path shim for "מטלות להגשה". Prefers the new submissions
 * repo (synced to Supabase). Falls back to the legacy
 * chrome.storage.local.courses + hiddenCourses keys when the repo cache
 * is empty — covers signed-out users, first launch before the migration
 * runs, and old extension versions writing into the same Chrome profile.
 *
 * Shape returned matches the legacy { courses, hiddenCourses } that every
 * existing read site already understands, plus two private fields on each
 * course so the hide button can call submissions.setHidden when available:
 *   _submissionId — repo row id (or null on the legacy path)
 *   _isHidden     — current is_hidden flag from the repo
 *
 * Remove this file (and its callers' fallback logic) in the follow-up
 * release that drops the legacy local-storage writes.
 */
async function readSubmissionsForUI() {
    const rows = await new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(
                { type: 'submissions.list', includeHidden: true },
                (response) => {
                    if (chrome.runtime.lastError) return resolve([]);
                    resolve(response && response.ok && Array.isArray(response.rows) ? response.rows : []);
                }
            );
        } catch (_) {
            resolve([]);
        }
    });

    if (rows.length === 0) {
        // Legacy path
        return new Promise((resolve) => {
            chrome.storage.local.get(['courses', 'hiddenCourses'], (data) => {
                resolve({
                    courses: Array.isArray(data.courses) ? data.courses : [],
                    hiddenCourses: Array.isArray(data.hiddenCourses) ? data.hiddenCourses : [],
                });
            });
        });
    }

    const courses = rows.map((r, i) => ({
        id: i,
        late: r.late_label || '',
        name: r.name || '',
        desc: r.description || '',
        date: r.event_date || '',
        time: r.event_time || '',
        link: r.link || '#',
        _submissionId: r.id,
        _isHidden: !!r.is_hidden,
    }));
    const hiddenCourses = rows.filter((r) => r.is_hidden).map((r) => r.link);
    return { courses, hiddenCourses };
}

globalThis.readSubmissionsForUI = readSubmissionsForUI;
