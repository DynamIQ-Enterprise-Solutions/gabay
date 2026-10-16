'use strict';

// OA-2 / spec/OA-2.md r1 AC-1 to AC-4 and AC-37 (plan/OA-2-map-storage.md 1.0 sections 3.1 and 8): schema 0.15 as the real
// local database holds it (information_schema, pg_constraint, pg_indexes, pg_trigger), the frozen layout, the new
// ObjectType columns and their CHECKs, the tenant's catalog version, and the trigger that moves it.
//
// Every row written is inside the rolled-back transaction of savepointDb.js (L151); a statement that the database
// refuses is undone to its own savepoint, so the transaction goes on. Nothing is kept.
//
// Not here: the two `schema.sql` runs (npm run verify: schema-run-1 and schema-run-2, AC-1), and migration 0001 on four
// databases (db/tools/test/migration0001.test.js, AC-5).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openSavepointDb } = require('./savepointDb');
const { createSeeder } = require('./authHelpers');
const { closedSet } = require('../src/config/closedSets');
const { seedPlatform } = require('../../db/seeds/lib/lookups');

const SCHEMA_TEXT = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');

async function withDb(fn) {
  const t = await openSavepointDb();
  try {
    await fn(t);
  } finally {
    await t.close();
  }
}

const rows = async (t, text, params = []) => (await t.db.query(text, params)).rows;
const one = async (t, text, params = []) => (await rows(t, text, params))[0];

/** Asserts the database refuses `fn`'s statement with a CHECK violation (23514) of the named constraint. */
async function assertCheckRefused(fn, constraint, note) {
  await assert.rejects(fn, (err) => {
    assert.equal(err.code, '23514', `${note}: a CHECK violation, got ${err.code} ${err.message}`);
    assert.equal(err.constraint, constraint, `${note}: the constraint`);
    return true;
  });
}

// ------------------------------------------------------------------------------------------------------------ AC-1

const COLUMNS = {
  venuemap: {
    venuemapid: { type: 'integer', nullable: false, identity: 'ALWAYS' },
    tenantid: { type: 'integer', nullable: false },
    venueid: { type: 'integer', nullable: false },
    draftjson: { type: 'jsonb', nullable: true },
    draftversion: { type: 'integer', nullable: false, default: /^0$/ },
    publishedversion: { type: 'integer', nullable: true },
    createdby: { type: 'integer', nullable: true },
    createdat: {
      type: 'timestamp with time zone',
      nullable: false,
      default: /^now\(\)$/,
      precision: 3,
    },
    updatedby: { type: 'integer', nullable: true },
    updatedat: { type: 'timestamp with time zone', nullable: true, precision: 3 },
  },
  venuemapbackdrop: {
    backdropkey: { type: 'character', nullable: false, length: 32 },
    tenantid: { type: 'integer', nullable: false },
    venueid: { type: 'integer', nullable: false },
    fileid: { type: 'bigint', nullable: false },
    widthpx: { type: 'integer', nullable: false },
    heightpx: { type: 'integer', nullable: false },
    createdby: { type: 'integer', nullable: true },
    createdat: {
      type: 'timestamp with time zone',
      nullable: false,
      default: /^now\(\)$/,
      precision: 3,
    },
  },
  venueversion: { layoutjson: { type: 'jsonb', nullable: true } },
  tenant: { catalogversion: { type: 'integer', nullable: false, default: /^1$/ } },
  objecttype: {
    resizeminwidthm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    resizemaxwidthm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    resizemindepthm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    resizemaxdepthm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    resizeminheightm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    resizemaxheightm: { type: 'numeric', nullable: true, numeric: [9, 3] },
    mount: { type: 'character varying', nullable: false, length: 10, default: /^'floor'/ },
    isround: { type: 'boolean', nullable: false, default: /^false$/ },
  },
};

