'use strict';

// DEP-0 AC-44, AC-45's data half, EC-12 (spec/DEP-0.md r2; plan/DEP-0.md 1.0 step 5): `npm run staging:seed`, on a THROWAWAY
// database (db/tools/test/scratchDb.js) built the way db:deploy builds one (schema, migrations, reference data). Every case runs
// inside a transaction that is rolled back, so the cases share one database and each starts empty.
//
//   a run makes exactly the tenant DEMO_MALLS and its four venues, and no account
//   a second run refuses with one line and changes nothing (create-only: the dev seed's delete-and-recreate would remove logins)
//   a sources folder holding a penthouse file and spike exports is never read, and SPIKE_VENUES is never made
//   the command: the environment only, a local database refused, one line for a refusal

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stagingSeed, StagingSeedRefusal, TENANT_CODE } = require('../lib/stagingSeed');
const { main } = require('../staging-seed');
const { nest } = require('./helpers');
const { withScratchDatabase } = require('../../tools/test/scratchDb');
const { applySchema } = require('../../tools/lib/schema');
const { runMigrations } = require('../../tools/lib/migrations');
const { seedReference } = require('../../tools/lib/reference');
const { quiet } = require('../../tools/test/schemaFingerprint');

const DEMO = path.join(__dirname, '..', 'sources', 'demo');
const DEPLOYED_ENV = {
  PGHOST: 'localhost',
  PGPORT: '5432',
  PGDATABASE: 'gabay_staging',
  PGUSER: 'u',
  PGPASSWORD: 'pw-secret-2',
};

async function counts(client) {
  const one = async (sql) => (await client.query(sql, [])).rows[0].n;
  return {
    tenants: await one('SELECT count(*)::int AS n FROM gabay.Tenant'),
    demo: await one(`SELECT count(*)::int AS n FROM gabay.Tenant WHERE Code = 'DEMO_MALLS'`),
    spike: await one(`SELECT count(*)::int AS n FROM gabay.Tenant WHERE Code = 'SPIKE_VENUES'`),
    venues: await one('SELECT count(*)::int AS n FROM gabay.Venue'),
    occupants: await one('SELECT count(*)::int AS n FROM gabay.Occupant'),
    users: await one('SELECT count(*)::int AS n FROM gabay.AppUser'),
    roles: await one('SELECT count(*)::int AS n FROM gabay.UserRole'),
    grants: await one('SELECT count(*)::int AS n FROM gabay.UserVenueGrant'),
    shoppers: await one('SELECT count(*)::int AS n FROM gabay.ShopperAccount'),
  };
}

/** Each case in a transaction that is rolled back. */
async function rolledBack(client, fn) {
  await client.query('BEGIN');
  try {
    await fn();
  } finally {
    await client.query('ROLLBACK');
  }
}

