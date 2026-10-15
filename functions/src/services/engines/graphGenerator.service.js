// The walkway graph (spec/P0-03.md r2 §3.4, AC-24 to AC-32; L32; plan/FF-3-publish-engine.md 1.0 §3, DC-P3).
// Generated from each level's walkable area plus the admin's corrections, in the venue's one frame (E10):
//   1. a square grid per level at publish.nodeSpacingM, keeping walkable points, each joined to its 8 neighbours and
//      8 knight's-move neighbours where the straight segment stays walkable (and so crosses no wall, D4);
//   2. a node at each door gap of a place's unit or a walk-through store, and at each venue entrance, joined through
//      the gap to the nearest walkable grid nodes it can reach in a straight walkable line (AC-25);
//   3. a node at each connector end and lift stop, joined the same way (AC-26; AC-15(c) when it cannot be);
//   4. a node at each amenity, transit point and anchor that stands on the walkable area (AC-13: reached at its own
//      position); one inside a non-walkable unit is reached through that unit's doors instead;
//   5. walk edges between levels of equal ElevationM where their walkable areas touch or overlap (ruled D6, AC-28);
//   6. connector edges (connectorCosting.js) and walk-through store crossings (storeCrossings.js);
//   7. REMOVE_PATH cuts every generated edge its line meets, then ADD_PATH adds its walkways, each end snapped to the
//      nearest node within publish.addPathSnapM (DC-6, AC-27); a segment through a wall is not added and is
//      recorded for AC-12;
//   8. each walk and store edge's clearance: twice its distance to the nearest edge of the walkable area (walls, and
//      its outline beside undrawn floor or a BLOCK_AREA; clearance.js), a door edge no wider than the door's
//      ClearWidthM where it is measured (AC-30).
// Node ids are deterministic (AC-31, DC-3): levels by (Ordinal, LevelId); in a level, grid nodes row by row, then
// door, connector, place, store and ADD_PATH nodes in the order of their row ids. A grid node left with no edge is
// dropped (finalize).
'use strict';

const { codesOf } = require('../../config/closedSets');
const planar = require('./geometry/planar');
const { buildLevelWalls } = require('./walls');
const { createLevelArea, segmentWalkable, segmentWalkableAcross } = require('./walkable');
const { isBuildable, isLift } = require('./connectorRules');
const { addConnectorEdges } = require('./connectorCosting');
const { addStoreCrossings } = require('./storeCrossings');
const { createClearance } = require('./clearance');
const { NODE, ORIGIN } = require('./graphKinds');

const EDGE = codesOf('GraphEdgeKind');
const CORRECTION = codesOf('NavCorrectionKind');

const NODE_ORDER = new Map(Object.values(NODE).map((kind, i) => [kind, i]));
const EDGE_ORDER = new Map(
  [EDGE.WALK, EDGE.CONNECTOR, EDGE.STORE_CROSSING].map((kind, i) => [kind, i]),
);

/** The 8 of a node's 16 neighbours that come after it in row order (the other 8 join it from their side). */
const FORWARD_NEIGHBOURS = Object.freeze([
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [-2, 1],
  [-1, 2],
  [1, 2],
  [2, 1],
]);
/** Same-height joins: the node at the same lattice point on the other level, and its four axis neighbours. */
const SAME_HEIGHT_OFFSETS = Object.freeze([
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);
/** A door, connector end or place joins grid nodes within this many node spacings... */
const JOIN_RADIUS_SPACINGS = 2;
/** ...and at most this many of them, nearest first. */
const JOIN_MAX_NODES = 4;

// Lattice keys: (j + OFFSET) * SPAN + (i + OFFSET), exact for |i|, |j| below 2^20 node spacings.
const LATTICE_OFFSET = 2 ** 20;
const LATTICE_SPAN = 2 ** 21;
const latticeKey = (i, j) => (j + LATTICE_OFFSET) * LATTICE_SPAN + (i + LATTICE_OFFSET);
const PAIR_SPAN = 2 ** 26;

function createBuilder() {
  const nodes = [];
  const links = [];
  const walkPairs = new Set();
  return {
    nodes,
    links,
    addNode(levelId, x, y, kind, ref) {
      nodes.push({ id: nodes.length, levelId, x, y, kind, ref });
      return nodes.length - 1;
    },
    /** One undirected (or one-way) link; a second walk link between the same two nodes is ignored. */
    addLink(link) {
      if (link.kind === EDGE.WALK) {
        // A number, not a string: a big venue has hundreds of thousands of these (exact below 2^26 nodes).
        const key = Math.min(link.a, link.b) * PAIR_SPAN + Math.max(link.a, link.b);
        if (walkPairs.has(key)) return;
        walkPairs.add(key);
      }
      links.push({
        connectorId: null,
        unitId: null,
        evacuationOnly: false,
        oneWay: false,
        doorWidth: null,
        clearance: null,
        removed: false,
        ...link,
      });
    },
  };
}

function groupBy(rows, keyOf) {
  const out = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  }
  return out;
}
const groupByLevel = (rows) => groupBy(rows, (row) => row.levelId);

