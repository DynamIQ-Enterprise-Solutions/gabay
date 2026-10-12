// Parses a VenueDraft once (plan/FF-3-publish-engine.md 1.0 §3, "The VenueDraft contract"). The rows arrive as pg
// returns them from db/schema.sql 0.14: lower-case column names, DECIMAL as strings, BIGINT as strings, JSONB as
// objects. Here they become numbers (EC-34: never compared as text), every list is ordered by id (DC-3), and rows of
// another venue or tenant are left out (AC-49, invariant 13). A row the contract promises but the snapshot did not
// supply is a fault in the caller, so it throws instead of guessing (C8: no silent defaults).
'use strict';

const TABLE_OF_LOOKUP = Object.freeze({
  connectorTypes: 'ConnectorType',
  amenityTypes: 'AmenityType',
  occupantCategories: 'OccupantCategory',
  storeStatuses: 'StoreStatus',
  objectTypes: 'ObjectType',
  buildingTypes: 'BuildingType',
  transitTypes: 'TransitType',
  beaconModels: 'BeaconModel',
});

/** The settings the engine reads (DC-P12). Each must be a finite number above its floor. */
const ENGINE_SETTINGS = Object.freeze([
  { group: 'publish', key: 'publish.nodeSpacingM', name: 'nodeSpacingM', min: 0, inclusive: false },
  { group: 'publish', key: 'publish.addPathSnapM', name: 'addPathSnapM', min: 0, inclusive: true },
  { group: 'publish', key: 'publish.maxNodesWarn', name: 'maxNodesWarn', min: 0, inclusive: false },
  {
    group: 'routing',
    key: 'routing.storeCrossingFactor',
    name: 'storeCrossingFactor',
    min: 0,
    inclusive: false,
  },
]);

function fault(message) {
  return new Error(`VenueDraft: ${message}`);
}

/** An id column (INT or BIGINT) as a number. */
function id(value, what) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(n)) throw fault(`${what} is not an id: ${String(value).slice(0, 40)}`);
  return n;
}
const optionalId = (value, what) =>
  value === null || value === undefined ? null : id(value, what);

/** A DECIMAL or numeric column as a number; null stays null. */
function decimal(value, what) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw fault(`${what} is not a number: ${String(value).slice(0, 40)}`);
  return n;
}
const required = (value, what) => {
  const n = decimal(value, what);
  if (n === null) throw fault(`${what} is missing`);
  return n;
};

const byId = (a, b) => a.id - b.id;

function readSettings(settings) {
  if (!settings || typeof settings !== 'object') throw fault('settings are missing');
  const out = { routing: {} };
  for (const s of ENGINE_SETTINGS) {
    const value = settings[s.group] ? settings[s.group][s.key] : undefined;
    const ok =
      typeof value === 'number' &&
      Number.isFinite(value) &&
      (s.inclusive ? value >= s.min : value > s.min);
    if (!ok)
      throw fault(
        `setting ${s.key} must be a number ${s.inclusive ? 'of at least' : 'above'} ${s.min}`,
      );
    out[s.name] = value;
  }
  // AC-72 (A3): every routing.* key as resolved for the tenant, and only those keys.
  for (const [key, value] of Object.entries(settings.routing ?? {})) {
    if (key.startsWith('routing.')) out.routing[key] = value;
  }
  return out;
}

function readLookups(lookups) {
  const out = {};
  for (const [name, table] of Object.entries(TABLE_OF_LOOKUP)) {
    const rows = (lookups && lookups[name]) || [];
    const idColumn = `${table.toLowerCase()}id`;
    const map = new Map();
    for (const row of rows) {
      const rowId = id(row[idColumn], `${table}.${table}Id`);
      map.set(rowId, {
        id: rowId,
        tenantId: optionalId(row.tenantid, `${table}.TenantId`),
        code: row.code,
        label: row.label,
        isActive: row.isactive,
        costModel: row.costmodel,
        isStepFree: row.isstepfree,
        costBaseM: decimal(row.costbasem, `${table}.CostBaseM`),
        costPerRiseM: decimal(row.costperrisem, `${table}.CostPerRiseM`),
        synonyms: row.searchsynonyms ?? null,
        isAccessible: row.isaccessible,
        isRoutable: row.isroutable,
        blocksWalk: row.blockswalk,
      });
    }
    out[name] = map;
  }
  return out;
}

