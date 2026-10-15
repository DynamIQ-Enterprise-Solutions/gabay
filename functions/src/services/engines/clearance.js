// Clearance (spec/P0-03.md AC-30, kept in r4; as ruled 2026-10-12 on the A1 review, Q5 "follow the spec"): an
// edge's clearance is twice its shortest distance to an edge of the floor as drawn, and an edge through a door
// carries no more than the door's measured clear width (`clearW`). The floor's edges are physical, not grown by the
// body margin, so a 1 m corridor still reads 1 m (the ruling's own example); the margin only keeps nodes off them.
// For one elevation (levels of one elevation are one floor, ruled D6) they are:
//   - every wall segment (AC-94: walls split at their doors, as the rectangle of their thickness; non-walkable unit
//     outlines split at their doors), so a doorway is a way through, not an edge;
//   - every blocking item's outline (a box or a circle);
//   - on the outdoor level, each building's footprint, split at the doors that sit on it (an entrance is a way in);
//   - every BLOCK_AREA's outline;
//   - each level's rectangle, where no other level of that elevation has floor beyond it, split at the doors that
//     sit on it (A1's "an entrance on the walkable area's edge is a gap in it").
// Clearance is searched up to CLEARANCE_SEARCH_M, so the figure is at most twice that (A1's, kept).
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');
const { edgeBesideDoors } = require('./walls');
const { BUCKET_CELL_M, SAME_SPLIT, wallRectangle } = require('./walkable');

/** Clearance looks for an edge up to this far away; anything wider is reported as twice this (metres). A1's. */
const CLEARANCE_SEARCH_M = 10;
/** How far beyond a level's rectangle its neighbour's floor is looked for (metres; drawings are to the mm). A1's. */
const SIDE_STEP_M = 1e-6;

const edgesOf = (ring) => ring.map((p, i) => [...p, ...ring[(i + 1) % ring.length]]);

/** A wall segment as its physical outline: a wall piece's rectangle, or an outline edge itself. */
function wallSegmentEdges(segment) {
  if (segment.halfT === 0) return [[segment.x1, segment.z1, segment.x2, segment.z2]];
  const length = Math.hypot(segment.x2 - segment.x1, segment.z2 - segment.z1);
  const piece = {
    a: [segment.x1, segment.z1],
    b: [segment.x2, segment.z2],
    t: segment.halfT * 2,
    ux: (segment.x2 - segment.x1) / length,
    uz: (segment.z2 - segment.z1) / length,
  };
  return edgesOf(wallRectangle(piece));
}

/** The stretches of a level's rectangle with no floor of another level of its elevation beyond them. */
function rectangleEdges(area, others) {
  const { x0, z0, x1, z1 } = area.rect;
  const sides = [
    [x0, z0, x1, z0, 0, -1],
    [x1, z0, x1, z1, 1, 0],
    [x1, z1, x0, z1, 0, 1],
    [x0, z1, x0, z0, -1, 0],
  ];
  const out = [];
  for (const [ax, az, bx, bz, nx, nz] of sides) {
    if (others.length === 0) {
      out.push([ax, az, bx, bz]);
      continue;
    }
    const ts = [0, 1];
    for (const other of others) {
      other.splitParams(ax, az, bx, bz, ts, 0);
      const r = other.rect;
      for (const [cx, cz, dx, dz] of edgesOf([
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ])) {
        planar.meetParams(ax, az, bx, bz, cx, cz, dx, dz, ts);
      }
    }
    ts.sort((p, q) => p - q);
    for (let k = 1; k < ts.length; k += 1) {
      const [t0, t1] = [ts[k - 1], ts[k]];
      if (t1 - t0 <= SAME_SPLIT) continue;
      const mx = ax + ((t0 + t1) / 2) * (bx - ax) + nx * SIDE_STEP_M;
      const mz = az + ((t0 + t1) / 2) * (bz - az) + nz * SIDE_STEP_M;
      if (others.some((o) => o.floorAt(mx, mz))) continue;
      out.push([
        ax + t0 * (bx - ax),
        az + t0 * (bz - az),
        ax + t1 * (bx - ax),
        az + t1 * (bz - az),
      ]);
    }
  }
  return out;
}

/**
 * One clearance measure for the levels of one elevation.
 * @param {object[]} areas  walkable.js's areas of those levels
 * @param {object[]} buildings  layout.js's buildings (their footprints bound the outdoor level)
 * @returns {{ clearance: (ax, az, bx, bz) => number }}  twice the distance to the nearest edge, at most twice
 *   CLEARANCE_SEARCH_M, and no more than the clear width of any measured door the segment passes through
 */
