// Function to format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to calculate storage usage for a specific key
function calculateKeyStorageUsage(key, storageType, elementId) {
    const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    storage.getBytesInUse([key], (bytes) => {
        const maxBytes = storageType === 'sync' ? 102400 : 5242880; // 100KB for sync, 5MB for local
        const percentage = ((bytes / maxBytes) * 100).toFixed(2);
        const remaining = formatBytes(maxBytes - bytes);
        
        // Update usage text
        document.getElementById(elementId).innerHTML = `
            ${formatBytes(bytes)} / ${formatBytes(maxBytes)} (${percentage}%)
            <br><small>Remaining: ${remaining}</small>
        `;

        // Update progress bar
        const progressBar = document.getElementById(`${key}ProgressBar`);
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            
            // Add warning class if storage is almost full
            if (percentage > 80) {
                progressBar.classList.add('warning');
            } else {
                progressBar.classList.remove('warning');
            }
        }
    });
}

// Escape strings for safe insertion into HTML attributes
function escapeAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Function to create a table from data.
// deleteConfig (optional): { storageKey, storageType, identifier: (item, idx) => string }
// When provided, adds an Actions column with a per-row delete button.
function createTable(data, columns, deleteConfig) {
    if (!data || data.length === 0) {
        return '<p>No data available</p>';
    }

    let table = '<table><thead><tr>';
    columns.forEach(column => {
        table += `<th>${column.label}</th>`;
    });
    if (deleteConfig) {
        table += '<th class="storage-table-row-actions">Actions</th>';
    }
    table += '</tr></thead><tbody>';

    data.forEach((item, idx) => {
        table += '<tr>';
        columns.forEach(column => {
            let value = item[column.key] ?? '';
            // Make URLs clickable
            if (column.key === 'url' && value) {
                value = `<a href="${value}" target="_blank" title="${value}">${value}</a>`;
            }
            table += `<td>${value}</td>`;
        });
        if (deleteConfig) {
            const rowId = deleteConfig.identifier(item, idx);
            table += `<td class="storage-table-row-actions">
                <button class="row-delete-btn"
                    data-storage-key="${escapeAttr(deleteConfig.storageKey)}"
                    data-storage-type="${escapeAttr(deleteConfig.storageType)}"
                    data-row-id="${escapeAttr(rowId)}"
                    title="Delete this row">
                    <i class="fas fa-times"></i>
                </button>
            </td>`;
        }
        table += '</tr>';
    });

    table += '</tbody></table>';
    return table;
}

// Function to calculate storage usage
function calculateStorageUsage() {
    // Calculate total storage usage
    chrome.storage.local.getBytesInUse(null, (bytes) => {
        document.getElementById('localStorageUsage').textContent = formatBytes(bytes);
    });

    chrome.storage.sync.getBytesInUse(null, (bytes) => {
        document.getElementById('syncStorageUsage').textContent = formatBytes(bytes);
    });

    // Calculate individual storage usage
    calculateKeyStorageUsage('courses', 'local', 'coursesStorageUsage');
    calculateKeyStorageUsage('watchedVideos', 'local', 'watchedVideosStorageUsage');
    calculateKeyStorageUsage('videoTimes', 'local', 'videoTimesStorageUsage');
    calculateKeyStorageUsage('watchLater', 'sync', 'watchLaterStorageUsage');
    calculateKeyStorageUsage('taskItUp', 'sync', 'taskItUpStorageUsage');
    calculateKeyStorageUsage('doneItems', 'sync', 'doneItemsStorageUsage');
    calculateKeyStorageUsage('weeklyTracker', 'local', 'weeklyTrackerStorageUsage');
    calculateKeyStorageUsage('availableCourses', 'local', 'availableCoursesStorageUsage');
    calculateKeyStorageUsage('analyticsStudySessions', 'local', 'analyticsStudySessionsStorageUsage');
    calculateKeyStorageUsage('analyticsDeadlineBehavior', 'local', 'analyticsDeadlineBehaviorStorageUsage');
    calculateKeyStorageUsage('analyticsEngagement', 'local', 'analyticsEngagementStorageUsage');
}

