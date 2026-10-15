'use strict';

// FF-3′ A1′b, the checks (spec/P0-03.md r4 AC-108 to AC-115; AC-22, AC-23, AC-39, AC-75 and AC-88 kept; L170 Q2,
// Q3; plan/FF-3-prime-A1.md 1.0 step 12): one fixture per finding kind and per UNREACHABLE reason, AC-108's blank-map
// set, a point on the boundary line, hundreds of UNREVIEWED, and one list holding a fault of each kind in AC-115's
// order. Publish blocks only on INVALID_DOCUMENT, NOTHING_TO_PUBLISH, TENANT_MISMATCH and the four beacon kinds;
// every other kind is a warning and the model is built. All rows are in memory (AC-109: the database's own
// constraints stop the first two beacon kinds in stored data). INVENTED DATA ONLY (L48).

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyseMap, runAnalysis } = require('../src/services/engines/publishEngine.service');
const { readLayout } = require('../src/services/engines/layout');
const { createFindings } = require('../src/services/engines/findings');
const { checkLayoutCodes } = require('../src/services/engines/checks/tenantRefs');
const { CLOSED_SETS } = require('../src/config/closedSets');
const {
  makeContext,
  lookupRow,
  lookupRows,
  wall,
  opening,
  unit,
  item,
  correction,
  amenity,
  transitPoint,
  connector,
  rect,
  minimalBuildingDoc,
} = require('./fixtures/mapBuilder');
const {
  snapshotOf,
  canonical,
  venueDoc,
  floor,
  yard,
  storeRow,
  beaconRow,
  TENANT_UUID,
} = require('./fixtures/snapshotBuilder');

// ------------------------------------------------------------------------------------------------- fixtures

const ARRAYS = [
  'walls',
  'openings',
  'units',
  'items',
  'corrections',
  'amenities',
  'transitPoints',
  'anchors',
];

/** The parts merged array by array: { walls, openings, units, ... }. */
function compose(...parts) {
  const out = {};
  for (const part of parts) {
    for (const name of ARRAYS) if (part[name]) out[name] = [...(out[name] ?? []), ...part[name]];
  }
  return out;
}

/** An entrance door on the level's west edge, at z 10. */
const entrance = (id = 'entrance') => ({
  walls: [wall(`${id}-wall`, { a: [0, 8], b: [0, 12] })],
  openings: [opening(id, `${id}-wall`, { at: 0.5, w: 1.2, entrance: true })],
});

/** A store unit with a wall on each side and, unless `door` is false, a door in the middle of its south wall. */
function shop(id, [x0, z0, x1, z1], { door = true, ...over } = {}) {
  return {
    walls: [
      wall(`${id}-n`, { a: [x0, z0], b: [x1, z0] }),
      wall(`${id}-e`, { a: [x1, z0], b: [x1, z1] }),
      wall(`${id}-s`, { a: [x0, z1], b: [x1, z1] }),
      wall(`${id}-w`, { a: [x0, z0], b: [x0, z1] }),
    ],
    openings: door ? [opening(`${id}-door`, `${id}-s`, { at: 0.5, w: 1 })] : [],
    units: [unit(id, { doors: door ? [`${id}-door`] : [], poly: rect(x0, z0, x1, z1), ...over })],
  };
}

/** One 20 x 20 m level of building b1 with the parts given. */
const oneLevel = (...parts) => venueDoc({ levels: [floor('l1', compose(...parts))] });

const kinds = (findings) => findings.map((f) => f.kind);
const ofKind = (findings, kind) => findings.filter((f) => f.kind === kind);
const blocking = (findings) => findings.filter((f) => f.severity === 'blocking');

// ------------------------------------------------------------------------------------- AC-108 INVALID_DOCUMENT

test('engine.checks AC-108, AC-115: an invalid layout gives INVALID_DOCUMENT per problem, the row findings, and stops', () => {
  const snapshot = snapshotOf(oneLevel(entrance(), shop('u1', [4, 2, 10, 6])), {
    stores: [storeRow(1, 'u1'), storeRow(2, 'gone')],
    beacons: [beaconRow(41, 'l1'), beaconRow(42, 'l1', { minor: 41 })],
  });
  snapshot.layout = structuredClone(snapshot.layout);
  snapshot.layout.levels[0].walls[1].t = 5;
  const { findings, model } = analyseMap(snapshot);
  assert.equal(model, null);
  const [invalid] = ofKind(findings, 'INVALID_DOCUMENT');
  assert.equal(invalid.severity, 'blocking');
  assert.equal(invalid.path, 'levels[0].walls[1].t');
  assert.equal(invalid.levelId, 'l1');
  assert.deepEqual(invalid.element, { kind: 'wall', id: 'u1-n', name: null });
  assert.match(invalid.message, /^The map is not valid: must be /);
  assert.equal(invalid.params.total, 1);
  assert.deepEqual(
    kinds(findings),
    ['INVALID_DOCUMENT', 'BEACON_DUPLICATE', 'STORE_WITHOUT_UNIT'],
    'the row checks ran; no graph check did (no NO_BEACONS_ON_LEVEL, no UNREACHABLE)',
  );
});

