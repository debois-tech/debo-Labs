// Accounts: the header link, the /login page, and syncing finished labs with the server. Only loaded when the server runs with LAB_AUTH=on.
(function () {
  function api(path, body) {
    return fetch(path, body === undefined ? { credentials: 'same-origin' } : {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); });
  }
  var slot = document.getElementById('auth-slot');
  var next = new URLSearchParams(location.search).get('next');
  var safeNext = next && /^\/[a-zA-Z0-9\/_-]*$/.test(next) ? next : '/';

  // Progress: finished labs are kept per account. The browser's own list is merged in on login, and every new completion is posted.
  var mark = window.deboMarkDone;
  var loggedIn = false;
  window.deboMarkDone = function (id) {
    if (mark) mark(id);
    if (loggedIn) api('/progress', { labs: [id] });
  };
  function syncProgress() {
    api('/progress').then(function (r) {
      if (r.status !== 200 || !window.deboLocalDone) return;
      var local = window.deboLocalDone();
      var merged = r.body.done.slice();
      local.forEach(function (l) { if (merged.indexOf(l) < 0) merged.push(l); });
      window.deboWriteDone(merged);
      window.deboRenderProgress();
      if (merged.length > r.body.done.length) api('/progress', { labs: merged });
    });
  }

  api('/auth/me').then(function (r) {
    var user = r.body && r.body.user;
    loggedIn = !!user;
    if (slot) {
      if (user) {
        slot.innerHTML = '<span class="auth-who"></span><button type="button" class="auth-out">Log out</button>';
        slot.querySelector('.auth-who').textContent = user.name || user.email;
        slot.querySelector('.auth-out').onclick = function () { api('/auth/logout', {}).then(function () { location.href = '/'; }); };
      } else {
        slot.innerHTML = '<a class="auth-in" href="/login?next=' + encodeURIComponent(location.pathname) + '">Log in</a>';
      }
    }
    if (user) syncProgress();
    if (user && document.getElementById('auth-form')) location.replace(safeNext);
  });

  // The /login page: one form, two modes.
  var form = document.getElementById('auth-form');
  if (!form) return;
  var mode = 'login';
  var err = document.getElementById('auth-error');
  function setMode(m) {
    mode = m;
    document.getElementById('tab-login').setAttribute('aria-selected', String(m === 'login'));
    document.getElementById('tab-signup').setAttribute('aria-selected', String(m === 'signup'));
    document.getElementById('name-row').hidden = m !== 'signup';
    form.name.required = m === 'signup';
    document.getElementById('auth-submit').textContent = m === 'login' ? 'Log in' : 'Create account';
    form.password.setAttribute('autocomplete', m === 'login' ? 'current-password' : 'new-password');
    err.textContent = '';
  }
  document.getElementById('tab-login').onclick = function () { setMode('login'); };
  document.getElementById('tab-signup').onclick = function () { setMode('signup'); };
  if (location.hash === '#signup') setMode('signup');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    if (mode === 'signup' && !form.name.value.trim()) { err.textContent = 'Enter your name.'; form.name.focus(); return; }
    api('/auth/' + mode, { name: form.name.value, email: form.email.value, password: form.password.value }).then(function (r) {
      if (r.status === 200) { location.href = safeNext; return; }
      err.textContent = r.body.error || 'Something went wrong. Try again.';
    }).catch(function () { err.textContent = 'Could not reach the server.'; });
  });
})();
