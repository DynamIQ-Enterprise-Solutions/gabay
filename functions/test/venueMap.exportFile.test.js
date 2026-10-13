'use strict';

// The export envelope (spec/OA-1.md r1 section 3.12; plan/OA-1-map-document.md 1.0 section 9): AC-47; EC-4a. The routes
// that write and read the file are OA-2's. Written FIRST: every case fails until engine-coder builds the module.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const walk = require('./fixtures/schemaWalk');
const { VENUE_MAP_SCHEMA: S } = require('../src/config/venueMapSchema');
const { context, clone, setAt, unsetAt } = require('./fixtures/mapAsserts');

const check = (envelope, ctx = context()) => b.vm().validateExportFile(envelope, ctx);

const store = (over = {}) => ({
  unit: 'u-1',
  name: 'Store A',
  spokenName: 'Store Ay',
  category: 'FASHION',
  keywords: 'shoes, bags',
  ...over,
});

const envelope = (over = {}) => ({
  format: 'gabay.venue-map',
  version: 1,
  exportedAt: '2026-10-13T10:00:00.000Z',
  fromVenue: { code: 'DEMO_AURORA', name: 'Aurora Mall' },
  map: b.fullDoc(),
  stores: [
    store(),
    store({
      unit: 'u-2',
      name: 'Concourse kiosk',
      spokenName: undefined,
      category: 'DINING',
      keywords: undefined,
    }),
  ],
  ...over,
});

const clean = (value) => JSON.parse(JSON.stringify(value));
const problemAt = (res, path) => b.problemsAt(res, path).length;

function assertRefusedAt(res, path, label = path) {
  assert.equal(res.ok, false, `${label}: must be refused`);
  assert.ok(
    problemAt(res, path) >= 1,
    `${label}: a problem at ${path}: ${JSON.stringify(res.problems)}`,
  );
}

test('AC-47: a valid envelope validates, and the canonical file holds the envelope fields, the map and the stores', () => {
  const env = envelope();
  const res = check(clean(env));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const file = res.file;
  assert.equal(file.format, 'gabay.venue-map');
  assert.equal(file.version, 1);
  assert.equal(file.exportedAt, '2026-10-13T10:00:00.000Z');
  assert.deepEqual(file.fromVenue, { code: 'DEMO_AURORA', name: 'Aurora Mall' });
  assert.deepEqual(file.stores, clean(env.stores));
  assert.deepEqual(Object.keys(file).sort(), [
    'exportedAt',
    'format',
    'fromVenue',
    'map',
    'stores',
    'version',
  ]);
});

test('AC-47: map is a canonical document passed through publishable(): it has no backdrop, and is otherwise the canonical map', () => {
  const { publishable, validateMap } = b.vm();
  const res = check(clean(envelope()));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  for (const l of res.file.map.levels) assert.equal('backdrop' in l, false, l.id);
  const expected = publishable(validateMap(b.fullDoc(), context()).map);
  assert.deepEqual(res.file.map, expected);
});

test('AC-47 and EC-4a: a store with status: "CLOSED" validates and its status is not in the canonical file (an imported store starts Open)', () => {
  const env = envelope({ stores: [store({ status: 'CLOSED', active: false, isActive: false })] });
  const res = check(clean(env));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.file.stores, [clean(store())]);
  for (const key of ['status', 'active', 'isActive'])
    assert.equal(key in res.file.stores[0], false, key);
});

test('AC-47: a store holds only unit, name, spokenName, category and keywords: any other key is left out', () => {
  const env = envelope({
    stores: [
      store({
        openingHours: '9-9',
        tenantId: 3,
        occupantId: 44,
        createdBy: 1,
        StatusCode: 'CLOSED',
        extra: { a: 1 },
      }),
    ],
  });
  const res = check(clean(env));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(Object.keys(res.file.stores[0]).sort(), [
    'category',
    'keywords',
    'name',
    'spokenName',
    'unit',
  ]);
});

test('AC-47: the file holds no tenant id, venue id, user, audit stamp, beacon, closure, store status or status history', () => {
  const env = envelope({
    tenantId: 5,
    venueId: 9,
    userId: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: 1,
    beacons: [{ uuid: 'x' }],
    closures: [{ unit: 'u-1' }],
    storeStatus: { 'u-1': 'CLOSED' },
    statusHistory: [],
  });
  const res = check(clean(env));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(Object.keys(res.file).sort(), [
    'exportedAt',
    'format',
    'fromVenue',
    'map',
    'stores',
    'version',
  ]);
});

