'use strict';

// FF-3′ A1′b, the seconds formulas (spec/P0-03.md r4 AC-100 to AC-106, section 3.14.7's V-C-1 to V-C-12; L170 Q4;
// L176; plan/FF-3-prime-A1.md 1.0 steps 8 to 10). Every vector is read from functions/test/fixtures/
// publish-cost-vectors.json (AC-106, DC-A8) and run through the engine's one copy of each formula (edgeCosts.js), then
// stored as the package stores it (to 0.001 s, OA-1's rounding, DC-21). The graph-level cases (V-C-4's six lift
// edges, V-C-9's directions, the tuned and inactive types, the build failures) run through analyseMap below them.
// Rewritten from A1's engine.costing (metres, CostBaseM, RiseM): every case is now in seconds and on documents.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  walkCostS,
  storeCrossingCostS,
  connectorCostS,
  riseBetween,
  createStoredRounding,
  assertEdgeCost,
} = require('../src/services/engines/edgeCosts');
const { PREFERRED_CONNECTOR_FACTOR } = require('../src/services/engines/constants');
const { PublishBuildError } = require('../src/services/engines/buildError');
const VECTORS = require('./fixtures/publish-cost-vectors.json');

const { rates, connectorPairs, vectors } = VECTORS;
const routing = {
  walkSpeedMps: rates.walkSpeedMps,
  storeCrossingFactor: rates.storeCrossingFactor,
};
const stored = createStoredRounding();

test('engine.costing V-C-1 (AC-100): a walk edge costs its length / routing.walkSpeedMps, stored to 0.001 s', () => {
  for (const { lengthM, expectedS } of vectors['V-C-1'].cases) {
    assert.equal(stored(walkCostS(lengthM, routing)), expectedS, `${lengthM} m`);
  }
});

for (const id of ['V-C-2', 'V-C-3', 'V-C-4', 'V-C-5']) {
  test(`engine.costing ${id} (AC-101): ${vectors[id].title}`, () => {
    const pair = connectorPairs[vectors[id].costModel];
    for (const { riseM, expectedS } of vectors[id].cases) {
      assert.equal(stored(connectorCostS(pair, riseM, false)), expectedS, `rise ${riseM}`);
    }
  });
}

test('engine.costing V-C-6 (AC-102): a preferred connector costs 0.7 x the whole cost, once', () => {
  assert.equal(PREFERRED_CONNECTOR_FACTOR, 0.7, 'the named constant (DC-22)');
  for (const { costModel, riseM, expectedS } of vectors['V-C-6'].cases) {
    assert.equal(
      stored(connectorCostS(connectorPairs[costModel], riseM, true)),
      expectedS,
      costModel,
    );
  }
});

test('engine.costing V-C-7 (AC-104): a store crossing costs length x routing.storeCrossingFactor / speed', () => {
  for (const { lengthM, storeCrossingFactor, expectedS } of vectors['V-C-7'].cases) {
    const cost = storeCrossingCostS(lengthM, { ...routing, storeCrossingFactor });
    assert.equal(stored(cost), expectedS, `${lengthM} m at ${storeCrossingFactor}`);
  }
});

test('engine.costing V-C-8 (AC-101, AC-105): a tuned pair is used as given, and a cost of 0 is allowed', () => {
  for (const { pair, riseM, preferred, expectedS } of vectors['V-C-8'].cases) {
    const cost = stored(connectorCostS(pair, riseM, preferred));
    assert.equal(cost, expectedS, JSON.stringify(pair));
    assertEdgeCost(cost, 'a tuned connector');
  }
});

test('engine.costing V-C-10: the cross-check numbers of P0-06 V-RG2-1 (the true cost and the estimate trap)', () => {
  const v = vectors['V-C-10'];
  const escalator = stored(
    connectorCostS(connectorPairs[v.escalator.costModel], v.escalator.riseM, false),
  );
  assert.equal(escalator, v.escalator.expectedS);
  const walks = v.walkways.map(({ lengthM }) => stored(walkCostS(lengthM, routing)));
  assert.deepEqual(
    walks,
    v.walkways.map((w) => w.expectedS),
  );
  for (const way of v.ways) {
    const total = way.walkways.reduce((sum, i) => sum + walks[i], escalator * way.escalators);
    assert.equal(stored(total), way.expectedS, way.name);
  }
});

