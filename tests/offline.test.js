/* Developer tests only. Opening index.html never requires Node.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../assets/dashboard-core.js');
const Workbook = require('../assets/workbook.js');
const Demo = require('../assets/demo-data.js');

test('demo ticks create visible changes across up to 54 containers without mutating the previous snapshot', () => {
    const source = Demo.createDemo(() => 0.2);
    const original = JSON.stringify(source);
    const next = Demo.advanceDemo(source, () => 0.8);
    const changed = next.rows.filter((row, index) => JSON.stringify(row) !== JSON.stringify(source.rows[index]));
    assert.equal(changed.length, 54);
    const beforeRate = Core.metrics(Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name]))).valid, '2026-11-16').rate;
    assert.equal(next.rows.length, 180);
    assert.equal(JSON.stringify(source), original);
    assert.deepEqual(next.rows.map(row => row['Container Number']), source.rows.map(row => row['Container Number']));
    const result = Core.normalize(next, Object.fromEntries(next.headers.map(name => [name, name])));
    assert.equal(result.valid.length, 180);
    assert.equal(result.quarantined.length, 0);
    assert.ok(Math.abs(Core.metrics(result.valid, '2026-11-16').rate - beforeRate) >= 10);
    const empty = { headers: source.headers, rows: [] };
    assert.deepEqual(Demo.advanceDemo(empty).rows, []);
});

test('random demo populates all analyses with valid chronological synthetic records', () => {
    let seed = 42;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const source = Demo.createDemo(random);
    const result = Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name])));
    assert.equal(result.valid.length, 180);
    assert.equal(result.quarantined.length, 0);
    assert.equal(result.blockers.length, 0);
    assert.ok(result.valid.every(row => row['Container Number'].startsWith('DEMO')));
    assert.ok(new Set(result.valid.map(row => row['Arrival Date'].slice(0, 7))).size >= 4);
    assert.ok(result.valid.some(row => row['Root Cause']));
    assert.ok(result.valid.some(row => Core.exposure(row, 'DEM', '2026-11-16', { flatTariff: true, assumeOpen: true }).charge > 0));
    assert.ok(result.valid.some(row => Core.exposure(row, 'DET', '2026-11-16', { flatTariff: true, assumeOpen: true }).charge > 0));
    const metrics = Core.metrics(result.valid, '2026-11-16');
    assert.ok(metrics.overdue > 0);
    assert.ok(metrics.approaching > 0);
});

test('different random streams produce different demo values', () => {
    const first = Demo.createDemo(() => 0.2);
    const second = Demo.createDemo(() => 0.8);
    assert.notDeepEqual(first.rows, second.rows);
});

function prepare(rows, options = {}) {
    const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
    return Core.normalize({ headers, rows }, Object.fromEntries(headers.map(name => [name, name])), options);
}

test('CSV preserves identifiers, quoted fields, blank rows and source values', () => {
    const source = Core.parseCSV('Container Number,BL Number,Note\r\n0001,B,"one, two"\r\n\r\n0002,C,"line\nnext"\r\n');
    assert.equal(source.rows.length, 3);
    assert.equal(source.rows[0]['Container Number'], '0001');
    assert.equal(source.rows[0].Note, 'one, two');
    assert.equal(source.rows[2].Note, 'line\nnext');
    assert.equal(prepare(source.rows).quarantined.length, 1);
});

test('CSV rejects extra fields, duplicate headers and unfinished quotes', () => {
    for (const input of ['A,A\n1,2', 'A,B\n1,2,3', 'A,B\n"bad,2']) {
        assert.throws(() => Core.parseCSV(input));
    }
});

test('mapping and strict dates never mutate the source', () => {
    const source = { headers: ['Box', 'Bill', 'Date', 'State'], rows: [{ Box: ' 001 ', Bill: 'B', Date: '31/01/2026', State: 'Done' }] };
    const result = Core.normalize(source, { 'Container Number': 'Box', 'BL Number': 'Bill', 'Arrival Date': 'Date', 'Delivery Status': 'State' },
        { dateFormat: 'DMY', statusMap: { Done: 'Delivered' } });
    assert.equal(source.rows[0].Box, ' 001 ');
    assert.equal(result.valid[0]['Container Number'], '001');
    assert.equal(result.valid[0]['Arrival Date'], '2026-01-31');
    assert.equal(result.valid[0]['Delivery Status'], 'Delivered');
    assert.ok(result.issues.length > 0);
});

test('invalid dates and every duplicate key are quarantined', () => {
    const result = prepare([
        { 'Container Number': 'A', 'BL Number': 'B' },
        { 'Container Number': 'A', 'BL Number': 'B' },
        { 'Container Number': 'C', 'BL Number': 'D', 'Arrival Date': '2026-02-30' },
        { 'Container Number': 'E', 'BL Number': 'F' },
    ]);
    assert.equal(result.valid.length, 1);
    assert.equal(result.quarantined.length, 3);
    assert.equal(result.valid[0]['Delivery Status'], 'Unknown');
});

test('missing required mapping blocks activation', () => {
    const result = Core.normalize({ headers: ['Box'], rows: [{ Box: 'A' }] }, { 'Container Number': 'Box' });
    assert.ok(result.blockers.length);
    assert.equal(result.valid.length, 0);
});

test('missing statuses cannot match a literal null status mapping', () => {
    const source = { headers: ['Container Number', 'BL Number', 'Delivery Status', 'undefined'], rows: [
        { 'Container Number': 'A', 'BL Number': 'B', 'Delivery Status': '', undefined: 'not a mapped vessel' },
        { 'Container Number': 'C', 'BL Number': 'D', 'Delivery Status': 'null', undefined: 'not a mapped vessel' },
    ] };
    const result = Core.normalize(source, { 'Container Number': 'Container Number', 'BL Number': 'BL Number', 'Delivery Status': 'Delivery Status' }, { statusMap: { null: 'Delivered' } });
    assert.equal(result.valid.length, 2, 'Unmapped fields must not read a source column named undefined');
    assert.equal(result.valid[0]['Delivery Status'], 'Unknown');
    assert.equal(result.valid[1]['Delivery Status'], 'Delivered');
    assert.equal(result.valid[0]['Vessel Name'], null);
});

test('consistent KPIs include unknown status in denominator but never Pending', () => {
    const rows = prepare([
        { 'Container Number': 'A', 'BL Number': 'B', 'Delivery Status': 'Delivered', 'Arrival Date': '2026-11-01', 'Delivery Date': '2026-11-05' },
        { 'Container Number': 'C', 'BL Number': 'D', 'Delivery Status': 'Pending', 'Delivery Deadline': '2026-11-16' },
        { 'Container Number': 'E', 'BL Number': 'F', 'Delivery Status': 'Other', 'Delivery Deadline': '2026-11-01' },
    ]).valid;
    const metrics = Core.metrics(rows, '2026-11-16', 0);
    assert.equal(metrics.total, 3);
    assert.equal(metrics.delivered, 1);
    assert.equal(metrics.pending, 1);
    assert.equal(metrics.unknown, 1);
    assert.equal(metrics.approaching, 1);
    assert.equal(metrics.overdue, 0);
    assert.equal(Core.leadTime(rows[0]), 4);
    assert.equal(Core.metrics([], '2026-11-16').rate, null);
});

test('delay can be measured for pending containers without actual deliveries', () => {
    const row = prepare([{ 'Container Number': 'A', 'BL Number': 'B', 'Delivery Status': 'Pending', 'Delivery Deadline': '2026-11-10' }]).valid[0];
    assert.equal(Core.delayDays(row, '2026-11-16'), 6);
    assert.equal(Core.leadTime(row), null);
});

test('exposure requires real tariff and known closure or explicit open assumption', () => {
    const row = prepare([{ 'Container Number': 'A', 'BL Number': 'B', 'DEM Deadline': '2026-11-10', 'DEM Daily Rate': '10', Currency: 'MYR' }]).valid[0];
    assert.equal(Core.exposure(row, 'DEM', '2026-11-16').charge, null);
    assert.equal(Core.exposure(row, 'DEM', '2026-11-16', { flatTariff: true }).charge, null);
    assert.equal(Core.exposure(row, 'DEM', '2026-11-16', { flatTariff: true, assumeOpen: true }).charge, 60);
});

test('future starts, future ends and deadline-before-start never produce estimates', () => {
    for (const fields of [
        { 'Gate Out Date': '2026-11-20', 'DET Deadline': '2026-11-10' },
        { 'Gate Out Date': '2026-11-12', 'DET Deadline': '2026-11-10' },
        { 'Gate Out Date': '2026-11-01', 'DET Deadline': '2026-11-10', 'Return Date': '2026-11-20' },
    ]) {
        const row = prepare([{ 'Container Number': 'A', 'BL Number': 'B', 'DET Daily Rate': '10', Currency: 'MYR', ...fields }]).valid[0];
        const result = Core.exposure(row, 'DET', '2026-11-16', { flatTariff: true, assumeOpen: true });
        assert.equal(result.charge, null);
        assert.equal(result.remaining, null);
    }
});

test('configured free days use excluded start day and supplied deadlines win', () => {
    const row = prepare([{ 'Container Number': 'A', 'BL Number': 'B', 'Gate Out Date': '2026-11-10', 'DET Daily Rate': '10', Currency: 'MYR' }]).valid[0];
    const result = Core.exposure(row, 'DET', '2026-11-16', { freeDays: 3, flatTariff: true, assumeOpen: true });
    assert.equal(result.deadline, '2026-11-13');
    assert.equal(result.charge, 30);
});

test('global filters combine and can explicitly include missing dates', () => {
    const rows = prepare([
        { 'Container Number': 'A', 'BL Number': 'B', 'Vessel Name': 'Ship', 'Arrival Date': '2026-11-01' },
        { 'Container Number': 'C', 'BL Number': 'D', 'Vessel Name': 'Ship' },
    ]).valid;
    const filters = { dateField: 'Arrival Date', from: '2026-11-01', to: '2026-11-30', values: { 'Vessel Name': ['Ship'] } };
    assert.equal(Core.filterRows(rows, { ...filters, includeMissing: false }).length, 1);
    assert.equal(Core.filterRows(rows, { ...filters, includeMissing: true }).length, 2);
});

test('CSV escapes formulas in values and headers', () => {
    const text = Core.toCSV([{ '=1+1': '=2+2', BL: '0001' }]);
    assert.ok(text.includes("'=1+1"));
    assert.ok(text.includes("'=2+2"));
    assert.ok(text.includes('0001'));
});

test('invalid source Date values remain downloadable in a quarantine CSV', () => {
    assert.ok(Core.toCSV([{ Date: new Date('invalid') }]).includes('Invalid Date'));
});

test('XLSX writer makes a valid Excel workbook with safe headers and preserved types', () => {
    const { spawnSync } = require('node:child_process');
    const path = require('node:path');
    const bytes = Workbook.write([{ '=1+1': '=2+2', Container: '000001', Rate: 10, Missing: null }]);
    const script = `import sys,base64,io\nfrom openpyxl import load_workbook\nw=load_workbook(io.BytesIO(base64.b64decode(sys.stdin.read())))\ns=w.active\nassert s['A1'].value == "'=1+1"\nassert s['A1'].data_type == 's'\nassert s['A2'].value == "'=2+2"\nassert s['B2'].value == '000001'\nassert s['C2'].value == 10\nassert s.freeze_panes == 'A2'\nprint('Workbook verified by OpenPyXL')`;
    const result = spawnSync(path.resolve('.venv/Scripts/python.exe'), ['-c', script], { input: Buffer.from(bytes).toString('base64'), encoding: 'utf-8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('verified'));
});

test('ZIP reader decompresses a real OpenPyXL workbook and detects corrupt archives', async () => {
    const { spawnSync } = require('node:child_process');
    const path = require('node:path');
    const script = `import sys,io,base64\nfrom openpyxl import Workbook\nw=Workbook();s=w.active;s.append(['Container Number','BL Number']);s.append(['000001','B'])\nb=io.BytesIO();w.save(b);sys.stdout.write(base64.b64encode(b.getvalue()).decode())`;
    const result = spawnSync(path.resolve('.venv/Scripts/python.exe'), ['-c', script], { encoding: 'utf-8' });
    assert.equal(result.status, 0, result.stderr);
    const entries = await Workbook.unzip(Buffer.from(result.stdout, 'base64'));
    assert.ok(new TextDecoder().decode(entries.get('xl/worksheets/sheet1.xml')).includes('000001'));
    await assert.rejects(() => Workbook.unzip(new Uint8Array([1, 2, 3])), /valid XLSX/);
});

test('XLSX export rejects invalid XML characters rather than losing source text', () => {
    assert.throws(() => Workbook.write([{ Note: '\u0000' }]), /control characters/);
});

test('selected exposure start cannot follow its actual end event', () => {
    const row = prepare([{ 'Container Number': 'A', 'BL Number': 'B', 'Gate Out Date': '2026-11-12',
        'Delivery Date': '2026-11-16', 'Return Date': '2026-11-14', 'DET Deadline': '2026-11-17',
        'DET Daily Rate': 10, Currency: 'MYR' }]).valid[0];
    const result = Core.exposure(row, 'DET', '2026-11-16', { startColumn: 'Delivery Date', flatTariff: true });
    assert.equal(result.charge, null);
    assert.ok(result.state.includes('unknown'));
});

test('mapped XLSX formulas are quarantined rather than counted as actual values', () => {
    const result = prepare([{ 'Container Number': { formula: '=A1', cached: 'ABC' }, 'BL Number': 'B' }]);
    assert.equal(result.valid.length, 0);
    assert.equal(result.quarantined.length, 1);
    assert.ok(result.issues.some(issue => issue.Issue.includes('Formula')));
    assert.ok(Core.toCSV(result.quarantined).includes("'=A1"));
});

test('XLSX worksheet reading preserves real dates, handles 1904 dates and rejects formula/time-only measurements', async () => {
    const { spawnSync } = require('node:child_process');
    const path = require('node:path');
    const python = path.resolve('.venv/Scripts/python.exe');
    // Node has no DOMParser. This test adapter uses a real XML parser from the
    // installed Python standard library, then exposes the DOM read methods used
    // by workbook.js. The dashboard itself uses the browser's native DOMParser.
    class XMLNode {
        constructor(data) { this.data = data; this.textContent = data.text || ''; this.children = (data.children || []).map(child => new XMLNode(child)); }
        getAttribute(name) { return this.data.attrs?.[name] ?? null; }
        getAttributeNS(namespace, name) { return this.getAttribute('{' + namespace + '}' + name); }
        getElementsByTagNameNS(namespace, name) {
            return this.children.flatMap(child => [ ...(child.data.name === name ? [child] : []), ...child.getElementsByTagNameNS(namespace, name) ]);
        }
        getElementsByTagName(name) { return this.getElementsByTagNameNS('*', name); }
    }
    global.DOMParser = class {
        parseFromString(text) {
            const script = `import sys,json,xml.etree.ElementTree as ET\ndef node(e):\n return dict(name=e.tag.split('}')[-1],attrs=e.attrib,text=''.join(e.itertext()),children=[node(c) for c in e])\ntry:\n data=node(ET.fromstring(sys.stdin.read()))\nexcept ET.ParseError:\n data=dict(name='parsererror',text='invalid XML')\nprint(json.dumps(dict(name='document',children=[data])))`;
            const result = spawnSync(python, ['-c', script], { input: text, encoding: 'utf-8' });
            assert.equal(result.status, 0, result.stderr);
            return new XMLNode(JSON.parse(result.stdout));
        }
    };
    try {
        for (const use1904 of [false, true]) {
            const script = `import sys,io,base64\nfrom datetime import datetime,time\nfrom openpyxl import Workbook\nfrom openpyxl.utils.datetime import CALENDAR_MAC_1904\nw=Workbook()\n${use1904 ? 'w.epoch=CALENDAR_MAC_1904' : ''}\nw.active.title='Cover';w.active.append(['Read me'])\ns=w.create_sheet('Data');s.append(['Container Number','BL Number','Arrival Date','DEM Daily Rate'])\ns.append(['000001','B',datetime(2026,11,2),10])\ns.append(['000002','C',datetime(2026,11,3),'=10+10'])\ns.append(['000003','D',time(8,30),10])\nb=io.BytesIO();w.save(b);sys.stdout.write(base64.b64encode(b.getvalue()).decode())`;
            const result = spawnSync(python, ['-c', script], { encoding: 'utf-8' });
            assert.equal(result.status, 0, result.stderr);
            const workbook = await Workbook.open(Buffer.from(result.stdout, 'base64'));
            assert.deepEqual(workbook.sheets.map(sheet => sheet.name), ['Cover', 'Data']);
            assert.throws(() => Workbook.readSheet(workbook, 0), /no data/);
            const source = Workbook.readSheet(workbook, 1);
            assert.equal(source.rows[0]['Container Number'], '000001');
            assert.equal(Core.parseDate(source.rows[0]['Arrival Date']), '2026-11-02');
            assert.equal(source.rows[1]['DEM Daily Rate'].formula, '=10+10');
            const normalized = Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name])));
            assert.equal(normalized.valid.length, 1);
            assert.equal(normalized.quarantined.length, 2);
            const sheetPath = 'xl/worksheets/sheet2.xml';
            const sheetXML = new TextDecoder().decode(workbook.entries.get(sheetPath));
            const malformedDateXML = sheetXML.replace(/<c\b[^>]*r="C2"[^>]*>[\s\S]*?<\/c>/, '<c r="C2" t="d"><v>not-a-date</v></c>');
            workbook.entries.set(sheetPath, new TextEncoder().encode(malformedDateXML));
            assert.equal(Workbook.readSheet(workbook, 1).rows[0]['Arrival Date'], 'not-a-date');
            workbook.entries.set('xl/worksheets/sheet2.xml', new TextEncoder().encode('<broken'));
            assert.throws(() => Workbook.readSheet(workbook, 1), /invalid XML/);
        }
    } finally { delete global.DOMParser; }
});
