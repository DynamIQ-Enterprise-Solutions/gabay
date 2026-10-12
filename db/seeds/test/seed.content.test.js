'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2): what the seed writes, not only its exit code.
// One seeding in a `before` hook (the committed demo and spike sources, no penthouse, no exports, no accounts), inside a
// transaction that is always rolled back. Covers AC-1, AC-2, AC-3, AC-4, AC-9 (committed sources) and AC-24.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, makeSources, runMain, committedSource, tenantId } = require('./helpers');

// L119 / L120's recorded run (plan.html L120): the test tenant "Demo Malls" holds these totals. They are never re-baselined.
const L120_DEMO_TOTALS = { Level: 66, Unit: 2320, Occupant: 1709, NavConnector: 163 };
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
  assert.ok(columns.length >= 8, `the scan covers the seeded tables (${columns.length} columns found)`);
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

test("AC-9: NeedsReview openings equal the source's unsure or orphan doors; Demo Malls has none", async () => {
  const source = committedSource('spike/mezz.json');
  const drawn = new Set(source.rooms.map((r) => r.id));
  const expected = source.doors.filter((d) => (d.confidence && d.confidence !== 'high') || d.rooms.some((id) => id !== 'OUTSIDE' && !drawn.has(id))).length;
  assert.ok(expected > 0, 'the committed MEZZ office has doors that wait for review (L108, L117)');
  const spike = await tenantId(db.client, 'SPIKE_VENUES');
  const review = await rows('SELECT count(*) AS n FROM gabay.Opening WHERE TenantId = $1 AND NeedsReview', [spike]);
  assert.equal(Number(review[0].n), expected);
  const demo = await tenantId(db.client, 'DEMO_MALLS');
  const none = await rows('SELECT count(*) AS n FROM gabay.Opening WHERE TenantId = $1 AND NeedsReview', [demo]);
  assert.equal(Number(none[0].n), 0);
});

test('AC-24: Demo Malls venues have no georeference (G1)', async () => {
  const id = await tenantId(db.client, 'DEMO_MALLS');
  const venues = await rows('SELECT Code AS code, GeoreferenceJson AS geo FROM gabay.Venue WHERE TenantId = $1 ORDER BY Code', [id]);
  assert.equal(venues.length, 4);
  for (const v of venues) assert.equal(v.geo, null, `${v.code} has no georeference: the test malls run on the fallback`);
});
