// Test support for the seed's tests (plan/FF-2-test-seeds.md section 4; WORKING_AGREEMENT section 5, L151). Not a test file.
//
//   openDb()              one pg client held inside a transaction that close() ALWAYS rolls back: no test ever commits.
//   inTransaction(fn)     the same for one case: a fresh client and transaction, fn(client), then ROLLBACK, always. A case gets
//                         its own transaction (not a savepoint in a shared one) because re-seeding inside one long transaction
//                         gets slower with every run: DELETE FROM Unit visits every dead row (measured in the FF-2 report).
//   nest(client)          the nesting adapter (D2): the seed command's BEGIN, COMMIT and ROLLBACK become SAVEPOINT, RELEASE
//                         and ROLLBACK TO on that client, and end() does nothing, so main()'s real commit, rollback and stop
//                         paths run and nothing is kept. `events` lists what main() asked for, in order.
//   startFakeEmulator()   a fake Identity Toolkit server (D4): accounts:signUp and accounts:signInWithPassword, with
//                         EMAIL_EXISTS and a wrong-password reply; `requests` counts what it received.
//   makeSources()         a temporary sources folder (D3): a copy of the committed demo/ and spike/ files, plus what a case adds.
//                         The real sources/ folder is never written.
//   runMain(...)          the seed command through the adapter; returns { code, out, err, events }.
//   snapshot(client)      row counts and codes per test tenant (keyed by Tenant.Code, so new ids do not matter).
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { main } = require('../seed');
const { TENANT_TABLES } = require('../lib/run');
const { SEED_EMAILS } = require('../lib/accounts');

const REAL_SOURCES = path.join(__dirname, '..', 'sources');
const FIXTURES = path.join(__dirname, 'fixtures', 'exports');
const TENANT_CODES = ['DEMO_MALLS', 'SPIKE_VENUES'];
const SPIKE_UUID = '87872435-5008-4e48-bd54-a7c561c885c3';

/** The client of one test file: PG* come from .env (node --env-file), and the transaction is never committed. */
async function openDb() {
  const client = new Client();
  await client.connect();
  await client.query('BEGIN');
  let closed = false;
  return {
    client,
    async close() {
      if (closed) return;
      closed = true;
      try {
        await client.query('ROLLBACK');
      } finally {
        await client.end();
      }
    },
  };
}

function nest(client) {
  const events = [];
  const stack = [];
  let counter = 0;
  return {
    events,
    async query(text, params) {
      if (text === 'BEGIN') {
        counter += 1;
        stack.push(`seed_main_${counter}`);
        events.push('BEGIN');
        return client.query(`SAVEPOINT ${stack[stack.length - 1]}`);
      }
      if (text === 'COMMIT') {
        events.push('COMMIT');
        return client.query(`RELEASE SAVEPOINT ${stack.pop()}`);
      }
      if (text === 'ROLLBACK') {
        events.push('ROLLBACK');
        const name = stack.pop();
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        return client.query(`RELEASE SAVEPOINT ${name}`);
      }
      return client.query(text, params);
    },
    async end() {},
  };
}

/** One case: a fresh client inside a transaction that is always rolled back (see the header). */
async function inTransaction(fn) {
  const db = await openDb();
  try {
    return await fn(db.client);
  } finally {
    await db.close();
  }
}

/**
 * A fake of the two Identity Toolkit calls the seed makes. `users` preloads email -> password (for the "exists with another
 * password" case). Each user gets a UID that is unique to this server, so a test can compare it with the stored FirebaseUid.
 */
