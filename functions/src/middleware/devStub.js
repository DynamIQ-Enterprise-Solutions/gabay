// devStub (EXCEPTIONS E-20; plan/FF0-dev-stub-lookups.md section 2, plan/FF-SK-dashboards.md section 5): until the
// retrofit's R1, admin routes run behind this instead of auth -> tenantContext. It fills exactly the fields the real
// chain fills, so R1 swaps ONE middleware and edits no route:
//   req.user              { kind: 'admin', userId, email, displayName, uid }  (the shape auth.js builds; no tenant, rule 2)
//   req.tenantCompanyID   the tenant the request acts for (rule 2: the only source routes read); null for a SUPERADMIN
//                         acting with no tenant (routes that work inside a tenant refuse that: middleware/requireTenant.js)
//   the actor context     runWithActor(userId, next, { tenantId }) so CreatedBy/UpdatedBy and getTenantId() work
// There is NO sign-in and NO permission check here (waived items 3 and 4, closed by R1 to R3).
//
// Refused at creation unless the RAW environment says NODE_ENV=development or test (config.devOnlyAllowed, the same
// rule as S1's Auth emulator guard, L151): a deployed function that forgot NODE_ENV must not run without sign-in.
// Nothing built on it is deployed (E-20's hard rules).
//
// The account (FF-SK, L157): `X-Dev-Act-As: <email>` names it when present and not blank. Only an account that passes
// canBeActedAs may be named (active, email ends @gabay.test, a tenant role or the SUPERADMIN platform role); anything
// else is 403. GET /api/dev/accounts lists exactly those accounts. Without the header it is the AppUser named by DEV_STUB_USER_EMAIL (default malladmin@gabay.test, L154).
// Either is loaded per request through S1's identity store, so a changed seed or setting takes effect without a restart.
// R8 removes the header with the switcher; R1 removes the stub.
// DESIGN CHOICE: a missing, inactive or role-less DEV_STUB_USER_EMAIL user is a 500 with a message that says what to fix
// (a setting is wrong), while a bad X-Dev-Act-As is a 403 (a request is wrong). Alternative: check the setting once at
// startup (createApp is synchronous and index.js builds the app lazily, so that would need an async start).
//
// The tenant (a small copy of S2's rule; R1 replaces it with S2 itself):
//   - any account but a SUPERADMIN: X-Tenant-Id when present, which must be a tenant where the account has a UserRole
//     row, else 403; with no header, the account's first tenant by Tenant.Code (code-unit order);
//   - a SUPERADMIN (the owner's ruling for FF-SK): X-Tenant-Id when present, which may be ANY existing tenant (the
//     superuser override, Blueprint 2.4), else 403; with no header, NO tenant (req.tenantCompanyID null).
'use strict';

const { httpError } = require('../utils/errors');
const { runWithActor } = require('../utils/requestContext');
const { holdsSuperAdmin } = require('../auth/permissionMerge');

const STARTUP_LINE = 'DEV STUB ACTIVE (E-20): admin routes run without sign-in';
const TENANT_HEADER = 'x-tenant-id';
const ACT_AS_HEADER = 'x-dev-act-as';
const TENANT_ID_PATTERN = /^\d{1,9}$/;
/** Only the seeded test accounts can be acted as or listed (L119): their emails all end here. */
const DEV_ACCOUNT_DOMAIN = '@gabay.test';

const MSG = Object.freeze({
  refused:
    'The development stub (E-20) is refused: NODE_ENV must be written explicitly as development or test in the environment',
  userMissing:
    'Development stub (E-20): the user named by DEV_STUB_USER_EMAIL was not found. Set it in .env to a seeded admin account.',
  userInactive:
    'Development stub (E-20): the user named by DEV_STUB_USER_EMAIL is not active. Set it in .env to an active admin account.',
  noTenant:
    'Development stub (E-20): the user named by DEV_STUB_USER_EMAIL has no tenant role and is not a SUPERADMIN. Set it in .env to a seeded admin account.',
  actAsRefused:
    'X-Dev-Act-As must name an active seeded admin account ending @gabay.test (GET /api/dev/accounts lists them)',
  tenantNotHeld: 'This account has no access to that tenant',
});

/** Code-unit order (not the database collation), so "T_B" sorts before "T_b" as the client expects. */
const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The order the stub and GET /api/dev/accounts both use for an account's roles: platform rows (no tenant) first, then
 * by Tenant.Code in code-unit order. Stable, so rows of one tenant keep the order they came in.
 * @param {Array<{tenantId: number|null, tenantCode: string|null}>} roles
 */
function inStubOrder(roles) {
  return [...roles].sort((a, b) => {
    if (a.tenantId === null || b.tenantId === null) {
      return (a.tenantId === null ? 0 : 1) - (b.tenantId === null ? 0 : 1);
    }
    return byCodeUnits(a.tenantCode, b.tenantCode);
  });
}

/** The account's tenants from its UserRole rows, each once, first by Tenant.Code: [{ tenantId, code }]. */
function tenantsOf(roles) {
  const byId = new Map();
  for (const role of inStubOrder(roles)) {
    if (role.tenantId !== null && !byId.has(role.tenantId)) {
      byId.set(role.tenantId, { tenantId: role.tenantId, code: role.tenantCode });
    }
  }
  return [...byId.values()];
}

