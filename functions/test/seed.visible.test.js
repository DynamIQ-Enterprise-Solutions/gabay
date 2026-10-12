'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4, D6; spec/P0-02.md r2): the seeded data seen through FF-1's real routes and
// the development stub (FF-0, FF-SK). The seed (db/seeds/lib/run.js, committed sources only: no penthouse, no exports) is
// written into one rolled-back transaction (savepointDb.js, L151), with the six accounts made through a fake Auth emulator,
// and the real app is mounted over the same connection. Nothing is kept.
//
// Covers AC-12 (malladmin.demo cannot reach Spike Venues, by DEV_STUB_USER_EMAIL and by X-Dev-Act-As), AC-13 (the venue list
// per tenant), AC-14 (every seeded venue, building and level round-trips unchanged, C8) and AC-16 (building types per tenant).
// Requests are awaited one at a time (FF-1 plan G4: one savepoint connection).

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
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
let mallAdmin; // the stub's default account: malladmin@gabay.test
let mallAdminDemo; // the stub's default account: malladmin.demo@gabay.test

/** The app over the transaction's connection, with the stub's default account set to `email`. */
async function mount(email) {
  const logger = fakeLogger();
  const app = createApp({
    config: testConfig({ DEV_STUB_USER_EMAIL: email }),
    db: t.db,
    logger,
    tokenVerifier: { verifyIdToken: async () => assert.fail('FF-1 routes need no token') },
    settings: createSettings((text, params) => t.raw.query(text, params), logger),
  });
  const server = await listen(app);
  servers.push(server);
  return async (method, path, { headers = {}, body } = {}) => {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${server.url}${path}`, init);
    const text = await res.text();
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
  mallAdmin = await mount('malladmin@gabay.test');
  mallAdminDemo = await mount('malladmin.demo@gabay.test');
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

  // By the stub's default account (DEV_STUB_USER_EMAIL).
  const byDefault = await mallAdminDemo('GET', '/api/venues', {
    headers: asTenant('SPIKE_VENUES'),
  });
  assert.equal(byDefault.status, 403);
  // By FF-SK's X-Dev-Act-As, on the app whose default account is malladmin@ (which does hold Spike Venues).
  const byActAs = await mallAdmin('GET', '/api/venues', {
    headers: { ...asTenant('SPIKE_VENUES'), 'x-dev-act-as': 'malladmin.demo@gabay.test' },
  });
  assert.equal(byActAs.status, 403);
  // And the account does reach Demo Malls.
  const own = await mallAdminDemo('GET', `/api/venues${ALL}`, { headers: asTenant('DEMO_MALLS') });
  assert.equal(own.status, 200);
});

test('AC-13: the venue list per tenant: four Demo Malls venues; Spike Venues has MEZZ office and nothing of Demo Malls', async () => {
  const demo = await mallAdmin('GET', `/api/venues${ALL}`);
  assert.equal(demo.status, 200);
  assert.deepEqual(
    demo.body.items.map((v) => v.code).sort(),
    DEMO_CODES,
    'no X-Tenant-Id: the first tenant by code, Demo Malls',
  );
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
  const counted = { venues: 0, buildings: 0, levels: 0 };
  const save = async (path, kind, table, idColumn) => {
    const read = await mallAdmin('GET', path, { headers });
    assert.equal(read.status, 200, `GET ${path}`);
    const before = await stored(table, idColumn, read.body.id);
    const put = await mallAdmin('PUT', path, { headers, body: read.body });
    assert.equal(put.status, 200, `PUT ${path}: ${JSON.stringify(put.body)}`);
    assert.deepEqual(
      await stored(table, idColumn, read.body.id),
      before,
      `${kind} ${read.body.id}: every column but UpdatedAt and UpdatedBy is unchanged`,
    );
    counted[kind === 'venue' ? 'venues' : kind === 'building' ? 'buildings' : 'levels'] += 1;
    return read.body;
  };
  const list = async (path) => {
    const res = await mallAdmin('GET', `${path}${ALL}`, { headers });
    assert.equal(res.status, 200, path);
    return res.body.items;
  };

  for (const summary of await list('/api/venues')) {
    const venueBefore = await stored('Venue', 'VenueId', summary.id);
    await save(`/api/venues/${summary.id}`, 'venue', 'Venue', 'VenueId');
    for (const building of await list(`/api/venues/${summary.id}/buildings`)) {
      await save(`/api/buildings/${building.id}`, 'building', 'Building', 'BuildingId');
      for (const level of await list(`/api/buildings/${building.id}/levels`))
        await save(`/api/levels/${level.id}`, 'level', 'Level', 'LevelId');
    }
    for (const level of await list(`/api/venues/${summary.id}/outdoor-levels`))
      await save(`/api/levels/${level.id}`, 'level', 'Level', 'LevelId');
    assert.deepEqual(
      await stored('Venue', 'VenueId', summary.id),
      venueBefore,
      `venue ${summary.code}: the row, boundary included, is unchanged after its levels' saves`,
    );
  }
  return counted;
}

for (const [code, expected] of [
  ['DEMO_MALLS', { venues: 4 }],
  ['SPIKE_VENUES', { venues: 1 }],
]) {
  test(`AC-14: every seeded venue, building and level of ${code} reads and saves back unchanged`, async () => {
    const counted = await roundTrip(code);
    const [db] = await rows(
      `SELECT (SELECT count(*) FROM gabay.Venue WHERE TenantId = $1)::int AS venues, (SELECT count(*) FROM gabay.Building WHERE TenantId = $1)::int AS buildings,
              (SELECT count(*) FROM gabay.Level WHERE TenantId = $1)::int AS levels`,
      [tenants[code]],
    );
    assert.equal(db.venues, expected.venues);
    assert.deepEqual(
      counted,
      db,
      'every seeded row of the tenant was read and saved, none skipped',
    );
    assert.ok(db.buildings > 0 && db.levels > 0);
  });
}
