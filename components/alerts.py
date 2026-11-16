import streamlit as st
from services.calculations import metrics


def render_alerts(frame, as_of, warning_days):
    values = metrics(frame, as_of, warning_days)
    if values['Overdue Containers']:
        st.error(f"Critical · {values['Overdue Containers']} pending containers are past their delivery target.")
    if values['Approaching Deadline']:
        st.warning(f"Warning · {values['Approaching Deadline']} pending containers are due within {warning_days} days, including today.")
    pending = values['Pending Containers']
    if pending:
        st.info(f'{pending} deliveries pending. Deadline alerts cover only containers with a supplied target.')
    unknown = int(frame['Delivery Status'].eq('Unknown').sum())
    missing = frame[['Arrival Date', 'Vessel Name', 'Shipping Line']].isna().any(axis=1)
    missing_target = frame['Delivery Status'].eq('Pending') & frame['Delivery Deadline'].isna()
    if unknown or missing.any() or missing_target.any():
        st.warning(f'Data quality · {unknown} unknown statuses; {int(missing.sum())} containers missing arrival/vessel/line; '
                   f'{int(missing_target.sum())} pending without delivery targets. Risk may be incomplete.')
    if not pending and not unknown and not missing.any() and len(frame):
        st.success('Normal · No pending deliveries in this filter scope.')
