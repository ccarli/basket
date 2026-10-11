from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import booking
import cash_flows
import checks
import utils

app = FastAPI(title="Basket TRS")


def known_basket(basket: str | None = None) -> str:
    known = utils.baskets()
    if basket is None:
        return known[0]
    if basket not in known:
        raise HTTPException(status_code=404, detail=f"Unknown basket: {basket}")
    return basket


# What the buttons send: the basket as it stands on screen, not as it is in the CSV.
class EditedBasket(BaseModel):
    basket: str
    positions: list[dict]
    unwind: float = 0

    @property
    def frame(self) -> pd.DataFrame:
        return utils.edited_positions(self.basket, self.positions)


def edited_basket(edited: EditedBasket) -> EditedBasket:
    known_basket(edited.basket)
    return edited


@app.exception_handler(FileNotFoundError)
def missing_data_file(_, error: FileNotFoundError):
    return JSONResponse({"detail": f"Missing data file: {Path(error.filename).name}"}, status_code=404)


@app.exception_handler(utils.UnknownFunction)
def unknown_function(_, error: utils.UnknownFunction):
    return JSONResponse({"detail": str(error)}, status_code=404)


@app.get("/api/basket")
def basket(basket: str = Depends(known_basket)):
    return utils.basket_payload(basket)


@app.post("/api/cash_flows")
def list_cash_flows(edited: EditedBasket = Depends(edited_basket)):
    return cash_flows.tables(edited.basket, edited.frame, edited.unwind)


@app.get("/api/checks")
def list_checks():
    return checks.CHECKS.catalogue()


@app.post("/api/checks/{name}")
def run_check(name: str, edited: EditedBasket = Depends(edited_basket)):
    return checks.run(name, edited.frame)


@app.get("/api/booking")
def list_booking_steps():
    return booking.STEPS.catalogue()


@app.post("/api/booking/{name}")
def run_booking_step(name: str, edited: EditedBasket = Depends(edited_basket)):
    return booking.run(name, edited.basket, edited.frame)


@app.post("/api/email")
def email(edited: EditedBasket = Depends(edited_basket)):
    return utils.send_email(edited.basket, edited.frame)


# Mounted last so the /api routes take precedence.
app.mount("/", StaticFiles(directory=Path(__file__).parent.parent / "frontend", html=True))