test("engine.checks AC-108: up to the validator's 20 problems, with the total; a path with no level or element has none", () => {
  const walls = Array.from({ length: 25 }, (_, i) =>
    wall(`w${i}`, { a: [1, i * 0.5 + 1], b: [5, i * 0.5 + 1] }),
  );
  const snapshot = snapshotOf(oneLevel({ walls }));
  snapshot.layout = structuredClone(snapshot.layout);
  for (const w of snapshot.layout.levels[0].walls) w.t = 5;
  const invalid = ofKind(analyseMap(snapshot).findings, 'INVALID_DOCUMENT');
  assert.equal(invalid.length, 20);
  assert.ok(invalid.every((f) => f.params.total === 25));
  assert.deepEqual(
    invalid.slice(0, 2).map((f) => f.path),
    ['levels[0].walls[0].t', 'levels[0].walls[1].t'],
    "in the validator's order",
  );
  snapshot.layout = null;
  const [root] = analyseMap(snapshot).findings;
  assert.equal(root.kind, 'INVALID_DOCUMENT');
  assert.equal(root.path, '(document)');
  assert.equal(root.levelId, null);
  assert.equal(root.element, null);
});

// ----------------------------------------------------------------------------------- AC-108 NOTHING_TO_PUBLISH

test('engine.checks AC-108 (Q3 (a), EC-72, EC-74): a blank map is refused, with a backdrop or several empty levels too', () => {
  const backdrop = {
    id: '0123456789abcdef0123456789abcdef',
    cx: 50,
    cz: 40,
    mpp: 0.01,
    opacity: 0.5,
  };
  const minimal = snapshotOf(minimalBuildingDoc());
  const withBackdrop = snapshotOf(minimalBuildingDoc());
  withBackdrop.layout = structuredClone(withBackdrop.layout);
  withBackdrop.layout.levels[0].backdrop = backdrop;
  const several = snapshotOf(
    venueDoc({
      buildings: [
        { id: 'b1', name: 'Main building', type: 'MAIN' },
        { id: 'b2', name: 'Wing', type: 'WING' },
      ],
      levels: [yard('yard'), floor('l1'), floor('l2', { building: 'b2', origin: [20, 0] })],
    }),
  );
  for (const [name, snapshot] of [
    ['minimal', minimal],
    ['with a backdrop', withBackdrop],
    ['several buildings and levels', several],
  ]) {
    const { findings, model } = analyseMap(snapshot);
    const [blank] = blocking(findings);
    assert.equal(blank.kind, 'NOTHING_TO_PUBLISH', name);
    assert.equal(blank.message, 'Nothing to publish: nothing is drawn yet');
    assert.equal(blank.levelId, null);
    assert.equal(blocking(findings).length, 1, name);
    assert.equal(model, null, name);
  }
});

test('engine.checks AC-108: one wall, item, amenity, correction or connector alone is not blank, and publishes', () => {
  const alone = {
    wall: oneLevel({ walls: [wall('w1', { a: [2, 2], b: [6, 2] })] }),
    item: oneLevel({ items: [item('i1', { x: 5, z: 5 })] }),
    amenity: oneLevel({ amenities: [amenity('a1', { at: [5, 5] })] }),
    correction: oneLevel({ corrections: [correction('c1', { poly: rect(2, 2, 4, 4) })] }),
    connector: venueDoc({
      levels: [floor('l1'), floor('l2', { ordinal: 2, elevation: 4.5 })],
      connectors: [
        connector('st', 'stairs', ['l1', 'l2'], {
          x: 10,
          z: 10,
          stops: [
            [10, 10],
            [10, 10],
          ],
        }),
      ],
    }),
  };
  for (const [name, doc] of Object.entries(alone)) {
    const { findings, model } = analyseMap(snapshotOf(doc));
    assert.deepEqual(blocking(findings), [], name);
    assert.ok(model !== null, name);
    assert.ok(kinds(findings).includes('NO_ENTRANCE'), `${name}: its warnings`);
  }
});

// -------------------------------------------------------------------------------------- AC-108 TENANT_MISMATCH

test('engine.checks AC-108 (EC-80): a layout code the snapshot cannot resolve is TENANT_MISMATCH, for each kind of code', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        items: [item('i1', { type: 'PILLAR', x: 5, z: 5 })],
        amenities: [amenity('a1', { type: 'ATM', at: [8, 8] })],
        transitPoints: [transitPoint('t1', { at: [12, 12] })],
      }),
      floor('l2', { ordinal: 2, elevation: 4.5 }),
    ],
    connectors: [
      connector('st', 'stairs', ['l1', 'l2'], {
        x: 10,
        z: 10,
        stops: [
          [10, 10],
          [10, 10],
        ],
      }),
    ],
  });
  const full = makeContext();
  const layout = readLayout(canonical(doc, full), full);
  // The validator's context accepted every code; the snapshot's own read (another moment) has none of them.
  const rows = lookupRows();
  const without = makeContext({
    buildingTypes: rows.buildingTypes.filter((r) => r.code !== 'MAIN'),
    amenityTypes: rows.amenityTypes.filter((r) => r.code !== 'ATM'),
    transitTypes: rows.transitTypes.filter((r) => r.code !== 'TAXI_BAY'),
    connectorTypes: rows.connectorTypes.filter((r) => r.code !== 'STAIRS_STD'),
    objectTypes: [],
  });
  const findings = createFindings();
  checkLayoutCodes(findings, layout, without);
  const list = findings.list();
  assert.deepEqual(
    list.map((f) => [f.element.kind, f.params.lookup, f.params.code]),
    [
      ['building', 'BuildingType', 'MAIN'],
      ['item', 'ObjectType', 'PILLAR'],
      ['amenity', 'AmenityType', 'ATM'],
      ['transitPoint', 'TransitType', 'TAXI_BAY'],
      ['connector', 'ConnectorType', 'STAIRS_STD'],
    ],
  );
  assert.ok(list.every((f) => f.kind === 'TENANT_MISMATCH' && f.severity === 'blocking'));
  const resolved = createFindings();
  checkLayoutCodes(resolved, layout, full);
  assert.deepEqual(resolved.list(), [], 'the same codes resolve in a full read');
});

