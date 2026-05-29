// Weekly tracker UI. Reads from userCoursesRepo + trackerCellsRepo;
// writes through those repos (optimistic cache + cloud sync via sync.js).

const PRESETS = {
    '1L_1T': { label: 'הרצאה + תרגול',         rows: [ {type:'lecture', idx:1, label:"הרצ'"}, {type:'tirgul', idx:1, label:"תר'"} ] },
    '1L_2T': { label: 'הרצאה + 2 תרגולים',      rows: [ {type:'lecture', idx:1, label:"הרצ'"}, {type:'tirgul', idx:1, label:"תר'1"}, {type:'tirgul', idx:2, label:"תר'2"} ] },
    '2L_1T': { label: '2 הרצאות + תרגול',       rows: [ {type:'lecture', idx:1, label:"הרצ'1"}, {type:'lecture', idx:2, label:"הרצ'2"}, {type:'tirgul', idx:1, label:"תר'"} ] },
    '2L_2T': { label: '2 הרצאות + 2 תרגולים',   rows: [ {type:'lecture', idx:1, label:"הרצ'1"}, {type:'lecture', idx:2, label:"הרצ'2"}, {type:'tirgul', idx:1, label:"תר'1"}, {type:'tirgul', idx:2, label:"תר'2"} ] },
    '1L':    { label: 'הרצאה בלבד',             rows: [ {type:'lecture', idx:1, label:"הרצ'"} ] },
};

class WeeklyTracker {
    constructor() {
        this._renderingPromise = null;
        // Kick off initial render; re-triggered by popup.js after course cards render
        this.displayTrackedCourses();
    }

    // Public: called by popup.js after displayAvailableCourses()
    async displayTrackedCourses() {
        // Coalesce concurrent calls — only one render at a time
        if (this._renderingPromise) return this._renderingPromise;
        this._renderingPromise = this._renderOnce().finally(() => {
            this._renderingPromise = null;
        });
        return this._renderingPromise;
    }

    async _renderOnce() {
        const cards = document.querySelectorAll('.course-card[data-course-name] .course-card-tracker');
        if (cards.length === 0) return;

        const userCourses = await userCoursesRepo.getAll();
        const byName = Object.fromEntries(userCourses.map((c) => [c.course_name, c]));

        for (const cardTracker of cards) {
            const card = cardTracker.closest('.course-card');
            const courseName = card.getAttribute('data-course-name');
            let uc = byName[courseName];
            if (!uc) {
                // Lazy-create row the first time we see this course. No preset yet.
                uc = await userCoursesRepo.upsertSettings(courseName, {});
            }
            await this._renderOneCourse(cardTracker, uc);
        }
    }

    async _renderOneCourse(container, uc) {
        container.innerHTML = '';
        if (!uc.tracker_preset) {
            this._renderPresetPicker(container, uc);
            return;
        }
        await this._renderTracker(container, uc);
    }

    _renderPresetPicker(container, uc) {
        const picker = document.createElement('div');
        picker.className = 'preset-picker';

        const title = document.createElement('div');
        title.className = 'preset-picker-title';
        title.textContent = 'בחר תבנית מעקב';
        picker.appendChild(title);

        const options = document.createElement('div');
        options.className = 'preset-picker-options';
        for (const [key, preset] of Object.entries(PRESETS)) {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = preset.label;
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await userCoursesRepo.upsertSettings(uc.course_name, { tracker_preset: key });
                await this.displayTrackedCourses();
            });
            options.appendChild(btn);
        }
        picker.appendChild(options);
        container.appendChild(picker);
    }

    async _renderTracker(container, uc) {
        const preset = PRESETS[uc.tracker_preset];
        if (!preset) return;

        // Header with change-preset
        const header = document.createElement('div');
        header.className = 'tracker-header';
        const changeBtn = document.createElement('button');
        changeBtn.className = 'change-preset-btn';
        changeBtn.innerHTML = '<i class="fa fa-cog"></i> שינוי תבנית';
        changeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await trackerCellsRepo.deleteByCourse(uc.id);
            await userCoursesRepo.upsertSettings(uc.course_name, { tracker_preset: null });
            await this.displayTrackedCourses();
        });
        header.appendChild(changeBtn);
        container.appendChild(header);

        const grid = await trackerCellsRepo.getByCourse(uc.id);
        const currentWeek = uc.tracker_current_week || 1;

        for (const rowSpec of preset.rows) {
            const rowEl = document.createElement('div');
            rowEl.className = 'tracker-row';

            const label = document.createElement('div');
            label.className = `tracker-row-label type-${rowSpec.type === 'tirgul' ? 'tirgul' : 'lecture'}`;
            label.textContent = rowSpec.label;
            rowEl.appendChild(label);

            const cells = document.createElement('div');
            cells.className = 'tracker-cells';
            const rowKey = `${rowSpec.type}:${rowSpec.idx}`;
            const rowCells = grid[rowKey] || {};

            for (let week = 1; week <= 13; week++) {
                const cell = document.createElement('div');
                cell.className = 'tracker-cell';
                const stored = rowCells[week];
                const isDone = !!(stored && stored.completed);
                if (isDone) {
                    cell.classList.add(rowSpec.type === 'lecture' ? 'completed-lecture' : 'completed-tirgul');
                }
                if (week === currentWeek) cell.classList.add('current-week');
                cell.setAttribute('role', 'checkbox');
                cell.setAttribute('aria-checked', String(isDone));
                cell.setAttribute('tabindex', '0');
                cell.title = `${rowSpec.label} - שבוע ${week}: ${isDone ? '\u2713' : '\u2717'}`;
                cell.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this._toggleCell(uc, rowSpec.type, rowSpec.idx, week, !isDone);
                });
                cell.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        await this._toggleCell(uc, rowSpec.type, rowSpec.idx, week, !isDone);
                    }
                });
                cells.appendChild(cell);
            }
            rowEl.appendChild(cells);
            container.appendChild(rowEl);
        }

        // Week number labels — current week highlighted via the number itself,
        // no cell border.
        const weekLabels = document.createElement('div');
        weekLabels.className = 'week-labels';
        for (let w = 1; w <= 13; w++) {
            const span = document.createElement('span');
            span.textContent = w;
            if (w === currentWeek) span.classList.add('current');
            weekLabels.appendChild(span);
        }
        container.appendChild(weekLabels);
    }

    async _toggleCell(uc, rowType, rowIndex, week, completed) {
        await trackerCellsRepo.setCompleted(uc.id, rowType, rowIndex, week, completed);
        // Auto-advance current week if this week's cells are all now complete
        if (completed && week === (uc.tracker_current_week || 1)) {
            const preset = PRESETS[uc.tracker_preset];
            if (preset) {
                const grid = await trackerCellsRepo.getByCourse(uc.id);
                const allDone = preset.rows.every((r) => {
                    const c = grid[`${r.type}:${r.idx}`]?.[week];
                    return c && c.completed;
                });
                if (allDone && week < 13) {
                    await userCoursesRepo.upsertSettings(uc.course_name, { tracker_current_week: week + 1 });
                }
            }
        }
        await this.displayTrackedCourses();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.weeklyTrackerInstance = new WeeklyTracker();
});
