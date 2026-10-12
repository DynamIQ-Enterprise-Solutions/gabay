// Gabay's local test seed (plan.html L119, FEATURE_PIPELINE P0-02). Local database and
// Auth emulator only. Re-runnable: it removes its own two tenants and accounts first.
//   npm run seed            the venues and the six accounts (starts the Auth emulator)
//   npm run seed:db-only    the venues only
// The work itself is lib/run.js (runSeed); this file is the command: it opens the client, wraps runSeed in one
// transaction, and returns the exit code (FF-2, plan/FF-2-test-seeds.md section 3.2).
'use strict';

const { connect: connectToDatabase } = require('./lib/db');
const { runSeed, SeedStopped } = require('./lib/run');

/**
 * @param {object} [io]  everything the command touches, so a test can supply its own
 * @param {() => Promise<{query: Function, end: Function}>} [io.connect]
 * @param {string[]} [io.argv]
 * @param {(line: string) => void} [io.out]
 * @param {(line: string) => void} [io.err]
 * @param {string} [io.sourcesDir]  the sources folder (default db/seeds/sources)
 * @returns {Promise<number>} the exit code
 */
async function main({ connect = connectToDatabase, argv = process.argv, out = console.log, err = console.error, sourcesDir } = {}) {
  const withAccounts = !argv.includes('--no-accounts');
  const client = await connect();
  try {
    await client.query('BEGIN');
    await runSeed(client, { sourcesDir, withAccounts, log: out });
    await client.query('COMMIT');
    out('Seed committed.');
    return 0;
  } catch (error) {
    await client.query('ROLLBACK');
    // A stop (AC-23) happens before any write: it is not a failure part-way, so its line has no "rolled back" prefix (D13).
    err(error instanceof SeedStopped ? error.message : `Seed rolled back: ${error.message}`);
    return 1;
  } finally {
    await client.end();
  }
}

module.exports = { main };

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}