test("engine.checks AC-108: a store whose category is not this tenant's is TENANT_MISMATCH and blocks", () => {
  const stores = [
    storeRow(4, 'u1', { category: { code: 'OTHER_TENANT_CAT', label: 'X', sortOrder: 0 } }),
  ];
  const { findings, model } = analyseMap(
    snapshotOf(oneLevel(entrance(), shop('u1', [4, 2, 10, 6])), { stores }),
  );
  const [mismatch] = blocking(findings);
  assert.equal(mismatch.kind, 'TENANT_MISMATCH');
  assert.deepEqual(mismatch.element, { kind: 'store', id: 'u1', name: 'Store u1' });
  assert.deepEqual(mismatch.params, {
    lookup: 'OccupantCategory',
    code: 'OTHER_TENANT_CAT',
    occupantId: 4,
  });
  assert.equal(model, null);
});

// ------------------------------------------------------------------------------------------- AC-109 beacons

const twoLevels = () =>
  venueDoc({
    levels: [
      floor('l1', compose(entrance(), { walls: [wall('w1', { a: [15, 2], b: [18, 2] })] })),
      floor('l2', { ordinal: 2, elevation: 4.5 }),
    ],
  });
const beaconFindings = (beacons, opts = {}) =>
  analyseMap(snapshotOf(twoLevels(), { beacons, ...opts })).findings.filter((f) =>
    f.kind.startsWith('BEACON_'),
  );

test('engine.checks AC-109: BEACON_DUPLICATE names every beacon of one identity; inactive ones never count', () => {
  const found = beaconFindings([
    beaconRow(41, 'l1', { minor: 7 }),
    beaconRow(42, 'l1', { minor: 7, proximityUuid: TENANT_UUID.toUpperCase() }),
    beaconRow(43, 'l1', { minor: 7, isActive: false }),
    beaconRow(44, 'l1', { minor: 8 }),
  ]);
  assert.deepEqual(kinds(found), ['BEACON_DUPLICATE']);
  assert.deepEqual(found[0].params.beaconIds, ['41', '42'], 'UUIDs compared without case');
  assert.deepEqual(found[0].element, { kind: 'beacon', id: '41', name: null });
  assert.deepEqual(found[0].at, { x: 10, z: 12.5 }, "the row's x and y");
});

test("engine.checks AC-109: BEACON_NAMESPACE for a beacon outside the tenant's UUID", () => {
  const other = '11111111-2222-4333-8444-555555555555';
  const found = beaconFindings([
    beaconRow(41, 'l1'),
    beaconRow(42, 'l1', { minor: 2, proximityUuid: other }),
  ]);
  assert.deepEqual(kinds(found), ['BEACON_NAMESPACE']);
  assert.equal(found[0].element.id, '42');
  assert.equal(found[0].params.proximityUuid, other);
});

test('engine.checks AC-109 (EC-65): BEACON_MIXED_MAJOR names the level and its Majors, one beacon of each', () => {
  const found = beaconFindings([
    beaconRow(41, 'l1', { major: 1 }),
    beaconRow(42, 'l1', { major: 2, minor: 2 }),
    beaconRow(43, 'l1', { major: 2, minor: 3 }),
    beaconRow(44, 'l2', { major: 3 }),
  ]);
  assert.deepEqual(kinds(found), ['BEACON_MIXED_MAJOR']);
  assert.equal(found[0].levelId, 'l1');
  assert.deepEqual(found[0].params, { majors: [1, 2], beaconIds: ['41', '42'] });
});

