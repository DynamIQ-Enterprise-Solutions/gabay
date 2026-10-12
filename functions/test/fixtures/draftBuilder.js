'use strict';

// Builds a VenueDraft (plan/FF-3-publish-engine.md 1.0 §3, "The VenueDraft contract") from invented data, with
// every row shaped as pg returns it from db/schema.sql 0.14: lower-case column names (identifiers are never
// quoted), DECIMAL columns as strings ("1.500"), BIGINT ids (Beacon) as strings, JSONB as parsed objects. No real
// venue data (L48, L123). Coordinates are the venue's one planar frame, in metres (E10).

const PLATFORM = null;
const TENANT_ID = 7;
const OTHER_TENANT_ID = 8;
const TENANT_UUID = '87872435-0000-4000-8000-000000000007';

const dec = (n) => (n === null || n === undefined ? null : Number(n).toFixed(3));

/** A closed GeoJSON ring around the rectangle [x1, y1, x2, y2]. */
const rectRing = ([x1, y1, x2, y2]) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
  [x1, y1],
];
const rectPolygon = (rect) => ({ type: 'Polygon', coordinates: [rectRing(rect)] });
const polygon = (points) => ({ type: 'Polygon', coordinates: [[...points, points[0]]] });
const line = (...points) => ({ type: 'LineString', coordinates: points });

/** Platform lookup rows, with the demo's metre costs (Blueprint §3.2). Ids are fixed so tests can name them. */
function platformLookups() {
  const lookup = (id, code, label, extra = {}) => ({
    tenantid: PLATFORM,
    code,
    label,
    sortorder: 0,
    isactive: true,
    ...extra,
    __id: id,
  });
  const withId = (column) => (row) => {
    const { __id, ...rest } = row;
    return { [column]: __id, ...rest };
  };
  return {
    connectorTypes: [
      lookup(1, 'ELEVATOR', 'Lift', {
        costmodel: 'ELEVATOR',
        isstepfree: true,
        costbasem: '30.000',
        costperrisem: '1.500',
      }),
      lookup(2, 'STAIRS', 'Stairs', {
        costmodel: 'STAIRS',
        isstepfree: false,
        costbasem: '34.000',
        costperrisem: '3.000',
      }),
      lookup(3, 'ESCALATOR', 'Escalator', {
        costmodel: 'ESCALATOR',
        isstepfree: false,
        costbasem: '14.000',
        costperrisem: '1.000',
      }),
      lookup(4, 'RAMP', 'Ramp', {
        costmodel: 'RAMP',
        isstepfree: true,
        costbasem: '20.000',
        costperrisem: '2.000',
      }),
    ].map(withId('connectortypeid')),
    amenityTypes: [
      lookup(11, 'CR', 'Restroom', {
        searchsynonyms: 'comfort room, cr, restroom',
        isaccessible: false,
      }),
      lookup(12, 'ATM', 'ATM', { searchsynonyms: 'bank, cash', isaccessible: false }),
    ].map(withId('amenitytypeid')),
    occupantCategories: [
      lookup(21, 'FASHION', 'Fashion'),
      lookup(22, 'DINING', 'Food and drink'),
    ].map(withId('occupantcategoryid')),
    storeStatuses: [
      lookup(31, 'OPEN', 'Open', { isroutable: true }),
      lookup(32, 'CLOSED', 'Closed', { isroutable: false }),
    ].map(withId('storestatusid')),
    objectTypes: [
      lookup(41, 'PILLAR', 'Pillar', {
        defaultwidthm: null,
        defaultdepthm: null,
        defaultheightm: null,
        blockswalk: true,
        signalpenaltydb: '20.00',
      }),
    ].map(withId('objecttypeid')),
    buildingTypes: [lookup(51, 'MAIN', 'Main building')].map(withId('buildingtypeid')),
    transitTypes: [lookup(61, 'JEEPNEY_BAY', 'Jeepney bay')].map(withId('transittypeid')),
    beaconModels: [
      {
        beaconmodelid: 71,
        tenantid: PLATFORM,
        code: 'MOKO_H2',
        label: 'MOKOSmart H2',
        unitprice: null,
        batterylifemonths: 50,
        iprating: 'IP65',
        isactive: true,
      },
    ],
  };
}

const TYPE_ID = { ELEVATOR: 1, STAIRS: 2, ESCALATOR: 3, RAMP: 4 };

