#!/usr/bin/env node
// Keeps the README's numbers honest: the lab/task badges and the track table are generated from the real catalog
// between <!-- stats:start --> / <!-- stats:end --> markers.
//   node scripts/readme-stats.js           rewrite the README
//   node scripts/readme-stats.js --check   exit 1 if the README is stale (the unit tests run this)
const fs = require('fs');
const path = require('path');
const { loadCatalog } = require('../src/loader');

const ROOT = path.join(__dirname, '..');
const README = path.join(ROOT, 'README.md');
const REPO = 'debois-tech/debo-Labs';

function compute(labsDir = path.join(ROOT, 'labs')) {
  const catalog = loadCatalog(labsDir);
  const labs = catalog.tracks.flatMap((t) => t.labs);
  const tasks = labs.reduce((n, l) => n + l.steps.filter((s) => s.type === 'task').length, 0);
  return { catalog, labs: labs.length, tasks, tracks: catalog.tracks.length };
}

const badge = (alt, url, href) => `[![${alt}](${url})](${href})`;

function render(s) {
  const gh = `https://github.com/${REPO}`;
  const badges = [
    badge('CI', `${gh}/actions/workflows/ci.yml/badge.svg`, `${gh}/actions/workflows/ci.yml`),
    badge('Release', `https://img.shields.io/github/v/release/${REPO}?style=flat-square&color=10b981`, `${gh}/releases`),
    badge('License: MIT', 'https://img.shields.io/badge/license-MIT-blue?style=flat-square', 'LICENSE'),
    badge('Labs', `https://img.shields.io/badge/labs-${s.labs}-10b981?style=flat-square`, '#whats-online'),
    badge('Graded tasks', `https://img.shields.io/badge/graded%20tasks-${s.tasks}-0d9488?style=flat-square`, '#how-it-works'),
    badge('Runs on', 'https://img.shields.io/badge/runs%20on-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-lightgrey?style=flat-square', '#run-it-locally'),
    badge('Stars', `https://img.shields.io/github/stars/${REPO}?style=flat-square`, `${gh}/stargazers`),
  ].join('\n');

  const rows = s.catalog.tracks.map((t) => `| **${t.title}** | ${t.labs.length} | ${t.labs.reduce((m, l) => m + l.minutes, 0)} min | ${t.description} |`);
  const table = ['| Track | Labs | Time | What you do |', '|---|---|---|---|', ...rows].join('\n');

  const pitch = `**${s.labs} labs · ${s.tasks} graded tasks · every task proven solvable by a script.**`;
  return { badges, table, pitch };
}

function apply(text, parts) {
  const sub = (name, body) => {
    const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
    if (!re.test(text)) throw new Error(`README.md is missing the <!-- ${name}:start --> / <!-- ${name}:end --> markers`);
    text = text.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
  };
  sub('badges', parts.badges);
  sub('pitch', parts.pitch);
  sub('routes', parts.table);
  return text;
}

function main(argv) {
  const s = compute();
  if (s.catalog.problems.length) {
    console.error(s.catalog.problems.join('\n'));
    return 1;
  }
  const current = fs.readFileSync(README, 'utf8');
  const next = apply(current, render(s));
  if (argv.includes('--check')) {
    if (next !== current) { console.error('README.md is out of date: run `npm run readme:stats`'); return 1; }
    console.log('README.md stats are current.');
    return 0;
  }
  fs.writeFileSync(README, next);
  console.log(`README.md updated: ${s.labs} labs, ${s.tasks} graded tasks, ${s.tracks} tracks.`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { compute, render, apply };
