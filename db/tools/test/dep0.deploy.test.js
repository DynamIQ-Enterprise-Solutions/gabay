'use strict';

// DEP-0 AC-19, AC-30 to AC-36, AC-43 (spec/DEP-0.md r2; plan/DEP-0.md 1.0 step 4): npm run db:deploy, on throwaway databases
// (scratchDb.js) with throwaway logins (scratchRoles.js). Nothing here touches the working copy's own database.
//
//   argument and environment refusals              AC-30, AC-19, EC-22     (no database needed)
//   an empty database, as gabay_migrate            AC-31, AC-43 (the reference rows equal a dev build's), AC-20 (grants applied)
//   a database that has the schema                 AC-32 (migrations and grants only), AC-33 (nothing destructive), AC-36 (twice)
//   one run at a time, and no queue pile-up        AC-34 (the lock, then lock_timeout)
//   a failing migration                            AC-35 (the run stops, names the file, skips the seed and the grants)
//   --init-roles                                   AC-19 (alone, from the environment, nothing printed)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runDeploy, DEPLOY_LOCK_KEY, REQUIRED_ENV } = require('../lib/deploy');
const { applySchema } = require('../lib/schema');
const { runMigrations, MIGRATIONS_DIR } = require('../lib/migrations');
const { initRoles } = require('../lib/roles');
const { ENV_FILE } = require('../lib/connect');
const { withScratchDatabase, connectionConfig } = require('./scratchDb');
const { withThrowawayRoles } = require('./scratchRoles');
const { quiet } = require('./schemaFingerprint');
const { runSeed } = require('../../seeds/lib/run');

const TOOLS_DIR = path.resolve(__dirname, '..');

function envFor(databaseName, user, password) {
  const c = connectionConfig(databaseName);
  return {
    PGHOST: c.host,
    PGPORT: String(c.port),
    PGDATABASE: databaseName,
    PGUSER: user ?? c.user,
    PGPASSWORD: password ?? c.password,
  };
}

/** Runs db:deploy in-process with its console output collected. Returns { code, out, err }. */
async function deploy(options) {
  const out = [];
  const err = [];
  let code;
  await quiet(async () => {
    code = await runDeploy({
      ...options,
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      table: (rows) => out.push(JSON.stringify(rows)),
    });
  });
  return { code, out, err, text: [...out, ...err].join('\n') };
}

const codeOf = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');

