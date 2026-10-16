// The real-bucket run for DEP-0 (spec/DEP-0.md r2 AC-8, AC-9, AC-11; plan/DEP-0.md 1.0 step 1): the owner runs it once at DEP-1,
// when Blaze gives a bucket, with their own Google login. It is NOT a verify check and not a *.test.js file, so `npm run verify`
// never runs it and never reports it skipped. DEP-0 writes it and checks only its argument handling and, over the fake bucket,
// its own logic (tools/test/gcs-bucket-check.test.js); it has never touched a real bucket.
//
// What it does, in order, on a real bucket, under keys no service makes (`backdrops/0/0/check-<random>`), removing all of them:
//   - the store's contract against the real client: a write and its read-back (size and SHA-256), a second write on the same key
//     refused with the stored bytes unchanged, two writes started together (exactly one wins), a read, an exists and a remove
//     of a missing object, and a 15 MB object (AC-8, AC-12's size);
//   - the fidelity table of functions/test/fakeBucket.js, row by row, printing what the REAL client answered, so the fake's
//     claims (412 as the number 412, 404 as the number 404) are confirmed or corrected (AC-9);
//   - an unauthenticated request for the object's public URL, which must be refused (AC-11).
// It prints one PASS or FAIL line per check; the exit code is the number of FAIL lines. It reads the bucket name from GCS_BUCKET
// and nothing else, never prints a token or a key path, and uses Application Default Credentials only (the owner's own login:
// `gcloud auth application-default login`); a service-account key file in GOOGLE_APPLICATION_CREDENTIALS is refused, as in
// staging:admin (plan R2).
'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..', 'functions');
const MB = 1024 * 1024;
const LARGEST_BYTES = 15 * MB;
const PUBLIC_REFUSALS = new Set([401, 403, 404]);

const USAGE = [
  'Usage: GCS_BUCKET=<bucket name> npm run gcs:check',
  '',
  'Checks the file store against a REAL Cloud Storage bucket, with your own Google login',
  '(gcloud auth application-default login). It writes and removes objects under backdrops/0/0/check-*.',
  'It takes no arguments. Run by the owner at DEP-1; never by CI and never by npm run verify.',
].join('\n');

/** Parses the environment and arguments; returns { ok: false, message } or { ok: true, bucketName }. */
function parseInvocation(env, argv) {
  if (argv.includes('--help') || argv.includes('-h'))
    return { ok: false, help: true, message: USAGE };
  if (argv.length > 0) {
    return { ok: false, message: `Unknown argument(s): ${argv.join(' ')}\n${USAGE}` };
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      ok: false,
      message:
        'GOOGLE_APPLICATION_CREDENTIALS is set. This check uses your own login only: unset it, then run `gcloud auth application-default login`.',
    };
  }
  const bucketName = (env.GCS_BUCKET ?? '').trim();
  if (bucketName === '') {
    return { ok: false, message: `GCS_BUCKET is not set: name the bucket to check.\n${USAGE}` };
  }
  return { ok: true, bucketName };
}

/**
 * Runs every check and prints its line. `bucket` is the Cloud Storage bucket (or a fake), `fetchStatus` answers the HTTP status of
 * an unauthenticated GET of a URL (injected, so a test never reaches the network).
 * @param {object} io
 * @param {string} io.bucketName
 * @param {{ file: (name: string) => object }} io.bucket
 * @param {(url: string) => Promise<number>} io.fetchStatus
 * @param {(line: string) => void} io.out
 * @returns {Promise<number>} how many checks failed
 */
