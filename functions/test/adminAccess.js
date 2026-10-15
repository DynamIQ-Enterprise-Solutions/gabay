// Test support (not a test file): signing in as an admin through the real chain (SEC-1, plan/SEC-1.md 1.0 step 7).
// There is no development stub: every admin request carries `Authorization: Bearer <token>` and `X-Tenant-Id`.
//
//   tokenVerifier({ now })        the app's verifier double: token -> uid (plus extra claims), auth_time read from the
//                                 app's own clock when verified, so a test that moves the clock never ages a session
//                                 out; an unknown token is 401 "Invalid session", as the real verifier answers;
//                                 fail(token, err) makes a token's verification throw err (an expired session, a 503)
//   seedAdmins(seed, tenants, v)  one AppUser per admin role of L41: SUPERADMIN on a platform row, MALL_ADMIN,
//                                 VENUE_EDITOR and VIEWER each in every tenant of `tenants`; a token each, registered in v
//   addUser(ctx, name, opts)      one more signed-in user in a venueApp ctx: chosen role rows and per-route overrides
//   asHeaders(token, tenant)      { authorization, 'x-tenant-id' } (tenant omitted: no tenant header)
//   withDefaults(defaults, given) the default headers, then the test's (names in lower case; a null or undefined value
//                                 removes one, so a test can send no token or no tenant)
//   assertMigrated(query)         the one-time check: migration 0002's route keys and twelve grants are in the database
'use strict';

const { httpError } = require('../src/utils/errors');
const { ADMIN_ROLE_CODES, ROUTE_KEY_LIST } = require('../src/auth/routeKeys');

/**
 * @param {{ now?: () => number }} [options]
 */
function tokenVerifier({ now = Date.now } = {}) {
  const table = new Map();
  const seen = [];
  return {
    seen,
    /** Registers `token` for `uid`; `extra` claims are returned with it (AC-6's claim cases). Returns the token. */
    add(token, uid, extra = {}) {
      table.set(token, { uid, extra });
      return token;
    },
    /** Makes `token` fail verification with `err` (what the real verifier throws for it). Returns the token. */
    fail(token, err) {
      table.set(token, { err });
      return token;
    },
    async verifyIdToken(token) {
      seen.push(token);
      const entry = table.get(token);
      if (!entry) throw httpError(401, 'Invalid session');
      if (entry.err) throw entry.err;
      return { uid: entry.uid, auth_time: Math.floor(now() / 1000), ...entry.extra };
    },
    async close() {},
  };
}

/**
 * One user per admin role, with a token each. Roles are found (migration 0002 writes them) or created under the table
 * lock the caller holds.
 * @param {ReturnType<import('./authHelpers').createSeeder>} seed
 * @param {Array<{tenantId: number}>} tenants  the tenants MALL_ADMIN, VENUE_EDITOR and VIEWER hold
 * @param {ReturnType<typeof tokenVerifier>} verifier
 * @returns {Promise<Record<string, {userId: number, uid: string, email: string, displayName: string, token: string, roleId: number}>>}
 */
async function seedAdmins(seed, tenants, verifier) {
  const users = {};
  for (const code of ADMIN_ROLE_CODES) {
    const roleId = await seed.role(code, { isPlatformRole: code === 'SUPERADMIN' });
    const user = await seed.user({ name: `Test ${code}` });
    if (code === 'SUPERADMIN') await seed.userRole(user.userId, roleId, null);
    else for (const t of tenants) await seed.userRole(user.userId, roleId, t.tenantId);
    const token = verifier.add(`tok-${code.toLowerCase()}-${seed.tag}-${user.userId}`, user.uid);
    users[code] = { ...user, token, roleId };
  }
  return users;
}

/**
 * One more signed-in AppUser inside the harness's transaction (venueApp.js ctx): its role rows, its UserPermission
 * overrides, and a token. `roles`: [[roleCode, tenant | null]] (a role that does not exist is created, active, not a
 * platform role); `overrides`: { routeKey: 'CRUD' with '-' for false }.
 * @returns {Promise<{userId: number, uid: string, email: string, token: string, headers: (tenant?: object|null) => object}>}
 */
async function addUser(ctx, name, { roles = [], overrides = {}, isActive = true } = {}) {
  const user = await ctx.seed.user({ name, isActive });
  for (const [code, tenant] of roles) {
    const roleId = await ctx.seed.role(code);
    await ctx.seed.userRole(user.userId, roleId, tenant ? tenant.tenantId : null);
  }
  for (const [key, crud] of Object.entries(overrides)) {
    const route = await ctx.sql.one(
      'SELECT PermissionRouteId AS "permissionRouteId" FROM gabay.PermissionRoute WHERE RouteKey = $1',
      [key],
    );
    await ctx.seed.userPermission(
      user.userId,
      route,
      [...crud].map((c) => c !== '-'),
    );
  }
  const token = ctx.verifier.add(`tok-${name}-${ctx.tag}-${user.userId}`, user.uid);
  return {
    ...user,
    token,
    headers: (tenant = ctx.tenantA) => asHeaders(token, tenant),
  };
}

/** The headers of a request by `token` in `tenant` (null or undefined: no tenant header). */
function asHeaders(token, tenant) {
  const headers = { authorization: `Bearer ${token}` };
  if (tenant) headers['x-tenant-id'] = String(tenant.tenantId);
  return headers;
}

/** The default headers, then the given ones (names compared in lower case); a null or undefined value removes one. */
function withDefaults(defaults, given) {
  const out = { ...defaults };
  for (const [name, value] of Object.entries(given ?? {})) {
    if (value === null || value === undefined) delete out[name.toLowerCase()];
    else out[name.toLowerCase()] = value;
  }
  return out;
}

let migrated = null;

/**
 * Fails, once per process, with a message naming the fix when migration 0002's rows are absent (the rows come from
 * 0002; `npm run verify` and CI run setup-db first, so only a hand-run on an old database meets this).
 * @param {(text: string, params: any[]) => Promise<{rows: any[]}>} query
 */
async function assertMigrated(query) {
  migrated ??= (async () => {
    const { rows } = await query(
      `SELECT (SELECT count(*) FROM gabay.PermissionRoute WHERE RouteKey = ANY($1::text[]))::int AS routes,
              (SELECT count(*) FROM gabay.RolePermission rp
                 JOIN gabay.PermissionRoute pr ON pr.PermissionRouteId = rp.PermissionRouteId
                 JOIN gabay.Role r ON r.RoleId = rp.RoleId
                WHERE pr.RouteKey = ANY($1::text[]) AND r.Code = ANY($2::text[]))::int AS grants`,
      [ROUTE_KEY_LIST, ['MALL_ADMIN', 'VENUE_EDITOR', 'VIEWER']],
    );
    if (rows[0].routes !== ROUTE_KEY_LIST.length || rows[0].grants !== 12) {
      throw new Error(
        `SEC-1: the permission rows of migration 0002 are missing (${rows[0].routes} route keys, ${rows[0].grants} grants): run npm run migrate`,
      );
    }
  })();
  return migrated;
}

module.exports = { tokenVerifier, seedAdmins, addUser, asHeaders, withDefaults, assertMigrated };
