// The Functions-path probe of `npm run verify` (DEP-0 DC-29; plan/DEP-0.md 1.0 step 7), run inside `firebase emulators:exec --only
// functions,auth` by the functions-health check, after the seed (the Auth emulator imports the seed's export). It is the REAL
// emulator's half of what functions/test/dep0.functionsPath.test.js proves through a platform-shaped host: the emulator reads the
// body before the function, listens on a named pipe and gives the function no socket address.
//
//   0  GET /api/health answers { status: "ok", db: "ok" } with an X-Request-Id (what health-probe.js always checked)
//   i  an anonymous 6 MB JSON POST to /api/venues gets the 413 { error } in JSON, not the platform's 32 MB acceptance (F2a)
//   ii signed in as malladmin@gabay.test on the Auth emulator, a small PNG upload to a seeded DEMO_MALLS venue is 201 (F1),
//      it reads back byte for byte, and POST /clear answers 200
//   iii an anonymous multipart POST to the same route is a JSON 401, not a crash (the body is read and then set aside)
//   iv the audit rows of (ii) hold 127.0.0.1 as the address (F3) and no `body` key (F4)
// FILE_STORE_DIR is a temporary folder (verify sets it), so nothing is left in the repository. The password of the seeded account
// is read from the git-ignored .env and never printed. Exit code: the number of failed steps. Plain CommonJS.
'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');
const { healthUrl, probeOnce } = require('./health-probe');

const ROOT = path.resolve(__dirname, '..');
const HEALTH_TIMEOUT_MS = 90_000;
const POLL_MS = 1_000;
const SIX_MB = 6 * 1024 * 1024;
const SEEDED_EMAIL = 'malladmin@gabay.test';
const PASSWORD_KEY = 'SEED_PW_MALLADMIN';
const TENANT_CODE = 'DEMO_MALLS';

const results = [];
function record(ok, label, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
}

async function waitForHealth(url) {
  const until = Date.now() + HEALTH_TIMEOUT_MS;
  let last = { ok: false, detail: 'never tried' };
  while (Date.now() < until) {
    last = await probeOnce(url);
    if (last.ok || !last.detail.startsWith('not answering')) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  record(last.ok, `GET ${url}`, last.detail);
  return last.ok;
}

/** A small valid PNG header the API accepts (the test fixture builder: header only, 100 x 80). */
const pngBytes = () => require('../functions/test/imageFixtures').pngBytes(100, 80);

/** One fetch; never throws; answers { status, headers, text, bytes, json }. */
async function send(url, init = {}) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, headers: res.headers, text, bytes, json };
  } catch (err) {
    return {
      status: 0,
      headers: new Headers(),
      text: String(err.message),
      bytes: Buffer.alloc(0),
      json: null,
    };
  }
}

