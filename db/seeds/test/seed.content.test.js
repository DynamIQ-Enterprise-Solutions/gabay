'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2): what the seed writes, not only its exit code.
// One seeding in a `before` hook (the committed demo and spike sources, no penthouse, no exports, no accounts), inside a
// transaction that is always rolled back. Covers AC-1, AC-2, AC-3, AC-4 (committed sources).
//
// CHANGED BY OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 4; spec/OA-3.md r2 section 5.2, AC-12a): schema 0.17 drops the
// geometry tables, and spec/P0-02.md r3 withdraws the Level, Unit and NavConnector counts of AC-2, AC-9 (NeedsReview) and
// AC-24 (the georeference column), which OA-3c's AC-19, AC-21 and AC-24 take back on the documents. AC-2 keeps the 1,709
// stores. AC-3's scan finds 7 columns now (Tenant, Venue, Occupant x2, Sentinel, Holiday, MallEvent). New: the interim seed
// of AC-12a (the U<n> and L1 keys, no map row), the five routing settings of AC-7, and the seeded blocking object types
// against the database's size rule (the owner's I2 (b), as read on 2026-10-16).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, makeSources, runMain, committedSource, tenantId } = require('./helpers');
const { DEFAULTS } = require('../../../functions/src/config/settings');

// L119 / L120's recorded run (plan.html L120): the test tenant "Demo Malls" holds these totals. They are never re-baselined.
// The Level, Unit and NavConnector totals (66, 2,320, 163) are withdrawn by P0-02 r3 and return in OA-3c's AC-19.
const L120_DEMO_TOTALS = { Occupant: 1709 };
const ELEMENT_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const DEMO_CODES = ['AURORA', 'BAYVIEW', 'MERIDIAN', 'SPIRE'];
const DEMO_SOURCES = ['aurora', 'bayview', 'meridian', 'spire'];
const SPIKE_UUID = '87872435-5008-4e48-bd54-a7c561c885c3';

let db;
let sources;
let ran;

before(async () => {
  db = await openDb();
  sources = makeSources();
  sources.reset();
  ran = await runMain(db.client, { sourcesDir: sources.dir });
});

after(async () => {
  await db?.close();
  sources?.remove();
});

const rows = async (text, params = []) => (await db.client.query(text, params)).rows;
const count = async (table, id) => Number((await rows(`SELECT count(*) AS n FROM gabay.${table} WHERE TenantId = $1`, [id]))[0].n);

test('the seeding itself ran and committed (the rest of this file reads what it wrote)', () => {
  assert.equal(ran.code, 0, ran.err.join('\n'));
  assert.deepEqual(ran.events, ['BEGIN', 'COMMIT']);
});

test('AC-1: Demo Malls has the four venues and no beacon', async () => {
  const [tenant] = await rows('SELECT TenantId AS id, Name AS name, BeaconProximityUuid AS uuid FROM gabay.Tenant WHERE Code = $1', ['DEMO_MALLS']);
  assert.equal(tenant.name, 'Demo Malls');
  assert.equal(tenant.uuid, null);
  const venues = await rows('SELECT Code AS code, Name AS name FROM gabay.Venue WHERE TenantId = $1 ORDER BY Code', [tenant.id]);
  assert.deepEqual(
    venues.map((v) => v.code),
    DEMO_CODES,
  );
  for (const [i, source] of DEMO_SOURCES.entries()) {
    assert.equal(venues[i].name, committedSource(`demo/${source}.json`).name, `${venues[i].code} is named as in its source`);
  }
  assert.equal(await count('Beacon', tenant.id), 0);
});

test("AC-2: Demo Malls totals equal L120's recorded run", async () => {
  const id = await tenantId(db.client, 'DEMO_MALLS');
  for (const [table, expected] of Object.entries(L120_DEMO_TOTALS)) {
    const actual = await count(table, id);
    assert.equal(actual, expected, `${table}: ${actual}, expected ${expected}. This differs from L120's recorded run: report to the product owner, never re-baseline`);
  }
});

