// npm run staging:admin -- <email> <role> [<tenant>] [--local-db]: the command line around stagingAdmin.js (spec/DEP-0.md r2 AC-37,
// AC-41, AC-56, AC-57; plan/DEP-0.md 1.0 step 5, R2, DC-24, DC-31). Run by the owner on their own machine, never by CI and never
// by an agent. Two modes, always chosen on the command line:
//   --local-db   the real Firebase project's Auth and the LOCAL database (what the owner can do under the Spark plan, L186)
//   (no flag)    the real project's Auth and the DEPLOYED database through the Cloud SQL proxy (DEP-1)
//
// It reads the PROCESS ENVIRONMENT only, never the repository's .env: PG* for the database and STAGING_PROJECT_ID (not
// FIREBASE_-prefixed) for the project. It REFUSES, before anything is written:
//   - an Auth emulator host in the environment, and a project id that starts with demo-  (never a user in an emulator by mistake,
//     nor a real user from an emulator-configured shell)
//   - GOOGLE_APPLICATION_CREDENTIALS set (R2): the tool uses the owner's own login (Application Default Credentials from
//     `gcloud auth application-default login`) and reads no key file; the Google library would read one from that variable
//   - --local-db with a database that is not one of this machine's, and no flag with one that is (DC-24: the real Auth is paired
//     with a local database only by the explicit flag, and the deployed database is never reached with it)
// The Admin SDK is initialised with { projectId } and no credential argument. firebase-admin and pg are the pins of functions/
// (DC-31: one pin), loaded through createRequire so tools/ needs no package of its own.
'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');
const { isLocalDatabaseName } = require('../../db/tools/lib/localDatabases');
const { provisionAdmin, summaryLines, dbOfClient, StagingAdminRefusal } = require('./stagingAdmin');

const FUNCTIONS_PACKAGE = path.resolve(__dirname, '..', '..', 'functions', 'package.json');
const DB_KEYS = Object.freeze(['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']);
/** Firebase project ids: 6 to 30 lower case letters, digits and hyphens, starting with a letter (a typo is caught here). */
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const USAGE = 'Usage: npm run staging:admin -- <email> <role> [<tenant code>] [--local-db]';

/** Splits the command line. Anything that is not the two or three words and the one flag is refused. */
function parseArgs(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const words = argv.filter((a) => !a.startsWith('--'));
  const unknown = flags.filter((f) => f !== '--local-db');
  if (unknown.length > 0) return { error: `Unknown option(s): ${unknown.join(' ')}. ${USAGE}` };
  if (flags.length > 1) return { error: `--local-db was given twice. ${USAGE}` };
  if (words.length < 2 || words.length > 3) return { error: USAGE };
  const [email, role, tenant = null] = words;
  return { email, role, tenant, localDb: flags.length === 1 };
}

/**
 * The environment refusals (AC-41, R2), as a list of plain lines; empty means the environment is acceptable.
 * @param {Record<string, string|undefined>} env
 * @param {{ localDb: boolean }} mode
 */
function environmentProblems(env, { localDb }) {
  const problems = [];
  if (!env.STAGING_PROJECT_ID) {
    problems.push(
      'STAGING_PROJECT_ID is not set: name the Firebase project (for example gabay-staging).',
    );
  } else if (env.STAGING_PROJECT_ID.startsWith('demo-')) {
    problems.push(
      `STAGING_PROJECT_ID "${env.STAGING_PROJECT_ID}" is an emulator project (demo-): this tool makes users in a REAL project only.`,
    );
  } else if (!PROJECT_ID.test(env.STAGING_PROJECT_ID)) {
    problems.push(
      'STAGING_PROJECT_ID does not look like a Firebase project id (lower case letters, digits and hyphens, 6 to 30 characters).',
    );
  }
  if (env.FIREBASE_AUTH_EMULATOR_HOST) {
    problems.push(
      'FIREBASE_AUTH_EMULATOR_HOST is set: this shell points at the Auth emulator. Unset it (unset FIREBASE_AUTH_EMULATOR_HOST) so a real user is never made there by mistake.',
    );
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    problems.push(
      'GOOGLE_APPLICATION_CREDENTIALS is set. This tool uses your own login only and reads no key file: unset it, then run `gcloud auth application-default login`.',
    );
  }
  const missing = DB_KEYS.filter((k) => !env[k]);
  if (missing.length > 0) {
    problems.push(
      `Missing ${missing.join(', ')} in the environment. staging:admin reads the process environment only and never the repository's .env.`,
    );
  } else if (localDb && !isLocalDatabaseName(env.PGDATABASE)) {
    problems.push(
      `--local-db was given, but the database "${env.PGDATABASE}" is not one of this machine's (gabay_dev, gabay_wt_<name>). The deployed database is reached without the flag.`,
    );
  } else if (!localDb && isLocalDatabaseName(env.PGDATABASE)) {
    problems.push(
      `The database "${env.PGDATABASE}" is one of this machine's: add --local-db to use it with the real Firebase project.`,
    );
  }
  return problems;
}

