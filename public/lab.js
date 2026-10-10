(function () {
  var DATA = JSON.parse(document.getElementById('lab-data').textContent);
  var STEPS = DATA.steps;
  var current = 0;
  var done = {};
  var token = null;
  var ws = null;
  var $ = function (id) { return document.getElementById(id); };

  // --- terminal --------------------------------------------------------------
  var pill = $('status-pill');
  function setStatus(cls, label) { pill.className = 'pill ' + cls; pill.textContent = label; }
  var term = new Terminal({
    convertEol: true, fontSize: 14, lineHeight: 1.35, cursorBlink: true,
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
    theme: {
      background: '#030c09', foreground: '#d6ece2', cursor: '#34d399', cursorAccent: '#030c09',
      selectionBackground: 'rgba(16,185,129,0.35)',
      black: '#1a1a1a', red: '#f26d78', green: '#a6e22e', yellow: '#e6db74', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#d4d4d4',
      brightBlack: '#666666', brightRed: '#f26d78', brightGreen: '#a6e22e', brightYellow: '#e6db74', brightBlue: '#66d9ef', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f8f8f2',
    },
  });
  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open($('term'));
  fit.fit();
  term.write(DATA.banner + '\r\n\r\n  \x1b[38;2;245;185;66mHappy Learning\x1b[0m\r\n\r\n');
  window.addEventListener('resize', function () { fit.fit(); sendSize(); });
  term.onData(function (d) { if (ws && ws.readyState === 1) ws.send(d); });
  function sendSize() { if (ws && ws.readyState === 1) ws.send('\u0000resize:' + term.cols + ',' + term.rows); }

  // --- session: the page shell takes no seat; we ask for one -------------------
  // Split hosting: the pages come from one host, the shells from another (DATA.backend). Empty = same host.
  var API = DATA.backend || '';
  var tries = 0;
  var INVITE_KEY = 'debo:invite';
  function savedInvite() { try { return localStorage.getItem(INVITE_KEY) || ''; } catch (e) { return ''; } }
  function saveInvite(v) { try { if (v) localStorage.setItem(INVITE_KEY, v); else localStorage.removeItem(INVITE_KEY); } catch (e) { /* storage blocked */ } }
  // Gated labs (hosted only) ask for an invite code before taking a seat.
  function askInvite(wrong) {
    setStatus('ended', 'invite');
    $('term').hidden = true;
    var f = $('invite');
    f.hidden = false;
    $('invite-msg').textContent = wrong ? 'That code was not accepted. Try again.' : 'This lab runs on a shared cluster, so it needs an invite code.';
    $('invite-code').value = '';
    $('invite-code').focus();
  }
  $('invite').addEventListener('submit', function (e) {
    e.preventDefault();
    saveInvite($('invite-code').value.trim());
    $('invite').hidden = true; $('term').hidden = false; fit.fit();
    startSession();
  });
  // Sandbox hosting: a Vercel function starts the lab server on demand and says where it is. Ask until it is ready.
  var sandboxTries = 0;
  function ensureBackend(done) {
    if (!DATA.sandbox) return done();
    if (sandboxTries === 0) term.write('\r\n\x1b[33mStarting the lab server (the first start takes up to a minute)...\x1b[0m\r\n');
    fetch('/api/backend', { method: 'POST', headers: { 'X-Lab-Token': savedInvite() } })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 401) { saveInvite(''); return askInvite(true); }
        if (r.status === 200 && r.body.ready) { API = r.body.url; sandboxTries = 0; setInterval(keepBackendAlive, 4 * 60 * 1000); return done(); }
        if (++sandboxTries > 60) return busy(r.body.message || 'The lab server did not start.');
        setTimeout(function () { ensureBackend(done); }, 2500);
      })
      .catch(function () { busy('Could not reach the server.'); });
  }
  function keepBackendAlive() {
    fetch('/api/backend', { method: 'POST', headers: { 'X-Lab-Token': savedInvite() } }).catch(function () { /* next tick */ });
  }
  function startSession() {
    if (DATA.gated && !savedInvite()) return askInvite(false);
    setStatus('', 'starting');
    if (DATA.sandbox && !API) return ensureBackend(startSession);
    var headers = { 'Content-Type': 'application/json' };
    if (savedInvite()) headers['X-Lab-Token'] = savedInvite();
    fetch(API + '/session', { method: 'POST', headers: headers, body: JSON.stringify({ track: DATA.track, lab: DATA.lab }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 200) { token = r.body.token; connect(); pollTimer(); setInterval(pollTimer, 5000); return; }
        if (r.status === 501) { setStatus('ended', 'preview'); term.write('\r\n\x1b[33m' + (r.body.message || 'Live terminals are not available on this host.') + '\x1b[0m\r\n'); return; }
        if (r.status === 401 && r.body.error === 'login-required') { location.href = '/login?next=' + encodeURIComponent(location.pathname); return; }
        if (r.status === 401) { var sent = !!savedInvite(); saveInvite(''); return askInvite(sent); }
        busy(r.body.message || 'No seat is free right now.');
      })
      .catch(function () { busy('Could not reach the server.'); });
  }
  function busy(message) {
    setStatus('ended', 'waiting');
    tries++;
    if (tries > 20) { term.write('\r\n\x1b[33m' + message + ' Reload the page to try again.\x1b[0m\r\n'); return; }
    term.write('\r\n\x1b[33m' + message + ' Retrying in a few seconds…\x1b[0m');
    setTimeout(startSession, 8000 + Math.random() * 7000);
  }
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsHost = API ? new URL(API).host : location.host;
    if (API) proto = new URL(API).protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + wsHost + '/ws?token=' + token);
    ws.onopen = function () { softStart = softStart || Date.now(); setStatus('live', 'live'); sendSize(); term.focus(); render(); };
    ws.onmessage = function (ev) { term.write(ev.data); };
    ws.onclose = function (ev) { setStatus('ended', 'ended'); term.write('\r\n[session ended: ' + (ev.reason || ev.code) + ']\r\n'); };
    ws.onerror = function () { setStatus('ended', 'error'); };
  }

  // --- steps -------------------------------------------------------------------
  // Progress is a thin route: one tick per step, the marker parked at the current one.
  function renderDots() {
    var ticks = $('jticks'), n = STEPS.length;
    ticks.innerHTML = '';
    STEPS.forEach(function (st, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jt' + (i === current ? ' is-active' : '') + (done[st.id] ? ' is-done' : '');
      b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + st.title + (done[st.id] ? ' (done)' : ''));
      if (i === current) b.setAttribute('aria-current', 'step');
      b.onclick = function () { current = i; render(); };
      ticks.appendChild(b);
    });
    $('journey').style.setProperty('--p', (n > 1 ? (current / (n - 1)) * 100 : 0) + '%');
  }
  function allDone() { return STEPS.every(function (s) { return done[s.id]; }); }

  function render() {
    var s = STEPS[current];
    var last = current === STEPS.length - 1;
    $('step-counter').textContent = 'Step ' + (current + 1) + ' of ' + STEPS.length + ' · ' + (s.type === 'task' ? 'task' : 'lesson');
    $('step-title').textContent = s.title;
    $('step-body').innerHTML = s.bodyHtml;          // server-rendered from escaped markdown
    setHint('', false);
    showAnswerUi(s);
    var btn = $('action-btn');
    btn.disabled = false;
    btn.style.display = '';
    if (done[s.id] && last) {
      btn.textContent = allDone() ? 'Finish' : 'Review skipped steps';
      btn.onclick = allDone() ? finish : function () { current = STEPS.findIndex(function (x) { return !done[x.id]; }); render(); };
    } else if (done[s.id]) { btn.textContent = 'Next →'; btn.onclick = next; }
    else if (s.type === 'lesson') { btn.textContent = 'Got it'; btn.onclick = function () { done[s.id] = true; if (last) render(); else { current++; render(); } }; }
    else { btn.textContent = 'Check'; btn.onclick = check; }
    $('back-btn').style.visibility = current === 0 ? 'hidden' : 'visible';
    $('skip-btn').style.visibility = last ? 'hidden' : 'visible';
    renderDots();
  }
  function next() { if (current < STEPS.length - 1) { current++; render(); } }
  $('back-btn').onclick = function () { if (current > 0) { current--; render(); } };
  $('skip-btn').onclick = next;

  // One live region for feedback: amber nudge when a check fails, green confirmation when it passes.
  function setHint(text, ok) { var h = $('step-hint'); h.textContent = text; h.classList.toggle('is-ok', !!ok); }

  function check() {
    var s = STEPS[current];
    var btn = $('action-btn');
    if (!token) { setHint('The terminal is still starting — try again in a moment.', false); return; }
    btn.textContent = 'Checking…'; btn.disabled = true;
    fetch(API + '/lab/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, stepId: s.id }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false;
        if (d.pass) { done[s.id] = true; render(); setHint(s.success || 'Correct. Step complete.', true); return; }
        btn.textContent = 'Not yet — try again';
        setHint(d.message || s.hint || '', false);
        fails[s.id] = d.fails || 0;
        answerAfter = d.answerAfter || answerAfter;
        showAnswerUi(s);
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'Error — retry'; });
  }

  // After a few misses on one task the learner may reveal its answer (the server decides; it counts the failed checks).
  var fails = {}, answers = {}, answerAfter = 3;
  function showAnswerUi(s) {
    var btn = $('answer-btn'), box = $('step-answer');
    var eligible = s.type === 'task' && !done[s.id] && (fails[s.id] || 0) >= answerAfter;
    btn.hidden = !eligible || !!answers[s.id];
    box.hidden = !(eligible && answers[s.id]);
    if (!box.hidden) $('answer-code').textContent = answers[s.id].join('\n');
  }
  $('answer-btn').onclick = function () {
    var s = STEPS[current];
    fetch(API + '/lab/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token, stepId: s.id }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.answer) { answers[s.id] = d.answer; showAnswerUi(s); } else setHint('The answer is not available yet — keep trying.', false); })
      .catch(function () { setHint('Could not fetch the answer. Try again.', false); });
  };

  function finish() {
    window.deboMarkDone(DATA.track + '/' + DATA.lab);
    var tasks = STEPS.filter(function (st) { return st.task; });
    var html = '<p class="done-mark">Congratulations!</p><p class="done-lede">You completed <strong>' + esc(DATA.title) + '</strong>.</p>' +
      '<p class="done-sub">' + tasks.length + (tasks.length === 1 ? ' task' : ' tasks') + ' solved, each one checked against the real state of your terminal:</p>' +
      '<ul class="done-list">' + tasks.map(function (t) { return '<li>' + esc(t.title) + '</li>'; }).join('') + '</ul>' +
      '<p class="done-sub">' + (DATA.next ? 'Ready for the next one?' : 'That was the last lab in this track — nicely done.') + '</p>';
    html += '<div id="cert-slot"></div>' + shareHtml(tasks.length);
    if (DATA.resources.length) {
      html += '<ul class="resource-list">' + DATA.resources.map(function (r) {
        return '<li><a href="' + r.url + '" target="_blank" rel="noopener noreferrer">' + esc(r.title) + '</a><span>' + esc(r.desc) + '</span></li>';
      }).join('') + '</ul>';
    }
    html += '<div class="done-actions">' +
      (DATA.next ? '<a class="btn-primary" href="' + DATA.next.href + '">Next: ' + esc(DATA.next.title) + ' <span aria-hidden="true">&rarr;</span></a>' : '') +
      '<a class="btn-quiet" href="' + DATA.trackUrl + '">Back to the track</a></div>';
    STEPS.forEach(function (st) { done[st.id] = true; });
    current = STEPS.length - 1; renderDots();
    $('journey').style.setProperty('--p', '100%');
    $('journey').classList.add('launch');                 // the marker leaves
    $('step-counter').textContent = 'Complete';
    $('step-title').style.display = 'none';
    $('step-body').innerHTML = html;
    setHint('', false);
    $('action-btn').style.display = 'none';
    $('skip-btn').style.visibility = 'hidden';
    $('back-btn').style.visibility = 'hidden';
    wireShare(tasks.length);
    requestCertificate();
  }

  // A signed-in learner earns a verifiable certificate: the server checks that this very session passed every task, then issues the credential.
  function requestCertificate() {
    var slot = $('cert-slot');
    if (!slot || !window.deboUser || !token) return;
    slot.innerHTML = '<p class="done-sub">Issuing your certificate…</p>';
    fetch(API + '/certificate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (r) {
        if (r.status === 200) {
          slot.innerHTML = '<div class="cert-earned"><span class="answer-label">Your certificate</span><div class="cert-earned-id">' + esc(r.body.id) + '</div>' +
            '<a class="btn primary" href="' + esc(r.body.url) + '">View &amp; download certificate</a></div>';
          var generic = document.querySelector('.share'); if (generic) generic.style.display = 'none';
        } else slot.innerHTML = '<p class="done-sub">' + esc(r.body.message || 'A certificate could not be issued for this session. It needs the terminal session that completed the tasks.') + '</p>';
      })
      .catch(function () { slot.innerHTML = '<p class="done-sub">Could not reach the server to issue the certificate.</p>'; });
  }

  // --- share: a card to screenshot or download, and post text for LinkedIn -------------------------------------------
  var TAGS = { 'linux-fundamentals': '#Linux #DevOps #SysAdmin', 'git-basics': '#Git #DevOps #VersionControl', aws: '#AWS #Cloud #DevOps', 'aws-cloud-practitioner': '#AWS #CloudPractitioner #Cloud', docker: '#Docker #Containers #DevOps', networking: '#Networking #DevOps #Linux', 'github-actions': '#GitHubActions #CICD #DevOps' };
  function who() { return (window.deboUser && (window.deboUser.name || window.deboUser.email)) || ''; }
  function today() { return new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }); }
  function shareUrl() { return location.origin + '/t/' + DATA.track; }
  function postText(n) {
    return 'I just completed "' + DATA.title + '" on Debo Labs: ' + n + (n === 1 ? ' hands-on task' : ' hands-on tasks') + ' in a real Linux terminal, each one graded on the actual state of the machine, not on multiple choice.\n\n' +
      'Learning by doing beats watching tutorials. Try it: ' + shareUrl() + '\n\n' + (TAGS[DATA.track] || '#DevOps #Cloud #Linux') + ' #HandsOnLearning #DeboLabs';
  }
  function shareHtml(n) {
    return '<div class="share"><div class="share-card" id="share-card"><div class="sc-top"><img src="/logo/debo-labs-mark.png" alt="" /><span>Debo <b>Labs</b></span></div>' +
      '<div class="sc-kicker">Lab completed</div><div class="sc-title">' + esc(DATA.title) + '</div>' +
      '<div class="sc-meta">' + n + (n === 1 ? ' task' : ' tasks') + ' solved &middot; graded on real terminal state</div>' +
      '<div class="sc-foot"><span class="sc-name" id="sc-name"></span><span>' + esc(today()) + '</span></div></div>' +
      '<div class="share-actions"><button class="btn primary" id="share-dl" type="button">Download image</button>' +
      '<button class="btn" id="share-copy" type="button">Copy LinkedIn post</button>' +
      '<a class="btn" id="share-li" target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl()) + '">Share on LinkedIn</a></div>' +
      '<p class="share-note">Download the image (or take a screenshot of the card), attach it to your post, and paste the copied text.</p></div>';
  }
  function wireShare(n) {
    var nm = $('sc-name'); if (nm) nm.textContent = who();
    $('share-copy').onclick = function () {
      var t = postText(n), b = $('share-copy');
      var ok = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy LinkedIn post'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { window.prompt('Copy this text:', t); });
      else window.prompt('Copy this text:', t);
    };
    $('share-dl').onclick = function () { drawCard(n); };
  }
  function drawCard(n) {
    var W = 1200, H = 627, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#04100c'); bg.addColorStop(1, '#0a2a1e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W * .85, 0, 0, W * .85, 0, 620); glow.addColorStop(0, 'rgba(16,185,129,.28)'); glow.addColorStop(1, 'rgba(16,185,129,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,255,210,.22)'; g.lineWidth = 2; g.strokeRect(40, 40, W - 80, H - 80);
    function text(s, x, y, font, color, max) { g.font = font; g.fillStyle = color; g.fillText(s, x, y, max); }
    function wrap(s, x, y, font, color, max, lh) {
      g.font = font; g.fillStyle = color;
      var words = s.split(' '), line = '', yy = y;
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
      g.fillText(line, x, yy); return yy;
    }
    var sans = 'Inter, "Helvetica Neue", Arial, sans-serif', disp = 'Sora, Inter, "Helvetica Neue", Arial, sans-serif';
    var finish = function (logo) {
      var lw = logo ? Math.round(56 * logo.width / logo.height) : 0;
      if (logo) g.drawImage(logo, 80, 76, lw, 56);
      text('Debo Labs', logo ? 80 + lw + 16 : 80, 116, '600 34px ' + disp, '#e9f5ef');
      text('LAB COMPLETED', 80, 250, '600 24px ' + sans, '#34d399');
      var last = wrap(DATA.title, 80, 322, '700 58px ' + disp, '#ffffff', W - 160, 70);
      text(n + (n === 1 ? ' task' : ' tasks') + ' solved  \u00b7  graded on real terminal state', 80, last + 64, '400 28px ' + sans, '#8fa89c');
      var grad = g.createLinearGradient(80, 0, 520, 0); grad.addColorStop(0, '#34d399'); grad.addColorStop(.55, '#2dd4bf'); grad.addColorStop(1, '#a3e635');
      g.fillStyle = grad; g.fillRect(80, 470, 440, 5);
      if (who()) text(who(), 80, 540, '600 32px ' + sans, '#e9f5ef', 600);
      g.textAlign = 'right'; text(today(), W - 80, 540, '400 26px ' + sans, '#8fa89c'); g.textAlign = 'left';
      cv.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'debo-labs-' + DATA.lab + '.png';
        document.body.appendChild(a); a.click(); a.remove();
      }, 'image/png');
    };
    var img = new Image();
    img.onload = function () { finish(img); };
    img.onerror = function () { finish(null); };
    img.src = '/logo/debo-labs-mark.png';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // --- chrome ------------------------------------------------------------------
  function endLab() { try { if (ws) ws.close(1000, 'ended by learner'); } catch (e) { /* closed */ } location.href = DATA.trackUrl; }
  $('end-btn').onclick = endLab;
  $('fs-btn').onclick = function () {
    var el = document.querySelector('.terminal-pane');
    if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen();
  };
  window.addEventListener('beforeunload', function () { try { if (ws) ws.close(1000, 'page closed'); } catch (e) { /* closed */ } });

  // Soft timer: counts down the lab's suggested time plus a buffer, from the moment the terminal connects. It never ends the session;
  // past zero it shows how long you are over.
  var softStart = null, softTick = null;
  function fmtClock(sec) { return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  function startSoftTimer() {
    if (softTick) return;
    softStart = softStart || Date.now();
    var el = $('lab-timer'), txt = $('lab-timer-text');
    var buffer = Math.max(5, Math.ceil(DATA.minutes * 0.5));
    var total = (DATA.minutes + buffer) * 60;
    el.title = 'Suggested time for this lab: ' + DATA.minutes + ' min plus a ' + buffer + ' min buffer. Nothing ends when it runs out.';
    function tick() {
      var left = total - Math.floor((Date.now() - softStart) / 1000);
      el.style.display = '';
      if (left >= 0) { txt.textContent = fmtClock(left); el.classList.toggle('is-low', left < 120); }
      else { txt.textContent = '+' + fmtClock(-left) + ' over'; el.classList.add('is-low'); }
    }
    tick();
    softTick = setInterval(tick, 1000);
  }

  function pollTimer() {
    if (!token) return;
    fetch(API + '/session/remaining?token=' + token).then(function (r) { return r.json(); }).then(function (d) {
      var t = d.remainingSec, el = $('lab-timer');
      if (t === null) { startSoftTimer(); return; }          // no session limit on this server: show the soft, suggested-time countdown instead
      $('lab-timer-text').textContent = t <= 0 ? '00:00' : String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
      el.classList.toggle('is-low', t > 0 && t < 120);
    }).catch(function () { /* transient */ });
  }
  function pollStats() {
    fetch(API + '/stats').then(function (r) { return r.json(); }).then(function (s) {
      $('stat-cpu').textContent = s.cpuPercent === null ? 'n/a' : s.cpuPercent + '%';
      $('stat-cpu-bar').style.width = (s.cpuPercent === null ? 0 : Math.min(100, s.cpuPercent)) + '%';
      $('stat-mem').textContent = s.memUsedMb + ' / ' + s.memLimitMb + ' MB';
      $('stat-mem-bar').style.width = Math.min(100, (s.memUsedMb / s.memLimitMb) * 100) + '%';
      $('stat-uptime').textContent = s.uptimeSec + 's';
    }).catch(function () { /* transient */ });
  }

  render();
  startSession();
  pollStats();
  setInterval(pollStats, 2000);
})();
