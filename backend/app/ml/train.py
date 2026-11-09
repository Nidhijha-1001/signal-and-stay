import argparse
import json
import logging
import shutil
from pathlib import Path
from urllib.request import urlopen

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    fbeta_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    GridSearchCV,
    StratifiedKFold,
    cross_val_predict,
    train_test_split,
)
from sklearn.pipeline import Pipeline

from app.config import (
    ARTIFACTS_DIR,
    DATASET_URL,
    EDA_PATH,
    IMPORTANCE_PATH,
    METRICS_PATH,
    MODEL_PATH,
    RAW_DATA_DIR,
)
from app.ml.eda import generate_eda
from app.ml.preprocessing import baseline_values, build_preprocessor, clean_dataset

RANDOM_STATE = 42
LOGGER = logging.getLogger("churn.train")


def download_dataset(destination: Path, force: bool = False) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not force:
        LOGGER.info("Using existing dataset: %s", destination)
        return destination
    LOGGER.info("Downloading IBM Telco Customer Churn dataset")
    temporary_path = destination.with_suffix(destination.suffix + ".part")
    try:
        with urlopen(DATASET_URL, timeout=30) as response:
            with temporary_path.open("wb") as output:
                shutil.copyfileobj(response, output)
        temporary_path.replace(destination)
    except Exception as error:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError(
            "Could not download the dataset. Download the IBM Telco Customer Churn CSV "
            "and save it to %s, then rerun training." % destination
        ) from error
    return destination


def _load_xgb_classifier():
    try:
        from xgboost import XGBClassifier
    except Exception as error:
        raise RuntimeError(
            "XGBoost could not load its native runtime. On macOS, install OpenMP with "
            "'brew install libomp', then rerun training."
        ) from error
    return XGBClassifier


def _model_searches(preprocessor, positive_weight: float, xgb_classifier):
    common = {"preprocessor": preprocessor}
    return {
        "Logistic Regression": (
            Pipeline(
                [
                    ("preprocessor", common["preprocessor"]),
                    ("model", LogisticRegression(class_weight="balanced", max_iter=1500, random_state=RANDOM_STATE)),
                ]
            ),
            {"model__C": [0.1, 1.0, 5.0]},
        ),
        "Random Forest": (
            Pipeline(
                [
                    ("preprocessor", common["preprocessor"]),
                    (
                        "model",
                        RandomForestClassifier(
                            class_weight="balanced_subsample",
                            n_estimators=250,
                            random_state=RANDOM_STATE,
                            n_jobs=1,
                        ),
                    ),
                ]
            ),
            {"model__max_depth": [None, 14], "model__min_samples_leaf": [2, 5]},
        ),
        "XGBoost": (
            Pipeline(
                [
                    ("preprocessor", common["preprocessor"]),
                    (
                        "model",
                        xgb_classifier(
                            eval_metric="logloss",
                            scale_pos_weight=positive_weight,
                            random_state=RANDOM_STATE,
                            n_jobs=1,
                            verbosity=0,
                        ),
                    ),
                ]
            ),
            {
                "model__n_estimators": [180],
                "model__max_depth": [3, 5],
                "model__learning_rate": [0.05, 0.1],
            },
        ),
    }


def _select_threshold(labels, probabilities) -> float:
    thresholds = np.unique(np.concatenate(([0.05], probabilities, [0.95])))
    scores = [
        fbeta_score(labels, probabilities >= threshold, beta=2, zero_division=0)
        for threshold in thresholds
    ]
    return float(thresholds[int(np.argmax(scores))])


def _evaluate(labels, probabilities, threshold: float):
    predictions = probabilities >= threshold
    fpr, tpr, _ = roc_curve(labels, probabilities)
    precision, recall, _ = precision_recall_curve(labels, probabilities)
    return {
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1": float(fbeta_score(labels, predictions, beta=1, zero_division=0)),
        "f2": float(fbeta_score(labels, predictions, beta=2, zero_division=0)),
        "roc_auc": float(roc_auc_score(labels, probabilities)),
        "pr_auc": float(average_precision_score(labels, probabilities)),
        "threshold": threshold,
        "confusion_matrix": confusion_matrix(labels, predictions, labels=[0, 1]).tolist(),
        "roc_curve": {
            "false_positive_rate": fpr.tolist(),
            "true_positive_rate": tpr.tolist(),
        },
        "precision_recall_curve": {
            "precision": precision.tolist(),
            "recall": recall.tolist(),
        },
    }