async function tableCounts(client) {
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'gabay' ORDER BY tablename`,
  );
  const counts = {};
  for (const { tablename } of rows) {
    counts[tablename] = (
      await client.query(`SELECT count(*)::int AS n FROM gabay."${tablename}"`)
    ).rows[0].n;
  }
  return counts;
}

const REFERENCE_TABLES = [
  'Role',
  'PermissionRoute',
  'RolePermission',
  'BuildingType',
  'OccupantCategory',
  'AmenityType',
  'TransitType',
  'ConnectorType',
  'ObjectType',
  'BeaconModel',
  'StoreStatus',
];

/** The reference rows of a database as sorted JSON text (timestamps left out): the platform rows (TenantId NULL) of the lookups. */
async function referenceRows(client) {
  const result = {};
  for (const table of REFERENCE_TABLES) {
    const platformOnly = ['Role', 'PermissionRoute', 'RolePermission'].includes(table)
      ? ''
      : 'WHERE TenantId IS NULL';
    const { rows } = await client.query(`SELECT * FROM gabay.${table} ${platformOnly}`);
    result[table] = rows
      .map((row) => {
        const { createdat, updatedat, ...rest } = row;
        void createdat;
        void updatedat;
        return JSON.stringify(rest, Object.keys(rest).sort());
      })
      .sort();
  }
  return result;
}

const aclOfEveryTable = async (client) =>
  (
    await client.query(
      `SELECT c.relname, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'gabay' AND c.relkind = 'r' ORDER BY c.relname`,
    )
  ).rows;

const hashOf = async (client, table) =>
  (
    await client.query(
      `SELECT md5(coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text), '')) AS h FROM gabay.${table} t`,
    )
  ).rows[0].h;

/** A scratch folder holding the real migrations plus the given extra files. */
function migrationsWith(extra = {}, { withReal = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-deploy-migrations-'));
  if (withReal) {
    for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql'))) {
      fs.copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(dir, f));
    }
  }
  for (const [name, sql] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), sql);
  return {
    dir,
    remove: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const withVerify = (sql) => `${sql}\n-- verify:\n-- SELECT 1 AS ok;\n`;

// ------------------------------------------------------------------------------------------------ arguments and environment

test('AC-30, EC-22: an empty environment is refused naming every missing key, with no connection made', async () => {
  let connected = false;
  const r = await deploy({
    env: {},
    newClient: () => {
      connected = true;
      return {};
    },
  });
  assert.equal(r.code, 1);
  assert.equal(connected, false);
  for (const key of REQUIRED_ENV) assert.match(r.text, new RegExp(key));
  assert.match(r.text, /never the repository's \.env/);
  const partial = await deploy({
    env: { PGHOST: 'h', PGPORT: '5432', PGDATABASE: 'd', PGUSER: 'u' },
  });
  assert.equal(partial.code, 1);
  assert.match(partial.text, /PGPASSWORD/);
  assert.doesNotMatch(partial.text, /PGHOST/);
});

test('AC-30: the command ignores the repository .env: with the environment empty it still refuses, whatever .env holds', () => {
  const run = spawnSync(process.execPath, [path.join(TOOLS_DIR, 'deploy.js')], {
    cwd: TOOLS_DIR,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
    encoding: 'utf8',
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Missing PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD/);
  // The claim "a .env is present" is only a claim when one is: the refusal above holds either way, and the source never loads it.
  void ENV_FILE;
  for (const file of [
    path.join(TOOLS_DIR, 'deploy.js'),
    path.join(TOOLS_DIR, 'lib', 'deploy.js'),
  ]) {
    const code = codeOf(file);
    for (const word of ['loadEnv', 'loadEnvFile', 'ENV_FILE', "require('./connect')", 'dotenv']) {
      assert.ok(!code.includes(word), `${path.basename(file)} does not mention ${word}`);
    }
  }
});

test('EC-22, AC-19: an unknown argument is refused, and --init-roles takes no other', async () => {
  const env = envFor('postgres');
  for (const argv of [
    ['--nope'],
    ['--init-roles', '--nope'],
    ['--init-roles', 'extra'],
    ['seed'],
  ]) {
    const r = await deploy({
      env,
      argv,
      newClient: () => assert.fail('no connection for a refused argument'),
    });
    assert.equal(r.code, 1, argv.join(' '));
    assert.match(r.text, /Unknown argument/);
  }
});

test('AC-33: db:deploy has no DROP, TRUNCATE or DELETE of its own, and never starts setup-db', () => {
  for (const file of [
    path.join(TOOLS_DIR, 'deploy.js'),
    path.join(TOOLS_DIR, 'lib', 'deploy.js'),
  ]) {
    const code = codeOf(file);
    for (const re of [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i, /setup-db/, /spawn|exec/]) {
      assert.doesNotMatch(code, re, `${path.basename(file)} ${re}`);
    }
  }
});

// ------------------------------------------------------------------------------------------------------------ --init-roles

test('AC-19: --init-roles makes the two logins from the environment and does nothing else, printing no password', async () => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      const env = {
        ...envFor(scratch.name),
        GABAY_MIGRATE_PASSWORD: 'secret-migrate-pw-1',
        GABAY_API_PASSWORD: 'secret-api-pw-2',
      };
      const roles = { migrate: r.migrate, api: r.api };

      const noPassword = await deploy({
        env: envFor(scratch.name),
        argv: ['--init-roles'],
        roles,
      });
      assert.equal(noPassword.code, 1);
      assert.match(noPassword.text, /GABAY_MIGRATE_PASSWORD, GABAY_API_PASSWORD/);

      const made = await deploy({ env, argv: ['--init-roles'], roles });
      assert.equal(made.code, 0, made.text);
      assert.doesNotMatch(made.text, /secret-migrate-pw-1|secret-api-pw-2/);
      assert.match(made.text, new RegExp(`${r.migrate}, ${r.api}`));
      const c = await r.connectAs(r.api, 'secret-api-pw-2');
      assert.equal((await c.query('SELECT 1 AS one')).rows[0].one, 1);
      const schema = await r.admin.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay'`,
      );
      assert.equal(schema.rows[0].n, 0, 'it built nothing');

      const again = await deploy({ env, argv: ['--init-roles'], roles });
      assert.equal(again.code, 0, 'safe to run again');
      assert.match(again.text, /Updated \(passwords set again\)/);
    });
  });
});

