// Shape reading for the publish engine (spec/P0-03.md r2 AC-18, DC-4; EC-21): GeoJSON from the draft becomes
// numbers in the venue frame, or a fault naming why it cannot be read. The fault codes are internal to the engine
// (the problem itself is SHAPE_UNREADABLE, "This shape can't be read", AC-18); tests read them to tell the cases
// apart.
'use strict';

const { EPS, segmentsCross, ringArea2, pointInRing } = require('./planar');

const FAULT = Object.freeze({
  WRONG_TYPE: 'WRONG_TYPE',
  NOT_A_NUMBER: 'NOT_A_NUMBER',
  UNCLOSED_RING: 'UNCLOSED_RING',
  TOO_FEW_POINTS: 'TOO_FEW_POINTS',
  SELF_INTERSECTING: 'SELF_INTERSECTING',
  NO_AREA: 'NO_AREA',
  HOLE_OUTSIDE: 'HOLE_OUTSIDE',
});

const isPosition = (p) => Array.isArray(p) && p.length >= 2;
const isNumberPosition = (p) =>
  typeof p[0] === 'number' &&
  typeof p[1] === 'number' &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]);
const samePoint = (a, b) => Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;

/** Points without consecutive repeats (and, for a ring, without the closing repeat). */
function dedupe(points) {
  const out = [];
  for (const p of points)
    if (!out.length || !samePoint(out[out.length - 1], p)) out.push([p[0], p[1]]);
  return out;
}

const distinctCount = (points) => new Set(points.map((p) => `${p[0]},${p[1]}`)).size;

/** True when two edges of the ring that are not neighbours pass through each other. */
function ringSelfCrosses(ring) {
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // neighbours through the closing edge
      const c = ring[j];
      const d = ring[(j + 1) % n];
      if (segmentsCross(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) return true;
    }
  }
  return false;
}

function ringsCross(r1, r2) {
  for (let i = 0; i < r1.length; i += 1) {
    const a = r1[i];
    const b = r1[(i + 1) % r1.length];
    for (let j = 0; j < r2.length; j += 1) {
      const c = r2[j];
      const d = r2[(j + 1) % r2.length];
      if (segmentsCross(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1])) return true;
    }
  }
  return false;
}

/** One GeoJSON polygon's coordinates -> { polygon } or { fault }. */
function readPolygonCoordinates(rings) {
  if (!Array.isArray(rings) || rings.length === 0) return { fault: FAULT.WRONG_TYPE };
  for (const ring of rings) {
    if (!Array.isArray(ring) || !ring.every(isPosition)) return { fault: FAULT.WRONG_TYPE };
    if (!ring.every(isNumberPosition)) return { fault: FAULT.NOT_A_NUMBER };
  }
  const polygon = [];
  for (const ring of rings) {
    if (ring.length < 2 || !samePoint(ring[0], ring[ring.length - 1]))
      return { fault: FAULT.UNCLOSED_RING };
    const open = dedupe(ring.slice(0, -1));
    if (open.length > 1 && samePoint(open[0], open[open.length - 1])) open.pop();
    if (distinctCount(open) < 3) return { fault: FAULT.TOO_FEW_POINTS };
    polygon.push(open);
  }
  for (let i = 0; i < polygon.length; i += 1) {
    if (ringSelfCrosses(polygon[i])) return { fault: FAULT.SELF_INTERSECTING };
    for (let j = i + 1; j < polygon.length; j += 1) {
      if (ringsCross(polygon[i], polygon[j])) return { fault: FAULT.SELF_INTERSECTING };
    }
  }
  for (const ring of polygon) if (Math.abs(ringArea2(ring)) < EPS) return { fault: FAULT.NO_AREA };
  for (let h = 1; h < polygon.length; h += 1) {
    if (pointInRing(polygon[h][0][0], polygon[h][0][1], polygon[0]) === 'outside') {
      return { fault: FAULT.HOLE_OUTSIDE };
    }
  }
  return { polygon };
}

/** A GeoJSON Polygon or MultiPolygon -> { polygons } (an area) or { fault }. */
function readArea(geo) {
  if (!geo || typeof geo !== 'object') return { fault: FAULT.WRONG_TYPE };
  let list;
  if (geo.type === 'Polygon') list = [geo.coordinates];
  else if (geo.type === 'MultiPolygon') list = geo.coordinates;
  else return { fault: FAULT.WRONG_TYPE };
  if (!Array.isArray(list) || list.length === 0) return { fault: FAULT.WRONG_TYPE };
  const polygons = [];
  for (const coordinates of list) {
    const read = readPolygonCoordinates(coordinates);
    if (read.fault) return { fault: read.fault };
    polygons.push(read.polygon);
  }
  return { polygons };
}

/** A GeoJSON LineString -> { points } (at least two distinct points) or { fault }. */
function readLine(geo) {
  if (!geo || typeof geo !== 'object' || geo.type !== 'LineString')
    return { fault: FAULT.WRONG_TYPE };
  const coordinates = geo.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.every(isPosition))
    return { fault: FAULT.WRONG_TYPE };
  if (!coordinates.every(isNumberPosition)) return { fault: FAULT.NOT_A_NUMBER };
  const points = dedupe(coordinates);
  if (distinctCount(points) < 2) return { fault: FAULT.TOO_FEW_POINTS };
  return { points };
}

/**
 * A box's outline as a polygon (one ring): centre (cx, cy), width along its own x, depth along its own y, turned by
 * rotationDeg with the standard rotation matrix in the venue frame (the seed's convention, db/seeds/lib/geo.js).
 */
function boxPolygon(cx, cy, width, depth, rotationDeg) {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corner = (u, v) => [cx + u * cos - v * sin, cy + u * sin + v * cos];
  const hw = width / 2;
  const hd = depth / 2;
  return [[corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)]];
}

module.exports = { FAULT, readArea, readLine, boxPolygon };
