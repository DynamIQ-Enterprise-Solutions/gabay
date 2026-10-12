// Clearance (spec/P0-03.md r2 AC-30: "worked out from the walkable area's geometry"; as ruled 2026-10-12 on the A1
// review, Q5 "follow the spec"): an edge's clearance is twice its shortest distance to an edge of the walkable area.
// Those edges are
//   - the walls (D4: non-walkable unit outlines away from their doors, blocking floor objects), and
//   - the walkable area's own outline where it meets undrawn floor or a BLOCK_AREA.
// A door's gap or any opening on the outline is a way through, not an edge, and so is the outline beside a store
// (its walls already count). Levels of one ElevationM are one floor (ruled D6): where they meet is not an edge, and
// each edge's clearance is measured against the edges of every level of its height.
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');
const { piecesOutsideOpenings } = require('./walls');
const { BUCKET_CELL_M, SAME_SPLIT } = require('./walkable');

/** Clearance looks for an edge up to this far away; anything wider is reported as twice this (metres). */
const CLEARANCE_SEARCH_M = 10;
/** How far either side of an outline the walkable area is tested (metres; drawings are to the millimetre). */
const SIDE_STEP_M = 1e-6;

/**
 * The stretches of one level's walkable-unit and BLOCK_AREA outlines that bound the walkable area of its height:
 * walkable on one side only, the other side not a store's floor, and no opening on them.
 * @param {object} level  { area (walkable.js), units, openings, corrections } of this level
 * @param {(x: number, y: number) => boolean} walkableAtHeight  walkable on any level of this height
 */
function outlinePieces(level, walkableAtHeight) {
  const candidates = [
    ...level.units.filter((u) => u.isWalkable && u.area).flatMap((u) => planar.areaEdges(u.area)),
    ...level.corrections.filter((c) => c.area).flatMap((c) => planar.areaEdges(c.area)),
  ];
  const openings = level.openings.filter((o) => o.line).map((o) => o.line);
  const pieces = [];
  for (const [ax, ay, bx, by] of candidates) {
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const nx = (-(by - ay) / len) * SIDE_STEP_M;
    const ny = ((bx - ax) / len) * SIDE_STEP_M;
    const ts = [0, 1];
    level.area.splitParams(ax, ay, bx, by, ts);
    ts.sort((p, q) => p - q);
    for (let k = 1; k < ts.length; k += 1) {
      const [t0, t1] = [ts[k - 1], ts[k]];
      if (t1 - t0 <= SAME_SPLIT) continue;
      const mx = ax + ((t0 + t1) / 2) * (bx - ax);
      const my = ay + ((t0 + t1) / 2) * (by - ay);
      const left = walkableAtHeight(mx + nx, my + ny);
      const right = walkableAtHeight(mx - nx, my - ny);
      if (left === right) continue;
      const [ox, oy] = left ? [mx - nx, my - ny] : [mx + nx, my + ny];
      if (level.area.inNonWalkableUnit(ox, oy)) continue; // beside a store: its walls count, its doors are ways in
      const p0 = [ax + t0 * (bx - ax), ay + t0 * (by - ay)];
      const p1 = [ax + t1 * (bx - ax), ay + t1 * (by - ay)];
      pieces.push(...piecesOutsideOpenings(p0[0], p0[1], p1[0], p1[1], openings));
    }
  }
  return pieces;
}

/**
 * One clearance measure per height: every level of that height shares it.
 * @param {object[]} levels  the levels of one ElevationM, each { area, units, openings, corrections }
 * @returns {{ distance: (ax: number, ay: number, bx: number, by: number) => number }}
 */
function createClearance(levels) {
  const walkableAtHeight = (x, y) => levels.some((l) => l.area.pointWalkable(x, y));
  const segments = [
    ...levels.flatMap((l) => l.area.walls.map((w) => [w.x1, w.y1, w.x2, w.y2])),
    ...levels.flatMap((l) => outlinePieces(l, walkableAtHeight)),
  ];
  const index = createBucketIndex(BUCKET_CELL_M);
  segments.forEach(([x1, y1, x2, y2], i) =>
    index.insert(i, Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)),
  );

  /** The shortest distance from a-b to an edge of the walkable area, up to CLEARANCE_SEARCH_M. */
  function distance(ax, ay, bx, by) {
    let reach = 1;
    let best = Infinity;
    for (;;) {
      index.query(
        Math.min(ax, bx) - reach,
        Math.min(ay, by) - reach,
        Math.max(ax, bx) + reach,
        Math.max(ay, by) + reach,
        (i) => {
          const [cx, cy, dx, dy] = segments[i];
          const d = planar.segmentDistance(ax, ay, bx, by, cx, cy, dx, dy);
          if (d < best) best = d;
          return false;
        },
      );
      if (best <= reach || reach >= CLEARANCE_SEARCH_M) break;
      reach = Math.min(reach * 2, CLEARANCE_SEARCH_M);
    }
    return Math.min(best, CLEARANCE_SEARCH_M);
  }

  return { distance };
}

module.exports = { createClearance, CLEARANCE_SEARCH_M };
