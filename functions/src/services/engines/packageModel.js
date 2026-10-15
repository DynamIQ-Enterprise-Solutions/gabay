// The package model (plan/FF-3-publish-engine.md 1.0 §2, DC-P1): a plain object holding the allow-listed rows
// (packageAllowList.js; ruled D11 with A3 and A9), the graph, the passages, the wall segments, the resolved
// routing.* settings and the metadata. A PackageWriter (stage B) turns it into bytes; nothing here knows the format.
// Every row is built by picking exactly its allow-listed fields, so nothing else can slip in (invariant 8).
'use strict';

const { PACKAGE_ALLOW_LIST, PACKAGE_FRAME } = require('./packageAllowList');

/** The row with exactly the table's allow-listed fields. */
function pick(table, row) {
  const out = {};
  for (const field of PACKAGE_ALLOW_LIST[table])
    out[field] = row[field] === undefined ? null : row[field];
  return out;
}
const rows = (table, list) => list.map((row) => pick(table, row));

const copy = (geo) => (geo === null || geo === undefined ? null : structuredClone(geo));
const geoJsonOf = (area) => ({
  type: 'Polygon',
  coordinates: area[0].map((ring) => [...ring, ring[0]]),
});

/**
 * @param {object} venue  the parsed draft (draft.js), shapes read
 * @param {object} graph  the generated graph (graphGenerator.service.js)
 * @param {object} analysis  reachability and passages (passages.js)
 */
function buildPackageModel(venue, graph, analysis) {
  const { lookups } = venue;
  const label = (map, id) => map.get(id).label;
  const levels = [...venue.levels].sort((a, b) => a.ordinal - b.ordinal || a.id - b.id);

  return {
    metadata: pick('metadata', {
      venueCode: venue.venue.code,
      frame: PACKAGE_FRAME,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }),
    venue: pick('venue', {
      ...venue.venue,
      boundary: copy(venue.venue.boundary),
      georeference: copy(venue.venue.georeference),
    }),
    buildings: rows(
      'buildings',
      venue.buildings.map((b) => ({
        ...b,
        typeLabel: label(lookups.buildingTypes, b.typeId),
        footprint: copy(b.footprint),
        mapUpDeg: b.mapUpDeg ?? venue.venue.mapUpDeg,
      })),
    ),
    levels: rows('levels', levels),
    units: rows(
      'units',
      venue.units.map((u) => ({ ...u, category: u.imdfCategory, outline: copy(u.geometry) })),
    ),
    openings: rows(
      'openings',
      venue.openings.map((o) => ({ ...o, outline: copy(o.geometry) })),
    ),
    floorObjects: rows(
      'floorObjects',
      venue.floorObjects.map((f) => ({
        ...f,
        outline: f.geometry ? copy(f.geometry) : geoJsonOf(f.area),
      })),
    ),
    occupants: rows(
      'occupants',
      venue.occupants
        .filter((o) => o.isActive)
        .map((o) => {
          const status = lookups.storeStatuses.get(o.statusId);
          return {
            ...o,
            categoryLabel: label(lookups.occupantCategories, o.categoryId),
            statusLabel: status.label,
            isRoutable: status.isRoutable === true,
          };
        }),
    ),
    amenities: rows(
      'amenities',
      venue.amenities.map((a) => {
        const type = lookups.amenityTypes.get(a.typeId);
        return {
          ...a,
          typeLabel: type.label,
          synonyms: type.synonyms,
          isAccessible: type.isAccessible === true,
        };
      }),
    ),
    transitPoints: rows('transitPoints', venue.transitPoints),
    anchors: rows('anchors', venue.anchors),
    connectors: rows(
      'connectors',
      venue.connectors.map((c) => {
        const type = lookups.connectorTypes.get(c.typeId);
        return {
          ...c,
          typeLabel: type.label,
          costModel: type.costModel,
          isStepFree: type.isStepFree === true,
        };
      }),
    ),
    connectorStops: rows('connectorStops', venue.connectorStops),
    beacons: rows(
      'beacons',
      venue.beacons.filter((b) => b.isActive),
    ),
    nodes: rows('nodes', graph.nodes),
    edges: rows('edges', graph.edges),
    placeNodes: rows(
      'placeNodes',
      analysis.results.map((r) => ({
        table: r.place.table,
        id: r.place.id,
        nodeIds: [...r.arrival].sort((a, b) => a - b),
      })),
    ),
    openingNodes: rows(
      'openingNodes',
      [...graph.openingNode.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([openingId, nodeId]) => ({ openingId, nodeId })),
    ),
    connectorNodes: rows('connectorNodes', graph.connectorNodes),
    passages: rows(
      'passages',
      analysis.passages.map((p) => ({ unitId: p.unitId, place: { ...p.place } })),
    ),
    walls: rows(
      'walls',
      [...graph.walls.entries()].flatMap(([levelId, list]) => list.map((w) => ({ levelId, ...w }))),
    ),
    routingSettings: rows(
      'routingSettings',
      Object.keys(venue.settings.routing)
        .sort()
        .map((key) => ({ key, value: venue.settings.routing[key] })),
    ),
  };
}

module.exports = { buildPackageModel };
