import { parseAmount } from "./format.js";

export const sum = (items, value = (x) => x) => items.reduce((total, item) => total + value(item), 0);

export const positions = (rows) => rows.filter((row) => row?.isin);

export const totalQty = (rows) => sum(rows, (row) => row.qty);

export const rowState = (row) => row.state;

export const inventoryLines = (row, inventory) => inventory[row.isin] ?? [];

export const toEur = (row, eurusd) => (row.ccy === "USD" ? row.mv * eurusd : row.mv);

export function withMarketValues(row) {
  const mv_pre = Math.round((row.qty * row.dirty_price) / 100) || 0;
  return { ...row, mv_pre, mv: Math.round(mv_pre * row.hc) || 0 };
}

const BLANK = { amount: 0, price: NaN, pct: NaN };

const blankRow = (columns) => ({
  ...Object.fromEntries(columns.map((c) => [c.name, BLANK[c.format] ?? ""])),
  state: "add",
  label: "SUB IN",
});

// edits: { rowIndex: { columnName: typedText } }. A new line whose ISIN is held
// in the previous set inherits that position's read-only columns.
export function applyEdits(rows, edits, previous, columns) {
  const held = new Map(previous.map((row) => [row.isin, row]));
  const readOnly = columns.filter((c) => !c.editable).map((c) => c.name);
  const format = Object.fromEntries(columns.map((c) => [c.name, c.format]));
  const edited = rows.slice();

  for (const [index, patch] of Object.entries(edits)) {
    const existing = rows[index];
    const source = existing ? null : held.get(patch.isin);
    const inherited = source ? Object.fromEntries(readOnly.map((name) => [name, source[name]])) : {};
    const typed = Object.fromEntries(
      Object.entries(patch).map(([name, text]) => [name, format[name] === "amount" ? parseAmount(text) : text])
    );
    edited[index] = withMarketValues({ ...(existing ?? blankRow(columns)), ...inherited, ...typed });
  }
  return edited;
}

const byIsin = (rows) => {
  const merged = new Map();
  for (const row of positions(rows)) {
    const seen = merged.get(row.isin);
    merged.set(row.isin, seen ? { ...seen, qty: seen.qty + row.qty } : row);
  }
  return merged;
};

// Current − previous quantity per ISIN, valued at the current price when there is one.
export function dealRows(current, previous) {
  const now = byIsin(current);
  const before = byIsin(previous);
  return [...new Set([...now.keys(), ...before.keys()])].flatMap((isin) => {
    const cur = now.get(isin);
    const prev = before.get(isin);
    const qty = (cur?.qty ?? 0) - (prev?.qty ?? 0);
    if (!qty) return [];
    const [state, label] = !prev ? ["add", "SUB IN"] : !cur ? ["rem", "SUB OUT"] : ["edit", "EDIT"];
    return withMarketValues({ ...(cur ?? prev), qty, state, label });
  });
}

// range: { r1, r2, c1, c2 } over rows × columns, or null.
export function selectionSum(range, rows, columns) {
  if (!range) return null;
  const summable = columns.slice(range.c1, range.c2 + 1).filter((c) => c.summable);
  const values = rows
    .slice(range.r1, range.r2 + 1)
    .flatMap((row) => (row ? summable.map((c) => Number(row[c.name])) : []))
    .filter(Number.isFinite);
  return values.length ? { total: sum(values), cells: values.length } : null;
}
