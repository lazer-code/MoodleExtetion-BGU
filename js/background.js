// Supabase client + auth for session refresh keep-alive
try {
    importScripts(
        '../lib/supabase-js/supabase.js',
        './data/storage-adapter.js',
        './data/client.js',
        './data/wipe-user-data.js',
        './data/auth.js',
        './data/auth-errors.js',
        './data/error-logger.js',
        './data/cache.js',
        './data/queue.js',
        './data/sync.js',
        './data/repos/tasks.js',
        './data/migrations/reshape-weekly-tracker.js',
        './data/migrations/reshape-tasks.js',
        './data/repos/watched-videos.js',
        './data/repos/video-times.js',
        './data/repos/study-sessions.js',
        './data/repos/deadline-behavior.js',
        './data/repos/submissions.js',
        './data/migrations/reshape-watched-videos.js',
        './data/migrations/reshape-video-times.js',
        './data/migrations/reshape-study-sessions.js',
        './data/migrations/reshape-deadline-behavior.js',
        './data/migrations/reshape-submissions.js'
    );
} catch (e) {
    console.error('[background] failed to import Supabase modules', e);
}

// Ship unhandled errors/rejections from the service worker
if (typeof errorLogger !== 'undefined') {
    errorLogger.install(self, { context: 'background' });
}

