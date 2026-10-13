'use strict';

// OA-2 / spec/OA-2.md r1 AC-5, EC-32 (plan/OA-2-map-storage.md 1.0 sections 3.2 and 8, DC-A14, DC-A15; the owner's ruling
// 18a Q1 (a): a throwaway database per test file): migration 0001, the repository's first, on five database states. Each state
// is built in ONE scratch database (scratchDb.js: created for this file, dropped at its end; nothing is kept and the working
// copy's own database is never written) by emptying the gabay schema and running a schema file.
//
//   1. 0.15 from db/schema.sql (what setup-db does, then 0001): it changes nothing and succeeds.
//   2. 0.14 (the frozen fixture, cb2f5cd) holding rows: after 0001 the catalog fingerprint equals a fresh 0.15 one, and the
//      existing rows are untouched (their new columns hold the defaults).
//   3. 0001 run a second time: it changes nothing.
//   4. 0.14 holding a PUBLISHED VenueVersion: 0001 stops with the exception that names setup-db, and the database is as it was.
//   5. 0.15's tables left behind when 0.14's schema.sql is run over a 0.15 database (its preamble drops every foreign key and
//      its drops do not know the new tables): 0001 converges to a fresh 0.15.
//
// "Exactly 0.15" is the catalog fingerprint of DC-A14: every column (type, length, precision, nullability, default, identity), every
// constraint's definition, every index's definition, every trigger's definition and every function's body. Not storage parameters.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  runMigrations,
  readMigrations,
  MIGRATIONS_DIR,
  NAME_PATTERN,
} = require('../lib/migrations');
const { withScratchDatabase } = require('./scratchDb');

const FINGERPRINT = [
  `SELECT 'col' AS k, table_name || '.' || lpad(ordinal_position::text, 3, '0') || ' ' || column_name || ' ' ||
          data_type || coalesce('(' || character_maximum_length || ')', '') ||
          coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '') || ' null=' || is_nullable ||
          ' def=' || coalesce(column_default, '-') || ' id=' || is_identity AS v
     FROM information_schema.columns WHERE table_schema = 'gabay'`,
  `SELECT 'con', t.relname || ' ' || k.conname || ' ' || k.contype::text || ' ' || pg_get_constraintdef(k.oid)
     FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'gabay'`,
  `SELECT 'idx', indexdef FROM pg_indexes WHERE schemaname = 'gabay'`,
  `SELECT 'trg', pg_get_triggerdef(g.oid) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
     JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'gabay' AND NOT g.tgisinternal`,
  `SELECT 'fn', p.proname || ' ' || md5(p.prosrc) FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
    WHERE s.nspname = 'gabay'`,
].join(' UNION ALL ');

/** The catalog fingerprint of the gabay schema: the sorted lines, and a short hash of them. */
async function fingerprint(client) {
  const { rows } = await client.query(`SELECT k, v FROM (${FINGERPRINT}) x ORDER BY k, v`);
  const lines = rows.map((r) => `${r.k} ${r.v}`);
  return {
    lines,
    hash: crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16),
  };
}

/** What differs between two fingerprints, for a readable failure. */
function difference(a, b) {
  const inA = new Set(a.lines);
  const inB = new Set(b.lines);
  return {
    onlyFirst: a.lines.filter((l) => !inB.has(l)),
    onlySecond: b.lines.filter((l) => !inA.has(l)),
  };
}

/** One hash over the rows the tests write, in a 0.14 database (columns that exist in both versions only). */
async function rowsHash(client) {
  const { rows } = await client.query(
    `SELECT md5(string_agg(x, '|' ORDER BY x)) AS h FROM (
       SELECT 'T' || TenantId || Code || Name AS x FROM gabay.Tenant
       UNION ALL SELECT 'O' || ObjectTypeId || Code || coalesce(DefaultWidthM::text, '-') FROM gabay.ObjectType
       UNION ALL SELECT 'V' || VenueId || Code FROM gabay.Venue
       UNION ALL SELECT 'VV' || VenueVersionId || Status || VersionNo FROM gabay.VenueVersion) s`,
  );
  return rows[0].h;
}

/** runMigrations prints its progress; the test keeps the console for its own failures. */
async function quiet(fn) {
  const { log, table } = console;
  console.log = () => {};
  console.table = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.table = table;
  }
}

const migrate = (client) => quiet(() => runMigrations(client));

