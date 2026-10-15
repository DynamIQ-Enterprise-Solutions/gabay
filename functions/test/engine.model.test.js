'use strict';

// FF-3′ A1′b, the package model (spec/P0-03.md r4 AC-116, AC-99, AC-105; AC-36, AC-46, AC-49, AC-72 and AC-79 kept;
// L176; plan/FF-3-prime-A1.md 1.0 section 2 and step 13): the plain object stage B's writer turns into bytes holds the
// allow-listed document and row fields and nothing beyond them (the seal, AC-46), string ids, the buildings in the
// document's order with their positions, the CSR graph with its stored costs, kinds, refs, level spans and flags in
// RoutingGraph's layout, every place with its door nodes joined or not, the passages, the wall segments and the
// routing.* settings. Rewritten from A1's engine.model on venue map documents. INVENTED DATA ONLY (L48).

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyseMap, runAnalysis } = require('../src/services/engines/publishEngine.service');
const {
  PACKAGE_ALLOW_LIST,
  PACKAGE_SECTIONS,
} = require('../src/services/engines/packageAllowList');
const {
  makeContext,
  lookupRows,
  lookupRow,
  wall,
  opening,
  unit,
  item,
  correction,
  amenity,
  transitPoint,
  anchor,
  connector,
  rect,
  fullDoc,
} = require('./fixtures/mapBuilder');
const { snapshotOf, venueDoc, floor, storeRow, beaconRow } = require('./fixtures/snapshotBuilder');
const { edgesOf } = require('./fixtures/graphAsserts');
const { closedSet } = require('../src/config/closedSets');
const { NO_CLEARANCE_M } = require('../src/services/engines/constants');

/** Each GraphEdgeKind's index, as the model's kind array holds it (the constants file's order). */
const KIND_INDEX = Object.fromEntries(closedSet('GraphEdgeKind').map((code, i) => [code, i]));

/** An 8 x 6 m level with a store on its north half, one of each point place, an item, and a lift to a second level. */
function smallMall() {
  return venueDoc({
    buildings: [
      { id: 'b1', name: 'Main', type: 'MAIN', footprint: rect(0, 0, 8, 6) },
      { id: 'b2', name: 'Wing', type: 'WING', mapUp: 90 },
    ],
    levels: [
      floor('l1', {
        size: [8, 6],
        walls: [wall('w1', { a: [0, 3], b: [8, 3] })],
        openings: [
          opening('o1', 'w1', { at: 0.5, w: 1, entrance: true, clearW: 0.9, name: 'Main door' }),
        ],
        units: [unit('u1', { name: 'Shop', doors: ['o1'], poly: rect(0, 0, 8, 3) })],
        items: [item('i1', { type: 'PILLAR', x: 6, z: 5 })],
        amenities: [amenity('a1', { at: [1, 5] })],
        transitPoints: [transitPoint('t1', { at: [3, 5], note: 'Gate 2' })],
        anchors: [anchor('n1', { at: [7, 4] })],
      }),
      floor('l2', { ordinal: 2, elevation: 4.5, size: [8, 6] }),
    ],
    connectors: [
      connector('lift', 'elevator', ['l1', 'l2'], {
        x: 4,
        z: 4.5,
        stops: [
          [4, 4.5],
          [4, 4.5],
        ],
      }),
    ],
  });
}
const SMALL_ROWS = {
  stores: [storeRow(5, 'u1', { name: 'Niño Café' })],
  beacons: [
    beaconRow(41, 'l1', { x: '2.000', y: '5.500', mountHeightM: '2.50', measuredPower: -59 }),
  ],
};

