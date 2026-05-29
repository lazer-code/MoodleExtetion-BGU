function showScrapingIndicator(message) {
    let indicator = document.getElementById('bgu-scraping-indicator');
    
    if (!indicator) {
        // Load CSS file
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('css/scrapingIndicator.css');
        document.head.appendChild(link);
        
        // Create indicator
        indicator = document.createElement('div');
        indicator.id = 'bgu-scraping-indicator';
        
        indicator.innerHTML = `
            <div class="scraping-header">
                <div class="scraping-spinner"></div>
                <div class="scraping-header-text">
                    <div class="scraping-title">BGU Spark</div>
                    <div id="scraping-message"></div>
                </div>
            </div>
            <button id="close-scraping-indicator">×</button>
        `;
        
        document.body.appendChild(indicator);
        
        // Add close button functionality
        document.getElementById('close-scraping-indicator').addEventListener('click', () => {
            hideScrapingIndicator();
        });
    }
    
    document.getElementById('scraping-message').textContent = message;
}

function updateScrapingMessage(message) {
    const messageEl = document.getElementById('scraping-message');
    if (messageEl) {
        messageEl.textContent = message;
    }
}

function showScrapedData(courses) {
    const spinner = document.querySelector('.scraping-spinner');
    
    // Hide spinner when showing data
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function hideScrapingIndicator() {
    const indicator = document.getElementById('bgu-scraping-indicator');
    if (indicator) {
        indicator.style.animation = 'slideOutDown 0.4s ease-in';
        setTimeout(() => indicator.remove(), 400);
    }
}

function scrapeAndStoreCoursesData() {
    const eventBlocks = document.querySelectorAll('.list-group-item.timeline-event-list-item');

    
    function getPreviousElementWithoutClass(element, className) {
        while (element && element.classList.contains(className)) {
            element = element.previousElementSibling;
        }
        return element;
    }

    const courses = Array.from(eventBlocks).map((block, index) => {
        let dateContainer = block.closest('.list-group').previousElementSibling;
        dateContainer = getPreviousElementWithoutClass(dateContainer, 'list-group');
        return {
            id: index,
            late: block.querySelector('.event-name span')?.textContent.trim() || '',
            name: block.querySelector('.event-name a')?.textContent.trim() || 'No title',
            desc: block.querySelector('.event-name-container small')?.textContent.trim() || 'No description',
            date: dateContainer ? dateContainer.querySelector('h5')?.textContent.trim() || 'No date' : 'No date',
            time: block.querySelector('small')?.textContent.trim() || 'No time',
            link: block.querySelector('.event-name a')?.href || '#'
        };
    });

    
    // Store the data in Chrome storage
    chrome.storage.local.set({ courses: courses }, () => {
        updateScrapingMessage(`✓ ${courses.length} מטלות הגשה נשמרו`);
        showScrapedData(courses);

        // Auto-hide after 2.5 seconds, or user can close manually
        setTimeout(() => {
            hideScrapingIndicator();
        }, 2500);
    });

    // Mirror the snapshot into Supabase via the repo. The background
    // handler diffs against the cache and only issues writes when something
    // actually changed, then throttles to one apply per minute.
    chrome.runtime.sendMessage(
        { type: 'submissions.applySnapshot', rows: courses },
        () => { /* fire-and-forget; signed-out short-circuits silently */ }
    );
}

function clickElement(selector) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
            resolve(element);
        } else {
            reject(`Element with selector ${selector} not found`);
        }
    });
}

function observeElement(selector) {
    return new Promise((resolve, reject) => {
        const targetNode = document.querySelector('body');
        const config = { childList: true, subtree: true };

        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const element = document.querySelector(selector);
                    if (element) {
                        observer.disconnect();
                        resolve(element);
                        return;
                    }
                }
            }
        });

        observer.observe(targetNode, config);
    });
}

function clickButtonsAndScrape() {
    showScrapingIndicator('Starting...');

    clickElement("#timeline-day-filter-current-selection")
        .then(() => {
            updateScrapingMessage('Opening filter...');
            return observeElement(".dropdown-item[data-filtername='all']");
        })
        .then((chooseAll) => {
            updateScrapingMessage('טוען מטלות להגשה...');
            return new Promise((resolve) => {
                setTimeout(() => {
                    chooseAll.click();
                    resolve();
                }, 300);
            });
        })
        .then(() => {
            updateScrapingMessage('טוען מטלות להגשה....');
            // Wait a bit for the content to load, then check if "more events" button exists
            return new Promise((resolve) => {
                setTimeout(() => {
                    const moreEventsButton = document.querySelector('button[data-action="more-events"]');
                    if (moreEventsButton) {
                        moreEventsButton.click();
                    } else {
                    }
                    resolve();
                }, 1000);
            });
        })
        .then(() => {
            updateScrapingMessage('שומר מטלות להגשה...');
            setTimeout(() => {
                return scrapeAndStoreCoursesData();
            }, 2000);

        })
        .catch((error) => {
            console.error('Error in clickButtonsAndScrape:', error);
            updateScrapingMessage('❌ שגיאה');
            setTimeout(() => {
                hideScrapingIndicator();
            }, 2000);
        });
}

// Check if the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    clickButtonsAndScrape();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        clickButtonsAndScrape();
    });
}
