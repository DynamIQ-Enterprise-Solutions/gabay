'use strict';

// OA-3a (spec/OA-3.md r2 AC-3, AC-4, AC-5, AC-6, AC-7, EC-1, EC-12, EC-21, EC-23; plan/OA-3a-migration-rekey.md 1.1 items
// 1 and 4, section 5): migration 0003, schema 0.16 -> 0.17, the first migration that drops tables. Every database state is
// built in ONE scratch database (scratchDb.js: created for this file, dropped at its end; the working copy's own database is
// never written) by emptying the gabay schema and running a schema file, then every migration (setup-db's order):
//
//   AC-4.1  0.16 (the frozen fixture, d896a28) holding rows in every re-keyed table: after the migrations the catalog
//           fingerprint equals a fresh 0.17, every re-keyed column holds the decimal text of the old id, no row moved
//           between tenants or venues, the rows without a key column are untouched, and no VenueVersion or StoredFile was
//           written. Its versions are BUILDING and FAILED, which do not stop 0003 (EC-21).
//   AC-7    the same database: every ConnectorType row, a tenant's included, carries its CostModel's pair in seconds.
//   AC-4.2  the migrations run twice: nothing changes. AC-4.3: a fresh 0.17 plus the migrations: nothing changes.
//   AC-4.4  the half state: 0.17's schema.sql over a 0.16 database, then the migrations: a fresh 0.17.
//   AC-4.5  0.14 and 0.15 databases take every migration in order and equal a fresh 0.17.
//   AC-5    a 0.16 database holding a PUBLISHED version: 0003 stops with the message naming setup-db, nothing changed.
//   I2 (b)  a 0.16 database holding a blocking object type with a default size of 0: 0003 stops naming it, nothing
//           changed; on 0.17 the database refuses a blocking type's default of 0 or less and accepts NULL defaults.
//
// "Exactly 0.17" is the catalog fingerprint (schemaFingerprint.js): columns ranked within their table (a dropped column
// leaves a gap in ordinal_position), every constraint, index, trigger and function body. A control at the end proves it
// sees the two differences 0003 has to get right: a NOT NULL constraint's name and a key CHECK's text.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  runMigrations,
  readMigrations,
  MIGRATIONS_DIR,
  NAME_PATTERN,
} = require('../lib/migrations');
const { withScratchDatabase, migrationsThrough } = require('./scratchDb');
const { fingerprint, difference, quiet } = require('./schemaFingerprint');

const FILE = '0003_retire_geometry_rekey_keys.sql';
const RETIRED = [
  'Building',
  'Level',
  'Unit',
  'Opening',
  'FloorUnderlay',
  'FloorObject',
  'Amenity',
  'TransitPoint',
  'Anchor',
  'NavConnector',
  'NavConnectorStop',
  'NavCorrection',
];
const NONE = { onlyFirst: [], onlySecond: [] };
/** spec/P0-03.md r5 AC-101's pairs, written out here independently of the migration's own VALUES list. */
const SECONDS = {
  ELEVATOR: ['4.000', '0.400'],
  STAIRS: ['1.500', '1.100'],
  ESCALATOR: ['1.000', '0.800'],
  RAMP: ['1.000', '1.000'],
};

const migrate = (client) => quiet(() => runMigrations(client));
const THROUGH_0002 = migrationsThrough(2);

/**
 * Each re-keyed table: how to order its rows, and its element columns before (0.16) and after (0.17). Table and column
 * names are this file's constants.
 */
