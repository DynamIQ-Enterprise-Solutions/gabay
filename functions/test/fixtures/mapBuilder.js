// Test support for the venue map document's tests (spec/OA-1.md r1; plan/OA-1-map-document.md 1.0 sections 3.6 and 9).
// Not a test file. INVENTED DATA ONLY: no penthouse and no seed sources (L48, EC-9).
//
//   vm()                      the venueMap module, required lazily so a missing module fails each test on its own
//   makeContext(overrides)    the validator's context, built ONLY through shapeCatalog and shapeMapContext (plan 3.2)
//   fullDoc()                 AC-1's document: every element kind and optional field. The LAST element of each kind
//                             (and of each array) is one nothing refers to, so a required field can be taken out of it
//                             without a dangling reference (AC-2)
//   smallDoc(), twoLevelDoc() one indoor level (two levels) in one building, for the rule tests
//   minimalOutdoorDoc(), minimalBuildingDoc()   EC-6's two smallest documents
//   wall(), opening(), unit(), item(), correction(), amenity(), transitPoint(), anchor(), connector(), level()
//   randomDoc(seed, opts)     a seeded valid document (DC-O9); opts.messy adds noise a canonical copy removes
//   fuzzDoc(rng)              a seeded malformed document (AC-28)
//   problemsAt(result, path)  the problems whose path is `path` or inside it
//   deepFreeze(), mulberry32(), bytesOf(), collectIds()
'use strict';

const { closedSet } = require('../../src/config/closedSets');

const vm = () => require('../../src/services/venueMap');

// ---------------------------------------------------------------------------------------------------------- rows

const TENANT = 7;
const CATALOG_VERSION = 5;

const objectRow = (code, over = {}) => ({
  tenantId: null,
  code,
  label: code,
  sortOrder: 0,
  isActive: true,
  defaultW: 1,
  defaultD: 1,
  defaultH: 1,
  resize: { w: null, d: null, h: null },
  blocksWalk: true,
  mount: 'floor',
  round: false,
  ...over,
});

/** Platform rows (tenantId null). DESK resizes; PILLAR is fixed; PLANTER_ROUND is round; COUNTER_FREE has no default
 *  width or depth (G13); OLD_TABLE is inactive (AC-20). */
function objectRows() {
  return [
    objectRow('DESK', {
      sortOrder: 1,
      defaultW: 1.4,
      defaultD: 0.7,
      defaultH: 0.75,
      resize: { w: [0.6, 3], d: [0.5, 1.5], h: [0.7, 1.2] },
    }),
    objectRow('PILLAR', { sortOrder: 2, defaultW: 0.5, defaultD: 0.5, defaultH: 3 }),
    objectRow('PLANTER_ROUND', {
      sortOrder: 3,
      defaultW: 0.8,
      defaultD: 0.8,
      defaultH: 0.5,
      resize: { w: [0.4, 2], d: null, h: null },
      round: true,
      blocksWalk: false,
    }),
    objectRow('COUNTER_FREE', { sortOrder: 4, defaultW: null, defaultD: null, defaultH: 1.1 }),
    objectRow('SIGN_WALL', {
      sortOrder: 5,
      defaultW: 0.6,
      defaultD: 0.05,
      defaultH: 0.4,
      mount: 'wall',
      blocksWalk: false,
    }),
    objectRow('OLD_TABLE', {
      sortOrder: 6,
      isActive: false,
      defaultW: 1,
      defaultD: 1,
      defaultH: 0.7,
    }),
  ];
}

const lookupRow = (code, over = {}) => ({
  tenantId: null,
  code,
  label: code,
  sortOrder: 0,
  isActive: true,
  ...over,
});

