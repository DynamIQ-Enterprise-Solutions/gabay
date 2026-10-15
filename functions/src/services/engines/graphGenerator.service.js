// The walkway graph (spec/P0-03.md r4 AC-93 to AC-97 and AC-99, with AC-28, AC-30 and AC-31 kept; L32; L170 Q6;
// plan/FF-3-prime-A1.md 1.0 step 5). Generated from each level's walkable area (walkable.js) in the venue's one frame:
//   1. a square lattice at publish.nodeSpacingM anchored at the venue frame's origin (DC-19), a node at every
//      lattice point inside a level's walkable area, joined to its neighbours (GRAPH_NEIGHBOUR_MOVES: 8 and the 8
//      knight's moves) wherever the whole segment lies inside the area, so no walk edge crosses a wall (L92);
//   2. a node at every `door` opening's midpoint, joined through its channel to up to 4 lattice nodes it can see
//      within 2 x the spacing on each side of its wall (AC-95);
//   3. a node for every amenity, transit point and anchor reached at its own point, joined the same way; one that
//      names a non-walkable unit, or stands inside one, is reached through that unit's doors (A1's choice 9);
//   4. a landing node at each stop of every walkable connector, joined the same way (AC-96; scenery has none);
//   5. walk edges between levels of equal elevation at the same lattice point and its 4 axis neighbours (AC-28);
//   6. REMOVE_PATH cuts every walk edge its line touches, then ADD_PATH adds a node at each vertex and an edge
//      along each segment, each end joined to the nearest lattice, door or landing node within
//      publish.addPathSnapM; an ADD_PATH segment through a wall segment is kept and recorded for WALL_CROSSING (AC-97);
//   7. every edge's clearance (clearance.js, AC-30).
// Levels of one elevation are one floor (D6): a door, point or landing joins the lattice of every level at its
// elevation, so a building's entrance joins the outdoor level outside it (V-GEO-5). A door, place or landing node
// that joins nothing stays, with no edges (AC-99); a lattice node left with no edge is dropped (AC-97). Connector
// edges, store crossings and costs are A1′b's.
'use strict';

const planar = require('./geometry/planar');
const { createBucketIndex } = require('./geometry/bucketIndex');
const { codesOf } = require('../../config/closedSets');
const { levelWallSegments } = require('./walls');
const { createAreas, segmentWalkableAcross, BUCKET_CELL_M } = require('./walkable');
const { createClearance } = require('./clearance');
const { createGraphStore } = require('./graphStore');
const { GRAPH_NEIGHBOUR_MOVES, FORWARD_MOVES } = require('./constants');
const { NODE, ORIGIN } = require('./graphKinds');

const CORRECTION = codesOf('NavCorrectionKind');

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
/** A lattice index is rounded inward by this much, so a point a hair outside a rectangle's edge is not taken. */
const LATTICE_EPS = 1e-9;

// Lattice keys: (j + OFFSET) * SPAN + (i + OFFSET), exact for |i|, |j| below 2^20 node spacings (A1's).
const LATTICE_OFFSET = 2 ** 20;
const LATTICE_SPAN = 2 ** 21;
const latticeKey = (i, j) => (j + LATTICE_OFFSET) * LATTICE_SPAN + (i + LATTICE_OFFSET);

/** The lattice indexes from lo to hi metres (+ 0: never a -0 index, so never a -0 coordinate). */
const firstIndex = (lo, spacing) => Math.ceil(lo / spacing - LATTICE_EPS) + 0;
const lastIndex = (hi, spacing) => Math.floor(hi / spacing + LATTICE_EPS) + 0;

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

/**
 * @param {object} layout  readLayout's result
 * @param {{ nodeSpacingM: number, bodyMarginM: number, addPathSnapM: number }} publish  the publish.* settings
 * @param {{ neighbourMoves?: 8 | 16 }} [options]  16 in production; a test or the measurement may pass 8 (DC-A5)
 */
