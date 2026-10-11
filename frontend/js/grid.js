import { matcher } from "./filter.js";
import { cellText, isNumeric, tone } from "./format.js";
import { escapeHtml, recordsTable } from "./html.js";
import { inventoryLines, railClass } from "./model.js";

const MOVES = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], PageUp: [-10, 0], PageDown: [10, 0],
};
const MIN_COLUMN_WIDTH = 50;
const FUNNEL = `<button class="filter-btn" title="Filter" aria-label="Show or hide the column filters"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg></button>`;
const EXPANDER = `<button class="exp-btn" aria-label="Show inventory"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>`;

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const span = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

let active = null; // the grid holding the selection: only one at a time

document.addEventListener("keydown", (e) => {
  if (active?.selection && !e.target.matches("input, select, textarea")) active.onKey(e);
});
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest("table.grid tbody")) active?.clearSelection();
});

// Excel-like table: range selection, keyboard navigation, in-cell editing,
// copy/paste, column resizing and filtering. It owns no data: edits go out
// through onEdit([{ row, name, value }]) and come back through update().
// A row is always known by its index in `rows`, filtered or not; selection,
// keyboard moves, copy, paste and fill only ever touch the `visible` ones.
export class Grid {
  columns = [];
  rows = [];
  rowCount = 0;
  filtering = false; // whether the filter boxes are on display
  filters = {}; // { columnName: what the user typed under its header }
  visible = []; // indexes of the rows on display, in order
  inventory = {};
  editable = false;
  selection = null; // { anchor: { r, c }, focus: { r, c } }
  editing = null; // { r, c, input }
  expanded = new Set();

  constructor(container, { signed = false, expandable = false, onEdit, onSelect, onResize }) {
    Object.assign(this, { container, signed, expandable, onEdit, onSelect, onResize });
    container.innerHTML = `<table class="grid"><colgroup></colgroup><thead></thead><tbody></tbody></table>`;
    this.table = container.firstChild;
    [this.colgroup, this.head, this.body] = this.table.children;

    this.body.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.body.addEventListener("dblclick", (e) => this.cellAt(e, (r, c) => this.edit(r, c)));
    this.body.addEventListener("keydown", (e) => this.onEditKey(e));
    this.body.addEventListener("focusout", () => this.commit());
    this.head.addEventListener("input", (e) => this.onFilter(e.target));
    this.head.addEventListener("click", (e) => e.target.closest(".filter-btn") && this.toggleFilters());
    this.head.addEventListener("mousedown", (e) => this.onResizeStart(e));
    this.head.addEventListener("dblclick", (e) => this.resizerAt(e, (name) => this.onResize(name, null)));
  }

  update({ columns, rows, minRows, inventory = {}, editable = false }) {
    const newColumns = columns !== this.columns;
    Object.assign(this, { columns, rows, inventory, editable, rowCount: Math.max(minRows, rows.length) });
    if (newColumns) this.renderHead();
    this.render();
  }

  reset() {
    this.expanded.clear();
    this.clearSelection();
  }

  setWidths(widths) {
    this.colgroup.innerHTML = widths.map((w) => `<col style="width:${w}px">`).join("");
  }

  // ---- rendering

  // Only when the columns change: rebuilding the header would empty its filter boxes.
  renderHead() {
    this.filters = {};
    this.head.innerHTML = `<tr><th></th><th>${FUNNEL}</th>${this.columns.map((column, c) => `
      <th class="${isNumeric(column) ? "num" : ""}">
        <div class="name">${escapeHtml(column.name)}</div>
        <input type="search" placeholder=" " data-c="${c}" aria-label="Filter ${escapeHtml(column.name)}">
        <div class="col-resizer" data-c="${c}"></div>
      </th>`).join("")}</tr>`;
  }

  render() {
    this.editing = null;
    this.visible = this.visibleRows();
    if (this.selection && !this.selectionIsVisible) this.selection = null;
    this.body.innerHTML = this.visible.map((r) => this.rowHtml(r)).join("");
    this.paintSelection();
  }

  // ---- filtering: without a filter every line shows, the empty ones included

  visibleRows() {
    const tests = Object.entries(this.filters)
      .filter(([, filter]) => filter.trim())
      .map(([name, filter]) => [this.columns.findIndex((column) => column.name === name), matcher(filter)]);
    const everyLine = span(0, this.rowCount - 1);
    if (!tests.length) return everyLine;
    return everyLine.filter((r) => this.rows[r] && tests.every(([c, matches]) => matches(this.text(r, c))));
  }

  // The funnel shows the filter boxes; hiding them again drops the filters.
  toggleFilters() {
    this.filtering = !this.filtering;
    this.table.classList.toggle("filtering", this.filtering);
    if (this.filtering) return this.head.querySelector("input").focus();
    this.renderHead();
    this.render();
    this.onSelect();
  }

