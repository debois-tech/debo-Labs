const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scaffold, addToTrackYaml, parseArgs } = require('../../scripts/new-lab');
const { loadCatalog } = require('../../src/loader');

const REPO = path.join(__dirname, '..', '..');

// A throwaway repo root: a minimal template, two tracks with one lab each.
// (The image does not ship templates/, so the tests carry their own; one more test uses the real one where it exists.)
function fixture({ realTemplate = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'newlab-'));
  const tpl = path.join(root, 'templates', 'lab');
  if (realTemplate) fs.cpSync(path.join(REPO, 'templates'), path.join(root, 'templates'), { recursive: true });
  else {
    fs.mkdirSync(path.join(tpl, 'checks'), { recursive: true });
    fs.mkdirSync(path.join(tpl, 'solutions'), { recursive: true });
    fs.writeFileSync(path.join(tpl, 'lab.yaml'), 'title: __TITLE__\nlevel: beginner          # beginner | intermediate | advanced\nminutes: 10\nsummary: s\nsteps:\n  - {id: intro, type: lesson, title: Intro, body: hi}\n  - {id: example, type: task, title: Do it, body: do it, hint: nudge}\n');
    fs.writeFileSync(path.join(tpl, 'checks', 'example.sh'), '. "$LAB_LIB"\n[ -f hello.txt ] || fail "no hello.txt"\n');
    fs.writeFileSync(path.join(tpl, 'solutions', 'example.sh'), 'touch hello.txt\n');
  }
  const lab = path.join(root, 'labs', 'demo-track', 'first');
  fs.mkdirSync(path.join(lab, 'checks'), { recursive: true });
  fs.mkdirSync(path.join(lab, 'solutions'), { recursive: true });
  fs.writeFileSync(path.join(root, 'labs', 'demo-track', 'track.yaml'), '# order matters\ntitle: Demo track\ndescription: d\nlabs:\n  - first   # the first one\n');
  fs.writeFileSync(path.join(lab, 'lab.yaml'), 'title: First\nlevel: beginner\nminutes: 10\nsummary: s\nsteps:\n  - {id: a, type: lesson, title: A, body: hi}\n  - {id: b, type: task, title: B, body: do it, hint: nudge}\n');
  fs.writeFileSync(path.join(lab, 'checks', 'b.sh'), '. "$LAB_LIB"\n[ -f x ] || fail "no x"\n');
  fs.writeFileSync(path.join(lab, 'solutions', 'b.sh'), 'touch x\n');
  fs.cpSync(lab, path.join(root, 'labs', 'whole-track', 'solo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'labs', 'whole-track', 'track.yaml'), 'title: Whole\ndescription: d\nlabs:\n  - solo\n');
  return root;
}
const problemsOf = (root) => {
  const catalog = loadCatalog(path.join(root, 'labs'));
  return catalog.problems;
};

test('scaffold creates the lab and registers it in track.yaml, leaving no problems', () => {
  const root = fixture();
  const r = scaffold({ root, track: 'demo-track', lab: 'second', title: 'Second lab', level: 'intermediate', minutes: 12 });
  assert.equal(r.dryRun, false);
  const yaml = fs.readFileSync(path.join(root, 'labs', 'demo-track', 'second', 'lab.yaml'), 'utf8');
  assert.match(yaml, /^title: Second lab$/m);
  assert.match(yaml, /^level: intermediate/m);
  assert.match(yaml, /^minutes: 12/m);
  assert.match(fs.readFileSync(path.join(root, 'labs', 'demo-track', 'track.yaml'), 'utf8'), /- first {3}# the first one\n {2}- second\n/);   // comments kept
  assert.deepEqual(problemsOf(root), []);
});

test('scaffold appends to an existing track and creates a new one when the track is new', () => {
  const root = fixture();
  scaffold({ root, track: 'whole-track', lab: 'extra' });
  assert.match(fs.readFileSync(path.join(root, 'labs', 'whole-track', 'track.yaml'), 'utf8'), /- solo\n {2}- extra\n/);
  scaffold({ root, track: 'brand-new', lab: 'one' });
  assert.match(fs.readFileSync(path.join(root, 'labs', 'brand-new', 'track.yaml'), 'utf8'), /^title: Brand new\n/);
  assert.deepEqual(problemsOf(root), []);
});

test('scaffold refuses bad input and duplicates, and dry-run writes nothing', () => {
  const root = fixture();
  assert.throws(() => scaffold({ root, track: 'demo-track', lab: 'first' }), /already exists/);
  assert.throws(() => scaffold({ root, track: 'demo-track', lab: 'Bad Id' }), /lowercase/);
  assert.throws(() => scaffold({ root, track: 'demo-track', lab: 'ok', level: 'expert' }), /--level/);
  assert.throws(() => scaffold({ root, track: 'demo-track', lab: 'ok', minutes: 60 }), /--minutes/);
  const before = fs.readFileSync(path.join(root, 'labs', 'demo-track', 'track.yaml'), 'utf8');
  const r = scaffold({ root, track: 'demo-track', lab: 'ghost', dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'labs', 'demo-track', 'ghost')), false);
  assert.equal(fs.readFileSync(path.join(root, 'labs', 'demo-track', 'track.yaml'), 'utf8'), before);
});

test('addToTrackYaml handles block and inline lists and is idempotent', () => {
  assert.equal(addToTrackYaml('title: t\nlabs:\n  - a\n  - b\ndescription: d\n', 'c'), 'title: t\nlabs:\n  - a\n  - b\n  - c\ndescription: d\n');
  assert.equal(addToTrackYaml('title: t\nlabs: [a, b]\n', 'c'), 'title: t\nlabs: [a, b, c]\n');
  assert.equal(addToTrackYaml('labs:\n  - a\n', 'a'), 'labs:\n  - a\n');
  assert.throws(() => addToTrackYaml('title: t\n', 'a'), /no labs/);
});

test('parseArgs reads flags and keeps the title words', () => {
  const o = parseArgs(['t', 'l', 'My', 'title', '--dry-run', '--minutes', '8']);
  assert.deepEqual([o.positional, o.dryRun, o.minutes], [['t', 'l', 'My', 'title'], true, '8']);
  assert.throws(() => parseArgs(['--wat']), /unknown option/);
});

test('the real templates/lab scaffolds into a lab that loads without problems', { skip: !fs.existsSync(path.join(REPO, 'templates')) }, () => {
  const root = fixture({ realTemplate: true });
  scaffold({ root, track: 'demo-track', lab: 'fromreal' });
  assert.deepEqual(problemsOf(root), []);
});
