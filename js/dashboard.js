console.log('Content script loaded');

// Track Moodle visits for analytics
chrome.storage.local.get('analyticsEngagement', function(data) {
    const eng = data.analyticsEngagement || { extensionOpens: [], moodleVisits: [], activeDays: [] };
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    eng.moodleVisits.push(now);
    if (!eng.activeDays.includes(today)) eng.activeDays.push(today);
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    eng.moodleVisits = eng.moodleVisits.filter(t => t > cutoff);
    eng.activeDays = eng.activeDays.filter(d => d > cutoff.slice(0, 10));
    chrome.storage.local.set({ analyticsEngagement: eng });
});

function waitForBlocksAndExecute(callback) {
    const targetNode = document.querySelector('body'); // Observing the entire body
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver((mutationsList, observer) => {
        const dashboard_cards = document.querySelectorAll('.block_mycourses .card.dashboard-card');
        if (dashboard_cards.length > 0) {
            observer.disconnect(); // Stop observing
            callback(dashboard_cards);
        }
    });

    observer.observe(targetNode, config);
    console.log('Mutation observer set up to wait for dashboard cards');
}

function runThroughCardsAndAddVideoLink(dashboard_cards) {
    dashboard_cards.forEach(block => {
        // Create a new <a> element with class "watch-videos"
        const linkElement = document.createElement('a');
        linkElement.classList.add('watch-videos');
    
        // Create a new <span> element with text "watch video"
        const spanElement = document.createElement('span');
        spanElement.textContent = 'מדיית הקורס';
    
        // Create a new <i> element for the Font Awesome icon
        const iconElement = document.createElement('i');
        iconElement.classList.add('fa', 'fa-video-camera', 'camera-icon'); // Replace 'fa-video-camera' with the desired Font Awesome icon class
    
        // Append the icon and span elements to the link element
        linkElement.appendChild(iconElement);  // Append icon first
        linkElement.appendChild(spanElement);  // Append text next
    
        // Extract the link from the block's "a" element and attach it to the link element
        const link = block.querySelector('a')?.getAttribute('href');
        if (link) {
            const id = getIdFromUrl(link);
            linkElement.setAttribute('href', 'https://moodle.bgu.ac.il/moodle/blocks/video/videoslist.php?courseid=' + id);
        }
    
        // Append the link element to the block
        block.appendChild(linkElement);
    });
}

function getIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('id');
    } catch (error) {
        console.error('Invalid URL:', url);
        return null;
    }
}

// Start checking for the blocks using MutationObserver
waitForBlocksAndExecute(runThroughCardsAndAddVideoLink);

// Scrape calendar events from the dashboard sidebar/calendar block
function formatDateDDMMYYYY(d) {
    if (!d || isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function dateFromTimestampAttr(el) {
    if (!el) return '';
    let ts = el.getAttribute('data-timestamp');
    if (!ts) {
        const child = el.querySelector('[data-timestamp]');
        if (child) ts = child.getAttribute('data-timestamp');
    }
    if (!ts) return '';
    const n = parseInt(ts, 10);
    if (isNaN(n)) return '';
    return formatDateDDMMYYYY(new Date(n * 1000));
}

function dateFromTimeQueryParam(href) {
    if (!href) return '';
    try {
        const url = new URL(href, location.href);
        const t = url.searchParams.get('time');
        if (!t) return '';
        const n = parseInt(t, 10);
        if (isNaN(n)) return '';
        return formatDateDDMMYYYY(new Date(n * 1000));
    } catch (_) { return ''; }
}

function dateFromText(text) {
    if (!text) return '';
    const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return '';
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return formatDateDDMMYYYY(new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
}

function scrapeCalendarEvents() {
    const events = [];

    // Scrape from the timeline block (upcoming events)
    document.querySelectorAll('.block_timeline .event-list-container .list-group-item').forEach(item => {
        const nameEl = item.querySelector('.event-name a');
        const timeEl = item.querySelector('small');
        const courseEl = item.querySelector('.event-name-container small');

        if (nameEl) {
            const timeText = timeEl ? timeEl.textContent.trim() : '';
            const date = dateFromTimestampAttr(item) || dateFromTimeQueryParam(nameEl.href) || dateFromText(timeText);
            events.push({
                title: nameEl.textContent.trim(),
                link: nameEl.href || '#',
                time: timeText,
                course: courseEl ? courseEl.textContent.trim() : '',
                date,
                scraped: Date.now()
            });
        }
    });

    // Also scrape from the calendar block if present
    document.querySelectorAll('.block_calendar_upcoming .event').forEach(item => {
        const nameEl = item.querySelector('.referer a') || item.querySelector('a');
        const dateEl = item.querySelector('.date');
        const courseEl = item.querySelector('.course');

        if (nameEl) {
            const dateText = dateEl ? dateEl.textContent.trim() : '';
            const date = dateFromTimestampAttr(item) || dateFromTimeQueryParam(nameEl.href) || dateFromText(dateText);
            events.push({
                title: nameEl.textContent.trim(),
                link: nameEl.href || '#',
                time: dateText,
                course: courseEl ? courseEl.textContent.trim() : '',
                date,
                scraped: Date.now()
            });
        }
    });

    // Also scrape from the mini-calendar day links
    document.querySelectorAll('.calendarwrapper .day a[data-action="view-day-link"]').forEach(dayLink => {
        const title = dayLink.getAttribute('title') || dayLink.getAttribute('aria-label');
        if (title && title.includes(',')) {
            const date = dateFromTimeQueryParam(dayLink.href) || dateFromText(title);
            events.push({
                title: title,
                link: dayLink.href || '#',
                time: '',
                course: '',
                date,
                scraped: Date.now()
            });
        }
    });

    if (events.length > 0) {
        chrome.storage.local.set({ calendarEvents: events });
    }
}

// Run calendar scraping after a short delay to let dashboard fully load
setTimeout(scrapeCalendarEvents, 3000);
