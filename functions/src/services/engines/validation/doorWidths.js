// AC-23 (L88; EC-28): each opening whose ClearWidthM is not measured (NULL) is a warning, never a refusal. Its
// edges' clearance comes from the geometry instead (AC-30).
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { ref, openingPoint } = require('../elements');

const WARNING = codesOf('PublishWarningKind');

function checkDoorWidths(venue, issues) {
  for (const o of venue.openings) {
    if (o.clearWidthM !== null) continue;
    issues.warning(WARNING.DOOR_WIDTH_UNMEASURED, {
      element: ref('Opening', o),
      levelId: o.levelId,
      at: openingPoint(o),
    });
  }
}

module.exports = { checkDoorWidths };
