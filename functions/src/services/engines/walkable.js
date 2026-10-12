// One level's walkable area (spec/P0-03.md r2 AC-24; ruled D4): the walkable units, minus the non-walkable units,
// minus floor objects with BlocksWalk, minus BLOCK_AREA corrections. A non-walkable unit is taken away as its
// inside and its walls, so a door's gap on its outline stays walkable (D4: the gap is not a wall); a blocking object
// and a BLOCK_AREA are taken away edge and all. A point on a walkable unit's own edge is inside it (DC-12).
//
// A segment is walkable when every point on it is. Walkability can only change where the segment meets an outline,
// so the segment is split at those points and each piece is tested at its middle, and each split point itself:
// exact for straight-edged shapes, and no sampling step to tune.
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');

/** Bucket side for one level's indexes, in metres (a node join or walk edge spans a cell or two). */
const BUCKET_CELL_M = 6;
/** Clearance looks for walls up to this far from an edge; anything wider is reported as twice this (metres). */
const CLEARANCE_SEARCH_M = 10;
/** Two split points closer than this along a segment (as a fraction of it) are one point. */
const SAME_SPLIT = 1e-12;

const KIND = Object.freeze({ WALKABLE: 0, OBSTACLE: 1, BLOCKING: 2, BLOCK_AREA: 3 });

function boxOf(area) {
  return planar.boundsOf(area.flatMap((polygon) => polygon[0]));
}

/**
 * @param {{ units: object[], floorObjects: object[], corrections: object[], walls: object[] }} level  this level's
 *   rows, read by validation/shapes.js, and its walls from walls.js.
 */
function createLevelArea({ units, floorObjects, corrections, walls }) {
  const items = [];
  const add = (kind, area, ref) => {
    const [minX, minY, maxX, maxY] = boxOf(area);
    items.push({ kind, area, ref, minX, minY, maxX, maxY });
  };
  for (const u of units)
    if (u.area) add(u.isWalkable ? KIND.WALKABLE : KIND.OBSTACLE, u.area, u.id);
  for (const o of floorObjects) if (o.blocksWalk && o.area) add(KIND.BLOCKING, o.area, o.id);
  for (const c of corrections) if (c.area) add(KIND.BLOCK_AREA, c.area, c.id);

  const shapeIndex = createBucketIndex(BUCKET_CELL_M);
  items.forEach((it, i) => shapeIndex.insert(i, it.minX, it.minY, it.maxX, it.maxY));

  const edges = items.flatMap((it) => planar.areaEdges(it.area));
  const edgeIndex = createBucketIndex(BUCKET_CELL_M);
  edges.forEach(([ax, ay, bx, by], i) =>
    edgeIndex.insert(i, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)),
  );

  const wallIndex = createBucketIndex(BUCKET_CELL_M);
  walls.forEach((w, i) =>
    wallIndex.insert(
      i,
      Math.min(w.x1, w.x2),
      Math.min(w.y1, w.y2),
      Math.max(w.x1, w.x2),
      Math.max(w.y1, w.y2),
    ),
  );

  const E = planar.EPS;

  function onWall(x, y) {
    let hit = false;
    wallIndex.query(x - E, y - E, x + E, y + E, (i) => {
      const w = walls[i];
      if (planar.pointSegmentDistance(x, y, w.x1, w.y1, w.x2, w.y2) <= E) {
        hit = true;
        return true;
      }
      return false;
    });
    return hit;
  }

  /**
   * True when (x, y) is strictly inside a non-walkable unit (other than those in `exceptUnits`), or inside or on a
   * blocking floor object or a BLOCK_AREA.
   */
  function inObstacle(x, y, exceptUnits = null) {
    let blocked = false;
    shapeIndex.query(x - E, y - E, x + E, y + E, (i) => {
      const it = items[i];
      if (it.kind === KIND.WALKABLE) return false;
      if (x < it.minX - E || x > it.maxX + E || y < it.minY - E || y > it.maxY + E) return false;
      if (it.kind === KIND.OBSTACLE && exceptUnits && exceptUnits.has(it.ref)) return false;
      const r = planar.pointInArea(x, y, it.area);
      blocked = it.kind === KIND.OBSTACLE ? r === 'inside' : r !== 'outside';
      return blocked;
    });
    return blocked;
  }

  function pointWalkable(x, y) {
    let walkable = false;
    let blocked = false;
    shapeIndex.query(x - E, y - E, x + E, y + E, (i) => {
      const it = items[i];
      if (x < it.minX - E || x > it.maxX + E || y < it.minY - E || y > it.maxY + E) return false;
      const r = planar.pointInArea(x, y, it.area);
      if (it.kind === KIND.WALKABLE) {
        if (r !== 'outside') walkable = true;
        return false;
      }
      blocked = it.kind === KIND.OBSTACLE ? r === 'inside' : r !== 'outside';
      return blocked;
    });
    return walkable && !blocked && !onWall(x, y);
  }

  /** Appends to `out` every t along a-b where the segment meets one of this level's outlines. */
  function splitParams(ax, ay, bx, by, out) {
    edgeIndex.query(
      Math.min(ax, bx) - E,
      Math.min(ay, by) - E,
      Math.max(ax, bx) + E,
      Math.max(ay, by) + E,
      (i) => {
        const [cx, cy, dx, dy] = edges[i];
        planar.meetParams(ax, ay, bx, by, cx, cy, dx, dy, out);
        return false;
      },
    );
  }

  /** The first point where a-b passes through a wall, by distance from a; null when it passes through none. */
  function crossesWall(ax, ay, bx, by) {
    let best = null;
    wallIndex.query(
      Math.min(ax, bx) - E,
      Math.min(ay, by) - E,
      Math.max(ax, bx) + E,
      Math.max(ay, by) + E,
      (i) => {
        const w = walls[i];
        if (planar.segmentsCross(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) {
          const [x, y] = planar.crossingPoint(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2);
          const d = Math.hypot(x - ax, y - ay);
          if (!best || d < best.distance) best = { x, y, distance: d, wall: w };
        }
        return false;
      },
    );
    return best;
  }

  /** The shortest distance from a-b to a wall, up to CLEARANCE_SEARCH_M. */
  function wallDistance(ax, ay, bx, by) {
    let reach = 1;
    let best = Infinity;
    for (;;) {
      wallIndex.query(
        Math.min(ax, bx) - reach,
        Math.min(ay, by) - reach,
        Math.max(ax, bx) + reach,
        Math.max(ay, by) + reach,
        (i) => {
          const w = walls[i];
          const d = planar.segmentDistance(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2);
          if (d < best) best = d;
          return false;
        },
      );
      if (best <= reach || reach >= CLEARANCE_SEARCH_M) break;
      reach = Math.min(reach * 2, CLEARANCE_SEARCH_M);
    }
    return Math.min(best, CLEARANCE_SEARCH_M);
  }

  return { pointWalkable, onWall, inObstacle, splitParams, crossesWall, wallDistance, walls };
}

