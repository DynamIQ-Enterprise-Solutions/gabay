// A level's wall segments (spec/P0-03.md r4 AC-94, DC-20): one list per level, built once, which the crossing
// tests, the graph generator and the package's wall index (AC-134) all read, so the index holds exactly the
// segments the engine used.
//   - every explicit wall, split around the gaps of its `door` openings (each gap the opening's `w`, centred on it,
//     the channel's width) and kept whole at a `window`;
//   - the outline edges of every non-walkable unit, each split at the doors THAT unit lists.
// A segment is { x1, z1, x2, z2, halfT, wallId, unitId }: a wall's centreline with half its thickness, or an
// outline edge with halfT 0.
'use strict';

/** A wall piece shorter than this, left between two gaps, is not kept (metres). Kept from A1. */
const MIN_WALL_M = 1e-6;
/**
 * How far off a unit's outline edge a listed door's gap may be drawn, beyond half its wall's thickness, and still
 * count as sitting on that edge (metres; drawings are to the millimetre). Kept from A1's
 * OPENING_ON_EDGE_TOLERANCE_M: the outline may follow the wall's centreline or either face.
 */
const OPENING_ON_EDGE_TOLERANCE_M = 0.05;

/** The pieces of a-b left after removing the gaps ([from, to] distances along it, sorted), as segments. */
function pieces(ax, az, bx, bz, gaps, source) {
  const length = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / length;
  const uz = (bz - az) / length;
  const out = [];
  const push = (s0, s1) => {
    if (s1 - s0 <= MIN_WALL_M) return;
    // The ends keep the wall's own coordinates, so a whole wall is exactly its a and b.
    const p0 = s0 === 0 ? [ax, az] : [ax + s0 * ux, az + s0 * uz];
    const p1 = s1 === length ? [bx, bz] : [ax + s1 * ux, az + s1 * uz];
    out.push({ x1: p0[0], z1: p0[1], x2: p1[0], z2: p1[1], ...source });
  };
  let from = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > from) push(from, g0);
    if (g1 > from) from = g1;
  }
  if (from < length) push(from, length);
  return out;
}

/** Distance from p to the line through a with unit direction u. */
const lineDistance = (px, pz, ax, az, ux, uz) => Math.abs((px - ax) * uz - (pz - az) * ux);

/** The listed doors' gaps that lie on the edge a-b, as [from, to] distances along it. */
function gapsOnEdge(ax, az, bx, bz, doors) {
  const length = Math.hypot(bx - ax, bz - az);
  if (length === 0) return [];
  const ux = (bx - ax) / length;
  const uz = (bz - az) / length;
  const gaps = [];
  for (const door of doors) {
    const tolerance = door.wall.t / 2 + OPENING_ON_EDGE_TOLERANCE_M;
    const [p, q] = door.gap;
    if (lineDistance(p[0], p[1], ax, az, ux, uz) > tolerance) continue;
    if (lineDistance(q[0], q[1], ax, az, ux, uz) > tolerance) continue;
    const sp = (p[0] - ax) * ux + (p[1] - az) * uz;
    const sq = (q[0] - ax) * ux + (q[1] - az) * uz;
    const g0 = Math.max(0, Math.min(sp, sq));
    const g1 = Math.min(length, Math.max(sp, sq));
    if (g1 > g0) gaps.push([g0, g1]);
  }
  return gaps.sort((g, h) => g[0] - h[0] || g[1] - h[1]);
}

/**
 * The wall segments of one level (layout.js's level), in document order: the explicit walls, then the outlines of
 * the non-walkable units.
 */
function levelWallSegments(level) {
  const segments = [];
  const doorsOnWall = new Map();
  for (const opening of level.openings) {
    if (!opening.isDoor) continue;
    if (!doorsOnWall.has(opening.wall.id)) doorsOnWall.set(opening.wall.id, []);
    doorsOnWall.get(opening.wall.id).push([opening.gapFrom, opening.gapTo]);
  }
  for (const wall of level.walls) {
    const gaps = (doorsOnWall.get(wall.id) ?? []).sort((g, h) => g[0] - h[0] || g[1] - h[1]);
    const source = { halfT: wall.t / 2, wallId: wall.id, unitId: null };
    segments.push(...pieces(wall.a[0], wall.a[1], wall.b[0], wall.b[1], gaps, source));
  }
  const openingById = new Map(level.openings.map((o) => [o.id, o]));
  for (const unit of level.units) {
    if (unit.walkable) continue;
    const doors = unit.doors.map((id) => openingById.get(id)).filter((o) => o && o.isDoor);
    const source = { halfT: 0, wallId: null, unitId: unit.id };
    const ring = unit.ring;
    for (let i = 0; i < ring.length; i += 1) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      segments.push(...edgeBesideDoors(ax, az, bx, bz, doors, source));
    }
  }
  return segments;
}

/**
 * The pieces of the edge a-b that none of `doors` (layout.js openings) sits on, as segments with `source`: the
 * same rule as a unit's outline (clearance.js reads it for a building's footprint, where an entrance is a way
 * through).
 */
function edgeBesideDoors(ax, az, bx, bz, doors, source) {
  if (ax === bx && az === bz) return [];
  return pieces(ax, az, bx, bz, gapsOnEdge(ax, az, bx, bz, doors), source);
}

module.exports = { levelWallSegments, edgeBesideDoors };
