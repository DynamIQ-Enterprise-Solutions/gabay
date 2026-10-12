// AC-19 (Blueprint DC8, re-checked at publish; DC-10; EC-11): a row of the venue that references a lookup row
// belonging to another tenant refuses the publish. A platform row (TenantId NULL) or the tenant's own row is fine
// (the global-lookup trap). Rows that never enter the package (inactive occupants and beacons) are not checked.
'use strict';

const { codesOf } = require('../../../config/closedSets');
const { ref, at } = require('../elements');
const { TABLE_OF_LOOKUP } = require('../draft');

const PROBLEM = codesOf('PublishProblemKind');

function checkTenantRefs(venue, issues) {
  const check = (element, levelId, point, lookups, lookupId) => {
    if (lookupId === null || lookupId === undefined) return;
    const row = venue.lookups[lookups].get(lookupId);
    if (row.tenantId === null || row.tenantId === venue.tenantId) return;
    issues.problem(PROBLEM.TENANT_MISMATCH, {
      element,
      levelId,
      at: point,
      params: { lookup: TABLE_OF_LOOKUP[lookups], lookupId },
    });
  };
  const unitsById = new Map(venue.units.map((u) => [u.id, u]));
  for (const b of venue.buildings) check(ref('Building', b), null, null, 'buildingTypes', b.typeId);
  for (const f of venue.floorObjects) {
    check(
      ref('FloorObject', f, null),
      f.levelId,
      at(f.centerX, f.centerY),
      'objectTypes',
      f.typeId,
    );
  }
  for (const o of venue.occupants) {
    if (!o.isActive) continue;
    const levelId = unitsById.get(o.unitId).levelId;
    check(ref('Occupant', o), levelId, null, 'occupantCategories', o.categoryId);
    check(ref('Occupant', o), levelId, null, 'storeStatuses', o.statusId);
  }
  for (const a of venue.amenities)
    check(ref('Amenity', a), a.levelId, at(a.x, a.y), 'amenityTypes', a.typeId);
  for (const t of venue.transitPoints) {
    check(ref('TransitPoint', t), t.levelId, at(t.x, t.y), 'transitTypes', t.typeId);
  }
  for (const c of venue.connectors) {
    check(ref('NavConnector', c), c.fromLevelId, at(c.fromX, c.fromY), 'connectorTypes', c.typeId);
  }
  for (const b of venue.beacons) {
    if (b.isActive)
      check(ref('Beacon', b, null), b.levelId, at(b.x, b.y), 'beaconModels', b.modelId);
  }
}

module.exports = { checkTenantRefs };