/** Rows a 0.14 database can hold: a tenant, a platform and a tenant object type, a venue, a FAILED version. */
async function seed014Rows(client) {
  await client.query(
    `INSERT INTO gabay.Tenant (Code, Name) VALUES ('MIGT', 'Migration tenant');
     INSERT INTO gabay.ObjectType (TenantId, Code, Label, DefaultWidthM) VALUES (NULL, 'PILLARX', 'Pillar', 0.600);
     INSERT INTO gabay.ObjectType (TenantId, Code, Label, DefaultWidthM, BlocksWalk)
       SELECT TenantId, 'TENANT_DESK', 'Desk', 1.400, FALSE FROM gabay.Tenant WHERE Code = 'MIGT';
     INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson)
       SELECT TenantId, 'MIGV', 'Venue', '{"type":"Polygon","coordinates":[]}'::jsonb FROM gabay.Tenant WHERE Code = 'MIGT';
     INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion)
       SELECT TenantId, VenueId, 1, 'FAILED', 1 FROM gabay.Venue WHERE Code = 'MIGV';`,
  );
}

/** A PUBLISHED row, which a 0.14 database can hold without a layout. */
async function insertPublished014(client) {
  await client.query(
    `INSERT INTO gabay.Tenant (Code, Name) VALUES ('MIGT', 'Migration tenant');
     INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson)
       SELECT TenantId, 'MIGV', 'Venue', '{"type":"Polygon","coordinates":[]}'::jsonb FROM gabay.Tenant WHERE Code = 'MIGT';
     INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
       SELECT TenantId, 'PACKAGE', 'application/octet-stream', 1, repeat('a', 64), 'packages/x' FROM gabay.Tenant WHERE Code = 'MIGT';
     INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256, PackageFormatVersion, PublishedAt)
       SELECT v.TenantId, v.VenueId, 1, 'PUBLISHED', f.FileId, repeat('a', 64), 1, now()
         FROM gabay.Venue v JOIN gabay.StoredFile f ON f.TenantId = v.TenantId WHERE v.Code = 'MIGV';`,
  );
}

test('AC-5: migration 0001 is db/migrations/0001_<name>.sql, four digits, additive only, no transaction statement of its own, ending with a -- verify: query', () => {
  const all = readMigrations(); // throws on a bad name, a repeated number or a missing verify query
  assert.ok(all.length >= 1, 'at least one migration exists');
  const first = all[0];
  assert.match(first.name, NAME_PATTERN);
  assert.match(first.name, /^0001_[a-z0-9_]+\.sql$/, 'four digits, then a snake_case name');
  assert.equal(first.name, '0001_venue_map_storage.sql');
  assert.ok(first.verify, 'it ends with a -- verify: SELECT');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, first.name), 'utf8');
  const code = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  assert.doesNotMatch(
    code,
    /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|END)\s*(TRANSACTION|WORK)?\s*;/im,
    'the runner owns the transaction: the file holds no BEGIN or COMMIT statement',
  );
  assert.doesNotMatch(
    code,
    /\bDROP\s+(TABLE|COLUMN|SCHEMA|INDEX|TRIGGER|FUNCTION)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i,
    'additive only: nothing is dropped, truncated or deleted',
  );
  assert.match(sql, /^-- verify:\s*$/m);
  assert.doesNotMatch(code, /["]\w+["]\s*\./, 'identifiers are never quoted, as in schema.sql');
});

