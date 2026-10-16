'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-34 to AC-36, EC-46 to EC-50; plan/SEC-1.md 1.0 step 1): migration 0002, schema 0.15 -> 0.16.
// The access rows the guards read (four Role rows if absent, four PermissionRoute rows, T2's twelve RolePermission rows)
// and the drop of the redundant UX_UserRole. Every database state is built in ONE scratch database (scratchDb.js: created
// for this file, dropped at its end; the working copy's own database is never written) by emptying the gabay schema and
// running a schema file:
//
//   (a) fresh: the frozen 0.16 (fixtures/schema-0.16.sql), then 0001 and 0002 (setup-db's order)
//   (b) 0.15 (the frozen fixture) holding rows, then every migration: the same rows, the existing ones untouched, and
//       the catalog fingerprint equals a fresh 0.16
//   (c) run twice: no change
//   (d) an admin's UPDATE of a grant and of a role label: kept on a re-run
//   (e) the seed created the roles first: no duplicate, 4 in all, the seed's ids kept
//   (f) a grant row deleted by hand: restored by the re-run (EC-48)
//   (g) a SUPERADMIN role of the same code not flagged IsPlatformRole (bad data): kept, and holdsSuperAdmin refuses it
//
// T2 is written out once below (spec section 2.4), and the rows read back must equal it, so a changed grant fails here.
//
// OA-3a (plan/OA-3a-migration-rekey.md 1.1 item 6, C1) moved db/schema.sql to 0.17. So that this file keeps testing what
// its name says, "0.15 -> 0.16, 0002", its 0.16 side is the frozen fixtures/schema-0.16.sql (scratchDb.applySchema016)
// and its migrate runs a temporary folder holding 0001 and 0002 only. migration0003.test.js tests 0.16 -> 0.17.

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
const { holdsSuperAdmin } = require('../../../functions/src/auth/permissionMerge');

const FILE = '0002_permission_rows_and_userrole_index.sql';

const ROLES = Object.freeze([
  { code: 'MALL_ADMIN', label: 'Mall admin', platform: false },
  { code: 'SUPERADMIN', label: 'Super admin', platform: true },
  { code: 'VENUE_EDITOR', label: 'Venue editor', platform: false },
  { code: 'VIEWER', label: 'Viewer', platform: false },
]);
const ROUTE_KEYS = Object.freeze(['lookups', 'venue-maps', 'venue-versions', 'venues']); // code-unit order

/** T2 (spec section 2.4): role -> route -> 'CRUD' with '-' for false. SUPERADMIN has no rows (DC-7). */
const T2 = Object.freeze({
  MALL_ADMIN: { lookups: '-R--', venues: 'CRU-', 'venue-maps': 'CRUD', 'venue-versions': 'C---' },
  VENUE_EDITOR: { lookups: '-R--', venues: '-R--', 'venue-maps': 'CRUD', 'venue-versions': '----' },
  VIEWER: { lookups: '-R--', venues: '-R--', 'venue-maps': '-R--', 'venue-versions': '----' },
});

const t2Lines = () =>
  Object.entries(T2)
    .flatMap(([role, routes]) =>
      Object.entries(routes).map(([key, crud]) => `${role} ${key} ${crud}`),
    )
    .sort(byCodeUnits);

const THROUGH_0002 = migrationsThrough(2);
const migrate = (client) => quiet(() => runMigrations(client, THROUGH_0002));

/** Code-unit order, not the database collation (which may sort "venue-versions" after "venues"). */
const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The access rows as plain text, sorted in code-unit order: what a test compares. */
async function accessRows(client) {
  const roles = (
    await client.query(
      `SELECT Code AS code, Label AS label, IsPlatformRole AS platform, IsActive AS active,
              CreatedBy AS "createdBy", UpdatedBy AS "updatedBy", RoleId AS id
         FROM gabay.Role ORDER BY Code`,
    )
  ).rows;
  const routes = (
    await client.query(
      `SELECT RouteKey AS key, Label AS label, CreatedBy AS "createdBy" FROM gabay.PermissionRoute ORDER BY RouteKey`,
    )
  ).rows;
  const grants = (
    await client.query(
      `SELECT r.Code || ' ' || pr.RouteKey || ' ' ||
              CASE WHEN rp.CanCreate THEN 'C' ELSE '-' END || CASE WHEN rp.CanRead THEN 'R' ELSE '-' END ||
              CASE WHEN rp.CanUpdate THEN 'U' ELSE '-' END || CASE WHEN rp.CanDelete THEN 'D' ELSE '-' END AS line,
              rp.CreatedBy AS "createdBy"
         FROM gabay.RolePermission rp
         JOIN gabay.Role r ON r.RoleId = rp.RoleId
         JOIN gabay.PermissionRoute pr ON pr.PermissionRouteId = rp.PermissionRouteId
        ORDER BY 1`,
    )
  ).rows;
  return {
    roles: roles.sort((a, b) => byCodeUnits(a.code, b.code)),
    routes: routes.sort((a, b) => byCodeUnits(a.key, b.key)),
    grants: grants.map((g) => g.line).sort(byCodeUnits),
    grantRows: grants,
  };
}

