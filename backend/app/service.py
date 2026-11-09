import json
from functools import lru_cache
from typing import Dict, Optional

import joblib
import pandas as pd

from app.config import (
    CUSTOMERS_PATH,
    EDA_PATH,
    IMPORTANCE_PATH,
    METRICS_PATH,
    MODEL_PATH,
)
from app.ml.explainability import explain_customer


@lru_cache(maxsize=1)
def get_model_bundle():
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Model artifacts are missing. Run the training command in README.md.")
    return joblib.load(MODEL_PATH)


@lru_cache(maxsize=1)
def get_customers():
    if not CUSTOMERS_PATH.exists():
        raise FileNotFoundError("Customer scores are missing. Run the training command in README.md.")
    return pd.read_csv(CUSTOMERS_PATH)


def get_json(path):
    if not path.exists():
        raise FileNotFoundError("Training artifacts are missing. Run the training command in README.md.")
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def get_overview():
    customers = get_customers()
    performance = get_json(METRICS_PATH)
    probabilities = customers["ChurnProbability"]
    return {
        "total_customers": int(len(customers)),
        "actual_churn_rate": round(float((customers["ActualChurn"] == "Yes").mean()), 4),
        "predicted_churn_count": int((customers["PredictedChurn"] == "Yes").sum()),
        "high_risk_count": int((customers["RiskCategory"] == "High").sum()),
        "average_churn_probability": round(float(probabilities.mean()), 4),
        "selected_model": performance["selected_model"],
        "selected_model_metrics": performance["models"][performance["selected_model"]],
        "risk_distribution": _risk_distribution(customers),
        "churn_by_contract": _group_rate(customers, "Contract"),
        "churn_by_tenure": _tenure_bands(customers),
        "retention_opportunities": _retention_opportunities(customers),
    }


def get_customer_page(
    search: Optional[str] = None,
    risk: Optional[str] = None,
    contract: Optional[str] = None,
    tenure_min: Optional[int] = None,
    tenure_max: Optional[int] = None,
    sort_by: str = "ChurnProbability",
    direction: str = "desc",
    page: int = 1,
    page_size: int = 20,
):
    data = get_customers().copy()
    if search:
        data = data[data["customerID"].astype(str).str.contains(search, case=False, na=False)]
    if risk and risk.lower() != "all":
        data = data[data["RiskCategory"].str.lower() == risk.lower()]
    if contract and contract.lower() != "all":
        data = data[data["Contract"] == contract]
    if tenure_min is not None:
        data = data[data["tenure"] >= tenure_min]
    if tenure_max is not None:
        data = data[data["tenure"] <= tenure_max]

    allowed_sort = {
        "customerID",
        "tenure",
        "MonthlyCharges",
        "TotalCharges",
        "ChurnProbability",
    }
    if sort_by not in allowed_sort:
        sort_by = "ChurnProbability"
    data = data.sort_values(sort_by, ascending=direction.lower() == "asc")
    total = len(data)
    start = (page - 1) * page_size
    rows = [_clean_record(row) for row in data.iloc[start : start + page_size].to_dict("records")]
    return {"items": rows, "total": total, "page": page, "page_size": page_size}


def get_customer(customer_id: str):
    customers = get_customers()
    found = customers[customers["customerID"].astype(str) == customer_id]
    if found.empty:
        return None
    row = found.iloc[0]
    input_features = row.drop(
        labels=["customerID", "ActualChurn", "ChurnProbability", "PredictedChurn", "RiskCategory"]
    ).to_dict()
    bundle = get_model_bundle()
    explanation = explain_customer(
        bundle["model"],
        pd.DataFrame([input_features], columns=bundle["features"]),
        bundle["baseline"],
    )
    return {
        **_clean_record(row.to_dict()),
        "explanations": explanation[:8],
        "recommendations": _recommendations_for(row),
    }


def predict_customer(customer: Dict):
    bundle = get_model_bundle()
    row = pd.DataFrame([customer], columns=bundle["features"])
    probability = float(bundle["model"].predict_proba(row)[0, 1])
    risk = "High" if probability >= 0.60 else "Medium" if probability >= 0.25 else "Low"
    return {
        "probability": round(probability, 4),
        "predicted_churn": bool(probability >= bundle["threshold"]),
        "threshold": round(float(bundle["threshold"]), 4),
        "risk_category": risk,
        "selected_model": bundle["selected_model"],
        "explanations": explain_customer(bundle["model"], row, bundle["baseline"])[:8],
        "recommendations": _recommendations_for(customer, risk),
    }