/**
 * True when every point of a-b passes `ok`, testing the pieces between the split points `ts` (fractions along a-b,
 * in any order) at their middles, and the split points themselves.
 */
function piecesPass(ax, ay, bx, by, ts, ok) {
  ts.push(0, 1);
  ts.sort((p, q) => p - q);
  let last = -1;
  for (let k = 0; k < ts.length; k += 1) {
    const t = ts[k];
    if (t - last <= SAME_SPLIT) continue;
    if (k > 0 && last >= 0) {
      const m = (last + t) / 2;
      if (!ok(ax + m * (bx - ax), ay + m * (by - ay))) return false;
    }
    if (t > 0 && t < 1 && !ok(ax + t * (bx - ax), ay + t * (by - ay))) return false;
    last = t;
  }
  return true;
}

/** True when the whole segment a-b lies in the level's walkable area (AC-24). */
function segmentWalkable(level, ax, ay, bx, by) {
  if (!level.pointWalkable(ax, ay) || !level.pointWalkable(bx, by)) return false;
  const ts = [];
  level.splitParams(ax, ay, bx, by, ts);
  if (ts.length === 0) return true;
  return piecesPass(ax, ay, bx, by, ts, (x, y) => level.pointWalkable(x, y));
}

/**
 * Same-height joins (ruled D6, AC-28): true when a-b lies in the union of the walkable areas of the given levels
 * and passes through no wall of any of them, nor runs along one (a wall on one level is not stepped over because
 * the other level has floor there).
 */
function segmentWalkableAcross(levels, ax, ay, bx, by) {
  const ok = (x, y) =>
    levels.some((l) => l.pointWalkable(x, y)) && !levels.some((l) => l.onWall(x, y));
  if (!ok(ax, ay) || !ok(bx, by)) return false;
  if (levels.some((l) => l.crossesWall(ax, ay, bx, by))) return false;
  const ts = [];
  for (const l of levels) l.splitParams(ax, ay, bx, by, ts);
  if (ts.length === 0) return true;
  return piecesPass(ax, ay, bx, by, ts, ok);
}

module.exports = {
  createLevelArea,
  segmentWalkable,
  segmentWalkableAcross,
  piecesPass,
  CLEARANCE_SEARCH_M,
};