const REKEYED = [
  ['Occupant', 'OccupantId', ['UnitId'], ['UnitKey']],
  ['StoreStatusChange', 'StoreStatusChangeId', ['UnitId'], ['UnitKey']],
  ['Beacon', 'BeaconId', ['LevelId'], ['LevelKey']],
  ['BeaconPlan', 'BeaconPlanId', ['LevelId'], ['LevelKey']],
  ['Sentinel', 'SentinelId', ['LevelId'], ['LevelKey']],
  ['Closure', 'ClosureId', ['LevelId', 'NavConnectorId'], ['LevelKey', 'ConnectorKey']],
  ['AnalyticsEvent', 'AnalyticsEventId', ['UnitId'], ['UnitKey']],
  ['AnalyticsDailyUnit', 'VenueVersionId, Day', ['UnitId'], ['UnitKey']],
  ['Forecast', 'ForecastId', ['UnitId'], ['UnitKey']],
  [
    'AnalyticsDailyCell',
    'AnalyticsDailyCellId',
    ['LevelId', 'DestinationUnitId'],
    ['LevelKey', 'DestinationUnitKey'],
  ],
];

/** One line per row of every re-keyed table: tenant, venue and each element column as text ('-' for NULL). */
async function keyLines(client, which) {
  const out = [];
  for (const [table, order, before, after] of REKEYED) {
    const cols = which === 'before' ? before : after;
    const text = cols.map((c) => `coalesce(${c}::text, '-')`).join(` || ' ' || `);
    const { rows } = await client.query(
      `SELECT TenantId || '/' || VenueId || ' ' || ${text} AS line FROM gabay.${table} ORDER BY ${order}`,
    );
    out.push(...rows.map((r) => `${table} ${r.line}`));
  }
  return out;
}

/** A hash of the rows that carry no element key and must not change. */
async function untouchedHash(client) {
  const { rows } = await client.query(
    `SELECT md5(string_agg(x, '|' ORDER BY x)) AS h FROM (
       SELECT 'T' || TenantId || Code || Name || coalesce(BeaconProximityUuid::text, '-') AS x FROM gabay.Tenant
       UNION ALL SELECT 'V' || VenueId || TenantId || Code || Name || IsActive FROM gabay.Venue
       UNION ALL SELECT 'O' || OccupantId || Name || StoreStatusId || IsActive FROM gabay.Occupant
       UNION ALL SELECT 'B' || BeaconId || Major || Minor || X || Y FROM gabay.Beacon
       UNION ALL SELECT 'VV' || VenueVersionId || Status || VersionNo FROM gabay.VenueVersion
       UNION ALL SELECT 'OT' || ObjectTypeId || Code || BlocksWalk || coalesce(DefaultWidthM::text, '-') FROM gabay.ObjectType) s`,
  );
  return rows[0].h;
}

const countOf = async (client, table) =>
  Number((await client.query(`SELECT count(*) AS n FROM gabay.${table}`)).rows[0].n);

/**
 * Rows of a 0.16 database in every re-keyed table, for two tenants (each with a venue and the old geometry rows the ids
 * point at), a tenant ConnectorType row beside the platform's, and a BUILDING and a FAILED version.
 */
