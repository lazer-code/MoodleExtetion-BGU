/**
 * BGU Spark - Popup Script
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

// Ship unhandled errors/rejections in the popup to Supabase for telemetry.
if (typeof errorLogger !== 'undefined') {
    errorLogger.install(window, { context: 'popup' });
}

// Pull Supabase changes into local cache + flush queued writes on popup open.
// Fires and forgets — UI will re-render from cache as it always does.
// The flush is a safety net: if the background service worker died
// before the 500ms debounced flush fired, pending writes sit in the
// queue until this runs (or the 1-minute syncFlush alarm fires).
(async function pullAndFlushOnOpen() {
    const showOverlay = () => {
        const el = document.getElementById('initial-load-overlay');
        if (el) el.hidden = false;
    };
    const hideOverlay = () => {
        const el = document.getElementById('initial-load-overlay');
        if (el) el.hidden = true;
    };

    let isFirstPull = false;
    try {
        if (typeof authModule === 'undefined') return;
        const session = await authModule.getCurrentSession();
        if (!session) return;
        if (typeof sync === 'undefined') return;

        // First pull = no lastPullTime stored. Renderers have already fired
        // against an empty cache, so show a blocking loader and reload once
        // data lands so every widget rerenders with fresh data.
        const { lastPullTime } = await new Promise((resolve) => {
            chrome.storage.local.get('lastPullTime', resolve);
        });
        isFirstPull = !lastPullTime;
        if (isFirstPull) showOverlay();

        // Skip the network pull when cache was refreshed in the last 5 min —
        // the background syncPull alarm covers steady-state freshness, and
        // popups open many times per session.
        const isFresh = lastPullTime &&
            (Date.now() - new Date(lastPullTime).getTime()) < 5 * 60 * 1000;

        if (!isFresh) {
            await sync.pull([
                'user_courses', 'tracker_cells', 'tasks',
                'watched_videos', 'video_times', 'study_sessions', 'deadline_behavior',
                'submissions'
            ]);
        }
        await sync.flushQueue();

        if (isFirstPull) {
            location.reload();
            return;
        }

        // Trigger the tracker re-render now that cache is fresh
        if (window.weeklyTrackerInstance) {
            window.weeklyTrackerInstance.displayTrackedCourses();
        }
    } catch (err) {
        console.warn('[popup] pullAndFlushOnOpen failed', err);
        if (isFirstPull) hideOverlay();
    }
})();

// Convert a Plan-3 tasks-table row to the legacy shape the existing
// rendering code expects: { id, title, link, course, deadline, addedAt, done, doneAt }.
// Lets us swap storage without rewriting the renderers.
function normalizeTaskRow(row) {
    return {
        id: row.id,
        title: row.title,
        link: row.link,
        course: row.course_name,
        deadline: row.deadline,
        addedAt: row.added_at,
        done: !!row.done,
        doneAt: row.done_at,
    };
}

function resolveThemeMode(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyPopupTheme(mode) {
    const resolved = resolveThemeMode(mode);
    document.body.classList.toggle('theme-dark', resolved === 'dark');
    document.body.classList.toggle('theme-light', resolved !== 'dark');
}

function initPopupTheme() {
    chrome.storage.sync.get('themeMode', function(data) {
        applyPopupTheme(data.themeMode || 'system');
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area === 'sync' && changes.themeMode) {
            applyPopupTheme(changes.themeMode.newValue || 'system');
        }
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function() {
        chrome.storage.sync.get('themeMode', function(data) {
            if ((data.themeMode || 'system') === 'system') {
                applyPopupTheme('system');
            }
        });
    });
}

initPopupTheme();

function normalizeMoodleTaskLink(rawUrl) {
    try {
        const url = new URL(rawUrl || '');
        const id = url.searchParams.get('id');
        return id
            ? `${url.origin}${url.pathname}?id=${id}`
            : `${url.origin}${url.pathname}`;
    } catch (_) {
        return String(rawUrl || '').trim();
    }
}

function normalizeTaskTitle(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildDoneTaskMatchers(doneRows) {
    const doneTitles = new Set(doneRows.map((row) => normalizeTaskTitle(row.title)).filter(Boolean));
    const doneLinks = new Set(doneRows.map((row) => normalizeMoodleTaskLink(row.link)).filter(Boolean));
    return { doneTitles, doneLinks };
}

function isSubmissionDone(course, doneMatchers) {
    const courseTitle = normalizeTaskTitle(course && course.name);
    const courseLink = normalizeMoodleTaskLink(course && course.link);
    return doneMatchers.doneTitles.has(courseTitle) || doneMatchers.doneLinks.has(courseLink);
}

// Tab Navigation
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');

        // Update active button
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Update active panel
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-' + tabId).classList.add('active');

        // Save last active tab
        chrome.storage.local.set({ lastActiveTab: tabId });
    });
});

// Restore last active tab
chrome.storage.local.get('lastActiveTab', function(data) {
    if (data.lastActiveTab) {
        const btn = document.querySelector(`.tab-button[data-tab="${data.lastActiveTab}"]`);
        if (btn) btn.click();
    }
});

//checks if the user is has create credentials to model
chrome.storage.sync.get('users', function(data) {
    const users = data.users || {};

    const warningElement = document.querySelector('.warning');
    
    if (Object.keys(users).length === 0) {
        // If the users object is empty or does not exist, show the warning element
        if (warningElement) {
            warningElement.style.display = 'flex';
        }
    } else {
        // If the users object is not empty, hide the warning element
        if (warningElement) {
            warningElement.style.display = 'none';
        }
    }
});

// Donation Banner - always visible, no dismiss


document.getElementById('openSettings').addEventListener('click', function() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('html/options.html'));
    }
});

document.getElementById('openStorage').addEventListener('click', function() {
    window.open(chrome.runtime.getURL('html/storage.html'));
});

document.querySelector('.warning span').addEventListener('click', function() {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('html/options.html'));
    }
});

function loadItems() {
    (async () => {
        const rows = await tasksRepo.list('task');
        const items = rows.map(normalizeTaskRow);
        const container = document.getElementById('taskItUpContainer');
        const countEl = document.getElementById('tasks-count');
        if (countEl) countEl.textContent = items.length > 0 ? items.length : '';

        if (items.length > 0) {
            container.innerHTML = '';
            createTaskCards(items, 'taskItUp', container);
        } else {
            container.innerHTML = '';
            const empty = document.createElement('div');
            empty.className = 'task-empty-state';
            empty.innerHTML = `
                <i class="fa fa-book" aria-hidden="true"></i>
                <p>כרגע אין לך משימות, על מנת להוסיף יש ללחוץ במודל על ׳הוסף למשימות׳</p>`;
            container.appendChild(empty);
        }
    })();
}

function getTaskIconClass(itemType) {
    if (itemType === 'קובץ') return { icon: 'fa-file-o', css: 'type-file' };
    if (itemType === 'קישור לאתר אינטרנט') return { icon: 'fa-link', css: 'type-link' };
    if (itemType === 'מטלה') return { icon: 'fa-file-text-o', css: 'type-assignment' };
    if (itemType === 'בוחן') return { icon: 'fa-question-circle', css: 'type-quiz' };
    if (itemType === 'video') return { icon: 'fa-video-camera', css: 'type-video' };
    if (itemType === 'ידני') return { icon: 'fa-plus-circle', css: 'type-manual' };
    return { icon: 'fa-circle-o', css: 'type-other' };
}

function getTaskTypeName(itemType) {
    if (itemType === 'קובץ') return 'קובץ';
    if (itemType === 'קישור לאתר אינטרנט') return 'קישור לאתר אינטרנט';
    if (itemType === 'מטלה') return 'מטלה להגשה';
    if (itemType === 'בוחן') return 'סטאק';
    if (itemType === 'video') return 'סרטון';
    if (itemType === 'ידני') return 'משימה ידנית';
    return 'אחר';
}

function formatDateDDMMYY(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
}

function formatTime24H(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
}

function formatDeadline(deadlineStr) {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime())) return null;

    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));

    const dateStr = formatDateDDMMYY(deadline);
    const timeStr = formatTime24H(deadline);

    let badgeClass, badgeText;
    if (daysLeft < 0) {
        badgeClass = 'overdue';
        badgeText = 'באיחור';
    } else if (daysLeft === 0) {
        badgeClass = 'urgent';
        badgeText = 'היום';
    } else if (daysLeft === 1) {
        badgeClass = 'urgent';
        badgeText = 'מחר';
    } else {
        badgeClass = 'normal';
        badgeText = daysLeft + ' ימים';
    }

    return { dateStr, timeStr, badgeClass, badgeText };
}

function createTaskCards(items, type, container) {
    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'task-card';

        const { icon, css } = getTaskIconClass(item.itemType);
        const typeName = getTaskTypeName(item.itemType);

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = `task-card-icon ${css}`;
        iconEl.innerHTML = `<i class="fa ${icon}"></i>`;

        // Info
        const info = document.createElement('div');
        info.className = 'task-card-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'task-card-title';
        titleEl.textContent = item.title;

        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'task-card-subtitle';
        subtitleEl.textContent = typeName + (item.course ? ' · ' + item.course : '');

        info.appendChild(titleEl);
        info.appendChild(subtitleEl);

        // Deadline display
        if (item.deadline) {
            const dl = formatDeadline(item.deadline);
            if (dl) {
                const deadlineEl = document.createElement('div');
                deadlineEl.className = 'task-card-deadline';
                deadlineEl.innerHTML = `
                    <span class="task-card-deadline-text"><i class="fa fa-clock-o"></i>${dl.dateStr} ${dl.timeStr}</span>
                    <span class="upcoming-item-badge ${dl.badgeClass}">${dl.badgeText}</span>`;
                info.appendChild(deadlineEl);
            }
        }

        // Actions
        const actions = document.createElement('div');
        actions.className = 'task-card-actions';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'task-action-btn icon-btn edit';
        editBtn.innerHTML = '<i class="fa fa-pencil"></i>';
        editBtn.title = 'ערוך משימה';
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openTaskModal(item, index);
        });

        // Link button (only if link exists)
        if (item.link) {
            const linkBtn = document.createElement('a');
            linkBtn.className = 'task-action-btn icon-btn secondary';
            linkBtn.href = item.link;
            linkBtn.target = '_blank';
            linkBtn.innerHTML = '<i class="fa fa-external-link"></i>';
            linkBtn.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            actions.appendChild(linkBtn);
        }

        const doneBtn = document.createElement('button');
        doneBtn.className = 'task-action-btn icon-btn check-done';
        doneBtn.innerHTML = '<i class="fa fa-check"></i>';
        doneBtn.addEventListener('click', function() {
            markItemAsDone(item);
            removeItemFromList(item, items, type, card);
        });

        actions.appendChild(editBtn);
        actions.appendChild(doneBtn);

        card.appendChild(iconEl);
        card.appendChild(info);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function removeItemFromList(item, items, type, cardElement) {
    const index = items.indexOf(item);
    if (index > -1) {
        items.splice(index, 1);
        (async () => {
            if (item.id) {
                await tasksRepo.remove(item.id);
            } else {
                const match = await tasksRepo.findByTitleAndKind(item.title, 'task');
                if (match) await tasksRepo.remove(match.id);
            }
            cardElement.style.transition = 'opacity 0.2s, transform 0.2s';
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'translateX(20px)';
            setTimeout(() => {
                cardElement.remove();
                // Update count badge
                const countEl = document.getElementById('tasks-count');
                if (countEl) countEl.textContent = items.length > 0 ? items.length : '';
                // Show empty state if no items left
                if (items.length === 0) {
                    const container = document.getElementById(type + 'Container');
                    container.innerHTML = '';
                    const empty = document.createElement('div');
                    empty.className = 'task-empty-state';
                    empty.innerHTML = `
                        <i class="fa fa-book" aria-hidden="true"></i>
                        <p>כרגע אין לך משימות, על מנת להוסיף יש ללחוץ במודל על ׳הוסף למשימות׳</p>`;
                    container.appendChild(empty);
                }
            }, 200);
        })();
    }
}

function markItemAsDone(item) {
    (async () => {
        if (item.id) {
            await tasksRepo.markDone(item.id);
        } else {
            const existing = await tasksRepo.findByTitleAndKind(item.title, 'task');
            if (existing) await tasksRepo.markDone(existing.id);
        }
        console.log('Marked as done:', item.title);
    })();
}

// Load items when popup is open
document.addEventListener('DOMContentLoaded', loadItems);

// Track extension opens for analytics
chrome.storage.local.get('analyticsEngagement', function(data) {
    const eng = data.analyticsEngagement || { extensionOpens: [], moodleVisits: [], activeDays: [] };
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    eng.extensionOpens.push(now);
    if (!eng.activeDays.includes(today)) eng.activeDays.push(today);
    // Trim to last 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    eng.extensionOpens = eng.extensionOpens.filter(t => t > cutoff);
    eng.moodleVisits = eng.moodleVisits.filter(t => t > cutoff);
    eng.activeDays = eng.activeDays.filter(d => d > cutoff.slice(0, 10));
    chrome.storage.local.set({ analyticsEngagement: eng });
});

//////////////////////////////////////////////




document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        const { courses, hiddenCourses } = await readSubmissionsForUI();
        const doneRows = (await tasksRepo.list('task', { includeDone: true }))
            .map(normalizeTaskRow)
            .filter((row) => row.done);
        const doneMatchers = buildDoneTaskMatchers(doneRows);
        const visibleCourses = courses.filter((course) => !isSubmissionDone(course, doneMatchers));
        displayCourses(visibleCourses, hiddenCourses);
    })();

    chrome.storage.local.get('availableCourses', function(result) {
        const availableCourses = result.availableCourses || [];
        console.log("Available courses:", availableCourses);
        displayAvailableCourses(availableCourses);
    });
});

function retrieveCourses(callback) {
    chrome.storage.local.get('availableCourses', function(result) {
        const availableCourses = result.availableCourses || [];
        console.log("Available courses:", availableCourses);
        callback(availableCourses);
    });
}

function getCourseColorIndex(courseName) {
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
        hash = ((hash << 5) - hash) + courseName.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 10;
}

const courseColorPalette = [
    { light: '#fff3ed', accent: '#FF421D' },
    { light: '#e0f2fe', accent: '#0284c7' },
    { light: '#f3e8ff', accent: '#7c3aed' },
    { light: '#ecfdf5', accent: '#059669' },
    { light: '#fef3c7', accent: '#d97706' },
    { light: '#fce7f3', accent: '#db2777' },
    { light: '#e0e7ff', accent: '#4f46e5' },
    { light: '#f0fdf4', accent: '#16a34a' },
    { light: '#fff7ed', accent: '#ea580c' },
    { light: '#f1f5f9', accent: '#475569' },
];

function calcTrackerProgress(tracker) {
    if (!tracker) return { completed: 0, total: 13, percentage: 0, currentWeek: 1 };
    // New row-based format (legacy pre-Plan-2)
    if (tracker.rows) {
        let completed = 0;
        const total = tracker.rows.length * 13;
        tracker.rows.forEach(row => {
            row.weeks.forEach(val => { if (val) completed++; });
        });
        return {
            completed, total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            currentWeek: tracker.currentWeek || 1
        };
    }
    // Old format fallback
    let completed = 0;
    for (let w = 1; w <= 13; w++) {
        const week = tracker.weeks?.[w];
        if (week?.lecture) completed++;
        if (week?.practice) completed++;
    }
    return {
        completed, total: 26,
        percentage: Math.round((completed / 26) * 100),
        currentWeek: tracker.currentWeek || 1
    };
}

// Plan 2+ format: compute progress directly from the normalized cache.
// `userCourse` is a row from cache:user_courses. `cellsMap` is cache:tracker_cells.
function calcTrackerProgressFromCache(userCourse, cellsMap) {
    if (!userCourse || !userCourse.tracker_preset) {
        return { completed: 0, total: 13, percentage: 0, currentWeek: 1 };
    }
    // Count how many distinct (row_type, row_index) rows belong to this course
    const rowKeys = new Set();
    let completed = 0;
    for (const cell of Object.values(cellsMap)) {
        if (cell.user_course_id !== userCourse.id) continue;
        if (cell.deleted_at) continue;
        rowKeys.add(`${cell.row_type}:${cell.row_index}`);
        if (cell.completed) completed++;
    }
    const total = rowKeys.size * 13;
    return {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        currentWeek: userCourse.tracker_current_week || 1,
    };
}

function displayAvailableCourses(courses) {
    const container = document.getElementById('courses-list');
    const emptyState = document.getElementById('courses-empty-state');
    const countBadge = document.getElementById('courses-count');

    container.innerHTML = '';

    if (courses.length === 0) {
        emptyState.style.display = 'flex';
        countBadge.textContent = '';
        return;
    }
    emptyState.style.display = 'none';
    countBadge.textContent = courses.length;

    chrome.storage.local.get(['cache:user_courses', 'cache:tracker_cells', 'weeklyTracker'], function(result) {
        const userCoursesMap = result['cache:user_courses'] || {};
        const cellsMap = result['cache:tracker_cells'] || {};
        const legacyTrackerData = result.weeklyTracker || {};
        // Build name -> user_course row lookup
        const userCourseByName = {};
        for (const uc of Object.values(userCoursesMap)) {
            if (!uc.deleted_at) userCourseByName[uc.course_name] = uc;
        }

        courses.forEach((course) => {
            const colorIdx = getCourseColorIndex(course.name);
            const colors = courseColorPalette[colorIdx];
            const courseId = course.link.split('id=')[1];

            // Prefer Plan 2 cache; fall back to legacy blob for users whose
            // reshape hasn't run yet (first popup open after update).
            const uc = userCourseByName[course.name];
            const stats = uc
                ? calcTrackerProgressFromCache(uc, cellsMap)
                : calcTrackerProgress(legacyTrackerData[course.name]);

            // Card container
            const card = document.createElement('div');
            card.className = 'course-card';
            card.setAttribute('data-course-name', course.name);

            // Color bar
            const colorBar = document.createElement('div');
            colorBar.className = 'course-card-color-bar';
            colorBar.style.backgroundColor = colors.accent;

            // Content
            const content = document.createElement('div');
            content.className = 'course-card-content';

            // Top row
            const top = document.createElement('div');
            top.className = 'course-card-top';

            // Icon
            const iconWrap = document.createElement('div');
            iconWrap.className = 'course-card-icon';
            iconWrap.style.backgroundColor = colors.light;
            const icon = document.createElement('i');
            icon.className = 'fa fa-graduation-cap';
            icon.style.color = colors.accent;
            iconWrap.appendChild(icon);

            // Info
            const info = document.createElement('div');
            info.className = 'course-card-info';
            const name = document.createElement('div');
            name.className = 'course-card-name';
            name.textContent = course.name;
            name.title = course.name;
            const idLabel = document.createElement('div');
            idLabel.className = 'course-card-id';
            idLabel.textContent = courseId ? `Course ID: ${courseId}` : '';
            info.appendChild(name);
            info.appendChild(idLabel);

            // Actions
            const actions = document.createElement('div');
            actions.className = 'course-card-actions';

            const videoBtn = document.createElement('a');
            videoBtn.className = 'course-action-btn';
            videoBtn.innerHTML = '<i class="fa fa-video-camera"></i>';
            videoBtn.title = 'הקלטות';
            videoBtn.setAttribute('aria-label', `צפה בהקלטות עבור ${course.name}`);
            videoBtn.href = `https://moodle.bgu.ac.il/moodle/blocks/video/videoslist.php?courseid=${courseId}`;
            videoBtn.target = '_blank';
            videoBtn.addEventListener('click', (e) => e.stopPropagation());

            const linkBtn = document.createElement('a');
            linkBtn.className = 'course-action-btn';
            linkBtn.innerHTML = '<i class="fa fa-external-link"></i>';
            linkBtn.title = 'פתח במודל';
            linkBtn.setAttribute('aria-label', `פתח ${course.name} במודל`);
            linkBtn.href = course.link;
            linkBtn.target = '_blank';
            linkBtn.addEventListener('click', (e) => e.stopPropagation());

            actions.appendChild(videoBtn);
            actions.appendChild(linkBtn);

            top.appendChild(iconWrap);
            top.appendChild(info);
            top.appendChild(actions);

            // Progress bar
            const progress = document.createElement('div');
            progress.className = 'course-card-progress';
            progress.setAttribute('role', 'button');
            progress.setAttribute('tabindex', '0');
            progress.setAttribute('aria-label', `הרחב מעקב שבועי עבור ${course.name}`);

            const progLabel = document.createElement('span');
            progLabel.className = 'progress-label';
            progLabel.textContent = `שבוע ${stats.currentWeek}/13`;

            const progTrack = document.createElement('div');
            progTrack.className = 'progress-bar-track';
            const progFill = document.createElement('div');
            progFill.className = 'progress-bar-fill';
            progFill.style.width = `${stats.percentage}%`;
            progFill.style.backgroundColor = stats.percentage > 50 ? '#4CAF50' : colors.accent;
            progTrack.appendChild(progFill);
            progTrack.setAttribute('role', 'progressbar');
            progTrack.setAttribute('aria-valuenow', stats.percentage);
            progTrack.setAttribute('aria-valuemin', '0');
            progTrack.setAttribute('aria-valuemax', '100');
            progTrack.setAttribute('aria-label', `התקדמות ב${course.name}`);

            const progPct = document.createElement('span');
            progPct.className = 'progress-percentage';
            progPct.textContent = `${stats.percentage}%`;

            const expandIcon = document.createElement('i');
            expandIcon.className = 'fa fa-chevron-down progress-expand-icon';

            progress.appendChild(progLabel);
            progress.appendChild(progTrack);
            progress.appendChild(progPct);
            progress.appendChild(expandIcon);

            progress.addEventListener('click', () => {
                card.classList.toggle('expanded');
            });
            progress.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.classList.toggle('expanded');
                }
            });

            // Tracker container (populated by WeeklyTracker)
            const trackerDiv = document.createElement('div');
            trackerDiv.className = 'course-card-tracker';

            content.appendChild(top);
            content.appendChild(progress);
            content.appendChild(trackerDiv);

            card.appendChild(colorBar);
            card.appendChild(content);

            card.addEventListener('click', (e) => {
                if (!e.target.closest('.course-card-progress') && !e.target.closest('.course-action-btn') && !e.target.closest('.course-card-tracker')) {
                    window.open(course.link, '_blank');
                }
            });

            container.appendChild(card);
        });

        // Tell weekly tracker to render grids inside cards
        if (window.weeklyTrackerInstance) {
            window.weeklyTrackerInstance.displayTrackedCourses();
        }
    });
}

// Search filter for courses
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('courses-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toLowerCase();
            const cards = document.querySelectorAll('.course-card');
            const noResults = document.getElementById('courses-no-results');
            let visibleCount = 0;

            cards.forEach(card => {
                const name = card.querySelector('.course-card-name').textContent.toLowerCase();
                const visible = name.includes(query);
                card.style.display = visible ? '' : 'none';
                if (visible) visibleCount++;
            });

            if (noResults) {
                noResults.style.display = (cards.length > 0 && visibleCount === 0) ? 'block' : 'none';
            }
        });
    }
});


// Toggle hidden submissions button
const toggleHiddenBtn = document.getElementById('toggle-hidden-btn');

function displayCourses(courses, hiddenCourses, showHidden) {
    const container = document.getElementById('content');
    container.innerHTML = '';

    if (toggleHiddenBtn) {
        toggleHiddenBtn.textContent = showHidden ? 'הראה מטלות פעילות' : 'הראה מטלות מוסתרות';
        toggleHiddenBtn.onclick = function() {
            displayCourses(courses, hiddenCourses, !showHidden);
        };
    }

    const coursesToDisplay = (showHidden
        ? courses.filter(c => hiddenCourses.includes(c.link))
        : courses.filter(c => !hiddenCourses.includes(c.link)))
        .slice()
        .sort((a, b) => parseSubmissionDateTime(a) - parseSubmissionDateTime(b));

    // Update count badge
    const countEl = document.getElementById('submissions-count');
    if (countEl) {
        const activeCount = courses.filter(c => !hiddenCourses.includes(c.link)).length;
        countEl.textContent = activeCount > 0 ? activeCount : '';
    }

    if (coursesToDisplay.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'task-empty-state';
        if (showHidden) {
            empty.innerHTML = `
                <i class="fa fa-eye-slash" aria-hidden="true"></i>
                <p>אין מטלות מוסתרות</p>`;
        } else {
            empty.innerHTML = `
                <i class="fa fa-pencil" aria-hidden="true"></i>
                <p>על מנת לטעון את ההגשות יש ללחוץ <span>כאן</span></p>`;
            const span = empty.querySelector('span');
            if (span) {
                span.addEventListener('click', function() {
                    openNewTab('https://moodle.bgu.ac.il/moodle/my/#loadtasks');
                });
            }
        }
        container.appendChild(empty);
        return;
    }

    coursesToDisplay.forEach(course => {
        const card = document.createElement('div');
        card.className = 'task-card';

        // Determine type
        const isAssignment = course.desc && course.desc.includes('מטלה');
        const iconCss = isAssignment ? 'type-assignment' : 'type-quiz';
        const iconClass = isAssignment ? 'fa-file-text-o' : 'fa-question-circle';
        const descType = isAssignment ? 'הגשת מטלה' : 'סטאק';

        // Parse course name from description
        let courseName = '';
        if (course.desc) {
            const desc = removeFirst12Letters(course.desc);
            const parts = desc.split('·');
            if (parts.length > 1) courseName = parts[1].trim();
        }

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = `task-card-icon ${iconCss}`;
        iconEl.innerHTML = `<i class="fa ${iconClass}"></i>`;

        // Info
        const info = document.createElement('div');
        info.className = 'task-card-info';
        info.innerHTML = `
            <div class="task-card-title">${course.name}</div>
            <div class="task-card-subtitle">${descType} · ${courseName}</div>`;

        // Meta (date + urgency)
        const meta = document.createElement('div');
        meta.className = 'task-card-meta';

        if (course.date) {
            const dateEl = document.createElement('div');
            dateEl.className = 'task-card-date';
            dateEl.textContent = course.date + (course.time ? ' ' + course.time : '');
            meta.appendChild(dateEl);

            // Urgency badge
            const daysLeftRaw = calculateDaysLeft(course.date);
            const daysNum = parseInt(daysLeftRaw);
            const badge = document.createElement('span');
            badge.className = 'upcoming-item-badge';
            if (isNaN(daysNum) || daysNum < 0) {
                badge.classList.add('overdue');
                badge.textContent = 'באיחור';
            } else if (daysNum <= 1) {
                badge.classList.add('urgent');
                badge.textContent = daysNum === 0 ? 'היום' : 'מחר';
            } else {
                badge.classList.add('normal');
                badge.textContent = daysLeftRaw;
            }
            meta.appendChild(badge);
        }

        // Actions
        const actions = document.createElement('div');
        actions.className = 'task-card-actions';

        const submitBtn = document.createElement('a');
        submitBtn.className = 'task-action-btn submit-link';
        submitBtn.href = course.link;
        submitBtn.target = '_blank';
        submitBtn.innerHTML = '<i class="fa fa-external-link"></i> פתח הגשה';
        submitBtn.addEventListener('click', function(e) { e.stopPropagation(); });

        const hideBtn = document.createElement('button');
        if (showHidden) {
            hideBtn.className = 'task-action-btn icon-btn restore';
            hideBtn.innerHTML = '<i class="fa fa-undo"></i>';
        } else {
            hideBtn.className = 'task-action-btn icon-btn danger';
            hideBtn.innerHTML = '<i class="fa fa-trash"></i>';
        }
        hideBtn.addEventListener('click', function() {
            const nextHidden = !showHidden;
            if (showHidden) {
                const idx = hiddenCourses.indexOf(course.link);
                if (idx > -1) hiddenCourses.splice(idx, 1);
            } else if (!hiddenCourses.includes(course.link)) {
                hiddenCourses.push(course.link);
            }
            const refresh = () => {
                if (course._submissionId) course._isHidden = nextHidden;
                displayCourses(courses, hiddenCourses, showHidden);
            };

            if (course._submissionId) {
                chrome.runtime.sendMessage(
                    { type: 'submissions.setHidden', id: course._submissionId, hidden: nextHidden },
                    refresh
                );
            } else {
                chrome.storage.local.set({ hiddenCourses: hiddenCourses }, refresh);
            }
        });

        actions.appendChild(submitBtn);
        actions.appendChild(hideBtn);

        card.appendChild(iconEl);
        card.appendChild(info);
        card.appendChild(meta);
        card.appendChild(actions);
        container.appendChild(card);
    });
}


// Parse a course's `dd/mm/yyyy` date plus optional `hh:mm` time into a
// timestamp suitable for sort. Missing/invalid → +Infinity so it sinks
// to the bottom rather than disrupting the order.
function parseSubmissionDateTime(course) {
    if (!course || !course.date) return Infinity;
    const parts = String(course.date).split('/');
    if (parts.length !== 3) return Infinity;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    let hour = 23, minute = 59;
    if (course.time) {
        const t = String(course.time).split(':');
        const h = parseInt(t[0], 10);
        const m = parseInt(t[1], 10);
        if (!isNaN(h)) hour = h;
        if (!isNaN(m)) minute = m;
    }
    const d = new Date(year, month, day, hour, minute);
    const ts = d.getTime();
    return isNaN(ts) ? Infinity : ts;
}

function calculateDaysLeft(dueDateString) {
    const today = new Date();
    const dateParts = dueDateString.split('/'); // Split the date string by '/'
    
    // Adjust for dd/mm/yy format, assuming the year is given as two digits
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Adjust month value for Date constructor (0-based)
    const year = parseInt(dateParts[2], 10); // Prepend '20' to make it yyyy

    const dueDate = new Date(year, month, day);
    const timeDiff = dueDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Calculate the difference in days
    console.log("timessssss");
    console.log(today);
    console.log(dueDate);
    console.log(timeDiff);
    return daysLeft + " ימים"; // Return a message if the due date has passed
}

function calculateHoursLeft(dueTimeString) {
    const today = new Date();
    const timeParts = dueTimeString.split(':'); // Split the time string by ':'
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    let dueTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

    // Check if the due time is in the past for today, and adjust to the next day if necessary
    if (dueTime.getTime() < today.getTime()) {
        dueTime.setDate(dueTime.getDate() + 1);
    }

    const timeDiff = dueTime.getTime() - today.getTime();
    const hoursLeft = Math.ceil(timeDiff / (1000 * 3600)); // Calculate the difference in hours

    return hoursLeft + " שעות"; // Return the calculated hours left
}


// More link handling
const links = [
    { class: 'moodle-link', url: 'https://moodle.bgu.ac.il/moodle/my/' },
    { class: 'portal-link', url: 'https://portal.bgu.ac.il/public/login' },
    { class: 'info-link', url: 'https://bgu4u22.bgu.ac.il/apex/10g/r/f_login1004/login_desktop?p_lang=he' },
    { class: 'sign-up-course-link', url: 'https://bgu4u.bgu.ac.il/pls/scwp/!app.gate?app=cns' },
    { class: 'choicefreak-link', url: 'https://www.choicefreak.co.il/bgu/' },
    { class: 'gezer-link', url: 'https://gezer1.bgu.ac.il/meser/main.php' }
];

// Function to open a new tab
function openNewTab(url) {
    chrome.tabs.create({ url: url });
}

// Add event listeners to the links
links.forEach(link => {
    const elements = document.getElementsByClassName(link.class);
    Array.from(elements).forEach(element => {
        element.addEventListener('click', function(event) {
            event.preventDefault();
            openNewTab(link.url);
        });
    });
});

// Display about us
function toggleClass(element, className) {
    element.classList.toggle(className);
}

const about = document.querySelector("#openabout");
const container = document.querySelector(".container");
const info = document.querySelector(".info");

const backbuttoninfo = document.querySelector("#back-info");

backbuttoninfo.addEventListener("click", function() {
    toggleClass(container, "hide");
    toggleClass(info, "show");
});

about.addEventListener("click", function() {
    toggleClass(container, "hide");
    toggleClass(info, "show");
});

const moreLinks = document.querySelector(".more-link");
const linksHide = document.querySelector(".links-hide");
const linksNotHide = document.querySelector(".quick-links-wrapper.visible");
const wrapper = document.querySelector(".quick-links-wrapper.full");


moreLinks.addEventListener("click", function() {
    toggleClass(linksHide, "active");
    // toggleClass(wrapper, "active");
    console.log(linksHide.scrollHeight)
    console.log(linksNotHide.scrollHeight)

    console.log(linksHide.scrollHeight + linksNotHide.scrollHeight)

    if (wrapper.style.height === `${linksHide.scrollHeight + linksNotHide.scrollHeight}px`) {
        console.log("here")

        // If it is expanded, collapse it
        wrapper.style.height = '70px';
    } else {
        // If it is collapsed, expand it
        wrapper.style.height = `${linksHide.scrollHeight + linksNotHide.scrollHeight}px`;
    }
});

function removeFirst12Letters(str) {
    return str.substring(12);
}



const fuckingSVG = `<svg version="1.1" id="fi_455691" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512.092 512.092" style="enable-background:new 0 0 512.092 512.092;" xml:space="preserve">
<g>
	<g>
		<path d="M312.453,199.601c-6.066-6.102-12.792-11.511-20.053-16.128c-19.232-12.315-41.59-18.859-64.427-18.859
			c-31.697-0.059-62.106,12.535-84.48,34.987L34.949,308.23c-22.336,22.379-34.89,52.7-34.91,84.318
			c-0.042,65.98,53.41,119.501,119.39,119.543c31.648,0.11,62.029-12.424,84.395-34.816l89.6-89.6
			c1.628-1.614,2.537-3.816,2.524-6.108c-0.027-4.713-3.87-8.511-8.583-8.484h-3.413c-18.72,0.066-37.273-3.529-54.613-10.581
			c-3.195-1.315-6.867-0.573-9.301,1.877l-64.427,64.512c-20.006,20.006-52.442,20.006-72.448,0
			c-20.006-20.006-20.006-52.442,0-72.448l108.971-108.885c19.99-19.965,52.373-19.965,72.363,0
			c13.472,12.679,34.486,12.679,47.957,0c5.796-5.801,9.31-13.495,9.899-21.675C322.976,216.108,319.371,206.535,312.453,199.601z"></path>
	</g>
</g>
<g>
	<g>
		<path d="M477.061,34.993c-46.657-46.657-122.303-46.657-168.96,0l-89.515,89.429c-2.458,2.47-3.167,6.185-1.792,9.387
			c1.359,3.211,4.535,5.272,8.021,5.205h3.157c18.698-0.034,37.221,3.589,54.528,10.667c3.195,1.315,6.867,0.573,9.301-1.877
			l64.256-64.171c20.006-20.006,52.442-20.006,72.448,0c20.006,20.006,20.006,52.442,0,72.448l-80.043,79.957l-0.683,0.768
			l-27.989,27.819c-19.99,19.965-52.373,19.965-72.363,0c-13.472-12.679-34.486-12.679-47.957,0
			c-5.833,5.845-9.35,13.606-9.899,21.845c-0.624,9.775,2.981,19.348,9.899,26.283c9.877,9.919,21.433,18.008,34.133,23.893
			c1.792,0.853,3.584,1.536,5.376,2.304c1.792,0.768,3.669,1.365,5.461,2.048c1.792,0.683,3.669,1.28,5.461,1.792l5.035,1.365
			c3.413,0.853,6.827,1.536,10.325,2.133c4.214,0.626,8.458,1.025,12.715,1.195h5.973h0.512l5.12-0.597
			c1.877-0.085,3.84-0.512,6.059-0.512h2.901l5.888-0.853l2.731-0.512l4.949-1.024h0.939c20.961-5.265,40.101-16.118,55.381-31.403
			l108.629-108.629C523.718,157.296,523.718,81.65,477.061,34.993z"></path>
	</g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
<g>
</g>
</svg>`;



// Handle toggle for Gezer
const toggleSwitchGezer = document.getElementById('toggle-switch-gezer');
if (toggleSwitchGezer) {
    // Load saved state
    chrome.storage.sync.get('toggleStateGezer', function (data) {
        toggleSwitchGezer.checked = data.toggleStateGezer || false;
    });

    // Save state when changed
    toggleSwitchGezer.addEventListener('change', function () {
        chrome.storage.sync.set({ toggleStateGezer: toggleSwitchGezer.checked });
    });
} else {
    console.error('Toggle switch for Gezer not found');
}

// Handle toggle for GPT Math RTL
const toggleSwitchGptMath = document.getElementById('toggle-switch-gpt-math');
if (toggleSwitchGptMath) {
    // Load saved state (default is false/disabled)
    chrome.storage.sync.get('toggleStateGptMath', function (data) {
        toggleSwitchGptMath.checked = data.toggleStateGptMath || false;
    });

    // Save state when changed
    toggleSwitchGptMath.addEventListener('change', function () {
        chrome.storage.sync.set({ toggleStateGptMath: toggleSwitchGptMath.checked });
    });
} else {
    console.error('Toggle switch for GPT Math RTL not found');
}

// // Handle toggle for Portal
// const toggleSwitchPortal = document.getElementById('toggle-switch-portal');
// if (toggleSwitchPortal) {
//     // Load saved state
//     chrome.storage.sync.get('toggleStatePortal', function (data) {
//         toggleSwitchPortal.checked = data.toggleStatePortal || false;
//     });

//     // Save state when changed
//     toggleSwitchPortal.addEventListener('change', function () {
//         chrome.storage.sync.set({ toggleStatePortal: toggleSwitchPortal.checked });
//     });
// } else {
//     console.error('Toggle switch for Portal not found');
// }
document.addEventListener("DOMContentLoaded", function() {
    const modal = document.getElementById("addLinkModal");
    const addLinkBtn = document.querySelector(".add-link");
    const closeBtn = document.querySelector(".close");
    const saveLinkBtn = document.getElementById("saveLinkBtn");
    const quickLinksWrapper = addLinkBtn.parentElement;

    // Load saved links from localStorage
    loadLinks();

    // Open modal
    addLinkBtn.addEventListener("click", function() {
        modal.style.display = "block";
    });

    // Close modal
    closeBtn.addEventListener("click", function() {
        modal.style.display = "none";
    });

    // Save link
    saveLinkBtn.addEventListener("click", function() {
        const linkName = document.getElementById("linkName").value;
        let linkUrl = document.getElementById("linkUrl").value;

        // Ensure URL includes the protocol
        if (!linkUrl.match(/^https?:\/\//i)) {
            linkUrl = 'http://' + linkUrl;
        }

        if (linkName && linkUrl) {
            const newLink = createLinkElement(linkName, linkUrl);
            quickLinksWrapper.insertBefore(newLink, addLinkBtn);

            // Save to localStorage
            saveLink(linkName, linkUrl);

            modal.style.display = "none";
            document.getElementById("linkName").value = "";
            document.getElementById("linkUrl").value = "";
        }
    });

    // Close modal when clicking outside of it
    window.addEventListener("click", function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });

    function createLinkElement(name, url) {
        const newLink = document.createElement("a");
        newLink.href = url;
        newLink.classList.add("grid-item");
        newLink.target = "_blank";

        const iconBg = document.createElement("div");
        iconBg.classList.add("link-icon-bg");

        const img = document.createElement("img");
        img.src = "../images/custom-icon.png";
        img.alt = name;
        img.classList.add("icon");
        iconBg.appendChild(img);

        const span = document.createElement("span");
        span.textContent = name;

        const deleteIcon = document.createElement("i");
        deleteIcon.classList.add("fa", "fa-times", "delete-icon", "delete-custom-link");
        deleteIcon.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            quickLinksWrapper.removeChild(newLink);
            removeLink(name, url);
        });

        newLink.appendChild(iconBg);
        newLink.appendChild(span);
        newLink.appendChild(deleteIcon);

        return newLink;
    }

    function saveLink(name, url) {
        let links = JSON.parse(localStorage.getItem("customLinks")) || [];
        links.push({ name: name, url: url });
        localStorage.setItem("customLinks", JSON.stringify(links));
    }

    function loadLinks() {
        let links = JSON.parse(localStorage.getItem("customLinks")) || [];
        links.forEach(link => {
            const newLink = createLinkElement(link.name, link.url);
            quickLinksWrapper.insertBefore(newLink, addLinkBtn);
        });
    }

    function removeLink(name, url) {
        let links = JSON.parse(localStorage.getItem("customLinks")) || [];
        links = links.filter(link => link.name !== name || link.url !== url);
        localStorage.setItem("customLinks", JSON.stringify(links));
    }
});

// =============================================
// Add/Edit Task Modal
// =============================================

(function() {
    const taskModal = document.getElementById('taskModal');
    const taskModalTitle = document.getElementById('taskModalTitle');
    const closeTaskModal = document.getElementById('closeTaskModal');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const taskTitleInput = document.getElementById('taskTitleInput');
    const taskCourseInput = document.getElementById('taskCourseInput');
    const taskLinkInput = document.getElementById('taskLinkInput');
    const taskDeadlineDateInput = document.getElementById('taskDeadlineDateInput');
    const taskDeadlineTimeInput = document.getElementById('taskDeadlineTimeInput');
    const taskEditIndex = document.getElementById('taskEditIndex');

    function openModal() {
        taskModal.style.display = 'block';
    }

    function closeModal() {
        taskModal.style.display = 'none';
        clearForm();
    }

    function setDeadlineDaysFromNow(days) {
        const target = new Date();
        target.setDate(target.getDate() + days);
        taskDeadlineDateInput.value = formatDateDDMMYY(target);
        taskDeadlineTimeInput.value = '23:59';
        document.querySelectorAll('.deadline-shortcut').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
        });
    }

    function getDeadlineFromInputs() {
        const dateVal = taskDeadlineDateInput.value.trim();
        if (!dateVal) return null;
        // Parse DD/MM/YY
        const parts = dateVal.split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const timeVal = taskDeadlineTimeInput.value.trim() || '23:59';
        const timeParts = timeVal.split(':');
        const hours = parseInt(timeParts[0], 10) || 23;
        const minutes = parseInt(timeParts[1], 10) || 59;
        const d = new Date(year, month, day, hours, minutes);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    function setInputsFromDeadline(deadlineStr) {
        if (!deadlineStr) {
            taskDeadlineDateInput.value = '';
            taskDeadlineTimeInput.value = '23:59';
            return;
        }
        const d = new Date(deadlineStr);
        if (isNaN(d.getTime())) return;
        taskDeadlineDateInput.value = formatDateDDMMYY(d);
        taskDeadlineTimeInput.value = formatTime24H(d);
    }

    // Auto-format date input: DD/MM/YY
    if (taskDeadlineDateInput) {
        taskDeadlineDateInput.addEventListener('input', function(e) {
            let val = this.value.replace(/[^\d/]/g, '');
            // Auto-insert slashes
            const digits = val.replace(/\//g, '');
            if (digits.length >= 4) {
                val = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 6);
            } else if (digits.length >= 2) {
                val = digits.slice(0, 2) + '/' + digits.slice(2);
            }
            this.value = val;
        });
    }

    // Auto-format time input: HH:MM
    if (taskDeadlineTimeInput) {
        taskDeadlineTimeInput.addEventListener('input', function(e) {
            let val = this.value.replace(/[^\d:]/g, '');
            const digits = val.replace(/:/g, '');
            if (digits.length >= 2) {
                val = digits.slice(0, 2) + ':' + digits.slice(2, 4);
            }
            this.value = val;
        });
    }

    function clearForm() {
        taskTitleInput.value = '';
        taskCourseInput.value = '';
        taskLinkInput.value = '';
        taskEditIndex.value = '-1';
        taskModalTitle.textContent = 'הוסף משימה';
        // Default to today at 23:59
        setDeadlineDaysFromNow(0);
    }

    // Wire up deadline shortcut buttons
    document.querySelectorAll('.deadline-shortcut').forEach(btn => {
        btn.addEventListener('click', function() {
            setDeadlineDaysFromNow(parseInt(this.dataset.days));
        });
    });

    // Clear active shortcut when user manually changes the date
    if (taskDeadlineDateInput) {
        taskDeadlineDateInput.addEventListener('input', function() {
            document.querySelectorAll('.deadline-shortcut').forEach(btn => btn.classList.remove('active'));
        });
    }

    // Open modal for new task
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', function() {
            clearForm();
            openModal();
        });
    }

    // Close modal
    if (closeTaskModal) {
        closeTaskModal.addEventListener('click', closeModal);
    }
    window.addEventListener('click', function(e) {
        if (e.target === taskModal) closeModal();
    });

    // Save task
    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', function() {
            const title = taskTitleInput.value.trim();
            if (!title) {
                taskTitleInput.style.borderColor = '#dc2626';
                return;
            }

            const course = taskCourseInput.value.trim();
            let link = taskLinkInput.value.trim();
            if (link && !link.match(/^https?:\/\//i)) {
                link = 'https://' + link;
            }
            const deadline = getDeadlineFromInputs();

            (async () => {
                const editId = taskEditIndex.value;

                if (editId && editId !== '-1') {
                    // Editing existing task
                    await tasksRepo.update(editId, {
                        title,
                        course_name: course,
                        link: link || null,
                        deadline,
                    });
                } else {
                    // Adding new task
                    await tasksRepo.add('task', {
                        title,
                        link: link || null,
                        course_name: course,
                        deadline,
                    });
                }

                closeModal();
                loadItems(); // Re-render the task list
            })();
        });
    }

    // Expose openTaskModal globally for the edit buttons in cards
    window.openTaskModal = function(item, index) {
        taskModalTitle.textContent = 'ערוך משימה';
        taskTitleInput.value = item.title || '';
        taskCourseInput.value = item.course || '';
        taskLinkInput.value = item.link || '';
        setInputsFromDeadline(item.deadline);
        // Store item id (from tasksRepo row) so the save handler can call tasksRepo.update
        taskEditIndex.value = item.id || '-1';
        openModal();
    };
})();

// Notification settings
const notificationHoursSelect = document.getElementById('notification-hours');
if (notificationHoursSelect) {
    chrome.storage.local.get('notificationSettings', function(data) {
        const settings = data.notificationSettings || { hoursBeforeAlert: 24 };
        notificationHoursSelect.value = String(settings.hoursBeforeAlert);
    });

    notificationHoursSelect.addEventListener('change', function() {
        chrome.storage.local.set({
            notificationSettings: { hoursBeforeAlert: parseInt(this.value, 10) }
        });
    });
}

// handle toggle for new badge
// document.addEventListener('DOMContentLoaded', function() {
//     if (chrome.browserAction) {
//       chrome.browserAction.setBadgeText({ text: '' });
//     } else if (chrome.action) {
//       chrome.action.setBadgeText({ text: '' });
//     }
//   });
  
// =============================================
// Home Tab Dashboard
// =============================================

function loadDashboard() {
    // Read all needed data in one go
    chrome.storage.local.get(['weeklyTracker'], function(localData) {
        (async () => {
            const active = (await tasksRepo.list('task')).map(normalizeTaskRow);
            const allIncludingDone = (await tasksRepo.list('task', { includeDone: true })).map(normalizeTaskRow);
            const done = allIncludingDone.filter(t => t.done);
            const taskItUp = active; // for compatibility with legacy variable names
            const doneMatchers = buildDoneTaskMatchers(done);

            const submissionsUI = await readSubmissionsForUI();
            const allCourses = submissionsUI.courses;
            const hiddenCourses = submissionsUI.hiddenCourses;
            const weeklyTracker = localData.weeklyTracker || {};

            // Filter out hidden and done assignments
            const courses = allCourses.filter(course =>
                !hiddenCourses.includes(course.link) &&
                !isSubmissionDone(course, doneMatchers)
            );

            // 1. Submissions count (Moodle only, excluding hidden/done)
            const submissionsValueEl = document.getElementById('summary-submissions-value');
            if (submissionsValueEl) submissionsValueEl.textContent = courses.length;

            // 1b. My Tasks count
            const myTasksValueEl = document.getElementById('summary-mytasks-value');
            if (myTasksValueEl) myTasksValueEl.textContent = taskItUp.length;

            // 2. Nearest deadline (from Moodle submissions only)
            const deadlineValueEl = document.getElementById('summary-deadline-value');
            if (deadlineValueEl) {
                const nearest = getNearestDeadline(courses);
                if (nearest) {
                    deadlineValueEl.textContent = nearest.label;
                    if (nearest.daysNum < 0) {
                        deadlineValueEl.style.color = '#d40505';
                    } else if (nearest.daysNum <= 1) {
                        deadlineValueEl.style.color = '#FF421D';
                    }
                } else {
                    deadlineValueEl.textContent = '--';
                }
            }

            // 2b. Next deadline bar (one-liner under quick links)
            const deadlineBar = document.getElementById('next-deadline-bar');
            const deadlineText = document.getElementById('next-deadline-text');
            if (deadlineBar && deadlineText) {
                const nextDeadline = getNextDeadlineInfo(courses);
                if (nextDeadline) {
                    let cssClass = '';
                    if (nextDeadline.daysNum < 0) cssClass = 'deadline-urgent';
                    else if (nextDeadline.daysNum <= 2) cssClass = 'deadline-soon';
                    deadlineText.innerHTML = `הגשה הבאה: <strong>${nextDeadline.name}</strong> · <span class="${cssClass}">${nextDeadline.label}</span>`;
                    deadlineBar.style.display = 'flex';
                } else {
                    deadlineBar.style.display = 'none';
                }
            }

            // 3. Weekly progress
            const progressValueEl = document.getElementById('summary-progress-value');
            if (progressValueEl) {
                const progress = calculateOverallProgress(weeklyTracker);
                progressValueEl.textContent = progress + '%';
            }

            // 4. Moodle upcoming deadlines widget
            renderUpcomingDeadlines(courses);

            // 5. My Tasks deadlines widget (separate)
            renderMyTasksDeadlines(taskItUp);
        })();
    });

    // Summary card click -> navigate to tab
    document.querySelectorAll('.summary-card[data-navigate]').forEach(card => {
        card.addEventListener('click', function() {
            const tab = this.getAttribute('data-navigate');
            const btn = document.querySelector(`.tab-button[data-tab="${tab}"]`);
            if (btn) btn.click();
        });
    });

    // "Show all" link -> navigate to tasks tab
    const showAllLink = document.getElementById('show-all-tasks');
    if (showAllLink) {
        showAllLink.addEventListener('click', function(e) {
            e.preventDefault();
            const btn = document.querySelector('.tab-button[data-tab="tasks"]');
            if (btn) btn.click();
        });
    }

    const showAllMyTasks = document.getElementById('show-all-my-tasks');
    if (showAllMyTasks) {
        showAllMyTasks.addEventListener('click', function(e) {
            e.preventDefault();
            const btn = document.querySelector('.tab-button[data-tab="tasks"]');
            if (btn) btn.click();
        });
    }
}

function getNearestDeadline(courses) {
    if (!courses || courses.length === 0) return null;

    const now = new Date();
    let nearest = null;
    let nearestDiff = Infinity;

    courses.forEach(course => {
        if (!course.date) return;
        const parts = course.date.split('/');
        if (parts.length < 3) return;
        const dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const diff = dueDate.getTime() - now.getTime();
        if (diff < nearestDiff) {
            nearestDiff = diff;
            nearest = { dueDate, diff };
        }
    });

    if (!nearest) return null;

    const daysNum = Math.ceil(nearest.diff / (1000 * 3600 * 24));
    let label;
    if (daysNum < 0) label = 'באיחור';
    else if (daysNum === 0) label = 'היום!';
    else if (daysNum === 1) label = 'מחר';
    else label = daysNum + ' ימים';

    return { label, daysNum };
}

function getNextDeadlineInfo(courses) {
    if (!courses || courses.length === 0) return null;

    const now = new Date();
    let nearest = null;
    let nearestDiff = Infinity;

    courses.forEach(course => {
        if (!course.date) return;
        const parts = course.date.split('/');
        if (parts.length < 3) return;
        const dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const diff = dueDate.getTime() - now.getTime();
        if (diff < nearestDiff) {
            nearestDiff = diff;
            nearest = { name: course.name, dueDate, diff };
        }
    });

    if (!nearest) return null;

    const daysNum = Math.ceil(nearest.diff / (1000 * 3600 * 24));
    let label;
    if (daysNum < 0) label = 'באיחור!';
    else if (daysNum === 0) label = 'היום!';
    else if (daysNum === 1) label = 'מחר';
    else label = 'עוד ' + daysNum + ' ימים';

    return { name: nearest.name, label, daysNum };
}

function calculateOverallProgress(weeklyTracker) {
    const courseIds = Object.keys(weeklyTracker);
    if (courseIds.length === 0) return 0;

    let totalCells = 0;
    let completedCells = 0;

    courseIds.forEach(courseId => {
        const course = weeklyTracker[courseId];
        // 13 weeks, 2 items each (lecture + practice) = 26 total per course
        totalCells += 13 * 2;
        for (let week = 1; week <= 13; week++) {
            const weekData = course.weeks?.[week];
            if (weekData) {
                if (weekData.lecture) completedCells++;
                if (weekData.practice) completedCells++;
            }
        }
    });

    return totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;
}

function renderUpcomingDeadlines(courses) {
    const container = document.getElementById('upcoming-deadlines-list');
    if (!container) return;

    if (!courses || courses.length === 0) {
        container.innerHTML = '<div class="upcoming-empty">אין מטלות קרובות</div>';
        return;
    }

    const now = new Date();
    const sorted = courses
        .filter(c => c.date)
        .map(course => {
            const parts = course.date.split('/');
            if (parts.length < 3) return null;
            const dueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            const daysLeft = Math.ceil((dueDate - now) / (1000 * 3600 * 24));
            return { ...course, dueDate, daysLeft };
        })
        .filter(Boolean)
        .sort((a, b) => a.dueDate - b.dueDate)
        .slice(0, 3);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="upcoming-empty">אין מטלות קרובות</div>';
        return;
    }

    container.innerHTML = '';
    sorted.forEach(course => {
        const item = document.createElement('div');
        item.className = 'upcoming-item';

        let courseName = '';
        if (course.desc) {
            const parts = course.desc.substring(12).split('·');
            if (parts.length > 1) courseName = parts[1].trim();
        }

        const info = document.createElement('div');
        info.className = 'upcoming-item-info';
        info.innerHTML = `
            <div class="upcoming-item-name">${course.name}</div>
            <div class="upcoming-item-course">${courseName} · ${course.date} ${course.time || ''}</div>`;

        const badge = document.createElement('span');
        badge.className = 'upcoming-item-badge';
        if (course.daysLeft < 0) { badge.classList.add('overdue'); badge.textContent = 'באיחור'; }
        else if (course.daysLeft <= 1) { badge.classList.add('urgent'); badge.textContent = course.daysLeft === 0 ? 'היום' : 'מחר'; }
        else { badge.classList.add('normal'); badge.textContent = course.daysLeft + ' ימים'; }

        // Submit link button
        const submitBtn = document.createElement('a');
        submitBtn.className = 'task-action-btn submit-link widget-action';
        submitBtn.href = course.link;
        submitBtn.target = '_blank';
        submitBtn.innerHTML = '<i class="fa fa-external-link"></i>';
        submitBtn.title = 'פתח הגשה';
        submitBtn.addEventListener('click', function(e) { e.stopPropagation(); });

        item.appendChild(info);
        item.appendChild(badge);
        item.appendChild(submitBtn);
        container.appendChild(item);
    });
}

function renderMyTasksDeadlines(taskItUp) {
    const container = document.getElementById('my-tasks-deadlines-list');
    if (!container) return;

    const items = taskItUp || [];

    // Hide widget if no tasks at all
    const widget = document.getElementById('my-tasks-deadlines');
    if (widget) {
        widget.style.display = items.length > 0 ? 'block' : 'none';
    }

    if (items.length === 0) {
        container.innerHTML = '<div class="upcoming-empty">אין משימות</div>';
        return;
    }

    // Sort: tasks with deadlines first (by date), then tasks without deadlines
    const now = new Date();
    const sorted = items.map(task => {
        let dueDate = null, daysLeft = null, dateStr = '', timeStr = '';
        if (task.deadline) {
            dueDate = new Date(task.deadline);
            if (!isNaN(dueDate.getTime())) {
                daysLeft = Math.ceil((dueDate - now) / (1000 * 3600 * 24));
                dateStr = formatDateDDMMYY(dueDate);
                timeStr = formatTime24H(dueDate);
            } else {
                dueDate = null;
            }
        }
        return { ...task, dueDate, daysLeft, dateStr, timeStr };
    }).sort((a, b) => {
        // Tasks with deadlines come first, sorted by date
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
    }).slice(0, 3);

    container.innerHTML = '';
    sorted.forEach((task, idx) => {
        const item = document.createElement('div');
        item.className = 'upcoming-item';

        const typeName = getTaskTypeName(task.itemType);
        const subtitleParts = [task.course || typeName];
        if (task.dateStr) subtitleParts.push(task.dateStr + ' ' + task.timeStr);

        const info = document.createElement('div');
        info.className = 'upcoming-item-info';
        info.innerHTML = `
            <div class="upcoming-item-name">${task.title}</div>
            <div class="upcoming-item-course">${subtitleParts.join(' · ')}</div>`;

        item.appendChild(info);

        // Show urgency badge only if task has a deadline
        if (task.daysLeft !== null) {
            const badge = document.createElement('span');
            badge.className = 'upcoming-item-badge';
            if (task.daysLeft < 0) { badge.classList.add('overdue'); badge.textContent = 'באיחור'; }
            else if (task.daysLeft <= 1) { badge.classList.add('urgent'); badge.textContent = task.daysLeft === 0 ? 'היום' : 'מחר'; }
            else { badge.classList.add('normal'); badge.textContent = task.daysLeft + ' ימים'; }
            item.appendChild(badge);
        }

        // Mark as done button
        const doneBtn = document.createElement('button');
        doneBtn.className = 'task-action-btn icon-btn check-done widget-action';
        doneBtn.innerHTML = '<i class="fa fa-check"></i>';
        doneBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Mark done and re-render
            (async () => {
                if (task.id) {
                    await tasksRepo.markDone(task.id);
                } else {
                    const existing = await tasksRepo.findByTitleAndKind(task.title, 'task');
                    if (existing) await tasksRepo.markDone(existing.id);
                }
                item.style.transition = 'opacity 0.2s, transform 0.2s';
                item.style.opacity = '0';
                item.style.transform = 'translateX(20px)';
                const freshItems = (await tasksRepo.list('task')).map(normalizeTaskRow);
                setTimeout(() => {
                    renderMyTasksDeadlines(freshItems);
                    loadItems(); // refresh Tasks tab too
                    // Update dashboard task count
                    const countEl = document.getElementById('summary-tasks-value');
                    if (countEl) countEl.textContent = freshItems.length;
                }, 200);
            })();
        });
        item.appendChild(doneBtn);

        container.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', loadDashboard);

document.getElementById("zoomInButton").addEventListener("click", function() {
    // Select all elements inside the body
    const textElements = document.querySelectorAll("body *:not(div)");

    textElements.forEach(element => {
        // Get the current font size
        const computedStyle = window.getComputedStyle(element);
        console.log(computedStyle)
        const currentFontSize = computedStyle.fontSize;
        console.log(currentFontSize)

        // Check if the font size is set (not "0px" or empty)
        if (currentFontSize && parseFloat(currentFontSize) > 0) {
            // Parse the font size and apply the scaling
            const currentSize = parseFloat(currentFontSize);
            element.style.fontSize = (currentSize * 1.1) + "px";
        }
    });
});


// =============================================
// Sync status indicator
// =============================================
(function () {
    function _init() {
        const btn = document.getElementById('sync-status');
        const dot = btn?.querySelector('.sync-dot');
        const label = btn?.querySelector('.sync-label');
        if (!btn || !dot) return;

        let isSyncing = false;

        function setState(state, queueLen) {
            dot.dataset.state = state;
            if (label) label.dataset.state = state;

            let text = '';
            let title = '';
            switch (state) {
                case 'syncing':
                    text = 'מסנכרן...';
                    title = 'מסנכרן את הנתונים שלך';
                    break;
                case 'synced':
                    text = 'מסונכרן';
                    title = 'הכל מסונכרן';
                    break;
                case 'pending':
                    text = queueLen ? `${queueLen} ממתינים` : 'ממתין';
                    title = `${queueLen || 0} שינויים ממתינים — לחץ לסנכרון`;
                    break;
                case 'error':
                    text = 'שגיאת סנכרון';
                    title = `שגיאת סנכרון (${queueLen || 0} פריטים) — לחץ כדי לנסות שוב`;
                    break;
                case 'offline':
                    text = 'לא מחובר';
                    title = 'אין חיבור לשרת';
                    break;
                default:
                    text = '';
                    title = 'סנכרון';
            }
            if (label) label.textContent = text;
            btn.title = title;
        }

        async function refresh() {
            if (isSyncing) return;
            try {
                if (typeof sync === 'undefined') { setState('unknown'); return; }
                const status = await sync.getStatus();
                const queueLen = await new Promise((resolve) => {
                    chrome.storage.local.get('syncQueue', (d) => resolve((d.syncQueue || []).length));
                });
                setState(status, queueLen);
            } catch (err) {
                setState('error', 0);
            }
        }

        async function runFlush() {
            if (typeof sync === 'undefined') return;
            btn.disabled = true;
            isSyncing = true;
            setState('syncing');
            try {
                await sync.flushQueue();
            } finally {
                isSyncing = false;
                btn.disabled = false;
                refresh();
            }
        }

        btn.addEventListener('click', () => openSyncDetails());

        async function openSyncDetails() {
            if (typeof sync === 'undefined') return;
            const modal = document.getElementById('syncDetailsModal');
            if (!modal) return;

            await renderSyncDetails();
            modal.style.display = 'block';
        }

        function closeSyncDetails() {
            const modal = document.getElementById('syncDetailsModal');
            if (modal) modal.style.display = 'none';
        }

        async function renderSyncDetails() {
            const status = await sync.getStatus();
            const queue = await new Promise((r) => chrome.storage.local.get('syncQueue', (d) => r(d.syncQueue || [])));
            const lastError = (sync.getLastError ? await sync.getLastError() : null);

            const dDot = document.getElementById('syncDetailsDot');
            const dLabel = document.getElementById('syncDetailsStateLabel');
            if (dDot) dDot.dataset.state = status;
            if (dLabel) {
                if (status === 'synced') dLabel.textContent = 'הכל מסונכרן';
                else if (status === 'pending') dLabel.textContent = `${queue.length} פריטים ממתינים`;
                else if (status === 'error') dLabel.textContent = `שגיאת סנכרון — ${queue.length} פריטים תקועים`;
                else dLabel.textContent = 'מצב לא ידוע';
            }

            const errBox = document.getElementById('syncDetailsError');
            const errMsg = document.getElementById('syncDetailsErrorMessage');
            const errMeta = document.getElementById('syncDetailsErrorMeta');
            if (lastError && errBox && errMsg && errMeta) {
                errMsg.textContent = lastError.message || 'unknown error';
                const parts = [];
                if (lastError.code) parts.push(`code=${lastError.code}`);
                if (lastError.table) parts.push(`table=${lastError.table}`);
                if (lastError.op) parts.push(`op=${lastError.op}`);
                if (lastError.at) parts.push(new Date(lastError.at).toLocaleString('he-IL'));
                errMeta.textContent = parts.join(' · ');
                errBox.hidden = false;
            } else if (errBox) {
                errBox.hidden = true;
            }

            const pendingBox = document.getElementById('syncDetailsPending');
            const pendingList = document.getElementById('syncDetailsPendingList');
            if (pendingList) pendingList.innerHTML = '';
            if (queue.length > 0 && pendingBox && pendingList) {
                queue.slice(0, 20).forEach((entry) => {
                    const li = document.createElement('li');
                    const left = document.createElement('span');
                    left.textContent = `${entry.table} · ${entry.op}`;
                    const right = document.createElement('span');
                    right.className = 'pending-attempts';
                    right.textContent = entry.attempts ? `נכשל ${entry.attempts}×` : 'בתור';
                    li.appendChild(left);
                    li.appendChild(right);
                    pendingList.appendChild(li);
                });
                if (queue.length > 20) {
                    const li = document.createElement('li');
                    li.textContent = `ועוד ${queue.length - 20}…`;
                    pendingList.appendChild(li);
                }
                pendingBox.hidden = false;
            } else if (pendingBox) {
                pendingBox.hidden = true;
            }

            const clearBtn = document.getElementById('syncDetailsClearBtn');
            if (clearBtn) clearBtn.hidden = !(status === 'error');
        }

        const closeBtn = document.getElementById('closeSyncDetailsModal');
        if (closeBtn) closeBtn.addEventListener('click', closeSyncDetails);
        const modal = document.getElementById('syncDetailsModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeSyncDetails(); });

        const retryBtn = document.getElementById('syncDetailsRetryBtn');
        if (retryBtn) retryBtn.addEventListener('click', async () => {
            retryBtn.disabled = true;
            try {
                await runFlush();
                await renderSyncDetails();
            } finally {
                retryBtn.disabled = false;
            }
        });

        const clearBtn = document.getElementById('syncDetailsClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', async () => {
            const ok = window.confirm('הפעולה תמחק את כל הפריטים התקועים בתור הסנכרון. הם לא יישלחו לשרת. להמשיך?');
            if (!ok) return;
            if (sync.clearQueue) await sync.clearQueue();
            await renderSyncDetails();
            refresh();
        });

        refresh();
        setInterval(refresh, 10_000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();
