'use strict';

// Numbers, units and rounding (spec/OA-1.md r1 section 3.3; plan/OA-1-map-document.md 1.0 section 9): AC-13, AC-13a,
// AC-14, AC-15, AC-16; EC-4b, EC-34. Written FIRST: every case fails until engine-coder builds the validator.
// The vectors are read from the shared file beside the schema file, which OA-4's Dart helper reads later (AC-13).

const test = require('node:test');
const assert = require('node:assert/strict');
const vectors = require('../src/config/venue-map-rounding-vectors.json');
const b = require('./fixtures/mapBuilder');
const {
  validate,
  clone,
  setAt,
  assertOneProblemAt,
  assertProblemAt,
} = require('./fixtures/mapAsserts');

/** Where each number kind of the vector file lives in the full document, and what to read back. */
const FIELD_OF_KIND = {
  metres: 'levels[1].backdrop.cx',
  degrees: 'buildings[0].mapUp',
  ratio: 'levels[1].openings[1].at',
  mpp: 'levels[1].backdrop.mpp',
  latLon: 'site.georeference.origin.lat',
};

const readAt = (root, path) => path.match(/[^.[\]]+/g).reduce((n, k) => n[k], root);

test('AC-13: the vector file holds the spec vectors and the plan-added ones (0.5005, the georeference, -0.0004, -0)', () => {
  const ins = vectors.vectors.map((v) => `${v.kind}:${Object.is(v.in, -0) ? '-0' : v.in}`);
  for (const wanted of [
    'metres:1.23456',
    'metres:1.0005',
    'metres:-0.0005',
    'metres:0.0004',
    'metres:-0.0004',
    'metres:-0',
    'metres:0.5005',
    'mpp:0.00833333',
    'mpp:0.00025',
    'latLon:14.55474561',
    'degrees:360',
    'degrees:-90',
    'degrees:725',
    'degrees:359.9996',
  ]) {
    assert.ok(ins.includes(wanted), `the vector file holds ${wanted}`);
  }
});

for (const v of vectors.vectors) {
  test(`AC-13 / AC-15: ${v.kind} ${Object.is(v.in, -0) ? '-0' : v.in} is written as ${v.out} (${v.source})`, () => {
    const path = FIELD_OF_KIND[v.kind];
    assert.ok(path, `a document field for number kind ${v.kind}`);
    const doc = clone(b.fullDoc());
    setAt(doc, path, v.in);
    const res = validate(doc);
    assert.equal(res.ok, true, JSON.stringify(res.problems));
    const got = readAt(res.map, path);
    assert.ok(
      Object.is(got, v.out),
      `${v.in} -> ${Object.is(got, -0) ? '-0' : got}, expected ${v.out}`,
    );
  });
}

test('AC-13: a value that rounds to zero is written 0, never -0 (EC-34), and the text has no "-0" number', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[1].backdrop.cx', -0.0004);
  setAt(doc, 'levels[1].backdrop.cz', -0);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.ok(Object.is(res.map.levels[1].backdrop.cx, 0));
  assert.ok(Object.is(res.map.levels[1].backdrop.cz, 0));
  assert.doesNotMatch(JSON.stringify(res.map), /:-0[,}\]]/);
});

test('AC-13: rounding is half away from zero on the decimal text, not Math.round(x * 1000) / 1000 (0.5005, 0.5015, 0.5025)', () => {
  const doc = clone(b.fullDoc());
  const got = [0.5005, 0.5015, 0.5025].map((v) => {
    setAt(doc, 'levels[1].backdrop.cx', v);
    return readAt(validate(doc).map, 'levels[1].backdrop.cx');
  });
  assert.deepEqual(got, [0.501, 0.502, 0.503]);
});

test('AC-13: every metre, degree and ratio field is rounded to 3 decimals, and mpp, lat and lon to 7 (a field of each kind)', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[1].walls[1].t', 0.123456);
  setAt(doc, 'levels[1].items[0].x', 30.12349);
  setAt(doc, 'levels[1].amenities[0].at', [65.00049, 65.9996]);
  setAt(doc, 'levels[1].backdrop.opacity', 0.45678);
  setAt(doc, 'levels[1].backdrop.mpp', 0.012345678);
  setAt(doc, 'site.georeference.origin.lon', 121.02444529);
  setAt(doc, 'site.boundary', [
    [0, 0.0004],
    [200, 0],
    [200, 150],
    [0, 150],
  ]);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const m = res.map;
  assert.equal(m.levels[1].walls[1].t, 0.123);
  assert.equal(m.levels[1].items[0].x, 30.123);
  assert.deepEqual(m.levels[1].amenities[0].at, [65, 66]);
  assert.equal(m.levels[1].backdrop.opacity, 0.457);
  assert.equal(m.levels[1].backdrop.mpp, 0.0123457);
  assert.equal(m.site.georeference.origin.lon, 121.0244453);
  assert.deepEqual(m.site.boundary[0], [0, 0]);
});

