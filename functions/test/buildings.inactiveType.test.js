'use strict';

// FF-1 / P0-01, AC-9 and AC-10 (definition-of-done item 15, L155, B10; plan/FF-1-venue-setup.md section 5): the end-to-end
// inactive-lookup test. It goes through the real createApp (the E-20 stub, the routes, the services) and the real local
// tables, inside openSavepointDb(): the deactivation is SQL, because the lookup screen is R11, and everything rolls back.
//
// Item 15: building B uses type T; T is deactivated; B must still open with T shown, save a rename with T kept, and
// never offer T again for a new choice. AC-10: the server refuses a NEW reference to an inactive type (create, or a
// change to it) and accepts an unchanged one.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

const NO_LONGER_IN_USE = 'That building type is no longer in use. Choose another';

const deactivate = (sql, typeId) =>
  sql.one(`UPDATE gabay.BuildingType SET IsActive = FALSE WHERE BuildingTypeId = $1 RETURNING 1`, [
    typeId,
  ]);

/** The item-15 steps 1 to 7, for a tenant-owned or a platform type T. Returns what the negative halves need. */
async function itemFifteen(ctx, { platform }) {
  const { get, post, put, sql, tenantA, tag } = ctx;
  const label = `${platform ? 'Platform' : 'Own'} type ${tag}`;
  // 1. a tenant, the stub user (both in withVenueApp), venue V, an active type T, and B created with T
  const venue = await sql.venue(tenantA.tenantId);
  const T = await sql.buildingType(platform ? null : tenantA.tenantId, { label });
  const created = await post(
    `/api/venues/${venue}/buildings`,
    bodies(ctx).building(T, { name: 'Before' }),
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const B = created.body.id;
  assert.equal(created.body.buildingTypeIsActive, true);

  // 2. T is deactivated in SQL
  await deactivate(sql, T);

  // 3. B still shows T, its label, inactive; the lookup serves T by id for the picker's currentOption
  const opened = await get(`/api/buildings/${B}`);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.buildingTypeId, T);
  assert.equal(opened.body.buildingTypeLabel, label);
  assert.equal(opened.body.buildingTypeIsActive, false);
  const option = await get(`/api/lookups/building-types/${T}`);
  assert.equal(option.status, 200);
  assert.equal(option.body.id, T);
  assert.equal(option.body.label, label);
  assert.equal(option.body.isActive, false);

  // 4. a rename that sends T and the loaded updatedAt succeeds
  const renamed = await put(`/api/buildings/${B}`, {
    name: 'After',
    buildingTypeId: T,
    mapUpDeg: opened.body.mapUpDeg,
    updatedAt: opened.body.updatedAt,
  });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.name, 'After');

  // 5. in the database B still has T
  const row = await sql.one(
    `SELECT BuildingTypeId FROM gabay.Building WHERE TenantId = $1 AND BuildingId = $2`,
    [tenantA.tenantId, B],
  );
  assert.equal(row.buildingtypeid, T);

  // 6. reopening shows T again, inactive
  const reopened = await get(`/api/buildings/${B}`);
  assert.equal(reopened.body.name, 'After');
  assert.equal(reopened.body.buildingTypeId, T);
  assert.equal(reopened.body.buildingTypeLabel, label);
  assert.equal(reopened.body.buildingTypeIsActive, false);
  // the list says the same
  const listed = (await get(`/api/venues/${venue}/buildings`)).body.items.find((i) => i.id === B);
  assert.equal(listed.buildingTypeId, T);
  assert.equal(listed.buildingTypeIsActive, false);

  // 7. the picker's list does not offer T
  const offered = await get(`/api/lookups/building-types?search=${encodeURIComponent(label)}`);
  assert.equal(offered.status, 200);
  assert.ok(!offered.body.items.some((i) => i.id === T), 'an inactive type is not offered');
  return { venue, T, B, label };
}

test('item 15 (AC-9): an inactive tenant type stays on its building, a rename keeps it, and the picker never offers it', async () => {
  await withVenueApp(async (ctx) => {
    await itemFifteen(ctx, { platform: false });
  });
});

test('item 15 (AC-9): the same holds for an inactive platform type (TenantId NULL, the global-lookup trap)', async () => {
  await withVenueApp(async (ctx) => {
    await itemFifteen(ctx, { platform: true });
  });
});

