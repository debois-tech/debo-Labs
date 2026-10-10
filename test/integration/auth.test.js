// Accounts and saved progress (LAB_AUTH=on). No pty needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { start, get, post } = require('./helpers');

const dataDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
const cookieOf = (r) => String(r.headers['set-cookie'] || '').split(';')[0];
const acct = { email: 'Learner@Example.com', password: 'correct horse', name: 'Lee' };

test('auth is off unless enabled: no login page, /auth/me says so', async () => {
  const app = await start();
  try {
    assert.deepEqual((await get(app, '/auth/me')).json, { enabled: false, user: null });
    assert.equal((await get(app, '/login')).status, 404);
  } finally { app.stop(); }
});

test('sign up, log in, wrong password, logout; the cookie is HttpOnly and the email is case-insensitive', async () => {
  const app = await start({ authEnabled: true, dataDir: dataDir(), accessTokens: [] });
  try {
    assert.equal((await post(app, '/auth/signup', { ...acct, password: 'short' })).status, 400);
    assert.equal((await post(app, '/auth/signup', { ...acct, email: 'nope' })).status, 400);
    assert.equal((await post(app, '/auth/signup', { ...acct, name: '  ' })).status, 400, 'a name is required');
    const up = await post(app, '/auth/signup', acct);
    assert.equal(up.status, 200);
    assert.match(String(up.headers['set-cookie']), /HttpOnly/);
    assert.equal((await post(app, '/auth/signup', acct)).status, 409);
    assert.equal((await post(app, '/auth/login', { email: acct.email, password: 'wrong password' })).status, 401);
    assert.equal((await post(app, '/auth/login', { email: 'nobody@example.com', password: 'whatever12' })).status, 401);
    const login = await post(app, '/auth/login', { email: 'learner@example.com', password: acct.password });
    assert.equal(login.status, 200);
    const me = await get(app, '/auth/me', { headers: { Cookie: cookieOf(login) } });
    assert.equal(me.json.user.email, 'learner@example.com');
    assert.equal((await get(app, '/auth/me', { headers: { Cookie: cookieOf(login) + 'x' } })).json.user, null, 'a tampered cookie is not a login');
    assert.equal((await post(app, '/auth/logout', {})).status, 200);
    assert.equal((await post(app, '/auth/login', { email: acct.email, password: acct.password }, { origin: false })).status, 403, 'POST needs an Origin');
  } finally { app.stop(); }
});

test('progress is per account, validated against the catalog, and survives a restart', async () => {
  const dir = dataDir();
  let app = await start({ authEnabled: true, dataDir: dir, accessTokens: [] });
  let cookie;
  try {
    cookie = cookieOf(await post(app, '/auth/signup', acct));
    assert.equal((await get(app, '/progress')).status, 401);
    assert.equal((await post(app, '/progress', { labs: ['git-basics/first-commit'] })).status, 401);
    const track = (await get(app, '/t/git-basics')).body.match(/\/lab\/git-basics\/([a-z0-9-]+)/)[1];
    const r = await post(app, '/progress', { labs: [`git-basics/${track}`, 'nope/nope', '../etc/passwd'] }, { headers: { Cookie: cookie } });
    assert.deepEqual(r.json.done, [`git-basics/${track}`]);
    assert.deepEqual((await get(app, '/progress', { headers: { Cookie: cookie } })).json.done, [`git-basics/${track}`]);
  } finally { app.stop(); }
  app = await start({ authEnabled: true, dataDir: dir, accessTokens: [] });
  try {
    const login = await post(app, '/auth/login', acct);
    assert.equal(login.status, 200);
    assert.equal((await get(app, '/progress', { headers: { Cookie: cookieOf(login) } })).json.done.length, 1);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'users.json'), 'utf8'), /correct horse/, 'passwords are never stored');
  } finally { app.stop(); }
});

test('with accounts on, starting a lab needs a login (and no invite code when none are configured)', async () => {
  const app = await start({ authEnabled: true, dataDir: dataDir(), accessTokens: [] });
  try {
    const body = { track: 'aws', lab: 'elastic-beanstalk-cluster-mode' };
    const anon = await post(app, '/session', body);
    assert.equal(anon.status, 401);
    assert.equal(anon.json.error, 'login-required');
    const cookie = cookieOf(await post(app, '/auth/signup', acct));
    assert.equal((await post(app, '/session', body, { headers: { Cookie: cookie } })).status, 200);
    assert.match((await get(app, '/login')).body, /auth-form/);
  } finally { app.stop(); }
});