async function seed016Rows(client) {
  await client.query(`
    INSERT INTO gabay.Tenant (Code, Name, BeaconProximityUuid)
    VALUES ('MIGA', 'Tenant A', '11111111-1111-4111-8111-111111111111'),
           ('MIGB', 'Tenant B', '22222222-2222-4222-8222-222222222222');
    INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES (NULL, 'MAIN', 'Main');
    INSERT INTO gabay.OccupantCategory (TenantId, Code, Label) VALUES (NULL, 'OTHER', 'Other');
    INSERT INTO gabay.StoreStatus (TenantId, Code, Label, IsRoutable) VALUES (NULL, 'OPEN', 'Open', TRUE);
    INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseM, CostPerRiseM)
    VALUES (NULL, 'ELEVATOR', 'Lift', 'ELEVATOR', TRUE, 30, 1.5),
           (NULL, 'STAIRS', 'Stairs', 'STAIRS', FALSE, 34, 3),
           (NULL, 'ESCALATOR', 'Escalator', 'ESCALATOR', FALSE, 14, 1),
           (NULL, 'RAMP', 'Ramp', 'RAMP', TRUE, 20, 2),
           (NULL, 'WALKWAY_LINK', 'Level link', 'LEVEL', TRUE, 5, 0);
    INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseM, CostPerRiseM)
      SELECT TenantId, 'ESCALATOR', 'Tuned escalator', 'ESCALATOR', FALSE, 99, 9 FROM gabay.Tenant WHERE Code = 'MIGA';
    INSERT INTO gabay.ObjectType (TenantId, Code, Label, BlocksWalk) VALUES (NULL, 'PILLAR', 'Pillar', TRUE);
    INSERT INTO gabay.AnalyticsConsent (PseudonymId, ConsentTextVersion, GrantedAt)
    VALUES ('33333333-3333-4333-8333-333333333333', 'v1', now());
  `);
  for (const code of ['MIGA', 'MIGB']) {
    await client.query(
      `
      WITH t AS (SELECT TenantId FROM gabay.Tenant WHERE Code = $1)
      INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson)
        SELECT TenantId, $1 || '_V', 'Venue of ' || $1, '{"type":"Polygon","coordinates":[]}'::jsonb FROM t`,
      [code],
    );
    const { rows } = await client.query(
      `SELECT t.TenantId AS t, v.VenueId AS v, t.BeaconProximityUuid AS uuid FROM gabay.Tenant t
         JOIN gabay.Venue v ON v.TenantId = t.TenantId WHERE t.Code = $1`,
      [code],
    );
    const { t, v, uuid } = rows[0];
    const one = async (sql, params) => (await client.query(sql, params)).rows[0].id;
    const building = await one(
      `INSERT INTO gabay.Building (TenantId, VenueId, BuildingTypeId, Name)
       SELECT $1, $2, BuildingTypeId, 'Main' FROM gabay.BuildingType WHERE Code = 'MAIN' RETURNING BuildingId AS id`,
      [t, v],
    );
    // A few throwaway levels first, so the ids under test differ between the tenants and from the unit ids.
    for (let i = 0; i < 3; i += 1) {
      await client.query(
        `INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, Ordinal, Name, ShortName, WidthM, DepthM)
         VALUES ($1, $2, $3, $4, 'Filler', 'F', 10, 10)`,
        [t, v, building, 10 + i],
      );
    }
    const level = await one(
      `INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, Ordinal, Name, ShortName, WidthM, DepthM)
       VALUES ($1, $2, $3, 0, 'Ground', 'G', 50, 40) RETURNING LevelId AS id`,
      [t, v, building],
    );
    const unit = await one(
      `INSERT INTO gabay.Unit (TenantId, VenueId, LevelId, ImdfCategory, Name, ShapeKind, GeometryGeoJson, IsWalkable)
       VALUES ($1, $2, $3, 'room', 'Shop', 'POLYGON', '{"type":"Polygon","coordinates":[]}'::jsonb, FALSE)
       RETURNING UnitId AS id`,
      [t, v, level],
    );
    const connector = await one(
      `INSERT INTO gabay.NavConnector (TenantId, VenueId, ConnectorTypeId, Name, FromLevelId, FromX, FromY, IsBidirectional)
       SELECT $1, $2, ConnectorTypeId, 'Lift', $3, 1, 1, TRUE FROM gabay.ConnectorType
        WHERE Code = 'ELEVATOR' AND TenantId IS NULL RETURNING NavConnectorId AS id`,
      [t, v, level],
    );
    const occupant = await one(
      `INSERT INTO gabay.Occupant (TenantId, VenueId, UnitId, OccupantCategoryId, StoreStatusId, Name)
       SELECT $1, $2, $3, c.OccupantCategoryId, s.StoreStatusId, 'Shop'
         FROM gabay.OccupantCategory c, gabay.StoreStatus s WHERE c.Code = 'OTHER' AND s.Code = 'OPEN'
       RETURNING OccupantId AS id`,
      [t, v, unit],
    );
    await client.query(
      `INSERT INTO gabay.StoreStatusChange (TenantId, VenueId, OccupantId, UnitId, ToStoreStatusId)
       SELECT $1, $2, $3, $4, StoreStatusId FROM gabay.StoreStatus WHERE Code = 'OPEN'`,
      [t, v, occupant, unit],
    );
    await client.query(
      `INSERT INTO gabay.Beacon (TenantId, VenueId, LevelId, X, Y, ProximityUuid, Major, Minor, IdentityScheme)
       VALUES ($1, $2, $3, 2.5, 3.5, $4, 7, 1, 'IBEACON_STATIC')`,
      [t, v, level, uuid],
    );
    await client.query(
      `INSERT INTO gabay.BeaconPlan (TenantId, VenueId, LevelId, PlanKind, Status, BeaconCount, InputsJson)
       VALUES ($1, $2, $3, 'RECOMMENDED', 'PROPOSED', 1, '{}'::jsonb)`,
      [t, v, level],
    );
    await client.query(
      `INSERT INTO gabay.Sentinel (TenantId, VenueId, LevelId, Name, X, Y, HmacSecretEnc)
       VALUES ($1, $2, $3, 'Sentinel', 1, 1, '\\x00'::bytea)`,
      [t, v, level],
    );
    await client.query(
      `INSERT INTO gabay.Closure (TenantId, VenueId, LevelId, NavConnectorId, AreaGeoJson, Reason, StartsAt)
       VALUES ($1, $2, $3, $4, NULL, 'Lift repair', now()),
              ($1, $2, NULL, NULL, '{"type":"Polygon","coordinates":[]}'::jsonb, 'Area', now())`,
      [t, v, level, connector],
    );
    const failed = await one(
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion)
       VALUES ($1, $2, 1, 'FAILED', 1) RETURNING VenueVersionId AS id`,
      [t, v],
    );
    await client.query(
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion)
       VALUES ($1, $2, 2, 'BUILDING', 1)`,
      [t, v],
    );
    await client.query(
      `INSERT INTO gabay.AnalyticsEvent (TenantId, VenueId, VenueVersionId, PseudonymId, SessionId, EventKind, OccurredAt, UnitId)
       VALUES ($1, $2, $3, '33333333-3333-4333-8333-333333333333', gen_random_uuid(), 'ARRIVE', now(), $4),
              ($1, $2, $3, '33333333-3333-4333-8333-333333333333', gen_random_uuid(), 'LOOKUP_OPEN', now(), NULL)`,
      [t, v, failed, unit],
    );
    const hours = `'{${Array(24).fill(0).join(',')}}'`;
    await client.query(
      `INSERT INTO gabay.AnalyticsDailyUnit (TenantId, VenueId, VenueVersionId, Day, UnitId, Shoppers, Visits, VisitsByHour,
              Arrivals, ArrivalsByHour, LookupsOpened, LookupsToRoute, LookupsArrived, LookupsConfirmed, StaysMeasured,
              ClosedInside, StayHist, IsEstimated)
       VALUES ($1, $2, $3, DATE '2026-10-01', $4, 6, 6, ${hours}, 1, ${hours}, 0, 0, 0, 0, 0, 0, '{}', FALSE)`,
      [t, v, failed, unit],
    );
    await client.query(
      `INSERT INTO gabay.AnalyticsDailyCell (TenantId, VenueId, VenueVersionId, Day, LevelId, DestinationUnitId, CellX, CellY, Samples, Shoppers)
       VALUES ($1, $2, $3, DATE '2026-10-01', $4, NULL, 1, 1, 9, 6), ($1, $2, $3, DATE '2026-10-01', $4, $5, 1, 1, 3, 5)`,
      [t, v, failed, level, unit],
    );
    await client.query(
      `INSERT INTO gabay.Forecast (TenantId, VenueId, UnitId, Metric, PeriodStart, Expected, RangeLow, RangeHigh, IsShown, ModelVersion)
       VALUES ($1, $2, $3, 'UNIT_VISITS_WEEK', DATE '2026-10-05', 10, 8, 12, FALSE, 'm1'),
              ($1, $2, NULL, 'VISITS_DAY', DATE '2026-10-05', 100, 80, 120, FALSE, 'm1')`,
      [t, v, unit],
    );
  }
}

