// The verify lock (plan/PH1-verify-lock.md): one `npm run verify` at a time on this machine, because every run
// uses the same database and the same emulator ports. Each test runs a scratch copy of verify with its own lock
// file (verify-scratch.js), so the machine's real lock is never touched.
//
// Written before the lock existed: every test here failed on the code of 62cb199 (no lock, no wait, no limit),
// except the ones noted "passes either way" in their comment.
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pidExists } = require('../lib/proc');

const {
  scratch,
  verify,
  startVerify,
  lockFileOf,
  sleep,
  waitUntil,
  liveHolder,
  deadPid,
  holderRecord,
  writeLock,
  readLock,
  lockExists,
  clean,
  seenFile,
  noteLockCheck,
  sleepingCheck,
} = require('./verify-scratch');

test('pidExists: true for a live process, false for one that has ended', async () => {
  assert.equal(pidExists(process.pid), true);
  assert.equal(pidExists(await deadPid()), false);
  assert.equal(pidExists(0), false);
  assert.equal(pidExists(-1), false);
  assert.equal(pidExists(Number.NaN), false);
});

test('a run takes the lock for its whole run: owner from GABAY_VERIFY_OWNER, pid, folder, commit and start time recorded; released at the end', () => {
  const seen = seenFile('record');
  const dir = scratch(noteLockCheck(seen));
  try {
    const r = verify(dir, ['--only', 'linter-tests'], {
      env: { GABAY_VERIFY_OWNER: 'main session' },
    });
    assert.equal(r.status, 0, r.out + r.err);
    const held = JSON.parse(fs.readFileSync(seen, 'utf8'));
    assert.equal(held.owner, 'main session');
    assert.ok(held.pid > 0 && held.pid !== process.pid, 'the pid of the verify process');
    assert.equal(fs.realpathSync(held.folder), fs.realpathSync(dir), 'the folder it runs in');
    assert.match(held.commit, /^[0-9a-f]{7,}$/, 'the commit of the folder');
    assert.ok(!Number.isNaN(Date.parse(held.startedAt)), 'an ISO start time');
    assert.equal(lockExists(dir), false, 'released at the end');
  } finally {
    clean(dir);
    fs.rmSync(seen, { force: true });
  }
});

test('without GABAY_VERIFY_OWNER the owner is the user and the folder', () => {
  const seen = seenFile('owner');
  const dir = scratch(noteLockCheck(seen));
  try {
    const r = verify(dir, ['--only', 'linter-tests']);
    assert.equal(r.status, 0, r.out + r.err);
    const held = JSON.parse(fs.readFileSync(seen, 'utf8'));
    assert.ok(held.owner.includes(os.userInfo().username), held.owner);
    assert.ok(held.owner.includes(path.basename(dir)), held.owner);
  } finally {
    clean(dir);
    fs.rmSync(seen, { force: true });
  }
});

test('two runs started together: the second prints who holds the lock at once, waits, then runs and ends green', async () => {
  const dir = scratch(sleepingCheck(3000));
  try {
    const first = startVerify(dir, ['--only', 'linter-tests'], {
      env: { GABAY_VERIFY_OWNER: 'api-coder' },
    });
    assert.ok(await waitUntil(() => lockExists(dir)), 'the first run took the lock');
    const second = startVerify(dir, ['--only', 'linter-tests'], {
      env: { GABAY_VERIFY_OWNER: 'main session', GABAY_VERIFY_LOCK_REPORT_MS: '400' },
    });
    const [a, b] = await Promise.all([first.done, second.done]);
    assert.equal(a.status, 0, a.out + a.err);
    assert.equal(b.status, 0, b.out + b.err);
    assert.match(
      b.out,
      new RegExp(
        `^verify is busy: held by api-coder \\(pid ${first.child.pid}, .+, [0-9a-f]{7,}\\) since \\d{4}-\\d\\d-\\d\\dT`,
        'm',
      ),
    );
    assert.ok((b.out.match(/^verify is busy: /gm) ?? []).length >= 2, 'it repeats while it waits');
    assert.match(b.out, /ALL GREEN/);
    assert.doesNotMatch(a.out, /verify is busy/, 'the first run never waited');
    assert.equal(lockExists(dir), false);
  } finally {
    clean(dir);
  }
});