test('engine.model AC-116, AC-79, AC-131: a fixture model equals its hand-written expectation', () => {
  const { model, findings } = analyseMap(snapshotOf(smallMall(), SMALL_ROWS));
  assert.deepEqual(
    findings.map((f) => f.kind),
    ['NO_BEACONS_ON_LEVEL'],
  );
  const box = (x0, z0, x1, z1) => rect(x0, z0, x1, z1);
  assert.deepEqual(Object.keys(model), [...PACKAGE_SECTIONS]);
  assert.deepEqual(model.metadata, { venueCode: 'TEST' });
  assert.deepEqual(model.venue, {
    code: 'TEST',
    name: 'Test venue',
    evacEscalatorsAllowed: false,
    boundary: box(0, 0, 200, 150),
    georeference: null,
    mapUp: 0,
  });
  assert.deepEqual(model.buildings, [
    {
      id: 'b1',
      position: 0,
      name: 'Main',
      typeCode: 'MAIN',
      typeLabel: 'MAIN',
      typeSortOrder: 0,
      footprint: box(0, 0, 8, 6),
      mapUp: 0,
    },
    {
      id: 'b2',
      position: 1,
      name: 'Wing',
      typeCode: 'WING',
      typeLabel: 'WING',
      typeSortOrder: 0,
      footprint: null,
      mapUp: 90,
    },
  ]);
  const level = (id, position, ordinal, elevation) => ({
    id,
    position,
    building: 'b1',
    ordinal,
    outdoor: false,
    name: `Level ${id}`,
    shortName: id,
    spokenName: null,
    elevation,
    origin: [0, 0],
    size: [8, 6],
    height: 3,
  });
  assert.deepEqual(model.levels, [level('l1', 0, 1, 0), level('l2', 1, 2, 4.5)]);
  assert.deepEqual(model.units, [
    {
      id: 'u1',
      position: 0,
      level: 'l1',
      category: 'room',
      name: 'Shop',
      outline: box(0, 0, 8, 3),
      walkable: false,
      passThrough: false,
      parent: null,
      doors: ['o1'],
    },
  ]);
  assert.deepEqual(model.openings, [
    {
      id: 'o1',
      level: 'l1',
      midpoint: [4, 3],
      width: 1,
      kind: 'door',
      entrance: true,
      clearW: 0.9,
      name: 'Main door',
    },
  ]);
  assert.deepEqual(model.items, [
    {
      id: 'i1',
      level: 'l1',
      typeCode: 'PILLAR',
      label: null,
      centre: [6, 5],
      rot: 0,
      size: { w: 0.5, d: 0.5, h: 3 },
      blocks: true,
      round: false,
    },
  ]);
  assert.deepEqual(model.stores, [
    {
      placeId: 'u1',
      name: 'Niño Café',
      categoryCode: 'FASHION',
      categoryLabel: 'Fashion',
      categorySortOrder: 0,
      keywords: null,
      spokenName: null,
      statusCode: 'OPEN',
      statusLabel: 'Open',
      statusSortOrder: 0,
      isRoutable: true,
    },
  ]);
  assert.deepEqual(model.amenities, [
    {
      id: 'a1',
      level: 'l1',
      unit: null,
      name: null,
      at: [1, 5],
      typeCode: 'CR',
      typeLabel: 'CR',
      typeSortOrder: 0,
      synonyms: null,
      isAccessible: false,
    },
  ]);
  assert.deepEqual(model.transitPoints, [
    {
      id: 't1',
      level: 'l1',
      name: 'Taxi bay',
      note: 'Gate 2',
      at: [3, 5],
      typeCode: 'TAXI_BAY',
      typeLabel: 'TAXI_BAY',
      typeSortOrder: 0,
    },
  ]);
  assert.deepEqual(model.anchors, [
    { id: 'n1', level: 'l1', unit: null, name: 'Landmark', at: [7, 4] },
  ]);
  assert.deepEqual(model.connectors, [
    {
      id: 'lift',
      position: 0,
      name: 'elevator lift',
      spokenName: null,
      kind: 'elevator',
      typeCode: 'LIFT_STD',
      typeLabel: 'LIFT_STD',
      typeSortOrder: 0,
      isStepFree: true,
      stops: [
        { level: 'l1', x: 4, z: 4.5 },
        { level: 'l2', x: 4, z: 4.5 },
      ],
      twoWay: false,
      preferred: false,
      evacuationOnly: false,
    },
  ]);
  assert.deepEqual(model.beacons, [
    {
      uuid: '0f8e2c1a-4b6d-4e8f-9a1b-2c3d4e5f6a7b',
      major: 1,
      minor: 41,
      level: 'l1',
      x: 2,
      z: 5.5,
      mountHeightM: 2.5,
      measuredPower: -59,
    },
  ]);
  const seg = (x1, z1, x2, z2) => ({ level: 'l1', x1, z1, x2, z2 });
  assert.deepEqual(
    model.walls,
    [
      seg(0, 3, 3.5, 3),
      seg(4.5, 3, 8, 3),
      seg(0, 0, 8, 0),
      seg(8, 0, 8, 3),
      seg(8, 3, 4.5, 3),
      seg(3.5, 3, 0, 3),
      seg(0, 3, 0, 0),
    ],
    "AC-94: the wall split at its door, then the store's outline split at it",
  );
  const { graph } = model;
  assert.deepEqual(graph.levels, ['l1', 'l2']);
  assert.deepEqual(graph.stores, [{ id: 'u1', passThrough: false, isRoutable: true }]);
  assert.deepEqual(graph.connectors, [
    { id: 'lift', costModel: 'ELEVATOR', name: 'elevator lift' },
  ]);
  const door = graph.places[0].doorNodes[0];
  assert.deepEqual(graph.entrances, [door]);
  assert.deepEqual(
    graph.places.map((p) => [p.id, p.kind, p.levelId, p.name, p.doorNodes.length, p.storeId]),
    [
      ['u1', 'store', 'l1', 'Niño Café', 1, 'u1'],
      ['a1', 'amenity', 'l1', null, 1, null],
      ['t1', 'transitPoint', 'l1', 'Taxi bay', 1, null],
      ['n1', 'anchor', 'l1', 'Landmark', 1, null],
    ],
  );
  assert.deepEqual(graph.passages, []);
  assert.deepEqual(model.routingSettings, [
    { key: 'routing.otherWayMarginS', value: 0.417 },
    { key: 'routing.stairsSaveS', value: 120 },
    { key: 'routing.stepFreeMinWidthM', value: 1.2 },
    { key: 'routing.storeCrossingFactor', value: 1.25 },
    { key: 'routing.walkSpeedMps', value: 1.2 },
  ]);
});

