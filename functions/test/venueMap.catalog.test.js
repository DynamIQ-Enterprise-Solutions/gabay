'use strict';

// The catalog and the validator's context (spec/OA-1.md r1 section 3.11; plan/OA-1-map-document.md 1.0 section 9):
// AC-44, AC-46; EC-15 (the active flag), EC-16. The route and its API test are OA-2's (AC-45 is not tested here).
// Both functions are pure over camelCase rows (plan section 3.2, DC-O8). Written FIRST: every case fails until
// engine-coder builds the module.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertProblemAt } = require('./fixtures/mapAsserts');
const { closedSet } = require('../src/config/closedSets');

const byCode = (catalog, code) => catalog.types.find((t) => t.code === code);
const isFixed = (resize) => resize === null || Object.values(resize).every((v) => v === null);

// ----------------------------------------------------------------------------------------------------------- AC-44

test('AC-44: the catalog is { version, finishes, floorFinishes, types } with the finishes read from the constants file', () => {
  const { shapeCatalog } = b.vm();
  const catalog = shapeCatalog(b.objectRows(), 5);
  assert.deepEqual(Object.keys(catalog).sort(), ['finishes', 'floorFinishes', 'types', 'version']);
  assert.equal(catalog.version, 5);
  assert.deepEqual([...catalog.finishes], [...closedSet('ItemFinish')]);
  assert.deepEqual([...catalog.floorFinishes], [...closedSet('FloorFinish')]);
  assert.equal(catalog.types.length, 6);
});

test('AC-44: each type is { code, label, sortOrder, active, size: { w, d, h }, resize, blocks, mount, round } and nothing else', () => {
  const { shapeCatalog } = b.vm();
  const catalog = shapeCatalog(b.objectRows(), 5);
  for (const type of catalog.types) {
    assert.deepEqual(
      Object.keys(type).sort(),
      ['active', 'blocks', 'code', 'label', 'mount', 'resize', 'round', 'size', 'sortOrder'],
      type.code,
    );
    assert.deepEqual(Object.keys(type.size).sort(), ['d', 'h', 'w']);
  }
  assert.deepEqual(byCode(catalog, 'DESK'), {
    code: 'DESK',
    label: 'DESK',
    sortOrder: 1,
    active: true,
    size: { w: 1.4, d: 0.7, h: 0.75 },
    resize: { w: [0.6, 3], d: [0.5, 1.5], h: [0.7, 1.2] },
    blocks: true,
    mount: 'floor',
    round: false,
  });
});

test('AC-44: size values are metres or null; blocks comes from BlocksWalk; mount is floor or wall; round is a flag', () => {
  const { shapeCatalog } = b.vm();
  const catalog = shapeCatalog(b.objectRows(), 5);
  assert.deepEqual(byCode(catalog, 'COUNTER_FREE').size, { w: null, d: null, h: 1.1 });
  assert.equal(byCode(catalog, 'SIGN_WALL').mount, 'wall');
  assert.equal(byCode(catalog, 'SIGN_WALL').blocks, false);
  assert.equal(byCode(catalog, 'PLANTER_ROUND').round, true);
  assert.equal(byCode(catalog, 'PLANTER_ROUND').blocks, false);
  assert.equal(byCode(catalog, 'PILLAR').blocks, true);
});

test('AC-44: resize is [min, max] per dimension, and a fixed dimension is null (a fixed type has no resize range at all)', () => {
  const { shapeCatalog } = b.vm();
  const catalog = shapeCatalog(b.objectRows(), 5);
  assert.deepEqual(byCode(catalog, 'PLANTER_ROUND').resize, { w: [0.4, 2], d: null, h: null });
  assert.ok(
    isFixed(byCode(catalog, 'PILLAR').resize),
    JSON.stringify(byCode(catalog, 'PILLAR').resize),
  );
  assert.ok(isFixed(byCode(catalog, 'COUNTER_FREE').resize));
});

