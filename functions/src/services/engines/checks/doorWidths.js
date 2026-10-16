// DOOR_WIDTH_UNMEASURED (spec/P0-03.md r4 section 3.14.8; AC-23 kept, L88: "An unmeasured door (NULL) needs a publish
// warning"; a warning, never a refusal): each door whose clear width `clearW` is absent. Its edges' clearance comes
// from the geometry (AC-30, EC-28). A window is never walked through, so it has no door width to measure (DC-B4).
'use strict';

const { KIND } = require('../findings');
const { elementRef, at, documentRank } = require('../elements');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 */
function checkDoorWidths(findings, layout) {
  for (const level of layout.levels) {
    for (const opening of level.openings) {
      if (!opening.isDoor || opening.clearW !== null) continue;
      findings.add(KIND.DOOR_WIDTH_UNMEASURED, {
        level,
        element: elementRef('opening', opening),
        at: at(opening.mid),
        order: [documentRank('opening'), opening.index],
      });
    }
  }
}

module.exports = { checkDoorWidths };
