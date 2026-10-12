// AC-22 (ruled D8; EC-6, EC-30): each level with no active beacon gets the warning "No beacons on this level". A
// warning never refuses a publish. PRD §6.3's coverage-gap and near-collinear warnings are not built until Spike 1's
// figures exist (D8, recorded under G4); no other beacon warning is raised.
'use strict';

const { codesOf } = require('../../../config/closedSets');

const WARNING = codesOf('PublishWarningKind');

function checkNoBeacons(venue, issues) {
  const withBeacon = new Set(venue.beacons.filter((b) => b.isActive).map((b) => b.levelId));
  const levels = [...venue.levels].sort((a, b) => a.ordinal - b.ordinal || a.id - b.id);
  for (const level of levels) {
    if (!withBeacon.has(level.id))
      issues.warning(WARNING.NO_BEACONS_ON_LEVEL, { levelId: level.id });
  }
}

module.exports = { checkNoBeacons };
