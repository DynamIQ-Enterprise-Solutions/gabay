// Platform lookup rows (TenantId NULL, DC1), roles and the platform routing settings. Inserted once; re-runs reuse them.
// Codes follow the schema's comments. Connector costs are in seconds since schema 0.17 (L170 Q4; OA-3 AC-7): the four pairs
// are spec/P0-03.md r5 AC-101's (office section 11), and migration 0003 converts an older database to the same pairs.
'use strict';

const { insert } = require('./db');

/**
 * The routing.* settings written as platform GlobalSetting rows (OA-3 AC-7; spec/P0-03.md r5 AC-120: P0-06's tests read
 * them), the value as text. They are the API's DEFAULTS (functions/src/config/settings.js); the seed holds its own copy so
 * db/seeds never loads the API's code (plan DC-M), and seed.content.test.js asserts the two are equal.
 */
const ROUTING_SETTINGS = Object.freeze(
  [
    ['routing.walkSpeedMps', '1.2'],
    ['routing.storeCrossingFactor', '1.25'],
    ['routing.stairsSaveS', '120'],
    ['routing.otherWayMarginS', '0.417'],
    ['routing.stepFreeMinWidthM', '1.2'],
  ].map(([key, value]) => Object.freeze({ key, value })),
);

const PLATFORM = {
  BuildingType: [
    { Code: 'MAIN', Label: 'Main building' },
    { Code: 'WING', Label: 'Wing' },
    { Code: 'ANNEX', Label: 'Annex' },
    { Code: 'PARKING', Label: 'Parking' },
  ],
  OccupantCategory: [
    { Code: 'FASHION', Label: 'Fashion' },
    { Code: 'DINING', Label: 'Food and drink' },
    { Code: 'ELECTRONICS', Label: 'Electronics' },
    { Code: 'BOOKS', Label: 'Books and hobbies' },
    { Code: 'SERVICES', Label: 'Services' },
    { Code: 'CINEMA', Label: 'Cinema' },
    { Code: 'ENTERTAINMENT', Label: 'Entertainment' },
    { Code: 'LEISURE', Label: 'Leisure' },
    { Code: 'OTHER', Label: 'Other shops' },
  ],
  AmenityType: [
    { Code: 'CR', Label: 'Restroom', SearchSynonyms: 'comfort room, cr, restroom, toilet, banyo, washroom', IsAccessible: false },
    { Code: 'CR_PWD', Label: 'Accessible restroom', SearchSynonyms: 'pwd cr, accessible toilet', IsAccessible: true },
    { Code: 'NURSING', Label: 'Nursing room', SearchSynonyms: 'breastfeeding, lactation' },
    { Code: 'PRAYER', Label: 'Prayer room', SearchSynonyms: 'chapel, prayer' },
    { Code: 'FIRST_AID', Label: 'First aid', SearchSynonyms: 'clinic, medic' },
    { Code: 'SECURITY', Label: 'Security', SearchSynonyms: 'guard, guwardiya' },
    { Code: 'INFO', Label: 'Information desk', SearchSynonyms: 'concierge, help, info' },
    { Code: 'ATM', Label: 'ATM', SearchSynonyms: 'bank, cash, atm' },
    { Code: 'EV_CHARGING', Label: 'EV charging', SearchSynonyms: 'electric car, charger' },
    { Code: 'REFUGE_AREA', Label: 'Refuge area' },
    { Code: 'ASSEMBLY_AREA', Label: 'Assembly area' },
  ],
  TransitType: [
    { Code: 'TRAIN_BRIDGE', Label: 'Train bridge' },
    { Code: 'TERMINAL', Label: 'Terminal' },
    { Code: 'JEEPNEY_BAY', Label: 'Jeepney bay' },
    { Code: 'TAXI_BAY', Label: 'Taxi bay' },
    { Code: 'PARKING_ENTRY', Label: 'Parking entry' },
    { Code: 'DROP_OFF', Label: 'Drop-off' },
  ],
  ConnectorType: [
    { Code: 'ELEVATOR', Label: 'Lift', CostModel: 'ELEVATOR', IsStepFree: true, CostBaseS: 4, CostPerRiseS: 0.4 },
    { Code: 'STAIRS', Label: 'Stairs', CostModel: 'STAIRS', IsStepFree: false, CostBaseS: 1.5, CostPerRiseS: 1.1 },
    { Code: 'ESCALATOR', Label: 'Escalator', CostModel: 'ESCALATOR', IsStepFree: false, CostBaseS: 1, CostPerRiseS: 0.8 },
    { Code: 'RAMP', Label: 'Ramp', CostModel: 'RAMP', IsStepFree: true, CostBaseS: 1, CostPerRiseS: 1 },
  ],
  // The spike's RF model gives the signal penalties (assets/venue/*.json, model.obstacleLossDbByKind).
  ObjectType: [
    { Code: 'PILLAR', Label: 'Pillar', BlocksWalk: true, SignalPenaltyDb: 20 },
    { Code: 'SHAFT', Label: 'Shaft', BlocksWalk: true, SignalPenaltyDb: 20 },
    { Code: 'FURNITURE', Label: 'Furniture', BlocksWalk: true, SignalPenaltyDb: 1 },
  ],
  // L117: the H2's conservative spec until a unit label is read.
  BeaconModel: [{ Code: 'MOKO_H2', Label: 'MOKOSmart H2', IpRating: 'IP65', BatteryLifeMonths: 50 }],
  StoreStatus: [
    { Code: 'OPEN', Label: 'Open', IsRoutable: true },
    { Code: 'CLOSED', Label: 'Closed', IsRoutable: false },
    { Code: 'BEING_REPAIRED', Label: 'Being repaired', IsRoutable: false },
    { Code: 'OPENING_SOON', Label: 'Opening soon', IsRoutable: false },
  ],
};

