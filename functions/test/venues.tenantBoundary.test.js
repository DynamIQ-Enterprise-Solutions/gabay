'use strict';

// FF-1 / P0-01, AC-22, AC-37 and the tenant edge cases (plan/FF-1-venue-setup.md section 4; rule 2): with the request tenant
// set to A (the default), the API behaves as if no tenant-B venue exists: lists leave them out and reading, updating or
// opening one by id is a 404 in the { error } shape (never a 403, never a 500 from a composite FK). With X-Tenant-Id set to
// B, the reverse. The rows of the other tenant are never changed.
// The tenant header's own rules are SEC-1's (sec1.tenantContext.test.js); here one call checks an X-Tenant-Id the user does
// not hold is 403. (SEC-1, C1: this comment named the deleted stub; the harness now signs in a MALL_ADMIN of A and B.)
//
// CHANGED BY OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-8, AC-42, EC-11): the building and level
// rows, requests and list checks went with their routes; the seven venue-scoped map routes' cross-tenant cases came in
// (venueMaps.tenancy.test.js holds the full rule-by-rule table for all eight routes).

const test = require('node:test');
const assert = require('node:assert/strict');
const { bodies, assertRefused } = require('./venueApp');
const { withMapApp, mapRoutes, sendRoute, MAP_KEY, OTHER_KEY } = require('./mapApp');

/** One tenant's fixture rows, written in SQL: a venue, its map row, a published version and a backdrop. */
async function rowsOf(ctx, tenant) {
  const { sql } = ctx;
  const t = tenant.tenantId;
  const venue = await sql.venue(t, { name: `Venue of ${tenant.code}` });
  await sql.one(
    `INSERT INTO gabay.VenueMap (TenantId, VenueId, DraftJson, DraftVersion) VALUES ($1, $2, '{"spec":1}'::jsonb, 3) RETURNING 1`,
    [t, venue],
  );
  await sql.published(t, venue, 1, { spec: 1 });
  // BackdropKey is the table's primary key, so each tenant's fixture needs its own key
  await sql.backdrop(t, venue, t === ctx.tenantA.tenantId ? MAP_KEY : OTHER_KEY, { ageH: 1 });
  return { venue };
}

/** A snapshot of every venue and map row of a tenant, to prove that refused requests changed none. */
const snapshotOf = async (sql, tenantId) => ({
  venues: await sql.rows(
    `SELECT to_jsonb(v) AS r FROM gabay.Venue v WHERE TenantId = $1 ORDER BY VenueId`,
    [tenantId],
  ),
  maps: await sql.rows(
    `SELECT to_jsonb(m) AS r FROM gabay.VenueMap m WHERE TenantId = $1 ORDER BY VenueMapId`,
    [tenantId],
  ),
  versions: await sql.rows(
    `SELECT to_jsonb(v) AS r FROM gabay.VenueVersion v WHERE TenantId = $1 ORDER BY VenueVersionId`,
    [tenantId],
  ),
  backdrops: await sql.rows(
    `SELECT to_jsonb(k) AS r FROM gabay.VenueMapBackdrop k WHERE TenantId = $1 ORDER BY BackdropKey`,
    [tenantId],
  ),
  files: await sql.rows(
    `SELECT to_jsonb(f) AS r FROM gabay.StoredFile f WHERE TenantId = $1 ORDER BY FileId`,
    [tenantId],
  ),
});

/** Every route that names a venue id, aimed at a venue of the other tenant. Each must answer 404. */
function attemptsAgainst(ctx, other) {
  const b = bodies(ctx);
  return [
    ['GET venue', 'GET', `/api/venues/${other.venue}`],
    ['PUT venue', 'PUT', `/api/venues/${other.venue}`, { ...b.venue(), updatedAt: null }],
    ['DELETE venue (no route)', 'DELETE', `/api/venues/${other.venue}`],
    ...mapRoutes(other.venue)
      .filter((r) => r.venue !== false)
      .map((r) => [r.name, r]),
  ];
}