/** The fresh 0.17 fingerprint: db/schema.sql, then every migration. */
async function fresh017(scratch, c) {
  await scratch.reset(c);
  await scratch.applyCurrentSchema(c);
  await migrate(c);
  return fingerprint(c);
}

test('AC-3: migration 0003 is db/migrations/0003_<name>.sql, the third, four digits, no transaction statement of its own, unquoted identifiers, every drop guarded, the twelve tables and nothing 0001 or 0002 made, ending with a -- verify: SELECT', () => {
  const all = readMigrations(); // throws on a bad name, a repeated number or a missing verify query
  assert.ok(all.length >= 3, 'three migrations at least');
  const third = all[2];
  assert.equal(third.name, FILE);
  assert.match(third.name, NAME_PATTERN);
  assert.match(third.name, /^0003_[a-z0-9_]+\.sql$/);
  assert.ok(third.verify, 'it ends with a -- verify: SELECT');
  assert.match(third.verify, /costbases/, 'the verify query reports the seconds columns');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, FILE), 'utf8');
  const code = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  assert.doesNotMatch(
    code,
    /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*(TRANSACTION|WORK)?\s*;/im,
    'the runner owns the transaction',
  );
  assert.doesNotMatch(code, /["]\w+["]\s*\./, 'identifiers are never quoted, as in schema.sql');
  const dropped = [...code.matchAll(/\bDROP\s+TABLE\s+(IF\s+EXISTS\s+)?gabay\.(\w+)/gi)];
  assert.ok(
    dropped.every((m) => m[1]),
    'every DROP TABLE is IF EXISTS',
  );
  assert.deepEqual(
    dropped.map((m) => m[2]).sort(),
    [...RETIRED].sort(),
    'it drops exactly the twelve geometry tables',
  );
  for (const made of [
    'VenueMap',
    'VenueMapBackdrop',
    'CatalogVersion',
    'LayoutJson',
    'PermissionRoute',
    'RolePermission',
  ]) {
    assert.doesNotMatch(
      code,
      new RegExp(`\\bDROP\\b[^;]*\\b${made}\\b`, 'i'),
      `nothing 0001 or 0002 made is dropped (${made})`,
    );
  }
  assert.doesNotMatch(code, /\bTRUNCATE\b|\bDELETE\s+FROM\b/i, 'no row is deleted');
  assert.doesNotMatch(
    code,
    /\bUPDATE\s+gabay\.VenueVersion\b/i,
    'no version row is ever updated (EC-23)',
  );
});

