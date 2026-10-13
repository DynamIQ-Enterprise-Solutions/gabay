'use strict';

// The venue map document's shape (spec/OA-1.md r1 section 3.1 and 3.7; plan/OA-1-map-document.md 1.0 section 9):
// AC-1, AC-2, AC-3, AC-17, AC-22, AC-30, AC-31, AC-37, AC-39, AC-43; EC-6, EC-7, EC-11, EC-24, EC-25, EC-33.
// Written FIRST (plan section 8 step 3): every case fails until engine-coder builds functions/src/services/venueMap/.
//
// AC-2 and AC-3 are GENERATED from the loaded schema file, so a new field gets its cases without a test edit.
// A schema fixture is passed as `{ ...context, schema: loadVenueMapSchema(editedCopy) }` (DC-E16, proposed API).

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VENUE_MAP_SCHEMA: S,
  SCHEMA_FILE,
  LOOKUP_NAMES,
  constant,
  loadVenueMapSchema,
} = require('../src/config/venueMapSchema');
const { CLOSED_SETS } = require('../src/config/closedSets');
const walk = require('./fixtures/schemaWalk');
const b = require('./fixtures/mapBuilder');

const RAW = require(SCHEMA_FILE);
const {
  context,
  validate,
  clone,
  setAt,
  unsetAt,
  assertOneProblemAt,
} = require('./fixtures/mapAsserts');

// ------------------------------------------------------------------------------------------------------------ AC-1

test('AC-1: the full document (every kind, every optional field, two-way escalator, 3-level lift, outdoor level, backdrop) validates and keeps every field it was given', () => {
  const doc = b.fullDoc();
  const before = JSON.stringify(doc);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.map, { ...doc, units: 'm' });
  assert.equal(JSON.stringify(doc), before, 'the input is not changed');
});

test('AC-1: the canonical copy holds no key the spec does not define (unknown keys at every depth are left out)', () => {
  const doc = b.fullDoc();
  doc.extraTop = 1;
  doc.site.extra = [1];
  doc.levels[1].extra = {};
  doc.levels[1].walls[0].extra = 'x';
  doc.connectors[0].extra = true;
  doc.site.georeference.origin.extra = 1;
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.map, { ...b.fullDoc(), units: 'm' });
});

test('AC-1: the full document uses the three kinds the spec names (two-way escalator, a lift serving three levels, an outdoor level)', () => {
  const res = validate(b.fullDoc());
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const esc = res.map.connectors.find((c) => c.kind === 'escalator');
  const lift = res.map.connectors.find((c) => c.kind === 'elevator');
  assert.equal(esc.twoWay, true);
  assert.equal(lift.levels.length, 3);
  assert.equal(res.map.levels.filter((l) => l.outdoor).length, 1);
});

// ------------------------------------------------------------------------------------------------------------ AC-2

/** For each (kind, field) that is required where it applies: the last instance of that kind it applies to. */
function requiredCases(base) {
  const cases = [];
  const instancesByKind = new Map();
  for (const inst of walk.instances(S, base)) {
    if (!instancesByKind.has(inst.kind)) instancesByKind.set(inst.kind, []);
    instancesByKind.get(inst.kind).push(inst);
  }
  for (const [kind, list] of instancesByKind) {
    for (const [name, rule] of Object.entries(S.kinds[kind].fields)) {
      const eligible = list.filter((inst) => {
        const disc = walk.discriminatorValue(S, kind, inst.value);
        return (
          walk.applies(S, kind, rule, inst.value) &&
          (rule.required || rule.perKind?.[disc]?.required)
        );
      });
      const inst = eligible.at(-1);
      if (inst) cases.push({ kind, name, path: inst.path ? `${inst.path}.${name}` : name });
    }
  }
  return cases;
}

const REQUIRED_ON_FULL = requiredCases(b.fullDoc());
const REQUIRED_ON_MINIMAL = requiredCases(b.minimalOutdoorDoc());

