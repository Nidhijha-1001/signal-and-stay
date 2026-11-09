from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "churn_model.joblib"
METRICS_PATH = ARTIFACTS_DIR / "model_performance.json"
IMPORTANCE_PATH = ARTIFACTS_DIR / "feature_importance.json"
CUSTOMERS_PATH = ARTIFACTS_DIR / "scored_customers.csv"
EDA_PATH = ARTIFACTS_DIR / "eda_summary.json"
DATASET_URL = (
    "https://raw.githubusercontent.com/IBM/telco-customer-churn-on-icp4d/"
    "d5371f5d83a446ad5673cbcca3b814b926491f8a/data/Telco-Customer-Churn.csv"
)
