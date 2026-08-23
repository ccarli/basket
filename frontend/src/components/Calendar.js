import { Fragment, useState } from "react";
import { html } from "../html.js";

const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "10-Aug" / "10-Aug-26" → Date (defaults to 10-Aug-2026, as in the reference). */
export function parseDate(s) {
  const m = s.match(/(\d{1,2})[-\s]([A-Za-z]{3})(?:[-\s](\d{2,4}))?/);
  if (!m) return new Date(2026, 7, 10);
  const mon = MONTHS_S.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  let year = m[3] ? parseInt(m[3], 10) : 2026;
  if (year < 100) year += 2000;
  return new Date(year, mon >= 0 ? mon : 0, parseInt(m[1], 10));
}

export const fmtDate = (d) => `${String(d.getDate()).padStart(2, "0")}-${MONTHS_S[d.getMonth()]}`;

/** Moves by whole business days, skipping weekends (no holiday calendar). */
export function shiftBusinessDays(date, days) {
  const d = new Date(date);
  const step = days < 0 ? -1 : 1;
  for (let left = Math.abs(days); left > 0; ) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

export function Calendar({ selected, onSelect }) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const y = view.getFullYear(), m = view.getMonth();

  const startDay = (new Date(y, m, 1).getDay() + 6) % 7; // week starts Monday
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = startDay - 1; i >= 0; i--) cells.push({ d: daysInPrev - i, other: true, date: new Date(y, m - 1, daysInPrev - i) });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ d: i, other: false, date: new Date(y, m, i) });
  for (let i = 1; cells.length < 42; i++) cells.push({ d: i, other: true, date: new Date(y, m + 1, i) });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sel = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()).getTime();

  return html`
    <${Fragment}>
      <div className="cal-head">
        <button className="cal-nav" aria-label="Previous month" onClick=${() => setView(new Date(y, m - 1, 1))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="cal-month">${MONTHS[m]} ${y}</div>
        <button className="cal-nav" aria-label="Next month" onClick=${() => setView(new Date(y, m + 1, 1))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div className="cal-wk">${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => html`<div key=${d}>${d}</div>`)}</div>
      <div className="cal-grid">
        ${cells.map((c, i) => {
          const dt = new Date(c.date); dt.setHours(0, 0, 0, 0);
          const cls = ["cal-day"];
          if (c.other) cls.push("other");
          if (dt.getTime() === today.getTime()) cls.push("today");
          if (dt.getTime() === sel) cls.push("sel");
          return html`<div key=${i} className=${cls.join(" ")} onClick=${() => onSelect(dt)}>${c.d}</div>`;
        })}
      </div>
    <//>
  `;
}
