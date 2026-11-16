"""Explicit, non-mutating source-to-analytics normalization and quality reports."""
from dataclasses import dataclass
from datetime import datetime
from math import isfinite
import pandas as pd

REQUIRED = ['Container Number', 'BL Number']
DATE_COLUMNS = ['Arrival Date', 'Discharge Date', 'Gate Out Date', 'Delivery Deadline',
                'Delivery Date', 'Return Date', 'DEM Deadline', 'DET Deadline', 'Source Updated At']
TEXT_COLUMNS = REQUIRED + ['Vessel Name', 'Shipping Line', 'Delivery Status', 'RFC Status',
                          'Return Status', 'Delay Category', 'Root Cause', 'Currency']
NUMBER_COLUMNS = ['DEM Daily Rate', 'DET Daily Rate']
SCHEMA = TEXT_COLUMNS + DATE_COLUMNS + NUMBER_COLUMNS


@dataclass
class ValidationResult:
    valid: pd.DataFrame
    quarantined: pd.DataFrame
    issues: pd.DataFrame
    blockers: list[str]


def normalize(raw, mapping, date_format='%Y-%m-%d', status_map=None):
    """Map canonical -> original columns. Quarantine ambiguous keys and bad values.

    Unknown statuses are retained as Unknown, never inferred as pending.
    Original columns and values are not modified.
    """
    frame = pd.DataFrame(index=raw.index)
    issues, blockers = [], []
    bad = pd.Series(False, index=raw.index)
    status_map = status_map if status_map is not None else {'Delivered': 'Delivered', 'Pending': 'Pending'}

    def report(mask, field, message, severity='Warning', exclude=False):
        nonlocal bad
        mask = mask.fillna(False)
        for position in range(len(raw)):
            if mask.iloc[position]:
                issues.append({'Source Row': position + 2, 'Field': field,
                               'Severity': severity, 'Issue': message})
        if exclude:
            bad |= mask

    active = {key: value for key, value in mapping.items() if value is not None and value != '(Not mapped)'}
    if len(set(active.values())) != len(active):
        blockers.append('Each source column may map to only one canonical field.')
    for column in REQUIRED:
        if column not in active or active[column] not in raw:
            blockers.append(f'Required mapping missing: {column}.')
    for column in SCHEMA:
        source = active.get(column)
        values = raw[source].copy() if source in raw else pd.Series(pd.NA, index=raw.index)
        if column in DATE_COLUMNS:
            parsed = values.map(lambda v: pd.Timestamp(v).normalize() if isinstance(v, (datetime, pd.Timestamp)) and not pd.isna(v)
                else pd.to_datetime(v, format=date_format, errors='coerce'))
            parsed = pd.to_datetime(parsed, errors='coerce')
            present = values.notna() & values.astype(str).str.strip().ne('')
            report(present & parsed.isna(), column, 'Invalid date for selected format; row quarantined.', 'Error', True)
            frame[column] = parsed
        elif column in NUMBER_COLUMNS:
            parsed = pd.to_numeric(values, errors='coerce').astype(float)
            present = values.notna() & values.astype(str).str.strip().ne('')
            invalid = present & (parsed.isna() | parsed.lt(0) | ~parsed.map(lambda x: pd.isna(x) or isfinite(x)))
            report(invalid, column, 'Rate must be a finite non-negative number; row quarantined.', 'Error', True)
            frame[column] = parsed
        else:
            text = values.astype('string')
            stripped = text.str.strip().replace('', pd.NA)
            report(text.notna() & text.ne(stripped).fillna(True), column, 'Whitespace trimmed or blank converted to missing in analytics copy.')
            frame[column] = stripped
    for column in REQUIRED:
        report(frame[column].isna(), column, 'Missing counting key; row quarantined.', 'Error', True)
    duplicate = frame.duplicated(REQUIRED, keep=False) & frame[REQUIRED].notna().all(axis=1)
    report(duplicate, 'Counting key', 'Duplicate BL/container key; all matching rows quarantined.', 'Error', True)
    source_status = frame['Delivery Status'].copy()
    frame['Delivery Status'] = source_status.map(status_map).fillna('Unknown').astype('string')
    report(frame['Delivery Status'].eq('Unknown'), 'Delivery Status', 'Status missing or unmapped; counted as Unknown, not Pending.')
    for end, start in [('Delivery Date', 'Arrival Date'), ('Return Date', 'Gate Out Date'), ('Gate Out Date', 'Discharge Date')]:
        report(frame[end].lt(frame[start]), end, f'{end} precedes {start}; row quarantined.', 'Error', True)
    report(frame['Delivery Status'].eq('Pending') & frame['Delivery Date'].notna(), 'Delivery Status',
           'Pending status conflicts with actual delivery date; row quarantined.', 'Error', True)
    report(frame['Delivery Status'].eq('Delivered') & frame['Delivery Date'].isna(), 'Delivery Date', 'Delivered status lacks actual date; lead time is unavailable.')
    report(frame['Delivery Status'].eq('Pending') & frame['Delivery Deadline'].isna(), 'Delivery Deadline', 'Pending container has no delivery target; deadline risk is unknown.')
    for column in ['Vessel Name', 'Shipping Line', 'Arrival Date']:
        report(frame[column].isna(), column, 'Missing shipment information; associated analysis may be unavailable.')
    if blockers:
        bad[:] = True
    frame.insert(0, 'Source Row', range(2, len(raw) + 2))
    return ValidationResult(frame.loc[~bad].reset_index(drop=True),
        raw.loc[bad].copy(), pd.DataFrame(issues, columns=['Source Row', 'Field', 'Severity', 'Issue']), blockers)