test('AC-5, EC-32: migration 0001 on the five database states (one scratch database, rebuilt for each)', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();

    // ---- 1. 0.15 from schema.sql (setup-db's order: the schema, then the migrations): 0001 changes nothing ------------------
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    const fresh = await fingerprint(c);
    assert.ok(fresh.lines.length > 500, 'the fingerprint reads the whole schema');
    await migrate(c);
    const afterFirst = await fingerprint(c);
    assert.deepEqual(
      difference(fresh, afterFirst),
      { onlyFirst: [], onlySecond: [] },
      '(1) on a 0.15 database it changes nothing',
    );
    assert.equal(afterFirst.hash, fresh.hash);

    // ---- 3. run a second time (and a third): nothing changes ------------------------------------------------------------------
    await migrate(c);
    await migrate(c);
    const again = await fingerprint(c);
    assert.deepEqual(
      difference(fresh, again),
      { onlyFirst: [], onlySecond: [] },
      '(3) run again, it changes nothing',
    );

    // ---- 2. 0.14 holding rows -> exactly 0.15, rows untouched ----------------------------------------------------------------
    await scratch.reset(c);
    await scratch.applySchema014(c);
    await seed014Rows(c);
    const v014 = await fingerprint(c);
    assert.notEqual(v014.hash, fresh.hash, 'the 0.14 schema really differs from 0.15');
    const rowsBefore = await rowsHash(c);
    await migrate(c);
    const migrated = await fingerprint(c);
    assert.deepEqual(
      difference(fresh, migrated),
      { onlyFirst: [], onlySecond: [] },
      '(2) a migrated 0.14 equals a fresh 0.15, to the fingerprint',
    );
    assert.equal(await rowsHash(c), rowsBefore, '(2) the existing rows are untouched');
    const tenant = (
      await c.query(`SELECT CatalogVersion AS v FROM gabay.Tenant WHERE Code = 'MIGT'`)
    ).rows[0];
    assert.equal(tenant.v, 1, 'an existing tenant starts at catalog version 1');
    const types = (
      await c.query(
        `SELECT Code AS code, Mount AS mount, IsRound AS round, ResizeMinWidthM AS rw FROM gabay.ObjectType ORDER BY Code`,
      )
    ).rows;
    assert.deepEqual(
      types,
      [
        { code: 'PILLARX', mount: 'floor', round: false, rw: null },
        { code: 'TENANT_DESK', mount: 'floor', round: false, rw: null },
      ],
      'existing object types become fixed, floor-mounted and not round',
    );
    // the trigger works on the migrated database: a new tenant object type moves that tenant's counter only
    await c.query(
      `INSERT INTO gabay.ObjectType (TenantId, Code, Label) SELECT TenantId, 'AFTER_MIG', 'After' FROM gabay.Tenant WHERE Code = 'MIGT'`,
    );
    assert.equal(
      (await c.query(`SELECT CatalogVersion AS v FROM gabay.Tenant WHERE Code = 'MIGT'`)).rows[0].v,
      2,
    );
    await c.query(`DELETE FROM gabay.ObjectType WHERE Code = 'AFTER_MIG'`);
    // and running it again over the migrated database still changes nothing
    await migrate(c);
    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      { onlyFirst: [], onlySecond: [] },
      '(2+3) and again',
    );

    // ---- 4. 0.14 holding a PUBLISHED row: stops before changing anything ----------------------------------------------------
    await scratch.reset(c);
    await scratch.applySchema014(c);
    await insertPublished014(c);
    const stopBefore = await fingerprint(c);
    const stopRows = await rowsHash(c);
    await assert.rejects(
      () => migrate(c),
      (err) => {
        assert.match(
          err.message,
          /Published versions exist without a layout; recreate this throwaway database with npm run setup-db \(E-20\)/,
        );
        assert.match(err.message, /rolled back/);
        return true;
      },
      '(4) the exception names setup-db',
    );
    const stopAfter = await fingerprint(c);
    assert.deepEqual(
      difference(stopBefore, stopAfter),
      { onlyFirst: [], onlySecond: [] },
      '(4) the schema is as it was',
    );
    assert.equal(await rowsHash(c), stopRows, '(4) the rows are as they were');
    assert.equal(
      (
        await c.query(
          `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'gabay' AND table_name = 'venueversion' AND column_name = 'layoutjson'`,
        )
      ).rows[0].n,
      0,
      '(4) no column was added',
    );

    // ---- 5. 0.15's tables left behind under the 0.14 schema file: 0001 converges to a fresh 0.15 -------------------------------
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    await migrate(c);
    await scratch.applySchema014(c); // 0.14's preamble drops every foreign key; its drops do not know VenueMap or VenueMapBackdrop
    await migrate(c);
    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      { onlyFirst: [], onlySecond: [] },
      '(5) a half state converges to 0.15',
    );
  });
});

test('AC-5: the migration is the one thing that differs between a fresh 0.15 and 0.14 plus 0001: the fingerprint query itself sees a missing column', async () => {
  // A control for the fingerprint: it must notice the smallest difference, or "no difference" above proves nothing.
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    await migrate(c);
    const base = await fingerprint(c);
    for (const [label, change] of [
      ['a column dropped', 'ALTER TABLE gabay.ObjectType DROP COLUMN IsRound'],
      ['a default changed', `ALTER TABLE gabay.ObjectType ALTER COLUMN Mount SET DEFAULT 'wall'`],
      ['a CHECK dropped', 'ALTER TABLE gabay.Tenant DROP CONSTRAINT CK_Tenant_CatalogVersion'],
      ['an index dropped', 'DROP INDEX gabay.IX_VenueMapBackdrop_Venue'],
      ['the trigger dropped', 'DROP TRIGGER TR_ObjectType_CatalogVersion ON gabay.ObjectType'],
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
