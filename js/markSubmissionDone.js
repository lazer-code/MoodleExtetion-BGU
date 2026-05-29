////////////// mark item as done when upload a file

function markItemAsDone(title) {
    chrome.runtime.sendMessage({
        type: 'tasks.markDoneByTitle',
        title: title,
        kind: 'task'
    }, (response) => {
        if (!response?.ok) console.error('[markSubmissionDone] markDoneByTitle failed', response?.error);
    });
}

function recordDeadlineBehavior(title) {
    const courseName = document.querySelector('.page-header-headings')?.textContent.trim() || '';
    // Try to find deadline from the submission status table
    let deadlineStr = null;
    document.querySelectorAll('.submissionstatustable .cell.c0').forEach(cell => {
        if (cell.textContent.includes('תאריך הגשה') || cell.textContent.includes('Due date')) {
            const valueCell = cell.closest('tr')?.querySelector('.cell.c1');
            if (valueCell) deadlineStr = valueCell.textContent.trim();
        }
    });

    // Parse the deadline and record behavior
    chrome.storage.local.get(['courses', 'cache:submissions'], function(data) {
        let deadline = null;
        const now = new Date();

        // Try parsing from page-scraped deadline
        if (deadlineStr) {
            deadline = new Date(deadlineStr);
            if (isNaN(deadline.getTime())) deadline = null;
        }

        // Fallback: match against stored submissions. Prefer cache:submissions
        // (synced, authoritative) and fall back to legacy courses array for
        // signed-out / pre-migration users.
        if (!deadline) {
            const submissionRows = Object.values(data['cache:submissions'] || {})
                .filter(r => !r.deleted_at)
                .map(r => ({ name: r.name, date: r.event_date, time: r.event_time }));
            const courses = submissionRows.length > 0 ? submissionRows : (data.courses || []);
            const match = courses.find(c => c.name && title.includes(c.name.trim()));
            if (match && match.date) {
                const parts = match.date.split('/');
                if (parts.length === 3) {
                    const hours = match.time ? parseInt(match.time.split(':')[0]) : 23;
                    const mins = match.time ? parseInt(match.time.split(':')[1]) : 59;
                    deadline = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), hours, mins);
                }
            }
        }

        if (deadline && !isNaN(deadline.getTime())) {
            const hoursBeforeDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            chrome.runtime.sendMessage({
                type: 'deadlines.record',
                data: {
                    task_name: title,
                    course_name: courseName,
                    deadline: deadline.toISOString(),
                    completed_at: now.toISOString(),
                    hours_before_deadline: Math.round(hoursBeforeDeadline * 10) / 10
                }
            }, (response) => {
                if (!response?.ok) console.error('[deadlines] record failed:', response?.error);
            });
        }
    });
}

document.querySelector("#id_submitbutton").addEventListener('click', function() {
    const title = document.querySelector('.page-header-headings').textContent.trim();
    markItemAsDone(title);
    recordDeadlineBehavior(title);
});

document.querySelector(".checkbox input").click();