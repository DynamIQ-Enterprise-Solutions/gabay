// The development switcher's account list (FF-SK, plan/FF-SK-dashboards.md section 5, L157; the contract is
// phase-reports/feature-first/FF-SK-client.md section 2): the accounts the stub can act as, with their roles and
// tenants. Development only: refused at creation unless NODE_ENV is explicitly development or test, exactly as the
// stub is. R8 deletes it with the switcher.
//
// An account is listed when it is an active AppUser whose email ends @gabay.test and it holds at least one UserRole of
// an active role: the same accounts X-Dev-Act-As accepts (devStub.js). Its roles come from S1's access store and are
// put in the stub's order (platform roles first, then code-unit order by Tenant.Code), so the client's "first tenant" is
// the one the stub picks when no X-Tenant-Id is sent.
//
// DESIGN CHOICE: one access-store read per account (about five accounts, development only), reusing its UserRole query
// and its documented tenant-scope reason, instead of a new cross-tenant query with a second such annotation.
// Alternative: one query joining AppUser, UserRole, Role and Tenant.
'use strict';

const { MSG, DEV_ACCOUNT_DOMAIN, inStubOrder } = require('../middleware/devStub');

/**
 * @param {object} deps
 * @param {{devOnlyAllowed: boolean, devStub: {userEmail: string}}} deps.config
 * @param {{listActiveAdminsByEmailSuffix: (suffix: string) => Promise<object[]>}} deps.identities
 * @param {{loadForUser: (userId: number) => Promise<{roles: object[]}>}} deps.accessStore
 * @throws {Error} unless the raw environment says NODE_ENV=development or test
 */
function createDevAccountsService({ config, identities, accessStore }) {
  if (!config.devOnlyAllowed) throw new Error(MSG.refused);
  const defaultEmail = config.devStub.userEmail.toLowerCase();

  return {
    /** @returns {Promise<{items: Array<{email, displayName, isDefault, roles: Array<{code, tenantId, tenantName}>}>}>} */
    async list() {
      const items = [];
      for (const user of await identities.listActiveAdminsByEmailSuffix(DEV_ACCOUNT_DOMAIN)) {
        const { roles } = await accessStore.loadForUser(user.userId);
        if (roles.length === 0) continue;
        items.push({
          email: user.email,
          displayName: user.displayName,
          isDefault: user.email.toLowerCase() === defaultEmail,
          roles: inStubOrder(roles).map((r) => ({
            code: r.roleCode,
            tenantId: r.tenantId,
            tenantName: r.tenantId === null ? null : r.tenantName,
          })),
        });
      }
      return { items };
    },
  };
}

module.exports = { createDevAccountsService };
