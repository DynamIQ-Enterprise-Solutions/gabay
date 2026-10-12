// AC-11 (L108): publish is refused while any Unit, Opening, FloorObject or NavConnector of the venue still needs
// review (generated from an uploaded plan and not yet confirmed). Each is listed with its kind, name and level, and
// shown on the map.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { ref, at, unitPoint, openingPoint } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');

function checkReviewGate(venue, issues) {
  const unreviewed = (element, levelId, point) =>
    issues.problem(PROBLEM.UNREVIEWED, { element, levelId, at: point });
  for (const u of venue.units)
    if (u.needsReview) unreviewed(ref('Unit', u), u.levelId, unitPoint(u));
  for (const o of venue.openings)
    if (o.needsReview) unreviewed(ref('Opening', o), o.levelId, openingPoint(o));
  for (const f of venue.floorObjects) {
    if (f.needsReview) unreviewed(ref('FloorObject', f, null), f.levelId, at(f.centerX, f.centerY));
  }
  for (const c of venue.connectors) {
    if (c.needsReview) unreviewed(ref('NavConnector', c), c.fromLevelId, at(c.fromX, c.fromY));
  }
}

module.exports = { checkReviewGate };
