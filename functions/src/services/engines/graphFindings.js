// The graph's own findings (spec/P0-03.md r4 AC-96, AC-97, AC-98; plan/FF-3-prime-A1.md 1.0 step 7, "the findings
// list empty but for the graph's own"): WALL_CROSSING for each ADD_PATH segment through a wall segment, NO_ENTRANCE
// when the venue has none, and CONNECTOR_OFF_WALKWAY for each landing that joins no walkway. All three are warnings.
// A1′b adds the checks of AC-108 to AC-114 beside these.
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { elementRef, at, segmentOf } = require('./elements');
const { KIND } = require('./findings');

const LEVEL_FIELDS = Object.keys(VENUE_MAP_SCHEMA.kinds.level.fields);
/** An element's place in document order: its level's array (the schema's field order), then its index. */
const arrayRank = (name) => LEVEL_FIELDS.indexOf(name);
/** Connectors follow every level's own arrays in the document (OA-1 section 2.1). */
const CONNECTOR_RANK = LEVEL_FIELDS.length;

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
      order: [arrayRank('corrections'), crossing.correction.index],
    });
  }
  if (!start.hasEntrance) {
    findings.add(KIND.NO_ENTRANCE, {
      level: layout.levels[start.fallback.levelIndex],
      at: at(start.fallback.at),
    });
  }
  for (const { connector, stop, levelIndex, at: point } of graph.offWalkway) {
    findings.add(KIND.CONNECTOR_OFF_WALKWAY, {
      level: layout.levels[levelIndex],
      element: elementRef('connector', connector),
      at: at(point),
      params: { stop },
      order: [CONNECTOR_RANK, connector.index, stop],
    });
  }
}

module.exports = { addGraphFindings };
