/**
 * datePicker.js — Reusable themed date & time picker component.
 *
 * Replaces the native `<input type="datetime-local">` control with a custom,
 * theme-matched popover calendar while preserving the exact value contract the
 * rest of the app depends on: reading/writing `element.value` still returns and
 * accepts a local `"YYYY-MM-DDTHH:MM"` string (same as a native datetime-local
 * input). This is achieved by shadowing the element's `value` accessor, so code
 * like `document.getElementById('startBox').value = ...` (see manageData.js)
 * keeps working unchanged, and programmatic writes update the picker UI.
 *
 * Usage (auto): add `data-datepicker` to a hidden/text input and it is wired up
 * on DOMContentLoaded. Optional `data-datepicker-align="right"` anchors the
 * popover to the input's right edge (keeps it inside narrow panels).
 *
 * Usage (manual): `createDatePicker(inputElement, { align: 'right' })`.
 *
 * Follows the plain-global-function convention used across this codebase
 * (see statsPanel.js) — no modules, no build step.
 */

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const MONTH_LABELS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Zero-pad a number to two digits.
function whibPad2(n) {
    return String(n).padStart(2, "0");
}

// Format a Date as a local "YYYY-MM-DDTHH:MM" string (native datetime-local contract).
function whibFormatLocal(date) {
    return `${date.getFullYear()}-${whibPad2(date.getMonth() + 1)}-${whibPad2(date.getDate())}` +
        `T${whibPad2(date.getHours())}:${whibPad2(date.getMinutes())}`;
}

// Parse an "HH:MM" string into a clamped [hours, minutes] pair (defaults to midnight).
function whibParseTime(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
    if (!match) return [0, 0];
    const h = Math.min(23, Math.max(0, Number(match[1]) || 0));
    const m = Math.min(59, Math.max(0, Number(match[2]) || 0));
    return [h, m];
}

// Parse a "YYYY-MM-DDTHH:MM" string into a local Date, or null if empty/invalid.
function whibParseLocal(value) {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match) return null;
    const [, y, mo, d, h, mi] = match.map(Number);
    const date = new Date(y, mo - 1, d, h, mi, 0, 0);
    return isNaN(date.getTime()) ? null : date;
}

// Human-friendly label shown on the trigger button, e.g. "30 Jun 2026, 14:30".
function whibFormatDisplay(date) {
    if (!date) return "";
    return `${date.getDate()} ${MONTH_LABELS_SHORT[date.getMonth()]} ${date.getFullYear()}, ` +
        `${whibPad2(date.getHours())}:${whibPad2(date.getMinutes())}`;
}

