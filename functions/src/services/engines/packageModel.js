// The package model (spec/P0-03.md r4 AC-116, AC-99; AC-46 and AC-49 kept; DC-P1 kept; plan/FF-3-prime-A1.md 1.0
// section 2): the plain in-memory object stage B's writer turns into bytes. It holds the allow-listed document and
// row fields (packageAllowList.js), with string ids (AC-131), the CSR graph in typed arrays in the layout FF-4's
// RoutingGraph reads (DC-42), the places with their door nodes (AC-99), the passages, the wall segments (AC-94), the
// routing.* settings (AC-120) and the metadata the engine knows (AC-48). Every object is built by picking exactly its
// allow-listed fields, so nothing else can slip in (invariant 8), and shares no array with the snapshot. Lists keep
// the document's order: buildings first to last, so the main building is the first (L176), and levels, units and
// connectors carry their positions (AC-131). The labels, codes and sort orders of the lookup rows come from the
// snapshot's lookups and store rows (AC-79). The model is built only when no finding blocks (plan section 2).
'use strict';

const { closedSet } = require('../../config/closedSets');
const { PACKAGE_ALLOW_LIST, PACKAGE_SECTIONS } = require('./packageAllowList');
const { ORIGINS } = require('./graphStore');
const { EDGE_KIND_OF_ORIGIN, ORIGIN } = require('./graphKinds');
const { placedStores } = require('./places');

const GRAPH_EDGE_KINDS = closedSet('GraphEdgeKind');
/** A walkway edge's `ref`: it names no connector and no store (plan section 2). */
const NO_REF = -1;

/** `row` with exactly the allow-listed fields of `list`, each missing one as null. */
function pick(list, row) {
  const out = {};
  for (const field of PACKAGE_ALLOW_LIST[list])
    out[field] = row[field] === undefined ? null : row[field];
  return out;
}

const point = ([x, z]) => [x + 0, z + 0];
const ring = (points) => points.map(point);
const copy = (value) => (value === null || value === undefined ? null : structuredClone(value));

/** The level-element lists, each element picked with its level's id. */
function documentLists(layout, lookups) {
  const labelled = (lookup, code) => {
    const entry = lookups[lookup].get(code);
    return { typeCode: code, typeLabel: entry.label, typeSortOrder: entry.sortOrder };
  };
  const units = [];
  const openings = [];
  const items = [];
  const amenities = [];
  const transitPoints = [];
  const anchors = [];
  for (const level of layout.levels) {
    const on = { level: level.id };
    for (const u of level.units) {
      units.push(
        pick('units', {
          ...u,
          ...on,
          position: u.index,
          outline: ring(u.ring),
          doors: [...u.doors],
        }),
      );
    }
    for (const o of level.openings) {
      openings.push(pick('openings', { ...o, ...on, midpoint: point(o.mid), width: o.w }));
    }
    for (const i of level.items) {
      items.push(
        pick('items', {
          ...i,
          ...on,
          centre: point([i.x, i.z]),
          size: { w: i.w, d: i.d, h: i.h },
        }),
      );
    }
    for (const a of level.amenities) {
      const type = lookups.AmenityType.get(a.typeCode);
      amenities.push(
        pick('amenities', {
          ...a,
          ...on,
          at: point(a.at),
          ...labelled('AmenityType', a.typeCode),
          synonyms: type.synonyms,
          isAccessible: type.isAccessible,
        }),
      );
    }
    for (const t of level.transitPoints) {
      transitPoints.push(
        pick('transitPoints', {
          ...t,
          ...on,
          at: point(t.at),
          ...labelled('TransitType', t.typeCode),
        }),
      );
    }
    for (const n of level.anchors) anchors.push(pick('anchors', { ...n, ...on, at: point(n.at) }));
  }
  const connectors = layout.connectors.map((c) => {
    const type = lookups.ConnectorType.get(c.typeCode);
    return pick('connectors', {
      ...c,
      position: c.index,
      ...labelled('ConnectorType', c.typeCode),
      costModel: type.costModel,
      isStepFree: type.isStepFree,
      stops: c.stops.map(([x, z], i) =>
        pick('connectorStops', { level: layout.levels[c.levels[i]].id, x: x + 0, z: z + 0 }),
      ),
    });
  });
  const buildings = layout.buildings.map((b) =>
    pick('buildings', {
      ...b,
      position: b.index,
      ...labelled('BuildingType', b.typeCode),
      footprint: b.footprint ? ring(b.footprint) : null,
      mapUp: b.mapUp ?? layout.site.mapUp,
    }),
  );
  const levels = layout.levels.map((l) =>
    pick('levels', { ...l, position: l.index, origin: point(l.origin), size: point(l.size) }),
  );
  return {
    buildings,
    levels,
    units,
    openings,
    items,
    amenities,
    transitPoints,
    anchors,
    connectors,
  };
}

/**
 * The graph's stores: every unit with a store crossing or an active store, in document order (by `serial`). A
 * crossed unit with no active store has no status, so its isRoutable is null and the reader decides (DC-B7).
 */
function graphStores(layout, csr, placed) {
  const crossed = new Set();
  for (let k = 0; k < csr.targets.length; k += 1) {
    if (ORIGINS[csr.edgeOrigin[k]] === ORIGIN.STORE) crossed.add(csr.edgeRef[k]);
  }
  const units = layout.levels.flatMap((level) => level.units);
  return units
    .filter((u) => crossed.has(u.serial) || placed.has(u.id))
    .map((u) => ({
      unit: u,
      row: pick('graphStores', {
        id: u.id,
        passThrough: u.passThrough,
        isRoutable: placed.has(u.id) ? placed.get(u.id).status.isRoutable : null,
      }),
    }));
}

