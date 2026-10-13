'use strict';

// The validator's contract (spec/OA-1.md r1 section 3.6 and 3.7; plan/OA-1-map-document.md 1.0 section 9): AC-23 to
// AC-29, AC-32; EC-10, EC-19, EC-23, EC-26. Written FIRST: every case fails until engine-coder builds the validator.
//
// DESIGN CHOICE proposed by engine-coder and used here (DC-E17): problems are in document position, that is the array
// index first, then the schema file's field order; the first MAX_PROBLEMS are kept and the total counts them all.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const b = require('./fixtures/mapBuilder');
const { validate, clone, assertProblemAt } = require('./fixtures/mapAsserts');
const { constant } = require('../src/config/venueMapSchema');

const MODULE_DIR = path.join(__dirname, '..', 'src', 'services', 'venueMap');

// ----------------------------------------------------------------------------------------------------------- AC-23

/**
 * Runs fn with the database, the clock (Date.now, new Date(), performance.now), the network, randomness (Math.random;
 * node:crypto's randomBytes, randomUUID, randomInt and createHash; web crypto's getRandomValues and randomUUID) and the
 * environment stubbed to throw; restores them after. The clock and crypto stubs were added by dod-reviewer's OA-1
 * review 1. node:crypto's own getRandomValues is a non-configurable getter, so it cannot be stubbed; its source, web
 * crypto's getRandomValues, is.
 */
