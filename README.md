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
  js/grid.js      the Excel-like table: selection, keyboard, editing, clipboard, resizing, filtering
  js/widths.js    automatic column widths
  js/filter.js    what a column filter matches
  js/format.js    number formatting and parsing
  js/html.js      HTML escaping and the generic records table
  js/toolbar.js   basket selector, basket details, notionals, theme
  js/tasks.js     the Checks and Booking popups
  js/cash_flows.js the Cash Flows popup
  js/email.js     the Email confirmation popup
  js/calendar.js  the COB / TD / VD date picker
  js/api.js       the backend calls
```

## Data

| File                       | Shown in                                                        |
|----------------------------|-----------------------------------------------------------------|
| `data_<mode>_<basket>.csv` | the grid. One file per basket and per mode (`current`, `previous`) |
| `static.csv`               | the basket selector and the "basket details" popup              |
| `inventory.csv`            | the sub-table opened by the `+` of a row, filtered on its `ISIN` |

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
| `COLUMN_FORMATS`   | `text`, `mono`, `amount`, `price`, `rate` or `pct`, when the dtype is not enough |

The columns the code computes with are listed once per tier, as constants named
after the header: the block at the top of `backend/utils.py`, which `checks.py`,
`booking.py` and `cash_flows.py` import, and the block at the top of
`frontend/js/model.js`. Renaming one of them means renaming it in the CSVs and
in those two blocks. Every other column can be renamed in the CSVs alone.

The basket files hold these columns, in this order:

| Column | Notes |
|---|---|
| `ISIN`, `NOMINAL`, `SOURCE` | editable. `SOURCE` is `TRS`, `SUB IN` or `SUB OUT`; anything else typed is ignored |
| `BBG NAME`, `MATURITY`, `ISSUER`, `TYPE`, `CURRENCY` | |
| `ISSUER COUNTRY`, `RISK COUNTRY`, `GRADE`, `RATING`, `NEXT COUPON` | |
| `MIN HC`, `HC` | haircuts as ratios: `0.05` displays as `5%` |
| `RESET FX` | units of `CURRENCY` per EUR: `1` for EUR, `1.0870` for USD |
| `CLEAN PX`, `DIRTY PX` | |
| `MARKET VALUE (EUR PRE-HC)` | `NOMINAL × DIRTY PX / 100 / RESET FX` |
| `MARKET VALUE (EUR)` | `MARKET VALUE (EUR PRE-HC) × (1 − HC)` |

`inventory.csv` and `static.csv` keep their own lower-case headers.

A blank CSV cell is served as `null`: it displays empty in a text column, as
`—` in a price, rate or percentage column and as `0` in an amount column. pandas reads
a whole-number column holding a blank as decimals, so list such a column as
`amount` in `COLUMN_FORMATS`.

## The edited basket

The CSVs only load the page. Everything the buttons run in the backend (cash
flows, checks, booking, email) works on the basket as it stands on screen, edits
included. Each of those calls is a `POST` whose JSON body is built by
`editedBasket()` in `frontend/js/main.js`:

```json
{ "basket": "FINECO", "positions": [{ "ISIN": "FR0123456", "NOMINAL": 100000000, "…": "…" }], "unwind": 0 }
```

`positions` holds the current lines that carry an `ISIN`, with the same keys as
the CSV header. `app.py` turns them into a DataFrame shaped like the CSV
(`EditedBasket.frame`) and passes it on, so a backend function receives the same
kind of DataFrame whether the user edited anything or not. No backend function
reads the current positions from the CSV itself. The previous positions and the
inventory are not editable and still come from the CSVs.

## Checks and booking

The Checks and Book buttons each open a popup listing the functions registered
in `backend/checks.py` or `backend/booking.py`, then call them one at a time:
each shows a spinner while it runs, then passed or failed with a message.

| Endpoint                                  | Returns                                   |
|-------------------------------------------|-------------------------------------------|
| `GET /api/checks`, `GET /api/booking`     | `[{name, description}]`, in running order |
| `POST /api/checks/<name>`                 | `{passed, detail}`                        |
| `POST /api/booking/<name>`                | `{passed, detail}`                        |

The function name is what the popup displays, and the functions run in the
order they are written. Adding one needs no frontend change.

- **A check** is decorated with `@check("what it verifies")`. It receives the
  current positions and the inventory as DataFrames and returns the reason it
  failed, or nothing when it passed. All checks run, whatever the results.
- **A booking step** is decorated with `@step("what it does")`. It receives the
  basket name and its current positions, returns a confirmation, and raises
  `BookingError("reason")` when it fails. Booking stops at the first failure.
  The steps are `log_basket`, `book_star`, `book_focus` and `book_apex`.

Both are mocks. They sleep for `MOCK_DURATION` so the spinner is visible. The booking steps book
nothing and return made-up references; `book_apex` rejects baskets above
`APEX_MAX_LINES`. `minimum_outstanding_amount` uses the inventory as a stand-in
for the issue size.

## Cash flows

The Cash Flows button calls `POST /api/cash_flows` and displays the two tables
it returns. Each
table is a list of records whose keys are the headers, so adding a row or a
table in `backend/cash_flows.py` needs no frontend change.

| Table          | Row           | Mock computation                                             |
|----------------|---------------|--------------------------------------------------------------|
| `basket flows` | `performance` | previous `NOMINAL` × (current − previous `DIRTY PX`) / 100 / `RESET FX` |
|                | `interests`   | − previous `MARKET VALUE (EUR)` × `FINANCING_RATE` × `ACCRUAL_DAYS` / 360 |
|                | `unwind cost` | − unwind amount × `UNWIND_COST_RATE`                         |
|                | `total`       | the sum of the three                                         |
| `fx flows`     | one per `CURRENCY` | previous − current `MARKET VALUE (EUR)` × `RESET FX`, in that currency |

Positive amounts are received and negative ones paid. Basket flows are in EUR;
fx flows are in their own currency.
The previous positions come from the CSV, the current ones from the screen.

## Where to change what

| To change                               | Edit                                         |
|-----------------------------------------|----------------------------------------------|
| rows per grid                           | `MAIN_TABLE_ROWS`, `DEAL_TABLE_ROWS` in `utils.py` |
| a check or its limit                    | `checks.py`: one decorated function per check |
| a booking step                          | `booking.py`: one decorated function per step |
| a cash flow formula, rate or FX rate    | `cash_flows.py`                              |
| how a number is displayed or parsed     | `format.js`                                  |
| the market value or deal sheet formulas | `withMarketValues()`, `dealRows()` in `model.js` |
| the totals strip                        | `renderTotals()` in `main.js`                |
| a keyboard shortcut                     | `onKey()` and `onEditKey()` in `grid.js`     |
| what a column filter understands        | `matcher()` in `filter.js`                   |
| column width limits                     | `STYLES` in `widths.js`                      |

## Features

- **Grid** — Excel-like range selection, keyboard navigation (arrows, Tab, Home,
  End, PageUp/PageDown), in-cell editing (Enter, F2, double-click or just type),
  TSV copy/paste, Delete to clear a range.
- **Filters** — the funnel icon in the header corner of the main grid and of the
  deal sheet shows a filter box under each column header. Clicking it again
  hides the boxes and drops the filters. Text is a case-insensitive "contains"; `>1M`,
  `<=5`, `=0` compare the displayed numbers; `=EUR` is an exact match. Filters
  on several columns combine. Hidden lines are skipped by keyboard moves, copy,
  paste, bulk edit, Delete and the selection total. Filters only change what is
  displayed: the totals and everything sent to the backend keep the whole
  basket. They survive the current/previous toggle and reset on a basket change.
- **Live model** — editing `NOMINAL` recomputes the two market value columns,
  the totals and the deal sheet. Typing into an empty line creates a `SUB IN`
  position, which inherits its other columns when the `ISIN` is in the previous
  set. Clearing the `ISIN` of a line, alone or with the rest of the line, removes
  the whole line; clearing only its `NOMINAL` sets it to 0 and keeps the line.
- **Bulk edit** — select a range, type a value and press Ctrl/Cmd+Enter to apply
  it to every editable cell of the selection.
- **Amount input** — amounts accept `125k`, `140M`, `1.5m` and `1,500,000`.
- **Selection total** — selecting summable cells adds a "Selection" tile with
  their sum and count.
- **Deal sheet** — current − previous `NOMINAL` per `ISIN`, valued at the current
  prices, with `SOURCE` set to `SUB IN` for an increase and `SUB OUT` for a
  decrease. It lives in a drawer opened by the tab at the bottom.
- **Row rail** — a `SUB IN` line carries a green rail on its left, a `SUB OUT`
  line a red one.
- **Inventory** — the `+` of a row shows the `inventory.csv` lines of its `ISIN`.
- **Columns** — long headers wrap. On a wide window every column is visible;
  below that the grid scrolls sideways. Numeric columns never shrink below
  their content, text columns ellipsise. Dragging a column edge pins its width;
  double-clicking the edge releases it.
- **Dates** — changing TD moves COB to the previous business day and VD to the
  next one. Weekends are skipped; there is no holiday calendar.
- **Notionals** — the old notional is the previous basket's total
  `MARKET VALUE (EUR)`, the new
  one defaults to it and the unwind amount is the difference. Editing either
  recomputes the other. They are indicators and do not rescale the positions.
- **Email** — the button asks for confirmation, then shows "sending" with a
  spinner and the outcome. `POST /api/email` calls `send_email()` in
  `utils.py`, a mock that sleeps for `MOCK_EMAIL_DURATION` and sends nothing.
- **Also** — current/previous toggle, basket details popup, dark mode, a spinner
  over the main table while a basket loads.
