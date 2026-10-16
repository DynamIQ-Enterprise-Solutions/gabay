'use strict';

// P0-02 / FF-2 (plan/FF-2-test-seeds.md section 4; spec/P0-02.md r2): the accounts, and what a second run, a failed run, a
// run after a publish and every printed line do. A fake Auth emulator (D4) stands in for the real one, which verify's `seed`
// check and a smoke row still cover. Each case runs in a transaction of its own that is always rolled back (helpers.js:
// inTransaction), starting from the good run it needs. Covers AC-10, AC-11, AC-17, AC-18, AC-19, AC-20, AC-23 (four cases)
// and the edge cases "the emulator account exists with another password" and "a SEED_PW_* under 6 characters".
//
// CHANGED BY OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 4; spec/P0-02.md r3 withdraws AC-18's buildings and levels):
// schema 0.17 has no Building or Level table and no Venue.BoundaryGeoJson, so AC-18's hand-made rows are a venue, a tenant
// building type and a store (an Occupant on that venue), and every hand-made Venue row is inserted without a boundary.
// New: AC-7's five routing settings are written once after two runs.

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

/**
 * A version (FAILED, BUILDING, or PUBLISHED with its file) of a venue of a tenant: test setup only, every value bound.
 * C1 (OA-2, plan/OA-2-map-storage.md 1.0 section 6.2; the owner's ruling at the contract checkpoint, 2026-10-13 Q1 (a)): a
 * PUBLISHED row now needs a LayoutJson (schema 0.15's CK_VenueVersion_Published), so the insert gives it a minimal one. What
 * AC-23 checks (a seed stops on a published version) is unchanged.
 */
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
    `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256, PackageFormatVersion, PublishedAt, LayoutJson)
     VALUES ($1, $2, 1, 'PUBLISHED', $3, $4, 1, now(), '{"spec":1}'::jsonb)`,
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
    const [venue] = await rows('INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, $2, $3) RETURNING VenueId AS id', [tenant, `HAND_${tag}`, 'Hand made']);
    await rows('INSERT INTO gabay.BuildingType (TenantId, Code, Label, SortOrder) VALUES ($1, $2, $3, 0) RETURNING BuildingTypeId AS id', [tenant, `HAND_${tag}`, 'Hand made type']);
    await rows(
      `INSERT INTO gabay.Occupant (TenantId, VenueId, UnitKey, OccupantCategoryId, StoreStatusId, Name)
       SELECT $1, $2, 'HAND1', c.OccupantCategoryId, s.StoreStatusId, 'Hand made store' FROM gabay.OccupantCategory c, gabay.StoreStatus s
        WHERE c.Code = 'OTHER' AND c.TenantId IS NULL AND s.Code = 'OPEN' AND s.TenantId IS NULL`,
      [tenant, venue.id],
    );
    return venue.id;
  };
  for (const code of ['DEMO_MALLS', 'SPIKE_VENUES']) await handMade(await tenantId(client, code));
  const [other] = await rows('INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $2) RETURNING TenantId AS id', [`OTHER_${tag}`.toUpperCase(), 'Another tenant']);
  const otherVenue = await handMade(other.id);
  const lookups = () => rows('SELECT BuildingTypeId AS id, Code AS code FROM gabay.BuildingType WHERE TenantId IS NULL ORDER BY Code');
  const countsOf = (id) =>
    rows(
      `SELECT (SELECT count(*) FROM gabay.Venue WHERE TenantId = $1)::int AS venues, (SELECT count(*) FROM gabay.Occupant WHERE TenantId = $1)::int AS stores,
              (SELECT count(*) FROM gabay.BuildingType WHERE TenantId = $1)::int AS types`,
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
              (SELECT count(*) FROM gabay.Occupant WHERE TenantId = $1 AND Name = 'Hand made store')::int AS stores`,
      [t, `HAND_${tag}`],
    );
    assert.deepEqual(gone[0], { venues: 0, types: 0, stores: 0 }, `${code}: the hand-made rows are removed`);
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

// ---- OA-2 (spec/OA-2.md r1 AC-6; the owner's ruling at the contract checkpoint, 2026-10-13 Q2 (a)) ---------------------------
// Schema 0.15 adds VenueMap, VenueMapBackdrop and (for backdrops) StoredFile rows that belong to a tenant's venue. A draft is
// saved and a backdrop uploaded on a SEEDED venue by the editor, so the next `npm run seed` must delete them with the venue
// (the seed's clean-up list gains VenueMapBackdrop, VenueMap and StoredFile, children before parents) instead of stopping on a
// foreign key. A published version is another matter: it is frozen and still stops the seed (AC-23, above).
seededCase('OA-2 (Q2 (a)): after a draft save and a backdrop row on a seeded venue, the seed runs again and leaves no map rows', async ({ client, rows, run }) => {
  const oldTenant = await tenantId(client, 'DEMO_MALLS');
  const [venue] = await rows('SELECT VenueId AS id FROM gabay.Venue WHERE TenantId = $1 AND Code = $2', [oldTenant, 'AURORA']);
  await rows(
    `INSERT INTO gabay.VenueMap (TenantId, VenueId, DraftJson, DraftVersion, UpdatedAt)
     VALUES ($1, $2, '{"spec":1}'::jsonb, 1, now()) RETURNING VenueMapId`,
    [oldTenant, venue.id],
  );
  const [file] = await rows(
    `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
     VALUES ($1, 'UNDERLAY', 'image/png', 1, $2, 'backdrops/test/oa2/seed.png') RETURNING FileId AS id`,
    [oldTenant, 'b'.repeat(64)],
  );
  await rows(
    `INSERT INTO gabay.VenueMapBackdrop (BackdropKey, TenantId, VenueId, FileId, WidthPx, HeightPx)
     VALUES ('0123456789abcdef0123456789abcdef', $1, $2, $3, 100, 80) RETURNING BackdropKey`,
    [oldTenant, venue.id, file.id],
  );

  const again = await run();
  assert.equal(again.code, 0, again.err.join('\n'));
  assert.deepEqual(again.events, ['BEGIN', 'COMMIT']);

  const count = async (tenant) => {
    const [n] = await rows(
      `SELECT (SELECT count(*) FROM gabay.VenueMap WHERE TenantId = $1)::int AS maps,
              (SELECT count(*) FROM gabay.VenueMapBackdrop WHERE TenantId = $1)::int AS backdrops,
              (SELECT count(*) FROM gabay.StoredFile WHERE TenantId = $1)::int AS files`,
      [tenant],
    );
    return n;
  };
  assert.deepEqual(await count(oldTenant), { maps: 0, backdrops: 0, files: 0 }, 'the old tenant\'s map rows went with it');
  const newTenant = await tenantId(client, 'DEMO_MALLS');
  assert.notEqual(newTenant, oldTenant, 'the seed made the tenant again');
  assert.deepEqual(await count(newTenant), { maps: 0, backdrops: 0, files: 0 }, 'the seeded tenant has no map rows');
  assert.equal((await rows('SELECT count(*)::int AS n FROM gabay.Venue WHERE TenantId = $1', [newTenant]))[0].n, 4, 'the four demo venues are back');
});

seededCase('OA-2 (Q2 (a)): another tenant\'s map rows are not touched by the seed', async ({ client, rows, run }) => {
  const [other] = await rows(`INSERT INTO gabay.Tenant (Code, Name) VALUES ('OA2_OTHER', 'Another tenant') RETURNING TenantId AS id`);
  const [venue] = await rows(
    `INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, 'OA2V', 'Another venue') RETURNING VenueId AS id`,
    [other.id],
  );
  await rows(`INSERT INTO gabay.VenueMap (TenantId, VenueId, DraftJson, DraftVersion) VALUES ($1, $2, '{"spec":1}'::jsonb, 4) RETURNING 1`, [other.id, venue.id]);
  const again = await run();
  assert.equal(again.code, 0, again.err.join('\n'));
  const [kept] = await rows('SELECT DraftVersion AS v FROM gabay.VenueMap WHERE TenantId = $1', [other.id]);
  assert.equal(kept.v, 4, 'a tenant the seed does not own keeps its map');
});

seededCase('AC-23: a version in another tenant does not stop the seed, and is not touched', async ({ rows, run }) => {
  const tag = randomUUID().replaceAll('-', '').slice(0, 8);
  const [other] = await rows('INSERT INTO gabay.Tenant (Code, Name) VALUES ($1, $2) RETURNING TenantId AS id', [`OTHER_${tag}`.toUpperCase(), 'Another tenant']);
  await rows('INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, $2, $3)', [other.id, `OV_${tag}`, 'Other venue']);
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

// ---- OA-3a (spec/OA-3.md r2 AC-7; spec/P0-03.md r5 AC-120): the platform routing settings ----------------------------------

seededCase('AC-7: after two runs the five routing settings are there once each, and an operator\'s value is kept', async ({ rows, run }) => {
  const read = () =>
    rows("SELECT SettingKey AS key, count(*)::int AS n, max(SettingValue) AS value FROM gabay.GlobalSetting WHERE TenantId IS NULL AND SettingKey LIKE 'routing.%' GROUP BY SettingKey ORDER BY SettingKey");
  const first = await read();
  assert.equal(first.length, 5);
  await rows("UPDATE gabay.GlobalSetting SET SettingValue = '150' WHERE TenantId IS NULL AND SettingKey = 'routing.stairsSaveS'");
  const second = await run();
  assert.equal(second.code, 0, second.err.join('\n'));
  const after = await read();
  assert.ok(after.every((s) => s.n === 1), 'one row per key, never a second');
  assert.equal(after.find((s) => s.key === 'routing.stairsSaveS').value, '150', 'a re-run never overwrites a value');
});
