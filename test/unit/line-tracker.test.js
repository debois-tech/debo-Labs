const test = require('node:test');
const assert = require('node:assert/strict');
const { createLineTracker, lineRunsCommand } = require('../../src/lib');

function typeKeys(tracker, text) {
  const lines = [];
  for (const ch of text) lines.push(...tracker.feed(ch));
  return lines;
}

test('regression: a command typed one keystroke per message is detected once Enter is pressed', () => {
  // The exact real-world bug: a real browser terminal (xterm.js) sends one
  // WebSocket message per keystroke, so a per-message substring check never
  // matches a multi-character command.
  const t = createLineTracker();
  assert.deepEqual(typeKeys(t, 'hostname'), []);
  assert.deepEqual(t.feed('\r'), ['hostname']);
});

test('a whole-string message (paste, script) with a newline also completes the line', () => {
  assert.deepEqual(createLineTracker().feed('hostname\n'), ['hostname']);
});

test('text that was typed but never submitted is not a completed line', () => {
  assert.deepEqual(typeKeys(createLineTracker(), 'hostname'), []);
});

test('backspace edits the line, so a corrected typo counts as the corrected command', () => {
  const t = createLineTracker();
  assert.deepEqual(typeKeys(t, 'hostnamX\x7fe\r'), ['hostname']);
});

test('Ctrl-C and Ctrl-U discard the line in progress', () => {
  const t = createLineTracker();
  typeKeys(t, 'hostname\x03');
  assert.deepEqual(t.feed('ls\r'), ['ls']);
  typeKeys(t, 'hostname\x15');
  assert.deepEqual(t.feed('pwd\r'), ['pwd']);
});

test('arrow-key escape sequences are ignored, not recorded as text', () => {
  assert.deepEqual(createLineTracker().feed('\x1b[Ahostname\r'), ['hostname']);
});

test('multiple lines in one chunk all complete; blank lines are skipped', () => {
  assert.deepEqual(createLineTracker().feed('ls\r\r pwd \r'), ['ls', 'pwd']);
});

test('a runaway line is bounded', () => {
  const t = createLineTracker(10);
  const [line] = t.feed('a'.repeat(100) + '\r');
  assert.equal(line.length, 10);
});

test('lineRunsCommand matches real invocations but not the word as an argument', () => {
  assert.equal(lineRunsCommand('hostname', 'hostname'), true);
  assert.equal(lineRunsCommand('hostname -f', 'hostname'), true);
  assert.equal(lineRunsCommand('echo $(hostname)', 'hostname'), true);
  assert.equal(lineRunsCommand('ls; hostname', 'hostname'), true);
  assert.equal(lineRunsCommand('echo hostname', 'hostname'), false);
  assert.equal(lineRunsCommand('hostnamectl', 'hostname'), false);
});
