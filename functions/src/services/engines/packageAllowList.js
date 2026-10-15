// The package allow-list (spec/P0-03.md r2 §3.7, ruled D11 with A3 and A9; Blueprint invariant 8, the sealed
// package): every table the package model holds and, for each, exactly the fields it may carry. The model is built
// by picking these fields and nothing else (packageModel.js), and stage B's seal test compares the written package
// with this list (AC-46). Excluded, never listed: secrets, audit columns, NeedsReview and DraftConfidence, beacon
// InstalledOn, BatteryServicedOn and BeaconPlanItemId, sentinel data, anything about users, TenantId, logos, and
// every setting that is not routing.* (A3).
'use strict';

/** The package's one planar frame (ruling E10): every x, y is in the venue's frame, in metres. */
const PACKAGE_FRAME = 'VENUE_METRES';

const PACKAGE_ALLOW_LIST = Object.freeze({
  // DC-7: the package carries its own metadata; the format version, version number and publish time are added by
  // the publish service and the writer (stage B).
  metadata: Object.freeze(['venueCode', 'frame', 'nodeCount', 'edgeCount']),
  venue: Object.freeze([
    'id',
    'code',
    'name',
    'boundary',
    'georeference',
    'mapUpDeg',
    'evacEscalatorsAllowed',
  ]),
  // AC-45: a building's MapUpDeg is resolved (the venue's where it has none).
  buildings: Object.freeze(['id', 'name', 'typeLabel', 'footprint', 'mapUpDeg']),
  levels: Object.freeze([
    'id',
    'buildingId',
    'ordinal',
    'name',
    'shortName',
    'spokenName',
    'isOutdoor',
    'elevationM',
    'widthM',
    'depthM',
  ]),
  units: Object.freeze([
    'id',
    'levelId',
    'parentId',
    'category',
    'name',
    'outline',
    'isWalkable',
    'passThrough',
  ]),
  openings: Object.freeze(['id', 'levelId', 'unitId', 'outline', 'isEntrance', 'clearWidthM']),
  floorObjects: Object.freeze(['id', 'levelId', 'outline', 'heightM', 'blocksWalk']),
  // Active occupants only; AC-47: the store status as of publish, with IsRoutable.
  occupants: Object.freeze([
    'id',
    'unitId',
    'name',
    'categoryLabel',
    'keywords',
    'spokenName',
    'statusLabel',
    'isRoutable',
  ]),
  amenities: Object.freeze([
    'id',
    'levelId',
    'unitId',
    'name',
    'x',
    'y',
    'typeLabel',
    'synonyms',
    'isAccessible',
  ]),
  transitPoints: Object.freeze(['id', 'levelId', 'name', 'x', 'y']),
  anchors: Object.freeze(['id', 'levelId', 'unitId', 'name', 'x', 'y']),
  // AC-70 (A9): each connector's Name with its SpokenName (AC-45).
  connectors: Object.freeze([
    'id',
    'name',
    'spokenName',
    'typeLabel',
    'costModel',
    'isStepFree',
    'isBidirectional',
    'isEvacuationOnly',
    'fromLevelId',
    'fromX',
    'fromY',
    'toLevelId',
    'toX',
    'toY',
  ]),
  connectorStops: Object.freeze(['id', 'connectorId', 'levelId', 'x', 'y']),
  // Active beacons only.
  beacons: Object.freeze([
    'id',
    'levelId',
    'x',
    'y',
    'uuid',
    'major',
    'minor',
    'mountHeightM',
    'measuredPower',
  ]),
  // The graph (AC-42): each node with its level and that level's ordinal (E10), each directed edge.
  nodes: Object.freeze(['id', 'levelId', 'ordinal', 'x', 'y']),
  edges: Object.freeze([
    'from',
    'to',
    'kind',
    'cost',
    'length',
    'clearance',
    'connectorId',
    'unitId',
    'evacuationOnly',
  ]),
  // P0-06 r2 §3 item 4: per place, its door nodes; each door, entrance and connector end with its node.
  placeNodes: Object.freeze(['table', 'id', 'nodeIds']),
  openingNodes: Object.freeze(['openingId', 'nodeId']),
  connectorNodes: Object.freeze(['connectorId', 'stopId', 'levelId', 'nodeId']),
  passages: Object.freeze(['unitId', 'place']),
  // AC-71 (A9): the wall segments the validator used, per level.
  walls: Object.freeze(['levelId', 'x1', 'y1', 'x2', 'y2']),
  // AC-72 (A3): every routing.* setting as resolved for the tenant.
  routingSettings: Object.freeze(['key', 'value']),
});

module.exports = { PACKAGE_ALLOW_LIST, PACKAGE_FRAME };
