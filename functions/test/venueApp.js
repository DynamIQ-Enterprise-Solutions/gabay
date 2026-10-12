// Test support for FF-1's API tests (plan/FF-1-venue-setup.md section 4). Not a test file.
//
//   withVenueApp(fn)   the real app (createApp: the E-20 stub, the routes, the services, the real local tables) on a port,
//                      over openSavepointDb() so every row, written by a test or by a service, is rolled back at the end
//                      (L151). The stub user is a MALL_ADMIN of tenants A and B and not of C. A request with no
//                      X-Tenant-Id acts for A (the stub's first tenant by Code, "T_A_...").
//   fn gets { call, get, post, put, del, sql, seed, user, tenantA, tenantB, tenantC, hooks, record, ... }
//
// Every request is awaited before the next one (plan G4: no concurrency through one savepoint connection).
// `sql` writes fixture rows directly (test setup only; the table names are literals in this file).
'use strict';

const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createSettings } = require('../src/config/settings');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { createSeeder } = require('./authHelpers');
const { openSavepointDb } = require('./savepointDb');

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

async function withVenueApp(fn) {
  const t = await openSavepointDb();
  const seed = createSeeder(t.raw);
  const role = await seed.role('MALL_ADMIN');
  const tenantA = await seed.tenant('A'); // sorts first: the stub's default tenant
  const tenantB = await seed.tenant('B');
  const tenantC = await seed.tenant('C'); // the stub user does not hold it
  const user = await seed.user();
  await seed.userRole(user.userId, role, tenantA.tenantId);
  await seed.userRole(user.userId, role, tenantB.tenantId);
  const logger = fakeLogger();
  const app = createApp({
    config: testConfig({ DEV_STUB_USER_EMAIL: user.email }),
    db: t.db,
    logger,
    tokenVerifier: { verifyIdToken: async () => assert.fail('FF-1 routes need no token') },
    settings: createSettings((text, params) => t.raw.query(text, params), logger),
  });
  const server = await listen(app);

  async function call(method, path, { body, headers = {}, rawBody } = {}) {
    const init = { method, headers: { ...headers } };
    if (rawBody !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = rawBody;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${server.url}${path}`, init);
    const text = await res.text();
    let parsed = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed, text };
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
    /** A unit on a level (what makes a level "in use"). */
    async unit(tenantId, venueId, levelId) {
      const made = await one(
        `INSERT INTO gabay.Unit (TenantId, VenueId, LevelId, ImdfCategory, ShapeKind, GeometryGeoJson, IsWalkable)
         VALUES ($1, $2, $3, 'room', 'POLYGON', '{"type":"Polygon","coordinates":[]}'::jsonb, FALSE) RETURNING UnitId`,
        [tenantId, venueId, levelId],
      );
      return made.unitid;
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
      mapUpDeg: null,
      isActive: true,
      ...over,
    }),
    building: (buildingTypeId, over = {}) => ({
      name: `Building ${ctx.tag}`,
      buildingTypeId,
      mapUpDeg: null,
      ...over,
    }),
    level: (over = {}) => ({
      ordinal: ctx.next(),
      name: `Level ${ctx.tag}`,
      shortName: 'L1',
      spokenName: null,
      elevationM: null,
      widthM: '40.000',
      depthM: '25.000',
      gridCellM: null,
      ceilingHeightM: null,
      ...over,
    }),
    outdoor: (over = {}) => ({
      name: `Outdoor ${ctx.tag}`,
      shortName: 'OUT',
      spokenName: null,
      elevationM: null,
      widthM: '40.000',
      depthM: '25.000',
      gridCellM: null,
      ceilingHeightM: null,
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

/** A venue's GeoJSON polygon for a rectangle from (0,0) to (w,d). */
const rectangle = (w, d) => ({
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
      [0, 0],
    ],
  ],
});

module.exports = { withVenueApp, bodies, assertRefused, ISO_MS, ZERO_POLYGON, rectangle };