test('a run that waits past the limit stops with exit 2 naming the holder, and records nothing', async () => {
  const dir = scratch();
  const holder = liveHolder();
  try {
    const record = holderRecord(holder.pid);
    writeLock(dir, record);
    const r = verify(dir, ['--only', 'node-version'], {
      env: { GABAY_VERIFY_LOCK_WAIT_MS: '1500', GABAY_VERIFY_LOCK_REPORT_MS: '400' },
    });
    assert.equal(r.status, 2, r.out + r.err);
    assert.match(
      r.out,
      /verify is busy: held by api-coder \(pid \d+, C:\\work\\gabay-a, abc1234\) since 2026-10-08T01:02:03/,
    );
    assert.match(r.err, /gave up waiting/);
    assert.match(r.err, /api-coder/);
    assert.match(r.err, new RegExp(`pid ${holder.pid}`));
    assert.doesNotMatch(r.out, /^ok /m, 'no check ran');
    assert.equal(r.state, null, 'it is not a verify run: .verify/last-run.json is not written');
    assert.deepEqual(readLock(dir), record, 'only the holder removes its own lock');
  } finally {
    holder.kill();
    clean(dir);
  }
});

test('a lock whose process no longer exists is cleared with one line, and the run goes on', async () => {
  const dir = scratch();
  try {
    writeLock(dir, holderRecord(await deadPid()));
    const r = verify(dir, ['--only', 'node-version']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(
      r.out,
      /^verify: cleared a stale lock held by api-coder \(pid \d+, C:\\work\\gabay-a, abc1234\): that process no longer exists$/m,
    );
    assert.doesNotMatch(r.out, /verify is busy/, 'it did not wait for a dead holder');
    assert.match(r.out, /ALL GREEN/);
    assert.equal(lockExists(dir), false);
  } finally {
    clean(dir);
  }
});

test('a lock file that cannot be read as a lock is cleared as stale too (nobody could ever release it)', () => {
  const dir = scratch();
  try {
    fs.writeFileSync(lockFileOf(dir), 'not json');
    const r = verify(dir, ['--only', 'node-version']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.match(r.out, /^verify: cleared a stale lock \(unreadable\)/m);
    assert.equal(lockExists(dir), false);
  } finally {
    clean(dir);
  }
});

test('the lock is held during a green run and a red run, and released after each', () => {
  for (const [kind, exitCode, status] of [
    ['green', 0, 0],
    ['red', 1, 1],
  ]) {
    const seen = seenFile(kind);
    const dir = scratch(noteLockCheck(seen, { exitCode }));
    try {
      const r = verify(dir, ['--only', 'linter-tests']);
      assert.equal(r.status, status, `${kind}: ${r.out}${r.err}`);
      assert.ok(fs.existsSync(seen), `${kind}: the lock was held while the check ran`);
      assert.equal(lockExists(dir), false, `${kind}: released`);
    } finally {
      clean(dir);
      fs.rmSync(seen, { force: true });
    }
  }
});

test('the lock is released on an interrupt (the Ctrl-C and SIGTERM path), and exit stays 130', async () => {
  const seen = seenFile('interrupt');
  const trigger = seenFile('interrupt-now');
  const dir = scratch(noteLockCheck(seen, { napMs: 20_000 }));
  try {
    const run = startVerify(dir, ['--only', 'linter-tests'], {
      env: { GABAY_VERIFY_TEST_INTERRUPT_FILE: trigger },
    });
    // Interrupt only once the check is running, so the lock is certainly held (no guess of how long that takes).
    assert.ok(
      await waitUntil(() => fs.existsSync(seen), 60_000),
      'the check ran, so the lock was held',
    );
    fs.writeFileSync(trigger, 'now');
    const r = await run.done;
    assert.equal(r.status, 130, r.out + r.err);
    assert.equal(lockExists(dir), false);
  } finally {
    clean(dir);
    fs.rmSync(seen, { force: true });
    fs.rmSync(trigger, { force: true });
  }
});

// A real SIGTERM runs Node's handler on POSIX only: on Windows process.kill(pid, 'SIGTERM') ends the process at
// once and no handler runs (a run killed that way leaves a lock that the stale-lock test above covers).
test('the lock is released on a real SIGTERM', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Node on Windows cannot deliver SIGTERM to a handler (see above)');
    return;
  }
  const dir = scratch(sleepingCheck(20_000));
  try {
    const run = startVerify(dir, ['--only', 'linter-tests']);
    assert.ok(await waitUntil(() => lockExists(dir)));
    await sleep(500);
    run.child.kill('SIGTERM');
    const r = await run.done;
    assert.equal(r.status, 130, r.out + r.err);
    assert.equal(lockExists(dir), false);
  } finally {
    clean(dir);
  }
});

