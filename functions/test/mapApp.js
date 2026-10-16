// Test support for OA-2's API tests (spec/OA-2.md r1; plan/OA-2-map-storage.md 1.0 sections 4.4 to 4.6 and 8). Not a test
// file. INVENTED DATA ONLY (L48).
//
//   withMapApp(fn, options)    withVenueApp (venueApp.js: the real app over a rolled-back savepoint connection, L151) with
//                              the map dependencies wired: a fake builder (options.mapBuilder; pass null for "no publish
//                              engine yet", AC-30), an in-memory file store, and a clock the test can move. fn gets the
//                              venue app's ctx plus the helpers below.
//   fakeBuilder(over)          the builder port (mapBuilderPort.js) as a double: records every call, returns stand-in
//                              package bytes, and can refuse, throw, or run `onBuild` first (the staged "pause" of AC-28:
//                              the test's hook sends a save or a clear while the publish is between its two transactions)
//   makeClock()                { now, advanceS, advanceH }: createApp's `now`, for the prune cutoff and the stale check
//   mapRoutes(venueId)         the eight OA-2 routes as { name, method, path, body | upload }, and sendRoute(ctx, route)
//   docs                       fixture documents (fixtures/mapBuilder.js) and padTo(doc, bytes)
//   MAP_KEY                    a well-formed backdrop key (32 lowercase hex characters)
//
// ctx additions (all over the same rolled-back transaction; nothing is kept):
//   ctx.clock, ctx.builder
//   ctx.seedLookups(tenantId)      the lookup rows fixtures/mapBuilder.js's documents use (MAIN, CR, DESK, ...), as the
//                                  tenant's OWN rows, so a test never depends on the seed; returns the tenant's CatalogVersion
//   ctx.mapVenue(tenant?, opts)    a venue of the tenant (default A), with its lookups seeded once; returns the venue id
//   ctx.mapUrl(venueId, tail)      /api/venues/:id/map<tail>
//   ctx.save(venueId, layout, baseVersion, headers)       PUT .../map/draft
//   ctx.saveOk(venueId, layout, baseVersion, headers)     the same, expecting 200; returns the body
//   ctx.loadMap(venueId, headers)  GET .../map
//   ctx.mapRow(venueId)            the VenueMap row (lower-case column names) or null
//   ctx.versions(venueId)          the VenueVersion rows by VersionNo
//   ctx.counts(venueId, tenantId)  { maps, versions, backdrops, files, audits } for "nothing was written" assertions
//   ctx.upload(venueId, bytes, { name, type, field, headers })   POST .../map/backdrops as multipart form data
//   ctx.sql.backdrop / .published / .building / .failedVersion   rows written by SQL (with the file in the store)
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const b = require('./fixtures/mapBuilder');
const { withVenueApp } = require('./venueApp');
const { pngBytes } = require('./imageFixtures');

const MAP_KEY = '0123456789abcdef0123456789abcdef';
const OTHER_KEY = 'fedcba9876543210fedcba9876543210';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

// --------------------------------------------------------------------------------------------------------- the clock

function makeClock() {
  let offsetMs = 0;
  return {
    now: () => Date.now() + offsetMs,
    advanceS: (s) => {
      offsetMs += s * 1000;
    },
    advanceH: (h) => {
      offsetMs += h * 3600 * 1000;
    },
  };
}

// ------------------------------------------------------------------------------------------------------ the builder

/**
 * The builder port as a double (plan section 4.4). Fields a test may set at any time:
 *   mode      'ok' (default), 'refuse' (returns { ok: false, problems }) or 'throw'
 *   problems  what a refusal carries
 *   warnings  what a success carries
 *   onBuild   async (args) => void, run first inside build() (stage a save, a clear, a second publish, ...)
 *   bytes     the stand-in package bytes (default: derived from the call)
 */
