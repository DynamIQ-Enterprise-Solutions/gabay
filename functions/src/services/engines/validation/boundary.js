// AC-16 (invariant 10; DC-12): publish is refused if any element is outside the venue boundary, each shown. A point
// or a shape on the boundary line counts as inside (L30 puts transit points "at its edge"). Inactive beacons are left
// out of the checks (EC-30). A boundary that cannot be read is AC-18's, and nothing is measured against it.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const planar = require('../geometry/planar');
const { ref, at, unitPoint, openingPoint, correctionPoint } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');

function checkBoundary(venue, issues) {
  const boundary = venue.boundaryArea;
  if (!boundary) return;
  const edges = planar.areaEdges(boundary);
  const pointInside = (x, y) => planar.pointInArea(x, y, boundary) !== 'outside';
  const crossesBoundary = (ax, ay, bx, by) =>
    edges.some(([cx, cy, dx, dy]) => planar.segmentsCross(ax, ay, bx, by, cx, cy, dx, dy));
  const lineInside = (points) =>
    points.every(([x, y]) => pointInside(x, y)) &&
    points.every(
      (p, i) => i === 0 || !crossesBoundary(points[i - 1][0], points[i - 1][1], p[0], p[1]),
    );
  const holes = boundary.flatMap((polygon) => polygon.slice(1));
  const areaInside = (area) =>
    area.every((polygon) => polygon.every((ring) => lineInside([...ring, ring[0]]))) &&
    !holes.some((hole) => planar.pointInArea(hole[0][0], hole[0][1], area) === 'inside');
  const outside = (element, levelId, point) =>
    issues.problem(PROBLEM.OUTSIDE_BOUNDARY, { element, levelId, at: point });

  for (const u of venue.units) {
    if (u.area && !areaInside(u.area)) outside(ref('Unit', u), u.levelId, unitPoint(u));
  }
  for (const o of venue.openings) {
    if (o.line && !lineInside(o.line)) outside(ref('Opening', o), o.levelId, openingPoint(o));
  }
  for (const f of venue.floorObjects) {
    if (f.area && !areaInside(f.area))
      outside(ref('FloorObject', f, null), f.levelId, at(f.centerX, f.centerY));
  }
  for (const [table, rows] of [
    ['Amenity', venue.amenities],
    ['TransitPoint', venue.transitPoints],
    ['Anchor', venue.anchors],
  ]) {
    for (const r of rows)
      if (!pointInside(r.x, r.y)) outside(ref(table, r), r.levelId, at(r.x, r.y));
  }
  const venueLevels = new Set(venue.levels.map((l) => l.id));
  const stopsOf = new Map();
  for (const s of venue.connectorStops) {
    if (!stopsOf.has(s.connectorId)) stopsOf.set(s.connectorId, []);
    stopsOf.get(s.connectorId).push(s);
  }
  for (const c of venue.connectors) {
    const stops = stopsOf.get(c.id) ?? [];
    if (stops.length) {
      for (const s of stops) {
        if (!pointInside(s.x, s.y)) {
          outside({ table: 'NavConnectorStop', id: s.id, name: c.name }, s.levelId, at(s.x, s.y));
        }
      }
      continue;
    }
    const ends = [[c.fromLevelId, c.fromX, c.fromY]];
    // A To end on another venue's level is AC-15(a)'s fault, and not in this venue's frame to measure.
    if (c.toLevelId !== null && c.toX !== null && c.toY !== null && venueLevels.has(c.toLevelId))
      ends.push([c.toLevelId, c.toX, c.toY]);
    const out = ends.find(([, x, y]) => !pointInside(x, y));
    if (out) outside(ref('NavConnector', c), out[0], at(out[1], out[2]));
  }
  for (const b of venue.beacons) {
    if (b.isActive && !pointInside(b.x, b.y))
      outside(ref('Beacon', b, null), b.levelId, at(b.x, b.y));
  }
  for (const c of venue.corrections) {
    const inside = c.line ? lineInside(c.line) : c.area ? areaInside(c.area) : true;
    if (!inside) outside(ref('NavCorrection', c, null), c.levelId, correctionPoint(c));
  }
}

module.exports = { checkBoundary };