test('engine.checks AC-109 (Q2 (a), EC-59, EC-60, EC-61): BEACON_MAJOR_SHARED with another level of this venue or another venue', () => {
  const same = beaconFindings([
    beaconRow(41, 'l1', { major: 5 }),
    beaconRow(42, 'l2', { major: 5 }),
  ]);
  assert.deepEqual(kinds(same), ['BEACON_MAJOR_SHARED']);
  assert.equal(same[0].levelId, 'l1');
  assert.deepEqual(same[0].params, {
    major: 5,
    otherLevelId: 'l2',
    otherLevelName: 'Level l2',
    otherVenueId: null,
    otherVenueName: null,
  });
  const other = beaconFindings(
    [beaconRow(41, 'l1', { major: 5 }), beaconRow(42, 'l2', { major: 6 })],
    {
      otherVenueBeacons: [
        { venueId: 9, venueName: 'Other venue', levelKey: 'x1', major: 5 },
        { venueId: 9, venueName: 'Other venue', levelKey: 'x1', major: 5 },
      ],
    },
  );
  assert.deepEqual(kinds(other), ['BEACON_MAJOR_SHARED'], 'one finding per other level');
  assert.equal(other[0].params.otherVenueName, 'Other venue');
  assert.equal(other[0].params.otherLevelId, 'x1');
  const inactive = beaconFindings([
    beaconRow(41, 'l1', { major: 5 }),
    beaconRow(42, 'l2', { major: 5, isActive: false }),
  ]);
  assert.deepEqual(inactive, [], 'a planned (inactive) beacon is not counted');
});

test('engine.checks AC-109, AC-114 (EC-62, EC-103): one Major per level publishes; a beacon on a missing level is left out of the Major checks', () => {
  const { findings, model } = analyseMap(
    snapshotOf(twoLevels(), {
      beacons: [
        beaconRow(41, 'l1', { major: 1 }),
        beaconRow(42, 'l2', { major: 2 }),
        beaconRow(43, 'gone', { major: 1, minor: 9 }),
      ],
    }),
  );
  assert.deepEqual(blocking(findings), []);
  assert.ok(model !== null);
  const [missing] = ofKind(findings, 'BEACON_LEVEL_MISSING');
  assert.equal(missing.element.id, '43');
  assert.deepEqual(missing.params, { levelKey: 'gone' });
  assert.equal(missing.levelId, null);
});

// --------------------------------------------------------------------------- AC-22, AC-23, AC-75 (kept warnings)

test('engine.checks AC-22: NO_BEACONS_ON_LEVEL for each level with no active beacon', () => {
  const { findings } = analyseMap(
    snapshotOf(twoLevels(), {
      beacons: [beaconRow(41, 'l1'), beaconRow(42, 'l2', { isActive: false })],
    }),
  );
  assert.deepEqual(
    ofKind(findings, 'NO_BEACONS_ON_LEVEL').map((f) => f.levelId),
    ['l2'],
  );
});

test('engine.checks AC-23 (EC-28, DC-B4): DOOR_WIDTH_UNMEASURED for a door with no clearW; a measured door or a window none', () => {
  const doc = oneLevel(entrance(), {
    walls: [wall('w1', { a: [6, 4], b: [16, 4] })],
    openings: [
      opening('measured', 'w1', { at: 0.2, w: 1, clearW: 0.9 }),
      opening('unmeasured', 'w1', { at: 0.5, w: 1 }),
      opening('pane', 'w1', { at: 0.8, w: 1, kind: 'window' }),
    ],
  });
  const found = ofKind(analyseMap(snapshotOf(doc)).findings, 'DOOR_WIDTH_UNMEASURED');
  assert.deepEqual(
    found.map((f) => f.element.id),
    ['entrance', 'unmeasured'],
  );
  assert.deepEqual(found[1].at, { x: 11, z: 4 });
});

test('engine.checks AC-75 (D14, EC-75): GRAPH_LARGE above publish.maxNodesWarn, a warning only', () => {
  const doc = oneLevel(entrance());
  const small = analyseMap(snapshotOf(doc, { publish: { maxNodesWarn: 10 } }));
  const [large] = ofKind(small.findings, 'GRAPH_LARGE');
  assert.equal(large.severity, 'warning');
  assert.ok(large.params.nodeCount > 10);
  assert.equal(large.params.limit, 10);
  assert.ok(small.model !== null);
  assert.deepEqual(ofKind(analyseMap(snapshotOf(doc)).findings, 'GRAPH_LARGE'), []);
});

// ------------------------------------------------------------------------------------------- AC-113 UNREVIEWED

test('engine.checks AC-113 (L170 Q3, DC-24): each flagged element is UNREVIEWED, and the map still publishes', () => {
  const doc = venueDoc({
    buildings: [{ id: 'b1', name: 'Main building', type: 'MAIN', review: true }],
    levels: [
      floor(
        'l1',
        compose(entrance(), {
          walls: [wall('w1', { a: [6, 4], b: [16, 4] })],
          openings: [
            opening('d1', 'w1', { at: 0.2, w: 1, review: true }),
            opening('d2', 'w1', { at: 0.6, w: 1, review: true }),
          ],
          amenities: [amenity('a1', { at: [3, 15], review: true })],
        }),
      ),
    ],
  });
  const { findings, model } = analyseMap(snapshotOf(doc));
  const flagged = ofKind(findings, 'UNREVIEWED');
  assert.deepEqual(
    flagged.map((f) => [f.element.kind, f.element.id, f.levelId]),
    [
      ['building', 'b1', null],
      ['opening', 'd1', 'l1'],
      ['opening', 'd2', 'l1'],
      ['amenity', 'a1', 'l1'],
    ],
  );
  assert.ok(flagged.every((f) => f.severity === 'warning'));
  assert.ok(model !== null, 'L108 is a warning now');
});

