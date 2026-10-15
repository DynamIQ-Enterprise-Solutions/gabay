// The 3D spike's level fixture (plan/V3D-spike.md 1.0 step 1): app/lib/spike3d/demo_level.g.dart is generated from
// the Demo Malls seed sources by `npm run gen:spike3d-level`. These cases keep it current (a changed source fails
// `npm run verify` until it is regenerated), prove the SHA-256 in its header is the source's, and pin the stand-in
// converter's rules (DC-V5) and the heaviest-level pick (DC-19) on invented fixtures. The app side
// (app/test/spike3d/demo_level_fixture_test.dart) checks the counts and the bounds; the app has no SHA-256 without a
// new package (AC-91), so the hash is checked here.
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DART_FILE, readSources, renderDart } = require('../gen-spike3d-level');
const { convertVenue, rankLevels, splitRectEdges, markerPath } = require('../lib/spike3d-level');

const ROOT = path.resolve(__dirname, '..', '..');
const CONSTANTS = { wallThicknessM: 0.15, levelHeightM: 3, wallMinLengthM: 0.05 };

test('spike3d level: the committed Dart file equals what the generator writes from the sources', () => {
  const committed = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  assert.equal(
    committed,
    renderDart(readSources()),
    `${DART_FILE} is stale: run npm run gen:spike3d-level and commit it`,
  );
});

test('spike3d level: --check exits 0 on the live files', () => {
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, 'tools', 'gen-spike3d-level.js'), '--check'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /up to date/);
});

test("spike3d level: the header's SHA-256 is the named source file's own", () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const file = /^\/\/ GENERATED FILE: do not edit\. Source: (\S+),$/m.exec(dart)[1];
  const sha = /^\/\/ Source SHA-256: ([0-9a-f]{64})$/m.exec(dart)[1];
  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, file)))
    .digest('hex');
  assert.equal(sha, actual);
  assert.match(dart, new RegExp(`sourceSha256 = '${actual}'`));
});

test('spike3d level: the heaviest level is Bayview Grand, building M, level "2" (the plan\'s expectation)', () => {
  const ranked = rankLevels(readSources().flatMap((s) => s.levels));
  const top = ranked[0].level;
  assert.deepEqual([top.venueId, top.buildingId, top.shortName], ['bayview', 'M', '2']);
  assert.equal(top.walls.filter((w) => w.source === 'wall').length, 937);
});

test('spike3d level: a door in the middle of an edge splits it in two; the other edges stay whole', () => {
  // A 10 x 35 m store with one 1.6 m door on its south edge (as Bayview's stores are drawn).
  const pieces = splitRectEdges([470, 258, 480, 293], [[475, 293]], 1.6, 0.05);
  assert.equal(pieces.length, 5);
  assert.deepEqual(
    pieces.filter((p) => p.edge === 2).map((p) => [p.ax, p.az, p.bx, p.bz]),
    [
      [480, 293, 475.8, 293],
      [474.2, 293, 470, 293],
    ],
  );
});

test('spike3d level: two doors on one edge give three pieces; a door at a corner leaves no sliver', () => {
  const two = splitRectEdges(
    [0, 0, 20, 10],
    [
      [5, 0],
      [15, 0],
    ],
    2,
    0.05,
  ).filter((p) => p.edge === 0);
  assert.deepEqual(
    two.map((p) => [p.ax, p.bx]),
    [
      [0, 4],
      [6, 14],
      [16, 20],
    ],
  );
  const corner = splitRectEdges([0, 0, 20, 10], [[0.98, 0]], 2, 0.05).filter((p) => p.edge === 0);
  assert.deepEqual(
    corner.map((p) => [p.ax, p.bx]),
    [[1.98, 20]],
  );
});

