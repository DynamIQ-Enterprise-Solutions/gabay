// NO_BEACONS_ON_LEVEL (spec/P0-03.md r4 section 3.14.8; AC-22 kept, ruled D8; a warning, never a refusal): each level
// of the layout with no active beacon. Every Demo Malls level gets it (L119: no beacons; AC-135).
'use strict';

const { KIND } = require('../findings');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object[]} beacons  the snapshot's beacon rows
 */
function checkNoBeacons(findings, layout, beacons) {
  const withBeacons = new Set(beacons.filter((b) => b.isActive).map((b) => b.levelKey));
  for (const level of layout.levels) {
    if (!withBeacons.has(level.id)) findings.add(KIND.NO_BEACONS_ON_LEVEL, { level });
  }
}

module.exports = { checkNoBeacons };
