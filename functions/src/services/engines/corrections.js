// The admin's corrections to the generated graph (L32; spec/P0-03.md r4 AC-97, DC-6). BLOCK_AREA is part of the
// walkable area (walkable.js, DC-18). Here, after the lattice and its joins:
//   - REMOVE_PATH removes every walk edge its line touches, on its own level (A1's design choice 16: a lattice node
//     left with no edge is then dropped, graphStore.js);
//   - ADD_PATH adds a node at each vertex of its line and a walk edge along each segment, and joins each of its two
//     ends to the nearest lattice, door, place-point or landing node of its level within publish.addPathSnapM (ties
//     by distance, then node order). An end at a door's midpoint is 0 from that door's node, so it always joins it
//     (OA-3's X3); an end on an amenity's, transit point's or anchor's point joins that point's node (review N2).
//     Another ADD_PATH's vertices are not joined (DC-E13): the corrections apply in document order, so an end could
//     join only the paths drawn before it; two backup paths meet at a door's midpoint or on the lattice instead.
//     A segment that crosses a wall segment (AC-94) is not refused (L170 Q2): it is kept and returned for
//     WALL_CROSSING, with the first point where it crosses.
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');
const { codesOf } = require('../../config/closedSets');
const { BUCKET_CELL_M } = require('./walkable');
const { LATTICE_EPS, forEachNear } = require('./lattice');
const { NODE, ORIGIN } = require('./graphKinds');

const CORRECTION = codesOf('NavCorrectionKind');
/**
 * The node kinds an ADD_PATH end may join besides the lattice (AC-97: "the nearest node of any kind": a door node, a
 * place's point or a connector landing; review N2 added the place point).
 */
const JOINABLE = new Set([NODE.DOOR, NODE.PLACE, NODE.CONNECTOR]);

/** REMOVE_PATH: removes every live walk link, other than an ADD_PATH's, that a correction's line touches. */
function removePaths(g, levels) {
  const lines = levels.flatMap((level) =>
    level.corrections
      .filter((c) => c.kind === CORRECTION.REMOVE_PATH)
      .map((c) => ({ levelIndex: level.index, line: c.line })),
  );
  if (lines.length === 0) return;
  const index = createBucketIndex(BUCKET_CELL_M);
  for (let k = 0; k < g.linkCount; k += 1) {
    const [ax, az, bx, bz] = g.linkSegment(k);
    index.insert(k, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
  }
  const E = planar.EPS;
  for (const { levelIndex, line } of lines) {
    for (let s = 1; s < line.length; s += 1) {
      const [cx, cz] = line[s - 1];
      const [dx, dz] = line[s];
      const box = [
        Math.min(cx, dx) - E,
        Math.min(cz, dz) - E,
        Math.max(cx, dx) + E,
        Math.max(cz, dz) + E,
      ];
      index.query(...box, (k) => {
        if (g.link.removed.get(k) || g.linkOrigin(k) === ORIGIN.ADD_PATH) return false;
        const onLevel =
          g.node.level.get(g.link.a.get(k)) === levelIndex ||
          g.node.level.get(g.link.b.get(k)) === levelIndex;
        const [ax, az, bx, bz] = g.linkSegment(k);
        if (onLevel && planar.segmentsMeet(ax, az, bx, bz, cx, cz, dx, dz))
          g.link.removed.set(k, 1);
        return false;
      });
    }
  }
}

/**
 * ADD_PATH, every correction of every level in document order.
 * @param {object} g  graphStore.js's store
 * @param {object[]} levels  layout.js's levels
 * @param {object[]} areas  walkable.js's areas (their wall segments)
 * @param {Map[]} lattices  each level's lattice, latticeKey -> node
 * @param {{ snap: number, spacing: number }} lengths  publish.addPathSnapM and publish.nodeSpacingM
 * @returns {{ correction, levelIndex, at: number[], segment: number[][] }[]}  the segments through a wall
 */
function addPaths(g, levels, areas, lattices, { snap, spacing }) {
  const specials = levels.map(() => []);
  for (let id = 0; id < g.nodeCount; id += 1) {
    if (JOINABLE.has(g.nodeKind(id))) specials[g.node.level.get(id)].push(id);
  }
  /** Node order on one level: kind (graphKinds.js), then document order (DC-A10). */
  const before = (p, q) =>
    g.node.kind.get(p) - g.node.kind.get(q) || g.node.seq.get(p) - g.node.seq.get(q);

  function nearestNode(levelIndex, x, z) {
    let best = null;
    const consider = (id) => {
      const d = Math.hypot(g.node.x.get(id) - x, g.node.z.get(id) - z);
      if (d > snap + LATTICE_EPS) return;
      if (!best || d < best.d || (d === best.d && before(id, best.id) < 0)) best = { id, d };
    };
    specials[levelIndex].forEach(consider);
    forEachNear(lattices[levelIndex], spacing, x, z, snap, consider);
    return best ? best.id : null;
  }

  const crossings = [];
  for (const level of levels) {
    for (const correction of level.corrections) {
      if (correction.kind !== CORRECTION.ADD_PATH) continue;
      const ids = correction.line.map(([x, z], vertex) =>
        g.addNode(level.index, x, z, NODE.ADD_PATH, { correctionId: correction.id, vertex }),
      );
      const links = ids.slice(1).map((id, k) => [ids[k], id]);
      for (const end of new Set([ids[0], ids[ids.length - 1]])) {
        const near = nearestNode(level.index, g.node.x.get(end), g.node.z.get(end));
        if (near !== null) links.push([end, near]);
      }
      for (const [a, b] of links) {
        if (g.addLink(a, b, ORIGIN.ADD_PATH) < 0) continue;
        const [ax, az, bx, bz] = g.segment(a, b);
        const hit = areas[level.index].crossesWall(ax, az, bx, bz);
        if (!hit) continue;
        crossings.push({
          correction,
          levelIndex: level.index,
          at: [hit.x, hit.z],
          segment: [
            [ax, az],
            [bx, bz],
          ],
        });
      }
    }
  }
  return crossings;
}

module.exports = { removePaths, addPaths };
