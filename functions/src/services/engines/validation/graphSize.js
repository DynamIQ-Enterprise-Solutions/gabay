// AC-75, the node count (ruled D14; PRD §7 "about 20,000 nodes"): a graph with more nodes than publish.maxNodesWarn
// is a warning, never a refusal. The package-size half of AC-75 needs the bytes, so it is the publish service's
// (stage B).
'use strict';

const { codesOf } = require('../../../config/closedSets');

const WARNING = codesOf('PublishWarningKind');

function checkGraphSize(venue, graph, issues) {
  const limit = venue.settings.maxNodesWarn;
  if (graph.nodes.length > limit) {
    issues.warning(WARNING.GRAPH_LARGE, { params: { nodeCount: graph.nodes.length, limit } });
  }
}

module.exports = { checkGraphSize };