test('AC-2: the generator finds the conditional required fields (indoor level building, BLOCK_AREA poly, path line, ramp w and len)', () => {
  const paths = REQUIRED_ON_FULL.map((c) => `${c.kind}.${c.name}`);
  for (const wanted of [
    'level.building',
    'correction.poly',
    'correction.line',
    'connector.w',
    'connector.len',
    'georeference.origin',
    'geoOrigin.lat',
    'backdrop.mpp',
  ]) {
    assert.ok(paths.includes(wanted), `${wanted} is a required field the cases must cover`);
  }
  assert.ok(REQUIRED_ON_FULL.length >= 50, `generated ${REQUIRED_ON_FULL.length} cases`);
});

for (const { kind, name, path } of REQUIRED_ON_FULL.filter((c) => c.kind !== 'document')) {
  test(`AC-2: removing required ${kind}.${name} (${path}) gives exactly one problem naming it`, () => {
    const doc = clone(b.fullDoc());
    unsetAt(doc, path);
    assertOneProblemAt(validate(doc), path);
  });
}

for (const { kind, name, path } of REQUIRED_ON_MINIMAL.filter((c) => c.kind === 'document')) {
  test(`AC-2: removing required ${kind}.${name} (${path}) from the smallest document gives exactly one problem naming it`, () => {
    const doc = clone(b.minimalOutdoorDoc());
    unsetAt(doc, path);
    assertOneProblemAt(validate(doc), path);
  });
}

// ------------------------------------------------------------------------------------------------------------ AC-3

const stepFor = (rule) => (rule.type === 'integer' ? 1 : rule.decimals === 7 ? 1e-7 : 1e-3);
const fixed = (n, rule) => Number(n.toFixed(rule.type === 'integer' ? 0 : rule.decimals));

/** One entry per range side of every number rule (and per-kind rule) of the schema file. */
function rangeCases(base) {
  const cases = [];
  const byKind = new Map();
  for (const inst of walk.instances(S, base)) {
    if (!byKind.has(inst.kind)) byKind.set(inst.kind, []);
    byKind.get(inst.kind).push(inst);
  }
  for (const [kind, list] of byKind) {
    for (const [name, rule] of Object.entries(S.kinds[kind].fields)) {
      if (!['integer', 'metres', 'degrees', 'number'].includes(rule.type) || rule.equals) continue;
      const variants = rule.perKind
        ? Object.keys(rule.perKind).map((disc) => ({
            disc,
            eff: { ...rule, ...rule.perKind[disc] },
          }))
        : [{ disc: null, eff: rule }];
      for (const { disc, eff } of variants) {
        if (eff.min === undefined && eff.max === undefined && eff.minExclusive === undefined)
          continue;
        const inst = list
          .filter(
            (i) =>
              walk.applies(S, kind, rule, i.value) &&
              (disc === null || walk.discriminatorValue(S, kind, i.value) === disc),
          )
          .at(-1);
        if (!inst) continue;
        const path = inst.path ? `${inst.path}.${name}` : name;
        const step = stepFor(eff);
        const label = `${kind}.${name}${disc === null ? '' : ` (${disc})`}`;
        const needles = [eff.min, eff.max, eff.minExclusive]
          .filter((v) => v !== undefined)
          .map(String);
        if (eff.min !== undefined) {
          cases.push({
            label: `${label} below min`,
            path,
            value: fixed(eff.min - step, eff),
            refused: true,
            needles,
          });
          cases.push({ label: `${label} at min`, path, value: eff.min, refused: false });
        }
        if (eff.minExclusive !== undefined) {
          cases.push({
            label: `${label} at its exclusive minimum`,
            path,
            value: eff.minExclusive,
            refused: true,
            needles,
          });
          cases.push({
            label: `${label} one step above its exclusive minimum`,
            path,
            value: fixed(eff.minExclusive + step, eff),
            refused: false,
          });
        }
        if (eff.max !== undefined) {
          cases.push({
            label: `${label} above max`,
            path,
            value: fixed(eff.max + step, eff),
            refused: true,
            needles,
          });
          cases.push({ label: `${label} at max`, path, value: eff.max, refused: false });
        }
      }
    }
  }
  return cases;
}

const RANGE_CASES = rangeCases(b.fullDoc());

