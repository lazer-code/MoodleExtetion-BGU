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
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const positives = [
        'submitted files',
        'submission accepted',
        'you have submitted',
        'submission status submitted',
        'הוגש',
        'קבצים שהוגשו',
        'הגשה אחרונה'
    ];
    const negatives = ['not submitted', 'לא הוגש'];
    const hasPositive = positives.some((phrase) => bodyText.includes(phrase));
    const hasNegative = negatives.some((phrase) => bodyText.includes(phrase));
    return hasPositive && !hasNegative;
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

document.addEventListener('DOMContentLoaded', () => {
    evaluateAndMark();

    document.addEventListener('click', (event) => {
        const target = event.target && (event.target.closest('button, input[type="submit"], a') || event.target);
        const text = (target?.textContent || target?.value || '').toLowerCase();
        if (text.includes('submit') || text.includes('הגש')) {
            setTimeout(evaluateAndMark, 1500);
            setTimeout(evaluateAndMark, 3500);
        }
    });

    const observer = new MutationObserver(() => {
        evaluateAndMark();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(() => observer.disconnect(), 20000);
});
