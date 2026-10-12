'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.4 "Boundary", B2, DC-9, G4; AC-34): venueBoundary.js keeps a venue's boundary a
// rectangle from (0,0) to (the largest WidthM, the largest DepthM) among the venue's levels, the outdoor ground level
// included, and the zero-size rectangle when it has none (the degenerate case). Refreshing it never touches UpdatedAt
// (DC-9) and never touches another venue or another tenant's. Exercised directly, over real rows in the rolled-back
// transaction; levels.test.js and venues.test.js cover the same rule through the routes.

const test = require('node:test');
const assert = require('node:assert/strict');
const { ZERO_BOUNDARY, refreshBoundary } = require('../src/services/venueBoundary');
const { withVenueApp, rectangle } = require('./venueApp');

const ZERO = rectangle(0, 0);

/** The stored boundary and UpdatedAt of a venue. */
const stored = async (sql, venueId) => {
  const row = await sql.one(
    `SELECT BoundaryGeoJson AS boundary, UpdatedAt AS updatedat FROM gabay.Venue WHERE VenueId = $1`,
    [venueId],
  );
  return { boundary: row.boundary, updatedAt: row.updatedat };
};

/** A venue, one building and a way to add levels to it. */
async function fixture({ sql, tenantA }) {
  const type = await sql.buildingType(tenantA.tenantId);
  const venue = await sql.venue(tenantA.tenantId);
  const building = await sql.building(tenantA.tenantId, venue, type);
  return { type, venue, building };
}

test('venueBoundary: ZERO_BOUNDARY is the five-point zero-size rectangle (a ring, or the polygon holding it)', () => {
  const ring = Array.isArray(ZERO_BOUNDARY) ? ZERO_BOUNDARY : ZERO_BOUNDARY.coordinates[0];
  assert.deepEqual(ring, [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
});

test('venueBoundary: a venue with no level gets the zero-size rectangle', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue } = await fixture(ctx);
    await sql.one(
      `UPDATE gabay.Venue SET BoundaryGeoJson = $2::jsonb WHERE VenueId = $1 RETURNING 1`,
      [venue, JSON.stringify(rectangle(9, 9))],
    );
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, ZERO);
  });
});

test('venueBoundary: the rectangle runs to the largest width and the largest depth, which may be on different levels', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building } = await fixture(ctx);
    await sql.level(tenantA.tenantId, venue, building, { ordinal: 0, width: '40', depth: '90' });
    await sql.level(tenantA.tenantId, venue, building, { ordinal: 1, width: '120.5', depth: '10' });
    await sql.level(tenantA.tenantId, venue, building, { ordinal: -1, width: '60', depth: '30' });
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(120.5, 90));
  });
});

test('venueBoundary: the outdoor ground level counts, and a building in another venue does not', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building, type } = await fixture(ctx);
    const other = await sql.venue(tenantA.tenantId);
    const otherBuilding = await sql.building(tenantA.tenantId, other, type);
    await sql.level(tenantA.tenantId, venue, building, { width: '40', depth: '25' });
    await sql.level(tenantA.tenantId, venue, null, { width: '200', depth: '150' }); // outdoor ground
    await sql.level(tenantA.tenantId, other, otherBuilding, { width: '999', depth: '999' });
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(200, 150));
    assert.deepEqual((await stored(sql, other)).boundary, ZERO, 'the other venue is not touched');
  });
});

test('venueBoundary: decimal extremes are exact, not rounded (999999.999 and 0.001)', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building } = await fixture(ctx);
    await sql.level(tenantA.tenantId, venue, building, {
      ordinal: 0,
      width: '999999.999',
      depth: '0.001',
    });
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(999999.999, 0.001));
  });
});

test('venueBoundary: it follows deletes, back to zero-size when the last level goes (the degenerate case, G4)', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building } = await fixture(ctx);
    const big = await sql.level(tenantA.tenantId, venue, building, {
      ordinal: 0,
      width: '80',
      depth: '60',
    });
    const small = await sql.level(tenantA.tenantId, venue, building, {
      ordinal: 1,
      width: '20',
      depth: '10',
    });
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(80, 60));
    await sql.one(`DELETE FROM gabay.Level WHERE LevelId = $1 RETURNING 1`, [big]);
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(20, 10));
    await sql.one(`DELETE FROM gabay.Level WHERE LevelId = $1 RETURNING 1`, [small]);
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, ZERO);
  });
});

test('venueBoundary: the polygon is closed and GeoJSON-shaped', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building } = await fixture(ctx);
    await sql.level(tenantA.tenantId, venue, building, { width: '12', depth: '7' });
    await refreshBoundary(db, tenantA.tenantId, venue);
    const { boundary } = await stored(sql, venue);
    assert.equal(boundary.type, 'Polygon');
    assert.equal(boundary.coordinates.length, 1);
    const ring = boundary.coordinates[0];
    assert.equal(ring.length, 5);
    assert.deepEqual(ring[0], ring[4], 'closed');
    assert.deepEqual(ring, [
      [0, 0],
      [12, 0],
      [12, 7],
      [0, 7],
      [0, 0],
    ]);
  });
});

test('venueBoundary: it leaves UpdatedAt alone, null or set (DC-9, so an open venue form is not made stale)', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, db } = ctx;
    const { venue, building } = await fixture(ctx);
    await sql.level(tenantA.tenantId, venue, building, { width: '12', depth: '7' });
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.equal((await stored(sql, venue)).updatedAt, null);
    await sql.one(
      `UPDATE gabay.Venue SET UpdatedAt = '2026-01-02T03:04:05.678Z' WHERE VenueId = $1 RETURNING 1`,
      [venue],
    );
    await sql.level(tenantA.tenantId, venue, building, { ordinal: 5, width: '50', depth: '50' });
    await refreshBoundary(db, tenantA.tenantId, venue);
    const after = await stored(sql, venue);
    assert.deepEqual(after.boundary, rectangle(50, 50));
    assert.equal(after.updatedAt.toISOString(), '2026-01-02T03:04:05.678Z');
  });
});

test('venueBoundary: it binds the tenant, so a venue id of another tenant changes nothing', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, tenantB, db } = ctx;
    const { venue, building } = await fixture(ctx);
    await sql.level(tenantA.tenantId, venue, building, { width: '12', depth: '7' });
    await refreshBoundary(db, tenantB.tenantId, venue); // the wrong tenant for this venue
    assert.deepEqual((await stored(sql, venue)).boundary, ZERO);
    await refreshBoundary(db, tenantA.tenantId, venue);
    assert.deepEqual((await stored(sql, venue)).boundary, rectangle(12, 7));
  });
});