function withStubs(fn) {
  const { Pool } = require('pg');
  const nodeCrypto = require('node:crypto');
  // A function, not an arrow, so `new Date()` reaches it and throws this error.
  const boom = (what) =>
    function stub() {
      throw new Error(`the validator used ${what}`);
    };
  // The Date stub keeps a throwing now, because once it replaces Date, Date.now reads it.
  const dateStub = Object.assign(boom('new Date()'), { now: boom('Date.now') });
  const stubs = [
    [Pool.prototype, 'query', 'pg Pool.query'],
    [Pool.prototype, 'connect', 'pg Pool.connect'],
    [Date, 'now', 'Date.now'],
    [globalThis, 'Date', dateStub],
    [Object.getPrototypeOf(globalThis.performance), 'now', 'performance.now'],
    [globalThis, 'fetch', 'fetch'],
    [Math, 'random', 'Math.random'],
    [nodeCrypto, 'randomBytes', 'crypto.randomBytes'],
    [nodeCrypto, 'randomUUID', 'crypto.randomUUID'],
    [nodeCrypto, 'randomInt', 'crypto.randomInt'],
    [nodeCrypto, 'createHash', 'crypto.createHash'],
    [Object.getPrototypeOf(globalThis.crypto), 'getRandomValues', 'crypto.getRandomValues'],
    [Object.getPrototypeOf(globalThis.crypto), 'randomUUID', 'crypto.randomUUID (web)'],
  ];
  const saved = stubs.map(([owner, name]) => [
    owner,
    name,
    Object.getOwnPropertyDescriptor(owner, name),
  ]);
  const savedEnv = process.env;
  for (const [owner, name, what] of stubs) {
    const value = typeof what === 'function' ? what : boom(what);
    Object.defineProperty(owner, name, { value, writable: true, configurable: true });
  }
  process.env = new Proxy(
    {},
    {
      get: boom('process.env'),
      has: boom('process.env'),
      ownKeys: boom('process.env'),
      getOwnPropertyDescriptor: boom('process.env'),
    },
  );
  try {
    return fn();
  } finally {
    for (const [owner, name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(owner, name, descriptor);
      else delete owner[name]; // it was inherited: remove the stub that shadowed it
    }
    process.env = savedEnv;
  }
}

test('AC-23: the stubs really throw while they are in place (the clock, performance.now and crypto included), and are restored after', () => {
  const nodeCrypto = require('node:crypto');
  const probes = {
    'Date.now': () => Date.now(),
    'new Date()': () => new globalThis.Date(),
    'performance.now': () => performance.now(),
    'crypto.randomBytes': () => nodeCrypto.randomBytes(4),
    'crypto.randomUUID': () => nodeCrypto.randomUUID(),
    'globalThis.crypto.getRandomValues': () => globalThis.crypto.getRandomValues(new Uint8Array(4)),
    'globalThis.crypto.randomUUID': () => globalThis.crypto.randomUUID(),
    'Math.random': () => Math.random(),
  };
  withStubs(() => {
    for (const [what, probe] of Object.entries(probes)) {
      assert.throws(probe, /the validator used/, `${what} is stubbed`);
    }
  });
  for (const [what, probe] of Object.entries(probes)) {
    assert.doesNotThrow(probe, `${what} is restored`);
  }
});

test('AC-23: the validator opens no connection, reads no clock, makes no network call and reads no environment value; repeated runs are byte-identical', () => {
  const ctx = b.makeContext();
  const good = b.fullDoc();
  const bad = b.fullDoc();
  bad.levels[1].walls[0].t = 0;
  bad.connectors[0].levels = ['lvl-1', 'ghost'];
  validate(good, ctx); // warm up: a first call may load code lazily
  validate(bad, ctx);
  const run = (doc) => withStubs(() => [1, 2, 3].map(() => JSON.stringify(validate(doc, ctx))));
  for (const doc of [good, bad]) {
    const texts = run(doc);
    assert.equal(texts[0], texts[1]);
    assert.equal(texts[1], texts[2]);
  }
});

test('AC-23: the same inputs give the same output from two contexts built apart', () => {
  const doc = b.fullDoc();
  const one = JSON.stringify(validate(doc, b.makeContext()));
  const two = JSON.stringify(validate(doc, b.makeContext()));
  assert.equal(one, two);
});

test('EC-19: the validator holds no state between calls (a bad document then a good one: the good one still validates)', () => {
  const bad = b.smallDoc();
  bad.spec = 7;
  assert.equal(validate(bad).ok, false);
  assert.equal(validate(b.smallDoc()).ok, true);
  assert.equal(validate(bad).ok, false);
});

// ----------------------------------------------------------------------------------------------------------- AC-24

function everyObject(root) {
  const seen = new Set();
  (function visit(node) {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    for (const v of Object.values(node)) visit(v);
  })(root);
  return seen;
}

test('AC-24: a deep-frozen input validates, is never mutated, and no object or array of it is in the result (a new object is built)', () => {
  const input = b.deepFreeze(b.fullDoc());
  const res = validate(input);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.notEqual(res.map, input);
  const inputs = everyObject(input);
  for (const out of everyObject(res.map))
    assert.ok(!inputs.has(out), 'the result shares an object with the input');
});

test('AC-24: a frozen input that FAILS also throws nothing and changes nothing', () => {
  const input = b.deepFreeze(b.fullDoc());
  const frozenCopy = clone(input);
  frozenCopy.levels = [];
  b.deepFreeze(frozenCopy);
  const res = validate(frozenCopy);
  assert.equal(res.ok, false);
});

/** Puts an own enumerable "__proto__", "constructor" and "prototype" key on every object of the document, as JSON.parse can. */
function poison(node) {
  if (typeof node !== 'object' || node === null) return;
  for (const v of Object.values(node)) poison(v);
  if (Array.isArray(node)) return;
  Object.defineProperty(node, '__proto__', {
    value: { polluted: 'proto' },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  node.constructor = { prototype: { polluted: 'constructor' } };
  node.prototype = { polluted: 'prototype' };
}

test('AC-24: __proto__, constructor and prototype keys at every depth never reach the copy or any prototype', () => {
  const doc = b.fullDoc();
  poison(doc);
  assert.ok(
    Object.hasOwn(doc.levels[1].walls[0], '__proto__'),
    'the fixture really has an own __proto__ key',
  );
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal([].polluted, undefined);
  for (const obj of everyObject(res.map)) {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      assert.equal(Object.hasOwn(obj, key), false, `an own ${key} key reached the copy`);
    }
    const proto = Object.getPrototypeOf(obj);
    assert.ok(proto === Object.prototype || proto === Array.prototype, 'a plain object or array');
  }
  assert.doesNotMatch(JSON.stringify(res.map), /polluted/);
  assert.deepEqual(res.map, { ...b.fullDoc(), units: 'm' });
});

test('AC-24: prototype keys parsed from JSON text are left out too (EC-26)', () => {
  const text = JSON.stringify(b.smallDoc()).replace(
    '"spec":1',
    '"spec":1,"__proto__":{"polluted":"json"},"constructor":{"prototype":{"polluted":"c"}},"prototype":{"x":1}',
  );
  const doc = JSON.parse(text);
  assert.ok(Object.hasOwn(doc, '__proto__'));
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.keys(res.map).sort(), [
    'buildings',
    'catalog',
    'levels',
    'site',
    'spec',
    'units',
  ]);
});

// ----------------------------------------------------------------------------------------------------------- AC-25

test('AC-25: validating a canonical copy returns a deep-equal copy with identical text (seeded property test, 60 documents tidy and messy, and the full document)', () => {
  const docs = [b.fullDoc()];
  for (let seed = 1; seed <= 60; seed += 1)
    docs.push(b.randomDoc(seed), b.randomDoc(seed, { messy: true }));
  for (const [i, doc] of docs.entries()) {
    const first = validate(doc);
    assert.equal(first.ok, true, `doc ${i}: ${JSON.stringify(first.problems?.slice(0, 2))}`);
    const second = validate(first.map);
    assert.equal(second.ok, true, `doc ${i}: ${JSON.stringify(second.problems?.slice(0, 2))}`);
    assert.deepEqual(second.map, first.map, `doc ${i}`);
    assert.equal(JSON.stringify(second.map), JSON.stringify(first.map), `doc ${i}: text`);
  }
});

// ----------------------------------------------------------------------------------------------------------- AC-26

const wallFaults = (n) => {
  const doc = b.smallDoc();
  doc.levels[0].walls = Array.from({ length: n }, (_, i) => b.wall(`w${i}`, { t: 0 }));
  return doc;
};

test('AC-26: a document with 25 faults gives 20 problems and a total of 25, in document order', () => {
  const res = validate(wallFaults(25));
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, constant('MAX_PROBLEMS'));
  assert.equal(res.problems.length, 20);
  assert.equal(res.total, 25);
  res.problems.forEach((p, i) =>
    assert.ok(p.startsWith(`levels[0].walls[${i}].t: `), `problem ${i}: ${p}`),
  );
});