test('only the holder removes its own lock: a lock another run put in its place survives the end of this run', () => {
  const seen = seenFile('swap');
  const other = JSON.stringify(holderRecord(process.pid)); // this test process is alive for the whole test
  const dir = scratch({
    'package.json': JSON.stringify({ scripts: { 'lint:test': 'node swap.js' } }),
    // The check notes that this run held the lock, then replaces it, as if it had been cleared and another
    // run had taken it.
    'swap.js': `const fs = require('fs');
fs.copyFileSync(process.env.GABAY_VERIFY_LOCK_FILE, ${JSON.stringify(seen)});
fs.writeFileSync(process.env.GABAY_VERIFY_LOCK_FILE, ${JSON.stringify(other)});
console.log('# tests 1');
`,
  });
  try {
    const r = verify(dir, ['--only', 'linter-tests']);
    assert.equal(r.status, 0, r.out + r.err);
    assert.ok(fs.existsSync(seen), 'this run held a lock of its own before the swap');
    assert.equal(fs.readFileSync(lockFileOf(dir), 'utf8'), other, 'left alone');
  } finally {
    clean(dir);
    fs.rmSync(seen, { force: true });
  }
});

test('an interrupt while waiting stops the run and leaves the holder lock alone', async () => {
  const dir = scratch();
  const holder = liveHolder();
  try {
    const record = holderRecord(holder.pid);
    writeLock(dir, record);
    const r = verify(dir, ['--only', 'node-version'], {
      env: { GABAY_VERIFY_TEST_INTERRUPT_MS: '1200' },
    });
    assert.equal(r.status, 130, r.out + r.err);
    assert.deepEqual(readLock(dir), record);
    assert.equal(r.state, null);
  } finally {
    holder.kill();
    clean(dir);
  }
});

test('GABAY_VERIFY_LOCK_WAIT_MS that is not a positive whole number is rejected with a clear error', () => {
  const dir = scratch();
  try {
    for (const bad of ['abc', '0', '-5', '1.5', '10s']) {
      const r = verify(dir, ['--only', 'node-version'], {
        env: { GABAY_VERIFY_LOCK_WAIT_MS: bad },
      });
      assert.equal(r.status, 2, `${bad}: ${r.out}${r.err}`);
      assert.match(r.err, /GABAY_VERIFY_LOCK_WAIT_MS/);
      assert.ok(r.err.includes(`"${bad}"`), 'the message quotes the bad value');
      assert.doesNotMatch(r.out, /^ok /m, 'no check ran');
      assert.equal(lockExists(dir), false, 'no lock was taken');
    }
    const empty = verify(dir, ['--only', 'node-version'], {
      env: { GABAY_VERIFY_LOCK_WAIT_MS: '' },
    });
    assert.equal(empty.status, 0, 'empty means not set (the 15 minute default)');
  } finally {
    clean(dir);
  }
});

test('CI=true: no lock at all (a held lock is ignored, nothing is created); the same run without CI waits', () => {
  const dir = scratch();
  try {
    writeLock(dir, holderRecord(process.pid)); // held by this test process, which is alive
    const before = fs.readFileSync(lockFileOf(dir), 'utf8');
    const wait = { GABAY_VERIFY_LOCK_WAIT_MS: '1000', GABAY_VERIFY_LOCK_REPORT_MS: '300' };
    const ci = verify(dir, ['--only', 'node-version'], { env: { ...wait, CI: 'true' } });
    assert.equal(ci.status, 0, ci.out + ci.err);
    assert.doesNotMatch(ci.out, /verify is busy/);
    assert.equal(fs.readFileSync(lockFileOf(dir), 'utf8'), before, 'untouched');
    const local = verify(dir, ['--only', 'node-version'], { env: { ...wait, CI: '' } });
    assert.equal(local.status, 2, 'without CI the same held lock is waited on until the limit');
    fs.rmSync(lockFileOf(dir));
    const again = verify(dir, ['--only', 'node-version'], { env: { CI: 'true' } });
    assert.equal(again.status, 0, again.out + again.err);
    assert.equal(lockExists(dir), false, 'no lock file was created');
  } finally {
    clean(dir);
  }
});

test('--list takes no lock: it answers at once while another run holds it', async () => {
  const dir = scratch();
  const holder = liveHolder();
  try {
    writeLock(dir, holderRecord(holder.pid));
    const started = Date.now();
    const r = verify(dir, ['--list'], { env: { GABAY_VERIFY_LOCK_WAIT_MS: '60000' } });
    assert.equal(r.status, 0, r.out + r.err);
    assert.equal(r.out.trim().split('\n').length, 16);
    assert.ok(Date.now() - started < 10_000, 'it did not wait');
  } finally {
    holder.kill();
    clean(dir);
  }
});