  onFilter(input) {
    this.filters[this.columns[input.dataset.c].name] = input.value;
    this.render();
    this.onSelect();
  }

  // The visible row `steps` lines away from row r, stopping at the first and last ones.
  rowAfter(r, steps) {
    return this.visible[clamp(this.visible.indexOf(r) + steps, 0, this.visible.length - 1)];
  }

  rowHtml(r) {
    const row = this.rows[r];
    const open = row && this.expanded.has(r);
    const cells = this.columns.map((column, c) => {
      const value = row?.[column.name];
      const classes = [column.format === "mono" && "mono", isNumeric(column) && "num", this.canEdit(c) && "editable"];
      const colour = row && column.format === "amount" && (this.signed || value < 0) ? tone(value) : "";
      return `<td data-c="${c}" class="${classes.filter(Boolean).join(" ")}"><div class="cell ${colour}">${escapeHtml(this.text(r, c))}</div></td>`;
    });
    return `<tr data-r="${r}" class="row ${row ? railClass(row) : ""}${open ? " expanded" : ""}">
        <td class="state"><span class="state-rail"></span></td>
        <td class="expander"><div class="cell">${row && this.expandable ? EXPANDER : ""}</div></td>
        ${cells.join("")}
      </tr>${open ? this.inventoryHtml(inventoryLines(row, this.inventory)) : ""}`;
  }

  inventoryHtml(lines) {
    return `<tr class="inv"><td colspan="${this.columns.length + 2}"><div class="inv-wrap">
      <div class="inv-head"><span class="t">inventory</span><span class="count">${lines.length} lines</span></div>
      ${recordsTable(lines, "inv")}
    </div></td></tr>`;
  }

  text(r, c) {
    const row = this.rows[r];
    const { name, format } = this.columns[c];
    return row ? cellText(row[name], format, this.signed) : "";
  }

  columnTexts(c) {
    return span(0, this.rowCount - 1).map((r) => this.text(r, c));
  }

  td(r, c) {
    return this.body.querySelector(`tr[data-r="${r}"] > td[data-c="${c}"]`);
  }

  cellAt(event, then) {
    const td = event.target.closest("td[data-c]");
    if (td) then(Number(td.parentElement.dataset.r), Number(td.dataset.c));
  }

  // ---- selection

  get range() {
    if (!this.selection) return null;
    const { anchor, focus } = this.selection;
    return {
      r1: Math.min(anchor.r, focus.r), r2: Math.max(anchor.r, focus.r),
      c1: Math.min(anchor.c, focus.c), c2: Math.max(anchor.c, focus.c),
    };
  }

  get selectionIsVisible() {
    const { anchor, focus } = this.selection;
    return this.visible.includes(anchor.r) && this.visible.includes(focus.r);
  }

  get rangeRows() {
    const { r1, r2 } = this.range;
    return this.visible.filter((r) => r >= r1 && r <= r2);
  }

  get rangeColumns() {
    const { c1, c2 } = this.range;
    return span(c1, c2);
  }

  // What the selection covers, for the host to sum up.
  get selected() {
    if (!this.selection) return null;
    return { rows: this.rangeRows.map((r) => this.rows[r]), columns: this.rangeColumns.map((c) => this.columns[c]) };
  }

  // r must be a visible row.
  select(r, c, extend = false) {
    if (active !== this) active?.clearSelection();
    active = this;
    const focus = { r, c: clamp(c, 0, this.columns.length - 1) };
    this.selection = { anchor: extend && this.selection ? this.selection.anchor : focus, focus };
    this.paintSelection();
    this.scrollIntoView(focus);
    this.onSelect();
  }

  clearSelection() {
    if (!this.selection) return;
    this.selection = null;
    this.paintSelection();
    this.onSelect();
  }

  paintSelection() {
    const range = this.range;
    const focus = this.selection?.focus;
    for (const td of this.body.querySelectorAll("td[data-c]")) {
      const r = Number(td.parentElement.dataset.r);
      const c = Number(td.dataset.c);
      const inside = !!range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
      td.classList.toggle("cell-sel", inside);
      td.classList.toggle("cell-focus", inside && r === focus.r && c === focus.c);
    }
  }

  scrollIntoView({ r, c }) {
    const cell = this.td(r, c).getBoundingClientRect();
    const view = this.container.getBoundingClientRect();
    const top = view.top + this.head.offsetHeight;
    if (cell.top < top) this.container.scrollTop -= top - cell.top;
    else if (cell.bottom > view.bottom) this.container.scrollTop += cell.bottom - view.bottom;
    if (cell.left < view.left) this.container.scrollLeft -= view.left - cell.left;
    else if (cell.right > view.right) this.container.scrollLeft += cell.right - view.right;
  }

  // ---- editing