test('AC-3: the generator finds the ranges of the schema file (levels, walls, openings, connectors per kind, backdrop, georeference)', () => {
  const labels = RANGE_CASES.map((c) => c.label).join('\n');
  for (const wanted of [
    'level.ordinal below min',
    'level.elevation above max',
    'wall.t at max',
    'opening.clearW at its exclusive minimum',
    'connector.w (stairs) below min',
    'connector.w (ramp) at its exclusive minimum',
    'connector.len (escalator) above max',
    'connector.cars above max',
    'backdrop.mpp below min',
    'geoOrigin.lat above max',
    'geoOrigin.lon below min',
  ]) {
    assert.match(labels, new RegExp(wanted.replace(/[().]/g, '\\$&')), wanted);
  }
});

for (const c of RANGE_CASES) {
  test(`AC-3: ${c.label} at ${c.path} = ${c.value} is ${c.refused ? 'refused, naming the range' : 'accepted'}`, () => {
    const doc = clone(b.fullDoc());
    setAt(doc, c.path, c.value);
    const res = validate(doc);
    if (c.refused) {
      assert.equal(res.ok, false, `${c.value} must be refused`);
      const hits = b.problemsAt(res, c.path);
      assert.ok(hits.length >= 1, `a problem names ${c.path}: ${JSON.stringify(res.problems)}`);
      for (const needle of c.needles) {
        assert.ok(
          hits.some((p) => p.includes(needle)),
          `the message names the range (${needle}): ${hits.join(' | ')}`,
        );
      }
    } else {
      assert.equal(res.ok, true, JSON.stringify(res.problems));
    }
  });
}

test('AC-3: a level size is held to LEVEL_SIZE_MIN_M .. VENUE_EXTENT_MAX_M on each side (a level at origin [0, 0] with no elements)', () => {
  const min = constant('LEVEL_SIZE_MIN_M');
  const max = constant('VENUE_EXTENT_MAX_M');
  for (const index of [0, 1]) {
    const make = (v) => {
      const doc = b.minimalOutdoorDoc();
      doc.levels[0].size = index === 0 ? [v, 100] : [100, v];
      return doc;
    };
    for (const [v, refused] of [
      [min - 0.001, true],
      [min, false],
      [max, false],
      [max + 0.001, true],
    ]) {
      const res = validate(make(v));
      if (refused) {
        assert.ok(
          b.problemsAt(res, `levels[0].size`).length >= 1,
          `size[${index}] = ${v}: ${JSON.stringify(res.problems)}`,
        );
      } else assert.equal(res.ok, true, `size[${index}] = ${v}: ${JSON.stringify(res.problems)}`);
    }
  }
});

test('AC-3: catalog is at least CATALOG_VERSION_MIN (its upper bound is the context version, tested in venueMap.lookups)', () => {
  const doc = b.smallDoc();
  doc.catalog = 0;
  const res = validate(doc);
  assert.ok(b.problemsAt(res, 'catalog').length >= 1, JSON.stringify(res.problems));
  doc.catalog = 1;
  assert.equal(validate(doc).ok, true);
});

// ----------------------------------------------------------------------------------------------------------- AC-17

const NOT_A_NUMBER = ['1.5', true, null, [1.5], {}];
for (const [path, label] of [
  ['levels[1].walls[1].t', 'a metres field'],
  ['levels[1].openings[1].at', 'a ratio field'],
  ['buildings[0].mapUp', 'a degrees field'],
  ['levels[1].backdrop.mpp', 'the mpp field'],
]) {
  for (const bad of NOT_A_NUMBER) {
    test(`AC-17: ${label} (${path}) holding ${JSON.stringify(bad)} gives one problem at its path`, () => {
      const doc = clone(b.fullDoc());
      setAt(doc, path, bad);
      assertOneProblemAt(validate(doc), path);
    });
  }
}

for (const [path, label] of [
  ['spec', 'spec'],
  ['levels[1].ordinal', 'ordinal'],
  ['connectors[1].cars', 'cars'],
  ['catalog', 'catalog'],
]) {
  for (const bad of [1.5, '1']) {
    test(`AC-17: the integer field ${label} (${path}) holding ${JSON.stringify(bad)} gives one problem at its path`, () => {
      const doc = clone(b.fullDoc());
      setAt(doc, path, bad);
      assertOneProblemAt(validate(doc), path);
    });
  }
}

