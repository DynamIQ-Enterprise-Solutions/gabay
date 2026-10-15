'use strict';

// FF-3′ A1′b, walk-through stores and passages (spec/P0-03.md r4 AC-104, with AC-38 and AC-39 kept; L92; ruled D10;
// section 3.14.7's V-C-7; plan/FF-3-prime-A1.md 1.0 steps 10 and 12). Rewritten from A1's engine.passages on venue map
// documents: a `passThrough` store's doors each join a point just inside, those points join across its floor at
// length x routing.storeCrossingFactor / routing.walkSpeedMps seconds, never through a notch; a store without the mark
// gets no crossing; and a place that needs a walk-through store gets every such store as its passage.

const test = require('node:test');
const assert = require('node:assert/strict');
const planar = require('../src/services/engines/geometry/planar');
const { runAnalysis } = require('../src/services/engines/publishEngine.service');
const { ORIGIN, NODE } = require('../src/services/engines/graphKinds');
const { wall, opening, unit, connector, rect } = require('./fixtures/mapBuilder');
const { snapshotOf, venueDoc, floor, storeRow } = require('./fixtures/snapshotBuilder');
const { originOf, kindOf, edgesOf } = require('./fixtures/graphAsserts');

/**
 * Corridor A (z 0 to 4, the entrance at its west end) and corridor B (z 11 to 15), with a band of units between them
 * (z 4 to 11). `first` and `second` say what fills x 5 to 10 (s1) and x 12 to 17 (s2): a walk-through store, a
 * store, or a solid block; the rest of the band is solid. `linkAtEnd` leaves x 18 to 20 open, joining the corridors.
 * Below corridor B, a café (x 6 to 9, z 15 to 19) with one door onto it.
 */
function twoCorridors({
  first = 'walk-through',
  second = 'block',
  linkAtEnd = false,
  extra = {},
} = {}) {
  const walls = [wall('edge', { a: [0, 0], b: [0, 4] })];
  const openings = [opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true })];
  const units = [
    unit('west', { poly: rect(0, 4, 5, 11) }),
    unit('middle', { poly: rect(10, 4, 12, 11) }),
    unit('east', { poly: rect(17, 4, linkAtEnd ? 18 : 20, 11) }),
  ];
  const fill = (kind, id, x0, x1) => {
    if (kind === 'block') {
      units.push(unit(id, { poly: rect(x0, 4, x1, 11) }));
      return;
    }
    walls.push(
      wall(`${id}-n`, { a: [x0, 4], b: [x1, 4] }),
      wall(`${id}-s`, { a: [x0, 11], b: [x1, 11] }),
    );
    openings.push(
      opening(`${id}-front`, `${id}-n`, { at: 0.5, w: 1.5 }),
      opening(`${id}-back`, `${id}-s`, { at: 0.5, w: 1.5 }),
    );
    units.push(
      unit(id, {
        ...(kind === 'walk-through' ? { passThrough: true } : {}),
        doors: [`${id}-front`, `${id}-back`],
        poly: rect(x0, 4, x1, 11),
      }),
    );
  };
  fill(first, 's1', 5, 10);
  fill(second, 's2', 12, 17);
  walls.push(wall('cafe-n', { a: [6, 15], b: [9, 15] }));
  openings.push(opening('cafe-door', 'cafe-n', { at: 0.5, w: 1 }));
  units.push(unit('cafe', { doors: ['cafe-door'], poly: rect(6, 15, 9, 19) }));
  return venueDoc({
    levels: [floor('l1', { size: [20, 19], walls, openings, units, ...extra })],
  });
}

// No store row on s2: in most fixtures it is a solid block (a walk-through store needs no row to be crossed, AC-104).
const STORES = [storeRow(1, 's1'), storeRow(3, 'cafe')];
const analyse = (doc, opts = {}) => runAnalysis(snapshotOf(doc, { stores: STORES, ...opts }));

