# Basket TRS — secondary event

A Python/pandas backend serving CSV data as JSON, and a plain HTML/CSS/JavaScript
frontend. No framework, no build step, no `node_modules`: the browser loads the
files under `frontend/` as they are.

## Run

```bash
pip3 install -r backend/requirements.txt
python3 -m uvicorn app:app --reload --app-dir backend
```

Open <http://localhost:8000>. The backend serves both the API and the frontend,
so deploying means copying the repository and running these two commands.
Editing a file under `frontend/` only needs a browser refresh. The page asks
Google Fonts for Inter and JetBrains Mono and falls back to system fonts offline.

## Layout

```
backend/
  app.py          the API: /api/basket, /api/cash_flows, /api/checks, /api/booking, /api/email, and the static frontend
  utils.py        settings, CSV loading, column definitions, the function registry, the email mock
  checks.py       the checks behind the Checks button, one function each
  booking.py      the steps behind the Book button, one function each
  cash_flows.py   the two tables behind the Cash Flows button
  data/*.csv      the data
frontend/
  index.html      the whole page structure
  style.css       design tokens and component styles
  js/main.js      state, rendering, totals, wiring
  js/model.js     edits, market values, deal sheet, selection sum
  js/grid.js      the Excel-like table: selection, keyboard, editing, clipboard, resizing
  js/widths.js    automatic column widths
  js/format.js    number formatting and parsing
  js/html.js      HTML escaping and the generic records table
  js/toolbar.js   basket selector, basket details, notionals, theme
  js/tasks.js     the Checks and Booking popups
  js/cash_flows.js  the Cash Flows popup
  js/email.js     the Email confirmation popup
  js/calendar.js  the COB / TD / VD date picker
  js/api.js       the two backend calls
```

## Data

| File                       | Shown in                                                        |
|----------------------------|-----------------------------------------------------------------|
| `data_<mode>_<basket>.csv` | the grid. One file per basket and per mode (`current`, `previous`) |
| `static.csv`               | the basket selector and the "basket details" popup              |
| `inventory.csv`            | the sub-table opened by the `+` of a row, filtered on its `isin` |

A basket name maps to its file names in lower case with underscores:
`NORDIC 2029` reads `data_current_nordic_2029.csv` and `data_previous_nordic_2029.csv`.
To add a basket, add its rows to `static.csv` and its two data files.

## Column names

**A column has one name: its CSV header.** That exact string is the JSON key,
the property the code reads, and the header on screen. Nothing relabels,
capitalises or translates it, for the grid, the deal sheet, the inventory and
the basket details alike. To show a different header, rename it in the CSV.

Adding a column to the data files is enough for it to appear, formatted from its
dtype: whole numbers as amounts, decimals as prices, the rest as text. The only
per-column settings are four constants at the top of `backend/utils.py`:

| Constant           | Meaning                                              |
|--------------------|------------------------------------------------------|
| `HIDDEN_COLUMNS`   | loaded but not displayed                             |
| `EDITABLE_COLUMNS` | can be typed into in the current set                 |
| `SUMMABLE_COLUMNS` | add up in the "Selection" total                      |
| `COLUMN_FORMATS`   | `text`, `mono`, `amount`, `price` or `pct`, when the dtype is not enough |

The code reads a few columns by name: `isin`, `qty`, `label`, `state`, `ccy`,
`dirty_price`, `hc`, `mv_pre`, `mv` in `frontend/js/model.js`, `isin` and `basket`
in `backend/utils.py`, and `isin`, `qty`, `mv`, `issuer`, `country`,
`available_qty`, `settlement` in `backend/checks.py`, `qty`, `mv` in
`backend/booking.py`, and `isin`, `qty`, `ccy`, `dirty_price`, `mv` in
`backend/cash_flows.py`. Renaming one of them means renaming it in the CSVs and in
those files. Every other column
can be renamed in the CSVs alone.

A blank CSV cell is served as `null`: it displays empty in a text column, as
`—` in a price or percentage column and as `0` in an amount column. pandas reads
a whole-number column holding a blank as decimals, so list such a column as
`amount` in `COLUMN_FORMATS`.

## Checks and booking

The Checks and Book buttons each open a popup listing the functions registered
in `backend/checks.py` or `backend/booking.py`, then call them one at a time:
each shows a spinner while it runs, then passed or failed with a message.

| Endpoint                                  | Returns                                   |
|-------------------------------------------|-------------------------------------------|
| `GET /api/checks`, `GET /api/booking`     | `[{name, description}]`, in running order |
| `POST /api/checks/<name>?basket=…`        | `{passed, detail}`                        |
| `POST /api/booking/<name>?basket=…`       | `{passed, detail}`                        |