test('AC-3: no seeded name contains IMAX', async () => {
  // Every Name and SearchKeywords column of a table that carries TenantId (D11), then the tenants' own names.
  const columns = await rows(
    `SELECT c.table_name AS tablename, c.column_name AS columnname
       FROM information_schema.columns c
      WHERE c.table_schema = 'gabay' AND lower(c.column_name) IN ('name', 'searchkeywords')
        AND EXISTS (SELECT 1 FROM information_schema.columns t
                     WHERE t.table_schema = 'gabay' AND t.table_name = c.table_name AND lower(t.column_name) = 'tenantid')`,
  );
  assert.ok(columns.length >= 7, `the scan covers the seeded tables (${columns.length} columns found)`);
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) {
    const id = await tenantId(db.client, code);
    for (const c of columns) {
      // Table and column names come from information_schema above, never from input.
      const hits = await rows(`SELECT count(*) AS n FROM gabay.${c.tablename} WHERE TenantId = $1 AND ${c.columnname} ILIKE '%imax%'`, [id]);
      assert.equal(Number(hits[0].n), 0, `${code} ${c.tablename}.${c.columnname} has no "IMAX"`);
    }
  }
  const tenantNames = await rows("SELECT count(*) AS n FROM gabay.Tenant WHERE Code IN ('DEMO_MALLS', 'SPIKE_VENUES') AND Name ILIKE '%imax%'");
  assert.equal(Number(tenantNames[0].n), 0);
});

test("AC-4: MEZZ office and its beacons are mezz.json's", async () => {
  const [tenant] = await rows('SELECT TenantId AS id, Name AS name, BeaconProximityUuid AS uuid FROM gabay.Tenant WHERE Code = $1', ['SPIKE_VENUES']);
  assert.equal(tenant.name, 'Spike Venues');
  assert.equal(tenant.uuid, SPIKE_UUID);
  const source = committedSource('spike/mezz.json');
  const [venue] = await rows('SELECT VenueId AS id, Name AS name FROM gabay.Venue WHERE TenantId = $1 AND Code = $2', [tenant.id, 'MEZZ_OFFICE']);
  assert.equal(venue.name, source.name);
  const beacons = await rows(
    `SELECT b.Major AS major, b.Minor AS minor, b.IdentityScheme AS scheme, m.Code AS model, b.MeasuredPower AS power
       FROM gabay.Beacon b JOIN gabay.BeaconModel m ON m.BeaconModelId = b.BeaconModelId
      WHERE b.TenantId = $1 AND b.VenueId = $2 ORDER BY b.Minor`,
    [tenant.id, venue.id],
  );
  const expected = source.beacons.map((b) => b.minor).sort((a, b) => a - b);
  assert.deepEqual(
    beacons.map((b) => b.minor),
    expected,
  );
  for (const b of beacons) {
    assert.equal(b.major, 2);
    assert.equal(b.scheme, 'IBEACON_STATIC');
    assert.equal(b.model, 'MOKO_H2');
    assert.equal(b.power, source.model.rssiAt1mDbm, 'MeasuredPower is the value at 1 m (C6), not the H2 transmit power');
  }
});

// ---- OA-3a: the interim seed (spec/OA-3.md r2 AC-12a), the routing settings (AC-7), the object types (I2 (b)) ----------

/** Independent of the seed: a demo source's stores (store and box places with a positive rectangle), in source order. */
const demoStores = (source) =>
  source.places.filter(
    (p) => (p.kind === 'store' || p.kind === 'box') && Math.abs(p.rect[2] - p.rect[0]) > 0 && Math.abs(p.rect[3] - p.rect[1]) > 0,
  );
/** Independent of the seed: a spike source's store rooms (the six store categories), in source order. */
const spikeStores = (source) =>
  (source.rooms ?? []).filter((r) => ['books', 'food', 'fashion', 'tech', 'services', 'other'].includes(r.category));

test('AC-12a: every store is an Occupant whose interim UnitKey is U1, U2, ... per venue, in source order; each key matches ELEMENT_KEY', async () => {
  const venues = [
    ...DEMO_SOURCES.map((s) => ['DEMO_MALLS', s.toUpperCase(), committedSource(`demo/${s}.json`), demoStores]),
    ['SPIKE_VENUES', 'MEZZ_OFFICE', committedSource('spike/mezz.json'), spikeStores],
  ];
  let total = 0;
  for (const [tenant, code, source, storesOf] of venues) {
    const id = await tenantId(db.client, tenant);
    const stores = await rows(
      `SELECT o.UnitKey AS key, o.Name AS name FROM gabay.Occupant o JOIN gabay.Venue v ON v.VenueId = o.VenueId AND v.TenantId = o.TenantId
        WHERE o.TenantId = $1 AND v.Code = $2 ORDER BY o.OccupantId`,
      [id, code],
    );
    const expected = storesOf(source);
    assert.ok(expected.length > 0, `${code} has stores`);
    assert.deepEqual(
      stores.map((s) => s.key),
      expected.map((_, i) => `U${i + 1}`),
      `${code}: U1 to U${expected.length}, one per store, in source order`,
    );
    assert.deepEqual(
      stores.map((s) => s.name),
      expected.map((p) => p.name.replace(/IMAX/g, 'Vista Max')),
      `${code}: each key is on its own store`,
    );
    for (const s of stores) assert.match(s.key, ELEMENT_KEY);
    if (tenant === 'DEMO_MALLS') total += stores.length;
  }
  assert.equal(total, L120_DEMO_TOTALS.Occupant, 'the 1,709 stores of L120, keys included');
});