function lookupRows() {
  return {
    buildingTypes: [
      lookupRow('MAIN'),
      lookupRow('WING'),
      lookupRow('OLD_ANNEX', { isActive: false }),
    ],
    amenityTypes: [
      lookupRow('CR'),
      lookupRow('ATM'),
      lookupRow('NURSING_OLD', { isActive: false }),
    ],
    transitTypes: [lookupRow('TAXI_BAY'), lookupRow('DROP_OFF_OLD', { isActive: false })],
    connectorTypes: [
      lookupRow('STAIRS_STD', { costModel: 'STAIRS' }),
      lookupRow('ESC_STD', { costModel: 'ESCALATOR' }),
      lookupRow('LIFT_STD', { costModel: 'ELEVATOR' }),
      lookupRow('RAMP_STD', { costModel: 'RAMP' }),
      lookupRow('LEVEL_ONLY', { costModel: 'LEVEL' }),
      lookupRow('STAIRS_OLD', { costModel: 'STAIRS', isActive: false }),
    ],
    occupantCategories: [
      lookupRow('FASHION'),
      lookupRow('DINING'),
      lookupRow('SPORTS_OLD', { isActive: false }),
    ],
  };
}

/** The validator's context, shaped by the module's own pure functions. `over` replaces a rows list by name
 *  (objectTypes, buildingTypes, amenityTypes, transitTypes, connectorTypes, occupantCategories) or the version. */
function makeContext(over = {}) {
  const { shapeCatalog, shapeMapContext } = vm();
  const rows = { ...lookupRows(), ...over };
  const catalog = shapeCatalog(over.objectTypes ?? objectRows(), over.version ?? CATALOG_VERSION);
  return shapeMapContext({
    catalog,
    buildingTypes: rows.buildingTypes,
    amenityTypes: rows.amenityTypes,
    transitTypes: rows.transitTypes,
    connectorTypes: rows.connectorTypes,
    occupantCategories: rows.occupantCategories,
  });
}

// -------------------------------------------------------------------------------------------------------- factories

const BOUNDARY = () => [
  [0, 0],
  [200, 0],
  [200, 150],
  [0, 150],
];

const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const wall = (id, over = {}) => ({ id, a: [20, 20], b: [40, 20], ...over });
const opening = (id, wallId, over = {}) => ({ id, wall: wallId, at: 0.5, w: 1, ...over });
const unit = (id, over = {}) => ({
  id,
  category: 'room',
  walkable: false,
  poly: rect(50, 10, 60, 20),
  ...over,
});
const item = (id, over = {}) => ({ id, type: 'DESK', x: 30, z: 30, ...over });
const correction = (id, over = {}) => ({
  id,
  kind: 'BLOCK_AREA',
  poly: rect(70, 10, 80, 20),
  ...over,
});
const amenity = (id, over = {}) => ({ id, type: 'CR', at: [10, 10], ...over });
const transitPoint = (id, over = {}) => ({
  id,
  type: 'TAXI_BAY',
  name: 'Taxi bay',
  at: [10, 10],
  ...over,
});
const anchor = (id, over = {}) => ({ id, name: 'Landmark', at: [10, 10], ...over });
const level = (id, over = {}) => ({
  id,
  name: `Level ${id}`,
  shortName: id.slice(0, 10),
  ordinal: 1,
  origin: [0, 0],
  size: [100, 80],
  ...over,
});

const CONNECTOR_TYPE = {
  stairs: 'STAIRS_STD',
  escalator: 'ESC_STD',
  elevator: 'LIFT_STD',
  ramp: 'RAMP_STD',
};

/** A connector of `kind` between `levels` (ids), footprint and landings at (50, 40) on a level of 100 x 80 at the origin. */
function connector(id, kind, levels, over = {}) {
  const base = {
    id,
    name: `${kind} ${id}`,
    kind,
    type: CONNECTOR_TYPE[kind],
    levels: [...levels],
    stops: levels.map(() => [50, 40]),
    x: 50,
    z: 40,
  };
  if (kind === 'ramp') Object.assign(base, { w: 2, len: 10 });
  return { ...base, ...over };
}

function smallDoc() {
  return {
    spec: 1,
    site: { boundary: BOUNDARY() },
    buildings: [{ id: 'b1', name: 'Main building', type: 'MAIN' }],
    levels: [level('l1', { building: 'b1', ordinal: 1 })],
  };
}

function twoLevelDoc() {
  const doc = smallDoc();
  doc.levels.push(level('l2', { building: 'b1', ordinal: 2 }));
  return doc;
}

