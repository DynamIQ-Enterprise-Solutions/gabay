'use strict';

// FF-3 A1, walls.js (ruled D4; spec/P0-03.md r2 §3 "Wall", AC-12, AC-71): a level's walls are every edge of a
// non-walkable unit's outline except where one of THAT unit's openings sits on it, plus the outlines of floor
// objects with BlocksWalk. The validator, the generator and the package model use the one list (AC-71).

const test = require('node:test');
const assert = require('node:assert/strict');
const { runStages, runPublishEngine } = require('../src/services/engines/publishEngine.service');
const { corridorWithStore, draftBuilder } = require('./fixtures/draftBuilder');

const round = (s) => [s.x1, s.y1, s.x2, s.y2].map((v) => Math.round(v * 1000) / 1000);

test("engine.walls D4: a store's outline is a wall except at its own door's gap", () => {
  const { b, L0, store } = corridorWithStore();
  const { graph } = runStages(b.build());
  const walls = graph.walls.get(L0);
  const fromStore = walls.filter((w) => w.unitId === store.unitId).map(round);
  // The front edge (5,4)-(10,4) is cut by the door from x = 7 to x = 8.5; the other three edges are whole.
  assert.deepEqual(
    fromStore.sort((p, q) => p[0] - q[0] || p[1] - q[1]),
    [
      [5, 4, 7, 4],
      [5, 10, 5, 4],
      [8.5, 4, 10, 4],
      [10, 4, 10, 10],
      [10, 10, 5, 10],
    ].sort((p, q) => p[0] - q[0] || p[1] - q[1]),
  );
  assert.equal(
    walls.filter((w) => w.unitId !== store.unitId && w.floorObjectId === null).length,
    0,
    'a walkable unit has no walls',
  );
});

test("engine.walls D4: another unit's opening does not cut this unit's wall", () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 4]);
  const a = b.unit(L0, [0, 4, 5, 10], { name: 'A' });
  const c = b.unit(L0, [5, 4, 10, 10], { name: 'B' });
  b.opening(L0, a, [
    [5, 6],
    [5, 7],
  ]); // on the shared edge x = 5, but it belongs to A only
  const { graph } = runStages(b.build());
  const walls = graph.walls.get(L0);
  const onShared = (unitId) =>
    walls.filter((w) => w.unitId === unitId && w.x1 === 5 && w.x2 === 5).map(round);
  assert.deepEqual(onShared(a), [
    [5, 4, 5, 6],
    [5, 7, 5, 10],
  ]);
  assert.deepEqual(onShared(c), [[5, 10, 5, 4]], "B's wall stays whole");
});

test('engine.walls D4: a blocking floor object is walled all round; a non-blocking one is not a wall', () => {
  const b = draftBuilder();
  const L0 = b.level();
  b.walkway(L0, [0, 0, 20, 10]);
  const pillar = b.floorObject(L0, { center: [5, 5], width: 2, depth: 2 });
  const bench = b.floorObject(L0, { center: [15, 5], width: 2, depth: 1, blocks: false });
  const { graph } = runStages(b.build());
  const walls = graph.walls.get(L0);
  assert.equal(walls.filter((w) => w.floorObjectId === pillar).length, 4);
  assert.equal(walls.filter((w) => w.floorObjectId === bench).length, 0);
});

test('engine.walls AC-71: the package model carries exactly the wall segments the validator used, none left out', () => {
  const { b, L0 } = corridorWithStore();
  b.floorObject(L0, { center: [15, 2], width: 1, depth: 1 });
  const draft = b.build();
  const { graph } = runStages(draft);
  const { problems, model } = runPublishEngine(draft);
  assert.deepEqual(problems, []);
  const used = [...graph.walls.entries()].flatMap(([levelId, list]) =>
    list.map((w) => ({ levelId, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 })),
  );
  assert.ok(used.length >= 9);
  assert.deepEqual(model.walls, used);
});
