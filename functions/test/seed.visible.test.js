'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4, D6; spec/P0-02.md r2): the seeded data seen through FF-1's real routes and
// the real sign-in chain (SEC-1: each seeded account signs in with its own Firebase UID through a verifier double, and
// every request names its tenant in X-Tenant-Id; there is no stub and no default tenant). The seed (db/seeds/lib/run.js, committed sources only: no penthouse, no exports) is
// written into one rolled-back transaction (savepointDb.js, L151), with the six accounts made through a fake Auth emulator,
// and the real app is mounted over the same connection. Nothing is kept.
//
// Covers AC-12 (malladmin.demo cannot reach Spike Venues: its own token there is 403), AC-13 (the venue list
// per tenant), AC-14 (every seeded venue round-trips unchanged, C8) and AC-16 (building types per tenant).
// Requests are awaited one at a time (FF-1 plan G4: one savepoint connection).
//
// CHANGED BY OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-42, spec section 4): the building and level
// routes retired, so AC-14's walk of the seeded buildings and levels goes; the venue walk stays (the venue row, its
// boundary and MapUpDeg included, is unchanged by a save). OA-3 adds the map walk (H-5).

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createAuditTrail } = require('../src/middleware/auditTrail');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { tokenVerifier, asHeaders, withDefaults } = require('./adminAccess');
const { openSavepointDb } = require('./savepointDb');
const { runSeed } = require('../../db/seeds/lib/run');
const { makeSources, startFakeEmulator, useEmulator } = require('../../db/seeds/test/helpers');

const DEMO_CODES = ['AURORA', 'BAYVIEW', 'MERIDIAN', 'SPIRE'];
const PLATFORM_TYPES = ['ANNEX', 'MAIN', 'PARKING', 'WING'];
const DEMO_OWN_TYPES = ['ARENA', 'OPEN_AIR', 'STATION']; // the README's: open-air, arena, station (D12)
const ALL = '?pageSize=200';

let t;
let sources;
let servers;
let tenants; // code -> id
let mallAdmin; // signed in as malladmin@gabay.test
let mallAdminDemo; // signed in as malladmin.demo@gabay.test
let verifier;

/**
 * A caller signed in as the seeded account `email` (its token maps to its own AppUser.FirebaseUid), over the app on the
 * transaction's connection. The tenant is the test's X-Tenant-Id (asTenant), and nothing else.
 */
