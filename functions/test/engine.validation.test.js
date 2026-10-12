'use strict';

// FF-3 A1, validation (spec/P0-03.md r2 §3.2 and §3.3, AC-11 to AC-23 and AC-75; DC-1, DC-11; rulings D4, D5, D7,
// D8, D9): every check runs on every publish, every problem is returned with its kind, level and element and/or
// location, and warnings never refuse. In-memory drafts only (the integration halves are api-coder's A2).

const test = require('node:test');
const assert = require('node:assert/strict');
const { runPublishEngine } = require('../src/services/engines/publishEngine.service');
const { closedSet } = require('../src/config/closedSets');
const {
  draftBuilder,
  corridorWithStore,
  line,
  polygon,
  rectPolygon,
  OTHER_TENANT_ID,
  TENANT_UUID,
} = require('./fixtures/draftBuilder');

const kinds = (list) => list.map((p) => p.kind);
const ofKind = (list, kind) => list.filter((p) => p.kind === kind);
const ids = (list) => list.map((p) => p.element && p.element.id);

/** Two floors 4.5 m apart, both a 20 x 4 m corridor; the entrance below. */
function twoFloors() {
  const b = draftBuilder();
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5 });
  b.walkway(L0, [0, 0, 20, 4]);
  b.walkway(L1, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  return { b, L0, L1 };
}

test("engine.validation DC-11: every issue has the plan's shape and a kind from the constants file", () => {
  const { b, L0 } = corridorWithStore();
  b.unit(L0, [30, 30, 31, 31], { needsReview: true, name: 'Draft kiosk' });
  b.opening(
    L0,
    b.rows.units[1].unitid,
    [
      [5, 6],
      [5, 7],
    ],
    { widthM: null },
  );
  const { problems, warnings } = runPublishEngine(b.build());
  assert.ok(problems.length > 0 && warnings.length > 0);
  for (const issue of [...problems, ...warnings]) {
    assert.deepEqual(Object.keys(issue).sort(), [
      'at',
      'element',
      'kind',
      'levelId',
      'params',
      'segment',
      'severity',
    ]);
  }
  for (const p of problems) {
    assert.equal(p.severity, 'problem');
    assert.ok(closedSet('PublishProblemKind').includes(p.kind));
  }
  for (const w of warnings) {
    assert.equal(w.severity, 'warning');
    assert.ok(closedSet('PublishWarningKind').includes(w.kind));
  }
});

test('engine.validation EC-5, AC-22: walkways with no places publish, with "No beacons on this level"', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 10, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const { problems, warnings, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.ok(model);
  assert.deepEqual(
    warnings.map((w) => [w.kind, w.levelId]),
    [['NO_BEACONS_ON_LEVEL', L0]],
  );
});

test('engine.validation AC-11: every unreviewed unit, opening, floor object and connector is listed with its level', () => {
  const { b, L0, L1 } = twoFloors();
  const unit = b.unit(L0, [12, 6, 14, 8], { needsReview: true, name: 'Generated room' });
  const shop = b.store(L0, [2, 4, 6, 8], { name: 'Shop', doors: [] });
  const door = b.opening(
    L0,
    shop.unitId,
    [
      [3, 4],
      [4, 4],
    ],
    { needsReview: true, name: 'Door 7' },
  );
  const pillar = b.floorObject(L0, { center: [15, 2], width: 0.5, depth: 0.5, needsReview: true });
  const stairs = b.connector('STAIRS', [L0, 18, 2], [L1, 18, 2], {
    needsReview: true,
    name: 'Stairs B',
  });
  const { problems, model } = runPublishEngine(b.build());
  assert.equal(model, null);
  const unreviewed = ofKind(problems, 'UNREVIEWED');
  assert.deepEqual(
    unreviewed.map((p) => [p.element.table, p.element.id, p.element.name, p.levelId]),
    [
      ['Unit', unit, 'Generated room', L0],
      ['Opening', door, 'Door 7', L0],
      ['FloorObject', pillar, null, L0],
      ['NavConnector', stairs, 'Stairs B', L0],
    ],
  );
  for (const p of unreviewed)
    assert.ok(p.at && Number.isFinite(p.at.x) && Number.isFinite(p.at.y), 'shown on the map');
});