for (const [path, label] of [
  ['buildings[0].review', 'a building review flag'],
  ['levels[1].walls[0].review', 'a wall review flag'],
  ['levels[1].openings[0].entrance', 'an entrance flag'],
  ['connectors[0].twoWay', 'twoWay'],
  ['levels[1].backdrop.locked', 'locked'],
]) {
  for (const bad of ['true', 1, 0, 'false', [], {}]) {
    test(`AC-17: ${label} (${path}) holding ${JSON.stringify(bad)} gives one problem at its path`, () => {
      const doc = clone(b.fullDoc());
      setAt(doc, path, bad);
      assertOneProblemAt(validate(doc), path);
    });
  }
}

for (const [path, label] of [
  ['levels[1].amenities[0].at', 'an amenity point'],
  ['levels[1].anchors[0].at', 'an anchor point'],
  ['levels[1].walls[0].a', 'a wall end'],
  ['levels[1].origin', 'a level origin'],
]) {
  for (const bad of [[1], [1, 2, 3], [1, '2'], ['1', '2'], {}, 'ab', null, [null, 2]]) {
    test(`AC-17: ${label} (${path}) holding ${JSON.stringify(bad)} is not exactly two numbers: one problem at its path`, () => {
      const doc = clone(b.fullDoc());
      setAt(doc, path, bad);
      const res = validate(doc);
      assert.equal(res.ok, false);
      assert.ok(b.problemsAt(res, path).length >= 1, JSON.stringify(res.problems));
    });
  }
}

test('EC-25: a JS NaN or Infinity passed directly is refused as "not a finite number" (NaN cannot arrive in JSON)', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const doc = clone(b.fullDoc());
    doc.levels[1].walls[1].t = bad;
    const res = validate(doc);
    assertOneProblemAt(res, 'levels[1].walls[1].t', String(bad));
    assert.match(res.problems[0], /not a finite number/i);
  }
});

// ----------------------------------------------------------------------------------------------------------- AC-22

test('AC-22: no colour is stored: a color or colour key is dropped everywhere (floor, unit floor, item, wall), and finishes stay keys', () => {
  const doc = b.fullDoc();
  doc.levels[0].floor.color = '#ff0000';
  doc.levels[1].units[0].floor.colour = '#00ff00';
  doc.levels[1].items[0].color = '#0000ff';
  doc.levels[1].items[0].colour = 'red';
  doc.levels[1].walls[0].color = '#fff';
  doc.site.color = '#000';
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.doesNotMatch(JSON.stringify(res.map), /colou?r/i);
  assert.deepEqual(res.map.levels[0].floor, { finish: 'concrete' });
  assert.deepEqual(res.map.levels[1].units[0].floor, { finish: 'tile' });
  assert.equal(res.map.levels[1].items[0].finish, 'oak');
});

test('AC-22: the schema file defines no colour field on any kind', () => {
  for (const [kind, def] of Object.entries(S.kinds)) {
    for (const name of Object.keys(def.fields))
      assert.doesNotMatch(name, /colou?r/i, `${kind}.${name}`);
  }
});

// ----------------------------------------------------------------------------------------------------------- AC-43

test('AC-43: the schema file has no store field on a unit (status, keywords, spoken name, occupant)', () => {
  const names = Object.keys(S.kinds.unit.fields);
  for (const banned of [
    'status',
    'keywords',
    'spokenName',
    'occupant',
    'store',
    'storeName',
    'hours',
  ]) {
    assert.ok(!names.includes(banned), `unit.${banned} must not exist`);
  }
});

test('AC-43: store keys on a unit are left out of the canonical copy, with no problem', () => {
  const doc = b.fullDoc();
  Object.assign(doc.levels[1].units[0], {
    status: 'OPEN',
    keywords: 'shoes',
    spokenName: 'Store A',
    storeName: 'Shoes R Us',
    occupant: { name: 'X' },
  });
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.map.levels[1].units[0], b.fullDoc().levels[1].units[0]);
});