test('AC-44: a tenant row overrides a platform row with the same code, with its own label, sizes and active flag (EC-15)', () => {
  const { shapeCatalog } = b.vm();
  const tenantDesk = b.objectRow('DESK', {
    tenantId: b.TENANT,
    label: 'Our desk',
    sortOrder: 9,
    isActive: false,
    defaultW: 2,
    defaultD: 1,
    defaultH: 0.8,
    resize: { w: null, d: null, h: null },
  });
  const catalog = shapeCatalog([...b.objectRows(), tenantDesk], 5);
  assert.equal(catalog.types.filter((t) => t.code === 'DESK').length, 1, 'one DESK');
  assert.equal(catalog.types.length, 6, 'no extra type');
  const desk = byCode(catalog, 'DESK');
  assert.equal(desk.label, 'Our desk');
  assert.equal(desk.active, false);
  assert.deepEqual(desk.size, { w: 2, d: 1, h: 0.8 });
  assert.ok(isFixed(desk.resize));
  // the order the rows arrive in does not matter
  const reversed = shapeCatalog([tenantDesk, ...b.objectRows().reverse()], 5);
  assert.equal(byCode(reversed, 'DESK').label, 'Our desk');
});

test('AC-44: a tenant-only type is served, and the platform types stay', () => {
  const { shapeCatalog } = b.vm();
  const own = b.objectRow('KIOSK_OWN', {
    tenantId: b.TENANT,
    defaultW: 3,
    defaultD: 2,
    defaultH: 2.5,
  });
  const catalog = shapeCatalog([...b.objectRows(), own], 5);
  assert.equal(catalog.types.length, 7);
  assert.equal(byCode(catalog, 'KIOSK_OWN').size.w, 3);
  assert.ok(byCode(catalog, 'PILLAR'));
});

test('AC-44: inactive types are served and marked inactive, so the editor can show one already placed but not offer it (DC-15)', () => {
  const { shapeCatalog } = b.vm();
  const catalog = shapeCatalog(b.objectRows(), 5);
  assert.equal(byCode(catalog, 'OLD_TABLE').active, false);
  assert.equal(byCode(catalog, 'DESK').active, true);
});

test('AC-44: the office palette fields category, desk and spots are not served (DC-30), whatever the rows carry', () => {
  const { shapeCatalog } = b.vm();
  const rows = b
    .objectRows()
    .map((r) => ({ ...r, category: 'Furniture', desk: true, spots: 4, signalPenaltyDb: 20 }));
  const catalog = shapeCatalog(rows, 5);
  for (const type of catalog.types) {
    for (const banned of ['category', 'desk', 'spots', 'signalPenaltyDb', 'tenantId']) {
      assert.equal(banned in type, false, `${type.code}.${banned}`);
    }
  }
});

test("AC-44 and EC-16: the version is the input the shaper is given (the route is OA-2's), and the rows are not changed", () => {
  const { shapeCatalog } = b.vm();
  const rows = b.deepFreeze(b.objectRows());
  assert.equal(shapeCatalog(rows, 1).version, 1);
  assert.equal(shapeCatalog(rows, 12).version, 12);
  assert.equal(shapeCatalog(rows, 12).types.length, 6);
});

// ----------------------------------------------------------------------------------------------------------- AC-46

test("AC-46: the context is built from the same rows: each lookup resolves its own codes and no other lookup's", () => {
  const ctx = b.makeContext();
  const doc = b.twoLevelDoc();
  doc.buildings[0].type = 'CR'; // an amenity code
  doc.levels[0].amenities = [b.amenity('a1', { type: 'MAIN' })]; // a building code
  doc.levels[0].transitPoints = [b.transitPoint('t1', { type: 'STAIRS_STD' })]; // a connector code
  doc.levels[0].items = [b.item('i1', { type: 'TAXI_BAY' })]; // a transit code
  doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: 'DESK' })]; // an object code
  const res = validate(doc, ctx);
  for (const path of [
    'buildings[0].type',
    'levels[0].amenities[0].type',
    'levels[0].transitPoints[0].type',
    'levels[0].items[0].type',
    'connectors[0].type',
  ]) {
    assertProblemAt(res, path);
  }
});

