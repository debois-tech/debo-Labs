const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCpuStat, parseMemory } = require('../../src/lib');

test('parseCpuStat extracts usage_usec from a real cgroup v2 cpu.stat body', () => {
  const body = 'usage_usec 1234567\nuser_usec 900000\nsystem_usec 334567\n';
  assert.equal(parseCpuStat(body), 1234567);
});

test('parseCpuStat returns null when usage_usec is missing', () => {
  assert.equal(parseCpuStat('nr_periods 0\n'), null);
});

test('parseMemory parses a numeric memory.max', () => {
  const result = parseMemory('52428800\n', '536870912\n', 999);
  assert.deepEqual(result, { used: 52428800, max: 536870912 });
});

test('parseMemory falls back to the provided total when memory.max is "max" (unlimited)', () => {
  const result = parseMemory('1024\n', 'max\n', 8_000_000_000);
  assert.deepEqual(result, { used: 1024, max: 8_000_000_000 });
});

test('parseMemory returns null on unparseable input', () => {
  assert.equal(parseMemory('not-a-number\n', '512\n', 0), null);
});

const { parseCpuMax } = require('../../src/lib');

test('parseCpuMax converts quota/period to cores (50000 100000 = half a core)', () => {
  assert.equal(parseCpuMax('50000 100000\n'), 0.5);
  assert.equal(parseCpuMax('200000 100000'), 2);
});

test('parseCpuMax returns null when the container has no hard CPU limit', () => {
  assert.equal(parseCpuMax('max 100000\n'), null);
});