def train(dataset_path: Path, force_download: bool = False) -> None:
    xgb_classifier = _load_xgb_classifier()
    dataset_path = download_dataset(dataset_path, force=force_download)
    raw = pd.read_csv(dataset_path)
    duplicate_count = int(raw.duplicated().sum())
    cleaned_raw = raw.drop_duplicates().reset_index(drop=True)
    data, labels = clean_dataset(raw)
    valid_rows = cleaned_raw["Churn"].isin(["No", "Yes"])
    customer_ids = cleaned_raw.loc[valid_rows, "customerID"].astype(str).reset_index(drop=True)
    if len(customer_ids) != len(data):
        raise ValueError("Customer identifiers could not be aligned with cleaned training records.")
    if len(data) < 100:
        raise ValueError("At least 100 valid customer records are required for training.")

    eda = generate_eda(data, labels, ARTIFACTS_DIR / "eda")
    eda["duplicates_removed"] = duplicate_count
    EDA_PATH.write_text(json.dumps(eda, indent=2), encoding="utf-8")

    X_train, X_test, y_train, y_test = train_test_split(
        data,
        labels,
        test_size=0.2,
        stratify=labels,
        random_state=RANDOM_STATE,
    )
    preprocessor = build_preprocessor(X_train)
    positives = int(y_train.sum())
    negatives = int(len(y_train) - positives)
    positive_weight = negatives / max(positives, 1)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    comparison = {}
    fitted_searches = {}
    for name, (pipeline, parameters) in _model_searches(preprocessor, positive_weight, xgb_classifier).items():
        LOGGER.info("Tuning %s", name)
        search = GridSearchCV(
            pipeline,
            parameters,
            scoring="recall",
            cv=cv,
            refit=True,
            n_jobs=-1,
            return_train_score=False,
        )
        search.fit(X_train, y_train)
        out_of_fold = cross_val_predict(
            search.best_estimator_,
            X_train,
            y_train,
            cv=cv,
            method="predict_proba",
            n_jobs=-1,
        )[:, 1]
        threshold = _select_threshold(y_train.to_numpy(), out_of_fold)
        test_probabilities = search.best_estimator_.predict_proba(X_test)[:, 1]
        metrics = _evaluate(y_test.to_numpy(), test_probabilities, threshold)
        metrics["cv_recall"] = float(search.best_score_)
        metrics["cv_f2_at_0_5"] = float(
            fbeta_score(y_train, out_of_fold >= 0.5, beta=2, zero_division=0)
        )
        metrics["cv_roc_auc"] = float(roc_auc_score(y_train, out_of_fold))
        metrics["best_parameters"] = {
            key.replace("model__", ""): value for key, value in search.best_params_.items()
        }
        comparison[name] = metrics
        fitted_searches[name] = {
            "estimator": search.best_estimator_,
            "threshold": threshold,
            "out_of_fold": out_of_fold,
            "test_probabilities": test_probabilities,
        }
        LOGGER.info(
            "%s: recall=%.3f F2=%.3f ROC-AUC=%.3f",
            name,
            metrics["recall"],
            metrics["f2"],
            metrics["roc_auc"],
        )

    best_name = max(
        comparison,
        key=lambda name: (
            comparison[name]["cv_recall"],
            comparison[name]["cv_f2_at_0_5"],
            comparison[name]["cv_roc_auc"],
        ),
    )
    best = fitted_searches[best_name]
    importance = _permutation_importance(best["estimator"], X_test, y_test)
    serving_model = best["estimator"]
    serving_model.fit(data, labels)
    model_baseline = baseline_values(data)

    scored = data.copy()
    scored.insert(0, "customerID", customer_ids.to_numpy())
    scored["ActualChurn"] = labels.map({0: "No", 1: "Yes"})
    train_indices, test_indices = train_test_split(
        np.arange(len(data)),
        test_size=0.2,
        stratify=labels,
        random_state=RANDOM_STATE,
    )
    scored["ChurnProbability"] = np.nan
    scored.loc[train_indices, "ChurnProbability"] = fitted_searches[best_name]["out_of_fold"]
    scored.loc[test_indices, "ChurnProbability"] = fitted_searches[best_name]["test_probabilities"]
    scored["PredictedChurn"] = np.where(scored["ChurnProbability"] >= best["threshold"], "Yes", "No")
    scored["RiskCategory"] = pd.cut(
        scored["ChurnProbability"],
        bins=[-np.inf, 0.25, 0.60, np.inf],
        labels=["Low", "Medium", "High"],
    ).astype(str)
    scored.to_csv(ARTIFACTS_DIR / "scored_customers.csv", index=False)

    METRICS_PATH.write_text(
        json.dumps(
            {
                "selected_model": best_name,
                "selection_criterion": "Highest mean 5-fold cross-validated recall; ties are broken by out-of-fold training F2, then ROC-AUC.",
                "threshold_policy": "Selected on out-of-fold training probabilities by maximizing F2, which weights recall more heavily than precision.",
                "holdout_size": len(X_test),
                "dataset_size": len(data),
                "models": comparison,
                "summary": {
                    name: {
                        key: metrics[key]
                        for key in ["accuracy", "precision", "recall", "f1", "f2", "roc_auc", "pr_auc", "cv_recall", "cv_f2_at_0_5", "threshold"]
                    }
                    for name, metrics in comparison.items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    IMPORTANCE_PATH.write_text(json.dumps(importance, indent=2), encoding="utf-8")
    model_dir = ARTIFACTS_DIR / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    for name, result in fitted_searches.items():
        slug = name.lower().replace(" ", "_")
        joblib.dump(
            {
                "model": result["estimator"],
                "threshold": result["threshold"],
                "baseline": model_baseline,
                "features": list(data.columns),
                "name": name,
            },
            model_dir / (slug + ".joblib"),
        )
    joblib.dump(
        {
            "model": serving_model,
            "threshold": best["threshold"],
            "baseline": model_baseline,
            "features": list(data.columns),
            "selected_model": best_name,
        },
        MODEL_PATH,
    )
    LOGGER.info("Training complete. Selected model: %s", best_name)


def _permutation_importance(model, X_test, y_test):
    from sklearn.inspection import permutation_importance

    result = permutation_importance(
        model,
        X_test,
        y_test,
        scoring="roc_auc",
        n_repeats=5,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    ranked = sorted(
        [
            {
                "feature": str(feature),
                "importance": float(importance),
                "std": float(deviation),
            }
            for feature, importance, deviation in zip(
                X_test.columns, result.importances_mean, result.importances_std
            )
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    return {"method": "Permutation importance (holdout ROC-AUC decrease)", "features": ranked}


def main():
    parser = argparse.ArgumentParser(description="Train the churn models and generate evaluation artifacts.")
    parser.add_argument("--data", type=Path, default=RAW_DATA_DIR / "telco_customer_churn.csv")
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    arguments = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, arguments.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    train(arguments.data, force_download=arguments.force_download)


if __name__ == "__main__":
    main()
