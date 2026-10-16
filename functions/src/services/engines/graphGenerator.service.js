// The walkway graph (spec/P0-03.md r4 AC-93 to AC-97 and AC-99, with AC-28, AC-30 and AC-31 kept; L32; L170 Q6;
// plan/FF-3-prime-A1.md 1.0 step 5). Generated from each level's walkable area (walkable.js) in the venue's one frame:
//   1. a square lattice at publish.nodeSpacingM anchored at the venue frame's origin (DC-19; lattice.js), a node at
//      every lattice point inside a level's walkable area, joined to its neighbours (GRAPH_NEIGHBOUR_MOVES: 8 and the
//      8 knight's moves) wherever the whole segment lies inside the area, so no walk edge crosses a wall (L92);
//   2. a node at every `door` opening's midpoint, joined through its channel to up to 4 lattice nodes it can see
//      within 2 x the spacing on each side of its wall (AC-95);
//   3. a node for every amenity, transit point and anchor reached at its own point, joined the same way; one that
//      names a non-walkable unit, or stands inside one, is reached through that unit's doors (A1's choice 9);
//   4. a landing node at each stop of every walkable connector, joined the same way (AC-96; scenery has none);
//   5. walk edges between levels of equal elevation at the same lattice point and its 4 axis neighbours (AC-28);
//   6. the store crossings of every walk-through store (storeCrossings.js, AC-104), before the corrections, so a
//      REMOVE_PATH removes the crossings its line touches too (AC-97);
//   7. the corrections (corrections.js, AC-97): REMOVE_PATH, then ADD_PATH;
//   8. every walkway's and store crossing's clearance (clearance.js, AC-30);
//   9. the connector edges (connectorRules.js, AC-103) between each walkable connector's landings, both ways or one
//      way, each flagged when its connector is evacuation-only (DC-38). A connector edge has no clearance (NO_CLEARANCE_M):
//      AC-30 measures walkways, and a connector's step-free flag is its type's (DC-B5).
// Levels of one elevation are one floor (D6): a door, point or landing joins the lattice of every level at its
// elevation, so a building's entrance joins the outdoor level outside it (V-GEO-5). A door, place or landing node
// that joins nothing stays, with no edges (AC-99); a lattice node left with no edge is dropped (AC-97). The costs
// are computed from the finished graph (graphCosts.js, AC-100 to AC-105).
'use strict';

const planar = require('./geometry/planar');
const { levelWallSegments } = require('./walls');
const { createAreas, segmentWalkableAcross } = require('./walkable');
const { assignClearances } = require('./clearance');
const { removePaths, addPaths } = require('./corrections');
const { addStoreCrossings } = require('./storeCrossings');
const { createGraphStore } = require('./graphStore');
const { connectorLinks } = require('./connectorRules');
const { latticeKey, firstIndex, lastIndex, forEachNear, LATTICE_EPS } = require('./lattice');
const { GRAPH_NEIGHBOUR_MOVES, FORWARD_MOVES, EDGE_FLAG } = require('./constants');
const { NODE, ORIGIN } = require('./graphKinds');