// ----------------------------------------------------------------------------------------------------------- AC-30

const NAMED_CAPS = {
  MAX_LEVELS: 10,
  MAX_BUILDINGS: 10,
  MAX_CONNECTORS: 40,
  MAX_WALLS_PER_LEVEL: 2000,
  MAX_OPENINGS_PER_LEVEL: 2000,
  MAX_UNITS_PER_LEVEL: 300,
  MAX_ITEMS_PER_LEVEL: 5000,
  MAX_CORRECTIONS_PER_LEVEL: 2000,
  MAX_POINTS_PER_LEVEL: 5000,
  MAX_POLY_POINTS: 64,
  VENUE_EXTENT_MAX_M: 300,
  MAX_MAP_BYTES: 4 * 1048576,
  MAX_PROBLEMS: 20,
};

test('AC-30: every cap named in r1 is a constant of the schema file with its starting value and a source', () => {
  for (const [name, start] of Object.entries(NAMED_CAPS)) {
    assert.equal(constant(name), start, `${name} starts at ${start}`);
    assert.ok(S.constantSources[name].trim().length > 10, `${name} names its source`);
  }
});

test('AC-30: every constant of the schema file names its source', () => {
  for (const name of Object.keys(S.constants)) {
    assert.ok(S.constantSources[name]?.trim().length > 10, `${name}: a source`);
  }
});

const withSchema = (edit) => {
  const raw = clone(RAW);
  edit(raw);
  return { ...context(), schema: loadVenueMapSchema(raw) };
};

test('AC-30 and AC-37: a fixture copy of the schema file with a changed cap changes the verdict (DC-E16)', () => {
  const doc = b.smallDoc();
  doc.levels[0].walls = [b.wall('w1'), b.wall('w2'), b.wall('w3')];
  assert.equal(validate(doc).ok, true, 'three walls pass the live cap');
  const tight = withSchema((raw) => (raw.constants.MAX_WALLS_PER_LEVEL.value = 2));
  const res = validate(doc, tight);
  assertOneProblemAt(res, 'levels[0].walls');
  assert.ok(res.problems[0].includes('3') && res.problems[0].includes('2'), res.problems[0]);
});

test('AC-37: a fixture copy with a changed range changes the verdict (no range is written twice)', () => {
  const doc = b.smallDoc();
  doc.levels[0].walls = [b.wall('w1', { t: 0.6 })];
  assert.equal(validate(doc).ok, true, 'a 0.6 m wall passes the live maximum of 1');
  const narrow = withSchema((raw) => (raw.constants.WALL_THICKNESS_MAX_M.value = 0.5));
  assertOneProblemAt(validate(doc, narrow), 'levels[0].walls[0].t');
});

test('AC-37: a fixture copy with a changed default changes what is omitted from the canonical copy (no default is written twice)', () => {
  const doc = b.smallDoc();
  doc.levels[0].walls = [b.wall('w1', { t: 0.15 }), b.wall('w2', { t: 0.3 })];
  const live = validate(doc);
  assert.equal(live.ok, true);
  assert.equal(live.map.levels[0].walls[0].t, undefined, 'the live default 0.15 is omitted');
  assert.equal(live.map.levels[0].walls[1].t, 0.3);
  const moved = withSchema((raw) => (raw.constants.WALL_THICKNESS_DEFAULT_M.value = 0.3));
  const res = validate(doc, moved);
  assert.equal(res.ok, true);
  assert.equal(res.map.levels[0].walls[0].t, 0.15);
  assert.equal(res.map.levels[0].walls[1].t, undefined, 'the changed default 0.3 is omitted');
});

test('AC-37: a fixture copy with a changed length limit changes the verdict', () => {
  const doc = b.smallDoc();
  const short = withSchema((raw) => (raw.constants.NAME_MAX_CHARS.value = 5));
  assert.equal(validate(doc).ok, true);
  assert.ok(b.problemsAt(validate(doc, short), 'buildings[0].name').length >= 1);
});