test('engine.validation AC-11 (EC-9): three hundred unreviewed elements are all listed', () => {
  const { b, L0 } = corridorWithStore();
  for (let i = 0; i < 300; i += 1)
    b.unit(
      L0,
      [30 + (i % 20), 30 + Math.floor(i / 20), 30.5 + (i % 20), 30.5 + Math.floor(i / 20)],
      { needsReview: true },
    );
  const { problems } = runPublishEngine(b.build());
  assert.equal(ofKind(problems, 'UNREVIEWED').length, 300);
});

test('engine.validation AC-12: an ADD_PATH through a wall is refused at the crossing point', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 10, 4]);
  b.walkway(L0, [0, 8, 10, 12]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.unit(L0, [0, 4, 10, 8], { name: 'Solid block' });
  const path = b.correction(L0, 'ADD_PATH', line([5, 3], [5, 9]));
  const { problems } = runPublishEngine(b.build());
  const crossing = ofKind(problems, 'WALL_CROSSING');
  assert.ok(crossing.length >= 1);
  assert.deepEqual(crossing[0].element, { table: 'NavCorrection', id: path, name: null });
  assert.deepEqual(crossing[0].at, { x: 5, y: 4 });
  assert.equal(crossing[0].levelId, L0);
  assert.deepEqual(crossing[0].segment, [
    [5, 3],
    [5, 9],
  ]);
});

test('engine.validation AC-12 (D4): an ADD_PATH through a blocking floor object is refused; one through door gaps is not', () => {
  const blocked = draftBuilder();
  const B0 = blocked.level();
  blocked.walkway(B0, [0, 0, 20, 4]);
  blocked.entrance(B0, [0, 1], [0, 3]);
  blocked.floorObject(B0, { center: [5, 2], width: 1, depth: 1 });
  blocked.correction(B0, 'ADD_PATH', line([2, 2], [8, 2]));
  const refused = runPublishEngine(blocked.build()).problems;
  assert.deepEqual(
    ofKind(refused, 'WALL_CROSSING').map((p) => p.at),
    [{ x: 4.5, y: 2 }],
  );

  const gaps = draftBuilder();
  const G0 = gaps.level();
  gaps.walkway(G0, [0, 0, 10, 4]);
  gaps.walkway(G0, [0, 8, 10, 12]);
  gaps.entrance(G0, [0, 1], [0, 3]);
  const room = gaps.unit(G0, [0, 4, 10, 8], { name: 'Room with two doors' });
  gaps.opening(G0, room, [
    [4, 4],
    [6, 4],
  ]);
  gaps.opening(G0, room, [
    [4, 8],
    [6, 8],
  ]);
  gaps.correction(G0, 'ADD_PATH', line([5, 3], [5, 9]));
  const { problems } = runPublishEngine(gaps.build());
  assert.deepEqual(ofKind(problems, 'WALL_CROSSING'), []);
  assert.deepEqual(problems, []);
});

test('engine.validation AC-13 (D5): an occupant is reached through at least one of its doors', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  b.store(L0, [5, 4, 10, 10], {
    doors: [
      [
        [7, 4],
        [8, 4],
      ],
      [
        [5, 8],
        [5, 9],
      ],
    ],
  }); // the side door faces nothing
  assert.deepEqual(runPublishEngine(b.build()).problems, []);
});

test('engine.validation AC-13 (D5, EC-25): a one-way escalator up with no way down leaves the upper places unreachable', () => {
  const { b, L0, L1 } = twoFloors();
  b.connector('ESCALATOR', [L0, 10, 2], [L1, 10, 2], { bidirectional: false });
  const upstairs = b.store(L1, [5, 4, 9, 8], {
    name: 'Upstairs shop',
    doors: [
      [
        [6, 4],
        [7, 4],
      ],
    ],
  });
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(ids(ofKind(problems, 'UNREACHABLE')), [upstairs.occupantId]);
  assert.deepEqual(ofKind(problems, 'ORPHAN'), [], 'joined, only not both ways');
});

