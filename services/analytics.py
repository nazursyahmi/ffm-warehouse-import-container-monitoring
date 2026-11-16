"""Reusable aggregations over the same validated container counting unit."""
from services.calculations import lead_times, delay_days, deadline_masks


def shipment_summary(frame, by, as_of):
    work = frame.copy()
    for column in by:
        work[column] = work[column].fillna('Not Available')
    work['_delivered'] = work['Delivery Status'].eq('Delivered').astype(int)
    work['_pending'] = work['Delivery Status'].eq('Pending').astype(int)
    work['_unknown'] = work['Delivery Status'].eq('Unknown').astype(int)
    work['_lead'] = lead_times(work)
    work['_overdue'] = deadline_masks(work, as_of)[0].astype(int)
    work['_delay'] = delay_days(work, as_of).gt(0).astype(int)
    result = work.groupby(by, dropna=False, as_index=False).agg(
        Containers=('Container Number', 'size'), Delivered=('_delivered', 'sum'),
        Pending=('_pending', 'sum'), Unknown=('_unknown', 'sum'),
        Overdue=('_overdue', 'sum'), Delayed=('_delay', 'sum'),
        Average_Lead_Days=('_lead', 'mean'), Lead_Time_Samples=('_lead', 'count'))
    result['Delivery Rate (%)'] = result['Delivered'].div(result['Containers']).mul(100).round(1)
    return result


def monthly_volume(frame):
    work = frame.dropna(subset=['Arrival Date']).copy()
    work['Month'] = work['Arrival Date'].dt.to_period('M').astype(str)
    return work.groupby('Month', as_index=False).size().rename(columns={'size': 'Containers'})


def delivery_trend(frame):
    work = frame[frame['Delivery Status'].eq('Delivered')].dropna(subset=['Delivery Date']).copy()
    work['Delivery Month'] = work['Delivery Date'].dt.to_period('M').astype(str)
    return work.groupby('Delivery Month', as_index=False).size().rename(columns={'size': 'Delivered Containers'})