test('engine.checks AC-113, AC-115 (EC-78): hundreds of UNREVIEWED are all returned, none dropped', () => {
  const walls = Array.from({ length: 300 }, (_, i) =>
    wall(`w${i}`, {
      a: [1 + (i % 15), 1 + Math.floor(i / 15) * 0.9],
      b: [1.5 + (i % 15), 1 + Math.floor(i / 15) * 0.9],
      review: true,
    }),
  );
  const { findings } = analyseMap(snapshotOf(oneLevel({ walls })));
  const flagged = ofKind(findings, 'UNREVIEWED');
  assert.equal(flagged.length, 300);
  assert.deepEqual(
    flagged.slice(0, 3).map((f) => f.element.id),
    ['w0', 'w1', 'w2'],
    'in document order',
  );
});

// ------------------------------------------------------------------------------------------ AC-110 UNREACHABLE

const unreachable = (findings) =>
  ofKind(findings, 'UNREACHABLE').map((f) => [f.element.id, f.params.reason]);

test('engine.checks AC-110, V-GEO-3 B (EC-106): a store whose unit lists no door is UNREACHABLE, no_door', () => {
  const doc = oneLevel(entrance(), { units: [unit('u1', { poly: rect(4, 2, 10, 6) })] });
  const { findings, model } = analyseMap(snapshotOf(doc, { stores: [storeRow(1, 'u1')] }));
  assert.deepEqual(unreachable(findings), [['u1', 'no_door']]);
  const [f] = ofKind(findings, 'UNREACHABLE');
  assert.equal(f.levelId, 'l1');
  assert.deepEqual(f.element, { kind: 'store', id: 'u1', name: 'Store u1' });
  assert.deepEqual(f.at, { x: 7, z: 4 }, 'no door: shown at the unit');
  assert.equal(f.severity, 'warning');
  assert.ok(model !== null, 'a warning never refuses (L170 Q2)');
});

test('engine.checks AC-110 (EC-106): a store on a walkable unit that lists no door is no_door too', () => {
  const doc = oneLevel(entrance(), {
    units: [unit('kiosk', { category: 'walkway', poly: rect(8, 8, 10, 10) })],
  });
  const { findings } = analyseMap(snapshotOf(doc, { stores: [storeRow(1, 'kiosk')] }));
  assert.deepEqual(unreachable(findings), [['kiosk', 'no_door']]);
});

test("engine.checks AC-110 (AC-95, A1's choice 9): an amenity inside a store is reached through the store's doors", () => {
  const inside = { amenities: [amenity('atm', { type: 'ATM', at: [6, 4] })] };
  const open = oneLevel(entrance(), shop('u1', [4, 2, 10, 6]), inside);
  assert.deepEqual(unreachable(analyseMap(snapshotOf(open)).findings), []);
  const shut = oneLevel(entrance(), shop('u1', [4, 2, 10, 6], { door: false }), inside);
  assert.deepEqual(unreachable(analyseMap(snapshotOf(shut)).findings), [['atm', 'no_door']]);
});

test('engine.checks AC-110, V-GEO-4 (EC-77): a door onto floor a BLOCK_AREA encloses is cut_off; a second door onto the corridor reaches it', () => {
  const pocket = [
    [3, 6],
    [6.6, 6],
    [6.6, 7],
    [7.4, 7],
    [7.4, 6],
    [11, 6],
    [11, 9],
    [3, 9],
  ];
  const doc = (second) =>
    oneLevel(entrance(), shop('u1', [4, 2, 10, 6]), {
      corrections: [correction('c1', { poly: pocket })],
      ...(second
        ? {
            openings: [opening('u1-side', 'u1-e', { at: 0.5, w: 1 })],
          }
        : {}),
    });
  const shut = analyseMap(snapshotOf(doc(false), { stores: [storeRow(1, 'u1')] }));
  assert.deepEqual(unreachable(shut.findings), [['u1', 'cut_off']]);
  const twoDoors = doc(true);
  twoDoors.levels[0].units[0].doors.push('u1-side');
  const open = analyseMap(snapshotOf(twoDoors, { stores: [storeRow(1, 'u1')] }));
  assert.deepEqual(unreachable(open.findings), []);
});

/** Two levels 4.5 m apart: the entrance below, a store above, joined by `connectors`. */
function upstairs(connectors, extra = {}) {
  return venueDoc({
    levels: [
      floor('l1', compose(entrance())),
      floor('l2', compose({ ordinal: 2 }, shop('up', [4, 2, 10, 6]), extra)),
    ].map((level, i) => (i === 1 ? { ...level, ordinal: 2, elevation: 4.5 } : level)),
    connectors,
  });
}
const escalator = (over = {}) =>
  connector('esc', 'escalator', ['l1', 'l2'], {
    x: 15,
    z: 15,
    stops: [
      [15, 15],
      [15, 15],
    ],
    ...over,
  });

test('engine.checks AC-110, EC-96: a one-way escalator up with no way down is no_way_back; with twoWay it is reached', () => {
  const stores = [storeRow(1, 'up')];
  const oneWay = analyseMap(snapshotOf(upstairs([escalator()]), { stores }));
  assert.deepEqual(unreachable(oneWay.findings), [['up', 'no_way_back']]);
  const twoWay = analyseMap(snapshotOf(upstairs([escalator({ twoWay: true })]), { stores }));
  assert.deepEqual(unreachable(twoWay.findings), []);
});

