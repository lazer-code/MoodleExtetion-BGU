/**
 * BGU Spark - Suggestions Engine
 * Generates actionable improvement tips based on analytics data.
 */

function generateSuggestions(data) {
    const suggestions = [];
    const {
        deadlineBehavior, studySessions, engagement,
        watchedVideos, videoTimes, weeklyTracker,
        doneItems, taskItUp, courses
    } = data;

    // --- Deadline Management ---
    if (deadlineBehavior && deadlineBehavior.length > 0) {
        const avgHours = deadlineBehavior.reduce((sum, d) => sum + d.hoursBeforeDeadline, 0) / deadlineBehavior.length;
        const lateCount = deadlineBehavior.filter(d => d.hoursBeforeDeadline < 0).length;
        const lastMinute = deadlineBehavior.filter(d => d.hoursBeforeDeadline >= 0 && d.hoursBeforeDeadline < 12).length;

        if (lateCount > 0) {
            suggestions.push({
                icon: 'fa-exclamation-circle',
                text: `יש לך ${lateCount} הגשות באיחור. הגדר/י תזכורות 48 שעות לפני הדדליין.`,
                priority: 10,
                category: 'deadline',
                type: 'warning'
            });
        }

        if (avgHours >= 0 && avgHours < 12 && lateCount === 0) {
            suggestions.push({
                icon: 'fa-clock-o',
                text: `בממוצע את/ה מגיש/ה ${Math.round(avgHours)} שעות לפני הדדליין. נסה/י להתחיל מוקדם יותר.`,
                priority: 9,
                category: 'deadline',
                type: 'warning'
            });
        }

        if (avgHours > 48) {
            suggestions.push({
                icon: 'fa-thumbs-up',
                text: `מעולה! את/ה מגיש/ה בממוצע ${Math.round(avgHours)} שעות לפני הדדליין.`,
                priority: 2,
                category: 'deadline',
                type: 'positive'
            });
        }
    }

    // --- Study Consistency ---
    if (engagement) {
        const streak = calcStudyStreak(engagement.activeDays || []);
        const activeDays = engagement.activeDays || [];
        const now = new Date();
        const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const recentActivity = activeDays.filter(d => d >= threeDaysAgo);

        if (streak >= 5) {
            suggestions.push({
                icon: 'fa-fire',
                text: `סטריק! למדת ${streak} ימים ברציפות. כל הכבוד!`,
                priority: 3,
                category: 'engagement',
                type: 'positive'
            });
        }

        if (recentActivity.length === 0 && activeDays.length > 0) {
            const daysSince = Math.floor((now - new Date(activeDays[activeDays.length - 1])) / (1000 * 60 * 60 * 24));
            suggestions.push({
                icon: 'fa-calendar-times-o',
                text: `לא למדת כבר ${daysSince} ימים. גם 30 דקות עוזרות.`,
                priority: 7,
                category: 'engagement',
                type: 'warning'
            });
        }
    }

    // --- Study Time Distribution ---
    if (studySessions) {
        const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        Object.keys(studySessions).forEach(dateStr => {
            const dayOfWeek = new Date(dateStr).getDay();
            const dayCourses = studySessions[dateStr];
            Object.values(dayCourses).forEach(c => { dayTotals[dayOfWeek] += c.totalSeconds; });
        });
        const totalStudy = dayTotals.reduce((a, b) => a + b, 0);
        if (totalStudy > 0) {
            const maxDay = dayTotals.reduce((max, val) => Math.max(max, val), 0);
            const topDays = dayTotals.filter(d => d > totalStudy * 0.3).length;
            if (topDays <= 2 && totalStudy > 3600) {
                suggestions.push({
                    icon: 'fa-calendar',
                    text: 'זמן הלמידה שלך מרוכז ב-1-2 ימים. נסה/י לפזר על יותר ימים בשבוע.',
                    priority: 6,
                    category: 'study',
                    type: 'warning'
                });
            }
        }
    }

    // --- Video Watching ---
    if (videoTimes && watchedVideos) {
        const coursesWithUnwatched = {};
        const watchedLinks = new Set((watchedVideos || []).map(v => v.link));
        Object.entries(videoTimes).forEach(([url, info]) => {
            if (!watchedLinks.has(url) && info.course) {
                coursesWithUnwatched[info.course] = (coursesWithUnwatched[info.course] || 0) + 1;
            }
        });
        Object.entries(coursesWithUnwatched).forEach(([course, count]) => {
            if (count >= 3) {
                suggestions.push({
                    icon: 'fa-video-camera',
                    text: `יש לך ${count} סרטונים שלא סיימת לצפות ב${course}.`,
                    priority: 5,
                    category: 'video',
                    type: 'info',
                    course: course
                });
            }
        });
    }

    // --- Course Balance ---
    if (studySessions && weeklyTracker) {
        const courseStudyTime = {};
        Object.values(studySessions).forEach(dayCourses => {
            Object.entries(dayCourses).forEach(([course, data]) => {
                if (course !== '__general__') {
                    courseStudyTime[course] = (courseStudyTime[course] || 0) + data.totalSeconds;
                }
            });
        });

        const courseNames = Object.keys(courseStudyTime);
        if (courseNames.length >= 2) {
            const sorted = courseNames.sort((a, b) => courseStudyTime[b] - courseStudyTime[a]);
            const top = courseStudyTime[sorted[0]];
            const bottom = courseStudyTime[sorted[sorted.length - 1]];
            if (top > bottom * 3 && bottom < 3600) {
                suggestions.push({
                    icon: 'fa-balance-scale',
                    text: `את/ה מקדיש/ה הרבה זמן ל${sorted[0]}. אל תשכח/י את ${sorted[sorted.length - 1]}.`,
                    priority: 6,
                    category: 'balance',
                    type: 'warning'
                });
            }
        }
    }

    // --- Weekly Tracker Progress ---
    if (weeklyTracker) {
        Object.entries(weeklyTracker).forEach(([course, tracker]) => {
            const progress = calcTrackerProgress(tracker);
            if (progress.currentWeek >= 7 && progress.percentage < 40) {
                suggestions.push({
                    icon: 'fa-exclamation-triangle',
                    text: `${course} נשאר מאחור (${progress.percentage}% בשבוע ${progress.currentWeek}).`,
                    priority: 7,
                    category: 'tracker',
                    type: 'warning',
                    course: course
                });
            }
        });
    }

    // --- Task Completion ---
    if (doneItems && taskItUp) {
        const doneCount = doneItems.length;
        const totalCount = doneCount + taskItUp.length;
        if (totalCount > 0) {
            const rate = Math.round((doneCount / totalCount) * 100);
            if (rate >= 80) {
                suggestions.push({
                    icon: 'fa-star',
                    text: `אחוז השלמת משימות מעולה! ${rate}%.`,
                    priority: 2,
                    category: 'tasks',
                    type: 'positive'
                });
            }
        }
    }

    // Sort by priority descending
    suggestions.sort((a, b) => b.priority - a.priority);
    return suggestions;
}

function generateCourseSuggestions(courseName, data) {
    const all = generateSuggestions(data);
    return all.filter(s => !s.course || s.course === courseName).slice(0, 2);
}

function calcStudyStreak(activeDays) {
    if (!activeDays || activeDays.length === 0) return 0;
    const sorted = [...activeDays].sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Streak must include today or yesterday
    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = new Date(sorted[i]);
        const prev = new Date(sorted[i + 1]);
        const diff = (current - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}