test('DEP-0 staging seed: create-only, demo sources only, no account', async (t) => {
  await withScratchDatabase(async (scratch) => {
    const client = await scratch.client();
    await scratch.reset(client);
    await applySchema(client, { log: () => {}, warn: () => {} });
    await quiet(() => runMigrations(client));
    await seedReference(client, () => {});
    const empty = await counts(client);
    assert.equal(empty.tenants, 0);

    await t.test(
      'AC-44: a run makes exactly the tenant DEMO_MALLS and its four venues, and no account',
      async () => {
        await rolledBack(client, async () => {
          const lines = [];
          const seeded = await stagingSeed(client, {
            log: (l) => lines.push(l),
          });
          assert.deepEqual(seeded.venues.map((v) => v.code).sort(), [
            'AURORA',
            'BAYVIEW',
            'MERIDIAN',
            'SPIRE',
          ]);
          const after = await counts(client);
          assert.deepEqual(
            {
              tenants: after.tenants,
              demo: after.demo,
              spike: after.spike,
              venues: after.venues,
            },
            { tenants: 1, demo: 1, spike: 0, venues: 4 },
          );
          assert.ok(after.occupants > 0, 'the venues have their content');
          assert.deepEqual(
            {
              users: after.users,
              roles: after.roles,
              grants: after.grants,
              shoppers: after.shoppers,
            },
            { users: 0, roles: 0, grants: 0, shoppers: 0 },
            'no AppUser, UserRole, UserVenueGrant or ShopperAccount',
          );
          assert.equal(lines.length, 4);
        });
        assert.deepEqual(await counts(client), empty, 'the case left nothing');
      },
    );

    await t.test(
      'AC-44: a second run refuses with one line, deletes nothing and writes nothing',
      async () => {
        await rolledBack(client, async () => {
          await stagingSeed(client, { log: () => {} });
          // The owner's login, as staging:admin makes it, must survive.
          await client.query(
            `INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('owner-uid', 'owner@example.com', 'owner')`,
            [],
          );
          await client.query(
            `INSERT INTO gabay.UserRole (UserId, RoleId, TenantId)
           SELECT u.UserId, r.RoleId, t.TenantId FROM gabay.AppUser u, gabay.Role r, gabay.Tenant t
            WHERE u.Email = 'owner@example.com' AND r.Code = 'MALL_ADMIN' AND t.Code = 'DEMO_MALLS'`,
            [],
          );
          const before = await counts(client);
          await assert.rejects(
            () => stagingSeed(client, { log: () => {} }),
            (err) =>
              err instanceof StagingSeedRefusal &&
              !err.message.includes('\n') &&
              err.message.includes(TENANT_CODE),
          );
          assert.deepEqual(
            await counts(client),
            before,
            "nothing changed, and the owner's role is still there",
          );
          assert.equal(before.roles, 1);
        });
      },
    );

    await t.test(
      'AC-44: a penthouse file and spike exports in the sources folder are never read, and SPIKE_VENUES is never made',
      async () => {
        const sources = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-staging-sources-'));
        try {
          fs.cpSync(DEMO, path.join(sources, 'demo'), { recursive: true });
          for (const file of [
            'internal/penthouse.json',
            'spike/mezz.json',
            'spike-exports/owner-export.json',
          ]) {
            fs.mkdirSync(path.dirname(path.join(sources, file)), {
              recursive: true,
            });
            fs.writeFileSync(path.join(sources, file), 'NOT JSON: reading this file would throw');
          }
          const read = [];
          const realRead = fs.readFileSync;
          const listed = [];
          const realList = fs.readdirSync;
          fs.readFileSync = (file, ...rest) => {
            read.push(String(file));
            return realRead(file, ...rest);
          };
          fs.readdirSync = (dir, ...rest) => {
            listed.push(String(dir));
            return realList(dir, ...rest);
          };
          try {
            await rolledBack(client, async () => {
              await stagingSeed(client, { sourcesDir: sources, log: () => {} });
              const after = await counts(client);
              assert.equal(after.spike, 0, 'no SPIKE_VENUES tenant');
              assert.equal(after.venues, 4);
            });
          } finally {
            fs.readFileSync = realRead;
            fs.readdirSync = realList;
          }
          const ofSources = read.filter((p) => p.startsWith(sources));
          assert.equal(ofSources.length, 4, 'four files read');
          assert.ok(
            ofSources.every((p) => p.startsWith(path.join(sources, 'demo'))),
            'all of them under demo/',
          );
          assert.ok(!listed.some((d) => d.startsWith(sources)), 'the folder was never listed');
        } finally {
          fs.rmSync(sources, { recursive: true, force: true });
        }
      },
    );

    await t.test(
      'the command: it makes the tenant through its own transaction, prints its target first, and no password',
      async () => {
        await rolledBack(client, async () => {
          const nested = nest(client);
          const out = [];
          const err = [];
          const code = await main({
            env: DEPLOYED_ENV,
            argv: [],
            newClient: () => Object.assign(nested, { connect: async () => {} }),
            out: (l) => out.push(l),
            err: (l) => err.push(l),
          });
          assert.equal(code, 0, err.join('\n'));
          assert.deepEqual(nested.events, ['BEGIN', 'COMMIT']);
          assert.match(out[0], /^staging:seed target: localhost:5432\/gabay_staging as u$/);
          assert.match(
            out.at(-1),
            /^Seed committed: the tenant and 4 venues\. No account was written/,
          );
          assert.ok(![...out, ...err].join('\n').includes('pw-secret-2'));
          assert.equal((await counts(client)).demo, 1);

          // And again: one refusal line, a rollback, exit 1.
          const nested2 = nest(client);
          const err2 = [];
          const again = await main({
            env: DEPLOYED_ENV,
            argv: [],
            newClient: () => Object.assign(nested2, { connect: async () => {} }),
            out: () => {},
            err: (l) => err2.push(l),
          });
          assert.equal(again, 1);
          assert.deepEqual(nested2.events, ['BEGIN', 'ROLLBACK']);
          assert.equal(err2.length, 1);
          assert.match(err2[0], /DEMO_MALLS already exists, so nothing was written/);
        });
      },
    );
  });
});

test('the command refuses an argument, a missing key and a local database, before connecting', async () => {
  const never = () => assert.fail('no client is made for a refused run');
  for (const [env, argv, pattern] of [
    [DEPLOYED_ENV, ['--force'], /takes no arguments/],
    [{}, [], /Missing PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD/],
    [{ ...DEPLOYED_ENV, PGDATABASE: 'gabay_dev' }, [], /one of this machine's.*npm run seed/],
    [{ ...DEPLOYED_ENV, PGDATABASE: 'gabay_wt_api_coder' }, [], /one of this machine's/],
  ]) {
    const err = [];
    const code = await main({
      env,
      argv,
      newClient: never,
      out: () => {},
      err: (l) => err.push(l),
    });
    assert.equal(code, 1);
    assert.equal(err.length, 1, 'one line');
    assert.match(err[0], pattern);
  }
});

test('the command never reads the repository .env', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'staging-seed.js'), 'utf8');
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
  for (const word of ['loadEnv', 'loadEnvFile', 'dotenv', "'.env'", 'env-file'])
    assert.ok(!code.includes(word), word);
});
