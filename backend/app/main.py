from contextlib import asynccontextmanager
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import MODEL_PATH
from app.schemas import CustomerInput
from app import service


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Signal & Stay — Customer Churn Intelligence",
    version="1.0.0",
    description="Churn risk scoring, model evaluation, and explainable retention insights.",
    lifespan=lifespan,
)
LOGGER = logging.getLogger("churn.api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ready" if MODEL_PATH.exists() else "needs_training",
        "model_available": MODEL_PATH.exists(),
    }


@app.get("/api/overview")
def overview():
    return _run(service.get_overview)


@app.get("/api/customers")
def customers(
    search: Optional[str] = None,
    risk: Optional[str] = None,
    contract: Optional[str] = None,
    tenure_min: Optional[int] = Query(default=None, ge=0),
    tenure_max: Optional[int] = Query(default=None, ge=0),
    sort_by: str = "ChurnProbability",
    direction: str = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    if tenure_min is not None and tenure_max is not None and tenure_min > tenure_max:
        raise HTTPException(status_code=422, detail="Minimum tenure must not exceed maximum tenure.")
    return _run(
        lambda: service.get_customer_page(
            search=search,
            risk=risk,
            contract=contract,
            tenure_min=tenure_min,
            tenure_max=tenure_max,
            sort_by=sort_by,
            direction=direction,
            page=page,
            page_size=page_size,
        )
    )


@app.get("/api/customers/{customer_id}")
def customer(customer_id: str):
    result = _run(lambda: service.get_customer(customer_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return result


@app.post("/api/predict")
def predict(payload: CustomerInput):
    return _run(lambda: service.predict_customer(payload.dict()))


@app.get("/api/performance")
def performance():
    return _run(service.get_performance)


@app.get("/api/recommendations")
def recommendations():
    return _run(service.get_recommendations)


def _run(operation):
    try:
        return operation()
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        LOGGER.exception("API request failed")
        raise HTTPException(status_code=500, detail="The request could not be completed.") from error