test("engine.model AC-105, AC-132 (DC-42): the graph's typed arrays, in RoutingGraph's layout", () => {
  const { model } = analyseMap(snapshotOf(smallMall(), SMALL_ROWS));
  const { graph } = model;
  const types = {
    x: Float64Array,
    z: Float64Array,
    levelIndex: Int32Array,
    offsets: Int32Array,
    targets: Int32Array,
    costS: Float64Array,
    lengthM: Float64Array,
    clearanceM: Float32Array,
    kind: Uint8Array,
    ref: Int32Array,
    levelSpan: Int16Array,
    flags: Uint8Array,
  };
  for (const [name, Type] of Object.entries(types)) assert.ok(graph[name] instanceof Type, name);
  const edges = graph.targets.length;
  for (const name of ['costS', 'lengthM', 'clearanceM', 'kind', 'ref', 'levelSpan', 'flags']) {
    assert.equal(graph[name].length, edges, name);
  }
  assert.equal(graph.offsets.length, graph.nodeCount + 1);
  assert.equal(graph.offsets[graph.nodeCount], edges);
  const csr = { nodeCount: graph.nodeCount, offsets: graph.offsets, targets: graph.targets };
  const rides = edgesOf(csr).filter(({ k }) => graph.kind[k] === KIND_INDEX.CONNECTOR);
  assert.equal(rides.length, 2, 'the lift, both ways');
  for (const { from, to, k } of rides) {
    assert.equal(graph.ref[k], 0, "the lift's index in graph.connectors");
    assert.equal(graph.levelSpan[k], 1);
    assert.equal(graph.costS[k], 5.8);
    assert.equal(graph.lengthM[k], 0);
    assert.equal(graph.clearanceM[k], NO_CLEARANCE_M, 'no clearance: the sentinel (review nit 1)');
    assert.notEqual(graph.levelIndex[from], graph.levelIndex[to]);
  }
  for (let k = 0; k < edges; k += 1) {
    assert.ok(Number.isFinite(graph.costS[k]) && graph.costS[k] >= 0, `cost ${k}`);
    assert.equal(Math.round(graph.costS[k] * 1000) / 1000, graph.costS[k], 'stored to 0.001 s');
    assert.equal(Math.round(graph.lengthM[k] * 1000) / 1000, graph.lengthM[k], 'stored to 0.001 m');
    if (graph.kind[k] === KIND_INDEX.WALK)
      assert.equal(graph.ref[k], -1, 'a walkway names nothing');
  }
});

