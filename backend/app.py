"""Basket TRS backend — loads the CSV data as DataFrames and serves it as JSON."""
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

EURUSD = 0.92

# ---------------------------------------------------------------------------
# Columns are described by the CSV header: adding a column to the data files is
# all it takes for it to appear in the UI. Only the entries below need editing,
# and only when a column needs a nicer label or a specific format.
# ---------------------------------------------------------------------------
HIDDEN_COLUMNS = {"state"}                       # rendering metadata, not shown
EDITABLE_COLUMNS = {"isin", "qty", "label"}
COLUMN_LABELS = {
    "isin": "ISIN", "qty": "Quantity", "label": "Basket", "instr_type": "Instrument type",
    "ccy": "Currency", "dirty_price": "Dirty Price", "hc": "HC",
    "mv_pre": "MV pre HC", "mv": "Market value",
}
DELTA_LABELS = {"qty": "Δ Quantity", "mv_pre": "Δ MV pre HC", "mv": "Δ Market value"}
# Columns whose cells add up in the "Selection" total, by label (case-insensitive).
COLUMN_SELECTION = ["QUANTITY", "MV pre HC", "MARKET VALUE"]
# text | mono | amount (integer) | price (2 decimals) | pct (0.95 -> 95%)
COLUMN_FORMATS = {"isin": "mono", "qty": "amount", "mv_pre": "amount", "mv": "amount", "hc": "pct"}

# How many rows each grid shows. MAIN_TABLE_ROWS is the number of lines available
# for input in "Basket components": real positions first, empty rows after.
MAIN_TABLE_ROWS = 150
DEAL_TABLE_ROWS = 10

app = FastAPI(title="Basket TRS")


def load(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / name, dtype={"value": str})


def baskets() -> list[str]:
    """The selectable baskets, in the order they appear in static.csv."""
    return load("static.csv")["basket"].drop_duplicates().tolist()


def resolve(basket: str | None) -> str:
    """Falls back to the first basket; rejects anything static.csv does not list."""
    known = baskets()
    if basket is None:
        return known[0]
    if basket not in known:
        raise HTTPException(status_code=404, detail=f"Unknown basket: {basket}")
    return basket


def slug(basket: str) -> str:
    """FINECO -> fineco, NORDIC 2029 -> nordic_2029 (see data/data_<mode>_<basket>.csv)."""
    return basket.lower().replace(" ", "_")


def rows(basket: str, mode: str) -> pd.DataFrame:
    return load(f"data_{mode}_{slug(basket)}.csv")


def column_format(name: str, dtype) -> str:
    """Falls back to the dtype: whole numbers are amounts, decimals are prices."""
    if name in COLUMN_FORMATS:
        return COLUMN_FORMATS[name]
    if pd.api.types.is_integer_dtype(dtype):
        return "amount"
    if pd.api.types.is_float_dtype(dtype):
        return "price"
    return "text"


def columns(df: pd.DataFrame) -> list[dict]:
    """The column definitions the UI renders, straight from the CSV header."""
    out = []
    for name, dtype in df.dtypes.items():
        if name in HIDDEN_COLUMNS:
            continue
        fmt = column_format(name, dtype)
        label = COLUMN_LABELS.get(name, name.replace("_", " ").capitalize())
        out.append({
            "key": name,
            "label": label,
            "summable": label.upper() in {c.upper() for c in COLUMN_SELECTION},
            "deltaLabel": DELTA_LABELS.get(name),
            "format": fmt,
            "num": fmt in ("amount", "price", "pct"),
            "editable": name in EDITABLE_COLUMNS,
        })
    return out


@app.get("/api/basket")
def basket(basket: str | None = None):
    """Everything the UI needs for one basket, in one payload."""
    basket = resolve(basket)
    current, previous = rows(basket, "current"), rows(basket, "previous")
    statics = load("static.csv")
    inventory = load("inventory.csv")
    held = set(current["isin"]) | set(previous["isin"])

    return {
        "baskets": baskets(),
        "basket": basket,
        "eurusd": EURUSD,
        "rows": {"main": MAIN_TABLE_ROWS, "deal": DEAL_TABLE_ROWS},
        "columns": columns(current),
        "statics": statics[statics["basket"] == basket].drop(columns="basket").to_dict(orient="records"),
        "current": current.to_dict(orient="records"),
        "previous": previous.to_dict(orient="records"),
        "inventory": {
            isin: group.drop(columns="isin").to_dict(orient="records")
            for isin, group in inventory[inventory["isin"].isin(held)].groupby("isin")
        },
    }


@app.get("/api/checks")
def checks(basket: str | None = None):
    """Validation run behind the 'Checks' button."""
    current = rows(resolve(basket), "current")
    inventory = load("inventory.csv")
    available = inventory.groupby("isin")["available_qty"].sum()

    return {
        "results": [
            ["Notional integrity", bool(current["qty"].sum() != 0)],
            ["Duplicate ISIN", bool(not current["isin"].duplicated().any())],
            ["Inventory availability", bool(
                all(available.get(r.isin, 0) >= abs(r.qty) for r in current.itertuples())
            )],
            ["Settlement date consistency", bool(inventory["settlement"].notna().all())],
        ]
    }


# The frontend is plain ES modules — no build step — so it is served as-is.
# Mounted last so the /api routes above take precedence.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
