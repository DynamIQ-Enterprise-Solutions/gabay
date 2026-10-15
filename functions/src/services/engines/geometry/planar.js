// In-house planar geometry for the publish engine (plan/FF-3-publish-engine.md 1.0 §3, DC-P4: no geometry
// library). Everything is in the venue's one frame, in metres (E10). A ring is an array of [x, y] points without
// the closing repeat; a polygon is [outerRing, ...holes]; an area is an array of polygons.
'use strict';

/** Two points closer than this are one point, and a point closer than this to a line is on it (metres). */
const EPS = 1e-9;

const cross = (ax, ay, bx, by) => ax * by - ay * bx;

/** Which side of the line a -> b the point c is on: 1 left, -1 right, 0 on the line (within EPS). */
function side(ax, ay, bx, by, cx, cy) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < EPS) return 0;
  const d = cross(bx - ax, by - ay, cx - ax, cy - ay) / len;
  if (d > EPS) return 1;
  if (d < -EPS) return -1;
  return 0;
}

/** The distance from point p to the segment a-b. */
function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * True when the segments a-b and c-d pass through each other at one point inside both. Touching at an end,
 * ending on the other segment, and running along it (collinear overlap) are not crossings.
 */
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const s1 = side(ax, ay, bx, by, cx, cy);
  const s2 = side(ax, ay, bx, by, dx, dy);
  if (s1 === 0 || s2 === 0 || s1 === s2) return false;
  const s3 = side(cx, cy, dx, dy, ax, ay);
  const s4 = side(cx, cy, dx, dy, bx, by);
  return s3 !== 0 && s4 !== 0 && s3 !== s4;
}

/** True when the closed segments a-b and c-d share at least one point (a touch counts). */
function segmentsMeet(ax, ay, bx, by, cx, cy, dx, dy) {
  const s1 = side(ax, ay, bx, by, cx, cy);
  const s2 = side(ax, ay, bx, by, dx, dy);
  const s3 = side(cx, cy, dx, dy, ax, ay);
  const s4 = side(cx, cy, dx, dy, bx, by);
  if (s1 * s2 < 0 && s3 * s4 < 0) return true;
  return (
    pointSegmentDistance(cx, cy, ax, ay, bx, by) <= EPS ||
    pointSegmentDistance(dx, dy, ax, ay, bx, by) <= EPS ||
    pointSegmentDistance(ax, ay, cx, cy, dx, dy) <= EPS ||
    pointSegmentDistance(bx, by, cx, cy, dx, dy) <= EPS
  );
}

/** The point where the lines through a-b and c-d meet (call it only for segments that cross). */
function crossingPoint(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax;
  const ry = by - ay;
  const t = cross(cx - ax, cy - ay, dx - cx, dy - cy) / cross(rx, ry, dx - cx, dy - cy);
  return [ax + t * rx, ay + t * ry];
}

/**
 * The parameters t in [0, 1] along a-b where the closed segment c-d meets it: one for a crossing or a touch,
 * the two ends of the shared stretch for a collinear overlap. Appends them to `out`.
 */