function fakeBuilder(over = {}) {
  const builder = {
    formatVersion: 1,
    mode: 'ok',
    problems: ['site: nothing walkable'],
    warnings: [],
    onBuild: null,
    bytes: null,
    calls: [],
    async build(args) {
      builder.calls.push(structuredClone(args));
      if (builder.onBuild) await builder.onBuild(args);
      if (builder.mode === 'throw') throw new Error('builder exploded: SECRET_BUILDER_DETAIL');
      if (builder.mode === 'refuse') return { ok: false, problems: [...builder.problems] };
      const bytes =
        builder.bytes ??
        Buffer.from(
          JSON.stringify({ stand: 'in package', venueId: args.venueId, versionNo: args.versionNo }),
        );
      return {
        ok: true,
        bytes,
        mimeType: 'application/octet-stream',
        extension: 'bin',
        nodeCount: 3,
        edgeCount: 2,
        warnings: [...builder.warnings],
      };
    },
    ...over,
  };
  return builder;
}

// ---------------------------------------------------------------------------------------------------------- documents

/** `doc` with an unknown key "pad" so its JSON text is exactly `target` bytes (an unknown key is left out of the copy). */
function padTo(doc, target) {
  const overhead = b.bytesOf({ ...doc, pad: '' });
  const padded = { ...doc, pad: 'x'.repeat(target - overhead) };
  assert.equal(b.bytesOf(padded), target, 'the padding is exact');
  return padded;
}

/** smallDoc with one level's backdrop naming `key` (the level l1). */
function docWithBackdrop(key, over = {}) {
  const doc = b.smallDoc();
  doc.levels[0].backdrop = { id: key, cx: 50, cz: 40, mpp: 0.01, ...over };
  return doc;
}

/** The tenant's CatalogVersion after ctx.seedLookups: it starts at 1 and the trigger adds 1 per ObjectType row inserted. */
const SEEDED_CATALOG_VERSION = 1 + b.objectRows().length;

/**
 * What the validator returns for `doc`: the canonical copy a save must store. The context is the fixture's, with the
 * catalog version a tenant has after ctx.seedLookups (the canonical copy writes it when the document has none).
 */
function canonical(doc, version = SEEDED_CATALOG_VERSION) {
  const result = b.vm().validateMap(structuredClone(doc), b.makeContext({ version }));
  assert.equal(
    result.ok,
    true,
    `the fixture is valid: ${JSON.stringify(result.problems?.slice(0, 3))}`,
  );
  return result.map;
}

/** The layout a publish freezes for `doc`: its canonical copy without any level's backdrop (OA-1 AC-34). */
const publishableOf = (doc, version) => b.vm().publishable(canonical(doc, version));

const docs = {
  small: () => b.smallDoc(),
  twoLevel: () => b.twoLevelDoc(),
  full: () => b.fullDoc(),
  outdoor: () => b.minimalOutdoorDoc(),
  withBackdrop: docWithBackdrop,
  padTo,
};

// -------------------------------------------------------------------------------------------------------------- routes

/** The eight routes of OA-2 for one venue. `venue: false` marks the one that names none. */
function mapRoutes(venueId) {
  const base = `/api/venues/${venueId}/map`;
  return [
    { name: 'GET map', method: 'GET', path: base },
    {
      name: 'PUT draft',
      method: 'PUT',
      path: `${base}/draft`,
      body: { layout: b.smallDoc(), baseVersion: 0 },
    },
    { name: 'POST publish', method: 'POST', path: `${base}/publish`, body: { baseVersion: 0 } },
    {
      name: 'POST rollback',
      method: 'POST',
      path: `${base}/rollback`,
      body: { version: 1, baseVersion: 0 },
    },
    { name: 'POST clear', method: 'POST', path: `${base}/clear`, body: { baseVersion: 0 } },
    { name: 'POST backdrops', method: 'POST', path: `${base}/backdrops`, upload: true },
    { name: 'GET backdrop', method: 'GET', path: `${base}/backdrops/${MAP_KEY}` },
    { name: 'GET catalog', method: 'GET', path: '/api/venue-maps/catalog', venue: false },
  ];
}

/** A multipart form with one file part. */
function uploadForm(bytes, { name = 'plan.png', type = 'image/png', field = 'file' } = {}) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), name);
  return form;
}

/** Sends one route of mapRoutes() with `headers`. */
function sendRoute(ctx, route, headers = {}) {
  if (route.upload) {
    return ctx.call('POST', route.path, { form: uploadForm(pngBytes(100, 80)), headers });
  }
  return ctx.call(route.method, route.path, { body: route.body, headers });
}