function generateGraph(layout, publish, { neighbourMoves = GRAPH_NEIGHBOUR_MOVES } = {}) {
  const moves = FORWARD_MOVES[neighbourMoves];
  if (!moves)
    throw new RangeError(`publish engine: neighbourMoves must be 8 or 16, not ${neighbourMoves}`);
  const spacing = publish.nodeSpacingM;
  const { levels } = layout;
  const wallSegments = new Map(levels.map((l) => [l.id, levelWallSegments(l)]));
  const areas = createAreas(layout, wallSegments, { margin: publish.bodyMarginM });
  const groups = elevationGroups(levels);
  const floorOf = (levelIndex) => groups.get(levels[levelIndex].elevation);
  const floorAreas = (levelIndex) => floorOf(levelIndex).map((i) => areas[i]);
  const g = createGraphStore();
  const lattices = levels.map(() => new Map());

  // 1. The lattice (AC-93).
  for (const level of levels) {
    const area = areas[level.index];
    const lattice = lattices[level.index];
    const { x0, z0, x1, z1 } = level.rect;
    for (let j = firstIndex(z0, spacing); j <= lastIndex(z1, spacing); j += 1) {
      for (let i = firstIndex(x0, spacing); i <= lastIndex(x1, spacing); i += 1) {
        if (!area.pointWalkable(i * spacing, j * spacing)) continue;
        lattice.set(
          latticeKey(i, j),
          g.addNode(level.index, i * spacing, j * spacing, NODE.GRID, { i, j }),
        );
      }
    }
    for (const a of lattice.values()) {
      const { i, j } = g.node.ref[a];
      for (const [di, dj] of moves) {
        const b = lattice.get(latticeKey(i + di, j + dj));
        if (b === undefined) continue;
        if (
          area.segmentWalkable(g.node.x.get(a), g.node.z.get(a), g.node.x.get(b), g.node.z.get(b))
        ) {
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
      const lattice = lattices[li];
      for (let j = firstIndex(z - reach, spacing); j <= lastIndex(z + reach, spacing); j += 1) {
        for (let i = firstIndex(x - reach, spacing); i <= lastIndex(x + reach, spacing); i += 1) {
          const id = lattice.get(latticeKey(i, j));
          if (id === undefined) continue;
          const d = Math.hypot(g.node.x.get(id) - x, g.node.z.get(id) - z);
          if (d <= reach + LATTICE_EPS) candidates.push({ id, d });
        }
      }
    }
    candidates.sort((p, q) => p.d - q.d || p.id - q.id);
    const taken = new Map();
    const floor = floorAreas(levelIndex);
    let joined = 0;
    for (const { id } of candidates) {
      const cx = g.node.x.get(id);
      const cz = g.node.z.get(id);
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
      const sideOf = (cx, cz) => planar.side(mx, mz, mx + ux, mz + uz, cx, cz);
      joinNearby(id, level.index, mx, mz, sideOf);
    }
  }

  // 3. Places reached at their own point (AC-95); the others through a non-walkable unit's doors (A1's choice 9).
  const placePoint = new Map();
  const placeUnit = new Map();
  for (const level of levels) {
    for (const point of [...level.amenities, ...level.transitPoints, ...level.anchors]) {
      const key = `${point.kind}:${point.id}`;
      const named = point.unit === null ? null : layout.unitById.get(point.unit);
      const unit =
        point.kind === 'transitPoint'
          ? null
          : named && !named.walkable
            ? named
            : innermostUnitAt(level, point.at[0], point.at[1]);
      if (unit) {
        placeUnit.set(key, unit.id);
        continue;
      }
      const id = g.addNode(level.index, point.at[0], point.at[1], NODE.PLACE, {
        kind: point.kind,
        id: point.id,
      });
      placePoint.set(key, id);
      joinNearby(id, level.index, point.at[0], point.at[1]);
    }
  }

  // 4. Connector landings (AC-96): a node per stop of a walkable connector; one that joins nothing is recorded.
  const landings = [];
  const offWalkway = [];
  for (const connector of layout.connectors) {
    if (!connector.walkable) continue;
    connector.stops.forEach(([x, z], stop) => {
      const levelIndex = connector.levels[stop];
      const id = g.addNode(levelIndex, x, z, NODE.CONNECTOR, { connectorId: connector.id, stop });
      landings.push({ connectorId: connector.id, stop, levelIndex, node: id });
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
            if (b === undefined) continue;
            const [ax, az, bx, bz] = [
              g.node.x.get(a),
              g.node.z.get(a),
              g.node.x.get(b),
              g.node.z.get(b),
            ];
            if (segmentWalkableAcross(pair, ax, az, bx, bz)) g.addLink(a, b, ORIGIN.SAME_HEIGHT);
          }
        }
      }
    }
  }

  // 6. Corrections (AC-97, DC-6): REMOVE_PATH on what was generated, then ADD_PATH.
  removePaths(g, levels);
  const wallCrossings = addPaths(g, levels, areas, lattices, publish.addPathSnapM, spacing);

  // 7. Clearance (AC-30): every link joins two levels of one elevation, so that floor's measure serves it.
  const measures = new Map();
  for (const [elevation, group] of groups) {
    measures.set(
      elevation,
      createClearance(
        group.map((i) => areas[i]),
        layout.buildings,
      ),
    );
  }
  const measureOf = (id) => measures.get(levels[g.node.level.get(id)].elevation);
  const nodeDistance = new Float64Array(g.nodeCount).fill(Number.NaN);
  const distanceAt = (id) => {
    if (Number.isNaN(nodeDistance[id])) {
      nodeDistance[id] = measureOf(id).pointDistance(g.node.x.get(id), g.node.z.get(id));
    }
    return nodeDistance[id];
  };
  for (let k = 0; k < g.linkCount; k += 1) {
    if (g.link.removed.get(k)) continue;
    const a = g.link.a.get(k);
    const b = g.link.b.get(k);
    const bound = Math.min(distanceAt(a), distanceAt(b));
    const [ax, az, bx, bz] = [g.node.x.get(a), g.node.z.get(a), g.node.x.get(b), g.node.z.get(b)];
    g.link.clearance.set(k, measureOf(a).clearance(ax, az, bx, bz, bound));
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

/** REMOVE_PATH (DC-6, AC-97): every walk edge on the correction's level that its line touches is removed. */
function removePaths(g, levels) {
  const lines = levels.flatMap((level) =>
    level.corrections
      .filter((c) => c.kind === CORRECTION.REMOVE_PATH)
      .map((c) => ({ levelIndex: level.index, line: c.line })),
  );
  if (lines.length === 0) return;
  const index = createBucketIndex(BUCKET_CELL_M);
  const ends = (k) => [g.link.a.get(k), g.link.b.get(k)];
  for (let k = 0; k < g.linkCount; k += 1) {
    const [a, b] = ends(k);
    const [ax, az, bx, bz] = [g.node.x.get(a), g.node.z.get(a), g.node.x.get(b), g.node.z.get(b)];
    index.insert(k, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
  }
  const E = planar.EPS;
  for (const { levelIndex, line } of lines) {
    for (let s = 1; s < line.length; s += 1) {
      const [cx, cz] = line[s - 1];
      const [dx, dz] = line[s];
      index.query(
        Math.min(cx, dx) - E,
        Math.min(cz, dz) - E,
        Math.max(cx, dx) + E,
        Math.max(cz, dz) + E,
        (k) => {
          if (g.link.removed.get(k) || g.linkOrigin(k) === ORIGIN.ADD_PATH) return false;
          const [a, b] = ends(k);
          if (g.node.level.get(a) !== levelIndex && g.node.level.get(b) !== levelIndex)
            return false;
          const [ax, az, bx, bz] = [
            g.node.x.get(a),
            g.node.z.get(a),
            g.node.x.get(b),
            g.node.z.get(b),
          ];
          if (planar.segmentsMeet(ax, az, bx, bz, cx, cz, dx, dz)) g.link.removed.set(k, 1);
          return false;
        },
      );
    }
  }
}

/**
 * ADD_PATH (DC-6, AC-97): a node at each vertex and an edge along each segment; each end also joins the nearest
 * lattice, door or landing node of its level within `snap` (ties by distance, then node order). A segment that
 * crosses a wall segment (AC-94) is kept and returned for WALL_CROSSING, with its first crossing point.
 */
function addPaths(g, levels, areas, lattices, snap, spacing) {
  const crossings = [];
  const joinable = new Set([NODE.DOOR, NODE.CONNECTOR]);
  const specials = levels.map(() => []);
  for (let id = 0; id < g.nodeCount; id += 1) {
    if (joinable.has(g.nodeKind(id))) specials[g.node.level.get(id)].push(id);
  }
  /** Node order on one level: kind (graphKinds.js), then document order (DC-A10). */
  const before = (p, q) =>
    g.node.kind.get(p) - g.node.kind.get(q) || g.node.seq.get(p) - g.node.seq.get(q);

  function nearestNode(levelIndex, x, z) {
    const candidates = [...specials[levelIndex]];
    const lattice = lattices[levelIndex];
    for (let j = firstIndex(z - snap, spacing); j <= lastIndex(z + snap, spacing); j += 1) {
      for (let i = firstIndex(x - snap, spacing); i <= lastIndex(x + snap, spacing); i += 1) {
        const id = lattice.get(latticeKey(i, j));
        if (id !== undefined) candidates.push(id);
      }
    }
    let best = null;
    for (const id of candidates) {
      const d = Math.hypot(g.node.x.get(id) - x, g.node.z.get(id) - z);
      if (d > snap + LATTICE_EPS) continue;
      if (!best || d < best.d || (d === best.d && before(id, best.id) < 0)) best = { id, d };
    }
    return best ? best.id : null;
  }

  for (const level of levels) {
    const area = areas[level.index];
    for (const correction of level.corrections) {
      if (correction.kind !== CORRECTION.ADD_PATH) continue;
      const ids = correction.line.map(([x, z], vertex) =>
        g.addNode(level.index, x, z, NODE.ADD_PATH, { correctionId: correction.id, vertex }),
      );
      const links = [];
      for (let k = 1; k < ids.length; k += 1) links.push([ids[k - 1], ids[k]]);
      for (const end of new Set([ids[0], ids[ids.length - 1]])) {
        const near = nearestNode(level.index, g.node.x.get(end), g.node.z.get(end));
        if (near !== null) links.push([end, near]);
      }
      for (const [a, b] of links) {
        const [ax, az, bx, bz] = [
          g.node.x.get(a),
          g.node.z.get(a),
          g.node.x.get(b),
          g.node.z.get(b),
        ];
        if (g.addLink(a, b, ORIGIN.ADD_PATH) < 0) continue;
        const hit = area.crossesWall(ax, az, bx, bz);
        if (hit) {
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
  }
  return crossings;
}

module.exports = { generateGraph, JOIN_RADIUS_SPACINGS, JOIN_MAX_NODES };
