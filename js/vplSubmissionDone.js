const SUBMISSION_CHECK_DELAY_SHORT_MS = 1500;
const SUBMISSION_CHECK_DELAY_LONG_MS = 3500;
const OBSERVER_DISCONNECT_TIMEOUT_MS = 20000;
const OBSERVER_DEBOUNCE_MS = 250;

function normalizeMoodleTaskLink(rawUrl) {
    try {
        const url = new URL(rawUrl || window.location.href);
        const id = url.searchParams.get('id');
        return id
            ? `${url.origin}${url.pathname}?id=${id}`
            : `${url.origin}${url.pathname}`;
    } catch (_) {
        return rawUrl || window.location.href;
    }
}

function isVplMarkedSubmitted() {
    const statusRows = document.querySelectorAll('.submissionstatustable tr, .submissionstatustable .row');
    for (const row of statusRows) {
        const text = (row.textContent || '').toLowerCase();
        const isStatusRow = text.includes('submission status') || text.includes('סטטוס הגשה');
        if (!isStatusRow) continue;
        if (text.includes('submitted') || text.includes('הוגש')) return true;
        if (text.includes('not submitted') || text.includes('לא הוגש')) return false;
    }

    const submittedIndicators = document.querySelectorAll('[class*="submitted"], .alert-success, .submissionstatussubmitted');
    for (const el of submittedIndicators) {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('submitted') || text.includes('הוגש') || text.includes('קבצים שהוגשו')) {
            return true;
        }
    }

    return false;
}

function markVplTaskAsDone() {
    const title = document.querySelector('.page-header-headings')?.textContent.trim() || '';
    if (!title) return;
    chrome.runtime.sendMessage({
        type: 'tasks.markDoneByTitle',
        title,
        kind: 'task',
        link: normalizeMoodleTaskLink(window.location.href)
    }, (response) => {
        if (!response?.ok) {
            console.error('[vplSubmissionDone] markDoneByTitle failed', response?.error);
        }
    });
}

function evaluateAndMark() {
    if (isVplMarkedSubmitted()) {
        markVplTaskAsDone();
    }
}

function initVplSubmissionWatcher() {
    evaluateAndMark();

    const submitControls = document.querySelectorAll('button, input[type="submit"], a');
    submitControls.forEach((control) => {
        const text = (control.textContent || control.value || '').toLowerCase();
        if (!(text.includes('submit') || text.includes('הגש'))) return;
        control.addEventListener('click', () => {
            setTimeout(evaluateAndMark, SUBMISSION_CHECK_DELAY_SHORT_MS);
            setTimeout(evaluateAndMark, SUBMISSION_CHECK_DELAY_LONG_MS);
        });
    });

    let observerPending = false;
    const observer = new MutationObserver(() => {
        if (observerPending) return;
        observerPending = true;
        setTimeout(() => {
            observerPending = false;
            evaluateAndMark();
        }, OBSERVER_DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(() => observer.disconnect(), OBSERVER_DISCONNECT_TIMEOUT_MS);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVplSubmissionWatcher);
} else {
    initVplSubmissionWatcher();
}