/** The store-crossing edges of the unit `unitId`, each with its cost and stored length. */
function crossingsOf(result, unitId) {
  const { csr } = result.graph;
  const serial = result.layout.unitById.get(unitId).serial;
  return edgesOf(csr)
    .filter(({ k }) => originOf(csr, k) === ORIGIN.STORE && csr.edgeRef[k] === serial)
    .map(({ from, to, k }) => ({
      from,
      to,
      lengthM: result.costs.lengthM[k],
      costS: result.costs.costS[k],
    }));
}

test('engine.passages AC-104, V-C-7: each door joins a point 0.5 m inside; the points join across at length x factor / speed', () => {
  const result = analyse(twoCorridors({ linkAtEnd: true }));
  const { csr } = result.graph;
  const edges = crossingsOf(result, 's1');
  assert.equal(edges.length, 6, 'door to inside, inside to inside, inside to door: each both ways');
  const front = result.graph.doorNode.get('s1-front');
  const back = result.graph.doorNode.get('s1-back');
  const fromFront = edges.find((e) => e.from === front);
  const inside = fromFront.to;
  assert.equal(kindOf(csr, inside), NODE.STORE_INSIDE);
  assert.deepEqual([csr.x[inside], csr.z[inside]], [7.5, 4.5], '0.5 m inside the gap');
  assert.equal(fromFront.lengthM, 0.5);
  assert.equal(fromFront.costS, 0.521, '0.5 x 1.25 / 1.2');
  const across = edges.find((e) => e.from === inside && kindOf(csr, e.to) === NODE.STORE_INSIDE);
  assert.equal(across.lengthM, 6);
  assert.equal(across.costS, 6.25, 'V-C-7: 6 m at 1.25');
  assert.ok(
    edges.some((e) => e.to === back),
    'out through the back door',
  );
});

test('engine.passages AC-104 (AC-72): the store-crossing factor and the walking speed are the settings, not literals', () => {
  const result = analyse(twoCorridors({ linkAtEnd: true }), {
    routing: { storeCrossingFactor: 2, walkSpeedMps: 1 },
  });
  const across = crossingsOf(result, 's1').find((e) => e.lengthM === 6);
  assert.equal(across.costS, 12);
});

test('engine.passages AC-38: a store not marked walk-through gets no edges across its floor', () => {
  const result = analyse(twoCorridors({ first: 'store', linkAtEnd: true }));
  const { csr } = result.graph;
  assert.deepEqual(crossingsOf(result, 's1'), []);
  for (let v = 0; v < csr.nodeCount; v += 1) {
    assert.notEqual(planar.pointInRing(csr.x[v], csr.z[v], rect(5, 4, 10, 11)), 'inside');
  }
});

test('engine.passages AC-104: a crossing of a concave store never leaves its floor through its notch', () => {
  // An L-shaped walk-through store with a door on its south side, on its east arm and on its notch side; the line
  // between the east arm's and the notch side's inside points would cut the notch, which is open floor.
  const shop = [
    [2, 4],
    [12, 4],
    [12, 8],
    [8, 8],
    [8, 14],
    [2, 14],
  ];
  const doc = venueDoc({
    levels: [
      floor('l1', {
        size: [20, 16],
        walls: [
          wall('edge', { a: [0, 0], b: [0, 4] }),
          wall('south', { a: [2, 4], b: [12, 4] }),
          wall('arm', { a: [12, 4], b: [12, 8] }),
          wall('notch', { a: [8, 8], b: [8, 14] }),
        ],
        openings: [
          opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true }),
          opening('d-south', 'south', { at: 0.175, w: 1.5 }),
          opening('d-arm', 'arm', { at: 0.4375, w: 1.5 }),
          opening('d-notch', 'notch', { at: 0.7916667, w: 1.5 }),
        ],
        units: [
          unit('shop', {
            passThrough: true,
            doors: ['d-south', 'd-arm', 'd-notch'],
            poly: shop,
          }),
        ],
      }),
    ],
  });
  const result = analyse(doc, { stores: [storeRow(1, 'shop')] });
  const { csr } = result.graph;
  const insides = [];
  for (let v = 0; v < csr.nodeCount; v += 1)
    if (kindOf(csr, v) === NODE.STORE_INSIDE) insides.push(v);
  assert.equal(insides.length, 3);
  const pairs = crossingsOf(result, 'shop')
    .filter((e) => insides.includes(e.from) && insides.includes(e.to))
    .map((e) => [csr.z[e.from], csr.z[e.to]].sort((p, q) => p - q).join('-'));
  assert.ok(!pairs.includes('5.75-12.75'), 'the arm and the notch side cannot see each other');
  assert.equal(pairs.length, 4, 'the south door sees both of the others, both ways');
});

