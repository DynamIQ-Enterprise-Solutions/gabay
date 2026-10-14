'use strict';

// Lookup codes and closed sets (spec/OA-1.md r1 section 3.5; plan/OA-1-map-document.md 1.0 section 9): AC-19, AC-20,
// AC-21 (through the validator); EC-4, EC-13, EC-14, EC-15, EC-22. Written FIRST: every case fails until engine-coder
// builds the validator.
//
// DESIGN CHOICES proposed by engine-coder and used here (DC-E19): "a code only another tenant has" is a code absent
// from the rows given to shapeMapContext, which throws when its rows mix two tenants.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt, assertProblemAt, clone } = require('./fixtures/mapAsserts');
const { closedSet, subsetOf } = require('../src/config/closedSets');

const withLevel = (edit) => {
  const doc = b.smallDoc();
  edit(doc.levels[0], doc);
  return doc;
};

// ----------------------------------------------------------------------------------------------------------- AC-19

const CODE_FIELDS = [
  [
    'building type',
    'buildings[0].type',
    (code) => Object.assign(b.smallDoc(), { buildings: [{ id: 'b1', name: 'Main', type: code }] }),
  ],
  [
    'amenity type',
    'levels[0].amenities[0].type',
    (code) => withLevel((l) => (l.amenities = [b.amenity('a1', { type: code })])),
  ],
  [
    'transit point type',
    'levels[0].transitPoints[0].type',
    (code) => withLevel((l) => (l.transitPoints = [b.transitPoint('t1', { type: code })])),
  ],
  [
    'connector type',
    'connectors[0].type',
    (code) => {
      const doc = b.twoLevelDoc();
      doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: code })];
      return doc;
    },
  ],
  [
    'item type',
    'levels[0].items[0].type',
    (code) => withLevel((l) => (l.items = [b.item('i1', { type: code })])),
  ],
];

for (const [label, path, build] of CODE_FIELDS) {
  test(`AC-19: a ${label} that is not in the context gives a problem at ${path}, naming the code (also: a code only another tenant has)`, () => {
    const res = validate(build('ONLY_ANOTHER_TENANT_HAS_THIS'));
    assertProblemAt(res, path);
    assert.ok(
      b.problemsAt(res, path).some((p) => p.includes('ONLY_ANOTHER_TENANT_HAS_THIS')),
      `names the code: ${res.problems.join(' | ')}`,
    );
  });
}

test('AC-19 (DC-E19): the context shaper refuses rows that mix two tenants, so another tenant never resolves', () => {
  const { shapeMapContext, shapeCatalog } = b.vm();
  const rows = b.lookupRows();
  const mixed = [
    ...rows.amenityTypes,
    b.lookupRow('OTHER_TENANT_CODE', { tenantId: b.TENANT + 1 }),
    b.lookupRow('MINE', { tenantId: b.TENANT }),
  ];
  assert.throws(
    () =>
      shapeMapContext({
        catalog: shapeCatalog(b.objectRows(), b.CATALOG_VERSION),
        ...rows,
        amenityTypes: mixed,
      }),
    Error,
  );
});

test('AC-19: a tenant row and a platform row with the same code resolve to the tenant row (connector CostModel decides)', () => {
  const rows = b.lookupRows();
  const platform = b.lookupRow('DUAL', { costModel: 'ELEVATOR' });
  const tenant = b.lookupRow('DUAL', { tenantId: b.TENANT, costModel: 'STAIRS' });
  for (const order of [
    [platform, tenant],
    [tenant, platform],
  ]) {
    const ctx = b.makeContext({ connectorTypes: [...rows.connectorTypes, ...order] });
    const doc = b.twoLevelDoc();
    doc.connectors = [b.connector('s1', 'stairs', ['l1', 'l2'], { type: 'DUAL' })];
    assert.equal(validate(doc, ctx).ok, true, 'the tenant row (STAIRS) wins');
    const lift = b.twoLevelDoc();
    lift.connectors = [b.connector('e1', 'elevator', ['l1', 'l2'], { type: 'DUAL' })];
    assertProblemAt(
      validate(lift, ctx),
      'connectors[0].type',
      'the platform row (ELEVATOR) is hidden by the tenant row',
    );
  }
});

test('AC-19: a tenant object type with the same code as a platform one overrides it (EC-15)', () => {
  const override = b.objectRow('DESK', {
    tenantId: b.TENANT,
    defaultW: 1.4,
    defaultD: 0.7,
    defaultH: 0.75,
    resize: { w: null, d: null, h: null },
  });
  const ctx = b.makeContext({ objectTypes: [...b.objectRows(), override] });
  const doc = withLevel((l) => (l.items = [b.item('i1', { type: 'DESK', w: 1.5 })]));
  assert.equal(validate(doc).ok, true, 'the platform DESK resizes');
  assertOneProblemAt(validate(doc, ctx), 'levels[0].items[0].w', 'the tenant DESK is fixed');
});

