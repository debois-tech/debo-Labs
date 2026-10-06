const test = require('node:test');
const assert = require('node:assert/strict');
const { clientIp } = require('../../src/lib');

test('uses the rightmost X-Forwarded-For entry (the one the ALB appended), not a client-forged one', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }, socket: {} }), '203.0.113.9');
});

test('falls back to the socket peer when there is no X-Forwarded-For', () => {
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});
