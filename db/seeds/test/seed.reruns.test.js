'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2): the accounts, and what a second run, a failed run, a
// run after a publish and every printed line do. A fake Auth emulator (D4) stands in for the real one, which verify's `seed`
// check and a smoke row still cover. Each case runs in a transaction of its own that is always rolled back (helpers.js:
// inTransaction), starting from the good run it needs. Covers AC-10, AC-11, AC-17, AC-18, AC-19, AC-20, AC-23 (four cases)
// and the edge cases "the emulator account exists with another password" and "a SEED_PW_* under 6 characters".

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { inTransaction, makeSources, runMain, startFakeEmulator, useEmulator, snapshot, tenantId, exportWith } = require('./helpers');

const ADMINS = ['superadmin@gabay.test', 'malladmin@gabay.test', 'editor@gabay.test', 'viewer@gabay.test', 'malladmin.demo@gabay.test'];
const SIX = [...ADMINS, 'shopper@gabay.test'];
// L119's role rows: [email, role, tenant code | null]
const L119_ROLES = [
  ['editor@gabay.test', 'VENUE_EDITOR', 'DEMO_MALLS'],
  ['editor@gabay.test', 'VENUE_EDITOR', 'SPIKE_VENUES'],
  ['malladmin.demo@gabay.test', 'MALL_ADMIN', 'DEMO_MALLS'],
  ['malladmin@gabay.test', 'MALL_ADMIN', 'DEMO_MALLS'],
  ['malladmin@gabay.test', 'MALL_ADMIN', 'SPIKE_VENUES'],
  ['superadmin@gabay.test', 'SUPERADMIN', null],
  ['viewer@gabay.test', 'VIEWER', 'DEMO_MALLS'],
  ['viewer@gabay.test', 'VIEWER', 'SPIKE_VENUES'],
];
const KEY_SHORT = 'is empty or under 6 characters in .env';
const ZERO_POLYGON = JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]] });

let sources;
let fake;
let restoreEmulator;

before(async () => {
  sources = makeSources();
  sources.reset();
  fake = await startFakeEmulator();
  restoreEmulator = useEmulator(fake);
});

after(async () => {
  restoreEmulator?.();
  await fake?.close();
  sources?.remove();
});