test('AC-30: MAX_PROBLEMS comes from the schema file too: a copy with 3 reports 3 problems and the true total', () => {
  const doc = b.smallDoc();
  doc.levels[0].walls = Array.from({ length: 6 }, (_, i) => b.wall(`w${i}`, { t: 0 }));
  const res = validate(
    doc,
    withSchema((raw) => (raw.constants.MAX_PROBLEMS.value = 3)),
  );
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 3);
  assert.equal(res.total, 6);
});

test('AC-30: no cap literal of 2000, 5000 or 4194304 appears in the validator code (C8; review checks the rest)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'src', 'services', 'venueMap');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'the module directory has code');
  for (const f of files) {
    const code = fs
      .readFileSync(path.join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(2000|5000|4194304|1048576)\b/, `${f} holds a cap literal`);
  }
});

// ----------------------------------------------------------------------------------------------------------- AC-31

const circle = (n, cx, cz, r) =>
  Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return [
      Math.round((cx + r * Math.cos(angle)) * 1000) / 1000,
      Math.round((cz + r * Math.sin(angle)) * 1000) / 1000,
    ];
  });
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));

/** [path, cap constant, build(n) -> a document with n entries at that path] */
const CAP_CASES = [
  [
    'levels',
    'MAX_LEVELS',
    (n) => {
      const doc = b.smallDoc();
      doc.levels = many(n, (i) => b.level(`l${i}`, { building: 'b1', ordinal: i - 5 }));
      return doc;
    },
  ],
  [
    'buildings',
    'MAX_BUILDINGS',
    (n) => {
      const doc = b.smallDoc();
      doc.buildings = many(n, (i) => ({ id: `b${i}`, name: `Building ${i}`, type: 'MAIN' }));
      doc.levels[0].building = 'b0';
      return doc;
    },
  ],
  [
    'connectors',
    'MAX_CONNECTORS',
    (n) => {
      const doc = b.twoLevelDoc();
      doc.connectors = many(n, (i) => b.connector(`c${i}`, 'stairs', ['l1', 'l2']));
      return doc;
    },
  ],
  [
    'levels[0].walls',
    'MAX_WALLS_PER_LEVEL',
    (n) => withLevel((l) => (l.walls = many(n, (i) => b.wall(`w${i}`)))),
  ],
  [
    'levels[0].openings',
    'MAX_OPENINGS_PER_LEVEL',
    (n) =>
      withLevel((l) => {
        l.walls = [b.wall('w0')];
        l.openings = many(n, (i) => b.opening(`o${i}`, 'w0'));
      }),
  ],
  [
    'levels[0].units',
    'MAX_UNITS_PER_LEVEL',
    (n) => withLevel((l) => (l.units = many(n, (i) => b.unit(`u${i}`)))),
  ],
  [
    'levels[0].items',
    'MAX_ITEMS_PER_LEVEL',
    (n) => withLevel((l) => (l.items = many(n, (i) => b.item(`i${i}`)))),
  ],
  [
    'levels[0].corrections',
    'MAX_CORRECTIONS_PER_LEVEL',
    (n) => withLevel((l) => (l.corrections = many(n, (i) => b.correction(`c${i}`)))),
  ],
  [
    'levels[0].amenities',
    'MAX_POINTS_PER_LEVEL',
    (n) => withLevel((l) => (l.amenities = many(n, (i) => b.amenity(`a${i}`)))),
  ],
  [
    'levels[0].transitPoints',
    'MAX_POINTS_PER_LEVEL',
    (n) => withLevel((l) => (l.transitPoints = many(n, (i) => b.transitPoint(`t${i}`)))),
  ],
  [
    'levels[0].anchors',
    'MAX_POINTS_PER_LEVEL',
    (n) => withLevel((l) => (l.anchors = many(n, (i) => b.anchor(`n${i}`)))),
  ],
  [
    'levels[0].units[0].poly',
    'MAX_POLY_POINTS',
    (n) => withLevel((l) => (l.units = [b.unit('u0', { poly: circle(n, 50, 40, 30) })])),
  ],
  [
    'levels[0].corrections[0].line',
    'MAX_POLY_POINTS',
    (n) =>
      withLevel((l) => {
        l.corrections = [
          {
            id: 'c0',
            kind: 'ADD_PATH',
            line: many(n, (i) => [Math.round(i * 1.2 * 1000) / 1000, i % 2 ? 10 : 20]),
          },
        ];
      }),
  ],
  [
    'site.boundary',
    'MAX_POLY_POINTS',
    (n) => {
      const doc = b.smallDoc();
      doc.site.boundary = circle(n, 150, 150, 100);
      return doc;
    },
  ],
  [
    'buildings[0].footprint',
    'MAX_POLY_POINTS',
    (n) => {
      const doc = b.smallDoc();
      doc.buildings[0].footprint = circle(n, 100, 100, 60);
      return doc;
    },
  ],
];

