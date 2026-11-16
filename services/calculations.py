"""Calendar-day rules for validated unique BL/container rows; see data dictionary."""
import pandas as pd


def deadline_masks(frame, as_of, warning_days=3):
    pending = frame['Delivery Status'].eq('Pending')
    days = (frame['Delivery Deadline'] - pd.Timestamp(as_of)).dt.days
    return pending & days.lt(0), pending & days.between(0, warning_days)


def metrics(frame, as_of, warning_days=3):
    total = len(frame)
    delivered = int(frame['Delivery Status'].eq('Delivered').sum())
    overdue, approaching = deadline_masks(frame, as_of, warning_days)
    return {
        'Total Containers': total,
        'Delivered Containers': delivered,
        'Pending Containers': int(frame['Delivery Status'].eq('Pending').sum()),
        'Delivery Rate': f'{delivered / total:.1%}' if total else 'Not Available',
        'Overdue Containers': int(overdue.sum()),
        'Approaching Deadline': int(approaching.sum()),
    }


def lead_times(frame, start='Arrival Date', end='Delivery Date'):
    days = (frame[end] - frame[start]).dt.days.astype(float)
    return days.where(days.ge(0) & frame['Delivery Status'].eq('Delivered'))


def delay_days(frame, as_of):
    end = frame['Delivery Date'].where(frame['Delivery Status'].eq('Delivered'))
    end = end.where(~frame['Delivery Status'].eq('Pending'), pd.Timestamp(as_of))
    days = (end - frame['Delivery Deadline']).dt.days.astype(float)
    return days.clip(lower=0)


def exposure(frame, kind, as_of, free_days=None, flat_tariff=False, assume_open=False, start_column=None):
    """Explicit deadlines win. Start day excluded; charge begins after deadline.

    Missing closure uses as_of ONLY on explicit opt-in. Flat daily tariff only;
    currencies must be grouped, never combined. Future stop dates are unknown.
    """
    if kind not in ('DEM', 'DET'):
        raise ValueError('Exposure type must be DEM or DET.')
    today = pd.Timestamp(as_of)
    deadline = frame[f'{kind} Deadline'].copy()
    start_column = start_column or ('Discharge Date' if kind == 'DEM' else 'Gate Out Date')
    if free_days is not None:
        if free_days < 0:
            raise ValueError('Free days cannot be negative.')
        deadline = deadline.fillna(frame[start_column] + pd.to_timedelta(free_days, unit='D'))
    future_start = frame[start_column].gt(today)
    inconsistent_start = deadline.lt(frame[start_column])
    invalid_start = future_start | inconsistent_start
    end_column = 'Gate Out Date' if kind == 'DEM' else 'Return Date'
    end = frame[end_column].copy()
    future = end.gt(today)
    closed = end.notna() & ~future
    effective_end = end.where(closed)
    if assume_open:
        effective_end = effective_end.where(end.notna(), today)
    days = (effective_end - deadline).dt.days.astype(float).clip(lower=0)
    remaining = (deadline - today).dt.days.astype(float).where(~closed)
    invalid_sequence = end.lt(deadline) & end.lt(frame[start_column])
    days = days.where(~invalid_sequence & ~future & ~invalid_start)
    remaining = remaining.where(~invalid_start & ~future)
    rate = frame[f'{kind} Daily Rate']
    configured = flat_tariff & rate.notna() & rate.ge(0) & frame['Currency'].notna()
    charge = (days * rate).where(configured)
    result = frame.copy()
    result['Deadline'] = deadline
    result['Exposure State'] = 'Open / unconfirmed'
    result.loc[closed, 'Exposure State'] = 'Closed'
    result.loc[future, 'Exposure State'] = 'Future end date / unknown'
    result.loc[deadline.isna(), 'Exposure State'] = 'Requires Configuration'
    result.loc[invalid_start, 'Exposure State'] = 'Invalid start/deadline / unknown'
    result['Remaining Free Days'] = remaining
    result['Charge Days'] = days
    result['Estimated Charge'] = charge
    result['Charge Basis'] = 'Requires Configuration'
    result.loc[charge.notna(), 'Charge Basis'] = 'Estimated flat daily rate'
    result.loc[deadline.notna() & effective_end.isna(), 'Charge Basis'] = 'Open/closed state or end date unknown'
    result.loc[invalid_start, 'Charge Basis'] = 'Start is future or deadline precedes start; verify source dates'
    return result