def get_performance():
    return {
        "performance": get_json(METRICS_PATH),
        "feature_importance": get_json(IMPORTANCE_PATH),
        "eda": get_json(EDA_PATH),
    }


def get_recommendations():
    customers = get_customers()
    return {
        "opportunities": _retention_opportunities(customers),
        "actions": [
            {
                "title": "Offer a contract review",
                "audience": "Month-to-month customers at elevated risk",
                "rationale": "A suitable annual option may improve predictability; compare the offer against customer value and avoid unnecessary discounting.",
            },
            {
                "title": "Review early customer experience",
                "audience": "Customers in their first year",
                "rationale": "Proactive onboarding and a service check-in can surface setup or support friction before it becomes a cancellation decision.",
            },
            {
                "title": "Check billing friction",
                "audience": "Customers using electronic check",
                "rationale": "Confirm the billing experience is clear and offer convenient payment options without assuming payment method causes churn.",
            },
            {
                "title": "Investigate service gaps",
                "audience": "Customers without online security or tech support",
                "rationale": "Ask about unresolved issues and explain available support or protection options where they match customer needs.",
            },
        ],
        "caveat": "These are hypotheses for retention testing, not guaranteed interventions. Validate offers with controlled experiments and customer feedback.",
    }


def _risk_distribution(customers):
    count = customers["RiskCategory"].value_counts()
    return [
        {"risk": level, "customers": int(count.get(level, 0))}
        for level in ["High", "Medium", "Low"]
    ]


def _group_rate(customers, column):
    result = (
        customers.groupby(column, dropna=False)["ActualChurn"]
        .apply(lambda values: (values == "Yes").mean())
        .sort_values(ascending=False)
    )
    return [{"name": str(key), "churn_rate": round(float(value), 4)} for key, value in result.items()]


def _tenure_bands(customers):
    bins = [0, 6, 12, 24, 48, 72, float("inf")]
    labels = ["0–6 mo", "7–12 mo", "13–24 mo", "25–48 mo", "49–72 mo", "73+ mo"]
    band = pd.cut(customers["tenure"], bins=bins, labels=labels, include_lowest=True)
    rates = customers.assign(_tenure_band=band).groupby("_tenure_band", observed=True)["ActualChurn"].apply(
        lambda values: (values == "Yes").mean()
    )
    return [{"name": str(key), "churn_rate": round(float(value), 4)} for key, value in rates.items()]


def _retention_opportunities(customers):
    high = customers[customers["RiskCategory"] == "High"]
    opportunities = []
    for name, mask in [
        ("Month-to-month contract", high["Contract"] == "Month-to-month"),
        ("First-year tenure", high["tenure"] <= 12),
        ("Electronic check", high["PaymentMethod"] == "Electronic check"),
        ("No tech support", high["TechSupport"] == "No"),
        ("High monthly charges", high["MonthlyCharges"] >= customers["MonthlyCharges"].quantile(0.75)),
    ]:
        subset = high[mask]
        opportunities.append(
            {
                "segment": name,
                "customers": int(len(subset)),
                "share_of_high_risk": round(float(len(subset) / len(high)), 4) if len(high) else 0.0,
                "avg_monthly_charges": round(float(subset["MonthlyCharges"].mean()), 2) if len(subset) else 0.0,
            }
        )
    return sorted(opportunities, key=lambda item: item["customers"], reverse=True)


def _recommendations_for(customer, risk=None):
    get_value = customer.get if isinstance(customer, dict) else lambda key, default=None: customer.get(key, default)
    recommendations = []
    if get_value("Contract") == "Month-to-month":
        recommendations.append("Discuss a longer-term plan only if it matches the customer's service needs and budget.")
    if int(get_value("tenure", 0) or 0) <= 12:
        recommendations.append("Offer a proactive onboarding or service check-in during the early customer journey.")
    if float(get_value("MonthlyCharges", 0) or 0) >= 80:
        recommendations.append("Review the bill and available plan options together; avoid assuming a discount is the right remedy.")
    if get_value("TechSupport") == "No" and get_value("InternetService") != "No":
        recommendations.append("Check for unresolved technical issues and explain support options.")
    if get_value("PaymentMethod") == "Electronic check":
        recommendations.append("Offer to review convenient payment choices and confirm the current billing setup works.")
    if not recommendations:
        recommendations.append("Ask about the customer's priorities and use the risk score as a prompt for a personal check-in.")
    return recommendations


def _clean_record(row):
    result = {}
    for key, value in row.items():
        if pd.isna(value):
            result[key] = None
        elif hasattr(value, "item"):
            result[key] = value.item()
        else:
            result[key] = value
    return result
