"""Basket TRS backend — loads the CSV data as DataFrames and serves it as JSON."""
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(__file__).parent / "data"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

EURUSD = 0.92

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
