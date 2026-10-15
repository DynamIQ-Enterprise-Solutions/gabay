// Walk-through stores (spec/P0-03.md r2 AC-37, AC-38; L92; Blueprint §4.1): for each unit the mall marks
// PassThrough, each of its doors joins a point just inside the store, and those points join each other across its
// floor. Every such edge carries the store's unit id, its real length, and cost = length x routing.storeCrossingFactor
// (a tenant setting, AC-72). Two points are joined only where the straight line between them stays on the store's
// floor and passes through no wall, so a concave store is never crossed through its own notch. A store not marked
// walk-through gets no edges across its floor (AC-38): its doors are only its own place's.
'use strict';

const { codesOf } = require('../../config/closedSets');
const planar = require('./geometry/planar');
const { piecesPass } = require('./walkable');
const { NODE, ORIGIN } = require('./graphKinds');

const EDGE = codesOf('GraphEdgeKind');

/** How far inside the store a door's crossing point sits, tried in this order (metres; "just inside", plan §3). */
const INSIDE_OFFSETS_M = Object.freeze([0.5, 0.25, 0.1]);

/** The point just inside the store from a door's gap, or null when there is no floor there. */
function insidePoint(line, mid, onFloor) {
  const [p, q] = [line[0], line[line.length - 1]];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (len === 0) return null;
  const nx = -(q[1] - p[1]) / len;
  const ny = (q[0] - p[0]) / len;
  for (const offset of INSIDE_OFFSETS_M) {
    for (const sign of [1, -1]) {
      const x = mid.x + sign * nx * offset;
      const y = mid.y + sign * ny * offset;
      if (onFloor(x, y)) return { x, y, offset };
    }
  }
  return null;
}

function ancestorsOf(unit, unitsById) {
  const out = [];
  let parent = unit.parentId === null ? null : unitsById.get(unit.parentId);
  while (parent && !out.includes(parent.id)) {
    out.push(parent.id);
    parent = parent.parentId === null ? null : unitsById.get(parent.parentId);
  }
  return out;
}

/**
 * Adds every walk-through store's crossing nodes and edges.
 * @param {object} venue  the parsed draft (shapes read)
 * @param {Map<number, object>} areas  each level's walkable-area context (walkable.js)
 * @param {Map<number, number>} openingNode  door node per opening (only doors that joined the walkways)
 * @param {{ nodes: object[], addNode: Function, addLink: Function }} graph  the generator's builder
 * @returns {{ unitId: number, doorGroups: number[][] }[]}  per store, its door nodes grouped by which can reach
 *   each other across its floor (passages.js links the walkway parts through them)
 */
function addStoreCrossings(venue, areas, openingNode, graph) {
  const factor = venue.settings.storeCrossingFactor;
  const unitsById = new Map(venue.units.map((u) => [u.id, u]));
  const openingsByUnit = new Map();
  for (const o of venue.openings) {
    if (o.unitId === null || !o.line) continue;
    if (!openingsByUnit.has(o.unitId)) openingsByUnit.set(o.unitId, []);
    openingsByUnit.get(o.unitId).push(o);
  }
  const stores = [];
  for (const unit of venue.units) {
    if (!unit.passThrough || unit.isWalkable || !unit.area) continue;
    const area = areas.get(unit.levelId);
    const own = new Set([unit.id, ...ancestorsOf(unit, unitsById)]);
    const onFloor = (x, y) =>
      planar.pointInArea(x, y, unit.area) === 'inside' &&
      !area.onWall(x, y) &&
      !area.inObstacle(x, y, own);

    const points = [];
    for (const opening of openingsByUnit.get(unit.id) ?? []) {
      const doorNode = openingNode.get(opening.id);
      if (doorNode === undefined) continue;
      const inside = insidePoint(opening.line, graph.nodes[doorNode], onFloor);
      if (!inside) continue;
      const insideNode = graph.addNode(unit.levelId, inside.x, inside.y, NODE.STORE_INSIDE, {
        unitId: unit.id,
        openingId: opening.id,
      });
      graph.addLink({
        a: doorNode,
        b: insideNode,
        kind: EDGE.STORE_CROSSING,
        origin: ORIGIN.STORE,
        length: inside.offset,
        cost: inside.offset * factor,
        unitId: unit.id,
        doorWidth: opening.clearWidthM,
      });
      points.push({ doorNode, insideNode, x: inside.x, y: inside.y });
    }

    const group = points.map((_, i) => i);
    const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const [a, b] = [points[i], points[j]];
        if (area.crossesWall(a.x, a.y, b.x, b.y)) continue;
        const ts = [];
        area.splitParams(a.x, a.y, b.x, b.y, ts);
        if (!piecesPass(a.x, a.y, b.x, b.y, ts, onFloor)) continue;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        graph.addLink({
          a: a.insideNode,
          b: b.insideNode,
          kind: EDGE.STORE_CROSSING,
          origin: ORIGIN.STORE,
          length,
          cost: length * factor,
          unitId: unit.id,
        });
        group[root(j)] = root(i);
      }
    }
    const byRoot = new Map();
    points.forEach((p, i) => {
      const r = root(i);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(p.doorNode);
    });
    stores.push({ unitId: unit.id, doorGroups: [...byRoot.values()] });
  }
  return stores;
}

module.exports = { addStoreCrossings, INSIDE_OFFSETS_M };
