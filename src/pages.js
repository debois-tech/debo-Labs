// Page bodies for the app. The shared chrome (header, frame) comes from ui.page().
const { esc, SITE_URL, mark } = require('./ui');
const { ASCII_BANNER } = require('./banner');

const mins = (ms) => Math.round(ms / 60000);
const REPO_URL = 'https://github.com/debois-tech/debo-Labs';

function loginBody() {
  return `<main class="wrap auth-wrap"><span class="eyebrow">Your account</span><h1 class="page-title">Log in or create an account.</h1>
    <p class="lede">An account saves your progress across devices and lets you start labs on this server.</p>
    <div class="auth-tabs" role="tablist"><button type="button" role="tab" id="tab-login" aria-selected="true">Log in</button><button type="button" role="tab" id="tab-signup" aria-selected="false">Create account</button></div>
    <form id="auth-form" class="auth-form" novalidate>
      <label id="name-row" hidden>Name <span class="faint">(optional)</span><input name="name" autocomplete="name" maxlength="60" /></label>
      <label>Email<input name="email" type="email" autocomplete="email" required /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required /></label>
      <p class="auth-error" id="auth-error" role="alert"></p>
      <button class="btn-primary" type="submit"><span id="auth-submit">Log in</span> <span aria-hidden="true">&rarr;</span></button>
    </form></main>`;
}

function notFoundBody() {
  return `<div class="wrap"><span class="eyebrow">404</span><h1 class="page-title">Page not found.</h1>
    <p class="lede">That page doesn&rsquo;t exist, or the lab has moved.</p><p style="margin-top:28px"><a class="btn-primary" href="/">Back to the labs <span aria-hidden="true">&rarr;</span></a></p></div>`;
}

const RUN_STEPS = [`git clone ${REPO_URL}`, 'cd debo-Labs', './start_local_labs.sh'];
const OS_TABS = [
  { id: 'windows', label: 'Windows', note: 'Needs <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer">Docker Desktop</a> (WSL2) and Git for Windows. Run in Git Bash (or any WSL terminal).' },
  { id: 'macos', label: 'macOS', note: 'Needs <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer">Docker Desktop</a>. Run in Terminal.' },
  { id: 'linux', label: 'Linux', note: 'Needs Docker Engine with the Compose plugin. Run in any terminal.' },
];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const trackMeta = (t) => `${plural(t.labs.length, 'lab')} \u00b7 ${t.labs.reduce((m, l) => m + l.minutes, 0)} min`;

// Hero illustration: a small terminal showing what a graded lab feels like.
const TERMINAL_DEMO = `<div class="term-demo" role="img" aria-label="A terminal: the learner makes a script executable, runs it, and the check passes">
  <div class="td-bar"><i></i><i></i><i></i><span>learner@lab: ~</span></div>
  <pre><span class="p">$</span> ls -l deploy.sh
<span class="d">-rw-r--r-- 1 learner learner 64 deploy.sh</span>
<span class="p">$</span> chmod +x deploy.sh
<span class="p">$</span> ./deploy.sh
<span class="d">deploying to staging&hellip; done</span>
<span class="ok">&#10003; Check passed</span> <span class="d">&middot; deploy.sh is executable</span></pre>
</div>`;

function homeBody(catalog, cfg) {
  const warn = catalog.problems.length
    ? `<div class="warn"><strong>${catalog.problems.length} content problem(s)</strong><ul>${catalog.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '';
  const first = catalog.tracks.find((t) => t.labs.length);
  const startHref = first ? `/lab/${first.id}/${first.labs[0].id}` : '/';

  const cards = catalog.tracks.map((t, i) => `
      <a class="tcard reveal" href="/t/${t.id}" data-track="${t.id}">
        <span class="tnum">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(t.title)}</h3><p>${esc(t.description)}</p>
        <span class="tmeta">${trackMeta(t)}</span>
        <span class="tprog" data-track-progress="${t.id}" data-labs="${t.labs.map((l) => l.id).join(',')}"></span>
      </a>`).join('');

  const tabs = OS_TABS.map((t, i) => `<button role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`).join('');
  const panels = OS_TABS.map((t, i) => `
        <div role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" ${i === 0 ? '' : 'hidden'}>
          <p class="run-note">${t.note}</p>
          <div class="codeblock"><pre><code>${RUN_STEPS.map((l) => `<span class="ln"><b>$</b> ${esc(l)}</span>`).join('')}</code></pre>
            <button class="copy" type="button" data-copy="${esc(RUN_STEPS.join('\n'))}">Copy</button></div>
        </div>`).join('');

  const note = cfg.isLocal
    ? `Running locally &middot; bound to localhost &middot; ${mins(cfg.idleMs)}-minute idle timeout`
    : `Hosted playground &middot; a private user per session &middot; ${mins(cfg.idleMs)}-minute idle timeout`;

  const body = `