// ---- plan/PH4-lane-ports.md: the lock is per lane (the copy's port offset) ----------------------------------------
// Written before the per-lane lock existed: each of these failed on the code of origin/main (one lock file for the
// machine, no offset in the record).

const lockModule = require('../lib/verify-lock');

const lanePath = (offset, dir) => lockModule.lockFilePath(offset, { env: {}, dir });

test('lane lock: offset 0 keeps gabay-verify.lock; every other offset has its own file; the test seam still wins', () => {
  const dir = os.tmpdir();
  assert.equal(path.basename(lanePath(0, dir)), 'gabay-verify.lock');
  assert.equal(path.basename(lanePath(10, dir)), 'gabay-verify-10.lock');
  assert.equal(path.basename(lanePath(20, dir)), 'gabay-verify-20.lock');
  assert.equal(path.dirname(lanePath(10, dir)), dir);
  assert.equal(
    lockModule.lockFilePath(10, { env: { GABAY_VERIFY_LOCK_FILE: 'X:\\seam.lock' } }),
    'X:\\seam.lock',
  );
});

test('lane lock: offsets 10 and 20 are both held at once; the same offset waits and names the holder; the record carries the offset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lanelock-'));
  try {
    const log = [];
    const a = await lockModule.acquireLock({
      file: lanePath(10, dir),
      root: dir,
      waitMs: 500,
      owner: 'api-coder',
      offset: 10,
      log: (l) => log.push(l),
    });
    const b = await lockModule.acquireLock({
      file: lanePath(20, dir),
      root: dir,
      waitMs: 500,
      owner: 'flutter-coder',
      offset: 20,
      log: (l) => log.push(l),
    });
    assert.ok(a.handle && b.handle, 'both lanes hold their lock at the same time');
    assert.deepEqual(log, [], 'neither printed "busy"');
    assert.equal(JSON.parse(fs.readFileSync(lanePath(10, dir), 'utf8')).offset, 10);
    assert.equal(JSON.parse(fs.readFileSync(lanePath(20, dir), 'utf8')).offset, 20);

    const waitLog = [];
    const again = await lockModule.acquireLock({
      file: lanePath(10, dir),
      root: dir,
      waitMs: 300,
      pollMs: 50,
      owner: 'someone else',
      offset: 10,
      log: (l) => waitLog.push(l),
    });
    assert.ok(again.timedOut, 'the same offset waits');
    assert.match(waitLog[0], /^verify is busy: held by api-coder \(pid \d+, /);
    lockModule.releaseLock(a.handle);
    lockModule.releaseLock(b.handle);
    assert.equal(fs.existsSync(lanePath(10, dir)), false);
    assert.equal(fs.existsSync(lanePath(20, dir)), false);
  } finally {
    clean(dir);
  }
});

test('lane lock: a record with no offset (the old format) is still read, and its holder still blocks', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lanelock-'));
  const holder = liveHolder();
  try {
    const file = lanePath(0, dir);
    fs.writeFileSync(file, JSON.stringify(holderRecord(holder.pid)));
    const lines = [];
    const got = await lockModule.acquireLock({
      file,
      root: dir,
      waitMs: 300,
      pollMs: 50,
      owner: 'new',
      log: (l) => lines.push(l),
    });
    assert.ok(got.timedOut);
    assert.match(
      lines[0],
      /^verify is busy: held by api-coder \(pid \d+, C:\\work\\gabay-a, abc1234\)/,
    );
    assert.equal(
      JSON.parse(fs.readFileSync(file, 'utf8')).offset,
      undefined,
      'the old record is not rewritten',
    );
  } finally {
    holder.kill();
    clean(dir);
  }
});

/** A check that copies the lane's lock file (in the temp folder) to `seen`, then waits until `other` exists (or 30 s). */
const laneCheck = ({ lockName, seen, other = null, napMs = 0 }) => ({
  'package.json': JSON.stringify({ scripts: { 'lint:test': 'node lane-check.js' } }),
  'lane-check.js': `const fs = require('fs'), os = require('os'), path = require('path');
fs.copyFileSync(path.join(os.tmpdir(), ${JSON.stringify(lockName)}), ${JSON.stringify(seen)});
const other = ${JSON.stringify(other)};
const began = Date.now();
(function wait() {
  const met = !other || fs.existsSync(other);
  if (met || Date.now() - began > 30000) {
    console.log('# tests 1');
    setTimeout(() => process.exit(met ? 0 : 1), ${napMs});
  } else setTimeout(wait, 50);
})();
`,
});

