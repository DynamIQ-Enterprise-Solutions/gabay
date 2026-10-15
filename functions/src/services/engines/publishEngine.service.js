// The publish engine's one entry (spec/P0-03.md r4 AC-89; plan/FF-3-prime-A1.md 1.0 section 2 and step 7):
// analyseMap(snapshot) -> { findings, model }. A pure function: it opens no database, reads no clock, no file and no
// environment value; the same snapshot always gives the same findings and the same model, in the same order (AC-31).
// Publish (AC-118), the checks route (AC-121) and the preview route (AC-124) all call it, so no check and no graph
// step has a second copy.
//
// A1′a's half: the snapshot read (snapshot.js), the document read (layout.js), the walkable area and the graph
// (graphGenerator.service.js), the entrance fallback (AC-98), the graph's own findings, and a model holding the
// graph, the levels, the entrances and the places (AC-99). A1′b adds validation and the other checks (AC-108 to
// AC-115), the costs (AC-100 to AC-105) and the rest of the package model (AC-116).
'use strict';

const { readSnapshot } = require('./snapshot');
const { readLayout } = require('./layout');
const { generateGraph } = require('./graphGenerator.service');
const { entranceSources } = require('./entranceFallback');
const { createFindings } = require('./findings');
const { addGraphFindings } = require('./graphFindings');
const { listPlaces } = require('./places');
const { costGraph } = require('./graphCosts');

/**
 * Every step, with what each made. Exported so tests can look at the graph itself (node kinds, edge origins, the
 * walkable areas), which the model leaves out.
 * @param {object} snapshot  plan section 2's snapshot
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  tests and the measurement only (DC-A5); publish passes nothing
 */
function runAnalysis(snapshot, { neighbourMoves } = {}) {
  const read = readSnapshot(snapshot);
  const layout = readLayout(read.layout, read.context);
  const graph = generateGraph(layout, read.settings.publish, { neighbourMoves });
  const start = entranceSources(layout, graph);
  const findings = createFindings();
  addGraphFindings(findings, layout, graph, start);
  const costs = costGraph(graph.csr, layout, read.settings.routing, read.lookups.ConnectorType);
  const { csr } = graph;
  const model = {
    levels: layout.levels.map((level) => level.id),
    graph: {
      nodeCount: csr.nodeCount,
      x: csr.x,
      z: csr.z,
      levelIndex: csr.levelIndex,
      offsets: csr.offsets,
      targets: csr.targets,
      lengthM: csr.lengthM,
      clearanceM: csr.clearanceM,
    },
    entrances: [...graph.entranceNodes],
    places: listPlaces(layout, read.stores, graph),
  };
  return { read, layout, graph, start, costs, findings: findings.list(), model };
}

/**
 * @param {object} snapshot  plan section 2's snapshot
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  tests and the measurement only (DC-A5)
 * @returns {{ findings: object[], model: object }}
 */
function analyseMap(snapshot, options) {
  const { findings, model } = runAnalysis(snapshot, options);
  return { findings, model };
}

module.exports = { analyseMap, runAnalysis };
