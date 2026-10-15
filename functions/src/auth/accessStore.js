// The rows behind a user's access (standard §3.4; schema 0.14): their UserRole rows (which are their tenants, L121),
// the permission rows of those roles, and their own per-route overrides. permissionMerge.js turns them into the answer.
// SEC-1: auth/accessCache.js holds loadForUser's result for 30 s and venueGrantsFor's per (user, tenant); tenantContext
// asks tenantById for a SUPERADMIN's act-as; GET /api/me asks listTenants for a SUPERADMIN's act-as list.
'use strict';

/** @param {{query: (text: string, params: any[]) => Promise<{rows: any[]}>}} db */
function createAccessStore(db) {
  return {
    /**
     * @param {number} userId  the verified user's id (from req.user, resolved from the token's UID, never a tenant)
     * @returns {Promise<{roles: object[], rolePermissions: object[], userPermissions: object[]}>} the shapes
     *   buildAccessProfile (permissionMerge.js) takes. Only active roles count. Database errors propagate.
     */
    async loadForUser(userId) {
      // A user's tenants ARE their UserRole rows (L121). This reads them by UserId, before any tenant has been
      // chosen for a request (tenantContext, SEC-1, checks the chosen tenant against these same rows).
      const roles = await db.query(
        // tenant-scope: reads the user's own UserRole rows by UserId; a user's tenants are those rows (L121), no tenant is chosen yet
        `SELECT ur.RoleId, r.Code AS RoleCode, r.IsPlatformRole, ur.TenantId,
                t.Code AS TenantCode, t.Name AS TenantName, t.IsActive AS TenantIsActive
           FROM gabay.UserRole ur
           JOIN gabay.Role r ON r.RoleId = ur.RoleId
           LEFT JOIN gabay.Tenant t ON t.TenantId = ur.TenantId
          WHERE ur.UserId = $1
            AND r.IsActive
          ORDER BY ur.TenantId NULLS FIRST, r.Code`,
        [userId],
      );
      const roleRows = roles.rows.map((row) => ({
        roleId: row.roleid,
        roleCode: row.rolecode,
        isPlatformRole: row.isplatformrole,
        tenantId: row.tenantid,
        tenantCode: row.tenantcode,
        tenantName: row.tenantname,
        tenantIsActive: row.tenantisactive,
      }));

      const roleIds = [...new Set(roleRows.map((r) => r.roleId))];
      const rolePermissions =
        roleIds.length === 0
          ? { rows: [] }
          : await db.query(
              `SELECT rp.RoleId, pr.RouteKey, rp.CanCreate, rp.CanRead, rp.CanUpdate, rp.CanDelete
                 FROM gabay.RolePermission rp
                 JOIN gabay.PermissionRoute pr ON pr.PermissionRouteId = rp.PermissionRouteId
                WHERE rp.RoleId = ANY($1::int[])`,
              [roleIds],
            );

      const userPermissions = await db.query(
        `SELECT pr.RouteKey, up.CanCreate, up.CanRead, up.CanUpdate, up.CanDelete
           FROM gabay.UserPermission up
           JOIN gabay.PermissionRoute pr ON pr.PermissionRouteId = up.PermissionRouteId
          WHERE up.UserId = $1`,
        [userId],
      );

      return {
        roles: roleRows,
        rolePermissions: rolePermissions.rows.map((row) => ({
          roleId: row.roleid,
          routeKey: row.routekey,
          canCreate: row.cancreate,
          canRead: row.canread,
          canUpdate: row.canupdate,
          canDelete: row.candelete,
        })),
        userPermissions: userPermissions.rows.map((row) => ({
          routeKey: row.routekey,
          canCreate: row.cancreate,
          canRead: row.canread,
          canUpdate: row.canupdate,
          canDelete: row.candelete,
        })),
      };
    },

    /**
     * A tenant's active flag, or null when no tenant has this id (SEC-1 DC-26: one statement serves both questions).
     * For a SUPERADMIN naming a tenant it holds no row in (the superuser override, Blueprint 2.4; AC-9, AC-11). The
     * tenant is the one tenantContext is checking, bound as the parameter (rule 2).
     * @param {number} tenantId
     * @returns {Promise<{isActive: boolean}|null>}
     */
    async tenantById(tenantId) {
      const { rows } = await db.query('SELECT IsActive FROM gabay.Tenant WHERE TenantId = $1', [
        tenantId,
      ]);
      return rows.length === 0 ? null : { isActive: rows[0].isactive };
    },

    /**
     * The venues a venue-scoped user is granted in ONE tenant (SEC-1 AC-29, DC-13): read with the tenant bound from
     * req.tenantCompanyID, never every tenant's grants filtered afterwards. FK_UserVenueGrant_Venue makes a grant to
     * another tenant's venue impossible, so every id returned is a venue of `tenantId`.
     * @param {number} userId
     * @param {number} tenantId
     * @returns {Promise<number[]>} venue ids, ascending
     */
    async venueGrantsFor(userId, tenantId) {
      const { rows } = await db.query(
        `SELECT VenueId
           FROM gabay.UserVenueGrant
          WHERE UserId = $1 AND TenantId = $2
          ORDER BY VenueId`,
        [userId, tenantId],
      );
      return rows.map((row) => row.venueid);
    },

    /**
     * Every tenant, active or not (the SUPERADMIN override accepts any existing tenant), by Tenant.Code in code-unit
     * order: GET /api/me's `actAsTenants` for a SUPERADMIN (SEC-1 AC-32, L186 Q4 (a)). Not tenant-scoped: the Tenant
     * table is the tenants, and the pilot has about five (PRD section 7), so the list is not paged.
     * @returns {Promise<Array<{tenantId: number, code: string, name: string, isActive: boolean}>>}
     */
    async listTenants() {
      const { rows } = await db.query(
        // tenant-scope: the Tenant table itself, listed whole for a SUPERADMIN's act-as list (GET /api/me, SEC-1 AC-32); no tenant is chosen yet
        'SELECT TenantId, Code, Name, IsActive FROM gabay.Tenant',
        [],
      );
      return rows
        .map((row) => ({
          tenantId: row.tenantid,
          code: row.code,
          name: row.name,
          isActive: row.isactive,
        }))
        .sort((a, b) => byCodeUnits(a.code, b.code));
    },
  };
}

/** Code-unit order (not the database collation), so "T_B" sorts before "T_b" as the client expects. */
const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

module.exports = { createAccessStore, byCodeUnits };
