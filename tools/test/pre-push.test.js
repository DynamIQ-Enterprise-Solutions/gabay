// .githooks/pre-push: the push is refused unless `npm run verify` is green. Scratch repositories only:
// the "remote" is a bare repository in a temp folder, and the repository's verify.js is a stub whose
// exit code is set by the test (the real verify takes minutes and is proven separately).
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scratchRepo, git, write, remove } = require('./scratch');

function withPushRepo(verifyExit, fn) {
  const dir = scratchRepo({
    // The hook runs tools/verify.js; this stub stands in for it and exits with the given code.
    'tools/verify.js': `process.stdout.write('verify stub\\n'); process.exit(${verifyExit});\n`,
  });
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-remote-'));
  git(remote, ['init', '-q', '--bare', '-b', 'main']);
  git(dir, ['remote', 'add', 'origin', remote.split(path.sep).join('/')]);
  try {
    return fn(dir, remote);
  } finally {
    remove(dir);
    remove(remote);
  }
}

const remoteHead = (remote) => git(remote, ['rev-parse', '--verify', '-q', 'main']);

test('pre-push: a failing verify refuses the push, and nothing reaches the remote', () => {
  withPushRepo(3, (dir, remote) => {
    const r = git(dir, ['push', 'origin', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.all, /verify stub/);
    assert.match(r.all, /pre-push: npm run verify failed \(3 check\(s\)\); the push is refused/);
    assert.notEqual(remoteHead(remote).status, 0, 'the remote has no main branch');
  });
});

test('pre-push: a green verify lets the push through', () => {
  withPushRepo(0, (dir, remote) => {
    const r = git(dir, ['push', 'origin', 'main']);
    assert.equal(r.status, 0, r.all);
    assert.equal(remoteHead(remote).out.trim(), git(dir, ['rev-parse', 'HEAD']).out.trim());
  });
});

test('pre-push: --no-verify is the one way around it (CI still refuses the merge)', () => {
  withPushRepo(1, (dir, remote) => {
    assert.equal(git(dir, ['push', '--no-verify', 'origin', 'main']).status, 0);
    assert.equal(remoteHead(remote).status, 0);
  });
});

test('pre-push: the hook runs the repository root verify.js whatever the current folder is', () => {
  withPushRepo(5, (dir) => {
    write(dir, 'sub/x.txt', 'x\n');
    const r = git(path.join(dir, 'sub'), ['push', 'origin', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.all, /\(5 check\(s\)\)/);
  });
});

// ---- L187 A.1: a push whose every changed path is a document skips verify -------------------------------------------------
// verify here is a stub that exits 7, so a push that reaches it is refused and a push that skips it goes through.

const commitFiles = (dir, files) => {
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  git(dir, ['add', ...Object.keys(files)]);
  const r = git(dir, ['-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'change']);
  assert.equal(r.status, 0, r.all);
};

/** A remote whose main already holds the baseline (pushed with --no-verify), so origin/main exists. */
const withBaseline = (fn) =>
  withPushRepo(7, (dir, remote) => {
    assert.equal(git(dir, ['push', '--no-verify', 'origin', 'main']).status, 0);
    return fn(dir, remote);
  });

test('pre-push (docs-only): a push of documents only skips verify, says why, and reaches the remote', () => {
  withBaseline((dir, remote) => {
    commitFiles(dir, {
      'README.md': '# r\n',
      'docs/process/x.txt': 'x\n',
      'plan.html': '<p>p</p>\n',
    });
    const r = git(dir, ['push', 'origin', 'main']);
    assert.equal(r.status, 0, r.all);
    assert.match(
      r.all,
      /pre-push: docs-only push \(3 files\), verify skipped; CI lint and e2e still gate the merge \(L187\)/,
    );
    assert.doesNotMatch(r.all, /verify stub/);
    assert.equal(remoteHead(remote).out.trim(), git(dir, ['rev-parse', 'HEAD']).out.trim());
  });
});

test('pre-push (docs-only): a code push still runs verify (here it fails, so the push is refused)', () => {
  withBaseline((dir, remote) => {
    const before = remoteHead(remote).out.trim();
    commitFiles(dir, { 'functions/src/more.js': "'use strict';\n" });
    const r = git(dir, ['push', 'origin', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.all, /verify stub/);
    assert.match(r.all, /pre-push: npm run verify failed \(7 check\(s\)\)/);
    assert.doesNotMatch(r.all, /docs-only/);
    assert.equal(remoteHead(remote).out.trim(), before);
  });
});

test('pre-push (docs-only): one code file among documents, across several commits, still runs verify', () => {
  withBaseline((dir) => {
    commitFiles(dir, { 'docs/a.md': 'a\n' });
    commitFiles(dir, { 'tools/lib/helper.js': "'use strict';\n", 'spec/b.md': 'b\n' });
    const r = git(dir, ['push', 'origin', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.all, /verify stub/);
  });
});

test('pre-push (docs-only): a new branch is judged against its merge-base with origin/main', () => {
  withBaseline((dir, remote) => {
    git(dir, ['checkout', '-q', '-b', 'notes']);
    commitFiles(dir, { 'plan/a.md': 'a\n' });
    commitFiles(dir, { 'phase-reports/shot.png': 'png\n' });
    const docs = git(dir, ['push', 'origin', 'notes']);
    assert.equal(docs.status, 0, docs.all);
    assert.match(docs.all, /docs-only push \(2 files\)/);
    assert.equal(remoteRef(remote, 'notes').out.trim(), git(dir, ['rev-parse', 'HEAD']).out.trim());

    git(dir, ['checkout', '-q', '-b', 'code', 'main']);
    commitFiles(dir, { 'README.md': 'r\n', 'db/schema.sql': '-- s\n' });
    const code = git(dir, ['push', 'origin', 'code']);
    assert.notEqual(code.status, 0);
    assert.match(code.all, /verify stub/);
    assert.notEqual(remoteRef(remote, 'code').status, 0);
  });
});

test('pre-push (docs-only): the first push to an empty remote has no origin/main to compare with, so it verifies', () => {
  withPushRepo(4, (dir, remote) => {
    const r = git(dir, ['push', 'origin', 'main']);
    assert.notEqual(r.status, 0);
    assert.match(r.all, /verify stub/);
    assert.doesNotMatch(r.all, /docs-only/);
    assert.notEqual(remoteHead(remote).status, 0);
  });
});

test('pre-push (docs-only): documents need neither a clean tree nor the checked-out branch (verify is not run)', () => {
  withBaseline((dir) => {
    git(dir, ['checkout', '-q', '-b', 'notes']);
    commitFiles(dir, { 'intent/a.md': 'a\n' });
    git(dir, ['checkout', '-q', 'main']);
    write(dir, 'app/lib/dirty.dart', 'void x() {}\n'); // untracked code: a verify push would refuse it
    const r = git(dir, ['push', 'origin', 'notes']);
    assert.equal(r.status, 0, r.all);
    assert.match(r.all, /docs-only push \(1 files\)/);
  });
});

test('pre-push (docs-only): --no-verify and deletions behave as before', () => {
  withBaseline((dir, remote) => {
    commitFiles(dir, { 'functions/src/x.js': "'use strict';\n" });
    assert.equal(git(dir, ['push', '--no-verify', 'origin', 'main:old']).status, 0);
    const r = git(dir, ['push', 'origin', ':old']);
    assert.equal(r.status, 0, r.all);
    assert.doesNotMatch(r.all, /docs-only/);
    assert.notEqual(git(remote, ['rev-parse', '--verify', '-q', 'old']).status, 0);
  });
});

function remoteRef(remote, ref) {
  return git(remote, ['rev-parse', '--verify', '-q', ref]);
}
