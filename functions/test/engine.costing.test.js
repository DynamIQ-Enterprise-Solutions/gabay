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