/** The CSR with its stored costs, kinds, refs, level spans and flags (AC-105, AC-132). */
function graphArrays(layout, csr, costs, storeIndex) {
  const edges = csr.targets.length;
  const kind = new Uint8Array(edges);
  const ref = new Int32Array(edges);
  const levelSpan = new Int16Array(edges);
  const ordinal = layout.levels.map((l) => l.ordinal);
  for (let v = 0; v < csr.nodeCount; v += 1) {
    for (let k = csr.offsets[v]; k < csr.offsets[v + 1]; k += 1) {
      const origin = ORIGINS[csr.edgeOrigin[k]];
      kind[k] = GRAPH_EDGE_KINDS.indexOf(EDGE_KIND_OF_ORIGIN[origin]);
      if (origin === ORIGIN.STORE) ref[k] = storeIndex.get(csr.edgeRef[k]);
      else if (origin === ORIGIN.CONNECTOR) ref[k] = csr.edgeRef[k];
      else ref[k] = NO_REF;
      levelSpan[k] = Math.abs(ordinal[csr.levelIndex[v]] - ordinal[csr.levelIndex[csr.targets[k]]]);
    }
  }
  return {
    nodeCount: csr.nodeCount,
    x: csr.x,
    z: csr.z,
    levelIndex: csr.levelIndex,
    offsets: csr.offsets,
    targets: csr.targets,
    costS: costs.costS,
    lengthM: costs.lengthM,
    clearanceM: csr.clearanceM,
    kind,
    ref,
    levelSpan,
    flags: csr.edgeFlags,
  };
}

/**
 * @param {object} inputs
 * @param {object} inputs.read  readSnapshot's result
 * @param {object} inputs.layout  readLayout's result
 * @param {object} inputs.graph  generateGraph's result
 * @param {object[]} inputs.places  places.js's places
 * @param {object} inputs.reach  passages.js's result
 * @param {{ costS: Float64Array, lengthM: Float64Array }} inputs.costs  graphCosts.js's result
 */
function buildPackageModel({ read, layout, graph, places, reach, costs }) {
  const { lookups } = read;
  const { csr } = graph;
  const lists = documentLists(layout, lookups);
  const placed = placedStores(read.stores, layout.unitById);
  const storeList = graphStores(layout, csr, placed);
  const storeIndex = new Map(storeList.map(({ unit }, i) => [unit.serial, i]));
  const unitBySerial = new Map(storeList.map(({ unit }) => [unit.serial, unit]));
  const stores = places
    .filter((p) => p.kind === 'store')
    .map(({ id, store }) =>
      pick('stores', {
        placeId: id,
        name: store.name,
        categoryCode: store.category.code,
        categoryLabel: store.category.label,
        categorySortOrder: store.category.sortOrder,
        keywords: store.keywords,
        spokenName: store.spokenName,
        statusCode: store.status.code,
        statusLabel: store.status.label,
        statusSortOrder: store.status.sortOrder,
        isRoutable: store.status.isRoutable,
      }),
    );
  const beacons = read.beacons
    .filter((b) => b.isActive && layout.levelById.has(b.levelKey))
    .map((b) => pick('beacons', { ...b, uuid: b.proximityUuid, level: b.levelKey, z: b.y }));
  const walls = layout.levels.flatMap((level) =>
    graph.wallSegments.get(level.id).map((s) => pick('walls', { ...s, level: level.id })),
  );
  const passages = [...reach.passages.keys()]
    .sort((p, q) => p - q)
    .map((serial) =>
      pick('graphPassages', {
        storeId: unitBySerial.get(serial).id,
        serves: [...reach.passages.get(serial)].sort((p, q) => p - q).map((i) => places[i].id),
      }),
    );
  const model = {
    metadata: pick('metadata', { venueCode: read.venue.code }),
    venue: pick('venue', {
      ...read.venue,
      boundary: ring(layout.site.boundary),
      georeference: copy(layout.site.georeference),
      mapUp: layout.site.mapUp,
    }),
    ...lists,
    stores,
    beacons,
    walls,
    graph: pick('graph', {
      ...graphArrays(layout, csr, costs, storeIndex),
      levels: layout.levels.map((l) => l.id),
      stores: storeList.map(({ row }) => row),
      connectors: layout.connectors.map((c) =>
        pick('graphConnectors', {
          id: c.id,
          costModel: lookups.ConnectorType.get(c.typeCode).costModel,
          name: c.name,
        }),
      ),
      places: places.map((p) => pick('graphPlaces', { ...p, doorNodes: [...p.doorNodes] })),
      passages,
      entrances: [...graph.entranceNodes],
    }),
    routingSettings: Object.keys(read.settings.routing)
      .map((name) => ({ key: `routing.${name}`, value: read.settings.routing[name] }))
      .sort((p, q) => (p.key < q.key ? -1 : p.key > q.key ? 1 : 0))
      .map((row) => pick('routingSettings', row)),
  };
  return Object.fromEntries(PACKAGE_SECTIONS.map((name) => [name, model[name]]));
}

module.exports = { buildPackageModel };
