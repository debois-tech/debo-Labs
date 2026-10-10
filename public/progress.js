// Progress lives only in this browser (localStorage): the set of finished labs.
(function () {
  var KEY = 'debo-local:done';
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  window.deboMarkDone = function (id) {
    try { var d = read(); if (d.indexOf(id) < 0) d.push(id); localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked */ }
  };
  function render() {
  var done = read();
  document.querySelectorAll('[data-lab]').forEach(function (el) {
    if (done.indexOf(el.getAttribute('data-lab')) >= 0) el.classList.add('is-done');
  });
  // a topic with several labs counts as done once every one of its labs is
  document.querySelectorAll('[data-labs]').forEach(function (el) {
    var keys = el.getAttribute('data-labs').split(',').filter(Boolean);
    if (keys.length && keys.every(function (k) { return done.indexOf(k) >= 0; })) el.classList.add('is-done');
  });
  document.querySelectorAll('[data-track-progress]').forEach(function (el) {
    var t = el.getAttribute('data-track-progress');
    var labs = el.getAttribute('data-labs').split(',').filter(Boolean);
    var n = labs.filter(function (l) { return done.indexOf(t + '/' + l) >= 0; }).length;
    el.textContent = n + ' of ' + labs.length + ' done';
    var card = el.closest('[data-track]');
    if (card) card.style.setProperty('--p', labs.length ? (n / labs.length) : 0);
  });
  }
  render();
  // auth.js merges the saved progress of a logged-in account into this browser's list, then asks for a repaint
  window.deboRenderProgress = render;
  window.deboLocalDone = read;
  window.deboWriteDone = function (d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked */ } };
})();
