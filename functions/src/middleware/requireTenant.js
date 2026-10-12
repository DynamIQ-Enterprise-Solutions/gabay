// requireTenant: a route group that works inside one tenant refuses a request that acts for none (FF-SK, the owner's
// ruling: a SUPERADMIN with no X-Tenant-Id acts with no tenant, so req.tenantCompanyID is null). It answers 400 before
// any handler or query runs, so such a request is never a 500 from a service's tenant guard and never a write.
//
// Mounted after the development stub on every tenant route of routes/api.js's "admin features (E-20)" group. At R1 the
// real tenantContext (S2) takes this rule over, with the audited superuser override (Blueprint 2.4), and this file goes.
'use strict';

const { httpError } = require('../utils/errors');

const CHOOSE_A_TENANT = 'Choose a tenant: this works inside one tenant';

/** @type {import('express').RequestHandler} */
function requireTenant(req, res, next) {
  if (!Number.isInteger(req.tenantCompanyID)) return next(httpError(400, CHOOSE_A_TENANT));
  return next();
}

module.exports = { requireTenant, CHOOSE_A_TENANT };
