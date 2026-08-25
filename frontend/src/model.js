/**
 * Row model: the CSV rows of a basket, the user's edits applied on top, and the
 * deal sheet derived from the Current/Previous comparison.
 */

/** An empty position, typed from the column definitions. */
const blankRow = (columns) => ({
  state: "add",
  ...Object.fromEntries(
    columns.map((c) => [c.key, c.format === "amount" ? 0 : c.num ? NaN : ""])
  ),
  label: "SUB IN",
});

/**
 * "1,500,000", "−100 000", "125k" or "140M" → number, rounded to the unit;
 * anything unparsable counts as 0.
 */
export function parseQty(text) {
  const cleaned = String(text).replace(/[\s,]/g, "").replace(/−/g, "-");
  const scaled = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+))([km])$/i);
  const n = scaled
    ? Number(scaled[1]) * (scaled[2].toLowerCase() === "k" ? 1e3 : 1e6)
    : Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** MV pre HC = quantity × dirty price / 100; Market value = MV pre HC × HC. */
export function derive(r) {
  const mvPre = Math.round((r.qty * r.dirty_price) / 100) || 0;
  return { ...r, mv_pre: mvPre, mv: Math.round(mvPre * r.hc) || 0 };
}

/** A row only counts as a position once it carries an ISIN. */
export const positions = (rows) => rows.filter((r) => r && r.isin);

/**
 * Applies the user's edits to the CSV rows. Edits are keyed by displayed row
 * index, so typing into an empty line creates a position on that line; its
 * descriptive fields are taken from the previous set when the ISIN is known.
 */
export function applyEdits(base, edits, previous, columns) {
  const format = new Map(columns.map((c) => [c.key, c.format]));
  const known = new Map(previous.map((r) => [r.isin, r]));
  const rows = base.slice();

  for (const [index, patch] of Object.entries(edits)) {
    const i = Number(index);
    const current = rows[i];
    const isin = patch.isin ?? current?.isin ?? "";
    // A new line whose ISIN is already held picks up its descriptive columns.
    const source = current ? null : known.get(isin);
    const inherited = source
      ? Object.fromEntries(columns.filter((c) => !c.editable).map((c) => [c.key, source[c.key]]))
      : {};
    const typed = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        format.get(key) === "amount" ? parseQty(value) : value,
      ])
    );

    rows[i] = derive({ ...(current ?? blankRow(columns)), ...inherited, ...typed });
  }
  return rows;
}

/**
 * Deal sheet = Current − Previous, per ISIN, an absent side counting as zero.
 * Deltas are valued at the Current prices (the Previous ones for an ISIN that
 * only exists there), so the sheet shows what the trade is worth today.
 */
export function dealRows(current, previous) {
  const byIsin = (rows) => {
    const map = new Map();
    for (const r of positions(rows)) {
      const seen = map.get(r.isin);
      if (seen) seen.qty += r.qty;
      else map.set(r.isin, { ...r });
    }
    return map;
  };

  const cur = byIsin(current);
  const prev = byIsin(previous);

  return [...new Set([...cur.keys(), ...prev.keys()])].flatMap((isin) => {
    const c = cur.get(isin);
    const p = prev.get(isin);
    const qty = (c?.qty ?? 0) - (p?.qty ?? 0);
    if (!qty) return [];
    return derive({
      ...(c ?? p),
      qty,
      state: !p ? "add" : !c ? "rem" : "edit",
      label: !p ? "SUB IN" : !c ? "SUB OUT" : "EDIT",
    });
  });
}
