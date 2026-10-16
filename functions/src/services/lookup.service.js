// Lookups, read-only (Blueprint 4.15; plan/FF0-dev-stub-lookups.md section 3): the option lists behind the admin's dropdowns, read from
// the seeded tables (rule 5: no hardcoded option list). Phase 3 (R11) adds tenant values on a screen, the maintenance
// screen and cascading lookups; none of that is here.
//
// The allow-list (rule 3) is this frozen map: a name in the URL selects an entry, and nothing the client sends reaches
// SQL as anything but a bound parameter. Each entry carries its own literal SQL, so the table and its id column are
// never built from text and the tenant-predicate lint can read every query. A later slice adds its name as one more entry.
// OA-3a (spec/OA-3.md AC-7a, DC-27) added 'connector-types', whose rows also carry costModel, costBaseS and costPerRiseS:
// the seconds a connector costs (spec/P0-03.md r5 AC-101), as JavaScript numbers, the representation the map context gives
// every DECIMAL(9,3) value (mapContext.repository.js: Number() of the column's text; metres and seconds, never money).
//
// The global-lookup trap (Blueprint Part 1): rows with TenantId NULL are platform defaults, so a tenant reads
// (TenantId = $1 OR TenantId IS NULL) and this file never writes a row, NULL-tenant or otherwise. The tenant is the
// request's (req.tenantCompanyID, rule 2), passed in by the route, never read from anything the client sent.
'use strict';

const { httpError } = require('../utils/errors');
const { parsePaging, likePattern, runPaged } = require('../utils/pagination');
const { assertTenantId } = require('../utils/requestContext');

const NOT_FOUND = 'Not found';

/**
 * Both orders at once: SortOrder, then Label, then the id so pages never overlap. The client has no say in it, so
 * the one key is the allow-list and `id` is the output column every entry below names.
 */
const PAGING = Object.freeze({
  sortMap: Object.freeze({ order: 'SortOrder ASC, Label' }),
  defaultSort: 'order',
  tieBreaker: 'id',
});

/**
 * @typedef {{ id: number, code: string, label: string, isActive: boolean }} LookupRow
 * @typedef {object} LookupEntry
 * @property {(query: Function, tenantId: number, search: string|null, paging: object) => Promise<object>} page
 *   the list: active rows of the tenant and the platform, filtered by a label search, paged
 * @property {(query: Function, tenantId: number, id: number) => Promise<{rows: LookupRow[]}>} one
 *   one row, active or not, of the tenant or the platform; never another tenant's
 */

/** A connector type row's two DECIMAL(9,3) costs, which pg returns as text, as numbers (DC-27). */
const costsAsNumbers = (row) => ({
  ...row,
  costBaseS: Number(row.costBaseS),
  costPerRiseS: Number(row.costPerRiseS),
});

