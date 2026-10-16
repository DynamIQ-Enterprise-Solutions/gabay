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
//
// CHANGED BY OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 4; spec/OA-3.md AC-1, AC-8): schema 0.17 has no Building or
// Level table and no Venue.BoundaryGeoJson or MapUpDeg, so sql.venue inserts identity only and sql.building and sql.level are
// gone. The keyed rows take their place (the key check's tests, AC-9, and the "nothing else changed" counts): sql.store,
// sql.statusChange, sql.beacon, sql.beaconPlan, sql.sentinel and sql.closure, each keyed by an element key.
'use strict';

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

/** The beacon namespace the keyed-row helpers give a tenant (Beacon's composite FK needs Tenant.BeaconProximityUuid). */
const uuidFor = (tenantId) => `00000000-0000-4000-8000-${String(tenantId).padStart(12, '0')}`;

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
  const fileStore = options.fileStore ?? memoryFileStore();
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

  let counter = 0;
  const next = () => {
    counter += 1;
    return counter;
  };
  const one = async (text, params = []) => (await t.raw.query(text, params)).rows[0];
  const rows = async (text, params = []) => (await t.raw.query(text, params)).rows;

  /** The tenant's test category and status for stores (one pair per tenant, made on first use in this transaction). */
  const lookupsByTenant = new Map();
  async function storeLookups(tenantId) {
    if (!lookupsByTenant.has(tenantId)) {
      const category = await one(
        `INSERT INTO gabay.OccupantCategory (TenantId, Code, Label) VALUES ($1, $2, 'Test category') RETURNING OccupantCategoryId`,
        [tenantId, `CAT${seed.tag}`],
      );
      const status = await one(
        `INSERT INTO gabay.StoreStatus (TenantId, Code, Label, IsRoutable) VALUES ($1, $2, 'Test open', TRUE) RETURNING StoreStatusId`,
        [tenantId, `OPEN${seed.tag}`],
      );
      lookupsByTenant.set(tenantId, {
        categoryId: category.occupantcategoryid,
        statusId: status.storestatusid,
      });
    }
    return lookupsByTenant.get(tenantId);
  }

  // Test setup only: every statement is a literal with bound values.
  const sql = {
    one,
    rows,
    async venue(tenantId, { code, name, isActive = true, grantTo = [] } = {}) {
      const n = next();
      const made = await one(
        `INSERT INTO gabay.Venue (TenantId, Code, Name, IsActive)
         VALUES ($1, $2, $3, $4) RETURNING VenueId`,
        [tenantId, code ?? `S${seed.tag}${n}`, name ?? `Venue ${seed.tag} ${n}`, isActive],
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
    /**
     * A store (Occupant) on the unit with this key. Its category and status are the tenant's own test rows (made once, in
     * this transaction), so the helper needs no seeded lookup.
     */
    async store(tenantId, venueId, unitKey, { isActive = true, name } = {}) {
      const { categoryId, statusId } = await storeLookups(tenantId);
      const made = await one(
        `INSERT INTO gabay.Occupant (TenantId, VenueId, UnitKey, OccupantCategoryId, StoreStatusId, Name, IsActive)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING OccupantId`,
        [tenantId, venueId, unitKey, categoryId, statusId, name ?? `Store ${seed.tag} ${next()}`, isActive],
      );
      return made.occupantid;
    },
    /** A store's status change on the unit with this key (an inactive store is made for it). */
    async statusChange(tenantId, venueId, unitKey) {
      const occupantId = await sql.store(tenantId, venueId, unitKey, { isActive: false });
      const { statusId } = await storeLookups(tenantId);
      await one(
        `INSERT INTO gabay.StoreStatusChange (TenantId, VenueId, OccupantId, UnitKey, ToStoreStatusId)
         VALUES ($1, $2, $3, $4, $5) RETURNING StoreStatusChangeId`,
        [tenantId, venueId, occupantId, unitKey, statusId],
      );
    },
    /** A beacon on the level with this key; the tenant gets a beacon namespace first if it has none. */
    async beacon(tenantId, venueId, levelKey, { isActive = true } = {}) {
      await one(
        `UPDATE gabay.Tenant SET BeaconProximityUuid = COALESCE(BeaconProximityUuid, $2::uuid)
          WHERE TenantId = $1 RETURNING TenantId`,
        [tenantId, uuidFor(tenantId)],
      );
      await one(
        `INSERT INTO gabay.Beacon (TenantId, VenueId, LevelKey, X, Y, ProximityUuid, Major, Minor, IdentityScheme, IsActive)
         SELECT $1, $2, $3, 1, 1, BeaconProximityUuid, 1, $4, 'IBEACON_STATIC', $5 FROM gabay.Tenant WHERE TenantId = $1
         RETURNING BeaconId`,
        [tenantId, venueId, levelKey, next(), isActive],
      );
    },
    /** A beacon plan for the level with this key. */
    async beaconPlan(tenantId, venueId, levelKey) {
      await one(
        `INSERT INTO gabay.BeaconPlan (TenantId, VenueId, LevelKey, PlanKind, Status, BeaconCount, InputsJson)
         VALUES ($1, $2, $3, 'RECOMMENDED', 'PROPOSED', 0, '{}'::jsonb) RETURNING BeaconPlanId`,
        [tenantId, venueId, levelKey],
      );
    },
    /** A sentinel on the level with this key. */
    async sentinel(tenantId, venueId, levelKey, { isActive = true } = {}) {
      await one(
        `INSERT INTO gabay.Sentinel (TenantId, VenueId, LevelKey, Name, X, Y, HmacSecretEnc, IsActive)
         VALUES ($1, $2, $3, 'Sentinel', 1, 1, '\\x00'::bytea, $4) RETURNING SentinelId`,
        [tenantId, venueId, levelKey, isActive],
      );
    },
    /** A closure: of a connector (connectorKey) or of an area on a level (levelKey). */
    async closure(tenantId, venueId, { levelKey = null, connectorKey = null } = {}) {
      await one(
        `INSERT INTO gabay.Closure (TenantId, VenueId, LevelKey, ConnectorKey, AreaGeoJson, Reason, StartsAt)
         VALUES ($1, $2, $3, $4, CASE WHEN $4::text IS NULL THEN '{"type":"Polygon","coordinates":[]}'::jsonb END,
                 'Closed for the test', now())
         RETURNING ClosureId`,
        [tenantId, venueId, levelKey, connectorKey],
      );
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

module.exports = { withVenueApp, bodies, assertRefused, ISO_MS };
