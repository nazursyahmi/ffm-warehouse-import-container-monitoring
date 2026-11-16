const test = require('node:test');
const assert = require('node:assert/strict');
const Motion = require('../assets/motion.js');

test('chart frames interpolate bar, line, pie and box values without changing source data', () => {
    for (const type of ['bar', 'scatter', 'pie', 'box']) {
        const key = type === 'pie' ? 'values' : 'y';
        const before = [{ type, [key]: [10, 30] }];
        const after = [{ type, [key]: [30, 50] }];
        assert.deepEqual(Motion.chartFrame(before, after, 0.5)[0][key], [20, 40]);
        assert.deepEqual(before[0][key], [10, 30]);
        assert.deepEqual(after[0][key], [30, 50]);
        assert.deepEqual(Motion.chartFrame(before, after, 1), after);
    }
});

test('chart categories retain identity when points are added or reordered', () => {
    const before = [{ type: 'bar', x: ['A', 'B'], y: [10, 20] }];
    const after = [{ type: 'bar', x: ['B', 'C'], y: [40, 10] }];
    const frame = Motion.chartFrame(before, after, 0.5)[0];
    assert.deepEqual(frame.x, ['A', 'B', 'C']);
    assert.deepEqual(frame.y, [5, 30, 5]);
});

test('animation renders intermediate values, reaches its exact target and can be cancelled', async () => {
    const callbacks = [];
    const values = [];
    const cancel = Motion.animate(1000, progress => values.push(progress), callback => callbacks.push(callback));
    await callbacks.shift()(0);
    await callbacks.shift()(500);
    assert.equal(values.at(-1), 0.5);
    await callbacks.shift()(1000);
    assert.equal(values.at(-1), 1);
    assert.equal(callbacks.length, 0);
    const stop = Motion.animate(1000, progress => values.push(progress), callback => callbacks.push(callback));
    stop();
    const length = values.length;
    await callbacks.shift()(2000);
    assert.equal(values.length, length);
    cancel();
});
