// Actor context (standard §3.18, Appendix A.1): services stamp CreatedBy/UpdatedBy with
// getActorId() instead of threading a userId through every call.
// Outside a request (a script, a test, the seed) every getter returns null, which correctly
// leaves audit columns NULL.
//
// Three values (SEC-1 AC-45): the actor (auth binds it), and the tenant and the acting-as tenant (tenantContext binds them
// with the actor). Each runWithActor opens a NEW store for its callback and everything it starts: a nested call replaces
// the outer store for the inner chain only (Node 22 docs, asyncLocalStorage.run; requestContext.test.js proves it).
'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

/**
 * Runs fn with the actor, the tenant and the acting-as tenant bound to the current async chain.
 * @param {number|null} userId  the verified AppUser id (null: no actor, a shopper or no sign-in)
 * @param {Function} fn
 * @param {{ tenantId?: number|null, actingAsTenantId?: number|null }} [scope]  set by tenantContext (SEC-1)
 */
function runWithActor(userId, fn, { tenantId = null, actingAsTenantId = null } = {}) {
  return als.run({ userId, tenantId, actingAsTenantId }, fn);
}

const getActorId = () => als.getStore()?.userId ?? null;

/**
 * The tenant the request acts for, as tenantContext resolved it from X-Tenant-Id and the user's UserRole rows (rule 2).
 * Handlers read req.tenantCompanyID; this is for deep services that have no req. Null before tenantContext.
 */
const getTenantId = () => als.getStore()?.tenantId ?? null;

/**
 * The tenant a SUPERADMIN acts in without holding a tenant role there (SEC-1 AC-10, DC-10), else null. SEC-2's audit
 * middleware writes it as AuditLog.ActingAsTenantId.
 */
const getActingAsTenantId = () => als.getStore()?.actingAsTenantId ?? null;

/** True inside a request's context (even with no actor yet), false in a script or a test. */
const inRequestContext = () => als.getStore() !== undefined;

/**
 * A service's guard on the tenant its route passed in (req.tenantCompanyID, rule 2): a missing one is a bug in the
 * route chain, never a request for "every tenant".
 * @throws {Error} a 500 (a programming error) unless tenantId is an integer
 */
function assertTenantId(tenantId) {
  if (!Number.isInteger(tenantId)) throw new Error('no tenant in the request context');
}

module.exports = {
  runWithActor,
  getActorId,
  getTenantId,
  getActingAsTenantId,
  inRequestContext,
  assertTenantId,
};
