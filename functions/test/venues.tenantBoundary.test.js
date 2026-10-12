'use strict';

// FF-1 / P0-01, AC-22, AC-37 and the tenant edge cases (plan/FF-1-venue-setup.md section 4; rule 2): with the request tenant
// set to A (the default), the API behaves as if no tenant-B venue, building or level exists: lists leave them out and
// reading, updating, deleting or creating under one by id is a 404 in the { error } shape (never a 403, never a 500 from a
// composite FK). With X-Tenant-Id set to B, the reverse. The rows of the other tenant are never changed.
// The stub's own header rules are FF-0's (devStub.test.js); here one call checks an X-Tenant-Id the user does not hold is 403.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

/** One tenant's fixture rows, written in SQL: a type, a venue, a building, a level and the outdoor ground level. */
async function rowsOf(ctx, tenant) {
  const { sql } = ctx;
  const t = tenant.tenantId;
  const type = await sql.buildingType(t);
  const venue = await sql.venue(t, { name: `Venue of ${tenant.code}` });
  const building = await sql.building(t, venue, type, { name: `Building of ${tenant.code}` });
  const level = await sql.level(t, venue, building, { ordinal: 1, name: 'Upper', shortName: 'U1' });
  const outdoor = await sql.level(t, venue, null, { ordinal: 0, name: 'Yard', shortName: 'YD' });
  return { type, venue, building, level, outdoor };
}

/** A snapshot of every FF-1 row of a tenant, to prove that refused requests changed none. */
const snapshotOf = async (sql, tenantId) => ({
  venues: await sql.rows(
    `SELECT to_jsonb(v) AS r FROM gabay.Venue v WHERE TenantId = $1 ORDER BY VenueId`,
    [tenantId],
  ),
  buildings: await sql.rows(
    `SELECT to_jsonb(b) AS r FROM gabay.Building b WHERE TenantId = $1 ORDER BY BuildingId`,
    [tenantId],
  ),
  levels: await sql.rows(
    `SELECT to_jsonb(l) AS r FROM gabay.Level l WHERE TenantId = $1 ORDER BY LevelId`,
    [tenantId],
  ),
});

/** Every FF-1 route that names an id, aimed at rows of the other tenant. Each must answer 404. */
function attemptsAgainst(ctx, other) {
  const b = bodies(ctx);
  return [
    ['GET venue', 'GET', `/api/venues/${other.venue}`],
    ['PUT venue', 'PUT', `/api/venues/${other.venue}`, { ...b.venue(), updatedAt: null }],
    ['DELETE venue (no route)', 'DELETE', `/api/venues/${other.venue}`],
    ['GET buildings of venue', 'GET', `/api/venues/${other.venue}/buildings`],
    [
      'POST building under venue',
      'POST',
      `/api/venues/${other.venue}/buildings`,
      b.building(other.type),
    ],
    ['GET outdoor levels of venue', 'GET', `/api/venues/${other.venue}/outdoor-levels`],
    [
      'POST outdoor level under venue',
      'POST',
      `/api/venues/${other.venue}/outdoor-levels`,
      b.outdoor(),
    ],
    ['GET building', 'GET', `/api/buildings/${other.building}`],
    [
      'PUT building',
      'PUT',
      `/api/buildings/${other.building}`,
      { ...b.building(other.type), updatedAt: null },
    ],
    ['DELETE building', 'DELETE', `/api/buildings/${other.building}`],
    ['GET levels of building', 'GET', `/api/buildings/${other.building}/levels`],
    ['POST level under building', 'POST', `/api/buildings/${other.building}/levels`, b.level()],
    ['GET level', 'GET', `/api/levels/${other.level}`],
    [
      'PUT level',
      'PUT',
      `/api/levels/${other.level}`,
      { ...b.level({ ordinal: 1 }), updatedAt: null },
    ],
    ['DELETE level', 'DELETE', `/api/levels/${other.level}`],
    ['GET outdoor level', 'GET', `/api/levels/${other.outdoor}`],
    [
      'PUT outdoor level',
      'PUT',
      `/api/levels/${other.outdoor}`,
      { ...b.outdoor(), updatedAt: null },
    ],
    ['DELETE outdoor level', 'DELETE', `/api/levels/${other.outdoor}`],
  ];
}

