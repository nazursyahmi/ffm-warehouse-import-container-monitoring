import streamlit as st
from components.kpi_cards import render_kpis
from services.calculations import metrics
from services.analytics import shipment_summary
from components.alerts import render_alerts
from components.tables import table, downloads, search_frame


def render(frame, as_of, warning_days):
    values = metrics(frame, as_of, warning_days)
    render_kpis(values)
    if frame.empty:
        st.info('No containers match these filters. Reset filters or widen the arrival date range.')
        return
    render_alerts(frame, as_of, warning_days)

    st.subheader('Vessel & BL monitoring')
    st.caption('Selection below narrows this detail panel and table. KPI cards retain the global filter scope.')
    col1, col2 = st.columns(2)
    vessel = col1.selectbox('Inspect vessel', ['All vessels'] + sorted(frame['Vessel Name'].dropna().unique()), key='inspect_vessel')
    detail = frame if vessel == 'All vessels' else frame[frame['Vessel Name'].eq(vessel)]
    bl = col2.selectbox('Inspect Bill of Lading', ['All BLs'] + sorted(detail['BL Number'].dropna().unique()), key='inspect_bl')
    if bl != 'All BLs':
        detail = detail[detail['BL Number'].eq(bl)]
    summary = shipment_summary(detail, ['Vessel Name', 'BL Number'], as_of)
    info = detail.assign(**{'Vessel Name': detail['Vessel Name'].fillna('Not Available')}).groupby(['Vessel Name', 'BL Number'], as_index=False).agg(
        Arrival=('Arrival Date', 'min'), Earliest_Target=('Delivery Deadline', 'min'),
        Latest_Delivery=('Delivery Date', 'max'), Latest_Return=('Return Date', 'max'),
        RFC_Status=('RFC Status', lambda s: ', '.join(sorted(s.dropna().unique())) or 'Not Available'),
        Return_Status=('Return Status', lambda s: ', '.join(sorted(s.dropna().unique())) or 'Not Available'))
    table(summary.merge(info, on=['Vessel Name', 'BL Number']), 'container_summary')
    st.subheader('Container register')
    search = st.text_input('Search containers, vessels, BLs or shipping lines', placeholder='Type a container number or shipment reference', key='inspect_search')
    detail = search_frame(detail, search)
    st.caption(f'{len(detail)} containers shown · Click a column heading to sort. Blank dates mean Not Available.')
    table(detail, 'container_register', height=380)
    downloads(detail, 'container_register')