test('engine.validation AC-13 (D5, EC-26): evacuation-only stairs do not count; ordinary stairs do (no step-free check)', () => {
  const evac = twoFloors();
  evac.b.connector('STAIRS', [evac.L0, 10, 2], [evac.L1, 10, 2], { evacuationOnly: true });
  const shop = evac.b.store(evac.L1, [5, 4, 9, 8], {
    doors: [
      [
        [6, 4],
        [7, 4],
      ],
    ],
  });
  assert.deepEqual(ids(ofKind(runPublishEngine(evac.b.build()).problems, 'UNREACHABLE')), [
    shop.occupantId,
  ]);

  const stairs = twoFloors();
  stairs.b.connector('STAIRS', [stairs.L0, 10, 2], [stairs.L1, 10, 2]);
  stairs.b.store(stairs.L1, [5, 4, 9, 8], {
    doors: [
      [
        [6, 4],
        [7, 4],
      ],
    ],
  });
  assert.deepEqual(
    runPublishEngine(stairs.b.build()).problems,
    [],
    'stairs only, and that is enough at publish',
  );
});

test('engine.validation AC-13 (EC-29): a nested section without a door is reached through its parent; not if the parent is cut off', () => {
  const ok = draftBuilder();
  const L0 = ok.level();
  ok.walkway(L0, [0, 0, 20, 4]);
  ok.entrance(L0, [0, 1], [0, 3]);
  const parent = ok.store(L0, [5, 4, 15, 12], {
    name: 'Department store',
    doors: [
      [
        [9, 4],
        [11, 4],
      ],
    ],
  });
  ok.store(L0, [6, 6, 9, 9], { name: 'Shoes section', parent: parent.unitId });
  assert.deepEqual(runPublishEngine(ok.build()).problems, []);

  const cut = draftBuilder();
  const C0 = cut.level();
  cut.walkway(C0, [0, 0, 20, 4]);
  cut.entrance(C0, [0, 1], [0, 3]);
  const closed = cut.store(C0, [5, 6, 15, 12], {
    name: 'Department store',
    doors: [
      [
        [9, 12],
        [11, 12],
      ],
    ],
  });
  const section = cut.store(C0, [6, 7, 9, 9], { name: 'Shoes section', parent: closed.unitId });
  const unreachable = ofKind(runPublishEngine(cut.build()).problems, 'UNREACHABLE');
  assert.deepEqual(ids(unreachable).sort(), [closed.occupantId, section.occupantId].sort());
});

test('engine.validation AC-13: amenities, transit points and anchors are reached at their own position', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.walkway(L0, [20, -6, 30, 10], { name: 'Atrium' });
  b.entrance(L0, [0, 1], [0, 3]);
  b.amenity(L0, 12, 2, { typeId: 12, name: 'ATM' });
  const restroom = b.unit(L0, [2, 4, 6, 8], { name: 'Restroom', category: 'restroom' });
  b.opening(L0, restroom, [
    [3, 4],
    [4, 4],
  ]);
  b.amenity(L0, 4, 6, { unitId: restroom, name: 'CR' });
  b.anchor(L0, 25, 2, { name: 'Fountain' });
  const lost = b.transitPoint(L0, 15, 30, { name: 'Lost jeepney bay' });
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'UNREACHABLE').map((p) => [p.element.table, p.element.id, p.at]),
    [['TransitPoint', lost, { x: 15, y: 30 }]],
  );
});

test('engine.validation AC-13: an inactive occupant is not a place', () => {
  const { b, L0 } = corridorWithStore();
  b.store(L0, [12, 6, 16, 10], { name: 'Closed for good', doors: [], active: false });
  assert.deepEqual(runPublishEngine(b.build()).problems, []);
});

