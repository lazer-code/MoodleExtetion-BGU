/**
 * BGU Spark - Study Session Tracker
 * Tracks time spent on Moodle pages per course per day.
 * Uses visibility API to only count active/visible time.
 */

(function() {
    let activeSeconds = 0;
    let lastTick = Date.now();
    let isVisible = !document.hidden;
    let courseName = null;

    // Detect course name from URL or page
    function detectCourseName() {
        // Try from breadcrumb (most reliable)
        const breadcrumbs = document.querySelectorAll('.breadcrumb li a, nav[aria-label="Navigation bar"] li a');
        for (let i = breadcrumbs.length - 1; i >= 0; i--) {
            const href = breadcrumbs[i].href || '';
            if (href.includes('/course/view.php?id=')) {
                return breadcrumbs[i].textContent.trim();
            }
        }

        // Try from page header
        const header = document.querySelector('.page-header-headings h1, h1.h2');
        if (header) {
            const text = header.textContent.trim();
            // If we're on a course page, the header IS the course name
            if (window.location.href.includes('/course/view.php')) {
                return text;
            }
        }

        // Fallback: general Moodle usage
        return '__general__';
    }

    function flushToStorage() {
        if (activeSeconds < 30) return; // Don't save tiny sessions

        const today = new Date().toISOString().slice(0, 10);
        const secondsToSave = activeSeconds;
        activeSeconds = 0;

        chrome.runtime.sendMessage({
            type: 'sessions.addSeconds',
            date: today,
            course_name: courseName,
            seconds: secondsToSave
        }, (response) => {
            if (!response?.ok) console.error('[sessions] addSeconds failed:', response?.error);
        });
    }

    // Wait for page to settle before detecting course
    setTimeout(function() {
        courseName = detectCourseName();
    }, 1000);

    // Tick every 30 seconds
    const tickInterval = setInterval(function() {
        if (isVisible && courseName) {
            activeSeconds += 30;
        }
    }, 30000);

    // Flush every 60 seconds
    const flushInterval = setInterval(function() {
        if (activeSeconds > 0 && courseName) {
            flushToStorage();
        }
    }, 60000);

    // Handle visibility changes
    document.addEventListener('visibilitychange', function() {
        isVisible = !document.hidden;
        if (document.hidden && activeSeconds > 0 && courseName) {
            flushToStorage();
        }
    });

    // Flush on page unload
    window.addEventListener('beforeunload', function() {
        if (activeSeconds > 0 && courseName) {
            flushToStorage();
        }
        clearInterval(tickInterval);
        clearInterval(flushInterval);
    });
})();
