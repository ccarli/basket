import time

import pandas as pd

import utils
from utils import ISIN, ISSUER, MARKET_VALUE, NOMINAL, RISK_COUNTRY

MOCK_DURATION = 0.4  # seconds each check pretends to work for

MAX_ISIN_WEIGHT = 0.15
MAX_ISSUER_WEIGHT = 0.25
MAX_COUNTRY_WEIGHT = 0.45
MIN_OUTSTANDING_AMOUNT = 1_000_000

CHECKS = utils.Registry()

# A check takes the current positions and the inventory, and returns why it
# failed, or nothing when it passed. Decorating it is all it takes to run it.
check = CHECKS.register


def listed(values: pd.Series, style: str) -> str:
    return ", ".join(f"{name} {value:{style}}" for name, value in values.items())


def concentration(positions: pd.DataFrame, column: str, limit: float) -> str | None:
    weights = positions.groupby(column)[MARKET_VALUE].sum() / positions[MARKET_VALUE].sum()
    over = weights[weights > limit].sort_values(ascending=False)
    if not over.empty:
        return f"Above {limit:.0%} of {MARKET_VALUE}: {listed(over, '.1%')}"


def available(positions: pd.DataFrame, inventory: pd.DataFrame) -> pd.Series:
    return inventory.groupby("isin")["available_qty"].sum().reindex(positions[ISIN].unique(), fill_value=0)


@check(f"No {ISIN} above {MAX_ISIN_WEIGHT:.0%} of the basket {MARKET_VALUE}")
def isin_concentration(positions, inventory):
    return concentration(positions, ISIN, MAX_ISIN_WEIGHT)


@check(f"No {ISSUER} above {MAX_ISSUER_WEIGHT:.0%} of the basket {MARKET_VALUE}")
def issuer_concentration(positions, inventory):
    return concentration(positions, ISSUER, MAX_ISSUER_WEIGHT)


@check(f"No {RISK_COUNTRY} above {MAX_COUNTRY_WEIGHT:.0%} of the basket {MARKET_VALUE}")
def country_concentration(positions, inventory):
    return concentration(positions, RISK_COUNTRY, MAX_COUNTRY_WEIGHT)


@check(f"Every {ISIN} has at least {MIN_OUTSTANDING_AMOUNT:,} outstanding (mocked as its total available_qty)")
def minimum_outstanding_amount(positions, inventory):
    outstanding = available(positions, inventory)
    small = outstanding[outstanding < MIN_OUTSTANDING_AMOUNT].sort_values()
    if not small.empty:
        return f"Below {MIN_OUTSTANDING_AMOUNT:,}: {listed(small, ',')}"


@check(f"The inventory covers the {NOMINAL} of every position")
def inventory_availability(positions, inventory):
    needed = positions.groupby(ISIN)[NOMINAL].sum().abs()
    shortfall = needed - available(positions, inventory)
    short = shortfall[shortfall > 0]
    if not short.empty:
        return f"Short by: {listed(short, ',')}"


@check(f"No {ISIN} appears on two lines")
def duplicate_isin(positions, inventory):
    duplicated = positions[ISIN][positions[ISIN].duplicated()].unique()
    if len(duplicated):
        return f"On several lines: {', '.join(duplicated)}"


@check("The basket holds something")
def notional_integrity(positions, inventory):
    if positions[NOMINAL].sum() == 0:
        return f"The total {NOMINAL} is zero"


@check("Every inventory line of the basket has a settlement date")
def settlement_date_consistency(positions, inventory):
    held = inventory[inventory["isin"].isin(positions[ISIN])]
    undated = held["isin"][held["settlement"].isna()].unique()
    if len(undated):
        return f"No settlement date: {', '.join(undated)}"


def run(name: str, positions: pd.DataFrame) -> dict:
    function = CHECKS[name]
    time.sleep(MOCK_DURATION)
    failure = function(positions, utils.load("inventory"))
    return {"passed": not failure, "detail": failure or ""}