function createClearance(areas, buildings) {
  const doors = areas.flatMap((a) => a.level.openings.filter((o) => o.isDoor));
  const segments = [];
  const circles = [];
  for (const area of areas) {
    for (const s of area.wallSegments) segments.push(...wallSegmentEdges(s));
    for (const shape of area.blockers) {
      const kind = shape.source.kind;
      if (kind === 'item' && shape.type === 'circle') circles.push(shape);
      else if (kind === 'item') segments.push(...shape.edges);
    }
    if (area.level.outdoor) {
      for (const { footprint } of buildings) {
        if (!footprint) continue;
        for (const [ax, az, bx, bz] of edgesOf(footprint)) {
          for (const s of edgeBesideDoors(ax, az, bx, bz, doors, {})) {
            segments.push([s.x1, s.z1, s.x2, s.z2]);
          }
        }
      }
    }
    for (const shape of area.blockAreas) segments.push(...shape.edges);
    for (const [ax, az, bx, bz] of rectangleEdges(
      area,
      areas.filter((o) => o !== area),
    )) {
      for (const s of edgeBesideDoors(ax, az, bx, bz, doors, {})) {
        segments.push([s.x1, s.z1, s.x2, s.z2]);
      }
    }
  }
  const index = createBucketIndex(BUCKET_CELL_M);
  segments.forEach(([ax, az, bx, bz], i) =>
    index.insert(i, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)),
  );
  const circleIndex = createBucketIndex(BUCKET_CELL_M);
  circles.forEach((c, i) => circleIndex.insert(i, c.minX, c.minZ, c.maxX, c.maxZ));
  const gaps = doors.filter((o) => o.clearW !== null);
  const gapIndex = createBucketIndex(BUCKET_CELL_M);
  gaps.forEach(({ gap: [[px, pz], [qx, qz]] }, i) =>
    gapIndex.insert(i, Math.min(px, qx), Math.min(pz, qz), Math.max(px, qx), Math.max(pz, qz)),
  );

  /** The shortest distance from a-b to an edge within `reach` of it, or `reach` when none is nearer. */
  function nearest(ax, az, bx, bz, reach) {
    let best = reach;
    const box = [
      Math.min(ax, bx) - reach,
      Math.min(az, bz) - reach,
      Math.max(ax, bx) + reach,
      Math.max(az, bz) + reach,
    ];
    index.query(...box, (i) => {
      const [cx, cz, dx, dz] = segments[i];
      const d = planar.segmentDistance(ax, az, bx, bz, cx, cz, dx, dz);
      if (d < best) best = d;
      return false;
    });
    circleIndex.query(...box, (i) => {
      const c = circles[i];
      const d = Math.max(0, planar.pointSegmentDistance(c.cx, c.cz, ax, az, bx, bz) - c.r);
      if (d < best) best = d;
      return false;
    });
    return best;
  }

  /** The distance from (x, z) to the nearest edge, up to CLEARANCE_SEARCH_M (searched outward, 1 m first). */
  function pointDistance(x, z) {
    let reach = 1;
    for (;;) {
      const best = nearest(x, z, x, z, reach);
      if (best < reach || reach >= CLEARANCE_SEARCH_M) return best;
      reach = Math.min(reach * 2, CLEARANCE_SEARCH_M);
    }
  }

  /**
   * The clearance of the edge a-b (AC-30). `bound` is an upper bound on its distance to an edge, such as the smaller
   * of its ends' pointDistance (each end is on the edge, so the nearest edge is no farther than that): one search
   * of that reach is exact.
   */
  function clearance(ax, az, bx, bz, bound = CLEARANCE_SEARCH_M) {
    let width = 2 * nearest(ax, az, bx, bz, Math.min(bound, CLEARANCE_SEARCH_M));
    const E = planar.EPS;
    gapIndex.query(
      Math.min(ax, bx) - E,
      Math.min(az, bz) - E,
      Math.max(ax, bx) + E,
      Math.max(az, bz) + E,
      (i) => {
        const [[px, pz], [qx, qz]] = gaps[i].gap;
        if (planar.segmentsMeet(ax, az, bx, bz, px, pz, qx, qz)) {
          width = Math.min(width, gaps[i].clearW);
        }
        return false;
      },
    );
    return width;
  }

  return { clearance, pointDistance };
}

module.exports = { createClearance, CLEARANCE_SEARCH_M };
