// NOTHING_TO_PUBLISH (spec/P0-03.md r4 AC-108, ruled 2026-10-14 Q3 (a); blocking): the draft holds nothing drawn at
// all, a blank map. Exactly: on every level all of walls, openings, units, items, corrections, amenities,
// transitPoints and anchors are empty, and the document's connectors are empty. The site boundary, the buildings,
// the level rectangles and a backdrop do not count as drawn (a minimal valid document is blank, OA-1 EC-6). One
// finding for the venue, with no level.
'use strict';

const { KIND } = require('../findings');

/** The arrays of a level that count as drawn (AC-108's list). */
const DRAWN = Object.freeze([
  'walls',
  'openings',
  'units',
  'items',
  'corrections',
  'amenities',
  'transitPoints',
  'anchors',
]);

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 */
function checkNothingToPublish(findings, layout) {
  const drawn =
    layout.connectors.length > 0 ||
    layout.levels.some((level) => DRAWN.some((name) => level[name].length > 0));
  if (!drawn) findings.add(KIND.NOTHING_TO_PUBLISH);
}

module.exports = { checkNothingToPublish };
