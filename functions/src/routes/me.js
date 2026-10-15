// GET /api/me: who the signed-in admin is, which tenants they belong to (their UserRole rows, L121), and their merged
// permissions in each (standard §3.4: role rows OR-ed, a user's own row replaces the merged role row). The client builds
// its menu from this (Q9). No tenant is read from the request: a user's tenants are what the database says they are
// (rule 2), and this route runs auth and requireAdminUser only (no tenant is chosen yet).
//
// SEC-1 (spec/SEC-1.md r2 AC-31 to AC-33): the access rows come from the same cached snapshot the guards read
// (auth/accessCache.js), and each tenant's permissions from the same derivation (permissionMerge.accessInTenant), so "the
// guard allows" equals "the flag here is true" for every route key and action, SUPERADMIN apart (it bypasses). A
// SUPERADMIN also gets `actAsTenants`: every tenant, active or not, by Tenant.Code in code-unit order, the tenants it may
// name in X-Tenant-Id (L186 Q4 (a); SEC-3's tenant picker). For anyone else the key is absent.
'use strict';

const express = require('express');
const { buildAccessProfile } = require('../auth/permissionMerge');

/**
 * @param {object} deps
 * @param {{ get: (userId: number) => Promise<object> }} deps.accessCache  auth/accessCache.js
 * @param {{ listTenants: () => Promise<object[]> }} deps.accessStore  auth/accessStore.js
 */
function meRoutes({ accessCache, accessStore }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const snapshot = await accessCache.get(req.user.userId);
    const profile = buildAccessProfile({
      user: req.user,
      ...snapshot,
      warn: (fields, message) => req.log?.warn(fields, message),
    });
    if (profile.isSuperAdmin) {
      profile.actAsTenants = (await accessStore.listTenants()).map((t) => ({
        tenantId: t.tenantId,
        code: t.code,
        name: t.name,
        isActive: t.isActive,
      }));
    }
    res.json(profile);
  });

  return router;
}

module.exports = { meRoutes };
