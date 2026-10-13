// The object catalog route's service (spec/OA-2.md r1 AC-36; spec/OA-1.md r1 AC-44, AC-45): the tenant's ObjectType
// rows over the platform's, through OA-1's shapeCatalog, with the tenant's CatalogVersion (mapContext.repository.js).
//
// CONTRACT ONLY (plan/OA-2-map-storage.md 1.0 section 13 step 3): answers 501 until OA-2 step 5.
'use strict';

const { notBuilt } = require('./notBuilt');

/**
 * @param {object} _deps
 * @param {{ query: Function }} _deps.db
 * @returns {{ catalog: (tenantId: number) => Promise<{ version: number, finishes: string[],
 *   floorFinishes: string[], types: object[] }> }}
 */
function createMapCatalogService(_deps) {
  return { catalog: notBuilt() };
}

module.exports = { createMapCatalogService };