test('EC-10: a whole bad import (300 faults) gives 20 problems and a total of 300', () => {
  const res = validate(wallFaults(300));
  assert.equal(res.problems.length, 20);
  assert.equal(res.total, 300);
});

test('AC-26: with 20 faults or fewer, every problem is reported and the total equals the count', () => {
  for (const n of [1, 3, 19, 20]) {
    const res = validate(wallFaults(n));
    assert.equal(res.problems.length, n);
    assert.equal(res.total, n);
  }
  const res21 = validate(wallFaults(21));
  assert.equal(res21.problems.length, 20);
  assert.equal(res21.total, 21);
});

test('AC-26: each problem reads "<path>: <message>" with zero-based indexes and the field names of the spec, in plain English', () => {
  const doc = b.smallDoc();
  doc.levels[0].items = Array.from({ length: 8 }, (_, i) =>
    b.item(`i${i}`, i === 7 ? { w: 9 } : {}),
  );
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1);
  assert.match(res.problems[0], /^levels\[0\]\.items\[7\]\.w: [A-Za-z].+/);
  assert.doesNotMatch(res.problems[0], /undefined|\[object|NaN/);
});

test('AC-26 (DC-E17): faults in different parts come in document position: site, buildings, levels (by index, then field order), connectors', () => {
  const doc = b.twoLevelDoc();
  doc.site.mapUp = 'north';
  doc.buildings[0].name = '';
  doc.levels[0].walls = [b.wall('w1', { t: 0 })];
  doc.levels[1].items = [b.item('i1', { type: 'GHOST_TYPE' })];
  doc.connectors = [b.connector('c1', 'stairs', ['l1', 'l2'], { w: 99 })];
  const res = validate(doc);
  assert.equal(res.ok, false);
  assert.deepEqual(
    res.problems.map((p) => p.slice(0, p.indexOf(':'))),
    [
      'site.mapUp',
      'buildings[0].name',
      'levels[0].walls[0].t',
      'levels[1].items[0].type',
      'connectors[0].w',
    ],
  );
  assert.equal(res.total, 5);
});

