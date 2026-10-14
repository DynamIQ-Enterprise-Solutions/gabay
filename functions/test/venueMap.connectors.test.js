'use strict';

// Connector rules (spec/OA-1.md r1 section 2.6, AC-7; plan/OA-1-map-document.md 1.0 section 9): AC-7; EC-29, EC-30,
// and the ramp's dynamic bounds (DC-7). Written FIRST: every case fails until engine-coder builds the validator.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt, assertProblemAt } = require('./fixtures/mapAsserts');

const threeLevelDoc = () => {
  const doc = b.twoLevelDoc();
  doc.levels.push(b.level('l3', { building: 'b1', ordinal: 3 }));
  return doc;
};

/** Two levels of one building joined by `conn`. */
const withConnector = (conn, doc = b.twoLevelDoc()) => {
  doc.connectors = [conn];
  return doc;
};
const stairs = (over) => b.connector('c1', 'stairs', ['l1', 'l2'], over);
const escalator = (over) => b.connector('c1', 'escalator', ['l1', 'l2'], over);
const elevator = (over) => b.connector('c1', 'elevator', ['l1', 'l2'], over);
const ramp = (over) => b.connector('c1', 'ramp', ['l1', 'l2'], over);

test('AC-7: every kind of connector with its own type code, in its own ranges, validates (stairs, escalator, elevator, ramp)', () => {
  for (const conn of [
    stairs({ w: 2, len: 6, shape: 'U' }),
    escalator({ w: 1.2, len: 8 }),
    elevator({ w: 2, d: 2.5, cars: 3 }),
    ramp({ w: 2, len: 12, shape: 'L' }),
  ]) {
    const res = validate(withConnector(conn));
    assert.equal(res.ok, true, `${conn.kind}: ${JSON.stringify(res.problems)}`);
  }
});

test('AC-7: an escalator with three levels gives one problem at levels (EC-29)', () => {
  const doc = withConnector(b.connector('c1', 'escalator', ['l1', 'l2', 'l3']), threeLevelDoc());
  assertOneProblemAt(validate(doc), 'connectors[0].levels');
});

test('AC-7: an escalator with one level gives a problem at levels', () => {
  assertProblemAt(
    validate(withConnector(b.connector('c1', 'escalator', ['l1']))),
    'connectors[0].levels',
  );
});

test('AC-7: stairs, ramps and lifts need at least two levels, and a lift may serve three', () => {
  assertProblemAt(
    validate(withConnector(b.connector('c1', 'stairs', ['l1']))),
    'connectors[0].levels',
  );
  assertProblemAt(
    validate(withConnector(b.connector('c1', 'elevator', ['l1']))),
    'connectors[0].levels',
  );
  const lift = validate(
    withConnector(b.connector('c1', 'elevator', ['l1', 'l2', 'l3']), threeLevelDoc()),
  );
  assert.equal(lift.ok, true, JSON.stringify(lift.problems));
});

test('AC-7: stops must hold exactly one point per level (too few and too many each give one problem at stops)', () => {
  assertOneProblemAt(validate(withConnector(stairs({ stops: [[50, 40]] }))), 'connectors[0].stops');
  assertOneProblemAt(
    validate(
      withConnector(
        stairs({
          stops: [
            [50, 40],
            [50, 40],
            [50, 40],
          ],
        }),
      ),
    ),
    'connectors[0].stops',
  );
  assertProblemAt(validate(withConnector(stairs({ stops: [] }))), 'connectors[0].stops');
});

test('AC-7: twoWay is set only on an escalator (stairs, elevator and ramp each give one problem at twoWay) (N6)', () => {
  for (const conn of [
    stairs({ twoWay: true }),
    elevator({ twoWay: true }),
    ramp({ twoWay: true }),
  ]) {
    assertOneProblemAt(
      validate(withConnector(conn)),
      'connectors[0].twoWay',
      `${conn.kind} ${conn.twoWay}`,
    );
  }
});

test('AC-7: a two-way escalator validates and keeps twoWay: true; a one-way escalator keeps its levels order', () => {
  const two = validate(withConnector(escalator({ twoWay: true })));
  assert.equal(two.ok, true, JSON.stringify(two.problems));
  assert.equal(two.map.connectors[0].twoWay, true);
  const oneWay = validate(withConnector(b.connector('c1', 'escalator', ['l2', 'l1'])));
  assert.equal(oneWay.ok, true, JSON.stringify(oneWay.problems));
  assert.deepEqual(oneWay.map.connectors[0].levels, ['l2', 'l1']);
  assert.ok(!oneWay.map.connectors[0].twoWay, 'one-way by default');
});

test('AC-7: d and cars are set only on an elevator (one problem each, at the field)', () => {
  assertOneProblemAt(validate(withConnector(stairs({ d: 2 }))), 'connectors[0].d');
  assertOneProblemAt(validate(withConnector(ramp({ d: 2 }))), 'connectors[0].d');
  assertOneProblemAt(validate(withConnector(escalator({ d: 2 }))), 'connectors[0].d');
  assertOneProblemAt(validate(withConnector(escalator({ cars: 2 }))), 'connectors[0].cars');
  assertOneProblemAt(validate(withConnector(stairs({ cars: 2 }))), 'connectors[0].cars');
  assertOneProblemAt(validate(withConnector(ramp({ cars: 2 }))), 'connectors[0].cars');
  const lift = validate(withConnector(elevator({ d: 2.5, cars: 2 })));
  assert.equal(lift.ok, true, JSON.stringify(lift.problems));
});

