// The publish engine's one entry (spec/P0-03.md r4 AC-89; plan/FF-3-prime-A1.md 1.0 section 2 and steps 7 to 13):
// analyseMap(snapshot) -> { findings, model }. A pure function: it opens no database, reads no clock, no file and no
// environment value; the same snapshot always gives the same findings and the same model, in the same order (AC-31).
// Publish (AC-118), the checks route (AC-121) and the preview route (AC-124) all call it, so no check and no graph
// step has a second copy.
//
// The steps (AC-115: every check runs on every analysis, and every finding is returned, in AC-115's order):
//   1. the snapshot, read once (snapshot.js; C8: a missing field throws);
//   2. OA-1's validator on the layout with the snapshot's context (INVALID_DOCUMENT, AC-108), then the row checks,
//      which run whatever the layout (beacons, AC-109; store categories, AC-108; stores and beacons left out,
//      AC-114). With an invalid layout the analysis stops there: no graph is built from an invalid document;
//   3. the document read (layout.js), the blank-map and tenant checks (AC-108);
//   4. the walkable area and the graph (A1′a, with A1′b's connector edges and store crossings), its own findings
//      (AC-97, AC-98), reachability and passages (AC-110, AC-39), orphans (AC-111), the data warnings (AC-112), the
//      review flags (AC-113) and the kept warnings (AC-22, AC-23, AC-75);
//   5. with no blocking finding, the costs (AC-100 to AC-105: a cost that is not finite or is below 0 throws
//      PublishBuildError) and the model. With one, the model is null (plan section 2).
'use strict';

const { readSnapshot } = require('./snapshot');
const { layoutKeys } = require('./layoutKeys');
const { readLayout } = require('./layout');
const { generateGraph } = require('./graphGenerator.service');
const { entranceSources } = require('./entranceFallback');
const { createFindings, isBlocking } = require('./findings');
const { addGraphFindings } = require('./graphFindings');
const { listPlaces } = require('./places');
const { analyseReach } = require('./passages');
const { costGraph } = require('./graphCosts');
const { checkDocument } = require('./checks/invalidDocument');
const { checkNothingToPublish } = require('./checks/nothingToPublish');
const { checkLayoutCodes, checkStoreCategories } = require('./checks/tenantRefs');
const { checkBeacons } = require('./checks/beacons');
const { checkRows } = require('./checks/rows');
const { checkReachability } = require('./checks/reachability');
const { checkOrphans } = require('./checks/orphans');
const { checkDataWarnings } = require('./checks/dataWarnings');
const { checkUnreviewed } = require('./checks/unreviewed');
const { checkNoBeacons } = require('./checks/noBeacons');
const { checkDoorWidths } = require('./checks/doorWidths');
const { checkGraphSize } = require('./checks/graphSize');

/** The model A1′a defined (the graph, the levels, the entrances and the places); step 13 replaces it with AC-116's. */
function interimModel(layout, graph, places, costs) {
  const { csr } = graph;
  return {
    levels: layout.levels.map((level) => level.id),
    graph: {
      nodeCount: csr.nodeCount,
      x: csr.x,
      z: csr.z,
      levelIndex: csr.levelIndex,
      offsets: csr.offsets,
      targets: csr.targets,
      lengthM: costs.lengthM,
      clearanceM: csr.clearanceM,
    },
    entrances: [...graph.entranceNodes],
    places: places.map(({ id, kind, levelId, name, doorNodes }) => ({
      id,
      kind,
      levelId,
      name,
      doorNodes,
    })),
  };
}

/**
 * Every step, with what each made. Exported so tests and the preview can look at the graph itself (node kinds, edge
 * origins, the walkable areas), which the model leaves out.
 * @param {object} snapshot  plan section 2's snapshot
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  tests and the measurement only (DC-A5); publish passes nothing
 */
function runAnalysis(snapshot, { neighbourMoves } = {}) {
  const read = readSnapshot(snapshot);
  const findings = createFindings();
  const keys = layoutKeys(read.layout);
  const valid = checkDocument(findings, read.layout, read.context, keys);
  checkBeacons(findings, read, keys);
  checkStoreCategories(findings, read.stores, read.context, keys);
  checkRows(findings, read, keys);
  if (valid === null) return { read, findings: findings.list(), model: null };

  const layout = readLayout(valid, read.context);
  checkNothingToPublish(findings, layout);
  checkLayoutCodes(findings, layout, read.context);
  const graph = generateGraph(layout, read.settings.publish, { neighbourMoves });
  const start = entranceSources(layout, graph);
  const places = listPlaces(layout, read.stores, graph);
  const reach = analyseReach(graph.csr, places, start.sources);
  addGraphFindings(findings, layout, graph, start);
  checkReachability(findings, layout, places, reach.results);
  checkOrphans(findings, layout, graph.csr, start.sources);
  checkDataWarnings(findings, layout, graph, read.beacons);
  checkUnreviewed(findings, layout);
  checkNoBeacons(findings, layout, read.beacons);
  checkDoorWidths(findings, layout);
  checkGraphSize(findings, graph.csr.nodeCount, read.settings.publish);

  const list = findings.list();
  const done = { read, layout, graph, start, places, reach, findings: list };
  if (list.some(isBlocking)) return { ...done, model: null };
  const costs = costGraph(graph.csr, layout, read.settings.routing, read.lookups.ConnectorType);
  return { ...done, costs, model: interimModel(layout, graph, places, costs) };
}

/**
 * @param {object} snapshot  plan section 2's snapshot
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  tests and the measurement only (DC-A5)
 * @returns {{ findings: object[], model: object | null }}
 * @throws {PublishBuildError} on a build failure (AC-105, AC-118 (c)); TypeError on a malformed snapshot (C8)
 */
function analyseMap(snapshot, options) {
  const { findings, model } = runAnalysis(snapshot, options);
  return { findings, model };
}

module.exports = { analyseMap, runAnalysis };