test('engine.checks AC-110, EC-97 (DC-38): evacuation-only stairs as the only way give cut_off; their edges stay', () => {
  const stairs = connector('evac', 'stairs', ['l1', 'l2'], {
    x: 15,
    z: 15,
    stops: [
      [15, 15],
      [15, 15],
    ],
    evacuationOnly: true,
  });
  const result = runAnalysis(snapshotOf(upstairs([stairs]), { stores: [storeRow(1, 'up')] }));
  assert.deepEqual(unreachable(result.findings), [['up', 'cut_off']]);
  assert.ok(
    result.graph.csr.edgeFlags.some((f) => f === 1),
    'flagged edges in the graph',
  );
});

test('engine.checks AC-88 (R29, EC-50): an evacuation amenity reached only over evacuation stairs is not checked; a CR there is', () => {
  const context = makeContext({
    amenityTypes: [
      ...lookupRows().amenityTypes,
      lookupRow('REFUGE_AREA'),
      lookupRow('ASSEMBLY_AREA'),
    ],
  });
  const stairs = connector('evac', 'stairs', ['l1', 'l2'], {
    x: 15,
    z: 15,
    stops: [
      [15, 15],
      [15, 15],
    ],
    evacuationOnly: true,
  });
  const doc = upstairs([stairs], {
    amenities: [
      amenity('refuge', { type: 'REFUGE_AREA', at: [16, 4] }),
      amenity('cr', { type: 'CR', at: [16, 8] }),
    ],
  });
  const { findings } = analyseMap(snapshotOf(doc, { context }));
  assert.deepEqual(
    unreachable(findings),
    [['cr', 'cut_off']],
    'the refuge area is left out; the CR is not, and neither is the store-less floor',
  );
});

test('engine.checks AC-110 (EC-29): a section with no door of its own is reached through its parent; an unreachable parent leaves it unreachable', () => {
  const section = unit('sec', { parent: 'u1', poly: rect(5, 3, 7, 5) });
  const reached = oneLevel(entrance(), shop('u1', [4, 2, 10, 6]), { units: [section] });
  const stores = [storeRow(1, 'u1'), storeRow(2, 'sec')];
  assert.deepEqual(unreachable(analyseMap(snapshotOf(reached, { stores })).findings), []);
  const shut = oneLevel(entrance(), shop('u1', [4, 2, 10, 6], { door: false }), {
    units: [section],
  });
  assert.deepEqual(unreachable(analyseMap(snapshotOf(shut, { stores })).findings), [
    ['u1', 'no_door'],
    ['sec', 'no_door'],
  ]);
});

test('engine.checks AC-110, AC-97 (EC-95): a REMOVE_PATH that cuts a place off gives UNREACHABLE', () => {
  // A wall from the north edge down to z 14 leaves the store's corner reached only round its south end; the
  // REMOVE_PATH along z 16 to 19 removes that way.
  const parts = [
    entrance(),
    shop('u1', [14, 2, 19, 6]),
    { walls: [wall('split', { a: [12, 0], b: [12, 15.5] })] },
  ];
  const stores = [storeRow(1, 'u1')];
  assert.deepEqual(
    unreachable(analyseMap(snapshotOf(oneLevel(...parts), { stores })).findings),
    [],
  );
  const cut = {
    corrections: [
      {
        id: 'cut',
        kind: 'REMOVE_PATH',
        line: [
          [12, 15],
          [12, 20],
        ],
      },
    ],
  };
  const { findings, model } = analyseMap(snapshotOf(oneLevel(...parts, cut), { stores }));
  assert.deepEqual(unreachable(findings), [['u1', 'cut_off']]);
  assert.ok(model !== null);
});

test('engine.checks AC-98, AC-110 (EC-73): with no entrance the fallback reaches places; when it joins nothing, every place is cut off', () => {
  const stores = [storeRow(1, 'u1')];
  const fallback = analyseMap(snapshotOf(oneLevel(shop('u1', [4, 2, 10, 6])), { stores }));
  assert.ok(kinds(fallback.findings).includes('NO_ENTRANCE'));
  assert.deepEqual(
    unreachable(fallback.findings),
    [],
    "the bottom edge's middle reaches the store",
  );
  const blockedBelow = venueDoc({
    levels: [
      floor('l0', {
        ordinal: 0,
        elevation: -4.5,
        corrections: [correction('all', { poly: rect(0, 0, 20, 20) })],
      }),
      floor('l1', compose(shop('u1', [4, 2, 10, 6]))),
    ],
  });
  const none = analyseMap(snapshotOf(blockedBelow, { stores }));
  assert.deepEqual(unreachable(none.findings), [['u1', 'cut_off']]);
});

// ---------------------------------------------------------------------------------------------- AC-111 ORPHAN