/**
 * @param {object} venue  the parsed draft, its shapes read (validation/shapes.js)
 * @returns {object}  the graph: nodes, directed edges, walls per level, and the indexes validation and the package
 *   model read (doors, connector nodes, places, store door groups, ADD_PATH wall crossings, unjoined connector ends)
 */
function generateGraph(venue) {
  const spacing = venue.settings.nodeSpacingM;
  const levels = [...venue.levels].sort((a, b) => a.ordinal - b.ordinal || a.id - b.id);
  const levelRank = new Map(levels.map((l, i) => [l.id, i]));
  const ordinalOf = new Map(levels.map((l) => [l.id, l.ordinal]));
  const levelIds = new Set(levels.map((l) => l.id));
  const unitsById = new Map(venue.units.map((u) => [u.id, u]));
  const byLevel = {
    units: groupByLevel(venue.units),
    openings: groupByLevel(venue.openings),
    floorObjects: groupByLevel(venue.floorObjects),
    corrections: groupByLevel(venue.corrections.filter((c) => c.kind === CORRECTION.BLOCK_AREA)),
  };

  const walls = new Map();
  const areas = new Map();
  for (const level of levels) {
    const rows = {
      units: byLevel.units.get(level.id) ?? [],
      openings: byLevel.openings.get(level.id) ?? [],
      floorObjects: byLevel.floorObjects.get(level.id) ?? [],
      corrections: byLevel.corrections.get(level.id) ?? [],
    };
    walls.set(level.id, buildLevelWalls(rows));
    areas.set(level.id, createLevelArea({ ...rows, walls: walls.get(level.id) }));
  }
  // Levels of one ElevationM are one floor (ruled D6): joined where they meet, and measured together for clearance.
  const byHeight = groupBy(levels, (l) => l.elevationM);
  const clearanceOf = new Map();
  for (const group of byHeight.values()) {
    const measure = createClearance(
      group.map((l) => ({
        area: areas.get(l.id),
        units: byLevel.units.get(l.id) ?? [],
        openings: byLevel.openings.get(l.id) ?? [],
        corrections: byLevel.corrections.get(l.id) ?? [],
      })),
    );
    for (const l of group) clearanceOf.set(l.id, measure);
  }

  const g = createBuilder();
  const grids = new Map(levels.map((l) => [l.id, new Map()]));
  const specialNodes = new Map(levels.map((l) => [l.id, []]));
  const addSpecial = (levelId, x, y, kind, ref) => {
    const id = g.addNode(levelId, x, y, kind, ref);
    specialNodes.get(levelId).push(id);
    return id;
  };

  // 1. The grid (AC-24, AC-29, AC-32).
  for (const level of levels) {
    const area = areas.get(level.id);
    const grid = grids.get(level.id);
    const tested = new Set();
    const points = [];
    for (const unit of byLevel.units.get(level.id) ?? []) {
      if (!unit.isWalkable || !unit.area) continue;
      const [minX, minY, maxX, maxY] = planar.boundsOf(unit.area.flatMap((p) => p[0]));
      // + 0 turns a -0 index (Math.ceil of a tiny negative) into 0, so no coordinate is ever -0.
      for (
        let j = Math.ceil(minY / spacing - 1e-9) + 0;
        j <= Math.floor(maxY / spacing + 1e-9);
        j += 1
      ) {
        for (
          let i = Math.ceil(minX / spacing - 1e-9) + 0;
          i <= Math.floor(maxX / spacing + 1e-9);
          i += 1
        ) {
          const key = latticeKey(i, j);
          if (tested.has(key)) continue;
          tested.add(key);
          if (area.pointWalkable(i * spacing, j * spacing)) points.push([i, j]);
        }
      }
    }
    points.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    for (const [i, j] of points)
      grid.set(
        latticeKey(i, j),
        g.addNode(level.id, i * spacing, j * spacing, NODE.GRID, { i, j }),
      );
    for (const [i, j] of points) {
      const a = grid.get(latticeKey(i, j));
      for (const [di, dj] of FORWARD_NEIGHBOURS) {
        const b = grid.get(latticeKey(i + di, j + dj));
        if (b === undefined) continue;
        const [p, q] = [g.nodes[a], g.nodes[b]];
        if (!segmentWalkable(area, p.x, p.y, q.x, q.y)) continue;
        const length = Math.hypot(q.x - p.x, q.y - p.y);
        g.addLink({ a, b, kind: EDGE.WALK, origin: ORIGIN.GRID, length, cost: length });
      }
    }
  }

  /** The nearest grid nodes on the level that a straight walkable line from (x, y) reaches (AC-25, AC-26). */
  function joinToGrid(levelId, x, y) {
    const grid = grids.get(levelId);
    const area = areas.get(levelId);
    if (!grid || !area || !area.pointWalkable(x, y)) return [];
    const reach = JOIN_RADIUS_SPACINGS * spacing;
    const candidates = [];
    for (let j = Math.ceil((y - reach) / spacing); j <= Math.floor((y + reach) / spacing); j += 1) {
      for (
        let i = Math.ceil((x - reach) / spacing);
        i <= Math.floor((x + reach) / spacing);
        i += 1
      ) {
        const id = grid.get(latticeKey(i, j));
        if (id === undefined) continue;
        const d = Math.hypot(g.nodes[id].x - x, g.nodes[id].y - y);
        if (d <= reach + 1e-9) candidates.push({ id, d });
      }
    }
    candidates.sort((p, q) => p.d - q.d || p.id - q.id);
    const joined = [];
    for (const c of candidates) {
      if (joined.length === JOIN_MAX_NODES) break;
      if (segmentWalkable(area, x, y, g.nodes[c.id].x, g.nodes[c.id].y)) joined.push(c.id);
    }
    return joined;
  }
  const joinLinks = (nodeId, joins, doorWidth = null) => {
    for (const other of joins) {
      const [p, q] = [g.nodes[nodeId], g.nodes[other]];
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      g.addLink({
        a: nodeId,
        b: other,
        kind: EDGE.WALK,
        origin: ORIGIN.JOIN,
        length,
        cost: length,
        doorWidth,
      });
    }
  };

  // Where each amenity, transit point and anchor is reached (AC-13): at its own position when that is walkable,
  // else through the doors of the non-walkable unit it stands in (its own UnitId first, else the innermost one).
  const innermostUnitAt = (levelId, x, y) => {
    let best = null;
    for (const unit of byLevel.units.get(levelId) ?? []) {
      if (unit.isWalkable || !unit.area || planar.pointInArea(x, y, unit.area) === 'outside')
        continue;
      const size = unit.area.reduce((sum, p) => sum + Math.abs(planar.ringArea2(p[0])), 0);
      if (!best || size < best.size) best = { unit, size };
    }
    return best ? best.unit : null;
  };
  const pointPlaces = [];
  for (const [table, rows] of [
    ['Amenity', venue.amenities],
    ['TransitPoint', venue.transitPoints],
    ['Anchor', venue.anchors],
  ]) {
    for (const row of rows) {
      const own =
        row.unitId === undefined || row.unitId === null ? null : unitsById.get(row.unitId);
      const area = areas.get(row.levelId);
      let target;
      if (own && !own.isWalkable && own.area) target = { unitId: own.id };
      else if (area && area.pointWalkable(row.x, row.y)) target = { atPosition: true };
      else {
        const unit = innermostUnitAt(row.levelId, row.x, row.y);
        target = unit ? { unitId: unit.id } : {};
      }
      pointPlaces.push({ table, row, ...target });
    }
  }

  // 2. Door and entrance nodes (AC-25): the doors of every unit that holds a place (and of the units around it,
  // for a nested section reached through its parent, EC-29) and of every walk-through store.
  const doorUnits = new Set();
  const withParents = (unitId) => {
    let unit = unitsById.get(unitId);
    while (unit && !doorUnits.has(unit.id)) {
      doorUnits.add(unit.id);
      unit = unit.parentId === null ? null : unitsById.get(unit.parentId);
    }
  };
  for (const o of venue.occupants) if (o.isActive) withParents(o.unitId);
  for (const p of pointPlaces) if (p.unitId !== undefined) withParents(p.unitId);
  for (const u of venue.units) if (u.passThrough && !u.isWalkable) doorUnits.add(u.id);

  const openingNode = new Map();
  for (const opening of venue.openings) {
    if (!opening.line || !grids.has(opening.levelId)) continue;
    if (!opening.isEntrance && !(opening.unitId !== null && doorUnits.has(opening.unitId)))
      continue;
    const [x, y] = planar.polylineMidpoint(opening.line);
    const joins = joinToGrid(opening.levelId, x, y);
    if (joins.length === 0 && !opening.isEntrance) continue; // a door facing another room joins nothing
    const id = addSpecial(opening.levelId, x, y, NODE.DOOR, { openingId: opening.id });
    openingNode.set(opening.id, id);
    joinLinks(id, joins, opening.clearWidthM);
  }

  // 3. Connector ends and lift stops (AC-26); one that cannot join is AC-15(c).
  const stopsByConnector = groupBy(venue.connectorStops, (s) => s.connectorId);
  const connectorEnds = new Map();
  const unjoinedConnectorEnds = [];
  const connectorNodes = [];
  for (const connector of venue.connectors) {
    const type = venue.lookups.connectorTypes.get(connector.typeId);
    const stops = stopsByConnector.get(connector.id) ?? [];
    if (!isBuildable(connector, type, stops, levelIds)) continue; // AC-15(a) or (b): refused, nothing to build
    const ends = isLift(type)
      ? stops.map((s) => ({ stopId: s.id, levelId: s.levelId, x: s.x, y: s.y, isFrom: false }))
      : [
          {
            stopId: null,
            levelId: connector.fromLevelId,
            x: connector.fromX,
            y: connector.fromY,
            isFrom: true,
          },
          {
            stopId: null,
            levelId: connector.toLevelId,
            x: connector.toX,
            y: connector.toY,
            isFrom: false,
          },
        ];
    const built = [];
    for (const end of ends) {
      if (!grids.has(end.levelId)) continue;
      const id = addSpecial(end.levelId, end.x, end.y, NODE.CONNECTOR, {
        connectorId: connector.id,
        stopId: end.stopId,
      });
      const joins = joinToGrid(end.levelId, end.x, end.y);
      if (joins.length === 0) unjoinedConnectorEnds.push({ connectorId: connector.id, ...end });
      joinLinks(id, joins);
      built.push({ nodeId: id, levelId: end.levelId, isFrom: end.isFrom });
      connectorNodes.push({
        connectorId: connector.id,
        stopId: end.stopId,
        levelId: end.levelId,
        nodeId: id,
      });
    }
    connectorEnds.set(connector.id, built);
  }

  // 4. Places at their own position (AC-13); the others are reached through a unit's doors.
  const placeNode = new Map();
  const placeUnit = new Map();
  for (const place of pointPlaces) {
    if (place.unitId !== undefined) placeUnit.set(`${place.table}:${place.row.id}`, place.unitId);
    if (!place.atPosition) continue;
    const { row, table } = place;
    const id = addSpecial(row.levelId, row.x, row.y, NODE.PLACE, { table, id: row.id });
    placeNode.set(`${table}:${row.id}`, id);
    joinLinks(id, joinToGrid(row.levelId, row.x, row.y));
  }

  // 5. Same-height joins (ruled D6, AC-28).
  for (const group of byHeight.values()) {
    for (let p = 0; p < group.length; p += 1) {
      for (let q = p + 1; q < group.length; q += 1) {
        const [A, B] = [group[p], group[q]];
        const pair = [areas.get(A.id), areas.get(B.id)];
        const gridB = grids.get(B.id);
        for (const a of grids.get(A.id).values()) {
          const { i, j } = g.nodes[a].ref;
          for (const [di, dj] of SAME_HEIGHT_OFFSETS) {
            const b = gridB.get(latticeKey(i + di, j + dj));
            if (b === undefined) continue;
            const [na, nb] = [g.nodes[a], g.nodes[b]];
            if (!segmentWalkableAcross(pair, na.x, na.y, nb.x, nb.y)) continue;
            const length = Math.hypot(nb.x - na.x, nb.y - na.y);
            g.addLink({ a, b, kind: EDGE.WALK, origin: ORIGIN.SAME_HEIGHT, length, cost: length });
          }
        }
      }
    }
  }

  // 6. Connector edges (AC-33 to AC-35) and walk-through store crossings (AC-37, AC-38).
  addConnectorEdges(venue, connectorEnds, g);
  const stores = addStoreCrossings(venue, areas, openingNode, {
    nodes: g.nodes,
    addLink: g.addLink,
    addNode: (levelId, x, y, kind, ref) => addSpecial(levelId, x, y, kind, ref),
  });

  // 7. Corrections (DC-6, AC-27): REMOVE_PATH on the generated edges, then ADD_PATH.
  for (const correction of venue.corrections) {
    if (correction.kind !== CORRECTION.REMOVE_PATH || !correction.line) continue;
    removeAlong(g, correction);
  }
  const addPathCrossings = [];
  for (const correction of venue.corrections) {
    if (
      correction.kind !== CORRECTION.ADD_PATH ||
      !correction.line ||
      !grids.has(correction.levelId)
    )
      continue;
    addPath(correction);
  }

  function nearestNode(levelId, x, y, reach) {
    const candidates = [];
    const grid = grids.get(levelId);
    for (
      let j = Math.ceil((y - reach) / spacing - 1e-9);
      j <= Math.floor((y + reach) / spacing + 1e-9);
      j += 1
    ) {
      for (
        let i = Math.ceil((x - reach) / spacing - 1e-9);
        i <= Math.floor((x + reach) / spacing + 1e-9);
        i += 1
      ) {
        const id = grid.get(latticeKey(i, j));
        if (id !== undefined) candidates.push(id);
      }
    }
    for (const id of specialNodes.get(levelId))
      if (g.nodes[id].kind !== NODE.STORE_INSIDE) candidates.push(id);
    let best = null;
    for (const id of candidates) {
      const d = Math.hypot(g.nodes[id].x - x, g.nodes[id].y - y);
      if (d > reach + 1e-9) continue;
      if (!best || d < best.d || (d === best.d && id < best.id)) best = { id, d };
    }
    return best ? best.id : null;
  }

  function addPath(correction) {
    const { levelId, line } = correction;
    const snap = venue.settings.addPathSnapM;
    const ids = line.map(([x, y], k) => {
      const end = k === 0 || k === line.length - 1;
      const snapped = end ? nearestNode(levelId, x, y, snap) : null;
      return (
        snapped ??
        addSpecial(levelId, x, y, NODE.ADD_PATH, { correctionId: correction.id, vertex: k })
      );
    });
    const area = areas.get(levelId);
    for (let k = 1; k < ids.length; k += 1) {
      const [p, q] = [g.nodes[ids[k - 1]], g.nodes[ids[k]]];
      if (p.id === q.id) continue;
      const hit = area.crossesWall(p.x, p.y, q.x, q.y);
      if (hit) {
        addPathCrossings.push({
          correctionId: correction.id,
          levelId,
          at: { x: hit.x, y: hit.y },
          segment: [
            [p.x, p.y],
            [q.x, q.y],
          ],
        });
        continue;
      }
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      g.addLink({
        a: p.id,
        b: q.id,
        kind: EDGE.WALK,
        origin: ORIGIN.ADD_PATH,
        length,
        cost: length,
      });
    }
  }

  // 8. Clearance (AC-30): from the walkable area's edges at this height (clearance.js). Both ends of a walk or store
  // edge are on levels of one height, so one measure serves it.
  for (const link of g.links) {
    if (link.removed || link.kind === EDGE.CONNECTOR) continue;
    const [p, q] = [g.nodes[link.a], g.nodes[link.b]];
    const distance = clearanceOf.get(p.levelId).distance(p.x, p.y, q.x, q.y);
    link.clearance =
      link.doorWidth === null ? 2 * distance : Math.min(2 * distance, link.doorWidth);
  }

  return finalize(g, {
    levelRank,
    ordinalOf,
    walls,
    levels,
    openingNode,
    connectorNodes,
    placeNode,
    placeUnit,
    stores,
    addPathCrossings,
    unjoinedConnectorEnds,
    areas,
  });
}