test('engine.validation AC-14: a walkway part not joined to the entrances is an orphan', () => {
  const { b, L0 } = corridorWithStore();
  b.walkway(L0, [0, 20, 10, 24]);
  const { problems } = runPublishEngine(b.build());
  const orphans = ofKind(problems, 'ORPHAN');
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0].levelId, L0);
  assert.deepEqual(orphans[0].at, { x: 0, y: 20 });
  assert.equal(orphans[0].params.nodeCount, 11 * 5);
});

test('engine.validation AC-14 (DC-6): an ADD_PATH whose ends join nothing is an orphan, named', () => {
  const { b, L0 } = corridorWithStore();
  const stray = b.correction(L0, 'ADD_PATH', line([40, 40], [45, 40]));
  const orphans = ofKind(runPublishEngine(b.build()).problems, 'ORPHAN');
  assert.deepEqual(
    orphans.map((p) => p.element),
    [{ table: 'NavCorrection', id: stray, name: null }],
  );
});

test('engine.validation AC-13 (EC-24): a REMOVE_PATH that cuts a place off refuses it as unreachable', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const far = b.store(L0, [15, 4, 19, 8], {
    name: 'Far shop',
    doors: [
      [
        [16, 4],
        [17, 4],
      ],
    ],
  });
  b.correction(L0, 'REMOVE_PATH', line([12.5, -1], [12.5, 5]));
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(ids(ofKind(problems, 'UNREACHABLE')), [far.occupantId]);
  assert.equal(ofKind(problems, 'ORPHAN').length, 1);
});

test('engine.validation AC-15 (a): a stairs, escalator or ramp row with no other end, or both ends on one level', () => {
  const { b, L0 } = twoFloors();
  const noTo = b.connector('STAIRS', [L0, 2, 2], null, { name: 'Half stairs' });
  const flat = b.connector('ESCALATOR', [L0, 4, 2], [L0, 8, 2], { name: 'Flat escalator' });
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'CONNECTOR_UNPAIRED').map((p) => p.element.id),
    [noTo, flat],
  );
});

test('engine.validation AC-15 (b): a lift needs two stops on different levels', () => {
  const { b, L0 } = twoFloors();
  const lonely = b.lift([[L0, 4, 2]], { name: 'Lift one stop' });
  const flat = b.lift(
    [
      [L0, 8, 2],
      [L0, 12, 2],
    ],
    { name: 'Lift one level' },
  );
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'LIFT_STOPS').map((p) => [p.element.id, p.params.levelCount]),
    [
      [lonely.connectorId, 1],
      [flat.connectorId, 1],
    ],
  );
});

test('engine.validation AC-15 (c, EC-23): a connector end or lift stop off the walkable area is refused, shown at that end', () => {
  const { b, L0, L1 } = twoFloors();
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 50, 50], { name: 'Into the void' });
  const lift = b.lift(
    [
      [L0, 18, 2],
      [L1, 18, 9],
    ],
    { name: 'Lift B' },
  );
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'CONNECTOR_OFF_WALKWAY').map((p) => [
      p.element.table,
      p.element.id,
      p.levelId,
      p.at,
    ]),
    [
      ['NavConnector', esc, L1, { x: 50, y: 50 }],
      ['NavConnectorStop', lift.stopIds[1], L1, { x: 18, y: 9 }],
    ],
  );
});

test('engine.validation AC-15 (d, EC-22): stairs, escalators and ramps need RiseM; a lift does not', () => {
  const { b, L0, L1 } = twoFloors();
  const stairs = b.connector('STAIRS', [L0, 4, 2], [L1, 4, 2], { riseM: null });
  const ramp = b.connector('RAMP', [L0, 8, 2], [L1, 8, 2], { riseM: null });
  b.connector('ESCALATOR', [L0, 12, 2], [L1, 12, 2], { riseM: 4.5 });
  b.lift(
    [
      [L0, 16, 2],
      [L1, 16, 2],
    ],
    { riseM: null },
  );
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'CONNECTOR_NO_RISE').map((p) => p.element.id),
    [stairs, ramp],
  );
  assert.equal(problems.length, 2);
});

