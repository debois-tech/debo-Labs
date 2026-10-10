// The certificate page: draws the downloadable PNG (the same layout as the page) and wires the share buttons.
(function () {
  var el = document.getElementById('cert');
  if (!el) return;
  var d = el.dataset;
  var $ = function (id) { return document.getElementById(id); };
  var month = new Date(d.issued);

  // LinkedIn's "Add to profile" form, pre-filled with the credential id and its public link.
  $('cert-li').href = 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME'
    + '&name=' + encodeURIComponent(d.title + ' (Debo Labs)') + '&organizationName=' + encodeURIComponent('Debo Labs')
    + '&issueYear=' + month.getUTCFullYear() + '&issueMonth=' + (month.getUTCMonth() + 1)
    + '&certUrl=' + encodeURIComponent(d.url) + '&certId=' + encodeURIComponent(d.id);

  function copy(text, btn, label) {
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = label; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
    else window.prompt('Copy this:', text);
  }
  $('cert-copy').onclick = function () { copy(d.url, this, 'Copy link'); };
  $('cert-post').onclick = function () {
    copy('I just earned a verified credential: "' + d.title + '" on Debo Labs. Every task was graded on the real state of a Linux terminal, not multiple choice.\n\nCredential ID: ' + d.id + '\nVerify it: ' + d.url + '\n\n#DevOps #Cloud #Linux #HandsOnLearning #DeboLabs', this, 'Copy post text');
  };

  function load(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  $('cert-dl').onclick = function () {
    Promise.all([load('/logo/debo-labs-mark.png'), load('/logo/deboistech-logo.png'), load('/logo/debo-labs-mark-white.png')]).then(function (im) { draw(im[0], im[1], im[2]); });
  };

  function draw(mark, logo, whiteMark) {
    var W = 1600, H = Math.round(W / 1.414), cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), L = Math.round(W * .64);
    var sans = 'Inter, "Helvetica Neue", Arial, sans-serif', disp = 'Sora, Inter, "Helvetica Neue", Arial, sans-serif', mono = '"JetBrains Mono", Menlo, Consolas, monospace';
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    var grad = g.createLinearGradient(L, 0, W, H); grad.addColorStop(0, '#0b8f6a'); grad.addColorStop(.55, '#0d9488'); grad.addColorStop(1, '#4d9a26');
    g.fillStyle = grad; g.fillRect(L, 0, W - L, H);
    function text(s, x, y, font, color, max, align) { g.font = font; g.fillStyle = color; g.textAlign = align || 'left'; g.fillText(s, x, y, max); g.textAlign = 'left'; }
    function wrap(s, x, y, font, color, max, lh) {
      g.font = font; g.fillStyle = color;
      var words = s.split(' '), line = '', yy = y;
      words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
      g.fillText(line, x, yy); return yy;
    }
    var pad = Math.round(W * .056), top = Math.round(W * .064), inner = L - pad - Math.round(W * .05);
    var bh = Math.round(W * .036);
    var mw1 = mark ? Math.round(bh * mark.width / mark.height) : 0;
    if (mark) g.drawImage(mark, pad, top, mw1, bh);
    text('Debo Labs', pad + mw1 + Math.round(W * .01), top + Math.round(bh * .78), '600 ' + Math.round(W * .024) + 'px ' + disp, '#0b1f17');
    var y = top + Math.round(W * .098);
    text('This Certificate Is Proudly Presented To', pad, y, '400 ' + Math.round(W * .019) + 'px ' + sans, '#1d2b25');
    var nameBottom = wrap(d.name, pad, y + Math.round(W * .06), '500 ' + Math.round(W * .041) + 'px ' + sans, '#08140f', inner, Math.round(W * .05));
    y = nameBottom + Math.round(W * .052);
    text('For Successfully Completing the Lab', pad, y, '400 ' + Math.round(W * .019) + 'px ' + sans, '#1d2b25');
    var titleBottom = wrap(d.title, pad, y + Math.round(W * .046), '500 ' + Math.round(W * .033) + 'px ' + sans, '#08140f', inner, Math.round(W * .042));
    text(d.date, pad, titleBottom + Math.round(W * .04), '400 ' + Math.round(W * .0155) + 'px ' + sans, '#1d2b25');
    text('ID: ' + d.id, pad, titleBottom + Math.round(W * .07), '400 ' + Math.round(W * .013) + 'px ' + mono, '#3b4a43');
    if (logo) { var lw = Math.round(W * .27), lh = Math.round(lw * logo.height / logo.width); g.drawImage(logo, pad, H - Math.round(W * .044) - lh, lw, lh); }

    var cx = L + (W - L) / 2;
    if (whiteMark) { var mw = Math.round(W * .12); g.globalAlpha = .95; g.drawImage(whiteMark, cx - mw / 2, top, mw, Math.round(mw * whiteMark.height / whiteMark.width)); g.globalAlpha = 1; }
    text('Debo Labs', cx, top + Math.round(W * .12), '600 ' + Math.round(W * .03) + 'px ' + disp, '#fff', W - L - 40, 'center');
    text('Lab Completion', cx, Math.round(H * .56), '400 ' + Math.round(W * .021) + 'px ' + sans, '#fff', W - L - 40, 'center');
    text('Certificate', cx, Math.round(H * .56) + Math.round(W * .029), '400 ' + Math.round(W * .021) + 'px ' + sans, '#fff', W - L - 40, 'center');
    // seal
    var sy = Math.round(H * .8), r = Math.round(W * .05);
    g.fillStyle = 'rgba(255,255,255,.4)';
    g.beginPath(); g.moveTo(cx - r * .55, sy + r * .6); g.lineTo(cx - r * .95, sy + r * 1.7); g.lineTo(cx - r * .3, sy + r * 1.35); g.lineTo(cx - r * .05, sy + r * .8); g.fill();
    g.beginPath(); g.moveTo(cx + r * .55, sy + r * .6); g.lineTo(cx + r * .95, sy + r * 1.7); g.lineTo(cx + r * .3, sy + r * 1.35); g.lineTo(cx + r * .05, sy + r * .8); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(cx, sy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.34)'; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, sy, r * .8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = Math.round(r * .16); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - r * .36, sy + r * .02); g.lineTo(cx - r * .08, sy + r * .3); g.lineTo(cx + r * .4, sy - r * .26); g.stroke();

    cv.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'debo-labs-certificate-' + d.id + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  }
})();
