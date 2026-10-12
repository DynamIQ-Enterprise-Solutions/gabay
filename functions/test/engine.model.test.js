'use strict';

// FF-3 A1, the package model (plan/FF-3-publish-engine.md 1.0 §2 DC-P1 and §3; spec/P0-03.md r2 §3.7, ruled D11
// with A3 and A9): a plain object holding the allow-listed rows and nothing else, the graph with each node's level
// ordinal in the venue's one frame (E10), the passages, the wall segments and every resolved routing.* setting.
// Stage B's writer turns it into bytes; AC-46's seal test on the file is stage B's (engine.packageSeal).

const test = require('node:test');
const assert = require('node:assert/strict');
const { runPublishEngine } = require('../src/services/engines/publishEngine.service');
const { PACKAGE_ALLOW_LIST, PACKAGE_FRAME } = require('../src/services/engines/packageAllowList');
const {
  draftBuilder,
  corridorWithStore,
  TENANT_ID,
  TENANT_UUID,
} = require('./fixtures/draftBuilder');

/** A two-floor venue with a bit of everything the allow-list names. */
function fullVenue(opts) {
  const b = draftBuilder(opts);
  const L0 = b.level({ ordinal: 0, elevationM: 0, name: 'Ground', spokenName: 'Ground floor' });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5, name: 'Upper' });
  b.walkway(L0, [0, 0, 30, 4]);
  b.walkway(L1, [0, 0, 30, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const shop = b.store(L0, [5, 4, 10, 10], {
    name: 'Bookshop',
    doors: [
      [
        [7, 4],
        [8.5, 4],
      ],
    ],
    keywords: 'books, magazines',
    spokenName: 'Book shop',
    status: 32,
  });
  const esc = b.connector('ESCALATOR', [L0, 20, 2], [L1, 24, 2], {
    name: 'Escalator E1',
    spokenName: 'the east escalator',
  });
  b.amenity(L0, 12, 2, { typeId: 12, name: 'ATM' });
  b.transitPoint(L0, 1, 1);
  b.anchor(L1, 15, 2, { name: 'Clock' });
  b.floorObject(L0, { center: [25, 3.5], width: 0.4, depth: 0.4 });
  const beacon = b.beacon(L0, 2, 2, { major: 3, minor: 7 });
  b.beacon(L1, 2, 2, { major: 3, minor: 8, active: false });
  const lift = b.lift(
    [
      [L0, 28, 2],
      [L1, 28, 2],
    ],
    { name: 'Lift A' },
  );
  // A back corridor reached only through a walk-through arcade, so the passages table has a row.
  b.walkway(L0, [10, 10, 20, 14]);
  const arcade = b.store(L0, [12, 4, 18, 10], {
    name: 'Arcade',
    passThrough: true,
    doors: [
      [
        [14, 4],
        [15.5, 4],
      ],
      [
        [14, 10],
        [15.5, 10],
      ],
    ],
  });
  const cafe = b.store(L0, [12, 14, 15, 17], {
    name: 'Café',
    doors: [
      [
        [13, 14],
        [14, 14],
      ],
    ],
  });
  return { b, L0, L1, shop, esc, beacon, lift, arcade, cafe };
}

const EXCLUDED = [
  'tenantid',
  'tenantId',
  'needsreview',
  'needsReview',
  'draftconfidence',
  'draftConfidence',
  'createdby',
  'createdBy',
  'createdat',
  'createdAt',
  'updatedby',
  'updatedBy',
  'updatedat',
  'updatedAt',
  'installedon',
  'installedOn',
  'batteryservicedon',
  'batteryServicedOn',
  'beaconplanitemid',
  'beaconPlanItemId',
  'logofileid',
  'logoFileId',
  'unitprice',
  'unitPrice',
];

/** Every key anywhere in a value (objects and arrays, all the way down). */
function allKeys(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

test('engine.model D11: each table holds exactly its allow-listed fields, and no excluded column anywhere', () => {
  const { model, problems } = runPublishEngine(fullVenue().b.build());
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.keys(model).sort(), Object.keys(PACKAGE_ALLOW_LIST).sort());
  for (const [table, fields] of Object.entries(PACKAGE_ALLOW_LIST)) {
    const rows = Array.isArray(model[table]) ? model[table] : [model[table]];
    assert.ok(rows.length > 0, `${table} has rows in this fixture`);
    for (const row of rows) assert.deepEqual(Object.keys(row).sort(), [...fields].sort(), table);
  }
  const keys = allKeys(model);
  for (const name of EXCLUDED) assert.equal(keys.has(name), false, name);
});

test('engine.model D11, EC-30: inactive occupants and inactive beacons stay out', () => {
  const { b, L0, beacon } = fullVenue();
  const gone = b.store(L0, [40, 10, 44, 14], { name: 'Gone shop', doors: [], active: false });
  const { model } = runPublishEngine(b.build());
  assert.equal(
    model.occupants.find((o) => o.id === gone.occupantId),
    undefined,
  );
  assert.deepEqual(
    model.beacons.map((x) => x.id),
    [Number(beacon)],
  );
  assert.deepEqual(model.beacons[0], {
    id: Number(beacon),
    levelId: L0,
    x: 2,
    y: 2,
    uuid: TENANT_UUID,
    major: 3,
    minor: 7,
    mountHeightM: 2.7,
    measuredPower: -55,
  });
});

test("engine.model AC-45: each building's MapUpDeg (the venue's where it has none), the venue's, and every SpokenName", () => {
  const { b, L0, shop, esc } = fullVenue();
  let { model } = runPublishEngine(b.build());
  assert.equal(model.venue.mapUpDeg, 15);
  assert.equal(model.buildings[0].mapUpDeg, 15, "NULL means the venue's");
  b.rows.buildings[0].mapupdeg = '90.00';
  ({ model } = runPublishEngine(b.build()));
  assert.equal(model.buildings[0].mapUpDeg, 90);
  assert.equal(model.buildings[0].typeLabel, 'Main building');
  assert.equal(model.levels.find((l) => l.id === L0).spokenName, 'Ground floor');
  assert.equal(model.occupants.find((o) => o.id === shop.occupantId).spokenName, 'Book shop');
  assert.equal(model.connectors.find((c) => c.id === esc).spokenName, 'the east escalator');
});

test('engine.model AC-47: each occupant carries its store status as of publish, with IsRoutable', () => {
  const { b, shop } = fullVenue();
  const { model } = runPublishEngine(b.build());
  const row = model.occupants.find((o) => o.id === shop.occupantId);
  assert.equal(row.statusLabel, 'Closed');
  assert.equal(row.isRoutable, false);
  assert.equal(row.categoryLabel, 'Fashion');
  assert.equal(row.keywords, 'books, magazines');
});

test('engine.model AC-70: each connector carries its Name with its type, cost model, step-free flag, direction and evacuation flag', () => {
  const { b, L0, L1, esc } = fullVenue();
  const { model } = runPublishEngine(b.build());
  assert.deepEqual(
    model.connectors.find((c) => c.id === esc),
    {
      id: esc,
      name: 'Escalator E1',
      spokenName: 'the east escalator',
      typeLabel: 'Escalator',
      costModel: 'ESCALATOR',
      isStepFree: false,
      isBidirectional: true,
      isEvacuationOnly: false,
      fromLevelId: L0,
      fromX: 20,
      fromY: 2,
      toLevelId: L1,
      toX: 24,
      toY: 2,
    },
  );
});

test('engine.model AC-72 (A3): every routing.* setting as resolved for the tenant, and no other key', () => {
  const draft = fullVenue({ storeCrossingFactor: 1.4 }).b.build();
  draft.settings.routing['package.refreshCheckS'] = 300; // a key that must never travel in the package
  const { model } = runPublishEngine(draft);
  assert.deepEqual(model.routingSettings, [
    { key: 'routing.stairsSaveM', value: 144 },
    { key: 'routing.stepFreeMinWidthM', value: 1.2 },
    { key: 'routing.storeCrossingFactor', value: 1.4 },
  ]);
  const text = JSON.stringify(model);
  assert.ok(!text.includes('package.refreshCheckS'));
  assert.ok(!text.includes('publish.'));
});

test("engine.model AC-49: a draft holding rows of another venue or tenant publishes only this venue's", () => {
  const { b, L0 } = fullVenue();
  const draft = b.build();
  const otherVenue = draft.venue.venueid + 1;
  draft.units.push({
    ...draft.units[0],
    unitid: 9001,
    venueid: otherVenue,
    name: 'Other venue hall',
  });
  draft.occupants.push({
    ...draft.occupants[0],
    occupantid: 9002,
    venueid: otherVenue,
    name: 'Other venue shop',
  });
  draft.beacons.push({
    ...draft.beacons[0],
    beaconid: '9003',
    venueid: otherVenue,
    major: 4242,
    minor: 4243,
  });
  draft.amenities.push({
    ...draft.amenities[0],
    amenityid: 9004,
    tenantid: TENANT_ID + 1,
    name: 'Other tenant ATM',
  });
  draft.connectors.push({
    ...draft.connectors[0],
    navconnectorid: 9005,
    venueid: otherVenue,
    name: 'Other venue lift',
  });
  draft.connectorStops.push({
    tenantid: TENANT_ID,
    navconnectorstopid: 9006,
    navconnectorid: 9005,
    levelid: L0,
    x: '1.000',
    y: '1.000',
  });
  const { model, problems } = runPublishEngine(draft);
  assert.deepEqual(problems, []);
  const text = JSON.stringify(model);
  for (const name of [
    'Other venue hall',
    'Other venue shop',
    'Other tenant ATM',
    'Other venue lift',
    '4242',
    '4243',
  ]) {
    assert.ok(!text.includes(name), name);
  }
  assert.ok(model.connectorStops.every((s) => s.id !== 9006));
});

test('engine.model E10: every node carries its level and ordinal, in the venue frame the metadata names', () => {
  const { b, L0, L1 } = fullVenue();
  const { model } = runPublishEngine(b.build());
  assert.equal(PACKAGE_FRAME, 'VENUE_METRES');
  assert.equal(model.metadata.frame, PACKAGE_FRAME);
  assert.equal(model.metadata.venueCode, 'TESTMALL');
  assert.equal(model.metadata.nodeCount, model.nodes.length);
  assert.equal(model.metadata.edgeCount, model.edges.length);
  const ordinal = new Map([
    [L0, 0],
    [L1, 1],
  ]);
  for (const n of model.nodes) {
    assert.deepEqual(Object.keys(n).sort(), ['id', 'levelId', 'ordinal', 'x', 'y']);
    assert.equal(n.ordinal, ordinal.get(n.levelId));
  }
  for (const e of model.edges) {
    assert.deepEqual(Object.keys(e).sort(), [
      'clearance',
      'connectorId',
      'cost',
      'evacuationOnly',
      'from',
      'kind',
      'length',
      'to',
      'unitId',
    ]);
  }
});

test('engine.model P0-06 §3: each place lists its door nodes, each door and entrance its node, each connector end its node', () => {
  const { b, shop, esc, arcade, cafe } = fullVenue();
  const { model } = runPublishEngine(b.build());
  assert.deepEqual(model.passages, [
    { unitId: arcade.unitId, place: { table: 'Occupant', id: cafe.occupantId } },
  ]);
  const place = model.placeNodes.find((p) => p.table === 'Occupant' && p.id === shop.occupantId);
  const door = model.openingNodes.find((o) => o.openingId === shop.openingIds[0]);
  assert.deepEqual(place.nodeIds, [door.nodeId]);
  const atm = model.placeNodes.find((p) => p.table === 'Amenity');
  assert.equal(atm.nodeIds.length, 1);
  assert.deepEqual([model.nodes[atm.nodeIds[0]].x, model.nodes[atm.nodeIds[0]].y], [12, 2]);
  assert.equal(model.connectorNodes.filter((c) => c.connectorId === esc).length, 2);
});

test('engine.model EC-8: long and non-ASCII names and keywords are carried unchanged', () => {
  const name = `Niño's Ñandú Pasalubong ${'é'.repeat(176)}`.slice(0, 200);
  const keywords = `kakanin, puto, bibingka, ${'ñ'.repeat(375)}`.slice(0, 400);
  const { b, L0 } = corridorWithStore();
  const shop = b.store(L0, [12, 4, 16, 8], {
    name,
    keywords,
    doors: [
      [
        [13, 4],
        [14, 4],
      ],
    ],
  });
  const { model } = runPublishEngine(b.build());
  const row = model.occupants.find((o) => o.id === shop.occupantId);
  assert.equal(row.name.length, 200);
  assert.equal(row.name, name);
  assert.equal(row.keywords, keywords);
});

test('engine.model AC-31: the same draft gives a deep-equal model', () => {
  const draft = fullVenue({ spacing: 1.5 }).b.build();
  assert.deepEqual(runPublishEngine(draft).model, runPublishEngine(structuredClone(draft)).model);
});
