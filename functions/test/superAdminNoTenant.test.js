'use strict';

// FF-SK, the owner's ruling for this slice: a SUPERADMIN acts with NO tenant when no X-Tenant-Id is sent
// (req.tenantCompanyID null). Every route that works inside a tenant (FF-0's lookups, FF-1's venues, buildings and
// levels; OA-2's eight map routes) must then refuse cleanly with 400 "Choose a tenant: this works inside one tenant", in the { error } shape,
// before any query on its tables: never a 500, never a write. With X-Tenant-Id the SUPERADMIN acts in that tenant,
// any existing one (the superuser override), and the routes work as for any admin there.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');
const { MAP_KEY } = require('./mapApp');

const CHOOSE = 'Choose a tenant: this works inside one tenant';

async function asSuperAdmin(ctx) {
  const { seed } = ctx;
  const role = await seed.role('SUPERADMIN', { isPlatformRole: true });
  const root = await seed.user({ name: 'Root' });
  await seed.userRole(root.userId, role, null);
  return { 'x-dev-act-as': root.email };
}

// OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-8, EC-17): the twelve building and level rows
// became the eight map routes.
test('SUPERADMIN with no tenant: every FF-0, FF-1 and OA-2 route is a clean 400, before any query on its tables', async () => {
  await withVenueApp(async (ctx) => {
    const { call, sql, tenantA, record } = ctx;
    const headers = await asSuperAdmin(ctx);
    const b = bodies(ctx);
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const log = record();
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
      assertRefused(res, 400, null, `${method} ${path}`);
      assert.equal(res.body.error, CHOOSE, `${method} ${path}`);
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
    const headers = { ...(await asSuperAdmin(ctx)), 'x-tenant-id': String(tenantC.tenantId) };
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

test('a MALL_ADMIN with no X-Tenant-Id still gets its first tenant: the tenant check refuses only a missing tenant', async () => {
  await withVenueApp(async (ctx) => {
    const res = await ctx.get('/api/venues');
    assert.equal(res.status, 200);
  });
});
