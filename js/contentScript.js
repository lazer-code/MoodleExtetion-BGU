/**
 * BGU Spark - Content Script
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

function insertThAfterHeaderC1() {
    const headerC1 = document.querySelector('#page-blocks-video-videoslist .header.c1');
    if (headerC1) {
        headerC1.insertAdjacentHTML('afterend', '<th class="header" style="width: 160px;">משימות</th>');
    }
}

// Function to handle video completion and add the watched icon


// Function to save the watched state of a video along with the page link


// Remove the watched state of a video and re-render row state
function removeWatchedState(videoTitle, videoLink) {
    chrome.runtime.sendMessage({ type: 'videos.remove', link: videoLink }, (response) => {
        if (!response?.ok) {
            console.error('[videos] remove failed:', response?.error);
            return;
        }
        // Strip badges from the single-video page (h3) where the video matches
        document.querySelectorAll('.watched-badge').forEach(badge => {
            const parent = badge.parentElement;
            if (!parent) return;
            if (parent.textContent.includes(videoTitle) || window.location.href === videoLink) {
                badge.remove();
                parent.style.color = '';
            }
        });
        // Re-render videos-list rows so the removed row gets a mark-watched button
        renderRowStates();
    });
}

function removeDidntFinishState(videoLink, _td) {
    chrome.runtime.sendMessage({ type: 'videoTimes.remove', link: videoLink }, (response) => {
        if (!response?.ok) {
            console.error('[videoTimes] remove failed:', response?.error);
            return;
        }
        renderRowStates();
    });
}

// Single-video page (viewvideo.php): show the watched badge on the title h3.
// No-op on pages without a #region-main h3 match.
function renderSingleVideoPageWatchedBadge() {
    const h3s = document.querySelectorAll('#region-main h3');
    if (!h3s.length) return;
    chrome.runtime.sendMessage({ type: 'videos.list' }, (response) => {
        const watched = (response?.ok ? response.rows : []) || [];
        watched.forEach(video => {
            h3s.forEach(h3 => {
                if (h3.querySelector('.watched-badge')) return;
                if (h3.textContent.trim() === video.title && window.location.href === video.link) {
                    h3.style.color = 'orange';
                    h3.appendChild(createWatchedBadge(video.title, video.link));
                }
            });
        });
    });
}

// Videos-list page: render per-row state in one synchronous pass after both
// stores have been fetched. Idempotent — safe to call after every mutation.
function renderRowStates() {
    const tds = document.querySelectorAll('#page-blocks-video-videoslist td.cell.c1');
    if (!tds.length) return;

    const courseName = document.querySelector('h1.h2')?.textContent.trim() || '';

    Promise.all([
        new Promise(r => chrome.runtime.sendMessage({ type: 'videos.list' }, r)),
        new Promise(r => chrome.runtime.sendMessage({ type: 'videoTimes.getAllAsMap' }, r)),
    ]).then(([watchedRes, partialRes]) => {
        const watchedByLink = ((watchedRes?.rows) || []).reduce((m, v) => { m[v.link] = v; return m; }, {});
        const partialByLink = (partialRes?.map) || {};

        tds.forEach(td => {
            // Wipe any prior badges/buttons we own so the function is idempotent
            td.querySelectorAll('.watched-badge, .didnt-finish-badge, .mark-watched-btn').forEach(el => el.remove());
            td.style.color = '';

            const linkEl = td.closest('tr')?.querySelector('.cell.c0 a');
            if (!linkEl) return;
            const link = linkEl.href;
            const title = td.textContent.trim();

            if (watchedByLink[link]) {
                td.style.color = 'orange';
                td.appendChild(createWatchedBadge(title, link));
            } else if (partialByLink[link]) {
                const p = partialByLink[link];
                const pct = (p.duration > 0 && p.seconds > 0)
                    ? Math.round(p.seconds / p.duration * 100)
                    : null;
                td.appendChild(createDidntFinisBadge(link, td, pct));
                td.appendChild(createMarkWatchedBtn(title, link, courseName));
            } else {
                td.appendChild(createMarkWatchedBtn(title, link, courseName));
            }
        });
    });
}

// Add "Task It Up" button to each cell with .cell.c1
document.querySelectorAll('#page-blocks-video-videoslist td.cell.c1').forEach(td => {
    const linkElement = td.closest('tr').querySelector('.cell.c0 a');
    const itemTitle = td.textContent.trim();
    const courseName = document.querySelector('h1.h2').textContent.trim();
    const link = linkElement ? linkElement.href : '';


    // Create a new td element for the button
    const taskItUpCell = document.createElement('td');
    const itemType = 'video';
    const taskItUpButton = createButtonCell('הוסף למשימות', 'הסר מהמשימות', 'taskItUp', itemTitle,itemType, courseName, link);
    taskItUpCell.appendChild(taskItUpButton);
    td.parentNode.insertBefore(taskItUpCell, td.nextSibling);

  

    // Update the button state
    updateButtonStateCell(taskItUpButton, 'taskItUp', itemTitle, courseName, link);
});

// Watched badge: ✓ icon, label, and a × revealed on hover for safe removal.
function createWatchedBadge(videoTitle, videoLink) {
    const badge = document.createElement('span');
    badge.className = 'watched-badge';
    badge.innerHTML =
        '<span class="bdg-icon">\u2713</span>' +
        '<span class="bdg-label">\u05E6\u05E4\u05D9\u05EA\u05D9</span>' +  // צפיתי
        '<span class="bdg-x" title="\u05D4\u05E1\u05E8">\u00D7</span>';     // הסר
    badge.addEventListener('click', function(event) {
        if (event.target.classList.contains('bdg-x')) {
            event.stopPropagation();
            removeWatchedState(videoTitle, videoLink);
        }
    });
    return badge;
}

// Partial-watch badge: ▶ icon, label, optional "· N%", and × on hover.
function createDidntFinisBadge(videoLink, td, pct) {
    const badge = document.createElement('span');
    badge.className = 'didnt-finish-badge';
    const pctSuffix = (typeof pct === 'number')
        ? '<span class="bdg-pct">\u00B7 ' + pct + '%</span>'
        : '';
    badge.innerHTML =
        '<span class="bdg-icon">\u25B6</span>' +
        '<span class="bdg-label">\u05DC\u05D0 \u05E1\u05D9\u05D9\u05DE\u05EA\u05D9</span>' +  // לא סיימתי
        pctSuffix +
        '<span class="bdg-x" title="\u05D0\u05D9\u05E4\u05D5\u05E1 \u05E6\u05E4\u05D9\u05D9\u05D4">\u00D7</span>';  // איפוס צפייה
    badge.addEventListener('click', function(event) {
        if (event.target.classList.contains('bdg-x')) {
            event.stopPropagation();
            removeDidntFinishState(videoLink, td);
        }
    });
    return badge;
}

// Ghost button shown on partial / not-yet-watched rows. Click marks the video
// as fully watched and re-renders the row (also clears any partial state).
function createMarkWatchedBtn(videoTitle, videoLink, courseName) {
    const btn = document.createElement('button');
    btn.className = 'mark-watched-btn';
    btn.type = 'button';
    btn.innerHTML =
        '<span class="check">\u2713</span>' +
        '<span>\u05E1\u05DE\u05DF \u05DB\u05E0\u05E6\u05E4\u05D4</span>';  // סמן כנצפה
    btn.addEventListener('click', function(event) {
        event.stopPropagation();
        if (btn.disabled) return;
        btn.disabled = true;
        chrome.runtime.sendMessage({
            type: 'videos.markWatched',
            data: { link: videoLink, title: videoTitle, course_name: courseName }
        }, (response) => {
            if (!response?.ok) {
                console.warn('[videos] markWatched failed:', response?.error || response?.reason);
                btn.disabled = false;
                return;
            }
            // Clear any partial-watch state for this link, then re-render
            chrome.runtime.sendMessage({ type: 'videoTimes.remove', link: videoLink }, () => {
                renderRowStates();
            });
        });
    });
    return btn;
}

// Function to create a button
function createButtonCell(buttonText, toggleText, type, itemTitle, itemType, courseName, link) {
    const button = document.createElement('button');
    button.setAttribute('data-toggle-text', toggleText); // Store the toggle text
    button.setAttribute('data-normal-text', buttonText); // Store the normal text
    button.classList.add(type, 'sa-button');

    // Add icon based on the type
    const icon = document.createElement('i');
    if (type === 'watchLater') {
        icon.className = 'fa fa-eye'; // FontAwesome class for watch later
    } else if (type === 'taskItUp') {
        icon.className = 'fa fa-book'; // FontAwesome class for tasks
    }
    button.appendChild(icon);

    // Add text node for the button text
    const textNode = document.createTextNode(' ' + buttonText);
    button.appendChild(textNode);

    // Event listener to toggle state
    button.addEventListener('click', function() {
        toggleItemCell(button, type, itemTitle, itemType, courseName, link, button.getAttribute('data-toggle-text'), button.getAttribute('data-normal-text'));
    });

    return button;
}

// Function to toggle item state
function toggleItemCell(button, type, title, itemType, course, link, toggledText, initialText) {
    const icon = button.querySelector('i'); // Reference to the icon inside the button
    const kind = type === 'watchLater' ? 'watch_later' : type === 'readingList' ? 'reading' : 'task';

    chrome.runtime.sendMessage({ type: 'tasks.list', kind, includeDone: true }, (response) => {
        if (!response?.ok) {
            console.error('tasks.list failed', response?.error);
            return;
        }
        const match = response.rows.find(item => item.title === title && item.course_name === course);

        if (match) {
            // Item exists, remove it
            chrome.runtime.sendMessage({ type: 'tasks.remove', id: match.id }, (removeResponse) => {
                if (!removeResponse?.ok) console.error('tasks.remove failed', removeResponse?.error);
            });
            button.childNodes[1].nodeValue = ' ' + initialText; // Update text
            icon.className = type === 'watchLater' ? 'fa fa-eye' : 'fa fa-book'; // Set icon for initial state
            button.classList.remove('removefromlist'); // Remove the active class
        } else {
            // Item does not exist, add it
            chrome.runtime.sendMessage({
                type: 'tasks.add',
                kind,
                data: { title, course_name: course, link }
            }, (addResponse) => {
                if (!addResponse?.ok) console.error('tasks.add failed', addResponse?.error);
            });
            button.childNodes[1].nodeValue = ' ' + toggledText; // Update text
            icon.className = 'fa fa-times-circle'; // Set icon for toggled state
            button.classList.add('removefromlist'); // Add the active class
        }
    });
}

// Function to update button state
function updateButtonStateCell(button, type, title, course, link) {
    const icon = button.querySelector('i'); // Access the icon element within the button
    const kind = type === 'watchLater' ? 'watch_later' : type === 'readingList' ? 'reading' : 'task';

    chrome.runtime.sendMessage({ type: 'tasks.list', kind, includeDone: false }, (response) => {
        if (!response?.ok) return;
        const items = response.rows;
        if (items.some(item => item.title === title && item.course_name === course && item.link === link)) {
            // Update the text and icon when the item is active
            button.childNodes[1].nodeValue = ' הסר ' + (type === 'watchLater' ? 'מצפייה מאוחרת' : 'מהמשימות');
            button.classList.add('removefromlist'); // Ensure button shows as active
            icon.className = 'fa fa-times-circle'; // Change the icon to 'times' for active state
        } else {
            // Restore original text and icon, and remove active class if not found
            button.childNodes[1].nodeValue = ' ' + button.getAttribute('data-normal-text');
            button.classList.remove('removefromlist');
            icon.className = type === 'watchLater' ? 'fa fa-eye' : 'fa fa-book'; // Reset to original icon
        }
    });
}

renderSingleVideoPageWatchedBadge();
renderRowStates();
insertThAfterHeaderC1();

// content.js

///////////////////////////////// content.js

// Inject CSS for the done badge
const style = document.createElement('style');
style.textContent = `
    .done-badge {
        text-align: center;
    background-color: #7adc91;
    color: white;
    padding: 3px 13px;
    margin-left: 5px;
    border-radius: 29px;
    font-size: 13px;
    position: absolute;
    right: 50px;
    top: -12px;
    cursor: pointer;
    transition-duration: 0.1s;
    width: 107px;
    }
    .done-badge:hover {
        background-color: #dc3545;
    }
`;
document.head.appendChild(style);

function getCleanInstanceName(element) {
    // Ensure the element is provided and valid
    if (element && element.cloneNode) {
        // Clone the element to work with it without modifying the original
        const elementClone = element.cloneNode(true);
        
        // Select and remove the .accesshide span from the cloned element
        const accesshideSpan = elementClone.querySelector('.accesshide');
        if (accesshideSpan) {
            accesshideSpan.remove();
        }

        // Get the text content of the modified cloned element
        return elementClone.textContent.trim();
    }

    // Return null if the element is not valid
    return null;
}


  

// Function to update the done badges on page load
// Function to update the done badges on page load
function updateDoneBadges() {
    chrome.runtime.sendMessage({ type: 'tasks.list', kind: 'task', includeDone: true }, function(response) {
        if (!response?.ok) return;
        const rows = response.rows;
        const titles = rows.filter(r => r.done).map(r => r.title);
        titles.forEach(taskTitle => {
            document.querySelectorAll('.activitytitle').forEach(anchor => {
                const instancename = getCleanInstanceName(anchor.querySelector('.instancename'));
                if (anchor.textContent.trim() === taskTitle || instancename === taskTitle) {
                    if (!anchor.nextElementSibling || !anchor.nextElementSibling.classList.contains('done-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'done-badge';
                        badge.textContent = 'המשימה בוצעה';
                        anchor.parentNode.insertBefore(badge, anchor.nextSibling);

                        // Event listeners for hover
                        badge.addEventListener('mouseover', function() {
                            badge.textContent = 'הסר';
                        });

                        badge.addEventListener('mouseout', function() {
                            badge.textContent = 'המשימה בוצעה';
                        });

                        // Event listener for click
                        badge.addEventListener('click', function(event) {
                            event.stopPropagation(); // Prevent link click
                            removeDoneTask(taskTitle, badge);
                        });
                    }
                }
            });
        });
    });
}



// Function to remove a task from the done list and update the UI
function removeDoneTask(taskTitle, badgeElement) {
    chrome.runtime.sendMessage({ type: 'tasks.list', kind: 'task', includeDone: true }, function(response) {
        if (!response?.ok) return;
        const match = response.rows.find(r => r.title === taskTitle);
        if (match) {
            chrome.runtime.sendMessage({ type: 'tasks.remove', id: match.id }, function(removeResponse) {
                if (!removeResponse?.ok) {
                    console.error('tasks.remove failed', removeResponse?.error);
                    return;
                }
                badgeElement.remove();
            });
        }
    });
}



// Ensure DOM is fully loaded before running the script

    updateDoneBadges();

    // Observe DOM changes to dynamically update done badges
    // const observer = new MutationObserver((mutations) => {
    //     mutations.forEach((mutation) => {
    //         if (mutation.addedNodes.length > 0) {
    //             updateDoneBadges();
    //         }
    //     });
    // });

    // observer.observe(document.body, {
    //     childList: true,
    //     subtree: true
    // });


// v2.1 announcement banner — shown on Moodle until the user either signs
// in with Google or explicitly dismisses it. Sits above the Moodle
// page-context header. Auto-hides once a Supabase session is detected.
function showV21AnnouncementBanner() {
    // Prefer inserting right above the Moodle page-context header
    // ("עדכונים בקורסים שלי"); fall back to the global header if the
    // page doesn't have one (some Moodle sub-pages don't).
    const anchor =
        document.querySelector('.page-context-header') ||
        document.querySelector('.header-main');
    if (!anchor) return;
    const position = anchor.matches('.page-context-header') ? 'beforebegin' : 'afterbegin';

    // Two reasons to hide: user dismissed, or user already signed in.
    chrome.storage.local.get(null, (data) => {
        const dismissed = !!data.v21BannerDismissed;
        const sessionKey = Object.keys(data).find(k => k.endsWith('-auth-token'));
        const signedIn = !!sessionKey && !!data[sessionKey];

        if (dismissed || signedIn) {
            // If user is signed in but never dismissed, set the flag so
            // we stop checking on every page load.
            if (signedIn && !dismissed) {
                chrome.storage.local.set({ v21BannerDismissed: true });
            }
            return;
        }

        const logoURL = chrome.runtime.getURL('images/icon48.png');
        anchor.insertAdjacentHTML(position, `
            <div class="spark-v21-banner" role="banner" id="spark-v21-banner">
                <div class="spark-v21-inner">
                    <img src="${logoURL}" alt="" class="spark-v21-logo">
                    <div class="spark-v21-text">
                        <strong>BGU Spark התעדכן לגרסה 2.1 🎉</strong>
                        <p>הנתונים שלך מסונכרנים עכשיו בין כל המחשבים. לחץ על אייקון BGU Spark בסרגל הכלים של Chrome והתחבר עם Google.</p>
                        <p class="spark-v21-hint">✨ וזה רק ההתחלה - אפליקציה למובייל בדרך</p>
                    </div>
                    <button class="spark-v21-close" aria-label="סגור">&times;</button>
                </div>
            </div>
        `);

        const closeBtn = document.getElementById('spark-v21-banner')?.querySelector('.spark-v21-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                chrome.storage.local.set({ v21BannerDismissed: true }, () => {
                    const banner = document.getElementById('spark-v21-banner');
                    if (banner) banner.remove();
                });
            });
        }
    });
}

showV21AnnouncementBanner();

// Donation banner on Moodle pages (no close button)
function showDonationBanner() {
    const header = document.querySelector('.header-main');
    if (!header) return;

    const qrURL = chrome.runtime.getURL('images/bit_pay.png');
    header.insertAdjacentHTML('afterend', `
        <div class="spark-donation-moodle" role="banner">
            <div class="spark-donation-inner">
                <div class="spark-donation-logo">
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M28.6118 15.6062C28.6118 15.6062 27.3476 17.4636 24.6978 19.0357C24.6978 19.0357 26.6169 2.81681 14.1129 0C17.3165 11.7576 10.0379 15.0734 7.38475 8.86162C2.95394 14.7773 6.31813 19.9384 6.31813 19.9384C4.50131 20.2002 2.97519 18.2153 2.97519 18.2153C2.96156 18.4598 2.95394 18.706 2.95394 18.9539C2.95388 26.1591 8.79481 32 16 32C23.2052 32 29.0461 26.1591 29.0461 18.9539C29.0461 17.7965 28.8946 16.6746 28.6118 15.6062Z" fill="#FF6536"/>
                        <path d="M2.97513 18.2153C2.97513 18.2153 4.50125 20.2002 6.31806 19.9384C6.31806 19.9384 2.95388 14.7773 7.38469 8.86162C10.0379 15.0734 17.3164 11.7576 14.1129 0C14.7826 0.150875 15.4106 0.340437 16 0.563625V32C8.79481 32 2.95388 26.1591 2.95388 18.9539C2.95388 18.7059 2.9615 18.4598 2.97513 18.2153Z" fill="#FF421D"/>
                        <path d="M21.7215 26.2785C21.7215 29.4384 19.1599 32 16 32C12.8401 32 10.2785 29.4384 10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 21.7215 17.9687 21.7215 26.2785Z" fill="#FF7E36"/>
                        <path d="M10.2785 26.2785C10.2785 24.5872 11.0123 23.0673 12.179 22.0199C14.3911 25.0252 17.5435 20.4664 15.0868 17.1372C15.0868 17.1372 15.4473 17.1825 16 17.357V32C12.8401 32 10.2785 29.4384 10.2785 26.2785Z" fill="#FF6E1D"/>
                        <g clip-path="url(#clip_moodle_donate)"><path d="M18.7931 26.5H21.6333C19.7019 24.7274 18.4684 23.0543 20.5597 21.8548L18.7931 21.3339C17.9992 22.0744 16.512 22.9171 18.7931 26.5Z" fill="white"/><path d="M14.0134 26.5H11C12.6757 25.6658 14.3246 24.8045 13.1128 21.0299L15.2255 22.5928C15.0677 23.8954 15.0563 25.1976 14.0134 26.5Z" fill="white"/><path d="M17.8234 26.5C15.1862 20.7664 20.8077 20.9598 20.8904 17.9497C20.9406 16.1502 19.6222 14.7832 15.5029 12C16.8778 15.8795 7.56 17.1501 15.3644 22.2455C15.4812 21.6231 15.8789 21.001 16.2648 20.3786C14.1944 19.3467 14.2276 18.6448 14.249 18.0341C14.3114 16.2546 16.4097 15.5163 16.2301 13.4326C18.7278 15.6484 18.6921 16.466 18.7105 17.3328C18.7681 20.0232 15.1488 19.0717 15.3987 26.4997H17.8234V26.5Z" fill="white"/></g>
                        <defs><clipPath id="clip_moodle_donate"><rect width="10.6333" height="14.5" fill="white" transform="translate(11 12)"/></clipPath></defs>
                    </svg>
                </div>
                <div class="spark-donation-text">
                    <strong>BGU Spark נבנה ומתוחזק בהתנדבות</strong>
                    <p>אם התוסף עוזר לכם — אשמח לתמיכה קטנה 💛</p>
                </div>
                <div class="spark-donation-qr">
                    <img src="${qrURL}" alt="QR לתרומה">
                    <small>bit / סריקה מהנייד</small>
                </div>
            </div>
        </div>
    `);
}

showDonationBanner();