test('AC-46: the context carries the catalog version counter (a document may not claim a higher one)', () => {
  const doc = b.smallDoc();
  doc.catalog = 8;
  assert.equal(validate(doc, b.makeContext({ version: 8 })).ok, true);
  assertProblemAt(validate(doc, b.makeContext({ version: 7 })), 'catalog');
});

test('AC-46: each code comes with its active flag: an inactive one resolves, and a tenant row beats a platform row of the same code', () => {
  const rows = b.lookupRows();
  const tenantOnly = b.lookupRow('MY_BUILDING_TYPE', { tenantId: b.TENANT });
  const ctx = b.makeContext({ buildingTypes: [...rows.buildingTypes, tenantOnly] });
  const doc = b.smallDoc();
  doc.buildings[0].type = 'MY_BUILDING_TYPE';
  assert.equal(validate(doc, ctx).ok, true, 'a tenant-only code resolves');
  doc.buildings[0].type = 'OLD_ANNEX';
  assert.equal(validate(doc, ctx).ok, true, 'an inactive platform code resolves');
  const inactiveTenant = b.makeContext({
    buildingTypes: [
      ...rows.buildingTypes,
      b.lookupRow('MAIN', { tenantId: b.TENANT, isActive: false }),
    ],
  });
  doc.buildings[0].type = 'MAIN';
  assert.equal(
    validate(doc, inactiveTenant).ok,
    true,
    'the tenant row (inactive) wins and is still accepted',
  );
});

test('AC-46: the shapers do not change the rows they are given', () => {
  const { shapeCatalog, shapeMapContext } = b.vm();
  const rows = b.lookupRows();
  b.deepFreeze(rows);
  const catalog = shapeCatalog(b.deepFreeze(b.objectRows()), 5);
  assert.doesNotThrow(() => shapeMapContext({ catalog, ...rows }));
});

test('AC-46: OccupantCategory rows are in the context for the export envelope (an unknown category fails there, an inactive one passes)', () => {
  const { validateExportFile } = b.vm();
  const ctx = b.makeContext();
  const env = (category) => ({
    format: 'gabay.venue-map',
    version: 1,
    exportedAt: '2026-10-13T10:00:00Z',
    fromVenue: { code: 'V1', name: 'Venue' },
    map: b.fullDoc(),
    stores: [{ unit: 'u-1', name: 'Store', category }],
  });
  assert.equal(validateExportFile(env('FASHION'), ctx).ok, true);
  assert.equal(validateExportFile(env('SPORTS_OLD'), ctx).ok, true);
  assert.equal(validateExportFile(env('NOPE'), ctx).ok, false);
});

// ------------------------------------------------- regression: a row with no tenantId read as a platform row (review 1)
//
// Bug (dod-reviewer, OA-1 review 1, nit on lookups.js): a row with no tenantId key at all was taken for a platform row
// (TenantId NULL), so a repository that forgot to select the column would silently lose the tenant-first rule. Every
// row must now carry the key, null or a value; a row without it is refused, naming its list and code.

test('AC-44 and AC-46 (regression, review 1): a row with no tenantId key is refused by both shapers, naming the list and the code', () => {
  const { shapeCatalog, shapeMapContext } = b.vm();
  const { tenantId: _dropped, ...noTenant } = b.lookupRow('NO_TENANT_KEY');
  const rows = b.lookupRows();
  assert.throws(
    () =>
      shapeMapContext({
        catalog: shapeCatalog(b.objectRows(), 5),
        ...rows,
        amenityTypes: [...rows.amenityTypes, noTenant],
      }),
    /amenityTypes.*NO_TENANT_KEY.*tenantId/,
  );
  const { tenantId: _also, ...objectNoTenant } = b.objectRow('NO_TENANT_TYPE');
  assert.throws(
    () => shapeCatalog([...b.objectRows(), objectNoTenant], 5),
    /NO_TENANT_TYPE.*tenantId/,
  );
  assert.doesNotThrow(() => shapeCatalog(b.objectRows(), 5), 'null is a value: a platform row');
});
