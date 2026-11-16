import streamlit as st
from components.charts import chart
from components.tables import table, downloads
from services.calculations import lead_times, delay_days


def render(frame, as_of, warning_days):
    if frame.empty:
        st.info('No containers match the filters.')
        return
    starts = [c for c in ['Arrival Date', 'Discharge Date', 'Gate Out Date'] if frame[c].notna().any()]
    work = frame.copy()
    work['Lead Time (days)'] = float('nan')
    if not starts or not frame['Delivery Date'].notna().any():
        st.info('Not Available · Lead time needs actual start dates and Delivery Date for delivered containers.')
    else:
        start = st.selectbox('Lead-time start event', starts, key='lead_start')
        st.caption(f'Calendar days = Delivery Date − {start}. Only Delivered status, non-negative durations and both actual dates qualify. Missing or inconsistent durations are excluded, not zero-filled.')
        work['Lead Time (days)'] = lead_times(work, start)
    samples = work.dropna(subset=['Lead Time (days)'])
    a, b, c, d = st.columns(4)
    values = samples['Lead Time (days)']
    for cell, name, value in [(a, 'Average lead time', values.mean()), (b, 'Minimum', values.min()), (c, 'Maximum', values.max())]:
        cell.metric(name, f'{value:.1f} days' if len(values) else 'Not Available')
    d.metric('Measured containers', len(samples))
    st.caption(f'{len(frame) - len(samples)} of {len(frame)} containers have no qualifying duration for this start event.')
    a, b = st.columns(2)
    with a:
        chart(samples, 'histogram', 'Lead Time (days)', title='Lead-time distribution', nbins=15)
    with b:
        samples = samples.copy()
        samples['Delivery Month'] = samples['Delivery Date'].dt.to_period('M').astype(str)
        trend = samples.groupby('Delivery Month', as_index=False)['Lead Time (days)'].mean()
        chart(trend, 'line', 'Delivery Month', 'Lead Time (days)', 'Average lead-time trend', markers=True)
    chart(samples.dropna(subset=['Vessel Name']), 'box', 'Vessel Name', 'Lead Time (days)', 'Vessel comparison', points='all')
    st.subheader('Delayed containers against delivery targets')
    work['Delay (days)'] = delay_days(work, as_of)
    delayed = work[work['Delay (days)'].gt(0)]
    st.caption('Delivered: actual delivery minus target. Pending: assessment date minus target. Missing targets/statuses cannot establish delay.')
    if delayed.empty:
        st.info('No measured delays in this scope. This does not establish on-time performance where target dates are missing.')
    table(delayed, 'lead_delayed')
    downloads(work, 'lead_time')
