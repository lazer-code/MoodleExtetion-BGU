/**
 * BGU Spark - Analytics Tab
 * Renders semester-wide and per-course analytics from stored data.
 */

(function() {
    // Only run when analytics tab exists
    const analyticsTab = document.getElementById('tab-analytics');
    if (!analyticsTab) return;

    let allData = {};
    let selectedCourse = null;

    function loadAnalyticsData(callback) {
        chrome.storage.local.get([
            'cache:watched_videos', 'cache:video_times',
            'cache:study_sessions', 'cache:deadline_behavior',
            'cache:tasks',
            'analyticsEngagement', 'weeklyTracker', 'courses', 'availableCourses'
        ], function(cacheData) {
            const watchedVideosArr = Object.values(cacheData['cache:watched_videos'] || {})
                .filter(r => !r.deleted_at)
                .map(r => ({ title: r.title, link: r.link, course: r.course_name, watchedAt: r.watched_at }));

            const videoTimesObj = {};
            for (const r of Object.values(cacheData['cache:video_times'] || {})) {
                if (!r.deleted_at) videoTimesObj[r.link] = { seconds: r.seconds, duration: r.duration, course: r.course_name, title: r.title };
            }

            const studySessionsObj = {};
            for (const r of Object.values(cacheData['cache:study_sessions'] || {})) {
                if (!r.deleted_at) {
                    studySessionsObj[r.date] = studySessionsObj[r.date] || {};
                    studySessionsObj[r.date][r.course_name] = { totalSeconds: r.total_seconds };
                }
            }

            const deadlineBehaviorArr = Object.values(cacheData['cache:deadline_behavior'] || {})
                .filter(r => !r.deleted_at)
                .map(r => ({
                    title: r.task_name, course: r.course_name,
                    deadline: r.deadline, submittedAt: r.completed_at,
                    hoursBeforeDeadline: r.hours_before_deadline
                }));

            // Tasks: read from the unified cache:tasks namespace and project to
            // the legacy { taskItUp[], doneItems[] } shape the existing analytics
            // render code expects.
            const taskRows = Object.values(cacheData['cache:tasks'] || {})
                .filter(r => !r.deleted_at && r.kind === 'task');
            const taskItUpArr = taskRows
                .filter(r => !r.done)
                .map(r => ({ title: r.title, link: r.link, course: r.course_name, deadline: r.deadline, addedAt: r.added_at }));
            const doneItemsArr = taskRows
                .filter(r => r.done)
                .map(r => ({ title: r.title, doneAt: r.done_at }));

            allData = {
                studySessions: studySessionsObj,
                deadlineBehavior: deadlineBehaviorArr,
                engagement: cacheData.analyticsEngagement || { extensionOpens: [], moodleVisits: [], activeDays: [] },
                watchedVideos: watchedVideosArr,
                videoTimes: videoTimesObj,
                weeklyTracker: cacheData.weeklyTracker || {},
                courses: cacheData.courses || [],
                availableCourses: cacheData.availableCourses || [],
                taskItUp: taskItUpArr,
                doneItems: doneItemsArr,
            };
            callback();
        });
    }

    function renderAnalytics() {
        loadAnalyticsData(function() {
            const hasData = allData.engagement.activeDays.length > 0 ||
                allData.watchedVideos.length > 0 ||
                Object.keys(allData.studySessions).length > 0 ||
                allData.doneItems.length > 0;

            document.getElementById('analytics-empty-state').style.display = hasData ? 'none' : 'flex';

            renderSummaryCards();
            renderHeatmap();
            renderEngagement();
            renderSuggestions();
            renderCoursePills();
        });
    }

    // =============================================
    // Summary Cards
    // =============================================

    function renderSummaryCards() {
        // Study Time This Week
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const lastWeekStart = new Date(weekStart - 7 * 24 * 60 * 60 * 1000);

        let thisWeekSec = 0, lastWeekSec = 0;
        Object.entries(allData.studySessions).forEach(([dateStr, dayCourses]) => {
            const d = new Date(dateStr);
            const totalSec = Object.values(dayCourses).reduce((s, c) => s + c.totalSeconds, 0);
            if (d >= weekStart) thisWeekSec += totalSec;
            else if (d >= lastWeekStart && d < weekStart) lastWeekSec += totalSec;
        });

        const thisWeekHours = (thisWeekSec / 3600).toFixed(1);
        document.getElementById('analytics-study-time').textContent = thisWeekHours + 'h';

        const deltaEl = document.getElementById('analytics-study-delta');
        if (lastWeekSec > 0) {
            const diff = thisWeekSec - lastWeekSec;
            const diffHours = (Math.abs(diff) / 3600).toFixed(1);
            if (diff > 0) {
                deltaEl.textContent = `+${diffHours}h מהשבוע שעבר`;
                deltaEl.className = 'analytics-delta positive';
            } else if (diff < 0) {
                deltaEl.textContent = `-${diffHours}h מהשבוע שעבר`;
                deltaEl.className = 'analytics-delta negative';
            } else {
                deltaEl.textContent = 'ללא שינוי';
                deltaEl.className = 'analytics-delta';
            }
        } else {
            deltaEl.textContent = '';
        }

        // Videos Watched
        const videosCount = allData.watchedVideos.length;
        document.getElementById('analytics-videos-count').textContent = videosCount;
        const totalVideoSec = Object.values(allData.videoTimes).reduce((s, v) => s + (v.duration || 0), 0);
        const videoHours = (totalVideoSec / 3600).toFixed(1);
        const videoSubEl = document.getElementById('analytics-videos-hours');
        videoSubEl.textContent = totalVideoSec > 0 ? `${videoHours} שעות צפייה` : '';

        // Task Completion Rate
        const doneCount = allData.doneItems.length;
        const totalTasks = doneCount + allData.taskItUp.length;
        const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
        document.getElementById('analytics-completion-rate').textContent = totalTasks > 0 ? completionRate + '%' : '--';

        // Deadline Health Score
        const db = allData.deadlineBehavior;
        if (db.length > 0) {
            const avgHours = db.reduce((s, d) => s + d.hoursBeforeDeadline, 0) / db.length;
            // Score: 100 if avg >= 72h, 0 if avg <= -24h (late)
            const score = Math.max(0, Math.min(100, Math.round(((avgHours + 24) / 96) * 100)));
            const scoreEl = document.getElementById('analytics-deadline-score');
            scoreEl.textContent = score;
            scoreEl.style.color = score > 70 ? '#16a34a' : score > 40 ? '#d97706' : '#dc2626';

            const avgEl = document.getElementById('analytics-deadline-avg');
            if (avgHours >= 0) {
                avgEl.textContent = `ממוצע: ${Math.round(avgHours)} שעות לפני`;
            } else {
                avgEl.textContent = `ממוצע: ${Math.abs(Math.round(avgHours))} שעות באיחור`;
            }
        } else {
            document.getElementById('analytics-deadline-score').textContent = '--';
            document.getElementById('analytics-deadline-avg').textContent = '';
        }
    }

    // =============================================
    // Activity Heatmap
    // =============================================

    function renderHeatmap() {
        const grid = document.getElementById('analytics-heatmap');
        grid.innerHTML = '';

        // Build day -> totalSeconds map
        const dayMap = {};
        Object.entries(allData.studySessions).forEach(([dateStr, dayCourses]) => {
            dayMap[dateStr] = Object.values(dayCourses).reduce((s, c) => s + c.totalSeconds, 0);
        });

        // Also count engagement (Moodle visits) for days without study sessions
        (allData.engagement.activeDays || []).forEach(d => {
            if (!dayMap[d]) dayMap[d] = 60; // minimal presence
        });

        const maxSec = Math.max(...Object.values(dayMap), 1);

        // Show last 13 weeks (semester)
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (13 * 7) + 1);
        // Align to Sunday
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const totalDays = 13 * 7;
        // Set grid columns
        grid.style.gridTemplateColumns = `repeat(13, 1fr)`;
        grid.style.gridTemplateRows = `repeat(7, 1fr)`;

        for (let week = 0; week < 13; week++) {
            for (let day = 0; day < 7; day++) {
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + week * 7 + day);
                const dateStr = cellDate.toISOString().slice(0, 10);

                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                if (cellDate > now) {
                    cell.style.opacity = '0.05';
                } else {
                    const seconds = dayMap[dateStr] || 0;
                    const intensity = seconds > 0 ? Math.max(0.15, seconds / maxSec) : 0.05;
                    cell.style.opacity = intensity.toString();
                }

                const hrs = ((dayMap[dateStr] || 0) / 3600).toFixed(1);
                cell.title = `${dateStr}: ${hrs}h`;

                grid.appendChild(cell);
            }
        }
    }

    // =============================================
    // Engagement Stats
    // =============================================

    function renderEngagement() {
        const eng = allData.engagement;

        // Streak
        const streak = calcStudyStreak(eng.activeDays || []);
        document.getElementById('engagement-streak').textContent = streak;

        // Active days this month
        const thisMonth = new Date().toISOString().slice(0, 7);
        const activeDaysThisMonth = (eng.activeDays || []).filter(d => d.startsWith(thisMonth)).length;
        document.getElementById('engagement-active-days').textContent = activeDaysThisMonth;

        // Moodle visits this week
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const visitsThisWeek = (eng.moodleVisits || []).filter(t => new Date(t) >= weekStart).length;
        document.getElementById('engagement-moodle-visits').textContent = visitsThisWeek;
    }

    // =============================================
    // Suggestions
    // =============================================

    function renderSuggestions() {
        const list = document.getElementById('suggestions-list');
        const suggestions = generateSuggestions(allData);
        const topSuggestions = suggestions.slice(0, 3);

        if (topSuggestions.length === 0) {
            list.innerHTML = '<div class="suggestion-empty">אין טיפים כרגע — המשיכו ללמוד!</div>';
            return;
        }

        list.innerHTML = topSuggestions.map(s => `
            <div class="suggestion-item suggestion-${s.type}">
                <i class="fa ${s.icon}"></i>
                <span>${s.text}</span>
            </div>
        `).join('');
    }

    // =============================================
    // Per-Course Section
    // =============================================

    function getActiveCourses() {
        const courseSet = new Set();

        // From available courses
        allData.availableCourses.forEach(c => {
            if (c.name) courseSet.add(c.name.trim());
        });

        // From study sessions
        Object.values(allData.studySessions).forEach(dayCourses => {
            Object.keys(dayCourses).forEach(c => {
                if (c !== '__general__') courseSet.add(c);
            });
        });

        // From video times
        Object.values(allData.videoTimes).forEach(v => {
            if (v.course) courseSet.add(v.course);
        });

        // From weekly tracker
        Object.keys(allData.weeklyTracker).forEach(c => courseSet.add(c));

        return Array.from(courseSet).sort();
    }

    function renderCoursePills() {
        const container = document.getElementById('analytics-course-pills');
        const courses = getActiveCourses();

        if (courses.length === 0) {
            container.innerHTML = '<div class="analytics-empty-course">לא נמצאו קורסים פעילים</div>';
            return;
        }

        container.innerHTML = courses.map((name, i) => {
            const colorIdx = hashCourseColor(name);
            const colors = courseColorPalette[colorIdx];
            return `<button class="course-pill" data-course="${name}"
                style="background:${colors.light}; color:${colors.accent}; border-color:${colors.accent}20">
                ${name}
            </button>`;
        }).join('');

        container.querySelectorAll('.course-pill').forEach(pill => {
            pill.addEventListener('click', function() {
                container.querySelectorAll('.course-pill').forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                selectedCourse = this.dataset.course;
                renderCourseDetail(selectedCourse);
            });
        });
    }

    function hashCourseColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = ((hash << 5) - hash) + name.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 10;
    }

    function renderCourseDetail(courseName) {
        const panel = document.getElementById('analytics-course-detail');

        // Study time for this course
        const dayOfWeekSec = [0, 0, 0, 0, 0, 0, 0];
        let totalCourseSec = 0;
        Object.entries(allData.studySessions).forEach(([dateStr, dayCourses]) => {
            const sec = dayCourses[courseName]?.totalSeconds || 0;
            if (sec > 0) {
                totalCourseSec += sec;
                dayOfWeekSec[new Date(dateStr).getDay()] += sec;
            }
        });

        // Videos for this course
        const courseVideos = Object.entries(allData.videoTimes)
            .filter(([url, v]) => v.course === courseName);
        const watchedLinks = new Set(allData.watchedVideos.map(v => v.link));
        const watchedCount = courseVideos.filter(([url]) => watchedLinks.has(url)).length;
        const unwatchedVideos = courseVideos.filter(([url]) => !watchedLinks.has(url));

        // Weekly tracker
        const tracker = allData.weeklyTracker[courseName];
        const progress = tracker ? calcTrackerProgress(tracker) : null;

        // Deadline behavior for this course
        const courseDeadlines = allData.deadlineBehavior.filter(d =>
            d.course && d.course.includes(courseName)
        );

        // Course suggestions
        const courseSuggestions = generateCourseSuggestions(courseName, allData);

        const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
        const maxDaySec = Math.max(...dayOfWeekSec, 1);

        panel.innerHTML = `
            <!-- Study Time -->
            <div class="course-detail-card">
                <div class="course-detail-title"><i class="fa fa-clock-o"></i> זמן למידה</div>
                <div class="course-total-time">${(totalCourseSec / 3600).toFixed(1)} שעות סה״כ</div>
                <div class="day-bars">
                    ${dayOfWeekSec.map((sec, i) => `
                        <div class="day-bar-wrapper">
                            <div class="day-bar" style="height:${Math.max(2, (sec / maxDaySec) * 50)}px"></div>
                            <span class="day-bar-label">${dayNames[i]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Video Progress -->
            ${courseVideos.length > 0 ? `
            <div class="course-detail-card">
                <div class="course-detail-title"><i class="fa fa-play-circle"></i> סרטונים</div>
                <div class="video-progress-bar-wrapper">
                    <div class="video-progress-bar">
                        <div class="video-progress-fill" style="width:${courseVideos.length > 0 ? (watchedCount / courseVideos.length * 100) : 0}%"></div>
                    </div>
                    <span class="video-progress-text">${watchedCount}/${courseVideos.length}</span>
                </div>
                ${unwatchedVideos.length > 0 ? `
                <div class="unwatched-list">
                    ${unwatchedVideos.slice(0, 3).map(([url, v]) => `
                        <a href="${url}" target="_blank" class="unwatched-item">
                            <i class="fa fa-play"></i> ${v.title || 'סרטון'}
                        </a>
                    `).join('')}
                    ${unwatchedVideos.length > 3 ? `<div class="unwatched-more">+${unwatchedVideos.length - 3} נוספים</div>` : ''}
                </div>` : ''}
            </div>` : ''}

            <!-- Weekly Tracker -->
            ${progress ? `
            <div class="course-detail-card">
                <div class="course-detail-title"><i class="fa fa-check-square-o"></i> מעקב שבועי</div>
                <div class="tracker-mini">
                    <div class="tracker-mini-bar">
                        <div class="tracker-mini-fill" style="width:${progress.percentage}%"></div>
                    </div>
                    <span>${progress.percentage}% · שבוע ${progress.currentWeek}</span>
                </div>
            </div>` : ''}

            <!-- Deadline Timeline -->
            ${courseDeadlines.length > 0 ? `
            <div class="course-detail-card">
                <div class="course-detail-title"><i class="fa fa-calendar-check-o"></i> הגשות</div>
                <div class="deadline-dots">
                    ${courseDeadlines.map(d => {
                        const h = d.hoursBeforeDeadline;
                        let cls = 'dot-green';
                        if (h < 0) cls = 'dot-red';
                        else if (h < 12) cls = 'dot-orange';
                        else if (h < 24) cls = 'dot-yellow';
                        return `<div class="deadline-dot ${cls}" title="${d.title}: ${Math.round(h)}h לפני"></div>`;
                    }).join('')}
                </div>
            </div>` : ''}

            <!-- Course Suggestions -->
            ${courseSuggestions.length > 0 ? `
            <div class="course-detail-card suggestions-card">
                ${courseSuggestions.map(s => `
                    <div class="suggestion-item suggestion-${s.type}">
                        <i class="fa ${s.icon}"></i>
                        <span>${s.text}</span>
                    </div>
                `).join('')}
            </div>` : ''}
        `;
    }

    // =============================================
    // Tab Listener - Refresh on tab click
    // =============================================

    document.querySelector('.tab-button[data-tab="analytics"]')?.addEventListener('click', function() {
        renderAnalytics();
    });

    // Also render if analytics is the restored last tab
    chrome.storage.local.get('lastActiveTab', function(data) {
        if (data.lastActiveTab === 'analytics') {
            renderAnalytics();
        }
    });
})();