test('AC-4.1, AC-6, AC-7, EC-1, EC-12, EC-21: a 0.16 database holding rows becomes exactly 0.17; the keys are the old ids as text; nothing moved; the costs are seconds', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    const fresh = await fresh017(scratch, c);

    await scratch.reset(c);
    await scratch.applySchema016(c);
    await seed016Rows(c);
    assert.notEqual(
      (await fingerprint(c)).hash,
      fresh.hash,
      'the 0.16 schema really differs from 0.17',
    );
    const keysBefore = await keyLines(c, 'before');
    assert.equal(
      keysBefore.length,
      2 * 14,
      'every re-keyed table holds rows for both tenants (14 rows each)',
    );
    const untouchedBefore = await untouchedHash(c);
    const versionsBefore = await countOf(c, 'VenueVersion');
    const filesBefore = await countOf(c, 'StoredFile');

    await migrate(c); // BUILDING and FAILED versions do not stop it (EC-21)

    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      NONE,
      'a migrated 0.16 equals a fresh 0.17',
    );
    assert.deepEqual(
      await keyLines(c, 'after'),
      keysBefore,
      'each key column holds the decimal text of the old id, on the same tenant and venue (DC-2, EC-12)',
    );
    assert.equal(
      await untouchedHash(c),
      untouchedBefore,
      'the rows without a key column are untouched',
    );
    assert.equal(
      await countOf(c, 'VenueVersion'),
      versionsBefore,
      'no VenueVersion written (EC-1)',
    );
    assert.equal(await countOf(c, 'StoredFile'), filesBefore, 'no StoredFile written (EC-1)');
    for (const table of RETIRED) {
      const { rows } = await c.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_name = $1`,
        [table.toLowerCase()],
      );
      assert.equal(rows[0].n, 0, `${table} is gone`);
    }

    // AC-7: every row, platform and tenant, takes its CostModel's pair; a LEVEL row takes 0, 0.
    const { rows: costs } = await c.query(
      `SELECT Code AS code, CostModel AS model, (TenantId IS NULL) AS platform,
              CostBaseS::text AS base, CostPerRiseS::text AS rise
         FROM gabay.ConnectorType ORDER BY Code, TenantId NULLS FIRST`,
    );
    for (const row of costs) {
      const want = SECONDS[row.model] ?? ['0.000', '0.000'];
      assert.deepEqual(
        [row.base, row.rise],
        want,
        `${row.code} (${row.platform ? 'platform' : 'tenant'}) costs ${want.join(' + ')} s`,
      );
    }
    assert.equal(costs.filter((r) => !r.platform).length, 1, 'the tenant row was converted too');

    // A key that does not match ELEMENT_KEY is refused now (AC-6).
    await assert.rejects(
      () => c.query(`UPDATE gabay.Occupant SET UnitKey = 'not a key!' WHERE TenantId IS NOT NULL`),
      (err) => err.code === '23514' && /ck_occupant_unitkey/i.test(err.constraint ?? ''),
    );

    // AC-4.2: twice more, nothing changes (catalog and rows), and a cost a mall tuned since is kept.
    await c.query('UPDATE gabay.ConnectorType SET CostBaseS = 2.5 WHERE TenantId IS NOT NULL');
    const tuned = costs.map((r) => ({ base: r.platform ? r.base : '2.500', rise: r.rise }));
    const keysAfter = await keyLines(c, 'after');
    await migrate(c);
    await migrate(c);
    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      NONE,
      'run again: still exactly 0.17',
    );
    assert.deepEqual(await keyLines(c, 'after'), keysAfter, 'run again: no key changed');
    assert.equal(await untouchedHash(c), untouchedBefore, 'run again: no row changed');
    const { rows: costsAgain } = await c.query(
      'SELECT CostBaseS::text AS base, CostPerRiseS::text AS rise FROM gabay.ConnectorType ORDER BY Code, TenantId NULLS FIRST',
    );
    assert.deepEqual(costsAgain, tuned, 'run again: a cost a mall tuned after 0003 is never reset');
  });
});

test('AC-4.3, AC-4.4, AC-4.5: a fresh 0.17, the half state, and 0.14 and 0.15 databases all end exactly 0.17', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    const fresh = await fresh017(scratch, c);

    // AC-4.3: a fresh 0.17 plus the migrations again changes nothing.
    await migrate(c);
    assert.deepEqual(difference(fresh, await fingerprint(c)), NONE, 'AC-4.3');

    // AC-4.4: 0.17's schema.sql over a 0.16 database (its preamble drops every foreign key; it does not know the twelve
    // tables, which are left behind), then the migrations.
    await scratch.reset(c);
    await scratch.applySchema016(c);
    await scratch.applyCurrentSchema(c);
    const leftBehind = (
      await c.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_name = ANY($1)`,
        [RETIRED.map((t) => t.toLowerCase())],
      )
    ).rows[0].n;
    assert.equal(leftBehind, 12, 'the half state really holds the twelve retired tables');
    await migrate(c);
    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      NONE,
      'AC-4.4: the half state converges',
    );

    // AC-4.5: 0.14 takes 0001, 0002 and 0003 in order; 0.15 takes 0002 and 0003.
    for (const [label, apply] of [
      ['0.14', () => scratch.applySchema014(c)],
      ['0.15', () => scratch.applySchema015(c)],
    ]) {
      await scratch.reset(c);
      await apply();
      await migrate(c);
      assert.deepEqual(
        difference(fresh, await fingerprint(c)),
        NONE,
        `AC-4.5: ${label} ends exactly 0.17`,
      );
    }
  });
});

