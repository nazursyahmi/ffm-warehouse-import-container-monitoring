/* Checks page generation without a browser. These are not visual/browser tests. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../assets/dashboard-core.js');
const Workbook = require('../assets/workbook.js');
const Demo = require('../assets/demo-data.js');

function application(source = null) {
    const nodes = new Map();
    function node(id) {
        if (!nodes.has(id)) nodes.set(id, {
            id, innerHTML: '', textContent: '', hidden: false, listeners: {},
            addEventListener(type, action) { this.listeners[type] = action; },
            querySelectorAll() { return []; },
            classList: { toggle() {}, remove() {} },
            attributes: {}, setAttribute(key, value) { this.attributes[key] = String(value); },
            getAttribute(key) { return this.attributes[key] ?? null; },
            querySelector() { return null; }, replaceWith() {}, replaceChildren() {},
            focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
        });
        return nodes.get(id);
    }
    const document = { getElementById: node, listeners: {},
        addEventListener(type, action) { this.listeners[type] = action; },
        querySelectorAll() { return []; }, querySelector() { return node('filter-panel'); } };
    const context = { document, console, Intl, Date, Map, Set, Promise, TextEncoder, TextDecoder, Blob,
        location: { hash: '' }, FFMCore: Core, FFMWorkbook: Workbook,
        events: {}, plots: [], intervals: [], frames: [], scrollTo() {}, setTimeout, clearTimeout,
        requestAnimationFrame(callback) { context.frames.push(callback); },
        setInterval(callback, milliseconds) { this.intervals.push({ callback, milliseconds }); return this.intervals.length; },
        addEventListener(type, action) { this.events[type] = action; },
        Plotly: { purge() {}, newPlot(target, traces, layout) { target.data = traces; context.plots.push({ traces, layout }); return Promise.resolve(); },
            react(target, traces, layout) { target.data = traces; context.plots.push({ traces, layout }); return Promise.resolve(); } },
    };
    context.window = context;
    node('busy').hidden = true;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('assets/demo-data.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('assets/motion.js', 'utf8'), context);
    // Keep existing page assertions reproducible; random-demo behavior is tested separately.
    context.FFMDemo = source || Core.parseCSV(fs.readFileSync('data/demo_shipments.csv', 'utf8'));
    vm.runInContext(fs.readFileSync('assets/dashboard.js', 'utf8'), context);
    return { context, node, navigate(page) { context.location.hash = '#' + page; context.events.hashchange(); } };
}

test('all seven offline page generators run with correct demo scope', () => {
    const app = application();
    assert.ok(app.node('page-content').innerHTML.includes('62.5%'));
    assert.ok(app.node('page-content').innerHTML.includes('3 overdue containers'));
    for (const [page, content] of [
        ['overview', 'Delivery throughput'], ['dem-det-analysis', 'Demurrage'],
        ['lead-time-analysis', 'Average lead time'], ['performance-comparison', 'Comparison summary'],
        ['root-cause-analysis', 'Root causes: Not Available'], ['shipment-explorer', 'Shipment database'],
    ]) {
        app.navigate(page);
        assert.ok(app.node('page-content').innerHTML.includes(content), page);
        assert.equal(app.node('match-count').textContent, '24 / 24 containers');
        assert.ok(!app.node('page-content').innerHTML.includes('[object Object]'));
    }
});

test('empty and optional-field-only sources generate clear states on every page', () => {
    for (const rows of [[], [{ 'Container Number': 'A', 'BL Number': 'B' }]]) {
        const app = application({ headers: ['Container Number', 'BL Number'], rows });
        for (const page of ['container-monitoring', 'overview', 'dem-det-analysis', 'lead-time-analysis', 'performance-comparison', 'root-cause-analysis', 'shipment-explorer']) {
            app.navigate(page);
            assert.ok(app.node('page-content').innerHTML.length);
            assert.ok(!app.node('page-content').innerHTML.includes('NaN'), page);
        }
    }
});

test('global filter state survives navigation and reset restores all demo rows', () => {
    const app = application();
    const target = { id: 'date-from', dataset: {}, value: '2026-11-08' };
    app.context.document.listeners.change({ target });
    app.navigate('overview');
    assert.equal(app.node('match-count').textContent, '8 / 24 containers');
    app.navigate('shipment-explorer');
    assert.equal(app.node('match-count').textContent, '8 / 24 containers');
    app.node('reset-filters').listeners.click();
    assert.equal(app.node('match-count').textContent, '24 / 24 containers');
});

test('container detail handler includes original source values', async () => {
    const app = application();
    const target = { dataset: { inspect: '2' } };
    target.closest = () => target;
    await app.context.document.listeners.click({ target });
    assert.equal(app.node('detail-dialog').open, true);
    assert.ok(app.node('detail-content').innerHTML.includes('Original source row'));
    assert.ok(app.node('detail-content').innerHTML.includes('DEMO0000001'));
});

test('untrusted shipment labels are escaped in generated markup', () => {
    const app = application({ headers: ['Container Number', 'BL Number', 'Vessel Name'],
        rows: [{ 'Container Number': '<img src=x onerror=alert(1)>', 'BL Number': 'B', 'Vessel Name': '<script>alert(1)</script>' }] });
    assert.ok(!app.node('page-content').innerHTML.includes('<script>alert(1)</script>'));
    assert.ok(app.node('page-content').innerHTML.includes('&lt;script&gt;'));
});

test('offline entrypoint bundles every script and stylesheet locally', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(value => !value.startsWith('#'));
    assert.ok(references.includes('assets/bootstrap.min.css'));
    assert.ok(references.includes('assets/plotly.min.js'));
    for (const reference of references) {
        assert.ok(!/^(?:https?:)?\/\//.test(reference), reference);
        assert.ok(fs.existsSync(reference), reference);
    }
    const { createHash } = require('node:crypto');
    const hash = createHash('sha384').update(fs.readFileSync('assets/bootstrap.min.css')).digest('base64');
    assert.equal(hash, 'yEPZ7jP9S0QKiUQ0m3jjsO4ProIW7wvR9gXkI7JOGa2XVsw53Yke2bsdkBbjmmiX');
});

test('random simulation fills the root-cause and financial demonstration views', () => {
    let seed = 123;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const app = application(Demo.createDemo(random));
    assert.equal(app.node('source-badge').textContent, 'RANDOM DEMO DATA');
    assert.ok(app.node('freshness').innerHTML.includes('fictional'));
    app.navigate('root-cause-analysis');
    assert.ok(app.node('page-content').innerHTML.includes('Recorded delay causes'));
    app.navigate('dem-det-analysis');
    assert.ok(app.node('page-content').innerHTML.includes('Estimated charges'));
    assert.ok(app.node('page-content').innerHTML.includes('MYR'));
    assert.equal(app.node('match-count').textContent, '180 / 180 containers');
});

test('randomize demo action generates a new labelled dataset', async () => {
    const app = application();
    const target = { dataset: { action: 'regenerate-demo' } };
    target.closest = () => target;
    await app.context.document.listeners.click({ target });
    assert.equal(app.node('match-count').textContent, '180 / 180 containers');
    assert.ok(app.node('toast').textContent.includes('fictional'));
});

test('demo refreshes every second and preserves the selected global filters', () => {
    const app = application(Demo.createDemo());
    assert.equal(app.context.intervals.length, 1);
    assert.equal(app.context.intervals[0].milliseconds, 1000);
    app.context.document.listeners.change({ target: { id: 'date-from', dataset: {}, value: '2026-11-08' } });
    app.context.intervals[0].callback();
    assert.ok(app.node('global-filters').innerHTML.includes('value="2026-11-08"'));
    assert.ok(app.node('freshness').innerHTML.includes('every second'));
    assert.ok(app.node('match-count').textContent.endsWith('/ 180 containers'));
});

test('automatic demo refresh pauses while a dialog is open', () => {
    const app = application();
    app.node('import-dialog').open = true;
    app.context.intervals[0].callback();
    assert.equal(app.node('match-count').textContent, '24 / 24 containers');
});

test('retained gauge animates its arc and label through intermediate values', async () => {
    const app = application();
    const gauge = app.node('existing-gauge');
    const arc = app.node('arc');
    const label = app.node('gauge-label');
    gauge.setAttribute('data-rate', '40');
    gauge.querySelector = selector => selector === '.gauge-arc' ? arc : label;
    app.node('page-content').querySelector = () => gauge;
    const next = app.node('next-gauge');
    next.setAttribute('data-rate', '80');
    next.setAttribute('aria-label', 'Delivery rate 80 percent');
    app.context.document.createElement = () => ({ content: { querySelector: selector => selector === '#delivery-gauge' ? next : null } });
    app.context.document.listeners.change({ target: { id: 'focus-vessel', value: '', dataset: {} } });
    await app.context.frames.shift()(0);
    await app.context.frames.shift()(425);
    assert.equal(label.textContent, '60.0%');
    assert.ok(Math.abs(Number(arc.getAttribute('stroke-dashoffset')) - 150.8) < 0.001);
    await app.context.frames.shift()(850);
    assert.equal(label.textContent, '80.0%');
});

test('retained pie chart draws intermediate geometry rather than snapping to target', async () => {
    const app = application();
    app.navigate('overview');
    const chart = app.node('chart-1');
    chart.id = 'chart-1';
    chart.setAttribute('aria-label', 'Shipment status');
    const before = [...chart.data[0].values];
    app.node('page-content').querySelectorAll = () => [chart];
    const placeholder = app.node('next-chart');
    placeholder.setAttribute('aria-label', 'Shipment status');
    app.context.document.createElement = () => ({ content: { querySelector: selector => selector === '#chart-1' ? placeholder : null } });
    app.context.FFMCreateDemo = () => Demo.createDemo(() => 0.2);
    const target = { dataset: { action: 'regenerate-demo' }, closest() { return this; } };
    await app.context.document.listeners.click({ target });
    async function tick(time) {
        const frames = app.context.frames.splice(0);
        await Promise.all(frames.map(callback => callback(time)));
    }
    await tick(0);
    await tick(425);
    const middle = [...chart.data[0].values];
    await tick(850);
    const after = [...chart.data[0].values];
    assert.notDeepEqual(before, after);
    assert.deepEqual(middle, before.map((value, index) => (value + after[index]) / 2));
});
