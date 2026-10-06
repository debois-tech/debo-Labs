const test = require('node:test');
const assert = require('node:assert/strict');
const { guardOk, hostnameOf } = require('../../src/server');
const { loadConfig } = require('../../src/config');

const req = (headers) => ({ headers });
const local = loadConfig({ LAB_PROFILE: 'local' });
const hosted = loadConfig({});

test('profile defaults: hosted unless LAB_PROFILE (or legacy LAB_MODE) says local', () => {
  assert.equal(hosted.profile, 'hosted');
  assert.equal(loadConfig({ LAB_MODE: 'local' }).profile, 'local');
  assert.equal(loadConfig({ EB_MODE: 'cluster' }).profile, 'hosted');
  assert.deepEqual([hosted.maxSessions, hosted.maxPerIp, hosted.idleMs, hosted.hardCapMs], [5, 3, 300000, 900000]);
  assert.deepEqual([local.maxSessions, local.maxPerIp, local.idleMs, local.hardCapMs], [3, 0, 1800000, 7200000]);
  assert.equal(loadConfig({ MAX_CONCURRENT_SESSIONS: '9' }).maxSessions, 9);   // legacy name still honoured
  assert.equal(local.remoteFonts, false);
  assert.equal(hosted.remoteFonts, true);
});

test('local profile: only loopback Host headers pass (DNS-rebinding guard), even for GET', () => {
  for (const h of ['localhost:8080', '127.0.0.1:9000', 'LOCALHOST', '[::1]:8080']) assert.ok(guardOk(req({ host: h }), local, { needOrigin: false }), h);
  for (const h of ['evil.com', 'evil.com:8080', 'localhost.evil.com', '192.168.1.5:8080', undefined]) assert.ok(!guardOk(req({ host: h }), local, { needOrigin: false }), String(h));
  assert.equal(hostnameOf('[::1]:8080'), '[::1]');
});

test('state-changing requests must carry a matching Origin; local = loopback, hosted = same origin', () => {
  const l = (origin) => guardOk(req({ host: 'localhost:8080', origin }), local, { needOrigin: true });
  assert.ok(l('http://localhost:8080'));
  assert.ok(!l(undefined), 'missing Origin rejected for POST/WS');
  assert.ok(!l('https://evil.com'));
  assert.ok(!l('http://localhost.evil.com'));
  assert.ok(!l('null'));
  const h = (origin) => guardOk(req({ host: 'labs.example.com', origin }), hosted, { needOrigin: true });
  assert.ok(h('https://labs.example.com'));
  assert.ok(!h('https://evil.com'));
  assert.ok(!h(undefined));
  assert.ok(guardOk(req({ host: 'anything.example' }), hosted, { needOrigin: false }), 'hosted GET with no Origin is fine');
});

test('LAB_ULIMIT_V_KB overrides the per-profile address-space limit; 0 disables it', () => {
  assert.equal(loadConfig({}).ulimitVKb, 262144);
  assert.equal(loadConfig({ LAB_PROFILE: 'local' }).ulimitVKb, 1048576);
  assert.equal(loadConfig({ LAB_ULIMIT_V_KB: '0' }).ulimitVKb, 0);
  assert.equal(loadConfig({ LAB_ULIMIT_V_KB: '131072' }).ulimitVKb, 131072);
});

test('invite tokens: comma-separated on hosted, never read by the local profile', () => {
  assert.deepEqual(hosted.accessTokens, []);
  assert.deepEqual(loadConfig({ LAB_ACCESS_TOKENS: ' a, b ,,c ' }).accessTokens, ['a', 'b', 'c']);
  assert.deepEqual(loadConfig({ LAB_ACCESS_TOKEN: 'solo' }).accessTokens, ['solo']);
  assert.deepEqual(loadConfig({ LAB_PROFILE: 'local', LAB_ACCESS_TOKENS: 'a' }).accessTokens, []);
});

test('split hosting: listed page origins pass the hosted guard; the local profile ignores the list; bad entries are dropped', () => {
  const c = loadConfig({ LAB_ALLOWED_ORIGINS: 'https://labs.example.app/, nope, ftp://x.y, http://localhost:3000' });
  assert.deepEqual(c.allowedOrigins, ['https://labs.example.app', 'http://localhost:3000']);
  const g = (origin, cfg = c) => guardOk(req({ host: 'api.example.com', origin }), cfg, { needOrigin: true });
  assert.ok(g('https://labs.example.app'));
  assert.ok(g('https://api.example.com'), 'same origin still works');
  assert.ok(!g('https://labs.example.app.evil.com'));
  assert.ok(!g('https://other.example.app'));
  assert.deepEqual(loadConfig({ LAB_PROFILE: 'local', LAB_ALLOWED_ORIGINS: 'https://a.b' }).allowedOrigins, []);
  assert.equal(loadConfig({ LAB_BACKEND_URL: 'https://api.example.com/x' }).backendUrl, 'https://api.example.com');
  assert.equal(loadConfig({ LAB_BACKEND_URL: 'javascript:alert(1)' }).backendUrl, '');
});

test('the header chip says what this host is: preview without a terminal host, online with one, cluster when it runs shells', () => {
  assert.equal(loadConfig({ VERCEL: '1' }).chip, 'preview');
  assert.equal(loadConfig({ VERCEL: '1', LAB_BACKEND_URL: 'https://api.example.com' }).chip, 'online');
  assert.equal(loadConfig({}).chip, 'cluster');
  assert.equal(loadConfig({ LAB_PROFILE: 'local' }).chip, 'local');
});