test('engine.model AC-46, AC-49, AC-116: the seal: nothing beyond the allow-list, no review flag, backdrop, correction, note or other row', () => {
  const doc = fullDoc();
  const context = makeContext();
  const rows = {
    stores: [
      storeRow(1, 'u-1', { name: 'Kept store' }),
      storeRow(2, 'u-1', { name: 'SEALED-SECOND-STORE' }),
      storeRow(3, 'u-2', { name: 'SEALED-INACTIVE-STORE', isActive: false }),
    ],
    beacons: [
      beaconRow(41, 'lvl-1', { major: 1 }),
      beaconRow(42, 'lvl-1', { major: 1, minor: 99, isActive: false }),
      beaconRow(43, 'gone', { major: 1, minor: 98 }),
    ],
    otherVenueBeacons: [
      {
        venueId: 9,
        venueName: 'SEALED-OTHER-VENUE',
        levelKey: 'x1',
        levelName: 'SEALED-OTHER-LEVEL',
        major: 77,
      },
    ],
  };
  const snapshot = snapshotOf(doc, { context, ...rows });
  snapshot.layout = structuredClone(snapshot.layout);
  snapshot.layout.levels[1].backdrop = structuredClone(doc.levels[1].backdrop);
  const { model, findings } = analyseMap(snapshot);
  assert.deepEqual(
    findings.filter((f) => f.severity === 'blocking'),
    [],
    'fullDoc publishes with warnings only',
  );
  for (const [name, list] of Object.entries(model)) {
    if (name === 'graph') continue;
    const rows = Array.isArray(list) ? list : [list];
    for (const row of rows) assert.deepEqual(Object.keys(row), [...PACKAGE_ALLOW_LIST[name]], name);
  }
  assert.deepEqual(Object.keys(model.graph), [...PACKAGE_ALLOW_LIST.graph]);
  for (const [list, rowsOf] of [
    ['graphStores', model.graph.stores],
    ['graphConnectors', model.graph.connectors],
    ['graphPlaces', model.graph.places],
    ['graphPassages', model.graph.passages],
    ['connectorStops', model.connectors.flatMap((c) => c.stops)],
  ]) {
    for (const row of rowsOf)
      assert.deepEqual(Object.keys(row), [...PACKAGE_ALLOW_LIST[list]], list);
  }
  const text = JSON.stringify(model, (_key, value) => (ArrayBuffer.isView(value) ? [] : value));
  for (const sealed of [
    '"review"',
    'backdrop',
    '0123456789abcdef0123456789abcdef',
    'finish',
    'carpet',
    'oak',
    'Wet floor',
    '"c-1"',
    '"c-2"',
    '"c-3"',
    'SEALED-SECOND-STORE',
    'SEALED-INACTIVE-STORE',
    'SEALED-OTHER-VENUE',
    'SEALED-OTHER-LEVEL',
    '"minor":99',
    '"minor":98',
    'publish.',
    'nodeSpacingM',
    'bodyMarginM',
    'catalog',
    'createdBy',
    'tenant',
  ]) {
    assert.ok(!text.includes(sealed), `the model holds ${sealed}`);
  }
  assert.ok(text.includes('Level 1 entrance'), "a transit point's note is the shopper's (AC-116)");
  assert.ok(text.includes('Kept store'));
});

