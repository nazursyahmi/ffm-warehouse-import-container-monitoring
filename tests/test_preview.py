"""Small executable checks for the authorized UI prototype, not production QA."""
from datetime import date
from pathlib import Path
import unittest
from streamlit.testing.v1 import AppTest
from services.data_loader import load_demo
from services.calculations import metrics


class PreviewSmokeTests(unittest.TestCase):
    def test_demo_and_empty_metrics(self):
        frame = load_demo()
        values = metrics(frame, date(2026, 11, 16))
        self.assertEqual(values['Total Containers'], 24)
        self.assertEqual(values['Delivered Containers'], 15)
        self.assertEqual(values['Pending Containers'], 9)
        self.assertEqual(values['Delivery Rate'], '62.5%')
        self.assertEqual(values['Overdue Containers'], 3)
        self.assertEqual(values['Approaching Deadline'], 6)
        self.assertEqual(metrics(frame, date(2026, 11, 16), 0)['Approaching Deadline'], 3)
        self.assertEqual(metrics(frame.iloc[:0], date(2026, 11, 16))['Delivery Rate'], 'Not Available')

    def test_interactive_preview(self):
        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / 'app.py'), default_timeout=20).run()
        self.assertFalse(app.exception)
        self.assertEqual(len(app.dataframe[1].value), 24)
        app.sidebar.multiselect[0].select('Demo Meridian').run()
        self.assertFalse(app.exception)
        self.assertEqual(len(app.dataframe[1].value), 8)
        app.sidebar.radio[0].set_value('Overview').run()
        self.assertFalse(app.exception)
        for destination in ['DEM / DET Analysis', 'Lead-Time Analysis',
                'Performance Comparison', 'Root-Cause Analysis', 'Shipment Explorer']:
            app.sidebar.radio[0].set_value(destination).run()
            self.assertFalse(app.exception)
        app.sidebar.radio[0].set_value('Container Monitoring').run()
        self.assertEqual(len(app.dataframe[1].value), 8)
        app.sidebar.button[0].click().run()
        self.assertEqual(len(app.dataframe[1].value), 24)
        app.text_input[0].set_value('NO-MATCH').run()
        self.assertEqual(len(app.dataframe[1].value), 0)
        app.sidebar.multiselect[0].select('Demo Meridian').run()
        app.sidebar.multiselect[1].select('DEMO-BL-002').run()
        self.assertFalse(app.exception)
        self.assertTrue(any('No containers match' in item.value for item in app.info))


if __name__ == '__main__':
    unittest.main()
