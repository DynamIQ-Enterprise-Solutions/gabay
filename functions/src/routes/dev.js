// /api/dev (FF-SK, E-20; development only): GET /api/dev/accounts, the development switcher's account list. Mounted
// only when the development stub may exist (NODE_ENV explicitly development or test), with NO stub, auth or tenant in
// front: it ignores X-Dev-Act-As and X-Tenant-Id, so a stale choice kept in the browser can never lock the switcher out
// (the client's contract, phase-reports/feature-first/FF-SK-client.md section 2). Only GET is routed. R8 deletes it.
'use strict';

const express = require('express');

/** @param {ReturnType<import('../services/devAccounts.service').createDevAccountsService>} devAccounts */
function devRoutes(devAccounts) {
  const router = express.Router();
  router.get('/accounts', async (req, res) => {
    res.json(await devAccounts.list());
  });
  return router;
}

module.exports = { devRoutes };