test('AC-5, EC-23: a 0.16 database holding a PUBLISHED version: 0003 stops with the message naming setup-db, and nothing is dropped or re-keyed', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applySchema016(c);
    await seed016Rows(c);
    await c.query(`
      INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
        SELECT TenantId, 'PACKAGE', 'application/zip', 1, repeat('a', 64), 'test/oa3a/package.zip'
          FROM gabay.Tenant WHERE Code = 'MIGA';
      INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256,
                                      PackageFormatVersion, PublishedAt, LayoutJson)
        SELECT v.TenantId, v.VenueId, 3, 'PUBLISHED', f.FileId, repeat('a', 64), 1, now(), '{"spec":1}'::jsonb
          FROM gabay.Venue v JOIN gabay.StoredFile f ON f.TenantId = v.TenantId WHERE v.Code = 'MIGA_V';
    `);
    // 0001 and 0002 run first and only insert their access rows, so the comparison point is after them.
    await quiet(() => runMigrations(c, THROUGH_0002));
    const before = await fingerprint(c);
    const keysBefore = await keyLines(c, 'before');
    const untouchedBefore = await untouchedHash(c);
    await assert.rejects(
      () => migrate(c),
      (err) => {
        assert.match(
          err.message,
          /0003_retire_geometry_rekey_keys\.sql failed and was rolled back: Published versions exist; recreate this throwaway database with npm run setup-db \(E-20\)/,
        );
        return true;
      },
    );
    assert.deepEqual(difference(before, await fingerprint(c)), NONE, 'the schema is as it was');
    assert.deepEqual(
      await keyLines(c, 'before'),
      keysBefore,
      'nothing re-keyed: the old columns still hold the ids',
    );
    assert.equal(await untouchedHash(c), untouchedBefore, 'the rows are as they were');
    const { rows } = await c.query(
      `SELECT CostBaseM::text AS base FROM gabay.ConnectorType WHERE Code = 'ELEVATOR' AND TenantId IS NULL`,
    );
    assert.equal(rows[0].base, '30.000', 'the costs are still metres');
  });
});

