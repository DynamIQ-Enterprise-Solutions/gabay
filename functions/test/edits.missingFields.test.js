'use strict';

// The owner's ruling L164 (dod-reviewer's FF-1 review): an edit (PUT) sends every field, as plan section 2.3 says ("all
// present"). A missing key, as distinct from null or "", is refused with 400 "<Field> is missing" on every PUT, and the
// stored record is unchanged; before the ruling a PUT without mapUpDeg silently reset a 45.00 angle to the default 0.
// A POST keeps the plan's create rules: a missing optional field is blank, a missing required one "is required". The
// outdoor ground level's body has no ordinal (the server sets 0), so its edit may leave it out.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

/** For each key of `full`: the PUT without it is a 400 "<Label> is missing" and changes nothing. */
async function assertEachMissingRefused(ctx, path, full, labels) {
  const before = (await ctx.get(path)).body;
  for (const [key, label] of Object.entries(labels)) {
    const { [key]: _dropped, ...without } = full;
    const res = await ctx.put(path, without);
    assertRefused(res, 400, null, `${path} without ${key}`);
    assert.equal(res.body.error, `${label} is missing`, key);
  }
  assert.deepEqual(
    (await ctx.get(path)).body,
    before,
    `${path}: a refused edit changed the record`,
  );
}

test('L164: a venue PUT without mapUpDeg is a 400 and the stored 45.00 stays; null still means the default', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const made = (await post('/api/venues', bodies(ctx).venue({ mapUpDeg: '45' }))).body;
    assert.equal(made.mapUpDeg, '45.00');
    const res = await put(`/api/venues/${made.id}`, {
      code: made.code,
      name: 'Renamed',
      isActive: true,
      updatedAt: made.updatedAt,
    });
    assertRefused(res, 400, null);
    assert.equal(res.body.error, 'Map up angle is missing');
    const stored = (await get(`/api/venues/${made.id}`)).body;
    assert.equal(stored.mapUpDeg, '45.00');
    assert.equal(stored.name, made.name);
    const cleared = await put(`/api/venues/${made.id}`, {
      code: made.code,
      name: made.name,
      mapUpDeg: null,
      isActive: true,
      updatedAt: made.updatedAt,
    });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal(
      cleared.body.mapUpDeg,
      '0.00',
      'null is not missing: it is blank, the column default',
    );
  });
});

test('L164: every venue field is required on PUT', async () => {
  await withVenueApp(async (ctx) => {
    const made = (await ctx.post('/api/venues', bodies(ctx).venue({ mapUpDeg: '45' }))).body;
    const full = {
      code: made.code,
      name: made.name,
      mapUpDeg: '45',
      isActive: true,
      updatedAt: null,
    };
    await assertEachMissingRefused(ctx, `/api/venues/${made.id}`, full, {
      code: 'Code',
      name: 'Name',
      mapUpDeg: 'Map up angle',
      isActive: 'Active',
      updatedAt: 'Updated at',
    });
  });
});

test('L164: every building field is required on PUT', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const made = (
      await ctx.post(
        `/api/venues/${venue}/buildings`,
        bodies(ctx).building(type, { mapUpDeg: '90' }),
      )
    ).body;
    const full = { name: made.name, buildingTypeId: type, mapUpDeg: '90', updatedAt: null };
    await assertEachMissingRefused(ctx, `/api/buildings/${made.id}`, full, {
      name: 'Name',
      buildingTypeId: 'Building type',
      mapUpDeg: 'Map up angle',
      updatedAt: 'Updated at',
    });
  });
});

const LEVEL_LABELS = {
  ordinal: 'Ordinal',
  name: 'Name',
  shortName: 'Short name',
  spokenName: 'Spoken name',
  elevationM: 'Elevation',
  widthM: 'Width',
  depthM: 'Depth',
  gridCellM: 'Grid cell size',
  ceilingHeightM: 'Ceiling height',
  updatedAt: 'Updated at',
};

test('L164: every indoor level field is required on PUT, the optional ones included', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    const body = bodies(ctx).level({
      ordinal: 3,
      spokenName: 'Third',
      elevationM: '8.5',
      gridCellM: '0.5',
      ceilingHeightM: '3.2',
    });
    const made = (await ctx.post(`/api/buildings/${building}/levels`, body)).body;
    await assertEachMissingRefused(
      ctx,
      `/api/levels/${made.id}`,
      { ...body, updatedAt: null },
      LEVEL_LABELS,
    );
  });
});

test('L164: the outdoor ground level PUT needs every field but the ordinal, which the server sets', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, put } = ctx;
    const venue = await sql.venue(tenantA.tenantId);
    const body = bodies(ctx).outdoor({ spokenName: 'Car park' });
    const made = (await ctx.post(`/api/venues/${venue}/outdoor-levels`, body)).body;
    const { ordinal: _ordinal, ...labels } = LEVEL_LABELS;
    await assertEachMissingRefused(
      ctx,
      `/api/levels/${made.id}`,
      { ...body, updatedAt: null },
      labels,
    );
    const saved = await put(`/api/levels/${made.id}`, { ...body, name: 'Yard', updatedAt: null });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.ordinal, 0);
  });
});

test('L164: a POST keeps the create rules: a missing optional field is blank, a missing required one is required', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const { mapUpDeg: _angle, ...venueBody } = bodies(ctx).venue();
    const venue = await post('/api/venues', venueBody);
    assert.equal(venue.status, 201, JSON.stringify(venue.body));
    assert.equal(venue.body.mapUpDeg, '0.00');
    const type = await sql.buildingType(tenantA.tenantId);
    const { mapUpDeg: _b, ...buildingBody } = bodies(ctx).building(type);
    const building = await post(`/api/venues/${venue.body.id}/buildings`, buildingBody);
    assert.equal(building.status, 201);
    assert.equal(building.body.mapUpDeg, null);
    const { buildingTypeId: _t, ...noType } = bodies(ctx).building(type);
    const refused = await post(`/api/venues/${venue.body.id}/buildings`, noType);
    assertRefused(refused, 400, null);
    assert.equal(refused.body.error, 'Building type is required');
    const {
      spokenName: _s,
      elevationM: _e,
      gridCellM: _g,
      ceilingHeightM: _c,
      ...levelBody
    } = bodies(ctx).level();
    const level = await post(`/api/buildings/${building.body.id}/levels`, levelBody);
    assert.equal(level.status, 201, JSON.stringify(level.body));
    assert.deepEqual(
      [
        level.body.spokenName,
        level.body.elevationM,
        level.body.gridCellM,
        level.body.ceilingHeightM,
      ],
      [null, '0.000', '1.00', null],
    );
  });
});