test('engine.validation AC-16 (DC-12): every element outside the boundary is refused; on the line counts as inside', () => {
  const b = draftBuilder({ boundary: [0, 0, 30, 10] });
  const L0 = b.level();
  b.walkway(L0, [0, 0, 30, 4]); // its edges lie on the boundary line
  b.entrance(L0, [0, 1], [0, 3]); // on the boundary line
  b.transitPoint(L0, 30, 2, { name: 'Bay at the edge' }); // on the boundary line (L30)
  const overhang = b.unit(L0, [25, 5, 35, 8], { name: 'Overhang' });
  const outsideAtm = b.amenity(L0, 40, 2, { typeId: 12 });
  const beacon = b.beacon(L0, -5, 2);
  const path = b.correction(L0, 'ADD_PATH', line([20, 2], [20, 12]));
  const lift = b.lift([
    [L0, 10, 2],
    [b.level({ ordinal: 1, elevationM: 5 }), 10, 12],
  ]);
  const { problems } = runPublishEngine(b.build());
  const outside = ofKind(problems, 'OUTSIDE_BOUNDARY').map((p) => [p.element.table, p.element.id]);
  assert.deepEqual(outside, [
    ['Unit', overhang],
    ['Amenity', outsideAtm],
    ['NavConnectorStop', lift.stopIds[1]],
    ['Beacon', Number(beacon)],
    ['NavCorrection', path],
  ]);
});

test('engine.validation AC-17 (EC-30): duplicate identities and foreign namespaces among active beacons; a shared Major is fine', () => {
  const { b, L0, L1 } = twoFloors();
  b.connector('STAIRS', [L0, 18, 2], [L1, 18, 2]);
  const a = b.beacon(L0, 2, 2, { major: 1, minor: 5 });
  const c = b.beacon(L1, 2, 2, { major: 1, minor: 5 }); // the same identity on another level
  b.beacon(L1, 6, 2, { major: 1, minor: 6 }); // the same Major on two levels: not checked (D9)
  b.beacon(L0, 8, 2, { major: 1, minor: 5, active: false }); // an inactive copy: not checked
  const foreign = b.beacon(L0, 10, 2, {
    major: 2,
    minor: 1,
    uuid: '00000000-0000-4000-8000-000000000001',
  });
  const { problems, warnings } = runPublishEngine(b.build());
  assert.deepEqual(
    ids(ofKind(problems, 'BEACON_DUPLICATE')),
    [Number(a), Number(c)],
    'both beacons are shown',
  );
  assert.deepEqual(ofKind(problems, 'BEACON_DUPLICATE')[0].params, {
    uuid: TENANT_UUID,
    major: 1,
    minor: 5,
    otherBeaconIds: [Number(c)],
  });
  assert.deepEqual(ids(ofKind(problems, 'BEACON_NAMESPACE')), [Number(foreign)]);
  assert.equal(problems.length, 3);
  assert.deepEqual(
    ofKind(warnings, 'NO_BEACONS_ON_LEVEL'),
    [],
    'both levels have an active beacon',
  );
});

test('engine.validation AC-18: an element whose shape cannot be read is named and refused', () => {
  const { b, L0 } = corridorWithStore();
  const broken = b.unit(
    L0,
    {
      type: 'Polygon',
      coordinates: [
        [
          [30, 30],
          [32, 30],
          [32, 32],
          [30, 32],
        ],
      ],
    },
    { name: 'Open ring' },
  );
  const bowtie = b.floorObject(L0, {
    center: [3, 2],
    kind: 'POLYGON',
    geometry: polygon([
      [2, 1],
      [4, 3],
      [4, 1],
      [2, 3],
    ]),
  });
  const pointDoor = b.opening(L0, null, { type: 'Point', coordinates: [1, 1] }, { entrance: true });
  const block = b.correction(L0, 'BLOCK_AREA', line([1, 1], [2, 2]));
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'SHAPE_UNREADABLE').map((p) => [
      p.element.table,
      p.element.id,
      p.element.name,
    ]),
    [
      ['Unit', broken, 'Open ring'],
      ['Opening', pointDoor, null],
      ['FloorObject', bowtie, null],
      ['NavCorrection', block, null],
    ],
  );
});

