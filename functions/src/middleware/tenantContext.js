// tenantContext (R1; SEC-1, spec/SEC-1.md r2 section 3.2, AC-3 to AC-12, AC-22 steps 1-2, AC-23, AC-45, AC-48; PH2 Q1;
// standard §3.5). Runs after auth and requireAdminUser on every admin route, before the role and permission guards:
//
//   requestId -> actorContext -> rate limit (SEC-2) -> auth -> requireAdminUser -> TENANT CONTEXT -> role guard
//   -> permission guard -> venue scope -> validate (SEC-2) -> handler
//
// The tenant comes from `X-Tenant-Id` and nothing else (rule 2): never a token claim, the query string, the body or
// req.user. In this order, the first that applies answers:
//   - missing, empty or blank (after trimming)                          400 M-NO-TENANT, before any query
//   - not ^[1-9][0-9]{0,8}$ (the parseIdParam rule; a repeated header
//     arrives comma-joined, step 0 (f), and fails it)                   403 M-NOT-HELD, before any query
//   - the access snapshot cannot be loaded (any failure, DC-25)         503 M-UNAVAILABLE, the cause logged, nothing cached
//   - no own role in that tenant, and not SUPERADMIN                    403 M-NOT-HELD (same body as "no such tenant")
//   - SUPERADMIN naming a tenant it holds no row in that does not exist 403 M-NOT-HELD
//   - the tenant is inactive, and the user is not SUPERADMIN            403 M-INACTIVE-TENANT (L186 Q3 (a))
// Otherwise it sets:
//   req.tenantCompanyID   the tenant (the only source a route or service reads, rule 2)
//   req.actingAsTenantId  the tenant when a SUPERADMIN names one it holds no tenant-role row in (an act-as, DC-10), else
//                         null; logged once as `acting as another tenant` with the two ids
//   req.access            { userId, tenantId, roles, permissions, isSuperAdmin, isTenantWide }: what the guards read
//                         (DC-5: they make no second load; permissionMerge.accessInTenant, the same derivation as
//                         GET /api/me, AC-17)
//   req.log               a child carrying tenantId (and actingAsTenantId when set); auth already added userId. Ids only.
// and runs the rest of the request inside runWithActor(userId, next, { tenantId, actingAsTenantId }) (AC-45).
//
// CONTRACT FOR SEC-2 (AC-55). The audit middleware (R3) reads req.user, req.tenantCompanyID and req.actingAsTenantId,
// or the context getters getActorId(), getTenantId() and getActingAsTenantId(), and writes AuditLog.ActingAsTenantId
// from the last (this slice writes no AuditLog row). route-guard-order must accept the chain above, with the venue
// scope step (middleware/venueScope.js) after the permission guard and before validation. The auth rate limiter
// counts this chain's refusals (401 first).
// CONTRACT FOR R6 (AC-55). Every grant, role, permission or user write calls accessCache.invalidate(userId), or
// invalidateAll() for a role's permission rows (auth/accessCache.js); until then a change made by SQL is seen in 30 s.
'use strict';

const { httpError } = require('../utils/errors');
const { runWithActor } = require('../utils/requestContext');
const { accessInTenant, warnIgnoredRows } = require('../auth/permissionMerge');
const { TENANT_WIDE_ROLE_CODES } = require('../auth/routeKeys');

const TENANT_HEADER = 'x-tenant-id';
/** The parseIdParam rule (utils/idParam.js): a positive INT of one to nine ASCII digits, no sign, no leading zero. */
const TENANT_ID_PATTERN = /^[1-9][0-9]{0,8}$/;

/**
 * The five refusals of spec section 2.1 (admin English by design, L165). The first two are the development stub's own
 * words, kept so the client's strings and the manual cases keep their meaning (DC-19). The role guard and the
 * permission guard both answer M-FORBIDDEN (DC-15).
 */
const MSG = Object.freeze({
  noTenant: 'Choose a tenant: this works inside one tenant', // M-NO-TENANT, 400
  notHeld: 'This account has no access to that tenant', // M-NOT-HELD, 403
  inactiveTenant: 'This tenant is not active', // M-INACTIVE-TENANT, 403
  forbidden: 'You do not have permission to do this', // M-FORBIDDEN, 403
  unavailable: 'Permission check unavailable', // M-UNAVAILABLE, 503
});

/** The 503 of a failed access lookup: the cause is kept for the log (errors.js logs every 5xx), never shown. */
function unavailable(cause) {
  const err = httpError(503, MSG.unavailable, { expose: true });
  err.cause = cause;
  return err;
}

/**
 * Runs `load`; any failure (a connection error, a pg error such as 42P01, a plain Error) becomes the one 503.
 * @template T
 * @param {() => Promise<T>} load
 * @returns {Promise<T>}
 */
async function orUnavailable(load) {
  try {
    return await load();
  } catch (err) {
    throw unavailable(err);
  }
}

/**
 * @param {object} deps
 * @param {{ get: (userId: number) => Promise<object> }} deps.accessCache  auth/accessCache.js
 * @param {{ tenantById: (tenantId: number) => Promise<{isActive: boolean}|null> }} deps.accessStore
 * @returns {import('express').RequestHandler}
 */
function createTenantContext({ accessCache, accessStore }) {
  return async function tenantContext(req, res, next) {
    try {
      const asked = (req.get(TENANT_HEADER) ?? '').trim();
      if (asked === '') throw httpError(400, MSG.noTenant);
      if (!TENANT_ID_PATTERN.test(asked)) throw httpError(403, MSG.notHeld);
      const tenantId = Number(asked);
      const { userId } = req.user; // requireAdminUser ran: an AppUser

      const snapshot = await orUnavailable(() => accessCache.get(userId));
      warnIgnoredRows(userId, snapshot.roles, (fields, message) => req.log?.warn(fields, message));
      const view = accessInTenant(snapshot, tenantId, TENANT_WIDE_ROLE_CODES);
      const ownRow = snapshot.roles.find((r) => r.tenantId === tenantId);

      let isActive;
      if (ownRow) {
        isActive = ownRow.tenantIsActive === true;
      } else {
        if (!view.isSuperAdmin) throw httpError(403, MSG.notHeld);
        const tenant = await orUnavailable(() => accessStore.tenantById(tenantId));
        if (!tenant) throw httpError(403, MSG.notHeld); // the same body as "not held" (AC-4)
        isActive = tenant.isActive === true;
      }
      if (!isActive && !view.isSuperAdmin) throw httpError(403, MSG.inactiveTenant);

      const actingAsTenantId = ownRow ? null : tenantId;
      req.tenantCompanyID = tenantId;
      req.actingAsTenantId = actingAsTenantId;
      req.access = Object.freeze({
        userId,
        tenantId,
        roles: Object.freeze(view.roles),
        permissions: view.permissions,
        isSuperAdmin: view.isSuperAdmin,
        isTenantWide: view.isTenantWide,
      });
      req.log = req.log?.child(
        actingAsTenantId === null ? { tenantId } : { tenantId, actingAsTenantId },
      );
      if (actingAsTenantId !== null) {
        req.log?.info({ userId, tenantId }, 'acting as another tenant');
      }
      runWithActor(userId, next, { tenantId, actingAsTenantId }); // the rest of the request runs inside it
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createTenantContext, MSG, TENANT_HEADER, TENANT_ID_PATTERN };
