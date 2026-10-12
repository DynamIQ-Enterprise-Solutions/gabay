// A level's walls (ruled D4; spec/P0-03.md r2 §3 "Wall", AC-12, AC-71): every edge of a non-walkable unit's outline
// is a wall except where one of THAT unit's openings sits on it, and the outline of a floor object with BlocksWalk
// is a wall all round. The validator, the graph generator and the package model use this one list, built once, so
// the package's wall index holds exactly the segments the validator used (AC-71).
'use strict';

const { EPS } = require('./geometry/planar');

/** How far off a unit's edge an opening may be drawn and still count as sitting on it (metres; drawings are mm). */
const OPENING_ON_EDGE_TOLERANCE_M = 0.05;
/** A wall piece shorter than this, left between two gaps, is not kept (metres). */
const MIN_WALL_M = 1e-6;

/**
 * The stretches of edge a-b that an opening's segments cover, each as [t0, t1] along the edge with its end points.
 * An opening end drawn on the edge keeps its own coordinates, so a wall ends exactly where the door begins.
 * @returns {{ t0: number, t1: number, p0: number[], p1: number[] }[]}
 */
function gapsOnEdge(ax, ay, bx, by, openingLines) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const gaps = [];
  if (len2 === 0) return gaps;
  const onEdge = (px, py) => {
    const t = ((px - ax) * dx + (py - ay) * dy) / len2;
    if (t <= 0) return { t: 0, p: [ax, ay] };
    if (t >= 1) return { t: 1, p: [bx, by] };
    const exact = pointLineDistance(px, py, ax, ay, dx, dy, len2) <= EPS;
    return { t, p: exact ? [px, py] : [ax + t * dx, ay + t * dy] };
  };
  for (const points of openingLines) {
    for (let i = 1; i < points.length; i += 1) {
      const [px, py] = points[i - 1];
      const [qx, qy] = points[i];
      const near =
        pointLineDistance(px, py, ax, ay, dx, dy, len2) <= OPENING_ON_EDGE_TOLERANCE_M &&
        pointLineDistance(qx, qy, ax, ay, dx, dy, len2) <= OPENING_ON_EDGE_TOLERANCE_M;
      if (!near) continue;
      const [lo, hi] = [onEdge(px, py), onEdge(qx, qy)].sort((g, h) => g.t - h.t);
      if (hi.t > lo.t) gaps.push({ t0: lo.t, t1: hi.t, p0: lo.p, p1: hi.p });
    }
  }
  return gaps.sort((g, h) => g.t0 - h.t0);
}

/** Distance from p to the infinite line through a with direction d. */
function pointLineDistance(px, py, ax, ay, dx, dy, len2) {
  return Math.abs((px - ax) * dy - (py - ay) * dx) / Math.sqrt(len2);
}

/** The pieces of edge a-b left after removing the gaps, as wall segments. */
function wallPieces(ax, ay, bx, by, gaps, source) {
  const pieces = [];
  let fromT = 0;
  let fromP = [ax, ay];
  for (const gap of gaps) {
    if (gap.t0 > fromT) pieces.push([fromP, gap.p0]);
    if (gap.t1 > fromT) {
      fromT = gap.t1;
      fromP = gap.p1;
    }
  }
  if (fromT < 1) pieces.push([fromP, [bx, by]]);
  const out = [];
  for (const [[x1, y1], [x2, y2]] of pieces) {
    if (Math.hypot(x2 - x1, y2 - y1) > MIN_WALL_M) out.push({ x1, y1, x2, y2, ...source });
  }
  return out;
}

/**
 * The walls of one level.
 * @param {{ units: object[], openings: object[], floorObjects: object[] }} level  rows of this level, read by
 *   validation/shapes.js (each with `area` or `line`, null when unreadable), ordered by id.
 * @returns {{ x1: number, y1: number, x2: number, y2: number, unitId: number|null, floorObjectId: number|null }[]}
 */
function buildLevelWalls({ units, openings, floorObjects }) {
  const linesByUnit = new Map();
  for (const opening of openings) {
    if (opening.unitId === null || !opening.line) continue;
    if (!linesByUnit.has(opening.unitId)) linesByUnit.set(opening.unitId, []);
    linesByUnit.get(opening.unitId).push(opening.line);
  }
  const walls = [];
  for (const unit of units) {
    if (unit.isWalkable || !unit.area) continue;
    const lines = linesByUnit.get(unit.id) ?? [];
    for (const polygon of unit.area) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length; i += 1) {
          const [ax, ay] = ring[i];
          const [bx, by] = ring[(i + 1) % ring.length];
          const gaps = gapsOnEdge(ax, ay, bx, by, lines);
          walls.push(...wallPieces(ax, ay, bx, by, gaps, { unitId: unit.id, floorObjectId: null }));
        }
      }
    }
  }
  for (const object of floorObjects) {
    if (!object.blocksWalk || !object.area) continue;
    for (const polygon of object.area) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length; i += 1) {
          const [ax, ay] = ring[i];
          const [bx, by] = ring[(i + 1) % ring.length];
          walls.push(...wallPieces(ax, ay, bx, by, [], { unitId: null, floorObjectId: object.id }));
        }
      }
    }
  }
  return walls;
}

/**
 * The stretches of the segment a-b that no opening sits on (clearance.js: an entrance or door on the walkable area's
 * edge is a way through it, not an edge), as [x1, y1, x2, y2].
 */
function piecesOutsideOpenings(ax, ay, bx, by, openingLines) {
  return wallPieces(ax, ay, bx, by, gapsOnEdge(ax, ay, bx, by, openingLines), {}).map((w) => [
    w.x1,
    w.y1,
    w.x2,
    w.y2,
  ]);
}

module.exports = { buildLevelWalls, piecesOutsideOpenings, OPENING_ON_EDGE_TOLERANCE_M };
