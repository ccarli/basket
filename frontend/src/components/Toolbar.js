import { useRef, useState } from "react";
import { html } from "../html.js";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover.js";
import { Calendar, fmtDate, parseDate, shiftBusinessDays } from "./Calendar.js";
import { StaticsDialog } from "./StaticsDialog.js";

const DATE_FIELDS = [
  { key: "COB", label: "Close of business date", initial: "10-Aug" },
  { key: "TD", label: "Trade date", initial: "11-Aug" },
  { key: "VD", label: "Value date", initial: "12-Aug" },
];
const TD = 1;

/** A new trade date drags COB and VD along: one business day either side. */
const fromTradeDate = (td) => [
  fmtDate(shiftBusinessDays(td, -1)),
  fmtDate(td),
  fmtDate(shiftBusinessDays(td, 1)),
];

export function Toolbar({ baskets, basket, onBasketChange, statics, dark, onToggleTheme }) {
  const [dates, setDates] = useState(DATE_FIELDS.map((f) => f.initial));

  return html`
    <header className="top">
      <div className="brand">
        <div className="mark">Basket TRS</div>
        <div className="crumb">secondary event</div>
      </div>

      <div className="top-group">
        <div className="basket-group">
          <div className="basket-select" title="Change basket">
            <span className="name">${basket}</span>
            <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            <select aria-label="Basket" value=${basket} onChange=${(e) => onBasketChange(e.target.value)}>
              ${baskets.map((b) => html`<option key=${b}>${b}</option>`)}
            </select>
          </div>
          <${StaticsDialog} statics=${statics} />
        </div>
      </div>

      <div className="spacer" />

      <div className="date-grid" role="group" aria-label="Dates">
        ${DATE_FIELDS.map((f) => html`<div className="dh" key=${f.key}>${f.key}</div>`)}
        ${DATE_FIELDS.map((f, i) => html`
          <${DateCell}
            key=${f.key}
            label=${f.label}
            value=${dates[i]}
            onChange=${(v) =>
              setDates((d) => (i === TD ? fromTradeDate(parseDate(v)) : d.map((x, j) => (j === i ? v : x))))}
          />
        `)}
      </div>

      <button className="theme-btn" title="Toggle theme" aria-label="Toggle dark mode" onClick=${onToggleTheme}>
        ${dark
          ? html`<svg className="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
            </svg>`
          : html`<svg className="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>`}
      </button>
    </header>
  `;
}

function DateCell({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const input = useRef(null);
  return html`
    <div className="dc">
      <${Popover} open=${open} onOpenChange=${setOpen}>
        <${PopoverAnchor} asChild>
          <input
            ref=${input}
            type="text"
            readOnly
            value=${value}
            aria-label=${label}
            onFocus=${() => setOpen(true)}
            onClick=${() => setOpen(true)}
          />
        <//>
        <${PopoverContent}
          onInteractOutside=${(e) => {
            if (input.current?.contains(e.target)) e.preventDefault();
          }}
        >
          <${Calendar}
            selected=${parseDate(value)}
            onSelect=${(d) => { onChange(fmtDate(d)); setOpen(false); }}
          />
        <//>
      <//>
    </div>
  `;
}