test('AC-26: array order decides, so an earlier index is reported before a later one whatever the field', () => {
  const doc = b.twoLevelDoc();
  doc.levels[1].name = '';
  doc.levels[0].shortName = '';
  const res = validate(doc);
  assert.deepEqual(
    res.problems.map((p) => p.slice(0, p.indexOf(':'))),
    ['levels[0].shortName', 'levels[1].name'],
  );
});

// ----------------------------------------------------------------------------------------------------------- AC-27

test('AC-27: mapProblemBody builds the standard error body plus the problems and the total', () => {
  const { mapProblemBody } = b.vm();
  const problems = Array.from(
    { length: 20 },
    (_, i) => `levels[0].walls[${i}].t: must be from 0.05 to 1`,
  );
  assert.deepEqual(mapProblemBody({ problems, total: 25 }), {
    error: 'This map has 25 problems.',
    problems,
    total: 25,
  });
  assert.equal(
    mapProblemBody({ problems: problems.slice(0, 2), total: 2 }).error,
    'This map has 2 problems.',
  );
});

test('AC-27: the body built from a real failure carries its own problems and total', () => {
  const { mapProblemBody } = b.vm();
  const res = validate(wallFaults(25));
  const body = mapProblemBody(res);
  assert.equal(body.error, 'This map has 25 problems.');
  assert.deepEqual(body.problems, res.problems);
  assert.equal(body.total, 25);
  assert.deepEqual(Object.keys(body).sort(), ['error', 'problems', 'total']);
});

// ----------------------------------------------------------------------------------------------------------- AC-28

function assertValidResult(res, label) {
  assert.ok(res !== null && typeof res === 'object', `${label}: a result object`);
  if (res.ok === true) {
    assert.ok(res.map !== null && typeof res.map === 'object', `${label}: a map`);
    return;
  }
  assert.equal(res.ok, false, `${label}: ok is true or false`);
  assert.ok(Array.isArray(res.problems), `${label}: problems`);
  assert.ok(
    res.problems.length >= 1 && res.problems.length <= 20,
    `${label}: 1 to 20 problems, got ${res.problems.length}`,
  );
  for (const p of res.problems) {
    assert.ok(
      typeof p === 'string' && /^\S[\s\S]*: [\s\S]+/.test(p),
      `${label}: a "<path>: <message>" string, got ${JSON.stringify(p)}`,
    );
  }
  assert.ok(Number.isInteger(res.total) && res.total >= res.problems.length, `${label}: total`);
  assert.doesNotThrow(() => JSON.stringify(res), `${label}: serialisable`);
}

test('AC-28 and EC-23: null, a number, a string, an array, {} and other non-documents give problems and never throw', () => {
  for (const bad of [
    null,
    undefined,
    0,
    1,
    -1,
    1.5,
    NaN,
    Infinity,
    '',
    'x',
    '{}',
    true,
    false,
    [],
    [1],
    [{}],
    {},
    { spec: 1 },
  ]) {
    const res = validate(bad);
    assert.equal(res.ok, false, String(bad));
    assertValidResult(res, String(bad));
  }
});

test('AC-28: a document 30 levels deep (objects, arrays, and the two nested) gives problems and never throws', () => {
  let objects = {};
  let arrays = [];
  let mixed = {};
  for (let i = 0; i < 30; i += 1) {
    objects = { levels: objects };
    arrays = [arrays];
    mixed = i % 2 === 0 ? { levels: [mixed] } : [mixed];
  }
  for (const deep of [
    objects,
    arrays,
    mixed,
    { spec: 1, site: objects, levels: arrays, connectors: mixed },
  ]) {
    assertValidResult(validate(deep), 'deep');
  }
});

