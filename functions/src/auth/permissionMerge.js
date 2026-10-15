// The permission merge (standard §3.4 layer 2; db/schema.sql comments on RolePermission and UserPermission).
// Pure functions: no database, no request. The guards (SEC-1, through tenantContext) and GET /api/me call the same
// per-tenant derivation (accessInTenant), so the screen and the server can never disagree ("the identical merge runs at
// sign-in and in the guard").
//
//   - the role rows of every role the user holds are OR-ed per route;
//   - a UserPermission row REPLACES the merged role row for its route (it may take rights away);
//   - a route with no row at all is absent from the result, which means "not granted".
//
// The result map has NO prototype (Object.create(null)): "constructor" or "toString" are not routes, so a lookup by a
// route name needs no Object.hasOwn guard. A UserPermission override has no tenant column, so it applies in EVERY
// tenant the user belongs to; S6 and S7 enforce who may write one (owner's ruling: only SUPERADMIN, or an admin who is
// MALL_ADMIN in every tenant that user belongs to).
'use strict';

/** The platform-wide super user (L41). Q8: the only role that bypasses permission rows. */
const SUPERADMIN_ROLE_CODE = 'SUPERADMIN';

const flagsOf = (row) => ({
  create: row.canCreate === true,
  read: row.canRead === true,
  update: row.canUpdate === true,
  delete: row.canDelete === true,
});

/**
 * @param {{roleIds: number[], rolePermissions: object[], userPermissions: object[]}} input
 *   rolePermissions: { roleId, routeKey, canCreate, canRead, canUpdate, canDelete }
 *   userPermissions: { routeKey, canCreate, canRead, canUpdate, canDelete }
 * @returns {Record<string, {create: boolean, read: boolean, update: boolean, delete: boolean}>}
 */
function mergeRoutePermissions({ roleIds, rolePermissions, userPermissions }) {
  const held = new Set(roleIds);
  const merged = new Map();
  for (const row of rolePermissions) {
    if (!held.has(row.roleId)) continue;
    const add = flagsOf(row);
    const have = merged.get(row.routeKey);
    merged.set(
      row.routeKey,
      have
        ? {
            create: have.create || add.create,
            read: have.read || add.read,
            update: have.update || add.update,
            delete: have.delete || add.delete,
          }
        : add,
    );
  }
  for (const row of userPermissions) merged.set(row.routeKey, flagsOf(row)); // replaces, never ORs
  const out = Object.create(null); // no prototype: "__proto__" is an ordinary own key too
  for (const [routeKey, flags] of merged) out[routeKey] = flags;
  return out;
}

/** A platform row: no tenant, and a role flagged IsPlatformRole (owner's ruling I2). It applies inside every tenant. */
const isPlatformRow = (r) => r.tenantId === null && r.isPlatformRole === true;

/** A NULL-tenant row of a role not flagged IsPlatformRole: bad data, ignored everywhere (it grants nothing). */
const isIgnoredRow = (r) => r.tenantId === null && r.isPlatformRole !== true;

/** What is logged, by ids only, for each ignored row (GET /api/me and tenantContext both log it). */
const IGNORED_ROW = 'a NULL-tenant UserRole row holds a role that is not a platform role: ignored';

/**
 * Reports each ignored row of `roles` through `warn`, with ids only (never an email or a name).
 * @param {number} userId
 * @param {object[]} roles
 * @param {(fields: object, message: string) => void} warn
 */
function warnIgnoredRows(userId, roles, warn) {
  for (const r of roles.filter(isIgnoredRow)) {
    warn({ userId, roleId: r.roleId, roleCode: r.roleCode }, IGNORED_ROW);
  }
}

/**
 * THE per-tenant derivation (SEC-1 AC-17, DC-3): what the user may do inside `tenantId`. GET /api/me (through
 * buildAccessProfile) and the guards (through tenantContext) both call it, so "the guard allows" and "the /api/me flag
 * is true" never disagree (AC-31).
 *
 *   tenantRoleCodes  the codes of the user's own rows IN this tenant (empty: the tenant is not held)
 *   roles            those codes plus the platform roles' codes: the "own roles" the role guard reads (spec section 2.1)
 *   permissions      the merge over the same roles (role rows OR-ed, a user row replaces, no row = absent)
 *   isSuperAdmin     holdsSuperAdmin: the one bypass of permission rows (PH2 Q8)
 *   isTenantWide     sees every venue of the tenant (L186 Q2 (a)): a role of `tenantWideRoleCodes` among `roles`. The
 *                    SUPERADMIN code counts only as the real platform role (a SUPERADMIN row bound to a tenant is bad
 *                    data, I2, and gives nothing a plain row of an unknown role would not)
 *
 * @param {{roles: object[], rolePermissions: object[], userPermissions: object[]}} snapshot  accessStore.loadForUser's
 * @param {number} tenantId
 * @param {readonly string[]} [tenantWideRoleCodes]  auth/routeKeys.js TENANT_WIDE_ROLE_CODES (DC-14)
 */
