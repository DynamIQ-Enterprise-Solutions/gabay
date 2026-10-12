// AC-20 (DC-5; EC-4): a venue with no walkable area on any level (no levels at all, or no walkway node anywhere) is
// refused with "Nothing to publish: no walkways".
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { NODE } = require('../graphKinds');

const PROBLEM = codesOf('PublishProblemKind');

function checkNothingToPublish(graph, issues) {
  if (!graph.nodes.some((n) => n.kind === NODE.GRID)) issues.problem(PROBLEM.NOTHING_TO_PUBLISH);
}

module.exports = { checkNothingToPublish };