test('AC-1: schema 0.15 has every column of spec section 2.1 and 2.2, with its type, nullability and default', async () => {
  await withDb(async (t) => {
    for (const [table, expected] of Object.entries(COLUMNS)) {
      const cols = await rows(
        t,
        `SELECT column_name AS name, data_type AS type, is_nullable AS nullable, column_default AS def,
                identity_generation AS identity, character_maximum_length AS length,
                numeric_precision AS np, numeric_scale AS ns, datetime_precision AS dp
           FROM information_schema.columns WHERE table_schema = 'gabay' AND table_name = $1`,
        [table],
      );
      const byName = new Map(cols.map((c) => [c.name, c]));
      for (const [name, want] of Object.entries(expected)) {
        const c = byName.get(name);
        assert.ok(c, `${table}.${name} exists`);
        assert.equal(c.type, want.type, `${table}.${name} type`);
        assert.equal(c.nullable === 'YES', want.nullable, `${table}.${name} nullable`);
        if (want.default) assert.match(c.def ?? '', want.default, `${table}.${name} default`);
        if (want.identity) assert.equal(c.identity, want.identity, `${table}.${name} identity`);
        if (want.length) assert.equal(c.length, want.length, `${table}.${name} length`);
        if (want.precision)
          assert.equal(c.dp, want.precision, `${table}.${name} timestamp precision`);
        if (want.numeric)
          assert.deepEqual([c.np, c.ns], want.numeric, `${table}.${name} DECIMAL(p,s)`);
      }
    }
  });
});

