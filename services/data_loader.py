"""Bounded CSV/XLSX loading without writing shipment uploads to disk."""
import csv
from io import BytesIO, StringIO
from pathlib import Path
from zipfile import ZipFile, BadZipFile
from xml.etree.ElementTree import ParseError
import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from services.data_validation import normalize, DATE_COLUMNS

ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 20 * 1024 * 1024
MAX_ROWS = 100_000


def _headers(headers):
    if not headers or any(h is None or not str(h).strip() for h in headers):
        raise ValueError('Every column needs a non-empty header.')
    names = [str(h) for h in headers]
    if len(set(names)) != len(names):
        raise ValueError('Duplicate column headers found. Rename them in the source file.')
    return names


def _check_excel(content):
    with ZipFile(BytesIO(content)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 100 * 1024 * 1024:
            raise ValueError('Excel workbook expands beyond the 100 MB safety limit.')


def read_upload(content, filename, sheet_name=None):
    if not content or len(content) > MAX_BYTES:
        raise ValueError('File must be non-empty and no larger than 20 MB.')
    suffix = Path(filename).suffix.lower()
    try:
        if suffix == '.csv':
            text = content.decode('utf-8-sig')
            reader = csv.reader(StringIO(text), strict=True)
            headers = _headers(next(reader, []))
            records = []
            for row in reader:
                if len(records) >= MAX_ROWS:
                    raise ValueError('Maximum supported size is 100,000 rows.')
                if not row:
                    row = [''] * len(headers)
                if len(row) != len(headers):
                    raise ValueError('CSV row width differs from its header. Correct the source; no values were imported.')
                records.append(row)
            frame = pd.DataFrame(records, columns=headers)
        elif suffix == '.xlsx':
            _check_excel(content)
            workbook = load_workbook(BytesIO(content), read_only=True, data_only=False)
            try:
                sheet = workbook[sheet_name] if sheet_name else workbook.worksheets[0]
                rows = sheet.iter_rows(values_only=True)
                headers = _headers(next(rows, []))
                records = []
                for row in rows:
                    if len(records) > MAX_ROWS:
                        raise ValueError('Maximum supported size is 100,000 rows.')
                    records.append(row)
                frame = pd.DataFrame(records, columns=headers)
            finally:
                workbook.close()
        else:
            raise ValueError('Only .csv and .xlsx files are supported.')
    except (UnicodeError, csv.Error, pd.errors.ParserError, BadZipFile, ParseError, InvalidFileException, KeyError, IndexError, OSError, EOFError) as exc:
        raise ValueError('Unable to read file. Use a UTF-8 CSV or a valid unencrypted XLSX workbook.') from exc
    if len(frame) > MAX_ROWS:
        raise ValueError('Maximum supported size is 100,000 rows.')
    if frame.empty:
        raise ValueError('The selected file or worksheet contains headers but no data rows.')
    return frame


def excel_sheets(content):
    if not content or len(content) > MAX_BYTES:
        raise ValueError('File must be non-empty and no larger than 20 MB.')
    try:
        _check_excel(content)
        book = load_workbook(BytesIO(content), read_only=True)
        names = book.sheetnames
        book.close()
        return names
    except (BadZipFile, ParseError, InvalidFileException, OSError, KeyError, EOFError) as exc:
        raise ValueError('Unable to read workbook worksheets.') from exc


def load_demo():
    raw = pd.read_csv(ROOT / 'data' / 'demo_shipments.csv', dtype=str)
    result = normalize(raw, {c: c for c in raw})
    if result.blockers or not result.quarantined.empty:
        raise ValueError('Demo fixture failed validation.')
    return result.valid