test('AC-28: arrays where objects belong and objects where arrays belong give problems and never throw', () => {
  const swaps = [
    ['site', []],
    ['site', 'x'],
    ['levels', {}],
    ['levels', 'x'],
    ['levels', [[]]],
    ['levels', [null]],
    ['buildings', {}],
    ['connectors', 'x'],
    ['levels[1].walls', {}],
    ['levels[1].units', 7],
    ['levels[1].units[0]', []],
    ['levels[1].units[0].poly', {}],
    ['levels[1].units[0].poly', [[]]],
    ['levels[1].units[0].poly', [null, null, null]],
    ['levels[1].units[0].doors', 'o-1'],
    ['levels[1].floor', []],
    ['levels[1].backdrop', 'x'],
    ['connectors[0].stops', {}],
    ['connectors[0].stops', [1, 2]],
    ['connectors[0].levels', 'lvl-1'],
    ['connectors[0].levels', [{}, []]],
    ['site.boundary', {}],
    ['site.boundary', 'x'],
    ['site.georeference', []],
  ];
  const setAt = require('./fixtures/mapAsserts').setAt;
  for (const [where, value] of swaps) {
    const doc = clone(b.fullDoc());
    setAt(doc, where, value);
    const res = validate(doc);
    assertValidResult(res, where);
    assert.equal(res.ok, false, `${where} = ${JSON.stringify(value)} must be refused`);
  }
});

test('AC-28: a missing parent stops only its own branch: the rest of the document is still checked', () => {
  const doc = clone(b.fullDoc());
  doc.levels[1].walls = 'not an array';
  doc.levels[2].items = [b.item('bad-item', { type: 'PILLAR', w: 5 })];
  doc.connectors[0].w = 99;
  doc.buildings[2].name = '';
  const res = validate(doc);
  assert.equal(res.ok, false);
  assertProblemAt(res, 'levels[1].walls');
  assertProblemAt(res, 'levels[2].items[0].w');
  assertProblemAt(res, 'connectors[0].w');
  assertProblemAt(res, 'buildings[2].name');
});

test('AC-28: a site that is not an object does not hide faults in the levels', () => {
  const doc = clone(b.fullDoc());
  doc.site = 5;
  doc.levels[1].name = '';
  const res = validate(doc);
  assertProblemAt(res, 'site');
  assertProblemAt(res, 'levels[1].name');
});

test('AC-28: a level that is not an object does not hide faults in the other levels or the connectors', () => {
  const doc = clone(b.fullDoc());
  doc.levels[0] = 'x';
  doc.levels[3].name = '';
  doc.connectors[1].cars = 9;
  const res = validate(doc);
  assertProblemAt(res, 'levels[0]');
  assertProblemAt(res, 'levels[3].name');
  assertProblemAt(res, 'connectors[1].cars');
});

test('AC-28: a seeded fuzz of 10,000 malformed documents never throws, and every result is a valid problem list or a valid map', () => {
  const rng = b.mulberry32(28);
  let refused = 0;
  for (let i = 0; i < 10000; i += 1) {
    const doc = b.fuzzDoc(rng);
    let res;
    try {
      res = validate(doc);
    } catch (err) {
      assert.fail(`iteration ${i} threw ${err.stack}\n${JSON.stringify(doc).slice(0, 600)}`);
    }
    assertValidResult(res, `iteration ${i}`);
    if (!res.ok) refused += 1;
  }
  assert.ok(refused > 2000, `the fuzz must mostly produce faults (refused ${refused} of 10000)`);
});

// ----------------------------------------------------------------------------------------------------------- AC-29

test('AC-29: the module exports one map validator, validateMap, and the other helpers of the plan (section 3.2)', () => {
  const mod = b.vm();
  assert.equal(typeof mod.validateMap, 'function');
  for (const name of [
    'publishable',
    'elementIndex',
    'keyStatus',
    'readMap',
    'mapProblemBody',
    'validateExportFile',
    'shapeCatalog',
    'shapeMapContext',
  ]) {
    assert.equal(typeof mod[name], 'function', name);
  }
  const validators = Object.keys(mod).filter((k) => /^validate/.test(k));
  assert.deepEqual(validators.sort(), ['validateExportFile', 'validateMap']);
});

