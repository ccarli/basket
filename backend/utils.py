import time
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

MAIN_TABLE_ROWS = 150
DEAL_TABLE_ROWS = 10

EMAIL_RECIPIENT = "desk@example.com"
MOCK_EMAIL_DURATION = 1.5  # seconds the mock pretends to send for

# The basket columns the backend computes with, named exactly as in the header of
# data/data_<mode>_<basket>.csv. frontend/js/model.js holds the same list.
ISIN = "ISIN"
NOMINAL = "NOMINAL"
SOURCE = "SOURCE"
ISSUER = "ISSUER"
CURRENCY = "CURRENCY"
RISK_COUNTRY = "RISK COUNTRY"
MIN_HC = "MIN HC"
HC = "HC"
RESET_FX = "RESET FX"  # units of CURRENCY per EUR
DIRTY_PX = "DIRTY PX"
MARKET_VALUE_PRE_HC = "MARKET VALUE (EUR PRE-HC)"
MARKET_VALUE = "MARKET VALUE (EUR)"

HIDDEN_COLUMNS = set()
EDITABLE_COLUMNS = {ISIN, NOMINAL, SOURCE}
SUMMABLE_COLUMNS = {NOMINAL, MARKET_VALUE_PRE_HC, MARKET_VALUE}
# text | mono | amount | price | rate | pct. Unlisted columns follow their dtype.
COLUMN_FORMATS = {
    ISIN: "mono",
    NOMINAL: "amount",
    MIN_HC: "pct",
    HC: "pct",
    RESET_FX: "rate",
    MARKET_VALUE_PRE_HC: "amount",
    MARKET_VALUE: "amount",
}


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


# The current positions as edited on screen, shaped like the CSV they started from.
def edited_positions(basket: str, records: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(records, columns=positions(basket, "current").columns)


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
        "rows": {"main": MAIN_TABLE_ROWS, "deal": DEAL_TABLE_ROWS},
        "columns": columns(current),
        "statics": statics(basket),
        "current": records(current),
        "previous": records(previous),
        "inventory": inventory(set(current[ISIN]) | set(previous[ISIN])),
    }


def send_email(basket: str, positions: pd.DataFrame) -> dict:
    time.sleep(MOCK_EMAIL_DURATION)
    return {"detail": f"{basket} reshuffle, {len(positions)} lines, to {EMAIL_RECIPIENT} (mock: nothing left the app)"}