/** Sets env keys for the duration of fn, restoring each afterwards (a value of undefined removes the key). */
async function withEnv(changes, fn) {
  const saved = Object.fromEntries(Object.keys(changes).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * One case: a transaction of its own, the good run (with accounts), then fn({ client, rows, run, first }). `run(opts)` runs the
 * seed command again on the same client.
 */
function seededCase(title, fn, { baseline = true } = {}) {
  test(title, () =>
    inTransaction(async (client) => {
      const rows = async (text, params = []) => (await client.query(text, params)).rows;
      const run = (opts = {}) => runMain(client, { sourcesDir: sources.dir, accounts: true, ...opts });
      const first = baseline ? await run() : null;
      if (baseline) {
        assert.equal(first.code, 0, first.err.join('\n'));
        assert.deepEqual(first.events, ['BEGIN', 'COMMIT']);
      }
      await fn({ client, rows, run, first });
    }),
  );
}

/** A version (FAILED, BUILDING, or PUBLISHED with its file) of a venue of a tenant: test setup only, every value bound. */
async function addVersionTo(rows, tenant, venueCode, status) {
  const [venue] = await rows('SELECT VenueId AS id FROM gabay.Venue WHERE TenantId = $1 AND Code = $2', [tenant, venueCode]);
  if (status !== 'PUBLISHED') {
    await rows('INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion) VALUES ($1, $2, 1, $3, 1)', [tenant, venue.id, status]);
    return;
  }
  const sha = 'a'.repeat(64);
  const [file] = await rows(
    `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
     VALUES ($1, 'PACKAGE', 'application/zip', 1, $2, 'test/ff2/package.zip') RETURNING FileId AS id`,
    [tenant, sha],
  );
  await rows(
    `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256, PackageFormatVersion, PublishedAt)
     VALUES ($1, $2, 1, 'PUBLISHED', $3, $4, 1, now())`,
    [tenant, venue.id, file.id, sha],
  );
}

seededCase('AC-10: six accounts, five AppUser, eight UserRole, one ShopperAccount, each UID the emulator returned', async ({ rows }) => {
  const users = await rows('SELECT Email AS email, FirebaseUid AS uid FROM gabay.AppUser WHERE Email = ANY($1) ORDER BY Email', [SIX]);
  assert.deepEqual(users.map((u) => u.email), [...ADMINS].sort(), 'five AppUser rows, no shopper among them');
  for (const u of users) assert.equal(u.uid, fake.uidOf(u.email), `${u.email}: FirebaseUid is the UID the emulator returned`);
  const roles = await rows(
    `SELECT u.Email AS email, r.Code AS role, t.Code AS tenant
       FROM gabay.UserRole ur JOIN gabay.AppUser u ON u.UserId = ur.UserId JOIN gabay.Role r ON r.RoleId = ur.RoleId
       LEFT JOIN gabay.Tenant t ON t.TenantId = ur.TenantId
      WHERE u.Email = ANY($1)`,
    [SIX],
  );
  const byText = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
  assert.deepEqual(roles.map((r) => [r.email, r.role, r.tenant]).sort(byText), [...L119_ROLES].sort(byText), "exactly L119's eight role rows: superadmin has no tenant; malladmin.demo is in Demo Malls only");
  const shoppers = await rows('SELECT Email AS email, FirebaseUid AS uid FROM gabay.ShopperAccount WHERE Email = ANY($1)', [SIX]);
  assert.deepEqual(shoppers.map((s) => s.email), ['shopper@gabay.test']);
  assert.equal(shoppers[0].uid, fake.uidOf('shopper@gabay.test'));
});

seededCase('AC-11: every tenant-scoped account has a grant for every venue of each of its tenants; superadmin has none', async ({ rows }) => {
  const held = await rows(
    `SELECT u.Email AS email, t.Code AS tenant FROM gabay.UserRole ur JOIN gabay.AppUser u ON u.UserId = ur.UserId
       JOIN gabay.Tenant t ON t.TenantId = ur.TenantId WHERE u.Email = ANY($1)`,
    [SIX],
  );
  const venues = await rows('SELECT v.VenueId AS id, t.Code AS tenant FROM gabay.Venue v JOIN gabay.Tenant t ON t.TenantId = v.TenantId WHERE t.Code = ANY($1)', [['DEMO_MALLS', 'SPIKE_VENUES']]);
  const expected = held.flatMap((h) => venues.filter((v) => v.tenant === h.tenant).map((v) => `${h.email}#${v.id}`)).sort();
  const grants = await rows('SELECT u.Email AS email, g.VenueId AS id FROM gabay.UserVenueGrant g JOIN gabay.AppUser u ON u.UserId = g.UserId WHERE u.Email = ANY($1)', [SIX]);
  assert.deepEqual(grants.map((g) => `${g.email}#${g.id}`).sort(), expected);
  assert.ok(expected.length > 0);
  assert.equal(grants.filter((g) => g.email === 'superadmin@gabay.test').length, 0);
});

seededCase('AC-17: two runs back to back both commit and leave equal counts and codes', async ({ client, run }) => {
  const afterFirst = await snapshot(client);
  const second = await run();
  assert.equal(second.code, 0, second.err.join('\n'));
  assert.deepEqual(second.events, ['BEGIN', 'COMMIT']);
  assert.deepEqual(await snapshot(client), afterFirst);
});

seededCase('AC-18: hand-made rows in the test tenants go; another tenant and the platform lookups stay', async ({ client, rows, run }) => {
  const tag = randomUUID().replaceAll('-', '').slice(0, 8);
  const handMade = async (tenant) => {
    const [venue] = await rows('INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, $2, $3, $4::jsonb) RETURNING VenueId AS id', [tenant, `HAND_${tag}`, 'Hand made', ZERO_POLYGON]);
    const [type] = await rows('INSERT INTO gabay.BuildingType (TenantId, Code, Label, SortOrder) VALUES ($1, $2, $3, 0) RETURNING BuildingTypeId AS id', [tenant, `HAND_${tag}`, 'Hand made type']);
    const [building] = await rows('INSERT INTO gabay.Building (TenantId, VenueId, BuildingTypeId, Name) VALUES ($1, $2, $3, $4) RETURNING BuildingId AS id', [tenant, venue.id, type.id, 'Hand made building']);
    await rows('INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, Ordinal, Name, ShortName, WidthM, DepthM) VALUES ($1, $2, $3, 0, $4, $5, 10, 10)', [tenant, venue.id, building.id, 'Hand made level', 'HM']);
    return venue.id;
  };
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) await handMade(await tenantId(client, code));
  const [other] = await rows('INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $2) RETURNING TenantId AS id', [`OTHER_${tag}`.toUpperCase(), 'Another tenant']);
  const otherVenue = await handMade(other.id);
  const lookups = () => rows('SELECT BuildingTypeId AS id, Code AS code FROM gabay.BuildingType WHERE TenantId IS NULL ORDER BY Code');
  const countsOf = (id) =>
    rows(
      `SELECT (SELECT count(*) FROM gabay.Venue WHERE TenantId = $1)::int AS venues, (SELECT count(*) FROM gabay.Building WHERE TenantId = $1)::int AS buildings,
              (SELECT count(*) FROM gabay.Level WHERE TenantId = $1)::int AS levels, (SELECT count(*) FROM gabay.BuildingType WHERE TenantId = $1)::int AS types`,
      [id],
    );
  const platformBefore = await lookups();
  const otherBefore = await countsOf(other.id);

  const second = await run();
  assert.equal(second.code, 0, second.err.join('\n'));
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) {
    const t = await tenantId(client, code);
    const gone = await rows(
      `SELECT (SELECT count(*) FROM gabay.Venue WHERE TenantId = $1 AND Code = $2)::int AS venues, (SELECT count(*) FROM gabay.BuildingType WHERE TenantId = $1 AND Code = $2)::int AS types,
              (SELECT count(*) FROM gabay.Level WHERE TenantId = $1 AND Name = 'Hand made level')::int AS levels`,
      [t, `HAND_${tag}`],
    );
    assert.deepEqual(gone[0], { venues: 0, types: 0, levels: 0 }, `${code}: the hand-made rows are removed`);
  }
  assert.deepEqual(await countsOf(other.id), otherBefore, "another tenant's rows are untouched");
  assert.equal((await rows('SELECT VenueId FROM gabay.Venue WHERE TenantId = $1 AND VenueId = $2', [other.id, otherVenue])).length, 1);
  assert.deepEqual(await lookups(), platformBefore, 'the platform lookups are reused, not recreated');
});

