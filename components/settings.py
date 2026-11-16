import streamlit as st
from services.data_validation import DATE_COLUMNS


def settings(default_as_of):
    with st.sidebar.expander('Calculation & alert settings'):
        as_of = st.date_input('Assessment date', value=default_as_of, key='as_of',
            help='Deadline alerts and open exposure are assessed on this date. Demo defaults to its fixed snapshot.')
        warning = st.number_input('Approaching deadline window (days)', min_value=0, max_value=90, value=3, key='warning_days')
        rules = {}
        for kind, default_start in [('DEM', 'Discharge Date'), ('DET', 'Gate Out Date')]:
            st.markdown(f'**{kind} rules**')
            derive = st.checkbox(f'{kind}: derive missing deadlines using start + free days (start day excluded)', key=f'{kind}_derive')
            free_days, start = None, default_start
            if derive:
                start = st.selectbox(f'{kind} start event', DATE_COLUMNS[:6], index=DATE_COLUMNS[:6].index(default_start), key=f'{kind}_start')
                free_days = st.number_input(f'{kind} configured free calendar days', min_value=0, max_value=365, value=0, key=f'{kind}_free')
                st.caption('Use only if this simple calendar-day convention matches the contract. Imported deadlines take priority.')
            flat = st.checkbox(f'{kind}: confirm supplied rates use a flat daily tariff', key=f'{kind}_flat')
            assume = st.checkbox(f'{kind}: treat missing end dates as still open', key=f'{kind}_open',
                help='Opt-in assumption for estimates. DEM end = Gate Out Date; DET end = Return Date. Without it missing ends have unknown charge duration.')
            rules[kind] = dict(free_days=free_days, flat_tariff=flat, assume_open=assume, start_column=start)
        st.caption('Tiered tariffs, inclusive-start rules, business-day calendars and combined DEM/DET contracts require externally calculated deadlines/charges. No automatic notifications.')
    return as_of, int(warning), rules
