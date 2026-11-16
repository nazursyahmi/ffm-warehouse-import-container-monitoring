import streamlit as st

PAGES = ['Container Monitoring', 'Overview', 'DEM / DET Analysis',
         'Lead-Time Analysis', 'Performance Comparison', 'Root-Cause Analysis',
         'Shipment Explorer']


def navigation():
    st.sidebar.title('FFM Logistics')
    st.sidebar.caption('IMPORT CONTAINER MONITORING')
    page = st.sidebar.radio('Workspace', PAGES, key='navigation')
    st.sidebar.caption('Operations · Analytics · Shipment records')
    return page
