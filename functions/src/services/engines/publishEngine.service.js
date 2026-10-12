// The publish engine (spec/P0-03.md r2; plan/FF-3-publish-engine.md 1.0 §3; Blueprint §4.1): pure functions over a
// VenueDraft, with no database and no file (DC-P2). It runs AC-1's steps in order (validation, graph generation,
// connector costing, walk-through stores and passages, then the package model), never stopping at the first
// problem (DC-1, AC-21), and returns { problems, warnings, model }. The model is built only when nothing refuses
// the publish; a PackageWriter (stage B) turns it into bytes.
'use strict';

const { createIssues } = require('./issues');
const { parseDraft } = require('./draft');
const { readShapes } = require('./validation/shapes');
const { checkReviewGate } = require('./validation/reviewGate');
const { checkConnectorRows, checkConnectorJoins } = require('./validation/connectors');
const { checkBoundary } = require('./validation/boundary');
const { checkBeacons } = require('./validation/beacons');
const { checkTenantRefs } = require('./validation/tenantRefs');
const { checkNoBeacons } = require('./validation/noBeacons');
const { checkDoorWidths } = require('./validation/doorWidths');
const { checkWallCrossings } = require('./validation/wallCrossing');
const { checkReachability } = require('./validation/reachability');
const { checkNothingToPublish } = require('./validation/nothingToPublish');
const { checkGraphSize } = require('./validation/graphSize');
const { generateGraph } = require('./graphGenerator.service');
const { findPassages } = require('./passages');
const { buildPackageModel } = require('./packageModel');

/**
 * Every step short of the package model. Exported so tests can look at the generated graph itself (node kinds,
 * edge origins), which the model leaves out.
 * @param {object} draft  the VenueDraft (plan §3)
 * @param {object} [settings]  { routing, publish }, the draft's own by default (injected by tests, AC-75)
 */
function runStages(draft, settings = draft.settings) {
  const issues = createIssues();
  const venue = parseDraft(draft, settings);
  readShapes(venue, issues); // AC-18
  checkReviewGate(venue, issues); // AC-11
  checkConnectorRows(venue, issues); // AC-15 (a), (b), (d)
  checkBoundary(venue, issues); // AC-16
  checkBeacons(venue, issues); // AC-17
  checkTenantRefs(venue, issues); // AC-19
  checkNoBeacons(venue, issues); // AC-22
  checkDoorWidths(venue, issues); // AC-23
  const graph = generateGraph(venue); // AC-24 to AC-38
  checkConnectorJoins(venue, graph, issues); // AC-15 (c)
  checkWallCrossings(venue, graph, issues); // AC-12
  const analysis = findPassages(venue, graph); // AC-13, AC-39
  checkReachability(venue, graph, analysis, issues); // AC-13, AC-14, AC-40
  checkNothingToPublish(graph, issues); // AC-20
  checkGraphSize(venue, graph, issues); // AC-75 (nodes)
  return { venue, graph, analysis, issues };
}

/**
 * @param {object} draft  the VenueDraft (plan §3)
 * @param {object} [settings]  { routing, publish }, the draft's own by default
 * @returns {{ problems: object[], warnings: object[], model: object | null }}
 */
function runPublishEngine(draft, settings = draft.settings) {
  const { venue, graph, analysis, issues } = runStages(draft, settings);
  const model = issues.problems.length ? null : buildPackageModel(venue, graph, analysis);
  return { problems: issues.problems, warnings: issues.warnings, model };
}

module.exports = { runPublishEngine, runStages };
