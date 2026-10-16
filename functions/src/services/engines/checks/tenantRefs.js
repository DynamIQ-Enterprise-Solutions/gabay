// TENANT_MISMATCH (spec/P0-03.md r4 AC-108; r3 AC-19 kept as a second line of defence; rule 2, invariant 13;
// blocking): a code the snapshot's own tenant-bound lookup read does not resolve, because only another tenant has it
// or no row has it. The validator's context and the snapshot are two reads (AC-117), and a package must never carry
// another tenant's row. The layout's codes: each building's type, amenity's type, transit point's type, connector's
// type and item's type (the catalog). The rows' code: each active store's category. The snapshot's lookups hold the
// tenant's rows and the platform's (TenantId = $t OR NULL, AC-117), so "does not resolve" is "is not there".
'use strict';

const { KIND } = require('../findings');
const { elementRef, at, documentRank, CONNECTOR_RANK, ROW_RANK } = require('../elements');

/**
 * The layout's codes (a valid layout: the validator read them against a context that may differ, EC-80).
 * @param {object} findings  createFindings()'s collector
 * @param {object} layout  readLayout's result
 * @param {object} context  the snapshot's context (its lookups)
 */
function checkLayoutCodes(findings, layout, context) {
  const { lookups } = context;
  const check = (lookup, code, fields) => {
    if (!lookups[lookup].has(code)) {
      findings.add(KIND.TENANT_MISMATCH, { ...fields, params: { lookup, code } });
    }
  };
  for (const building of layout.buildings) {
    check('BuildingType', building.typeCode, {
      element: elementRef('building', building),
      order: [building.index],
    });
  }
  for (const level of layout.levels) {
    for (const item of level.items) {
      check('ObjectType', item.typeCode, {
        level,
        element: elementRef('item', item),
        at: at([item.x, item.z]),
        order: [documentRank('item'), item.index],
      });
    }
    for (const point of [...level.amenities, ...level.transitPoints]) {
      check(point.kind === 'amenity' ? 'AmenityType' : 'TransitType', point.typeCode, {
        level,
        element: elementRef(point.kind, point),
        at: at(point.at),
        order: [documentRank(point.kind), point.index],
      });
    }
  }
  for (const connector of layout.connectors) {
    check('ConnectorType', connector.typeCode, {
      level: layout.levels[connector.levels[0]],
      element: elementRef('connector', connector),
      at: at(connector.stops[0]),
      order: [CONNECTOR_RANK, connector.index],
    });
  }
}

/**
 * The rows' code: each active store's category (AC-108). A row check, so it runs on an invalid layout too (AC-115).
 * @param {object} findings  createFindings()'s collector
 * @param {object[]} stores  the snapshot's store rows
 * @param {object} context  the snapshot's context
 * @param {object} keys  layoutKeys(layout)
 */
function checkStoreCategories(findings, stores, context, keys) {
  const categories = context.lookups.OccupantCategory;
  for (const store of stores) {
    if (!store.isActive || categories.has(store.category.code)) continue;
    findings.add(KIND.TENANT_MISMATCH, {
      level: keys.unitLevel.get(store.unitKey) ?? null,
      element: { kind: 'store', id: store.unitKey, name: store.name },
      order: [ROW_RANK, store.occupantId],
      params: {
        lookup: 'OccupantCategory',
        code: store.category.code,
        occupantId: store.occupantId,
      },
    });
  }
}

module.exports = { checkLayoutCodes, checkStoreCategories };
