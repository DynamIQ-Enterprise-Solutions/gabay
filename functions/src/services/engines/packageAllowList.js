// The package allow-list (spec/P0-03.md r4 AC-116, r3 section 3.7 read for the document; AC-46 and AC-49 kept;
// Blueprint invariant 8, the sealed package): every list and object the package model holds and, for each, exactly the
// fields it may carry. The model is built by picking these fields and nothing else (packageModel.js), and the seal
// tests compare the model, and in stage B the written package, with this list. Never listed: a `review` flag, a
// backdrop, a correction (only its effect on the graph), a colour or finish key, an editor's note, a user, an audit
// column, a beacon's InstalledOn, BatteryServicedOn or BeaconPlanItemId, a secret, another venue's or another
// tenant's row, and every setting that is not routing.* (AC-46, AC-72). A transit point's `note` is the shopper's
// (AC-116), not the editor's.
'use strict';

const PACKAGE_ALLOW_LIST = Object.freeze({
  // AC-48: the writer adds the format version, the version number and the publish time (stage B, OA-2).
  metadata: Object.freeze(['venueCode']),
  venue: Object.freeze([
    'code',
    'name',
    'evacEscalatorsAllowed',
    'boundary',
    'georeference',
    'mapUp',
  ]),
  // In the document's order, each with its position: the main building is the first (L176, AC-131). AC-45: a
  // building's mapUp is resolved (the site's where it has none).
  buildings: Object.freeze([
    'id',
    'position',
    'name',
    'typeCode',
    'typeLabel',
    'typeSortOrder',
    'footprint',
    'mapUp',
  ]),
  levels: Object.freeze([
    'id',
    'position',
    'building',
    'ordinal',
    'outdoor',
    'name',
    'shortName',
    'spokenName',
    'elevation',
    'origin',
    'size',
    'height',
  ]),
  units: Object.freeze([
    'id',
    'position',
    'level',
    'category',
    'name',
    'outline',
    'walkable',
    'passThrough',
    'parent',
    'doors',
  ]),
  openings: Object.freeze([
    'id',
    'level',
    'midpoint',
    'width',
    'kind',
    'entrance',
    'clearW',
    'name',
  ]),
  items: Object.freeze([
    'id',
    'level',
    'typeCode',
    'label',
    'centre',
    'rot',
    'size',
    'blocks',
    'round',
  ]),
  // Active stores, one per unit (DC-27); AC-47: the store status as of publish, with IsRoutable.
  stores: Object.freeze([
    'placeId',
    'name',
    'categoryCode',
    'categoryLabel',
    'categorySortOrder',
    'keywords',
    'spokenName',
    'statusCode',
    'statusLabel',
    'statusSortOrder',
    'isRoutable',
  ]),
  amenities: Object.freeze([
    'id',
    'level',
    'unit',
    'name',
    'at',
    'typeCode',
    'typeLabel',
    'typeSortOrder',
    'synonyms',
    'isAccessible',
  ]),
  transitPoints: Object.freeze([
    'id',
    'level',
    'name',
    'note',
    'at',
    'typeCode',
    'typeLabel',
    'typeSortOrder',
  ]),
  anchors: Object.freeze(['id', 'level', 'unit', 'name', 'at']),
  // AC-70: each connector's name with its spoken name (AC-45).
  connectors: Object.freeze([
    'id',
    'position',
    'name',
    'spokenName',
    'kind',
    'typeCode',
    'typeLabel',
    'typeSortOrder',
    'isStepFree',
    'stops',
    'twoWay',
    'preferred',
    'evacuationOnly',
  ]),
  connectorStops: Object.freeze(['level', 'x', 'z']),
  // Active beacons on a level of the layout.
  beacons: Object.freeze([
    'uuid',
    'major',
    'minor',
    'level',
    'x',
    'z',
    'mountHeightM',
    'measuredPower',
  ]),
  // AC-94, AC-134: the wall segments the engine used, per level.
  walls: Object.freeze(['level', 'x1', 'z1', 'x2', 'z2']),
  // AC-105, AC-132; plan/FF-3-prime-A1.md 1.0 section 2: the CSR in the layout FF-4's RoutingGraph reads.
  graph: Object.freeze([
    'nodeCount',
    'x',
    'z',
    'levelIndex',
    'offsets',
    'targets',
    'costS',
    'lengthM',
    'clearanceM',
    'kind',
    'ref',
    'levelSpan',
    'flags',
    'levels',
    'stores',
    'connectors',
    'places',
    'passages',
    'entrances',
  ]),
  graphStores: Object.freeze(['id', 'passThrough', 'isRoutable']),
  graphConnectors: Object.freeze(['id', 'costModel', 'name']),
  // AC-99: every place with its door nodes, joined or not.
  graphPlaces: Object.freeze(['id', 'kind', 'levelId', 'name', 'doorNodes', 'storeId']),
  graphPassages: Object.freeze(['storeId', 'serves']),
  // AC-72, AC-120: every routing.* setting as resolved for the tenant.
  routingSettings: Object.freeze(['key', 'value']),
});

/** The model's top-level lists and objects, in the order the model holds them. */
const PACKAGE_SECTIONS = Object.freeze([
  'metadata',
  'venue',
  'buildings',
  'levels',
  'units',
  'openings',
  'items',
  'stores',
  'amenities',
  'transitPoints',
  'anchors',
  'connectors',
  'beacons',
  'walls',
  'graph',
  'routingSettings',
]);

module.exports = { PACKAGE_ALLOW_LIST, PACKAGE_SECTIONS };
