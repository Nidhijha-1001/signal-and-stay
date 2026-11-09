from typing import Dict, Tuple

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TARGET = "Churn"
IDENTIFIER = "customerID"
NUMERIC_FEATURES = ["SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges"]


def clean_dataset(frame: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    required = {
        IDENTIFIER,
        TARGET,
        "gender",
        "SeniorCitizen",
        "tenure",
        "MonthlyCharges",
        "TotalCharges",
    }
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError("Dataset is missing required columns: " + ", ".join(missing))

    data = frame.copy().drop_duplicates()
    data["TotalCharges"] = pd.to_numeric(data["TotalCharges"], errors="coerce")
    data["SeniorCitizen"] = pd.to_numeric(data["SeniorCitizen"], errors="coerce")
    data["tenure"] = pd.to_numeric(data["tenure"], errors="coerce")
    data["MonthlyCharges"] = pd.to_numeric(data["MonthlyCharges"], errors="coerce")
    data = data.dropna(subset=[TARGET])

    labels = data.pop(TARGET).map({"No": 0, "Yes": 1})
    valid_labels = labels.notna()
    data = data.loc[valid_labels].drop(columns=[IDENTIFIER], errors="ignore")
    labels = labels.loc[valid_labels].astype(int)

    if data.empty or labels.nunique() != 2:
        raise ValueError("Dataset must contain both churn classes after cleaning.")
    if data[NUMERIC_FEATURES].isna().all(axis=None):
        raise ValueError("All numeric feature values are missing.")
    return data.reset_index(drop=True), labels.reset_index(drop=True)


def build_preprocessor(features: pd.DataFrame) -> ColumnTransformer:
    numeric = [name for name in NUMERIC_FEATURES if name in features.columns]
    categorical = [name for name in features.columns if name not in numeric]

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, numeric),
            ("categorical", categorical_pipeline, categorical),
        ],
        remainder="drop",
    )


def baseline_values(features: pd.DataFrame) -> Dict[str, object]:
    baseline = {}
    for column in features.columns:
        if column in NUMERIC_FEATURES:
            baseline[column] = float(features[column].median())
        else:
            modes = features[column].mode(dropna=True)
            baseline[column] = modes.iloc[0] if not modes.empty else "Unknown"
    return baseline
