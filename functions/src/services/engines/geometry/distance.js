// Squared distances for the engine's hot loops (the walkable test's margin and the clearance search): the same
// measures as planar.js's pointSegmentDistance and segmentDistance, without a square root or Math.hypot per call,
// so a caller compares against a squared limit and takes one root at the end. No geometry library (DC-P4).
'use strict';

/** The squared distance from p to the segment a-b. */
function pointSegmentDistanceSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/**
 * The squared distance between the segments a-b and c-d: 0 when they pass through each other, else the least of
 * each end's distance to the other segment (where they touch, that end's distance is 0).
 */
function segmentDistanceSq(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(ax, ay, bx, by, cx, cy);
  const d2 = cross(ax, ay, bx, by, dx, dy);
  const d3 = cross(cx, cy, dx, dy, ax, ay);
  const d4 = cross(cx, cy, dx, dy, bx, by);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return 0;
  }
  return Math.min(
    pointSegmentDistanceSq(ax, ay, cx, cy, dx, dy),
    pointSegmentDistanceSq(bx, by, cx, cy, dx, dy),
    pointSegmentDistanceSq(cx, cy, ax, ay, bx, by),
    pointSegmentDistanceSq(dx, dy, ax, ay, bx, by),
  );
}

module.exports = { pointSegmentDistanceSq, segmentDistanceSq };
