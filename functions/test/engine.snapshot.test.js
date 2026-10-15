'use strict';

// FF-3′ A1′a, the engine's input (spec/P0-03.md r4 AC-89, AC-117; plan/FF-3-prime-A1.md 1.0 section 2, step 2): the
// snapshot is checked once, field by field; a missing field throws (C8: no silent defaults); rows arrive as pg
// returns them, DECIMAL and BIGINT as text (EC-34), and are parsed once; the input is never changed.

const test = require('node:test');
const assert = require('node:assert/strict');
const { readSnapshot } = require('../src/services/engines/snapshot');
const { deepFreeze } = require('./fixtures/mapBuilder');
const {
  snapshotOf,
  venueDoc,
  floor,
  storeRow,
  beaconRow,
  PUBLISH,
} = require('./fixtures/snapshotBuilder');

const baseSnapshot = () =>
  snapshotOf(venueDoc({ levels: [floor('l1')] }), {
    stores: [storeRow(3, 'u1')],
    beacons: [beaconRow(41, 'l1')],
    otherVenueBeacons: [
      { venueId: '9', venueName: 'Other venue', levelKey: 'x1', levelName: 'Level x1', major: 2 },
    ],
  });

/** A shallow copy of an object or a list (the context is frozen, so a test edits copies). */
const copyOf = (node) => (Array.isArray(node) ? [...node] : { ...node });

/** The snapshot with the field at `path` (keys and indexes) removed; every container on the path is a copy. */
function without(path) {
  const snapshot = baseSnapshot();
  let parent = snapshot;
  for (const key of path.slice(0, -1)) {
    parent[key] = copyOf(parent[key]);
    parent = parent[key];
  }
  delete parent[path[path.length - 1]];
  return snapshot;
}

test('engine.snapshot AC-89 (C8): every missing field throws, naming it', () => {
  const cases = [
    [['layout'], /snapshot\.layout is missing/],
    [['venue', 'code'], /snapshot\.venue\.code is missing/],
    [['venue', 'evacEscalatorsAllowed'], /evacEscalatorsAllowed is missing/],
    [['tenant', 'beaconProximityUuid'], /beaconProximityUuid is missing/],
    [['stores', 0, 'unitKey'], /snapshot\.stores\[0\]\.unitKey is missing/],
    [['stores', 0, 'status', 'isRoutable'], /status\.isRoutable is missing/],
    [['beacons', 0, 'x'], /snapshot\.beacons\[0\]\.x is missing/],
    [['beacons', 0, 'measuredPower'], /measuredPower is missing/],
    [['otherVenueBeacons', 0, 'major'], /otherVenueBeacons\[0\]\.major is missing/],
    [['context', 'lookups', 'ObjectType'], /lookups\.ObjectType is missing/],
    [['settings', 'routing', 'walkSpeedMps'], /routing\.walkSpeedMps is missing/],
    [['settings', 'publish', 'nodeSpacingM'], /publish\.nodeSpacingM is missing/],
    [['settings', 'publish'], /snapshot\.settings\.publish is missing/],
  ];
  for (const [path, message] of cases) {
    assert.throws(() => readSnapshot(without(path)), message, path.join('.'));
  }
});

test("engine.snapshot AC-109 (review nit 2): the other venue's beacon rows carry its level's name, null when unknown", () => {
  assert.throws(
    () => readSnapshot(without(['otherVenueBeacons', 0, 'levelName'])),
    /otherVenueBeacons\[0\]\.levelName is missing/,
  );
  assert.equal(readSnapshot(baseSnapshot()).otherVenueBeacons[0].levelName, 'Level x1');
  const unknown = baseSnapshot();
  unknown.otherVenueBeacons[0].levelName = null;
  assert.equal(readSnapshot(unknown).otherVenueBeacons[0].levelName, null);
});

