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
  src/grid.js          column definitions and cell model (text + node per cell)
  src/model.js         edits applied to the rows, and the deal sheet derived from them
  src/use-grid.js      Excel-like selection, keyboard nav, editing, copy/paste
  src/html.js          the htm/React binding used in place of JSX
  src/components/      Toolbar, GridTable, InventoryPanel, TotalsBar, ActionBar,
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
- **Bulk edit** — select a range, type a value and press **Ctrl/Cmd+Enter** to
  apply it to every editable cell of the selection, as in Excel.
- **Deal sheet** — computed as Current − Previous per ISIN (a missing side counts
  as zero) and valued at the Current prices, so it follows every edit.
- **Dates** — changing TD moves COB to the previous business day and VD to the
  next one (weekends skipped, no holiday calendar).
- **Rows** — `MAIN_TABLE_ROWS` / `DEAL_TABLE_ROWS` in `backend/app.py` set how
  many lines each grid shows.
