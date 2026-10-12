// AC-18 (DC-4; EC-21): every element's shape is read once into numbers. One that cannot be read is listed as
// "This shape can't be read" with the element named, and refuses the publish; the rest of the engine then leaves it
// out (it has no `area` or `line`). The venue's own boundary is read here too: a zero-size boundary (P0-01 AC-34,
// a venue with no level) is a shape with fewer than three distinct points.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { readArea, readLine, boxPolygon, FAULT } = require('../geometry/shapes');
const { ref, at, unitPoint } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');
const CORRECTION = codesOf('NavCorrectionKind');
const SHAPE = codesOf('ShapeKind');

/** A floor object's outline: its GeoJSON when stored, else its box (centre, width, depth, rotation). */
function floorObjectArea(object) {
  if (object.geometry) return readArea(object.geometry);
  if (object.shapeKind === SHAPE.BOX && object.widthM > 0 && object.depthM > 0) {
    return {
      polygons: [
        boxPolygon(
          object.centerX,
          object.centerY,
          object.widthM,
          object.depthM,
          object.rotationDeg,
        ),
      ],
    };
  }
  return { fault: FAULT.NO_AREA };
}

function correctionShape(correction) {
  if (correction.kind === CORRECTION.BLOCK_AREA) {
    const read = readArea(correction.geometry);
    return { area: read.polygons ?? null, fault: read.fault };
  }
  if (correction.kind === CORRECTION.ADD_PATH || correction.kind === CORRECTION.REMOVE_PATH) {
    const read = readLine(correction.geometry);
    return { line: read.points ?? null, fault: read.fault };
  }
  return { fault: FAULT.WRONG_TYPE };
}

/** Reads every shape onto its row (`area` or `line`, null when unreadable) and reports the unreadable ones. */
function readShapes(venue, issues) {
  const unreadable = (element, levelId, point) =>
    issues.problem(PROBLEM.SHAPE_UNREADABLE, { element, levelId, at: point });

  const boundary = readArea(venue.venue.boundary);
  venue.boundaryArea = boundary.polygons ?? null;
  if (boundary.fault) unreadable(ref('Venue', venue.venue), null, null);

  for (const unit of venue.units) {
    const read = readArea(unit.geometry);
    unit.area = read.polygons ?? null;
    if (read.fault) unreadable(ref('Unit', unit), unit.levelId, unitPoint(unit));
  }
  for (const opening of venue.openings) {
    const read = readLine(opening.geometry);
    opening.line = read.points ?? null;
    if (read.fault) unreadable(ref('Opening', opening), opening.levelId, null);
  }
  for (const object of venue.floorObjects) {
    const read = floorObjectArea(object);
    object.area = read.polygons ?? null;
    if (read.fault)
      unreadable(
        ref('FloorObject', object, null),
        object.levelId,
        at(object.centerX, object.centerY),
      );
  }
  for (const correction of venue.corrections) {
    const shape = correctionShape(correction);
    correction.area = shape.area ?? null;
    correction.line = shape.line ?? null;
    if (shape.fault) unreadable(ref('NavCorrection', correction, null), correction.levelId, null);
  }
}

module.exports = { readShapes };
