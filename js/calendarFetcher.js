/**
 * BGU Spark - Calendar Fetcher (Popup)
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

const HEBREW_MONTHS_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HEBREW_DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
const EVENT_DOT_COLORS = ['#FF421D', '#0284c7', '#7c3aed', '#059669', '#d97706', '#db2777', '#4f46e5', '#16a34a', '#ea580c', '#475569'];

let allEventsByDay = {};
let undatedEvents = [];
let viewYear = 0;
let viewMonth = 0;
let selectedKey = null;

function pad2(n) {
    return String(n).padStart(2, '0');
}

function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getMonthName(month) {
    const months = ['', 'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
    return months[month] || '';
}

function parseEventDate(event) {
    if (event.date && typeof event.date === 'string') {
        const parts = event.date.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                if (year < 100) year += 2000;
                const d = new Date(year, month - 1, day);
                if (!isNaN(d.getTime())) return d;
            }
        }
    }
    if (event.time && typeof event.time === 'string') {
        const m = event.time.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m) {
            let year = parseInt(m[3], 10);
            if (year < 100) year += 2000;
            const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

function colorForCourse(courseName) {
    if (!courseName) return EVENT_DOT_COLORS[0];
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
        hash = ((hash << 5) - hash) + courseName.charCodeAt(i);
        hash |= 0;
    }
    return EVENT_DOT_COLORS[Math.abs(hash) % EVENT_DOT_COLORS.length];
}

function loadEvents() {
    return Promise.all([
        new Promise((resolve) => chrome.storage.local.get(['calendarEvents'], (r) => resolve(r.calendarEvents || []))),
        readSubmissionsForUI(),
    ]).then(([calendarEvents, { courses }]) => {
        allEventsByDay = {};
        undatedEvents = [];

        const merged = [];

        calendarEvents.forEach(event => {
            merged.push({
                title: event.title,
                link: event.link,
                time: event.time,
                date: event.date || '',
                course: event.course,
                type: 'calendar'
            });
        });

        courses.forEach(course => {
            merged.push({
                title: course.name,
                link: course.link,
                time: course.time || '',
                date: course.date || '',
                course: course.desc || '',
                type: 'deadline'
            });
        });

        merged.forEach(event => {
            const d = parseEventDate(event);
            if (d) {
                const key = dateKey(d);
                if (!allEventsByDay[key]) allEventsByDay[key] = [];
                allEventsByDay[key].push(event);
            } else {
                undatedEvents.push(event);
            }
        });
    });
}

function renderCalendar() {
    const monthLabel = document.getElementById('calendar-month-label');
    const grid = document.getElementById('calendar-grid-days');
    if (!monthLabel || !grid) return;

    monthLabel.textContent = `${HEBREW_MONTHS_FULL[viewMonth]} ${viewYear}`;
    grid.innerHTML = '';

    const today = new Date();
    const todayKey = dateKey(today);

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = firstOfMonth.getDay();
    const gridStart = new Date(viewYear, viewMonth, 1 - startDay);

    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + i);
        const key = dateKey(cellDate);
        const isOtherMonth = cellDate.getMonth() !== viewMonth;

        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        if (isOtherMonth) cell.classList.add('is-other-month');
        if (key === todayKey) cell.classList.add('is-today');
        if (key === selectedKey) cell.classList.add('is-selected');
        cell.dataset.date = key;

        const dayNum = document.createElement('span');
        dayNum.className = 'day-number';
        dayNum.textContent = cellDate.getDate();
        cell.appendChild(dayNum);

        const events = allEventsByDay[key] || [];
        if (events.length > 0) {
            const dots = document.createElement('div');
            dots.className = 'event-dots';
            const visible = Math.min(events.length, 3);
            for (let j = 0; j < visible; j++) {
                const dot = document.createElement('span');
                dot.className = 'event-dot';
                dot.style.background = colorForCourse(events[j].course || events[j].title);
                dots.appendChild(dot);
            }
            if (events.length > 3) {
                const more = document.createElement('span');
                more.className = 'event-overflow';
                more.textContent = `+${events.length - 3}`;
                dots.appendChild(more);
            }
            cell.appendChild(dots);
        }

        cell.addEventListener('click', () => setSelectedDay(key));
        grid.appendChild(cell);
    }
}

function renderDayEvents() {
    const headerEl = document.getElementById('calendar-day-events-header');
    const listEl = document.getElementById('calendar-day-events-list');
    if (!headerEl || !listEl) return;

    let totalEvents = undatedEvents.length;
    Object.keys(allEventsByDay).forEach(k => { totalEvents += allEventsByDay[k].length; });

    if (totalEvents === 0) {
        headerEl.textContent = '';
        listEl.innerHTML = `
            <div class="calendar-empty-state">
                <i class="fa fa-calendar-o fa-3x" aria-hidden="true"></i>
                <p>אין אירועים קרובים</p>
                <small>על מנת לטעון אירועים, יש לבקר בדף הראשי של המודל</small>
            </div>`;
        return;
    }

    if (!selectedKey) {
        headerEl.textContent = '';
        listEl.innerHTML = '';
        return;
    }

    const [y, m, d] = selectedKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    headerEl.textContent = `${HEBREW_DAY_NAMES[date.getDay()]}, ${d} ${HEBREW_MONTHS_FULL[m - 1]}`;

    const events = allEventsByDay[selectedKey] || [];
    listEl.innerHTML = '';

    if (events.length === 0) {
        listEl.innerHTML = `
            <div class="calendar-empty-state">
                <i class="fa fa-calendar-o fa-2x" aria-hidden="true"></i>
                <p>אין אירועים ביום זה</p>
            </div>`;
        return;
    }

    events.forEach(event => {
        const item = document.createElement('div');
        item.className = 'calendar-event-item';

        const info = document.createElement('div');
        info.className = 'calendar-event-info';

        const titleEl = document.createElement('a');
        titleEl.className = 'event-title';
        titleEl.textContent = event.title;
        titleEl.href = event.link;
        titleEl.target = '_blank';
        titleEl.style.textDecoration = 'none';
        titleEl.style.color = 'inherit';
        info.appendChild(titleEl);

        if (event.course) {
            const courseEl = document.createElement('div');
            courseEl.className = 'event-course';
            courseEl.textContent = event.course;
            info.appendChild(courseEl);
        }

        if (event.time) {
            const timeEl = document.createElement('div');
            timeEl.className = 'event-time';
            timeEl.innerHTML = `<i class="fa fa-clock-o"></i> ${event.time}`;
            info.appendChild(timeEl);
        }

        item.appendChild(info);

        titleEl.addEventListener('click', function (e) {
            e.preventDefault();
            chrome.tabs.create({ url: event.link });
        });

        listEl.appendChild(item);
    });
}

function setSelectedDay(key) {
    selectedKey = key;
    const [y, m] = key.split('-').map(Number);
    if (y !== viewYear || (m - 1) !== viewMonth) {
        viewYear = y;
        viewMonth = m - 1;
        renderCalendar();
    } else {
        document.querySelectorAll('.calendar-day-cell.is-selected').forEach(el => el.classList.remove('is-selected'));
        const cell = document.querySelector(`.calendar-day-cell[data-date="${key}"]`);
        if (cell) cell.classList.add('is-selected');
    }
    renderDayEvents();
}

function navigateMonth(delta) {
    viewMonth += delta;
    while (viewMonth < 0) { viewMonth += 12; viewYear -= 1; }
    while (viewMonth > 11) { viewMonth -= 12; viewYear += 1; }
    renderCalendar();
}

function goToToday() {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectedKey = dateKey(today);
    renderCalendar();
    renderDayEvents();
}

function initCalendar() {
    const grid = document.getElementById('calendar-grid-days');
    if (!grid) return;

    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectedKey = dateKey(today);

    loadEvents().then(() => {
        renderCalendar();
        renderDayEvents();
    });

    const prevBtn = document.getElementById('calendar-prev-month');
    const nextBtn = document.getElementById('calendar-next-month');
    const todayBtn = document.getElementById('calendar-today-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateMonth(1));
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
}

document.addEventListener('DOMContentLoaded', initCalendar);