/** @type {Readonly<Record<string, LookupEntry>>} */
const LOOKUPS = Object.freeze({
  'connector-types': Object.freeze({
    page: async (query, tenantId, search, paging) => {
      const result = await runPaged({
        query,
        select:
          'ConnectorTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive", CostModel AS "costModel", CostBaseS AS "costBaseS", CostPerRiseS AS "costPerRiseS"',
        from: 'gabay.ConnectorType',
        where:
          '(TenantId = $1 OR TenantId IS NULL) AND IsActive AND ($2::text IS NULL OR Label ILIKE $2)',
        params: [tenantId, search],
        paging,
      });
      return { ...result, items: result.items.map(costsAsNumbers) };
    },
    one: async (query, tenantId, id) => {
      const result = await query(
        `SELECT ConnectorTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive", CostModel AS "costModel",
                CostBaseS AS "costBaseS", CostPerRiseS AS "costPerRiseS"
           FROM gabay.ConnectorType
          WHERE ConnectorTypeId = $1 AND (TenantId = $2 OR TenantId IS NULL)`,
        [id, tenantId],
      );
      return { ...result, rows: result.rows.map(costsAsNumbers) };
    },
  }),
  'building-types': Object.freeze({
    page: (query, tenantId, search, paging) =>
      runPaged({
        query,
        select: 'BuildingTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"',
        from: 'gabay.BuildingType',
        where:
          '(TenantId = $1 OR TenantId IS NULL) AND IsActive AND ($2::text IS NULL OR Label ILIKE $2)',
        params: [tenantId, search],
        paging,
      }),
    one: (query, tenantId, id) =>
      query(
        `SELECT BuildingTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"
           FROM gabay.BuildingType
          WHERE BuildingTypeId = $1 AND (TenantId = $2 OR TenantId IS NULL)`,
        [id, tenantId],
      ),
  }),
  'amenity-types': Object.freeze({
    page: (query, tenantId, search, paging) =>
      runPaged({
        query,
        select: 'AmenityTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"',
        from: 'gabay.AmenityType',
        where:
          '(TenantId = $1 OR TenantId IS NULL) AND IsActive AND ($2::text IS NULL OR Label ILIKE $2)',
        params: [tenantId, search],
        paging,
      }),
    one: (query, tenantId, id) =>
      query(
        `SELECT AmenityTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"
           FROM gabay.AmenityType
          WHERE AmenityTypeId = $1 AND (TenantId = $2 OR TenantId IS NULL)`,
        [id, tenantId],
      ),
  }),
  'transit-types': Object.freeze({
    page: (query, tenantId, search, paging) =>
      runPaged({
        query,
        select: 'TransitTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"',
        from: 'gabay.TransitType',
        where:
          '(TenantId = $1 OR TenantId IS NULL) AND IsActive AND ($2::text IS NULL OR Label ILIKE $2)',
        params: [tenantId, search],
        paging,
      }),
    one: (query, tenantId, id) =>
      query(
        `SELECT TransitTypeId AS id, Code AS code, Label AS label, IsActive AS "isActive"
           FROM gabay.TransitType
          WHERE TransitTypeId = $1 AND (TenantId = $2 OR TenantId IS NULL)`,
        [id, tenantId],
      ),
  }),
});

/**
 * The entry for a name the route's schema already checked against LOOKUPS' own keys (validation/params.js): a name that is
 * not one is a wiring bug here, never a request (a plain Error: 500).
 */
function entryFor(name) {
  if (typeof name !== 'string' || !Object.hasOwn(LOOKUPS, name)) {
    throw new Error('lookup service: the name was not validated against LOOKUPS');
  }
  return LOOKUPS[name];
}

/** @param {{query: (text: string, params: any[]) => Promise<{rows: any[]}>}} db */
function createLookupService(db) {
  const query = (text, params) => db.query(text, params);
  return {
    /**
     * @param {string} name  the lookup's name in the URL, validated (validation/params.js lookupNameParam)
     * @param {number} tenantId  req.tenantCompanyID
     * @param {object} params  the validated query (validation/query.js pagingQuery): page, pageSize and search
     * @returns {Promise<{items: LookupRow[], totalCount: number, page: number, pageSize: number}>}
     */
    async list(name, tenantId, params) {
      const entry = entryFor(name);
      assertTenantId(tenantId);
      // sortBy and sortOrder are deliberately not passed on: the order is fixed.
      const paging = parsePaging(
        { page: params.page, pageSize: params.pageSize, search: params.search },
        PAGING,
      );
      const search = paging.search === null ? null : likePattern(paging.search);
      return entry.page(query, tenantId, search, paging);
    },

    /**
     * One row, even an inactive one (the picker keeps showing a value that has since been switched off, section 4.10).
     * @param {number} id  the id from the URL, validated (validation/params.js lookupItemParams)
     * @returns {Promise<LookupRow>}
     * @throws {Error} 404 for no such row, or a row that belongs to another tenant
     */
    async get(name, tenantId, id) {
      const entry = entryFor(name);
      assertTenantId(tenantId);
      const { rows } = await entry.one(query, tenantId, id);
      if (rows.length === 0) throw httpError(404, NOT_FOUND);
      return rows[0];
    },
  };
}

module.exports = { createLookupService, LOOKUPS };
