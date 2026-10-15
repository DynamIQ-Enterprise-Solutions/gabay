'use strict';

// FF-3′ A1′a, the engine's one entry (spec/P0-03.md r4 AC-89, with AC-31 kept; plan/FF-3-prime-A1.md 1.0 step 7):
// analyseMap(snapshot) -> { findings, model } is pure (no database, clock, file or environment read: run here with
// each stubbed to throw), gives byte-identical results for one snapshot, never changes its input, and returns the
// graph's own findings (AC-96, AC-97, AC-98) in AC-107's shape and AC-115's order, with a model holding the graph,
// the entrances and the places (AC-99).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');
const { analyseMap, runAnalysis } = require('../src/services/engines/publishEngine.service');
const { PublishBuildError } = require('../src/services/engines/buildError');
const {
  makeContext,
  objectRow,
  objectRows,
  wall,
  opening,
  unit,
  item,
  connector,
  rect,
  randomDoc,
  deepFreeze,
} = require('./fixtures/mapBuilder');
const { snapshotOf, venueDoc, floor, storeRow } = require('./fixtures/snapshotBuilder');

const ENGINE_DIR = path.join(__dirname, '../src/services/engines');

/** A document with one of each graph finding: an ADD_PATH through a wall, no entrance, a landing in a store. */
function faultyDoc() {
  return venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [0, 10], b: [20, 10] })],
        openings: [opening('o1', 'w1', { at: 0.25, w: 1 })],
        units: [unit('u1', { walkable: false, doors: [], poly: rect(14, 14, 18, 18) })],
        corrections: [
          {
            id: 'p1',
            kind: 'ADD_PATH',
            line: [
              [10.2, 8.1],
              [10.2, 12.2],
            ],
          },
        ],
      }),
      floor('l2', { ordinal: 2, elevation: 4.5 }),
    ],
    connectors: [
      connector('lift', 'elevator', ['l1', 'l2'], {
        x: 16,
        z: 16,
        stops: [
          [16, 16],
          [16, 16],
        ],
      }),
    ],
  });
}

/** The graph's own findings among all of them (AC-96, AC-97, AC-98): A1′a's three kinds. */
const GRAPH_OWN = ['WALL_CROSSING', 'NO_ENTRANCE', 'CONNECTOR_OFF_WALKWAY'];
const graphOwn = (findings) => findings.filter((f) => GRAPH_OWN.includes(f.kind));

/** The result as bytes: JSON, with each typed array written as its own bytes in hex. */
function bytesOf(result) {
  const text = JSON.stringify(result, (_key, value) =>
    ArrayBuffer.isView(value)
      ? `${value.constructor.name}:${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')}`
      : value,
  );
  return Buffer.from(text, 'utf8');
}

function throwing(what) {
  return () => {
    throw new Error(`the engine read ${what}`);
  };
}

/** Every function of `target` replaced by one that throws, for the length of `run`. */
function withStubs(t, run) {
  const stub = (target, label) => {
    for (const name of Object.keys(target)) {
      if (typeof target[name] !== 'function') continue;
      try {
        t.mock.method(target, name, throwing(`${label}.${name}`));
      } catch {
        // A property that cannot be replaced cannot be called through a replaced reference either; the static
        // check below covers the module as a whole.
      }
    }
  };
  stub(fs, 'fs');
  stub(fs.promises, 'fs.promises');
  stub(pg, 'pg');
  t.mock.method(Date, 'now', throwing('the clock (Date.now)'));
  t.mock.method(performance, 'now', throwing('the clock (performance.now)'));
  const env = process.env;
  process.env = new Proxy(
    {},
    {
      get: throwing('process.env'),
      has: throwing('process.env'),
      ownKeys: throwing('process.env'),
    },
  );
  try {
    return run();
  } finally {
    process.env = env;
    t.mock.restoreAll();
  }
}