seededCase('AC-19: a run that fails part-way (SEED_PW_SHOPPER removed) leaves the last good run, names the key, exits 1', async ({ client, run, first }) => {
  const afterFirst = await snapshot(client);
  assert.ok(first);
  await withEnv({ SEED_PW_SHOPPER: undefined }, async () => {
    const failed = await run();
    assert.equal(failed.code, 1);
    assert.deepEqual(failed.events, ['BEGIN', 'ROLLBACK']);
    assert.equal(failed.err.length, 1);
    assert.match(failed.err[0], /^Seed rolled back: SEED_PW_SHOPPER is empty or under 6 characters in \.env$/);
  });
  assert.deepEqual(await snapshot(client), afterFirst);
});

seededCase(
  'a SEED_PW_* of 5 characters fails the same way: the key is named, the run rolls back, nothing is left',
  async ({ client, run }) => {
    const before = await snapshot(client);
    await withEnv({ SEED_PW_VIEWER: '12345' }, async () => {
      const failed = await run();
      assert.equal(failed.code, 1);
      assert.match(failed.err.join('\n'), new RegExp(`SEED_PW_VIEWER ${KEY_SHORT}`));
      assert.doesNotMatch(failed.err.join('\n'), /12345/);
    });
    assert.deepEqual(await snapshot(client), before);
  },
  { baseline: false },
);

