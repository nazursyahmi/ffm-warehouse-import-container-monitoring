from datetime import date
from pathlib import Path
import unittest
import pandas as pd
from streamlit.testing.v1 import AppTest
from services.data_validation import normalize
from services.data_loader import load_demo

APP = str(Path(__file__).resolve().parents[1] / 'app.py')
DESTINATIONS = ['Overview', 'DEM / DET Analysis', 'Lead-Time Analysis',
                'Performance Comparison', 'Root-Cause Analysis', 'Shipment Explorer']


class ApplicationTests(unittest.TestCase):
    def app(self, frame=None):
        app = AppTest.from_file(APP, default_timeout=30)
        if frame is not None:
            app.session_state['active_dataset'] = {'frame': frame, 'raw': frame.copy(),
                'issues': pd.DataFrame(), 'quarantined': pd.DataFrame(), 'name': 'test.csv',
                'demo': False, 'loaded_at': 'test snapshot', 'id': 'test', 'as_of': date(2026, 11, 16)}
        return app.run()

    def test_all_pages_have_real_content(self):
        app = self.app()
        for destination in DESTINATIONS:
            app.sidebar.radio[0].set_value(destination).run()
            self.assertFalse(app.exception, destination)
            self.assertFalse(any('Planned for Phase 3' in item.value for item in app.info))
            if destination in ['Overview', 'Lead-Time Analysis', 'Performance Comparison']:
                self.assertGreater(len(app.get('plotly_chart')), 0, destination)

    def test_optional_fields_and_empty_dataset_render_every_page(self):
        raw = pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B']})
        minimal = normalize(raw, {c: c for c in raw}).valid
        for frame in [minimal, minimal.iloc[:0]]:
            app = self.app(frame)
            self.assertFalse(app.exception)
            for destination in DESTINATIONS:
                app.sidebar.radio[0].set_value(destination).run()
                self.assertFalse(app.exception, destination)

    def test_root_causes_use_real_fields(self):
        raw = pd.DataFrame({'Container Number': ['A', 'C'], 'BL Number': ['B', 'D'],
            'Delivery Status': ['Pending', 'Pending'], 'Delivery Deadline': ['2026-11-10', '2026-11-11'],
            'Delay Category': ['Documentation', 'Documentation'], 'Root Cause': ['Missing invoice', 'Missing invoice']})
        app = self.app(normalize(raw, {c: c for c in raw}).valid)
        app.sidebar.radio[0].set_value('Root-Cause Analysis').run()
        self.assertFalse(app.exception)
        self.assertGreater(len(app.get('plotly_chart')), 0)

    def test_shipment_explorer_search(self):
        app = self.app()
        app.sidebar.radio[0].set_value('Shipment Explorer').run()
        self.assertFalse(app.exception)
        app.text_input(key='explorer_search').set_value('DEMO0000001').run()
        self.assertFalse(app.exception)
        self.assertTrue(any(len(item.value) == 1 for item in app.dataframe))

    def test_excel_export_preparation(self):
        app = self.app()
        app.sidebar.radio[0].set_value('Shipment Explorer').run()
        app.button(key='shipment_explorer_prepare').click().run()
        self.assertFalse(app.exception)
        self.assertTrue(any(item.proto.label == 'Download Excel' for item in app.get('download_button')))

    def test_configured_exposure_page(self):
        raw = pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B'],
            'DEM Deadline': ['2026-11-10'], 'Gate Out Date': ['2026-11-13'],
            'DEM Daily Rate': ['10'], 'Currency': ['MYR']})
        app = self.app(normalize(raw, {c: c for c in raw}).valid)
        app.sidebar.radio[0].set_value('DEM / DET Analysis').run()
        app.checkbox(key='DEM_flat').check().run()
        self.assertFalse(app.exception)
        self.assertTrue(any('Estimated_Charge' in item.value and item.value['Estimated_Charge'].iloc[0] == 30 for item in app.dataframe))

    def test_dataset_activation_resets_filters_and_rules(self):
        # Run the actual activation callback inside a Streamlit test session.
        script = '''
import streamlit as st
from components.data_management import activate_dataset, demo_dataset
if 'done' not in st.session_state:
    st.session_state['vessels'] = ['stale']
    st.session_state['DEM_open'] = True
    activate_dataset(demo_dataset())
    st.session_state['done'] = True
st.write(st.session_state['active_dataset']['name'])
st.write('vessels' in st.session_state)
st.write('DEM_open' in st.session_state)
'''
        app = AppTest.from_string(script).run()
        self.assertFalse(app.exception)
        self.assertEqual(app.markdown[0].value, 'demo_shipments.csv')
        self.assertEqual(app.markdown[1].value, '`False`')
        self.assertEqual(app.markdown[2].value, '`False`')

    def test_pending_only_still_shows_measured_delay(self):
        raw = pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B'],
            'Delivery Status': ['Pending'], 'Arrival Date': ['2026-11-01'], 'Delivery Deadline': ['2026-11-10']})
        app = self.app(normalize(raw, {c: c for c in raw}).valid)
        app.sidebar.radio[0].set_value('Lead-Time Analysis').run()
        self.assertFalse(app.exception)
        self.assertTrue(any('Delay (days)' in item.value and item.value['Delay (days)'].iloc[0] == 6 for item in app.dataframe))
