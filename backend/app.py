from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

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


@app.exception_handler(FileNotFoundError)
def missing_data_file(_, error: FileNotFoundError):
    return JSONResponse({"detail": f"Missing data file: {Path(error.filename).name}"}, status_code=404)


@app.exception_handler(utils.UnknownFunction)
def unknown_function(_, error: utils.UnknownFunction):
    return JSONResponse({"detail": str(error)}, status_code=404)


@app.get("/api/basket")
def basket(basket: str = Depends(known_basket)):
    return utils.basket_payload(basket)


@app.get("/api/cash_flows")
def list_cash_flows(basket: str = Depends(known_basket), unwind: float = 0):
    return cash_flows.tables(basket, unwind)


@app.get("/api/checks")
def list_checks():
    return checks.CHECKS.catalogue()


@app.post("/api/checks/{name}")
def run_check(name: str, basket: str = Depends(known_basket)):
    return checks.run(name, basket)


@app.get("/api/booking")
def list_booking_steps():
    return booking.STEPS.catalogue()


@app.post("/api/booking/{name}")
def run_booking_step(name: str, basket: str = Depends(known_basket)):
    return booking.run(name, basket)


@app.post("/api/email")
def email(basket: str = Depends(known_basket)):
    return utils.send_email(basket)


# Mounted last so the /api routes take precedence.
app.mount("/", StaticFiles(directory=Path(__file__).parent.parent / "frontend", html=True))