test('engine.validation AC-18 (P0-01 AC-34): a zero-size venue boundary cannot be read', () => {
  const { b } = corridorWithStore();
  b.boundary(rectPolygon([0, 0, 0, 0]));
  const { problems } = runPublishEngine(b.build());
  const venue = ofKind(problems, 'SHAPE_UNREADABLE').filter((p) => p.element.table === 'Venue');
  assert.equal(venue.length, 1);
  assert.equal(venue[0].element.name, 'Test Mall');
});

test("engine.validation AC-19 (EC-11): an element that references another tenant's lookup row refuses the publish", () => {
  const { b, L0, L1 } = twoFloors();
  b.lookups.connectorTypes.push({
    connectortypeid: 95,
    tenantid: OTHER_TENANT_ID,
    code: 'ESCALATOR',
    label: 'Their escalator',
    costmodel: 'ESCALATOR',
    isstepfree: false,
    costbasem: '1.000',
    costperrisem: '1.000',
    sortorder: 0,
    isactive: true,
  });
  b.lookups.amenityTypes.push({
    amenitytypeid: 96,
    tenantid: OTHER_TENANT_ID,
    code: 'CR',
    label: 'Their CR',
    searchsynonyms: null,
    isaccessible: false,
    sortorder: 0,
    isactive: true,
  });
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 10, 2], { typeId: 95 });
  const atm = b.amenity(L0, 12, 2, { typeId: 96 });
  const { problems } = runPublishEngine(b.build());
  assert.deepEqual(
    ofKind(problems, 'TENANT_MISMATCH').map((p) => [p.element.table, p.element.id, p.params]),
    [
      ['Amenity', atm, { lookup: 'AmenityType', lookupId: 96 }],
      ['NavConnector', esc, { lookup: 'ConnectorType', lookupId: 95 }],
    ],
  );
});

test('engine.validation AC-20 (EC-4): no levels, or no walkable area, is "Nothing to publish"', () => {
  const none = draftBuilder();
  const empty = runPublishEngine(none.build());
  assert.deepEqual(kinds(empty.problems), ['NOTHING_TO_PUBLISH']);
  assert.deepEqual(empty.problems[0], {
    kind: 'NOTHING_TO_PUBLISH',
    severity: 'problem',
    levelId: null,
    element: null,
    at: null,
    segment: null,
    params: {},
  });

  const bare = draftBuilder();
  const L0 = bare.level();
  bare.unit(L0, [0, 0, 10, 10], { name: 'Plant room' });
  assert.deepEqual(kinds(runPublishEngine(bare.build()).problems), ['NOTHING_TO_PUBLISH']);
});