// -------------------------------------------------------------------------------------------------------- the helpers

function createHelpers(ctx, { clock, builder }) {
  const { sql, fileStore } = ctx;
  const seeded = new Set();

  async function seedLookups(tenantId) {
    const rows = b.lookupRows();
    for (const r of rows.buildingTypes) {
      await sql.one(
        `INSERT INTO gabay.BuildingType (TenantId, Code, Label, SortOrder, IsActive) VALUES ($1, $2, $3, $4, $5) RETURNING 1`,
        [tenantId, r.code, r.label, r.sortOrder, r.isActive],
      );
    }
    for (const r of rows.amenityTypes) {
      await sql.one(
        `INSERT INTO gabay.AmenityType (TenantId, Code, Label, SortOrder, IsActive) VALUES ($1, $2, $3, $4, $5) RETURNING 1`,
        [tenantId, r.code, r.label, r.sortOrder, r.isActive],
      );
    }
    for (const r of rows.transitTypes) {
      await sql.one(
        `INSERT INTO gabay.TransitType (TenantId, Code, Label, SortOrder, IsActive) VALUES ($1, $2, $3, $4, $5) RETURNING 1`,
        [tenantId, r.code, r.label, r.sortOrder, r.isActive],
      );
    }
    for (const r of rows.connectorTypes) {
      await sql.one(
        `INSERT INTO gabay.ConnectorType (TenantId, Code, Label, CostModel, IsStepFree, SortOrder, IsActive, CostBaseS, CostPerRiseS)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1) RETURNING 1`,
        [
          tenantId,
          r.code,
          r.label,
          r.costModel,
          ['ELEVATOR', 'RAMP', 'LEVEL'].includes(r.costModel),
          r.sortOrder,
          r.isActive,
        ],
      );
    }
    for (const r of rows.occupantCategories) {
      await sql.one(
        `INSERT INTO gabay.OccupantCategory (TenantId, Code, Label, SortOrder, IsActive) VALUES ($1, $2, $3, $4, $5) RETURNING 1`,
        [tenantId, r.code, r.label, r.sortOrder, r.isActive],
      );
    }
    for (const r of b.objectRows()) {
      await sql.objectType(tenantId, r);
    }
    seeded.add(tenantId);
    return (
      await sql.one(`SELECT CatalogVersion FROM gabay.Tenant WHERE TenantId = $1`, [tenantId])
    ).catalogversion;
  }

  const mapUrl = (venueId, tail = '') => `/api/venues/${venueId}/map${tail}`;

  async function mapVenue(tenant = ctx.tenantA, opts = {}) {
    if (!seeded.has(tenant.tenantId)) await seedLookups(tenant.tenantId);
    return sql.venue(tenant.tenantId, opts);
  }

  const save = (venueId, layout, baseVersion, headers) =>
    ctx.put(mapUrl(venueId, '/draft'), { layout, baseVersion }, headers);

  async function saveOk(venueId, layout, baseVersion, headers) {
    const res = await save(venueId, layout, baseVersion, headers);
    assert.equal(
      res.status,
      200,
      `save at ${baseVersion}: ${JSON.stringify(res.body)?.slice(0, 600)}`,
    );
    return res.body;
  }

  const loadMap = (venueId, headers) => ctx.get(mapUrl(venueId), headers);

  async function mapRow(venueId) {
    const row = await sql.one(`SELECT * FROM gabay.VenueMap WHERE VenueId = $1`, [venueId]);
    return row ?? null;
  }

  const versions = (venueId) =>
    sql.rows(`SELECT * FROM gabay.VenueVersion WHERE VenueId = $1 ORDER BY VersionNo`, [venueId]);

  async function counts(venueId, tenantId = ctx.tenantA.tenantId) {
    return sql.one(
      `SELECT (SELECT count(*) FROM gabay.VenueMap WHERE VenueId = $1)::int AS maps,
              (SELECT count(*) FROM gabay.VenueVersion WHERE VenueId = $1)::int AS versions,
              (SELECT count(*) FROM gabay.VenueMapBackdrop WHERE VenueId = $1)::int AS backdrops,
              (SELECT count(*) FROM gabay.StoredFile WHERE TenantId = $2)::int AS files,
              (SELECT count(*) FROM gabay.AuditLog WHERE TenantId = $2)::int AS audits`,
      [venueId, tenantId],
    );
  }

  const upload = (venueId, bytes, opts = {}) =>
    ctx.call('POST', mapUrl(venueId, '/backdrops'), {
      form: uploadForm(bytes, opts),
      headers: opts.headers ?? {},
    });

  // ------------------------------------------------------------------------ rows written by SQL (test setup only)

  /** An ObjectType row from a fixtures/mapBuilder.js objectRow (tenantId null makes a platform row). */
  sql.objectType = async (tenantId, r) => {
    const rz = r.resize ?? { w: null, d: null, h: null };
    return sql.one(
      `INSERT INTO gabay.ObjectType (TenantId, Code, Label, DefaultWidthM, DefaultDepthM, DefaultHeightM, BlocksWalk,
                                     SortOrder, IsActive, ResizeMinWidthM, ResizeMaxWidthM, ResizeMinDepthM,
                                     ResizeMaxDepthM, ResizeMinHeightM, ResizeMaxHeightM, Mount, IsRound)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING ObjectTypeId`,
      [
        tenantId,
        r.code,
        r.label ?? r.code,
        r.defaultW ?? null,
        r.defaultD ?? null,
        r.defaultH ?? null,
        r.blocksWalk ?? true,
        r.sortOrder ?? 0,
        r.isActive ?? true,
        rz.w?.[0] ?? null,
        rz.w?.[1] ?? null,
        rz.d?.[0] ?? null,
        rz.d?.[1] ?? null,
        rz.h?.[0] ?? null,
        rz.h?.[1] ?? null,
        r.mount ?? 'floor',
        r.round ?? false,
      ],
    );
  };

  /** A backdrop row, its StoredFile row and its file in the store, back-dated `ageH` hours. Returns the key. */
  sql.backdrop = async (
    tenantId,
    venueId,
    key = MAP_KEY,
    { ageH = 0, width = 100, height = 80, bytes } = {},
  ) => {
    const data = bytes ?? pngBytes(width, height);
    const path = `backdrops/${tenantId}/${venueId}/${key}`;
    await fileStore.put(path, data);
    const file = await sql.one(
      `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
       VALUES ($1, 'UNDERLAY', 'image/png', $2, $3, $4) RETURNING FileId`,
      [tenantId, data.length, sha256(data), path],
    );
    await sql.one(
      `INSERT INTO gabay.VenueMapBackdrop (BackdropKey, TenantId, VenueId, FileId, WidthPx, HeightPx, CreatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(hours => $7)) RETURNING 1`,
      [key, tenantId, venueId, file.fileid, width, height, ageH],
    );
    return key;
  };

  /** A PUBLISHED version with its package file (a stand-in), as a finished publish leaves it. */
  sql.published = async (
    tenantId,
    venueId,
    versionNo,
    layout,
    { publishedBy = ctx.user.userId } = {},
  ) => {
    const bytes = Buffer.from(`stand-in package v${versionNo} of venue ${venueId}`);
    const hash = sha256(bytes);
    const path = `packages/${tenantId}/${venueId}/v${versionNo}-${hash}.bin`;
    await fileStore.put(path, bytes);
    const file = await sql.one(
      `INSERT INTO gabay.StoredFile (TenantId, Purpose, MimeType, SizeBytes, Sha256, StoragePath)
       VALUES ($1, 'PACKAGE', 'application/octet-stream', $2, $3, $4) RETURNING FileId`,
      [tenantId, bytes.length, hash, path],
    );
    const row = await sql.one(
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFileId, PackageSha256,
                                       PackageFormatVersion, NodeCount, EdgeCount, PublishedAt, PublishedBy, CreatedBy,
                                       LayoutJson)
       VALUES ($1, $2, $3, 'PUBLISHED', $4, $5, 1, 3, 2, now(), $6, $6, $7::jsonb) RETURNING VenueVersionId`,
      [tenantId, venueId, versionNo, file.fileid, hash, publishedBy, JSON.stringify(layout)],
    );
    return { versionId: row.venueversionid, fileId: file.fileid, path, hash, bytes };
  };

  /** A BUILDING row (someone else's publish in flight), `ageS` seconds old. */
  sql.buildingVersion = async (
    tenantId,
    venueId,
    versionNo,
    { ageS = 0, layout = b.smallDoc() } = {},
  ) =>
    sql.one(
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion, CreatedAt, LayoutJson)
       VALUES ($1, $2, $3, 'BUILDING', 1, now() - make_interval(secs => $4), $5::jsonb) RETURNING VenueVersionId`,
      [tenantId, venueId, versionNo, ageS, JSON.stringify(layout)],
    );
  sql.failedVersion = async (tenantId, venueId, versionNo, { layout = b.smallDoc() } = {}) =>
    sql.one(
      `INSERT INTO gabay.VenueVersion (TenantId, VenueId, VersionNo, Status, PackageFormatVersion, LayoutJson)
       VALUES ($1, $2, $3, 'FAILED', 1, $4::jsonb) RETURNING VenueVersionId`,
      [tenantId, venueId, versionNo, JSON.stringify(layout)],
    );

  return {
    clock,
    builder,
    seedLookups,
    mapVenue,
    mapUrl,
    save,
    saveOk,
    loadMap,
    mapRow,
    versions,
    counts,
    upload,
  };
}