/** Throws unless the lookup row a venue row names is in the snapshot (the contract supplies every one, AC-19). */
function mustHave(lookups, name, lookupId, referrer) {
  if (lookupId === null) return;
  if (!lookups[name].has(lookupId)) {
    throw fault(
      `${TABLE_OF_LOOKUP[name]} ${lookupId} (referenced by ${referrer}) is not in the snapshot`,
    );
  }
}

/**
 * @param {object} draft  the VenueDraft (plan §3)
 * @param {object} [settings]  { routing, publish }, the draft's own by default
 */
function parseDraft(draft, settings = draft.settings) {
  if (!draft || !draft.tenant || !draft.venue) throw fault('tenant and venue are required');
  const tenantId = id(draft.tenant.tenantId, 'tenant.tenantId');
  const venueId = id(draft.venue.venueid, 'Venue.VenueId');
  const ownRow = (row) => Number(row.tenantid) === tenantId && Number(row.venueid) === venueId;
  const rows = (name) => (Array.isArray(draft[name]) ? draft[name] : []).filter(ownRow);
  const v = draft.venue;
  const lookups = readLookups(draft.lookups);

  const levels = rows('levels')
    .map((r) => ({
      id: id(r.levelid, 'Level.LevelId'),
      buildingId: optionalId(r.buildingid, 'Level.BuildingId'),
      ordinal: id(r.ordinal, 'Level.Ordinal'),
      name: r.name,
      shortName: r.shortname,
      spokenName: r.spokenname ?? null,
      isOutdoor: r.isoutdoor === true,
      elevationM: required(r.elevationm, 'Level.ElevationM'),
      widthM: decimal(r.widthm, 'Level.WidthM'),
      depthM: decimal(r.depthm, 'Level.DepthM'),
    }))
    .sort(byId);
  const levelIds = new Set(levels.map((l) => l.id));
  const onLevel = (row) => levelIds.has(Number(row.levelid));

  const buildings = rows('buildings')
    .map((r) => ({
      id: id(r.buildingid, 'Building.BuildingId'),
      typeId: id(r.buildingtypeid, 'Building.BuildingTypeId'),
      name: r.name,
      footprint: r.footprintgeojson ?? null,
      mapUpDeg: decimal(r.mapupdeg, 'Building.MapUpDeg'),
    }))
    .sort(byId);

  const units = rows('units')
    .filter(onLevel)
    .map((r) => ({
      id: id(r.unitid, 'Unit.UnitId'),
      levelId: id(r.levelid, 'Unit.LevelId'),
      parentId: optionalId(r.parentunitid, 'Unit.ParentUnitId'),
      imdfCategory: r.imdfcategory,
      name: r.name ?? null,
      shapeKind: r.shapekind,
      centerX: decimal(r.centerx, 'Unit.CenterX'),
      centerY: decimal(r.centery, 'Unit.CenterY'),
      geometry: r.geometrygeojson,
      isWalkable: r.iswalkable === true,
      passThrough: r.passthrough === true,
      needsReview: r.needsreview === true,
    }))
    .sort(byId);
  const unitIds = new Set(units.map((u) => u.id));

  const openings = rows('openings')
    .filter(onLevel)
    .map((r) => ({
      id: id(r.openingid, 'Opening.OpeningId'),
      levelId: id(r.levelid, 'Opening.LevelId'),
      unitId: optionalId(r.unitid, 'Opening.UnitId'),
      imdfCategory: r.imdfcategory,
      name: r.name ?? null,
      geometry: r.geometrygeojson,
      isEntrance: r.isvenueentrance === true,
      clearWidthM: decimal(r.clearwidthm, 'Opening.ClearWidthM'),
      needsReview: r.needsreview === true,
    }))
    .sort(byId);

  const floorObjects = rows('floorObjects')
    .filter(onLevel)
    .map((r) => ({
      id: id(r.floorobjectid, 'FloorObject.FloorObjectId'),
      levelId: id(r.levelid, 'FloorObject.LevelId'),
      typeId: id(r.objecttypeid, 'FloorObject.ObjectTypeId'),
      unitId: optionalId(r.unitid, 'FloorObject.UnitId'),
      shapeKind: r.shapekind,
      centerX: required(r.centerx, 'FloorObject.CenterX'),
      centerY: required(r.centery, 'FloorObject.CenterY'),
      widthM: decimal(r.widthm, 'FloorObject.WidthM'),
      depthM: decimal(r.depthm, 'FloorObject.DepthM'),
      heightM: decimal(r.heightm, 'FloorObject.HeightM'),
      rotationDeg: decimal(r.rotationdeg, 'FloorObject.RotationDeg') ?? 0,
      geometry: r.geometrygeojson ?? null,
      blocksWalk: r.blockswalk === true,
      needsReview: r.needsreview === true,
    }))
    .sort(byId);

  const occupants = rows('occupants')
    .filter((r) => unitIds.has(Number(r.unitid)))
    .map((r) => ({
      id: id(r.occupantid, 'Occupant.OccupantId'),
      unitId: id(r.unitid, 'Occupant.UnitId'),
      categoryId: id(r.occupantcategoryid, 'Occupant.OccupantCategoryId'),
      statusId: id(r.storestatusid, 'Occupant.StoreStatusId'),
      name: r.name,
      keywords: r.searchkeywords ?? null,
      spokenName: r.spokenname ?? null,
      isActive: r.isactive === true,
    }))
    .sort(byId);

  const point = (prefix, r, idColumn, extra) => ({
    id: id(r[idColumn], `${prefix}.${prefix}Id`),
    levelId: id(r.levelid, `${prefix}.LevelId`),
    x: required(r.x, `${prefix}.X`),
    y: required(r.y, `${prefix}.Y`),
    ...extra,
  });
  const amenities = rows('amenities')
    .filter(onLevel)
    .map((r) =>
      point('Amenity', r, 'amenityid', {
        unitId: optionalId(r.unitid, 'Amenity.UnitId'),
        typeId: id(r.amenitytypeid, 'Amenity.AmenityTypeId'),
        name: r.name ?? null,
      }),
    )
    .sort(byId);
  const transitPoints = rows('transitPoints')
    .filter(onLevel)
    .map((r) =>
      point('TransitPoint', r, 'transitpointid', {
        typeId: id(r.transittypeid, 'TransitPoint.TransitTypeId'),
        name: r.name,
      }),
    )
    .sort(byId);
  const anchors = rows('anchors')
    .filter(onLevel)
    .map((r) =>
      point('Anchor', r, 'anchorid', {
        unitId: optionalId(r.unitid, 'Anchor.UnitId'),
        name: r.name,
      }),
    )
    .sort(byId);

  const connectors = rows('connectors')
    .filter((r) => levelIds.has(Number(r.fromlevelid)))
    .map((r) => ({
      id: id(r.navconnectorid, 'NavConnector.NavConnectorId'),
      typeId: id(r.connectortypeid, 'NavConnector.ConnectorTypeId'),
      name: r.name,
      spokenName: r.spokenname ?? null,
      fromLevelId: id(r.fromlevelid, 'NavConnector.FromLevelId'),
      fromX: required(r.fromx, 'NavConnector.FromX'),
      fromY: required(r.fromy, 'NavConnector.FromY'),
      toLevelId: optionalId(r.tolevelid, 'NavConnector.ToLevelId'),
      toX: decimal(r.tox, 'NavConnector.ToX'),
      toY: decimal(r.toy, 'NavConnector.ToY'),
      isBidirectional: r.isbidirectional === true,
      isEvacuationOnly: r.isevacuationonly === true,
      riseM: decimal(r.risem, 'NavConnector.RiseM'),
      needsReview: r.needsreview === true,
    }))
    .sort(byId);
  const connectorIds = new Set(connectors.map((c) => c.id));

  const connectorStops = (Array.isArray(draft.connectorStops) ? draft.connectorStops : [])
    .filter(
      (r) =>
        Number(r.tenantid) === tenantId && connectorIds.has(Number(r.navconnectorid)) && onLevel(r),
    )
    .map((r) => ({
      id: id(r.navconnectorstopid, 'NavConnectorStop.NavConnectorStopId'),
      connectorId: id(r.navconnectorid, 'NavConnectorStop.NavConnectorId'),
      levelId: id(r.levelid, 'NavConnectorStop.LevelId'),
      x: required(r.x, 'NavConnectorStop.X'),
      y: required(r.y, 'NavConnectorStop.Y'),
    }))
    .sort(byId);

  const beacons = rows('beacons')
    .filter(onLevel)
    .map((r) =>
      point('Beacon', r, 'beaconid', {
        mountHeightM: decimal(r.mountheightm, 'Beacon.MountHeightM'),
        uuid: String(r.proximityuuid).toLowerCase(),
        major: id(r.major, 'Beacon.Major'),
        minor: id(r.minor, 'Beacon.Minor'),
        measuredPower: decimal(r.measuredpower, 'Beacon.MeasuredPower'),
        modelId: optionalId(r.beaconmodelid, 'Beacon.BeaconModelId'),
        isActive: r.isactive === true,
      }),
    )
    .sort(byId);

  const corrections = rows('corrections')
    .filter(onLevel)
    .map((r) => ({
      id: id(r.navcorrectionid, 'NavCorrection.NavCorrectionId'),
      levelId: id(r.levelid, 'NavCorrection.LevelId'),
      kind: r.correctionkind,
      geometry: r.geometrygeojson,
    }))
    .sort(byId);

  for (const b of buildings) mustHave(lookups, 'buildingTypes', b.typeId, `Building ${b.id}`);
  for (const o of floorObjects) mustHave(lookups, 'objectTypes', o.typeId, `FloorObject ${o.id}`);
  for (const o of occupants) {
    mustHave(lookups, 'occupantCategories', o.categoryId, `Occupant ${o.id}`);
    mustHave(lookups, 'storeStatuses', o.statusId, `Occupant ${o.id}`);
  }
  for (const a of amenities) mustHave(lookups, 'amenityTypes', a.typeId, `Amenity ${a.id}`);
  for (const t of transitPoints)
    mustHave(lookups, 'transitTypes', t.typeId, `TransitPoint ${t.id}`);
  for (const c of connectors) mustHave(lookups, 'connectorTypes', c.typeId, `NavConnector ${c.id}`);
  for (const b of beacons) mustHave(lookups, 'beaconModels', b.modelId, `Beacon ${b.id}`);

  return {
    tenantId,
    beaconProximityUuid: String(draft.tenant.beaconProximityUuid ?? '').toLowerCase(),
    venue: {
      id: venueId,
      code: v.code,
      name: v.name,
      boundary: v.boundarygeojson,
      georeference: v.georeferencejson ?? null,
      evacEscalatorsAllowed: v.evacescalatorsallowed === true,
      mapUpDeg: decimal(v.mapupdeg, 'Venue.MapUpDeg') ?? 0,
    },
    buildings,
    levels,
    units,
    openings,
    floorObjects,
    occupants,
    amenities,
    transitPoints,
    anchors,
    connectors,
    connectorStops,
    beacons,
    corrections,
    lookups,
    settings: readSettings(settings),
  };
}

module.exports = { parseDraft, TABLE_OF_LOOKUP };
