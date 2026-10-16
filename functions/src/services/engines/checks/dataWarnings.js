// The data warnings (spec/P0-03.md r4 AC-112; each a warning, never a refusal):
//   - CONNECTOR_OFF_WALKWAY (AC-96): a landing of a walkable connector that joins no walkway; its connector edges are
//     still written. One per stop;
//   - CONNECTOR_NO_RISE (AC-101, DC-35; OA-1 EC-30): a walkable connector with an edge between two levels of one
//     elevation, which costs the type's base time alone. One per connector, naming every such pair of levels;
//   - OUTSIDE_BOUNDARY (invariant 10; r3 AC-16 as a warning): each element not inside `site.boundary`, a point on the
//     line counting as inside (DC-12, kept): units and corrections (any vertex), openings (the midpoint), items (the
//     centre), amenities, transit points and anchors (the point), connector stops (one per stop) and active beacons
//     on a level of the layout (their x and z; a beacon on no level has BEACON_LEVEL_MISSING instead);
//   - SHAPE_SELF_CROSSING (OA-1 DC-16, EC-27): a polygon whose outline crosses itself: a unit, a BLOCK_AREA, a
//     building's footprint or the site boundary.
'use strict';

const planar = require('../geometry/planar');
const { ringSelfCrosses } = require('../geometry/shapes');
const { connectorLinks } = require('../connectorRules');
const { KIND } = require('../findings');
const { elementRef, at, documentRank, CONNECTOR_RANK, ROW_RANK } = require('../elements');

/** The landings that join no walkway (the generator's record, AC-96). */
function checkOffWalkway(findings, layout, graph) {
  for (const { connector, stop, levelIndex, at: point } of graph.offWalkway) {
    findings.add(KIND.CONNECTOR_OFF_WALKWAY, {
      level: layout.levels[levelIndex],
      element: elementRef('connector', connector),
      at: at(point),
      params: { stop },
      order: [CONNECTOR_RANK, connector.index, stop],
    });
  }
}

function checkNoRise(findings, layout) {
  const { levels } = layout;
  for (const connector of layout.connectors) {
    const flat = connectorLinks(connector, levels).filter(
      ({ from, to }) =>
        levels[connector.levels[from]].elevation === levels[connector.levels[to]].elevation,
    );
    if (flat.length === 0) continue;
    const [first] = flat;
    findings.add(KIND.CONNECTOR_NO_RISE, {
      level: levels[connector.levels[first.from]],
      element: elementRef('connector', connector),
      at: at(connector.stops[first.from]),
      order: [CONNECTOR_RANK, connector.index],
      params: {
        levels: flat.map(({ from, to }) => [
          levels[connector.levels[from]].id,
          levels[connector.levels[to]].id,
        ]),
      },
    });
  }
}

/** The first point of `points` outside the boundary ring, or null (on the line is inside, DC-12). */
function firstOutside(points, boundary) {
  return points.find(([x, z]) => planar.pointInRing(x, z, boundary) === 'outside') ?? null;
}

function checkBoundary(findings, layout, beacons) {
  const boundary = layout.site.boundary;
  const outside = (fields, points) => {
    const point = firstOutside(points, boundary);
    if (point !== null) findings.add(KIND.OUTSIDE_BOUNDARY, { ...fields, at: at(point) });
  };
  for (const level of layout.levels) {
    const element = (kind, e) => ({
      level,
      element: elementRef(kind, e),
      order: [documentRank(kind), e.index],
    });
    for (const opening of level.openings) outside(element('opening', opening), [opening.mid]);
    for (const unit of level.units) outside(element('unit', unit), unit.ring);
    for (const item of level.items) outside(element('item', item), [[item.x, item.z]]);
    for (const c of level.corrections) outside(element('correction', c), c.ring ?? c.line);
    for (const p of [...level.amenities, ...level.transitPoints, ...level.anchors]) {
      outside(element(p.kind, p), [p.at]);
    }
  }
  for (const connector of layout.connectors) {
    connector.stops.forEach((stop, i) =>
      outside(
        {
          level: layout.levels[connector.levels[i]],
          element: elementRef('connector', connector),
          order: [CONNECTOR_RANK, connector.index, i],
          params: { stop: i },
        },
        [stop],
      ),
    );
  }
  for (const beacon of beacons) {
    const level = layout.levelById.get(beacon.levelKey);
    if (!beacon.isActive || !level) continue;
    outside(
      {
        level,
        element: { kind: 'beacon', id: String(beacon.beaconId), name: null },
        order: [ROW_RANK, beacon.beaconId],
      },
      [[beacon.x, beacon.y]],
    );
  }
}

function checkSelfCrossing(findings, layout) {
  const crossing = (fields, ring) => {
    if (ringSelfCrosses(ring))
      findings.add(KIND.SHAPE_SELF_CROSSING, { ...fields, at: at(ring[0]) });
  };
  crossing({ params: { shape: 'boundary' } }, layout.site.boundary);
  for (const building of layout.buildings) {
    if (building.footprint) {
      crossing(
        { element: elementRef('building', building), order: [building.index] },
        building.footprint,
      );
    }
  }
  for (const level of layout.levels) {
    for (const unit of level.units) {
      crossing(
        { level, element: elementRef('unit', unit), order: [documentRank('unit'), unit.index] },
        unit.ring,
      );
    }
    for (const c of level.corrections) {
      if (!c.ring) continue;
      crossing(
        {
          level,
          element: elementRef('correction', c),
          order: [documentRank('correction'), c.index],
        },
        c.ring,
      );
    }
  }
}

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object} graph  generateGraph's result
 * @param {object[]} beacons  the snapshot's beacon rows
 */
function checkDataWarnings(findings, layout, graph, beacons) {
  checkOffWalkway(findings, layout, graph);
  checkNoRise(findings, layout);
  checkBoundary(findings, layout, beacons);
  checkSelfCrossing(findings, layout);
}

module.exports = { checkDataWarnings };
