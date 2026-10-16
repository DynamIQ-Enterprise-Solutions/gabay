'use strict';

// DEP-0 AC-19 to AC-23 (spec/DEP-0.md r2; plan/DEP-0.md 1.0 step 3): the two logins and their grants, shown by CONNECTING as each
// one on a throwaway database, with throwaway role names (scratchRoles.js: gabay_t_<copy>_<pid>_<n>_{migrate,api}, dropped in a
// finally; AC-23 asserts the cluster holds none afterwards). The database is built the way a deployed one is: the admin makes
// the roles (initRoles), then gabay_migrate applies db/schema.sql and every migration and runs the grants step, and gabay_api is
// tried against the result. Nothing here touches the working copy's own database.
//
//   AC-19  initRoles: attributes, privileges, re-run, a rotated password, escaping, nothing printed
//   AC-20  applyGrants: exactly the listed grants, no sequence privilege, AuditLog read and append only, idempotent (relacl),
//          drift removed
//   AC-21  what each login can and cannot do (42501 for DDL, TRUNCATE and an AuditLog edit; the frozen-version trigger holds)
//   AC-22  the database halves of staging:seed and staging:admin run as gabay_api
//   AC-23  no throwaway role is left behind

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Client } = require('pg');
const { initRoles, ROLE_NAMES } = require('../lib/roles');
const { applyGrants, AUDIT_TABLE } = require('../lib/grants');
const { runMigrations } = require('../lib/migrations');
const { withScratchDatabase, SCHEMA_CURRENT, connectionConfig } = require('./scratchDb');
const { withThrowawayRoles, leftoverRoles } = require('./scratchRoles');
const { quiet } = require('./schemaFingerprint');
const { stagingSeed } = require('../../seeds/lib/stagingSeed');
const { provisionAdmin, dbOfClient } = require('../../../tools/lib/stagingAdmin');
const { fakeAdminAuth } = require('../../../functions/test/fakeAdminAuth');

const INSUFFICIENT_PRIVILEGE = '42501';
const FROZEN = 'P0001';

/** Admin makes the roles, gabay_migrate builds the schema, runs the migrations and the grants. Returns { m, a } clients. */
async function deployedLike(r) {
  const made = await initRoles(r.admin, { migrate: r.migrate, api: r.api, passwords: r.passwords });
  assert.deepEqual(made.created.sort(), [r.api, r.migrate].sort());
  const m = await r.connectAs(r.migrate, r.passwords.migrate);
  await m.query(fs.readFileSync(SCHEMA_CURRENT, 'utf8'));
  await quiet(() => runMigrations(m));
  await applyGrants(m, { migrate: r.migrate, api: r.api });
  const a = await r.connectAs(r.api, r.passwords.api);
  return { m, a };
}

const aclOfEveryTable = async (client) =>
  (
    await client.query(
      `SELECT c.relname, c.relacl::text AS acl
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'gabay' AND c.relkind = 'r' ORDER BY c.relname`,
      [],
    )
  ).rows;

/** The error a statement raises, or null. */
async function failure(client, text, params = []) {
  try {
    await client.query(text, params);
    return null;
  } catch (err) {
    return err;
  }
}

