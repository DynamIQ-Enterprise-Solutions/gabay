// ORPHAN (spec/P0-03.md r4 AC-111, DC-36; replaces r3 AC-14; reversed by L170 Q2; a warning): one finding per orphan
// part of the graph, with its level and a point inside it. A part is weakly connected (every edge, either direction,
// evacuation edges included); it is an orphan when it holds at least one lattice or ADD_PATH node and no entrance node
// (nor AC-98's fallback node when the venue has no entrance). A part of door nodes or landings alone is its place's or
// its connector's own finding (AC-110, AC-96), not an orphan. The point is the part's first lattice or ADD_PATH node.
'use strict';

const { KIND } = require('../findings');
const { csrComponents } = require('../graphSearch');
const { NODE_KINDS } = require('../graphStore');
const { NODE } = require('../graphKinds');

const WALKWAY = new Set([NODE.GRID, NODE.ADD_PATH]);

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object} csr  the generated graph
 * @param {number[]} sources  the nodes the checks start from (entranceFallback.js)
 */
function checkOrphans(findings, layout, csr, sources) {
  const part = csrComponents(csr);
  const anchored = new Set(sources.map((v) => part[v]));
  const first = new Map();
  const size = new Map();
  for (let v = 0; v < csr.nodeCount; v += 1) {
    size.set(part[v], (size.get(part[v]) ?? 0) + 1);
    if (!WALKWAY.has(NODE_KINDS[csr.nodeKind[v]]) || anchored.has(part[v])) continue;
    if (!first.has(part[v])) first.set(part[v], v);
  }
  for (const [root, v] of first) {
    findings.add(KIND.ORPHAN, {
      level: layout.levels[csr.levelIndex[v]],
      at: { x: csr.x[v], z: csr.z[v] },
      params: { nodeCount: size.get(root) },
    });
  }
}

module.exports = { checkOrphans };