test('engine.passages AC-97: a REMOVE_PATH removes the store crossings its line touches', () => {
  const removal = {
    corrections: [
      {
        id: 'cut',
        kind: 'REMOVE_PATH',
        line: [
          [5.5, 7.5],
          [9.5, 7.5],
        ],
      },
    ],
  };
  const result = analyse(twoCorridors({ linkAtEnd: true, extra: removal }));
  const { csr } = result.graph;
  const edges = crossingsOf(result, 's1');
  assert.ok(
    edges.every(
      (e) => kindOf(csr, e.from) !== NODE.STORE_INSIDE || kindOf(csr, e.to) !== NODE.STORE_INSIDE,
    ),
    'the line across the floor is gone',
  );
  assert.equal(edges.length, 4, 'each door still reaches its own inside point');
});

test('engine.passages AC-30, AC-104: a crossing through a door carries no more than its measured clear width', () => {
  const doc = twoCorridors({ linkAtEnd: true });
  doc.levels[0].openings.find((o) => o.id === 's1-front').clearW = 0.9;
  const result = analyse(doc);
  const { csr } = result.graph;
  const front = result.graph.doorNode.get('s1-front');
  const k = edgesOf(csr).find((e) => e.from === front && originOf(csr, e.k) === ORIGIN.STORE).k;
  assert.ok(Math.abs(csr.clearanceM[k] - 0.9) < 1e-6, `clearance ${csr.clearanceM[k]}`);
});

// ---------------------------------------------------------------------------------------------- AC-39 passages

/** The unit ids of the walk-through stores that are passages for `placeId`, in document order. */
function passagesFor(result, placeId) {
  const index = result.places.findIndex((p) => p.id === placeId);
  const units = result.layout.levels.flatMap((l) => l.units);
  return [...result.reach.passages]
    .filter(([, serves]) => serves.has(index))
    .map(([serial]) => units[serial].id);
}
const unreachableOf = (result) =>
  result.findings
    .filter((f) => f.kind === 'UNREACHABLE')
    .map((f) => [f.element.id, f.params.reason]);

test('engine.passages AC-39: a place reached only through a walk-through store gets that store as its passage', () => {
  const result = analyse(twoCorridors());
  assert.deepEqual(unreachableOf(result), []);
  assert.deepEqual(passagesFor(result, 'cafe'), ['s1']);
  assert.deepEqual(passagesFor(result, 's1'), [], 'the store itself is reached at its front door');
});

test('engine.passages AC-39 (D10, EC-98): when either of two walk-through stores would do, both become passages', () => {
  const result = analyse(twoCorridors({ second: 'walk-through' }));
  assert.deepEqual(passagesFor(result, 'cafe'), ['s1', 's2']);
});

test('engine.passages AC-39: a place with a way round gets no passage', () => {
  const result = analyse(twoCorridors({ linkAtEnd: true }));
  assert.deepEqual(passagesFor(result, 'cafe'), []);
  assert.deepEqual([...result.reach.passages.keys()], []);
});

test('engine.passages AC-110 (EC-98): a place reachable only through an unmarked store is unreachable', () => {
  const result = analyse(twoCorridors({ first: 'store' }));
  assert.deepEqual(unreachableOf(result), [['cafe', 'cut_off']]);
  const [finding] = result.findings.filter((f) => f.kind === 'UNREACHABLE');
  assert.deepEqual(finding.element, { kind: 'store', id: 'cafe', name: 'Store cafe' });
  assert.deepEqual(finding.at, { x: 7.5, z: 15 }, 'shown at its door');
});

