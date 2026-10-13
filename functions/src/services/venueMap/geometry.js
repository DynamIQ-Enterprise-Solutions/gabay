// Geometry for the validator (spec/OA-1.md r1 AC-6, AC-8, AC-16, DC-16, EC-27). Every value it sees is already
// rounded to the millimetre, so each test runs on whole millimetres: exact, where metres in binary floating point are
// not (0.7 + 0.1 is 0.7999999999999999). Polygons are one ring, stored open; self-crossing is not checked here
// (FF-3 prime flags it, EC-27).
'use strict';

const MM_PER_M = 1000;

/** Metres (3 decimals) as whole millimetres. */
const toMm = (metres) => Math.round(metres * MM_PER_M);

/** A level's rectangle in millimetres: { x0, z0, x1, z1 }, edges included. */
function rectangleMm(origin, size) {
  const x0 = toMm(origin[0]);
  const z0 = toMm(origin[1]);
  return { x0, z0, x1: x0 + toMm(size[0]), z1: z0 + toMm(size[1]) };
}

const xInside = (x, rect) => toMm(x) >= rect.x0 && toMm(x) <= rect.x1;
const zInside = (z, rect) => toMm(z) >= rect.z0 && toMm(z) <= rect.z1;
const pointInside = (point, rect) => xInside(point[0], rect) && zInside(point[1], rect);

/** "x 10 to 110, z 10 to 90": a rectangle in words, in metres. */
const describeRectangle = (rect) =>
  `x ${rect.x0 / MM_PER_M} to ${rect.x1 / MM_PER_M}, z ${rect.z0 / MM_PER_M} to ${rect.z1 / MM_PER_M}`;

const samePoint = (a, b) => toMm(a[0]) === toMm(b[0]) && toMm(a[1]) === toMm(b[1]);

/** The ring stored open: a last point that repeats the first is dropped (EC-27). */
function openRing(points) {
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) {
    return points.slice(0, -1);
  }
  return points;
}

/** How many different points the list holds. */
function distinctCount(points) {
  return new Set(points.map((p) => `${toMm(p[0])},${toMm(p[1])}`)).size;
}

/** Twice the ring's area, in square millimetres (the shoelace formula on whole millimetres: exact). */
function twiceAreaMm2(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += toMm(a[0]) * toMm(b[1]) - toMm(b[0]) * toMm(a[1]);
  }
  return Math.abs(sum);
}

/** A segment's squared length, in square millimetres (exact). */
function squaredLengthMm2(a, b) {
  const dx = toMm(b[0]) - toMm(a[0]);
  const dz = toMm(b[1]) - toMm(a[1]);
  return dx * dx + dz * dz;
}

/** A line's total length, in millimetres. */
function lineLengthMm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1)
    total += Math.sqrt(squaredLengthMm2(points[i - 1], points[i]));
  return total;
}

/** Square metres for a message, from twice the area in square millimetres. */
const areaM2 = (twiceArea) => twiceArea / 2 / (MM_PER_M * MM_PER_M);

module.exports = {
  MM_PER_M,
  toMm,
  rectangleMm,
  xInside,
  zInside,
  pointInside,
  describeRectangle,
  openRing,
  distinctCount,
  twiceAreaMm2,
  squaredLengthMm2,
  lineLengthMm,
  areaM2,
};
