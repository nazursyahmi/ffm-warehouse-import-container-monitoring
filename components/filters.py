import streamlit as st

FILTER_KEYS = ['date_range', 'date_basis', 'include_missing_dates', 'vessels', 'bls', 'statuses', 'lines']


def reset_filters():
    for key in FILTER_KEYS:
        st.session_state.pop(key, None)


def apply_filters(frame):
    st.sidebar.divider()
    st.sidebar.subheader('Global filters')
    st.sidebar.caption('All filters combine. Empty selections include all values.')
    basis = st.sidebar.selectbox('Date field', ['Arrival Date', 'Delivery Date', 'Delivery Deadline', 'Return Date'],
        key='date_basis', on_change=lambda: st.session_state.pop('date_range', None))
    known_dates = frame[basis].dropna()
    dates = None
    if not known_dates.empty:
        dates = st.sidebar.date_input('Date range', value=(known_dates.min().date(), known_dates.max().date()), key='date_range')
    else:
        st.sidebar.caption('Date range unavailable: no values for the selected date field.')
    include_missing = st.sidebar.checkbox('Include records without this date', value=True, key='include_missing_dates')
    selected = {}
    for label, column, key in [
        ('Vessel', 'Vessel Name', 'vessels'), ('BL number', 'BL Number', 'bls'),
        ('Shipment status', 'Delivery Status', 'statuses'),
        ('Shipping line', 'Shipping Line', 'lines'),
    ]:
        selected[column] = st.sidebar.multiselect(label, sorted(frame[column].fillna('Not Available').unique()), key=key)
    st.sidebar.button('Reset filters', on_click=reset_filters, width='stretch')
    result = frame.copy()
    if isinstance(dates, (tuple, list)) and len(dates) == 2:
        mask = result[basis].dt.date.between(*dates)
        result = result[mask | (include_missing & result[basis].isna())]
    elif dates is not None:
        st.sidebar.info('Select both dates to apply the date range.')
    elif not include_missing:
        result = result[result[basis].notna()]
    for column, choices in selected.items():
        if choices:
            result = result[result[column].fillna('Not Available').isin(choices)]
    st.sidebar.caption(f'{len(result)} of {len(frame)} containers match')
    return result
