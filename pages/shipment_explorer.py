import math
import streamlit as st
from components.tables import table, search_frame, downloads


def render(frame, as_of, warning_days):
    st.caption('Search and local filters refine the global scope. Exports include all local matches; pagination affects only the table.')
    if frame.empty:
        st.info('No containers match the global filters.')
        return
    text = st.text_input('Search all available shipment fields', key='explorer_search')
    work = search_frame(frame, text)
    with st.expander('Advanced column filters'):
        fields = st.multiselect('Filter columns', ['Container Number', 'Vessel Name', 'BL Number', 'Shipping Line', 'Delivery Status',
            'RFC Status', 'Return Status', 'Delay Category', 'Root Cause'], key='explorer_columns')
        for column in fields:
            choices = st.multiselect(column, sorted(frame[column].fillna('Not Available').unique()), key=f'explorer_filter_{column}')
            if choices:
                work = work[work[column].fillna('Not Available').isin(choices)]
    a, b, c = st.columns(3)
    sort = a.selectbox('Sort by', list(frame.columns), key='explorer_sort')
    ascending = b.checkbox('Ascending order', value=True, key='explorer_ascending')
    page_size = c.selectbox('Rows per page', [25, 50, 100, 250], key='explorer_size')
    work = work.sort_values(sort, ascending=ascending, na_position='last', kind='stable')
    st.caption(f'{len(work):,} matching containers')
    pages = max(1, math.ceil(len(work) / page_size))
    if st.session_state.get('explorer_page', 1) > pages:
        st.session_state['explorer_page'] = 1
    page = st.number_input('Page', min_value=1, max_value=pages, value=1, key='explorer_page')
    table(work.iloc[(page-1)*page_size:page*page_size], 'explorer_table', height=420)
    if work.empty:
        st.info('No local matches. Clear search or advanced filters.')
    else:
        st.subheader('Shipment detail')
        # Select a paginated row to keep the detail selector efficient on large files.
        visible = work.iloc[(page-1)*page_size:page*page_size]
        labels = {index: f"{row['Container Number']} · {row['BL Number']}" for index, row in visible.iterrows()}
        selected = st.selectbox('Inspect a container on this page', list(labels), format_func=labels.get, key='explorer_detail')
        record = work.loc[selected]
        table(record.rename_axis('Field').reset_index(name='Value').astype(str), 'explorer_detail_table')
        active = st.session_state['active_dataset']
        source_row = int(record['Source Row']) - 2
        if source_row < len(active['raw']):
            with st.expander('Original source row · original column names'):
                table(active['raw'].iloc[[source_row]], 'explorer_source_row')
    downloads(work, 'shipment_explorer')
