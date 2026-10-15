// GRAPH_LARGE (spec/P0-03.md r4 section 3.14.8; AC-75 kept, ruled D14; PRD section 7; a warning, never a refusal): a
// graph of more nodes than publish.maxNodesWarn (default 20,000, PRD section 7's figure). It fires on three of the four
// Demo Malls until the owner rules on the neighbour count or the threshold (EC-75). PACKAGE_LARGE, AC-75's other
// half, is stage B's: it needs the package's size.
'use strict';

const { KIND } = require('../findings');

/**
 * @param {object} findings  createFindings()'s collector
 * @param {number} nodeCount  the graph's nodes
 * @param {{ maxNodesWarn: number }} publish  the snapshot's publish.* settings
 */
function checkGraphSize(findings, nodeCount, publish) {
  if (nodeCount > publish.maxNodesWarn) {
    findings.add(KIND.GRAPH_LARGE, { params: { nodeCount, limit: publish.maxNodesWarn } });
  }
}

module.exports = { checkGraphSize };
