#!/usr/bin/env node
// Repo hygiene gate (npm run check:hygiene, also run in CI):
//   * no other lab/training platform or PaaS/cloud competitor, and no previous owner or brand, is named anywhere - code, docs,
//     comments - only AWS and the tools the labs teach (Linux, Git, Docker, Terraform, Kubernetes)
//   * optionally the same check on a commit message:  --message <file>
// The banned names are assembled from fragments below so that this file does not itself
// contain them (and therefore passes its own check).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const J = (...parts) => parts.join('');
const BANNED = [
  J('esc', 'bash'), J('kode', 'kloud'), J('killer', '(?:koda|coda)'), J('kata', 'coda'), J('instru', 'qt'),
  J('iximi', 'uz'), J('lab', 'ex\\b'), J('play-with-', '(?:docker|k8s)'), J('hacker', 'rank'), J('code', 'sandbox'),
  J('hero', 'ku'), J('fly', '\\.io'), J('render', '\\.com'), J('rail', 'way\\.app'), J('net', 'lify'),
  // names of the previous owner and brand: the project was rebranded and none of it may creep back
  J('train', 'with', 'shu', 'bham'), J('shu', 'bham'), J('lond', 'he'), J('\\bt', 'ws\\b'),
].map((p) => new RegExp(p, 'i'));

const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2']);
const root = path.join(__dirname, '..');
const hits = [];

function scan(label, text) {
  text.split('\n').forEach((line, i) => {
    for (const re of BANNED) if (re.test(line)) hits.push(`${label}:${i + 1}: matches /${re.source}/i`);
  });
}

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean);
for (const f of files) {
  if (SKIP_EXT.has(path.extname(f).toLowerCase()) || f === 'package-lock.json') continue;
  let text;
  try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }   // deleted but not yet staged
  scan(f, text);
}

const mi = process.argv.indexOf('--message');
if (mi > -1) scan(`commit message (${process.argv[mi + 1]})`, fs.readFileSync(process.argv[mi + 1], 'utf8'));

if (hits.length) {
  console.error('Hygiene check failed - other products must not be named in this repo:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log(`Hygiene OK (${files.length} files checked).`);
