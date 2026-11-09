from typing import Literal

from pydantic import BaseModel, Field


class CustomerInput(BaseModel):
    gender: Literal["Female", "Male"] = "Female"
    SeniorCitizen: Literal[0, 1] = 0
    Partner: Literal["Yes", "No"] = "No"
    Dependents: Literal["Yes", "No"] = "No"
    tenure: int = Field(default=12, ge=0, le=100)
    PhoneService: Literal["Yes", "No"] = "Yes"
    MultipleLines: Literal["Yes", "No", "No phone service"] = "No"
    InternetService: Literal["DSL", "Fiber optic", "No"] = "Fiber optic"
    OnlineSecurity: Literal["Yes", "No", "No internet service"] = "No"
    OnlineBackup: Literal["Yes", "No", "No internet service"] = "No"
    DeviceProtection: Literal["Yes", "No", "No internet service"] = "No"
    TechSupport: Literal["Yes", "No", "No internet service"] = "No"
    StreamingTV: Literal["Yes", "No", "No internet service"] = "No"
    StreamingMovies: Literal["Yes", "No", "No internet service"] = "No"
    Contract: Literal["Month-to-month", "One year", "Two year"] = "Month-to-month"
    PaperlessBilling: Literal["Yes", "No"] = "Yes"
    PaymentMethod: Literal[
        "Electronic check",
        "Mailed check",
        "Bank transfer (automatic)",
        "Credit card (automatic)",
    ] = "Electronic check"
    MonthlyCharges: float = Field(default=70.0, ge=0, le=10000)
    TotalCharges: float = Field(default=840.0, ge=0, le=1000000)

    class Config:
        extra = "forbid"