test('engine.model AC-99, V-GEO-3 B, V-GEO-4 (EC-77): a place with no door has an empty list; an unjoined door node is kept, edgeless', () => {
  const pocket = [
    [3, 6],
    [4.6, 6],
    [4.6, 7],
    [5.4, 7],
    [5.4, 6],
    [7, 6],
    [7, 9],
    [3, 9],
  ];
  const doc = venueDoc({
    levels: [
      floor('l1', {
        size: [12, 12],
        walls: [
          wall('edge', { a: [0, 10], b: [0, 12] }),
          wall('s', { a: [8, 6], b: [2, 6] }),
          wall('n', { a: [2, 2], b: [8, 2] }),
          wall('e', { a: [8, 2], b: [8, 6] }),
          wall('w', { a: [2, 6], b: [2, 2] }),
        ],
        openings: [
          opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true }),
          opening('o1', 's', { at: 0.5, w: 0.9 }),
        ],
        units: [
          unit('u1', { doors: ['o1'], poly: rect(2, 2, 8, 6) }),
          unit('u2', { poly: rect(9, 1, 11, 3) }),
        ],
        corrections: [correction('c1', { poly: pocket })],
      }),
    ],
  });
  const { model, findings } = analyseMap(
    snapshotOf(doc, { stores: [storeRow(1, 'u1'), storeRow(2, 'u2')] }),
  );
  const { graph } = model;
  const [shut, doorless] = graph.places;
  assert.equal(shut.id, 'u1');
  const [door] = shut.doorNodes;
  assert.equal(graph.offsets[door + 1] - graph.offsets[door], 0, 'the door node has no edges');
  assert.deepEqual([graph.x[door], graph.z[door]], [5, 6], 'and stays at its midpoint');
  assert.deepEqual(doorless, {
    id: 'u2',
    kind: 'store',
    levelId: 'l1',
    name: 'Store u2',
    doorNodes: [],
    storeId: 'u2',
  });
  assert.deepEqual(
    findings.filter((f) => f.kind === 'UNREACHABLE').map((f) => [f.element.id, f.params.reason]),
    [
      ['u1', 'cut_off'],
      ['u2', 'no_door'],
    ],
  );
});

test('engine.model AC-116 (EC-8, EC-79): names with ñ and at the full 200 characters pass through unchanged', () => {
  const long = `Parañaque ${'ñ'.repeat(190)}`;
  assert.equal(long.length, 200);
  const doc = smallMall();
  doc.levels[0].units[0].name = long;
  doc.connectors[0].name = long;
  doc.levels[0].openings[0].name = long;
  const { model } = analyseMap(
    snapshotOf(doc, {
      ...SMALL_ROWS,
      stores: [storeRow(5, 'u1', { name: long, keywords: 'niño, NIÑO' })],
    }),
  );
  assert.equal(model.units[0].name, long);
  assert.equal(model.connectors[0].name, long);
  assert.equal(model.graph.connectors[0].name, long);
  assert.equal(model.openings[0].name, long);
  assert.equal(model.stores[0].name, long);
  assert.equal(model.stores[0].keywords, 'niño, NIÑO');
  assert.equal(model.graph.places[0].name, long);
});

test("engine.model AC-116, AC-131 (L176): buildings, levels and connectors in the document's order, each with its position", () => {
  const doc = smallMall();
  doc.buildings = [
    { id: 'z-wing', name: 'Wing', type: 'WING' },
    { id: 'a-main', name: 'Main', type: 'MAIN' },
    { id: 'b1', name: 'Third', type: 'WING' },
  ];
  const { model } = analyseMap(snapshotOf(doc, SMALL_ROWS));
  assert.deepEqual(
    model.buildings.map((b) => [b.id, b.position]),
    [
      ['z-wing', 0],
      ['a-main', 1],
      ['b1', 2],
    ],
    'the first entry is the main building, whatever its type code (L176)',
  );
});

