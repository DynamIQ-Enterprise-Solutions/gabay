'use strict';

// FF-3′ A1′b, the finding (spec/P0-03.md r4 AC-107, AC-115; section 3.14.8; DC-25; plan/FF-3-prime-A1.md 1.0 step 11,
// DC-A11): every kind is in the constants file's PublishBlockingKind or PublishWarningKind, exactly section 3.14.8's
// kinds, with its severity fixed by its set and a plain English message from one table; the collector returns the
// finding's shape in AC-115's order. The staleness of the Dart copy is tools:test's (tools/test/closed-sets.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { CLOSED_SETS } = require('../src/config/closedSets');
const {
  createFindings,
  KIND,
  SEVERITY,
  MESSAGES,
  UNREACHABLE_REASON,
  messageOf,
} = require('../src/services/engines/findings');

/** Section 3.14.8's table, in its order. */
const BLOCKING = [
  'INVALID_DOCUMENT',
  'NOTHING_TO_PUBLISH',
  'TENANT_MISMATCH',
  'BEACON_DUPLICATE',
  'BEACON_NAMESPACE',
  'BEACON_MIXED_MAJOR',
  'BEACON_MAJOR_SHARED',
];
const WARNING = [
  'NO_BEACONS_ON_LEVEL',
  'DOOR_WIDTH_UNMEASURED',
  'GRAPH_LARGE',
  'PACKAGE_LARGE',
  'UNREVIEWED',
  'UNREACHABLE',
  'ORPHAN',
  'WALL_CROSSING',
  'NO_ENTRANCE',
  'CONNECTOR_OFF_WALKWAY',
  'CONNECTOR_NO_RISE',
  'OUTSIDE_BOUNDARY',
  'SHAPE_SELF_CROSSING',
  'STORE_WITHOUT_UNIT',
  'STORE_DUPLICATE_UNIT',
  'BEACON_LEVEL_MISSING',
];

test('engine.findings AC-107 (EC-36): the two sets are section 3.14.8 exactly, each with its authority and why it is closed', () => {
  assert.deepEqual([...CLOSED_SETS.PublishBlockingKind.values], BLOCKING);
  assert.deepEqual([...CLOSED_SETS.PublishWarningKind.values], WARNING);
  for (const name of ['PublishBlockingKind', 'PublishWarningKind', 'GraphEdgeKind']) {
    assert.match(CLOSED_SETS[name].authority, /P0-03\.md r4/, name);
    assert.ok(CLOSED_SETS[name].whyClosed.length > 20, name);
  }
  assert.deepEqual(
    [...CLOSED_SETS.EvacuationAmenityType.values],
    ['REFUGE_AREA', 'ASSEMBLY_AREA'],
    'AC-88: the two evacuation amenity types, L87 its authority',
  );
  assert.match(CLOSED_SETS.EvacuationAmenityType.authority, /L87/);
  assert.deepEqual(
    [...CLOSED_SETS.UnreachableReason.values],
    ['no_door', 'cut_off', 'no_way_back'],
    "AC-110's reasons (review I2)",
  );
  assert.match(CLOSED_SETS.UnreachableReason.authority, /AC-110/);
});

/**
 * FF-4's reviewed RoutingGraph reads the package's edge kind as an index into its own enum, `EdgeKind` in
 * app/lib/core/routing/graph/graph_elements.dart on ff4-engine, lines 16 to 25 (walkway, storeCrossing, connector).
 * That file is not on this branch, so its order is copied here; a change on either side must change both.
 */
const ROUTING_GRAPH_EDGE_KIND = ['walkway', 'storeCrossing', 'connector'];

test("engine.findings AC-105, AC-132 (review I1): GraphEdgeKind's order is RoutingGraph's EdgeKind order, index for index", () => {
  const asDart = (code) => code.toLowerCase().replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
  const named = { walk: 'walkway' };
  assert.deepEqual(
    CLOSED_SETS.GraphEdgeKind.values.map((code) => named[asDart(code)] ?? asDart(code)),
    ROUTING_GRAPH_EDGE_KIND,
  );
  assert.deepEqual([...CLOSED_SETS.GraphEdgeKind.values], ['WALK', 'STORE_CROSSING', 'CONNECTOR']);
});