test('engine.checks AC-111 (DC-36): a walled-off pocket of floor is one ORPHAN with a point inside it', () => {
  const pocket = {
    walls: [
      wall('p-n', { a: [12, 12], b: [18, 12] }),
      wall('p-e', { a: [18, 12], b: [18, 18] }),
      wall('p-s', { a: [12, 18], b: [18, 18] }),
      wall('p-w', { a: [12, 12], b: [12, 18] }),
    ],
  };
  const { findings } = analyseMap(snapshotOf(oneLevel(entrance(), pocket)));
  const orphans = ofKind(findings, 'ORPHAN');
  assert.equal(orphans.length, 1);
  const [{ at, levelId, params }] = orphans;
  assert.equal(levelId, 'l1');
  assert.ok(at.x > 12 && at.x < 18 && at.z > 12 && at.z < 18, JSON.stringify(at));
  assert.ok(params.nodeCount > 1);
});

test('engine.checks AC-111 (AC-97): an ADD_PATH whose ends join nothing is an ORPHAN; a lone unjoined door is not', () => {
  const doc = oneLevel(entrance(), {
    corrections: [
      correction('void', { poly: rect(8, 8, 18, 18) }),
      {
        id: 'lost',
        kind: 'ADD_PATH',
        line: [
          [11, 13],
          [15, 13],
        ],
      },
    ],
    walls: [wall('inner', { a: [10, 16], b: [16, 16] })],
    openings: [opening('nowhere', 'inner', { at: 0.5, w: 1 })],
  });
  const orphans = ofKind(analyseMap(snapshotOf(doc)).findings, 'ORPHAN');
  assert.deepEqual(
    orphans.map((f) => f.at),
    [{ x: 11, z: 13 }],
    "the ADD_PATH's first vertex; the door inside the void is its own part, not an orphan",
  );
});

// ---------------------------------------------------------------------------------------- AC-112 data warnings

test('engine.checks AC-112, AC-101 (DC-35, EC-99): a connector between levels of one elevation is CONNECTOR_NO_RISE', () => {
  const doc = venueDoc({
    levels: [floor('l1', compose(entrance())), floor('l2', { ordinal: 2 })],
    connectors: [
      connector('flat', 'stairs', ['l1', 'l2'], {
        x: 15,
        z: 15,
        stops: [
          [15, 15],
          [15, 15],
        ],
      }),
    ],
  });
  const result = runAnalysis(snapshotOf(doc));
  const [flat] = ofKind(result.findings, 'CONNECTOR_NO_RISE');
  assert.deepEqual(flat.element, { kind: 'connector', id: 'flat', name: 'stairs flat' });
  assert.deepEqual(flat.params, { levels: [['l1', 'l2']] });
  const k = result.graph.csr.edgeOrigin.findIndex(
    (o, i) => o === 3 && result.graph.csr.edgeRef[i] === 0,
  );
  assert.equal(result.costs.costS[k], 1.5, 'the base alone');
});

test('engine.checks AC-112 (DC-12, invariant 10): OUTSIDE_BOUNDARY for each kind of element; a point on the line is inside', () => {
  const doc = venueDoc({
    levels: [
      floor(
        'l1',
        compose(entrance(), {
          units: [unit('u-out', { poly: rect(14, 2, 18, 6) })],
          amenities: [amenity('a-on', { at: [12, 5] }), amenity('a-out', { at: [13, 8] })],
          items: [item('i-out', { x: 16, z: 10 })],
          corrections: [correction('c-out', { poly: rect(13, 12, 15, 14) })],
        }),
      ),
      floor('l2', { ordinal: 2, elevation: 4.5 }),
    ],
    connectors: [
      connector('st', 'stairs', ['l1', 'l2'], {
        x: 13,
        z: 17,
        stops: [
          [5, 17],
          [13, 17],
        ],
      }),
    ],
  });
  doc.site.boundary = rect(0, 0, 12, 20);
  const { findings } = analyseMap(
    snapshotOf(doc, { beacons: [beaconRow(41, 'l1', { x: '16.000', y: '1.000' })] }),
  );
  assert.deepEqual(
    ofKind(findings, 'OUTSIDE_BOUNDARY').map((f) => [f.element.kind, f.element.id, f.at.x]),
    [
      ['unit', 'u-out', 14],
      ['item', 'i-out', 16],
      ['correction', 'c-out', 13],
      ['amenity', 'a-out', 13],
      ['beacon', '41', 16],
      ['connector', 'st', 13],
    ],
    'a-on, exactly on the line, is inside; the stairs stop on l1 is inside, the one on l2 (the next level) is not',
  );
});

test('engine.checks AC-112 (OA-1 DC-16, EC-27): SHAPE_SELF_CROSSING for a unit and for the site boundary', () => {
  const bowtie = [
    [2, 2],
    [10, 2],
    [10, 8],
    [6, 1],
    [2, 8],
  ];
  const doc = oneLevel(entrance(), { units: [unit('u-x', { poly: bowtie })] });
  // Its last two edges dip from z 150 to z 0 and back, through its first edge at z 10.
  doc.site.boundary = [
    [0, 10],
    [200, 10],
    [200, 150],
    [100, 0],
    [0, 150],
  ];
  const found = ofKind(analyseMap(snapshotOf(doc)).findings, 'SHAPE_SELF_CROSSING');
  assert.deepEqual(
    found.map((f) => [f.element && f.element.id, f.params.shape ?? null]),
    [
      [null, 'boundary'],
      ['u-x', null],
    ],
  );
});

// ------------------------------------------------------------------------------------------ AC-114 the rows

