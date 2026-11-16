/* Shared data rules. No network access or browser storage is used. */
(function (root) {
    'use strict';
    const dayMilliseconds = 86400000;
    const dateFields = ['Arrival Date', 'Discharge Date', 'Gate Out Date', 'Delivery Deadline', 'Delivery Date', 'Return Date', 'DEM Deadline', 'DET Deadline', 'Source Updated At'];
    const textFields = ['Container Number', 'BL Number', 'Vessel Name', 'Shipping Line', 'Delivery Status', 'RFC Status', 'Return Status', 'Delay Category', 'Root Cause', 'Currency'];
    const numberFields = ['DEM Daily Rate', 'DET Daily Rate'];
    const schema = [...textFields, ...dateFields, ...numberFields];
    const required = ['Container Number', 'BL Number'];

    function isMissing(value) {
        return value === null || value === undefined || String(value).trim() === '';
    }

    function parseCSV(text) {
        text = text.replace(/^\uFEFF/, '');
        const records = [];
        let record = [], field = '', quoted = false, closedQuote = false;
        function finishField() {
            record.push(field);
            field = '';
            closedQuote = false;
        }
        function finishRecord() {
            finishField();
            records.push(record);
            record = [];
            if (records.length > 100001) throw new Error('Maximum supported size is 100,000 data rows.');
        }
        for (let index = 0; index < text.length; index++) {
            const character = text[index];
            if (quoted) {
                if (character === '"' && text[index + 1] === '"') {
                    field += '"';
                    index++;
                } else if (character === '"') {
                    quoted = false;
                    closedQuote = true;
                } else {
                    field += character;
                }
            } else if (character === '"') {
                if (field !== '' || closedQuote) throw new Error('CSV has an unexpected quote. Correct the source file.');
                quoted = true;
            } else if (character === ',') {
                finishField();
            } else if (character === '\n' || character === '\r') {
                if (character === '\r' && text[index + 1] === '\n') index++;
                finishRecord();
            } else {
                if (closedQuote) throw new Error('Unexpected text after a quoted CSV field.');
                field += character;
            }
        }
        if (quoted) throw new Error('CSV contains an unfinished quoted field.');
        if (field !== '' || record.length || closedQuote) finishRecord();
        const headers = records.shift() || [];
        if (!headers.length || headers.some(name => !name.trim())) throw new Error('Every column needs a non-empty header.');
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers found. Rename them in the source.');
        if (!records.length) throw new Error('File contains no data rows.');
        const rows = records.map((values, index) => {
            if (values.length === 1 && values[0] === '') values = headers.map(() => '');
            if (values.length !== headers.length) throw new Error(`CSV record ${index + 2} has a different field count from its header.`);
            return Object.fromEntries(headers.map((name, position) => [name, values[position]]));
        });
        return { headers, rows };
    }

    function parseDate(value, format = 'ISO') {
        if (isMissing(value)) return null;
        if (value instanceof Date) {
            if (!Number.isFinite(value.getTime())) return null;
            return value.toISOString().slice(0, 10);
        }
        if (typeof value !== 'string') return null;
        let match, year, month, day;
        if (format === 'ISO') {
            match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
            if (match) [, year, month, day] = match;
        } else {
            const pattern = format === 'DMYDASH' ? /^(\d{2})-(\d{2})-(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/;
            match = pattern.exec(value.trim());
            if (match) {
                year = match[3];
                day = format === 'MDY' ? match[2] : match[1];
                month = format === 'MDY' ? match[1] : match[2];
            }
        }
        if (!match || Number(year) < 1900 || Number(year) > 9999) return null;
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
        return date.toISOString().slice(0, 10);
    }

    function daysBetween(end, start) {
        if (!end || !start) return null;
        const difference = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / dayMilliseconds;
        return Number.isFinite(difference) ? Math.round(difference) : null;
    }

    function addDays(date, days) {
        if (!date) return null;
        return new Date(Date.parse(date + 'T00:00:00Z') + days * dayMilliseconds).toISOString().slice(0, 10);
    }

    function normalize(source, mapping, options = {}) {
        const issues = [], quarantined = [], blockers = [], normalized = [];
        const statusMap = options.statusMap || { Delivered: 'Delivered', Pending: 'Pending' };
        const selected = Object.values(mapping).filter(value => value && value !== '(Not mapped)');
        if (new Set(selected).size !== selected.length) blockers.push('Each source column may map to only one field.');
        for (const field of required) {
            if (!source.headers.includes(mapping[field])) blockers.push(`Required mapping missing: ${field}.`);
        }
        const badRows = new Set();
        function report(index, field, message, exclude = false) {
            issues.push({ 'Source Row': index + 2, Field: field, Severity: exclude ? 'Error' : 'Warning', Issue: message });
            if (exclude) badRows.add(index);
        }
        source.rows.forEach((original, index) => {
            const row = { 'Source Row': index + 2 };
            for (const field of schema) {
                const sourceName = mapping[field];
                const value = sourceName && Object.hasOwn(original, sourceName) ? original[sourceName] : null;
                if (value && typeof value === 'object' && typeof value.formula === 'string') {
                    row[field] = null;
                    report(index, field, 'Formula cell: paste values in a copy of the workbook and re-import. Formulas and cached results are not treated as current operational values.', true);
                    continue;
                }
                if (dateFields.includes(field)) {
                    row[field] = parseDate(value, options.dateFormat || 'ISO');
                    if (!isMissing(value) && row[field] === null) report(index, field, 'Invalid date for selected format; row quarantined.', true);
                } else if (numberFields.includes(field)) {
                    const text = isMissing(value) ? '' : String(value).trim();
                    row[field] = text === '' ? null : Number(text);
                    if (text !== '' && (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text) || !Number.isFinite(row[field]) || row[field] < 0)) {
                        report(index, field, 'Rate must be a finite non-negative number; row quarantined.', true);
                        row[field] = null;
                    }
                } else {
                    row[field] = isMissing(value) ? null : String(value).trim();
                    if (typeof value === 'string' && value !== (row[field] || '')) report(index, field, 'Whitespace trimmed in analytics copy. Original value preserved.');
                }
            }
            for (const field of required) {
                if (!row[field]) report(index, field, 'Missing counting key; row quarantined.', true);
            }
            const sourceStatus = row['Delivery Status'];
            row['Delivery Status'] = sourceStatus !== null && Object.hasOwn(statusMap, sourceStatus) ? statusMap[sourceStatus] : 'Unknown';
            if (!['Delivered', 'Pending'].includes(row['Delivery Status'])) row['Delivery Status'] = 'Unknown';
            if (row['Delivery Status'] === 'Unknown') report(index, 'Delivery Status', 'Missing or unmapped status; counted as Unknown, never Pending.');
            for (const [end, start] of [['Delivery Date', 'Arrival Date'], ['Return Date', 'Gate Out Date'], ['Gate Out Date', 'Discharge Date']]) {
                if (daysBetween(row[end], row[start]) < 0) report(index, end, `${end} precedes ${start}; row quarantined.`, true);
            }
            if (row['Delivery Status'] === 'Pending' && row['Delivery Date']) report(index, 'Delivery Status', 'Pending conflicts with actual Delivery Date; row quarantined.', true);
            if (row['Delivery Status'] === 'Delivered' && !row['Delivery Date']) report(index, 'Delivery Date', 'Delivered without actual date; lead time is unavailable.');
            if (row['Delivery Status'] === 'Pending' && !row['Delivery Deadline']) report(index, 'Delivery Deadline', 'Pending without target; deadline risk unknown.');
            for (const field of ['Vessel Name', 'Shipping Line', 'Arrival Date']) {
                if (!row[field]) report(index, field, 'Missing shipment information; associated analysis may be unavailable.');
            }
            normalized.push(row);
        });
        const keys = new Map();
        normalized.forEach((row, index) => {
            if (!row['Container Number'] || !row['BL Number']) return;
            const key = JSON.stringify(required.map(field => row[field]));
            if (!keys.has(key)) keys.set(key, []);
            keys.get(key).push(index);
        });
        for (const indices of keys.values()) {
            if (indices.length > 1) indices.forEach(index => report(index, 'Counting key', 'Duplicate BL/container pair; all matching rows quarantined.', true));
        }
        const valid = [];
        normalized.forEach((row, index) => {
            if (badRows.has(index) || blockers.length) quarantined.push({ ...source.rows[index] });
            else valid.push(row);
        });
        return { valid, quarantined, issues, blockers };
    }

    function metrics(rows, asOf, warningDays = 3) {
        const result = { total: rows.length, delivered: 0, pending: 0, unknown: 0, overdue: 0, approaching: 0, rate: null };
        rows.forEach(row => {
            if (row['Delivery Status'] === 'Delivered') result.delivered++;
            else if (row['Delivery Status'] === 'Pending') {
                result.pending++;
                const days = daysBetween(row['Delivery Deadline'], asOf);
                if (days !== null && days < 0) result.overdue++;
                if (days !== null && days >= 0 && days <= warningDays) result.approaching++;
            } else result.unknown++;
        });
        if (rows.length) result.rate = result.delivered / rows.length * 100;
        return result;
    }

    function leadTime(row, start = 'Arrival Date') {
        const days = daysBetween(row['Delivery Date'], row[start]);
        return row['Delivery Status'] === 'Delivered' && days !== null && days >= 0 ? days : null;
    }

    function delayDays(row, asOf) {
        let end = null;
        if (row['Delivery Status'] === 'Delivered') end = row['Delivery Date'];
        if (row['Delivery Status'] === 'Pending') end = asOf;
        const days = daysBetween(end, row['Delivery Deadline']);
        return days === null ? null : Math.max(0, days);
    }

    function exposure(row, kind, asOf, rules = {}) {
        if (!['DEM', 'DET'].includes(kind)) throw new Error('Exposure type must be DEM or DET.');
        const startField = rules.startColumn || (kind === 'DEM' ? 'Discharge Date' : 'Gate Out Date');
        const start = row[startField];
        let deadline = row[kind + ' Deadline'];
        if (rules.freeDays !== null && rules.freeDays !== undefined) {
            if (!Number.isInteger(rules.freeDays) || rules.freeDays < 0) throw new Error('Free days must be a non-negative whole number.');
            if (!deadline) deadline = addDays(start, rules.freeDays);
        }
        const end = row[kind === 'DEM' ? 'Gate Out Date' : 'Return Date'];
        const futureEnd = Boolean(end && end > asOf);
        const invalidStart = Boolean(start && (start > asOf || (deadline && deadline < start) || (end && end < start)));
        const closed = Boolean(end && !futureEnd);
        const effectiveEnd = end ? (futureEnd ? null : end) : (rules.assumeOpen ? asOf : null);
        let state = closed ? 'Closed' : 'Open / unconfirmed';
        if (futureEnd) state = 'Future end / unknown';
        if (!deadline) state = 'Requires Configuration';
        if (invalidStart) state = 'Invalid start/deadline / unknown';
        const duration = daysBetween(effectiveEnd, deadline);
        const chargeDays = futureEnd || invalidStart || duration === null ? null : Math.max(0, duration);
        const rate = row[kind + ' Daily Rate'];
        const charge = rules.flatTariff && rate !== null && rate !== undefined && row.Currency && chargeDays !== null ? chargeDays * rate : null;
        return {
            deadline, state, chargeDays, charge,
            remaining: closed || futureEnd || invalidStart ? null : daysBetween(deadline, asOf),
            basis: charge !== null ? 'Estimated flat daily rate' : 'Requires Configuration / usable dates',
        };
    }

    function filterRows(rows, filters) {
        return rows.filter(row => {
            const value = row[filters.dateField || 'Arrival Date'];
            if (!value && !filters.includeMissing) return false;
            if (value && ((filters.from && value < filters.from) || (filters.to && value > filters.to))) return false;
            for (const [field, selected] of Object.entries(filters.values || {})) {
                if (selected.length && !selected.includes(row[field] || 'Not Available')) return false;
            }
            return true;
        });
    }

    function groupRows(rows, field) {
        const groups = new Map();
        rows.forEach(row => {
            const value = typeof field === 'function' ? field(row) : row[field];
            const name = value || 'Not Available';
            if (!groups.has(name)) groups.set(name, []);
            groups.get(name).push(row);
        });
        return groups;
    }

    function mean(values) {
        const measured = values.filter(value => value !== null && Number.isFinite(value));
        return measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : null;
    }

    function summary(rows, field, asOf) {
        return [...groupRows(rows, field)].map(([name, members]) => {
            const counts = metrics(members, asOf);
            const leads = members.map(row => leadTime(row)).filter(value => value !== null);
            return {
                Group: name, Containers: counts.total, Delivered: counts.delivered, Pending: counts.pending,
                Unknown: counts.unknown, Overdue: counts.overdue, 'Delivery Rate (%)': counts.rate,
                'Average Lead (days)': mean(leads), 'Lead Samples': leads.length,
            };
        });
    }

    function safeText(value) {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : 'Invalid Date';
        if (typeof value === 'object' && typeof value.formula === 'string') value = value.formula;
        const text = String(value);
        return /^[\s]*[=+\-@\t\r]/.test(text) && typeof value === 'string' ? "'" + text : text;
    }

    function toCSV(rows, headers = null) {
        headers = headers || [...new Set(rows.flatMap(row => Object.keys(row)))];
        const quote = value => '"' + safeText(value).replace(/"/g, '""') + '"';
        return '\uFEFF' + [headers.map(quote).join(','), ...rows.map(row => headers.map(name => quote(row[name])).join(','))].join('\r\n');
    }

    const api = { schema, dateFields, required, parseCSV, parseDate, normalize, metrics, leadTime, delayDays, exposure,
        filterRows, groupRows, summary, mean, daysBetween, addDays, safeText, toCSV };
    root.FFMCore = api;
    if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