const ROLES = [
  { Code: 'SUPERADMIN', Label: 'Super admin', IsPlatformRole: true },
  { Code: 'MALL_ADMIN', Label: 'Mall admin', IsPlatformRole: false },
  { Code: 'VENUE_EDITOR', Label: 'Venue editor', IsPlatformRole: false },
  { Code: 'VIEWER', Label: 'Viewer', IsPlatformRole: false },
];

const ID_COLUMN = (table) => `${table}Id`;

/** Find a lookup row by (TenantId, Code), inserting it when absent. Returns its id. */
async function ensureLookup(client, table, tenantId, row) {
  const id = ID_COLUMN(table);
  const found = await client.query(
    `SELECT ${id} AS id FROM gabay.${table} WHERE Code = $1 AND TenantId IS NOT DISTINCT FROM $2`,
    [row.Code, tenantId],
  );
  if (found.rows.length) return found.rows[0].id;
  return insert(client, table, { TenantId: tenantId, ...row }, id);
}

/** A platform GlobalSetting row by key, inserted when absent; an existing row (an operator's value) is kept. Returns its id. */
async function ensurePlatformSetting(client, { key, value }) {
  const found = await client.query(
    'SELECT GlobalSettingId AS id FROM gabay.GlobalSetting WHERE TenantId IS NULL AND SettingKey = $1',
    [key],
  );
  if (found.rows.length) return found.rows[0].id;
  return insert(client, 'GlobalSetting', { TenantId: null, SettingKey: key, SettingValue: value }, 'GlobalSettingId');
}

/** Every platform lookup, role and routing setting; returns { table: { CODE: id } } (GlobalSetting by key). */
async function seedPlatform(client) {
  const ids = {};
  for (const [table, rows] of Object.entries(PLATFORM)) {
    ids[table] = {};
    for (const row of rows) ids[table][row.Code] = await ensureLookup(client, table, null, row);
  }
  ids.Role = {};
  for (const role of ROLES) {
    const found = await client.query('SELECT RoleId AS id FROM gabay.Role WHERE Code = $1', [role.Code]);
    ids.Role[role.Code] = found.rows.length ? found.rows[0].id : await insert(client, 'Role', role, 'RoleId');
  }
  ids.GlobalSetting = {};
  for (const setting of ROUTING_SETTINGS) ids.GlobalSetting[setting.key] = await ensurePlatformSetting(client, setting);
  return ids;
}

module.exports = { seedPlatform, ensureLookup, ROUTING_SETTINGS };