<main class="home">
  <section class="hero">
    <div class="hero-copy">
      <span class="eyebrow">Debo Labs</span>
      <h1>Learn DevOps<br/><em>by doing.</em></h1>
      <p class="lede">Real terminals. Real feedback. Every lab is graded on what actually happened.</p>
      <div class="cta"><a class="btn-primary" href="${startHref}">Start the first lab <span aria-hidden="true">&rarr;</span></a><a class="btn-quiet" href="#labs">Browse the labs</a></div>
    </div>
    <div class="hero-art">${TERMINAL_DEMO}</div>
  </section>

  ${warn}

  <section class="section" id="labs" aria-labelledby="labsh">
    <div class="section-head reveal"><span class="eyebrow">The labs</span><h2 id="labsh">Pick a track.</h2></div>
    <div class="tgrid">${cards}</div>
  </section>

  <section class="section" aria-labelledby="how">
    <div class="section-head reveal"><span class="eyebrow">How it works</span><h2 id="how">Not a tutorial. A lab.</h2></div>
    <div class="steps">
      <div class="reveal"><span class="n">01</span><h3>A real terminal</h3><p>A genuine Linux shell, as its own user. Break things safely.</p><code>$ uname -sr</code></div>
      <div class="reveal"><span class="n">02</span><h3>Graded on real state</h3><p>Check inspects your sandbox. However you got there, the state is what counts.</p><code>[ -x deploy.sh ] &#10003;</code></div>
      <div class="reveal"><span class="n">03</span><h3>Your machine or ours</h3><p>The same labs offline in Docker, or hosted.</p><code>$ ./start_local_labs.sh</code></div>
    </div>
  </section>

  <section class="section run" id="run" aria-labelledby="runh">
    <div class="run-grid">
      <div class="reveal"><span class="eyebrow">Run it locally</span><h2 id="runh">On your own machine.</h2><p class="lede">Docker is all you need.</p></div>
      <div class="runbox reveal"><div class="tabs-os" role="tablist" aria-label="Operating system">${tabs}</div>${panels}
        <p class="run-after">Then open <a href="http://localhost:8082">localhost:8082</a>.</p></div>
    </div>
  </section>

  <section class="final reveal">
    <span class="mk-big">${mark()}</span>
    <h2>Open a terminal.</h2>
    <a class="btn-primary" href="${startHref}">Start the first lab <span aria-hidden="true">&rarr;</span></a>
    <p class="fine">${note}<br/>A <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer">deboistech</a> project &middot; <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">Source</a></p>
  </section>
