import json
from pathlib import Path
from typing import Dict

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

sns.set_theme(style="whitegrid", palette=["#ed725c", "#90aa9b"])


def generate_eda(data: pd.DataFrame, labels: pd.Series, output_dir: Path) -> Dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    frame = data.copy()
    frame["Churn"] = labels.map({0: "No", 1: "Yes"})
    total = len(frame)
    churn_rate = float(labels.mean())

    summary = {
        "row_count": total,
        "feature_count": int(data.shape[1]),
        "churn_count": int(labels.sum()),
        "retained_count": int(total - labels.sum()),
        "churn_rate": churn_rate,
        "missing_values": {
            str(name): int(count)
            for name, count in data.isna().sum().items()
            if count > 0
        },
        "duplicates_removed": 0,
        "churn_by_gender": _rate_by(frame, "gender"),
        "churn_by_contract": _rate_by(frame, "Contract"),
        "churn_by_payment_method": _rate_by(frame, "PaymentMethod"),
        "churn_by_internet_service": _rate_by(frame, "InternetService"),
        "tenure_by_churn": _distribution_by(frame, "tenure"),
        "monthly_charges_by_churn": _distribution_by(frame, "MonthlyCharges"),
        "service_churn_rates": {
            column: _rate_by(frame, column)
            for column in [
                "OnlineSecurity",
                "OnlineBackup",
                "DeviceProtection",
                "TechSupport",
                "StreamingTV",
                "StreamingMovies",
            ]
            if column in frame.columns
        },
        "numeric_correlation": data.select_dtypes(include="number")
        .assign(Churn=labels)
        .corr()
        .round(3)
        .to_dict(),
    }
    _write_charts(frame, labels, output_dir)
    (output_dir.parent / "eda_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    return summary


def _rate_by(frame: pd.DataFrame, column: str) -> Dict[str, float]:
    if column not in frame.columns:
        return {}
    return {
        str(key): round(float(value), 4)
        for key, value in frame.groupby(column, dropna=False)["Churn"]
        .apply(lambda values: (values == "Yes").mean())
        .items()
    }


def _distribution_by(frame: pd.DataFrame, column: str) -> Dict[str, Dict[str, float]]:
    return {
        str(key): {
            "mean": round(float(values.mean()), 2),
            "median": round(float(values.median()), 2),
        }
        for key, values in frame.groupby("Churn")[column]
    }


def _write_charts(frame: pd.DataFrame, labels: pd.Series, output_dir: Path) -> None:
    _countplot(frame, "Churn", "Customer churn distribution", output_dir / "churn-distribution.png")
    _countplot(frame, "Contract", "Churn by contract type", output_dir / "churn-by-contract.png", hue="Churn")
    _countplot(frame, "PaymentMethod", "Churn by payment method", output_dir / "churn-by-payment.png", hue="Churn", rotate=20)
    _countplot(frame, "gender", "Churn by gender", output_dir / "churn-by-gender.png", hue="Churn")

    fig, axis = plt.subplots(figsize=(8, 4.5))
    sns.histplot(data=frame, x="tenure", hue="Churn", bins=24, multiple="stack", ax=axis)
    axis.set(title="Customer tenure", xlabel="Months with service", ylabel="Customers")
    _save(fig, output_dir / "tenure-distribution.png")

    fig, axis = plt.subplots(figsize=(8, 4.5))
    sns.boxplot(data=frame, x="Churn", y="MonthlyCharges", ax=axis)
    axis.set(title="Monthly charges by churn outcome", xlabel="Churned", ylabel="Monthly charges")
    _save(fig, output_dir / "monthly-charges-by-churn.png")

    service_columns = [
        column
        for column in [
            "OnlineSecurity",
            "OnlineBackup",
            "DeviceProtection",
            "TechSupport",
            "StreamingTV",
            "StreamingMovies",
        ]
        if column in frame.columns
    ]
    rates = []
    for column in service_columns:
        for value, group in frame.groupby(column):
            rates.append(
                {
                    "Service": column,
                    "Status": str(value),
                    "Churn rate": (group["Churn"] == "Yes").mean(),
                }
            )
    if rates:
        fig, axis = plt.subplots(figsize=(10, 5))
        sns.barplot(data=pd.DataFrame(rates), x="Service", y="Churn rate", hue="Status", ax=axis)
        axis.set(title="Service adoption and churn", xlabel="", ylabel="Churn rate")
        axis.tick_params(axis="x", rotation=20)
        _save(fig, output_dir / "service-patterns.png")

    numeric = frame.select_dtypes(include="number").copy()
    numeric["Churn"] = labels.values
    fig, axis = plt.subplots(figsize=(7, 5))
    sns.heatmap(numeric.corr(), annot=True, fmt=".2f", cmap="vlag", center=0, ax=axis)
    axis.set(title="Numeric feature correlation")
    _save(fig, output_dir / "correlation-heatmap.png")


def _countplot(
    frame: pd.DataFrame,
    column: str,
    title: str,
    path: Path,
    hue: str = None,
    rotate: int = 0,
) -> None:
    fig, axis = plt.subplots(figsize=(9, 4.5))
    sns.countplot(data=frame, x=column, hue=hue, ax=axis)
    axis.set(title=title, xlabel="", ylabel="Customers")
    axis.tick_params(axis="x", rotation=rotate)
    _save(fig, path)


def _save(fig, path: Path) -> None:
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