test('AC-19: initRoles makes two login-only roles, with the database privileges listed, and a re-run is safe', async () => {
  let scratchName;
  await withScratchDatabase(async (scratch) => {
    scratchName = scratch.name;
    await withThrowawayRoles(scratch, async (r) => {
      const first = await initRoles(r.admin, {
        migrate: r.migrate,
        api: r.api,
        passwords: r.passwords,
      });
      assert.deepEqual(first, { created: [r.migrate, r.api], updated: [] });
      const attrs = (
        await r.admin.query(
          `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
             FROM pg_roles WHERE rolname = ANY($1) ORDER BY rolname`,
          [[r.migrate, r.api]],
        )
      ).rows;
      assert.equal(attrs.length, 2);
      for (const row of attrs) {
        assert.deepEqual(
          [
            row.rolsuper,
            row.rolcreatedb,
            row.rolcreaterole,
            row.rolreplication,
            row.rolbypassrls,
            row.rolcanlogin,
          ],
          [false, false, false, false, false, true],
          row.rolname,
        );
      }
      const db = await r.admin.query('SELECT current_database() AS d', []);
      const priv = async (role, p) =>
        (
          await r.admin.query('SELECT has_database_privilege($1, $2, $3) AS ok', [
            role,
            db.rows[0].d,
            p,
          ])
        ).rows[0].ok;
      assert.equal(await priv(r.migrate, 'CONNECT'), true);
      assert.equal(await priv(r.migrate, 'CREATE'), true);
      assert.equal(await priv(r.api, 'CONNECT'), true);
      assert.equal(
        await priv(r.api, 'CREATE'),
        false,
        'the API login holds no CREATE on the database',
      );

      // Safe to run again: nothing is created, both are updated.
      const second = await initRoles(r.admin, {
        migrate: r.migrate,
        api: r.api,
        passwords: r.passwords,
      });
      assert.deepEqual(second, { created: [], updated: [r.migrate, r.api] });
    });
  });
  assert.deepEqual(await leftoverRoles(scratchName), [], 'AC-23: no throwaway role is left');
});

test('AC-19: a re-run with new passwords rotates them: the old one is refused, the new one works', async () => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      await initRoles(r.admin, { migrate: r.migrate, api: r.api, passwords: r.passwords });
      const rotated = { migrate: `${r.passwords.migrate}-new`, api: `${r.passwords.api}-new` };
      await initRoles(r.admin, { migrate: r.migrate, api: r.api, passwords: rotated });
      for (const [role, old] of [
        [r.migrate, r.passwords.migrate],
        [r.api, r.passwords.api],
      ]) {
        await assert.rejects(
          () => r.connectAs(role, old),
          (err) => err.code === '28P01',
        );
      }
      const a = await r.connectAs(r.api, rotated.api);
      assert.equal((await a.query('SELECT 1 AS one', [])).rows[0].one, 1);
    });
  });
});

test('AC-19: a password with quotes, backslashes and semicolons is stored as given, and the text is never printed', async () => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      const hard = { migrate: `a'b"c\\d;--e`, api: `x' OR '1'='1\\` };
      const printed = [];
      const { log, error, warn } = console;
      console.log = (...a) => printed.push(a.join(' '));
      console.error = (...a) => printed.push(a.join(' '));
      console.warn = (...a) => printed.push(a.join(' '));
      try {
        await initRoles(r.admin, { migrate: r.migrate, api: r.api, passwords: hard });
      } finally {
        Object.assign(console, { log, error, warn });
      }
      assert.deepEqual(printed, [], 'initRoles prints nothing');
      for (const [role, pw] of [
        [r.migrate, hard.migrate],
        [r.api, hard.api],
      ]) {
        const c = await r.connectAs(role, pw);
        assert.equal((await c.query('SELECT 1 AS one', [])).rows[0].one, 1, role);
      }
    });
  });
});

test('AC-19: a bad name or password is refused before any statement is sent', async () => {
  const sent = [];
  const fake = {
    escapeIdentifier: (s) => `"${s}"`,
    escapeLiteral: (s) => `'${s}'`,
    query: async (text) => {
      sent.push(text);
      return { rows: [{ name: 'x' }] };
    },
  };
  const ok = { migrate: 'm_ok', api: 'a_ok', passwords: { migrate: 'p', api: 'q' } };
  for (const bad of [
    { ...ok, migrate: 'x"; DROP ROLE postgres; --' },
    { ...ok, api: 'Gabay_Api' },
    { ...ok, api: 'a'.repeat(64) },
    { ...ok, api: ok.migrate },
    { ...ok, passwords: { migrate: '', api: 'q' } },
    { ...ok, passwords: { migrate: 'p' } },
    { ...ok, passwords: undefined },
  ]) {
    await assert.rejects(() => initRoles(fake, bad));
  }
  assert.deepEqual(sent, []);
  assert.deepEqual(ROLE_NAMES, { migrate: 'gabay_migrate', api: 'gabay_api' });
});