async function startFakeEmulator({ users = {} } = {}) {
  const prefix = `fake-${randomUUID().slice(0, 8)}`;
  const accounts = new Map(Object.entries(users).map(([email, password], i) => [email, { password, uid: `${prefix}-pre${i}` }]));
  const requests = [];
  const reply = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      requests.push({ url: req.url, email: body.email });
      const existing = accounts.get(body.email);
      if (req.url.includes('accounts:signUp')) {
        if (existing) return reply(res, 400, { error: { message: 'EMAIL_EXISTS' } });
        const created = { password: body.password, uid: `${prefix}-${accounts.size}` };
        accounts.set(body.email, created);
        return reply(res, 200, { localId: created.uid, email: body.email });
      }
      if (req.url.includes('accounts:signInWithPassword')) {
        if (!existing) return reply(res, 400, { error: { message: 'EMAIL_NOT_FOUND' } });
        if (existing.password !== body.password) return reply(res, 400, { error: { message: 'INVALID_PASSWORD' } });
        return reply(res, 200, { localId: existing.uid, email: body.email });
      }
      return reply(res, 404, { error: { message: 'NOT_FOUND' } });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    accounts,
    requests,
    host: `127.0.0.1:${server.address().port}`,
    uidOf: (email) => accounts.get(email)?.uid,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Points the seed's Auth calls at a fake for the rest of the process; returns the function that undoes it. */
function useEmulator(fake) {
  const before = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = fake.host;
  return () => {
    if (before === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = before;
  };
}

/**
 * A temporary sources folder holding a copy of demo/ and spike/. `reset({ internal, exports })` then sets what a case adds:
 *   internal  { 'penthouse.json': <object|string> } written to internal/ (omit for no folder)
 *   exports   { 'name.json': <object|string> } written to spike-exports/ (omit for no folder); `exportsFolder: true` with an
 *             empty object makes an empty folder, and the key 'README.md' is written as text
 * An object is written as JSON, a string as it is.
 */
function makeSources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-seed-sources-'));
  fs.cpSync(path.join(REAL_SOURCES, 'demo'), path.join(dir, 'demo'), { recursive: true });
  fs.cpSync(path.join(REAL_SOURCES, 'spike'), path.join(dir, 'spike'), { recursive: true });
  const write = (folder, files) => {
    fs.mkdirSync(path.join(dir, folder), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, folder, name), typeof content === 'string' ? content : JSON.stringify(content));
    }
  };
  return {
    dir,
    reset({ internal, exports } = {}) {
      fs.rmSync(path.join(dir, 'internal'), { recursive: true, force: true });
      fs.rmSync(path.join(dir, 'spike-exports'), { recursive: true, force: true });
      if (internal) write('internal', internal);
      if (exports) write('spike-exports', exports);
    },
    remove: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
const committedSource = (rel) => JSON.parse(fs.readFileSync(path.join(REAL_SOURCES, rel), 'utf8'));

/** The seed command through the adapter. `accounts` false passes --no-accounts. */
async function runMain(client, { sourcesDir, accounts = false } = {}) {
  const nested = nest(client);
  const out = [];
  const err = [];
  const code = await main({
    connect: async () => nested,
    argv: ['node', 'seed.js', ...(accounts ? [] : ['--no-accounts'])],
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    sourcesDir,
  });
  return { code, out, err, events: nested.events };
}

/** Row counts of every table in the seed's delete list plus VenueVersion, and the codes, per test tenant. */
async function snapshot(client) {
  const result = {};
  const tenants = await client.query('SELECT TenantId AS id, Code AS code FROM gabay.Tenant WHERE Code = ANY($1) ORDER BY Code', [TENANT_CODES]);
  for (const t of tenants.rows) {
    const counts = {};
    // Table names come from the seed's own constant list, never from input.
    for (const table of [...TENANT_TABLES, 'VenueVersion']) {
      const n = await client.query(`SELECT count(*) AS n FROM gabay.${table} WHERE TenantId = $1`, [t.id]);
      counts[table] = Number(n.rows[0].n);
    }
    const venues = await client.query('SELECT Code AS code FROM gabay.Venue WHERE TenantId = $1 ORDER BY Code', [t.id]);
    const types = await client.query('SELECT Code AS code FROM gabay.BuildingType WHERE TenantId = $1 ORDER BY Code', [t.id]);
    result[t.code] = { counts, venueCodes: venues.rows.map((r) => r.code), buildingTypeCodes: types.rows.map((r) => r.code) };
  }
  const users = await client.query('SELECT count(*) AS n FROM gabay.AppUser WHERE Email = ANY($1)', [SEED_EMAILS]);
  const shoppers = await client.query('SELECT count(*) AS n FROM gabay.ShopperAccount WHERE Email = ANY($1)', [SEED_EMAILS]);
  result.accounts = { appUsers: Number(users.rows[0].n), shoppers: Number(shoppers.rows[0].n) };
  return result;
}

/** The id of a test tenant, by code. */
async function tenantId(client, code) {
  const r = await client.query('SELECT TenantId AS id FROM gabay.Tenant WHERE Code = $1', [code]);
  return r.rows[0]?.id ?? null;
}

/** An export fixture with changes; `over` is merged at the top level. */
const exportWith = (over, base = 'valid.json') => ({ ...fixture(base), ...over });

module.exports = {
  openDb,
  nest,
  inTransaction,
  startFakeEmulator,
  useEmulator,
  makeSources,
  fixture,
  committedSource,
  exportWith,
  runMain,
  snapshot,
  tenantId,
  SPIKE_UUID,
  TENANT_CODES,
};