/**
 * withVenueApp with the OA-2 dependencies wired.
 * @param {(ctx: object) => Promise<void>} fn
 * @param {{ mapBuilder?: object|null, fileStore?: object }} [options]  `mapBuilder: null` means no engine (AC-30)
 */
async function withMapApp(fn, options = {}) {
  const clock = makeClock();
  const builder = Object.hasOwn(options, 'mapBuilder') ? options.mapBuilder : fakeBuilder();
  await withVenueApp(
    async (ctx) => {
      Object.assign(ctx, createHelpers(ctx, { clock, builder }));
      await fn(ctx);
    },
    { ...options, mapBuilder: builder, now: clock.now },
  );
}

/** Asserts a refusal in OA-1's problem shape: { error, problems, total } and no driver text. */
function assertProblemBody(res, { status = 400, error, includes } = {}) {
  assert.equal(res.status, status, JSON.stringify(res.body)?.slice(0, 500));
  assert.deepEqual(Object.keys(res.body).sort(), ['error', 'problems', 'total']);
  assert.ok(Array.isArray(res.body.problems) && res.body.problems.length > 0, 'problems');
  assert.equal(typeof res.body.total, 'number');
  if (error !== undefined) {
    if (error instanceof RegExp) assert.match(res.body.error, error);
    else assert.equal(res.body.error, error);
  }
  if (includes !== undefined) {
    assert.ok(
      res.body.problems.some((p) =>
        includes instanceof RegExp ? includes.test(p) : p.includes(includes),
      ),
      `a problem matching ${includes}: ${JSON.stringify(res.body.problems.slice(0, 5))}`,
    );
  }
}