test("AC-12a: MEZZ office's beacons sit on the interim level key L1; no seeded venue has a map row", async () => {
  const spike = await tenantId(db.client, 'SPIKE_VENUES');
  const keys = await rows('SELECT DISTINCT LevelKey AS key FROM gabay.Beacon WHERE TenantId = $1', [spike]);
  assert.deepEqual(keys, [{ key: 'L1' }]);
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) {
    const id = await tenantId(db.client, code);
    const maps = await rows('SELECT count(*)::int AS n FROM gabay.VenueMap WHERE TenantId = $1', [id]);
    assert.equal(maps[0].n, 0, `${code}: no VenueMap row (OA-3c writes the documents)`);
  }
  const retired = await rows(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'gabay' AND table_name IN ('building', 'level', 'unit', 'opening', 'floorobject', 'amenity', 'navconnector')`,
  );
  assert.equal(retired[0].n, 0, 'no geometry table exists to hold a seeded row');
});

test('AC-7: the five routing settings are platform GlobalSetting rows holding the API defaults as text; routing.stairsSaveM is not seeded', async () => {
  const settings = await rows(
    "SELECT SettingKey AS key, SettingValue AS value FROM gabay.GlobalSetting WHERE TenantId IS NULL AND SettingKey LIKE 'routing.%' ORDER BY SettingKey",
  );
  const expected = Object.entries(DEFAULTS)
    .filter(([key]) => key.startsWith('routing.'))
    .map(([key, value]) => ({ key, value: String(value) }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  assert.deepEqual(
    expected.map((s) => s.key),
    ['routing.otherWayMarginS', 'routing.stairsSaveS', 'routing.stepFreeMinWidthM', 'routing.storeCrossingFactor', 'routing.walkSpeedMps'],
    "P0-03 r5 AC-120's five keys",
  );
  assert.deepEqual(settings, expected);
});

test("AC-7: the four platform connector types carry P0-03 r5 AC-101's pairs, in seconds", async () => {
  const types = await rows(
    'SELECT Code AS code, CostModel AS model, CostBaseS::text AS base, CostPerRiseS::text AS rise FROM gabay.ConnectorType WHERE TenantId IS NULL ORDER BY Code',
  );
  assert.deepEqual(types, [
    { code: 'ELEVATOR', model: 'ELEVATOR', base: '4.000', rise: '0.400' },
    { code: 'ESCALATOR', model: 'ESCALATOR', base: '1.000', rise: '0.800' },
    { code: 'RAMP', model: 'RAMP', base: '1.000', rise: '1.000' },
    { code: 'STAIRS', model: 'STAIRS', base: '1.500', rise: '1.100' },
  ]);
});

test('I2 (b), owner ruling 2026-10-16: every seeded object type that blocks walking passes the size rule (no default of 0 or less), and the database holds that rule', async () => {
  const blocking = await rows(
    `SELECT Code AS code, DefaultWidthM::text AS w, DefaultDepthM::text AS d, IsRound AS round
       FROM gabay.ObjectType WHERE TenantId IS NULL AND BlocksWalk ORDER BY Code`,
  );
  assert.ok(blocking.length >= 3, `the seeded blocking types are read (${blocking.length})`);
  for (const t of blocking) {
    const ok = (t.w === null || Number(t.w) > 0) && (t.round || t.d === null || Number(t.d) > 0);
    assert.ok(ok, `${t.code}: no default size of 0 or less (w ${t.w}, d ${t.d})`);
  }
  const check = await rows(
    `SELECT pg_get_constraintdef(k.oid) AS def FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'gabay' AND k.conname = 'ck_objecttype_blockingsize'`,
  );
  assert.equal(check.length, 1, 'CK_ObjectType_BlockingSize is on the real database');
});
