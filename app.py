"""FFM Logistics import monitoring; all uploaded data is session-only."""
from pathlib import Path
from html import escape
import streamlit as st
from components.sidebar import navigation
from components.filters import apply_filters
from components.data_management import data_management
from components.settings import settings
from pages import container_monitoring, overview, dem_det_analysis, lead_time_analysis
from pages import performance_comparison, root_cause_analysis, shipment_explorer

st.set_page_config(page_title='FFM Logistics | Import Monitoring', page_icon=':material/local_shipping:', layout='wide')
# Disable automatic discovery of the pages/ render modules.
st.navigation([st.Page(lambda: None, title='FFM Logistics')], position='hidden').run()
st.markdown(f'<style>{(Path(__file__).parent / "assets/styles.css").read_text(encoding="utf-8")}</style>', unsafe_allow_html=True)
page = navigation()
st.markdown(f'<div class="ffm-heading">{escape(page)}</div>', unsafe_allow_html=True)
st.markdown('<div class="ffm-subtitle">Import visibility for warehouse operations and management</div>', unsafe_allow_html=True)
active = data_management()
if active['demo']:
    st.markdown('<span class="ffm-demo">DEMO DATA ? SYNTHETIC SHIPMENTS</span>', unsafe_allow_html=True)
    st.caption('Source: demo_shipments.csv ? Fixed snapshot: 16 Nov 2026, Asia/Kuala_Lumpur ? No live data connection')
else:
    st.info('UPLOADED DATA ? Session only ? No live refresh connection')
    st.caption(f"Source: {active['name']} ? Loaded: {active['loaded_at']}")
    updated = active['frame']['Source Updated At'].dropna()
    st.caption(f"Latest supplied source update date: {updated.max().date()}" if len(updated) else 'Source freshness: Not Available ? no Source Updated At values supplied. Load time is not source freshness.')
    if len(active['quarantined']):
        st.warning(f"{len(active['quarantined'])} source rows were quarantined and excluded. Review the active validation report in Data source.")
filtered = apply_filters(active['frame'])
as_of, warning_days, rules = settings(active['as_of'])
st.caption(f'{len(filtered):,} of {len(active["frame"]):,} eligible containers match global filters ? Assessment date: {as_of:%d %b %Y} ? Counting unit: BL + container')
if page == 'DEM / DET Analysis':
    dem_det_analysis.render(filtered, as_of, warning_days, rules)
else:
    renderers = {
        'Container Monitoring': container_monitoring.render,
        'Overview': overview.render,
        'Lead-Time Analysis': lead_time_analysis.render,
        'Performance Comparison': performance_comparison.render,
        'Root-Cause Analysis': root_cause_analysis.render,
        'Shipment Explorer': shipment_explorer.render,
    }
    renderers[page](filtered, as_of, warning_days)
with st.expander('Calculation rules & data limitations'):
    st.write('Total = validated unique BL/container pairs. Delivered and pending use explicitly mapped status values; all other statuses are Unknown. '
        'Delivery rate = delivered / total, with Not Available for zero denominator. Overdue = pending and delivery target before assessment date. '
        'Approaching = pending and target from assessment date through the configured window, inclusive. Missing targets have unknown risk. '
        'Lead time uses actual delivered dates minus the selected actual start date in calendar days. Delivery targets are separate from DEM/DET free-time deadlines.')
    st.write('DEM/DET: explicit deadlines take priority. Optional configured deadline = start + free calendar days, excluding the start day. '
        'Charge days = max(0, actual end minus deadline); missing ends require an explicit open-state assumption. DEM end = gate out; DET end = empty return. '
        'Estimates require confirmed flat daily tariff, supplied rate and currency. Currencies remain separate; tiered or combined contracts require additional business inputs.')
    st.caption('No external notifications, scheduled ingestion, database persistence or authentication are implemented. Review recorded data quality and missing-field messages before acting on alerts.')