/** True for an email the switcher may name: ends @gabay.test, any letter case. */
const isDevAccountEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith(DEV_ACCOUNT_DOMAIN);

/**
 * THE predicate for "this account can be acted as": an active AppUser whose email ends @gabay.test, holding at least
 * one UserRole, and either a tenant (a UserRole row with one) or the SUPERADMIN platform role (which acts with no tenant
 * or in any tenant). X-Dev-Act-As (below) and GET /api/dev/accounts (services/devAccounts.service.js) both use it, so
 * the list never shows an account the header would refuse.
 * @param {{email: string, isActive: boolean}} identity
 * @param {Array<{tenantId: number|null, tenantCode: string|null}>} roles  the account's UserRole rows
 */
function canBeActedAs(identity, roles) {
  return (
    isDevAccountEmail(identity.email) &&
    identity.isActive === true &&
    roles.length > 0 &&
    (tenantsOf(roles).length > 0 || holdsSuperAdmin(roles))
  );
}

/**
 * @param {object} deps
 * @param {{devOnlyAllowed: boolean, devStub: {userEmail: string}}} deps.config
 * @param {{info: Function}} deps.logger  the root logger: the startup line goes here once
 * @param {{findAdminByEmail: (email: string) => Promise<object|null>}} deps.identities  S1's identity store
 * @param {{loadForUser: (userId: number) => Promise<{roles: object[]}>, tenantExists: (id: number) => Promise<boolean>}}
 *   deps.accessStore  its UserRole rows are the tenants (L121)
 * @returns {import('express').RequestHandler}
 * @throws {Error} unless the raw environment says NODE_ENV=development or test
 */
function createDevStub({ config, logger, identities, accessStore }) {
  if (!config.devOnlyAllowed) throw new Error(MSG.refused);
  // DESIGN CHOICE: info, not warn. The default LOG_LEVEL (info) shows it, and S1's app test counts warn lines (it expects none for a
  // normal start), which this slice may not change. Alternative: warn, and an edit to that test named in the plan.
  logger.info(STARTUP_LINE);

  /** The account named by X-Dev-Act-As, with its roles; 403 unless it is an active seeded admin account. */
  async function actedAccount(email) {
    const refuse = () => httpError(403, MSG.actAsRefused);
    if (!isDevAccountEmail(email)) throw refuse(); // before any query: a foreign email is never looked up
    const identity = await identities.findAdminByEmail(email);
    if (!identity) throw refuse();
    const { roles } = await accessStore.loadForUser(identity.userId);
    if (!canBeActedAs(identity, roles)) throw refuse();
    return { identity, roles };
  }

  /** The account named by DEV_STUB_USER_EMAIL, with its roles; a 500 naming the setting when it is unusable. */
  async function defaultAccount() {
    const identity = await identities.findAdminByEmail(config.devStub.userEmail);
    if (!identity) throw httpError(500, MSG.userMissing, { expose: true });
    if (!identity.isActive) throw httpError(500, MSG.userInactive, { expose: true });
    const { roles } = await accessStore.loadForUser(identity.userId);
    if (tenantsOf(roles).length === 0 && !holdsSuperAdmin(roles)) {
      throw httpError(500, MSG.noTenant, { expose: true });
    }
    return { identity, roles };
  }

  /** The tenant the request acts for (see the header comment), or null for a SUPERADMIN with no X-Tenant-Id. */
  async function chosenTenant(roles, asked) {
    const superAdmin = holdsSuperAdmin(roles);
    if (asked === '') return superAdmin ? null : tenantsOf(roles)[0].tenantId;
    if (!TENANT_ID_PATTERN.test(asked)) throw httpError(403, MSG.tenantNotHeld);
    const tenantId = Number(asked);
    if (superAdmin) {
      if (!(await accessStore.tenantExists(tenantId))) throw httpError(403, MSG.tenantNotHeld);
      return tenantId;
    }
    if (!tenantsOf(roles).some((t) => t.tenantId === tenantId)) {
      throw httpError(403, MSG.tenantNotHeld);
    }
    return tenantId;
  }

  return async function devStub(req, res, next) {
    try {
      const actAs = (req.get(ACT_AS_HEADER) ?? '').trim();
      const { identity, roles } = actAs === '' ? await defaultAccount() : await actedAccount(actAs);
      const tenantId = await chosenTenant(roles, (req.get(TENANT_HEADER) ?? '').trim());

      req.user = {
        kind: identity.kind,
        userId: identity.userId,
        email: identity.email,
        displayName: identity.displayName,
        uid: identity.firebaseUid,
      };
      req.tenantCompanyID = tenantId;
      req.log = req.log?.child({ userId: identity.userId, kind: identity.kind, tenantId });
      runWithActor(identity.userId, next, { tenantId }); // everything after this, awaited or not, runs in the context
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  createDevStub,
  inStubOrder,
  byCodeUnits,
  canBeActedAs,
  isDevAccountEmail,
  STARTUP_LINE,
  MSG,
  DEV_ACCOUNT_DOMAIN,
};
