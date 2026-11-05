import copy
from datetime import date
import math
import unittest

from demo_data import dataset
from recommend import baseline, clean_records, features, forecast


class ForecastTests(unittest.TestCase):
    def setUp(self):
        self.menu = dataset()['menus'][0]

    def test_future_target_rows_cannot_change_forecast(self):
        expected = forecast(self.menu, '2026-11-04')
        self.menu['records'].append({'productionDate': '2026-11-04', 'producedQuantity': 99999, 'soldQuantity': 99999, 'surplusQuantity': 0})
        actual = forecast(self.menu, '2026-11-04')
        self.assertEqual(expected['recommendation']['predictedDemand'], actual['recommendation']['predictedDemand'])
        self.assertEqual(expected['forestMAE'], actual['forestMAE'])

    def test_features_use_only_prior_history(self):
        rows = self.menu['records']
        history = rows[:20]
        before = features(history, date.fromisoformat(rows[20]['productionDate']))
        rows[20]['soldQuantity'] = 99999
        self.assertEqual(before, features(history, date.fromisoformat(rows[20]['productionDate'])))

    def test_chronological_evaluation_and_quantity(self):
        result = forecast(self.menu, '2026-11-04')
        self.assertEqual(result['testObservations'], 7)
        self.assertLess(result['testEnd'], result['targetDate'])
        self.assertEqual(result['testStart'], self.menu['records'][-7]['productionDate'])
        expected = 'random-forest-v1' if result['validationForestMAE'] < result['validationBaselineMAE'] else 'weekday-v1'
        self.assertEqual(result['recommendation']['modelVersion'], expected)
        self.assertEqual(result['recommendation']['recommendedQuantity'], math.ceil(result['recommendation']['predictedDemand']))

    def test_insufficient_history_and_duplicate_rejection(self):
        self.menu['records'] = self.menu['records'][:34]
        self.assertEqual(forecast(self.menu, '2026-11-04')['status'], 'insufficient-history')
        self.menu['records'].append(copy.deepcopy(self.menu['records'][0]))
        rows, rejected = clean_records(self.menu['records'], '2026-11-04')
        self.assertEqual(len(rows), 33)
        self.assertEqual(rejected, 2)

    def test_invalid_quantities_and_missing_days(self):
        rows = [dict(self.menu['records'][0], soldQuantity=-1), dict(self.menu['records'][1], soldQuantity=True),
                dict(self.menu['records'][2], producedQuantity=0, soldQuantity=0, surplusQuantity=0), self.menu['records'][8]]
        cleaned, rejected = clean_records(rows, '2026-11-04')
        self.assertEqual(rejected, 2)
        self.assertEqual(len(cleaned), 2)
        self.assertEqual(cleaned[0]['soldQuantity'], 0)

    def test_constant_sales_choose_baseline_and_zero_is_valid(self):
        for record in self.menu['records']:
            record.update(producedQuantity=0, soldQuantity=0, surplusQuantity=0)
        result = forecast(self.menu, '2026-11-04')
        self.assertEqual(result['recommendation']['modelVersion'], 'weekday-v1')
        self.assertEqual(result['recommendation']['recommendedQuantity'], 0)
        self.assertEqual(result['selectedMAE'], 0)

    def test_menu_isolation(self):
        other = dataset()['menus'][1]
        first = forecast(self.menu, '2026-11-04')
        for record in other['records']:
            record['soldQuantity'] = 9999
        self.assertEqual(first, forecast(self.menu, '2026-11-04'))


if __name__ == '__main__':
    unittest.main()
