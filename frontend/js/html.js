import { amount } from "./format.js";

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const isNumber = (value) => typeof value === "number";
const numClass = (value) => (isNumber(value) ? ' class="num"' : "");

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) => ENTITIES[ch]);

// One <table> whose headers are the record keys, verbatim.
export function recordsTable(records, className = "") {
  const names = Object.keys(records[0] ?? {});
  const header = (name) => `<th${numClass(records[0][name])}>${escapeHtml(name)}</th>`;
  const cell = (value) => `<td${numClass(value)}>${escapeHtml(isNumber(value) ? amount(value) : value)}</td>`;
  const line = (record) => `<tr>${names.map((name) => cell(record[name])).join("")}</tr>`;
  return `<table class="${className}">
    <thead><tr>${names.map(header).join("")}</tr></thead>
    <tbody>${records.map(line).join("")}</tbody>
  </table>`;
}