const indexExists = async (client) =>
  (
    await client.query(
      `SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'gabay' AND indexname = 'ux_userrole') AS e`,
    )
  ).rows[0].e;

/** The expected end state of a database that held no access rows: four roles, four routes, T2, no UX_UserRole. */
async function assertSeededState(client, note) {
  const rows = await accessRows(client);
  assert.deepEqual(
    rows.roles.map((r) => ({
      code: r.code,
      label: r.label,
      platform: r.platform,
      active: r.active,
    })),
    ROLES.map((r) => ({ ...r, active: true })),
    `${note}: the four roles of L41 with the seed's labels`,
  );
  assert.deepEqual(
    rows.routes.map((r) => r.key),
    ROUTE_KEYS,
    `${note}: the four route keys`,
  );
  assert.deepEqual(rows.grants, t2Lines(), `${note}: the twelve grants are T2`);
  assert.equal(rows.grants.length, 12);
  for (const r of [...rows.roles, ...rows.routes, ...rows.grantRows]) {
    assert.equal(r.createdBy, null, `${note}: CreatedBy stays NULL`);
  }
  assert.equal(await indexExists(client), false, `${note}: UX_UserRole is gone`);
}

test('AC-34: migration 0002 is db/migrations/0002_<name>.sql, the second, four digits, no transaction statement of its own, unquoted identifiers, ending with a -- verify: SELECT', () => {
  const all = readMigrations(); // throws on a bad name, a repeated number or a missing verify query
  assert.ok(all.length >= 2, 'two migrations at least');
  const second = all[1];
  assert.equal(second.name, FILE);
  assert.match(second.name, NAME_PATTERN);
  assert.match(second.name, /^0002_[a-z0-9_]+\.sql$/);
  assert.ok(second.verify, 'it ends with a -- verify: SELECT');
  assert.match(second.verify, /ux_userrole/, 'the verify query reports the index');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, FILE), 'utf8');
  const code = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  assert.doesNotMatch(
    code,
    /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|END)\s*(TRANSACTION|WORK)?\s*;/im,
    'the runner owns the transaction',
  );
  assert.doesNotMatch(code, /["]\w+["]\s*\./, 'identifiers are never quoted, as in schema.sql');
  // Every insert does nothing on a conflict: a re-run never overwrites an admin's change (AC-34).
  const inserts = code.match(/\bINSERT\s+INTO\b/gi) ?? [];
  const conflicts = code.match(/\bON\s+CONFLICT\b[^;]*\bDO\s+NOTHING\b/gi) ?? [];
  assert.equal(inserts.length, 3, 'three inserts: roles, routes, grants');
  assert.equal(conflicts.length, 3, 'each does nothing on a conflict');
  assert.doesNotMatch(code, /\bON\s+CONFLICT\b[^;]*\bDO\s+UPDATE\b/i);
  assert.match(
    code,
    /\bDROP\s+INDEX\s+IF\s+EXISTS\s+gabay\.UX_UserRole\s*;/i,
    'the drop is guarded',
  );
  assert.doesNotMatch(
    code,
    /\bDROP\s+(TABLE|COLUMN|SCHEMA|TRIGGER|FUNCTION)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i,
  );
});

