from datetime import date
import unittest
import pandas as pd
from services import calculations as calc
from services import data_validation as validation


class CalculationTests(unittest.TestCase):
    def frame(self, **fields):
        raw = pd.DataFrame({'Container Number': ['A', 'C'], 'BL Number': ['B', 'D'], **fields})
        return validation.normalize(raw, {c: c for c in raw}).valid

    def test_lead_time_excludes_missing_and_negative(self):
        frame = self.frame(**{'Arrival Date': ['2026-11-01', '2026-11-02'],
            'Delivery Date': ['2026-11-05', None], 'Delivery Status': ['Delivered', 'Pending']})
        lead = calc.lead_times(frame)
        self.assertEqual(lead.dropna().tolist(), [4])

    def test_deadline_inclusive_today_and_unknown_status(self):
        frame = self.frame(**{'Delivery Status': ['Pending', 'Mystery'],
            'Delivery Deadline': ['2026-11-16', '2026-11-01']})
        values = calc.metrics(frame, date(2026, 11, 16), 0)
        self.assertEqual(values['Pending Containers'], 1)
        self.assertEqual(values['Overdue Containers'], 0)
        self.assertEqual(values['Approaching Deadline'], 1)

    def test_no_tariff_no_invented_charge(self):
        frame = self.frame(**{'DEM Deadline': ['2026-11-10', None]})
        result = calc.exposure(frame, 'DEM', date(2026, 11, 16))
        self.assertTrue(result['Estimated Charge'].isna().all())
        self.assertEqual(result.iloc[0]['Remaining Free Days'], -6)

    def test_flat_charge_with_known_end_never_uses_future_dates(self):
        frame = self.frame(**{'DEM Deadline': ['2026-11-10', '2026-11-10'],
            'Gate Out Date': ['2026-11-13', '2026-11-20'],
            'DEM Daily Rate': [10, 10], 'Currency': ['MYR', 'USD']})
        result = calc.exposure(frame, 'DEM', date(2026, 11, 16), flat_tariff=True, assume_open=True)
        self.assertEqual(result.iloc[0]['Estimated Charge'], 30)
        self.assertTrue(pd.isna(result.iloc[1]['Estimated Charge']))

    def test_configured_free_days_and_open_state(self):
        frame = self.frame(**{'Gate Out Date': ['2026-11-10', '2026-11-10'],
            'DET Daily Rate': [10, 10], 'Currency': ['MYR', 'MYR']})
        unknown = calc.exposure(frame, 'DET', date(2026, 11, 16), free_days=3, flat_tariff=True)
        self.assertTrue(unknown['Estimated Charge'].isna().all())
        known = calc.exposure(frame, 'DET', date(2026, 11, 16), free_days=3, flat_tariff=True, assume_open=True)
        self.assertEqual(known.iloc[0]['Deadline'], pd.Timestamp('2026-11-13'))
        self.assertEqual(known.iloc[0]['Estimated Charge'], 30)

    def test_delay_uses_target_and_actual_delivery(self):
        frame = self.frame(**{'Delivery Status': ['Delivered', 'Pending'],
            'Delivery Date': ['2026-11-12', None], 'Delivery Deadline': ['2026-11-10', '2026-11-15']})
        self.assertEqual(calc.delay_days(frame, date(2026, 11, 16)).tolist(), [2, 1])

    def test_future_start_or_deadline_before_start_withholds_exposure(self):
        frame = self.frame(**{'Gate Out Date': ['2026-11-20', '2026-11-12'],
            'DET Deadline': ['2026-11-10', '2026-11-10'],
            'DET Daily Rate': [10, 10], 'Currency': ['MYR', 'MYR']})
        result = calc.exposure(frame, 'DET', date(2026, 11, 16), flat_tariff=True, assume_open=True)
        self.assertTrue(result['Estimated Charge'].isna().all())
        self.assertTrue(result['Remaining Free Days'].isna().all())
        self.assertTrue(result['Exposure State'].str.contains('unknown').all())
