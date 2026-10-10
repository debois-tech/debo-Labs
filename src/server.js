const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const WebSocket = require('ws');
const {
  createSessionStore, createUidPool, killProcessSession, killProcessesOfUid, clientIp,
} = require('./lib');
const { loadConfig } = require('./config');
const { loadCatalog } = require('./loader');
const { createUi } = require('./ui');
const { createSandbox } = require('./sandbox');
const { createStats } = require('./stats');
const { createAuth } = require('./auth');
const pages = require('./pages');

const XTERM_DIR = path.join(__dirname, '..', 'node_modules', '@xterm');
const BASHRC = path.join(__dirname, 'lab.bashrc');
const MAX_WS_MESSAGE_BYTES = 64 * 1024;
const MAX_JSON_BODY_BYTES = 4 * 1024;
const ANSWER_AFTER = 3;   // failed checks of one task before its answer can be shown

// --- Request guards -------------------------------------------------------------
// This app hands out a real shell, so a web page the visitor happens to have open
// must not be able to drive it.
//  local  : Host and Origin must be loopback names (stops DNS rebinding and CSRF
//           against localhost:8082).
//  hosted : Origin must equal Host (same-origin); Host is whatever the ALB serves.
// State-changing requests (POST, WebSocket) must carry an Origin; browsers always send one.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
function hostnameOf(hostHeader) {
  const h = String(hostHeader || '').toLowerCase();
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0];
}
// Local profile only: any Host that is not a loopback name is a DNS-rebinding attempt.
function hostOk(req, cfg) {
  return !cfg.isLocal || LOOPBACK.has(hostnameOf(req.headers.host));
}
function guardOk(req, cfg, { needOrigin }) {
  const origin = req.headers.origin;
  if (!hostOk(req, cfg)) return false;
  if (!origin) return !needOrigin;
  let originHost;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return false; }
  if (cfg.isLocal) return LOOPBACK.has(hostnameOf(originHost));
  // hosted: same origin, or a page origin the operator listed (the pages live on another host)
  return originHost === String(req.headers.host || '').toLowerCase() || (cfg.allowedOrigins || []).includes(new URL(origin).origin);
}

// Hosted only: every lab needs one of the configured invite tokens (the local app never asks). Compared as
// SHA-256 digests so length and content never leak through timing. No tokens
// configured means closed, never open.
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
function tokenOk(req, cfg) {
  const given = digest(req.headers['x-lab-token'] || '');
  return cfg.accessTokens.reduce((ok, t) => crypto.timingSafeEqual(given, digest(t)) || ok, false);
}

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}
const json = (res, status, obj, extra) => send(res, status, 'application/json', JSON.stringify(obj), extra);

function readJson(req, res, cb) {
  let body = '';
  let tooBig = false;
  req.on('data', (c) => {
    if (tooBig) return;
    body += c;
    // Answer, then close the connection (rather than destroying it mid-response) and stop buffering.
    if (body.length > MAX_JSON_BODY_BYTES) { tooBig = true; json(res, 413, { error: 'too large', pass: false }, { Connection: 'close' }); }
  });
  req.on('end', () => {
    if (tooBig) return;
    let parsed;
    try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
    cb(parsed || {});
  });
}

