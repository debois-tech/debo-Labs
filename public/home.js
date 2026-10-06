(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Fade sections in as they scroll into view.
  var els = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (n) { io.observe(n); });
  } else { els.forEach(function (n) { n.classList.add('in'); }); }

  // OS tabs.
  var tabs = $$('.tabs-os [role=tab]');
  function selectTab(t, focus) {
    tabs.forEach(function (b) {
      var on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      $('#' + b.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();            // only when the visitor drove it - focusing on load would scroll the page
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t, true); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length], true);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i + tabs.length - 1) % tabs.length], true);
    });
  });
  var plat = (navigator.userAgent || '') + (navigator.platform || '');   // start on the visitor's own OS
  var mine = /Win/i.test(plat) ? 'tab-windows' : /Mac/i.test(plat) ? 'tab-macos' : /Linux|X11/i.test(plat) ? 'tab-linux' : null;
  if (mine && $('#' + mine)) selectTab($('#' + mine), false);

  // Copy buttons.
  $$('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      function ok() { b.textContent = 'Copied'; b.classList.add('done'); setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('done'); }, 1800); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, ok);
      else { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); ok(); }
    });
  });
})();
