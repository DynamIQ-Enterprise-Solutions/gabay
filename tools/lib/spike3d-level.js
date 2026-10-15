// The 3D spike's stand-in converter (plan/V3D-spike.md 1.0 step 1, DC-V5): one Demo Malls source (the JSON dump of
// the demo's generator, L119) in, the per-level geometry the 3D map reads (spec/P0-03.md r5 AC-116 and AC-140) out.
// Data only: nothing of the demo's code is used (L34). It mirrors OA-3 AC-13 simply and is not OA-3c's converter;
// stage V re-measures on real packages (plan §7).
//
// DC-V5's rules:
//   - stores, boxes and restrooms become non-walkable units, each with one explicit wall per outline edge, split at
//     its doors, WALL_THICKNESS_DEFAULT_M thick and solid; abutting stores keep both walls;
//   - courts and plazas become walkable; voids, back-of-house and cores become non-walkable units without walls;
//     corridors become walkable strips;
//   - the level height is LEVEL_HEIGHT_DEFAULT_M; there are no items;
//   - every non-walkable unit's outline edges are wall segments with source "unit" (AC-94, AC-140 (b)).
// Where DC-V5 names nothing, the seed's own reading (db/seeds/lib/demo.js) is kept: gardens are walkable, a bowl
// and a portal are non-walkable with no walls, parking zones and bridges are walkable, a cinema is a movie theatre,
// and a thing is on the level of its building, else the building that holds it, else the outdoor ground.
'use strict';

const WALLED_KINDS = new Set(['store', 'box']);
const AREA_UNIT = {
  court: ['walkway', true],
  plaza: ['walkway', true],
  garden: ['unenclosedarea', true],
  void: ['opentobelow', false],
  boh: ['nonpublic', false],
  bowl: ['recreation', false],
  portal: ['unspecified', false],
};
const SLOT_UNIT = { core: 'structure', portal: 'unspecified' };
const RENAMES = [[/IMAX/g, 'Vista Max']]; // L119: no real trademarks in test data (as db/seeds/lib/demo.js)
const OUTDOOR = 'OUT';

const round = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const rename = (s) => RENAMES.reduce((acc, [re, to]) => acc.replace(re, to), s);
const normRect = ([x1, y1, x2, y2]) => [
  Math.min(x1, x2),
  Math.min(y1, y2),
  Math.max(x1, x2),
  Math.max(y1, y2),
];
const rectOutline = ([x1, y1, x2, y2]) => [x1, y1, x2, y1, x2, y2, x1, y2].map(round);
const contains = ([x1, y1, x2, y2], [x, y]) =>
  x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
const area = ([x1, y1, x2, y2]) => Math.abs(x2 - x1) * Math.abs(y2 - y1);

/** The four corners of a strip of the given width around the segment a-b (a corridor or a bridge). */
function stripOutline(a, b, width) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const hx = (-uy * width) / 2;
  const hy = (ux * width) / 2;
  return [
    a[0] + hx,
    a[1] + hy,
    b[0] + hx,
    b[1] + hy,
    b[0] - hx,
    b[1] - hy,
    a[0] - hx,
    a[1] - hy,
  ].map(round);
}

/**
 * The edge of rect a door at p sits on, as db/seeds/lib/geo.js doorOnRect picks it: the nearer of the two
 * horizontal edges when that is at least as near as the nearer vertical edge. Returns 0 north, 1 east, 2 south,
 * 3 west, and the door's coordinate along that edge.
 */
function doorEdge([x1, y1, x2, y2], p) {
  const d = [Math.abs(p[1] - y1), Math.abs(p[1] - y2), Math.abs(p[0] - x1), Math.abs(p[0] - x2)];
  if (Math.min(d[0], d[1]) <= Math.min(d[2], d[3])) return { edge: d[0] <= d[1] ? 0 : 2, at: p[0] };
  return { edge: d[2] <= d[3] ? 3 : 1, at: p[1] };
}

/**
 * A rectangle's four edges (north, east, south, west, clockwise on the plan), each split at the gaps of the doors
 * on it. Returns [{ edge, ax, az, bx, bz }], pieces shorter than minLength left out.
 */
