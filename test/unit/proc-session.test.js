const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { processesInSession, sessionHasProcessNamed } = require('../../src/lib');

// Builds a fake /proc directory: one entry per {pid, comm, session, state},
// with a /proc/<pid>/stat body matching the real kernel format closely
// enough for our parser: "<pid> (<comm>) <state> <ppid> <pgrp> <session> ...".
function makeFakeProc(processes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-'));
  for (const { pid, comm, session, state = 'S' } of processes) {
    const pidDir = path.join(dir, String(pid));
    fs.mkdirSync(pidDir);
    fs.writeFileSync(path.join(pidDir, 'stat'), `${pid} (${comm}) ${state} 1 ${pid} ${session} 0 -1\n`);
  }
  return dir;
}

test('processesInSession finds every process sharing a session id, across process groups', () => {
  const procDir = makeFakeProc([
    { pid: 100, comm: 'sh', session: 100 },       // the shell itself: sid == its own pid
    { pid: 105, comm: 'yes', session: 100 },      // a backgrounded job: same session, different pgrp
    { pid: 999, comm: 'yes', session: 999 },      // a different visitor's unrelated session
  ]);

  const matches = processesInSession(procDir, 100);
  assert.deepEqual(
    matches.map((p) => p.pid).sort(),
    [100, 105],
  );
});

test('sessionHasProcessNamed is true when a matching-name process shares the session', () => {
  const procDir = makeFakeProc([
    { pid: 200, comm: 'sh', session: 200 },
    { pid: 201, comm: 'yes', session: 200 },
  ]);
  assert.equal(sessionHasProcessNamed(procDir, 200, 'yes'), true);
});

test('sessionHasProcessNamed is false once the named process is gone (only unrelated pids remain)', () => {
  const procDir = makeFakeProc([
    { pid: 300, comm: 'sh', session: 300 },
  ]);
  assert.equal(sessionHasProcessNamed(procDir, 300, 'yes'), false);
});

test('sessionHasProcessNamed ignores a same-named process in a different session (another visitor)', () => {
  const procDir = makeFakeProc([
    { pid: 400, comm: 'sh', session: 400 },
    { pid: 555, comm: 'yes', session: 999 }, // belongs to someone else's session
  ]);
  assert.equal(sessionHasProcessNamed(procDir, 400, 'yes'), false);
});

test('processesInSession returns an empty list for a nonexistent procDir rather than throwing', () => {
  assert.deepEqual(processesInSession('/no/such/directory', 1), []);
});

test('a zombie ("Z") process is excluded, even though its comm-matching /proc entry still exists', () => {
  // Real bug this project's own end-to-end testing caught: `kill` makes a
  // process a zombie until its parent shell next reaps it (which only
  // happens when the shell processes more interactive input) - a killed
  // process must not still count as "running" just because /proc hasn't
  // cleaned up yet.
  const procDir = makeFakeProc([
    { pid: 500, comm: 'sh', session: 500 },
    { pid: 501, comm: 'yes', session: 500, state: 'Z' },
  ]);
  assert.equal(sessionHasProcessNamed(procDir, 500, 'yes'), false);
});

test('a genuinely running ("S"/"R") process of the same name is still detected', () => {
  const procDir = makeFakeProc([
    { pid: 600, comm: 'sh', session: 600 },
    { pid: 601, comm: 'yes', session: 600, state: 'R' },
  ]);
  assert.equal(sessionHasProcessNamed(procDir, 600, 'yes'), true);
});