async function signIn() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const password = process.env[PASSWORD_KEY];
  if (!host)
    return { error: 'FIREBASE_AUTH_EMULATOR_HOST is not set: the Auth emulator is not running' };
  if (!password) return { error: `${PASSWORD_KEY} is not in .env: run the seed first` };
  const res = await send(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: SEEDED_EMAIL, password, returnSecureToken: true }),
    },
  );
  if (res.status !== 200 || !res.json?.idToken) {
    return {
      error: `sign-in of ${SEEDED_EMAIL} failed (HTTP ${res.status}): the seed's Auth export was not imported; run the seed first`,
    };
  }
  return { token: res.json.idToken };
}

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    /* no .env: the checks below say what is missing */
  }
  const base = healthUrl().replace(/\/health$/, '');
  if (!(await waitForHealth(`${base}/health`))) return finish();

  // i. an anonymous JSON body over the 5 MB limit
  const big = await send(`${base}/venues`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'x', name: 'y'.repeat(SIX_MB) }),
  });
  record(
    big.status === 413 && big.json?.error === 'Request body too large',
    "i. an anonymous 6 MB JSON POST is the API's 413 { error }",
    `HTTP ${big.status} ${big.text.slice(0, 80)}`,
  );

  // iii. an anonymous multipart POST: a JSON 401 (needs no venue)
  const anonForm = new FormData();
  anonForm.append('file', new Blob([pngBytes()]), 'plan.png');
  const anon = await send(`${base}/venues/1/map/backdrops`, { method: 'POST', body: anonForm });
  record(
    anon.status === 401 && typeof anon.json?.error === 'string',
    'iii. an anonymous multipart POST is a JSON 401',
    `HTTP ${anon.status} ${anon.text.slice(0, 80)}`,
  );

  // ii and iv. signed in, on the seeded database
  const session = await signIn();
  if (session.error) {
    record(false, 'ii. sign in as the seeded mall admin', session.error);
    return finish();
  }
  const pg = createRequire(path.join(ROOT, 'functions', 'package.json'))('pg');
  const db = new pg.Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
  try {
    await db.connect();
    const target = (
      await db.query(
        `SELECT t.TenantId AS tenant, v.VenueId AS venue FROM gabay.Tenant t JOIN gabay.Venue v ON v.TenantId = t.TenantId
          WHERE t.Code = $1 ORDER BY v.VenueId LIMIT 1`,
        [TENANT_CODE],
      )
    ).rows[0];
    if (!target) {
      record(false, 'ii. a seeded DEMO_MALLS venue', 'none found: run the seed first');
      return finish();
    }
    const headers = {
      authorization: `Bearer ${session.token}`,
      'x-tenant-id': String(target.tenant),
    };
    const bytes = pngBytes();
    const form = new FormData();
    form.append('file', new Blob([bytes]), 'plan.png');
    const venueUrl = `${base}/venues/${target.venue}/map`;
    const up = await send(`${venueUrl}/backdrops`, { method: 'POST', headers, body: form });
    record(
      up.status === 201 && Number.isInteger(up.json?.width),
      'ii. a PNG upload by the signed-in mall admin is 201',
      `HTTP ${up.status} ${up.text.slice(0, 120)}`,
    );
    if (up.status === 201) {
      const back = await send(`${venueUrl}/backdrops/${up.json.id}`, { headers });
      record(
        back.status === 200 && back.bytes.equals(bytes),
        'ii. the image reads back byte for byte',
        `HTTP ${back.status}`,
      );
    }
    const loaded = await send(venueUrl, { headers });
    const clear = await send(`${venueUrl}/clear`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ baseVersion: loaded.json?.draftVersion ?? 0 }),
    });
    record(
      clear.status === 200,
      'ii. POST /clear answers 200',
      `HTTP ${clear.status} ${clear.text.slice(0, 80)}`,
    );

    // iv. the audit rows of the writes above (the insert is written just after each response: give it a moment)
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const rows = (
      await db.query(
        `SELECT IPAddress AS ip, PayloadDiff AS payload, Route AS route FROM gabay.AuditLog
          WHERE TenantId = $1 AND Method = 'POST' AND Route LIKE $2 ORDER BY AuditLogId DESC LIMIT 2`,
        [target.tenant, `%/venues/${target.venue}/map/%`],
      )
    ).rows;
    record(rows.length >= 1, 'iv. the writes left audit rows', `${rows.length} found`);
    record(
      rows.length >= 1 && rows.every((r) => r.ip === '127.0.0.1'),
      "iv. the audit rows hold the emulator's address 127.0.0.1 (F3)",
      rows.map((r) => r.ip).join(', '),
    );
    record(
      rows.length >= 1 &&
        rows.every((r) => !r.payload.includes('"body"') || /\/clear$/.test(r.route)),
      "iv. no audit row holds the upload's body (F4)",
      rows.map((r) => `${r.route.split('/').pop()}: ${r.payload.slice(0, 50)}`).join(' | '),
    );
  } catch (err) {
    record(false, 'ii. the database step', err.message.split('\n')[0]);
  } finally {
    await db.end().catch(() => {});
  }
  return finish();
}

function finish() {
  const failed = results.filter((ok) => !ok).length;
  console.log(
    failed === 0 ? 'functions path: healthy' : `functions path: ${failed} STEP(S) FAILED`,
  );
  return failed;
}

if (require.main === module) {
  main().then(
    (failed) => process.exit(failed === 0 ? 0 : 1),
    (err) => {
      console.log(`FAIL the probe stopped: ${err.message}`);
      process.exit(1);
    },
  );
}

module.exports = { main };