function splitRectEdges(rect, doors, doorWidth, minLength) {
  const [x1, y1, x2, y2] = rect;
  const gaps = [[], [], [], []];
  for (const p of doors) {
    const { edge, at } = doorEdge(rect, p);
    gaps[edge].push([at - doorWidth / 2, at + doorWidth / 2]);
  }
  // Each edge as a fixed coordinate and a run along the other axis, in clockwise order.
  const edges = [
    { horizontal: true, fixed: y1, from: x1, to: x2 },
    { horizontal: false, fixed: x2, from: y1, to: y2 },
    { horizontal: true, fixed: y2, from: x2, to: x1 },
    { horizontal: false, fixed: x1, from: y2, to: y1 },
  ];
  const out = [];
  edges.forEach((e, i) => {
    const lo = Math.min(e.from, e.to);
    const hi = Math.max(e.from, e.to);
    let kept = [[lo, hi]];
    for (const [g0, g1] of gaps[i]) {
      kept = kept.flatMap(([k0, k1]) =>
        [
          [k0, Math.min(k1, g0)],
          [Math.max(k0, g1), k1],
        ].filter(([s0, s1]) => s1 > s0),
      );
    }
    const pieces = kept.filter(([s0, s1]) => s1 - s0 >= minLength);
    if (e.from > e.to) pieces.reverse();
    for (const [s0, s1] of pieces) {
      const [u0, u1] = e.from > e.to ? [s1, s0] : [s0, s1];
      const [ax, az, bx, bz] = e.horizontal
        ? [u0, e.fixed, u1, e.fixed]
        : [e.fixed, u0, e.fixed, u1];
      out.push({ edge: i, ax: round(ax), az: round(az), bx: round(bx), bz: round(bz) });
    }
  });
  return out;
}

/** The squared distance from point p to the segment a-b. */
function segmentDistance2(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const qx = a[0] + t * dx - p[0];
  const qy = a[1] + t * dy - p[1];
  return qx * qx + qy * qy;
}

function boundsOf(flat) {
  let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < flat.length; i += 2) {
    minX = Math.min(minX, flat[i]);
    maxX = Math.max(maxX, flat[i]);
    minZ = Math.min(minZ, flat[i + 1]);
    maxZ = Math.max(maxZ, flat[i + 1]);
  }
  return [minX, minZ, maxX, maxZ];
}

/**
 * Converts one Demo Malls source into its levels, one entry per (building, level) plus the outdoor ground.
 * `constants` holds wallThicknessM, levelHeightM and wallMinLengthM (from the venue map schema file).
 */
