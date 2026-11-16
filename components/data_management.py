"""Session-only import staging, explicit mapping and reviewed dataset activation."""
from datetime import datetime, date
from hashlib import sha256
from zoneinfo import ZoneInfo
import pandas as pd
import streamlit as st
from components.filters import reset_filters
from services.data_loader import load_demo, read_upload, excel_sheets, ROOT
from services.data_validation import normalize, SCHEMA
from services.exports import csv_bytes


def activate_dataset(dataset):
    st.session_state['active_dataset'] = dataset
    reset_filters()
    for key in list(st.session_state):
        if key in ['as_of', 'warning_days'] or key.startswith(('DEM_', 'DET_', 'explorer_', 'inspect_', 'compare_', 'lead_', 'cause_')):
            del st.session_state[key]


def demo_dataset():
    raw = pd.read_csv(ROOT / 'data' / 'demo_shipments.csv', dtype=str)
    result = normalize(raw, {c: c for c in raw})
    return {'frame': load_demo(), 'raw': raw, 'issues': result.issues, 'quarantined': result.quarantined,
        'name': 'demo_shipments.csv', 'demo': True, 'loaded_at': datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).isoformat(timespec='seconds'),
        'as_of': date(2026, 11, 16), 'id': 'demo'}


def data_management():
    if 'active_dataset' not in st.session_state:
        st.session_state['active_dataset'] = demo_dataset()
    active = st.session_state['active_dataset']
    with st.expander('Data source · Import, map & validate'):
        st.caption('Files stay in this session. New imports replace the active dataset only after review. Counting unit: unique BL + container; all duplicate keys are quarantined.')
        st.button('Use demo dataset', on_click=activate_dataset, args=(demo_dataset(),), key='use_demo')
        uploaded = st.file_uploader('Upload CSV or Excel', type=['csv', 'xlsx'], max_upload_size=20)
        if uploaded is not None:
            content = uploaded.getvalue()
            token = sha256(content).hexdigest()
            try:
                sheet = st.selectbox('Worksheet', excel_sheets(content), key=f'sheet_{token}') if uploaded.name.lower().endswith('.xlsx') else None
                parse_key = (token, sheet)
                if st.session_state.get('parsed_upload_key') != parse_key:
                    with st.spinner('Reading upload…'):
                        st.session_state['parsed_upload'] = read_upload(content, uploaded.name, sheet)
                    st.session_state['parsed_upload_key'] = parse_key
                raw = st.session_state['parsed_upload']
            except (ValueError, TypeError) as error:
                st.error(str(error))
                return active
            st.write(f'{len(raw):,} source rows · Original column names and values')
            st.dataframe(raw.head(50), hide_index=True, width='stretch')
            st.caption('Preview shows the first 50 source rows. Map fields explicitly; unmapped optional fields stay unavailable.')
            mapping = {}
            columns = ['(Not mapped)'] + list(raw.columns)
            for index, canonical in enumerate(SCHEMA):
                if index % 3 == 0:
                    cells = st.columns(3)
                mapping[canonical] = cells[index % 3].selectbox(canonical + (' *' if canonical in ['Container Number', 'BL Number'] else ''),
                    columns, index=columns.index(canonical) if canonical in columns else 0, key=f'map_{token}_{sheet}_{canonical}')
            fmt = st.selectbox('Text date format', ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y'], key=f'fmt_{token}')
            status_column = mapping['Delivery Status']
            states = sorted(raw[status_column].dropna().astype(str).str.strip().unique()) if status_column in raw else []
            delivered = st.multiselect('Source values meaning Delivered', states, default=['Delivered'] if 'Delivered' in states else [], key=f'delivered_{token}_{status_column}')
            pending = st.multiselect('Source values meaning Pending', states, default=['Pending'] if 'Pending' in states else [], key=f'pending_{token}_{status_column}')
            status_map = {s: 'Delivered' for s in delivered} | {s: 'Pending' for s in pending}
            signature = repr((parse_key, mapping, fmt, delivered, pending))
            if set(delivered) & set(pending):
                st.error('A source status cannot mean both Delivered and Pending.')
            elif st.button('Validate import', type='primary'):
                with st.spinner('Checking mappings, keys, dates, rates and chronology…'):
                    result = normalize(raw, mapping, date_format=fmt, status_map=status_map)
                st.session_state['staged_import'] = (signature, result)
            staged = st.session_state.get('staged_import')
            if staged and staged[0] == signature:
                result = staged[1]
                for blocker in result.blockers:
                    st.error(blocker)
                st.write(f'{len(result.valid):,} eligible · {len(result.quarantined):,} quarantined · {len(result.issues):,} validation findings')
                st.dataframe(result.issues.head(200), hide_index=True, width='stretch')
                st.download_button('Download full validation report', csv_bytes(result.issues), 'validation_report.csv', 'text/csv')
                if len(result.quarantined):
                    st.warning('Quarantined rows will be excluded from every KPI, table and export of analytics data. Correct and re-upload the source to include them.')
                    st.download_button('Download quarantined source rows', csv_bytes(result.quarantined), 'quarantined_rows.csv', 'text/csv')
                accepted = st.checkbox('I reviewed the mapping, normalization findings and excluded rows', key=f'accept_{sha256(signature.encode()).hexdigest()}')
                metadata = {'frame': result.valid, 'raw': raw.copy(), 'issues': result.issues,
                    'quarantined': result.quarantined, 'name': uploaded.name, 'demo': False,
                    'loaded_at': datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).isoformat(timespec='seconds'),
                    'as_of': datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).date(), 'id': token,
                    'mapping': mapping, 'date_format': fmt, 'status_map': status_map}
                st.button('Activate validated data', disabled=not accepted or bool(result.blockers) or result.valid.empty,
                    on_click=activate_dataset, args=(metadata,), type='primary')
                st.caption('Activation resets filters and calculation assumptions. Unknown statuses are retained as Unknown. No arbitrary duplicate is kept.')
            elif staged:
                st.info('Mapping or options changed. Validate again before activation.')
        if not active['issues'].empty:
            st.caption(f"Active dataset: {len(active['issues'])} recorded validation findings; {len(active['quarantined'])} excluded source rows.")
            st.download_button('Active validation report', csv_bytes(active['issues']), 'active_validation.csv', 'text/csv')
    return st.session_state['active_dataset']