test('AC-47: a store keyed to a wall (an element of another kind) gives a problem at the store unit', () => {
  assertRefusedAt(check(clean(envelope({ stores: [store({ unit: 'w-1' })] }))), 'stores[0].unit');
});

test('AC-47: a store keyed to an id the map does not hold gives a problem at the store unit, naming the key', () => {
  const res = check(clean(envelope({ stores: [store({ unit: 'ghost' })] })));
  assertRefusedAt(res, 'stores[0].unit');
  assert.ok(b.problemsAt(res, 'stores[0].unit').some((p) => p.includes('ghost')));
});

test('AC-47: two stores on one unit give a problem at the later store (P0-11 G7)', () => {
  const res = check(clean(envelope({ stores: [store(), store({ name: 'Other' })] })));
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1, JSON.stringify(res.problems));
  assert.ok(res.problems[0].startsWith('stores[1].unit:'), res.problems[0]);
});

test('AC-47: a store category that is not in the context gives a problem at the category, naming the code', () => {
  const res = check(clean(envelope({ stores: [store({ category: 'NO_SUCH_CATEGORY' })] })));
  assertRefusedAt(res, 'stores[0].category');
  assert.ok(b.problemsAt(res, 'stores[0].category').some((p) => p.includes('NO_SUCH_CATEGORY')));
});

test('AC-47 and AC-20: an inactive category is accepted and kept', () => {
  const res = check(clean(envelope({ stores: [store({ category: 'SPORTS_OLD' })] })));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(res.file.stores[0].category, 'SPORTS_OLD');
});

test("AC-47: the category is resolved for the tenant, platform rows too (a tenant-only category resolves; the shaper takes only the request tenant's rows)", () => {
  const rows = b.lookupRows();
  const ctx = b.makeContext({
    occupantCategories: [
      ...rows.occupantCategories,
      b.lookupRow('OWN_CATEGORY', { tenantId: b.TENANT }),
    ],
  });
  assert.equal(
    check(clean(envelope({ stores: [store({ category: 'OWN_CATEGORY' })] })), ctx).ok,
    true,
  );
});

test('AC-47: format and version are exactly gabay.venue-map and 1', () => {
  for (const [field, value] of [
    ['format', 'gabay.venue-map.v2'],
    ['format', 'venue-map'],
    ['format', ''],
    ['format', 7],
    ['version', 2],
    ['version', 0],
    ['version', '1'],
    ['version', 1.5],
  ]) {
    assertRefusedAt(
      check(clean(envelope({ [field]: value }))),
      field,
      `${field} ${JSON.stringify(value)}`,
    );
  }
});

test('AC-47: exportedAt is an ISO-8601 UTC timestamp; an offset, a date alone, no zone or text gives a problem at exportedAt', () => {
  for (const bad of [
    '2026-10-13T10:00:00+08:00',
    '2026-10-13',
    '2026-10-13T10:00:00',
    'yesterday',
    '',
    12345,
    null,
  ]) {
    assertRefusedAt(check(clean(envelope({ exportedAt: bad }))), 'exportedAt', JSON.stringify(bad));
  }
  for (const ok of ['2026-10-13T10:00:00Z', '2026-10-13T10:00:00.123Z']) {
    assert.equal(check(clean(envelope({ exportedAt: ok }))).ok, true, ok);
  }
});

test('AC-47: a map that fails the validator fails the envelope, naming the map problem', () => {
  const env = envelope();
  env.map.levels[1].walls[0].t = 0;
  const res = check(clean(env));
  assert.equal(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('levels[1].walls[0].t')),
    JSON.stringify(res.problems),
  );
  assert.ok(res.total >= 1);
});

test('AC-47: a map with levels: [] fails, naming levels', () => {
  const env = envelope({ stores: [store({ category: 'NO_SUCH_CATEGORY' })] });
  env.map.levels = [];
  const res = check(clean(env));
  assert.equal(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('levels')),
    JSON.stringify(res.problems),
  );
});