test('I2 (b), owner ruling 2026-10-16: 0003 stops on a blocking object type whose default size is 0, naming it; on 0.17 the database refuses a default of 0 or less on a blocking type and accepts NULL defaults', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();

    // The stop on a 0.16 database, nothing changed.
    await scratch.reset(c);
    await scratch.applySchema016(c);
    await c.query(`
      INSERT INTO gabay.ObjectType (TenantId, Code, Label, BlocksWalk, DefaultWidthM, DefaultDepthM)
      VALUES (NULL, 'ZERO_KIOSK', 'Zero kiosk', TRUE, 0, 2),
             (NULL, 'FLAT_RUG', 'Rug', FALSE, 0, 0),
             (NULL, 'PILLAR', 'Pillar', TRUE, NULL, NULL)`);
    await quiet(() => runMigrations(c, THROUGH_0002));
    const before = await fingerprint(c);
    await assert.rejects(
      () => migrate(c),
      (err) => {
        assert.match(
          err.message,
          /Object types that block walking have a default size of 0 or less \(ZERO_KIOSK\); fix them or recreate this throwaway database with npm run setup-db \(E-20\)/,
        );
        assert.doesNotMatch(
          err.message,
          /FLAT_RUG|PILLAR/,
          'a type that does not block, and NULL defaults, are not named',
        );
        return true;
      },
    );
    assert.deepEqual(difference(before, await fingerprint(c)), NONE, 'nothing changed');

    // On 0.17: what CK_ObjectType_BlockingSize refuses and accepts.
    await fresh017(scratch, c);
    const insertType = (code, { blocks = true, w = null, d = null, round = false } = {}) =>
      c.query(
        `INSERT INTO gabay.ObjectType (TenantId, Code, Label, BlocksWalk, DefaultWidthM, DefaultDepthM, IsRound)
         VALUES (NULL, $1, $1, $2, $3, $4, $5)`,
        [code, blocks, w, d, round],
      );
    for (const [code, opts] of [
      ['ZERO_W', { w: 0, d: 1 }],
      ['NEGATIVE_W', { w: -1, d: 1 }],
      ['ZERO_D', { w: 1, d: 0 }],
      ['NEGATIVE_D', { w: 1, d: -0.5 }],
      ['ZERO_W_NULL_D', { w: 0 }],
      ['ROUND_ZERO_W', { w: 0, round: true }],
    ]) {
      await assert.rejects(
        () => insertType(code, opts),
        (err) => err.code === '23514' && /ck_objecttype_blockingsize/i.test(err.constraint ?? ''),
        `${code} is refused`,
      );
    }
    for (const [code, opts] of [
      ['NULL_DEFAULTS', {}],
      ['NULL_W_SIZED_D', { d: 1 }],
      ['SIZED', { w: 1.2, d: 0.6 }],
      ['ROUND_NULL_D', { w: 1, round: true }],
      ['ROUND_ZERO_D', { w: 1, d: 0, round: true }],
      ['NOT_BLOCKING_ZERO', { blocks: false, w: 0, d: 0 }],
    ]) {
      await insertType(code, opts); // throws if refused
    }
    // An UPDATE is held to the same rule.
    await assert.rejects(
      () => c.query(`UPDATE gabay.ObjectType SET DefaultWidthM = 0 WHERE Code = 'SIZED'`),
      (err) => err.code === '23514',
    );
    await assert.rejects(
      () =>
        c.query(`UPDATE gabay.ObjectType SET BlocksWalk = TRUE WHERE Code = 'NOT_BLOCKING_ZERO'`),
      (err) => err.code === '23514',
    );
  });
});

