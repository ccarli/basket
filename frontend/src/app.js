import { useEffect, useMemo, useRef, useState } from "react";
import { html } from "./html.js";
import { getBasket } from "./api.js";
import { GridTable } from "./components/GridTable.js";
import { Toolbar } from "./components/Toolbar.js";
import { TotalsBar } from "./components/TotalsBar.js";
import { DEFAULT_WIDTHS, emptyCells, rowCells } from "./grid.js";
import { fmtInt, signedInt } from "./format.js";
import { useGrid } from "./use-grid.js";
import { EDITABLE_FIELDS, applyEdits, dealRows, positions } from "./model.js";

/**
 * Cell model of a table: one entry per displayed line. `rows` may be sparse —
 * a position typed into an empty line keeps the line it was typed on.
 */
const buildCells = (rows, minRows, editable, delta) =>
  Array.from({ length: Math.max(minRows, rows.length) }, (_, i) =>
    rows[i] ? rowCells(rows[i], editable, delta) : emptyCells(editable)
  );

const toEur = (r, eurusd) => (r.ccy === "USD" ? r.mv * eurusd : r.mv);
const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
const sign = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export default function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("current");
  const [basket, setBasket] = useState(null);
  const [dark, setDark] = useState(false);
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  const [expanded, setExpanded] = useState([]);
  /** User edits of the current set, keyed by displayed row index. */
  const [edits, setEdits] = useState({});
  /** Target notional of the basket; null follows the previous notional. */
  const [target, setTarget] = useState(null);
  /** The deal sheet lives in a drawer, closed on load. */
  const [dealOpen, setDealOpen] = useState(false);

  const mainScroll = useRef(null);
  const dealScroll = useRef(null);

  useEffect(() => { getBasket(basket).then(setData); }, [basket]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  /** Current holdings with the user's edits applied — the deal sheet derives from these. */
  const current = useMemo(
    () => (data ? applyEdits(data.current, edits, data.previous) : []),
    [data, edits]
  );
  const rows = mode === "current" ? current : data?.previous ?? [];
  const deal = useMemo(
    () => (data ? dealRows(current, data.previous) : []),
    [current, data]
  );

  const mainCells = useMemo(
    () => buildCells(rows, data?.rows.main ?? 0, mode === "current", false),
    [rows, mode, data]
  );
  const dealCells = useMemo(() => buildCells(deal, data?.rows.deal ?? 0, false, true), [deal, data]);

  const tables = useMemo(() => ({
    main: {
      rowCount: mainCells.length,
      isEditable: (_r, c) => mode === "current" && c >= 2 && c <= 4,
      baseText: (r, c) => mainCells[r]?.[c]?.text ?? "",
      scroll: () => mainScroll.current,
    },
    deal: {
      rowCount: dealCells.length,
      isEditable: () => false,
      baseText: (r, c) => dealCells[r]?.[c]?.text ?? "",
      scroll: () => dealScroll.current,
    },
  }), [mainCells, dealCells, mode]);

  /** Every edit — typing, paste, Delete, Ctrl+Enter — lands here. */
  const onEdit = (entries) =>
    setEdits((prev) => {
      const next = { ...prev };
      for (const { table, r, c, value } of entries) {
        const field = EDITABLE_FIELDS[c];
        if (table === "main" && field) next[r] = { ...next[r], [field]: value };
      }
      return next;
    });

  const grid = useGrid({ tables, onEdit });

  const reset = () => {
    setExpanded([]);
    grid.setSel(null);
  };

  const switchMode = (m) => { setMode(m); reset(); };

  const switchBasket = (b) => { setBasket(b); setEdits({}); setTarget(null); reset(); };

  const toggleDeal = () => {
    if (dealOpen && grid.sel?.table === "deal") grid.setSel(null);
    setDealOpen(!dealOpen);
  };

  const onResize = (col, w) => setWidths((prev) => prev.map((x, i) => (i === col ? w : x)));

  if (!data) return null;

  const shown = positions(rows);
  const currentMv = Math.round(sum(positions(current), (r) => toEur(r, data.eurusd)));
  const previousMv = Math.round(sum(data.previous, (r) => toEur(r, data.eurusd)));
  const mainTotals = [
    { k: "Lines", v: String(shown.length) },
    { k: "Total quantity", v: fmtInt(sum(shown, (r) => r.qty)) },
    { k: "Total MV — current", ccy: "EUR eq.", v: fmtInt(currentMv) },
    { k: "Total MV — previous", ccy: "EUR eq.", v: fmtInt(previousMv) },
  ];

  /** Old notional is the previous basket; the new one defaults to it, and the
      unwind amount is the difference — editing either side moves the other. */
  const notional = { old: previousMv, new: target ?? previousMv };
  notional.unwind = notional.old - notional.new;
  const onNotional = (field, value) =>
    setTarget(field === "new" ? value : previousMv - value);

  const dealQty = sum(deal, (r) => r.qty);
  const dealMv = sum(deal, (r) => toEur(r, data.eurusd));
  const dealTotals = [
    { k: "Lines", v: String(deal.length) },
    { k: "Δ Total quantity", v: signedInt(dealQty), cls: sign(dealQty) },
    { k: "Δ Total MV", ccy: "EUR eq.", v: signedInt(Math.round(dealMv)), cls: sign(dealMv) },
  ];

  return html`
    <div className="app">
      <${Toolbar}
        baskets=${data.baskets}
        basket=${data.basket}
        onBasketChange=${switchBasket}
        statics=${data.statics}
        notional=${notional}
        onNotional=${onNotional}
        dark=${dark}
        onToggleTheme=${() => setDark((d) => !d)}
      />

      <main className="main">
        <section className="pane">
          <div className="pane-head">
            <div className="pane-title">Basket components</div>
            <div className="seg" role="tablist" aria-label="Basket mode">
              ${["current", "previous"].map((m) => html`
                <button key=${m} className=${mode === m ? "on" : ""} onClick=${() => switchMode(m)}>
                  <span className="pip" />${m === "current" ? "Current" : "Previous"}
                </button>
              `)}
            </div>
            <div className="spacer" />
          </div>

          <${TotalsBar} totals=${mainTotals} />
          <${GridTable}
            tableKey="main"
            cells=${mainCells}
            rows=${rows}
            deltaHeaders=${false}
            expandable=${true}
            widths=${widths}
            onResize=${onResize}
            grid=${grid}
            scrollRef=${mainScroll}
            scrollClass="main-table"
            inventory=${data.inventory}
            expanded=${expanded}
            onToggleExpand=${(i) => setExpanded((e) => (e.includes(i) ? e.filter((x) => x !== i) : [...e, i]))}
          />
        </section>

      </main>

      <div className=${`drawer ${dealOpen ? "open" : ""}`}>
        <button
          className="drawer-handle"
          aria-expanded=${dealOpen}
          aria-controls="deal-drawer"
          onClick=${toggleDeal}
        >
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
          Deal sheet
        </button>
        <div className="drawer-body" id="deal-drawer">
          <section className="pane">
            <${TotalsBar} totals=${dealTotals} />
            <${GridTable}
              tableKey="deal"
              cells=${dealCells}
              rows=${deal}
              deltaHeaders=${true}
              expandable=${false}
              widths=${widths}
              onResize=${onResize}
              grid=${grid}
              scrollRef=${dealScroll}
              scrollClass="deal-table"
            />
          </section>
        </div>
      </div>
    </div>
  `;
}
