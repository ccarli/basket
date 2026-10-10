import time
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

EURUSD = 0.92
MAIN_TABLE_ROWS = 150
DEAL_TABLE_ROWS = 10

EMAIL_RECIPIENT = "desk@example.com"
MOCK_EMAIL_DURATION = 1.5  # seconds the mock pretends to send for

# Columns are named exactly as in the header of data/data_<mode>_<basket>.csv.
HIDDEN_COLUMNS = {"state"}
EDITABLE_COLUMNS = {"isin", "qty", "label"}
SUMMABLE_COLUMNS = {"qty", "mv_pre", "mv"}
# text | mono | amount | price | pct. Unlisted columns follow their dtype.
COLUMN_FORMATS = {"isin": "mono", "qty": "amount", "mv_pre": "amount", "mv": "amount", "hc": "pct"}


class UnknownFunction(LookupError):
    pass


# The functions behind a button, by name and in running order: see checks.py and booking.py.
class Registry(dict):
    def register(self, description: str):
        def decorate(function):
            function.description = description
            self[function.__name__] = function
            return function

        return decorate

    def __missing__(self, name: str):
        raise UnknownFunction(f"Unknown function: {name}")

    def catalogue(self) -> list[dict]:
        return [{"name": name, "description": function.description} for name, function in self.items()]


def load(name: str, **options) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / f"{name}.csv", **options)


def records(df: pd.DataFrame) -> list[dict]:
    return df.astype(object).where(df.notna(), None).to_dict(orient="records")


def baskets() -> list[str]:
    return load("static")["basket"].drop_duplicates().tolist()


def positions(basket: str, mode: str) -> pd.DataFrame:
    return load(f"data_{mode}_{basket.lower().replace(' ', '_')}")


def column_format(name: str, dtype) -> str:
    if name in COLUMN_FORMATS:
        return COLUMN_FORMATS[name]
    if pd.api.types.is_integer_dtype(dtype):
        return "amount"
    if pd.api.types.is_float_dtype(dtype):
        return "price"
    return "text"


def columns(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": name,
            "format": column_format(name, dtype),
            "editable": name in EDITABLE_COLUMNS,
            "summable": name in SUMMABLE_COLUMNS,
        }
        for name, dtype in df.dtypes.items()
        if name not in HIDDEN_COLUMNS
    ]


def statics(basket: str) -> list[dict]:
    df = load("static", dtype=str)
    return records(df[df["basket"] == basket].drop(columns="basket"))


def inventory(isins: set[str]) -> dict[str, list[dict]]:
    df = load("inventory")
    return {
        isin: records(lines.drop(columns="isin"))
        for isin, lines in df[df["isin"].isin(isins)].groupby("isin")
    }


def basket_payload(basket: str) -> dict:
    current, previous = positions(basket, "current"), positions(basket, "previous")
    return {
        "baskets": baskets(),
        "basket": basket,
        "eurusd": EURUSD,
        "rows": {"main": MAIN_TABLE_ROWS, "deal": DEAL_TABLE_ROWS},
        "columns": columns(current),
        "statics": statics(basket),
        "current": records(current),
        "previous": records(previous),
        "inventory": inventory(set(current["isin"]) | set(previous["isin"])),
    }


def send_email(basket: str) -> dict:
    time.sleep(MOCK_EMAIL_DURATION)
    lines = len(positions(basket, "current"))
    return {"detail": f"{basket} reshuffle, {lines} lines, to {EMAIL_RECIPIENT} (mock: nothing left the app)"}