test('AC-35 (a), AC-36: a fresh database (schema.sql 0.16, then the migrations) has the four roles, four routes, T2 and no UX_UserRole; UQ_UserRole still refuses a duplicate, a NULL tenant included', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applySchema016(c);
    assert.equal(await indexExists(c), false, 'schema.sql 0.16 has no UX_UserRole');
    const fresh = await fingerprint(c);
    await migrate(c);
    await assertSeededState(c, '(a)');
    assert.deepEqual(
      difference(fresh, await fingerprint(c)),
      { onlyFirst: [], onlySecond: [] },
      '(a) on a 0.16 database the migrations change no catalog object',
    );

    // UQ_UserRole (AC-36): a duplicate row is refused with 23505, the NULL-tenant (platform) one included.
    await c.query(
      `INSERT INTO gabay.Tenant (Code, Name) VALUES ('UQT', 'Unique test');
       INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('uq-uid', 'uq@gabay.test', 'Uq');`,
    );
    const ids = (
      await c.query(
        `SELECT (SELECT UserId FROM gabay.AppUser WHERE FirebaseUid = 'uq-uid') AS u,
                (SELECT RoleId FROM gabay.Role WHERE Code = 'SUPERADMIN') AS sa,
                (SELECT RoleId FROM gabay.Role WHERE Code = 'VIEWER') AS v,
                (SELECT TenantId FROM gabay.Tenant WHERE Code = 'UQT') AS t`,
      )
    ).rows[0];
    const insertRole = (roleId, tenantId) =>
      c.query('INSERT INTO gabay.UserRole (UserId, RoleId, TenantId) VALUES ($1, $2, $3)', [
        ids.u,
        roleId,
        tenantId,
      ]);
    await insertRole(ids.sa, null);
    await insertRole(ids.v, ids.t);
    for (const [label, roleId, tenantId] of [
      ['a NULL-tenant duplicate', ids.sa, null],
      ['a tenant duplicate', ids.v, ids.t],
    ]) {
      await assert.rejects(
        () => insertRole(roleId, tenantId),
        (err) => err.code === '23505' && /uq_userrole/i.test(err.constraint ?? ''),
        `UQ_UserRole refuses ${label}`,
      );
    }
  });
});

