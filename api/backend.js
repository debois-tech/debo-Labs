// Vercel function: makes sure the lab server is running inside a Vercel Sandbox (a Linux microVM with root, started
// from our own image) and tells the lab page where it is. The page calls this with the invite code, repeatedly,
// until it answers ready; it keeps calling it every few minutes while a lab is open, which extends the sandbox's life.
//
// Needs, on the Vercel project:  LAB_ACCESS_TOKENS (invite codes)  LAB_ALLOWED_ORIGINS (page origins)  LAB_SANDBOX=1
// Optional: LAB_SANDBOX_IMAGE (default debo-labs-server:latest)  LAB_SANDBOX_VCPUS (default 4)  LAB_SANDBOX_MINUTES (default 40)
//           LAB_MAX_SESSIONS (default 32)
const crypto = require('crypto');

const NAME = 'debo-labs-server';
const PORT = 8080;
const MINUTE = 60 * 1000;

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const posInt = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
function tokenOk(given, tokens) {
  const g = digest(given || '');
  return tokens.reduce((ok, t) => crypto.timingSafeEqual(g, digest(t)) || ok, false);
}

async function healthy(url) {
  try { return (await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(2500) })).ok; } catch { return false; }
}

function createHandler({ loadSdk = () => import('@vercel/sandbox'), env = process.env } = {}) {
  return async function handler(req, res) {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return send(405, { error: 'method' });
    // Same origin only (a browser always sends Origin on POST), and a valid invite code: this call can start paid compute.
    let sameOrigin = false;
    try { sameOrigin = !!req.headers.origin && new URL(req.headers.origin).host === req.headers.host; } catch { /* bad Origin */ }
    if (!sameOrigin) return send(403, { error: 'forbidden' });
    const tokens = list(env.LAB_ACCESS_TOKENS);
    if (!tokens.length || !tokenOk(req.headers['x-lab-token'], tokens)) return send(401, { error: 'token-required' });

    try {
      const { Sandbox } = await loadSdk();
      const sandbox = await Sandbox.getOrCreate({
        name: NAME,
        image: env.LAB_SANDBOX_IMAGE || 'debo-labs-server:latest',
        ports: [PORT],
        resources: { vcpus: posInt(env.LAB_SANDBOX_VCPUS, 4) },
        timeout: posInt(env.LAB_SANDBOX_MINUTES, 40) * MINUTE,
        resume: true,
      });
      const url = sandbox.domain(PORT);

      if (!(await healthy(url))) {
        // Not answering: start the server (once; a resumed or new sandbox has no process running), and let the page ask again.
        const running = await sandbox.runCommand({ cmd: 'pgrep', args: ['-f', 'node src/server.js'] });
        if (running.exitCode !== 0) {
          await sandbox.runCommand({
            cmd: '/usr/bin/tini', args: ['--', 'node', 'src/server.js'], cwd: '/app', sudo: true, detached: true,
            env: {
              PORT: String(PORT), SANDBOX_DIR: '/sandbox', LAB_UID: '10000',
              LAB_ACCESS_TOKENS: env.LAB_ACCESS_TOKENS, LAB_ALLOWED_ORIGINS: env.LAB_ALLOWED_ORIGINS || '',
              MAX_SESSIONS: String(posInt(env.LAB_MAX_SESSIONS, 32)),
              MAX_SESSIONS_PER_IP: '40',            // a campus NAT puts a whole class behind one address
            },
          });
        }
        return send(200, { ready: false });
      }

      // Keep it alive while people are using it; when nobody calls any more, it expires by itself and stops billing.
      const left = sandbox.expiresAt ? new Date(sandbox.expiresAt).getTime() - Date.now() : 0;
      if (left < 10 * MINUTE) { try { await sandbox.extendTimeout(15 * MINUTE); } catch { /* at the plan's session limit */ } }
      return send(200, { ready: true, url });
    } catch (e) {
      console.error('lab server sandbox:', e && e.message);
      return send(502, { error: 'sandbox-unavailable', message: 'Could not start the lab server. Try again in a minute.' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