async function signedIn(email) {
  const [account] = await rows('SELECT FirebaseUid AS uid FROM gabay.AppUser WHERE Email = $1', [
    email,
  ]);
  assert.ok(account, email);
  const token = verifier.add(`tok-seed-${email}`, account.uid);
  const logger = fakeLogger();
  // SEC-2 AC-26 (plan C1): this test builds its own app over one rolled-back connection, so it builds the audit trail too and
  // waits on settled() after each response: a write's audit row must not land inside a later savepoint.
  const auditTrail = createAuditTrail({ db: t.db, logger });
  const app = createApp({
    config: testConfig(),
    db: t.db,
    logger,
    auditTrail,
    tokenVerifier: verifier,
    settings: createSettings((text, params) => t.raw.query(text, params), logger),
  });
  const server = await listen(app);
  servers.push(server);
  return async (method, path, { headers = {}, body } = {}) => {
    const init = { method, headers: withDefaults(asHeaders(token), headers) };
    if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${server.url}${path}`, init);
    const text = await res.text();
    await auditTrail.settled();
    return { status: res.status, body: text === '' ? null : JSON.parse(text) };
  };
}

const rows = async (text, params = []) => (await t.raw.query(text, params)).rows;
const asTenant = (code) => ({ 'x-tenant-id': String(tenants[code]) });

before(async () => {
  servers = [];
  t = await openSavepointDb();
  // Other test files insert the roles this seed writes, in their own transactions. A table lock taken first makes them wait
  // for this file's transaction instead of crossing it in the unique index (two inserts in opposite orders would deadlock).
  await t.raw.query('LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE', []);
  sources = makeSources();
  sources.reset();
  const fake = await startFakeEmulator();
  const restore = useEmulator(fake);
  try {
    await runSeed(t.raw, { sourcesDir: sources.dir, withAccounts: true, log: () => {} });
  } finally {
    restore();
    await fake.close();
  }
  tenants = Object.fromEntries(
    (
      await rows('SELECT Code AS code, TenantId AS id FROM gabay.Tenant WHERE Code = ANY($1)', [
        ['DEMO_MALLS', 'SPIKE_VENUES'],
      ])
    ).map((r) => [r.code, r.id]),
  );
  verifier = tokenVerifier();
  mallAdmin = await signedIn('malladmin@gabay.test');
  mallAdminDemo = await signedIn('malladmin.demo@gabay.test');
});

after(async () => {
  for (const s of servers ?? []) await s.close();
  await t?.close();
  sources?.remove();
});

test('AC-12: malladmin.demo has no role or grant in Spike Venues, and the venue list refuses it there (403)', async () => {
  const held = await rows(
    `SELECT (SELECT count(*) FROM gabay.UserRole ur JOIN gabay.AppUser u ON u.UserId = ur.UserId WHERE u.Email = $1 AND ur.TenantId = $2)::int AS roles,
            (SELECT count(*) FROM gabay.UserVenueGrant g JOIN gabay.AppUser u ON u.UserId = g.UserId WHERE u.Email = $1 AND g.TenantId = $2)::int AS grants`,
    ['malladmin.demo@gabay.test', tenants.SPIKE_VENUES],
  );
  assert.deepEqual(held[0], { roles: 0, grants: 0 });

  // CHANGED BY SEC-1 (C1): signed in as itself (the stub's DEV_STUB_USER_EMAIL and X-Dev-Act-As are gone).
  const own403 = await mallAdminDemo('GET', '/api/venues', {
    headers: asTenant('SPIKE_VENUES'),
  });
  assert.equal(own403.status, 403);
  assert.deepEqual(own403.body, { error: 'This account has no access to that tenant' });
  // malladmin@ does hold Spike Venues: the refusal is malladmin.demo's, not the tenant's
  assert.equal(
    (await mallAdmin('GET', '/api/venues', { headers: asTenant('SPIKE_VENUES') })).status,
    200,
  );
  // And the account does reach Demo Malls.
  const own = await mallAdminDemo('GET', `/api/venues${ALL}`, { headers: asTenant('DEMO_MALLS') });
  assert.equal(own.status, 200);
});

test('AC-13: the venue list per tenant: four Demo Malls venues; Spike Venues has MEZZ office and nothing of Demo Malls', async () => {
  // CHANGED BY SEC-1 (C1): the tenant is named (there is no default tenant; no header is 400, AC-3).
  const demo = await mallAdmin('GET', `/api/venues${ALL}`, { headers: asTenant('DEMO_MALLS') });
  assert.equal(demo.status, 200);
  assert.deepEqual(demo.body.items.map((v) => v.code).sort(), DEMO_CODES, 'Demo Malls');
  assert.equal((await mallAdmin('GET', `/api/venues${ALL}`)).status, 400, 'no X-Tenant-Id: 400');
  assert.equal(demo.body.totalCount, 4);
  const spike = await mallAdmin('GET', `/api/venues${ALL}`, { headers: asTenant('SPIKE_VENUES') });
  assert.equal(spike.status, 200);
  assert.deepEqual(
    spike.body.items.map((v) => v.code),
    ['MEZZ_OFFICE'],
    'the penthouse and the owner exports are absent from this test sources (AC-6 and AC-8 cover them)',
  );
});

test('AC-16: building types: Demo Malls has the platform rows and its own three; Spike Venues the platform rows only', async () => {
  const codes = async (tenant) => {
    const res = await mallAdmin('GET', `/api/lookups/building-types${ALL}`, {
      headers: asTenant(tenant),
    });
    assert.equal(res.status, 200);
    return res.body.items.map((r) => r.code).sort();
  };
  assert.deepEqual(await codes('DEMO_MALLS'), [...PLATFORM_TYPES, ...DEMO_OWN_TYPES].sort());
  assert.deepEqual(await codes('SPIKE_VENUES'), PLATFORM_TYPES);
});

// ---- AC-14: every seeded row round-trips ------------------------------------------------------------------------------

/** One stored row as JSON, without the two audit stamps a save always changes (C8). */
async function stored(table, idColumn, id) {
  // Table and id column are this file's literals below, never input.
  const r = await rows(
    `SELECT to_jsonb(x) - 'updatedat' - 'updatedby' AS row FROM gabay.${table} x WHERE ${idColumn} = $1`,
    [id],
  );
  return r[0].row;
}

async function roundTrip(tenantCode) {
  const headers = asTenant(tenantCode);
  let venues = 0;
  const list = await mallAdmin('GET', `/api/venues${ALL}`, { headers });
  assert.equal(list.status, 200, 'GET /api/venues');
  for (const summary of list.body.items) {
    const path = `/api/venues/${summary.id}`;
    const read = await mallAdmin('GET', path, { headers });
    assert.equal(read.status, 200, `GET ${path}`);
    const before = await stored('Venue', 'VenueId', read.body.id);
    const put = await mallAdmin('PUT', path, { headers, body: read.body });
    assert.equal(put.status, 200, `PUT ${path}: ${JSON.stringify(put.body)}`);
    assert.deepEqual(
      await stored('Venue', 'VenueId', read.body.id),
      before,
      `venue ${summary.code}: every column but UpdatedAt and UpdatedBy is unchanged (the boundary and the map up angle included, AC-43)`,
    );
    venues += 1;
  }
  return { venues };
}

for (const [code, expected] of [
  ['DEMO_MALLS', { venues: 4 }],
  ['SPIKE_VENUES', { venues: 1 }],
]) {
  test(`AC-14: every seeded venue of ${code} reads and saves back unchanged`, async () => {
    const counted = await roundTrip(code);
    const [db] = await rows(
      `SELECT (SELECT count(*) FROM gabay.Venue WHERE TenantId = $1)::int AS venues`,
      [tenants[code]],
    );
    assert.equal(db.venues, expected.venues);
    assert.deepEqual(
      counted,
      db,
      'every seeded venue of the tenant was read and saved, none skipped',
    );
  });
}

// ---- OA-3a (spec/OA-3.md r2 AC-12a; plan/OA-3a-migration-rekey.md 1.1 section 1): the interim seed's state ----------------
// Until OA-3c writes the documents, every seeded venue has no map row, so GET .../map answers the empty shape, and every key
// the seed wrote (the stores' U<n>, the beacons' L1) reads `removed` through the one loader (AC-11). New cases; the cases
// above are unchanged.
const { loadKeyIndexes } = require('../src/services/mapStorage/keyIndexes');
const { keyStatus } = require('../src/services/venueMap');

test('AC-12a: every seeded venue of both tenants answers the empty map shape (no draft, version 0, never published)', async () => {
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) {
    const headers = asTenant(code);
    const list = await mallAdmin('GET', `/api/venues${ALL}`, { headers });
    assert.equal(list.status, 200);
    assert.ok(list.body.items.length > 0);
    for (const v of list.body.items) {
      const map = await mallAdmin('GET', `/api/venues/${v.id}/map`, { headers });
      assert.equal(map.status, 200, `${v.code}: ${JSON.stringify(map.body)}`);
      assert.equal(map.body.draft, null, `${v.code}: no draft`);
      assert.equal(map.body.draftVersion, 0);
      assert.equal(map.body.publishedVersion, null);
      assert.deepEqual(map.body.versions, []);
    }
  }
});

test("AC-12a: every key the interim seed wrote reads removed through the key-status loader (OA-3c's documents make them pending)", async () => {
  const keyed = await rows(
    `SELECT TenantId AS t, VenueId AS v, UnitKey AS key, 'unit' AS kind FROM gabay.Occupant WHERE TenantId = ANY($1)
     UNION ALL
     SELECT TenantId, VenueId, LevelKey, 'level' FROM gabay.Beacon WHERE TenantId = ANY($1)`,
    [[tenants.DEMO_MALLS, tenants.SPIKE_VENUES]],
  );
  assert.ok(keyed.length > 1709, `the seeded keys are read (${keyed.length})`);
  const byVenue = new Map();
  for (const k of keyed) {
    if (!byVenue.has(k.v)) byVenue.set(k.v, await loadKeyIndexes(t.raw, k.t, k.v));
    const indexes = byVenue.get(k.v);
    assert.equal(
      keyStatus(k.key, k.kind, indexes.draftIndex, indexes.publishedIndex),
      'removed',
      `${k.kind} ${k.key}`,
    );
  }
});