test('engine.checks AC-114 (DC-27, EC-102): STORE_WITHOUT_UNIT and STORE_DUPLICATE_UNIT name the stores left out', () => {
  const doc = oneLevel(entrance(), shop('u1', [4, 2, 10, 6]), {
    amenities: [amenity('am1', { at: [15, 15] })],
  });
  const stores = [
    storeRow(8, 'u1', { name: 'Second on u1' }),
    storeRow(5, 'u1'),
    storeRow(6, 'gone'),
    storeRow(7, 'am1', { name: 'On an amenity' }),
    storeRow(9, 'u1', { isActive: false }),
  ];
  const { findings, model } = analyseMap(snapshotOf(doc, { stores }));
  assert.deepEqual(
    ofKind(findings, 'STORE_WITHOUT_UNIT').map((f) => [f.element.id, f.params.occupantId]),
    [
      ['gone', 6],
      ['am1', 7],
    ],
  );
  const [dup] = ofKind(findings, 'STORE_DUPLICATE_UNIT');
  assert.deepEqual(dup.element, { kind: 'store', id: 'u1', name: 'Second on u1' });
  assert.deepEqual(dup.params, { occupantId: 8, unitKey: 'u1', keptOccupantId: 5 });
  assert.equal(dup.levelId, 'l1');
  assert.ok(model !== null);
});

// ------------------------------------------------------------------------------------------- AC-115 the order

test('engine.checks AC-115: one fault of each kind gives one list holding all of them, in the constants file order', () => {
  const doc = venueDoc({
    buildings: [{ id: 'b1', name: 'Main building', type: 'MAIN' }],
    levels: [
      floor(
        'l1',
        compose(shop('u1', [4, 2, 10, 6]), {
          units: [
            unit('u-nodoor', { poly: rect(2, 10, 5, 13), review: true }),
            unit('u-x', {
              poly: [
                [6, 10],
                [9, 10],
                [9, 13],
                [7.5, 9.5],
                [6, 13],
              ],
            }),
          ],
          walls: [
            wall('p-n', { a: [13, 13], b: [19, 13] }),
            wall('p-e', { a: [19, 13], b: [19, 19] }),
            wall('p-s', { a: [13, 19], b: [19, 19] }),
            wall('p-w', { a: [13, 13], b: [13, 19] }),
            wall('short', { a: [10, 15.5], b: [12, 15.5] }),
          ],
          corrections: [
            {
              id: 'through',
              kind: 'ADD_PATH',
              line: [
                [11, 14.6],
                [11, 16.4],
              ],
            },
          ],
          amenities: [amenity('a-out', { at: [19.5, 1] })],
        }),
      ),
      // At l1's elevation (one floor, D6), all blocked; the stairs' landings stand inside store u1, so neither
      // joins a walkway.
      floor('l2', { ordinal: 2, corrections: [correction('all', { poly: rect(0, 0, 20, 20) })] }),
    ],
    connectors: [
      connector('flat', 'stairs', ['l1', 'l2'], {
        x: 7,
        z: 4,
        stops: [
          [7, 4],
          [7, 4],
        ],
      }),
    ],
  });
  doc.site.boundary = rect(0, 0, 19, 20);
  const stores = [
    storeRow(1, 'u-nodoor', { category: { code: 'ELSEWHERE', label: 'X', sortOrder: 0 } }),
    storeRow(2, 'gone'),
    storeRow(3, 'u1'),
    storeRow(4, 'u1'),
  ];
  const beacons = [
    beaconRow(41, 'l1', { major: 1, minor: 7 }),
    beaconRow(42, 'l1', { major: 1, minor: 7 }),
    beaconRow(43, 'l1', {
      major: 2,
      minor: 3,
      proximityUuid: '11111111-2222-4333-8444-555555555555',
    }),
    beaconRow(44, 'gone', { minor: 4 }),
  ];
  const { findings } = analyseMap(
    snapshotOf(doc, {
      stores,
      beacons,
      otherVenueBeacons: [{ venueId: 9, venueName: 'Other', levelKey: 'x1', major: 1 }],
      publish: { maxNodesWarn: 10 },
    }),
  );
  const order = [
    ...CLOSED_SETS.PublishBlockingKind.values,
    ...CLOSED_SETS.PublishWarningKind.values,
  ];
  const seen = [...new Set(kinds(findings))];
  const expected = order.filter(
    (k) => !['INVALID_DOCUMENT', 'NOTHING_TO_PUBLISH', 'PACKAGE_LARGE'].includes(k),
  );
  assert.deepEqual(
    seen,
    expected,
    'every kind but the three that cannot share a list with the rest',
  );
  const ranks = kinds(findings).map((k) => order.indexOf(k));
  assert.deepEqual(
    ranks,
    [...ranks].sort((p, q) => p - q),
    'blocking first, then by the kind',
  );
  const again = analyseMap(
    snapshotOf(doc, {
      stores,
      beacons,
      otherVenueBeacons: [{ venueId: 9, venueName: 'Other', levelKey: 'x1', major: 1 }],
      publish: { maxNodesWarn: 10 },
    }),
  ).findings;
  assert.deepEqual(again, findings, 'the same snapshot, the same list (AC-31)');
});
