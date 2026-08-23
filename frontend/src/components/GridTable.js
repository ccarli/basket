import { Fragment, useEffect, useRef } from "react";
import { html } from "../html.js";
import { COLUMNS, COL_MAX, COL_MIN, RESET_WIDTHS } from "../grid.js";
import { InventoryPanel } from "./InventoryPanel.js";

export function GridTable({
  tableKey, cells, rows, deltaHeaders, expandable, widths, onResize,
  grid, scrollRef, scrollClass, inventory, expanded = [], onToggleExpand,
}) {
  return html`
    <div className=${`table-scroll ${scrollClass}`} ref=${scrollRef}>
      <table className="grid">
        <colgroup>
          ${widths.map((w, i) => html`<col key=${i} style=${{ width: `${w}px` }} />`)}
        </colgroup>
        <thead>
          <tr>
            ${COLUMNS.map((col, i) => html`
              <th key=${i} className=${col.num ? "num" : undefined}>
                ${deltaHeaders && col.deltaLabel ? col.deltaLabel : col.label}
                ${i >= 2 && html`<${Resizer} col=${i} onResize=${onResize} />`}
              </th>
            `)}
          </tr>
        </thead>
        <tbody>
          ${cells.map((rowCells, r) => {
            const row = rows[r];
            return html`
              <${Fragment} key=${r}>
                <tr className=${`row ${row ? "" : "row-empty "}st-${row?.state ?? "trac"}${expanded.includes(r) ? " expanded" : ""}`}>
                  ${rowCells.map((cell, c) => html`
                    <${Cell}
                      key=${c}
                      tableKey=${tableKey}
                      r=${r}
                      c=${c}
                      cell=${cell}
                      grid=${grid}
                      expander=${c === 1 && expandable && row ? () => onToggleExpand?.(r) : undefined}
                    />
                  `)}
                </tr>
                ${row && expanded.includes(r) && html`
                  <tr className="inv">
                    <td colSpan=${15}>
                      <${InventoryPanel} isin=${row.isin} lines=${inventory?.[row.isin] ?? []} />
                    </td>
                  </tr>
                `}
              <//>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

/** A single <td>: handles selection classes, click/dbl-click and inline editing. */
function Cell({ tableKey, r, c, cell, grid, expander }) {
  const { selectAt, selClass, editing, setEditing, startEdit, commitEdit, cancelEdit } = grid;
  const isEditing = editing?.table === tableKey && editing.r === r && editing.c === c;
  const editable = cell.cls.includes("editable");

  const onMouseDown = (e) => {
    if (c < COL_MIN || c > COL_MAX) return;
    selectAt(tableKey, r, c, e.shiftKey);
  };

  const content = isEditing
    ? html`<${EditInput}
        value=${editing.value}
        selectAll=${editing.selectAll}
        onChange=${(v) => setEditing({ ...editing, value: v })}
        onCommit=${(move, opts) => commitEdit(move, opts)}
        onCancel=${cancelEdit}
      />`
    : html`<div className="cell">
        ${expander
          ? html`<button
              className="exp-btn"
              aria-label="Show inventory"
              onMouseDown=${(e) => e.stopPropagation()}
              onClick=${(e) => { e.stopPropagation(); expander(); }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>`
          : cell.node}
      </div>`;

  return html`
    <td
      data-r=${r}
      data-c=${c}
      className=${`${cell.cls}${selClass(tableKey, r, c)}${isEditing ? " edit" : ""}`}
      onMouseDown=${onMouseDown}
      onDoubleClick=${() => editable && startEdit(tableKey, r, c)}
    >
      ${c === 0 ? html`<span className="state-rail" />` : content}
    </td>
  `;
}

function EditInput({ value, selectAll, onChange, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (selectAll) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return html`
    <input
      ref=${ref}
      value=${value}
      onChange=${(e) => onChange(e.target.value)}
      onBlur=${() => onCommit()}
      onKeyDown=${(e) => {
        // Ctrl/Cmd+Enter fills the whole selection with the typed value, as in Excel.
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCommit(undefined, { bulk: true }); }
        else if (e.key === "Enter") { e.preventDefault(); onCommit([1, 0]); }
        else if (e.key === "Tab") { e.preventDefault(); onCommit([0, e.shiftKey ? -1 : 1]); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
    />
  `;
}

/** Drag to resize a column; double-click restores its default width. */
function Resizer({ col, onResize }) {
  const ref = useRef(null);

  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const th = ref.current.parentElement;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    ref.current.classList.add("dragging");
    document.body.classList.add("col-resizing");

    const onMove = (ev) => onResize(col, Math.max(50, Math.round(startWidth + ev.clientX - startX)));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      ref.current?.classList.remove("dragging");
      document.body.classList.remove("col-resizing");
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return html`
    <div
      ref=${ref}
      className="col-resizer"
      onMouseDown=${onMouseDown}
      onDoubleClick=${(e) => { e.preventDefault(); e.stopPropagation(); onResize(col, RESET_WIDTHS[col] ?? 120); }}
    />
  `;
}