seededCase(
  'an emulator account that exists with another password: the message names both fixes, the run rolls back, exit 1',
  async ({ client, run }) => {
    const before = await snapshot(client);
    const other = await startFakeEmulator({ users: { 'superadmin@gabay.test': 'a-different-password' } });
    const restore = useEmulator(other);
    try {
      const failed = await run();
      assert.equal(failed.code, 1);
      assert.deepEqual(failed.events, ['BEGIN', 'ROLLBACK']);
      assert.match(failed.err[0], /superadmin@gabay\.test exists with another password; clear db\/seeds\/\.emulator-data or fix \.env/);
      assert.deepEqual(await snapshot(client), before);
    } finally {
      restore();
      await other.close();
      useEmulator(fake);
    }
  },
  { baseline: false },
);

test('AC-20: no secret .env value appears in any output (the good run, a failed run, a wrong password, an AC-23 stop, an AC-25 skip)', async () => {
  const keys = Object.keys(process.env).filter((k) => k.startsWith('SEED_PW_') || k === 'PGPASSWORD' || /_(PASSWORD|SECRET|KEY|TOKEN)$/.test(k));
  assert.ok(keys.includes('PGPASSWORD') && keys.filter((k) => k.startsWith('SEED_PW_')).length === 6, 'the six SEED_PW_* keys and PGPASSWORD are in the environment');
  const markers = Object.fromEntries(keys.map((k) => [k, `marker-${randomUUID()}-${k.toLowerCase()}`]));
  const clean = await startFakeEmulator();
  const dirty = await startFakeEmulator({ users: Object.fromEntries(ADMINS.map((e) => [e, 'preloaded-other-password'])) });
  const restore = useEmulator(clean);
  const outputs = [];
  // The markers are set only while the seed command runs, after the case's client has connected with the real PGPASSWORD.
  const seedWith = (accounts, { before, env = {} } = {}) =>
    inTransaction(async (client) => {
      await before?.(client);
      const r = await withEnv({ ...markers, ...env }, () => runMain(client, { sourcesDir: sources.dir, accounts }));
      outputs.push([...r.out, ...r.err]);
    });
  try {
    await seedWith(true); // 1. the good run
    await seedWith(true, { env: { SEED_PW_SHOPPER: undefined } }); // 2. a failed run
    useEmulator(dirty);
    await seedWith(true); // 3. a wrong password
    useEmulator(clean);
    await seedWith(true, {
      // 4. an AC-23 stop
      before: async (client) => {
        const rows = async (text, params = []) => (await client.query(text, params)).rows;
        await runMain(client, { sourcesDir: sources.dir, accounts: false });
        await addVersionTo(rows, await tenantId(client, 'DEMO_MALLS'), 'AURORA', 'FAILED');
      },
    });
    sources.reset({ exports: { 'bad.json': exportWith({ spikeUuid: '11111111-2222-4333-8444-555555555555' }) } });
    await seedWith(true); // 5. an AC-25 skip
    sources.reset();
  } finally {
    restore();
    await clean.close();
    await dirty.close();
    useEmulator(fake);
  }
  assert.equal(outputs.length, 5);
  assert.ok(outputs.every((o) => o.length > 0));
  assert.ok(outputs[3].some((l) => l.startsWith('Seed stopped:')), 'the fourth output is the AC-23 stop');
  assert.ok(outputs[4].some((l) => l.includes('skipped spike-exports/bad.json')), 'the fifth output is the AC-25 skip');
  const everything = outputs.flat().join('\n');
  for (const key of keys) assert.ok(!everything.includes(markers[key]), `the value of ${key} appears in the seed's output`);
});