test('AC-20, AC-21: the grants, and what each login can and cannot do (one deployed-like database, built once)', async (t) => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      const { m, a } = await deployedLike(r);
      await t.test(
        'AC-20: the grants are exactly the listed ones, with no sequence privilege, and AuditLog only read and appended',
        async () => {
          const { rows } = await m.query(
            `SELECT c.relname,
                  has_table_privilege($1, c.oid, 'SELECT') AS s, has_table_privilege($1, c.oid, 'INSERT') AS i,
                  has_table_privilege($1, c.oid, 'UPDATE') AS u, has_table_privilege($1, c.oid, 'DELETE') AS d,
                  has_table_privilege($1, c.oid, 'TRUNCATE') AS t, has_table_privilege($1, c.oid, 'REFERENCES') AS r,
                  has_table_privilege($1, c.oid, 'TRIGGER') AS g
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'gabay' AND c.relkind = 'r' ORDER BY c.relname`,
            [r.api],
          );
          assert.ok(rows.length >= 58, `every table was checked (${rows.length})`);
          for (const row of rows) {
            const audit = row.relname === AUDIT_TABLE.toLowerCase();
            assert.deepEqual(
              [row.s, row.i, row.u, row.d, row.t, row.r, row.g],
              [true, true, !audit, !audit, false, false, false],
              row.relname,
            );
          }
          const schemaPriv = (
            await m.query(
              `SELECT has_schema_privilege($1, 'gabay', 'USAGE') AS u, has_schema_privilege($1, 'gabay', 'CREATE') AS c`,
              [r.api],
            )
          ).rows[0];
          assert.deepEqual(schemaPriv, { u: true, c: false });
          const sequences = await m.query(
            `SELECT c.relname, has_sequence_privilege($1, c.oid, 'USAGE') AS u, has_sequence_privilege($1, c.oid, 'UPDATE') AS w
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'gabay' AND c.relkind = 'S'`,
            [r.api],
          );
          assert.ok(sequences.rows.length > 0, 'the identity columns have sequences');
          assert.ok(
            sequences.rows.every((s) => s.u === false && s.w === false),
            'the API login holds no sequence privilege: an INSERT into an identity column needs none (AC-21 shows it)',
          );
        },
      );

      await t.test(
        'AC-20: running the grants step twice leaves every table ACL identical, and a manual extra grant is taken away',
        async () => {
          const before = await aclOfEveryTable(m);
          await applyGrants(m, { migrate: r.migrate, api: r.api });
          assert.deepEqual(await aclOfEveryTable(m), before, 'the second run changed no ACL');
          await applyGrants(m, { migrate: r.migrate, api: r.api });
          assert.deepEqual(await aclOfEveryTable(m), before, 'nor the third');
          // Drift: someone granted TRUNCATE by hand, and UPDATE on the audit trail.
          await m.query(`GRANT TRUNCATE ON gabay.Tenant TO "${r.api}"`);
          await m.query(`GRANT UPDATE ON gabay.AuditLog TO "${r.api}"`);
          await applyGrants(m, { migrate: r.migrate, api: r.api });
          assert.deepEqual(
            await aclOfEveryTable(m),
            before,
            'the grants step puts the ACLs back as listed',
          );
        },
      );

      await t.test(
        'AC-21: gabay_api can read and write the tables of schema.sql and of a LATER migration with no new grant, identity inserts included',
        async () => {
          const tenant = await a.query(
            `INSERT INTO gabay.Tenant (Code, Name) VALUES ('T-API', 'API test') RETURNING TenantId`,
            [],
          );
          const tenantId = tenant.rows[0].tenantid;
          assert.ok(
            Number.isInteger(tenantId),
            'an INSERT into an identity column works with no sequence grant',
          );
          await a.query(`UPDATE gabay.Tenant SET Name = 'Renamed' WHERE TenantId = $1`, [tenantId]);
          assert.equal(
            (await a.query(`SELECT Name FROM gabay.Tenant WHERE TenantId = $1`, [tenantId])).rows[0]
              .name,
            'Renamed',
          );
          await a.query(`DELETE FROM gabay.Tenant WHERE TenantId = $1`, [tenantId]);

          // A table a later migration makes (by gabay_migrate, after the grants step ran once): usable at once.
          await m.query(
            `CREATE TABLE gabay.LaterProbe (ProbeId INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, N INT NOT NULL)`,
          );
          const probe = await a.query(
            `INSERT INTO gabay.LaterProbe (N) VALUES (1) RETURNING ProbeId`,
            [],
          );
          assert.equal(probe.rows.length, 1);
          await a.query(`UPDATE gabay.LaterProbe SET N = 2`, []);
          assert.equal((await a.query(`SELECT N FROM gabay.LaterProbe`, [])).rows[0].n, 2);
          await a.query(`DELETE FROM gabay.LaterProbe`, []);
          assert.equal(
            (
              await a.query(
                `SELECT has_table_privilege(current_user, 'gabay.LaterProbe', 'TRUNCATE') AS t`,
                [],
              )
            ).rows[0].t,
            false,
            'and only the four privileges',
          );
        },
      );

      await t.test(
        'AC-21: gabay_api cannot create, drop, alter or truncate anything, and cannot edit the audit trail',
        async () => {
          for (const text of [
            'CREATE TABLE gabay.NotAllowed (a INT)',
            'CREATE TABLE public.NotAllowed (a INT)',
            'CREATE SCHEMA notallowed',
            'DROP TABLE gabay.Tenant',
            'ALTER TABLE gabay.Tenant ADD COLUMN z INT',
            'ALTER TABLE gabay.VenueVersion DISABLE TRIGGER TR_VenueVersion_Frozen',
            'TRUNCATE gabay.Tenant',
            'CREATE ROLE notallowed',
            'CREATE DATABASE notallowed',
          ]) {
            const err = await failure(a, text);
            assert.equal(err?.code, INSUFFICIENT_PRIVILEGE, `${text}: ${err?.message}`);
          }
          // The audit trail: it can append and read, never edit or remove (DC-12).
          await a.query(
            `INSERT INTO gabay.AuditLog (Method, Route, StatusCode, RequestId) VALUES ('POST', '/api/x', 200, 'req-1')`,
            [],
          );
          assert.equal(
            (await a.query(`SELECT count(*)::int AS n FROM gabay.AuditLog`, [])).rows[0].n,
            1,
          );
          for (const text of [
            `UPDATE gabay.AuditLog SET StatusCode = 500`,
            `DELETE FROM gabay.AuditLog`,
            `TRUNCATE gabay.AuditLog`,
          ]) {
            assert.equal((await failure(a, text))?.code, INSUFFICIENT_PRIVILEGE, text);
          }
        },
      );

      await t.test(
        'AC-21: the grants do not replace the trigger: an UPDATE or DELETE of a PUBLISHED venue version is still refused',
        async () => {
          const tenant = (
            await m.query(
              `INSERT INTO gabay.Tenant (Code, Name) VALUES ('T-FROZEN', 'Frozen') RETURNING TenantId`,
              [],
            )
          ).rows[0].tenantid;
          const venue = (
            await m.query(
              `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, 'V', 'V', '{"type":"Polygon","coordinates":[]}'::jsonb) RETURNING VenueId`,
              [tenant],
            )
          ).rows[0].venueid;
          const file = (
            await m.query(
              `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
             VALUES ($1, 'PACKAGE', 'application/octet-stream', 1, $2, 'packages/1/1/v1-x.bin') RETURNING FileId`,
              [tenant, 'a'.repeat(64)],
            )
          ).rows[0].fileid;
          const version = (
            await m.query(
              `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256, PackageFormatVersion, PublishedAt, LayoutJson)
             VALUES ($1, $2, 1, 'PUBLISHED', $3, $4, 1, now(), '{}'::jsonb) RETURNING VenueVersionId`,
              [tenant, venue, file, 'a'.repeat(64)],
            )
          ).rows[0].venueversionid;
          for (const text of [
            `UPDATE gabay.VenueVersion SET NodeCount = 9 WHERE VenueVersionId = ${version}`,
            `DELETE FROM gabay.VenueVersion WHERE VenueVersionId = ${version}`,
          ]) {
            const err = await failure(a, text);
            assert.equal(err?.code, FROZEN, text);
            assert.match(err.message, /Frozen Package/);
          }
        },
      );

      await t.test(
        'AC-21: gabay_migrate applies schema.sql and every migration on an empty database, and cannot create a role or a database',
        async () => {
          const tables = (
            await m.query(
              `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'`,
              [],
            )
          ).rows[0].n;
          assert.ok(tables >= 58);
          const owner = (
            await m.query(
              `SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'gabay'`,
              [],
            )
          ).rows;
          assert.deepEqual(
            owner,
            [{ tableowner: r.migrate }],
            'gabay_migrate owns everything schema.sql made',
          );
          assert.equal((await failure(m, 'CREATE ROLE notallowed'))?.code, INSUFFICIENT_PRIVILEGE);
          assert.equal(
            (await failure(m, 'CREATE DATABASE notallowed'))?.code,
            INSUFFICIENT_PRIVILEGE,
          );
        },
      );

      await t.test(
        'AC-22: gabay_api suffices for the database halves of staging:seed and staging:admin (as gabay_api, with a fake Admin auth)',
        async () => {
          await a.query('BEGIN');
          const seeded = await stagingSeed(a, { log: () => {} });
          await a.query('COMMIT');
          assert.equal(seeded.venues.length, 4);
          const auth = fakeAdminAuth();
          const made = {};
          for (const [role, tenant] of [
            ['SUPERADMIN', null],
            ['MALL_ADMIN', 'DEMO_MALLS'],
            ['VIEWER', 'DEMO_MALLS'],
          ]) {
            made[role] = await provisionAdmin({
              db: dbOfClient(a),
              auth,
              projectId: 'gabay-staging',
              input: { email: `${role.toLowerCase()}@example.com`, role, tenant },
            });
          }
          assert.equal(made.SUPERADMIN.accountAdded, true);
          assert.equal(made.MALL_ADMIN.grantsAdded, 0);
          assert.equal(made.VIEWER.grantsAdded, 4, 'a grant for each of the four demo venues');
          const rows = (
            await a.query(
              `SELECT (SELECT count(*)::int FROM gabay.AppUser) AS users, (SELECT count(*)::int FROM gabay.UserRole) AS roles,
                      (SELECT count(*)::int FROM gabay.UserVenueGrant) AS grants`,
              [],
            )
          ).rows[0];
          assert.deepEqual({ ...rows }, { users: 3, roles: 3, grants: 4 });
        },
      );
    });
  });
});

test('AC-23: a role left by a dead process of this working copy is dropped by the next run, and a live one is not', async () => {
  await withScratchDatabase(async (scratch) => {
    const copy = /^gabay_scratch_(.+)_\d+_\d+$/.exec(scratch.name)[1];
    const admin = new Client(connectionConfig('postgres'));
    await admin.connect();
    const dead = `gabay_t_${copy}_2147483000_1_api`; // a pid no live process has
    try {
      await admin.query(`CREATE ROLE "${dead}"`);
      await withThrowawayRoles(scratch, async () => {
        const still = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [dead]);
        assert.equal(still.rows.length, 0, "the dead process's role was dropped first");
      });
    } finally {
      await admin.query(`DROP ROLE IF EXISTS "${dead}"`);
      await admin.end();
    }
  });
});
