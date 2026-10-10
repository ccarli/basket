const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKEND = [0, 6]; // Date.getDay() of Sunday and Saturday
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const ARROW = (path) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${path}"/></svg>`;

const popover = document.querySelector("#calendar");
const inputs = [...document.querySelectorAll("[data-date]")];
const dates = { COB: new Date(2026, 7, 10), TD: new Date(2026, 7, 11), VD: new Date(2026, 7, 12) };
let field = null; // the date being picked
let month = null; // first day of the month on display

const label = (date) => `${String(date.getDate()).padStart(2, "0")}-${MONTHS[date.getMonth()].slice(0, 3)}`;

// Weekends are skipped; there is no holiday calendar.
function shiftBusinessDays(date, days) {
  const shifted = new Date(date);
  for (let left = Math.abs(days); left > 0; ) {
    shifted.setDate(shifted.getDate() + Math.sign(days));
    if (!WEEKEND.includes(shifted.getDay())) left--;
  }
  return shifted;
}

function showDates() {
  inputs.forEach((input) => (input.value = label(dates[input.dataset.date])));
}

function draw() {
  const mondayOffset = (month.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset + i));
  const today = new Date().toDateString();
  const classes = (day) => [
    "cal-day",
    day.getMonth() !== month.getMonth() && "other",
    day.toDateString() === today && "today",
    +day === +dates[field] && "sel",
  ].filter(Boolean).join(" ");
  popover.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" data-step="-1" aria-label="Previous month">${ARROW("M15 6l-6 6 6 6")}</button>
      <div class="cal-month">${MONTHS[month.getMonth()]} ${month.getFullYear()}</div>
      <button class="cal-nav" data-step="1" aria-label="Next month">${ARROW("M9 6l6 6-6 6")}</button>
    </div>
    <div class="cal-wk">${WEEKDAYS.map((day) => `<div>${day}</div>`).join("")}</div>
    <div class="cal-grid">${days.map((day) => `<div class="${classes(day)}" data-time="${+day}">${day.getDate()}</div>`).join("")}</div>`;
}

function open(input) {
  field = input.dataset.date;
  month = new Date(dates[field].getFullYear(), dates[field].getMonth(), 1);
  const anchor = input.getBoundingClientRect();
  popover.classList.add("open");
  popover.style.top = `${anchor.bottom + 6}px`;
  popover.style.left = `${Math.min(anchor.left, innerWidth - popover.offsetWidth - 8)}px`;
  draw();
}

const close = () => popover.classList.remove("open");

// A new trade date drags COB and VD along: one business day either side.
function pick(date) {
  if (field === "TD") Object.assign(dates, { COB: shiftBusinessDays(date, -1), TD: date, VD: shiftBusinessDays(date, 1) });
  else dates[field] = date;
  showDates();
  close();
}

export function initCalendar() {
  showDates();
  inputs.forEach((input) => input.addEventListener("click", () => open(input)));
  popover.addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    const day = e.target.closest("[data-time]");
    if (step) {
      month = new Date(month.getFullYear(), month.getMonth() + Number(step.dataset.step), 1);
      draw();
    } else if (day) pick(new Date(Number(day.dataset.time)));
  });
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest("#calendar, [data-date]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
