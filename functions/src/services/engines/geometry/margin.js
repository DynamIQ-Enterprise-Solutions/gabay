// Where a segment meets a blocker grown by the body margin (spec/P0-03.md r4 AC-91; plan/FF-3-prime-A1.md 1.0 DC-A1:
// "grown by the margin" is an exact distance test, with no offset polygon). The set of points within r of a segment
// c-d is a capsule: two discs of radius r at c and d and the band r either side of c-d between them. Along a
// straight line the capsule's boundary lies where the line meets one of those discs or one of the band's two
// sides, so these are the only places a segment can enter or leave the grown blocker. walkable.js splits a segment
// at them and tests each piece once (A1's exact split-and-test, kept). No geometry library (DC-P4).
'use strict';

const { EPS } = require('./planar');

/** Appends to `out` every t in (0, 1) where a + t (b - a) is exactly r from the point c. */
function circleParams(ax, ay, bx, by, cx, cy, r, out) {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return;
  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  if (t1 > 0 && t1 < 1) out.push(t1);
  if (t2 > 0 && t2 < 1 && t2 !== t1) out.push(t2);
}

/** Appends to `out` every t in (0, 1) where a + t (b - a) is exactly r from the segment c-d (the capsule's edge). */
function capsuleParams(ax, ay, bx, by, cx, cy, dx, dy, r, out) {
  circleParams(ax, ay, bx, by, cx, cy, r, out);
  circleParams(ax, ay, bx, by, dx, dy, r, out);
  const ex = dx - cx;
  const ey = dy - cy;
  const length = Math.hypot(ex, ey);
  if (length === 0) return;
  const ux = ex / length;
  const uy = ey / length;
  // The band's sides: n . (p - c) = +r or -r, where n is c-d's unit normal, met where the foot of p lies on c-d.
  const nx = -uy;
  const ny = ux;
  const sx = bx - ax;
  const sy = by - ay;
  const across = nx * sx + ny * sy;
  if (across === 0) return; // parallel to c-d: only the discs can bound it
  const start = nx * (ax - cx) + ny * (ay - cy);
  for (const side of [r, -r]) {
    const t = (side - start) / across;
    if (!(t > 0 && t < 1)) continue;
    const along = ux * (ax + t * sx - cx) + uy * (ay + t * sy - cy);
    if (along >= -EPS && along <= length + EPS) out.push(t);
  }
}

module.exports = { circleParams, capsuleParams };