async function assertAllNotFound(ctx, headers, other, otherTenantId, label) {
  const before = await snapshotOf(ctx.sql, otherTenantId);
  for (const [name, method, path, body] of attemptsAgainst(ctx, other)) {
    const res = await ctx.call(method, path, { body, headers });
    assertRefused(res, 404, null, `${label}: ${name}`);
  }
  assert.deepEqual(
    await snapshotOf(ctx.sql, otherTenantId),
    before,
    `${label}: a refused request changed a row`,
  );
}

test('tenant boundary: as the default tenant A, every read, edit, delete and create-under of tenant B rows is a 404 and changes nothing (AC-22)', async () => {
  await withVenueApp(async (ctx) => {
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    await assertAllNotFound(ctx, {}, b, ctx.tenantB.tenantId, 'A acting');
    // A's own rows are still reachable
    assert.equal((await ctx.get(`/api/venues/${a.venue}`)).status, 200);
    assert.equal((await ctx.get(`/api/buildings/${a.building}`)).status, 200);
    assert.equal((await ctx.get(`/api/levels/${a.level}`)).status, 200);
  });
});

test('tenant boundary: with X-Tenant-Id set to B the reverse holds: tenant A rows are a 404 and unchanged (AC-22, AC-37)', async () => {
  await withVenueApp(async (ctx) => {
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    await assertAllNotFound(ctx, ctx.asB, a, ctx.tenantA.tenantId, 'B acting');
    assert.equal((await ctx.get(`/api/venues/${b.venue}`, ctx.asB)).status, 200);
    assert.equal((await ctx.get(`/api/buildings/${b.building}`, ctx.asB)).status, 200);
    assert.equal((await ctx.get(`/api/levels/${b.level}`, ctx.asB)).status, 200);
  });
});

test('tenant boundary: the lists show only the rows of the acting tenant, and the switch changes them (AC-22, AC-37)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, asB } = ctx;
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    const ids = (res) => res.body.items.map((i) => i.id);

    assert.deepEqual(ids(await get('/api/venues')), [a.venue]);
    assert.deepEqual(ids(await get('/api/venues', asB)), [b.venue]);
    assert.deepEqual(ids(await get(`/api/venues/${a.venue}/buildings`)), [a.building]);
    assert.deepEqual(ids(await get(`/api/venues/${b.venue}/buildings`, asB)), [b.building]);
    assert.deepEqual(ids(await get(`/api/buildings/${a.building}/levels`)), [a.level]);
    assert.deepEqual(ids(await get(`/api/buildings/${b.building}/levels`, asB)), [b.level]);
    assert.deepEqual(ids(await get(`/api/venues/${a.venue}/outdoor-levels`)), [a.outdoor]);
    assert.deepEqual(ids(await get(`/api/venues/${b.venue}/outdoor-levels`, asB)), [b.outdoor]);

    // a search never reaches across: B's venue name is not found as A
    const found = await get(`/api/venues?search=${encodeURIComponent(ctx.tenantB.code)}`);
    assert.deepEqual(found.body.items, []);
    assert.equal(found.body.totalCount, 0);
  });
});

test('tenant boundary: a body that names another tenant is a 400 and writes nothing; one that names the request tenant is ignored (rule 2)', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA, tenantB } = ctx;
    const a = await rowsOf(ctx, tenantA);
    const before = await snapshotOf(sql, tenantA.tenantId);
    assertRefused(
      await post('/api/venues', { ...bodies(ctx).venue(), tenantId: tenantB.tenantId }),
      400,
      null,
    );
    assertRefused(
      await post(`/api/venues/${a.venue}/buildings`, {
        ...bodies(ctx).building(a.type),
        tenantId: tenantB.tenantId,
      }),
      400,
      null,
    );
    assertRefused(
      await post(`/api/buildings/${a.building}/levels`, {
        ...bodies(ctx).level(),
        tenantId: tenantB.tenantId,
      }),
      400,
      null,
    );
    assert.deepEqual(await snapshotOf(sql, tenantA.tenantId), before);
    const same = await post('/api/venues', { ...bodies(ctx).venue(), tenantId: tenantA.tenantId });
    assert.equal(same.status, 201);
  });
});

test('tenant boundary: an X-Tenant-Id the acting user does not hold is a 403 and nothing is read (edge)', async () => {
  await withVenueApp(async (ctx) => {
    const { get, asC, tenantC, sql } = ctx;
    await sql.venue(tenantC.tenantId);
    const res = await get('/api/venues', asC);
    assert.equal(res.status, 403);
    assert.equal(typeof res.body.error, 'string');
    assert.deepEqual(Object.keys(res.body), ['error']);
  });
});
