// npm run setup-db: the one orchestrator for a database (standard §8.2).
//
//   dev mode (default)   schema -> migrations -> test seed (db/seeds; starts the Auth emulator, which runs on Node: no Java)
//   --bootstrap          schema -> reference seed (platform lookups and roles) -> tenant provisioning (Phase 2)
//
//   --stop-on-error      stop at the first failed step (default: report it and run the rest)
//   --skip-schema        do not (re)apply db/schema.sql (it drops and recreates every table!)
//   --skip-migrations    dev mode only: do not apply db/migrations
//   --skip-seed          do not seed
//
// The exit code is the number of failed steps. It refuses a database that is not one of this machine's (db/tools/lib/localDatabases.js).
'use strict';

const { spawnSync } = require('node:child_process');
const { connect, loadEnv, REPO_ROOT } = require('./lib/connect');
const { destructiveRefusal } = require('./lib/localDatabases');
const { runMigrations } = require('./lib/migrations');
const { applySchema } = require('./lib/schema');
const { seedReference } = require('./lib/reference');

const FLAGS = new Set([
  '--bootstrap',
  '--stop-on-error',
  '--skip-schema',
  '--skip-migrations',
  '--skip-seed',
]);

function parseArgs(argv) {
  const unknown = argv.filter((a) => !FLAGS.has(a));
  if (unknown.length) {
    throw new Error(`Unknown option(s): ${unknown.join(' ')}\nKnown: ${[...FLAGS].join(' ')}`);
  }
  const has = (f) => argv.includes(f);
  return {
    bootstrap: has('--bootstrap'),
    stopOnError: has('--stop-on-error'),
    skipSchema: has('--skip-schema'),
    skipMigrations: has('--skip-migrations'),
    skipSeed: has('--skip-seed'),
  };
}

/**
 * The dev seed is the existing seed project. It starts the Firebase Auth emulator, which runs on Node: firebase-tools
 * 15.32.1 needs Java only for the Firestore, Realtime Database and Storage emulators (source check 2026-10-08:
 * downloadableEmulators.js, `binary: "java"` on exactly those three), and Gabay starts none of them.
 */
function runDevSeed() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // Fixed arguments, nothing from the user. shell:true is required to start a .cmd file on Windows.
  const result = spawnSync(`${npm} --prefix db/seeds run seed`, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) throw new Error(`the test seed exited with code ${result.status}`);
}

async function main() {
  // DEP-0 AC-46: setup-db drops and recreates every table, so it runs only on a database of this machine (by name: the Cloud SQL
  // proxy listens on 127.0.0.1 too). The one line names the command a deployed database is changed with, and nothing has run yet.
  loadEnv();
  const refusal = destructiveRefusal('setup-db', process.env.PGDATABASE);
  if (refusal) throw new Error(refusal);
  const opts = parseArgs(process.argv.slice(2));
  console.log(`setup-db: ${opts.bootstrap ? 'bootstrap' : 'dev'} mode`);

  const steps = [];
  if (!opts.skipSchema) steps.push(['schema', (c) => applySchema(c)]);
  if (opts.bootstrap) {
    if (!opts.skipSeed) steps.push(['reference seed', (c) => seedReference(c)]);
    steps.push([
      'tenant provisioning',
      async () => console.log('Tenant provisioning: Phase 2 (no tenants are created in Phase 1).'),
    ]);
  } else {
    if (!opts.skipMigrations) steps.push(['migrations', (c) => runMigrations(c)]);
    if (!opts.skipSeed) {
      // The seed opens its own connection; close ours first so it never waits on a lock of ours.
      steps.push(['test seed', async (c) => c.end().then(() => runDevSeed())]);
    }
  }

  const client = await connect();
  let ended = false;
  const failed = [];
  try {
    for (const [name, step] of steps) {
      console.log(`\n== ${name} ==`);
      try {
        await step(client);
        if (name === 'test seed') ended = true;
        console.log(`-- ${name}: ok`);
      } catch (err) {
        if (name === 'test seed') ended = true;
        failed.push(name);
        console.error(`-- ${name}: FAILED: ${err.message}`);
        if (opts.stopOnError) break;
      }
    }
  } finally {
    if (!ended) await client.end();
  }

  console.log(
    failed.length
      ? `\nsetup-db finished with ${failed.length} failed step(s): ${failed.join(', ')}`
      : '\nsetup-db finished: every step ok.',
  );
  process.exitCode = failed.length;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
