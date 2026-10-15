'use strict';

// FF-SK, the owner's ruling for that slice: a SUPERADMIN with no X-Tenant-Id acts in no tenant, and every route that
// works inside a tenant (FF-0's lookups, FF-1's venues, OA-2's eight map routes) refuses cleanly with 400 "Choose a
// tenant: this works inside one tenant", in the { error } shape, before any query on its tables: never a 500, never a
// write. With X-Tenant-Id the SUPERADMIN acts in that tenant, any existing one (the superuser override), and the routes
// work as for any admin there.
//
// CHANGED BY SEC-1 (plan/SEC-1.md 1.0 section 2, C1; spec AC-3, AC-9, DC-4): there is no default tenant for anyone, so the
// no-header rows now hold for EVERY role (the same text, M-NO-TENANT, from tenantContext); the MALL_ADMIN "first tenant"
// case inverts to 400; asSuperAdmin signs in with the SUPERADMIN token instead of the stub's X-Dev-Act-As.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');
const { MAP_KEY } = require('./mapApp');
const { ADMIN_ROLE_CODES } = require('../src/auth/routeKeys');

const CHOOSE = 'Choose a tenant: this works inside one tenant';

/** The role's token with NO tenant header (the harness's default header removed). */
const noTenant = (ctx, role) => ({ ...ctx.as(role), 'x-tenant-id': null });

/** SUPERADMIN signed in, naming no tenant. */
const asSuperAdmin = (ctx) => noTenant(ctx, 'SUPERADMIN');

// OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-8, EC-17): the twelve building and level rows
// became the eight map routes.
test('no X-Tenant-Id, every role (SUPERADMIN included): every FF-0, FF-1 and OA-2 route is a clean 400, before any query on its tables', async () => {
  await withVenueApp(async (ctx) => {
    const { call, sql, tenantA, record } = ctx;
    const b = bodies(ctx);
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const log = record();
    for (const role of ADMIN_ROLE_CODES) {
      const headers = noTenant(ctx, role);
      for (const [method, path, body] of [
        ['GET', '/api/lookups/building-types'],
        ['GET', `/api/lookups/building-types/${type}`],
        ['GET', '/api/venues'],
        ['POST', '/api/venues', b.venue()],
        ['GET', `/api/venues/${venue}`],
        ['PUT', `/api/venues/${venue}`, { ...b.venue(), updatedAt: null }],
        ['GET', `/api/venues/${venue}/map`],
        ['PUT', `/api/venues/${venue}/map/draft`, { layout: {}, baseVersion: 0 }],
        ['POST', `/api/venues/${venue}/map/publish`, { baseVersion: 0 }],
        ['POST', `/api/venues/${venue}/map/rollback`, { version: 1, baseVersion: 0 }],
        ['POST', `/api/venues/${venue}/map/clear`, { baseVersion: 0 }],
        ['POST', `/api/venues/${venue}/map/backdrops`],
        ['GET', `/api/venues/${venue}/map/backdrops/${MAP_KEY}`],
        ['GET', '/api/venue-maps/catalog'],
      ]) {
        const res = await call(method, path, { body, headers });
        assertRefused(res, 400, null, `${role} ${method} ${path}`);
        assert.equal(res.body.error, CHOOSE, `${role} ${method} ${path}`);
      }
    }
    const touched = log.filter((s) =>
      /gabay\.(Venue|VenueMap|VenueMapBackdrop|VenueVersion|StoredFile|ObjectType|BuildingType|AmenityType|TransitType)\b/i.test(
        s.text,
      ),
    );
    assert.deepEqual(touched, [], 'no feature table was queried without a tenant');
    ctx.hooks.onStatement = null;
    assert.equal(
      (await sql.one(`SELECT count(*)::int AS n FROM gabay.VenueMap WHERE VenueId = $1`, [venue]))
        .n,
      0,
      'nothing was written',
    );
  });
});

test('SUPERADMIN with X-Tenant-Id: the routes work in that tenant, one the account holds no row in', async () => {
  await withVenueApp(async (ctx) => {
    const { call, sql, tenantC } = ctx;
    const headers = { ...asSuperAdmin(ctx), 'x-tenant-id': String(tenantC.tenantId) };
    const venue = await sql.venue(tenantC.tenantId, { name: 'Of tenant C' });
    const list = await call('GET', '/api/venues', { headers });
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body.items.map((v) => v.id),
      [venue],
    );
    const made = await call('POST', '/api/venues', { body: bodies(ctx).venue(), headers });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const row = await sql.one(`SELECT TenantId, CreatedBy FROM gabay.Venue WHERE VenueId = $1`, [
      made.body.id,
    ]);
    assert.equal(row.tenantid, tenantC.tenantId);
    assert.equal(row.createdby, ctx.users.SUPERADMIN.userId);
    assert.equal((await call('GET', '/api/lookups/building-types', { headers })).status, 200);
    // OA-2: the map load and the catalog work in that tenant too
    const map = await call('GET', `/api/venues/${venue}/map`, { headers });
    assert.equal(map.status, 200, JSON.stringify(map.body));
    assert.equal(map.body.draft, null);
    const catalog = await call('GET', '/api/venue-maps/catalog', { headers });
    assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
    assert.equal(typeof catalog.body.version, 'number');
  });
});

// CHANGED BY SEC-1 (C1): inverted. The stub gave a MALL_ADMIN with no header its first tenant; now no one has a default.
test('a MALL_ADMIN with no X-Tenant-Id gets the same 400: there is no default tenant (AC-3, DC-4)', async () => {
  await withVenueApp(async (ctx) => {
    const res = await ctx.get('/api/venues', noTenant(ctx, 'MALL_ADMIN'));
    assertRefused(res, 400, null);
    assert.equal(res.body.error, CHOOSE);
  });
});