function convertVenue(v, constants) {
  const levels = new Map();
  const site = normRect(v.siteRect);
  const levelFor = (key, lv, building) => {
    if (!levels.has(key)) {
      const L = v.levels[lv];
      levels.set(key, {
        key,
        venueId: v.id,
        venueName: v.name,
        buildingId: building ? building.id : null,
        buildingName: building ? building.name : null,
        levelIndex: lv,
        sourceLevelId: building ? L.id : 'outdoor',
        levelName: building ? L.name : 'Outdoor ground',
        shortName: building ? L.short : OUTDOOR,
        elevation: building ? L.elev : 0,
        height: constants.levelHeightM,
        origin: [site[0], site[1]],
        size: [site[2] - site[0], site[3] - site[1]],
        floorOutline: rectOutline(building ? normRect(building.rect) : site),
        walls: [],
        units: [],
        items: [],
        explicitWalls: 0,
        corridors: [],
      });
    }
    return levels.get(key);
  };
  const byId = new Map(v.buildings.map((b) => [b.id, b]));
  // The level a thing at point p on source level lv belongs to (db/seeds/lib/demo.js levelAt).
  const levelAt = (lv, p, hint) => {
    if (hint && byId.has(hint) && byId.get(hint).lvs.includes(lv)) {
      return levelFor(`${hint}|${lv}`, lv, byId.get(hint));
    }
    const inside = v.buildings
      .filter((b) => b.lvs.includes(lv) && contains(b.rect, p))
      .sort((a, b) => area(a.rect) - area(b.rect));
    if (inside.length) return levelFor(`${inside[0].id}|${lv}`, lv, inside[0]);
    if (lv === v.ground) return levelFor(`${OUTDOOR}|${lv}`, lv, null);
    const any = v.buildings.find((b) => b.lvs.includes(lv));
    return levelFor(`${any.id}|${lv}`, lv, any);
  };
  const centre = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

  // Every level of every building exists, even an empty one.
  for (const b of v.buildings) for (const lv of b.lvs) levelFor(`${b.id}|${lv}`, lv, b);

  const addUnit = (level, id, category, walkable, outline, storeName = null) => {
    level.units.push({ id, category, walkable, outline, storeName });
  };
  const addOutlineSegments = (level, unitId, pieces) => {
    for (const s of pieces) level.walls.push({ ...s, source: 'unit', sourceId: unitId });
  };

  for (const p of v.places) {
    const isRestroom = p.kind === 'svc' && p.cat === 'restroom';
    if (!WALLED_KINDS.has(p.kind) && !isRestroom) continue;
    const rect = normRect(p.rect);
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) continue;
    const level = levelAt(p.lv, p.at, p.wing);
    const doors = isRestroom ? [p.door] : p.doors.length ? p.doors : [p.door];
    const category = isRestroom ? 'restroom' : p.cat === 'cinema' ? 'movietheater' : 'room';
    addUnit(level, p.id, category, false, rectOutline(rect), isRestroom ? null : rename(p.name));
    const pieces = splitRectEdges(rect, doors, p.doorW, constants.wallMinLengthM);
    level.explicitWalls += 4;
    for (const s of pieces) {
      level.walls.push({
        ...s,
        source: 'wall',
        sourceId: `${p.id}-w${s.edge}`,
        thickness: constants.wallThicknessM,
        kind: 'solid',
      });
    }
    addOutlineSegments(level, p.id, pieces);
  }

  v.areas.forEach((a, i) => {
    const [category, walkable] = AREA_UNIT[a.kind] || ['unspecified', false];
    const rect = normRect(a.rect);
    for (const lv of a.lvs) {
      const level = levelAt(lv, centre(rect), a.bld);
      const id = `area${i}-${lv}`;
      addUnit(level, id, category, walkable, rectOutline(rect));
      if (!walkable)
        addOutlineSegments(level, id, splitRectEdges(rect, [], 0, constants.wallMinLengthM));
    }
  });
  v.slots.forEach((s, i) => {
    if (!SLOT_UNIT[s.kind]) return;
    const rect = normRect(s.rect);
    const level = levelAt(s.lv, centre(rect));
    const id = `slot${i}`;
    addUnit(level, id, SLOT_UNIT[s.kind], false, rectOutline(rect));
    addOutlineSegments(level, id, splitRectEdges(rect, [], 0, constants.wallMinLengthM));
  });
  for (const p of v.places.filter((x) => x.kind === 'zone')) {
    const rect = normRect(p.rect);
    if (rect[2] - rect[0] <= 0 || rect[3] - rect[1] <= 0) continue;
    addUnit(levelAt(p.lv, p.at, p.wing), p.id, 'parking', true, rectOutline(rect));
  }
  v.graph.lines.forEach((l, i) => {
    if (Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) <= 0) return;
    const mid = [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2];
    const level =
      l.out && l.lv === v.ground && !l.bld
        ? levelFor(`${OUTDOOR}|${l.lv}`, l.lv, null)
        : levelAt(l.lv, mid, l.bld);
    addUnit(level, `line${i}`, l.zone ? 'parking' : 'walkway', true, stripOutline(l.a, l.b, l.w));
    level.corridors.push([l.a, l.b]);
  });
  const nodes = new Map(v.graph.nodes.map((n) => [n.k, n]));
  v.graph.edges
    .filter((e) => e.kind === 'bridge')
    .forEach((e, i) => {
      const a = nodes.get(e.a);
      const b = nodes.get(e.b);
      const level = levelAt(a.lv, [a.x, a.y]);
      addUnit(level, `bridge${i}`, 'footbridge', true, stripOutline([a.x, a.y], [b.x, b.y], e.w));
    });

  for (const level of levels.values()) {
    level.markerPath = markerPath(level);
    delete level.corridors;
  }
  return [...levels.values()];
}

/**
 * The marker's path (plan step 5): the level's corridor centre-line nearest the floor's centre, walked out and back;
 * with no corridor, the floor's east-west midline.
 */
function markerPath(level) {
  const [minX, minZ, maxX, maxZ] = boundsOf(level.floorOutline);
  const c = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  let best = null;
  for (const [a, b] of level.corridors) {
    const d2 = segmentDistance2(c, a, b);
    if (!best || d2 < best.d2) best = { d2, path: [a[0], a[1], b[0], b[1]] };
  }
  return (best ? best.path : [minX, c[1], maxX, c[1]]).map(round);
}

/** The document elements of a level, DC-19's weight: walls (explicit, one per outline edge), units and items. */
const elementCount = (level) => level.explicitWalls + level.units.length + level.items.length;

/**
 * DC-19: the heaviest level of all the venues' levels; a tie goes to the lower elevation, then to the earlier
 * venue and level in source order. Returns the ranking, heaviest first.
 */
function rankLevels(levels) {
  return levels
    .map((level, order) => ({ level, order, elements: elementCount(level) }))
    .sort(
      (a, b) =>
        b.elements - a.elements || a.level.elevation - b.level.elevation || a.order - b.order,
    );
}

module.exports = {
  convertVenue,
  rankLevels,
  elementCount,
  splitRectEdges,
  doorEdge,
  markerPath,
  round,
};