test('AC-7: shape is set only on stairs or a ramp (an elevator or an escalator with a shape gives one problem at shape)', () => {
  assertOneProblemAt(validate(withConnector(elevator({ shape: 'L' }))), 'connectors[0].shape');
  assertOneProblemAt(validate(withConnector(escalator({ shape: 'U' }))), 'connectors[0].shape');
  for (const shape of ['straight', 'L', 'U']) {
    assert.equal(validate(withConnector(stairs({ shape }))).ok, true, `stairs ${shape}`);
    assert.equal(validate(withConnector(ramp({ shape }))).ok, true, `ramp ${shape}`);
  }
});

test('AC-7: len is set only on stairs, an escalator or a ramp (an elevator with len gives one problem at len)', () => {
  assertOneProblemAt(validate(withConnector(elevator({ len: 5 }))), 'connectors[0].len');
});

test('AC-7: evacuationOnly: true together with walkable: false gives one problem at the connector (L87)', () => {
  const res = validate(withConnector(stairs({ evacuationOnly: true, walkable: false })));
  assert.equal(res.ok, false);
  assert.equal(res.problems.length, 1, JSON.stringify(res.problems));
  assert.match(res.problems[0], /^connectors\[0\]\.(evacuationOnly|walkable):/);
  assert.equal(
    validate(withConnector(stairs({ evacuationOnly: true }))).ok,
    true,
    'evacuation only, walkable',
  );
  assert.equal(validate(withConnector(stairs({ walkable: false }))).ok, true, 'scenery');
  assert.equal(
    validate(withConnector(stairs({ evacuationOnly: false, walkable: false }))).ok,
    true,
  );
});

test('AC-7 and EC-29: the type code CostModel must match the kind (stairs with a lift type, a lift with a stairs type, and a LEVEL type for every kind)', () => {
  const cases = [
    ['stairs', 'LIFT_STD'],
    ['stairs', 'ESC_STD'],
    ['escalator', 'STAIRS_STD'],
    ['elevator', 'STAIRS_STD'],
    ['ramp', 'LIFT_STD'],
    ['stairs', 'LEVEL_ONLY'],
    ['escalator', 'LEVEL_ONLY'],
    ['elevator', 'LEVEL_ONLY'],
    ['ramp', 'LEVEL_ONLY'],
  ];
  for (const [kind, type] of cases) {
    const res = validate(withConnector(b.connector('c1', kind, ['l1', 'l2'], { type })));
    assertOneProblemAt(res, 'connectors[0].type', `${kind} with ${type}`);
  }
});

test('AC-7: the same level twice in levels gives one problem at levels (EC-29)', () => {
  assertProblemAt(
    validate(withConnector(b.connector('c1', 'stairs', ['l1', 'l1']))),
    'connectors[0].levels',
  );
});

test('EC-30: two levels at the same elevation joined by stairs are accepted (the near-zero cost is a FF-3 prime check)', () => {
  const doc = b.twoLevelDoc();
  doc.levels[0].elevation = 4;
  doc.levels[1].elevation = 4;
  const res = validate(withConnector(stairs(), doc));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

// --------------------------------------------------------------------------------------- the ramp's dynamic bounds (DC-7)

// l1 is 100 x 80 (larger side 100); l2 is 60 x 40 (larger side 60), so a ramp between them is held to 60.
const rampDoc = (over) => {
  const doc = b.twoLevelDoc();
  doc.levels[1].size = [60, 40];
  return withConnector(
    b.connector('c1', 'ramp', ['l1', 'l2'], {
      stops: [
        [30, 20],
        [30, 20],
      ],
      x: 30,
      z: 20,
      ...over,
    }),
    doc,
  );
};

test("DC-7: a ramp's w and len are at most the larger side of the smallest level it serves (60 here); 60 is accepted, 60.001 is refused", () => {
  assert.equal(validate(rampDoc({ w: 60, len: 60 })).ok, true);
  assertOneProblemAt(validate(rampDoc({ w: 60.001, len: 10 })), 'connectors[0].w');
  assertOneProblemAt(validate(rampDoc({ w: 2, len: 60.001 })), 'connectors[0].len');
  assert.equal(validate(rampDoc({ w: 0.001, len: 0.001 })).ok, true, 'above 0 is enough');
});

test('DC-7: a ramp with no w or no len gives one problem at the missing field', () => {
  const noW = rampDoc({ len: 10 });
  delete noW.connectors[0].w;
  assertOneProblemAt(validate(noW), 'connectors[0].w');
  const noLen = rampDoc({ w: 2 });
  delete noLen.connectors[0].len;
  assertOneProblemAt(validate(noLen), 'connectors[0].len');
});

test('AC-7: stairs, escalator and elevator with no w, len, d or cars take the per-kind defaults and omit them from the canonical copy', () => {
  const res = validate(withConnector(stairs()));
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const c = res.map.connectors[0];
  for (const key of ['w', 'len', 'shape', 'rot', 'preferred'])
    assert.equal(key in c, false, `${key} is a default`);
  const written = validate(
    withConnector(stairs({ w: 1.2, len: 4, shape: 'straight', rot: 0, preferred: false })),
  );
  assert.equal(written.ok, true);
  for (const key of ['w', 'len', 'shape', 'rot', 'preferred'])
    assert.equal(key in written.map.connectors[0], false, `${key} equal to its default is omitted`);
  const lift = validate(withConnector(elevator({ w: 2, d: 2, cars: 1 })));
  for (const key of ['w', 'd', 'cars'])
    assert.equal(key in lift.map.connectors[0], false, `lift ${key}`);
  const esc = validate(withConnector(escalator({ w: 1, len: 7.5 })));
  for (const key of ['w', 'len'])
    assert.equal(key in esc.map.connectors[0], false, `escalator ${key}`);
});