test('AC-7: on 0.17 a negative or NULL cost is refused, and a ConnectorType row must state both costs', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await fresh017(scratch, c);
    const insert = (base, rise) =>
      c.query(
        `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, CostBaseS, CostPerRiseS)
         VALUES (NULL, 'X', 'X', 'STAIRS', FALSE, $1, $2)`,
        [base, rise],
      );
    for (const [label, base, rise, code] of [
      ['a negative base', -0.001, 1, '23514'],
      ['a negative rise cost', 1, -1, '23514'],
      ['a NULL base', null, 1, '23502'],
      ['a NULL rise cost', 1, null, '23502'],
    ]) {
      await assert.rejects(
        () => insert(base, rise),
        (err) => err.code === code,
        `${label} is refused`,
      );
    }
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree) VALUES (NULL, 'Y', 'Y', 'RAMP', TRUE)`,
        ),
      (err) => err.code === '23502',
      'no default: a row that states no cost is refused',
    );
    await insert(0, 0); // zero is a cost (a LEVEL link)
  });
});

test('the fingerprint control: it sees a NOT NULL constraint left under its old name, and a key CHECK with another pattern', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    const base = await fresh017(scratch, c);
    for (const [label, change] of [
      [
        'a renamed NOT NULL constraint',
        'ALTER TABLE gabay.Occupant RENAME CONSTRAINT occupant_unitkey_not_null TO occupant_unitid_not_null',
      ],
      [
        'a key CHECK with another pattern',
        `ALTER TABLE gabay.Beacon DROP CONSTRAINT CK_Beacon_LevelKey;
         ALTER TABLE gabay.Beacon ADD CONSTRAINT CK_Beacon_LevelKey CHECK (LevelKey ~ '^[A-Za-z0-9_-]{1,39}$')`,
      ],
      [
        'a column dropped at the end of a table',
        'ALTER TABLE gabay.Occupant DROP COLUMN UpdatedAt',
      ],
    ]) {
      await c.query('BEGIN');
      await c.query(change);
      const changed = await fingerprint(c);
      await c.query('ROLLBACK');
      assert.notEqual(changed.hash, base.hash, `the fingerprint sees ${label}`);
    }
    assert.equal((await fingerprint(c)).hash, base.hash, 'rolled back: back to the base');
  });
});