/** Same-height joins: the node at the same lattice point on the other level, and its four axis neighbours (A1's). */
const SAME_HEIGHT_OFFSETS = Object.freeze([
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);
/** A door, point or landing joins lattice nodes within this many node spacings (A1's design choice 7)... */
const JOIN_RADIUS_SPACINGS = 2;
/** ...and at most this many of them on each side, nearest first (A1's design choice 7; AC-95's "on each side"). */
const JOIN_MAX_NODES = 4;

/** The levels of each elevation, in document order (ruled D6: one floor). */
function elevationGroups(levels) {
  const groups = new Map();
  for (const level of levels) {
    if (!groups.has(level.elevation)) groups.set(level.elevation, []);
    groups.get(level.elevation).push(level.index);
  }
  return groups;
}

/** The innermost non-walkable unit of the level that holds (x, z) strictly inside, or null (A1's choice 9). */
function innermostUnitAt(level, x, z) {
  let best = null;
  for (const unit of level.units) {
    if (unit.walkable || planar.pointInRing(x, z, unit.ring) !== 'inside') continue;
    const size = Math.abs(planar.ringArea2(unit.ring));
    if (!best || size < best.size) best = { unit, size };
  }
  return best ? best.unit : null;
}

/** The unit whose doors reach a point place, or null when it is reached at its own point (AC-95). */
function reachingUnit(layout, level, point) {
  if (point.kind === 'transitPoint') return null;
  const named = point.unit === null ? null : layout.unitById.get(point.unit);
  if (named && !named.walkable) return named;
  return innermostUnitAt(level, point.at[0], point.at[1]);
}

/**
 * @param {object} layout  readLayout's result
 * @param {{ nodeSpacingM: number, bodyMarginM: number, addPathSnapM: number }} publish  the publish.* settings
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  16 in production; a test or the measurement may pass 8 (DC-A5)
 */
function generateGraph(layout, publish, { neighbourMoves = GRAPH_NEIGHBOUR_MOVES } = {}) {
  const moves = FORWARD_MOVES[neighbourMoves];
  if (!moves) {
    throw new RangeError(`publish engine: neighbourMoves must be 8 or 16, not ${neighbourMoves}`);
  }
  const spacing = publish.nodeSpacingM;
  const { levels } = layout;
  const wallSegments = new Map(levels.map((l) => [l.id, levelWallSegments(l)]));
  const areas = createAreas(layout, wallSegments, { margin: publish.bodyMarginM });
  const groups = elevationGroups(levels);
  const floorOf = (levelIndex) => groups.get(levels[levelIndex].elevation);
  const g = createGraphStore();
  const lattices = levels.map(() => new Map());

  // 1. The lattice (AC-93).
  for (const level of levels) {
    const area = areas[level.index];
    const lattice = lattices[level.index];
    const { x0, z0, x1, z1 } = level.rect;
    for (let j = firstIndex(z0, spacing); j <= lastIndex(z1, spacing); j += 1) {
      for (let i = firstIndex(x0, spacing); i <= lastIndex(x1, spacing); i += 1) {
        const [x, z] = [i * spacing, j * spacing];
        if (area.pointWalkable(x, z)) {
          lattice.set(latticeKey(i, j), g.addNode(level.index, x, z, NODE.GRID, { i, j }));
        }
      }
    }
    for (const a of lattice.values()) {
      const { i, j } = g.node.ref[a];
      for (const [di, dj] of moves) {
        const b = lattice.get(latticeKey(i + di, j + dj));
        if (b !== undefined && area.segmentWalkable(...g.segment(a, b))) {
          g.addLink(a, b, ORIGIN.GRID);
        }
      }
    }
  }

  /**
   * Joins the node at (x, z) to the nearest lattice nodes of its floor it can see (AC-95): within
   * JOIN_RADIUS_SPACINGS spacings, at most JOIN_MAX_NODES per group, nearest first, ties by node order. `sideOf`
   * puts each candidate in a group (a door's two sides and its line), or every candidate in one. Returns how many.
   */
  function joinNearby(nodeId, levelIndex, x, z, sideOf = () => 0) {
    const reach = JOIN_RADIUS_SPACINGS * spacing;
    const candidates = [];
    for (const li of floorOf(levelIndex)) {
      forEachNear(lattices[li], spacing, x, z, reach, (id) => {
        const d = Math.hypot(g.node.x.get(id) - x, g.node.z.get(id) - z);
        if (d <= reach + LATTICE_EPS) candidates.push({ id, d });
      });
    }
    candidates.sort((p, q) => p.d - q.d || p.id - q.id);
    const floor = floorOf(levelIndex).map((i) => areas[i]);
    const taken = new Map();
    let joined = 0;
    for (const { id } of candidates) {
      const [cx, cz] = [g.node.x.get(id), g.node.z.get(id)];
      const side = sideOf(cx, cz);
      if ((taken.get(side) ?? 0) === JOIN_MAX_NODES) continue;
      if (!segmentWalkableAcross(floor, x, z, cx, cz)) continue;
      if (g.addLink(nodeId, id, ORIGIN.JOIN) < 0) continue;
      taken.set(side, (taken.get(side) ?? 0) + 1);
      joined += 1;
    }
    return joined;
  }

  // 2. Every door is a node at its midpoint (AC-95), joined on each side of its wall.
  const doorNode = new Map();
  const entranceNodes = [];
  for (const level of levels) {
    for (const opening of level.openings) {
      if (!opening.isDoor) continue;
      const [mx, mz] = opening.mid;
      const id = g.addNode(level.index, mx, mz, NODE.DOOR, { openingId: opening.id });
      doorNode.set(opening.id, id);
      if (opening.entrance) entranceNodes.push(id);
      const { ux, uz } = opening.wall;
      joinNearby(id, level.index, mx, mz, (cx, cz) =>
        planar.side(mx, mz, mx + ux, mz + uz, cx, cz),
      );
    }
  }

  // 3. Places reached at their own point (AC-95); the others through a non-walkable unit's doors (A1's choice 9).
  const placePoint = new Map();
  const placeUnit = new Map();
  for (const level of levels) {
    for (const point of [...level.amenities, ...level.transitPoints, ...level.anchors]) {
      const key = `${point.kind}:${point.id}`;
      const unit = reachingUnit(layout, level, point);
      if (unit) {
        placeUnit.set(key, unit.id);
        continue;
      }
      const [x, z] = point.at;
      const id = g.addNode(level.index, x, z, NODE.PLACE, { kind: point.kind, id: point.id });
      placePoint.set(key, id);
      joinNearby(id, level.index, x, z);
    }
  }

  // 4. Connector landings (AC-96): a node per stop of a walkable connector; one that joins nothing is recorded.
  const landings = [];
  const landingNodes = new Map();
  const offWalkway = [];
  for (const connector of layout.connectors) {
    if (!connector.walkable) continue;
    landingNodes.set(connector.index, []);
    connector.stops.forEach(([x, z], stop) => {
      const levelIndex = connector.levels[stop];
      const id = g.addNode(levelIndex, x, z, NODE.CONNECTOR, { connectorId: connector.id, stop });
      landings.push({ connectorId: connector.id, stop, levelIndex, node: id });
      landingNodes.get(connector.index).push(id);
      if (joinNearby(id, levelIndex, x, z) === 0) {
        offWalkway.push({ connector, stop, levelIndex, at: [x, z] });
      }
    });
  }

  // 5. Same-height joins (ruled D6, AC-28): never across a wall of either level.
  for (const group of groups.values()) {
    for (let p = 0; p < group.length; p += 1) {
      for (let q = p + 1; q < group.length; q += 1) {
        const pair = [areas[group[p]], areas[group[q]]];
        const other = lattices[group[q]];
        for (const a of lattices[group[p]].values()) {
          const { i, j } = g.node.ref[a];
          for (const [di, dj] of SAME_HEIGHT_OFFSETS) {
            const b = other.get(latticeKey(i + di, j + dj));
            if (b !== undefined && segmentWalkableAcross(pair, ...g.segment(a, b))) {
              g.addLink(a, b, ORIGIN.SAME_HEIGHT);
            }
          }
        }
      }
    }
  }

  // 6. Store crossings (AC-104), before the corrections.
  addStoreCrossings(g, layout, areas, doorNode);

  // 7. Corrections (AC-97, DC-6): REMOVE_PATH on what was generated, then ADD_PATH.
  removePaths(g, levels);
  const wallCrossings = addPaths(g, levels, areas, lattices, {
    snap: publish.addPathSnapM,
    spacing,
  });

  // 8. Clearance (AC-30).
  assignClearances(g, levels, areas, layout.buildings);

  // 9. Connector edges (AC-103): scenery has no landings, so no edge.
  for (const connector of layout.connectors) {
    const nodes = landingNodes.get(connector.index);
    if (!nodes) continue;
    const flags = connector.evacuationOnly ? EDGE_FLAG.EVACUATION : 0;
    for (const { from, to, oneWay } of connectorLinks(connector, levels)) {
      g.addLink(nodes[from], nodes[to], ORIGIN.CONNECTOR, { oneWay, ref: connector.index, flags });
    }
  }

  const csr = g.finalize();
  const final = (id) => csr.newId[id];
  return {
    csr,
    areas,
    wallSegments,
    doorNode: new Map([...doorNode].map(([key, id]) => [key, final(id)])),
    entranceNodes: entranceNodes.map(final).sort((p, q) => p - q),
    placePoint: new Map([...placePoint].map(([key, id]) => [key, final(id)])),
    placeUnit,
    landings: landings.map((l) => ({ ...l, node: final(l.node) })),
    offWalkway,
    wallCrossings,
  };
}

module.exports = { generateGraph };