test('engine.costing V-C-11 (EC-99): a basement level at -4.5 and one at 0 give a rise of 4.5, not -4.5', () => {
  const v = vectors['V-C-11'];
  const rise = riseBetween(...v.elevations);
  assert.equal(rise, v.expectedRiseM);
  assert.equal(riseBetween(v.elevations[1], v.elevations[0]), rise, 'down is the same rise');
  assert.equal(stored(connectorCostS(connectorPairs[v.costModel], rise, false)), v.expectedS);
});

test('engine.costing V-C-12 (AC-120): 0.5 m and 144 m at 1.2 m/s are 0.417 s and 120 s, the two seeded defaults', () => {
  for (const { lengthM, expectedS, setting } of vectors['V-C-12'].cases) {
    assert.equal(stored(walkCostS(lengthM, routing)), expectedS, setting);
  }
});

test('engine.costing AC-105 (DC-21): costs are stored half away from zero on the decimal text, to 0.001', () => {
  assert.equal(stored(0.0005), 0.001);
  assert.equal(stored(1.2345), 1.235, 'not 1.234: the text, not the binary value, is rounded');
  assert.equal(stored(4.514999999999999), 4.515);
  assert.equal(stored(2 / 3), 0.667);
  assert.ok(Object.is(stored(-0), 0), 'never -0');
  const again = createStoredRounding();
  assert.equal(again(1.2345), stored(1.2345), 'each rounding gives the same answer');
});

test('engine.costing AC-105, EC-92: a cost that is not finite or is below 0 is a build failure, not a warning', () => {
  for (const bad of [Number.NaN, Infinity, -Infinity, -0.001]) {
    assert.throws(() => assertEdgeCost(bad, 'an edge'), PublishBuildError, String(bad));
  }
  assertEdgeCost(0, 'a free edge');
  assertEdgeCost(12.5, 'an edge');
});

// AC-106's review search, kept as a test for the engine's own folder: the formula numbers live in the vector file
// (tests), the lookups seed (OA-3), settings.js (OA-3a) and constants.js (0.7) only. Comments are left out, so a
// source citation such as "x 0.7" in a comment does not count.
const ENGINE_DIR = path.join(__dirname, '../src/services/engines');
const FORMULA_NUMBERS = /(?<![\w.])(0\.7|1\.2|1\.25|0\.4|1\.1|0\.8)(?![\w.])/;

function codeOf(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
}

test('engine.costing AC-106: no engine source file holds a formula number, except the one named 0.7', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(ENGINE_DIR);
  const holders = files.filter((f) => FORMULA_NUMBERS.test(codeOf(f)));
  assert.deepEqual(
    holders.map((f) => path.relative(ENGINE_DIR, f)),
    ['constants.js'],
    'only constants.js holds a formula number (PREFERRED_CONNECTOR_FACTOR)',
  );
  assert.match(codeOf(path.join(ENGINE_DIR, 'constants.js')), /PREFERRED_CONNECTOR_FACTOR = 0\.7;/);
});

// ------------------------------------------------------------------------------------------------- on the graph

const { runAnalysis } = require('../src/services/engines/publishEngine.service');
const { ORIGIN } = require('../src/services/engines/graphKinds');
const { EDGE_FLAG } = require('../src/services/engines/constants');
const { connector: connectorOf, wall } = require('./fixtures/mapBuilder');
const { snapshotOf, venueDoc, floor } = require('./fixtures/snapshotBuilder');
const { originOf, edgesOf } = require('./fixtures/graphAsserts');

/** Blank 20 x 20 m levels of building b1 at the given elevations, ordinals 1, 2, ...; connectors as given. */
function floorsAt(elevations, connectors, opts) {
  const levels = elevations.map((elevation, i) => floor(`l${i}`, { ordinal: i + 1, elevation }));
  return runAnalysis(snapshotOf(venueDoc({ levels, connectors }), opts));
}

/** A connector of `kind` with its landings at (10, 10) on each level named. */
const ride = (id, kind, levels, over = {}) =>
  connectorOf(id, kind, levels, {
    x: 10,
    z: 10,
    stops: levels.map(() => [10, 10]),
    ...over,
  });

/** Every connector edge of the analysis as { from: stop, to: stop, costS, k } by the landings' stops. */
function rideEdges(result, connectorId) {
  const { csr } = result.graph;
  const stopOf = new Map(
    result.graph.landings.filter((l) => l.connectorId === connectorId).map((l) => [l.node, l.stop]),
  );
  return edgesOf(csr)
    .filter(({ from, k }) => stopOf.has(from) && originOf(csr, k) === ORIGIN.CONNECTOR)
    .map(({ from, to, k }) => ({
      from: stopOf.get(from),
      to: stopOf.get(to),
      costS: result.costs.costS[k],
      k,
    }))
    .sort((p, q) => p.from - q.from || p.to - q.to);
}

