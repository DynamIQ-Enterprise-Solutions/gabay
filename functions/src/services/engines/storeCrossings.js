// Walk-through stores (spec/P0-03.md r4 AC-104, with AC-38 kept; L92; replaces r3 AC-37): for each unit the mall
// marks `passThrough` (a non-walkable unit: OA-1 lets only those carry the mark), each door the unit lists joins a
// point just inside the store, and those points join each other across the store's floor wherever the straight line
// between them stays on that floor, so a concave store is never cut through its notch (A1's rule, kept). The point
// sits 0.5 m inside the door, or 0.25 m, or 0.1 m when the longer distance is off the floor (A1's design choice 10).
// A store's floor is the inside of its outline, less every other blocker as drawn (walls, nested non-walkable units,
// blocking items) and every BLOCK_AREA; its own outline and its parents' are not blockers of it. A store without the
// mark gets no edge across its floor (AC-38): its doors are only its own place's.
// The links are STORE crossings both ways, each carrying its unit (by its place in the document's units, `serial`),
// and are made before the corrections, so a REMOVE_PATH removes the crossings it touches too (AC-97). Their cost is
// length x routing.storeCrossingFactor / routing.walkSpeedMps (graphCosts.js, AC-104).
'use strict';

const planar = require('./geometry/planar');
const { piecesPass } = require('./walkable');
const { NODE, ORIGIN } = require('./graphKinds');

/** How far inside the store a door's crossing point sits, tried in this order (metres; A1's design choice 10). */
const INSIDE_OFFSETS_M = Object.freeze([0.5, 0.25, 0.1]);

/** The unit's own id and its parents' (a section's floor is its parent's too). */
function ownIds(unit, unitById) {
  const out = new Set([unit.id]);
  let parent = unit.parent === null ? null : unitById.get(unit.parent);
  while (parent && !out.has(parent.id)) {
    out.add(parent.id);
    parent = parent.parent === null ? null : unitById.get(parent.parent);
  }
  return out;
}

/** The first point just inside the store from the door's midpoint, across its wall, or null. */
function insidePoint(opening, onFloor) {
  const [mx, mz] = opening.mid;
  const nx = -opening.wall.uz;
  const nz = opening.wall.ux;
  for (const offset of INSIDE_OFFSETS_M) {
    for (const sign of [1, -1]) {
      const x = mx + sign * nx * offset;
      const z = mz + sign * nz * offset;
      if (onFloor(x, z)) return [x, z];
    }
  }
  return null;
}

/**
 * Adds every walk-through store's crossing points and links to the graph store.
 * @param {object} g  graphStore.js's store
 * @param {object} layout  readLayout's result
 * @param {object[]} areas  walkable.js's areas, one per level
 * @param {Map<string, number>} doorNode  opening id -> its door node (every door has one, AC-95)
 */
function addStoreCrossings(g, layout, areas, doorNode) {
  for (const level of layout.levels) {
    const area = areas[level.index];
    const openingById = new Map(level.openings.map((o) => [o.id, o]));
    for (const unit of level.units) {
      if (!unit.passThrough || unit.walkable) continue;
      const own = ownIds(unit, layout.unitById);
      const onFloor = (x, z) =>
        planar.pointInRing(x, z, unit.ring) === 'inside' && area.floorExcept(x, z, own);
      const link = { ref: unit.serial };
      const points = [];
      for (const openingId of unit.doors) {
        const opening = openingById.get(openingId);
        const inside = opening && insidePoint(opening, onFloor);
        if (!inside) continue;
        const node = g.addNode(level.index, inside[0], inside[1], NODE.STORE_INSIDE, {
          unitId: unit.id,
          openingId,
        });
        g.addLink(doorNode.get(openingId), node, ORIGIN.STORE, link);
        points.push({ node, x: inside[0], z: inside[1] });
      }
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const [p, q] = [points[i], points[j]];
          if (area.crossesWall(p.x, p.z, q.x, q.z)) continue;
          const ts = [];
          area.splitParams(p.x, p.z, q.x, q.z, ts, 0);
          if (piecesPass(p.x, p.z, q.x, q.z, ts, onFloor)) {
            g.addLink(p.node, q.node, ORIGIN.STORE, link);
          }
        }
      }
    }
  }
}

module.exports = { addStoreCrossings, INSIDE_OFFSETS_M };
