/** Number formatting helpers — mirrors the reference app. */

export const fmtInt = (n) => n.toLocaleString("en-US");

export const fmtNum = (n, dp = 2) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Minus sign is U+2212, as in the reference. */
export function fmtQty(n) {
  return { sign: n < 0 ? "−" : n > 0 ? "+" : "", abs: Math.abs(n).toLocaleString("en-US"), signed: n !== 0 };
}

/** Amount with thousands separators, using the app's minus sign: "−1,250,000". */
export const fmtAmount = (n) => (n < 0 ? `−${fmtInt(-n)}` : fmtInt(n));

/** Haircut ratio as a percentage: 0.95 -> "95%", 0.925 -> "92.5%". */
export const fmtPct = (ratio) =>
  ratio === null || ratio === undefined || Number.isNaN(ratio)
    ? "—"
    : `${+(ratio * 100).toFixed(2)}%`;

export function signedInt(n) {
  if (n === 0) return "0";
  const q = fmtQty(n);
  return `${q.sign}${q.abs}`;
}
