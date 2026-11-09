import unittest

import pandas as pd

from app.service import _tenure_bands


class ServiceTests(unittest.TestCase):
    def test_tenure_bands_omit_empty_groups_instead_of_emitting_nan(self):
        customers = pd.DataFrame(
            {
                "tenure": [1, 3, 10],
                "ActualChurn": ["Yes", "No", "Yes"],
            }
        )
        bands = _tenure_bands(customers)
        self.assertEqual([item["name"] for item in bands], ["0–6 mo", "7–12 mo"])
        self.assertTrue(all(0 <= item["churn_rate"] <= 1 for item in bands))


if __name__ == "__main__":
    unittest.main()
