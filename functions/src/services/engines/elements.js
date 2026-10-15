// How a problem names an element and where it shows it (spec/P0-03.md r2 DC-11: every problem carries an element
// reference and/or a location, so the screen can show it on the map). Tables are the schema's own names.
'use strict';

const { ringCentroid, polylineMidpoint } = require('./geometry/planar');

/** { table, id, name } for an issue's element. */
const ref = (table, row, name = row.name ?? null) => ({ table, id: row.id, name });

const at = (x, y) => ({ x, y });
const atPoint = (p) => (p ? at(p[0], p[1]) : null);

/** A unit's representative point: its outline's centroid, else its box centre, else nothing. */
function unitPoint(unit) {
  if (unit.area) return atPoint(ringCentroid(unit.area[0][0]));
  if (unit.centerX !== null && unit.centerY !== null) return at(unit.centerX, unit.centerY);
  return null;
}

/** An opening's representative point: the middle of its gap. */
const openingPoint = (opening) => (opening.line ? atPoint(polylineMidpoint(opening.line)) : null);

/** A correction's representative point: the start of its line, or its area's centroid. */
function correctionPoint(correction) {
  if (correction.line) return atPoint(correction.line[0]);
  if (correction.area) return atPoint(ringCentroid(correction.area[0][0]));
  return null;
}

module.exports = { ref, at, atPoint, unitPoint, openingPoint, correctionPoint };