test('AC-9: other fields of a building that keeps its inactive type can change too, the angle included', async () => {
  await withVenueApp(async (ctx) => {
    const { put, get } = ctx;
    const { B, T } = await itemFifteen(ctx, { platform: false });
    const loaded = (await get(`/api/buildings/${B}`)).body;
    const res = await put(`/api/buildings/${B}`, {
      name: loaded.name,
      buildingTypeId: T,
      mapUpDeg: '120',
      updatedAt: loaded.updatedAt,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.mapUpDeg, '120.00');
    assert.equal(res.body.buildingTypeId, T);
    assert.equal(res.body.buildingTypeIsActive, false);
  });
});

test('AC-10: a new building cannot be given an inactive type: 400 naming the type, and nothing is written', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql } = ctx;
    const { venue, T } = await itemFifteen(ctx, { platform: false });
    const before = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE VenueId = $1`, [
      venue,
    ]);
    const res = await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(T));
    assertRefused(res, 400, /type/i);
    assert.equal(res.body.error, NO_LONGER_IN_USE);
    const after = await sql.one(`SELECT COUNT(*) AS n FROM gabay.Building WHERE VenueId = $1`, [
      venue,
    ]);
    assert.equal(after.n, before.n);
    // the same for a platform type switched off
    const platform = await sql.buildingType(null);
    await deactivate(sql, platform);
    const res2 = await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(platform));
    assertRefused(res2, 400, /type/i);
    assert.equal(res2.body.error, NO_LONGER_IN_USE);
  });
});

test('AC-10: another building cannot be changed to an inactive type: 400, and its own type is kept', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    const { venue, T } = await itemFifteen(ctx, { platform: false });
    const active = await sql.buildingType(tenantA.tenantId);
    const other = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(active))).body;
    const res = await put(`/api/buildings/${other.id}`, {
      name: other.name,
      buildingTypeId: T,
      mapUpDeg: null,
      updatedAt: other.updatedAt,
    });
    assertRefused(res, 400, /type/i);
    assert.equal(res.body.error, NO_LONGER_IN_USE);
    const kept = (await get(`/api/buildings/${other.id}`)).body;
    assert.equal(kept.buildingTypeId, active, 'the building keeps its active type');
    assert.equal(kept.updatedAt, null, 'nothing was written');
  });
});

test('AC-10: a building on an inactive type may be changed to an active one, and then cannot go back', async () => {
  await withVenueApp(async (ctx) => {
    const { put, get, sql, tenantA } = ctx;
    const { B, T } = await itemFifteen(ctx, { platform: false });
    const active = await sql.buildingType(tenantA.tenantId);
    const loaded = (await get(`/api/buildings/${B}`)).body;
    const moved = await put(`/api/buildings/${B}`, {
      name: loaded.name,
      buildingTypeId: active,
      mapUpDeg: null,
      updatedAt: loaded.updatedAt,
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.buildingTypeId, active);
    assert.equal(moved.body.buildingTypeIsActive, true);
    const back = await put(`/api/buildings/${B}`, {
      name: moved.body.name,
      buildingTypeId: T,
      mapUpDeg: null,
      updatedAt: moved.body.updatedAt,
    });
    assertRefused(back, 400, /type/i);
    assert.equal(back.body.error, NO_LONGER_IN_USE);
  });
});

test('AC-9 (edge: type deactivated while the form is open): the form loaded before T went inactive still saves with T', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA, tag } = ctx;
    const venue = await sql.venue(tenantA.tenantId);
    const T = await sql.buildingType(tenantA.tenantId, { label: `Open form ${tag}` });
    const B = (await post(`/api/venues/${venue}/buildings`, bodies(ctx).building(T))).body;
    const loadedWhenOpened = (await get(`/api/buildings/${B.id}`)).body; // the form opens with T active
    await deactivate(sql, T); // an admin switches T off while the form is open
    const saved = await put(`/api/buildings/${B.id}`, {
      name: 'Saved after deactivation',
      buildingTypeId: loadedWhenOpened.buildingTypeId,
      mapUpDeg: null,
      updatedAt: loadedWhenOpened.updatedAt,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.buildingTypeId, T);
  });
});
