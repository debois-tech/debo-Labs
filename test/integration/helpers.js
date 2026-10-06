// Shared plumbing for the integration tests: an isolated app instance per test,
// HTTP/WebSocket clients that behave like a browser (they send an Origin), and a
// "learner" that types one keystroke per WebSocket message, exactly like xterm.js.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { createApp } = require('../../src/server');

const LABS = path.join(__dirname, '..', '..', 'labs');
const TEST_TOKEN = 'test-invite';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Real isolation (a uid per session) only exists when running as root with LAB_UID, i.e. in the image.
const ISOLATED = typeof process.getuid === 'function' && process.getuid() === 0 && !!process.env.LAB_UID;

function start(opts = {}) {
  const base = process.env.SANDBOX_DIR || os.tmpdir();
  fs.mkdirSync(base, { recursive: true });
  const sandboxDir = fs.mkdtempSync(path.join(base, 'test-'));
  fs.chmodSync(sandboxDir, 0o755);
  // Hosted gated labs need an invite token; the helpers hold a valid one unless a test says otherwise.
  const app = createApp({ labsDir: LABS, sandboxDir, accessTokens: [TEST_TOKEN], ...opts });
  return new Promise((resolve) => app.server.listen(0, '127.0.0.1', () => {
    const port = app.server.address().port;
    resolve({ ...app, port, sandboxDir, origin: `http://127.0.0.1:${port}`, stop: () => app.server.close() });
  }));
}

function request(app, method, urlPath, { headers = {}, body, origin = true, host } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (origin === true && method !== 'GET') h.Origin = app.origin;
    else if (typeof origin === 'string') h.Origin = origin;
    if (host) h.Host = host;
    const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    if (data !== undefined) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const req = http.request({ host: '127.0.0.1', port: app.port, path: urlPath, method, headers: h }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
      });
    });
    req.on('error', reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

const get = (app, p, o) => request(app, 'GET', p, o);
const post = (app, p, body, o = {}) => request(app, 'POST', p, { ...o, body });
const mint = (app, track, lab, o = {}) => post(app, '/session', { track, lab }, { ...o, headers: { 'X-Lab-Token': TEST_TOKEN, ...o.headers } });
const check = (app, token, stepId) => post(app, '/lab/check', { token, stepId });

// Mint a session and open its terminal. Resolves once the shell prompt is up.
async function openLab(app, track, lab, { headers } = {}) {
  const m = await mint(app, track, lab, { headers });
  if (m.status !== 200) throw new Error(`could not mint a session: ${m.status} ${m.body}`);
  const { token } = m.json;
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws?token=${token}`, { headers: { Origin: app.origin } });
  let output = '';
  ws.on('message', (d) => { output += d; });
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  const type = async (text) => { for (const ch of text) { ws.send(ch); await sleep(4); } };
  const waitFor = async (re, ms = 6000) => {
    const t0 = Date.now();
    while (!re.test(output)) {
      if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${re}; saw: ${output.slice(-300)}`);
      await sleep(40);
    }
  };
  // Run a command and wait for its output to settle (a unique marker proves it finished).
  const run = async (cmd) => {
    const marker = `__done_${Math.random().toString(36).slice(2, 8)}__`;
    const before = output.length;
    await type(`${cmd}\recho ${marker}\r`);
    // The marker appears once in the echoed command line and once more as real output.
    const t0 = Date.now();
    while (output.slice(before).split(marker).length - 1 < 2) {
      if (Date.now() - t0 > 6000) throw new Error(`timeout running ${cmd}; saw: ${output.slice(before).slice(-300)}`);
      await sleep(40);
    }
    return output.slice(before);
  };
  await waitFor(/learner@lab/);
  return { token, ws, type, waitFor, run, output: () => output, id: token.slice(0, 8) };
}

module.exports = { start, request, get, post, mint, check, openLab, sleep, ISOLATED, LABS, WebSocket, TEST_TOKEN };