// A factory, not a singleton: each call builds a fully independent server (own
// session store, own catalog), so tests can run as many isolated instances as they like.
function createApp(opts = {}) {
  const env = { ...process.env };
  if (opts.profile) env.LAB_PROFILE = opts.profile;
  const { profile, ...rest } = opts;
  const cfg = { ...loadConfig(env), ...rest };

  const ui = createUi({ chip: cfg.chip, chipTitle: `pod ${os.hostname()}`, remoteFonts: cfg.remoteFonts, auth: cfg.authEnabled, xtermDir: XTERM_DIR });
  const sandbox = createSandbox({ labsDir: cfg.labsDir });
  const stats = createStats();
  const auth = cfg.authEnabled ? createAuth({ dir: cfg.dataDir, secret: cfg.authSecret, secure: !cfg.isLocal }) : null;
  const pool = createUidPool(cfg.uidBase, cfg.maxSessions);

  fs.mkdirSync(cfg.sandboxDir, { recursive: true });
  try { fs.chmodSync(cfg.sandboxDir, 0o711); } catch { /* not ours to chmod */ }   // traversable, not listable

  const store = createSessionStore({ connectDeadlineMs: cfg.connectDeadlineMs, onExpire: (s) => pool.release(s.uid) });

  let catalog = loadCatalog(cfg.labsDir);
  catalog.problems.forEach((p) => console.warn('content problem: ' + p));
  const getCatalog = () => (cfg.watch ? (catalog = loadCatalog(cfg.labsDir)) : catalog);
  const findLab = (t, l) => getCatalog().tracks.find((x) => x.id === t)?.labs.find((x) => x.id === l);
  const page = (title, body, scripts) => ui.page(title, body, scripts);

  const idOf = (token) => token.slice(0, 8);
  const homeOf = (token) => path.join(cfg.sandboxDir, idOf(token));
  const historyOf = (token) => path.join(cfg.sandboxDir, `.${idOf(token)}.history`);

  // Per-shell guards (fork bombs, runaway memory, huge files) applied before the learner gets the shell.
  // ulimit -v bounds one process, not the sum over concurrent sessions, so under real memory pressure the
  // kernel must pick a learner's process, never the server that serves everyone. A process may always RAISE
  // its own oom_score_adj (no capability needed), and children inherit it.
  const bootstrap = `echo 1000 > /proc/self/oom_score_adj 2>/dev/null; ulimit -u 256 2>/dev/null; ${cfg.ulimitVKb > 0 ? `ulimit -v ${cfg.ulimitVKb} 2>/dev/null; ` : ''}ulimit -f 40960 2>/dev/null; exec bash --rcfile ${BASHRC} -i`;

  const server = http.createServer((req, res) => {
    // Local profile: refuse any non-loopback Host outright (DNS rebinding).
    if (!hostOk(req, cfg)) return send(res, 421, 'text/plain', 'This app only answers on localhost.');
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    let m;

    // Cross-origin calls from a listed page host (split hosting): CORS headers, and the preflight answered here.
    const origin = req.headers.origin;
    const corsOk = !!origin && !cfg.isLocal && (cfg.allowedOrigins || []).includes((() => { try { return new URL(origin).origin; } catch { return ''; } })());
    if (corsOk) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      if (!corsOk) return send(res, 403, 'text/plain', 'forbidden');
      return send(res, 204, 'text/plain', '', { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Lab-Token', 'Access-Control-Max-Age': '600' });
    }

    if (req.method === 'GET' && p === '/healthz') return send(res, 200, 'text/plain', 'ok');
    if (req.method === 'GET' && p === '/stats') {
      // sessions/maxSessions let an operator see seat pressure per replica without shell access.
      return json(res, 200, { ...stats.get(), sessions: store.size(), maxSessions: cfg.maxSessions, profile: cfg.profile });
    }
    if (ui.serveAsset(req, res, p)) return;

    // Accounts and saved progress (LAB_AUTH=on). Same-origin only: state-changing calls must carry a matching Origin.
    if (auth && (p === '/auth/me' || p === '/progress' || p.startsWith('/auth/'))) {
      const user = auth.userFrom(req);
      const ip = clientIp(req, { trustProxy: cfg.trustProxy });
      const reply = (r) => json(res, r.status, r.error ? { error: r.error } : { user: r.user }, r.cookie ? { 'Set-Cookie': r.cookie, 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' });
      if (req.method === 'GET' && p === '/auth/me') return json(res, 200, { enabled: true, user: user ? auth.view(user) : null }, { 'Cache-Control': 'no-store' });
      if (req.method === 'GET' && p === '/progress') return user ? json(res, 200, { done: auth.progressOf(user) }, { 'Cache-Control': 'no-store' }) : json(res, 401, { error: 'login-required' });
      if (req.method === 'POST' && ['/auth/signup', '/auth/login', '/auth/logout', '/progress'].includes(p)) {
        if (!guardOk(req, cfg, { needOrigin: true })) return json(res, 403, { error: 'forbidden' });
        if (p === '/auth/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() });
        return readJson(req, res, async (body) => {
          if (p === '/auth/signup') return reply(await auth.signup(body, ip));
          if (p === '/auth/login') return reply(await auth.login(body, ip));
          if (!user) return json(res, 401, { error: 'login-required' });
          const labs = [].concat(body.labs || body.lab || []).filter((id) => typeof id === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(id) && findLab(...id.split('/')));
          json(res, 200, { done: auth.markDone(user, labs) });
        });
      }
    }
    if (!auth && req.method === 'GET' && p === '/auth/me') return json(res, 200, { enabled: false, user: null });
    if (auth && req.method === 'GET' && p === '/login') return send(res, 200, 'text/html', page('Log in', pages.loginBody()));

    if (req.method === 'GET' && p === '/') {
      const home = pages.homeBody(getCatalog(), cfg);
      return send(res, 200, 'text/html', ui.page('Home', home.body, home.scripts, home.head));
    }
    if (req.method === 'GET' && (m = p.match(/^\/t\/([a-z0-9-]+)$/))) {
      const track = getCatalog().tracks.find((t) => t.id === m[1]);
      if (!track) return send(res, 404, 'text/html', page('Not found', pages.notFoundBody()));
      return send(res, 200, 'text/html', page(track.title, pages.trackBody(track), '<script src="/progress.js"></script>'));
    }
    // The page shell takes no seat; the page's JS mints a session with POST /session.
    if (req.method === 'GET' && (m = p.match(/^\/lab\/([a-z0-9-]+)\/([a-z0-9-]+)$/))) {
      const lab = findLab(m[1], m[2]);
      if (!lab) return send(res, 404, 'text/html', page('Not found', pages.notFoundBody()));
      const trackTitle = getCatalog().tracks.find((x) => x.id === lab.track).title;
      const { body, scripts } = pages.labBody(lab, trackTitle, cfg, pages.nextLab(getCatalog(), lab.track, lab.id));
      return send(res, 200, 'text/html', page(lab.title, body, scripts), { 'Cache-Control': 'no-store' });
    }

    if (req.method === 'POST' && p === '/session') {
      if (!guardOk(req, cfg, { needOrigin: true })) return json(res, 403, { error: 'forbidden' });
      if (!cfg.terminal && !cfg.backendUrl && !cfg.sandbox) return json(res, 501, { error: 'no-terminal', message: 'Live terminals are not available on this host. Run Debo Labs with Docker to try the labs (see the README).' });
      return readJson(req, res, ({ track, lab }) => {
        const found = findLab(String(track), String(lab));
        if (!found) return json(res, 404, { error: 'unknown lab' });
        if (auth && !auth.userFrom(req)) return json(res, 401, { error: 'login-required', message: 'Log in to start a lab.' });
        if (!cfg.isLocal && !(auth && !cfg.accessTokens.length) && !tokenOk(req, cfg)) {   // accounts replace invite codes unless codes are configured too
          return json(res, 401, { error: 'token-required', message: 'This lab needs an invite code.' });
        }
        const ip = clientIp(req, { trustProxy: cfg.trustProxy });
        // Retry-After + client auto-retry: a visitor who hits a full replica just waits
        // (the ALB may land the retry on a less-busy one) instead of a dead end.
        if (store.size() >= cfg.maxSessions) {
          return json(res, 503, { error: 'busy', message: 'All lab seats on this server are taken right now. A seat usually frees up within a few minutes.' }, { 'Retry-After': '15' });
        }
        if (cfg.maxPerIp && store.countByIp(ip) >= cfg.maxPerIp) {
          return json(res, 429, { error: 'too-many', message: 'You already have labs open. Close your other lab tabs (or press End lab) and try again.' }, { 'Retry-After': '30' });
        }
        const uid = pool.acquire();
        if (uid === null) return json(res, 503, { error: 'busy', message: 'No free sandbox slot right now.' }, { 'Retry-After': '15' });
        const token = store.mint({ track: String(track), lab: String(lab) }, ip, uid);
        json(res, 200, { token });
      });
    }

    if (req.method === 'GET' && p === '/session/remaining') {
      const s = store.get(url.searchParams.get('token'));
      const remainingSec = !cfg.hardCapMs ? null : (s ? Math.max(0, Math.round((s.createdAt + cfg.hardCapMs - Date.now()) / 1000)) : 0);   // null = no time limit
      return json(res, 200, { remainingSec });
    }

    if (req.method === 'POST' && p === '/lab/check') {
      if (!guardOk(req, cfg, { needOrigin: true })) return json(res, 403, { pass: false });
      return readJson(req, res, async ({ token, stepId }) => {
        const session = store.get(token);
        if (!session) return json(res, 403, { pass: false });
        const lab = findLab(session.meta.track, session.meta.lab);
        const step = lab && lab.steps.find((s) => s.id === stepId && s.type === 'task');
        if (!step) return json(res, 404, { pass: false });
        if (!session.shellPid) return json(res, 200, { pass: false, message: 'Terminal is still connecting.' });
        const r = await sandbox.runCheck(step.checkFile, {
          home: session.home, uid: session.uid, shellPid: session.shellPid, historyFile: historyOf(token),
        });
        // Failed checks are counted per step, server-side: after ANSWER_AFTER misses the learner may ask for the answer.
        session.fails = session.fails || {};
        if (!r.pass) session.fails[step.id] = (session.fails[step.id] || 0) + 1;
        json(res, 200, { pass: r.pass, message: r.pass ? '' : r.message, fails: session.fails[step.id] || 0, answerAfter: ANSWER_AFTER });
      });
    }

    // The answer to a task: the commands in solutions/<step>.sh, released only after ANSWER_AFTER failed checks of that step.
    if (req.method === 'POST' && p === '/lab/answer') {
      if (!guardOk(req, cfg, { needOrigin: true })) return json(res, 403, { error: 'forbidden' });
      return readJson(req, res, ({ token, stepId }) => {
        const session = store.get(token);
        if (!session) return json(res, 403, { error: 'invalid session' });
        const lab = findLab(session.meta.track, session.meta.lab);
        const step = lab && lab.steps.find((s) => s.id === stepId && s.type === 'task');
        if (!step) return json(res, 404, { error: 'unknown step' });
        if (((session.fails || {})[step.id] || 0) < ANSWER_AFTER) return json(res, 403, { error: 'not-yet', answerAfter: ANSWER_AFTER });
        let lines = [];
        try { lines = fs.readFileSync(step.solutionFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')); } catch { /* unreadable */ }
        json(res, 200, { answer: lines });
      });
    }

    send(res, 404, 'text/html', page('Not found', pages.notFoundBody()));
  });

  const wss = new WebSocket.Server({
    server, path: '/ws', maxPayload: MAX_WS_MESSAGE_BYTES,
    verifyClient: ({ req }) => guardOk(req, cfg, { needOrigin: true }),
  });

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    const session = store.get(token);
    if (!session) return ws.close(4001, 'invalid or expired session');
    if (session.shellPid) return ws.close(4002, 'session already connected');   // one terminal per token
    const lab = findLab(session.meta.track, session.meta.lab);
    if (!lab) { store.expire(token); return ws.close(4004, 'lab not found'); }

    const { uid } = session;
    const home = homeOf(token);
    let shell;
    try {
      sandbox.prepareHome(home, uid);
      const setup = sandbox.runSetup(lab.dir, home, uid);
      if (setup.code !== 0) throw new Error('setup.sh failed:\n' + setup.out);
      sandbox.prepareHistory(historyOf(token), uid);
      // bash, not sh: on Debian sh is dash, which has no `ulimit -u` (and would fail silently).
      const [file, args] = sandbox.asUser(uid, home, 'bash', ['-c', bootstrap]);
      // The environment is deliberately minimal: the learner gets a shell, not this
      // process's config or secrets.
      shell = require('node-pty').spawn(file, args, {
        name: 'xterm-256color', cols: 80, rows: 24, cwd: home,
        env: { PATH: process.env.PATH, HOME: home, TERM: 'xterm-256color', LANG: 'C.UTF-8', GIT_TERMINAL_PROMPT: '0' },
      });
    } catch (e) {
      // A resource-exhausted host must not crash the process for every other visitor.
      console.error(`session ${idOf(token)} could not start:`, e.message);
      sandbox.removeTree(home);
      sandbox.removeTree(historyOf(token));
      store.expire(token);
      return ws.close(1011, 'could not start the lab sandbox');
    }
    store.markConnected(token, { shellPid: shell.pid, home });

    const hardTimer = cfg.hardCapMs > 0 ? setTimeout(() => ws.close(4000, 'session time limit reached'), cfg.hardCapMs) : null;
    let idleTimer = setTimeout(() => ws.close(4000, 'idle timeout'), cfg.idleMs);
    const resetIdle = () => {
      store.touch(token);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => ws.close(4000, 'idle timeout'), cfg.idleMs);
    };

    shell.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
    // `exit` / Ctrl-D ends the shell; without this the browser sits on a dead terminal holding a seat.
    shell.onExit(() => { if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'shell exited'); });
    // Without a listener an 'error' event (malformed/oversized frame) is an uncaught exception for everyone.
    ws.on('error', () => ws.terminate());

    ws.on('message', (data) => {
      resetIdle();
      const text = data.toString();
      if (text.startsWith('\u0000resize:')) {                  // out-of-band control frame (NUL-prefixed)
        const mm = text.slice(8).match(/^(\d{1,3}),(\d{1,3})$/);
        if (mm) { try { shell.resize(Math.min(300, Math.max(10, +mm[1])), Math.min(100, Math.max(5, +mm[2]))); } catch { /* gone */ } }
        return;
      }
      const lines = store.recordInput(token, text);
      if (lines.length) { try { fs.appendFileSync(historyOf(token), lines.join('\n') + '\n'); } catch { /* best effort */ } }
      shell.write(text);
    });

    ws.on('close', () => {
      clearTimeout(hardTimer);
      clearTimeout(idleTimer);
      killProcessSession('/proc', shell.pid);
      if (uid !== undefined) killProcessesOfUid('/proc', uid);    // also daemons that escaped via setsid
      try { shell.kill(); } catch { /* already exited */ }
      store.expire(token);
      sandbox.removeTree(home);
      sandbox.removeTree(historyOf(token));
    });
  });

  server.on('close', () => stats.stop());
  return { server, cfg, store, getCatalog };
}

if (require.main === module) {
  const { server, cfg } = createApp();
  server.listen(cfg.port, () => console.log(`Debo Labs listening on ${cfg.port}, profile=${cfg.profile}, seats=${cfg.maxSessions}/replica, labs=${cfg.labsDir}`));
}

// A serverless host loads this file and calls the export as a request handler (preview mode, no terminals);
// the helpers ride along as properties for tests and the other entry points.
let serverless;
function handler(req, res) {
  if (!serverless) serverless = createApp().server;
  serverless.emit('request', req, res);
}
module.exports = Object.assign(handler, { createApp, guardOk, hostOk, hostnameOf });
