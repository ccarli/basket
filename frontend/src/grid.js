import { html } from "./html.js";
import { fmtInt, fmtNum, fmtPct, fmtQty } from "./format.js";
import { textWidth } from "./measure.js";

/**
 * Cell model. Column 0 is the state rail and column 1 the expander; the data
 * columns described by the backend follow, so the CSV header drives the grid.
 */
export const LEAD_COLS = 2;
export const COL_MIN = LEAD_COLS; // first selectable column

/** Fonts the grid renders with, mirroring style.css. */
const UI = 'Inter, ui-sans-serif, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const HEADER_FONT = `600 10.5px ${UI}`;
const HEADER_SPACING = 0.84; // .08em at 10.5px, which canvas measuring ignores
const FONTS = {
  mono: `400 12px ${MONO}`,
  amount: `400 12.5px ${MONO}`,
  price: `400 12.5px ${MONO}`,
  pct: `400 12.5px ${MONO}`,
  text: `400 12.5px ${UI}`,
};

/** Bounds each column stays within, whatever its content. */
const SIZING = {
  mono: { min: 92, max: 170 },
  text: { min: 62, max: 300 },
  amount: { min: 86, max: 190 },
  price: { min: 78, max: 150 },
  pct: { min: 54, max: 120 },
};
const CELL_PADDING = 22;
/** Headers pay for their own padding plus a little slack. */
const HEADER_PADDING = 26;
/** A column is never floored above this by its header alone: a long header
    ellipsises rather than eating the width its neighbours need. */
const HEADER_FLOOR_MAX = 145;
const RAIL_W = 3;
const EXPANDER_W = 32;

function signed(n, forceSign) {
  const q = fmtQty(n);
  if (!q.signed) return { text: q.abs, node: q.abs };
  const s = forceSign ? q.sign : "";
  return {
    text: s + q.abs,
    node: html`<span className=${`signed ${n < 0 ? "neg" : "pos"}`}><span className="sign">${s}</span>${q.abs}</span>`,
  };
}

const plain = (text) => ({ text: String(text ?? ""), node: String(text ?? "") });

/** Deltas always carry their sign; levels only show one when negative. */
function content(row, col, delta) {
  const v = row[col.key];
  switch (col.format) {
    case "amount":
      return delta || v < 0 ? signed(v ?? 0, true) : plain(fmtInt(v ?? 0));
    case "price":
      return plain(fmtNum(v));
    case "pct":
      return plain(fmtPct(v));
    default:
      return plain(v);
  }
}

const cellClass = (col, editable) =>
  [col.format === "mono" ? "mono" : "", col.num ? "num" : "", editable && col.editable ? "editable" : ""]
    .filter(Boolean)
    .join(" ");

/** One row: the two leading cells, then one cell per data column. */
export function rowCells(row, columns, { editable = false, delta = false } = {}) {
  return [
    { cls: "state", text: "", node: "" },
    { cls: "expander", text: "", node: "" },
    ...columns.map((col) => {
      const v = content(row, col, delta);
      return { cls: cellClass(col, editable), text: v.text, node: v.node };
    }),
  ];
}

/** Filler row: same shape, no content. */
export function emptyCells(columns, editable) {
  return [
    { cls: "state", text: "", node: "" },
    { cls: "expander", text: "", node: "" },
    ...columns.map((col) => ({ cls: cellClass(col, editable), text: "", node: "" })),
  ];
}

/**
 * Column widths that keep every column visible: each one asks for the width of
 * its widest value (or of its header), then the row is scaled to the space
 * available. Columns the user resized by hand keep their pixel width.
 */
export function computeWidths(columns, cellRows, available, overrides = {}) {
  const wants = columns.map((col, i) => {
    if (overrides[col.key]) return { fixed: overrides[col.key] };
    const size = SIZING[col.format] ?? SIZING.text;
    const font = FONTS[col.format] ?? FONTS.text;
    const header = Math.ceil(textWidth(col.label.toUpperCase(), HEADER_FONT, HEADER_SPACING)) + HEADER_PADDING;

    let widest = 0;
    for (const row of cellRows) {
      const text = row[LEAD_COLS + i]?.text;
      if (text) widest = Math.max(widest, textWidth(text, font));
    }
    const content = Math.ceil(widest) + CELL_PADDING;

    // Numbers are right-aligned, so a column too narrow for them would hide
    // their leading digits with nothing to signal it: they never shrink below
    // their content. Text columns do, and ellipsise instead.
    const min = col.num
      ? Math.min(size.max, Math.max(size.min, header, content))
      : Math.min(HEADER_FLOOR_MAX, Math.max(size.min, header));

    return { want: Math.min(size.max, Math.max(min, content)), min };
  });

  const pinned = wants.reduce((s, w) => s + (w.fixed ?? 0), 0);
  let space = Math.max(0, available - RAIL_W - EXPANDER_W - pinned);
  const widths = wants.map((w) => w.fixed ?? 0);

  // Share the space in proportion to what each column asked for. Columns that
  // would fall under their minimum are pinned there and the rest is shared
  // again, so the total still lands on the space available.
  let pool = wants.map((_, i) => i).filter((i) => !wants[i].fixed);
  while (pool.length) {
    const asked = pool.reduce((s, i) => s + wants[i].want, 0);
    const scale = asked > 0 ? space / asked : 1;
    const tooSmall = pool.filter((i) => wants[i].want * scale < wants[i].min);
    if (!tooSmall.length) {
      pool.forEach((i) => { widths[i] = wants[i].want * scale; });
      break;
    }
    tooSmall.forEach((i) => { widths[i] = wants[i].min; space -= wants[i].min; });
    pool = pool.filter((i) => !tooSmall.includes(i));
  }

  // Round, then put the rounding drift back on the widest flexible column so
  // the row lands exactly on the available width.
  const rounded = widths.map(Math.round);
  const flexible = wants.map((w, i) => (w.fixed ? -1 : i)).filter((i) => i >= 0);
  if (flexible.length) {
    const drift =
      Math.round(available - RAIL_W - EXPANDER_W - pinned) -
      flexible.reduce((s, i) => s + rounded[i], 0);
    const widest = flexible.reduce((a, i) => (rounded[i] > rounded[a] ? i : a), flexible[0]);
    if (rounded[widest] + drift >= (wants[widest].min ?? 0)) rounded[widest] += drift;
  }

  return [RAIL_W, EXPANDER_W, ...rounded];
}
