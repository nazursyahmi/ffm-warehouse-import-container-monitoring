import pandas as pd
import streamlit as st
from components.charts import chart
from components.tables import table, downloads
from services.calculations import exposure


def render(frame, as_of, warning_days, rules):
    st.caption('DEM and DET are assessed separately. Delivery targets are never used as free-time deadlines. Missing end dates are unconfirmed unless explicitly treated as open in calculation settings.')
    if frame.empty:
        st.info('No containers match the filters.')
        return
    kind = st.radio('Exposure type', ['DEM', 'DET'], horizontal=True, key='exposure_kind')
    result = exposure(frame, kind, as_of, **rules[kind])
    open_candidates = result['Exposure State'].eq('Open / unconfirmed')
    at_risk = open_candidates & result['Remaining Free Days'].between(0, warning_days)
    exceeded = open_candidates & result['Remaining Free Days'].lt(0)
    a, b, c, d = st.columns(4)
    a.metric('Potential approaching deadlines', int(at_risk.sum()))
    b.metric('Potential free-time exceedances', int(exceeded.sum()))
    c.metric('Known deadlines', int(result['Deadline'].notna().sum()))
    d.metric('Missing deadlines', int(result['Deadline'].isna().sum()))
    if result['Deadline'].isna().all():
        st.info('Requires Configuration · Supply explicit DEM/DET Deadline columns or enable a confirmed start + free-calendar-days rule. No allowance is assumed.')
    if exceeded.any():
        st.error(f'Critical · {int(exceeded.sum())} potentially open containers are beyond {kind} deadline. Confirm movement/return dates before treating them as chargeable.')
    if at_risk.any():
        st.warning(f'Warning · {int(at_risk.sum())} potentially open containers approach {kind} deadline within {warning_days} days.')
    if result['Exposure State'].str.contains('Future').any():
        st.warning('Future end dates are not treated as actual completed movements or used to estimate charges.')
    if result['Exposure State'].str.contains('Invalid start').any():
        st.warning('Some start events are after the assessment date or after their supplied deadline. Their remaining days and charges are withheld; verify the source dates.')
    st.subheader('Estimated charges · by currency')
    measured = result.dropna(subset=['Estimated Charge', 'Currency'])
    if measured.empty:
        st.info('Estimated charges: Requires Configuration. Confirm flat daily tariff, supply rate and currency, and establish the end date or explicitly assume missing ends are open. No rates are generated.')
    else:
        totals = measured.groupby('Currency', as_index=False).agg(Estimated_Charge=('Estimated Charge', 'sum'), Measured_Containers=('Container Number', 'size'))
        table(totals, 'exposure_currency')
        st.caption(f'{len(measured)} of {len(result)} containers have an estimate. Currencies remain separate. Estimates exclude taxes, rounding, tiered tariffs and combined contracts.')
    result['Deadline Alert'] = 'Unknown / Not Available'
    result.loc[result['Exposure State'].eq('Closed'), 'Deadline Alert'] = 'Closed'
    result.loc[open_candidates & result['Remaining Free Days'].gt(warning_days), 'Deadline Alert'] = 'Outside warning window'
    result.loc[at_risk, 'Deadline Alert'] = 'Warning — confirm open state'
    result.loc[exceeded, 'Deadline Alert'] = 'Critical — confirm open state'
    columns = ['Container Number', 'Vessel Name', 'BL Number', 'Shipping Line', 'Return Status',
        'Deadline', 'Gate Out Date', 'Return Date', 'Remaining Free Days', 'Exposure State', 'Deadline Alert', 'Charge Days',
        f'{kind} Daily Rate', 'Currency', 'Estimated Charge', 'Charge Basis']
    table(result[columns], 'exposure_details', height=380)
    st.subheader('Deadline breakdown')
    group = st.selectbox('Breakdown by', ['Vessel Name', 'BL Number', 'Shipping Line'], key='exposure_group')
    grouped = result.assign(**{group: result[group].fillna('Not Available')},
        _risk=at_risk.astype(int), _exceeded=exceeded.astype(int)).groupby(group, as_index=False).agg(
            Containers=('Container Number', 'size'), At_Risk=('_risk', 'sum'), Potential_Exceedances=('_exceeded', 'sum'))
    chart(grouped.head(30), 'bar', group, ['At_Risk', 'Potential_Exceedances'], f'{kind} deadline risk', barmode='group')
    table(grouped, 'exposure_breakdown')
    downloads(result[columns], f'{kind.lower()}_analysis')