async function assertAllNotFound(ctx, headers, other, otherTenantId, label) {
  const before = await snapshotOf(ctx.sql, otherTenantId);
  const filesBefore = ctx.fileStore.keys();
  for (const [name, methodOrRoute, path, body] of attemptsAgainst(ctx, other)) {
    const res =
      typeof methodOrRoute === 'string'
        ? await ctx.call(methodOrRoute, path, { body, headers })
        : await sendRoute(ctx, methodOrRoute, headers);
    assertRefused(res, 404, null, `${label}: ${name}`);
  }
  assert.deepEqual(
    await snapshotOf(ctx.sql, otherTenantId),
    before,
    `${label}: a refused request changed a row`,
  );
  assert.deepEqual(ctx.fileStore.keys(), filesBefore, `${label}: a refused request wrote a file`);
}

test('tenant boundary: as the default tenant A, every read, edit and map route of a tenant B venue is a 404 and changes nothing (AC-22, AC-8)', async () => {
  await withMapApp(async (ctx) => {
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    await assertAllNotFound(ctx, {}, b, ctx.tenantB.tenantId, 'A acting');
    // A's own rows are still reachable
    assert.equal((await ctx.get(`/api/venues/${a.venue}`)).status, 200);
    assert.equal((await ctx.get(`/api/venues/${a.venue}/map`)).status, 200);
  });
});

test('tenant boundary: with X-Tenant-Id set to B the reverse holds: tenant A venues are a 404 and unchanged (AC-22, AC-37, AC-8)', async () => {
  await withMapApp(async (ctx) => {
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    await assertAllNotFound(ctx, ctx.asB, a, ctx.tenantA.tenantId, 'B acting');
    assert.equal((await ctx.get(`/api/venues/${b.venue}`, ctx.asB)).status, 200);
    assert.equal((await ctx.get(`/api/venues/${b.venue}/map`, ctx.asB)).status, 200);
  });
});

test('tenant boundary: the lists show only the rows of the acting tenant, and the switch changes them (AC-22, AC-37)', async () => {
  await withMapApp(async (ctx) => {
    const { get, asB } = ctx;
    const a = await rowsOf(ctx, ctx.tenantA);
    const b = await rowsOf(ctx, ctx.tenantB);
    const ids = (res) => res.body.items.map((i) => i.id);

    assert.deepEqual(ids(await get('/api/venues')), [a.venue]);
    assert.deepEqual(ids(await get('/api/venues', asB)), [b.venue]);

    // a search never reaches across: B's venue name is not found as A
    const found = await get(`/api/venues?search=${encodeURIComponent(ctx.tenantB.code)}`);
    assert.deepEqual(found.body.items, []);
    assert.equal(found.body.totalCount, 0);
  });
});

test('tenant boundary: a body that names another tenant is a 400 and writes nothing; one that names the request tenant is ignored (rule 2)', async () => {
  await withMapApp(async (ctx) => {
    const { post, sql, tenantA, tenantB } = ctx;
    await rowsOf(ctx, tenantA);
    const before = await snapshotOf(sql, tenantA.tenantId);
    assertRefused(
      await post('/api/venues', { ...bodies(ctx).venue(), tenantId: tenantB.tenantId }),
      400,
      null,
    );
    assert.deepEqual(await snapshotOf(sql, tenantA.tenantId), before);
    const same = await post('/api/venues', { ...bodies(ctx).venue(), tenantId: tenantA.tenantId });
    assert.equal(same.status, 201);
  });
});

test('tenant boundary: an X-Tenant-Id the acting user does not hold is a 403 and nothing is read (edge)', async () => {
  await withMapApp(async (ctx) => {
    const { get, asC, tenantC, sql } = ctx;
    await sql.venue(tenantC.tenantId);
    const res = await get('/api/venues', asC);
    assert.equal(res.status, 403);
    assert.equal(typeof res.body.error, 'string');
    assert.deepEqual(Object.keys(res.body), ['error']);
  });
});