/** The environment that puts the child's temp folder, and so its lane lock, in `tmp` (and not the seam's file). */
const laneEnv = (tmp, extra = {}) => ({
  GABAY_VERIFY_LOCK_FILE: '',
  TEMP: tmp,
  TMP: tmp,
  TMPDIR: tmp,
  ...extra,
});

test('verify: the lock file is gabay-verify.lock at offset 0 (an .env value of 0) and gabay-verify-<offset>.lock from the .env otherwise', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lanetmp-'));
  const seen = seenFile('lane-name');
  try {
    for (const [offset, lockName] of [
      [0, 'gabay-verify.lock'],
      [10, 'gabay-verify-10.lock'],
    ]) {
      const dir = scratch({
        '.env': `EMULATOR_PORT_OFFSET=${offset}\n`,
        ...laneCheck({ lockName, seen }),
      });
      try {
        const r = verify(dir, ['--only', 'linter-tests'], { env: laneEnv(tmp) });
        assert.equal(r.status, 0, `offset ${offset}: ${r.out}${r.err}`);
        const held = JSON.parse(fs.readFileSync(seen, 'utf8'));
        assert.equal(held.offset, offset, `offset ${offset}: the record carries it`);
        assert.equal(fs.existsSync(path.join(tmp, lockName)), false, 'released at the end');
        assert.match(
          r.out,
          new RegExp(`^lane: offset ${offset}, functions ${5001 + offset}, `, 'm'),
        );
      } finally {
        clean(dir);
        fs.rmSync(seen, { force: true });
      }
    }
  } finally {
    clean(tmp);
  }
});

test('verify: runs in two lanes (offsets 10 and 20) are in their checks at the same time, and neither prints "busy"', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lanetmp-'));
  const seenA = seenFile('lane-a');
  const seenB = seenFile('lane-b');
  const a = scratch({
    '.env': 'EMULATOR_PORT_OFFSET=10\n',
    ...laneCheck({ lockName: 'gabay-verify-10.lock', seen: seenA, other: seenB }),
  });
  const b = scratch({
    '.env': 'EMULATOR_PORT_OFFSET=20\n',
    ...laneCheck({ lockName: 'gabay-verify-20.lock', seen: seenB, other: seenA }),
  });
  try {
    const runA = startVerify(a, ['--only', 'linter-tests'], { env: laneEnv(tmp) });
    const runB = startVerify(b, ['--only', 'linter-tests'], { env: laneEnv(tmp) });
    const [ra, rb] = await Promise.all([runA.done, runB.done]);
    // each check exits 0 only once it saw the other's lock copy, so both were holding their lock together
    assert.equal(ra.status, 0, ra.out + ra.err);
    assert.equal(rb.status, 0, rb.out + rb.err);
    assert.doesNotMatch(ra.out + rb.out, /verify is busy/);
  } finally {
    clean(a);
    clean(b);
    clean(tmp);
    fs.rmSync(seenA, { force: true });
    fs.rmSync(seenB, { force: true });
  }
});

test('verify: two runs in the SAME lane (the same offset in two folders) wait for each other, naming the holder', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lanetmp-'));
  const seen = seenFile('lane-same');
  const first = scratch({
    '.env': 'EMULATOR_PORT_OFFSET=10\n',
    ...laneCheck({ lockName: 'gabay-verify-10.lock', seen, napMs: 6000 }),
  });
  const second = scratch({ '.env': 'EMULATOR_PORT_OFFSET=10\n' });
  try {
    const run = startVerify(first, ['--only', 'linter-tests'], {
      env: laneEnv(tmp, { GABAY_VERIFY_OWNER: 'holder-run' }),
    });
    assert.ok(await waitUntil(() => fs.existsSync(seen), 60_000), 'the first run holds its lock');
    const r = verify(second, ['--only', 'node-version'], {
      env: laneEnv(tmp, { GABAY_VERIFY_LOCK_WAIT_MS: '1500', GABAY_VERIFY_LOCK_REPORT_MS: '300' }),
    });
    assert.equal(r.status, 2, 'it gave up waiting');
    assert.match(r.out, /^verify is busy: held by holder-run \(pid \d+, /m);
    await run.done;
  } finally {
    clean(first);
    clean(second);
    clean(tmp);
    fs.rmSync(seen, { force: true });
  }
});