test('engine.costing V-C-4, AC-103 (D7): a lift on three levels has six edges, each costed by its own rise', () => {
  const v = vectors['V-C-4'].lift;
  const result = floorsAt(v.stopElevations, [ride('lift', 'elevator', ['l0', 'l1', 'l2'])]);
  assert.deepEqual(
    rideEdges(result, 'lift').map(({ from, to, costS }) => ({ from, to, expectedS: costS })),
    v.edges,
  );
});

test('engine.costing EC-76: a lift serving ten levels gives 90 edges', () => {
  const elevations = Array.from({ length: 10 }, (_, i) => i * 4.5);
  const ids = elevations.map((_, i) => `l${i}`);
  const result = floorsAt(elevations, [ride('lift', 'elevator', ids)]);
  assert.equal(rideEdges(result, 'lift').length, 90);
});

for (const c of vectors['V-C-9'].cases) {
  test(`engine.costing V-C-9 (AC-103, N6): ${c.name}`, () => {
    const result = floorsAt(c.elevations, [
      ride('c1', c.kind, ['l0', 'l1'], c.twoWay ? { twoWay: true } : {}),
    ]);
    assert.deepEqual(
      rideEdges(result, 'c1').map(({ from, to, costS }) => ({ from, to, expectedS: costS })),
      c.edges,
    );
  });
}

test('engine.costing V-C-11 (EC-99): stairs from a basement at -4.5 to 0 cost 6.450 both ways', () => {
  const v = vectors['V-C-11'];
  const result = floorsAt(v.elevations, [ride('st', 'stairs', ['l0', 'l1'])]);
  assert.deepEqual(
    rideEdges(result, 'st').map((e) => e.costS),
    [v.expectedS, v.expectedS],
  );
});

test("engine.costing V-C-6, V-C-8 (AC-101, AC-102): a tenant's tuned pair, a zero pair, and the preferred factor", () => {
  const tuned = floorsAt([0, 4.5], [ride('st', 'stairs', ['l0', 'l1'])], {
    lookups: { ConnectorType: { STAIRS_STD: { costBaseS: '2.000', costPerRiseS: '0.500' } } },
  });
  assert.deepEqual(
    rideEdges(tuned, 'st').map((e) => e.costS),
    [4.25, 4.25],
    'DECIMAL text from the row, parsed once (EC-34)',
  );
  const zero = floorsAt([0, 4.5], [ride('st', 'stairs', ['l0', 'l1'], { preferred: true })], {
    lookups: { ConnectorType: { STAIRS_STD: { costBaseS: 0, costPerRiseS: 0 } } },
  });
  assert.deepEqual(
    rideEdges(zero, 'st').map((e) => e.costS),
    [0, 0],
    'a cost of 0 is kept',
  );
  const preferred = floorsAt([0, 4.5], [ride('st', 'stairs', ['l0', 'l1'], { preferred: true })]);
  assert.deepEqual(
    rideEdges(preferred, 'st').map((e) => e.costS),
    [4.515, 4.515],
  );
});

test('engine.costing AC-36 (EC-104): a deactivated connector type the map still names is costed with its values', () => {
  const result = floorsAt([0, 4.5], [ride('st', 'stairs', ['l0', 'l1'])], {
    lookups: { ConnectorType: { STAIRS_STD: { active: false } } },
  });
  assert.deepEqual(
    rideEdges(result, 'st').map((e) => e.costS),
    [6.45, 6.45],
  );
});

test('engine.costing AC-103, DC-38, EC-108: an evacuation-only connector is costed like any other, preferred too, and flagged', () => {
  const result = floorsAt(
    [0, 4.5],
    [
      ride('ev', 'stairs', ['l0', 'l1'], { evacuationOnly: true, preferred: true }),
      ride('st', 'stairs', ['l0', 'l1'], {
        x: 15,
        z: 15,
        stops: [
          [15, 15],
          [15, 15],
        ],
      }),
    ],
  );
  const { csr } = result.graph;
  const evac = rideEdges(result, 'ev');
  assert.deepEqual(
    evac.map((e) => e.costS),
    [4.515, 4.515],
  );
  for (const e of evac) assert.equal(csr.edgeFlags[e.k], EDGE_FLAG.EVACUATION);
  for (const e of rideEdges(result, 'st')) assert.equal(csr.edgeFlags[e.k], 0);
  for (const e of evac) assert.equal(csr.edgeRef[e.k], 0, "the connector's place in the document");
});