test('engine.findings AC-107 (DC-A11): every kind has a severity in its subset and a message', () => {
  const findings = createFindings();
  for (const kind of [...BLOCKING, ...WARNING]) {
    assert.equal(KIND[kind], kind);
    assert.equal(typeof MESSAGES[kind], 'string', kind);
    assert.ok(MESSAGES[kind].length > 10, kind);
    findings.add(kind, { params: { problem: 'must be a number', reason: 'cut_off' } });
  }
  for (const f of findings.list()) {
    assert.equal(f.severity, BLOCKING.includes(f.kind) ? SEVERITY.BLOCKING : SEVERITY.WARNING);
    assert.ok(f.message.length > 10);
  }
  assert.deepEqual(
    Object.keys(MESSAGES).sort(),
    [...BLOCKING, ...WARNING].sort(),
    'no message for a kind no set has',
  );
  assert.throws(() => findings.add('LIFT_STOPS'), /not a finding kind/, "A1's dropped kind");
});

test("engine.findings AC-108, AC-110: INVALID_DOCUMENT carries the validator's words; UNREACHABLE its reason's", () => {
  assert.equal(
    messageOf(KIND.INVALID_DOCUMENT, { problem: 'must be at most 1', total: 3 }),
    'The map is not valid: must be at most 1',
  );
  const reasons = Object.values(UNREACHABLE_REASON);
  assert.deepEqual(reasons, ['no_door', 'cut_off', 'no_way_back']);
  const words = reasons.map((reason) => messageOf(KIND.UNREACHABLE, { reason }));
  assert.equal(new Set(words).size, 3, 'each reason has its own words');
  assert.equal(messageOf(KIND.NOTHING_TO_PUBLISH, {}), 'Nothing to publish: nothing is drawn yet');
});

test("engine.findings AC-107, AC-115: the finding's shape, and the order: blocking, kind, level, element, x, z", () => {
  const findings = createFindings();
  const l0 = { index: 0, id: 'l0', name: 'Ground' };
  const l1 = { index: 1, id: 'l1', name: 'Upper' };
  findings.add(KIND.UNREVIEWED, { level: l1, order: [2, 0], at: { x: 1, z: 1 } });
  findings.add(KIND.UNREVIEWED, { level: l0, order: [3, 1], at: { x: 1, z: 1 } });
  findings.add(KIND.UNREVIEWED, { level: l0, order: [3, 0], at: { x: 9, z: 9 } });
  findings.add(KIND.UNREVIEWED, { level: l0, order: [3, 0], at: { x: 2, z: 5 } });
  findings.add(KIND.NO_BEACONS_ON_LEVEL, { level: l1 });
  findings.add(KIND.TENANT_MISMATCH, { params: { lookup: 'AmenityType', code: 'X' } });
  findings.add(KIND.INVALID_DOCUMENT, {
    path: 'levels[1]',
    sortKey: [1],
    params: { problem: 'b' },
  });
  findings.add(KIND.INVALID_DOCUMENT, {
    path: 'levels[0]',
    sortKey: [0],
    params: { problem: 'a' },
  });
  const list = findings.list();
  assert.deepEqual(
    list.map((f) => [f.kind, f.levelId, f.at && f.at.x, f.path]),
    [
      ['INVALID_DOCUMENT', null, null, 'levels[0]'],
      ['INVALID_DOCUMENT', null, null, 'levels[1]'],
      ['TENANT_MISMATCH', null, null, null],
      ['NO_BEACONS_ON_LEVEL', 'l1', null, null],
      ['UNREVIEWED', 'l0', 2, null],
      ['UNREVIEWED', 'l0', 9, null],
      ['UNREVIEWED', 'l0', 1, null],
      ['UNREVIEWED', 'l1', 1, null],
    ],
  );
  assert.deepEqual(Object.keys(list[0]), [
    'kind',
    'severity',
    'message',
    'levelId',
    'levelName',
    'element',
    'at',
    'segment',
    'path',
    'params',
  ]);
  assert.equal(list[3].levelName, 'Upper');
});