test('engine.model AC-72, AC-120: a tenant override of routing.* is the value in the model; no publish.* key is', () => {
  const { model } = analyseMap(
    snapshotOf(smallMall(), {
      ...SMALL_ROWS,
      routing: { storeCrossingFactor: 1.5, otherWayMarginS: 0.5 },
      publish: { maxNodesWarn: 99999 },
    }),
  );
  const value = (key) => model.routingSettings.find((s) => s.key === key).value;
  assert.equal(value('routing.storeCrossingFactor'), 1.5);
  assert.equal(value('routing.otherWayMarginS'), 0.5);
  assert.ok(model.routingSettings.every((s) => s.key.startsWith('routing.')));
});

test('engine.model AC-36 (EC-47, EC-104): a deactivated lookup row the map still names keeps its label and code', () => {
  const rows = lookupRows();
  const context = makeContext({
    amenityTypes: rows.amenityTypes.map((r) =>
      r.code === 'CR' ? lookupRow('CR', { isActive: false }) : r,
    ),
    connectorTypes: rows.connectorTypes.map((r) =>
      r.code === 'LIFT_STD' ? lookupRow('LIFT_STD', { costModel: 'ELEVATOR', isActive: false }) : r,
    ),
  });
  const { model } = analyseMap(snapshotOf(smallMall(), { ...SMALL_ROWS, context }));
  assert.equal(model.amenities[0].typeCode, 'CR');
  assert.equal(model.amenities[0].typeLabel, 'CR');
  assert.equal(model.connectors[0].typeLabel, 'LIFT_STD');
  assert.equal(model.graph.connectors[0].costModel, 'ELEVATOR');
});

test("engine.model AC-39, AC-104 (DC-B7): the graph's stores and passages; a crossed unit with no store row has no routable flag", () => {
  const walls = [
    wall('edge', { a: [0, 0], b: [0, 4] }),
    wall('s1-n', { a: [5, 4], b: [10, 4] }),
    wall('s1-s', { a: [5, 11], b: [10, 11] }),
    wall('cafe-n', { a: [6, 15], b: [9, 15] }),
  ];
  const openings = [
    opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true }),
    opening('s1-front', 's1-n', { at: 0.5, w: 1.5 }),
    opening('s1-back', 's1-s', { at: 0.5, w: 1.5 }),
    opening('cafe-door', 'cafe-n', { at: 0.5, w: 1 }),
  ];
  const units = [
    unit('west', { poly: rect(0, 4, 5, 11) }),
    unit('s1', { passThrough: true, doors: ['s1-front', 's1-back'], poly: rect(5, 4, 10, 11) }),
    unit('east', { poly: rect(10, 4, 20, 11) }),
    unit('cafe', { doors: ['cafe-door'], poly: rect(6, 15, 9, 19) }),
  ];
  const doc = venueDoc({ levels: [floor('l1', { size: [20, 19], walls, openings, units })] });
  const result = runAnalysis(snapshotOf(doc, { stores: [storeRow(3, 'cafe')] }));
  const { graph } = result.model;
  assert.deepEqual(graph.stores, [
    { id: 's1', passThrough: true, isRoutable: null },
    { id: 'cafe', passThrough: false, isRoutable: true },
  ]);
  assert.deepEqual(graph.passages, [{ storeId: 's1', serves: ['cafe'] }]);
  const csr = { nodeCount: graph.nodeCount, offsets: graph.offsets, targets: graph.targets };
  const crossings = edgesOf(csr).filter(({ k }) => graph.kind[k] === KIND_INDEX.STORE_CROSSING);
  assert.equal(crossings.length, 6);
  for (const { k } of crossings) assert.equal(graph.ref[k], 0, "s1's index in graph.stores");
});
