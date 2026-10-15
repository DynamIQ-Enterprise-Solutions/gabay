// requirePermission (R2 layer 2; SEC-1, spec/SEC-1.md r2 AC-14 to AC-17, AC-22 step 4; standard §3.4 layer 2 and
// Appendix A.2; PH2 Q8). After the role guard, on each route, naming the route's key and action (spec section 2.3, T1).
// Reads req.access only (tenantContext's derivation, DC-5): no load of its own, so it cannot fail on the database.
//
// The verdict, over the user's merged permissions in the named tenant (role rows OR-ed, a user row replaces; AC-17):
//   ALLOWED        at least one listed route has a merged row whose bit for the action is true       -> next()
//   DENIED         at least one listed route has a merged row, and none grants the action           -> 403 M-FORBIDDEN
//   UNCONFIGURED   no listed route has a merged row (no role row and no override)                    -> 403 M-FORBIDDEN,
//                  and one warn line naming the route keys (keys only, no user data)
// Always strict: standard A.2 would let UNCONFIGURED through unless `strict` is set; Gabay sets it everywhere, so there is
// no argument for it (DC-2). With several routes, any one granting the action is enough (DC-2).
//
// SUPERADMIN (holdsSuperAdmin, req.access.isSuperAdmin) is ALLOWED without a verdict, whatever rows or overrides exist,
// an all-false override included (AC-16). The bypass is here only: the chain, the tenant rule, the venue lookup and the
// handler's own checks still apply. MALL_ADMIN gets no bypass (PH2 Q8).
'use strict';

const { httpError } = require('../utils/errors');
const { MSG } = require('./tenantContext');
const { ACTIONS, ROUTE_KEY_LIST } = require('../auth/routeKeys');

const VERDICT = Object.freeze({
  allowed: 'ALLOWED',
  denied: 'DENIED',
  unconfigured: 'UNCONFIGURED',
});

/**
 * The three-valued verdict (pure).
 * @param {Record<string, {create: boolean, read: boolean, update: boolean, delete: boolean}>} permissions
 * @param {readonly string[]} routes
 * @param {'create'|'read'|'update'|'delete'} action
 */
function permissionVerdict(permissions, routes, action) {
  let configured = false;
  for (const key of routes) {
    const row = permissions[key]; // a prototype-free map (permissionMerge.js): no inherited key matches
    if (!row) continue;
    configured = true;
    if (row[action] === true) return VERDICT.allowed;
  }
  return configured ? VERDICT.denied : VERDICT.unconfigured;
}

/**
 * @param {string[]} routes  PermissionRoute keys (auth/routeKeys.js); at least one
 * @param {'create'|'read'|'update'|'delete'} action
 * @returns {import('express').RequestHandler}
 * @throws {TypeError} when the routes are built (AC-14): `routes` not a non-empty array of strings, a key that is not in
 *   auth/routeKeys.js (a typo never ships as an open or a closed route), or an action that is not one of the four
 */
function requirePermission(routes, action) {
  if (
    !Array.isArray(routes) ||
    routes.length === 0 ||
    routes.some((r) => typeof r !== 'string' || r === '')
  ) {
    throw new TypeError('requirePermission: routes must be a non-empty array of route keys');
  }
  const unknown = routes.filter((r) => !ROUTE_KEY_LIST.includes(r));
  if (unknown.length > 0) {
    throw new TypeError(
      `requirePermission: unknown route key(s) ${unknown.join(', ')} (auth/routeKeys.js)`,
    );
  }
  if (!ACTIONS.includes(action)) {
    throw new TypeError(`requirePermission: action must be one of ${ACTIONS.join(', ')}`);
  }
  const keys = Object.freeze([...routes]);
  return function permissionGuard(req, res, next) {
    const access = req.access;
    // tenantContext did not run before this: a wiring bug, refused (never a pass).
    if (!access?.permissions) return next(new Error('requirePermission: no req.access'));
    if (access.isSuperAdmin === true) return next();
    const verdict = permissionVerdict(access.permissions, keys, action);
    if (verdict === VERDICT.allowed) return next();
    if (verdict === VERDICT.unconfigured) {
      req.log?.warn({ routeKeys: keys, action }, 'permission check: no row for these route keys');
    }
    return next(httpError(403, MSG.forbidden));
  };
}

module.exports = { requirePermission, permissionVerdict, VERDICT };