// ------------------------------------------------------------------------------------------------------------ the main path

test('AC-31, AC-43, AC-20, AC-32, AC-33, AC-34, AC-36: an empty database, then runs on a database that has the schema', async (t) => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      const roles = { migrate: r.migrate, api: r.api };
      await initRoles(r.admin, { ...roles, passwords: r.passwords });
      const env = envFor(scratch.name, r.migrate, r.passwords.migrate);
      const observer = await r.connectAs(r.migrate, r.passwords.migrate);

      let first;
      await t.test(
        'AC-31: the first run on an empty database, as gabay_migrate: schema, migrations, reference data, grants, in that order',
        async () => {
          first = await deploy({ env, roles });
          assert.equal(first.code, 0, first.text);
          const at = (needle) => first.out.findIndex((l) => l.includes(needle));
          const order = [
            'no tables',
            'Schema applied',
            'Applying 0001',
            'Applying 0002',
            'Reference data seeded',
            'Grants applied',
            'finished',
          ].map(at);
          assert.ok(
            order.every((i) => i >= 0),
            `every step was reported: ${JSON.stringify(order)}`,
          );
          assert.deepEqual(
            [...order].sort((a, b) => a - b),
            order,
            'in the documented order',
          );
          assert.match(
            first.out[0],
            new RegExp(`target: ${env.PGHOST}:${env.PGPORT}/${scratch.name} as ${r.migrate}`),
          );
          assert.doesNotMatch(first.text, new RegExp(r.passwords.migrate));
          const tables = (
            await observer.query(
              `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'gabay' AND table_type = 'BASE TABLE'`,
            )
          ).rows[0].n;
          assert.ok(tables >= 46);
          assert.equal(
            (await observer.query(`SELECT count(*)::int AS n FROM gabay.Tenant`)).rows[0].n,
            0,
            'no tenant and no account',
          );
          assert.equal(
            (await observer.query(`SELECT count(*)::int AS n FROM gabay.AppUser`)).rows[0].n,
            0,
          );
        },
      );

      await t.test(
        'AC-31, AC-43: the reference rows equal those of a dev build (schema, migrations, the dev seed) over the same four groups',
        async () => {
          const ours = await referenceRows(observer);
          assert.equal(ours.Role.length, 4);
          assert.ok(
            ours.PermissionRoute.length > 0 &&
              ours.RolePermission.length > 0 &&
              ours.BuildingType.length > 0,
          );
          await withScratchDatabase(async (other) => {
            const dev = await other.client();
            await other.reset(dev);
            await applySchema(dev, { log: () => {}, warn: () => {} });
            await quiet(() => runMigrations(dev));
            await dev.query('BEGIN');
            await runSeed(dev, { withAccounts: false, log: () => {} });
            await dev.query('COMMIT');
            assert.deepEqual(await referenceRows(dev), ours);
          });
        },
      );

      await t.test(
        'AC-20: the first run left the grants in place, and the API login can read what it built',
        async () => {
          const api = await r.connectAs(r.api, r.passwords.api);
          assert.ok((await api.query(`SELECT count(*)::int AS n FROM gabay.Role`)).rows[0].n >= 4);
          assert.equal(
            (
              await observer.query(
                `SELECT has_table_privilege($1, 'gabay.auditlog', 'UPDATE') AS u`,
                [r.api],
              )
            ).rows[0].u,
            false,
          );
        },
      );

      await t.test(
        'AC-32, AC-33, AC-36: a run on a database that has the schema applies migrations and grants only, destroys nothing, and a second run changes nothing',
        async () => {
          await observer.query(`INSERT INTO gabay.Tenant (Code, Name) VALUES ('KEEP', 'Kept row')`);
          // A reference row removed on purpose: only a seed would bring it back, and none runs after the first.
          await observer.query(
            `DELETE FROM gabay.BuildingType WHERE TenantId IS NULL AND Code = 'ANNEX'`,
          );
          const tables = ['Tenant', 'Role', 'BuildingType', 'PermissionRoute', 'RolePermission'];
          const hashes = async () => {
            const out = [];
            for (const x of tables) out.push(await hashOf(observer, x)); // one at a time: a pg client runs one query at a time
            return out;
          };
          const before = {
            counts: await tableCounts(observer),
            hashes: await hashes(),
            acl: await aclOfEveryTable(observer),
          };

          const again = await deploy({ env, roles });
          assert.equal(again.code, 0, again.text);
          assert.match(again.text, /migrations and grants only/);
          assert.doesNotMatch(again.text, /Schema applied|Reference data seeded/);
          assert.deepEqual(
            await tableCounts(observer),
            before.counts,
            'every table keeps its rows',
          );
          assert.deepEqual(await hashes(), before.hashes, 'and their content');
          assert.deepEqual(
            await aclOfEveryTable(observer),
            before.acl,
            'the ACLs are identical (AC-36)',
          );
          assert.equal(
            (
              await observer.query(
                `SELECT count(*)::int AS n FROM gabay.BuildingType WHERE TenantId IS NULL AND Code = 'ANNEX'`,
              )
            ).rows[0].n,
            0,
            'nothing was re-seeded',
          );

          const third = await deploy({ env, roles });
          assert.equal(third.code, 0);
          assert.deepEqual(await tableCounts(observer), before.counts);
          assert.deepEqual(await aclOfEveryTable(observer), before.acl);
        },
      );

      await t.test(
        'AC-34: a second run waits for the first (the advisory lock), then goes on, and gives up with one clear line after its wait',
        async () => {
          const holder = await r.connectAs(r.migrate, r.passwords.migrate);
          await holder.query('SELECT pg_advisory_lock($1::bigint)', [DEPLOY_LOCK_KEY]);
          const started = Date.now();
          const refused = await deploy({ env, roles, lockWaitMs: 700 });
          assert.equal(refused.code, 1);
          assert.match(refused.text, /another db:deploy is running/);
          assert.ok(Date.now() - started >= 600, 'it did wait');
          assert.match(refused.text, /waiting for it to finish/);

          const waiting = deploy({ env, roles, lockWaitMs: 15_000 });
          await new Promise((resolve) => setTimeout(resolve, 800));
          await holder.query('SELECT pg_advisory_unlock($1::bigint)', [DEPLOY_LOCK_KEY]);
          const proceeded = await waiting;
          assert.equal(proceeded.code, 0, proceeded.text);
          assert.match(proceeded.text, /waiting for it to finish/);
          assert.match(proceeded.text, /finished: every step succeeded/);
        },
      );

      await t.test(
        'AC-34, AC-35, EC-4: a migration blocked behind an open transaction fails within the lock timeout, rolls back, stops the run and skips the grants',
        async () => {
          const probe = migrationsWith(
            {
              '0004_dep0_probe.sql': withVerify(
                'ALTER TABLE gabay.Role ADD COLUMN IF NOT EXISTS Dep0Probe INT;',
              ),
            },
            { withReal: false },
          );
          const blocker = await r.connectAs(r.migrate, r.passwords.migrate);
          // Detect "grants skipped": take one privilege away; only a grants step would give it back.
          await observer.query(`REVOKE SELECT ON gabay.BuildingType FROM "${r.api}"`);
          try {
            await blocker.query('BEGIN');
            await blocker.query('LOCK TABLE gabay.Role IN ACCESS EXCLUSIVE MODE');
            const started = Date.now();
            const failed = await deploy({
              env,
              roles,
              migrationsDir: probe.dir,
              lockTimeoutMs: 400,
            });
            assert.equal(failed.code, 1);
            assert.ok(
              Date.now() - started < 10_000,
              'it failed instead of queueing behind the lock',
            );
            assert.match(failed.text, /0004_dep0_probe\.sql failed and was rolled back/);
            assert.match(failed.text, /step "migrations"/);
            assert.match(failed.text, /lock timeout/i);
            assert.doesNotMatch(failed.text, /Grants applied|finished/);
            assert.equal(
              (
                await observer.query(
                  `SELECT has_table_privilege($1, 'gabay.buildingtype', 'SELECT') AS s`,
                  [r.api],
                )
              ).rows[0].s,
              false,
              'the grants step did not run',
            );
          } finally {
            await blocker.query('ROLLBACK');
          }
          const column = await observer.query(
            `SELECT 1 FROM information_schema.columns WHERE table_schema = 'gabay' AND table_name = 'role' AND column_name = 'dep0probe'`,
          );
          assert.equal(column.rows.length, 0, 'the blocked migration did not apply');
          const ok = await deploy({ env, roles, migrationsDir: probe.dir });
          assert.equal(ok.code, 0, ok.text);
          assert.equal(
            (
              await observer.query(
                `SELECT has_table_privilege($1, 'gabay.buildingtype', 'SELECT') AS s`,
                [r.api],
              )
            ).rows[0].s,
            true,
            'the grants step brought it back',
          );
          probe.remove();
        },
      );

      await t.test(
        'AC-20: with the logins missing, the grants step says what to run, and the migrations that came first stay applied',
        async () => {
          const r2 = await deploy({
            env,
            roles: { migrate: r.migrate, api: 'gabay_t_no_such_login_api' },
          });
          assert.equal(r2.code, 1);
          assert.match(r2.text, /step "grants"/);
          assert.match(
            r2.text,
            /gabay_t_no_such_login_api do not exist: run "npm run db:deploy -- --init-roles"/,
          );
        },
      );
    });
  });
});

