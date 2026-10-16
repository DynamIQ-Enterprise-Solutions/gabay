// UNREVIEWED (spec/P0-03.md r4 AC-113; L170 Q3, which reverses r3 AC-11 and the L108 gate; DC-24; a warning): one
// finding per element whose `review` flag is true, any kind that carries it (OA-1 DC-17: buildings, every level
// element and connectors), with its kind, id, name and level, in document order. Hundreds are all returned (EC-78).
// The flag itself never reaches the package (AC-46, AC-116).
'use strict';

const planar = require('../geometry/planar');
const { KIND } = require('../findings');
const { elementRef, at, ARRAY_OF, documentRank, CONNECTOR_RANK } = require('../elements');

/** Where each kind of element is shown: a point on it. */
const POINT_OF = Object.freeze({
  wall: (w) => [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2],
  opening: (o) => o.mid,
  unit: (u) => planar.ringCentroid(u.ring),
  item: (i) => [i.x, i.z],
  correction: (c) => (c.ring ? planar.ringCentroid(c.ring) : c.line[0]),
  amenity: (p) => p.at,
  transitPoint: (p) => p.at,
  anchor: (p) => p.at,
});

/**
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 */
function checkUnreviewed(findings, layout) {
  for (const building of layout.buildings) {
    if (!building.review) continue;
    findings.add(KIND.UNREVIEWED, {
      element: elementRef('building', building),
      at: building.footprint ? at(planar.ringCentroid(building.footprint)) : null,
      order: [building.index],
    });
  }
  for (const level of layout.levels) {
    for (const [kind, array] of Object.entries(ARRAY_OF)) {
      for (const element of level[array]) {
        if (!element.review) continue;
        findings.add(KIND.UNREVIEWED, {
          level,
          element: elementRef(kind, element),
          at: at(POINT_OF[kind](element)),
          order: [documentRank(kind), element.index],
        });
      }
    }
  }
  for (const connector of layout.connectors) {
    if (!connector.review) continue;
    findings.add(KIND.UNREVIEWED, {
      level: layout.levels[connector.levels[0]],
      element: elementRef('connector', connector),
      at: at(connector.stops[0]),
      order: [CONNECTOR_RANK, connector.index],
    });
  }
}

module.exports = { checkUnreviewed };
