// The object catalog route's service (spec/OA-2.md r1 AC-36; spec/OA-1.md r1 AC-44, AC-45): the tenant's ObjectType
// rows over the platform's, through OA-1's shapeCatalog, with the tenant's CatalogVersion (mapContext.repository.js).
// Inactive types are served, marked active: false (OA-1 DC-15). The tenant is the route's req.tenantCompanyID (rule 2).
'use strict';

const { assertTenantId } = require('../../utils/requestContext');
const { loadCatalog } = require('./mapContext.repository');

/**
 * @param {object} deps
 * @param {{ query: Function }} deps.db
 * @returns {{ catalog: (tenantId: number) => Promise<{ version: number, finishes: string[],
 *   floorFinishes: string[], types: object[] }> }}
 */
function createMapCatalogService({ db }) {
  return {
    async catalog(tenantId) {
      assertTenantId(tenantId);
      return loadCatalog(db, tenantId);
    },
  };
}

module.exports = { createMapCatalogService };
