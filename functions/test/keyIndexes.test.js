'use strict';

// OA-3a (spec/OA-3.md r2 AC-11, H-7; plan/OA-3a-migration-rekey.md 1.1 sections 3 and 6, DC-B): the key-status loader,
// loadKeyIndexes(q, tenantId, venueId, { draft, published }), over the real tables inside a transaction that is always rolled
// back (authHelpers.openRolledBackDb; L151), with OA-1's keyStatus. The five states of the spec (pending, live, removed,
// wrongKind, and a venue with no map row), the optional draft, `published: false`, and an unreadable published layout (OA-2
// AC-31's 409). Then the review half of AC-11 as a scan: under functions/src, only keyIndexes.js builds an element index
// outside OA-1's own module, so there is no second reader of the indexes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openRolledBackDb, createSeeder } = require('./authHelpers');
const { loadKeyIndexes } = require('../src/services/mapStorage/keyIndexes');
const { keyStatus } = require('../src/services/venueMap');

/** A small map: one level `levelId` holding the given units and walls (only ids matter to an element index). */
const mapOf = ({ levelId = 'L1', units = [], walls = [] } = {}) => ({
  spec: 1,
  levels: [{ id: levelId, units: units.map((id) => ({ id })), walls: walls.map((id) => ({ id })) }],
});

async function withVenue(fn) {
  const t = await openRolledBackDb();
  try {
    const seed = createSeeder(t.db);
    const tenant = await seed.tenant('K');
    const one = async (text, params) => (await t.db.query(text, params)).rows[0];
    const venue = await one(
      `INSERT INTO gabay.Venue (TenantId, Code, Name) VALUES ($1, $2, 'Venue') RETURNING VenueId AS id`,
      [tenant.tenantId, `KV${seed.tag}`],
    );
    const ids = { t: tenant.tenantId, v: venue.id };
    const helpers = {
      ...ids,
      db: t.db,
      draft: (map) =>
        one(
          `INSERT INTO gabay.VenueMap (TenantId, VenueId, DraftJson, DraftVersion) VALUES ($1, $2, $3::jsonb, 1) RETURNING 1`,
          [ids.t, ids.v, JSON.stringify(map)],
        ),
      publish: async (layout, versionNo = 1) => {
        const file = await one(
          `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
           VALUES ($1, 'PACKAGE', 'application/octet-stream', 1, repeat('a', 64), 'test/keys') RETURNING FileId AS id`,
          [ids.t],
        );
        await one(
          `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256,
                                          PackageFormatVersion, PublishedAt, LayoutJson)
           VALUES ($1, $2, $3, 'PUBLISHED', $4, repeat('a', 64), 1, now(), $5::jsonb) RETURNING 1`,
          [ids.t, ids.v, versionNo, file.id, JSON.stringify(layout)],
        );
        await one(
          `UPDATE gabay.VenueMap SET PublishedVersion = $3 WHERE TenantId = $1 AND VenueId = $2 RETURNING 1`,
          [ids.t, ids.v, versionNo],
        );
      },
    };
    await fn(helpers);
  } finally {
    await t.close();
  }
}

const status = (indexes, key, kind) =>
  keyStatus(key, kind, indexes.draftIndex, indexes.publishedIndex);

test('AC-11: no map row: no draft index and no published index, so every key reads removed', async () => {
  await withVenue(async ({ db, t, v }) => {
    const indexes = await loadKeyIndexes(db, t, v);
    assert.deepEqual(indexes, { draftIndex: null, publishedIndex: null });
    assert.equal(status(indexes, 'U1', 'unit'), 'removed');
  });
});

test('AC-11: the stored draft only: pending; in neither layout: removed; held as another kind: wrongKind', async () => {
  await withVenue(async ({ db, t, v, draft }) => {
    await draft(mapOf({ units: ['U1'], walls: ['W1'] }));
    const indexes = await loadKeyIndexes(db, t, v);
    assert.equal(indexes.publishedIndex, null, 'never published');
    assert.equal(status(indexes, 'U1', 'unit'), 'pending');
    assert.equal(status(indexes, 'L1', 'level'), 'pending');
    assert.equal(status(indexes, 'GONE', 'unit'), 'removed');
    assert.equal(status(indexes, 'W1', 'unit'), 'wrongKind');
  });
});

test('AC-11: in the published layout too: live; the published index comes from LayoutJson of PublishedVersion, never re-validated', async () => {
  await withVenue(async ({ db, t, v, draft, publish }) => {
    await draft(mapOf({ units: ['U1', 'U2'] }));
    // a layout today's validator would refuse (a level with no size, no buildings): read, not validated (OA-1 AC-36)
    await publish(mapOf({ units: ['U1'], walls: ['U3'] }));
    const indexes = await loadKeyIndexes(db, t, v);
    assert.equal(status(indexes, 'U1', 'unit'), 'live');
    assert.equal(status(indexes, 'U2', 'unit'), 'pending');
    assert.equal(
      status(indexes, 'U3', 'unit'),
      'wrongKind',
      'the published layout holds it as a wall',
    );
  });
});

test("AC-11: an optional draft (the save's incoming draft, the import's file map) is the draft index instead of the stored one; published: false reads no published layout", async () => {
  await withVenue(async ({ db, t, v, draft, publish }) => {
    await draft(mapOf({ units: ['STORED'] }));
    await publish(mapOf({ units: ['PUB'] }));
    const given = await loadKeyIndexes(db, t, v, { draft: mapOf({ units: ['INCOMING'] }) });
    assert.equal(status(given, 'INCOMING', 'unit'), 'pending');
    assert.equal(
      status(given, 'STORED', 'unit'),
      'removed',
      'the stored draft is not read when one is given',
    );
    assert.equal(status(given, 'PUB', 'unit'), 'live');
    const draftOnly = await loadKeyIndexes(db, t, v, {
      draft: mapOf({ units: ['INCOMING'] }),
      published: false,
    });
    assert.equal(draftOnly.publishedIndex, null);
    assert.equal(status(draftOnly, 'PUB', 'unit'), 'removed');
  });
});

test("AC-11: a published layout of an unknown spec refuses with OA-2 AC-31's 409; published: false (the save) is not refused by it", async () => {
  await withVenue(async ({ db, t, v, draft, publish }) => {
    await draft(mapOf({ units: ['U1'] }));
    await publish({ spec: 99, levels: [] }, 4);
    await assert.rejects(
      () => loadKeyIndexes(db, t, v),
      (err) =>
        err.httpStatus === 409 &&
        err.message === 'Version 4 was made by a newer or unknown version of Gabay',
    );
    const save = await loadKeyIndexes(db, t, v, {
      draft: mapOf({ units: ['U1'] }),
      published: false,
    });
    assert.equal(status(save, 'U1', 'unit'), 'pending');
  });
});

test("AC-11 (review): only keyIndexes.js builds an element index outside OA-1's venueMap module; there is no second reader of the indexes", () => {
  const src = path.join(__dirname, '..', 'src');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(src);
  const venueMapDir = path.join(src, 'services', 'venueMap') + path.sep;
  const callers = files
    .filter((f) => !f.startsWith(venueMapDir))
    .filter((f) => /\belementIndex\s*\(/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')))
    .map((f) => path.relative(src, f).split(path.sep).join('/'));
  assert.deepEqual(callers, ['services/mapStorage/keyIndexes.js']);
});