test('AC-29: no file of services/venueMap/ exports a validator other than validateMap and validateExportFile, and each is one function', () => {
  const files = fs.readdirSync(MODULE_DIR).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('index.js'), 'index.js is the module surface');
  const found = new Map();
  for (const f of files) {
    const exported = require(path.join(MODULE_DIR, f));
    for (const [name, fn] of Object.entries(exported ?? {})) {
      if (!/^validate/i.test(name)) continue;
      assert.ok(['validateMap', 'validateExportFile'].includes(name), `${f} exports ${name}`);
      if (found.has(name))
        assert.equal(found.get(name), fn, `${name} is one function across files`);
      found.set(name, fn);
    }
  }
  const mod = b.vm();
  assert.equal(found.get('validateMap'), mod.validateMap, 'index exports the same validateMap');
});

test('AC-29: validateExportFile checks the map through validateMap (the same problem for the same fault)', () => {
  const ctx = b.makeContext();
  const bad = b.fullDoc();
  bad.levels[1].walls[0].t = 0;
  const direct = validate(bad, ctx);
  const envelope = {
    format: 'gabay.venue-map',
    version: 1,
    exportedAt: '2026-10-13T10:00:00.000Z',
    fromVenue: { code: 'V1', name: 'Venue' },
    map: bad,
    stores: [],
  };
  const viaExport = b.vm().validateExportFile(envelope, ctx);
  assert.equal(viaExport.ok, false);
  assert.ok(
    viaExport.problems.some((p) => p.includes(direct.problems[0].split(': ')[0])),
    `${viaExport.problems.join(' | ')} names ${direct.problems[0]}`,
  );
});

// ----------------------------------------------------------------------------------------------------------- AC-32

const CAP = () => constant('MAX_MAP_BYTES');

/** `doc` with an unknown key "pad" so that its JSON text is exactly `target` bytes (an unknown key is left out of the canonical copy). */
function padTo(doc, target) {
  const overhead = b.bytesOf({ ...doc, pad: '' });
  const padded = { ...doc, pad: 'x'.repeat(target - overhead) };
  assert.equal(b.bytesOf(padded), target, 'the padding is exact');
  return padded;
}

test('AC-32: a document of exactly MAX_MAP_BYTES is accepted, and one byte over is refused with the single size problem', () => {
  const cap = CAP();
  assert.equal(cap, 4 * 1048576);
  const exact = validate(padTo(b.fullDoc(), cap));
  assert.equal(exact.ok, true, JSON.stringify(exact.problems?.slice(0, 2)));
  const over = validate(padTo(b.fullDoc(), cap + 1));
  assert.equal(over.ok, false);
  assert.deepEqual(over.problems, [`(document): is ${cap + 1} bytes; the limit is ${cap}`]);
  assert.equal(over.total, 1);
});

test('AC-32: the size check comes before any other check (an oversize document with other faults gives only the size problem)', () => {
  const doc = b.fullDoc();
  doc.spec = 99;
  doc.levels = 'x';
  const over = validate(padTo(doc, CAP() + 1));
  assert.deepEqual(over.problems, [`(document): is ${CAP() + 1} bytes; the limit is ${CAP()}`]);
});

test('AC-32: bytes are UTF-8 bytes of the JSON text (a multi-byte pad counts by its encoded size)', () => {
  const cap = CAP();
  const base = b.fullDoc();
  const overhead = b.bytesOf({ ...base, pad: '' });
  // each "ñ" is 2 bytes, so this pad is exactly cap bytes
  const remaining = cap - overhead;
  const pad = (remaining % 2 ? 'x' : '') + 'ñ'.repeat(Math.floor(remaining / 2));
  const exact = { ...base, pad };
  assert.equal(b.bytesOf(exact), cap);
  assert.equal(validate(exact).ok, true);
  const over = { ...base, pad: pad + 'ñ' };
  assert.equal(b.bytesOf(over), cap + 2);
  assert.deepEqual(validate(over).problems, [
    `(document): is ${cap + 2} bytes; the limit is ${cap}`,
  ]);
});

