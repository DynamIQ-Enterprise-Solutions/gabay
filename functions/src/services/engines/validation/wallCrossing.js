// AC-12 (L92; walls ruled D4): publish is refused if any walkway crosses a wall, shown at the crossing point. An
// ADD_PATH segment through a wall is never added to the graph; the generator records it and it is refused here.
// The generated walkways are built so that none crosses a wall; they are checked again here all the same, so the
// rule holds whatever the generator does.
'use strict';

const { codesOf } = require('../../../config/closedSets');

const PROBLEM = codesOf('PublishProblemKind');
const EDGE = codesOf('GraphEdgeKind');

function checkWallCrossings(venue, graph, issues) {
  for (const c of graph.addPathCrossings) {
    issues.problem(PROBLEM.WALL_CROSSING, {
      element: { table: 'NavCorrection', id: c.correctionId, name: null },
      levelId: c.levelId,
      at: c.at,
      segment: c.segment,
    });
  }
  for (const e of graph.edges) {
    if (e.kind === EDGE.CONNECTOR || e.from > e.to) continue;
    const [p, q] = [graph.nodes[e.from], graph.nodes[e.to]];
    for (const levelId of p.levelId === q.levelId ? [p.levelId] : [p.levelId, q.levelId]) {
      const hit = graph.areas.get(levelId).crossesWall(p.x, p.y, q.x, q.y);
      if (!hit) continue;
      issues.problem(PROBLEM.WALL_CROSSING, {
        levelId,
        at: { x: hit.x, y: hit.y },
        segment: [
          [p.x, p.y],
          [q.x, q.y],
        ],
      });
    }
  }
}

module.exports = { checkWallCrossings };