function withLevel(edit) {
  const doc = b.smallDoc();
  edit(doc.levels[0]);
  return doc;
}

for (const [path, capName, build] of CAP_CASES) {
  const cap = constant(capName);
  test(`AC-31: ${path} holds exactly ${cap} entries (${capName})`, () => {
    const res = validate(build(cap));
    assert.equal(res.ok, true, JSON.stringify(res.problems.slice(0, 3)));
  });
  test(`AC-31: ${path} with ${cap + 1} entries gives one problem naming the array, the count and the cap`, () => {
    const res = validate(build(cap + 1));
    assertOneProblemAt(res, path);
    assert.ok(res.problems[0].includes(String(cap + 1)), `names the count: ${res.problems[0]}`);
    assert.ok(res.problems[0].includes(String(cap)), `names the cap: ${res.problems[0]}`);
  });
}

// ------------------------------------------------------------------------------------------------- AC-37, AC-39 (JSON)

const FIELD_TYPES = new Set([
  'text',
  'integer',
  'metres',
  'degrees',
  'number',
  'flag',
  'code',
  'closedSet',
  'id',
  'idRef',
  'idRefs',
  'point',
  'polygon',
  'line',
  'object',
  'array',
]);

function everyField(fn) {
  for (const [kind, def] of Object.entries(S.kinds)) {
    for (const [name, rule] of Object.entries(def.fields)) fn(`${kind}.${name}`, rule);
  }
  for (const [kind, def] of Object.entries(S.exportFile.kinds)) {
    for (const [name, rule] of Object.entries(def.fields)) fn(`export ${kind}.${name}`, rule);
  }
}

test('AC-37: every field states its type kind, whether it is required, and whether it has a default', () => {
  everyField((label, rule) => {
    assert.ok(FIELD_TYPES.has(rule.type), `${label}: type ${rule.type}`);
    assert.equal(typeof rule.required, 'boolean', `${label}: required`);
    assert.equal(typeof rule.hasDefault, 'boolean', `${label}: hasDefault`);
    if (rule.appliesTo)
      assert.ok(Array.isArray(rule.appliesTo) && rule.appliesTo.length > 0, `${label}: appliesTo`);
    for (const k of ['min', 'max', 'minExclusive']) {
      if (k in rule) assert.equal(typeof rule[k], 'number', `${label}: ${k} is a resolved number`);
    }
    if (rule.type === 'code') assert.ok(LOOKUP_NAMES.includes(rule.lookup), `${label}: lookup`);
    if (rule.type === 'closedSet') assert.ok(rule.closedSet in CLOSED_SETS, `${label}: closed set`);
  });
});

test('AC-37: every array and polygon of the document states its cap, and every cap is a named constant', () => {
  everyField((label, rule) => {
    if (label.startsWith('export ')) return; // the export file's stores are bounded by the map's units (schema note)
    if (['array', 'polygon', 'line', 'idRefs'].includes(rule.type)) {
      assert.equal(typeof rule.maxItems, 'number', `${label}: maxItems`);
      assert.ok(rule.refs.maxItems in S.constants, `${label}: ${rule.refs.maxItems} is a constant`);
    }
  });
});