/** EC-6: a site boundary and one empty outdoor level, no buildings, no connectors. */
function minimalOutdoorDoc() {
  return {
    spec: 1,
    site: { boundary: BOUNDARY() },
    levels: [level('yard', { outdoor: true, ordinal: 0, size: [200, 150] })],
  };
}

/** EC-6: one building and its one (empty) level. */
function minimalBuildingDoc() {
  return smallDoc();
}

/** AC-1's document. Nothing in it equals a default, so the canonical copy differs only by `units`. */
function fullDoc() {
  const lvl1 = level('lvl-1', {
    name: 'Level 1',
    shortName: 'L1',
    spokenName: 'the first floor',
    building: 'bld-1',
    ordinal: 1,
    elevation: 4.5,
    height: 3.5,
    origin: [10, 10],
    size: [100, 80],
    floor: { finish: 'carpet' },
    walls: [
      wall('w-1', { a: [20, 20], b: [60, 20], t: 0.2, kind: 'glass', review: true }),
      wall('w-2', { a: [60, 20], b: [60, 50] }),
      wall('w-3', { a: [20, 50], b: [60, 50], kind: 'partition' }),
      wall('w-4', { a: [15, 85], b: [105, 85] }),
      wall('w-5', { a: [15, 88], b: [105, 88] }),
    ],
    openings: [
      opening('o-1', 'w-1', {
        at: 0.5,
        w: 1.2,
        name: 'Main door',
        clearW: 0.9,
        entrance: true,
        review: true,
      }),
      opening('o-2', 'w-2', { at: 0.25, w: 1, kind: 'window' }),
      opening('o-3', 'w-3', { at: 0.5, w: 0.9 }),
      opening('o-4', 'w-4', { at: 0.5, w: 1.5, kind: 'window' }),
    ],
    units: [
      unit('u-1', {
        name: 'Store A',
        category: 'room',
        walkable: false,
        passThrough: true,
        doors: ['o-1', 'o-3'],
        poly: rect(20, 20, 60, 50),
        floor: { finish: 'tile' },
        review: true,
      }),
      unit('u-2', {
        name: 'Concourse',
        category: 'walkway',
        walkable: true,
        poly: rect(60, 20, 100, 80),
      }),
      unit('u-3', {
        category: 'storage',
        walkable: false,
        parent: 'u-1',
        poly: rect(22, 22, 30, 30),
      }),
    ],
    items: [
      item('i-1', {
        type: 'DESK',
        x: 30,
        z: 30,
        rot: 45,
        w: 1.5,
        d: 0.8,
        h: 0.9,
        finish: 'oak',
        label: 'Reception',
        review: true,
      }),
      item('i-2', { type: 'PILLAR', x: 70, z: 60 }),
      item('i-3', { type: 'PLANTER_ROUND', x: 80, z: 60, w: 1 }),
      item('i-4', { type: 'COUNTER_FREE', x: 90, z: 70, w: 2, d: 1 }),
    ],
    corrections: [
      correction('c-1', { poly: rect(70, 30, 80, 40), note: 'Wet floor', review: true }),
      {
        id: 'c-2',
        kind: 'ADD_PATH',
        line: [
          [62, 60],
          [90, 60],
        ],
      },
      {
        id: 'c-3',
        kind: 'REMOVE_PATH',
        line: [
          [62, 70],
          [90, 70],
        ],
      },
    ],
    amenities: [
      amenity('am-1', { type: 'CR', name: 'Restroom', at: [65, 65], unit: 'u-2', review: true }),
    ],
    transitPoints: [
      transitPoint('tp-1', {
        type: 'TAXI_BAY',
        name: 'Taxi bay',
        note: 'Level 1 entrance',
        at: [100, 85],
        review: true,
      }),
    ],
    anchors: [anchor('an-1', { name: 'Fountain', at: [80, 50], unit: 'u-2', review: true })],
    backdrop: {
      id: '0123456789abcdef0123456789abcdef',
      cx: 60,
      cz: 50,
      mpp: 0.0083333,
      rot: 15,
      opacity: 0.4,
      locked: true,
    },
  });
  const upper = (id, ordinal, elevation) =>
    level(id, { building: 'bld-1', ordinal, elevation, origin: [10, 10], size: [100, 80] });
  const lvl2 = upper('lvl-2', 2, 9);
  lvl2.items = [item('i-5', { type: 'PILLAR', x: 40, z: 40 })];
  return {
    spec: 1,
    catalog: 3,
    site: {
      boundary: BOUNDARY(),
      georeference: { origin: { lat: 14.5547456, lon: 121.0244452 }, bearingDeg: 12.5 },
      mapUp: 30,
    },
    buildings: [
      {
        id: 'bld-1',
        name: 'Main building',
        type: 'MAIN',
        footprint: rect(10, 10, 110, 90),
        mapUp: 15,
        review: true,
      },
      { id: 'bld-2', name: 'Wing', type: 'WING' },
      { id: 'bld-3', name: 'Annex', type: 'WING' },
    ],
    levels: [
      level('lvl-out', {
        name: 'Ground yard',
        shortName: 'Yard',
        spokenName: 'the yard',
        outdoor: true,
        ordinal: 0,
        elevation: -0.5,
        height: 4,
        origin: [0, 0],
        size: [200, 150],
        floor: { finish: 'concrete' },
      }),
      lvl1,
      lvl2,
      upper('lvl-3', 3, 13.5),
      level('lvl-4', {
        building: 'bld-2',
        ordinal: 1,
        elevation: 4.5,
        origin: [120, 10],
        size: [60, 60],
      }),
    ],
    connectors: [
      {
        id: 'esc-1',
        name: 'Escalator A',
        spokenName: 'the escalator',
        kind: 'escalator',
        type: 'ESC_STD',
        levels: ['lvl-1', 'lvl-2'],
        stops: [
          [70, 40],
          [70, 45],
        ],
        x: 70,
        z: 42,
        rot: 90,
        w: 1.4,
        len: 9,
        twoWay: true,
        preferred: true,
        review: true,
      },
      {
        id: 'lift-1',
        name: 'Lift',
        kind: 'elevator',
        type: 'LIFT_STD',
        levels: ['lvl-1', 'lvl-2', 'lvl-3'],
        stops: [
          [90, 30],
          [90, 30],
          [90, 30],
        ],
        x: 90,
        z: 30,
        rot: 90,
        w: 2.5,
        d: 2.5,
        cars: 2,
      },
      {
        id: 'st-1',
        name: 'Stairs',
        kind: 'stairs',
        type: 'STAIRS_STD',
        levels: ['lvl-1', 'lvl-2'],
        stops: [
          [15, 15],
          [15, 15],
        ],
        x: 15,
        z: 15,
        rot: 180,
        w: 1.5,
        len: 5,
        shape: 'L',
        evacuationOnly: true,
        review: true,
      },
      {
        id: 'rp-1',
        name: 'Ramp',
        kind: 'ramp',
        type: 'RAMP_STD',
        levels: ['lvl-1', 'lvl-2'],
        stops: [
          [100, 15],
          [100, 15],
        ],
        x: 100,
        z: 15,
        w: 2,
        len: 12,
        shape: 'U',
        preferred: true,
        walkable: false,
      },
    ],
  };
}