// ---- AC-23: a re-seed after a publish --------------------------------------------------------------------------------

seededCase('AC-23: a version in a test tenant stops the seed before any write, with one line naming the tenant and the way out', async ({ client, rows, run }) => {
  await addVersionTo(rows, await tenantId(client, 'DEMO_MALLS'), 'AURORA', 'FAILED');
  const snapBefore = await snapshot(client);
  const requestsBefore = fake.requests.length;
  const stopped = await run();
  assert.equal(stopped.code, 1);
  assert.deepEqual(stopped.events, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(stopped.out, []);
  assert.equal(stopped.err.length, 1, 'exactly one line');
  const line = stopped.err[0];
  assert.match(line, /^Seed stopped: /);
  assert.doesNotMatch(line, /rolled back/i);
  assert.match(line, /DEMO_MALLS/);
  assert.match(line, /npm run setup-db/);
  assert.match(line, /npm run publish:dev -- DEMO_MALLS --all/);
  assert.doesNotMatch(line, /SPIKE_VENUES/, 'only the tenants that hold versions are named');
  assert.deepEqual(await snapshot(client), snapBefore, 'nothing was deleted or written');
  assert.equal(fake.requests.length, requestsBefore, 'the check ran before any Auth emulator call');
});

seededCase('AC-23: a published version stops it too, naming both tenants in code order', async ({ client, rows, run }) => {
  await addVersionTo(rows, await tenantId(client, 'SPIKE_VENUES'), 'MEZZ_OFFICE', 'PUBLISHED');
  await addVersionTo(rows, await tenantId(client, 'DEMO_MALLS'), 'AURORA', 'FAILED');
  const stopped = await run();
  assert.equal(stopped.code, 1);
  assert.equal(stopped.err.length, 1);
  assert.match(stopped.err[0], /DEMO_MALLS, SPIKE_VENUES/);
  assert.match(stopped.err[0], /npm run publish:dev -- DEMO_MALLS --all/);
  assert.match(stopped.err[0], /npm run publish:dev -- SPIKE_VENUES --all/);
});

seededCase('AC-23: the same stop with --no-accounts (seed:db-only)', async ({ client, rows, run }) => {
  await addVersionTo(rows, await tenantId(client, 'DEMO_MALLS'), 'BAYVIEW', 'FAILED');
  const stopped = await run({ accounts: false });
  assert.equal(stopped.code, 1);
  assert.match(stopped.err.join('\n'), /^Seed stopped: DEMO_MALLS /);
});

seededCase('AC-23: a version in another tenant does not stop the seed, and is not touched', async ({ rows, run }) => {
  const tag = randomUUID().replaceAll('-', '').slice(0, 8);
  const [other] = await rows('INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $2) RETURNING TenantId AS id', [`OTHER_${tag}`.toUpperCase(), 'Another tenant']);
  await rows('INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, $2, $3, $4::jsonb)', [other.id, `OV_${tag}`, 'Other venue', ZERO_POLYGON]);
  await addVersionTo(rows, other.id, `OV_${tag}`, 'PUBLISHED');
  const readOther = () =>
    rows(
      `SELECT v.VenueId AS venue, ver.VenueVersionId AS version, ver.Status AS status FROM gabay.Venue v
         JOIN gabay.VenueVersion ver ON ver.VenueId = v.VenueId AND ver.TenantId = v.TenantId WHERE v.TenantId = $1`,
      [other.id],
    );
  const before = await readOther();
  assert.equal(before.length, 1);
  const second = await run();
  assert.equal(second.code, 0, second.err.join('\n'));
  assert.deepEqual(second.events, ['BEGIN', 'COMMIT']);
  assert.deepEqual(await readOther(), before);
});
