import { html } from "./html.js";
import { fmtInt, fmtNum, fmtPct, fmtQty } from "./format.js";

/** A rendered cell carries its <td> classes, its plain text (copy) and its node. */

export const COL_MIN = 2; // ISIN
export const COL_MAX = 14; // Market value

export const COLUMNS = [
  { label: "", num: false },
  { label: "", num: false },
  { label: "ISIN", num: false },
  { label: "Quantity", deltaLabel: "Δ Quantity", num: true },
  { label: "Basket", num: false },
  { label: "Name", num: false },
  { label: "Issuer", num: false },
  { label: "Country", num: false },
  { label: "Instrument type", num: false },
  { label: "Rating", num: false },
  { label: "Type", num: false },
  { label: "Dirty Price", num: true },
  { label: "HC", num: true },
  { label: "MV pre HC", deltaLabel: "Δ MV pre HC", num: true },
  { label: "Market value", deltaLabel: "Δ Market value", num: true },
];

export const DEFAULT_WIDTHS = [3, 32, 120, 140, 110, 240, 200, 80, 130, 70, 120, 100, 70, 140, 140];
/** Widths restored by double-clicking a column resizer (as in the reference app). */
export const RESET_WIDTHS = [3, 32, 120, 140, 110, 340, 260, 80, 130, 70, 120, 100, 70, 140, 140];

function signed(n, forceSign) {
  const q = fmtQty(n);
  if (!q.signed) return { text: q.abs, node: q.abs };
  const s = forceSign ? q.sign : "";
  return {
    text: s + q.abs,
    node: html`<span className=${`signed ${n < 0 ? "neg" : "pos"}`}><span className="sign">${s}</span>${q.abs}</span>`,
  };
}

const plain = (text) => ({ text, node: text });

/** Builds the 15 cells of a data row, mirroring the reference `rowHtml`. */
export function rowCells(r, editable, showQtyAsDelta) {
  const editCls = editable ? " editable" : "";
  const qty =
    showQtyAsDelta || r.qty < 0 || r.state === "add" ? signed(r.qty, true) : plain(fmtInt(r.qty));
  const forceSign = r.state !== "trac";

  return [
    ["state", plain("")],
    ["expander", plain("")],
    [`mono${editCls}`, plain(r.isin)],
    [`num${editCls}`, qty],
    [editable ? "editable" : "", plain(r.label)],
    ["", plain(r.name)],
    ["", plain(r.issuer)],
    ["", plain(r.country ?? "")],
    ["", plain(r.instr_type ?? "")],
    ["", plain(r.rating)],
    ["", plain(r.type)],
    ["num", plain(fmtNum(r.dirty_price))],
    ["num", plain(fmtPct(r.hc))],
    ["num", signed(r.mv_pre, forceSign)],
    ["num", signed(r.mv, forceSign)],
  ].map(([cls, v]) => ({ cls, text: v.text, node: v.node }));
}

/** Filler row: same shape, no content. */
export function emptyCells(editable) {
  return rowCells(
    { state: "trac", isin: "", qty: 0, label: "", name: "", issuer: "", country: "",
      instr_type: "", rating: "", type: "", ccy: "EUR", dirty_price: NaN, hc: NaN, mv_pre: 0, mv: 0 },
    editable,
    false
  ).map((c) => ({ ...c, text: "", node: "" }));
}
