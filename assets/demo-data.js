/* Random simulation only. No operational shipment, tariff or cause data. */
(function (root) {
    'use strict';
    const core = root.FFMCore || (typeof require === 'function' ? require('./dashboard-core.js') : null);

    function createDemo(random = Math.random, asOf = '2026-11-16', deliveryChance = 0.76) {
        const integer = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
        const vessels = ['Demo Meridian', 'Demo Horizon', 'Demo Pacific', 'Demo Atlas', 'Demo Voyager', 'Demo Pioneer'];
        const lines = ['DEMO Ocean Line', 'DEMO Global Shipping', 'DEMO Maritime'];
        const causes = [
            ['DEMO Documentation', 'DEMO missing shipment paperwork'],
            ['DEMO Transport', 'DEMO transport capacity constraint'],
            ['DEMO Warehouse', 'DEMO receiving slot unavailable'],
            ['DEMO Clearance', 'DEMO simulated clearance review'],
        ];
        const rows = [];
        for (let index = 0; index < 180; index++) {
            const shipment = Math.floor(index / 10);
            const arrival = core.addDays(asOf, -(5 + shipment * 7 + integer(0, 4)));
            const discharge = core.addDays(arrival, 1);
            const delivered = index % 10 === 0 ? false : random() < deliveryChance;
            const gateOut = delivered || random() < 0.7 ? core.addDays(discharge, integer(0, 3)) : null;
            const delivery = delivered ? [core.addDays(gateOut, integer(1, 8)), asOf].sort()[0] : null;
            const returned = delivered && random() < 0.72;
            const returnDate = returned ? [core.addDays(delivery, integer(1, 6)), asOf].sort()[0] : null;
            let target = core.addDays(arrival, integer(3, 11));
            if (!delivered && index % 3 === 0) target = core.addDays(asOf, [-2, 0, 2, 6][shipment % 4]);
            const delay = core.daysBetween(delivery || asOf, target);
            const cause = delay > 0 ? causes[integer(0, causes.length - 1)] : [null, null];
            rows.push({
                'Container Number': 'DEMO' + String(index + 1).padStart(7, '0'),
                'BL Number': 'DEMO-BL-' + String(shipment + 1).padStart(3, '0'),
                'Vessel Name': vessels[shipment % vessels.length],
                'Shipping Line': lines[shipment % lines.length],
                'Delivery Status': delivered ? 'Delivered' : 'Pending',
                'RFC Status': delivered ? 'Complete' : 'Pending',
                'Return Status': returned ? 'Returned' : 'Not returned',
                'Arrival Date': arrival, 'Discharge Date': discharge, 'Gate Out Date': gateOut,
                'Delivery Deadline': target, 'Delivery Date': delivery, 'Return Date': returnDate,
                'DEM Deadline': core.addDays(discharge, integer(4, 10)),
                'DET Deadline': gateOut ? core.addDays(gateOut, integer(5, 12)) : null,
                'DEM Daily Rate': integer(8, 20) * 10,
                'DET Daily Rate': integer(6, 14) * 10,
                'Currency': 'MYR', 'Delay Category': cause[0], 'Root Cause': cause[1],
                'Source Updated At': asOf,
            });
        }
        return { headers: [...core.schema], rows };
    }

    function advanceDemo(source, random = Math.random) {
        // Wider fictional status swings make the gauge and charts visibly move.
        const deliveryChance = random() < 0.5 ? 0.9 : 0.2;
        const next = createDemo(random, undefined, deliveryChance);
        const replacements = new Map(next.rows.map(row => [row['Container Number'], row]));
        const rows = source.rows.map(row => ({ ...row }));
        // Refresh 30% of the demo per tick; identities remain stable.
        const start = Math.floor(random() * rows.length);
        for (let offset = 0; offset < Math.min(54, rows.length); offset++) {
            const index = (start + offset) % rows.length;
            const replacement = replacements.get(rows[index]['Container Number']);
            if (replacement) rows[index] = replacement;
        }
        return { headers: [...source.headers], rows };
    }

    root.FFMAdvanceDemo = advanceDemo;
    root.FFMCreateDemo = createDemo;
    root.FFMDemo = createDemo();
    if (typeof module !== 'undefined') module.exports = { createDemo, advanceDemo };
})(typeof globalThis !== 'undefined' ? globalThis : window);