/**
 * BGU Spark - Background Service Worker
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "scrapeData") {
        // Handle data scraping request if needed
    }
});

////////////////////

// background.js// background.js
// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'login') {
        const startTime = performance.now();
        console.log(`Login request received at: ${new Date(startTime).toISOString()}`);
        
        loginToMoodle(request.username, request.password, request.token)
            .then(response => {
                const endTime = performance.now();
                console.log(`Login completed at: ${new Date(endTime).toISOString()}`);
                console.log(`Total time taken: ${endTime - startTime} ms`);
                
                sendResponse(response);
            })
            .catch(error => {
                const errorTime = performance.now();
                console.log(`Login error at: ${new Date(errorTime).toISOString()}`);
                console.log(`Total time taken before error: ${errorTime - startTime} ms`);
                
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function loginToMoodle(username, password, token) {
    console.log('Logging in to Moodle with username:', username);
    const url = "https://moodle.bgu.ac.il/moodle/login/index.php";
    
    const payload = new URLSearchParams();
    payload.append('username', username);
    payload.append('password', password);
    payload.append('logintoken', token);
    payload.append('Current_language', 'HEBREW');

    console.log('Request payload:', payload.toString());

    try {
        const cookies = await chrome.cookies.getAll({ domain: "moodle.bgu.ac.il" });
        console.log('Cookies:', cookies);
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        console.log('Cookie header:', cookieHeader);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Cache-Control': 'no-cache',
                'Origin': 'https://moodle.bgu.ac.il',
                'Referer': 'https://moodle.bgu.ac.il/moodle/my/',
                'User-Agent': navigator.userAgent,
                'Cookie': cookieHeader
            },
            body: payload,
            credentials: 'include'
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let loggedIn = false;
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
            
            if (result.includes('<title>הקורסים שלי</title>')) {
                loggedIn = true;
                break;
            }
        }

        // Ensure any remaining text is processed
        result += decoder.decode();


            return { success: loggedIn, response: result };

    } catch (error) {
        console.error('Login attempt error:', error);
        return { success: false, error: error.message };
    }
}





// open pop up shortcut
chrome.commands.onCommand.addListener(function(command) {
    if (command === "open_popup") {
        chrome.windows.create({
            url: chrome.runtime.getURL("../html/popup.html"),
            type: "popup",
            width: 600,
            height: 850
        }, function(window) {
        });
    }
});



chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install' || details.reason === 'update') {
        migrateData();
    }
});

function migrateData() {
    // Migrate watched videos from sync to local
    chrome.storage.sync.get('watchedVideos', function(data) {
        let watchedVideos = data.watchedVideos || [];
        if (watchedVideos.length > 0) {
            chrome.storage.local.set({ watchedVideos: watchedVideos }, function() {
                console.log('Watched videos migrated to local storage.');
                chrome.storage.sync.remove('watchedVideos', function() {
                    console.log('Watched videos removed from sync storage.');
                });
            });
        }
    });

    // Migrate courses from sync to local if they exist
    chrome.storage.sync.get('courses', function(data) {
        let courses = data.courses || [];
        if (courses.length > 0) {
            chrome.storage.local.set({ courses: courses }, function() {
                console.log('Courses migrated to local storage.');
                chrome.storage.sync.remove('courses', function() {
                    console.log('Courses removed from sync storage.');
                });
            });
        }
    });

    // Migrate doneItems: convert old string format to object format
    chrome.storage.sync.get('doneItems', function(data) {
        let doneItems = data.doneItems || [];
        let needsMigration = false;
        doneItems = doneItems.map(d => {
            if (typeof d === 'string') {
                needsMigration = true;
                return { title: d, doneAt: null };
            }
            return d;
        });
        if (needsMigration) {
            chrome.storage.sync.set({ doneItems: doneItems }, function() {
                console.log('doneItems migrated to object format.');
            });
        }
    });

    // Migrate watchedVideos: add watchedAt field if missing
    chrome.storage.local.get('watchedVideos', function(data) {
        let watchedVideos = data.watchedVideos || [];
        let needsMigration = false;
        watchedVideos = watchedVideos.map(v => {
            if (!v.watchedAt) {
                needsMigration = true;
                return { ...v, watchedAt: null };
            }
            return v;
        });
        if (needsMigration) {
            chrome.storage.local.set({ watchedVideos: watchedVideos }, function() {
                console.log('watchedVideos migrated with watchedAt field.');
            });
        }
    });

    // Ensure taskItUp, watchLater, and readingList stay in sync
    ['taskItUp', 'watchLater', 'readingList'].forEach(type => {
        chrome.storage.sync.get(type, function(data) {
            if (data[type] && data[type].length > 0) {
                console.log(`${type} data is in sync storage.`);
            }
        });
    });
}

// Run migration on extension install/update
chrome.runtime.onInstalled.addListener(function() {
    migrateData();
});

// =============================================
// Deadline Notifications & Badge
// =============================================

// Set up a recurring alarm to check deadlines
chrome.alarms.create('checkDeadlines', { periodInMinutes: 30 });

// Also check on install/update
chrome.runtime.onInstalled.addListener(function() {
    checkDeadlinesAndUpdateBadge();
});

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'checkDeadlines') {
        checkDeadlinesAndUpdateBadge();
    }
});

function checkDeadlinesAndUpdateBadge() {
    chrome.storage.local.get(['courses', 'notificationSettings', 'notifiedDeadlines', 'cache:tasks', 'cache:submissions'], function(localData) {
        // Read tasks from the unified cache:tasks namespace, projected to the
        // legacy taskItUp shape the deadline-checking code expects.
        const taskItUp = Object.values(localData['cache:tasks'] || {})
            .filter(r => !r.deleted_at && r.kind === 'task' && !r.done)
            .map(r => ({
                title: r.title,
                link: r.link,
                course: r.course_name,
                deadline: r.deadline,
                addedAt: r.added_at,
            }));
        {
            // Prefer cache:submissions (synced) over legacy chrome.storage.local.courses.
            // Project each row back to the legacy shape this code expects.
            const submissionRows = Object.values(localData['cache:submissions'] || {})
                .filter(r => !r.deleted_at && !r.is_hidden);
            const courses = submissionRows.length > 0
                ? submissionRows.map((r, i) => ({
                    id: i,
                    name: r.name || '',
                    desc: r.description || '',
                    date: r.event_date || '',
                    time: r.event_time || '',
                    link: r.link || '',
                  }))
                : (localData.courses || []);
            const settings = localData.notificationSettings || { hoursBeforeAlert: 24 };
            const notificationsDisabled = settings.hoursBeforeAlert === 0;
            const notified = new Set(localData.notifiedDeadlines || []);
            const now = new Date();

            let overdueCount = 0;
            let upcomingCount = 0;
            const alertThresholdMs = settings.hoursBeforeAlert * 60 * 60 * 1000;
            const activeIds = new Set();

            // Check Moodle submissions
            courses.forEach(course => {
                if (!course.date) return;
                const dueDate = parseDateString(course.date, course.time);
                if (!dueDate) return;
                const timeDiff = dueDate.getTime() - now.getTime();
                const notifId = 'deadline-' + (course.id || course.name);

                if (timeDiff < 0) {
                    overdueCount++;
                } else if (!notificationsDisabled && timeDiff <= alertThresholdMs) {
                    upcomingCount++;
                    activeIds.add(notifId);
                    if (!notified.has(notifId)) {
                        chrome.notifications.create(notifId, {
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('images/icon128.png'),
                            title: 'BGU Spark - מטלה קרובה',
                            message: `${course.name} - הגשה ב-${course.date} ${course.time || ''}`,
                            priority: 2
                        });
                    }
                }
            });

            // Check taskItUp items with deadlines
            taskItUp.forEach(task => {
                if (!task.deadline) return;
                const dueDate = new Date(task.deadline);
                if (isNaN(dueDate.getTime())) return;
                const timeDiff = dueDate.getTime() - now.getTime();
                const notifId = 'task-' + task.title.replace(/\s+/g, '-');

                if (timeDiff < 0) {
                    overdueCount++;
                } else if (!notificationsDisabled && timeDiff <= alertThresholdMs) {
                    upcomingCount++;
                    activeIds.add(notifId);
                    if (!notified.has(notifId)) {
                        chrome.notifications.create(notifId, {
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('images/icon128.png'),
                            title: 'BGU Spark - משימה קרובה',
                            message: `${task.title}${task.course ? ' · ' + task.course : ''}`,
                            priority: 2
                        });
                    }
                }
            });

            // Persist notified IDs (only keep active ones to avoid unbounded growth)
            chrome.storage.local.set({ notifiedDeadlines: [...activeIds] });

            // Update badge (total from both sources)
            const totalAlerts = overdueCount + upcomingCount;
            if (totalAlerts > 0) {
                chrome.action.setBadgeText({ text: String(totalAlerts) });
                chrome.action.setBadgeBackgroundColor({
                    color: overdueCount > 0 ? '#d40505' : '#FF6536'
                });
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        }
    });
}

function parseDateString(dateStr, timeStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    let hours = 23, minutes = 59;
    if (timeStr) {
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
            hours = parseInt(timeParts[0], 10);
            minutes = parseInt(timeParts[1], 10);
        }
    }

    return new Date(year, month, day, hours, minutes);
}

// Handle notification clicks - open the Moodle dashboard
chrome.notifications.onClicked.addListener(function(notificationId) {
    if (notificationId.startsWith('deadline-')) {
        chrome.tabs.create({ url: 'https://moodle.bgu.ac.il/moodle/my/' });
    }
});

// Listen for when the extension is updated
// chrome.runtime.onInstalled.addListener((details) => {
//     if (details.reason === 'update') {
//       chrome.action.setBadgeText({ text: 'עדכון' });
//       chrome.action.setBadgeBackgroundColor({ color: 'lightblue' });
//     }
//   });

//   // Listen for when the extension icon is clicked
//   chrome.action.onClicked.addListener(() => {
//     chrome.action.setBadgeText({ text: '' });
//   });

// =============================================
// Supabase session refresh keep-alive
// =============================================

chrome.alarms.create('refreshAuth', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'refreshAuth') return;
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session) return;
        // Refresh if close to expiry (within 10 minutes)
        const expiresAt = session.expires_at * 1000;
        if (expiresAt - Date.now() < 10 * 60 * 1000) {
            await client.auth.refreshSession();
            console.log('[background] session refreshed');
        }
    } catch (e) {
        console.error('[background] refreshAuth error', e);
    }
});

// =============================================
// Weekly tracker reshape (one-time per user)
// =============================================
async function maybeReshapeWeeklyTracker() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;

        const key = 'weeklyTrackerReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return; // already done for this user

        const result = await globalThis.reshapeWeeklyTracker(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.coursesReshaped, 'legacy tracker courses');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) {
        console.error('[background] reshape error', err);
    }
}

// Run on install/update, on browser startup, and 5 seconds after service worker boot
chrome.runtime.onInstalled.addListener(() => maybeReshapeWeeklyTracker());
chrome.runtime.onStartup.addListener(() => maybeReshapeWeeklyTracker());
setTimeout(maybeReshapeWeeklyTracker, 5000);

// =============================================
// Tasks reshape (one-time per user)
// =============================================
async function maybeReshapeTasks() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;

        const key = 'tasksReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;

        const result = await globalThis.reshapeTasks(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.count, 'legacy tasks');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) {
        console.error('[background] tasks reshape error', err);
    }
}

chrome.runtime.onInstalled.addListener(() => maybeReshapeTasks());
chrome.runtime.onStartup.addListener(() => maybeReshapeTasks());
setTimeout(maybeReshapeTasks, 6000);

// =============================================
// Analytics reshapes (one-time per user)
// =============================================
async function maybeReshapeWatchedVideos() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;
        const key = 'watchedVideosReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;
        const result = await globalThis.reshapeWatchedVideos(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.count, 'legacy watched videos');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) { console.error('[background] watched videos reshape error', err); }
}

async function maybeReshapeVideoTimes() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;
        const key = 'videoTimesReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;
        const result = await globalThis.reshapeVideoTimes(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.count, 'legacy video times');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) { console.error('[background] video times reshape error', err); }
}

async function maybeReshapeStudySessions() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;
        const key = 'studySessionsReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;
        const result = await globalThis.reshapeStudySessions(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.count, 'legacy study sessions');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) { console.error('[background] study sessions reshape error', err); }
}

async function maybeReshapeDeadlineBehavior() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;
        const key = 'deadlineBehaviorReshaped:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;
        const result = await globalThis.reshapeDeadlineBehavior(userId);
        if (result.reshaped) {
            console.log('[background] reshaped', result.count, 'legacy deadline behavior rows');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) { console.error('[background] deadline behavior reshape error', err); }
}

chrome.runtime.onInstalled.addListener(() => {
    maybeReshapeWatchedVideos();
    maybeReshapeVideoTimes();
    maybeReshapeStudySessions();
    maybeReshapeDeadlineBehavior();
});
chrome.runtime.onStartup.addListener(() => {
    maybeReshapeWatchedVideos();
    maybeReshapeVideoTimes();
    maybeReshapeStudySessions();
    maybeReshapeDeadlineBehavior();
});
// Staggered — avoid simultaneous Supabase bursts
setTimeout(maybeReshapeWatchedVideos, 7000);
setTimeout(maybeReshapeVideoTimes, 8000);
setTimeout(maybeReshapeStudySessions, 9000);
setTimeout(maybeReshapeDeadlineBehavior, 10000);

// =============================================
// Submissions reshape (one-time per user) — seeds Supabase with whatever
// is in the legacy chrome.storage.local.courses + hiddenCourses keys.
// =============================================
async function maybeReshapeSubmissions() {
    try {
        const client = globalThis.getSupabaseClient?.();
        if (!client) return;
        const session = await globalThis.authModule?.getCurrentSession?.();
        if (!session?.user) return;
        const userId = session.user.id;
        const key = 'submissionsMigrated:' + userId;
        const existing = await new Promise((r) => chrome.storage.local.get(key, r));
        if (existing[key]) return;
        const result = await globalThis.reshapeSubmissions(userId);
        if (result.reshaped) {
            console.log('[background] reshaped submissions:', result.seeded, 'seeded,', result.hiddenApplied, 'hidden');
            globalThis.sync?.flushQueue?.();
        }
        await new Promise((r) => chrome.storage.local.set({ [key]: Date.now() }, r));
    } catch (err) {
        console.error('[background] submissions reshape error', err);
    }
}

chrome.runtime.onInstalled.addListener(() => maybeReshapeSubmissions());
chrome.runtime.onStartup.addListener(() => maybeReshapeSubmissions());
setTimeout(maybeReshapeSubmissions, 11000);

// =============================================
// Submissions snapshot throttle. The Moodle dashboard scraper fires
// `submissions.applySnapshot` on every visit. Layer-1 diff in the repo
// already produces zero writes when nothing changed; this is layer-2:
// even when data did change, coalesce rapid re-fires (multiple tabs, F5
// hammering) into at most one apply per 60 seconds. Pending snapshots are
// stashed in chrome.storage.local and drained by an alarm.
// =============================================
const SUBMISSIONS_THROTTLE_MS = 60 * 1000;
const PENDING_SNAPSHOT_KEY = 'pendingSubmissionsSnapshot';
const LAST_APPLY_KEY = 'lastSubmissionsSyncAt';

async function applySubmissionsSnapshotThrottled(rows) {
    if (!Array.isArray(rows)) return { skipped: true };
    const now = Date.now();
    const data = await new Promise((r) => chrome.storage.local.get([LAST_APPLY_KEY], r));
    const lastApply = data[LAST_APPLY_KEY] || 0;

    if (now - lastApply < SUBMISSIONS_THROTTLE_MS) {
        // Stash and let the alarm drain it
        await new Promise((r) => chrome.storage.local.set({ [PENDING_SNAPSHOT_KEY]: rows }, r));
        chrome.alarms.create('submissionsThrottle', { delayInMinutes: 1 });
        return { throttled: true };
    }

    const result = await globalThis.submissionsRepo.applyScrapedSnapshot(rows);
    await new Promise((r) => chrome.storage.local.set({
        [LAST_APPLY_KEY]: now,
        [PENDING_SNAPSHOT_KEY]: null,
    }, r));
    return result;
}

async function drainPendingSubmissionsSnapshot() {
    const data = await new Promise((r) =>
        chrome.storage.local.get([PENDING_SNAPSHOT_KEY], r));
    const pending = data[PENDING_SNAPSHOT_KEY];
    if (!Array.isArray(pending) || pending.length === 0) return;
    if (!(await _isSignedIn())) return;
    const result = await globalThis.submissionsRepo.applyScrapedSnapshot(pending);
    await new Promise((r) => chrome.storage.local.set({
        [LAST_APPLY_KEY]: Date.now(),
        [PENDING_SNAPSHOT_KEY]: null,
    }, r));
    if (result.adds || result.updates || result.deletions) {
        globalThis.sync?.flushQueue?.();
    }
}

// =============================================
// Periodic sync (pull remote changes + flush local queue)
// Runs every 5 minutes. Flush is here as a safety net: the in-process
// debounced flush in sync.js can be lost if the MV3 service worker
// terminates within its 500ms window (common for writes from content
// scripts via messaging). The alarm guarantees forward progress.
// =============================================
// Jittered 28-32 min so 331 users don't fire in the same second after a
// browser startup or extension auto-update.
const _syncPullJitter = 28 + Math.random() * 4;
chrome.alarms.create('syncPull', { delayInMinutes: _syncPullJitter, periodInMinutes: 30 });
// Also flush on a shorter interval so offline-then-online round trips
// recover quickly. Cheap: flushQueue() makes zero requests when the queue
// is empty.
chrome.alarms.create('syncFlush', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'syncFlush') {
        try {
            if (!globalThis.getSupabaseClient?.()) return;
            await globalThis.sync?.flushQueue?.();
        } catch (e) {
            console.error('[background] syncFlush error', e);
        }
        return;
    }
    if (alarm.name === 'submissionsThrottle') {
        try {
            await drainPendingSubmissionsSnapshot();
        } catch (e) {
            console.error('[background] submissionsThrottle error', e);
        }
        return;
    }
    if (alarm.name !== 'syncPull') return;
    try {
        if (!globalThis.getSupabaseClient?.()) return;
        await globalThis.sync?.pull?.([
            'user_courses', 'tracker_cells', 'tasks',
            'watched_videos', 'video_times', 'study_sessions', 'deadline_behavior',
            'submissions'
        ]);
        // Also flush anything queued while we were away
        await globalThis.sync?.flushQueue?.();
    } catch (e) {
        console.error('[background] syncPull error', e);
    }
});

// =============================================
// Messaging bridge for content scripts
// =============================================
// Message types that fire fire-and-forget from content scripts while the user
// is browsing. If the user is signed out we shouldn't throw loud errors for
// these — just no-op silently. Applies to analytics/telemetry writes only.
const SILENT_IF_SIGNED_OUT = new Set([
    'videos.markWatched',
    'videoTimes.upsert',
    'videoTimes.remove',
    'sessions.addSeconds',
    'deadlines.record',
    'submissions.applySnapshot',
]);

async function _isSignedIn() {
    try {
        if (!globalThis.authModule) return false;
        await globalThis.authModule.getCurrentUserId();
        return true;
    } catch (_) {
        return false;
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    (async () => {
        // Silent no-op for analytics writes when signed out — prevents log spam
        // on every heartbeat from the Moodle content scripts.
        if (SILENT_IF_SIGNED_OUT.has(msg.type) && !(await _isSignedIn())) {
            sendResponse({ ok: false, reason: 'not-signed-in' });
            return;
        }
        try {
            if (msg.type === 'tasks.add') {
                const row = await globalThis.tasksRepo.add(msg.kind, msg.data);
                sendResponse({ ok: true, row });
            } else if (msg.type === 'tasks.markDone') {
                await globalThis.tasksRepo.markDone(msg.id);
                sendResponse({ ok: true });
            } else if (msg.type === 'tasks.markDoneByTitle') {
                const existing = await globalThis.tasksRepo.findByTitleAndKind(msg.title, msg.kind || 'task');
                if (existing) {
                    await globalThis.tasksRepo.markDone(existing.id);
                    sendResponse({ ok: true, found: true });
                } else {
                    await globalThis.tasksRepo.add(msg.kind || 'task', { title: msg.title });
                    const created = await globalThis.tasksRepo.findByTitleAndKind(msg.title, msg.kind || 'task');
                    await globalThis.tasksRepo.markDone(created.id);
                    sendResponse({ ok: true, found: false });
                }
            } else if (msg.type === 'tasks.remove') {
                await globalThis.tasksRepo.remove(msg.id);
                sendResponse({ ok: true });
            } else if (msg.type === 'tasks.list') {
                const rows = await globalThis.tasksRepo.list(msg.kind || 'task', { includeDone: !!msg.includeDone });
                sendResponse({ ok: true, rows });
            } else if (msg.type === 'videos.markWatched') {
                const row = await globalThis.watchedVideosRepo.markWatched(msg.data);
                sendResponse({ ok: true, row });
            } else if (msg.type === 'videos.list') {
                const rows = await globalThis.watchedVideosRepo.list();
                sendResponse({ ok: true, rows });
            } else if (msg.type === 'videos.remove') {
                await globalThis.watchedVideosRepo.remove(msg.link);
                sendResponse({ ok: true });
            } else if (msg.type === 'videoTimes.upsert') {
                const row = await globalThis.videoTimesRepo.upsertPosition(msg.data);
                sendResponse({ ok: true, row });
            } else if (msg.type === 'videoTimes.findByLink') {
                const row = await globalThis.videoTimesRepo.findByLink(msg.link);
                sendResponse({ ok: true, row });
            } else if (msg.type === 'videoTimes.remove') {
                await globalThis.videoTimesRepo.remove(msg.link);
                sendResponse({ ok: true });
            } else if (msg.type === 'videoTimes.getAllAsMap') {
                const map = await globalThis.videoTimesRepo.getAllAsMap();
                sendResponse({ ok: true, map });
            } else if (msg.type === 'sessions.addSeconds') {
                await globalThis.studySessionsRepo.addSeconds(msg.date, msg.course_name, msg.seconds);
                sendResponse({ ok: true });
            } else if (msg.type === 'deadlines.record') {
                await globalThis.deadlineBehaviorRepo.record(msg.data);
                sendResponse({ ok: true });
            } else if (msg.type === 'submissions.applySnapshot') {
                const result = await applySubmissionsSnapshotThrottled(msg.rows);
                sendResponse({ ok: true, result });
            } else if (msg.type === 'submissions.list') {
                const rows = await globalThis.submissionsRepo.list({ includeHidden: !!msg.includeHidden });
                sendResponse({ ok: true, rows });
            } else if (msg.type === 'submissions.setHidden') {
                await globalThis.submissionsRepo.setHidden(msg.id, !!msg.hidden);
                sendResponse({ ok: true });
            } else if (msg.type === 'auth.signInWithGoogle') {
                // Run OAuth in the SW so the popup can close mid-flow without
                // killing the callback. The SW stays alive on pending Chrome
                // API calls; chrome.identity.launchWebAuthFlow is one of those.
                const session = await globalThis.authModule.signInWithGoogle();
                sendResponse({ ok: true, hasSession: !!session });
            } else {
                return; // not ours — let other listeners handle it
            }
        } catch (err) {
            console.error('[background] message handler error', msg.type, err);
            const cat = (typeof globalThis.categorizeAuthError === 'function')
                ? globalThis.categorizeAuthError(err)
                : null;
            sendResponse({
                ok: false,
                error: err.message || String(err),
                code: cat ? cat.code : undefined,
                hebrew: cat ? cat.hebrew : undefined,
            });
        }
    })();
    return true; // keep the message channel open for async sendResponse
});
