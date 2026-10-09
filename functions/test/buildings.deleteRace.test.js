'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 4, "a building delete versus a level create"; spec edge: concurrent edits; G4):
// the race is STAGED deterministically, with no timing and no concurrent request (savepointDb.js hooks). A statement hook
// runs raw SQL on the same connection right after the service's own check, which is exactly the state a second admin
// would have created in the gap:
//   1. a level inserted between the delete's "has levels?" pre-check and its DELETE: the FK stops the delete, and the
//      service answers 409 "still has levels" (never a 500), and the building stays;
//   2. a building deleted between a level create's first read of it and its lock: the create re-reads the building after
//      the lock and answers 404 (never a 500 from the composite FK).
// The race writes happen inside the service's own savepoint, so a failed request rolls them back with it; the tests
// assert the HTTP answer and the rows that remain.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

const isSelectFrom = (text, table) =>
  /^\s*SELECT\b/i.test(text) && new RegExp(`\\bFROM\\s+gabay\\.${table}\\b`, 'i').test(text);

test('delete race: a level that gets in after the "has levels" check makes the DELETE a 409, and the building stays', async () => {
  await withVenueApp(async (ctx) => {
    const { get, del, sql, tenantA, hooks } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    assert.equal((await get(`/api/buildings/${building}/levels`)).body.totalCount, 0);

    let raced = 0;
    hooks.afterStatement = async (text, params, result, run) => {
      if (raced === 0 && isSelectFrom(text, 'Level') && result.rows.length === 0) {
        raced += 1; // the pre-check just found no level: now one gets in
        await run(
          `INSERT INTO gabay.Level (TenantId, VenueId, BuildingId, Ordinal, Name, ShortName, IsOutdoor, WidthM, DepthM)
           VALUES ($1, $2, $3, 0, 'Raced', 'R', FALSE, 10, 10)`,
          [tenantA.tenantId, venue, building],
        );
      }
    };
    const res = await del(`/api/buildings/${building}`);
    hooks.afterStatement = null;

    assert.equal(raced, 1, 'the delete must check for levels first: the staged race never fired');
    assertRefused(res, 409, /levels/i);
    assert.equal(res.body.error, 'This building still has levels. Delete them first');
    assert.equal((await get(`/api/buildings/${building}`)).status, 200, 'the building stays');
  });
});

test('delete race: a building deleted after a level create read it is a 404 for the create, and no level is written', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA, hooks } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);

    let raced = 0;
    hooks.afterStatement = async (text, params, result, run) => {
      if (raced === 0 && isSelectFrom(text, 'Building') && result.rows.length === 1) {
        raced += 1; // the create just found the building: another admin deletes it now
        await run(`DELETE FROM gabay.Building WHERE TenantId = $1 AND BuildingId = $2`, [
          tenantA.tenantId,
          building,
        ]);
      }
    };
    const res = await post(`/api/buildings/${building}/levels`, bodies(ctx).level({ ordinal: 1 }));
    hooks.afterStatement = null;

    assert.equal(raced, 1, 'the create must read its building first: the staged race never fired');
    assertRefused(res, 404, null, 'a create under a building deleted in the gap');
    const levels = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Level WHERE VenueId = $1`, [
      venue,
    ]);
    assert.equal(levels.n, '0', 'no level was written under a building that is gone');
  });
});
