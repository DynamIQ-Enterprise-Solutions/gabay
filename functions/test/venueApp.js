// Test support for FF-1's API tests (plan/FF-1-venue-setup.md section 4). Not a test file.
//
//   withVenueApp(fn)   the real app (createApp: the E-20 stub, the routes, the services, the real local tables) on a port,
//                      over openSavepointDb() so every row, written by a test or by a service, is rolled back at the end
//                      (L151). The stub user is a MALL_ADMIN of tenants A and B and not of C. A request with no
//                      X-Tenant-Id acts for A (the stub's first tenant by Code, "T_A_...").
//   fn gets { call, get, post, put, del, sql, seed, user, tenantA, tenantB, tenantC, hooks, record, ... }
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

const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { createSeeder } = require('./authHelpers');
const { openSavepointDb } = require('./savepointDb');
const { memoryFileStore } = require('./memoryFileStore');

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
  const seed = createSeeder(t.raw);
  const role = await seed.role('MALL_ADMIN');
  const tenantA = await seed.tenant('A'); // sorts first: the stub's default tenant
  const tenantB = await seed.tenant('B');
  const tenantC = await seed.tenant('C'); // the stub user does not hold it
  const user = await seed.user();
  await seed.userRole(user.userId, role, tenantA.tenantId);
  await seed.userRole(user.userId, role, tenantB.tenantId);
  const logger = fakeLogger();
  const fileStore = options.fileStore ?? memoryFileStore();
  const app = createApp({
    config: testConfig({ DEV_STUB_USER_EMAIL: user.email }),
    db: t.db,
    logger,
    tokenVerifier: { verifyIdToken: async () => assert.fail('FF-1 routes need no token') },
    settings: createSettings((text, params) => t.raw.query(text, params), logger),
    fileStore,
    mapBuilder: options.mapBuilder ?? null,
    now: options.now,
  });
  const server = await listen(app);

  async function call(method, path, { body, headers = {}, rawBody, form } = {}) {
    const init = { method, headers: { ...headers } };
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

  // Test setup only: every statement is a literal with bound values.
  const sql = {
    one,
    rows,
    async venue(tenantId, { code, name, mapUpDeg = 0, isActive = true } = {}) {
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
      return made.venueid;
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

  /** Starts recording every statement the services send; returns the live array of { text, params }. */
  const record = () => {
    const log = [];
    t.hooks.onStatement = (text, params, inTransaction) =>
      log.push({ text, params, inTransaction });
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
    user,
    tenantA,
    tenantB,
    tenantC,
    asB: { 'x-tenant-id': String(tenantB.tenantId) },
    asC: { 'x-tenant-id': String(tenantC.tenantId) },
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

module.exports = { withVenueApp, bodies, assertRefused, ISO_MS, ZERO_POLYGON };
