const MINUS = "−";
const missing = (n) => n === null || n === undefined || Number.isNaN(n);

export const amount = (n, plus = false) =>
  `${n < 0 ? MINUS : plus && n > 0 ? "+" : ""}${Math.abs(n).toLocaleString("en-US")}`;

export const price = (n) =>
  missing(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rate = (n) => (missing(n) ? "—" : n.toFixed(4));

export const pct = (ratio) => (missing(ratio) ? "—" : `${+(ratio * 100).toFixed(2)}%`);

export const tone = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

// "1,500,000", "−100 000", "125k", "1.5M" -> number; unparsable -> NaN
export function parseNumber(text) {
  const [, digits, unit] = String(text).replace(/[\s,]/g, "").replace(MINUS, "-").match(/^(.*?)([km]?)$/i);
  return Number(digits) * ({ k: 1e3, m: 1e6 }[unit.toLowerCase()] ?? 1);
}

// The same, as a whole number; unparsable -> 0
export function parseAmount(text) {
  const n = Math.round(parseNumber(text));
  return Number.isFinite(n) ? n : 0;
}

const FORMATTERS = { amount: (n, plus) => amount(n ?? 0, plus), price, rate, pct };

export const isNumeric = (column) => column.format in FORMATTERS;

export const cellText = (value, format, plus = false) =>
  FORMATTERS[format]?.(value, plus) ?? String(value ?? "");
