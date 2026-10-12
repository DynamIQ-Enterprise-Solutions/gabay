'use strict';

// FF-SK, the owner's ruling for this slice: a SUPERADMIN acts with NO tenant when no X-Tenant-Id is sent
// (req.tenantCompanyID null). Every route that works inside a tenant (FF-0's lookups, FF-1's venues, buildings and
// levels) must then refuse cleanly with 400 "Choose a tenant: this works inside one tenant", in the { error } shape,
// before any query on its tables: never a 500, never a write. With X-Tenant-Id the SUPERADMIN acts in that tenant,
// any existing one (the superuser override), and the routes work as for any admin there.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

const CHOOSE = 'Choose a tenant: this works inside one tenant';

async function asSuperAdmin(ctx) {
  const { seed } = ctx;
  const role = await seed.role('SUPERADMIN', { isPlatformRole: true });
  const root = await seed.user({ name: 'Root' });
  await seed.userRole(root.userId, role, null);
  return { 'x-dev-act-as': root.email };
}

test('SUPERADMIN with no tenant: every FF-0 and FF-1 route is a clean 400, before any query on its tables', async () => {
  await withVenueApp(async (ctx) => {
    const { call, sql, tenantA, record } = ctx;
    const headers = await asSuperAdmin(ctx);
    const b = bodies(ctx);
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    const level = await sql.level(tenantA.tenantId, venue, building, { ordinal: 1 });
    const log = record();
    for (const [method, path, body] of [
      ['GET', '/api/lookups/building-types'],
      ['GET', `/api/lookups/building-types/${type}`],
      ['GET', '/api/venues'],
      ['POST', '/api/venues', b.venue()],
      ['GET', `/api/venues/${venue}`],
      ['PUT', `/api/venues/${venue}`, { ...b.venue(), updatedAt: null }],
      ['GET', `/api/venues/${venue}/buildings`],
      ['POST', `/api/venues/${venue}/buildings`, b.building(type)],
      ['GET', `/api/venues/${venue}/outdoor-levels`],
      ['POST', `/api/venues/${venue}/outdoor-levels`, b.outdoor()],
      ['GET', `/api/buildings/${building}`],
      ['PUT', `/api/buildings/${building}`, { ...b.building(type), updatedAt: null }],
      ['DELETE', `/api/buildings/${building}`],
      ['GET', `/api/buildings/${building}/levels`],
      ['POST', `/api/buildings/${building}/levels`, b.level()],
      ['GET', `/api/levels/${level}`],
      ['PUT', `/api/levels/${level}`, { ...b.level({ ordinal: 1 }), updatedAt: null }],
      ['DELETE', `/api/levels/${level}`],
    ]) {
      const res = await call(method, path, { body, headers });
      assertRefused(res, 400, null, `${method} ${path}`);
      assert.equal(res.body.error, CHOOSE, `${method} ${path}`);
    }
    const touched = log.filter((s) =>
      /gabay\.(Venue|Building|Level|BuildingType|AmenityType|TransitType)\b/i.test(s.text),
    );
    assert.deepEqual(touched, [], 'no feature table was queried without a tenant');
    ctx.hooks.onStatement = null;
    assert.equal((await ctx.get(`/api/buildings/${building}`)).status, 200, 'nothing was deleted');
    assert.equal((await ctx.get(`/api/levels/${level}`)).status, 200);
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
  });
});

test('a MALL_ADMIN with no X-Tenant-Id still gets its first tenant: the tenant check refuses only a missing tenant', async () => {
  await withVenueApp(async (ctx) => {
    const res = await ctx.get('/api/venues');
    assert.equal(res.status, 200);
  });
});
