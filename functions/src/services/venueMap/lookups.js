// Lookup codes (spec/OA-1.md r1 AC-19, AC-20, AC-46; the global-lookup trap). A code resolves for the request's
// tenant: its own row first, then the platform row (TenantId NULL) for a code it does not have. Another tenant's
// rows never reach the context: the caller's SQL reads (TenantId = $1 OR TenantId IS NULL), and the shapers refuse
// rows of two tenants (DC-E19). An inactive code still resolves (DC-15), so a drawn element survives deactivation.
'use strict';

/** How each lookup is named in a problem. */
const LOOKUP_WORDS = Object.freeze({
  BuildingType: 'building type',
  AmenityType: 'amenity type',
  TransitType: 'transit point type',
  ConnectorType: 'connector type',
  ObjectType: 'object type in the catalog',
  OccupantCategory: 'store category',
});

/**
 * The rows by code, the tenant's own row over a platform row with the same code. Throws when the rows come from
 * two tenants: that is a query that forgot its tenant predicate (rule 2), never an input to accept.
 */
function tenantFirst(rows, label) {
  if (!Array.isArray(rows))
    throw new TypeError(`venue map context: ${label} must be a list of rows`);
  assertOneTenant([rows]);
  const byCode = new Map();
  for (const row of rows) {
    const held = byCode.get(row.code);
    if (!held || (isPlatform(held) && !isPlatform(row))) byCode.set(row.code, row);
  }
  return byCode;
}

/** A platform row: TenantId NULL. */
const isPlatform = (row) => row.tenantId === null || row.tenantId === undefined;

/** Throws unless every row that has a tenant has the same one. */
function assertOneTenant(rowLists) {
  const tenants = new Set();
  for (const rows of rowLists) {
    for (const row of rows) if (!isPlatform(row)) tenants.add(row.tenantId);
  }
  if (tenants.size > 1) {
    throw new Error(
      `venue map context: rows of ${tenants.size} tenants were given; give the request tenant's rows and the platform's only`,
    );
  }
}

/** The context entry for a code, or undefined when the code does not resolve. */
function resolveCode(context, lookup, code) {
  return context.lookups[lookup].get(code);
}

module.exports = { LOOKUP_WORDS, tenantFirst, assertOneTenant, resolveCode };