test('engine.snapshot EC-34: DECIMAL and BIGINT text from the rows is parsed once, to numbers', () => {
  const snapshot = baseSnapshot();
  snapshot.beacons[0] = beaconRow(41, 'l1', { x: '10.000', y: '12.500', mountHeightM: '2.50' });
  const read = readSnapshot(snapshot);
  assert.equal(read.beacons[0].beaconId, 41);
  assert.equal(read.beacons[0].x, 10);
  assert.equal(read.beacons[0].y, 12.5);
  assert.equal(read.beacons[0].mountHeightM, 2.5);
  assert.equal(read.beacons[0].measuredPower, null, 'a NULL column stays null');
  assert.equal(read.otherVenueBeacons[0].venueId, 9);
  assert.equal(read.stores[0].occupantId, 3);
  assert.equal(read.settings.publish.nodeSpacingM, PUBLISH.nodeSpacingM);

  const bad = (mutate, message) => {
    const s = baseSnapshot();
    mutate(s);
    assert.throws(() => readSnapshot(s), message);
  };
  bad((s) => (s.beacons[0].x = 'twelve'), /beacons\[0\]\.x must be a finite number/);
  bad((s) => (s.beacons[0].y = Infinity), /beacons\[0\]\.y must be a finite number/);
  bad((s) => (s.beacons[0].beaconId = '9007199254740993'), /beaconId must be a whole number/);
  bad((s) => (s.beacons[0].major = 1.5), /major must be a whole number/);
  bad((s) => (s.stores[0].isActive = 'yes'), /isActive must be true or false/);
  bad((s) => (s.stores[0].name = null), /stores\[0\]\.name must be text/);
  bad(
    (s) => (s.context = { ...s.context, lookups: { ...s.context.lookups, ConnectorType: {} } }),
    /ConnectorType must be a Map/,
  );
});

test('engine.snapshot C8: a setting outside its range throws instead of falling back', () => {
  const bad = (group, name, value, message) => {
    const s = baseSnapshot();
    s.settings[group][name] = value;
    assert.throws(() => readSnapshot(s), message, `${group}.${name} = ${value}`);
  };
  bad('publish', 'nodeSpacingM', 0, /nodeSpacingM must be above 0/);
  bad('publish', 'bodyMarginM', -0.1, /bodyMarginM must be at least 0/);
  bad('publish', 'maxNodesWarn', 20000.5, /maxNodesWarn must be a whole number/);
  bad('routing', 'walkSpeedMps', 0, /walkSpeedMps must be above 0/);
  bad('routing', 'storeCrossingFactor', Number.NaN, /storeCrossingFactor must be a finite number/);
  const zeroMargin = baseSnapshot();
  zeroMargin.settings.publish.bodyMarginM = '0';
  assert.equal(
    readSnapshot(zeroMargin).settings.publish.bodyMarginM,
    0,
    'a margin of 0 is allowed',
  );
});

test('engine.snapshot AC-79, AC-101 (C8, DC-B6): the lookup entries the model and the costs read are parsed once; a missing one throws', () => {
  const read = readSnapshot(baseSnapshot());
  assert.deepEqual(read.lookups.ConnectorType.get('ESC_STD'), {
    code: 'ESC_STD',
    label: 'ESC_STD',
    sortOrder: 0,
    costModel: 'ESCALATOR',
    isStepFree: false,
    costBaseS: 1,
    costPerRiseS: 0.8,
  });
  assert.deepEqual(read.lookups.AmenityType.get('CR'), {
    code: 'CR',
    label: 'CR',
    sortOrder: 0,
    synonyms: null,
    isAccessible: false,
  });
  assert.equal(
    read.lookups.BuildingType.get('OLD_ANNEX').label,
    'OLD_ANNEX',
    'inactive: still read',
  );
  assert.equal(read.stores[0].status.sortOrder, 0);

  const withEntry = (name, code, change) => {
    const s = baseSnapshot();
    const entries = new Map(s.context.lookups[name]);
    const entry = { ...entries.get(code) };
    change(entry);
    entries.set(code, entry);
    s.context = { ...s.context, lookups: { ...s.context.lookups, [name]: entries } };
    return s;
  };
  const bad = (snapshot, message) => assert.throws(() => readSnapshot(snapshot), message);
  bad(
    withEntry('BuildingType', 'MAIN', (e) => delete e.label),
    /BuildingType\[MAIN\]\.label is missing/,
  );
  bad(
    withEntry('TransitType', 'TAXI_BAY', (e) => (e.sortOrder = 1.5)),
    /TransitType\[TAXI_BAY\]\.sortOrder must be a whole number/,
  );
  bad(
    withEntry('AmenityType', 'ATM', (e) => (e.isAccessible = 'no')),
    /AmenityType\[ATM\]\.isAccessible must be true or false/,
  );
  bad(
    withEntry('ConnectorType', 'LIFT_STD', (e) => delete e.isStepFree),
    /ConnectorType\[LIFT_STD\]\.isStepFree is missing/,
  );
  const s = baseSnapshot();
  delete s.stores[0].status.sortOrder;
  bad(s, /stores\[0\]\.status\.sortOrder is missing/);
});

test('engine.snapshot AC-89: reading never changes the input; the layout and context pass through', () => {
  const snapshot = deepFreeze(baseSnapshot());
  const before = JSON.stringify(snapshot);
  const read = readSnapshot(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(read.layout, snapshot.layout, 'the document is not copied');
  assert.equal(read.context, snapshot.context);
  assert.notEqual(read.stores[0], snapshot.stores[0], 'rows are read into new objects');
});