// ----------------------------------------------------------------------------------------------------------- AC-14

test('AC-14: a backdrop with mpp 0.0083333 on a 4,000-pixel image measures 33.333 m, and 0.008 is not what is stored', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[1].backdrop.mpp', 0.00833333);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const mpp = res.map.levels[1].backdrop.mpp;
  assert.equal(mpp, 0.0083333);
  assert.notEqual(mpp, 0.008);
  assert.ok(Math.abs(mpp * 4000 - 33.333) < 0.001, `${mpp * 4000} m across`);
  assert.ok(
    Math.abs(mpp * 4000 - 0.00833333 * 4000) < 0.001,
    'within 0.001 m of the uncalibrated value',
  );
  assert.ok(Math.abs(0.008 * 4000 - 33.333) > 1, 'a 3-decimal copy would make it 32 m');
});

test('AC-14: mpp 0.00025 is kept exactly (a 3-decimal copy would write 0)', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[1].backdrop.mpp', 0.00025);
  assert.equal(validate(doc).map.levels[1].backdrop.mpp, 0.00025);
});

// ----------------------------------------------------------------------------------------------------------- AC-15

test('AC-15: angles on every angle field (site and building mapUp, item and connector and backdrop rot) are normalised to [0, 360)', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'site.mapUp', 725);
  setAt(doc, 'buildings[0].mapUp', -90);
  setAt(doc, 'levels[1].items[0].rot', 360);
  setAt(doc, 'connectors[0].rot', -90);
  setAt(doc, 'levels[1].backdrop.rot', 359.9996);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(res.map.site.mapUp, 5);
  assert.equal(res.map.buildings[0].mapUp, 270);
  assert.equal(
    res.map.levels[1].items[0].rot ?? 0,
    0,
    '360 is 0 (the default, so it may be omitted)',
  );
  assert.equal(res.map.connectors[0].rot, 270);
  assert.equal(res.map.levels[1].backdrop.rot ?? 0, 0, '359.9996 rounds to 360 and is 0');
});

test('AC-15: every written angle is in [0, 360) (random angles, seeded)', () => {
  const rng = b.mulberry32(15);
  for (let i = 0; i < 40; i += 1) {
    const doc = clone(b.fullDoc());
    const angle = (rng() - 0.5) * 4000;
    setAt(doc, 'buildings[0].mapUp', angle);
    const got = validate(doc).map.buildings[0].mapUp;
    assert.ok(got >= 0 && got < 360, `${angle} -> ${got}`);
    assert.ok(Object.is(got, Math.abs(got)), `${angle} -> ${got} is not -0`);
  }
});

// ----------------------------------------------------------------------------------------------------------- AC-16

test('AC-16: rounding comes first: 300.0004 passes a maximum of 300 (an elevation, and a level size at origin [0, 0])', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[4].elevation', 300.0004);
  const res = validate(doc);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(res.map.levels[4].elevation, 300);

  const small = b.minimalOutdoorDoc();
  small.levels[0].origin = [0, 0];
  small.levels[0].size = [300.0004, 100];
  const sized = validate(small);
  assert.equal(sized.ok, true, JSON.stringify(sized.problems));
  assert.equal(sized.map.levels[0].size[0], 300);
});

test('AC-16: 300.0006 is 300.001 after rounding and is refused', () => {
  const doc = clone(b.fullDoc());
  setAt(doc, 'levels[4].elevation', 300.0006);
  assertProblemAt(validate(doc), 'levels[4].elevation');
});

const poly = (points) => {
  const doc = b.smallDoc();
  doc.levels[0].units = [b.unit('u1', { poly: points })];
  return doc;
};

