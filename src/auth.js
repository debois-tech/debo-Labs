// Accounts and saved progress. No database: one JSON file in DATA_DIR (a Docker volume), written atomically.
// Passwords are scrypt-hashed; a login is a signed, HttpOnly cookie, so the server keeps no session table.
// Single-process by design: run one lab server per data directory (see deploy/vps).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'debo_session';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const LAB_ID_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const b64 = (b) => Buffer.from(b).toString('base64url');

function createAuth({ dir, secret, secure }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const usersFile = path.join(dir, 'users.json');
  const key = Buffer.from(secret || loadOrCreateSecret(path.join(dir, '.secret')));

  let users = {};                                  // id -> { id, email, name, salt, hash, createdAt, done: [] }
  try { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { /* first run */ }
  const byEmail = (email) => Object.values(users).find((u) => u.email === email);
  const save = () => {
    const tmp = usersFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(users), { mode: 0o600 });
    fs.renameSync(tmp, usersFile);
  };

  const hash = (password, salt) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const DUMMY_SALT = crypto.randomBytes(16);       // so an unknown email costs the same time as a wrong password

  // Slow down guessing: attempts per IP in a sliding window.
  const attempts = new Map();
  function limited(ip) {
    const now = Date.now();
    const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
    list.push(now);
    attempts.set(ip, list);
    if (attempts.size > 5000) attempts.clear();
    return list.length > 20;
  }

  const sign = (payload) => crypto.createHmac('sha256', key).update(payload).digest('base64url');
  function makeCookie(id) {
    const payload = b64(JSON.stringify({ id, exp: Date.now() + SESSION_MS }));
    return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
  }
  const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

  function userFrom(req) {
    const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    if (!m) return null;
    const [payload, sig] = m[1].split('.');
    if (!payload || !sig) return null;
    const want = Buffer.from(sign(payload));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    try {
      const { id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return exp > Date.now() ? (users[id] || null) : null;
    } catch { return null; }
  }
  const view = (u) => ({ email: u.email, name: u.name });

  async function signup({ email, password, name }, ip) {
    if (limited(ip)) return { status: 429, error: 'Too many attempts. Try again in a few minutes.' };
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    name = String(name || '').trim().slice(0, 60);
    if (!EMAIL_RE.test(email)) return { status: 400, error: 'Enter a valid email address.' };
    if (password.length < 8 || password.length > 200) return { status: 400, error: 'Use a password of at least 8 characters.' };
    if (byEmail(email)) return { status: 409, error: 'An account with this email already exists. Log in instead.' };
    const salt = crypto.randomBytes(16);
    const id = crypto.randomBytes(12).toString('hex');
    users[id] = { id, email, name, salt: salt.toString('hex'), hash: (await hash(password, salt)).toString('hex'), createdAt: new Date().toISOString(), done: [] };
    save();
    return { status: 200, user: view(users[id]), cookie: makeCookie(id) };
  }

  async function login({ email, password }, ip) {
    if (limited(ip)) return { status: 429, error: 'Too many attempts. Try again in a few minutes.' };
    const u = byEmail(String(email || '').trim().toLowerCase());
    const given = await hash(String(password || '').slice(0, 200), u ? Buffer.from(u.salt, 'hex') : DUMMY_SALT);
    if (!u || !crypto.timingSafeEqual(given, Buffer.from(u.hash, 'hex'))) return { status: 401, error: 'Wrong email or password.' };
    return { status: 200, user: view(u), cookie: makeCookie(u.id) };
  }

  const progressOf = (u) => u.done.slice();
  function markDone(u, labs) {
    let changed = false;
    for (const l of [].concat(labs)) {
      if (typeof l === 'string' && LAB_ID_RE.test(l) && !u.done.includes(l) && u.done.length < 1000) { u.done.push(l); changed = true; }
    }
    if (changed) save();
    return progressOf(u);
  }

  return { userFrom, signup, login, clearCookie, view, progressOf, markDone };
}

function loadOrCreateSecret(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}

module.exports = { createAuth, LAB_ID_RE };