  canEdit(c) {
    return this.editable && this.columns[c].editable;
  }

  // cells: [{ r, c, value }]; the read-only ones are skipped
  write(cells) {
    const edits = cells
      .filter(({ c }) => this.canEdit(c))
      .map(({ r, c, value }) => ({ row: r, name: this.columns[c].name, value }));
    if (edits.length) this.onEdit(edits);
  }

  fillSelection(value) {
    this.write(this.rangeRows.flatMap((r) => this.rangeColumns.map((c) => ({ r, c, value }))));
  }

  edit(r, c, typed) {
    if (!this.canEdit(c)) return;
    const td = this.td(r, c);
    td.classList.add("edit");
    td.innerHTML = "<input>";
    const input = td.firstChild;
    input.value = typed ?? this.text(r, c);
    this.editing = { r, c, input };
    input.focus();
    if (typed === undefined) input.select();
  }

  // bulk: Ctrl+Enter fills the whole selection with the typed value, as in Excel.
  commit({ move, bulk = false } = {}) {
    if (!this.editing) return;
    const { r, c, input } = this.editing;
    this.editing = null;
    if (bulk) this.fillSelection(input.value);
    else this.write([{ r, c, value: input.value }]);
    if (move && this.visible.length) this.select(this.rowAfter(r, move[0]), c + move[1]);
  }

  onEditKey(e) {
    if (e.key === "Enter") this.commit(e.ctrlKey || e.metaKey ? { bulk: true } : { move: [1, 0] });
    else if (e.key === "Tab") this.commit({ move: [0, e.shiftKey ? -1 : 1] });
    else if (e.key === "Escape") this.render();
    else return;
    e.preventDefault();
  }

  // ---- mouse, keyboard, clipboard

  onMouseDown(e) {
    if (e.target.closest("input")) return;
    if (e.target.closest(".exp-btn")) return this.toggleInventory(Number(e.target.closest("tr").dataset.r));
    this.cellAt(e, (r, c) => this.select(r, c, e.shiftKey));
  }

  toggleInventory(r) {
    this.expanded.has(r) ? this.expanded.delete(r) : this.expanded.add(r);
    this.render();
  }

  onKey(e) {
    const { r, c } = this.selection.focus;
    const shortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase();
    if (MOVES[e.key]) this.select(this.rowAfter(r, MOVES[e.key][0]), c + MOVES[e.key][1], e.shiftKey);
    else if (e.key === "Tab") this.select(r, c + (e.shiftKey ? -1 : 1));
    else if (e.key === "Home") this.select(r, 0, e.shiftKey);
    else if (e.key === "End") this.select(r, this.columns.length - 1, e.shiftKey);
    else if (shortcut === "c") this.copy();
    else if (shortcut === "v") this.paste();
    else if (e.key === "Enter" || e.key === "F2") this.edit(r, c);
    else if (e.key === "Delete" || e.key === "Backspace") this.fillSelection("");
    else if (e.key.length === 1 && !shortcut && !e.altKey) this.edit(r, c, e.key);
    else return;
    e.preventDefault();
  }

  copy() {
    const lines = this.rangeRows.map((r) => this.rangeColumns.map((c) => this.text(r, c)).join("\t"));
    navigator.clipboard.writeText(lines.join("\n")).catch(console.warn);
  }

  async paste() {
    const { r, c } = this.selection.focus;
    const text = await navigator.clipboard.readText().catch(() => "");
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n").map((line) => line.split("\t"));
    if (!text.trim()) return;
    const targets = this.visible.slice(this.visible.indexOf(r), this.visible.indexOf(r) + lines.length);
    const cells = targets.flatMap((row, i) => lines[i].map((value, dc) => ({ r: row, c: c + dc, value })));
    this.write(cells.filter((cell) => cell.c < this.columns.length));
    if (!this.visible.includes(r)) return;
    this.select(r, c);
    this.select(this.rowAfter(r, lines.length - 1), c + Math.max(...lines.map((line) => line.length)) - 1, true);
  }

  // ---- column resizing: dragging pins a width, double-click releases it

  resizerAt(event, then) {
    const handle = event.target.closest(".col-resizer");
    if (handle) then(this.columns[handle.dataset.c].name, handle);
  }

  onResizeStart(e) {
    this.resizerAt(e, (name, handle) => {
      e.preventDefault();
      const offset = handle.parentElement.getBoundingClientRect().width - e.clientX;
      const drag = (move) => this.onResize(name, Math.max(MIN_COLUMN_WIDTH, Math.round(offset + move.clientX)));
      const mark = (on) => {
        handle.classList.toggle("dragging", on);
        document.body.classList.toggle("col-resizing", on);
      };
      mark(true);
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", () => {
        document.removeEventListener("mousemove", drag);
        mark(false);
      }, { once: true });
    });
  }
}