// ------------------------------------------------------------------------------------------------------ small helpers

/** The problems whose path is `path` or lies inside it (`levels[0].walls[1]` matches `levels[0].walls[1].t`). */
function problemsAt(result, path) {
  return (result.problems ?? []).filter(
    (p) => p.startsWith(`${path}:`) || p.startsWith(`${path}.`) || p.startsWith(`${path}[`),
  );
}

function deepFreeze(value) {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A seeded pseudo-random generator (mulberry32), so a failing case is reproduced by its seed (DC-O9). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

const ELEMENT_ARRAYS = [
  'walls',
  'openings',
  'units',
  'items',
  'corrections',
  'amenities',
  'transitPoints',
  'anchors',
];

/** Every id in document order: buildings, then each level (its own id, then its arrays in this order), then connectors. */
function collectIds(map) {
  const ids = [];
  for (const b of map.buildings ?? []) ids.push(b.id);
  for (const l of map.levels ?? []) {
    ids.push(l.id);
    for (const name of ELEMENT_ARRAYS) for (const e of l[name] ?? []) ids.push(e.id);
  }
  for (const c of map.connectors ?? []) ids.push(c.id);
  return ids;
}

// ---------------------------------------------------------------------------------------------------- random documents

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * A seeded VALID document (the property tests of AC-12 and AC-25). Ids are random so array order is not id order.
 * opts.messy: coordinates carry noise below half a millimetre, text is padded, defaults are written out, unknown keys
 * are added: all of which a canonical copy removes or rounds away.
 */
function randomDoc(seed, { messy = false } = {}) {
  const rng = mulberry32(seed);
  let counter = 0;
  const nextId = (prefix) => {
    counter += 1;
    return `${prefix}-${counter}-${Math.floor(rng() * 36 ** 4).toString(36)}`;
  };
  const noise = (n) => (messy ? n + (rng() - 0.5) * 0.0006 : n);
  const num = (lo, hi) => noise(round3(between(rng, lo, hi)));
  const pt = (x0, z0, x1, z1) => [num(x0, x1), num(z0, z1)];
  const pad = (s) => (messy ? `  ${s}\t` : s);
  const extra = (o) => (messy ? { ...o, junk: { deep: [1, 2] } } : o);

  const levels = [];
  const connectors = [];
  const indoorCount = 1 + Math.floor(rng() * 3);
  const order = Array.from({ length: indoorCount }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (rng() < 0.4) {
    levels.push(level(nextId('out'), { outdoor: true, ordinal: 0, size: [200, 150] }));
  }
  for (const ordinal of order) {
    const id = nextId('lvl');
    const lv = level(id, {
      building: 'b1',
      ordinal,
      name: pad(`Level ${ordinal}`),
      shortName: `L${ordinal}`,
    });
    if (messy) lv.elevation = 3;
    const walls = Array.from({ length: Math.floor(rng() * 7) }, () => {
      const a = pt(10, 10, 80, 70);
      const b = [round3(a[0] + 5), a[1]];
      return extra(
        wall(nextId('w'), { a, b, ...(messy ? { t: 0.15, kind: 'solid', review: false } : {}) }),
      );
    });
    const openings = walls
      .filter(() => rng() < 0.6)
      .map((w) =>
        extra(
          opening(nextId('o'), w.id, {
            at: num(0.1, 0.9),
            w: 1,
            kind: pick(rng, ['door', 'window']),
          }),
        ),
      );
    const doors = openings.filter((o) => o.kind === 'door').map((o) => o.id);
    const units = [];
    for (let n = Math.floor(rng() * 6); n > 0; n -= 1) {
      const x = num(5, 60);
      const z = num(5, 50);
      const w = num(3, 20);
      const d = num(3, 20);
      const walkable = rng() < 0.4;
      const u = unit(nextId('u'), {
        name: pad(`Unit ${n}`),
        category: pick(rng, ['room', 'walkway', 'storage', 'restroom']),
        walkable,
        poly: [
          [x, z],
          [round3(x + w), z],
          [round3(x + w), round3(z + d)],
          [x, round3(z + d)],
        ],
      });
      if (units.length > 0 && rng() < 0.4) u.parent = pick(rng, units).id;
      if (doors.length > 0 && rng() < 0.5) u.doors = [pick(rng, doors)];
      if (!walkable && rng() < 0.3) u.passThrough = true;
      units.push(extra(u));
    }
    const items = Array.from({ length: Math.floor(rng() * 6) }, () => {
      const type = pick(rng, ['DESK', 'PILLAR', 'PLANTER_ROUND']);
      const it = item(nextId('i'), {
        type,
        x: num(5, 95),
        z: num(5, 75),
        rot: messy ? 725 : num(0, 359),
      });
      if (type === 'DESK')
        Object.assign(it, { w: pick(rng, [0.6, 1.5, 3]), d: pick(rng, [0.5, 1, 1.5]) });
      return extra(it);
    });
    const corrections = Array.from({ length: Math.floor(rng() * 3) }, () =>
      extra(
        correction(nextId('c'), { poly: rect(num(5, 40), num(5, 40), num(50, 90), num(50, 70)) }),
      ),
    );
    const amenities = Array.from({ length: Math.floor(rng() * 3) }, () =>
      extra(
        amenity(nextId('am'), {
          type: pick(rng, ['CR', 'ATM']),
          at: pt(5, 5, 95, 75),
          ...(units.length && rng() < 0.5 ? { unit: pick(rng, units).id } : {}),
        }),
      ),
    );
    const transitPoints = Array.from({ length: Math.floor(rng() * 2) }, () =>
      extra(transitPoint(nextId('tp'), { at: pt(5, 5, 95, 75), name: pad('Taxi') })),
    );
    const anchors = Array.from({ length: Math.floor(rng() * 3) }, () =>
      extra(anchor(nextId('an'), { at: pt(5, 5, 95, 75) })),
    );
    Object.assign(lv, {
      walls,
      openings,
      units,
      items,
      corrections,
      amenities,
      transitPoints,
      anchors,
    });
    levels.push(extra(lv));
  }
  const indoor = levels.filter((l) => !l.outdoor);
  if (indoor.length >= 2 && rng() < 0.7) {
    connectors.push(extra(connector(nextId('cn'), 'stairs', [indoor[0].id, indoor[1].id])));
  }
  return extra({
    spec: 1,
    site: { boundary: BOUNDARY(), ...(messy ? { mapUp: 360 } : {}) },
    buildings: [extra({ id: 'b1', name: pad('Main'), type: 'MAIN' })],
    levels,
    connectors,
  });
}

// ------------------------------------------------------------------------------------------------------------- fuzz

const JUNK = [
  null,
  0,
  -1,
  1.5,
  1e308,
  -0,
  NaN,
  Infinity,
  '',
  ' ',
  'x',
  '1.5',
  'true',
  'a'.repeat(500),
  '__proto__',
  true,
  false,
  [],
  {},
  [1],
  [1, 2, 3],
  ['a', 'b'],
  { a: 1 },
  JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}}'),
  [[[[[]]]]],
];