test('engine.costing AC-105 (DC-23): a lift edge of length 0 is kept; its real length is never derived from its cost', () => {
  const result = floorsAt(
    [0, 4.5],
    [
      ride('lift', 'elevator', ['l0', 'l1']),
      ride('esc', 'escalator', ['l0', 'l1'], {
        x: 9,
        z: 15,
        stops: [
          [5, 15],
          [13, 15],
        ],
      }),
    ],
  );
  const [lift] = rideEdges(result, 'lift');
  assert.equal(result.costs.lengthM[lift.k], 0);
  assert.equal(lift.costS, 5.8);
  const [esc] = rideEdges(result, 'esc');
  assert.equal(result.costs.lengthM[esc.k], 8, 'the planar run between its stops');
  assert.equal(esc.costS, 4.6);
  assert.ok(Number.isNaN(result.graph.csr.clearanceM[lift.k]), 'a ride has no clearance (DC-B5)');
});

test('engine.costing AC-100, AC-105: every walk edge costs its stored length at the walking speed', () => {
  const doc = venueDoc({
    levels: [floor('l0', { walls: [wall('w1', { a: [19, 1], b: [19, 3] })] })],
  });
  const result = runAnalysis(snapshotOf(doc, { routing: { walkSpeedMps: 1.5 } }));
  const { csr } = result.graph;
  for (const { k } of edgesOf(csr)) {
    assert.equal(result.costs.lengthM[k], stored(csr.lengthM[k]));
    assert.equal(result.costs.costS[k], stored(csr.lengthM[k] / 1.5));
  }
  const diagonal = edgesOf(csr).find(({ k }) => Math.abs(csr.lengthM[k] - Math.SQRT2 * 1.5) < 1e-9);
  assert.equal(result.costs.lengthM[diagonal.k], 2.121);
  assert.equal(result.costs.costS[diagonal.k], 1.414);
});

test('engine.costing DC-B1: stairs serving three levels join each stop to the next one up, by elevation', () => {
  const result = floorsAt([9, 0, 4.5], [ride('st', 'stairs', ['l0', 'l1', 'l2'])]);
  assert.deepEqual(
    rideEdges(result, 'st').map(({ from, to, costS }) => [from, to, costS]),
    [
      [0, 2, 6.45],
      [1, 2, 6.45],
      [2, 0, 6.45],
      [2, 1, 6.45],
    ],
    'l1 at 0 to l2 at 4.5 to l0 at 9: no edge skips a floor',
  );
});

test('engine.costing AC-105, DC-A4, EC-92: an absent, negative, NaN or infinite cost pair stops the build, no default', () => {
  const doc = venueDoc({
    levels: [floor('l0'), floor('l1', { ordinal: 2, elevation: 4.5 })],
    connectors: [ride('st', 'stairs', ['l0', 'l1'])],
  });
  const withEntry = (change) => {
    const snapshot = snapshotOf(doc);
    const types = new Map(snapshot.context.lookups.ConnectorType);
    const entry = { ...types.get('STAIRS_STD') };
    change(entry);
    types.set('STAIRS_STD', entry);
    snapshot.context = {
      ...snapshot.context,
      lookups: { ...snapshot.context.lookups, ConnectorType: types },
    };
    return snapshot;
  };
  const cases = [
    [(e) => delete e.costBaseS, /ConnectorType\[STAIRS_STD\]\.costBaseS is missing/],
    [(e) => delete e.costPerRiseS, /costPerRiseS is missing/],
    [(e) => (e.costBaseS = -1), /costBaseS must be at least 0/],
    [(e) => (e.costPerRiseS = Number.NaN), /costPerRiseS must be a finite number/],
    [(e) => (e.costBaseS = Infinity), /costBaseS must be a finite number/],
    [(e) => (e.costBaseS = '-0.500'), /costBaseS must be at least 0/],
  ];
  for (const [change, message] of cases) {
    assert.throws(() => runAnalysis(withEntry(change)), message, String(change));
  }
  assert.doesNotThrow(() => runAnalysis(withEntry(() => {})));
});
