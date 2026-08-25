# Basket TRS — secondary event

Web replica of `examples/app_google_design.html`: a Python/pandas backend serving
the CSV data as JSON, and a React frontend that runs straight from source.

There is **no build step and no `node_modules`**. `index.html` declares an
[import map](frontend/index.html) pointing at the [esm.sh](https://esm.sh) CDN,
the browser loads React and the two Radix primitives from there, and `htm`
replaces JSX with tagged template literals (`html\`<div>…\``) — nearly the same
syntax, compiled at runtime instead of at build time. The app therefore needs a
network connection to start, as it already did for the Google fonts. Styling is
`frontend/style.css`, the mockup's own stylesheet, so there is no CSS framework
to configure either.

## Data

All data lives in `backend/data/` as CSV and is loaded into pandas DataFrames:

| File                          | Used by                                             |
|-------------------------------|-----------------------------------------------------|
| `data_<mode>_<basket>.csv`    | the "Basket components" table — one file per basket and per mode (`current` / `previous`), e.g. `data_current_nordic_2029.csv`. `MV pre HC = qty × dirty_price / 100` and `Market value = MV pre HC × hc`; the two modes are marked at different dirty prices |
| `static.csv`                  | the "basket details" popup, keyed by a `basket` column |
| `inventory.csv`               | the per-ISIN sub-table shown when a row is expanded  |

**The CSV header defines the grid.** `/api/basket` derives the column list from
the data file: adding a column to the CSVs is enough for it to appear, labelled
after its header and formatted from its dtype (whole numbers as amounts,
decimals as prices, the rest as text). Only special cases need an entry in the
small maps at the top of `backend/app.py` — `COLUMN_LABELS`, `DELTA_LABELS`,
`COLUMN_FORMATS`, `EDITABLE_COLUMNS`, `HIDDEN_COLUMNS`.

Column widths follow: each one is measured against its own header and content
(`computeWidths` in `frontend/src/grid.js`) and the row is scaled to the width
available, so every column stays visible without horizontal scrolling. Numeric
columns never shrink below their content — a half-shown number would be
misleading — while text columns ellipsise. Dragging a column pins its width;
double-clicking its handle hands it back to the automatic sizing.

The basket selected in the toolbar is sent to the backend
(`GET /api/basket?basket=NORDIC%202029`), which reads that basket's two files
and returns its rows, statics and the inventory of its ISINs. Basket names map
to file names by lowercasing and replacing spaces with underscores (`slug()` in
`backend/app.py`).

## Run

The backend serves both the API and the frontend, so one command is enough:

```bash
pip3 install -r backend/requirements.txt   # or in a venv, if python3-venv is available
python3 -m uvicorn app:app --reload --app-dir backend
```

Then open <http://localhost:8000>. Editing any file under `frontend/` only
requires a browser refresh.

## Layout

```
backend/
  app.py               FastAPI: /api/basket, /api/checks, and the static frontend
  data/*.csv           the three data files
frontend/
  index.html           import map (all dependencies) + page shell
  style.css            design tokens and component styles, ported from the mockup
  src/app.js           page layout, mode/basket/theme state, totals
  src/grid.js          cell model and automatic column widths
  src/measure.js       text measurement against the real fonts
  src/model.js         edits applied to the rows, and the deal sheet derived from them
  src/use-grid.js      Excel-like selection, keyboard nav, editing, copy/paste
  src/html.js          the htm/React binding used in place of JSX
  src/components/      Toolbar, GridTable, InventoryPanel, TotalsBar, Actions,
                       StaticsDialog, Calendar, ui/ (shadcn-style primitives)
```

## Features

Mode toggle (current/previous), basket selector, basket details popup, dark mode
(persisted), resizable columns (double-click a resizer to reset), row expansion
showing ISIN inventory, Excel-like cell range selection, keyboard navigation,
in-cell editing, TSV copy/paste, range clearing, live totals, and server-side checks.

- **Live model** — editing a quantity recomputes MV pre HC, Market value, the
  totals and the deal sheet. Typing into one of the empty lines creates a
  position; clearing a line removes it.
- **Selection total** — selecting cells in Quantity, MV pre HC or Market value
  adds a "Selection" tile to the totals, between Lines and Total quantity, with
  the sum of the selected cells and how many they are. `COLUMN_SELECTION` in
  `backend/app.py` lists the column labels that take part.
- **Bulk edit** — select a range, type a value and press **Ctrl/Cmd+Enter** to
  apply it to every editable cell of the selection, as in Excel.
- **Amount input** — quantities and notionals accept `125k`, `140M`, `1.5m` and
  separated forms like `1,500,000`; everything is parsed by `parseQty()` in
  `frontend/src/model.js` and rounded to the unit.
- **Deal sheet** — computed as Current − Previous per ISIN (a missing side counts
  as zero) and valued at the Current prices, so it follows every edit. It lives in
  a drawer, closed on load: the centred tab at the bottom slides it up over the
  grid, which lets the main table use the full height the rest of the time.
- **Dates** — changing TD moves COB to the previous business day and VD to the
  next one (weekends skipped, no holiday calendar).
- **Notionals** — old notional is the previous basket's total MV (read-only), the
  new notional defaults to it, and the unwind amount is the difference: editing
  either one recomputes the other. They are indicators only — they do not rescale
  the positions.
- **Rows** — `MAIN_TABLE_ROWS` / `DEAL_TABLE_ROWS` in `backend/app.py` set how
  many lines each grid shows.
