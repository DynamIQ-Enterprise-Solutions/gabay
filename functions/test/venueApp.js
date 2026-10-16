// Test support for FF-1's API tests (plan/FF-1-venue-setup.md section 4). Not a test file.
//
//   withVenueApp(fn)   the real app (createApp: the real chain auth -> tenantContext -> guards, the routes, the services,
//                      the real local tables) on a port, over openSavepointDb() so every row, written by a test or by a
//                      service, is rolled back at the end (L151).
//   fn gets { call, get, post, put, del, as, users, user, sql, seed, tenantA, tenantB, tenantC, hooks, record, ... }
//
// SEC-1 (plan/SEC-1.md 1.0 step 7, DC-23): there is no development stub and no default tenant. The harness signs in ONE
// user per admin role (adminAccess.js: SUPERADMIN on a platform row; MALL_ADMIN, VENUE_EDITOR and VIEWER each in tenants A
// and B, none in C), each with a token the app's verifier double knows. ctx.as(role, tenant = A) gives that user's
// { authorization, 'x-tenant-id' }. get/post/put/del/call send MALL_ADMIN in A unless the test's headers say otherwise
// (what the stub gave, so the OA-1 and OA-2 expectations hold; a header given as null is left out, so a test can send
// no token or no tenant). ctx.user is that MALL_ADMIN; ctx.asB and ctx.asC are MALL_ADMIN in B and in C (C is not held).
// sql.grant(userId, tenantId, venueId) and sql.venue(..., { grantTo }) write UserVenueGrant rows for the scoped roles.
// ctx.accessCache is the app's access cache (its invalidations, for a test that changes a grant mid-test). The first
// call in a process checks that migration 0002's rows exist (adminAccess.assertMigrated).
//
// Every request is awaited before the next one (plan G4: no concurrency through one savepoint connection). The one
// exception is a request a test's own builder hook (mapApp.js) sends while a publish is paused between its two
// transactions: nothing is then inside a savepoint, so the connection is free.
// `sql` writes fixture rows directly (test setup only; the table names are literals in this file).
//
// OA-2 (plan/OA-2-map-storage.md 1.0 sections 4.6 and 6.2): withVenueApp(fn, options) takes the app's new dependencies,
// { fileStore, mapBuilder, now } (the default store is in memory, so no test writes a file; the default builder is null:
// publish answers 501), and call() sends a multipart `form`. The building, level and unit builders of FF-1 are gone with
// the routes they served, except sql.building and sql.level, which AC-35's "nothing else changed" count still needs.
'use strict';

const test = require('node:test');
const { AsyncLocalStorage } = require('node:async_hooks');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createAuditTrail } = require('../src/middleware/auditTrail');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { createSeeder } = require('./authHelpers');
const {
  tokenVerifier,
  seedAdmins,
  asHeaders,
  withDefaults,
  assertMigrated,
} = require('./adminAccess');
const { createAccessCache } = require('../src/auth/accessCache');
const { createAccessStore } = require('../src/auth/accessStore');
const { openSavepointDb } = require('./savepointDb');
const { memoryFileStore } = require('./memoryFileStore');
const { fakeBucketFileStore } = require('./fakeBucket');
const { startFunctionsHost } = require('./functionsHost');

/**
 * The stores a store-sensitive suite runs over (DEP-0 AC-10): the in-memory double (the default of every other suite) and
 * GcsFileStore over the fake bucket. Both offer the same inspection surface (files, puts, gets, removes, keys, hashes).
 */
const STORE_KINDS = Object.freeze(['memory', 'gcs-fake']);
const storeKindOfTest = new AsyncLocalStorage();

/** A fresh store of the kind the running forEachStore test asked for; the in-memory double outside one. */
function defaultFileStore() {
  return storeKindOfTest.getStore() === 'gcs-fake' ? fakeBucketFileStore() : memoryFileStore();
}

/**
 * node:test's `test`, once per store kind (plan C1): the body is unchanged, and withVenueApp (so withMapApp) builds the app
 * over the store of the kind running. A test that passes its own `fileStore` keeps it in both runs.
 * @param {string} name
 * @param {(t: object) => Promise<void>|void} fn
 */
function forEachStore(name, fn) {
  for (const kind of STORE_KINDS) {
    test(`${name} [${kind}]`, (t) => storeKindOfTest.run(kind, () => fn(t)));
  }
}

const ZERO_POLYGON = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  ],
});

async function withVenueApp(fn, options = {}) {
  const t = await openSavepointDb();
  try {
    return await withVenueAppOn(t, fn, options);
  } catch (err) {
    await t.close().catch(() => {}); // a setup failure must not leave the connection open (the process would hang)
    throw err;
  }
}

