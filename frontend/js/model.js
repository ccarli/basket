import { parseAmount } from "./format.js";

// The basket columns the frontend computes with, named exactly as in the CSV
// header. backend/utils.py holds the same list.
export const ISIN = "ISIN";
export const NOMINAL = "NOMINAL";
const SOURCE = "SOURCE";
const HC = "HC";
const RESET_FX = "RESET FX"; // units of CURRENCY per EUR
const DIRTY_PX = "DIRTY PX";
const MARKET_VALUE_PRE_HC = "MARKET VALUE (EUR PRE-HC)";
export const MARKET_VALUE = "MARKET VALUE (EUR)";

const SOURCES = ["TRS", "SUB IN", "SUB OUT"];
const RAIL_CLASS = { "SUB IN": "st-add", "SUB OUT": "st-rem" }; // the coloured rail of a row, see style.css

export const sum = (items, value = (x) => x) => items.reduce((total, item) => total + value(item), 0);

export const positions = (rows) => rows.filter((row) => row?.[ISIN]);

export const totalNominal = (rows) => sum(rows, (row) => row[NOMINAL]);

export const totalMarketValue = (rows) => sum(rows, (row) => row[MARKET_VALUE]);

export const railClass = (row) => RAIL_CLASS[row[SOURCE]] ?? "";

export const inventoryLines = (row, inventory) => inventory[row[ISIN]] ?? [];

export function withMarketValues(row) {
  const preHaircut = Math.round((row[NOMINAL] * row[DIRTY_PX]) / 100 / row[RESET_FX]) || 0;
  return { ...row, [MARKET_VALUE_PRE_HC]: preHaircut, [MARKET_VALUE]: Math.round(preHaircut * (1 - row[HC])) || 0 };
}

const BLANK = { amount: 0, price: NaN, rate: NaN, pct: NaN };

const blankRow = (columns) => ({
  ...Object.fromEntries(columns.map((c) => [c.name, BLANK[c.format] ?? ""])),
  [SOURCE]: "SUB IN",
});

// What a typed text becomes in the row, or undefined when it is not acceptable.
function typedValue(name, text, format) {
  if (name === SOURCE) return SOURCES.find((source) => source === text.trim().toUpperCase());
  return format === "amount" ? parseAmount(text) : text;
}

// edits: { rowIndex: { columnName: typedText } }.
// Clearing the ISIN of a line removes the line. Typing another ISIN starts a
// new line, which inherits its read-only columns when the previous set holds it.
export function applyEdits(rows, edits, previous, columns) {
  const held = new Map(previous.map((row) => [row[ISIN], row]));
  const readOnly = columns.filter((c) => !c.editable).map((c) => c.name);
  const format = Object.fromEntries(columns.map((c) => [c.name, c.format]));
  const edited = rows.slice();

  for (const [index, patch] of Object.entries(edits)) {
    if (ISIN in patch && !patch[ISIN].trim()) {
      delete edited[index];
      continue;
    }
    const existing = ISIN in patch && patch[ISIN] !== rows[index]?.[ISIN] ? null : rows[index];
    const source = existing ? null : held.get(patch[ISIN]);
    const inherited = source ? Object.fromEntries(readOnly.map((name) => [name, source[name]])) : {};
    const typed = Object.fromEntries(
      Object.entries(patch)
        .map(([name, text]) => [name, typedValue(name, text, format[name])])
        .filter(([, value]) => value !== undefined)
    );
    edited[index] = withMarketValues({ ...(existing ?? blankRow(columns)), ...inherited, ...typed });
  }
  return edited;
}

const byIsin = (rows) => {
  const merged = new Map();
  for (const row of positions(rows)) {
    const seen = merged.get(row[ISIN]);
    merged.set(row[ISIN], seen ? { ...seen, [NOMINAL]: seen[NOMINAL] + row[NOMINAL] } : row);
  }
  return merged;
};

// Current − previous NOMINAL per ISIN, valued at the current price when there is one.
export function dealRows(current, previous) {
  const now = byIsin(current);
  const before = byIsin(previous);
  return [...new Set([...now.keys(), ...before.keys()])].flatMap((isin) => {
    const cur = now.get(isin);
    const prev = before.get(isin);
    const nominal = (cur?.[NOMINAL] ?? 0) - (prev?.[NOMINAL] ?? 0);
    if (!nominal) return [];
    return withMarketValues({ ...(cur ?? prev), [NOMINAL]: nominal, [SOURCE]: nominal > 0 ? "SUB IN" : "SUB OUT" });
  });
}

// selected: the { rows, columns } of a grid selection, or null.
export function selectionSum(selected) {
  if (!selected) return null;
  const summable = selected.columns.filter((c) => c.summable);
  const values = selected.rows
    .flatMap((row) => (row ? summable.map((c) => Number(row[c.name])) : []))
    .filter(Number.isFinite);
  return values.length ? { total: sum(values), cells: values.length } : null;
}