test('AC-32: a canonical copy over the cap is refused the same way, even when the input was under it (a fixture schema puts the cap between the two sizes, DC-E16)', () => {
  const { loadVenueMapSchema, SCHEMA_FILE } = require('../src/config/venueMapSchema');
  const doc = b.smallDoc();
  doc.levels = Array.from({ length: 10 }, (_, i) =>
    b.level(`l${i}`, {
      building: 'b1',
      ordinal: i - 4,
      // no walkable: the canonical copy writes it for every unit (AC-9), about 17 bytes each
      units: Array.from({ length: constant('MAX_UNITS_PER_LEVEL') }, (_, u) => ({
        id: `u${i}-${u}`,
        category: 'room',
        poly: b.rect(50, 10, 60, 20),
      })),
    }),
  );
  const live = validate(doc);
  assert.equal(live.ok, true, 'under the live cap it validates');
  const inputBytes = b.bytesOf(doc);
  const copyBytes = b.bytesOf(live.map);
  assert.ok(copyBytes > inputBytes + 20000, 'the canonical copy is bigger than the input');
  const cap = inputBytes + 10000; // the input fits, the copy does not
  const raw = clone(require(SCHEMA_FILE));
  raw.constants.MAX_MAP_BYTES.value = cap;
  const res = validate(doc, { ...b.makeContext(), schema: loadVenueMapSchema(raw) });
  assert.equal(res.ok, false, 'the copy is measured, not only the input');
  assert.equal(res.problems.length, 1);
  const match = /^\(document\): is (\d+) bytes; the limit is (\d+)$/.exec(res.problems[0]);
  assert.ok(match, res.problems[0]);
  assert.equal(Number(match[2]), cap);
  assert.equal(Number(match[1]), copyBytes);
});

test('AC-32: MAX_MAP_BYTES is below the configured request body limit (5mb is 5 x 1,048,576 bytes, so a save has room for its envelope)', () => {
  const bytes = require('bytes');
  const { testConfig } = require('./helpers');
  assert.equal(bytes.parse('5mb'), 5 * 1048576, 'the library counts mb as 2^20');
  assert.ok(
    CAP() < bytes.parse(testConfig().maxJsonBody),
    `${CAP()} < ${testConfig().maxJsonBody}`,
  );
  assert.ok(CAP() < bytes.parse('5mb'));
});

// ------------------------------------------------- regression: the size cap skipped on a deep document (review 1)
//
// Bug (dod-reviewer, OA-1 review 1, Important): the input's bytes were counted with JSON.stringify, which throws
// "Maximum call stack size exceeded" on deeply nested arrays; the count then came back empty and the input cap
// (AC-32) was skipped, so an unknown key holding 2.3 million nested arrays (4.6 MB) validated. A second fault of the
// same kind: a closed-set problem quoted its value with JSON.stringify, so a deep value there threw (AC-28). The
// input is now measured without recursion, and a value with no JSON text is refused.

/** `depth` arrays, each holding the next: "[[[...]]]", 2 x (depth + 1) characters of JSON. */
function nested(depth) {
  let value = [];
  for (let i = 0; i < depth; i += 1) value = [value];
  return value;
}

test('AC-32 (regression, review 1): an input too deep for JSON.stringify is still measured: over the cap gives the single size problem, with its exact bytes', () => {
  const cap = CAP();
  const depth = 2300000;
  const doc = b.smallDoc();
  const expected = b.bytesOf({ ...doc, junk: [] }) - 2 + 2 * (depth + 1);
  assert.ok(expected > cap, 'the probe is over the cap');
  doc.junk = nested(depth);
  assert.throws(() => JSON.stringify(doc), RangeError, 'JSON.stringify cannot write it');
  const res = validate(doc);
  assert.equal(res.ok, false, 'the cap is not skipped');
  assert.deepEqual(res.problems, [`(document): is ${expected} bytes; the limit is ${cap}`]);
  assert.equal(res.total, 1);
});

test('AC-32 (regression, review 1): a deep value under the cap in an unknown key is measured and left out of the copy', () => {
  const doc = b.smallDoc();
  doc.junk = nested(100000);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems?.slice(0, 2)));
  assert.equal('junk' in res.map, false);
});

