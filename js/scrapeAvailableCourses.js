function scrapeAndStoreAvailableCoursesData() {
    const eventBlocks = document.querySelectorAll('div[data-display=card] .card-body');
    const availableCourses = Array.from(eventBlocks).map(block => ({
        name: block.querySelector('h5')?.textContent.trim() || '',
        link: block.querySelector('a')?.href || '#'
    }));
    chrome.storage.local.set({ availableCourses: availableCourses }, () => {
    });
}

function checkAndLogCourseInfoContainer() {
    const targetDiv = document.querySelector('.course-info-container');
    if (targetDiv) {
        observeForAvailableCoursesScraping(); // Set up observer for scraping after click
        return true;
    }
    return false;
}

function observeForAvailableCoursesScraping() {
    const targetNode = document.querySelector('body'); // Observing the entire body
    const config = { childList: true, subtree: true };

    const callback = function(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Check if the target elements are present for scraping
                if (document.querySelector('div[data-display=card]')) {
                    observer.disconnect(); // Stop observing
                    scrapeAndStoreAvailableCoursesData(); // Call your scraping function
                    return;
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

function observeDOMForCourseInfoContainer() {
    const targetNode = document.querySelector('body'); // Observing the entire body
    const config = { childList: true, subtree: true };

    const callback = function(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                if (checkAndLogCourseInfoContainer()) {
                    observer.disconnect(); // Stop observing
                    return;
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

// Check if the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!checkAndLogCourseInfoContainer()) {
        observeDOMForCourseInfoContainer();
    }
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (!checkAndLogCourseInfoContainer()) {
            observeDOMForCourseInfoContainer();
        }
    });
}
