import pandas as pd

import utils

# Mock market data and terms. Amounts are signed: positive is received, negative is paid.
EUR_PER = {"USD": utils.EURUSD, "GBP": 1.17, "EUR": 1.0}  # in the order the fx flows are listed
FINANCING_RATE = 0.035
ACCRUAL_DAYS = 90
DAYS_IN_YEAR = 360
UNWIND_COST_RATE = 0.0015


def in_eur(amounts: pd.Series, positions: pd.DataFrame) -> float:
    return (amounts * positions["ccy"].map(EUR_PER)).sum()


# The previous positions, revalued from their previous dirty_price to the current one.
def performance(current: pd.DataFrame, previous: pd.DataFrame) -> float:
    current_price = previous["isin"].map(current.drop_duplicates("isin").set_index("isin")["dirty_price"])
    price_move = (current_price - previous["dirty_price"]).fillna(0)
    return in_eur(previous["qty"] * price_move / 100, previous)


def interests(previous: pd.DataFrame) -> float:
    notional = in_eur(previous["mv"], previous)
    return -notional * FINANCING_RATE * ACCRUAL_DAYS / DAYS_IN_YEAR


def unwind_cost(unwind: float) -> float:
    return -abs(unwind) * UNWIND_COST_RATE


def basket_flows(current: pd.DataFrame, previous: pd.DataFrame, unwind: float) -> list[dict]:
    flows = {
        "performance": performance(current, previous),
        "interests": interests(previous),
        "unwind cost": unwind_cost(unwind),
    }
    flows["total"] = sum(flows.values())
    return [{"basket flows": name, "EUR": int(round(amount))} for name, amount in flows.items()]


# What the reshuffle buys or sells in each currency: previous mv minus current mv.
def fx_flows(current: pd.DataFrame, previous: pd.DataFrame) -> list[dict]:
    net = previous.groupby("ccy")["mv"].sum().sub(current.groupby("ccy")["mv"].sum(), fill_value=0)
    return [{"fx flows": ccy, "amount": int(round(amount))} for ccy, amount in net.reindex(EUR_PER, fill_value=0).items()]


# One list of records per table of the Cash Flows popup. The keys are the headers.
def tables(basket: str, unwind: float) -> list[list[dict]]:
    current, previous = utils.positions(basket, "current"), utils.positions(basket, "previous")
    return [basket_flows(current, previous, unwind), fx_flows(current, previous)]