// ----------------------------------------------------------------------------------------------------------- AC-20

test('AC-20 and EC-22: an inactive code is accepted for every lookup field, and the canonical copy keeps it', () => {
  const doc = b.twoLevelDoc();
  doc.buildings[0].type = 'OLD_ANNEX';
  doc.levels[0].amenities = [b.amenity('a1', { type: 'NURSING_OLD' })];
  doc.levels[0].transitPoints = [b.transitPoint('t1', { type: 'DROP_OFF_OLD' })];
  doc.levels[0].items = [b.item('i1', { type: 'OLD_TABLE' })];
  doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: 'STAIRS_OLD' })];
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(res.map.buildings[0].type, 'OLD_ANNEX');
  assert.equal(res.map.levels[0].amenities[0].type, 'NURSING_OLD');
  assert.equal(res.map.levels[0].transitPoints[0].type, 'DROP_OFF_OLD');
  assert.equal(res.map.levels[0].items[0].type, 'OLD_TABLE');
  assert.equal(res.map.connectors[0].type, 'STAIRS_OLD');
});

test('EC-4: an element drawn before its type was deactivated survives every later save (validate the canonical copy again)', () => {
  const doc = withLevel((l) => (l.items = [b.item('i1', { type: 'OLD_TABLE' })]));
  const first = validate(doc);
  assert.equal(first.ok, true);
  const again = validate(first.map);
  assert.equal(again.ok, true);
  assert.deepEqual(again.map, first.map);
});

// ------------------------------------------------------------------------------------------------------------- EC-4

test('EC-4: a map drawn at catalog 3 while the context is at 5 is accepted and keeps catalog 3; 5 is accepted; 6 is refused at catalog', () => {
  for (const [version, ok] of [
    [3, true],
    [5, true],
    [6, false],
    [50, false],
  ]) {
    const doc = b.smallDoc();
    doc.catalog = version;
    const res = validate(doc);
    if (ok) {
      assert.equal(res.ok, true, JSON.stringify(res.problems));
      assert.equal(res.map.catalog, version);
    } else assertOneProblemAt(res, 'catalog', `catalog ${version}`);
  }
});

test('EC-4: a document with no catalog gets the context version written (spec 2.1: the default is the context current version)', () => {
  const res = validate(b.smallDoc());
  assert.equal(res.ok, true);
  assert.equal(res.map.catalog, b.CATALOG_VERSION);
});

test('EC-4: the version limit follows the context (a context at version 9 accepts catalog 9 and refuses 10)', () => {
  const ctx = b.makeContext({ version: 9 });
  const doc = b.smallDoc();
  doc.catalog = 9;
  assert.equal(validate(doc, ctx).ok, true);
  doc.catalog = 10;
  assertOneProblemAt(validate(doc, ctx), 'catalog');
});

// ----------------------------------------------------------------------------------------------------------- EC-14

test('EC-14: a document whose codes exist nowhere in the context gives one problem per code', () => {
  const doc = b.twoLevelDoc();
  doc.buildings[0].type = 'NOPE_BUILDING';
  doc.levels[0].amenities = [b.amenity('a1', { type: 'NOPE_AMENITY' })];
  doc.levels[0].transitPoints = [b.transitPoint('t1', { type: 'NOPE_TRANSIT' })];
  doc.levels[0].items = [b.item('i1', { type: 'NOPE_ITEM' })];
  doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { type: 'NOPE_CONNECTOR' })];
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 5, JSON.stringify(res.problems));
  for (const path of [
    'buildings[0].type',
    'levels[0].amenities[0].type',
    'levels[0].transitPoints[0].type',
    'levels[0].items[0].type',
    'connectors[0].type',
  ]) {
    assert.equal(b.problemsAt(res, path).length, 1, path);
  }
});

// ----------------------------------------------------------------------------------------------------------- EC-13

test('EC-13: the document holds no tenant, venue or user identity: such keys are left out of the canonical copy', () => {
  const doc = b.smallDoc();
  Object.assign(doc, {
    tenantId: 5,
    tenantCompanyID: 5,
    venueId: 9,
    venueCode: 'V1',
    venueName: 'Mall',
    createdBy: 1,
  });
  Object.assign(doc.site, { tenantId: 5 });
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  for (const key of [
    'tenantId',
    'tenantCompanyID',
    'venueId',
    'venueCode',
    'venueName',
    'createdBy',
  ]) {
    assert.equal(key in res.map, false, key);
  }
  assert.equal('tenantId' in res.map.site, false);
});

// ----------------------------------------------------------------------------------------------------------- AC-21

