/* Offline application UI. Source data lives in this tab's memory only. */
(function () {
    'use strict';
    const Core = window.FFMCore;
    const Workbook = window.FFMWorkbook;
    const Motion = window.FFMMotion;
    const motionDuration = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 850;

    function updateGauge(target, next) {
        target._ffmCancel?.();
        const end = Number(next.getAttribute('data-rate'));
        const start = target._ffmValue ?? Number(target.getAttribute('data-rate'));
        const known = next.getAttribute('data-rate') !== '';
        target.setAttribute('aria-label', next.getAttribute('aria-label'));
        target.setAttribute('data-rate', next.getAttribute('data-rate'));
        const arc = target.querySelector('.gauge-arc');
        const value = target.querySelector('.gauge-value');
        arc.setAttribute('stroke', known ? colors.accent : colors.grey);
        const draw = progress => {
            const displayed = Motion.blend(start, end, progress);
            target._ffmValue = displayed;
            arc.setAttribute('stroke-dashoffset', 377 * (1 - displayed / 100));
            value.textContent = known ? displayed.toFixed(1) + '%' : 'N/A';
        };
        if (Motion && motionDuration() && known) target._ffmCancel = Motion.animate(motionDuration(), draw);
        else draw(1);
    }
    const pages = [
        ['container-monitoring', 'Container Monitoring', 'box', 'Shipment visibility. Clear priorities. Better decisions.'],
        ['overview', 'Overview', 'chart', 'The operational picture, from arrivals to delivery.'],
        ['dem-det-analysis', 'DEM / DET Analysis', 'clock', 'Monitor free-time deadlines and verify financial exposure.'],
        ['lead-time-analysis', 'Lead-Time Analysis', 'route', 'Measure actual journey times and delivery delays.'],
        ['performance-comparison', 'Performance Comparison', 'compare', 'Compare vessels, shipping lines and delivery performance.'],
        ['root-cause-analysis', 'Root-Cause Analysis', 'alert', 'Investigate recorded delays without inventing causes.'],
        ['shipment-explorer', 'Shipment Explorer', 'search', 'Find a container. Inspect its shipment. Export your results.'],
    ];
    const colors = { accent: '#ff747d', green: '#4ade80', amber: '#facc15', red: '#ff6464', grey: '#aeb6c5', blue: '#84b9f5' };
    const defaultColumns = ['Container Number', 'Vessel Name', 'BL Number', 'Shipping Line', 'Delivery Status', 'Arrival Date', 'Delivery Deadline', 'Delivery Date', 'Return Status'];
    const state = {
        page: 'container-monitoring', source: null, rows: [], issues: [], quarantined: [],
        demo: true, filename: 'demo_shipments.csv', loadedAt: '', asOf: '2026-11-16', warningDays: 3,
        filters: {}, rules: {}, focusVessel: '', focusBL: '', exposureKind: 'DEM', exposureGroup: 'Vessel Name',
        leadStart: 'Arrival Date', compareField: 'Vessel Name', compareMeasure: 'Containers', compareGroups: [],
        causeField: 'Delay Category', tableSettings: {}, tableCache: {}, explorerFilters: {},
    };
    let pendingCharts = [], chartNumber = 0, importSource = null, importWorkbook = null, stagedImport = null;
    let toastTimer, searchTimer;
    const element = id => document.getElementById(id);
    const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;

    function format(value, decimals = 1) {
        if (value === null || value === undefined || value === '') return 'Not Available';
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : 'Invalid date';
        if (typeof value === 'object' && value.formula) return value.formula + ' (formula · not evaluated)';
        if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: decimals });
        return String(value);
    }

    function currentDate() {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    }

    function option(value, label, selected) {
        return `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(label)}</option>`;
    }

    function choices(rows, field) {
        return [...new Set(rows.map(row => row[field] || 'Not Available'))].sort((a, b) => a.localeCompare(b));
    }

    function notice(message, tone = '') {
        return `<div class="notice ${tone}">${icon(tone === 'success' ? 'check' : 'alert')}<p>${escape(message)}</p></div>`;
    }

    function empty(message = 'No containers match these filters. Reset the filters or widen the date range.') {
        return `<div class="panel empty-state">${icon('search')}<h2>No matching records</h2><p>${escape(message)}</p></div>`;
    }

    function multiSelect(field, selected, values, scope) {
        return `<div><label>${escape(field)}</label><details class="multi-select"><summary>${selected.length ? escape(selected.length + ' selected') : 'All values'}</summary><div class="multi-options">${values.map(value => `<label><input type="checkbox" data-multi="${scope}" data-field="${escape(field)}" value="${escape(value)}"${selected.includes(value) ? ' checked' : ''}>${escape(value)}</label>`).join('')}</div></details></div>`;
    }

    function resetFilters() {
        const dates = state.rows.map(row => row['Arrival Date']).filter(Boolean).sort();
        state.filters = { dateField: 'Arrival Date', from: dates[0] || '', to: dates.at(-1) || '', includeMissing: true, values: {} };
    }

    function resetRules() {
        for (const kind of ['DEM', 'DET']) state.rules[kind] = { derive: false, freeDays: null, flatTariff: false, assumeOpen: false, startColumn: kind === 'DEM' ? 'Discharge Date' : 'Gate Out Date' };
    }

    function activate(source, result, demo, filename) {
        state.source = source;
        state.rows = result.valid;
        state.issues = result.issues;
        state.quarantined = result.quarantined;
        state.demo = demo;
        state.filename = filename;
        state.loadedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' MYT';
        state.asOf = demo ? '2026-11-16' : currentDate();
        state.warningDays = 3;
        state.focusVessel = ''; state.focusBL = ''; state.compareGroups = [];
        state.explorerFilters = {}; state.tableSettings = {};
        resetFilters(); resetRules();
        if (demo) {
            // These assumptions apply only to labelled fictional sample rates.
            for (const kind of ['DEM', 'DET']) {
                state.rules[kind].flatTariff = true;
                state.rules[kind].assumeOpen = true;
            }
        }
    }

    function renderFilters() {
        const filters = state.filters;
        element('global-filters').innerHTML = `<div class="date-filters"><div><label for="date-field">Date field</label><select id="date-field">${Core.dateFields.slice(0, 8).map(field => option(field, field, filters.dateField)).join('')}</select></div><div><label for="date-from">From</label><input id="date-from" type="date" value="${escape(filters.from)}"></div><div><label for="date-to">To</label><input id="date-to" type="date" value="${escape(filters.to)}"></div></div><div class="filter-grid">${['Vessel Name', 'BL Number', 'Delivery Status', 'Shipping Line'].map(field => multiSelect(field, filters.values[field] || [], choices(state.rows, field), 'global')).join('')}</div><div class="filter-note"><label class="check-label"><input id="include-missing" type="checkbox"${filters.includeMissing ? ' checked' : ''}>Include records without the selected date</label><span>Filters apply to every page. Empty selections include all values.</span></div>`;
        const rows = Core.filterRows(state.rows, filters);
        element('match-count').textContent = `${rows.length.toLocaleString()} / ${state.rows.length.toLocaleString()} containers`;
    }

    function renderFreshness() {
        const badge = element('source-badge');
        badge.textContent = state.demo ? 'RANDOM DEMO DATA' : 'LOCAL FILE';
        element('regenerate-demo').hidden = !state.demo;
        badge.className = 'badge ' + (state.demo ? 'badge-warning' : 'badge-success');
        const updated = state.rows.map(row => row['Source Updated At']).filter(Boolean).sort().at(-1);
        const freshness = state.demo ? 'Random simulation · refreshes every second · 16 Nov 2026 · All rates and causes are fictional' : (updated ? 'Latest supplied update · ' + updated : 'Source freshness · Not Available');
        element('freshness').innerHTML = `<span>Source <strong>${escape(state.filename)}</strong></span><span>${escape(freshness)}</span><span>Assessment <strong>${escape(state.asOf)}</strong></span>${state.demo ? '' : `<span>Loaded ${escape(state.loadedAt)}</span>`}${state.quarantined.length ? `<span class="text-warning">${state.quarantined.length} source rows excluded</span>` : ''}`;
    }

    function metricCards(rows) {
        const values = Core.metrics(rows, state.asOf, state.warningDays);
        const cards = [
            ['Total Containers', values.total, 'BL / container pairs', 'box', ''],
            ['Delivered', values.delivered, 'Recorded delivered status', 'check', 'green'],
            ['Pending', values.pending, 'Awaiting delivery', 'truck', ''],
            ['Delivery Rate', values.rate === null ? null : values.rate.toFixed(1) + '%', 'Delivered / all containers', 'chart', 'green'],
            ['Overdue', values.overdue, 'Past delivery target', 'alert', 'red'],
            ['Approaching Deadline', values.approaching, `Due within ${state.warningDays} days`, 'clock', 'amber'],
        ];
        return `<section class="metric-grid" aria-label="Container KPIs">${cards.map(([label, value, note, name, tone]) => `<article class="metric-card tone-${tone}" title="${escape(note)}"><div class="metric-top"><span>${escape(label)}</span>${icon(name)}</div><div class="metric-value">${escape(format(value))}</div><div class="metric-note">${escape(note)}</div></article>`).join('')}</section>`;
    }

    function smallMetrics(cards) {
        return `<div class="small-metrics">${cards.map(([label, value, note = '']) => `<article class="metric-card"><div class="metric-top">${escape(label)}</div><div class="metric-value">${escape(format(value))}</div><div class="metric-note">${escape(note)}</div></article>`).join('')}</div>`;
    }

    function alerts(rows) {
        const counts = Core.metrics(rows, state.asOf, state.warningDays);
        const items = [];
        if (counts.overdue) items.push(['danger', 'alert', `${counts.overdue} overdue containers`, 'Pending past their supplied delivery target.']);
        if (counts.approaching) items.push(['warning', 'clock', `${counts.approaching} approaching deadline`, `Due today through the next ${state.warningDays} calendar days.`]);
        if (counts.pending) items.push(['warning', 'truck', `${counts.pending} deliveries pending`, 'Confirm the next transport and warehouse actions.']);
        const missing = rows.filter(row => !row['Arrival Date'] || !row['Vessel Name'] || !row['Shipping Line']).length;
        const noTarget = rows.filter(row => row['Delivery Status'] === 'Pending' && !row['Delivery Deadline']).length;
        if (missing || counts.unknown || noTarget) items.push(['warning', 'alert', 'Data quality needs attention', `${counts.unknown} unknown statuses · ${noTarget} pending without targets · ${missing} missing arrival, vessel or line.`]);
        if (!items.length) items.push(['success', 'check', 'No pending delivery alerts', 'All known statuses in this scope are delivered.']);
        return `<section class="panel"><div class="panel-heading"><h2>${icon('alert')} Operational priorities</h2><span class="badge badge-neutral">${items.length} indicators</span></div>${items.map(([tone, name, title, note]) => `<div class="alert-item alert-${tone}">${icon(name)}<div><strong>${escape(title)}</strong><p>${escape(note)}</p></div></div>`).join('')}</section>`;
    }

    function vesselDrawing() {
        return `<svg class="vessel-art" viewBox="0 0 500 180" role="img" aria-label="Static container vessel illustration"><defs><pattern id="container-ribs" width="13" height="40" patternUnits="userSpaceOnUse"><path d="M4 0v40" stroke="#ffabb2" stroke-opacity=".35"/></pattern></defs><path d="M30 120h425l-48 40H85Z" fill="#e34958"/><path d="M45 126h391" stroke="#171b21" stroke-width="5"/><path d="M95 159h304" stroke="#111419" stroke-width="4"/><path d="M50 173q25-12 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0" fill="none" stroke="#6d7f97" stroke-width="3"/><g fill="#354150" stroke="#708096" stroke-width="2"><rect x="98" y="70" width="95" height="47" rx="2"/><rect x="198" y="70" width="95" height="47" rx="2"/><rect x="298" y="70" width="95" height="47" rx="2"/></g><g fill="#622831" stroke="#e34958" stroke-width="2"><rect x="148" y="20" width="95" height="45" rx="2"/><rect x="248" y="20" width="95" height="45" rx="2"/></g><path d="M53 75h36v43H45V89h8Z" fill="#d0d5de"/><path d="M56 83h20m-20 12h20M64 65V44" stroke="#b6bfcd" stroke-width="3"/><path d="M98 70h295v47H98Zm50-50h195v45H148Z" fill="url(#container-ribs)"/></svg>`;
    }

    function gauge(rate) {
        const circumference = 377;
        const percent = rate === null ? 0 : Math.max(0, Math.min(100, rate));
        return `<svg id="delivery-gauge" data-rate="${rate === null ? '' : percent}" class="gauge" viewBox="0 0 150 150" role="img" aria-label="${rate === null ? 'Delivery rate unavailable' : 'Delivery rate ' + rate.toFixed(1) + ' percent'}"><circle cx="75" cy="75" r="60" fill="none" stroke="#303641" stroke-width="11"/><circle class="gauge-arc" cx="75" cy="75" r="60" fill="none" stroke="${rate === null ? colors.grey : colors.accent}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - percent / 100)}" transform="rotate(-90 75 75)"/><text x="75" y="73" text-anchor="middle" class="gauge-value">${rate === null ? 'N/A' : rate.toFixed(1) + '%'}</text><text x="75" y="96" text-anchor="middle" class="gauge-label">delivered</text></svg>`;
    }

    function statusBadge(value) {
        const tone = value === 'Delivered' || value === 'Closed' || value === 'Returned' ? 'success' : value === 'Pending' ? 'warning' : 'neutral';
        return `<span class="badge badge-${tone}">${escape(format(value))}</span>`;
    }

    function table(rows, key, title, columns = null, settings = {}) {
        const config = state.tableSettings[key] || { search: '', sort: '', ascending: true, page: 1, size: 25 };
        state.tableSettings[key] = config;
        columns = columns || [...new Set(rows.flatMap(row => Object.keys(row)))];
        if (!columns.length) columns = ['Container Number', 'BL Number'];
        let shown = rows.filter(row => !config.search || Object.values(row).some(value => format(value).toLocaleLowerCase().includes(config.search.toLocaleLowerCase())));
        if (config.sort) {
            shown = [...shown].sort((a, b) => {
                const left = a[config.sort], right = b[config.sort];
                if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
                if (right === null || right === undefined) return -1;
                const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
                return config.ascending ? comparison : -comparison;
            });
        }
        const exportColumns = settings.exportAll ? [...new Set(rows.flatMap(row => Object.keys(row)))] : columns;
        state.tableCache[key] = { rows: shown, columns: exportColumns.length ? exportColumns : columns };
        const count = Math.max(1, Math.ceil(shown.length / config.size));
        config.page = Math.max(1, Math.min(config.page, count));
        const start = (config.page - 1) * config.size;
        const visible = shown.slice(start, start + config.size);
        const exportButtons = settings.noExport ? '' : `<button class="btn btn-secondary" data-export="${key}" data-type="csv">${icon('download')} CSV</button><button class="btn btn-secondary" data-export="${key}" data-type="xlsx">Excel</button>`;
        return `<section class="panel"><div class="panel-heading"><h2>${escape(title)}</h2><span class="badge badge-neutral">${shown.length.toLocaleString()} records</span></div><div class="table-controls"><input type="search" class="table-search" id="search-${key}" data-table-search="${key}" aria-label="Search ${escape(title)}" placeholder="Search these records…" value="${escape(config.search)}"><div class="toolbar">${exportButtons}</div></div><div class="table-scroll"><table><thead><tr>${columns.map(column => `<th scope="col"><button data-sort-table="${key}" data-column="${escape(column)}" title="Sort by ${escape(column)}">${escape(column)} ${config.sort === column ? (config.ascending ? '↑' : '↓') : '↕'}</button></th>`).join('')}</tr></thead><tbody>${visible.length ? visible.map(row => `<tr>${columns.map(column => {
            const value = row[column];
            let cell = escape(format(value));
            if (column === 'Delivery Status' || column === 'Exposure State') cell = statusBadge(value);
            if (column === 'Container Number' && row['Source Row']) cell = `<button class="table-link" data-inspect="${row['Source Row']}">${escape(format(value))}</button>`;
            return `<td title="${escape(format(value))}">${cell}</td>`;
        }).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}"><div class="empty-state">No matching records. Clear search or adjust filters.</div></td></tr>`}</tbody></table></div><div class="table-footer"><span>${shown.length ? start + 1 : 0}–${Math.min(start + config.size, shown.length)} of ${shown.length.toLocaleString()} · Click headings to sort</span><div class="pagination"><label for="size-${key}">Rows</label><select id="size-${key}" data-page-size="${key}">${[25, 50, 100, 250].map(size => option(size, size, config.size)).join('')}</select><button class="btn btn-secondary" data-page-table="${key}" data-step="-1"${config.page === 1 ? ' disabled' : ''}>Previous</button><span>${config.page} / ${count}</span><button class="btn btn-secondary" data-page-table="${key}" data-step="1"${config.page === count ? ' disabled' : ''}>Next</button></div></div>${settings.noExport ? '' : '<p class="table-note">Exports include all search matches, not just this page. Formula-like text and headers are escaped.</p>'}</section>`;
    }

    function chartPanel(title, traces, note = '', layout = {}) {
        const id = 'chart-' + (++chartNumber);
        pendingCharts.push({ id, traces, layout });
        return `<section class="panel"><div class="panel-heading"><h2>${escape(title)}</h2></div><div id="${id}" class="chart" role="img" aria-label="${escape(title)}"></div>${note ? `<p class="chart-note">${escape(note)}</p>` : ''}</section>`;
    }

    function chartBars(rows, label = 'Group', value = 'Containers') {
        return [{ type: 'bar', x: rows.map(row => escape(row[label])), y: rows.map(row => row[value]), marker: { color: colors.accent }, hovertemplate: '%{x}<br>%{y}<extra></extra>' }];
    }

    function groupCount(rows, field) {
        return [...Core.groupRows(rows, field)].map(([name, members]) => ({ Group: name, Containers: members.length })).sort((a, b) => a.Group.localeCompare(b.Group));
    }

    function drawCharts() {
        for (const { id, traces, layout } of pendingCharts) {
            const target = element(id);
            if (!target) continue;
            if (!window.Plotly) { target.innerHTML = notice('Local chart asset is missing. Keep the assets folder beside index.html.'); continue; }
            const usable = traces.some(trace => (trace.y || trace.values || trace.x || []).length);
            if (!usable) { target.innerHTML = '<div class="empty-state">Not Available · No qualifying measurements.</div>'; continue; }
            const axis = { gridcolor: '#303541', zerolinecolor: '#404858', tickfont: { size: 14 }, automargin: true };
            const chartLayout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'Segoe UI, Arial, sans-serif', size: 14, color: '#c7ced9' },
                colorway: Object.values(colors), margin: { l: 45, r: 16, t: 18, b: 55 },
                xaxis: { ...axis }, yaxis: { ...axis }, legend: { font: { size: 14 }, orientation: 'h', y: -0.25 },
                hoverlabel: { font: { size: 14 }, bgcolor: '#262c36' }, autosize: true,
                transition: { duration: 0 }, ...layout };
            const config = { responsive: true, displaylogo: false, displayModeBar: false, scrollZoom: false };
            target._ffmCancel?.();
            const failed = () => { target._ffmCancel?.(); target.innerHTML = notice('Chart could not render. The underlying data remains available in tables.'); };
            if (Motion && target._ffmShown && Plotly.react && motionDuration()) {
                const before = target._ffmShown;
                if (!chartLayout.yaxis?.range && traces.some(trace => ['bar', 'scatter', 'box'].includes(trace.type))) {
                    const measurements = [...before, ...traces].flatMap(trace => trace.y || []).filter(Number.isFinite);
                    const lower = measurements.reduce((minimum, value) => Math.min(minimum, value), 0);
                    let upper = measurements.reduce((maximum, value) => Math.max(maximum, value), 1);
                    if (chartLayout.barmode === 'stack') {
                        for (const group of [before, traces]) {
                            const totals = new Map();
                            for (const trace of group) (trace.y || []).forEach((value, index) => {
                                const key = trace.x?.[index] ?? index;
                                totals.set(key, (totals.get(key) || 0) + value);
                            });
                            upper = Math.max(upper, ...totals.values());
                        }
                    }
                    const previousRange = target._fullLayout?.yaxis?.range;
                    chartLayout.yaxis = { ...chartLayout.yaxis, autorange: false,
                        range: [Math.min(lower, previousRange?.[0] ?? lower), Math.max(upper * 1.1, previousRange?.[1] ?? 0)] };
                }
                // Draw intermediate geometry explicitly, including pie and bar charts.
                target._ffmCancel = Motion.animate(motionDuration(), progress => {
                    const frame = Motion.chartFrame(before, traces, progress);
                    target._ffmShown = frame;
                    return Plotly.react(target, frame, chartLayout, config).catch(failed);
                });
            } else {
                target._ffmShown = traces;
                const plot = target.data && Plotly.react ? Plotly.react : Plotly.newPlot;
                plot.call(Plotly, target, traces, chartLayout, config).catch(failed);
            }
        }
    }

    function monitoring(rows) {
        let focus = rows;
        const vessels = choices(rows.filter(row => row['Vessel Name']), 'Vessel Name');
        if (!vessels.includes(state.focusVessel)) state.focusVessel = '';
        if (state.focusVessel) focus = focus.filter(row => row['Vessel Name'] === state.focusVessel);
        const bls = choices(focus, 'BL Number');
        if (!bls.includes(state.focusBL)) state.focusBL = '';
        if (state.focusBL) focus = focus.filter(row => row['BL Number'] === state.focusBL);
        const counts = Core.metrics(focus, state.asOf, state.warningDays);
        const spotlight = `<section class="panel"><div class="panel-heading"><h2>${icon('ship')} Vessel & BL monitoring</h2><span class="badge badge-neutral">Shipment focus</span></div><div class="spotlight-controls"><div><label for="focus-vessel">Vessel</label><select id="focus-vessel">${option('', 'All vessels', state.focusVessel)}${vessels.map(value => option(value, value, state.focusVessel)).join('')}</select></div><div><label for="focus-bl">Bill of Lading</label><select id="focus-bl">${option('', 'All BLs', state.focusBL)}${bls.map(value => option(value, value, state.focusBL)).join('')}</select></div></div><div class="vessel-visual"><div>${vesselDrawing()}<p class="visual-caption">Static illustration · not a container count</p></div>${gauge(counts.rate)}</div><div class="focus-stats"><div><strong>${counts.total}</strong><span>Containers in focus</span></div><div><strong class="text-success">${counts.delivered}</strong><span>Delivered</span></div><div><strong class="text-warning">${counts.pending}</strong><span>Pending</span></div></div><p class="chart-note">Inspection narrows the tables below. KPI cards retain the global filter scope.</p></section>`;
        const summaries = [...Core.groupRows(focus, row => JSON.stringify([row['Vessel Name'], row['BL Number']]))].map(([, members]) => {
            const first = members[0], m = Core.metrics(members, state.asOf);
            const latest = field => members.map(row => row[field]).filter(Boolean).sort().at(-1) || null;
            const joined = field => [...new Set(members.map(row => row[field]).filter(Boolean))].join(', ') || null;
            const earliestTarget = members.map(row => row['Delivery Deadline']).filter(Boolean).sort()[0] || null;
            return { 'Vessel Name': first['Vessel Name'], 'BL Number': first['BL Number'], Containers: m.total, Delivered: m.delivered, Pending: m.pending, Unknown: m.unknown,
                'RFC Status': joined('RFC Status'), 'Return Status': joined('Return Status'), 'Arrival Date': latest('Arrival Date'), 'Earliest Delivery Target': earliestTarget, 'Delivery Date': latest('Delivery Date'), 'Return Date': latest('Return Date') };
        });
        return metricCards(rows) + `<div class="grid-hero">${spotlight}${alerts(rows)}</div>` + table(summaries, 'shipment-summary', 'Shipment summary') + table(focus, 'container-register', 'Container register', defaultColumns, { exportAll: true });
    }

    function overview(rows) {
        const statuses = groupCount(rows, 'Delivery Status');
        const arrivals = groupCount(rows.filter(row => row['Arrival Date']), row => row['Arrival Date'].slice(0, 7));
        const delivered = groupCount(rows.filter(row => row['Delivery Status'] === 'Delivered' && row['Delivery Date']), row => row['Delivery Date'].slice(0, 7));
        const cohorts = Core.summary(rows.filter(row => row['Arrival Date']), row => row['Arrival Date'].slice(0, 7), state.asOf).sort((a, b) => a.Group.localeCompare(b.Group));
        const distribution = [{ type: 'pie', labels: statuses.map(row => row.Group), values: statuses.map(row => row.Containers), hole: .72,
            marker: { colors: statuses.map(row => row.Group === 'Delivered' ? colors.green : row.Group === 'Pending' ? colors.amber : colors.grey) }, textinfo: 'percent', textfont: { size: 16 }, hovertemplate: '%{label}: %{value}<extra></extra>' }];
        const throughput = [{ type: 'scatter', mode: 'lines+markers', x: delivered.map(row => row.Group), y: delivered.map(row => row.Containers), line: { color: colors.green, width: 3 }, marker: { size: 9 }, fill: 'tozeroy', fillcolor: '#4ade8012' }];
        const rates = [{ type: 'scatter', mode: 'lines+markers', x: cohorts.map(row => row.Group), y: cohorts.map(row => row['Delivery Rate (%)']), line: { color: colors.accent, width: 3 }, marker: { size: 9 } }];
        return metricCards(rows) + `<div class="grid-two">${chartPanel('Shipment status', distribution, 'Unknown statuses remain separate.')}${chartPanel('Delivery throughput', throughput, 'Delivered containers grouped by actual delivery month.')}</div><div class="grid-two">${chartPanel('Monthly container arrivals', chartBars(arrivals), 'Calendar month of recorded Arrival Date.')}${chartPanel('Delivery performance by arrival cohort', rates, 'Current delivered / all containers in each arrival month. Recent cohorts can still be in progress.', { yaxis: { range: [0, 105], ticksuffix: '%', gridcolor: '#303541', tickfont: { size: 14 } } })}</div>` + alerts(rows) + table(Core.summary(rows, 'Vessel Name', state.asOf), 'overview-summary', 'Vessel performance · pending & overdue');
    }

    function leadTimePage(rows) {
        const available = ['Arrival Date', 'Discharge Date', 'Gate Out Date'].filter(field => rows.some(row => row[field]));
        if (!available.includes(state.leadStart)) state.leadStart = available[0] || 'Arrival Date';
        const measured = rows.map(row => ({ ...row, 'Lead Time (days)': Core.leadTime(row, state.leadStart), 'Delay (days)': Core.delayDays(row, state.asOf) }));
        const samples = measured.filter(row => row['Lead Time (days)'] !== null);
        const times = samples.map(row => row['Lead Time (days)']);
        let html = `<section class="panel"><div class="control-row"><div><label for="lead-start">Actual start event</label><select id="lead-start">${available.length ? available.map(field => option(field, field, state.leadStart)).join('') : option('Arrival Date', 'Arrival Date (unavailable)', 'Arrival Date')}</select></div><div><label>End event</label><div class="form-control">Actual Delivery Date</div></div></div><p class="muted">Calendar days = Delivery Date − ${escape(state.leadStart)}. Delivered status and both actual dates are required. Unavailable measurements are excluded, never zero-filled.</p></section>`;
        html += smallMetrics([['Average lead time', Core.mean(times), 'Calendar days'], ['Minimum', times.length ? Math.min(...times) : null, 'Calendar days'], ['Maximum', times.length ? Math.max(...times) : null, 'Calendar days'], ['Measured containers', samples.length, `${rows.length - samples.length} without a qualifying duration`]]);
        if (samples.length) {
            const trend = [...Core.groupRows(samples, row => row['Delivery Date'].slice(0, 7))].map(([month, group]) => ({ month, average: Core.mean(group.map(row => row['Lead Time (days)'])) })).sort((a, b) => a.month.localeCompare(b.month));
            const vessels = [...Core.groupRows(samples.filter(row => row['Vessel Name']), 'Vessel Name')].map(([name, group]) => ({ type: 'box', name: escape(name), y: group.map(row => row['Lead Time (days)']), boxpoints: 'all', jitter: .25, pointpos: 0 }));
            // Explicit histogram counts let bin heights interpolate, rather than jumping as samples cross bins.
            const maximumLead = times.reduce((maximum, value) => Math.max(maximum, value), 0);
            const binWidth = Math.max(1, Math.ceil((maximumLead + 1) / 15));
            const bins = Array.from({ length: Math.floor(maximumLead / binWidth) + 1 }, (_, index) => ({
                Group: binWidth === 1 ? String(index) : `${index * binWidth}–${(index + 1) * binWidth - 1}`,
                Containers: times.filter(value => Math.floor(value / binWidth) === index).length,
            }));
            html += `<div class="grid-two">${chartPanel('Lead-time distribution', chartBars(bins), 'Actual measured calendar days; bar labels show day ranges.')}${chartPanel('Average lead-time trend', [{ type: 'scatter', mode: 'lines+markers', x: trend.map(row => row.month), y: trend.map(row => row.average), line: { color: colors.green, width: 3 } }], 'Grouped by actual delivery month.')}</div>`;
            html += chartPanel('Lead time by vessel', vessels, 'Compare the spread and measured container samples.', { showlegend: false });
        } else html += notice('Lead time: Not Available. Supply actual start and delivery dates for Delivered containers. Measurable pending delays still appear below.');
        html += table(measured.filter(row => row['Delay (days)'] > 0), 'lead-delayed', 'Delayed containers', ['Container Number', 'Vessel Name', 'BL Number', 'Delivery Status', 'Delivery Deadline', 'Delivery Date', 'Lead Time (days)', 'Delay (days)'], { exportAll: true });
        html += table(measured, 'lead-measurements', 'All lead-time measurements', ['Container Number', 'Vessel Name', 'BL Number', state.leadStart, 'Delivery Date', 'Lead Time (days)'], { exportAll: true });
        return html;
    }

    function performance(rows) {
        const work = rows.map(row => ({ ...row, 'Arrival Month': row['Arrival Date']?.slice(0, 7) || null }));
        const available = ['Vessel Name', 'Shipping Line', 'Arrival Month', 'Delivery Status'].filter(field => work.some(row => row[field] && row[field] !== 'Unknown'));
        if (!available.length) return notice('Comparison: Not Available. Supply vessels, shipping lines, arrival dates or mapped delivery statuses.');
        if (!available.includes(state.compareField)) state.compareField = available[0];
        let summaries = Core.summary(work, state.compareField, state.asOf);
        const groups = summaries.map(row => row.Group).sort();
        state.compareGroups = state.compareGroups.filter(value => groups.includes(value));
        const measures = ['Containers', 'Delivery Rate (%)', 'Pending', 'Overdue'];
        if (summaries.some(row => row['Average Lead (days)'] !== null)) measures.push('Average Lead (days)');
        if (!measures.includes(state.compareMeasure)) state.compareMeasure = measures[0];
        const controls = `<section class="panel"><div class="control-row"><div><label for="compare-field">Compare by</label><select id="compare-field">${available.map(field => option(field, field, state.compareField)).join('')}</select></div><div><label for="compare-measure">Measure</label><select id="compare-measure">${measures.map(field => option(field, field, state.compareMeasure)).join('')}</select></div>${multiSelect('Comparison groups', state.compareGroups, groups, 'comparison')}</div><p class="muted">All groups if none are selected. Average lead time uses Arrival Date → actual Delivery Date. Sample sizes accompany the results.</p></section>`;
        if (state.compareGroups.length) summaries = summaries.filter(row => state.compareGroups.includes(row.Group));
        const plotted = [...summaries].filter(row => row[state.compareMeasure] !== null).sort((a, b) => b[state.compareMeasure] - a[state.compareMeasure]).slice(0, 30);
        return controls + (summaries.length < 2 ? notice('Only one group is available. Widen filters or import more groups to compare.') : '') + chartPanel(state.compareMeasure + ' by ' + state.compareField, chartBars(plotted, 'Group', state.compareMeasure), 'Chart shows up to 30 groups; full data is available below.') + table(summaries, 'performance-summary', 'Comparison summary');
    }

    function causes(rows) {
        const delayed = rows.map(row => ({ ...row, 'Delay (days)': Core.delayDays(row, state.asOf) })).filter(row => row['Delay (days)'] > 0);
        const fields = ['Delay Category', 'Root Cause'].filter(field => delayed.some(row => row[field]));
        let html = smallMetrics([['Delayed containers', delayed.length, 'Measured against supplied targets'], ['Delayed BLs', new Set(delayed.map(row => row['BL Number'])).size, 'Distinct Bill of Lading values'], ['Container-days delayed', delayed.reduce((sum, row) => sum + row['Delay (days)'], 0), 'Not financial loss or shipment-days'], ['Targets unavailable', rows.filter(row => !row['Delivery Deadline']).length, 'Delay cannot be established']]);
        if (!fields.length) html += notice('Root causes: Not Available. Supply recorded Delay Category and/or Root Cause. Reasons are never inferred from vessel names, shipping lines or dates.');
        else {
            if (!fields.includes(state.causeField)) state.causeField = fields[0];
            html += `<section class="panel"><label for="cause-field">Recorded cause field</label><select id="cause-field">${fields.map(field => option(field, field, state.causeField)).join('')}</select></section>`;
            const grouped = [...Core.groupRows(delayed, state.causeField)].map(([name, members]) => ({ Cause: name, Containers: members.length,
                'Distinct BLs': new Set(members.map(row => row['BL Number'])).size, 'Container-days': members.reduce((sum, row) => sum + row['Delay (days)'], 0) }));
            html += chartPanel('Recorded delay causes', chartBars(grouped, 'Cause'), 'Missing cause values stay labelled Not Available.');
            html += table(grouped, 'cause-breakdown', 'Root-cause breakdown');
            html += table(grouped.filter(row => row.Cause !== 'Not Available' && row['Distinct BLs'] >= 2), 'recurring-causes', 'Recurring causes · at least two distinct BLs');
            const recorded = delayed.filter(row => row[state.causeField] && row['Vessel Name']);
            const traces = [...Core.groupRows(recorded, state.causeField)].map(([name, members]) => { const groups = groupCount(members, 'Vessel Name'); return { type: 'bar', name: escape(name), x: groups.map(row => escape(row.Group)), y: groups.map(row => row.Containers) }; });
            html += chartPanel('Recorded causes by vessel', traces, 'Association does not establish causation.', { barmode: 'stack' });
        }
        return html + table(delayed, 'cause-delayed', 'Delayed shipment list', ['Container Number', 'Vessel Name', 'BL Number', 'Delivery Status', 'Delivery Deadline', 'Delivery Date', 'Delay (days)', 'Delay Category', 'Root Cause'], { exportAll: true });
    }

    function demDet(rows) {
        const kind = state.exposureKind;
        const rules = { ...state.rules[kind] };
        if (!rules.derive) rules.freeDays = null;
        const assessed = rows.map(row => ({ ...row, assessment: Core.exposure(row, kind, state.asOf, rules) }));
        const approaching = assessed.filter(row => row.assessment.state === 'Open / unconfirmed' && row.assessment.remaining !== null && row.assessment.remaining >= 0 && row.assessment.remaining <= state.warningDays);
        const exceeded = assessed.filter(row => row.assessment.state === 'Open / unconfirmed' && row.assessment.remaining !== null && row.assessment.remaining < 0);
        const measured = assessed.filter(row => row.assessment.charge !== null);
        let html = `<section class="panel"><div class="panel-heading"><div class="segmented">${['DEM', 'DET'].map(value => `<button class="btn ${kind === value ? 'active' : ''}" data-exposure-kind="${value}" aria-pressed="${kind === value}">${value === 'DEM' ? 'Demurrage · DEM' : 'Detention · DET'}</button>`).join('')}</div><button class="btn btn-secondary" data-action="open-settings">${icon('settings')} Configure rules</button></div><p class="muted">Delivery targets are never free-time deadlines. Missing end dates stay open / unconfirmed; potential risk is not confirmed liability.</p></section>`;
        html += smallMetrics([['Approaching deadlines', approaching.length, 'Potentially open containers'], ['Beyond free time', exceeded.length, 'Confirm movement / return dates'], ['Known deadlines', assessed.filter(row => row.assessment.deadline).length, 'Explicit or configured rule'], ['Missing deadlines', assessed.filter(row => !row.assessment.deadline).length, 'Requires Configuration']]);
        if (exceeded.length) html += notice(`${exceeded.length} potentially open containers are past their ${kind} deadline. Verify actual movements before treating them as chargeable.`, 'danger');
        if (approaching.length) html += notice(`${approaching.length} potential deadlines fall within the configured ${state.warningDays}-day warning window.`, 'warning');
        if (assessed.some(row => row.assessment.state.includes('unknown'))) html += notice('Future or contradictory event dates have unknown exposure. Their estimates are withheld.', 'warning');
        if (!assessed.some(row => row.assessment.deadline)) html += notice('Requires Configuration: supply explicit DEM/DET deadlines, or enable a confirmed start + free-calendar-days rule. No allowance is assumed.');
        if (measured.length) {
            const totals = [...Core.groupRows(measured, 'Currency')].map(([currency, group]) => ({ Currency: currency, 'Estimated Charge': group.reduce((sum, row) => sum + row.assessment.charge, 0), 'Measured Containers': group.length }));
            html += table(totals, 'exposure-currencies', 'Estimated charges · currencies kept separate');
            html += notice(`${measured.length} of ${rows.length} containers have an estimate. Flat daily rate only; no tax, rounding, tiers or combined-contract assumptions.`);
        } else html += notice('Estimated charges: Requires Configuration. Confirm flat tariff, supply rates/currencies, and establish an end date or explicitly assume missing ends are open.');
        const detail = assessed.map(row => ({ 'Source Row': row['Source Row'], 'Container Number': row['Container Number'], 'Vessel Name': row['Vessel Name'], 'BL Number': row['BL Number'], 'Shipping Line': row['Shipping Line'], 'Return Status': row['Return Status'],
            Deadline: row.assessment.deadline, 'Remaining Free Days': row.assessment.remaining, 'Exposure State': row.assessment.state, 'Charge Days': row.assessment.chargeDays, Currency: row.Currency, 'Estimated Charge': row.assessment.charge, 'Charge Basis': row.assessment.basis,
            'Gate Out Date': row['Gate Out Date'], 'Return Date': row['Return Date'], [kind + ' Daily Rate']: row[kind + ' Daily Rate'] }));
        html += table(detail, 'exposure-details', kind + ' · container exposure');
        const grouped = [...Core.groupRows(assessed, state.exposureGroup)].map(([name, members]) => ({ Group: name, Containers: members.length,
            Approaching: members.filter(row => approaching.includes(row)).length, 'Potential Exceedances': members.filter(row => exceeded.includes(row)).length }));
        html += `<section class="panel"><label for="exposure-group">Deadline breakdown by</label><select id="exposure-group">${['Vessel Name', 'BL Number', 'Shipping Line'].map(field => option(field, field, state.exposureGroup)).join('')}</select></section>`;
        html += chartPanel(kind + ' deadline risk', [
            { type: 'bar', name: 'Approaching', x: grouped.slice(0, 30).map(row => escape(row.Group)), y: grouped.slice(0, 30).map(row => row.Approaching), marker: { color: colors.amber } },
            { type: 'bar', name: 'Potential exceedance', x: grouped.slice(0, 30).map(row => escape(row.Group)), y: grouped.slice(0, 30).map(row => row['Potential Exceedances']), marker: { color: colors.red } },
        ], 'Potential risk counts, not confirmed chargeable containers.', { barmode: 'group' });
        return html + table(grouped, 'exposure-breakdown', kind + ' deadline breakdown');
    }

    function explorer(rows) {
        let matching = rows;
        for (const [field, selected] of Object.entries(state.explorerFilters)) {
            if (selected.length) matching = matching.filter(row => selected.includes(row[field] || 'Not Available'));
        }
        const fields = ['Container Number', 'Vessel Name', 'BL Number', 'Shipping Line', 'Delivery Status', 'RFC Status', 'Return Status', 'Delay Category', 'Root Cause'];
        return `<section class="panel"><div class="panel-heading"><h2>${icon('search')} Advanced shipment filters</h2><button class="btn btn-quiet" id="reset-explorer">Clear local filters</button></div><details class="advanced-filters"><summary>Select additional column filters</summary><div class="filter-grid">${fields.map(field => multiSelect(field, state.explorerFilters[field] || [], choices(rows, field), 'explorer')).join('')}</div></details><p class="muted">Global filters still apply. Search any field below. Click a container number to inspect the normalized record and its original source values.</p></section>` + table(matching, 'explorer-register', 'Shipment database', ['Container Number', 'Vessel Name', 'BL Number', 'Shipping Line', 'Delivery Status', 'Arrival Date', 'Delivery Deadline', 'Delivery Date', 'Return Status', 'Return Date'], { exportAll: true });
    }

    function renderContent(preserveCharts = true) {
        const focused = document.activeElement;
        const focusId = focused?.id;
        const selection = focused?.type === 'search' ? [focused.selectionStart, focused.selectionEnd] : null;
        const existingCharts = [...element('page-content').querySelectorAll('.js-plotly-plot')];
        const existingGauge = element('page-content').querySelector?.('#delivery-gauge');
        pendingCharts = []; chartNumber = 0; state.tableCache = {};
        const rows = Core.filterRows(state.rows, state.filters);
        const renderers = { 'container-monitoring': monitoring, overview, 'dem-det-analysis': demDet, 'lead-time-analysis': leadTimePage,
            'performance-comparison': performance, 'root-cause-analysis': causes, 'shipment-explorer': explorer };
        let html = '';
        if (state.filters.from && state.filters.to && state.filters.from > state.filters.to) html += notice('Start date is after end date. Correct the date range.', 'warning');
        if (!rows.length) html += metricCards(rows) + empty();
        else html += renderers[state.page](rows);
        if (preserveCharts && document.createElement) {
            const template = document.createElement('template');
            template.innerHTML = html;
            const nextGauge = template.content.querySelector('#delivery-gauge');
            if (existingGauge && nextGauge) {
                updateGauge(existingGauge, nextGauge);
                nextGauge.replaceWith(existingGauge);
            } else existingGauge?._ffmCancel?.();
            for (const chart of existingCharts) {
                const placeholder = template.content.querySelector('#' + chart.id);
                if (placeholder && placeholder.getAttribute('aria-label') === chart.getAttribute('aria-label')) placeholder.replaceWith(chart);
                else { chart._ffmCancel?.(); window.Plotly?.purge(chart); }
            }
            element('page-content').replaceChildren(template.content);
        } else {
            for (const chart of existingCharts) { chart._ffmCancel?.(); window.Plotly?.purge(chart); }
            element('page-content').innerHTML = html;
        }
        drawCharts();
        if (focusId && element(focusId)) {
            element(focusId).focus({ preventScroll: true });
            if (selection) element(focusId).setSelectionRange(...selection);
        }
    }

    function render() {
        const page = pages.find(item => item[0] === state.page) || pages[0];
        element('page-navigation').innerHTML = pages.map(([id, label, name]) => `<a href="#${id}" class="nav-item ${id === state.page ? 'active' : ''}"${id === state.page ? ' aria-current="page"' : ''}>${icon(name)}<span>${label}</span></a>`).join('');
        element('page-title').textContent = page[1];
        element('page-description').textContent = page[3];
        document.title = page[1] + ' · FFM Logistics';
        renderFreshness(); renderFilters(); renderContent();
    }

    function toast(message, error = false) {
        clearTimeout(toastTimer);
        element('toast').textContent = message;
        element('toast').className = 'toast-message' + (error ? ' error' : '');
        element('toast').hidden = false;
        toastTimer = setTimeout(() => { element('toast').hidden = true; }, 6000);
    }

    async function busy(message, operation) {
        element('busy-message').textContent = message;
        element('busy').hidden = false;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try { return await operation(); }
        finally { element('busy').hidden = true; }
    }

    function download(content, filename, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    async function exportTable(key, type) {
        const data = state.tableCache[key];
        if (!data) return;
        try {
            await busy('Preparing ' + type.toUpperCase() + ' locally…', () => {
                const content = type === 'xlsx' ? Workbook.write(data.rows, data.columns) : Core.toCSV(data.rows, data.columns);
                download(content, (state.demo ? 'ffm_DEMO_' : 'ffm_') + key + '.' + type, type === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8');
            });
            toast(`${type.toUpperCase()} prepared · ${data.rows.length} matching records.`);
        } catch (error) { toast(error.message, true); }
    }

    function inspect(sourceRow) {
        const row = state.rows.find(record => record['Source Row'] === sourceRow);
        if (!row) return;
        const original = state.source.rows[sourceRow - 2];
        const fields = record => Object.entries(record).map(([name, value]) => `<div class="detail-field"><label>${escape(name)}</label><strong>${escape(format(value))}</strong></div>`).join('');
        element('detail-title').textContent = row['Container Number'] + ' · ' + row['BL Number'];
        element('detail-content').innerHTML = `<h3>Validated shipment record</h3><div class="detail-grid">${fields(row)}</div><details class="advanced-filters"><summary>Original source row · original column names</summary><div class="detail-grid">${fields(original)}</div></details>`;
        element('detail-dialog').showModal();
    }

    function settings() {
        element('settings-content').innerHTML = (state.demo ? notice('DEMO ONLY: random sample tariffs and causes are fictional. Flat-rate and open-end assumptions are enabled for illustration; imports reset them.') : '') + `<div class="control-row"><div><label for="assessment-date">Assessment date</label><input id="assessment-date" type="date" value="${escape(state.asOf)}"></div><div><label for="warning-days">Approaching deadline window (days)</label><input id="warning-days" type="number" min="0" max="90" step="1" value="${state.warningDays}"></div></div><p class="muted">Assessment date affects deadline alerts and open exposure. It does not reconstruct historical source statuses. Due today is included.</p>${['DEM', 'DET'].map(kind => {
            const rules = state.rules[kind];
            return `<section class="settings-section"><h3>${kind} · ${kind === 'DEM' ? 'Demurrage' : 'Detention'}</h3><label class="check-label"><input type="checkbox" data-rule-kind="${kind}" data-rule="derive"${rules.derive ? ' checked' : ''}>Derive missing deadlines: start + free days, excluding the start day</label><div class="control-row"><div><label for="${kind}-start">Start event</label><select id="${kind}-start" data-rule-kind="${kind}" data-rule="startColumn"${rules.derive ? '' : ' disabled'}>${Core.dateFields.slice(0, 6).map(field => option(field, field, rules.startColumn)).join('')}</select></div><div><label for="${kind}-free">Confirmed free calendar days</label><input id="${kind}-free" type="number" min="0" max="365" step="1" placeholder="Not configured" value="${rules.freeDays ?? ''}" data-rule-kind="${kind}" data-rule="freeDays"${rules.derive ? '' : ' disabled'}></div></div><label class="check-label"><input type="checkbox" data-rule-kind="${kind}" data-rule="flatTariff"${rules.flatTariff ? ' checked' : ''}>Confirm supplied ${kind} rates use a flat daily tariff</label><label class="check-label"><input type="checkbox" data-rule-kind="${kind}" data-rule="assumeOpen"${rules.assumeOpen ? ' checked' : ''}>Treat missing ${kind === 'DEM' ? 'gate-out' : 'return'} dates as still open through assessment date</label><p class="muted">Imported deadlines take priority. Operational data requires supplied rates, currencies and confirmed free allowances. Use this convention only when it matches the actual contract.</p></section>`;
        }).join('')}<div class="notice">${icon('alert')}<p>Tiered, combined, inclusive-start and business-day contracts need externally calculated deadlines or an additional tariff implementation. No external notifications are sent.</p></div>`;
    }

    // Import controls and event wiring are defined below.
    function rawPreview(source, limit = 8) {
        return `<div class="table-scroll import-preview"><table><thead><tr>${source.headers.map(name => `<th>${escape(name)}</th>`).join('')}</tr></thead><tbody>${source.rows.slice(0, limit).map(row => `<tr>${source.headers.map(name => `<td>${escape(format(row[name]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function statusOptions() {
        const name = document.querySelector('[data-map="Delivery Status"]')?.value;
        const values = importSource && name ? choices(importSource.rows.map(row => ({ Status: row[name] === null || row[name] === undefined ? null : String(row[name]).trim() })).filter(row => row.Status), 'Status') : [];
        for (const [id, match] of [['map-delivered', 'Delivered'], ['map-pending', 'Pending']]) {
            element(id).innerHTML = values.map(value => `<option value="${escape(value)}"${value === match ? ' selected' : ''}>${escape(value)}</option>`).join('');
        }
    }

    function showImportSource() {
        stagedImport = null;
        element('import-workspace').innerHTML = `<div class="import-preview-heading"><h3>${importSource.rows.length.toLocaleString()} source rows</h3>${rawPreview(importSource)}<p class="muted">Original source preview · first 8 rows. Choose mappings below. Date fields use calendar dates; time-of-day is ignored.</p></div><h3>Map source columns</h3><div class="mapping-grid">${Core.schema.map(field => `<div><label for="map-${field.replaceAll(' ', '-')}">${escape(field)}${Core.required.includes(field) ? ' *' : ''}</label><select id="map-${field.replaceAll(' ', '-')}" data-map="${escape(field)}">${option('', 'Not mapped', '')}${importSource.headers.map(name => option(name, name, field)).join('')}</select></div>`).join('')}</div><div class="status-mapping"><div><label for="map-format">Text date format</label><select id="map-format"><option value="ISO">YYYY-MM-DD</option><option value="DMY">DD/MM/YYYY</option><option value="MDY">MM/DD/YYYY</option><option value="DMYDASH">DD-MM-YYYY</option></select><p class="muted">Actual Excel date cells are accepted independently of text format.</p></div><div><label for="map-delivered">Source values meaning Delivered</label><select id="map-delivered" multiple aria-describedby="status-help"></select></div><div><label for="map-pending">Source values meaning Pending</label><select id="map-pending" multiple aria-describedby="status-help"></select></div></div><p id="status-help" class="muted">Use Ctrl (Windows) or Command (Mac) to select multiple source statuses. Unselected values become Unknown.</p><button id="validate-import" class="btn btn-primary">Validate import</button><div id="validation-results"></div>`;
        statusOptions();
    }

    function showSheetPicker(selected = 0, error = '') {
        element('import-status').innerHTML = `<div class="settings-section"><label for="import-sheet">Worksheet</label><select id="import-sheet">${importWorkbook.sheets.map((sheet, index) => option(index, sheet.name, selected)).join('')}</select></div>${error ? notice(error, 'warning') : ''}`;
    }

    function invalidateImport() {
        stagedImport = null;
        if (element('validation-results')) element('validation-results').innerHTML = notice('Mapping or options changed. Validate again before activation.');
    }

    async function readFile(file) {
        if (!file) return;
        importSource = null; importWorkbook = null; stagedImport = null;
        element('import-workspace').innerHTML = '';
        element('import-status').innerHTML = '';
        if (!file.size || file.size > 20 * 1024 * 1024) { element('import-status').innerHTML = notice('Choose a non-empty file no larger than 20 MB.', 'danger'); return; }
        try {
            await busy('Reading file locally…', async () => {
                if (file.name.toLowerCase().endsWith('.csv')) {
                    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
                    importSource = Core.parseCSV(text);
                } else if (file.name.toLowerCase().endsWith('.xlsx')) {
                    importWorkbook = await Workbook.open(await file.arrayBuffer());
                    showSheetPicker(0);
                    try { importSource = Workbook.readSheet(importWorkbook, 0); }
                    catch (error) { showSheetPicker(0, error.message + ' Choose another worksheet if needed.'); }
                } else throw new Error('Only UTF-8 CSV and standard XLSX are supported.');
                if (importSource) showImportSource();
            });
        } catch (error) { element('import-status').innerHTML = notice(error.message, 'danger'); }
    }

    async function validateImport() {
        if (!importSource) return;
        const mapping = Object.fromEntries([...document.querySelectorAll('[data-map]')].map(control => [control.dataset.map, control.value]));
        const selected = id => [...element(id).selectedOptions].map(item => item.value);
        const delivered = selected('map-delivered'), pending = selected('map-pending');
        if (delivered.some(value => pending.includes(value))) { element('validation-results').innerHTML = notice('A source status cannot mean both Delivered and Pending.', 'danger'); stagedImport = null; return; }
        const statusMap = Object.fromEntries([...delivered.map(value => [value, 'Delivered']), ...pending.map(value => [value, 'Pending'])]);
        const result = await busy('Checking keys, dates, statuses and chronology…', () => Core.normalize(importSource, mapping, { dateFormat: element('map-format').value, statusMap }));
        stagedImport = result;
        element('validation-results').innerHTML = `<h3 style="margin-top:24px">Validation results</h3>${result.blockers.map(message => notice(message, 'danger')).join('')}${smallMetrics([['Eligible containers', result.valid.length], ['Quarantined rows', result.quarantined.length], ['Validation findings', result.issues.length], ['Source records', importSource.rows.length]])}<div class="toolbar"><button id="download-validation" class="btn btn-secondary">Download full report (CSV)</button>${result.quarantined.length ? '<button id="download-quarantine" class="btn btn-secondary">Download quarantined source rows</button>' : ''}</div>${rawPreview({ headers: ['Source Row', 'Field', 'Severity', 'Issue'], rows: result.issues }, 20)}${notice('Original values are preserved. Analytics uses trimmed text, mapped statuses and parsed dates. Every duplicate BL/container pair is excluded together. Unknown statuses are retained as Unknown. Correct and re-import quarantined rows to include them.')}<label class="check-label"><input id="accept-import" type="checkbox">I reviewed the mapping, findings, normalization and excluded rows.</label><button id="activate-import" class="btn btn-primary" disabled>Activate validated data</button>`;
    }

    function closeSidebar() {
        element('sidebar').classList.remove('open'); element('sidebar-scrim').hidden = true; element('menu-button').setAttribute('aria-expanded', 'false');
    }

    function randomizeDemo() {
        const source = window.FFMCreateDemo();
        window.FFMDemo = source;
        activate(source, Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name]))), true, 'Randomized simulation');
        render();
        toast('New random demo generated. All shipments, rates and causes are fictional.');
    }

    function refreshDemo() {
        if (!state.demo || document.hidden || !element('busy').hidden) return;
        if (['import-dialog', 'settings-dialog', 'detail-dialog', 'rules-dialog'].some(id => element(id).open)) return;
        const focusedTag = document.activeElement?.tagName;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(focusedTag) || document.querySelectorAll('details[open]').length) return;

        const source = window.FFMAdvanceDemo(state.source);
        const result = Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name])));
        // Replace only demo records; keep selected filters and calculation settings.
        window.FFMDemo = source;
        state.source = source;
        state.rows = result.valid;
        state.issues = result.issues;
        state.quarantined = result.quarantined;
        renderFreshness(); renderFilters(); renderContent(true);
    }

    function wireEvents() {
        window.addEventListener('hashchange', () => {
            const requested = location.hash.slice(1);
            state.page = pages.some(page => page[0] === requested) ? requested : pages[0][0];
            closeSidebar(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
        });
        element('menu-button').addEventListener('click', () => {
            const open = element('sidebar').classList.toggle('open');
            element('sidebar-scrim').hidden = !open; element('menu-button').setAttribute('aria-expanded', String(open));
        });
        element('sidebar-scrim').addEventListener('click', closeSidebar);
        element('reset-filters').addEventListener('click', () => { resetFilters(); state.tableSettings = {}; render(); });
        element('toggle-filters').addEventListener('click', () => {
            const hidden = !element('global-filters').hidden;
            element('global-filters').hidden = hidden;
            element('toggle-filters').textContent = hidden ? 'Show filters' : 'Hide filters';
            element('toggle-filters').setAttribute('aria-expanded', String(!hidden));
            document.querySelector('.filter-panel').classList.toggle('collapsed', hidden);
        });
        element('file-input').addEventListener('change', event => readFile(event.target.files[0]));
        element('use-demo').addEventListener('click', () => {
            element('import-dialog').close();
            randomizeDemo();
        });
        document.addEventListener('input', event => {
            const target = event.target;
            if (target.dataset.tableSearch) {
                const config = state.tableSettings[target.dataset.tableSearch];
                config.search = target.value; config.page = 1;
                clearTimeout(searchTimer); searchTimer = setTimeout(renderContent, 250);
            }
        });
        document.addEventListener('change', event => {
            const target = event.target;
            if (target.dataset.multi) {
                const field = target.dataset.field;
                const scope = target.dataset.multi;
                const selected = [...document.querySelectorAll(`input[data-multi="${scope}"]`)].filter(control => control.dataset.field === field && control.checked).map(control => control.value);
                if (scope === 'global') state.filters.values[field] = selected;
                if (scope === 'explorer') state.explorerFilters[field] = selected;
                if (scope === 'comparison') state.compareGroups = selected;
                // Keep open filter menus usable for selecting several values.
                const summary = target.closest('details').querySelector('summary');
                summary.textContent = selected.length ? selected.length + ' selected' : 'All values';
                const matches = Core.filterRows(state.rows, state.filters).length;
                element('match-count').textContent = `${matches.toLocaleString()} / ${state.rows.length.toLocaleString()} containers`;
                const openFields = [...element('page-content').querySelectorAll('details[open]')].map(item => item.querySelector('input[data-multi]')?.dataset.field);
                renderContent();
                for (const fieldName of openFields) for (const control of element('page-content').querySelectorAll('input[data-multi]')) if (control.dataset.field === fieldName) control.closest('details').open = true;
                return;
            }
            if (target.id === 'date-field') {
                state.filters.dateField = target.value;
                const dates = state.rows.map(row => row[target.value]).filter(Boolean).sort();
                state.filters.from = dates[0] || ''; state.filters.to = dates.at(-1) || ''; render();
            } else if (target.id === 'date-from' || target.id === 'date-to') {
                state.filters[target.id === 'date-from' ? 'from' : 'to'] = target.value;
                renderFilters(); renderContent();
            } else if (target.id === 'include-missing') {
                state.filters.includeMissing = target.checked; renderFilters(); renderContent();
            } else if (target.id === 'focus-vessel') { state.focusVessel = target.value; state.focusBL = ''; renderContent(); }
            else if (target.id === 'focus-bl') { state.focusBL = target.value; renderContent(); }
            else if (target.id === 'lead-start') { state.leadStart = target.value; renderContent(); }
            else if (target.id === 'compare-field') { state.compareField = target.value; state.compareGroups = []; renderContent(); }
            else if (target.id === 'compare-measure') { state.compareMeasure = target.value; renderContent(); }
            else if (target.id === 'cause-field') { state.causeField = target.value; renderContent(); }
            else if (target.id === 'exposure-group') { state.exposureGroup = target.value; renderContent(); }
            else if (target.dataset.pageSize) { const config = state.tableSettings[target.dataset.pageSize]; config.size = Number(target.value); config.page = 1; renderContent(); }
            else if (target.id === 'assessment-date') {
                if (!Core.parseDate(target.value)) { toast('Choose a valid assessment date.', true); target.value = state.asOf; return; }
                state.asOf = target.value; renderFreshness(); renderContent();
            } else if (target.id === 'warning-days') {
                const days = Number(target.value);
                if (!Number.isInteger(days) || days < 0 || days > 90 || target.value === '') { toast('Warning days must be a whole number from 0 to 90.', true); target.value = state.warningDays; return; }
                state.warningDays = days; renderContent();
            } else if (target.dataset.ruleKind) {
                const rule = target.dataset.rule, rules = state.rules[target.dataset.ruleKind];
                if (target.type === 'checkbox') rules[rule] = target.checked;
                else if (rule === 'freeDays') {
                    const number = target.value === '' ? null : Number(target.value);
                    if (number !== null && (!Number.isInteger(number) || number < 0 || number > 365)) { toast('Free days must be a whole number from 0 to 365.', true); target.value = rules.freeDays ?? ''; return; }
                    rules.freeDays = number;
                } else rules[rule] = target.value;
                if (rule === 'derive') settings();
                renderContent();
            } else if (target.dataset.map || ['map-format', 'map-delivered', 'map-pending'].includes(target.id)) {
                if (target.dataset.map === 'Delivery Status') statusOptions();
                invalidateImport();
            } else if (target.id === 'import-sheet') {
                const selected = Number(target.value);
                try { importSource = Workbook.readSheet(importWorkbook, selected); showSheetPicker(selected); showImportSource(); }
                catch (error) { stagedImport = null; importSource = null; element('import-workspace').innerHTML = ''; showSheetPicker(selected, error.message); }
            } else if (target.id === 'accept-import') {
                element('activate-import').disabled = !target.checked || !stagedImport || stagedImport.blockers.length > 0 || stagedImport.valid.length === 0;
            }
        });
        document.addEventListener('click', async event => {
            const target = event.target.closest('button');
            if (!target) return;
            if (target.dataset.close) element(target.dataset.close).close();
            else if (target.dataset.action === 'regenerate-demo') randomizeDemo();
            else if (target.dataset.action === 'open-import') { element('import-dialog').showModal(); closeSidebar(); }
            else if (target.dataset.action === 'open-settings') { settings(); element('settings-dialog').showModal(); closeSidebar(); }
            else if (target.dataset.action === 'open-rules') element('rules-dialog').showModal();
            else if (target.dataset.export) await exportTable(target.dataset.export, target.dataset.type);
            else if (target.dataset.inspect) inspect(Number(target.dataset.inspect));
            else if (target.dataset.exposureKind) { state.exposureKind = target.dataset.exposureKind; renderContent(); }
            else if (target.dataset.sortTable) { const config = state.tableSettings[target.dataset.sortTable]; config.ascending = config.sort === target.dataset.column ? !config.ascending : true; config.sort = target.dataset.column; renderContent(); }
            else if (target.dataset.pageTable) { state.tableSettings[target.dataset.pageTable].page += Number(target.dataset.step); renderContent(); }
            else if (target.id === 'reset-explorer') { state.explorerFilters = {}; state.tableSettings['explorer-register'] = { search: '', sort: '', ascending: true, page: 1, size: 25 }; renderContent(); }
            else if (target.id === 'validate-import') {
                try { await validateImport(); }
                catch (error) { element('validation-results').innerHTML = notice(error.message, 'danger'); stagedImport = null; }
            } else if (target.id === 'download-validation' && stagedImport) download(Core.toCSV(stagedImport.issues, ['Source Row', 'Field', 'Severity', 'Issue']), 'ffm_validation.csv', 'text/csv;charset=utf-8');
            else if (target.id === 'download-quarantine' && stagedImport) download(Core.toCSV(stagedImport.quarantined, importSource.headers), 'ffm_quarantined.csv', 'text/csv;charset=utf-8');
            else if (target.id === 'activate-import' && stagedImport && !target.disabled && element('accept-import').checked) {
                activate(importSource, stagedImport, false, element('file-input').files[0].name);
                element('import-dialog').close(); render(); toast(`${state.rows.length} eligible containers activated. Filters and rules reset.`);
            }
        });
    }

    function initialize() {
        if (!Core || !Workbook || !Motion || !window.FFMDemo) { element('page-content').innerHTML = notice('A local asset is missing. Keep index.html and the complete assets folder together.', 'danger'); return; }
        const source = window.FFMDemo;
        activate(source, Core.normalize(source, Object.fromEntries(source.headers.map(name => [name, name]))), true, 'Randomized simulation');
        const requested = location.hash.slice(1);
        if (pages.some(page => page[0] === requested)) state.page = requested;
        wireEvents(); render();
        window.setInterval(refreshDemo, 1000);
    }

    initialize();
})();