test('engine.analyse AC-89: one analysis with the file system, pg, the clock and the environment all stubbed to throw', (t) => {
  const snapshot = snapshotOf(faultyDoc(), { stores: [storeRow(1, 'u1')] });
  const result = withStubs(t, () => analyseMap(snapshot));
  assert.ok(result.model.graph.nodeCount > 0);
  assert.equal(graphOwn(result.findings).length, 3, 'with every other check run too (AC-115)');
  // The stubs bite: each read the engine must not make throws while they are in place.
  for (const read of [
    () => fs.readFileSync(__filename),
    () => Date.now(),
    () => performance.now(),
    () => process.env.PATH,
    () => new pg.Pool().query('SELECT 1'),
  ]) {
    assert.throws(() => withStubs(t, read), /the engine read/);
  }
});

test('engine.analyse AC-89: no engine source file requires a database, file, network or process module, or reads the clock or environment', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(ENGINE_DIR);
  assert.ok(files.length > 10);
  const forbidden =
    /require\(['"](node:)?(fs|pg|net|http|https|child_process|worker_threads|os)['"]\)|require\(['"][./]+db['"/]|process\.env|Date\.now|new Date\(|performance\.now|Math\.random/;
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), forbidden, path.relative(ENGINE_DIR, file));
  }
});

test('engine.analyse AC-89, AC-31: two runs of one snapshot are byte for byte the same', () => {
  const snapshot = snapshotOf(randomDoc(5), { stores: [] });
  const one = bytesOf(analyseMap(snapshot));
  const two = bytesOf(analyseMap(snapshot));
  assert.equal(Buffer.compare(one, two), 0);
  const faulty = snapshotOf(faultyDoc());
  assert.equal(Buffer.compare(bytesOf(analyseMap(faulty)), bytesOf(analyseMap(faulty))), 0);
});

