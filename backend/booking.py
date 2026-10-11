import time
from zlib import crc32

import pandas as pd

import utils
from utils import MARKET_VALUE, NOMINAL

MOCK_DURATION = 0.8  # seconds each step pretends to work for
APEX_MAX_LINES = 40

STEPS = utils.Registry()


class BookingError(Exception):
    pass


# A step takes the basket name and its current positions, and returns a
# confirmation. It raises BookingError with the reason when it fails.
# Steps run in the order they are written, and the run stops at the first failure.
step = STEPS.register


def reference(prefix: str, basket: str) -> str:
    return f"{prefix}-{crc32(basket.encode()) % 10**6:06d}"


@step("Write the basket to the booking log")
def log_basket(basket: str, positions: pd.DataFrame) -> str:
    return f"{len(positions)} lines logged as {reference('LOG', basket)}"


@step("Book the basket in STAR")
def book_star(basket: str, positions: pd.DataFrame) -> str:
    return f"STAR trade {reference('ST', basket)}, {NOMINAL} {positions[NOMINAL].sum():,}"


@step("Book the basket in FOCUS")
def book_focus(basket: str, positions: pd.DataFrame) -> str:
    return f"FOCUS deal {reference('FC', basket)}, {MARKET_VALUE} {positions[MARKET_VALUE].sum():,}"


@step(f"Book the basket in APEX, which takes at most {APEX_MAX_LINES} lines")
def book_apex(basket: str, positions: pd.DataFrame) -> str:
    if len(positions) > APEX_MAX_LINES:
        raise BookingError(f"APEX rejected the basket: {len(positions)} lines, the limit is {APEX_MAX_LINES}")
    return f"APEX ticket {reference('AX', basket)}"


def run(name: str, basket: str, positions: pd.DataFrame) -> dict:
    function = STEPS[name]
    time.sleep(MOCK_DURATION)
    try:
        return {"passed": True, "detail": function(basket, positions)}
    except BookingError as error:
        return {"passed": False, "detail": str(error)}