const CONSTRAINTS = {
  venuemap: {
    pk_venuemap: ['p', /PRIMARY KEY \(venuemapid\)/i],
    ck_venuemap_draftversion: ['c', /draftversion >= 0/i],
    uq_venuemap: ['u', /UNIQUE \(tenantid, venueid\)/i],
    fk_venuemap_venue: [
      'f',
      /FOREIGN KEY \(tenantid, venueid\) REFERENCES (gabay\.)?venue\(tenantid, venueid\)/i,
    ],
    fk_venuemap_published: [
      'f',
      /FOREIGN KEY \(tenantid, venueid, publishedversion\) REFERENCES (gabay\.)?venueversion\(tenantid, venueid, versionno\)/i,
    ],
  },
  venuemapbackdrop: {
    pk_venuemapbackdrop: ['p', /PRIMARY KEY \(backdropkey\)/i],
    ck_venuemapbackdrop_key: ['c', /\[0-9a-f\]\{32\}/i],
    fk_venuemapbackdrop_venue: [
      'f',
      /FOREIGN KEY \(tenantid, venueid\) REFERENCES (gabay\.)?venue\(tenantid, venueid\)/i,
    ],
    fk_venuemapbackdrop_file: [
      'f',
      /FOREIGN KEY \(tenantid, fileid\) REFERENCES (gabay\.)?storedfile\(tenantid, fileid\)/i,
    ],
  },
  venueversion: {
    ck_venueversion_published: ['c', /layoutjson IS NOT NULL/i],
  },
  tenant: { ck_tenant_catalogversion: ['c', /catalogversion >= 1/i] },
  objecttype: {
    ck_objecttype_mount: ['c', /mount/i],
    ck_objecttype_resizew_pair: ['c', /resizeminwidthm IS NULL/i],
    ck_objecttype_resizew_order: ['c', /resizeminwidthm > \(?0/i],
    ck_objecttype_resizew_default: ['c', /defaultwidthm/i],
    ck_objecttype_resized_pair: ['c', /resizemindepthm IS NULL/i],
    ck_objecttype_resized_order: ['c', /resizemindepthm > \(?0/i],
    ck_objecttype_resized_default: ['c', /defaultdepthm/i],
    ck_objecttype_resizeh_pair: ['c', /resizeminheightm IS NULL/i],
    ck_objecttype_resizeh_order: ['c', /resizeminheightm > \(?0/i],
    ck_objecttype_resizeh_default: ['c', /defaultheightm/i],
  },
};

test('AC-1: schema 0.15 holds every named constraint, index and trigger of spec section 2.1 and 2.2', async () => {
  await withDb(async (t) => {
    for (const [table, expected] of Object.entries(CONSTRAINTS)) {
      const found = await rows(
        t,
        `SELECT k.conname AS name, k.contype::text AS kind, pg_get_constraintdef(k.oid) AS def
           FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'gabay' AND c.relname = $1`,
        [table],
      );
      const byName = new Map(found.map((r) => [r.name, r]));
      for (const [name, [kind, pattern]] of Object.entries(expected)) {
        const r = byName.get(name);
        assert.ok(r, `${table}: constraint ${name} exists`);
        assert.equal(r.kind, kind, `${name}: kind`);
        assert.match(r.def, pattern, `${name}: definition`);
      }
    }
    const index = await one(
      t,
      `SELECT indexdef AS def FROM pg_indexes WHERE schemaname = 'gabay' AND indexname = 'ix_venuemapbackdrop_venue'`,
    );
    assert.ok(index, 'IX_VenueMapBackdrop_Venue exists');
    assert.match(index.def, /\(tenantid, venueid, createdat\)/i);
    const trigger = await one(
      t,
      `SELECT pg_get_triggerdef(g.oid) AS def FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
        WHERE c.relname = 'objecttype' AND g.tgname = 'tr_objecttype_catalogversion' AND NOT g.tgisinternal`,
    );
    assert.ok(trigger, 'TR_ObjectType_CatalogVersion exists');
    assert.match(
      trigger.def,
      /AFTER INSERT OR DELETE OR UPDATE ON gabay\.objecttype FOR EACH ROW/i,
    );
    const frozen = await one(
      t,
      `SELECT 1 AS ok FROM pg_trigger g WHERE g.tgname = 'tr_venueversion_frozen' AND NOT g.tgisinternal`,
    );
    assert.ok(frozen, 'TR_VenueVersion_Frozen is still there, unchanged');
  });
});

// CHANGED BY OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 4; spec/OA-3.md AC-1): schema 0.17 drops the twelve geometry
// tables, so the database's count is 46 now; 0.15's 58 stays checked against the frozen fixture by migration0001.test.js.
test('AC-1: the database holds 46 tables (58 at 0.15, less the twelve OA-3a dropped)', async () => {
  await withDb(async (t) => {
    const n = await one(
      t,
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'`,
    );
    assert.equal(n.n, 46);
  });
});

test('AC-1: schema.sql records 0.15 and 58 tables in its header, creates both new tables with a DROP, and drops VenueMap before VenueVersion', () => {
  const header = SCHEMA_TEXT.split('\n').slice(0, 80).join('\n');
  assert.match(header, /0\.15/, 'the header names 0.15');
  assert.match(header, /58 tables/, 'the header counts 58 tables');
  const at = (re) => {
    const m = re.exec(SCHEMA_TEXT);
    assert.ok(m, `${re} is in schema.sql`);
    return m.index;
  };
  for (const table of ['VenueMap', 'VenueMapBackdrop']) {
    at(new RegExp(`CREATE TABLE gabay\\.${table}\\s*\\(`));
    at(new RegExp(`DROP TABLE IF EXISTS gabay\\.${table}\\s+CASCADE;`));
  }
  const dropBackdrop = at(/DROP TABLE IF EXISTS gabay\.VenueMapBackdrop\s+CASCADE;/);
  const dropMap = at(/DROP TABLE IF EXISTS gabay\.VenueMap\s+CASCADE;/);
  const dropVersion = at(/DROP TABLE IF EXISTS gabay\.VenueVersion\s+CASCADE;/);
  assert.ok(
    dropMap < dropVersion,
    'VenueMap is dropped before VenueVersion (its foreign key points at it)',
  );
  assert.ok(
    dropBackdrop < dropMap || dropBackdrop < dropVersion,
    'VenueMapBackdrop is dropped before VenueVersion',
  );
  at(/DROP FUNCTION IF EXISTS gabay\.tr_objecttype_catalogversion\(\)\s+CASCADE;/);
});

// ------------------------------------------------------------------------------------------------------------ AC-2

/** A tenant, a venue and a package file, inside the transaction. */
async function venueFixture(t) {
  const seed = createSeeder(t.raw);
  const tenant = await seed.tenant('M');
  const venue = await one(
    t,
    `INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, $2, 'Venue') RETURNING VenueId`,
    [tenant.tenantId, `V${seed.tag}`],
  );
  const file = await one(
    t,
    `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
     VALUES ($1, 'PACKAGE', 'application/octet-stream', 1, repeat('a', 64), $2) RETURNING FileId`,
    [tenant.tenantId, `packages/${tenant.tenantId}/x`],
  );
  return { tenant, seed, venueId: venue.venueid, fileId: file.fileid };
}

const PUBLISH = `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256,
                                                  PackageFormatVersion, PublishedAt, LayoutJson)
                 VALUES ($1, $2, 1, 'PUBLISHED', $3, repeat('a', 64), 1, now(), $4::jsonb) RETURNING VenueVersionId`;

test('AC-2: a PUBLISHED row inserted without LayoutJson is refused by CK_VenueVersion_Published', async () => {
  await withDb(async (t) => {
    const f = await venueFixture(t);
    await assertCheckRefused(
      () => t.db.query(PUBLISH, [f.tenant.tenantId, f.venueId, f.fileId, null]),
      'ck_venueversion_published',
      'a published row with no layout',
    );
    const ok = await one(t, PUBLISH, [f.tenant.tenantId, f.venueId, f.fileId, '{"spec":1}']);
    assert.ok(ok.venueversionid, 'with a layout the same row is accepted');
    // a BUILDING row needs no layout yet (it is claimed with one, but the CHECK only guards PUBLISHED)
    const building = await one(
      t,
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion)
       VALUES ($1, $2, 2, 'BUILDING', 1) RETURNING VenueVersionId`,
      [f.tenant.tenantId, f.venueId],
    );
    assert.ok(building.venueversionid);
  });
});

test("AC-2: a direct UPDATE of a PUBLISHED row's LayoutJson raises the frozen trigger's error (invariant 3)", async () => {
  await withDb(async (t) => {
    const f = await venueFixture(t);
    const row = await one(t, PUBLISH, [f.tenant.tenantId, f.venueId, f.fileId, '{"spec":1}']);
    await assert.rejects(
      () =>
        t.db.query(
          `UPDATE gabay.VenueVersion SET LayoutJson = '{"spec":2}'::jsonb WHERE VenueVersionId = $1`,
          [row.venueversionid],
        ),
      (err) => {
        assert.equal(err.code, 'P0001');
        assert.match(err.message, /Frozen Package/);
        return true;
      },
    );
    const kept = await one(
      t,
      `SELECT LayoutJson AS layout FROM gabay.VenueVersion WHERE VenueVersionId = $1`,
      [row.venueversionid],
    );
    assert.deepEqual(kept.layout, { spec: 1 }, 'the stored layout is unchanged');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-3

const INSERT_TYPE = `INSERT INTO gabay.ObjectType (TenantId, Code, Label, DefaultWidthM, DefaultDepthM, DefaultHeightM,
                       ResizeMinWidthM, ResizeMaxWidthM, ResizeMinDepthM, ResizeMaxDepthM, ResizeMinHeightM,
                       ResizeMaxHeightM, Mount)
                     VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ObjectTypeId`;

/** Parameters of INSERT_TYPE: defaults and ranges per dimension, [min, max] each. */
const typeParams = (
  tenantId,
  code,
  {
    d = [null, null, null],
    w = [null, null],
    dp = [null, null],
    h = [null, null],
    mount = 'floor',
  } = {},
) => [tenantId, code, d[0], d[1], d[2], w[0], w[1], dp[0], dp[1], h[0], h[1], mount];

const DIMENSIONS = [
  { name: 'width', letter: 'w', key: 'w', defaultAt: 0 },
  { name: 'depth', letter: 'd', key: 'dp', defaultAt: 1 },
  { name: 'height', letter: 'h', key: 'h', defaultAt: 2 },
];

test('AC-3: per dimension, a min above its max, one end without the other, a default outside its range and a zero min are each refused', async () => {
  await withDb(async (t) => {
    const { tenantId } = await createSeeder(t.raw).tenant('O');
    let n = 0;
    const code = () => `OT${(n += 1)}`;
    for (const dim of DIMENSIONS) {
      const check = (suffix) => `ck_objecttype_resize${dim.letter}_${suffix}`;
      const withDefault = (value) => {
        const d = [null, null, null];
        d[dim.defaultAt] = value;
        return d;
      };
      await assertCheckRefused(
        () => t.db.query(INSERT_TYPE, typeParams(tenantId, code(), { [dim.key]: [2, 1] })),
        check('order'),
        `${dim.name}: min above max`,
      );
      await assertCheckRefused(
        () => t.db.query(INSERT_TYPE, typeParams(tenantId, code(), { [dim.key]: [0, 1] })),
        check('order'),
        `${dim.name}: a zero min (0 < min)`,
      );
      await assertCheckRefused(
        () => t.db.query(INSERT_TYPE, typeParams(tenantId, code(), { [dim.key]: [1, null] })),
        check('pair'),
        `${dim.name}: min without max`,
      );
      await assertCheckRefused(
        () => t.db.query(INSERT_TYPE, typeParams(tenantId, code(), { [dim.key]: [null, 2] })),
        check('pair'),
        `${dim.name}: max without min`,
      );
      await assertCheckRefused(
        () =>
          t.db.query(
            INSERT_TYPE,
            typeParams(tenantId, code(), { d: withDefault(5), [dim.key]: [1, 2] }),
          ),
        check('default'),
        `${dim.name}: a default above its range`,
      );
      await assertCheckRefused(
        () =>
          t.db.query(
            INSERT_TYPE,
            typeParams(tenantId, code(), { d: withDefault(0.5), [dim.key]: [1, 2] }),
          ),
        check('default'),
        `${dim.name}: a default below its range`,
      );
      // accepted: fixed (both NULL), a range with the default inside it (the ends included), min equal to max
      for (const ok of [
        { [dim.key]: [null, null] },
        { d: withDefault(1.5), [dim.key]: [1, 2] },
        { d: withDefault(1), [dim.key]: [1, 2] },
        { d: withDefault(2), [dim.key]: [1, 2] },
        { d: withDefault(1.5), [dim.key]: [1.5, 1.5] },
        { d: withDefault(null), [dim.key]: [1, 2] },
      ]) {
        const made = await one(t, INSERT_TYPE, typeParams(tenantId, code(), ok));
        assert.ok(made.objecttypeid, `${dim.name}: ${JSON.stringify(ok)} is accepted`);
      }
    }
  });
});

test("AC-3: Mount = 'ceiling' is refused, floor and wall are accepted, and the CHECK's values equal the constants file's ItemMount", async () => {
  const check =
    /CONSTRAINT\s+CK_ObjectType_Mount\s+CHECK\s*\(\s*Mount\s+IN\s*\(([^)]*)\)\s*\)/i.exec(
      SCHEMA_TEXT,
    );
  assert.ok(check, 'CK_ObjectType_Mount is in schema.sql');
  const values = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...values].sort(),
    [...closedSet('ItemMount')].sort(),
    'the same values (invariant 14)',
  );
  await withDb(async (t) => {
    const { tenantId } = await createSeeder(t.raw).tenant('P');
    await assertCheckRefused(
      () => t.db.query(INSERT_TYPE, typeParams(tenantId, 'CEILING1', { mount: 'ceiling' })),
      'ck_objecttype_mount',
      'ceiling mount',
    );
    for (const mount of ['floor', 'wall']) {
      assert.ok(
        (await one(t, INSERT_TYPE, typeParams(tenantId, `M_${mount}`, { mount }))).objecttypeid,
      );
    }
    const defaults = await one(
      t,
      `INSERT INTO gabay.ObjectType (TenantId, Code, Label) VALUES ($1, 'PLAIN', 'Plain')
       RETURNING Mount AS mount, IsRound AS isround, ResizeMinWidthM AS rw, ResizeMaxHeightM AS rh`,
      [tenantId],
    );
    assert.deepEqual(
      defaults,
      { mount: 'floor', isround: false, rw: null, rh: null },
      'the column defaults',
    );
  });
});

test('AC-3: after the platform seed, PILLAR, SHAFT and FURNITURE read fixed (no resize range), floor-mounted and not round', async () => {
  await withDb(async (t) => {
    // Other test files insert the roles this writes in their own transactions: a table lock taken first makes them wait for
    // this transaction instead of crossing it in the unique index (the same care as seed.visible.test.js).
    await t.raw.query('LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE', []);
    await seedPlatform(t.raw);
    const found = await rows(
      t,
      `SELECT Code AS code, Mount AS mount, IsRound AS isround,
              ResizeMinWidthM AS a, ResizeMaxWidthM AS b, ResizeMinDepthM AS c, ResizeMaxDepthM AS d,
              ResizeMinHeightM AS e, ResizeMaxHeightM AS f
         FROM gabay.ObjectType WHERE TenantId IS NULL AND Code IN ('PILLAR', 'SHAFT', 'FURNITURE') ORDER BY Code`,
    );
    assert.deepEqual(
      found.map((r) => r.code),
      ['FURNITURE', 'PILLAR', 'SHAFT'],
    );
    for (const r of found) {
      assert.equal(r.mount, 'floor', `${r.code} mount`);
      assert.equal(r.isround, false, `${r.code} round`);
      assert.deepEqual(
        [r.a, r.b, r.c, r.d, r.e, r.f],
        [null, null, null, null, null, null],
        `${r.code} is fixed`,
      );
    }
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-4

test('AC-4: Tenant.CatalogVersion exists, a new tenant starts at 1, and a value below 1 is refused', async () => {
  await withDb(async (t) => {
    const seed = createSeeder(t.raw);
    const tenant = await seed.tenant('Q');
    const row = await one(t, `SELECT CatalogVersion AS v FROM gabay.Tenant WHERE TenantId = $1`, [
      tenant.tenantId,
    ]);
    assert.equal(row.v, 1);
    await assertCheckRefused(
      () =>
        t.db.query(`UPDATE gabay.Tenant SET CatalogVersion = 0 WHERE TenantId = $1`, [
          tenant.tenantId,
        ]),
      'ck_tenant_catalogversion',
      'catalog version 0',
    );
  });
});

// ----------------------------------------------------------------------------------------------------------- AC-37

const version = async (t, tenantId) =>
  (await one(t, `SELECT CatalogVersion AS v FROM gabay.Tenant WHERE TenantId = $1`, [tenantId])).v;

const INSERT_PLAIN = `INSERT INTO gabay.ObjectType (TenantId, Code, Label) VALUES ($1, $2, $2) RETURNING ObjectTypeId`;

test("AC-37: a tenant ObjectType row inserted, updated or deleted adds 1 to that tenant's counter only, in the same transaction", async () => {
  await withDb(async (t) => {
    const seed = createSeeder(t.raw);
    const a = await seed.tenant('A');
    const b = await seed.tenant('B');
    assert.deepEqual([await version(t, a.tenantId), await version(t, b.tenantId)], [1, 1]);

    const made = await one(t, INSERT_PLAIN, [a.tenantId, 'T_ONE']);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [2, 1],
      'insert',
    );

    await t.db.query(`UPDATE gabay.ObjectType SET Label = 'Renamed' WHERE ObjectTypeId = $1`, [
      made.objecttypeid,
    ]);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [3, 1],
      'update',
    );

    await t.db.query(`DELETE FROM gabay.ObjectType WHERE ObjectTypeId = $1`, [made.objecttypeid]);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [4, 1],
      'delete',
    );

    const audit = await one(
      t,
      `SELECT UpdatedAt AS u, UpdatedBy AS b FROM gabay.Tenant WHERE TenantId = $1`,
      [a.tenantId],
    );
    assert.deepEqual(
      audit,
      { u: null, b: null },
      'only CatalogVersion is set, never UpdatedAt or UpdatedBy',
    );
  });
});

test("AC-37: a platform ObjectType row change adds 1 to every tenant's counter", async () => {
  await withDb(async (t) => {
    const seed = createSeeder(t.raw);
    const a = await seed.tenant('A');
    const b = await seed.tenant('B');
    const made = await one(t, INSERT_PLAIN, [null, `PLAT_${seed.tag}`]);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [2, 2],
      'insert',
    );
    await t.db.query(`UPDATE gabay.ObjectType SET Label = 'Renamed' WHERE ObjectTypeId = $1`, [
      made.objecttypeid,
    ]);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [3, 3],
      'update',
    );
    await t.db.query(`DELETE FROM gabay.ObjectType WHERE ObjectTypeId = $1`, [made.objecttypeid]);
    assert.deepEqual(
      [await version(t, a.tenantId), await version(t, b.tenantId)],
      [4, 4],
      'delete',
    );
  });
});

test('AC-37: an update that moves a row between owners counts both owners once each (plan DC-A16)', async () => {
  await withDb(async (t) => {
    const seed = createSeeder(t.raw);
    const a = await seed.tenant('A');
    const b = await seed.tenant('B');
    const made = await one(t, INSERT_PLAIN, [a.tenantId, 'MOVER']);
    assert.deepEqual([await version(t, a.tenantId), await version(t, b.tenantId)], [2, 1]);
    await t.db.query(`UPDATE gabay.ObjectType SET TenantId = $2 WHERE ObjectTypeId = $1`, [
      made.objecttypeid,
      b.tenantId,
    ]);
    assert.deepEqual([await version(t, a.tenantId), await version(t, b.tenantId)], [3, 2]);
  });
});

test('AC-37: a write rolled back to a savepoint moves no counter', async () => {
  await withDb(async (t) => {
    const seed = createSeeder(t.raw);
    const a = await seed.tenant('A');
    await t.raw.query('SAVEPOINT counter_probe', []);
    await t.raw.query(INSERT_PLAIN, [a.tenantId, 'ROLLED']);
    await t.raw.query(INSERT_PLAIN, [null, `ROLLED_${seed.tag}`]);
    assert.equal(await version(t, a.tenantId), 3, 'inside the savepoint both writes counted');
    await t.raw.query('ROLLBACK TO SAVEPOINT counter_probe', []);
    assert.equal(await version(t, a.tenantId), 1, 'rolled back: the counter is where it was');
    await t.raw.query('RELEASE SAVEPOINT counter_probe', []);
  });
});