function whibSameDay(a, b) {
    return a && b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

/**
 * Turn a plain input element into a custom date+time picker.
 * @param {HTMLInputElement} input - The input to enhance (its id is preserved).
 * @param {Object} [options]
 * @param {'left'|'right'} [options.align='left'] - Popover anchor edge.
 * @returns {Object} A small controller ({ open, close, getDate, setDate }).
 */
function createDatePicker(input, options = {}) {
    if (!input || input.dataset.datepickerReady === "true") return null;
    input.dataset.datepickerReady = "true";

    const align = options.align || input.dataset.datepickerAlign || "left";

    // Internal source of truth. Seeded from any pre-existing value attribute.
    let selected = whibParseLocal(input.getAttribute("value") || input.value || "");
    // Month currently shown in the calendar grid (defaults to selected or today).
    let viewDate = selected ? new Date(selected) : new Date();
    viewDate.setDate(1);
    let isOpen = false;

    // --- Shadow the value accessor so external get/set keeps the string contract ---
    Object.defineProperty(input, "value", {
        configurable: true,
        get() {
            return selected ? whibFormatLocal(selected) : "";
        },
        set(v) {
            selected = whibParseLocal(v);
            if (selected) {
                viewDate = new Date(selected);
                viewDate.setDate(1);
            }
            refreshTrigger();
            if (isOpen) renderCalendar();
        }
    });

    // Hide the original input but keep it in the DOM (id/name preserved).
    input.type = "hidden";

    // --- Build DOM scaffolding ---
    const wrapper = document.createElement("div");
    wrapper.className = "whib-datepicker";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "whib-datepicker__trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");

    const triggerLabel = document.createElement("span");
    triggerLabel.className = "whib-datepicker__label";

    const triggerIcon = document.createElement("span");
    triggerIcon.className = "whib-datepicker__icon";
    triggerIcon.setAttribute("aria-hidden", "true");
    // Feather-style calendar glyph; inherits colour via `currentColor`.
    triggerIcon.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="18" rx="2"></rect>' +
        '<line x1="3" y1="9" x2="21" y2="9"></line>' +
        '<line x1="8" y1="2" x2="8" y2="6"></line>' +
        '<line x1="16" y1="2" x2="16" y2="6"></line></svg>';

    trigger.appendChild(triggerLabel);
    trigger.appendChild(triggerIcon);
    wrapper.appendChild(trigger);

    const popover = document.createElement("div");
    popover.className = `whib-datepicker__popover whib-datepicker__popover--${align}`;
    popover.setAttribute("role", "dialog");
    popover.hidden = true;
    wrapper.appendChild(popover);

    // Calendar header: prev / month-year / next
    const header = document.createElement("div");
    header.className = "whib-datepicker__header";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "whib-datepicker__nav";
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.textContent = "‹"; // ‹

    const titleEl = document.createElement("span");
    titleEl.className = "whib-datepicker__title";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "whib-datepicker__nav";
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.textContent = "›"; // ›

    header.appendChild(prevBtn);
    header.appendChild(titleEl);
    header.appendChild(nextBtn);
    popover.appendChild(header);

    // Weekday labels
    const weekRow = document.createElement("div");
    weekRow.className = "whib-datepicker__weekdays";
    WEEKDAY_LABELS.forEach((label) => {
        const cell = document.createElement("span");
        cell.className = "whib-datepicker__weekday";
        cell.textContent = label;
        weekRow.appendChild(cell);
    });
    popover.appendChild(weekRow);

    // Day grid
    const grid = document.createElement("div");
    grid.className = "whib-datepicker__grid";
    popover.appendChild(grid);

    // Time row: hour : minute
    const timeRow = document.createElement("div");
    timeRow.className = "whib-datepicker__time";

    const timeLabel = document.createElement("span");
    timeLabel.className = "whib-datepicker__time-label";
    timeLabel.textContent = "Time";

    // Single time field — one large tap target that opens the OS-native time
    // wheel on mobile, while staying a plain HH:MM box on desktop.
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.className = "whib-datepicker__time-input";
    timeInput.setAttribute("aria-label", "Time");

    timeRow.appendChild(timeLabel);
    timeRow.appendChild(timeInput);
    popover.appendChild(timeRow);

    // Footer actions
    const footer = document.createElement("div");
    footer.className = "whib-datepicker__footer";

    const nowBtn = document.createElement("button");
    nowBtn.type = "button";
    nowBtn.className = "whib-datepicker__action whib-datepicker__action--muted";
    nowBtn.textContent = "Now";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "whib-datepicker__action whib-datepicker__action--primary";
    doneBtn.textContent = "Done";

    footer.appendChild(nowBtn);
    footer.appendChild(doneBtn);
    popover.appendChild(footer);

    // --- Rendering ---
    function refreshTrigger() {
        const display = whibFormatDisplay(selected);
        if (display) {
            triggerLabel.textContent = display;
            trigger.classList.remove("whib-datepicker__trigger--empty");
        } else {
            triggerLabel.textContent = "Select date & time";
            trigger.classList.add("whib-datepicker__trigger--empty");
        }
    }

    function renderCalendar() {
        titleEl.textContent = `${MONTH_LABELS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

        grid.textContent = "";
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        // Leading blanks for alignment.
        for (let i = 0; i < firstWeekday; i++) {
            const blank = document.createElement("span");
            blank.className = "whib-datepicker__day whib-datepicker__day--blank";
            grid.appendChild(blank);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "whib-datepicker__day";
            cell.textContent = String(day);
            if (whibSameDay(dayDate, today)) {
                cell.classList.add("whib-datepicker__day--today");
            }
            if (whibSameDay(dayDate, selected)) {
                cell.classList.add("whib-datepicker__day--selected");
            }
            cell.addEventListener("click", () => pickDay(day));
            grid.appendChild(cell);
        }

        const time = selected || new Date();
        timeInput.value = `${whibPad2(time.getHours())}:${whibPad2(time.getMinutes())}`;
    }

    // --- Interaction ---
    function ensureSelected() {
        if (!selected) {
            // Default to the currently viewed month's day 1 at the shown time.
            const [h, m] = whibParseTime(timeInput.value);
            selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, h, m);
        }
        return selected;
    }

    function pickDay(day) {
        const base = ensureSelected();
        selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day,
            base.getHours(), base.getMinutes());
        refreshTrigger();
        renderCalendar();
    }

    function commitTime() {
        const [h, m] = whibParseTime(timeInput.value);
        const base = ensureSelected();
        selected = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
        refreshTrigger();
    }

    prevBtn.addEventListener("click", () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderCalendar();
    });
    nextBtn.addEventListener("click", () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderCalendar();
    });
    timeInput.addEventListener("change", commitTime);
    timeInput.addEventListener("input", commitTime);

    nowBtn.addEventListener("click", () => {
        selected = new Date();
        selected.setSeconds(0, 0);
        viewDate = new Date(selected);
        viewDate.setDate(1);
        refreshTrigger();
        renderCalendar();
    });
    doneBtn.addEventListener("click", close);

    trigger.addEventListener("click", () => {
        isOpen ? close() : open();
    });

    // Close when clicking outside this picker.
    function onDocClick(event) {
        if (!wrapper.contains(event.target)) close();
    }
    function onKeyDown(event) {
        if (event.key === "Escape") close();
    }

    function open() {
        if (isOpen) return;
        isOpen = true;
        popover.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        renderCalendar();
        document.addEventListener("click", onDocClick, true);
        document.addEventListener("keydown", onKeyDown);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        popover.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        document.removeEventListener("click", onDocClick, true);
        document.removeEventListener("keydown", onKeyDown);
    }

    refreshTrigger();

    return {
        open,
        close,
        getDate: () => (selected ? new Date(selected) : null),
        setDate: (date) => {
            input.value = date ? whibFormatLocal(date) : "";
        }
    };
}

/**
 * Wire up every `input[data-datepicker]` on the page. Safe to call repeatedly;
 * already-initialised inputs are skipped.
 */
function initDatePickers() {
    document.querySelectorAll("input[data-datepicker]").forEach((input) => {
        createDatePicker(input);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDatePickers);
} else {
    initDatePickers();
}