/** The real SDK and driver: the pins of functions/, found from there. */
function loadSdk() {
  const fromFunctions = createRequire(FUNCTIONS_PACKAGE);
  return {
    initializeApp: fromFunctions('firebase-admin/app').initializeApp,
    deleteApp: fromFunctions('firebase-admin/app').deleteApp,
    getAuth: fromFunctions('firebase-admin/auth').getAuth,
    Client: fromFunctions('pg').Client,
  };
}

/**
 * @param {object} [io]
 * @param {Record<string, string|undefined>} [io.env]
 * @param {string[]} [io.argv]
 * @param {(line: string) => void} [io.out]
 * @param {(line: string) => void} [io.err]
 * @param {() => ReturnType<typeof loadSdk>} [io.sdk]  tests give fakes
 * @returns {Promise<number>} the exit code
 */
async function main({
  env = process.env,
  argv = process.argv.slice(2),
  out = console.log,
  err = console.error,
  sdk = loadSdk,
} = {}) {
  const args = parseArgs(argv);
  if (args.error) {
    err(args.error);
    return 1;
  }
  const problems = environmentProblems(env, args);
  if (problems.length > 0) {
    for (const line of problems) err(line);
    return 1;
  }

  const { initializeApp, deleteApp, getAuth, Client } = sdk();
  out(`staging:admin mode: ${args.localDb ? 'local database (--local-db)' : 'deployed database'}`);
  out(`Firebase project: ${env.STAGING_PROJECT_ID}`);
  out(`Database: ${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE} as ${env.PGUSER}`);
  out(
    `Account: ${String(args.email).trim().toLowerCase()} as ${args.role}${args.tenant ? ` in ${args.tenant}` : ''}`,
  );

  const client = new Client({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
  });
  try {
    await client.connect();
  } catch {
    err('Could not connect to the database named above. Nothing was written.');
    await client.end().catch(() => {});
    return 1;
  }
  // No credential argument: the SDK finds your own login (Application Default Credentials). The project is explicit.
  const app = initializeApp({ projectId: env.STAGING_PROJECT_ID });
  try {
    const result = await provisionAdmin({
      db: dbOfClient(client),
      auth: getAuth(app),
      projectId: env.STAGING_PROJECT_ID,
      input: { email: args.email, role: args.role, tenant: args.tenant },
    });
    for (const line of summaryLines(result)) out(line);
    // The one place the link is printed, once, last. It is never written to a file, a log or a table.
    out(
      `Open this link once to set the password (it is shown only now; run this again for a new one): ${result.link}`,
    );
    return 0;
  } catch (error) {
    if (error instanceof StagingAdminRefusal) {
      err(error.message);
      return 1;
    }
    // Anything unforeseen: a plain line with no stack and no SDK text.
    err(
      'staging:admin stopped on an unexpected error. Nothing more was written. Check the database and the project, then run it again.',
    );
    return 1;
  } finally {
    await deleteApp(app).catch(() => {});
    await client.end().catch(() => {});
  }
}

module.exports = { main, parseArgs, environmentProblems, USAGE, FUNCTIONS_PACKAGE };
