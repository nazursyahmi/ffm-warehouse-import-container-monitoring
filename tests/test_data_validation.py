from io import BytesIO
import unittest
import pandas as pd
from services import data_validation as validation
from services import data_loader
from services import exports


class ValidationTests(unittest.TestCase):
    def normalize(self, frame, **kwargs):
        return validation.normalize(frame, {c: c for c in frame.columns}, **kwargs)

    def test_explicit_mapping_preserves_source(self):
        raw = pd.DataFrame({'Box': ['A'], 'Bill': ['B'], 'State': ['Done'], 'When': ['31/01/2026']})
        original = raw.copy(deep=True)
        result = validation.normalize(raw, {'Container Number': 'Box', 'BL Number': 'Bill',
            'Delivery Status': 'State', 'Arrival Date': 'When'}, date_format='%d/%m/%Y',
            status_map={'Done': 'Delivered'})
        pd.testing.assert_frame_equal(raw, original)
        self.assertEqual(result.valid.iloc[0]['Delivery Status'], 'Delivered')
        self.assertEqual(result.valid.iloc[0]['Arrival Date'], pd.Timestamp('2026-01-31'))

    def test_missing_required_columns_blocks_activation(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A']}))
        self.assertTrue(result.blockers)
        self.assertTrue(result.valid.empty)

    def test_duplicate_keys_quarantine_every_conflicting_row(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A', 'A', 'C'], 'BL Number': ['B', 'B', 'D']}))
        self.assertEqual(len(result.valid), 1)
        self.assertEqual(len(result.quarantined), 2)
        self.assertTrue(result.issues['Issue'].str.contains('Duplicate').any())

    def test_invalid_date_and_missing_key_are_reported(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A', None, 'C'],
            'BL Number': ['B', 'B', 'D'], 'Arrival Date': ['2026-02-30', '', '2026-01-01']}))
        self.assertEqual(len(result.valid), 1)
        self.assertEqual(len(result.quarantined), 2)

    def test_unknown_status_is_not_pending(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B'], 'Delivery Status': ['Mystery']}))
        self.assertEqual(result.valid.iloc[0]['Delivery Status'], 'Unknown')
        self.assertFalse(result.issues.empty)

    def test_negative_lead_time_is_quarantined(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B'],
            'Arrival Date': ['2026-02-02'], 'Delivery Date': ['2026-02-01']}))
        self.assertTrue(result.valid.empty)
        self.assertEqual(len(result.quarantined), 1)

    def test_empty_file_and_duplicate_headers_rejected(self):
        for content in [b'', b'A,A\n1,2\n']:
            with self.assertRaises(ValueError):
                data_loader.read_upload(content, 'test.csv')

    def test_csv_excel_round_trip_and_formula_safety(self):
        raw = pd.DataFrame({'Container Number': ['=1+1', '000001'], 'BL Number': ['B', 'C']})
        for name, payload in [('test.csv', exports.csv_bytes(raw)), ('test.xlsx', exports.excel_bytes(raw))]:
            loaded = data_loader.read_upload(payload, name)
            self.assertEqual(str(loaded.iloc[1]['Container Number']), '000001')
            self.assertEqual(loaded.iloc[0]['Container Number'], "'=1+1")
        self.assertEqual(raw.iloc[0]['Container Number'], '=1+1')

    def test_incomplete_dataset_has_complete_optional_schema(self):
        result = self.normalize(pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B']}))
        self.assertFalse(result.blockers)
        self.assertIn('DEM Deadline', result.valid)
        self.assertTrue(result.valid['DEM Deadline'].isna().all())

    def test_csv_mismatched_row_width_is_rejected_without_losing_values(self):
        with self.assertRaises(ValueError):
            data_loader.read_upload(b'Container Number,BL Number\nA,B,EXTRA\n', 'bad.csv')

    def test_empty_source_rows_are_reported_not_silently_removed(self):
        raw = data_loader.read_upload(b'Container Number,BL Number\nA,B\n\nC,D\n', 'blanks.csv')
        result = self.normalize(raw)
        self.assertEqual(len(raw), 3)
        self.assertEqual(len(result.quarantined), 1)
        self.assertIn(3, result.issues['Source Row'].tolist())

    def test_excel_multiple_sheets_and_invalid_workbook(self):
        from io import BytesIO
        payload = BytesIO()
        with pd.ExcelWriter(payload, engine='openpyxl') as writer:
            pd.DataFrame({'Wrong': [1]}).to_excel(writer, index=False, sheet_name='Cover')
            pd.DataFrame({'Container Number': ['0001'], 'BL Number': ['B']}).to_excel(writer, index=False, sheet_name='Data')
        self.assertEqual(data_loader.excel_sheets(payload.getvalue()), ['Cover', 'Data'])
        self.assertEqual(data_loader.read_upload(payload.getvalue(), 'book.xlsx', 'Data').iloc[0, 0], '0001')
        with self.assertRaises(ValueError):
            data_loader.read_upload(b'not an excel workbook', 'bad.xlsx')

    def test_header_only_file_and_negative_rates(self):
        with self.assertRaises(ValueError):
            data_loader.read_upload(b'Container Number,BL Number\n', 'empty.csv')
        result = self.normalize(pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B'], 'DEM Daily Rate': ['-10']}))
        self.assertEqual(len(result.quarantined), 1)

    def test_corrupt_excel_xml_reports_readable_error(self):
        from zipfile import ZipFile
        original = exports.excel_bytes(pd.DataFrame({'Container Number': ['A'], 'BL Number': ['B']}))
        corrupt = BytesIO()
        with ZipFile(BytesIO(original)) as source, ZipFile(corrupt, 'w') as target:
            for item in source.infolist():
                target.writestr(item.filename, b'<broken' if item.filename == 'xl/workbook.xml' else source.read(item.filename))
        with self.assertRaises(ValueError):
            data_loader.read_upload(corrupt.getvalue(), 'broken.xlsx')
        with self.assertRaises(ValueError):
            data_loader.excel_sheets(corrupt.getvalue())

    def test_export_headers_cannot_execute_spreadsheet_formulas(self):
        from openpyxl import load_workbook
        frame = pd.DataFrame({'=1+1': ['value']})
        self.assertIn("'=1+1", exports.csv_bytes(frame).decode('utf-8-sig'))
        book = load_workbook(BytesIO(exports.excel_bytes(frame)))
        self.assertEqual(book.active['A1'].data_type, 's')
        self.assertEqual(book.active['A1'].value, "'=1+1")
        book.close()