test('AC-47: a backdrop in the map is stripped, not refused (the map is passed through publishable())', () => {
  const env = envelope();
  assert.ok(env.map.levels[1].backdrop);
  const res = check(clean(env));
  assert.equal(res.ok, true);
  assert.equal(JSON.stringify(res.file).includes('0123456789abcdef'), false);
});

test('AC-47: store text limits are the Occupant columns: name and spokenName 200, keywords 400; name is required', () => {
  assertRefusedAt(
    check(clean(envelope({ stores: [store({ name: 'x'.repeat(201) })] }))),
    'stores[0].name',
  );
  assertRefusedAt(
    check(clean(envelope({ stores: [store({ spokenName: 'x'.repeat(201) })] }))),
    'stores[0].spokenName',
  );
  assertRefusedAt(
    check(clean(envelope({ stores: [store({ keywords: 'x'.repeat(401) })] }))),
    'stores[0].keywords',
  );
  assertRefusedAt(check(clean(envelope({ stores: [store({ name: '   ' })] }))), 'stores[0].name');
  const ok = check(
    clean(
      envelope({
        stores: [
          store({ name: 'x'.repeat(200), spokenName: 'y'.repeat(200), keywords: 'k'.repeat(400) }),
        ],
      }),
    ),
  );
  assert.equal(ok.ok, true, JSON.stringify(ok.problems));
});

test('AC-47: a store with no spokenName or keywords is valid, and an empty one is left out', () => {
  const res = check(
    clean(
      envelope({
        stores: [
          { unit: 'u-1', name: 'Store A', category: 'FASHION', spokenName: '  ', keywords: '' },
        ],
      }),
    ),
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.file.stores[0], { unit: 'u-1', name: 'Store A', category: 'FASHION' });
});

// Generated from the schema file: every required field of the envelope, the venue and the store.
const REQUIRED = [];
for (const kind of ['envelope', 'fromVenue', 'store']) {
  for (const [name, rule] of Object.entries(S.exportFile.kinds[kind].fields)) {
    if (rule.required) REQUIRED.push({ kind, name });
  }
}
const PATH_OF = {
  envelope: (n) => n,
  fromVenue: (n) => `fromVenue.${n}`,
  store: (n) => `stores[0].${n}`,
};

for (const { kind, name } of REQUIRED) {
  test(`AC-47: removing the required ${kind}.${name} gives a problem at ${PATH_OF[kind](name)}`, () => {
    const env = clean(envelope());
    unsetAt(env, PATH_OF[kind](name));
    assertRefusedAt(check(env), PATH_OF[kind](name));
  });
}

test('AC-47: the export schema in the schema file has the stores and the envelope fields of the spec and nothing about status', () => {
  assert.deepEqual(Object.keys(S.exportFile.kinds.store.fields).sort(), [
    'category',
    'keywords',
    'name',
    'spokenName',
    'unit',
  ]);
  assert.deepEqual(Object.keys(S.exportFile.kinds.envelope.fields).sort(), [
    'exportedAt',
    'format',
    'fromVenue',
    'map',
    'stores',
    'version',
  ]);
  assert.equal(S.exportFile.format, 'gabay.venue-map');
  assert.equal(S.exportFile.version, 1);
  assert.ok(walk.isObject(S.exportFile.kinds.store));
});

test('AC-47: a non-object envelope (null, a string, an array) is refused without throwing', () => {
  for (const bad of [null, undefined, 'x', 7, [], [envelope()]]) {
    let res;
    assert.doesNotThrow(() => (res = check(bad)), String(bad));
    assert.equal(res.ok, false);
    assert.ok(Array.isArray(res.problems) && res.problems.length >= 1);
  }
});

test('AC-47: stores that is not an array, or holds a non-object, gives a problem and the rest is still checked', () => {
  const notArray = clean(envelope());
  setAt(notArray, 'stores', 'x');
  assertRefusedAt(check(notArray), 'stores');
  const junk = clean(envelope());
  setAt(junk, 'stores', [7, store()]);
  assertRefusedAt(check(junk), 'stores[0]');
});

test('AC-47: the input envelope is not mutated', () => {
  const env = b.deepFreeze(clean(envelope()));
  assert.doesNotThrow(() => check(env));
  const before = JSON.stringify(env);
  check(env);
  assert.equal(JSON.stringify(env), before);
  assert.ok(clone(env));
});