test('engine.analyse AC-89: the snapshot is never changed', () => {
  const snapshot = deepFreeze(snapshotOf(faultyDoc(), { stores: [storeRow(1, 'u1')] }));
  const before = JSON.stringify(snapshot);
  analyseMap(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
});

test("engine.analyse AC-107, AC-115: the graph's own findings, in the finding's shape and a fixed order", () => {
  const all = analyseMap(snapshotOf(faultyDoc())).findings;
  const findings = graphOwn(all);
  assert.deepEqual(
    findings.map((f) => f.kind),
    ['WALL_CROSSING', 'NO_ENTRANCE', 'CONNECTOR_OFF_WALKWAY'],
  );
  for (const f of all) {
    assert.deepEqual(Object.keys(f), [
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
    assert.equal(f.severity, 'warning', 'none of them blocks (L170 Q2)');
    assert.equal(typeof f.message, 'string');
    assert.ok(f.message.length > 0);
    assert.equal(f.path, null);
  }
  const [crossing, noEntrance, offWalkway] = findings;
  assert.equal(crossing.levelId, 'l1');
  assert.equal(crossing.levelName, 'Level l1');
  assert.deepEqual(crossing.element, { kind: 'correction', id: 'p1', name: null });
  assert.ok(Math.abs(crossing.at.x - 10.2) < 1e-9 && Math.abs(crossing.at.z - 10) < 1e-9);
  assert.deepEqual(crossing.segment, [
    { x: 10.2, z: 8.1 },
    { x: 10.2, z: 12.2 },
  ]);
  assert.equal(noEntrance.levelId, 'l1', 'the lowest level holds the fallback point');
  assert.deepEqual(noEntrance.at, { x: 10, z: 20 });
  assert.equal(noEntrance.element, null);
  assert.deepEqual(offWalkway.element, { kind: 'connector', id: 'lift', name: 'elevator lift' });
  assert.deepEqual(offWalkway.params, { stop: 0 });
  assert.deepEqual(offWalkway.at, { x: 16, z: 16 });
});

test('engine.analyse AC-99: the model holds the graph, the levels, the entrances and every place with its door nodes', () => {
  const doc = venueDoc({
    levels: [
      floor('l1', {
        walls: [wall('w1', { a: [2, 6], b: [8, 6] })],
        openings: [opening('o1', 'w1', { at: 0.5, w: 1, entrance: true })],
        units: [unit('u1', { walkable: false, doors: ['o1'], poly: rect(2, 2, 8, 6) })],
      }),
    ],
  });
  const stores = [storeRow(7, 'u1', { name: 'Niño Café' }), storeRow(3, 'u1'), storeRow(9, 'gone')];
  const { model, findings } = analyseMap(snapshotOf(doc, { stores }));
  const { graph, read } = runAnalysis(snapshotOf(doc, { stores }));
  const door = graph.doorNode.get('o1');
  assert.deepEqual(model.levels, ['l1']);
  assert.deepEqual(model.entrances, [door]);
  assert.deepEqual(
    model.places,
    [{ id: 'u1', kind: 'store', levelId: 'l1', name: 'Store u1', doorNodes: [door] }],
    'one place per unit: the lowest OccupantId (DC-27); a store keyed to no unit is left out',
  );
  assert.equal(read.stores.length, 3);
  assert.deepEqual(
    Object.keys(model.graph),
    ['nodeCount', 'x', 'z', 'levelIndex', 'offsets', 'targets', 'lengthM', 'clearanceM'],
    "the engine's own labels stay out of the model",
  );
  assert.equal(model.graph.offsets.length, model.graph.nodeCount + 1);
  assert.ok(model.graph.clearanceM instanceof Float32Array);
  assert.deepEqual(
    findings.map((f) => f.kind),
    ['NO_BEACONS_ON_LEVEL', 'DOOR_WIDTH_UNMEASURED', 'STORE_WITHOUT_UNIT', 'STORE_DUPLICATE_UNIT'],
    'an entrance and a graph with nothing wrong: only the row and data warnings (AC-22, AC-23, AC-114)',
  );
});

// Regression, A1′a review I2 (the owner's ruling of 2026-10-15, option (b)): a blocking item with no size threw a
// bare TypeError, a 500 with nothing to name. It is now a named build failure naming the item and its type, never a
// warning and never a silent pass. Changed in A1′b (C1): the engine now runs OA-1's validator first (AC-108), which
// refuses an item whose type has no default size, so the fixture's type has a default size of 0, which the validator
// accepts and the engine cannot block with (until OA-3a's migration requires a size, I2's ruling).
test('engine.analyse EC-101 (review I2): a blocking item with no size is a build failure naming the item and its type', () => {
  const context = makeContext({
    objectTypes: [...objectRows(), objectRow('ZERO_BOX', { defaultW: 0, defaultD: 0 })],
  });
  const snapshot = snapshotOf(
    venueDoc({
      levels: [floor('l1', { items: [item('i1', { type: 'ZERO_BOX', x: 10, z: 10 })] })],
    }),
    { context },
  );
  assert.throws(
    () => analyseMap(snapshot),
    (error) =>
      error instanceof PublishBuildError &&
      /item i1 of type ZERO_BOX blocks walking but has no size/.test(error.message),
  );
});

test('engine.analyse DC-A5: the 16-to-8 switch is an option of the call, for tests and the measurement only', () => {
  // One wall, so the map is not blank (AC-108's NOTHING_TO_PUBLISH would leave no model).
  const snapshot = snapshotOf(
    venueDoc({ levels: [floor('l1', { walls: [wall('w1', { a: [19, 1], b: [19, 3] })] })] }),
  );
  const sixteen = analyseMap(snapshot).model.graph;
  const eight = analyseMap(snapshot, { neighbourMoves: 8 }).model.graph;
  assert.equal(sixteen.nodeCount, eight.nodeCount);
  assert.ok(eight.targets.length < sixteen.targets.length);
  assert.throws(() => analyseMap(snapshot, { neighbourMoves: 4 }), /8 or 16/);
});
