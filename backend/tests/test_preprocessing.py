import unittest

import pandas as pd

from app.ml.preprocessing import build_preprocessor, clean_dataset


class PreprocessingTests(unittest.TestCase):
    def setUp(self):
        self.frame = pd.DataFrame(
            [
                {"customerID": "A", "gender": "Female", "SeniorCitizen": 0, "tenure": 2, "MonthlyCharges": 70.0, "TotalCharges": "140", "Contract": "Month-to-month", "Churn": "Yes"},
                {"customerID": "B", "gender": "Male", "SeniorCitizen": 1, "tenure": 8, "MonthlyCharges": 50.0, "TotalCharges": "400", "Contract": "One year", "Churn": "No"},
                {"customerID": "C", "gender": "Female", "SeniorCitizen": 0, "tenure": 0, "MonthlyCharges": 25.0, "TotalCharges": " ", "Contract": "Month-to-month", "Churn": "Yes"},
                {"customerID": "B", "gender": "Male", "SeniorCitizen": 1, "tenure": 8, "MonthlyCharges": 50.0, "TotalCharges": "400", "Contract": "One year", "Churn": "No"},
            ]
        )

    def test_cleaning_drops_duplicates_and_keeps_missing_numeric_for_imputation(self):
        features, labels = clean_dataset(self.frame)
        self.assertEqual(len(features), 3)
        self.assertEqual(labels.tolist(), [1, 0, 1])
        self.assertNotIn("customerID", features.columns)
        self.assertNotIn("Churn", features.columns)
        self.assertTrue(pd.isna(features.loc[2, "TotalCharges"]))

    def test_preprocessor_handles_missing_values_and_unseen_categories(self):
        features, labels = clean_dataset(self.frame)
        pipeline = build_preprocessor(features)
        transformed = pipeline.fit_transform(features, labels)
        self.assertEqual(transformed.shape[0], 3)
        unseen = features.iloc[[0]].copy()
        unseen.loc[:, "Contract"] = "Long-term"
        self.assertEqual(pipeline.transform(unseen).shape[0], 1)


if __name__ == "__main__":
    unittest.main()
