import { getBasket } from "./api.js";
import { initCalendar } from "./calendar.js";
import { amount, tone } from "./format.js";
import { Grid } from "./grid.js";
import { MARKET_VALUE, NOMINAL, applyEdits, dealRows, positions, selectionSum, totalMarketValue, totalNominal } from "./model.js";
import { initToolbar, showBasket, showNotional } from "./toolbar.js";
import { columnWidths } from "./widths.js";

const $ = (selector) => document.querySelector(selector);

const state = {
  data: null, // the /api/basket payload
  mode: "current", // or "previous"
  edits: {}, // { rowIndex: { columnName: typedText } } on the current set
  newNotional: null, // null follows the old notional
  pinnedWidths: {}, // { columnName: px } for the columns resized by hand
  available: 0, // px the grids can spread their columns over
  view: null, // what the last render() derived from the above
};

const mainGrid = new Grid($("#main-grid"), { expandable: true, onEdit, onResize, onSelect: renderTotals });
const dealGrid = new Grid($("#deal-grid"), { signed: true, onEdit, onResize, onSelect: renderTotals });

function render() {
  const { data, mode, edits } = state;
  const current = applyEdits(data.current, edits, data.previous, data.columns);
  const deal = dealRows(current, data.previous);
  const rows = mode === "current" ? current : data.previous;
  state.view = {
    current, rows, deal,
    currentMv: totalMarketValue(positions(current)),
    previousMv: totalMarketValue(data.previous),
  };

  mainGrid.update({ columns: data.columns, rows, minRows: data.rows.main, inventory: data.inventory, editable: mode === "current" });
  dealGrid.update({ columns: data.columns, rows: deal, minRows: data.rows.deal });
  layout();
  renderTotals();
  renderNotional();
}

// Both grids share the widths measured on the main one, so their columns line up.
function layout() {
  if (!state.data) return;
  const widths = columnWidths(state.data.columns, (c) => mainGrid.columnTexts(c), state.available, state.pinnedWidths);
  mainGrid.setWidths(widths);
  dealGrid.setWidths(widths);
}

const tile = (name, value, { hint = "", className = "" } = {}) =>
  `<div class="cell"><span class="k">${name}<span class="ccy">${hint}</span></span><span class="v ${className}">${value}</span></div>`;

function selectionTile(grid) {
  const picked = selectionSum(grid.selected);
  return picked
    ? tile("Selection", amount(Math.round(picked.total)), { hint: `${picked.cells} cell${picked.cells > 1 ? "s" : ""}`, className: "sel" })
    : "";
}

function renderTotals() {
  const { rows, deal, currentMv, previousMv } = state.view;
  const shown = positions(rows);
  const dealNominal = totalNominal(deal);
  const dealMv = totalMarketValue(deal);

  $("#main-totals").innerHTML =
    tile("Lines", shown.length) +
    selectionTile(mainGrid) +
    tile(NOMINAL, amount(totalNominal(shown))) +
    tile(`${MARKET_VALUE} — current`, amount(currentMv)) +
    tile(`${MARKET_VALUE} — previous`, amount(previousMv));

  $("#deal-totals").innerHTML =
    tile("Lines", deal.length) +
    selectionTile(dealGrid) +
    tile(`Δ ${NOMINAL}`, amount(dealNominal, true), { className: tone(dealNominal) }) +
    tile(`Δ ${MARKET_VALUE}`, amount(dealMv, true), { className: tone(dealMv) });
}

// Editing the new notional or the unwind amount recomputes the other one.
function renderNotional() {
  const old = state.view.previousMv;
  const next = state.newNotional ?? old;
  showNotional({ old, new: next, unwind: old - next });
}

// What the backend functions run on: the current positions with the edits applied.
function editedBasket() {
  const { current, previousMv } = state.view;
  return {
    basket: state.data.basket,
    positions: positions(current),
    unwind: previousMv - (state.newNotional ?? previousMv),
  };
}

function onNotional(field, value) {
  state.newNotional = field === "new" ? value : state.view.previousMv - value;
  renderNotional();
}

function onEdit(cells) {
  for (const { row, name, value } of cells) state.edits[row] = { ...state.edits[row], [name]: value };
  render();
}

function onResize(name, width) {
  if (width === null) delete state.pinnedWidths[name];
  else state.pinnedWidths[name] = width;
  layout();
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("on", button.dataset.mode === mode));
  mainGrid.reset();
  render();
}

async function loadBasket(basket) {
  $(".main").classList.add("loading");
  try {
    state.data = await getBasket(basket);
  } catch (error) {
    alert(error.message);
    if (state.data) showBasket(state.data);
    return;
  } finally {
    $(".main").classList.remove("loading");
  }
  state.edits = {};
  state.newNotional = null;
  mainGrid.reset();
  dealGrid.reset();
  showBasket(state.data);
  render();
}

function toggleDealSheet() {
  const open = $("#drawer").classList.toggle("open");
  $("#drawer-handle").setAttribute("aria-expanded", open);
  if (!open) dealGrid.clearSelection();
}

initToolbar({ onBasket: loadBasket, onNotional, editedBasket });
initCalendar();
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
$("#drawer-handle").addEventListener("click", toggleDealSheet);
new ResizeObserver(([entry]) => {
  state.available = entry.contentRect.width;
  layout();
}).observe($("#main-grid"));
document.fonts.ready.then(layout);
loadBasket();
