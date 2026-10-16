// npm run staging:seed: the logic (spec/DEP-0.md r2 AC-44, DC-19; plan/DEP-0.md 1.0 step 5). Test data on a DEPLOYED database is
// loaded by this explicit command and nothing else: CI never seeds (AC-45), and db:deploy writes reference data only.
//
// CREATE-ONLY: it makes the tenant DEMO_MALLS and its four invented venues, reading ONLY sources/demo/*.json. If the tenant already
// exists it refuses with one line and writes nothing. It never goes through the dev seed's path (lib/run.js removeTenant), which
// deletes the tenant's UserRole rows before re-creating the tenant: on staging that would remove the owner's logins.
// It writes NO AppUser, UserRole or ShopperAccount (the owner's logins are staging:admin's), creates no SPIKE_VENUES tenant and
// reads no `internal/` or `spike*` source: the penthouse and the owner's spike exports never reach a deployed database (L48).
//
// Like the dev seed's library it never runs BEGIN, COMMIT or ROLLBACK: the caller owns the transaction.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { insert } = require('./db');
const { seedPlatform } = require('./lookups');
const { seedDemoVenue } = require('./demo');
const { TENANTS, DEMO_VENUES, SOURCES } = require('./run');

const TENANT_CODE = 'DEMO_MALLS';

/** The tenant exists already: the one line the command prints, and nothing was written. */
class StagingSeedRefusal extends Error {}

/**
 * @param {{ query: (text: string, params: any[]) => Promise<{ rows: any[] }> }} client  inside the caller's transaction
 * @param {{ sourcesDir?: string, log?: (line: string) => void }} [options]
 * @returns {Promise<{ tenantId: number, venues: Array<{ code: string, name: string, counts: object }> }>}
 */
async function stagingSeed(client, { sourcesDir = SOURCES, log = console.log } = {}) {
  const found = await client.query('SELECT TenantId AS id FROM gabay.Tenant WHERE Code = $1', [
    TENANT_CODE,
  ]);
  if (found.rows.length > 0) {
    throw new StagingSeedRefusal(
      `The tenant ${TENANT_CODE} already exists, so nothing was written. staging:seed only creates: it never deletes or re-creates a tenant (that would remove the logins made with staging:admin).`,
    );
  }
  // Only the four demo files, by name: no directory is listed, so a penthouse or spike file in the folder is never opened.
  const readDemo = (id) =>
    JSON.parse(fs.readFileSync(path.join(sourcesDir, 'demo', `${id}.json`), 'utf8'));

  const ids = await seedPlatform(client); // finds the platform rows db:deploy wrote (adds a missing one); returns their ids
  const tenant = TENANTS[TENANT_CODE];
  const tenantId = await insert(client, 'Tenant', { Code: TENANT_CODE, ...tenant }, 'TenantId');
  const venues = [];
  for (const id of DEMO_VENUES) {
    const v = readDemo(id);
    const { counts } = await seedDemoVenue(client, tenantId, ids, v);
    venues.push({ code: v.id.toUpperCase(), name: v.name, counts });
    log(`${tenant.Name} · ${v.name}: ${JSON.stringify(counts)}`);
  }
  return { tenantId, venues };
}

module.exports = { stagingSeed, StagingSeedRefusal, TENANT_CODE };
