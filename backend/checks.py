import time

import pandas as pd

import utils

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
    weights = positions.groupby(column)["mv"].sum() / positions["mv"].sum()
    over = weights[weights > limit].sort_values(ascending=False)
    if not over.empty:
        return f"Above {limit:.0%} of mv: {listed(over, '.1%')}"


def available(positions: pd.DataFrame, inventory: pd.DataFrame) -> pd.Series:
    return inventory.groupby("isin")["available_qty"].sum().reindex(positions["isin"].unique(), fill_value=0)


@check(f"No isin above {MAX_ISIN_WEIGHT:.0%} of the basket mv")
def isin_concentration(positions, inventory):
    return concentration(positions, "isin", MAX_ISIN_WEIGHT)


@check(f"No issuer above {MAX_ISSUER_WEIGHT:.0%} of the basket mv")
def issuer_concentration(positions, inventory):
    return concentration(positions, "issuer", MAX_ISSUER_WEIGHT)


@check(f"No country above {MAX_COUNTRY_WEIGHT:.0%} of the basket mv")
def country_concentration(positions, inventory):
    return concentration(positions, "country", MAX_COUNTRY_WEIGHT)


@check(f"Every isin has at least {MIN_OUTSTANDING_AMOUNT:,} outstanding (mocked as its total available_qty)")
def minimum_outstanding_amount(positions, inventory):
    outstanding = available(positions, inventory)
    small = outstanding[outstanding < MIN_OUTSTANDING_AMOUNT].sort_values()
    if not small.empty:
        return f"Below {MIN_OUTSTANDING_AMOUNT:,}: {listed(small, ',')}"


@check("The inventory covers the qty of every position")
def inventory_availability(positions, inventory):
    needed = positions.groupby("isin")["qty"].sum().abs()
    shortfall = needed - available(positions, inventory)
    short = shortfall[shortfall > 0]
    if not short.empty:
        return f"Short by: {listed(short, ',')}"


@check("No isin appears on two lines")
def duplicate_isin(positions, inventory):
    duplicated = positions["isin"][positions["isin"].duplicated()].unique()
    if len(duplicated):
        return f"On several lines: {', '.join(duplicated)}"


@check("The basket holds something")
def notional_integrity(positions, inventory):
    if positions["qty"].sum() == 0:
        return "The total qty is zero"


@check("Every inventory line of the basket has a settlement date")
def settlement_date_consistency(positions, inventory):
    held = inventory[inventory["isin"].isin(positions["isin"])]
    undated = held["isin"][held["settlement"].isna()].unique()
    if len(undated):
        return f"No settlement date: {', '.join(undated)}"


def run(name: str, basket: str) -> dict:
    function = CHECKS[name]
    time.sleep(MOCK_DURATION)
    failure = function(utils.positions(basket, "current"), utils.load("inventory"))
    return {"passed": not failure, "detail": failure or ""}
