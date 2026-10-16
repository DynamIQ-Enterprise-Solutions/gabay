'use strict';

// DEP-0 AC-8 (plan/DEP-0.md 1.0 step 1): tools/gcs-bucket-check.js is the owner's real-bucket run at DEP-1. Here, with no cloud
// and no network, only its argument handling is checked, and its own logic over the fake bucket (so a wrong check is caught
// before the owner spends a deploy on it). It has never touched a real bucket.

const test = require('./timeout');
const assert = require('node:assert/strict');
const path = require('node:path');
const { main, parseInvocation, USAGE } = require('../lib/gcs-bucket-check');

const { createFakeBucket, permissionDenied } = require(
  path.join(__dirname, '..', '..', 'functions', 'test', 'fakeBucket.js'),
);

function collect() {
  const lines = [];
  return { lines, out: (l) => lines.push(l), err: (l) => lines.push(`ERR ${l}`) };
}

test('no bucket name: refused with a line naming GCS_BUCKET, exit 1, nothing opened', async () => {
  const io = collect();
  let opened = false;
  const code = await main({
    env: {},
    argv: [],
    ...io,
    openBucket: () => {
      opened = true;
    },
  });
  assert.equal(code, 1);
  assert.equal(opened, false);
  assert.match(io.lines.join('\n'), /GCS_BUCKET/);
});

test('an argument is refused (the tool takes none), --help prints the usage and exits 0', async () => {
  const refused = collect();
  assert.equal(await main({ env: { GCS_BUCKET: 'b' }, argv: ['--prefix', 'x'], ...refused }), 1);
  assert.match(refused.lines.join('\n'), /Unknown argument/);
  const help = collect();
  assert.equal(await main({ env: {}, argv: ['--help'], ...help }), 0);
  assert.equal(help.lines.join('\n'), USAGE);
});

test('a service-account key file in the environment is refused: the owner uses their own login (R2)', () => {
  const parsed = parseInvocation(
    { GCS_BUCKET: 'b', GOOGLE_APPLICATION_CREDENTIALS: '/k.json' },
    [],
  );
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /own login/);
  assert.doesNotMatch(parsed.message, /k\.json/, 'the path is never printed');
});

test('a bucket the client cannot open is one plain line with no raw error text and exit 1', async () => {
  const io = collect();
  const code = await main({
    env: { GCS_BUCKET: 'b' },
    argv: [],
    ...io,
    openBucket: () => {
      throw Object.assign(new Error('secret project detail my-project-123'), { code: 403 });
    },
  });
  assert.equal(code, 1);
  const text = io.lines.join('\n');
  assert.match(text, /could not run/);
  assert.doesNotMatch(text, /my-project-123/);
});

test('over the fake bucket every check passes, and nothing is left behind', async () => {
  const bucket = createFakeBucket({ name: 'the-bucket' });
  const io = collect();
  const code = await main({
    env: { GCS_BUCKET: 'the-bucket' },
    argv: [],
    ...io,
    openBucket: () => bucket,
    fetchStatus: async () => 403,
  });
  assert.equal(code, 0, io.lines.join('\n'));
  assert.equal(io.lines.filter((l) => l.startsWith('FAIL')).length, 0);
  assert.ok(
    io.lines.some((l) => l.startsWith('PASS table:')),
    'the fidelity table rows are printed',
  );
  assert.ok(io.lines.at(-1).includes('ALL CHECKS PASSED'));
  assert.equal(bucket.objects.size, 0, 'every object was removed');
});

test('a public object is a failed check, and a refused bucket is counted in the exit code', async () => {
  const bucket = createFakeBucket();
  const publicIo = collect();
  const code = await main({
    env: { GCS_BUCKET: 'b' },
    argv: [],
    ...publicIo,
    openBucket: () => bucket,
    fetchStatus: async () => 200,
  });
  assert.equal(code, 1);
  assert.ok(publicIo.lines.some((l) => /^FAIL AC-11/.test(l)));

  const denied = createFakeBucket();
  denied.failWith(permissionDenied());
  const deniedIo = collect();
  const deniedCode = await main({
    env: { GCS_BUCKET: 'b' },
    argv: [],
    ...deniedIo,
    openBucket: () => denied,
    fetchStatus: async () => 403,
  });
  assert.ok(deniedCode > 1, 'every check fails when the bucket refuses the caller');
});