test('AC-35 (b) to (g), EC-46 to EC-50: migration 0002 on a 0.15 database, run again, after edits, after the seed, after a deleted grant, with a bad-data role', async () => {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();

    // The fresh 0.16 fingerprint, the target of (b).
    await scratch.reset(c);
    await scratch.applySchema016(c);
    await migrate(c);
    const fresh016 = await fingerprint(c);

    // ---- (b) 0.15 holding rows -> 0.16, the same access rows, the existing rows untouched --------------------------------
    await scratch.reset(c);
    await scratch.applySchema015(c);
    assert.equal(await indexExists(c), true, '0.15 has UX_UserRole');
    await c.query(
      `INSERT INTO gabay.Tenant (Code, Name) VALUES ('MIGT', 'Migration tenant');
       INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('mig-uid', 'mig@gabay.test', 'Mig');
       INSERT INTO gabay.Role (Code, Label) VALUES ('MERCHANT', 'Merchant (a later role)');
       INSERT INTO gabay.UserRole (UserId, RoleId, TenantId)
         SELECT u.UserId, r.RoleId, t.TenantId FROM gabay.AppUser u, gabay.Role r, gabay.Tenant t
          WHERE u.FirebaseUid = 'mig-uid' AND r.Code = 'MERCHANT' AND t.Code = 'MIGT';`,
    );
    const otherRows = async () =>
      (
        await c.query(
          `SELECT md5(string_agg(x, '|' ORDER BY x)) AS h FROM (
             SELECT 'T' || TenantId || Code || Name || IsActive AS x FROM gabay.Tenant
             UNION ALL SELECT 'U' || UserId || FirebaseUid || Email || IsActive FROM gabay.AppUser
             UNION ALL SELECT 'R' || RoleId || Code || Label || IsPlatformRole || IsActive FROM gabay.Role WHERE Code = 'MERCHANT'
             UNION ALL SELECT 'UR' || UserRoleId || UserId || RoleId || coalesce(TenantId::text, '-') FROM gabay.UserRole) s`,
        )
      ).rows[0].h;
    const before = await otherRows();
    await migrate(c);
    assert.deepEqual(
      difference(fresh016, await fingerprint(c)),
      { onlyFirst: [], onlySecond: [] },
      '(b) a migrated 0.15 equals a fresh 0.16, to the fingerprint',
    );
    assert.equal(await otherRows(), before, '(b) the existing rows are untouched');
    const afterB = await accessRows(c);
    assert.deepEqual(
      afterB.roles.map((r) => r.code),
      ['MALL_ADMIN', 'MERCHANT', 'SUPERADMIN', 'VENUE_EDITOR', 'VIEWER'],
      '(b) the four roles added beside the existing one',
    );
    assert.deepEqual(afterB.grants, t2Lines(), '(b) T2');
    assert.equal(await indexExists(c), false, '(b) the index is gone');

    // ---- (c) run twice: nothing changes (EC-50: the drop on a database without the index is no error) --------------------
    const snapshot = JSON.stringify(await accessRows(c));
    const stamps = async () =>
      (
        await c.query(
          `SELECT string_agg(CreatedAt::text || coalesce(UpdatedAt::text, '-'), '|' ORDER BY RoleId, PermissionRouteId) AS s
             FROM gabay.RolePermission`,
        )
      ).rows[0].s;
    const stampsBefore = await stamps();
    await migrate(c);
    await migrate(c);
    assert.equal(JSON.stringify(await accessRows(c)), snapshot, '(c) the rows are as they were');
    assert.equal(await stamps(), stampsBefore, '(c) no row was rewritten');
    assert.deepEqual(difference(fresh016, await fingerprint(c)), { onlyFirst: [], onlySecond: [] });

    // ---- (d) an admin's UPDATE of a grant and of a role label: kept on a re-run (EC-47) -----------------------------------
    await c.query(
      `UPDATE gabay.RolePermission SET CanRead = FALSE
        WHERE RoleId = (SELECT RoleId FROM gabay.Role WHERE Code = 'VIEWER')
          AND PermissionRouteId = (SELECT PermissionRouteId FROM gabay.PermissionRoute WHERE RouteKey = 'venues');
       UPDATE gabay.Role SET Label = 'Read-only staff' WHERE Code = 'VIEWER';
       UPDATE gabay.PermissionRoute SET Label = 'Malls' WHERE RouteKey = 'venues';`,
    );
    await migrate(c);
    const afterD = await accessRows(c);
    assert.ok(afterD.grants.includes('VIEWER venues ----'), '(d) the edited grant is kept');
    assert.equal(
      afterD.roles.find((r) => r.code === 'VIEWER').label,
      'Read-only staff',
      '(d) the label is kept',
    );
    assert.equal(
      afterD.routes.find((r) => r.key === 'venues').label,
      'Malls',
      '(d) the route label is kept',
    );

    // ---- (f) a grant row deleted by hand comes back on the next run, with T2's flags (EC-48) ----------------------------
    await c.query(
      `DELETE FROM gabay.RolePermission
        WHERE RoleId = (SELECT RoleId FROM gabay.Role WHERE Code = 'VENUE_EDITOR')
          AND PermissionRouteId = (SELECT PermissionRouteId FROM gabay.PermissionRoute WHERE RouteKey = 'venue-maps')`,
    );
    assert.ok(!(await accessRows(c)).grants.some((g) => g.startsWith('VENUE_EDITOR venue-maps')));
    await migrate(c);
    assert.ok(
      (await accessRows(c)).grants.includes('VENUE_EDITOR venue-maps CRUD'),
      '(f) the deleted grant is restored as T2 has it',
    );

    // ---- (e) the seed created the roles first (its labels, its ids): no duplicate, 4 in all (EC-46) ----------------------
    await scratch.reset(c);
    await scratch.applySchema015(c);
    await c.query(
      `INSERT INTO gabay.Role (Code, Label, IsPlatformRole)
       VALUES ('SUPERADMIN', 'Super admin', TRUE), ('MALL_ADMIN', 'Mall admin', FALSE),
              ('VENUE_EDITOR', 'Venue editor', FALSE), ('VIEWER', 'Viewer', FALSE)`,
    );
    const seededIds = (await accessRows(c)).roles.map((r) => [r.code, r.id]);
    await migrate(c);
    await assertSeededState(c, '(e)');
    assert.deepEqual(
      (await accessRows(c)).roles.map((r) => [r.code, r.id]),
      seededIds,
      "(e) the seed's role ids are kept: no role was inserted again",
    );

    // ---- (g) a SUPERADMIN of the same code not flagged as a platform role (bad data): kept; the bypass is refused (EC-49) ----
    await scratch.reset(c);
    await scratch.applySchema015(c);
    await c.query(
      `INSERT INTO gabay.Role (Code, Label, IsPlatformRole) VALUES ('SUPERADMIN', 'Bad copy', FALSE)`,
    );
    await migrate(c);
    const bad = (await accessRows(c)).roles.find((r) => r.code === 'SUPERADMIN');
    assert.deepEqual(
      { label: bad.label, platform: bad.platform },
      { label: 'Bad copy', platform: false },
      '(g) the migration keeps the existing row as it is',
    );
    assert.equal(
      holdsSuperAdmin([
        { roleCode: bad.code, isPlatformRole: bad.platform, tenantId: null, roleId: bad.id },
      ]),
      false,
      '(g) a NULL-tenant SUPERADMIN row of a role not flagged IsPlatformRole gives no bypass',
    );
  });
});
