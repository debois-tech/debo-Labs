// One server, two profiles. `hosted` is the default so the live Elastic Beanstalk
// environment (which sets no app env vars) keeps working unchanged; the local
// docker-compose file sets LAB_PROFILE=local.
//   local  - a learner's own machine: loopback-only, relaxed limits, offline fonts
//   hosted - the public deployment: per-IP seat limits, tight timeouts, same-origin guard
function intEnv(env, names, fallback) {
  for (const name of [].concat(names)) {
    const n = parseInt(env[name], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

// "https://labs.example.com/anything" -> "https://labs.example.com"; anything that is not an http(s) URL -> ''.
function originOf(u) {
  try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch { return ''; }
}

function loadConfig(env = process.env) {
  // LAB_MODE / EB_MODE are the old names; only the value 'local' ever mattered.
  const raw = env.LAB_PROFILE || env.LAB_MODE || env.EB_MODE || 'hosted';
  const profile = raw === 'local' ? 'local' : 'hosted';
  const isLocal = profile === 'local';
  const terminal = env.LAB_TERMINAL !== 'off' && !env.VERCEL;
  const backendUrl = originOf(env.LAB_BACKEND_URL || '');
  const uidBase = env.LAB_UID ? parseInt(env.LAB_UID, 10) : undefined;
  return {
    profile,
    isLocal,
    // Preview mode: the pages render but no shells start (serverless hosts cannot run a pty or keep a WebSocket open).
    terminal,
    // Split hosting: pages on one host (serverless), shells on another (a Docker server).
    //   LAB_BACKEND_URL      on the pages host: where the lab page sends /session, /ws and /lab/check.
    //   LAB_ALLOWED_ORIGINS  on the lab server: comma-separated page origins allowed to call it (hosted profile only).
    backendUrl,
    allowedOrigins: isLocal ? [] : String(env.LAB_ALLOWED_ORIGINS || '').split(',').map(originOf).filter(Boolean),
    port: env.PORT || 8080,
    labsDir: env.LABS_DIR || require('path').join(__dirname, '..', 'labs'),
    sandboxDir: env.SANDBOX_DIR || require('path').join(require('os').tmpdir(), 'debo-labs-sandbox'),
    watch: env.LABS_WATCH === '1',
    // Seats are per replica. Autoscaling is CPU-driven and idle shells use almost
    // no CPU, so extra visitors do not add replicas on their own: total seats =
    // replicas x maxSessions (raise min-replica before an announcement).
    maxSessions: intEnv(env, ['MAX_SESSIONS', 'MAX_CONCURRENT_SESSIONS'], isLocal ? 3 : 5),
    // Per client IP, counting minted-but-unconnected tokens. Kept above 1 because a
    // classroom/campus NAT puts many real learners behind one address. 0 = unlimited.
    maxPerIp: isLocal ? 0 : intEnv(env, 'MAX_SESSIONS_PER_IP', 3),
    idleMs: intEnv(env, 'LAB_IDLE_MIN', isLocal ? 30 : 5) * 60 * 1000,
    hardCapMs: intEnv(env, 'LAB_HARD_CAP_MIN', isLocal ? 120 : 15) * 60 * 1000,
    // The page connects its terminal right after minting; a token that never does
    // must not hold a seat for long.
    connectDeadlineMs: 15 * 1000,
    // -v caps each process's address space so `tail /dev/zero` cannot OOM the pod.
    // LAB_ULIMIT_V_KB=0 disables it (needed when the image runs under x86 emulation, which maps huge address ranges).
    ulimitVKb: env.LAB_ULIMIT_V_KB !== undefined ? parseInt(env.LAB_ULIMIT_V_KB, 10) || 0 : (isLocal ? 1048576 : 262144),
    // Every learner shell gets its own unprivileged uid (uidBase + slot) so one
    // learner cannot read, signal or starve another. Undefined = not root / no drop.
    uidBase,
    trustProxy: !isLocal,          // behind the ALB the rightmost X-Forwarded-For is the client
    chip: isLocal ? 'local' : (!terminal ? (backendUrl ? 'online' : 'preview') : 'cluster'),
    remoteFonts: !isLocal,         // the local app renders fully offline
    // Invite tokens: on the hosted profile every lab needs one (the local app never asks).
    // Comma-separated so a cohort's token can be revoked without touching the others.
    accessTokens: isLocal ? [] : String(env.LAB_ACCESS_TOKENS || env.LAB_ACCESS_TOKEN || '').split(',').map((s) => s.trim()).filter(Boolean),
    ownerNote: isLocal ? 'this container' : (!terminal ? (backendUrl ? 'shared lab server' : 'preview') : 'this replica only'),
  };
}

module.exports = { loadConfig };
