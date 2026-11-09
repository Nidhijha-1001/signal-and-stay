from typing import Dict, List

import pandas as pd


def explain_customer(model, customer: pd.DataFrame, baseline: Dict[str, object]) -> List[Dict]:
    original_probability = float(model.predict_proba(customer)[0, 1])
    explanations = []

    for feature in customer.columns:
        reference = customer.copy()
        reference.loc[:, feature] = baseline.get(feature)
        reference_probability = float(model.predict_proba(reference)[0, 1])
        delta = original_probability - reference_probability
        explanations.append(
            {
                "feature": feature,
                "value": _json_value(customer.iloc[0][feature]),
                "baseline": _json_value(baseline.get(feature)),
                "impact": round(delta, 5),
                "direction": "increases" if delta > 0.0005 else "reduces" if delta < -0.0005 else "neutral",
            }
        )
    return sorted(explanations, key=lambda item: abs(item["impact"]), reverse=True)


def _json_value(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value