function allPaths(node, path, out) {
  if (typeof node !== 'object' || node === null) return out;
  for (const key of Object.keys(node)) {
    out.push([...path, key]);
    allPaths(node[key], [...path, key], out);
  }
  return out;
}

const parentOf = (root, path) => path.slice(0, -1).reduce((n, k) => n[k], root);

/** A malformed document, seeded: the full fixture with one to four random mutations (AC-28). */
function fuzzDoc(rng) {
  const doc = structuredClone(fullDoc());
  const steps = 1 + Math.floor(rng() * 4);
  for (let s = 0; s < steps; s += 1) {
    const paths = allPaths(doc, [], []);
    const path = pick(rng, paths);
    const parent = parentOf(doc, path);
    const key = path[path.length - 1];
    const op = Math.floor(rng() * 5);
    if (op === 0) parent[key] = structuredClone(pick(rng, JUNK));
    else if (op === 1) delete parent[key];
    else if (op === 2 && Array.isArray(parent)) parent.push(structuredClone(parent[key]));
    else if (op === 3 && Array.isArray(parent)) parent.splice(Number(key), 1);
    else if (op === 4) {
      const other = pick(rng, paths);
      parent[key] = structuredClone(parentOf(doc, other)[other[other.length - 1]]);
    } else parent[key] = structuredClone(pick(rng, JUNK));
  }
  return doc;
}

module.exports = {
  vm,
  TENANT,
  CATALOG_VERSION,
  objectRow,
  objectRows,
  lookupRow,
  lookupRows,
  makeContext,
  rect,
  BOUNDARY,
  wall,
  opening,
  unit,
  item,
  correction,
  amenity,
  transitPoint,
  anchor,
  level,
  connector,
  smallDoc,
  twoLevelDoc,
  minimalOutdoorDoc,
  minimalBuildingDoc,
  fullDoc,
  problemsAt,
  deepFreeze,
  mulberry32,
  bytesOf,
  collectIds,
  randomDoc,
  fuzzDoc,
  closedSet,
  ELEMENT_ARRAYS,
};
