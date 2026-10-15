// requireRole (R2 layer 1; SEC-1, spec/SEC-1.md r2 AC-13, AC-14, AC-22 step 3; standard §3.4 layer 1 and Appendix A.2).
// After tenantContext, before the permission guard. Passes when the user's own roles in the named tenant (their rows
// there plus their platform rows: req.access.roles, set by tenantContext, DC-5) include at least one listed code;
// otherwise 403 M-FORBIDDEN, the permission guard's text too (DC-15: a refusal does not say which layer refused).
//
// On every admin route the list is the four admin roles of L41 (auth/routeKeys.js ADMIN_ROLE_CODES): the closed-role-set
// floor. The permission rows make the distinctions between the four (DC-1), so a UserPermission override can widen a
// role's rights without a code change. It is mounted per route group (routes/api.js), so it also runs on a path no
// route answers (EC-43).
'use strict';

const { httpError } = require('../utils/errors');
const { MSG } = require('./tenantContext');

/**
 * @param {string[]} codes  Role.Code values; at least one
 * @returns {import('express').RequestHandler}
 * @throws {TypeError} when the routes are built, if `codes` is not a non-empty array of non-empty strings (AC-14)
 */
function requireRole(codes) {
  if (
    !Array.isArray(codes) ||
    codes.length === 0 ||
    codes.some((c) => typeof c !== 'string' || c.trim() === '')
  ) {
    throw new TypeError('requireRole: codes must be a non-empty array of role codes');
  }
  const allowed = new Set(codes);
  return function roleGuard(req, res, next) {
    const roles = req.access?.roles;
    // tenantContext did not run before this: a wiring bug, refused (never a pass).
    if (!Array.isArray(roles)) return next(new Error('requireRole: no req.access (tenantContext)'));
    if (roles.some((code) => allowed.has(code))) return next();
    return next(httpError(403, MSG.forbidden));
  };
}

module.exports = { requireRole };