function meetParams(ax, ay, bx, by, cx, cy, dx, dy, out) {
  const rx = bx - ax;
  const ry = by - ay;
  const len2 = rx * rx + ry * ry;
  if (len2 === 0) return;
  const s1 = side(ax, ay, bx, by, cx, cy);
  const s2 = side(ax, ay, bx, by, dx, dy);
  if (s1 === 0 && s2 === 0) {
    // Collinear: the overlap of [tc, td] with [0, 1].
    const tc = ((cx - ax) * rx + (cy - ay) * ry) / len2;
    const td = ((dx - ax) * rx + (dy - ay) * ry) / len2;
    const lo = Math.max(0, Math.min(tc, td));
    const hi = Math.min(1, Math.max(tc, td));
    if (hi + EPS / Math.sqrt(len2) >= lo) {
      out.push(Math.min(Math.max(lo, 0), 1), Math.min(Math.max(hi, 0), 1));
    }
    return;
  }
  if (s1 === s2) return;
  const s3 = side(cx, cy, dx, dy, ax, ay);
  const s4 = side(cx, cy, dx, dy, bx, by);
  if (s3 !== 0 && s4 !== 0 && s3 === s4) return;
  // They meet: a crossing, or an end of one lying on the other.
  if (s1 === 0) out.push(clamp01(((cx - ax) * rx + (cy - ay) * ry) / len2));
  else if (s2 === 0) out.push(clamp01(((dx - ax) * rx + (dy - ay) * ry) / len2));
  else if (s3 === 0) out.push(0);
  else if (s4 === 0) out.push(1);
  else
    out.push(clamp01(cross(cx - ax, cy - ay, dx - cx, dy - cy) / cross(rx, ry, dx - cx, dy - cy)));
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** The shortest distance between the segments a-b and c-d (0 when they meet). */
function segmentDistance(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segmentsMeet(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    pointSegmentDistance(ax, ay, cx, cy, dx, dy),
    pointSegmentDistance(bx, by, cx, cy, dx, dy),
    pointSegmentDistance(cx, cy, ax, ay, bx, by),
    pointSegmentDistance(dx, dy, ax, ay, bx, by),
  );
}

/** 'inside', 'boundary' (within EPS of an edge) or 'outside' for one ring (even-odd). */
function pointInRing(x, y, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (
      x >= Math.min(xi, xj) - EPS &&
      x <= Math.max(xi, xj) + EPS &&
      y >= Math.min(yi, yj) - EPS &&
      y <= Math.max(yi, yj) + EPS &&
      pointSegmentDistance(x, y, xj, yj, xi, yi) <= EPS
    ) {
      return 'boundary';
    }
    if (yi > y !== yj > y && x < xj + ((y - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

/** 'inside', 'boundary' or 'outside' for a polygon with holes. A point on a hole's edge is on the boundary (DC-12). */
function pointInPolygon(x, y, polygon) {
  const outer = pointInRing(x, y, polygon[0]);
  if (outer !== 'inside') return outer;
  for (let h = 1; h < polygon.length; h += 1) {
    const r = pointInRing(x, y, polygon[h]);
    if (r === 'boundary') return 'boundary';
    if (r === 'inside') return 'outside';
  }
  return 'inside';
}

/** The best answer over several polygons: inside beats boundary beats outside. */
function pointInArea(x, y, area) {
  let best = 'outside';
  for (const polygon of area) {
    const r = pointInPolygon(x, y, polygon);
    if (r === 'inside') return 'inside';
    if (r === 'boundary') best = 'boundary';
  }
  return best;
}

/** Twice the signed area of a ring (positive when counter-clockwise in a y-up frame). */
function ringArea2(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum;
}

/** The centroid of a ring (its first point when it has no area). */
function ringCentroid(ring) {
  const a2 = ringArea2(ring);
  if (Math.abs(a2) < EPS) return [ring[0][0], ring[0][1]];
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  return [cx / (3 * a2), cy / (3 * a2)];
}

/** [minX, minY, maxX, maxY] of a list of points. */
function boundsOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Every edge of an area as [ax, ay, bx, by], ring by ring. */
function areaEdges(area) {
  const edges = [];
  for (const polygon of area) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        edges.push([a[0], a[1], b[0], b[1]]);
      }
    }
  }
  return edges;
}

/** The point half-way along a polyline, by length. */
function polylineMidpoint(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  let left = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len >= left && len > 0) {
      const t = left / len;
      return [ax + t * (bx - ax), ay + t * (by - ay)];
    }
    left -= len;
  }
  return [points[0][0], points[0][1]];
}

module.exports = {
  EPS,
  side,
  pointSegmentDistance,
  segmentsCross,
  segmentsMeet,
  crossingPoint,
  meetParams,
  segmentDistance,
  pointInRing,
  pointInPolygon,
  pointInArea,
  ringArea2,
  ringCentroid,
  boundsOf,
  areaEdges,
  polylineMidpoint,
};