test('AC-28 (regression, review 1): a value too deep for JSON.stringify in a known field gives a problem at it, never a throw', () => {
  const doc = b.smallDoc();
  doc.levels[0].units = [b.unit('u1', { category: nested(200000) })];
  doc.levels[0].walls = [b.wall('w1', { kind: nested(200000) })];
  let res;
  assert.doesNotThrow(() => (res = validate(doc)));
  assert.equal(res.ok, false);
  assert.equal(
    b.problemsAt(res, 'levels[0].units[0].category').length,
    1,
    JSON.stringify(res.problems),
  );
  assert.equal(
    b.problemsAt(res, 'levels[0].walls[0].kind').length,
    1,
    JSON.stringify(res.problems),
  );
});

test('AC-28 and AC-32 (regression, review 1): a value with no JSON text (a cycle, a BigInt) is refused with one document problem, never a throw', () => {
  const cyclic = b.smallDoc();
  cyclic.self = cyclic;
  const big = b.smallDoc();
  big.extra = { n: 10n };
  for (const [label, doc] of [
    ['a cycle', cyclic],
    ['a BigInt', big],
  ]) {
    let res;
    assert.doesNotThrow(() => (res = validate(doc)), label);
    assert.equal(res.ok, false, label);
    assert.equal(res.problems.length, 1, `${label}: ${JSON.stringify(res.problems)}`);
    assert.match(res.problems[0], /^\(document\): /, label);
  }
});

test('AC-32 (regression, review 1): the stack-free count equals Buffer.byteLength(JSON.stringify(x)) wherever JSON.stringify can write x (fixtures, 60 random documents, 2,000 fuzz documents, edge values)', () => {
  const { jsonBytesWithoutRecursion: jsonBytes } = require('../src/services/venueMap/jsonBytes');
  const holes = [1, 2, 3];
  delete holes[1]; // a hole: JSON writes null
  const edge = {
    neg0: -0,
    nan: NaN,
    inf: -Infinity,
    big: 1e308,
    tiny: 5e-324,
    text: 'ñ \u{1F600} "quoted" \\ \n \u0001 ' + String.fromCharCode(0x2028),
    nested: { a: [undefined, () => 1, Symbol('s'), null, true, false] },
    skipped: undefined,
    fn: () => 1,
    holes,
    date: new Date(0),
    boxed: [Object(1), Object('s'), Object(false)],
  };
  Object.defineProperty(edge, '__proto__', { value: { p: 1 }, enumerable: true });
  const samples = [b.fullDoc(), b.smallDoc(), edge, [], {}, 'x', 7, null, true];
  for (let seed = 1; seed <= 60; seed += 1) samples.push(b.randomDoc(seed, { messy: true }));
  const rng = b.mulberry32(32);
  for (let i = 0; i < 2000; i += 1) samples.push(b.fuzzDoc(rng));
  for (const [i, sample] of samples.entries()) {
    assert.equal(
      jsonBytes(sample),
      Buffer.byteLength(JSON.stringify(sample), 'utf8'),
      `sample ${i}`,
    );
  }
  assert.equal(jsonBytes(undefined), null);
  assert.equal(
    jsonBytes(() => 1),
    null,
  );
});

test("AC-10 (review 1, C8): the id problem states the length the schema file's ID pattern allows, so the limit is written once", () => {
  const { loadVenueMapSchema, SCHEMA_FILE } = require('../src/config/venueMapSchema');
  const doc = b.smallDoc();
  doc.levels[0].items = [b.item('a b')];
  const live = validate(doc);
  assert.match(live.problems[0], /^levels\[0\]\.items\[0\]\.id: must be an id: 1 to 40 /);
  const raw = clone(require(SCHEMA_FILE));
  raw.patterns.ID.value = '^[A-Za-z0-9_-]{1,12}$';
  const short = validate(doc, { ...b.makeContext(), schema: loadVenueMapSchema(raw) });
  assert.match(short.problems[0], /^levels\[0\]\.items\[0\]\.id: must be an id: 1 to 12 /);
});