test('engine.validation AC-21 (DC-1): one fault of each kind, all listed in one response', () => {
  const { b, L0, L1 } = twoFloors();
  b.unit(L0, [40, 40, 41, 41], { needsReview: true }); // UNREVIEWED
  b.unit(L0, [0, 4, 4, 8], { name: 'Block' });
  b.correction(L0, 'ADD_PATH', line([2, 3], [2, 6])); // WALL_CROSSING
  b.store(L1, [5, 4, 9, 8], {
    doors: [
      [
        [6, 4],
        [7, 4],
      ],
    ],
  }); // UNREACHABLE: no connector up
  b.walkway(L0, [0, 20, 6, 24]); // ORPHAN
  b.connector('STAIRS', [L0, 12, 2], null); // CONNECTOR_UNPAIRED
  b.lift([[L0, 14, 2]]); // LIFT_STOPS
  b.connector('ESCALATOR', [L0, 16, 2], [L1, 16, 30]); // CONNECTOR_OFF_WALKWAY
  b.connector('RAMP', [L0, 18, 2], [L1, 18, 2], { riseM: null }); // CONNECTOR_NO_RISE
  b.amenity(L0, 500, 500, { typeId: 12 }); // OUTSIDE_BOUNDARY (and so unreachable as well)
  b.beacon(L0, 1, 1, { minor: 9 });
  b.beacon(L1, 1, 1, { minor: 9 }); // BEACON_DUPLICATE
  b.beacon(L0, 3, 1, { uuid: '00000000-0000-4000-8000-000000000002' }); // BEACON_NAMESPACE
  b.unit(L0, {
    type: 'Polygon',
    coordinates: [
      [
        [50, 50],
        [51, 50],
        [51, 51],
      ],
    ],
  }); // SHAPE_UNREADABLE
  b.lookups.objectTypes.push({
    ...b.lookups.objectTypes[0],
    objecttypeid: 97,
    tenantid: OTHER_TENANT_ID,
  });
  b.floorObject(L0, { center: [19, 3.5], width: 0.2, depth: 0.2, typeId: 97 }); // TENANT_MISMATCH
  const { problems, model } = runPublishEngine(b.build());
  assert.equal(model, null);
  const expected = closedSet('PublishProblemKind').filter((k) => k !== 'NOTHING_TO_PUBLISH');
  assert.deepEqual([...new Set(kinds(problems))].sort(), [...expected].sort());

  const nothing = draftBuilder();
  const N0 = nothing.level();
  nothing.unit(N0, [0, 0, 5, 5], { needsReview: true });
  nothing.unit(N0, {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  });
  assert.deepEqual(kinds(runPublishEngine(nothing.build()).problems).sort(), [
    'NOTHING_TO_PUBLISH',
    'SHAPE_UNREADABLE',
    'UNREVIEWED',
  ]);
});

test('engine.validation AC-22 (D8, EC-6, EC-30): "No beacons on this level" for each level without an active beacon, and no other beacon warning', () => {
  const { b, L0, L1 } = twoFloors();
  b.connector('STAIRS', [L0, 10, 2], [L1, 10, 2]);
  const L2 = b.level({ ordinal: 2, elevationM: 9, name: 'Empty roof' });
  b.beacon(L0, 4, 2);
  b.beacon(L1, 4, 2, { active: false });
  const { problems, warnings, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, [], 'a warning never refuses; the empty level raises no problem');
  assert.deepEqual(
    warnings.map((w) => [w.kind, w.levelId]),
    [
      ['NO_BEACONS_ON_LEVEL', L1],
      ['NO_BEACONS_ON_LEVEL', L2],
    ],
  );
  assert.equal(
    model.nodes.filter((n) => n.levelId === L2).length,
    0,
    'the empty level adds no node',
  );
});

test('engine.validation AC-23 (EC-28): an unmeasured door is a warning, never a refusal', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3], { widthM: 2 });
  const shop = b.store(L0, [5, 4, 10, 10], { doors: [] });
  const door = b.opening(
    L0,
    shop.unitId,
    [
      [7, 4],
      [8.5, 4],
    ],
    { widthM: null },
  );
  const { problems, warnings, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.ok(model);
  const unmeasured = ofKind(warnings, 'DOOR_WIDTH_UNMEASURED');
  assert.deepEqual(
    unmeasured.map((w) => [w.element.table, w.element.id, w.levelId, w.at]),
    [['Opening', door, L0, { x: 7.75, y: 4 }]],
  );
});

test('engine.validation AC-75 (D14): a graph above publish.maxNodesWarn is a warning, never a refusal', () => {
  const { b } = corridorWithStore({ maxNodesWarn: 50 });
  const { problems, warnings, model } = runPublishEngine(b.build());
  assert.deepEqual(problems, []);
  assert.ok(model);
  const large = ofKind(warnings, 'GRAPH_LARGE');
  assert.equal(large.length, 1);
  assert.deepEqual(large[0].params, { nodeCount: model.nodes.length, limit: 50 });
  const { b: small } = corridorWithStore({ maxNodesWarn: 100000 });
  assert.deepEqual(ofKind(runPublishEngine(small.build()).warnings, 'GRAPH_LARGE'), []);
});