The function name is what the popup displays, and the functions run in the
order they are written. Adding one needs no frontend change.

- **A check** is decorated with `@check("what it verifies")`. It receives the
  current positions and the inventory as DataFrames and returns the reason it
  failed, or nothing when it passed. All checks run, whatever the results.
- **A booking step** is decorated with `@step("what it does")`. It receives the
  basket name and its current positions, returns a confirmation, and raises
  `BookingError("reason")` when it fails. Booking stops at the first failure.
  The steps are `log_basket`, `book_star`, `book_focus` and `book_apex`.

Both are mocks. They read the current CSV rather than the edits made on screen
and sleep for `MOCK_DURATION` so the spinner is visible. The booking steps book
nothing and return made-up references; `book_apex` rejects baskets above
`APEX_MAX_LINES`. `minimum_outstanding_amount` uses the inventory as a stand-in
for the issue size, and market values are not converted to one currency.

## Cash flows

The Cash Flows button calls `GET /api/cash_flows?basket=…&unwind=…`, with the
unwind amount shown in the toolbar, and displays the two tables it returns. Each
table is a list of records whose keys are the headers, so adding a row or a
table in `backend/cash_flows.py` needs no frontend change.

| Table          | Row           | Mock computation                                             |
|----------------|---------------|--------------------------------------------------------------|
| `basket flows` | `performance` | previous `qty` × (current − previous `dirty_price`) / 100    |
|                | `interests`   | − previous `mv` × `FINANCING_RATE` × `ACCRUAL_DAYS` / 360     |
|                | `unwind cost` | − unwind amount × `UNWIND_COST_RATE`                         |
|                | `total`       | the sum of the three                                         |
| `fx flows`     | one per `ccy` | previous `mv` − current `mv` in that currency                |

Positive amounts are received and negative ones paid. Basket flows are in EUR,
converted with the mock rates in `EUR_PER`; fx flows stay in their own currency.
Apart from the unwind amount, the figures come from the CSVs, not from the
edits made on screen.

## Where to change what

| To change                               | Edit                                         |
|-----------------------------------------|----------------------------------------------|
| rows per grid, EUR/USD rate             | `MAIN_TABLE_ROWS`, `DEAL_TABLE_ROWS`, `EURUSD` in `utils.py` |
| a check or its limit                    | `checks.py`: one decorated function per check |
| a booking step                          | `booking.py`: one decorated function per step |
| a cash flow formula, rate or FX rate    | `cash_flows.py`                              |
| how a number is displayed or parsed     | `format.js`                                  |
| the market value or deal sheet formulas | `withMarketValues()`, `dealRows()` in `model.js` |
| the totals strip                        | `renderTotals()` in `main.js`                |
| a keyboard shortcut                     | `onKey()` and `onEditKey()` in `grid.js`     |
| column width limits                     | `STYLES` in `widths.js`                      |

## Features

- **Grid** — Excel-like range selection, keyboard navigation (arrows, Tab, Home,
  End, PageUp/PageDown), in-cell editing (Enter, F2, double-click or just type),
  TSV copy/paste, Delete to clear a range.
- **Live model** — editing `qty` recomputes `mv_pre = qty × dirty_price / 100`,
  `mv = mv_pre × hc`, the totals and the deal sheet. Typing into an empty line
  creates a position; clearing its `isin` removes it.
- **Bulk edit** — select a range, type a value and press Ctrl/Cmd+Enter to apply
  it to every editable cell of the selection.
- **Amount input** — amounts accept `125k`, `140M`, `1.5m` and `1,500,000`.
- **Selection total** — selecting summable cells adds a "Selection" tile with
  their sum and count.
- **Deal sheet** — current − previous `qty` per `isin`, valued at the current
  prices. It lives in a drawer opened by the tab at the bottom.
- **Inventory** — the `+` of a row shows the `inventory.csv` lines of its `isin`.
- **Columns** — every column stays visible without horizontal scrolling. Numeric
  columns never shrink below their content, text columns ellipsise. Dragging a
  column edge pins its width; double-clicking the edge releases it.
- **Dates** — changing TD moves COB to the previous business day and VD to the
  next one. Weekends are skipped; there is no holiday calendar.
- **Notionals** — the old notional is the previous basket's total `mv`, the new
  one defaults to it and the unwind amount is the difference. Editing either
  recomputes the other. They are indicators and do not rescale the positions.
- **Email** — the button asks for confirmation, then shows "sending" with a
  spinner and the outcome. `POST /api/email?basket=…` calls `send_email()` in
  `utils.py`, a mock that sleeps for `MOCK_EMAIL_DURATION` and sends nothing.
- **Also** — current/previous toggle, basket details popup, dark mode.
