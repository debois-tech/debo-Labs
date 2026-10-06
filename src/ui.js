// The Debo Labs shell: the header (logo, name, env chip, link to the main site), the page frame with the prompt-mark sprite and favicon,
// and the table of static assets. Every page is built through page(), so the chrome is identical everywhere.
const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SITE_URL = 'https://www.deboistech.in/';
const FONTS_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');\n";
const PUBLIC = path.join(__dirname, '..', 'public');

// The prompt mark: a chevron and a cursor bar, the glyph of a shell. Defined once per page and reused with <use href="#mark">;
// the colour comes from currentColor.
const MARK_PATHS = '<path d="M4 5.5 L11 12 L4 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M13.5 19 H21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><symbol id="mark" viewBox="0 0 24 24">${MARK_PATHS}</symbol></svg>`;
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#06130e"/><g transform="translate(2.4 2.4) scale(.8)">${MARK_PATHS.replace(/currentColor/g, '#34d399')}</g></svg>`);
const mark = (cls = '') => `<svg class="mk ${cls}" aria-hidden="true" focusable="false"><use href="#mark"/></svg>`;

const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/**
 * @param {object} o
 * @param {string} o.chip           env label in the header: 'local' | 'cluster'
 * @param {string} [o.chipTitle]    tooltip for the chip (e.g. the pod hostname)
 * @param {boolean} [o.remoteFonts] load Google Fonts (hosted app). Local stays offline.
 * @param {string} [o.xtermDir]     path to node_modules/@xterm, to serve /xterm/*
 */
function createUi(o) {
  const read = (...p) => fs.readFileSync(path.join(PUBLIC, ...p), 'utf8');
  const appCss = (o.remoteFonts ? FONTS_IMPORT : '') + read('tokens.css') + read('components.css') + read('lab.css');
  const assets = {
    '/app.css': () => [Buffer.from(appCss), 'text/css'],
    '/lab.js': () => [fs.readFileSync(path.join(PUBLIC, 'lab.js')), 'application/javascript'],
    '/progress.js': () => [fs.readFileSync(path.join(PUBLIC, 'progress.js')), 'application/javascript'],
    '/home.css': () => [fs.readFileSync(path.join(PUBLIC, 'home.css')), 'text/css'],
    '/home.js': () => [fs.readFileSync(path.join(PUBLIC, 'home.js')), 'application/javascript'],
    '/logo/debo-labs-logo.png': () => [fs.readFileSync(path.join(PUBLIC, 'logo', 'debo-labs-logo.png')), 'image/png'],
  };
  if (o.xtermDir) {
    const files = {
      '/xterm/xterm.js': [['xterm', 'lib', 'xterm.js'], 'application/javascript'],
      '/xterm/xterm.css': [['xterm', 'css', 'xterm.css'], 'text/css'],
      '/xterm/addon-fit.js': [['addon-fit', 'lib', 'addon-fit.js'], 'application/javascript'],
    };
    for (const [url, [parts, type]] of Object.entries(files)) assets[url] = () => [fs.readFileSync(path.join(o.xtermDir, ...parts)), type];
  }

  // Returns true when it served something. Apps call this first in their request handler.
  function serveAsset(req, res, pathname) {
    if (req.method !== 'GET' || !assets[pathname]) return false;
    try {
      const [data, type] = assets[pathname]();
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
    return true;
  }

  function topbar() {
    return `<header class="topbar">
  <a class="logo" href="/"><img class="logo-mark" src="/logo/debo-labs-logo.png" alt="Debo Labs" />
    <span class="logo-word">Debo <span class="accent">Labs</span></span></a>
  <div class="topbar-right"><span class="mono chip-env"${o.chipTitle ? ` title="${esc(o.chipTitle)}"` : ''}>${esc(o.chip)}</span>
    <a class="btn-site" href="${SITE_URL}" target="_blank" rel="noopener noreferrer">deboistech.in <span aria-hidden="true">&#8599;</span></a></div>
</header>`;
  }

  // `head` adds page-specific tags (e.g. an extra stylesheet) after the shared /app.css.
  function page(title, body, scripts = '', head = '') {
    const css = '<link rel="stylesheet" href="/app.css" />';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${esc(title)} · Debo Labs</title>
<meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="dark" /><link rel="icon" href="${FAVICON}" />${css}${head}</head>
<body>
${SPRITE}
${topbar()}
${body}
${scripts}
</body></html>`;
  }

  return { page, topbar, serveAsset };
}

module.exports = { createUi, esc, ext, SITE_URL, mark };
