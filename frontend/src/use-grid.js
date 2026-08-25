import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { COL_MIN } from "./grid.js";

/**
 * Excel-like grid behaviour shared by both tables: range selection, keyboard
 * navigation, in-cell editing, clipboard copy/paste and range clearing.
 *
 * The hook owns no data: every edit — typing, paste, Delete, Ctrl+Enter — is
 * handed to `onEdit` as [{ table, r, c, value }] and the host applies it to its
 * model. Each table registers a descriptor:
 *   { rowCount, isEditable(r, c), baseText(r, c), scroll() }
 * `scroll` is a getter because the ref is not attached when it is built.
 */
export function useGrid({ tables, onEdit, colMax }) {
  const info = useRef(tables);
  info.current = tables;
  const emit = useRef(onEdit);
  emit.current = onEdit;
  // Read through refs: both change with the data, and the callbacks below
  // must not capture a stale value.
  const lastCol = useRef(colMax);
  lastCol.current = colMax;

  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);

  const textAt = useCallback((t, r, c) => info.current[t].baseText(r, c), []);

  const ensureVisible = useCallback((t, r, c) => {
    const scroll = info.current[t].scroll();
    const td = scroll?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    if (!scroll || !td) return;
    const cr = td.getBoundingClientRect();
    const sr = scroll.getBoundingClientRect();
    const headerH = 32; // approximate sticky header height
    if (cr.top < sr.top + headerH) scroll.scrollTop -= sr.top + headerH - cr.top;
    else if (cr.bottom > sr.bottom) scroll.scrollTop += cr.bottom - sr.bottom;
    if (cr.left < sr.left) scroll.scrollLeft -= sr.left - cr.left;
    else if (cr.right > sr.right) scroll.scrollLeft += cr.right - sr.right;
  }, []);

  const selectAt = useCallback(
    (table, r, c, extend = false) => {
      const max = info.current[table].rowCount - 1;
      const pos = { r: Math.max(0, Math.min(max, r)), c: Math.max(COL_MIN, Math.min(lastCol.current, c)) };
      setSel((s) =>
        extend && s && s.table === table ? { ...s, focus: pos } : { table, anchor: pos, focus: pos }
      );
    },
    []
  );

  /** Keep the focused cell in view, once the selection has been laid out. */
  useLayoutEffect(() => {
    if (sel) ensureVisible(sel.table, sel.focus.r, sel.focus.c);
  }, [sel, ensureVisible]);

  const bounds = useCallback((s) => ({
    r1: Math.min(s.anchor.r, s.focus.r), r2: Math.max(s.anchor.r, s.focus.r),
    c1: Math.min(s.anchor.c, s.focus.c), c2: Math.max(s.anchor.c, s.focus.c),
  }), []);

  /** Class names contributed by the selection for one cell. */
  const selClass = useCallback(
    (table, r, c) => {
      if (!sel || sel.table !== table) return "";
      const b = bounds(sel);
      if (r < b.r1 || r > b.r2 || c < b.c1 || c > b.c2) return "";
      return sel.focus.r === r && sel.focus.c === c ? " cell-sel cell-focus" : " cell-sel";
    },
    [sel, bounds]
  );

  const startEdit = useCallback((table, r, c, initial) => {
    if (!info.current[table].isEditable(r, c)) return;
    setEditing({
      table, r, c,
      value: initial ?? textAt(table, r, c),
      selectAll: initial === undefined,
    });
  }, [textAt]);

  /** `bulk` is Excel's Ctrl+Enter: the value fills the whole selection. */
  const commitEdit = useCallback((move, { bulk = false } = {}) => {
    if (!editing) return;
    const { table, r, c, value } = editing;
    const entries = [];
    if (bulk && sel && sel.table === table) {
      const b = bounds(sel);
      for (let rr = b.r1; rr <= b.r2; rr++)
        for (let cc = b.c1; cc <= b.c2; cc++)
          if (info.current[table].isEditable(rr, cc)) entries.push({ table, r: rr, c: cc, value });
    } else {
      entries.push({ table, r, c, value });
    }
    emit.current(entries);
    setEditing(null);
    if (move) selectAt(table, r + move[0], c + move[1], false);
  }, [editing, sel, bounds, selectAt]);

  const copySelection = useCallback(async () => {
    if (!sel) return;
    const b = bounds(sel);
    const lines = [];
    for (let r = b.r1; r <= b.r2; r++) {
      const parts = [];
      for (let c = b.c1; c <= b.c2; c++) parts.push(textAt(sel.table, r, c));
      lines.push(parts.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch (err) {
      console.warn("Clipboard write failed", err);
    }
  }, [sel, bounds, textAt]);

  const pasteClipboard = useCallback(async () => {
    if (!sel) return;
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      console.warn("Clipboard read failed", err);
      return;
    }
    const grid = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.split("\t"));
    while (grid.length && grid[grid.length - 1].every((x) => x === "")) grid.pop();
    if (!grid.length) return;

    const t = info.current[sel.table];
    const { r: startR, c: startC } = sel.focus;
    const entries = [];
    let lastR = startR, lastC = startC;
    grid.forEach((line, dr) => {
      const r = startR + dr;
      if (r >= t.rowCount) return;
      line.forEach((v, dc) => {
        const c = startC + dc;
        if (c > lastCol.current || !t.isEditable(r, c)) return;
        entries.push({ table: sel.table, r, c, value: v });
        lastR = Math.max(lastR, r);
        lastC = Math.max(lastC, c);
      });
    });
    emit.current(entries);
    setSel({ table: sel.table, anchor: { r: startR, c: startC }, focus: { r: lastR, c: lastC } });
  }, [sel]);

  const clearRange = useCallback(() => {
    if (!sel) return;
    const b = bounds(sel);
    const t = info.current[sel.table];
    const entries = [];
    for (let r = b.r1; r <= b.r2; r++)
      for (let c = b.c1; c <= b.c2; c++) if (t.isEditable(r, c)) entries.push({ table: sel.table, r, c, value: "" });
    emit.current(entries);
  }, [sel, bounds]);

  /* ---- Global keyboard navigation ---- */
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      if (target.matches("input, select, textarea, [contenteditable]")) return;
      if (!sel) return;
      const { table, focus } = sel;

      const arrows = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        PageUp: [-10, 0], PageDown: [10, 0],
      };
      if (arrows[e.key]) {
        e.preventDefault();
        const [dr, dc] = arrows[e.key];
        return selectAt(table, focus.r + dr, focus.c + dc, e.shiftKey);
      }
      if (e.key === "Tab") {
        e.preventDefault();
        return selectAt(table, focus.r, focus.c + (e.shiftKey ? -1 : 1), false);
      }
      if (e.key === "Home") {
        e.preventDefault();
        return selectAt(table, focus.r, COL_MIN, e.shiftKey);
      }
      if (e.key === "End") {
        e.preventDefault();
        return selectAt(table, focus.r, lastCol.current, e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        return void copySelection();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        return void pasteClipboard();
      }
      if (e.key === "Enter" || e.key === "F2") {
        if (info.current[table].isEditable(focus.r, focus.c)) {
          e.preventDefault();
          startEdit(table, focus.r, focus.c);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return clearRange();
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (info.current[table].isEditable(focus.r, focus.c)) {
          e.preventDefault();
          startEdit(table, focus.r, focus.c, e.key);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sel, selectAt, startEdit, clearRange, copySelection, pasteClipboard]);

  /* ---- Clicking outside the tables clears the selection ---- */
  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (t.closest("table.grid tbody") || t.closest(".exp-btn")) return;
      setSel(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return {
    sel, setSel, selectAt, selClass,
    editing, setEditing, startEdit, commitEdit, cancelEdit: () => setEditing(null),
  };
}