test('AC-39: every text field states its maximum length, in code points', () => {
  everyField((label, rule) => {
    if (rule.type === 'text')
      assert.ok(Number.isInteger(rule.maxLength) && rule.maxLength > 0, `${label}: maxLength`);
  });
  assert.equal(S.kinds.building.fields.name.maxLength, 200);
  assert.equal(S.kinds.level.fields.shortName.maxLength, 10);
  assert.equal(S.kinds.level.fields.name.maxLength, 100);
  assert.equal(S.kinds.item.fields.label.maxLength, 40);
});

test('AC-39: every metre, degree and ratio field states 3 decimals, and mpp, lat and lon state 7', () => {
  everyField((label, rule) => {
    if (['metres', 'degrees', 'number'].includes(rule.type)) {
      assert.ok(Number.isInteger(rule.decimals), `${label}: decimals`);
    }
  });
  assert.equal(S.kinds.wall.fields.t.decimals, 3);
  assert.equal(S.kinds.level.fields.elevation.decimals, 3);
  assert.equal(S.kinds.site.fields.mapUp.decimals, 3);
  assert.equal(S.kinds.opening.fields.at.decimals, 3);
  assert.equal(S.kinds.backdrop.fields.opacity.decimals, 3);
  assert.equal(S.kinds.backdrop.fields.mpp.decimals, 7);
  assert.equal(S.kinds.geoOrigin.fields.lat.decimals, 7);
  assert.equal(S.kinds.geoOrigin.fields.lon.decimals, 7);
});

// -------------------------------------------------------------------------------------------------------- edge cases

test('EC-6: the smallest documents validate: outdoor-only with no buildings, and one building with its one level', () => {
  const outdoor = validate(b.minimalOutdoorDoc());
  assert.equal(outdoor.ok, true, JSON.stringify(outdoor.problems));
  assert.equal(outdoor.map.levels.length, 1);
  const building = validate(b.minimalBuildingDoc());
  assert.equal(building.ok, true, JSON.stringify(building.problems));
});

test('EC-6: a level with every array empty is valid, and writes no empty array (omitted when default)', () => {
  const doc = b.smallDoc();
  for (const name of b.ELEMENT_ARRAYS) doc.levels[0][name] = [];
  doc.connectors = [];
  doc.buildings.push({ id: 'b2', name: 'Spare', type: 'WING' });
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  for (const name of b.ELEMENT_ARRAYS) assert.equal(res.map.levels[0][name], undefined, name);
});

test('EC-7: levels: [] gives a problem at levels', () => {
  const doc = b.minimalOutdoorDoc();
  doc.levels = [];
  assertOneProblemAt(validate(doc), 'levels');
});

test('EC-24: spec 2, 0 or "1" gives a problem at spec', () => {
  for (const bad of [2, 0, '1', 99]) {
    const doc = b.smallDoc();
    doc.spec = bad;
    assertOneProblemAt(validate(doc), 'spec', String(bad));
  }
});

test('EC-33: a known field on a kind it does not apply to gives a problem at its path (twoWay on stairs, cars on an escalator, line on a BLOCK_AREA, h on a fixed item)', () => {
  const cases = [
    [
      'connectors[0].twoWay',
      () => {
        const d = b.twoLevelDoc();
        d.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { twoWay: true })];
        return d;
      },
    ],
    [
      'connectors[0].cars',
      () => {
        const d = b.twoLevelDoc();
        d.connectors = [b.connector('c1', 'escalator', ['l1', 'l2'], { cars: 2 })];
        return d;
      },
    ],
    [
      'levels[0].corrections[0].line',
      () =>
        withLevel(
          (l) =>
            (l.corrections = [
              b.correction('c1', {
                line: [
                  [1, 1],
                  [5, 5],
                ],
              }),
            ]),
        ),
    ],
    [
      'levels[0].items[0].h',
      () => withLevel((l) => (l.items = [b.item('i1', { type: 'PILLAR', h: 2 })])),
    ],
  ];
  for (const [path, build] of cases) assertOneProblemAt(validate(build()), path);
});

test('EC-33: an unknown key is dropped silently, with no problem', () => {
  const doc = b.smallDoc();
  doc.levels[0].walls = [b.wall('w1', { glow: 'yes', hot: true })];
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(Object.keys(res.map.levels[0].walls[0]).sort(), ['a', 'b', 'id']);
});