/** REMOVE_PATH (DC-6): every generated walk or store edge on the correction's level that its line meets is removed. */
function removeAlong(g, correction) {
  const { levelId, line } = correction;
  for (const link of g.links) {
    if (link.removed || link.kind === EDGE.CONNECTOR || link.origin === ORIGIN.ADD_PATH) continue;
    const [p, q] = [g.nodes[link.a], g.nodes[link.b]];
    if (p.levelId !== levelId && q.levelId !== levelId) continue;
    for (let k = 1; k < line.length; k += 1) {
      const [cx, cy] = line[k - 1];
      const [dx, dy] = line[k];
      if (
        Math.max(p.x, q.x) < Math.min(cx, dx) - planar.EPS ||
        Math.min(p.x, q.x) > Math.max(cx, dx) + planar.EPS
      )
        continue;
      if (
        Math.max(p.y, q.y) < Math.min(cy, dy) - planar.EPS ||
        Math.min(p.y, q.y) > Math.max(cy, dy) + planar.EPS
      )
        continue;
      if (planar.segmentsMeet(p.x, p.y, q.x, q.y, cx, cy, dx, dy)) {
        link.removed = true;
        break;
      }
    }
  }
}

/**
 * Renumbers the nodes in their deterministic order (AC-31) and turns the links into directed edges. A grid node left
 * with no edge at all (a REMOVE_PATH drawn through it, or a pocket of floor too small to join) is not a walkway and is
 * dropped; every other node is kept, because a door, connector, place or correction refers to it.
 */
