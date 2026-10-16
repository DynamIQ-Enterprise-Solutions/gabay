// The graph's own findings (spec/P0-03.md r4 AC-97, AC-98; plan/FF-3-prime-A1.md 1.0 step 7): WALL_CROSSING for
// each ADD_PATH segment through a wall segment, and NO_ENTRANCE when the venue has none. Both are warnings. The
// checks of AC-108 to AC-114 are in checks/, CONNECTOR_OFF_WALKWAY with the data warnings (AC-112).
'use strict';

const { elementRef, at, segmentOf, documentRank } = require('./elements');
const { KIND } = require('./findings');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object} graph  generateGraph's result
 * @param {object} start  entranceSources' result
 */
function addGraphFindings(findings, layout, graph, start) {
  for (const crossing of graph.wallCrossings) {
    findings.add(KIND.WALL_CROSSING, {
      level: layout.levels[crossing.levelIndex],
      element: elementRef('correction', crossing.correction),
      at: at(crossing.at),
      segment: segmentOf(crossing.segment),
      order: [documentRank('correction'), crossing.correction.index],
    });
  }
  if (!start.hasEntrance) {
    findings.add(KIND.NO_ENTRANCE, {
      level: layout.levels[start.fallback.levelIndex],
      at: at(start.fallback.at),
    });
  }
}

module.exports = { addGraphFindings };