async function runChecks({ bucketName, bucket, fetchStatus, out }) {
  const { createGcsFileStore } = require(
    path.join(FUNCTIONS_DIR, 'src', 'services', 'storage', 'gcsFileStore.js'),
  );
  const store = createGcsFileStore({ bucket });
  const stamp = crypto.randomBytes(8).toString('hex');
  const keyOf = (name) => `backdrops/0/0/check-${stamp}-${name}`;
  const made = new Set();
  const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
  let failed = 0;

  async function check(label, body) {
    try {
      const detail = await body();
      out(`PASS ${label}${detail ? ` (${detail})` : ''}`);
    } catch (err) {
      failed += 1;
      out(`FAIL ${label}: ${err.message}`);
    }
  }
  const expect = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  out(`Checking bucket "${bucketName}" with keys backdrops/0/0/check-${stamp}-*`);

  await check('put stores the bytes and answers their size and SHA-256', async () => {
    const key = keyOf('basic');
    const bytes = crypto.randomBytes(5000);
    const result = await store.put(key, bytes);
    made.add(key);
    expect(result.sizeBytes === 5000 && result.sha256 === sha(bytes), 'wrong size or hash');
    const back = await store.get(key);
    expect(back && sha(back) === result.sha256, 'the bytes read back differ');
    expect(await store.exists(key), 'exists is false after put');
  });

  await check(
    'a second put on the same key is refused and the stored bytes are unchanged',
    async () => {
      const key = keyOf('twice');
      await store.put(key, Buffer.from('first'));
      made.add(key);
      let refused = false;
      try {
        await store.put(key, Buffer.from('second'));
      } catch {
        refused = true;
      }
      expect(refused, 'the second put was accepted');
      expect((await store.get(key)).toString() === 'first', 'the stored bytes changed');
    },
  );

  await check('two puts started together on one key: exactly one resolves', async () => {
    const key = keyOf('race');
    const settled = await Promise.allSettled([
      store.put(key, Buffer.from('one')),
      store.put(key, Buffer.from('two')),
    ]);
    made.add(key);
    const won = settled.filter((s) => s.status === 'fulfilled').length;
    expect(won === 1, `${won} writes resolved`);
  });

  await check(
    'get is null, exists is false and remove resolves for an object that is not there',
    async () => {
      const key = keyOf('missing');
      expect((await store.get(key)) === null, 'get was not null');
      expect((await store.exists(key)) === false, 'exists was not false');
      await store.remove(key);
    },
  );

  await check('a 15 MB object is stored whole and read back byte for byte', async () => {
    const key = keyOf('largest');
    const bytes = crypto.randomBytes(LARGEST_BYTES);
    await store.put(key, bytes);
    made.add(key);
    const back = await store.get(key);
    expect(back && back.length === LARGEST_BYTES && sha(back) === sha(bytes), 'the bytes differ');
    return `${LARGEST_BYTES} bytes`;
  });

  // The fidelity table of fakeBucket.js, read off the REAL client (AC-9). Each line says what the client answered.
  await check(
    'table: a create-only save on an existing object fails with the NUMBER 412',
    async () => {
      const key = keyOf('twice');
      let code;
      try {
        await bucket
          .file(key)
          .save(Buffer.from('third'), { preconditionOpts: { ifGenerationMatch: 0 } });
      } catch (err) {
        code = err.code;
      }
      expect(
        code === 412,
        `the error code was ${JSON.stringify(code)} (${typeof code}), the fake says the number 412`,
      );
      return `code ${code}`;
    },
  );

  await check('table: a download of a missing object fails with the NUMBER 404', async () => {
    let code;
    try {
      await bucket.file(keyOf('missing')).download();
    } catch (err) {
      code = err.code;
    }
    expect(
      code === 404,
      `the error code was ${JSON.stringify(code)} (${typeof code}), the fake says the number 404`,
    );
    return `code ${code}`;
  });

  await check(
    'table: a delete of a missing object fails with 404, and resolves under ignoreNotFound',
    async () => {
      let code;
      try {
        await bucket.file(keyOf('missing')).delete();
      } catch (err) {
        code = err.code;
      }
      expect(code === 404, `the error code was ${JSON.stringify(code)}, the fake says 404`);
      await bucket.file(keyOf('missing')).delete({ ignoreNotFound: true });
      return `code ${code}`;
    },
  );

  await check('table: exists answers [true] or [false]', async () => {
    const yes = await bucket.file(keyOf('basic')).exists();
    const no = await bucket.file(keyOf('missing')).exists();
    expect(
      Array.isArray(yes) && yes[0] === true && Array.isArray(no) && no[0] === false,
      `answers ${JSON.stringify([yes, no])}`,
    );
  });

  await check(
    'AC-11: the object is not public: an unauthenticated request for its URL is refused',
    async () => {
      const url = `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${keyOf('basic')}`;
      const status = await fetchStatus(url);
      expect(PUBLIC_REFUSALS.has(status), `the public URL answered ${status}`);
      return `HTTP ${status}`;
    },
  );

  out(
    'not checked here: a permission failure (403) and a network failure need a second identity or no network; the fake models both from the library source only.',
  );

  for (const key of made) {
    try {
      await store.remove(key);
    } catch (err) {
      failed += 1;
      out(`FAIL cleanup of ${key}: ${err.message}`);
    }
  }
  out(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
  return failed;
}

/** The real bucket through the same firebase-admin Storage client the API uses (DC-31: one pin, found from functions/). */
function openRealBucket(bucketName) {
  const { adminBucket } = require(
    path.join(FUNCTIONS_DIR, 'src', 'services', 'storage', 'createFileStore.js'),
  );
  return adminBucket(bucketName);
}

/** An unauthenticated GET; the status only, never the body. */
async function realFetchStatus(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return res.status;
}

/**
 * @param {object} [io]
 * @returns {Promise<number>} the exit code
 */
async function main({
  env = process.env,
  argv = process.argv.slice(2),
  out = console.log,
  err = console.error,
  openBucket = openRealBucket,
  fetchStatus = realFetchStatus,
} = {}) {
  const parsed = parseInvocation(env, argv);
  if (!parsed.ok) {
    (parsed.help ? out : err)(parsed.message);
    return parsed.help ? 0 : 1;
  }
  try {
    const failed = await runChecks({
      bucketName: parsed.bucketName,
      bucket: openBucket(parsed.bucketName),
      fetchStatus,
      out,
    });
    return Math.min(failed, 255);
  } catch (error) {
    // The client's text can name the project or the account: one plain line, never the raw error.
    err(
      `The check could not run (${error?.code ?? 'error'}). Sign in again with \`gcloud auth application-default login\`, and check the bucket name and your access to it.`,
    );
    return 1;
  }
}

module.exports = { main, parseInvocation, runChecks, USAGE };