async function withVenueAppOn(t, fn, options) {
  // Other test files insert the roles in their own transactions; on an unseeded database two inserts in opposite orders
  // deadlock (40P01). A table lock first makes them wait for this transaction instead.
  await t.raw.query('LOCK TABLE gabay.Role IN SHARE ROW EXCLUSIVE MODE', []);
  await assertMigrated((text, params) => t.raw.query(text, params));
  const seed = createSeeder(t.raw);
  const tenantA = await seed.tenant('A');
  const tenantB = await seed.tenant('B');
  const tenantC = await seed.tenant('C'); // held by nobody but SUPERADMIN (who may name any tenant)
  const now = options.now ?? Date.now;
  const verifier = tokenVerifier({ now });
  const users = await seedAdmins(seed, [tenantA, tenantB], verifier);
  const user = users.MALL_ADMIN;
  const logger = fakeLogger();
  const fileStore = options.fileStore ?? defaultFileStore();
  const accessCache = createAccessCache({ accessStore: createAccessStore(t.db), now });
  // SEC-2 AC-26: every request runs over ONE rolled-back connection, so an audit write still in flight would land inside a
  // later savepoint. The trail is built here so call() can wait on settled() after each response, and before close().
  const auditTrail =
    options.auditTrail ??
    createAuditTrail({ db: options.auditDb ? options.auditDb(t.db) : t.db, logger });
  const app = createApp({
    config: options.config ?? testConfig(),
    db: t.db,
    logger,
    rateLimitWindows: options.rateLimitWindows,
    auditTrail,
    tokenVerifier: verifier,
    settings: createSettings((text, params) => t.raw.query(text, params), logger),
    fileStore,
    mapBuilder: options.mapBuilder ?? null,
    now,
    accessCache,
  });
  const server = await listen(app);

  /** That role's user in that tenant (default A); SUPERADMIN's platform row lets it name any tenant. */
  const as = (role, tenant = tenantA) => asHeaders(users[role].token, tenant);
  const defaultHeaders = as('MALL_ADMIN');

  async function call(method, path, { body, headers = {}, rawBody, form } = {}) {
    const init = { method, headers: withDefaults(defaultHeaders, headers) };
    if (form !== undefined) {
      init.body = form; // a FormData: fetch sets the multipart content type and boundary
    } else if (rawBody !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = rawBody;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${server.url}${path}`, init);
    const bytes = Buffer.from(await res.arrayBuffer());
    await auditTrail.settled();
    const text = bytes.toString('utf8');
    let parsed = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed, text, bytes, headers: res.headers };
  }

  // DEP-0 (plan step 7): the same app through a platform-shaped host (functionsHost.js), started on first use. hostCall takes what call
  // takes and answers the same shape, so a test can send one request down both paths and compare the answers.
  let host = null;
  const getHost = async () => (host ??= await startFunctionsHost(app));
  async function hostCall(method, path, { body, headers = {}, rawBody, form } = {}) {
    const platform = await getHost();
    const sent = withDefaults(defaultHeaders, headers);
    let bytes;
    if (form !== undefined) {
      const encoded = new Response(form); // fetch's own multipart encoding: the bytes and the content type with its boundary
      sent['content-type'] = encoded.headers.get('content-type');
      bytes = Buffer.from(await encoded.arrayBuffer());
    } else if (rawBody !== undefined) {
      bytes = Buffer.from(rawBody);
      sent['content-type'] ??= 'application/json';
    } else if (body !== undefined) {
      bytes = Buffer.from(JSON.stringify(body));
      sent['content-type'] = 'application/json';
    }
    const res = await platform.request(method, path, { headers: sent, bytes });
    await auditTrail.settled();
    let parsed = null;
    if (res.text !== '') {
      try {
        parsed = JSON.parse(res.text);
      } catch {
        parsed = res.text;
      }
    }
    return {
      status: res.status,
      body: parsed,
      text: res.text,
      bytes: res.bytes,
      headers: new Headers(res.headers),
    };
  }

  let counter = 0;
  const next = () => {
    counter += 1;
    return counter;
  };
  const one = async (text, params = []) => (await t.raw.query(text, params)).rows[0];
  const rows = async (text, params = []) => (await t.raw.query(text, params)).rows;

  // Test setup only: every statement is a literal with bound values.
  const sql = {
    one,
    rows,
    async venue(tenantId, { code, name, mapUpDeg = 0, isActive = true, grantTo = [] } = {}) {
      const n = next();
      const made = await one(
        `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson, MapUpDeg, IsActive)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING VenueId`,
        [
          tenantId,
          code ?? `S${seed.tag}${n}`,
          name ?? `Venue ${seed.tag} ${n}`,
          ZERO_POLYGON,
          mapUpDeg,
          isActive,
        ],
      );
      for (const userId of grantTo) await sql.grant(userId, tenantId, made.venueid);
      return made.venueid;
    },
    /** A UserVenueGrant row: the venue-scoped user may see and work on this venue of this tenant (SEC-1). */
    async grant(userId, tenantId, venueId) {
      await one(
        `INSERT INTO gabay.UserVenueGrant (TenantId, UserId, VenueId) VALUES ($1, $2, $3) RETURNING UserVenueGrantId`,
        [tenantId, userId, venueId],
      );
    },
    /** A building type: tenantId null makes a platform row (exists only in this transaction). */
    async buildingType(tenantId, { label, code, isActive = true } = {}) {
      const n = next();
      const made = await one(
        `INSERT INTO gabay.BuildingType (TenantId, Code, Label, SortOrder, IsActive)
         VALUES ($1, $2, $3, 0, $4) RETURNING BuildingTypeId`,
        [tenantId, code ?? `BT${seed.tag}${n}`, label ?? `Type ${seed.tag} ${n}`, isActive],
      );
      return made.buildingtypeid;
    },
    async building(tenantId, venueId, buildingTypeId, { name, mapUpDeg = null } = {}) {
      const n = next();
      const made = await one(
        `INSERT INTO gabay.Building (TenantId, VenueId, BuildingTypeId, Name, MapUpDeg)
         VALUES ($1, $2, $3, $4, $5) RETURNING BuildingId`,
        [tenantId, venueId, buildingTypeId, name ?? `Building ${seed.tag} ${n}`, mapUpDeg],
      );
      return made.buildingid;
    },
    /** buildingId null makes the venue's outdoor ground level. */
    async level(
      tenantId,
      venueId,
      buildingId,
      { ordinal = 0, name, shortName, width = '40', depth = '25' } = {},
    ) {
      const n = next();
      const made = await one(
        `INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, Ordinal, Name, ShortName, IsOutdoor, WidthM, DepthM)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING LevelId`,
        [
          tenantId,
          venueId,
          buildingId,
          ordinal,
          name ?? `Level ${seed.tag} ${n}`,
          shortName ?? `L${n}`.slice(0, 10),
          buildingId === null,
          width,
          depth,
        ],
      );
      return made.levelid;
    },
  };

  /**
   * Starts recording every statement the services send; returns the live array of { text, params }. The audit trail's own
   * insert is left out (SEC-2 plan C1): it runs after the response (AC-17), and the tests that read this log assert what a
   * request's chain sent. sec2.audit.test.js reads AuditLog itself.
   */
  const record = () => {
    const log = [];
    t.hooks.onStatement = (text, params, inTransaction) => {
      if (/^\s*INSERT INTO gabay\.AuditLog\b/i.test(text)) return;
      log.push({ text, params, inTransaction });
    };
    return log;
  };

  const ctx = {
    call,
    hostCall,
    getHost,
    defaultHeaders,
    app,
    get: (path, headers) => call('GET', path, { headers }),
    post: (path, body, headers) => call('POST', path, { body, headers }),
    put: (path, body, headers) => call('PUT', path, { body, headers }),
    del: (path, headers) => call('DELETE', path, { headers }),
    sql,
    seed,
    tag: seed.tag,
    as,
    users,
    user,
    verifier,
    auditTrail,
    accessCache,
    logger,
    tenantA,
    tenantB,
    tenantC,
    asB: as('MALL_ADMIN', tenantB),
    asC: as('MALL_ADMIN', tenantC),
    fileStore,
    server,
    hooks: t.hooks,
    record,
    next,
    db: t.db,
    raw: t.raw,
  };
  try {
    await fn(ctx);
  } finally {
    await host?.close();
    await server.close();
    await auditTrail.settled();
    await t.close();
  }
}

/** The bodies a valid request carries; `over` replaces any field. Decimals are strings, blank is null. */
function bodies(ctx) {
  return {
    venue: (over = {}) => ({
      code: `V${ctx.tag}${ctx.next()}`,
      name: `Venue ${ctx.tag}`,
      isActive: true,
      ...over,
    }),
  };
}

/** Asserts a refusal: the status and the standard { error } body, the message matching `pattern`, no driver text. */
function assertRefused(res, status, pattern, note = '') {
  assert.equal(res.status, status, `${note} ${JSON.stringify(res.body)}`);
  assert.equal(typeof res.body?.error, 'string', `${note} the { error } shape`);
  assert.deepEqual(Object.keys(res.body), ['error'], note);
  if (pattern) assert.match(res.body.error, pattern, note);
  assert.doesNotMatch(res.body.error, /violates|constraint|fk_|ck_|uq_|23\d\d\d|gabay\./i, note);
}

const ISO_MS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

module.exports = {
  withVenueApp,
  forEachStore,
  STORE_KINDS,
  bodies,
  assertRefused,
  ISO_MS,
  ZERO_POLYGON,
};
