"""Shared table rendering, literal search and bounded export preparation."""
import streamlit as st
from services.exports import csv_bytes, excel_bytes


def search_frame(frame, text):
    if not text:
        return frame
    return frame[frame.astype(str).apply(lambda col: col.str.contains(text, case=False, regex=False)).any(axis=1)]


def table(frame, key, height='auto'):
    dates = {column: st.column_config.DateColumn(column, format='DD MMM YYYY')
             for column in frame if str(frame[column].dtype).startswith('datetime64')}
    st.dataframe(frame, hide_index=True, width='stretch', height=height, column_config=dates, key=key)


def downloads(frame, key):
    st.caption('Exports contain all matching rows, independent of table pagination. Spreadsheet formula-like text is escaped for safety. Original source values remain unchanged.')
    a, b = st.columns(2)
    a.download_button('Download CSV', csv_bytes(frame), f'ffm_{key}.csv', 'text/csv', key=f'{key}_csv')
    if b.button('Prepare Excel download', key=f'{key}_prepare'):
        with st.spinner('Preparing Excel workbook…'):
            payload = excel_bytes(frame)
        b.download_button('Download Excel', payload, f'ffm_{key}.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', key=f'{key}_xlsx')
