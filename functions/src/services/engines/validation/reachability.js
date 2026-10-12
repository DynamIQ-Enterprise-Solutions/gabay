// AC-13 and AC-14 (ruled D5; DC-6). Every place that cannot be reached from an entrance and back, over walkways,
// everyday connectors and walk-through stores, is refused at its door (AC-13, AC-40). Every part of the graph that
// holds no joined entrance is an orphan (AC-14), an ADD_PATH that joins nothing included. A connector end or a place
// node standing alone is not reported here: AC-15(c) and AC-13 already name it.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { undirectedComponents } = require('../graphSearch');
const { NODE } = require('../graphKinds');
const { ref, at } = require('../elements');

const PROBLEM = codesOf('PublishProblemKind');
const ORPHAN_KINDS = new Set([NODE.GRID, NODE.DOOR, NODE.STORE_INSIDE, NODE.ADD_PATH]);

function checkReachability(venue, graph, analysis, issues) {
  for (const result of analysis.results) {
    if (result.reached) continue;
    const { element, levelId, at: shownAt } = result.place;
    issues.problem(PROBLEM.UNREACHABLE, { element, levelId, at: shownAt });
  }

  const component = undirectedComponents(graph.nodes.length, graph.edges);
  const joined = new Set(analysis.entrances.map((node) => component[node]));
  const members = new Map();
  for (const node of graph.nodes) {
    const c = component[node.id];
    if (joined.has(c)) continue;
    if (!members.has(c)) members.set(c, []);
    members.get(c).push(node);
  }
  const openingsById = new Map(venue.openings.map((o) => [o.id, o]));
  for (const nodes of members.values()) {
    if (!nodes.some((n) => ORPHAN_KINDS.has(n.kind))) continue;
    const first = nodes[0];
    const addPath = nodes.find((n) => n.kind === NODE.ADD_PATH);
    let element = null;
    if (addPath) element = { table: 'NavCorrection', id: addPath.ref.correctionId, name: null };
    else if (nodes.length === 1 && first.kind === NODE.DOOR) {
      element = ref('Opening', openingsById.get(first.ref.openingId));
    }
    issues.problem(PROBLEM.ORPHAN, {
      element,
      levelId: first.levelId,
      at: at(first.x, first.y),
      params: { nodeCount: nodes.length },
    });
  }
}

module.exports = { checkReachability };