// Function to load and display all data
function loadAllData() {
    // Load courses data from local storage
    chrome.storage.local.get(['courses'], (result) => {
        const courses = result.courses || [];
        setTableContent('coursesTable', createTable(courses, [
            { key: 'name', label: 'Name' },
            { key: 'desc', label: 'Description' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
            { key: 'link', label: 'Link' }
        ], {
            storageKey: 'courses',
            storageType: 'local',
            identifier: (item, idx) => String(idx)
        }));
    });

    // Load taskItUp items from sync storage
    chrome.storage.sync.get(['taskItUp'], (result) => {
        const items = result.taskItUp || [];
        setTableContent('taskItUpTable', createTable(items, [
            { key: 'title', label: 'Title' },
            { key: 'course', label: 'Course' },
            { key: 'link', label: 'Link' },
            { key: 'itemType', label: 'Type' }
        ], {
            storageKey: 'taskItUp',
            storageType: 'sync',
            identifier: (item) => `${item.link || ''}::${item.itemType || ''}`
        }));
    });

    // Load done items from sync storage
    chrome.storage.sync.get(['doneItems'], (result) => {
        const doneItems = result.doneItems || [];
        const doneItemsObjects = doneItems.map(item => ({
            title: typeof item === 'string' ? item : (item && item.title) || ''
        }));
        setTableContent('doneItemsTable', createTable(doneItemsObjects, [
            { key: 'title', label: 'Title' }
        ], {
            storageKey: 'doneItems',
            storageType: 'sync',
            identifier: (item) => item.title
        }));
    });

    // Load watched videos from local storage
    chrome.storage.local.get(['watchedVideos'], (result) => {
        const watchedVideos = result.watchedVideos || [];
        setTableContent('watchedVideosTable', createTable(watchedVideos, [
            { key: 'title', label: 'Title' },
            { key: 'course', label: 'Course' },
            { key: 'link', label: 'Link' }
        ], {
            storageKey: 'watchedVideos',
            storageType: 'local',
            identifier: (item) => item.link || ''
        }));
    });

    // Load video times from local storage
    chrome.storage.local.get(['videoTimes'], (result) => {
        const videoTimes = result.videoTimes || {};
        const videoTimesArray = Object.entries(videoTimes).map(([url, data]) => {
            if (!data || typeof data !== 'object') {
                return null;
            }
            return {
                title: data.title || 'Unknown Video',
                course: data.course || 'Unknown Course',
                time: formatTime(data.time || 0),
                duration: formatTime(data.duration || 0),
                timestamp: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown',
                url: url
            };
        }).filter(item => item !== null);

        videoTimesArray.sort((a, b) => {
            if (a.course === b.course) {
                return a.title.localeCompare(b.title);
            }
            return a.course.localeCompare(b.course);
        });

        setTableContent('videoTimesTable', createTable(videoTimesArray, [
            { key: 'course', label: 'Course' },
            { key: 'title', label: 'Video Title' },
            { key: 'time', label: 'Current Time' },
            { key: 'duration', label: 'Duration' },
            { key: 'timestamp', label: 'Last Updated' },
            { key: 'url', label: 'URL' }
        ], {
            storageKey: 'videoTimes',
            storageType: 'local',
            identifier: (item) => item.url
        }));
    });

    // Load watch later items from sync storage
    chrome.storage.sync.get(['watchLater'], (result) => {
        const watchLater = result.watchLater || [];
        setTableContent('watchLaterTable', createTable(watchLater, [
            { key: 'title', label: 'Title' },
            { key: 'course', label: 'Course' },
            { key: 'link', label: 'Link' },
            { key: 'addedAt', label: 'Added At' }
        ], {
            storageKey: 'watchLater',
            storageType: 'sync',
            identifier: (item) => item.link || ''
        }));
    });

    // Load weekly tracker data from local storage
    chrome.storage.local.get(['weeklyTracker', 'availableCourses'], (result) => {
        // Display weekly tracker data
        const weeklyTracker = result.weeklyTracker || {};
        const availableCourses = result.availableCourses || [];

        // Create a map of course IDs to course names
        const courseNameMap = {};
        availableCourses.forEach((course, index) => {
            courseNameMap[index.toString()] = course.name;
        });

        const weeklyTrackerArray = Object.entries(weeklyTracker)
            .map(([courseKey, data]) => {
                // Get the course name from the map or use the key itself if not found
                const courseName = courseNameMap[courseKey] || courseKey;

                // Count completed weeks (where both lecture and practice are true)
                const completedWeeks = Object.values(data.weeks || {})
                    .filter(weekData => weekData.lecture && weekData.practice)
                    .length;

                // Count total weeks that have any data
                const totalWeeks = Object.keys(data.weeks || {}).length;

                return {
                    _rowId: courseKey, // original storage key for delete
                    courseName: courseName,
                    currentWeek: data.currentWeek || 1,
                    completedWeeks: completedWeeks,
                    totalWeeks: Math.max(totalWeeks, 14),
                    progress: Math.round((completedWeeks / 14) * 100)
                };
            })
            .filter(item => item.courseName);

        setTableContent('weeklyTrackerTable', createTable(weeklyTrackerArray, [
            { key: 'courseName', label: 'Course Name' },
            { key: 'currentWeek', label: 'Current Week' },
            { key: 'completedWeeks', label: 'Completed Weeks' },
            { key: 'totalWeeks', label: 'Total Weeks' },
            { key: 'progress', label: 'Progress %' }
        ], {
            storageKey: 'weeklyTracker',
            storageType: 'local',
            identifier: (item) => item._rowId
        }));

        // Display available courses
        setTableContent('availableCoursesTable', createTable(availableCourses, [
            { key: 'name', label: 'Course Name' },
            { key: 'desc', label: 'Description' },
            { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' },
            { key: 'link', label: 'Link' }
        ], {
            storageKey: 'availableCourses',
            storageType: 'local',
            identifier: (item, idx) => String(idx)
        }));
    });

    // Load analytics: study sessions (nested: {date: {course: {totalSeconds}}})
    chrome.storage.local.get(['analyticsStudySessions'], (result) => {
        const sessions = result.analyticsStudySessions || {};
        const rows = [];
        Object.entries(sessions).forEach(([date, dayCourses]) => {
            if (!dayCourses || typeof dayCourses !== 'object') return;
            Object.entries(dayCourses).forEach(([course, info]) => {
                const sec = (info && info.totalSeconds) || 0;
                rows.push({
                    _rowId: `${date}::${course}`,
                    date: date,
                    course: course,
                    studyTime: formatTime(sec)
                });
            });
        });
        rows.sort((a, b) => b.date.localeCompare(a.date) || a.course.localeCompare(b.course));

        setTableContent('analyticsStudySessionsTable', createTable(rows, [
            { key: 'date', label: 'Date' },
            { key: 'course', label: 'Course' },
            { key: 'studyTime', label: 'Study Time' }
        ], {
            storageKey: 'analyticsStudySessions',
            storageType: 'local',
            identifier: (item) => item._rowId
        }));
    });

    // Load analytics: deadline behavior
    chrome.storage.local.get(['analyticsDeadlineBehavior'], (result) => {
        const items = (result.analyticsDeadlineBehavior || []).map((item, idx) => ({
            _rowId: String(idx),
            title: item.title || '',
            course: item.course || '',
            submittedAt: item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '',
            hoursBeforeDeadline: item.hoursBeforeDeadline != null ? item.hoursBeforeDeadline + 'h' : ''
        }));

        setTableContent('analyticsDeadlineBehaviorTable', createTable(items, [
            { key: 'title', label: 'Title' },
            { key: 'course', label: 'Course' },
            { key: 'submittedAt', label: 'Submitted' },
            { key: 'hoursBeforeDeadline', label: 'Hours Before Deadline' }
        ], {
            storageKey: 'analyticsDeadlineBehavior',
            storageType: 'local',
            identifier: (item) => item._rowId
        }));
    });

    // Load analytics: engagement (3 sub-arrays of timestamps/dates)
    chrome.storage.local.get(['analyticsEngagement'], (result) => {
        const eng = result.analyticsEngagement || { extensionOpens: [], moodleVisits: [], activeDays: [] };
        const rows = [];
        (eng.extensionOpens || []).forEach((ts, idx) => {
            rows.push({
                _rowId: `extensionOpens::${idx}`,
                category: 'Extension Open',
                value: ts ? new Date(ts).toLocaleString() : '',
                _sortKey: ts || ''
            });
        });
        (eng.moodleVisits || []).forEach((ts, idx) => {
            rows.push({
                _rowId: `moodleVisits::${idx}`,
                category: 'Moodle Visit',
                value: ts ? new Date(ts).toLocaleString() : '',
                _sortKey: ts || ''
            });
        });
        (eng.activeDays || []).forEach((d, idx) => {
            rows.push({
                _rowId: `activeDays::${idx}`,
                category: 'Active Day',
                value: d || '',
                _sortKey: d || ''
            });
        });
        rows.sort((a, b) => b._sortKey.localeCompare(a._sortKey));

        setTableContent('analyticsEngagementTable', createTable(rows, [
            { key: 'category', label: 'Category' },
            { key: 'value', label: 'Timestamp / Date' }
        ], {
            storageKey: 'analyticsEngagement',
            storageType: 'local',
            identifier: (item) => item._rowId
        }));
    });

    // Populate the purge-course dropdown (union of 4 course sources, matches analytics.js logic)
    populatePurgeDropdown();

    // Calculate storage usage
    calculateStorageUsage();
}

// Helper function to format time in seconds to HH:MM:SS
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Function to refresh all data
function refreshData() {
    loadAllData();
}

// Delete a single row from a storage key. Handles all 11 shapes in one dispatcher.
function deleteRow(storageKey, storageType, rowId) {
    const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
    storage.get([storageKey], (result) => {
        let data = result[storageKey];

        switch (storageKey) {
            case 'courses':
            case 'availableCourses':
            case 'analyticsDeadlineBehavior': {
                const idx = parseInt(rowId, 10);
                if (!isNaN(idx) && Array.isArray(data)) {
                    data.splice(idx, 1);
                }
                break;
            }
            case 'watchedVideos':
            case 'watchLater': {
                data = (data || []).filter(item => (item.link || '') !== rowId);
                break;
            }
            case 'taskItUp': {
                data = (data || []).filter(item => `${item.link || ''}::${item.itemType || ''}` !== rowId);
                break;
            }
            case 'doneItems': {
                // Array of strings OR objects — must detect per element
                data = (data || []).filter(item => {
                    const title = typeof item === 'string' ? item : (item && item.title) || '';
                    return title !== rowId;
                });
                break;
            }
            case 'videoTimes':
            case 'weeklyTracker': {
                if (data && typeof data === 'object') {
                    delete data[rowId];
                }
                break;
            }
            case 'analyticsStudySessions': {
                // rowId = 'date::courseName' — split only on first '::' in case course has '::'
                const sepIdx = rowId.indexOf('::');
                if (sepIdx === -1) break;
                const date = rowId.slice(0, sepIdx);
                const courseName = rowId.slice(sepIdx + 2);
                if (data && data[date]) {
                    delete data[date][courseName];
                    if (Object.keys(data[date]).length === 0) {
                        delete data[date];
                    }
                }
                break;
            }
            case 'analyticsEngagement': {
                // rowId = 'subkey::index'
                const sepIdx = rowId.indexOf('::');
                if (sepIdx === -1) break;
                const subkey = rowId.slice(0, sepIdx);
                const idx = parseInt(rowId.slice(sepIdx + 2), 10);
                if (data && Array.isArray(data[subkey]) && !isNaN(idx)) {
                    data[subkey].splice(idx, 1);
                }
                break;
            }
            default:
                console.warn(`deleteRow: unknown storage key "${storageKey}"`);
                return;
        }

        const setObj = {};
        setObj[storageKey] = data;
        storage.set(setObj, () => {
            loadAllData();
        });
    });
}

// Purge every trace of a course from every course-tagged storage key.
// Skips doneItems (titles only) and analyticsEngagement (timestamps only).
function purgeCourse(courseName) {
    if (!courseName) return;
    if (!confirm(`Remove all data for course "${courseName}" from every storage key?\n\nThis cannot be undone.`)) {
        return;
    }

    const localKeys = [
        'courses', 'availableCourses', 'watchedVideos', 'videoTimes',
        'weeklyTracker', 'analyticsStudySessions', 'analyticsDeadlineBehavior'
    ];
    const syncKeys = ['watchLater', 'taskItUp'];

    chrome.storage.local.get(localKeys, (localData) => {
        chrome.storage.sync.get(syncKeys, (syncData) => {
            // Arrays: simple filter by course name
            if (Array.isArray(localData.courses)) {
                localData.courses = localData.courses.filter(item => item && item.name !== courseName);
            }
            if (Array.isArray(localData.availableCourses)) {
                localData.availableCourses = localData.availableCourses.filter(item => item && item.name !== courseName);
            }
            if (Array.isArray(localData.watchedVideos)) {
                localData.watchedVideos = localData.watchedVideos.filter(item => item && item.course !== courseName);
            }
            if (Array.isArray(syncData.watchLater)) {
                syncData.watchLater = syncData.watchLater.filter(item => item && item.course !== courseName);
            }
            if (Array.isArray(syncData.taskItUp)) {
                syncData.taskItUp = syncData.taskItUp.filter(item => item && item.course !== courseName);
            }
            // analyticsDeadlineBehavior: use .includes() to match analytics.js semantics (line 329)
            if (Array.isArray(localData.analyticsDeadlineBehavior)) {
                localData.analyticsDeadlineBehavior = localData.analyticsDeadlineBehavior.filter(item =>
                    !item || !item.course || !item.course.includes(courseName)
                );
            }
            // videoTimes: iterate, delete entries where value.course === courseName
            if (localData.videoTimes && typeof localData.videoTimes === 'object') {
                Object.keys(localData.videoTimes).forEach(url => {
                    if (localData.videoTimes[url] && localData.videoTimes[url].course === courseName) {
                        delete localData.videoTimes[url];
                    }
                });
            }
            // weeklyTracker: delete obj[courseName] AND numeric-keyed legacy entries
            if (localData.weeklyTracker && typeof localData.weeklyTracker === 'object') {
                delete localData.weeklyTracker[courseName];
                const availCourses = Array.isArray(localData.availableCourses) ? localData.availableCourses : [];
                availCourses.forEach((course, index) => {
                    if (course && course.name === courseName) {
                        delete localData.weeklyTracker[index.toString()];
                    }
                });
            }
            // analyticsStudySessions: nested {date: {course: ...}} — iterate dates
            if (localData.analyticsStudySessions && typeof localData.analyticsStudySessions === 'object') {
                Object.keys(localData.analyticsStudySessions).forEach(date => {
                    const dayCourses = localData.analyticsStudySessions[date];
                    if (dayCourses && typeof dayCourses === 'object' && (courseName in dayCourses)) {
                        delete dayCourses[courseName];
                    }
                    if (!dayCourses || Object.keys(dayCourses).length === 0) {
                        delete localData.analyticsStudySessions[date];
                    }
                });
            }

            // Grouped writes: one local.set, one sync.set
            chrome.storage.local.set(localData, () => {
                chrome.storage.sync.set(syncData, () => {
                    // Show inline success message at the top of the page
                    const container = document.querySelector('.purge-course-section');
                    if (container) {
                        const successMessage = document.createElement('div');
                        successMessage.className = 'success-message';
                        successMessage.innerHTML = `<i class="fas fa-check-circle"></i> Purged all data for "${courseName}".`;
                        container.appendChild(successMessage);
                        setTimeout(() => successMessage.remove(), 4000);
                    }
                    loadAllData();
                });
            });
        });
    });
}

// Populate the purge-course dropdown with the UNION of all course sources,
// mirroring analytics.js:getActiveCourses() so stale courses are included (which is the point).
function populatePurgeDropdown() {
    const select = document.getElementById('purgeCourseSelect');
    if (!select) return;

    chrome.storage.local.get(
        ['availableCourses', 'analyticsStudySessions', 'videoTimes', 'weeklyTracker'],
        (data) => {
            const courseSet = new Set();

            (data.availableCourses || []).forEach(c => {
                if (c && c.name) courseSet.add(c.name.trim());
            });
            Object.values(data.analyticsStudySessions || {}).forEach(dayCourses => {
                if (dayCourses && typeof dayCourses === 'object') {
                    Object.keys(dayCourses).forEach(c => {
                        if (c !== '__general__') courseSet.add(c);
                    });
                }
            });
            Object.values(data.videoTimes || {}).forEach(v => {
                if (v && v.course) courseSet.add(v.course);
            });

            // weeklyTracker keys: course name OR legacy numeric index mapped via availableCourses
            const availCourses = data.availableCourses || [];
            Object.keys(data.weeklyTracker || {}).forEach(key => {
                if (/^\d+$/.test(key) && availCourses[parseInt(key, 10)] && availCourses[parseInt(key, 10)].name) {
                    courseSet.add(availCourses[parseInt(key, 10)].name);
                } else {
                    courseSet.add(key);
                }
            });

            const previousValue = select.value;
            const courses = Array.from(courseSet).sort();
            select.innerHTML = '<option value="">-- select a course --</option>' +
                courses.map(c => `<option value="${escapeAttr(c)}">${escapeAttr(c)}</option>`).join('');
            // Restore previous selection if it still exists
            if (previousValue && courses.includes(previousValue)) {
                select.value = previousValue;
            }

            // Enable/disable purge button based on selection
            const btn = document.getElementById('purgeCourseBtn');
            if (btn) btn.disabled = !select.value;
        }
    );
}

// Function to clear data for a specific key
function clearData(key, storageType) {
    if (confirm(`Are you sure you want to clear all ${key} data? This action cannot be undone.`)) {
        const storage = storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
        storage.remove([key], () => {
            // Show success message
            const container = document.getElementById(`${key}Table`).parentElement;
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.innerHTML = `
                <i class="fas fa-check-circle"></i>
                Data cleared successfully!
            `;
            container.insertBefore(successMessage, document.getElementById(`${key}Table`));
            
            // Remove message after 3 seconds
            setTimeout(() => {
                successMessage.remove();
            }, 3000);

            // Refresh the data
            loadAllData();
        });
    }
}

// Add warning class to progress bars
const style = document.createElement('style');
style.textContent = `
    .progress-bar-fill.warning {
        background-color: #f44336 !important;
    }
    .success-message {
        background-color: #4CAF50;
        color: white;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .success-message i {
        font-size: 18px;
    }
`;
document.head.appendChild(style);

// Add event listener for the refresh button
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadAllData();

    // Add event listeners for clear buttons
    document.getElementById('clearCourses')?.addEventListener('click', () => clearData('courses', 'local'));
    document.getElementById('clearWatchedVideos')?.addEventListener('click', () => clearData('watchedVideos', 'local'));
    document.getElementById('clearVideoTimes')?.addEventListener('click', () => clearData('videoTimes', 'local'));
    document.getElementById('clearWatchLater')?.addEventListener('click', () => clearData('watchLater', 'sync'));
    document.getElementById('clearTaskItUp')?.addEventListener('click', () => clearData('taskItUp', 'sync'));
    document.getElementById('clearDoneItems')?.addEventListener('click', () => clearData('doneItems', 'sync'));
    document.getElementById('clearWeeklyTracker')?.addEventListener('click', () => clearData('weeklyTracker', 'local'));
    document.getElementById('clearAvailableCourses')?.addEventListener('click', () => clearData('availableCourses', 'local'));
    document.getElementById('clearAnalyticsStudySessions')?.addEventListener('click', () => clearData('analyticsStudySessions', 'local'));
    document.getElementById('clearAnalyticsDeadlineBehavior')?.addEventListener('click', () => clearData('analyticsDeadlineBehavior', 'local'));
    document.getElementById('clearAnalyticsEngagement')?.addEventListener('click', () => clearData('analyticsEngagement', 'local'));

    // Purge-course controls
    const purgeSelect = document.getElementById('purgeCourseSelect');
    const purgeBtn = document.getElementById('purgeCourseBtn');
    if (purgeSelect && purgeBtn) {
        purgeSelect.addEventListener('change', () => {
            purgeBtn.disabled = !purgeSelect.value;
        });
        purgeBtn.addEventListener('click', () => {
            const courseName = purgeSelect.value;
            if (courseName) purgeCourse(courseName);
        });
    }

    // Delegated handler for per-row delete buttons (one listener for all tables)
    document.addEventListener('click', function(e) {
        const btn = e.target.closest && e.target.closest('.row-delete-btn');
        if (!btn) return;
        const storageKey = btn.dataset.storageKey;
        const storageType = btn.dataset.storageType;
        const rowId = btn.dataset.rowId;
        if (!storageKey || !storageType || rowId == null) return;
        if (confirm('Delete this row?')) {
            deleteRow(storageKey, storageType, rowId);
        }
    });
});

// Function to safely set table content
function setTableContent(tableId, content) {
    const tableElement = document.getElementById(tableId);
    if (tableElement) {
        tableElement.innerHTML = content;
    } else {
        console.warn(`Table element with ID '${tableId}' not found`);
    }
} 