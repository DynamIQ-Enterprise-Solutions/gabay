// UNREACHABLE (spec/P0-03.md r4 AC-110, replacing r3 AC-13 and AC-40; reversed by L170 Q2; a warning): each place
// reachability (passages.js) could not reach both ways, named with its level and its door or point, and
// `params.reason` one of no_door, cut_off or no_way_back. It never refuses a publish: the shopper's router ends such
// a trip at the nearest reachable point (P0-06 AC-76), from the model's door nodes (AC-99).
'use strict';

const { KIND } = require('../findings');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object[]} places  places.js's places
 * @param {object[]} results  passages.js's results, one per place (null for a place not checked, AC-88)
 */
function checkReachability(findings, layout, places, results) {
  places.forEach((place, i) => {
    const result = results[i];
    if (result === null || result.reached) return;
    findings.add(KIND.UNREACHABLE, {
      level: layout.levels[place.levelIndex],
      element: place.element,
      at: place.at,
      order: place.order,
      params: { reason: result.reason },
    });
  });
}

module.exports = { checkReachability };
