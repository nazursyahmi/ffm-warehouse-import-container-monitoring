import streamlit as st
from components.charts import chart
from components.tables import table, downloads
from services.analytics import shipment_summary


def render(frame, as_of, warning_days):
    if frame.empty:
        st.info('No containers match the filters.')
        return
    work = frame.copy()
    options = {label: column for label, column in [('Vessel', 'Vessel Name'), ('Shipping line', 'Shipping Line'), ('Delivered / Pending / Unknown', 'Delivery Status')]
               if work[column].notna().any() and (column != 'Delivery Status' or work[column].ne('Unknown').any())}
    if work['Arrival Date'].notna().any():
        work['Arrival Month'] = work['Arrival Date'].dt.to_period('M').astype('string')
        options['Arrival month'] = 'Arrival Month'
    if not options:
        st.info('Not Available · No vessel, line, arrival month or known delivery status to compare.')
        return
    choice = st.selectbox('Compare by', list(options), key='compare_by')
    column = options[choice]
    summary = shipment_summary(work, [column], as_of)
    chosen = st.multiselect('Comparison groups (empty = all)', summary[column].tolist(), key=f'compare_groups_{column}')
    if chosen:
        summary = summary[summary[column].isin(chosen)]
    metric_options = ['Containers', 'Delivery Rate (%)', 'Pending', 'Overdue']
    if summary['Average_Lead_Days'].notna().any():
        metric_options.append('Average_Lead_Days')
    measurement = st.selectbox('Measure', metric_options, key='compare_measure')
    st.caption('Lead time = actual Delivery Date − Arrival Date, calendar days. Unknown groups remain labelled. Delivery rates use all containers in each group as denominator.')
    plotted = summary.dropna(subset=[measurement]).sort_values(measurement, ascending=False)
    chart(plotted.head(30), 'bar', column, measurement, f'{measurement.replace("_", " ")} by {choice.lower()}')
    if len(plotted) > 30:
        st.caption('Chart shows the 30 largest values; the full summary is below.')
    if len(summary) < 2:
        st.info('Only one group is available. Widen filters or import more groups for a comparison.')
    table(summary, 'comparison_summary')
    downloads(summary, 'performance_comparison')
