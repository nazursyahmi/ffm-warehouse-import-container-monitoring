import streamlit as st
from components.kpi_cards import render_kpis
from components.charts import chart
from components.tables import table, downloads
from components.alerts import render_alerts
from services.calculations import metrics
from services.analytics import shipment_summary, monthly_volume, delivery_trend


def render(frame, as_of, warning_days):
    render_kpis(metrics(frame, as_of, warning_days))
    if frame.empty:
        st.info('No containers match the filters. Reset filters or import valid records.')
        return
    a, b = st.columns(2)
    with a:
        statuses = frame.groupby('Delivery Status').size().reset_index(name='Containers')
        chart(statuses, 'pie', 'Delivery Status', 'Containers', 'Shipment status distribution')
    with b:
        chart(delivery_trend(frame), 'line', 'Delivery Month', 'Delivered Containers', 'Delivery throughput trend', markers=True)
    a, b = st.columns(2)
    with a:
        chart(monthly_volume(frame), 'bar', 'Month', 'Containers', 'Monthly arrivals')
    with b:
        work = frame.dropna(subset=['Arrival Date']).copy()
        work['Arrival Month'] = work['Arrival Date'].dt.to_period('M').astype(str)
        cohort = shipment_summary(work, ['Arrival Month'], as_of)
        chart(cohort, 'line', 'Arrival Month', 'Delivery Rate (%)', 'Delivery rate by arrival cohort', markers=True)
        st.caption('Arrival-cohort rate uses current source statuses; recent cohorts may still be in progress.')
    st.subheader('Operational alerts')
    render_alerts(frame, as_of, warning_days)
    st.subheader('Shipment summary · pending & overdue')
    summary = shipment_summary(frame, ['Vessel Name', 'BL Number'], as_of)
    table(summary, 'overview_summary')
    downloads(summary, 'overview_summary')