test('spike3d level: DC-V5 on an invented venue (walls, walkable areas, outline segments, no items)', () => {
  const venue = {
    id: 'inv',
    name: 'Invented',
    siteRect: [0, 0, 200, 100],
    ground: 0,
    levels: [{ id: 'G', short: 'G', name: 'Ground', elev: 0 }],
    buildings: [{ id: 'B', name: 'Block', rect: [10, 10, 190, 90], lvs: [0], kind: 'mall' }],
    areas: [
      { bld: 'B', kind: 'court', lvs: [0], rect: [100, 40, 120, 60] },
      { bld: 'B', kind: 'void', lvs: [0], rect: [140, 40, 150, 50] },
    ],
    slots: [],
    places: [
      {
        id: 's1',
        lv: 0,
        name: 'IMAX Hall',
        cat: 'cinema',
        wing: 'B',
        kind: 'box',
        rect: [20, 20, 40, 30],
        at: [30, 25],
        door: [30, 25],
        doors: [
          [30, 30],
          [40, 25],
        ],
        doorW: 2,
      },
      {
        id: 's2',
        lv: 0,
        name: 'Shop',
        cat: 'fashion',
        wing: 'B',
        kind: 'store',
        rect: [40, 20, 50, 30],
        at: [45, 25],
        door: [45, 30],
        doors: [],
        doorW: 1.6,
      },
      {
        id: 'r1',
        lv: 0,
        name: 'Restroom',
        cat: 'restroom',
        wing: 'B',
        kind: 'svc',
        rect: [60, 20, 66, 30],
        at: [63, 25],
        door: [63, 30],
        doors: [],
        doorW: 1,
      },
      {
        id: 'a1',
        lv: 0,
        name: 'ATM',
        cat: 'atm',
        wing: 'B',
        kind: 'svc',
        rect: [70, 20, 71, 21],
        at: [70.5, 20.5],
        door: [70.5, 21],
        doors: [],
        doorW: 1,
      },
    ],
    graph: {
      nodes: [],
      edges: [],
      lines: [{ lv: 0, a: [20, 50], b: [180, 50], w: 10, out: false, zone: null, bld: 'B' }],
    },
  };
  const [level] = convertVenue(venue, CONSTANTS);
  const walls = level.walls.filter((w) => w.source === 'wall');
  const outline = level.walls.filter((w) => w.source === 'unit');
  // Three walled units, four explicit walls each; s1 has two doors (6 pieces), s2 and r1 one each (5 pieces).
  assert.equal(level.explicitWalls, 12);
  assert.equal(walls.length, 16);
  assert.ok(walls.every((w) => w.thickness === 0.15 && w.kind === 'solid'));
  // Outline segments: the same 16 pieces plus the void's 4 edges; the court is walkable and has none.
  assert.equal(outline.length, 20);
  assert.deepEqual(
    level.units.map((u) => [u.id, u.category, u.walkable, u.storeName]),
    [
      ['s1', 'movietheater', false, 'Vista Max Hall'],
      ['s2', 'room', false, 'Shop'],
      ['r1', 'restroom', false, null],
      ['area0-0', 'walkway', true, null],
      ['area1-0', 'opentobelow', false, null],
      ['line0', 'walkway', true, null],
    ],
  );
  assert.deepEqual(level.items, []);
  assert.equal(level.height, 3);
  assert.deepEqual(level.floorOutline, [10, 10, 190, 10, 190, 90, 10, 90]);
  assert.deepEqual(level.markerPath, [20, 50, 180, 50]);
});

test('spike3d level: the heaviest pick breaks a tie by the lower elevation', () => {
  const lv = (elevation, units) => ({
    elevation,
    explicitWalls: 0,
    units: Array(units).fill({}),
    items: [],
  });
  const ranked = rankLevels([lv(12, 3), lv(6, 3), lv(0, 2)]);
  assert.deepEqual(
    ranked.map((r) => r.level.elevation),
    [6, 12, 0],
  );
});

test('spike3d level: a level with no corridor walks the floor midline', () => {
  assert.deepEqual(
    markerPath({ floorOutline: [0, 0, 10, 0, 10, 4, 0, 4], corridors: [] }),
    [0, 2, 10, 2],
  );
});