</main>`;
  return {
    body,
    head: '<script>document.documentElement.classList.add("js")</script><link rel="stylesheet" href="/home.css" />',
    scripts: '<script src="/progress.js"></script><script src="/home.js"></script>',
  };
}

// The lab to suggest after finishing one: the next in its track, else the first lab of the next track.
function nextLab(catalog, trackId, labId) {
  const ti = catalog.tracks.findIndex((t) => t.id === trackId);
  const track = catalog.tracks[ti];
  if (!track) return null;
  const li = track.labs.findIndex((l) => l.id === labId);
  const sameTrack = track.labs[li + 1];
  if (sameTrack) return { href: `/lab/${track.id}/${sameTrack.id}`, title: sameTrack.title };
  const other = catalog.tracks[ti + 1];
  return other && other.labs[0] ? { href: `/lab/${other.id}/${other.labs[0].id}`, title: other.labs[0].title } : null;
}
const crumb = (parts) => `<p class="crumb">${parts.map(([label, href]) => (href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join('<i>/</i>')}</p>`;

function trackBody(track) {
  const items = track.labs.map((l) => `
      <li data-status="live"><a href="/lab/${track.id}/${l.id}" data-labs="${track.id}/${l.id}"><i class="stn-dot"></i>
        <b>${esc(l.title)}</b><small>${esc(l.summary)} &middot; ${l.minutes} min &middot; ${esc(l.level)}</small></a></li>`).join('');
  return `<div class="wrap track">${crumb([['Labs', '/'], [track.title, '']])}
    <h1 class="page-title">${esc(track.title)}</h1><p class="lede">${esc(track.description)}</p>
    <div class="track-meta"><span class="meta" data-track-progress="${track.id}" data-labs="${track.labs.map((l) => l.id).join(',')}"></span></div>
    <ol class="route labs">${items}</ol></div>`;
}

const STAT = (id, label) => `<div class="stat-cell"><div class="stat-label">${label}</div><div class="stat-value" id="stat-${id}">&mdash;</div>${id === 'uptime' ? '' : `<div class="stat-bar"><div class="stat-bar-fill" id="stat-${id}-bar"></div></div>`}</div>`;

// The lab page is a seatless shell: it embeds the steps and the client mints its
// own session with POST /session. Nothing about GET /lab/... takes a seat.
function labBody(lab, trackTitle, cfg, next) {
  const data = {
    track: lab.track, lab: lab.id, title: lab.title, trackUrl: '/t/' + lab.track,
    local: cfg.isLocal, gated: !cfg.isLocal && !(cfg.authEnabled && !cfg.accessTokens.length) && (cfg.terminal || !!cfg.backendUrl || cfg.sandbox), backend: cfg.backendUrl, sandbox: !!cfg.sandbox, banner: ASCII_BANNER,
    links: lab.links, resources: lab.resources, next,
    steps: lab.steps.map((s) => ({
      id: s.id, type: s.type, title: s.title, hint: s.hint, success: s.success,
      bodyHtml: (cfg.isLocal && s.localBodyHtml) || s.bodyHtml,
    })),
  };
  // JSON in a script tag: neutralise "<" so content can never close the tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const links = lab.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)}</a>`).join('');
  return {
    body: `
  <div class="lab-shell">
    <div class="tasks-pane">
      ${crumb([['Labs', '/'], [trackTitle, `/t/${lab.track}`]])}
      <div class="tasks-header"><h1 class="lab-title">${esc(lab.title)}</h1><div class="lab-timer" id="lab-timer" title="Time left in this session"><span id="lab-timer-text">--:--</span></div></div>
      <nav class="journey" id="journey" aria-label="Lab progress"><span class="jline"><i></i></span><span class="jticks" id="jticks"></span><span class="jmark" aria-hidden="true">${mark()}</span></nav>
      <div class="step-counter" id="step-counter"></div>
      <div class="step-card">
        <div class="step-title" id="step-title"></div>
        <div class="step-body" id="step-body"></div>
        <div class="step-hint" id="step-hint" role="status"></div>
        <div class="step-footer">
          <button class="btn link" id="back-btn">&larr; Back</button>
          <button class="btn link" id="skip-btn">Skip &rarr;</button>
          <span class="spacer"></span>
          <button class="btn primary" id="action-btn"></button>
        </div>
      </div>
      <button class="btn danger" id="end-btn">End lab</button>
    </div>
    <div class="terminal-pane">
      <div class="terminal-tab"><span id="status-pill" class="pill">starting</span> Terminal
        <span class="terminal-links">${links}<button class="fullscreen-btn" id="fs-btn" title="Fullscreen" aria-label="Fullscreen">&#x26F6;</button></span></div>
      <form class="invite" id="invite" hidden autocomplete="off">
        <label for="invite-code">Invite code</label>
        <p id="invite-msg">This lab runs on a shared cluster, so it needs an invite code.</p>
        <div class="invite-row"><input id="invite-code" type="password" spellcheck="false" autocapitalize="off" required /><button class="btn primary" type="submit">Start</button></div>
      </form>
      <div id="term"></div>
    </div>
  </div>
  <div class="stats-box" id="stats-box">${STAT('cpu', 'CPU')}${STAT('mem', 'Memory')}${STAT('uptime', 'Uptime')}<div class="stats-note-cell">${esc(cfg.ownerNote)}</div></div>`,
    scripts: `<link rel="stylesheet" href="/xterm/xterm.css" />
  <script id="lab-data" type="application/json">${json}</script>
  <script src="/xterm/xterm.js"></script><script src="/xterm/addon-fit.js"></script><script src="/progress.js"></script><script src="/lab.js"></script>`,
  };
}

module.exports = {
  loginBody, notFoundBody, homeBody, trackBody, labBody, nextLab };