/** Asserts the plain { error } refusal with exactly `message` (a string) or matching (a RegExp). */
function assertError(res, status, message) {
  assert.equal(res.status, status, JSON.stringify(res.body)?.slice(0, 500));
  assert.equal(typeof res.body?.error, 'string', 'the { error } shape');
  if (message instanceof RegExp) assert.match(res.body.error, message);
  else if (message !== undefined) assert.equal(res.body.error, message);
  assert.doesNotMatch(res.body.error, /violates|constraint|fk_|ck_|uq_|23\d\d\d|gabay\./i);
}

/** The 409 of a stale draft version (AC-16): the exact text and the stored version. */
const STALE_TEXT = 'Someone else changed this map. Reload to see their change';
function assertStale(res, storedVersion) {
  assert.equal(res.status, 409, JSON.stringify(res.body)?.slice(0, 500));
  assert.deepEqual(res.body, { error: STALE_TEXT, draftVersion: storedVersion });
}

module.exports = {
  MAP_KEY,
  OTHER_KEY,
  STALE_TEXT,
  sha256,
  makeClock,
  fakeBuilder,
  docs,
  padTo,
  canonical,
  publishableOf,
  SEEDED_CATALOG_VERSION,
  mapRoutes,
  sendRoute,
  uploadForm,
  withMapApp,
  assertProblemBody,
  assertError,
  assertStale,
};
