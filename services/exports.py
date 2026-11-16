"""Spreadsheet-safe exports; source values are not changed in memory."""
from io import BytesIO
import pandas as pd


def safe_frame(frame):
    def protect(value):
        if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')):
            return "'" + value
        return value
    result = frame.map(protect)
    result.columns = [protect(column) for column in result.columns]
    return result


def csv_bytes(frame):
    return safe_frame(frame).to_csv(index=False, date_format='%Y-%m-%d').encode('utf-8-sig')


def excel_bytes(frame):
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl', datetime_format='YYYY-MM-DD') as writer:
        safe_frame(frame).to_excel(writer, index=False, sheet_name='Shipments')
        sheet = writer.sheets['Shipments']
        sheet.freeze_panes = 'A2'
        sheet.auto_filter.ref = sheet.dimensions
    return output.getvalue()