/**
 * A fluent builder. Every add* method returns the new row's id. `build()` returns a fresh VenueDraft each time.
 * @param {{ spacing?: number, snap?: number, maxNodesWarn?: number, storeCrossingFactor?: number,
 *           boundary?: number[], venueId?: number }} [opts]
 */
function draftBuilder(opts = {}) {
  const venueId = opts.venueId ?? 100;
  let nextId = 1000;
  const id = () => (nextId += 1);
  const rows = {
    buildings: [],
    levels: [],
    units: [],
    openings: [],
    floorObjects: [],
    occupants: [],
    amenities: [],
    transitPoints: [],
    anchors: [],
    connectors: [],
    connectorStops: [],
    beacons: [],
    corrections: [],
  };
  const lookups = platformLookups();
  const scoped = (extra) => ({ tenantid: TENANT_ID, venueid: venueId, ...extra });
  const audit = {
    createdby: 1,
    createdat: '2026-10-09T00:00:00.000Z',
    updatedby: null,
    updatedat: null,
  };
  let buildingId = null;
  const settings = {
    routing: {
      'routing.stairsSaveM': 144,
      'routing.storeCrossingFactor': opts.storeCrossingFactor ?? 1.25,
      'routing.stepFreeMinWidthM': 1.2,
    },
    publish: {
      'publish.nodeSpacingM': opts.spacing ?? 1,
      'publish.addPathSnapM': opts.snap ?? opts.spacing ?? 1,
      'publish.maxNodesWarn': opts.maxNodesWarn ?? 20000,
    },
  };
  let boundary = rectPolygon(opts.boundary ?? [-100, -100, 400, 400]);

  const api = {
    venueId,
    lookups,
    settings,
    /** Replace the venue boundary (a rectangle, or any GeoJSON object). */
    boundary(value) {
      boundary = Array.isArray(value) ? rectPolygon(value) : value;
      return api;
    },
    level({ ordinal = 0, elevationM = 0, name, outdoor = false, spokenName = null } = {}) {
      if (!outdoor && buildingId === null) {
        buildingId = id();
        rows.buildings.push(
          scoped({
            buildingid: buildingId,
            buildingtypeid: 51,
            name: 'Main hall',
            footprintgeojson: rectPolygon([0, 0, 300, 300]),
            mapupdeg: null,
            ...audit,
          }),
        );
      }
      const levelId = id();
      rows.levels.push(
        scoped({
          levelid: levelId,
          buildingid: outdoor ? null : buildingId,
          ordinal,
          name: name ?? `Level ${ordinal}`,
          shortname: `L${ordinal}`,
          spokenname: spokenName,
          isoutdoor: outdoor,
          elevationm: dec(elevationM),
          widthm: dec(300),
          depthm: dec(300),
          gridcellm: '1.00',
          ceilingheightm: null,
          ...audit,
        }),
      );
      return levelId;
    },
    /** Any unit. `geometry` is GeoJSON, or a rectangle [x1, y1, x2, y2]. */
    unit(
      levelId,
      geometry,
      {
        walkable = false,
        passThrough = false,
        name = null,
        parent = null,
        needsReview = false,
        category,
      } = {},
    ) {
      const unitId = id();
      const geo = Array.isArray(geometry) ? rectPolygon(geometry) : geometry;
      rows.units.push(
        scoped({
          unitid: unitId,
          levelid: levelId,
          parentunitid: parent,
          imdfcategory: category ?? (walkable ? 'walkway' : 'room'),
          name,
          shapekind: 'POLYGON',
          centerx: null,
          centery: null,
          widthm: null,
          depthm: null,
          rotationdeg: null,
          geometrygeojson: geo,
          iswalkable: walkable,
          passthrough: passThrough,
          needsreview: needsReview,
          draftconfidence: needsReview ? '0.300' : null,
          ...audit,
        }),
      );
      return unitId;
    },
    walkway(levelId, geometry, extra = {}) {
      return api.unit(levelId, geometry, { ...extra, walkable: true });
    },
    opening(
      levelId,
      unitId,
      geometry,
      { entrance = false, widthM, name = null, needsReview = false } = {},
    ) {
      const openingId = id();
      const geo = Array.isArray(geometry) ? line(...geometry) : geometry;
      const [a, b] = geo.coordinates ?? [];
      const drawn =
        Array.isArray(a) && Array.isArray(b) ? Math.hypot(b[0] - a[0], b[1] - a[1]) : null;
      rows.openings.push(
        scoped({
          openingid: openingId,
          levelid: levelId,
          unitid: unitId,
          imdfcategory: entrance ? 'pedestrian.principal' : 'pedestrian',
          name,
          geometrygeojson: geo,
          isvenueentrance: entrance,
          clearwidthm: widthM === null ? null : dec(widthM ?? drawn),
          needsreview: needsReview,
          draftconfidence: needsReview ? '0.300' : null,
          ...audit,
        }),
      );
      return openingId;
    },
    entrance(levelId, a, b, extra = {}) {
      return api.opening(levelId, null, [a, b], { ...extra, entrance: true });
    },
    /** A store: a non-walkable unit with its doors (each [[x1, y1], [x2, y2]]) and an occupant. */
    store(
      levelId,
      rect,
      {
        name = 'Store',
        doors = [],
        passThrough = false,
        category = 21,
        status = 31,
        active = true,
        keywords = null,
        spokenName = null,
        parent = null,
        occupant = true,
      } = {},
    ) {
      const unitId = api.unit(levelId, rect, { name, passThrough, parent });
      const openingIds = doors.map((d) => api.opening(levelId, unitId, d));
      let occupantId = null;
      if (occupant) {
        occupantId = id();
        rows.occupants.push(
          scoped({
            occupantid: occupantId,
            unitid: unitId,
            occupantcategoryid: category,
            storestatusid: status,
            name,
            searchkeywords: keywords,
            spokenname: spokenName,
            logofileid: null,
            isactive: active,
            ...audit,
          }),
        );
      }
      return { unitId, occupantId, openingIds };
    },
    floorObject(
      levelId,
      {
        center,
        width,
        depth,
        rotation = 0,
        geometry = null,
        blocks = true,
        kind = 'BOX',
        height = 1,
        needsReview = false,
        typeId = 41,
      },
    ) {
      const objectId = id();
      rows.floorObjects.push(
        scoped({
          floorobjectid: objectId,
          levelid: levelId,
          objecttypeid: typeId,
          unitid: null,
          shapekind: kind,
          centerx: dec(center[0]),
          centery: dec(center[1]),
          widthm: width === undefined ? null : dec(width),
          depthm: depth === undefined ? null : dec(depth),
          heightm: dec(height),
          rotationdeg: rotation.toFixed(2),
          geometrygeojson: geometry,
          blockswalk: blocks,
          needsreview: needsReview,
          draftconfidence: null,
          ...audit,
        }),
      );
      return objectId;
    },
    amenity(levelId, x, y, { unitId = null, typeId = 11, name = null } = {}) {
      const amenityId = id();
      rows.amenities.push(
        scoped({
          amenityid: amenityId,
          levelid: levelId,
          unitid: unitId,
          amenitytypeid: typeId,
          name,
          x: dec(x),
          y: dec(y),
          ...audit,
        }),
      );
      return amenityId;
    },
    transitPoint(levelId, x, y, { name = 'Jeepney bay', typeId = 61 } = {}) {
      const transitPointId = id();
      rows.transitPoints.push(
        scoped({
          transitpointid: transitPointId,
          levelid: levelId,
          transittypeid: typeId,
          name,
          x: dec(x),
          y: dec(y),
          note: null,
          ...audit,
        }),
      );
      return transitPointId;
    },
    anchor(levelId, x, y, { name = 'Fountain', unitId = null } = {}) {
      const anchorId = id();
      rows.anchors.push(
        scoped({
          anchorid: anchorId,
          levelid: levelId,
          unitid: unitId,
          name,
          x: dec(x),
          y: dec(y),
          ...audit,
        }),
      );
      return anchorId;
    },
    /** stairs, escalator, ramp: from and to are [levelId, x, y]. */
    connector(
      type,
      from,
      to,
      {
        riseM = 4.5,
        bidirectional = true,
        evacuationOnly = false,
        name,
        spokenName = null,
        typeId,
        needsReview = false,
      } = {},
    ) {
      const connectorId = id();
      rows.connectors.push(
        scoped({
          navconnectorid: connectorId,
          connectortypeid: typeId ?? TYPE_ID[type],
          name: name ?? `${type} ${connectorId}`,
          fromlevelid: from[0],
          fromx: dec(from[1]),
          fromy: dec(from[2]),
          tolevelid: to ? to[0] : null,
          tox: to ? dec(to[1]) : null,
          toy: to ? dec(to[2]) : null,
          isbidirectional: bidirectional,
          isevacuationonly: evacuationOnly,
          spokenname: spokenName,
          risem: riseM === null ? null : dec(riseM),
          needsreview: needsReview,
          draftconfidence: null,
          ...audit,
        }),
      );
      return connectorId;
    },
    /** A lift: stops are [levelId, x, y]; its From columns repeat the first stop, as the seed writes them. */
    lift(
      stops,
      { name = 'Lift A', riseM = null, typeId = TYPE_ID.ELEVATOR, bidirectional = true } = {},
    ) {
      const connectorId = id();
      const first = stops[0] ?? [rows.levels[0]?.levelid, 0, 0];
      rows.connectors.push(
        scoped({
          navconnectorid: connectorId,
          connectortypeid: typeId,
          name,
          fromlevelid: first[0],
          fromx: dec(first[1]),
          fromy: dec(first[2]),
          tolevelid: null,
          tox: null,
          toy: null,
          isbidirectional: bidirectional,
          isevacuationonly: false,
          spokenname: null,
          risem: riseM === null ? null : dec(riseM),
          needsreview: false,
          draftconfidence: null,
          ...audit,
        }),
      );
      const stopIds = stops.map(([levelId, x, y]) => {
        const stopId = id();
        rows.connectorStops.push({
          tenantid: TENANT_ID,
          navconnectorstopid: stopId,
          navconnectorid: connectorId,
          levelid: levelId,
          x: dec(x),
          y: dec(y),
          ...audit,
        });
        return stopId;
      });
      return { connectorId, stopIds };
    },
    beacon(levelId, x, y, { major = 1, minor, uuid = TENANT_UUID, active = true } = {}) {
      const beaconId = String(id());
      rows.beacons.push(
        scoped({
          beaconid: beaconId,
          levelid: levelId,
          x: dec(x),
          y: dec(y),
          mountheightm: '2.70',
          proximityuuid: uuid,
          major,
          minor: minor ?? Number(beaconId) % 65536,
          identityscheme: 'IBEACON_STATIC',
          measuredpower: -55,
          beaconmodelid: 71,
          beaconplanitemid: null,
          installedon: '2026-10-01',
          batteryservicedon: null,
          isactive: active,
          ...audit,
        }),
      );
      return beaconId;
    },
    correction(levelId, kind, geometry) {
      const correctionId = id();
      rows.corrections.push(
        scoped({
          navcorrectionid: correctionId,
          levelid: levelId,
          correctionkind: kind,
          geometrygeojson: geometry,
          note: null,
          ...audit,
        }),
      );
      return correctionId;
    },
    /** Direct access to a row list, for tests that edit a row after adding it. */
    rows,
    build() {
      return structuredClone({
        tenant: { tenantId: TENANT_ID, beaconProximityUuid: TENANT_UUID },
        venue: scoped({
          code: 'TESTMALL',
          name: 'Test Mall',
          boundarygeojson: boundary,
          georeferencejson: null,
          evacescalatorsallowed: true,
          mapupdeg: '15.00',
          isactive: true,
          ...audit,
        }),
        ...rows,
        lookups,
        settings,
      });
    },
  };
  return api;
}

/**
 * The plainest publishable venue: one level, a 20 x 4 m corridor, a west entrance, a store above the corridor
 * with one door on its front, and nothing else. Spacing 1 m unless given.
 */
function corridorWithStore(opts = {}) {
  const b = draftBuilder(opts);
  const L0 = b.level({ ordinal: 0, name: 'Ground' });
  const corridor = b.walkway(L0, [0, 0, 20, 4]);
  const entrance = b.entrance(L0, [0, 1], [0, 3]);
  const store = b.store(L0, [5, 4, 10, 10], {
    name: 'Bookshop',
    doors: [
      [
        [7, 4],
        [8.5, 4],
      ],
    ],
  });
  return { b, L0, corridor, entrance, store };
}

module.exports = {
  draftBuilder,
  corridorWithStore,
  rectPolygon,
  rectRing,
  polygon,
  line,
  TENANT_ID,
  OTHER_TENANT_ID,
  TENANT_UUID,
  TYPE_ID,
};