const SET_CASES = [
  [
    'a wall kind',
    'levels[0].walls[0].kind',
    () => withLevel((l) => (l.walls = [b.wall('w1', { kind: 'brick' })])),
  ],
  [
    'an opening kind',
    'levels[0].openings[0].kind',
    () =>
      withLevel((l) => {
        l.walls = [b.wall('w1')];
        l.openings = [b.opening('o1', 'w1', { kind: 'gate' })];
      }),
  ],
  [
    'a correction kind',
    'levels[0].corrections[0].kind',
    () => withLevel((l) => (l.corrections = [b.correction('c1', { kind: 'DRAW' })])),
  ],
  [
    'a connector kind',
    'connectors[0].kind',
    () => {
      const doc = b.twoLevelDoc();
      doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { kind: 'ladder' })];
      return doc;
    },
  ],
  [
    'a stairs shape',
    'connectors[0].shape',
    () => {
      const doc = b.twoLevelDoc();
      doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { shape: 'Z' })];
      return doc;
    },
  ],
  [
    'an item finish',
    'levels[0].items[0].finish',
    () => withLevel((l) => (l.items = [b.item('i1', { finish: 'neon' })])),
  ],
  [
    'a level floor finish',
    'levels[0].floor.finish',
    () => withLevel((l) => (l.floor = { finish: 'marble' })),
  ],
  [
    'a unit floor finish',
    'levels[0].units[0].floor.finish',
    () => withLevel((l) => (l.units = [b.unit('u1', { floor: { finish: 'marble' } })])),
  ],
  [
    'a unit category',
    'levels[0].units[0].category',
    () => withLevel((l) => (l.units = [b.unit('u1', { category: 'shop' })])),
  ],
];

for (const [label, path, build] of SET_CASES) {
  test(`AC-21: ${label} outside its closed set gives a problem at ${path}`, () => {
    assertProblemAt(validate(build()), path);
  });
}

test('AC-21: every IMDF 1.0.0 unit category is accepted, dotted ones included; walkable is filled from the walkable subset', () => {
  const walkable = new Set(subsetOf('WalkableUnitCategory'));
  for (const category of closedSet('ImdfUnitCategory')) {
    const res = validate(
      withLevel((l) => (l.units = [{ id: 'u1', category, poly: b.rect(50, 10, 60, 20) }])),
    );
    assert.equal(res.ok, true, `${category}: ${JSON.stringify(res.problems)}`);
    assert.equal(res.map.levels[0].units[0].walkable, walkable.has(category), category);
  }
});

test('AC-21: every wall kind, opening kind, stairs shape, item finish and floor finish of the constants file is accepted', () => {
  for (const kind of closedSet('WallKind')) {
    assert.equal(validate(withLevel((l) => (l.walls = [b.wall('w1', { kind })]))).ok, true, kind);
  }
  for (const kind of closedSet('OpeningKind')) {
    const res = validate(
      withLevel((l) => {
        l.walls = [b.wall('w1')];
        l.openings = [b.opening('o1', 'w1', { kind })];
      }),
    );
    assert.equal(res.ok, true, kind);
  }
  for (const shape of closedSet('ConnectorShape')) {
    const doc = b.twoLevelDoc();
    doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { shape })];
    assert.equal(validate(doc).ok, true, shape);
  }
  for (const finish of closedSet('ItemFinish')) {
    assert.equal(
      validate(withLevel((l) => (l.items = [b.item('i1', { finish })]))).ok,
      true,
      finish,
    );
  }
  for (const finish of closedSet('FloorFinish')) {
    assert.equal(validate(withLevel((l) => (l.floor = { finish }))).ok, true, finish);
    assert.equal(
      validate(withLevel((l) => (l.units = [b.unit('u1', { floor: { finish } })]))).ok,
      true,
      finish,
    );
  }
  for (const kind of closedSet('NavCorrectionKind')) {
    const correction =
      kind === 'BLOCK_AREA'
        ? b.correction('c1')
        : {
            id: 'c1',
            kind,
            line: [
              [10, 10],
              [20, 10],
            ],
          };
    assert.equal(validate(withLevel((l) => (l.corrections = [correction]))).ok, true, kind);
  }
});

test('AC-21: a value is compared exactly: the wrong case of a closed-set key is outside the set', () => {
  assertProblemAt(
    validate(withLevel((l) => (l.walls = [b.wall('w1', { kind: 'Solid' })]))),
    'levels[0].walls[0].kind',
  );
  assertProblemAt(
    validate(withLevel((l) => (l.corrections = [b.correction('c1', { kind: 'block_area' })]))),
    'levels[0].corrections[0].kind',
  );
  const doc = clone(b.smallDoc());
  assert.equal(validate(doc).ok, true);
});