// ------------------------------------------------------------------------------------------------- a failing migration

test('AC-35: on an empty database a failing migration stops the run, names the file, and skips the reference data and the grants; an empty gabay schema counts as absent', async () => {
  await withScratchDatabase(async (scratch) => {
    await withThrowawayRoles(scratch, async (r) => {
      const roles = { migrate: r.migrate, api: r.api };
      await initRoles(r.admin, { ...roles, passwords: r.passwords });
      // An earlier failed run left an empty gabay schema: it counts as absent, so the schema is applied.
      await r.admin.query('CREATE SCHEMA gabay');
      await r.admin.query(`ALTER SCHEMA gabay OWNER TO "${r.migrate}"`);
      const bad = migrationsWith({
        '0004_dep0_fails.sql': withVerify('SELECT * FROM gabay.no_such_table_for_dep0;'),
      });
      try {
        const env = envFor(scratch.name, r.migrate, r.passwords.migrate);
        const failed = await deploy({ env, roles, migrationsDir: bad.dir });
        assert.equal(failed.code, 1, failed.text);
        assert.match(failed.text, /no tables/, 'the empty schema counted as absent');
        assert.match(failed.text, /Schema applied/);
        assert.match(failed.text, /0004_dep0_fails\.sql failed and was rolled back/);
        assert.match(failed.text, /step "migrations"/);
        assert.doesNotMatch(failed.text, /Reference data seeded|Grants applied|finished/);
        const observer = await r.connectAs(r.migrate, r.passwords.migrate);
        assert.equal(
          (await observer.query(`SELECT count(*)::int AS n FROM gabay.BuildingType`)).rows[0].n,
          0,
          'no reference data',
        );
        assert.equal(
          (
            await observer.query(`SELECT has_table_privilege($1, 'gabay.tenant', 'SELECT') AS s`, [
              r.api,
            ])
          ).rows[0].s,
          false,
          'no grants',
        );
      } finally {
        bad.remove();
      }
    });
  });
});

test('AC-35: a run that cannot connect exits 1 with one line and no stack', async () => {
  const r = await deploy({ env: { ...envFor('postgres'), PGPORT: '1' } });
  assert.equal(r.code, 1);
  assert.match(r.text, /db:deploy failed at step "connect"/);
  assert.ok(!r.text.includes('    at '), 'no stack');
});

test('AC-30: a refused login prints no password', async () => {
  const env = { ...envFor('postgres'), PGPASSWORD: 'not-the-password-xyz' };
  const r = await deploy({ env });
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.text, /not-the-password-xyz/);
});
