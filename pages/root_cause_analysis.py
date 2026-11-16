import streamlit as st
from components.charts import chart
from components.tables import table, downloads
from services.calculations import delay_days


def render(frame, as_of, warning_days):
    if frame.empty:
        st.info('No containers match the filters.')
        return
    work = frame.copy()
    work['Delay (days)'] = delay_days(work, as_of)
    delayed = work[work['Delay (days)'].gt(0)].copy()
    a, b, c = st.columns(3)
    a.metric('Delayed containers', len(delayed))
    b.metric('Recorded delayed BLs', delayed['BL Number'].nunique())
    c.metric('Measured container-days of delay', f"{delayed['Delay (days)'].sum():.0f}")
    st.caption('Impact = sum of positive calendar-day delays per container, not financial loss or distinct shipment-days. Delivered uses actual delivery; pending uses assessment date. No target or usable status means unknown delay.')
    if frame['Delivery Deadline'].isna().any():
        st.warning(f"{int(frame['Delivery Deadline'].isna().sum())} containers have no delivery target; delay cannot be assessed for those records.")
    table(delayed, 'cause_delayed')
    available = [c for c in ['Delay Category', 'Root Cause'] if delayed[c].notna().any()]
    if not available:
        st.info('Root-cause breakdown: Not Available. Supply recorded Delay Category and/or Root Cause fields. The system does not infer reasons from vessel, line or dates.')
    else:
        field = st.selectbox('Recorded cause field', available, key='cause_field')
        delayed[field] = delayed[field].fillna('Not Available')
        grouped = delayed.groupby(field, as_index=False).agg(Containers=('Container Number', 'size'),
            Delayed_BLs=('BL Number', 'nunique'), Container_Days=('Delay (days)', 'sum'))
        chart(grouped.sort_values('Containers', ascending=False).head(30), 'bar', field, 'Containers', 'Recorded delay causes')
        table(grouped, 'cause_breakdown')
        st.subheader('Recurring patterns')
        st.caption('Repeated cause = at least two distinct BLs in the current scope. Association does not establish causation.')
        recurring = grouped[grouped['Delayed_BLs'].ge(2)]
        table(recurring, 'cause_recurring')
        if delayed['Vessel Name'].notna().any():
            pattern = delayed.groupby(['Vessel Name', field], as_index=False).size().rename(columns={'size': 'Containers'})
            chart(pattern.head(50), 'bar', 'Vessel Name', 'Containers', 'Recorded causes by vessel', color=field)
    downloads(delayed, 'root_causes')
