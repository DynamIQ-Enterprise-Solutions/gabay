'use strict';

// OA-2 / spec/OA-2.md r1 AC-42, EC-39 (plan/OA-2-map-storage.md 1.0 section 8; DC-1): FF-1's twelve building and level routes are
// retired. Each answers the API's ordinary 404 { error: "Not found" }, with real ids of rows that still exist (the Building and
// Level tables stay until OA-3, seed-only), and no request writes or changes one: the draft is the only geometry an admin can edit.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp } = require('./venueApp');

test('AC-42, EC-39: every one of the twelve retired routes is a 404 { error: "Not found" }, and no Building or Level row is read through them or changed', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    const level = await sql.level(tenantA.tenantId, venue, building, { ordinal: 1 });
    const outdoor = await sql.level(tenantA.tenantId, venue, null, { ordinal: 0 });
    const snapshot = async () => ({
      buildings: await sql.rows(
        `SELECT to_jsonb(b) AS r FROM gabay.Building b WHERE VenueId = $1 ORDER BY BuildingId`,
        [venue],
      ),
      levels: await sql.rows(
        `SELECT to_jsonb(l) AS r FROM gabay.Level l WHERE VenueId = $1 ORDER BY LevelId`,
        [venue],
      ),
    });
    const before = await snapshot();
    assert.equal(before.buildings.length, 1);
    assert.equal(before.levels.length, 2);

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

test('AC-42: the retired source files are gone (routers, services, the boundary refresh and foreignKeyInUse)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = path.join(__dirname, '..', 'src');
  for (const gone of [
    'routes/buildings.js',
    'routes/levels.js',
    'services/building.service.js',
    'services/level.service.js',
    'utils/foreignKeyInUse.js',
  ]) {
    assert.equal(fs.existsSync(path.join(src, gone)), false, `${gone} is deleted`);
  }
  const boundary = fs.readFileSync(path.join(src, 'services', 'venueBoundary.js'), 'utf8');
  assert.doesNotMatch(boundary, /refreshBoundary/, 'refreshBoundary retired with its callers');
  assert.match(boundary, /ZERO_BOUNDARY/, 'ZERO_BOUNDARY stays for venue creation until OA-3');
});
