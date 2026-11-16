/* Display-only interpolation. Analytical data and exports keep exact values. */
(function (root) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const blend = (start, end, progress) => start + (end - start) * progress;

    function chartFrame(before, after, progress) {
        if (progress >= 1) return clone(after);
        return after.map((trace, index) => {
            const old = before.find(item => item.type === trace.type && item.name === trace.name) || before[index] || trace;
            const frame = clone(trace);
            const category = trace.labels ? 'labels' : (trace.x?.some(value => typeof value !== 'number') ? 'x' : null);
            const measure = trace.labels ? 'values' : 'y';
            if (category && Array.isArray(old[category])) {
                const keys = [...new Set([...old[category], ...trace[category]])];
                const left = new Map(old[category].map((key, i) => [key, old[measure]?.[i] ?? 0]));
                const right = new Map(trace[category].map((key, i) => [key, trace[measure]?.[i] ?? 0]));
                frame[category] = keys;
                frame[measure] = keys.map(key => blend(left.get(key) ?? 0, right.get(key) ?? 0, progress));
            } else {
                for (const key of ['x', 'y', 'values']) {
                    if (!Array.isArray(trace[key]) || !trace[key].every(Number.isFinite)) continue;
                    frame[key] = trace[key].map((value, i) => blend(old[key]?.[i] ?? value, value, progress));
                }
            }
            return frame;
        });
    }

    function animate(duration, draw, requestFrame = root.requestAnimationFrame.bind(root)) {
        let cancelled = false;
        let start;
        async function frame(time) {
            if (cancelled) return;
            if (start === undefined) start = time;
            const elapsed = Math.min(1, Math.max(0, (time - start) / duration));
            const eased = elapsed * elapsed * (3 - 2 * elapsed);
            await draw(eased);
            if (!cancelled && elapsed < 1) requestFrame(frame);
        }
        requestFrame(frame);
        return () => { cancelled = true; };
    }

    root.FFMMotion = { chartFrame, animate, blend };
    if (typeof module !== 'undefined') module.exports = root.FFMMotion;
})(typeof globalThis !== 'undefined' ? globalThis : window);
