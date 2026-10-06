const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionStore, createUidPool } = require('../../src/lib');

const mk = (ms = 60_000, onExpire) => createSessionStore({ connectDeadlineMs: ms, onExpire });

test('mint creates a session that has() and get() can find, carrying meta, ip and uid', () => {
  const store = mk();
  const token = store.mint({ track: 't', lab: 'l' }, '1.2.3.4', 10003);
  assert.equal(store.has(token), true);
  assert.deepEqual([store.get(token).meta, store.get(token).ip, store.get(token).uid], [{ track: 't', lab: 'l' }, '1.2.3.4', 10003]);
  store.expire(token);
});

test('a session never marked connected is reclaimed after the connect deadline, and onExpire fires', async () => {
  const expired = [];
  const store = mk(20, (s) => expired.push(s.uid));
  const token = store.mint({}, 'ip', 10001);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(store.has(token), false);
  assert.deepEqual(expired, [10001]);
});

test('markConnected cancels the connect deadline, so the session survives past it', async () => {
  const store = mk(20);
  const token = store.mint({});
  store.markConnected(token, { shellPid: 12345, home: '/h' });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(store.has(token), true);
  assert.equal(store.get(token).shellPid, 12345);
  store.expire(token);
});

test('expire removes the session, cancels its timer, and is idempotent', () => {
  let n = 0;
  const store = mk(60_000, () => n++);
  const token = store.mint({});
  store.expire(token);
  store.expire(token);
  assert.equal(store.has(token), false);
  assert.equal(n, 1);
});

test('size() and countByIp() count live and not-yet-connected sessions (the seat cap relies on both)', () => {
  const store = mk();
  const a = store.mint({}, '10.0.0.1');
  const b = store.mint({}, '10.0.0.1');
  const c = store.mint({}, '10.0.0.2');
  assert.equal(store.size(), 3);
  assert.equal(store.countByIp('10.0.0.1'), 2);
  store.expire(a);
  assert.equal(store.countByIp('10.0.0.1'), 1);
  [b, c].forEach((t) => store.expire(t));
});

test('recordInput accumulates keystrokes per session and never leaks between sessions', () => {
  const store = mk();
  const a = store.mint({});
  const b = store.mint({});
  let lines = [];
  for (const ch of 'hostname\r') lines = lines.concat(store.recordInput(a, ch));
  assert.deepEqual(lines, ['hostname']);
  assert.deepEqual(store.recordInput(b, '\r'), []);
  assert.deepEqual(store.recordInput('nope', 'x\r'), []);
  [a, b].forEach((t) => store.expire(t));
});

test('uid pool hands out distinct uids, reuses released ones, and is a no-op without a base (not root)', () => {
  const pool = createUidPool(10000, 3);
  const [a, b, c] = [pool.acquire(), pool.acquire(), pool.acquire()];
  assert.deepEqual([a, b, c], [10000, 10001, 10002]);
  assert.equal(pool.acquire(), null);
  pool.release(b);
  assert.equal(pool.acquire(), 10001);
  assert.equal(createUidPool(undefined, 3).acquire(), undefined);
});
