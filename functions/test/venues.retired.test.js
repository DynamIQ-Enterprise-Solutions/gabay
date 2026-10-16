'use strict';

// OA-2 / spec/OA-2.md r1 AC-42, EC-39 (plan/OA-2-map-storage.md 1.0 section 8; DC-1): FF-1's twelve building and level routes are
// retired. Each answers the API's ordinary 404 { error: "Not found" }, with real ids of rows that still exist (the Building and
// Level tables stay until OA-3, seed-only), and no request writes or changes one: the draft is the only geometry an admin can edit.
//
// CHANGED BY OA-3a (plan/OA-3a-migration-rekey.md 1.1 section 4; spec/OA-3.md AC-1, AC-8): schema 0.17 has no Building or
// Level table, so the routes are called with ids that name nothing, and "nothing changed" reads the venue's keyed rows
// (Occupant, Beacon, StoreStatusChange); venueBoundary.js is deleted with the boundary column.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp } = require('./venueApp');

test('AC-42, EC-39: every one of the twelve retired routes is a 404 { error: "Not found" }, and none of the venue\'s keyed rows is read through them or changed', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    await sql.store(tenantA.tenantId, venue, 'U1');
    await sql.statusChange(tenantA.tenantId, venue, 'U2');
    await sql.beacon(tenantA.tenantId, venue, 'L1');
    const building = 1;
    const level = 2;
    const outdoor = 3;
    const snapshot = async () => ({
      stores: await sql.rows(
        `SELECT to_jsonb(o) AS r FROM gabay.Occupant o WHERE VenueId = $1 ORDER BY OccupantId`,
        [venue],
      ),
      beacons: await sql.rows(
        `SELECT to_jsonb(b) AS r FROM gabay.Beacon b WHERE VenueId = $1 ORDER BY BeaconId`,
        [venue],
      ),
      changes: await sql.rows(
        `SELECT to_jsonb(s) AS r FROM gabay.StoreStatusChange s WHERE VenueId = $1 ORDER BY StoreStatusChangeId`,
        [venue],
      ),
    });
    const before = await snapshot();
    assert.equal(before.stores.length, 2);
    assert.equal(before.beacons.length, 1);
    assert.equal(before.changes.length, 1);

    const body = {
      name: 'x',
      buildingTypeId: type,
      ordinal: 5,
      shortName: 'X',
      widthM: '10',
      depthM: '10',
      updatedAt: null,
    };
    const routes = [
      ['GET', `/api/venues/${venue}/buildings`],
      ['POST', `/api/venues/${venue}/buildings`],
      ['GET', `/api/venues/${venue}/outdoor-levels`],
      ['POST', `/api/venues/${venue}/outdoor-levels`],
      ['GET', `/api/buildings/${building}`],
      ['PUT', `/api/buildings/${building}`],
      ['DELETE', `/api/buildings/${building}`],
      ['GET', `/api/buildings/${building}/levels`],
      ['POST', `/api/buildings/${building}/levels`],
      ['GET', `/api/levels/${level}`],
      ['PUT', `/api/levels/${level}`],
      ['DELETE', `/api/levels/${level}`],
    ];
    assert.equal(routes.length, 12);
    for (const [method, path] of routes) {
      const res = await ctx.call(method, path, {
        body: method === 'GET' || method === 'DELETE' ? undefined : body,
      });
      assert.equal(res.status, 404, `${method} ${path}: ${JSON.stringify(res.body)}`);
      assert.deepEqual(res.body, { error: 'Not found' }, `${method} ${path}`);
    }
    // the outdoor ground level's id too
    assert.equal((await ctx.get(`/api/levels/${outdoor}`)).status, 404);
    assert.equal((await ctx.del(`/api/levels/${outdoor}`)).status, 404);
    assert.deepEqual(await snapshot(), before, 'no row was written, edited or deleted');
  });
});

test('AC-42: the venue routes are still there (the retirement is of the building and level routes only)', async () => {
  await withVenueApp(async (ctx) => {
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId);
    assert.equal((await ctx.get('/api/venues')).status, 200);
    assert.equal((await ctx.get(`/api/venues/${venue}`)).status, 200);
  });
});

test('AC-42, OA-3 AC-8: the retired source files are gone (routers, services, the boundary module and foreignKeyInUse)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = path.join(__dirname, '..', 'src');
  for (const gone of [
    'routes/buildings.js',
    'routes/levels.js',
    'services/building.service.js',
    'services/level.service.js',
    'utils/foreignKeyInUse.js',
    'services/venueBoundary.js', // OA-3 AC-8: ZERO_BOUNDARY retired with Venue.BoundaryGeoJson
  ]) {
    assert.equal(fs.existsSync(path.join(src, gone)), false, `${gone} is deleted`);
  }
});
