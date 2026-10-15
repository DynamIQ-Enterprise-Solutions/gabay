// Where the reachability and orphan checks start (spec/P0-03.md r4 AC-98, DC-26; office section 8.6 check 1 and
// section 11; plan/FF-3-prime-A1.md 1.0 step 6). An entrance is a `door` opening with `entrance` true, on any level;
// every one is a door node of the graph (AC-95), so the checks start from those nodes. With none, the analysis raises
// NO_ENTRANCE and, for AC-110 and AC-111 only, starts from office's fallback: the middle of the bottom edge (the
// largest z) of the lowest level's rectangle, "lowest" being the least elevation, then the least ordinal, then
// document order (DC-26). That point joins the nearest walkway node of its level, the nearest node with an edge
// (ties by node index); it is never a node of the model and never an entrance. If it joins nothing, the checks start
// from nowhere, so every place is unreachable (AC-110 says so).
'use strict';

/** The lowest level: least elevation, then least ordinal, then document order (DC-26). */
function lowestLevel(levels) {
  let best = levels[0];
  for (const level of levels) {
    if (
      level.elevation < best.elevation ||
      (level.elevation === best.elevation && level.ordinal < best.ordinal)
    ) {
      best = level;
    }
  }
  return best;
}

/** The nearest node of the level with at least one edge, ties by node index, or null. */
function nearestWalkwayNode(csr, levelIndex, x, z) {
  let best = null;
  for (let v = 0; v < csr.nodeCount; v += 1) {
    if (csr.levelIndex[v] !== levelIndex || csr.offsets[v + 1] === csr.offsets[v]) continue;
    const d = Math.hypot(csr.x[v] - x, csr.z[v] - z);
    if (best === null || d < best.d) best = { v, d };
  }
  return best === null ? null : best.v;
}

/**
 * @param {object} layout  readLayout's result
 * @param {object} graph  generateGraph's result
 * @returns {{ hasEntrance: boolean, sources: number[], fallback: null | { levelIndex: number, at: number[],
 *             node: number | null } }}  sources: the nodes the checks start from
 */
function entranceSources(layout, graph) {
  if (graph.entranceNodes.length > 0) {
    return { hasEntrance: true, sources: [...graph.entranceNodes], fallback: null };
  }
  const level = lowestLevel(layout.levels);
  const { x0, x1, z1 } = level.rect;
  const at = [(x0 + x1) / 2, z1];
  const node = nearestWalkwayNode(graph.csr, level.index, at[0], at[1]);
  return {
    hasEntrance: false,
    sources: node === null ? [] : [node],
    fallback: { levelIndex: level.index, at, node },
  };
}

module.exports = { entranceSources };