test('engine.passages AC-39: two stores in a row are both passages for the place beyond them', () => {
  const door = (id, wallId) => opening(id, wallId, { at: 0.5, w: 1.5 });
  const crossing = (id, z0, z1) => ({
    walls: [
      wall(`${id}-n`, { a: [0, z0], b: [10, z0] }),
      wall(`${id}-s`, { a: [0, z1], b: [10, z1] }),
    ],
    openings: [door(`${id}-front`, `${id}-n`), door(`${id}-back`, `${id}-s`)],
    unit: unit(id, {
      passThrough: true,
      doors: [`${id}-front`, `${id}-back`],
      poly: rect(0, z0, 10, z1),
    }),
  });
  const first = crossing('first', 4, 10);
  const second = crossing('second', 14, 20);
  const doc = venueDoc({
    levels: [
      floor('l1', {
        size: [10, 28],
        walls: [
          wall('edge', { a: [0, 0], b: [0, 4] }),
          ...first.walls,
          ...second.walls,
          wall('end-n', { a: [2, 24], b: [6, 24] }),
        ],
        openings: [
          opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true }),
          ...first.openings,
          ...second.openings,
          opening('end-door', 'end-n', { at: 0.5, w: 1 }),
        ],
        units: [
          first.unit,
          second.unit,
          unit('end', { doors: ['end-door'], poly: rect(2, 24, 6, 28) }),
        ],
      }),
    ],
  });
  const result = runAnalysis(
    snapshotOf(doc, { stores: [storeRow(1, 'first'), storeRow(2, 'second'), storeRow(3, 'end')] }),
  );
  assert.deepEqual(unreachableOf(result), []);
  assert.deepEqual(passagesFor(result, 'end'), ['first', 'second']);
  assert.deepEqual(passagesFor(result, 'second'), ['first']);
});

test('engine.passages AC-39 (D5): a one-way escalator up and a way down only through a store makes that store a passage', () => {
  const door = (id, wallId) => opening(id, wallId, { at: 0.5, w: 1.5 });
  const doc = venueDoc({
    levels: [
      floor('l1', {
        size: [30, 6],
        walls: [wall('edge', { a: [0, 0], b: [0, 4] })],
        openings: [opening('entrance', 'edge', { at: 0.5, w: 1.2, entrance: true })],
      }),
      floor('l2', {
        ordinal: 2,
        elevation: 4.5,
        size: [30, 10],
        walls: [
          wall('link-w', { a: [10, 0], b: [10, 6] }),
          wall('link-e', { a: [20, 0], b: [20, 6] }),
          wall('west-n', { a: [2, 6], b: [6, 6] }),
          wall('east-n', { a: [22, 6], b: [26, 6] }),
        ],
        openings: [
          door('link-west', 'link-w'),
          door('link-east', 'link-e'),
          opening('west-door', 'west-n', { at: 0.5, w: 1 }),
          opening('east-door', 'east-n', { at: 0.5, w: 1 }),
        ],
        units: [
          unit('link', {
            passThrough: true,
            doors: ['link-west', 'link-east'],
            poly: rect(10, 0, 20, 6),
          }),
          unit('west', { doors: ['west-door'], poly: rect(2, 6, 6, 10) }),
          unit('east', { doors: ['east-door'], poly: rect(22, 6, 26, 10) }),
          unit('filler', { poly: rect(6, 6, 22, 10) }),
          unit('filler-w', { poly: rect(0, 6, 2, 10) }),
          unit('filler-e', { poly: rect(26, 6, 30, 10) }),
        ],
      }),
    ],
    connectors: [
      // Up into the west half; down from the east half.
      connector('up', 'escalator', ['l1', 'l2'], {
        x: 4,
        z: 2,
        stops: [
          [4, 2],
          [4, 2],
        ],
      }),
      connector('down', 'escalator', ['l2', 'l1'], {
        x: 26,
        z: 2,
        stops: [
          [26, 2],
          [26, 2],
        ],
      }),
    ],
  });
  const result = runAnalysis(
    snapshotOf(doc, { stores: [storeRow(1, 'west'), storeRow(2, 'east'), storeRow(3, 'link')] }),
  );
  assert.deepEqual(unreachableOf(result), []);
  assert.deepEqual(passagesFor(result, 'west'), ['link'], 'the way back down');
  assert.deepEqual(passagesFor(result, 'east'), ['link'], 'the way there');
});