function finalize(g, ctx) {
  const degree = new Uint32Array(g.nodes.length);
  for (const link of g.links) {
    if (link.removed) continue;
    degree[link.a] += 1;
    degree[link.b] += 1;
  }
  const order = g.nodes
    .filter((n) => n.kind !== NODE.GRID || degree[n.id] > 0)
    .map((n) => n.id)
    .sort((a, b) => {
      const [p, q] = [g.nodes[a], g.nodes[b]];
      return (
        ctx.levelRank.get(p.levelId) - ctx.levelRank.get(q.levelId) ||
        NODE_ORDER.get(p.kind) - NODE_ORDER.get(q.kind) ||
        a - b
      );
    });
  const newId = new Array(g.nodes.length);
  order.forEach((old, i) => {
    newId[old] = i;
  });
  const nodes = order.map((old, i) => {
    const n = g.nodes[old];
    // + 0: a canonical zero, never -0, in what the package will carry.
    return {
      id: i,
      levelId: n.levelId,
      ordinal: ctx.ordinalOf.get(n.levelId),
      x: n.x + 0,
      y: n.y + 0,
      kind: n.kind,
      ref: n.ref,
    };
  });
  const edges = [];
  for (const link of g.links) {
    if (link.removed) continue;
    const base = {
      kind: link.kind,
      cost: link.cost,
      length: link.length,
      clearance: link.clearance,
      connectorId: link.connectorId,
      unitId: link.unitId,
      evacuationOnly: link.evacuationOnly,
      origin: link.origin,
    };
    edges.push({ from: newId[link.a], to: newId[link.b], ...base });
    if (!link.oneWay) edges.push({ from: newId[link.b], to: newId[link.a], ...base });
  }
  edges.sort(
    (e, f) =>
      e.from - f.from ||
      e.to - f.to ||
      EDGE_ORDER.get(e.kind) - EDGE_ORDER.get(f.kind) ||
      (e.connectorId ?? 0) - (f.connectorId ?? 0) ||
      (e.unitId ?? 0) - (f.unitId ?? 0),
  );
  const remap = (map) => new Map([...map.entries()].map(([k, v]) => [k, newId[v]]));
  return {
    nodes,
    edges,
    walls: new Map(ctx.levels.map((l) => [l.id, ctx.walls.get(l.id)])),
    areas: ctx.areas,
    openingNode: remap(ctx.openingNode),
    placeNode: remap(ctx.placeNode),
    placeUnit: ctx.placeUnit,
    connectorNodes: ctx.connectorNodes
      .map((c) => ({ ...c, nodeId: newId[c.nodeId] }))
      .sort((a, b) => a.connectorId - b.connectorId || a.nodeId - b.nodeId),
    stores: ctx.stores.map((s) => ({
      unitId: s.unitId,
      doorGroups: s.doorGroups.map((grp) => grp.map((id) => newId[id]).sort((a, b) => a - b)),
    })),
    addPathCrossings: ctx.addPathCrossings,
    unjoinedConnectorEnds: ctx.unjoinedConnectorEnds,
  };
}

module.exports = { generateGraph };