function accessInTenant(
  { roles, rolePermissions, userPermissions },
  tenantId,
  tenantWideRoleCodes = [],
) {
  const platform = roles.filter(isPlatformRow);
  const own = roles.filter((r) => r.tenantId === tenantId);
  const applicable = [...platform, ...own];
  const isSuperAdmin = holdsSuperAdmin(roles);
  const wide = new Set(tenantWideRoleCodes);
  return {
    tenantRoleCodes: [...new Set(own.map((r) => r.roleCode))],
    roles: [...new Set(applicable.map((r) => r.roleCode))],
    permissions: mergeRoutePermissions({
      roleIds: applicable.map((r) => r.roleId),
      rolePermissions,
      userPermissions,
    }),
    isSuperAdmin,
    isTenantWide:
      isSuperAdmin ||
      applicable.some((r) => r.roleCode !== SUPERADMIN_ROLE_CODE && wide.has(r.roleCode)),
  };
}

/**
 * What GET /api/me returns about access: the tenants (the user's UserRole rows, L121) each with its roles and merged
 * permissions, the platform roles, and the SUPERADMIN flag. Platform roles (UserRole.TenantId NULL) apply inside
 * every tenant. User overrides carry no tenant, so they apply in every tenant too. Each tenant's entry comes from
 * accessInTenant, the guards' own derivation (SEC-1 AC-17).
 *
 * A role is a platform role only when its UserRole row has no tenant AND the role is flagged IsPlatformRole; SUPERADMIN
 * needs both, plus the code (owner's ruling I2). A NULL-tenant row for any other role is bad data: it is ignored (it
 * grants nothing, anywhere) and reported through `warn`, with ids only.
 *
 * @param {{user: object, roles: object[], rolePermissions: object[], userPermissions: object[],
 *   warn?: (fields: object, message: string) => void}} input
 *   roles: { roleId, roleCode, isPlatformRole, tenantId (null = platform), tenantCode, tenantName, tenantIsActive }
 */
function buildAccessProfile({ user, roles, rolePermissions, userPermissions, warn = () => {} }) {
  warnIgnoredRows(user.userId, roles, warn);
  const firstRowOf = new Map(); // tenant id -> its first row, in the store's order
  for (const r of roles) {
    if (r.tenantId !== null && !firstRowOf.has(r.tenantId)) firstRowOf.set(r.tenantId, r);
  }
  const snapshot = { roles, rolePermissions, userPermissions };
  const tenants = [...firstRowOf].map(([tenantId, row]) => {
    const view = accessInTenant(snapshot, tenantId);
    return {
      tenantId,
      code: row.tenantCode,
      name: row.tenantName,
      isActive: row.tenantIsActive,
      roles: view.tenantRoleCodes,
      permissions: view.permissions,
    };
  });
  return {
    user: { userId: user.userId, email: user.email, displayName: user.displayName },
    // Platform rows only (NULL tenant and IsPlatformRole): a SUPERADMIN bound to a tenant, or not flagged platform, is
    // bad data and must not bypass anything.
    isSuperAdmin: holdsSuperAdmin(roles),
    platformRoles: [...new Set(roles.filter(isPlatformRow).map((r) => r.roleCode))],
    tenants,
  };
}

/**
 * True when the rows hold SUPERADMIN as a platform role: a NULL-tenant UserRole row, a role flagged IsPlatformRole, and
 * the code (owner's ruling I2). The one test of "is this a superuser", shared by GET /api/me and the guards.
 * @param {Array<{roleCode: string, isPlatformRole: boolean, tenantId: number|null}>} roles
 */
function holdsSuperAdmin(roles) {
  return roles.some((r) => isPlatformRow(r) && r.roleCode === SUPERADMIN_ROLE_CODE);
}

module.exports = {
  mergeRoutePermissions,
  accessInTenant,
  buildAccessProfile,
  holdsSuperAdmin,
  warnIgnoredRows,
  SUPERADMIN_ROLE_CODE,
};
