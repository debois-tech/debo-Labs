const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHandler } = require('../../api/backend');

// A real HTTP server stands in for the lab server inside the sandbox, so /healthz is answered for real.
function labServer(up) {
  const s = http.createServer((req, res) => { res.statusCode = up.value ? 200 : 503; res.end('ok'); });
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${s.address().port}` })));
}

function fakeSdk(url, { running = false, expiresInMs = 60 * 60 * 1000 } = {}) {
  const calls = { create: [], run: [], extend: 0 };
  const sandbox = {
    expiresAt: new Date(Date.now() + expiresInMs),
    domain: (port) => { assert.equal(port, 8080); return url; },
    runCommand: async (c) => { calls.run.push(c); return { exitCode: c.cmd === 'pgrep' ? (running ? 0 : 1) : 0 }; },
    extendTimeout: async () => { calls.extend++; },
  };
  return { calls, loadSdk: async () => ({ Sandbox: { getOrCreate: async (o) => { calls.create.push(o); return sandbox; } } }) };
}

const call = (handler, { method = 'POST', headers = {} } = {}) => new Promise((resolve) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b), headers: this.headers }); } };
  handler({ method, headers: { host: 'labs.example.app', origin: 'https://labs.example.app', 'x-lab-token': 'good', ...headers } }, res);
});
const ENV = { LAB_ACCESS_TOKENS: 'good,other', LAB_ALLOWED_ORIGINS: 'https://labs.example.app' };

test('refuses anything but a same-origin POST with a valid invite code, before touching the sandbox', async () => {
  const sdk = fakeSdk('http://127.0.0.1:1');
  const h = createHandler({ loadSdk: sdk.loadSdk, env: ENV });
  assert.equal((await call(h, { method: 'GET' })).status, 405);
  assert.equal((await call(h, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call(h, { headers: { origin: undefined } })).status, 403);
  assert.equal((await call(h, { headers: { 'x-lab-token': 'wrong' } })).status, 401);
  assert.equal((await call(h, { headers: { 'x-lab-token': undefined } })).status, 401);
  assert.equal((await call(createHandler({ loadSdk: sdk.loadSdk, env: {} }))).status, 401, 'no codes configured means closed');
  assert.equal(sdk.calls.create.length, 0);
});

test('a sandbox with no server running gets one started, once, and the page is told to ask again', async () => {
  const up = { value: false };
  const { s, url } = await labServer(up);
  try {
    const sdk = fakeSdk(url);
    const r = await call(createHandler({ loadSdk: sdk.loadSdk, env: { ...ENV, LAB_SANDBOX_VCPUS: '8', LAB_MAX_SESSIONS: '30' } }));
    assert.deepEqual([r.status, r.body], [200, { ready: false }]);
    assert.equal(sdk.calls.create[0].name, 'debo-labs-server');
    assert.deepEqual(sdk.calls.create[0].ports, [8080]);
    assert.equal(sdk.calls.create[0].resources.vcpus, 8);
    const start = sdk.calls.run.find((c) => c.cmd !== 'pgrep');
    assert.ok(start.sudo && start.detached, 'runs as root so it can give each learner their own user');
    assert.equal(start.env.LAB_ACCESS_TOKENS, 'good,other');
    assert.equal(start.env.LAB_ALLOWED_ORIGINS, 'https://labs.example.app');
    assert.equal(start.env.MAX_SESSIONS, '30');
    // a server process already exists but is not healthy yet: do not start a second one
    const again = fakeSdk(url, { running: true });
    await call(createHandler({ loadSdk: again.loadSdk, env: ENV }));
    assert.equal(again.calls.run.filter((c) => c.cmd !== 'pgrep').length, 0);
  } finally { s.close(); }
});

test('a healthy server returns its address, and the sandbox life is extended only when it runs low', async () => {
  const { s, url } = await labServer({ value: true });
  try {
    const fresh = fakeSdk(url);
    const r = await call(createHandler({ loadSdk: fresh.loadSdk, env: ENV }));
    assert.deepEqual([r.status, r.body], [200, { ready: true, url }]);
    assert.equal(fresh.calls.extend, 0);
    assert.equal(fresh.calls.run.length, 0, 'nothing is started when it already answers');
    const low = fakeSdk(url, { expiresInMs: 3 * 60 * 1000 });
    await call(createHandler({ loadSdk: low.loadSdk, env: ENV }));
    assert.equal(low.calls.extend, 1);
  } finally { s.close(); }
});

test('an SDK failure is a clear 502, never a crash', async () => {
  const h = createHandler({ loadSdk: async () => ({ Sandbox: { getOrCreate: async () => { throw new Error('boom'); } } }), env: ENV });
  const r = await call(h);
  assert.equal(r.status, 502);
  assert.match(r.body.message, /Could not start the lab server/);
});
