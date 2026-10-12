'use strict';

// FF-3 A1, connector costing (spec/P0-03.md r2 §3.5, AC-33 to AC-36; ruled D7; Blueprint invariant 15): a floor
// change costs CostBaseM + CostPerRiseM x rise from the connector's own type row (the tenant's tuned row where the
// connector names one, else the platform's), a lift's rise between two stops is the difference of their levels'
// ElevationM, a one-way connector runs From -> To only, and evacuation-only connectors stay in the graph, flagged.

const test = require('node:test');
const assert = require('node:assert/strict');
const { runStages, runPublishEngine } = require('../src/services/engines/publishEngine.service');
const { draftBuilder, TENANT_ID } = require('./fixtures/draftBuilder');

/** Two levels 4.5 m apart, each a corridor, an entrance below. */
function twoFloors() {
  const b = draftBuilder();
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5 });
  b.walkway(L0, [0, 0, 30, 4]);
  b.walkway(L1, [0, 0, 30, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  return { b, L0, L1 };
}

const connectorEdges = (graph, connectorId) =>
  graph.edges.filter((e) => e.kind === 'CONNECTOR' && e.connectorId === connectorId);
const levelsOf = (graph, e) => [graph.nodes[e.from].levelId, graph.nodes[e.to].levelId];

test('engine.costing AC-33: an escalator with a 4.5 m rise costs 14 + 1 x 4.5 = 18.5 m (the seeded defaults)', () => {
  const { b, L0, L1 } = twoFloors();
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2], { riseM: 4.5 });
  const { graph, issues } = runStages(b.build());
  assert.deepEqual(issues.problems, []);
  const edges = connectorEdges(graph, esc);
  assert.equal(edges.length, 2, 'two-way');
  for (const e of edges) {
    assert.equal(e.cost, 18.5);
    assert.equal(e.length, 4, 'its real length is the planar run between its ends');
    assert.equal(e.clearance, null);
    assert.equal(e.evacuationOnly, false);
  }
});

test("engine.costing AC-33: a tenant's own tuned type row is used, not the platform default", () => {
  const { b, L0, L1 } = twoFloors();
  b.lookups.connectorTypes.push({
    connectortypeid: 90,
    tenantid: TENANT_ID,
    code: 'ESCALATOR',
    label: 'Escalator (tuned)',
    costmodel: 'ESCALATOR',
    isstepfree: false,
    costbasem: '10.000',
    costperrisem: '2.000',
    sortorder: 0,
    isactive: true,
  });
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2], { riseM: 4.5, typeId: 90 });
  const { graph } = runStages(b.build());
  for (const e of connectorEdges(graph, esc)) assert.equal(e.cost, 19, '10 + 2 x 4.5');
});

test("engine.costing AC-33 (D7, EC-22): a lift joins every pair of stops, its rise from the levels' ElevationM, with no RiseM", () => {
  const b = draftBuilder();
  const L0 = b.level({ ordinal: 0, elevationM: 0 });
  const L1 = b.level({ ordinal: 1, elevationM: 4.5 });
  const L2 = b.level({ ordinal: 2, elevationM: 10 });
  for (const L of [L0, L1, L2]) b.walkway(L, [0, 0, 20, 4]);
  b.entrance(L0, [0, 1], [0, 3]);
  const lift = b.lift(
    [
      [L0, 18, 2],
      [L1, 18, 2],
      [L2, 18, 2],
    ],
    { riseM: null },
  );
  const { graph, issues } = runStages(b.build());
  assert.deepEqual(issues.problems, [], 'a lift needs no RiseM');
  const edges = connectorEdges(graph, lift.connectorId);
  assert.equal(edges.length, 6, 'three pairs, both ways');
  const cost = (from, to) =>
    edges.find((e) => levelsOf(graph, e)[0] === from && levelsOf(graph, e)[1] === to).cost;
  assert.equal(cost(L0, L1), 30 + 1.5 * 4.5);
  assert.equal(cost(L1, L2), 30 + 1.5 * 5.5);
  assert.equal(cost(L2, L0), 30 + 1.5 * 10);
  assert.equal(cost(L0, L2), cost(L2, L0));
});

test('engine.costing AC-34: a one-way connector gets From -> To only; a two-way one both', () => {
  const { b, L0, L1 } = twoFloors();
  const up = b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2], { bidirectional: false });
  const both = b.connector('STAIRS', [L1, 20, 2], [L0, 24, 2], { bidirectional: true });
  const { graph } = runStages(b.build());
  assert.deepEqual(
    connectorEdges(graph, up).map((e) => levelsOf(graph, e)),
    [[L0, L1]],
  );
  assert.deepEqual(
    connectorEdges(graph, both)
      .map((e) => levelsOf(graph, e))
      .sort(),
    [
      [L0, L1],
      [L1, L0],
    ].sort(),
  );
});

test('engine.costing AC-35: evacuation-only connectors are in the graph and flagged', () => {
  const { b, L0, L1 } = twoFloors();
  b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2]);
  const evac = b.connector('STAIRS', [L0, 26, 2], [L1, 26, 2], { evacuationOnly: true });
  const { graph, issues } = runStages(b.build());
  assert.deepEqual(issues.problems, []);
  const edges = connectorEdges(graph, evac);
  assert.equal(edges.length, 2);
  for (const e of edges) {
    assert.equal(e.evacuationOnly, true);
    assert.equal(e.cost, 34 + 3 * 4.5);
  }
});

test('engine.costing AC-36 (EC-31): a deactivated type row the venue still references is used with its values', () => {
  const { b, L0, L1 } = twoFloors();
  const esc = b.connector('ESCALATOR', [L0, 10, 2], [L1, 14, 2], { riseM: 4.5 });
  const draft = b.build();
  for (const type of draft.lookups.connectorTypes) type.isactive = false;
  for (const status of draft.lookups.storeStatuses) status.isactive = false;
  const { graph } = runStages(draft);
  for (const e of connectorEdges(graph, esc)) assert.equal(e.cost, 18.5);
  const { problems, model } = runPublishEngine(draft);
  assert.deepEqual(problems, []);
  const row = model.connectors.find((c) => c.id === esc);
  assert.equal(row.typeLabel, 'Escalator');
  assert.equal(row.costModel, 'ESCALATOR');
});

// Added by test-verifier (FF-3 A1 verification): AC-36 names four lookups; the test above deactivates two of them.
test('engine.costing AC-36 (EC-31): a deactivated amenity type and occupant category the venue still references are carried with their values', () => {
  const { b, L0, L1 } = twoFloors();
  b.connector('ESCALATOR', [L0, 20, 2], [L1, 24, 2], { riseM: 4.5 }); // joins the upper corridor to the entrance
  const shop = b.store(L0, [5, 4, 10, 9], {
    name: 'Cafe',
    doors: [
      [
        [6, 4],
        [7, 4],
      ],
    ],
    category: 22,
  });
  const cr = b.amenity(L0, 15, 2, { typeId: 11 });
  const draft = b.build();
  for (const type of draft.lookups.amenityTypes) type.isactive = false;
  for (const category of draft.lookups.occupantCategories) category.isactive = false;
  const { problems, model } = runPublishEngine(draft);
  assert.deepEqual(problems, []);
  const occupant = model.occupants.find((o) => o.id === shop.occupantId);
  assert.equal(occupant.categoryLabel, 'Food and drink');
  const amenity = model.amenities.find((a) => a.id === cr);
  assert.equal(amenity.typeLabel, 'Restroom');
  assert.equal(amenity.synonyms, 'comfort room, cr, restroom');
});
