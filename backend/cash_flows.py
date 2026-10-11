import pandas as pd

import utils
from utils import CURRENCY, DIRTY_PX, ISIN, MARKET_VALUE, NOMINAL, RESET_FX

# Mock terms. Amounts are signed: positive is received, negative is paid.
FINANCING_RATE = 0.035
ACCRUAL_DAYS = 90
DAYS_IN_YEAR = 360
UNWIND_COST_RATE = 0.0015
FX_FLOW_CURRENCIES = ["USD", "GBP", "EUR"]


# The previous positions, revalued in EUR from their previous DIRTY PX to the current one.
def performance(current: pd.DataFrame, previous: pd.DataFrame) -> float:
    current_price = previous[ISIN].map(current.drop_duplicates(ISIN).set_index(ISIN)[DIRTY_PX])
    price_move = (current_price - previous[DIRTY_PX]).fillna(0)
    return (previous[NOMINAL] * price_move / 100 / previous[RESET_FX]).sum()


def interests(previous: pd.DataFrame) -> float:
    return -previous[MARKET_VALUE].sum() * FINANCING_RATE * ACCRUAL_DAYS / DAYS_IN_YEAR


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


def in_own_currency(positions: pd.DataFrame) -> pd.Series:
    return (positions[MARKET_VALUE] * positions[RESET_FX]).groupby(positions[CURRENCY]).sum()


# What the reshuffle buys or sells in each currency: previous market value minus current.
def fx_flows(current: pd.DataFrame, previous: pd.DataFrame) -> list[dict]:
    net = in_own_currency(previous).sub(in_own_currency(current), fill_value=0).reindex(FX_FLOW_CURRENCIES, fill_value=0)
    return [{"fx flows": currency, "amount": int(round(amount))} for currency, amount in net.items()]


# One list of records per table of the Cash Flows popup. The keys are the headers.
def tables(basket: str, current: pd.DataFrame, unwind: float) -> list[list[dict]]:
    previous = utils.positions(basket, "previous")
    return [basket_flows(current, previous, unwind), fx_flows(current, previous)]
