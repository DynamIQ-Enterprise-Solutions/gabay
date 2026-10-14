'use strict';

// The venue map document's schema file and its loader (spec/OA-1.md r1 AC-37, AC-30; plan/OA-1-map-document.md
// 1.0 sections 3.1 and 5): venue-map-schema.json is read once by functions/src/config/venueMapSchema.js, checked,
// resolved and frozen; a broken file throws at load, naming the fault, so it fails every test that loads it. These
// cases cover the loader's own checks. The document's behaviour (AC-1 to AC-47) is tested in venueMap.*.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VENUE_MAP_SCHEMA,
  SCHEMA_FILE,
  LOOKUP_NAMES,
  constant,
  loadVenueMapSchema,
} = require('../src/config/venueMapSchema');

const RAW = require(SCHEMA_FILE);

/** A deep copy of the live file with `edit` applied, for one fault at a time. */
function copyWith(edit) {
  const copy = structuredClone(RAW);
  edit(copy);
  return copy;
}

test('venue map schema: the live file loads, deep-frozen, with constants resolved to numbers', () => {
  assert.equal(VENUE_MAP_SCHEMA.spec, 1);
  assert.equal(VENUE_MAP_SCHEMA.units, 'm');
  assert.ok(Object.isFrozen(VENUE_MAP_SCHEMA));
  assert.ok(Object.isFrozen(VENUE_MAP_SCHEMA.kinds.wall.fields.t));
  assert.ok(Object.isFrozen(VENUE_MAP_SCHEMA.constants));
  const t = VENUE_MAP_SCHEMA.kinds.wall.fields.t;
  assert.equal(t.min, 0.05);
  assert.equal(t.max, 1);
  assert.equal(t.default, 0.15);
  assert.deepEqual(t.refs, {
    min: 'WALL_THICKNESS_MIN_M',
    max: 'WALL_THICKNESS_MAX_M',
    default: 'WALL_THICKNESS_DEFAULT_M',
  });
  assert.equal(t.decimals, 3);
  assert.equal(VENUE_MAP_SCHEMA.kinds.backdrop.fields.mpp.decimals, 7);
  assert.equal(VENUE_MAP_SCHEMA.kinds.geoOrigin.fields.lat.decimals, 7);
});

test('venue map schema: derived constants are computed from their base constant', () => {
  const extent = constant('VENUE_EXTENT_MAX_M');
  assert.equal(constant('BACKDROP_CENTRE_MIN_M'), -2 * extent);
  assert.equal(constant('BACKDROP_CENTRE_MAX_M'), 3 * extent);
  assert.equal(constant('LEVEL_ORDINAL_MIN'), -constant('MAX_LEVELS'));
  const wider = loadVenueMapSchema(copyWith((c) => (c.constants.VENUE_EXTENT_MAX_M.value = 1400)));
  assert.equal(wider.constants.BACKDROP_CENTRE_MAX_M, 4200);
});

test('venue map schema: constant() reads a named constant and throws on a name the file does not hold', () => {
  assert.equal(constant('MAX_PROBLEMS'), 20);
  assert.throws(() => constant('MAX_PROBLEM'), /no constant named MAX_PROBLEM/);
});

test('venue map schema: the element key pattern is the id pattern itself (AC-41)', () => {
  assert.equal(VENUE_MAP_SCHEMA.patterns.ELEMENT_KEY, VENUE_MAP_SCHEMA.patterns.ID);
});

test('venue map schema: the six lookups are the ones a rule may name', () => {
  assert.deepEqual([...LOOKUP_NAMES].sort(), [
    'AmenityType',
    'BuildingType',
    'ConnectorType',
    'ObjectType',
    'OccupantCategory',
    'TransitType',
  ]);
});

test('venue map schema: a broken file is refused at load, naming the fault', () => {
  const cases = [
    [(c) => delete c.constants.MAX_LEVELS.source, /constant MAX_LEVELS needs a source/],
    [(c) => (c.constants.MAX_LEVELS.value = '10'), /MAX_LEVELS: the value must be a finite number/],
    [
      (c) => (c.constants.lower = { value: 1, source: 'x' }),
      /constant lower is not UPPER_SNAKE_CASE/,
    ],
    [
      (c) =>
        (c.constants.X_M = { derived: { constant: 'LEVEL_ORDINAL_MIN', times: 2 }, source: 'x' }),
      /derived from LEVEL_ORDINAL_MIN, which is itself derived/,
    ],
    [(c) => (c.kinds.wall.fields.t.max = 1), /wall\.t\.max must name a constant/],
    [(c) => (c.kinds.wall.fields.t.max = 'NO_SUCH_M'), /wall\.t\.max names NO_SUCH_M/],
    [(c) => (c.kinds.wall.fields.kind.closedSet = 'Nope'), /wall\.kind: no closed set named Nope/],
    [
      (c) => (c.kinds.wall.fields.kind.default = 'brick'),
      /wall\.kind\.default brick is not a value/,
    ],
    [
      (c) => (c.kinds.item.fields.type.lookup = 'StoreStatus'),
      /StoreStatus is not one of the lookups/,
    ],
    [(c) => (c.kinds.wall.fields.t.colour = 'x'), /wall\.t: unknown property colour/],
    [(c) => (c.kinds.wall.fields.t.type = 'float'), /wall\.t: unknown type float/],
    [
      (c) => delete c.kinds.building.fields.name.maxLength,
      /building\.name: a text field needs maxLength/,
    ],
    [(c) => (c.kinds.level.fields.walls.of = 'brick'), /level\.walls: no kind named brick/],
    [
      (c) => (c.kinds.opening.fields.entrance.appliesTo = ['gate']),
      /gate is not a value of the discriminator/,
    ],
    [
      (c) => delete c.kinds.connector.fields.type.costModelOf.ramp,
      /costModelOf must give a cost model/,
    ],
    [
      (c) => (c.kinds.connector.fields.type.costModelOf.ramp = 'LIFT'),
      /LIFT is not a ConnectorCostModel/,
    ],
    [
      (c) => (c.kinds.level.fields.floor.default = { colour: '#fff' }),
      /colour is not a field of floor/,
    ],
    [(c) => (c.kinds.wall.fields.a.default = [0, 0]), /wall\.a: this point field has no default/],
    [(c) => (c.kinds.wall.fields.id.default = 'w-1'), /wall\.id: this id field has no default/],
    [
      (c) => (c.patterns.ID.value = '[a-z]+'),
      /pattern ID must be a whole-string regular expression/,
    ],
    [(c) => (c.patterns.ELEMENT_KEY.sameAs = 'NOPE'), /ELEMENT_KEY is the same as NOPE/],
    [(c) => delete c.numberKinds.degrees.turnDeg, /degrees needs turnDeg/],
    [(c) => (c.exportFile.root = 'nope'), /exportFile\.root nope is not one of its kinds/],
    [(c) => (c.extra = 1), /the file: unknown property extra/],
  ];
  for (const [edit, message] of cases) {
    assert.throws(() => loadVenueMapSchema(copyWith(edit)), message, String(message));
  }
});
