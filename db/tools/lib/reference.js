// The reference seed: the platform lookups and the four roles (db/seeds/lib/lookups.js, seedPlatform), TenantId NULL, no tenants
// and no accounts. Moved out of setup-db.js when db:deploy became its second user (DEP-0 step 4; C2), unchanged in what it
// writes. It is written once, by the first db:deploy of an empty database (AC-31, AC-43), and afterwards only by migrations.
'use strict';

const path = require('node:path');
const { DB_DIR } = require('./connect');

/**
 * @param {{ query: Function }} client
 * @param {(line: string) => void} [log]
 */
async function seedReference(client, log = console.log) {
  const { seedPlatform } = require(path.join(DB_DIR, 'seeds', 'lib', 'lookups.js'));
  await client.query('BEGIN');
  try {
    const ids = await seedPlatform(client);
    await client.query('COMMIT');
    const summary = Object.entries(ids)
      .map(([table, byCode]) => `${table} ${Object.keys(byCode).length}`)
      .join(', ');
    log(`Reference data seeded (platform rows, TenantId NULL): ${summary}.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

module.exports = { seedReference };