test('AC-16: a polygon whose points merge on rounding is judged on the merged points', () => {
  // three points within 0.0004 m of one another: one distinct point after rounding
  assertProblemAt(
    validate(
      poly([
        [10, 10],
        [10.0001, 10],
        [10.0002, 10.0001],
      ]),
    ),
    'levels[0].units[0].poly',
  );
  // four points of which two merge: three distinct remain, with a real area
  const res = validate(
    poly([
      [10, 10],
      [10.0004, 10.0004],
      [20, 10],
      [20, 20],
    ]),
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

test('AC-16: the area is judged after rounding (a sliver under POLY_MIN_AREA_M2 is refused)', () => {
  assertProblemAt(
    validate(
      poly([
        [10, 10],
        [20, 10],
        [20, 10.001],
      ]),
    ),
    'levels[0].units[0].poly',
  );
});

// ---------------------------------------------------------------------------------------------------------- AC-13a

const geo = (g) => {
  const doc = b.smallDoc();
  doc.site.georeference = g;
  return doc;
};
const GOOD_GEO = () => ({ origin: { lat: 14.5547456, lon: 121.0244452 }, bearingDeg: 12.5 });

test('AC-13a and EC-4b: georeference null is accepted and kept as null; an absent georeference is written null', () => {
  const nulled = validate(geo(null));
  assert.equal(nulled.ok, true, JSON.stringify(nulled.problems));
  assert.equal(nulled.map.site.georeference, null);
  const absent = validate(b.smallDoc());
  assert.equal(absent.ok, true);
  assert.equal(
    absent.map.site.georeference,
    null,
    'site.georeference: null is always written (owner ruling 2026-10-13)',
  );
});

test('AC-13a and EC-4b: the boundaries lat 90, lat -90, lon -180 and lon 180 are accepted', () => {
  for (const origin of [
    { lat: 90, lon: -180 },
    { lat: -90, lon: 180 },
    { lat: 0, lon: 0 },
  ]) {
    const res = validate(geo({ origin, bearingDeg: 0 }));
    assert.equal(res.ok, true, JSON.stringify([origin, res.problems]));
    assert.deepEqual(res.map.site.georeference.origin, origin);
  }
});

test('AC-13a: lat outside -90 .. 90 or lon outside -180 .. 180 gives one problem at its path', () => {
  for (const [field, value] of [
    ['lat', 90.0000001],
    ['lat', -90.0000001],
    ['lat', 91],
    ['lon', 180.0000001],
    ['lon', -180.0000001],
    ['lon', 200],
  ]) {
    const g = GOOD_GEO();
    g.origin[field] = value;
    assertOneProblemAt(validate(geo(g)), `site.georeference.origin.${field}`, `${field} ${value}`);
  }
});

test('AC-13a: a missing origin, lat, lon or bearingDeg gives one problem at its path', () => {
  for (const [mutate, path] of [
    [(g) => delete g.origin, 'site.georeference.origin'],
    [(g) => delete g.origin.lat, 'site.georeference.origin.lat'],
    [(g) => delete g.origin.lon, 'site.georeference.origin.lon'],
    [(g) => delete g.bearingDeg, 'site.georeference.bearingDeg'],
  ]) {
    const g = GOOD_GEO();
    mutate(g);
    assertOneProblemAt(validate(geo(g)), path);
  }
});

test('AC-13a: any other shape (a GeoJSON object, an array of control points, text, a number) gives a problem at site.georeference', () => {
  for (const bad of [
    { type: 'Point', coordinates: [121.0244, 14.5547] },
    [
      { x: 0, z: 0, lat: 14.55, lon: 121.02 },
      { x: 100, z: 0, lat: 14.55, lon: 121.03 },
    ],
    'Manila',
    14.55,
    true,
    [],
  ]) {
    assertProblemAt(validate(geo(bad)), 'site.georeference', JSON.stringify(bad));
  }
});

test('AC-13a: bearingDeg is normalised as an angle (-10 becomes 350), lat and lon are rounded to 7 decimals, unknown keys are left out', () => {
  const res = validate(
    geo({
      origin: { lat: 14.55474561, lon: 121.02444529, extra: 1 },
      bearingDeg: -10,
      spare: true,
    }),
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.deepEqual(res.map.site.georeference, {
    origin: { lat: 14.5547456, lon: 121.0244453 },
    bearingDeg: 350,
  });
});

test('AC-13a: a georeference with a non-number lat or bearingDeg gives one problem at it', () => {
  const g = GOOD_GEO();
  g.origin.lat = '14.55';
  assertOneProblemAt(validate(geo(g)), 'site.georeference.origin.lat');
  const h = GOOD_GEO();
  h.bearingDeg = null;
  assertOneProblemAt(validate(geo(h)), 'site.georeference.bearingDeg');
});
