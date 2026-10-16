// Validated configuration (standard §3.16): the repo-root .env is loaded by absolute path, every
// value is checked with zod, and a missing or malformed required key stops the process with a
// readable message instead of failing later on the first query.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

/** The repository root, found from this file so the working directory never matters (§3.16). */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
/** The repo-root .env. */
const ENV_FILE = path.join(REPO_ROOT, '.env');

/**
 * Loads the root .env with Node's built-in loader (DESIGN CHOICE: no dotenv package).
 * Values already in process.env win, so a real environment (Cloud Functions, CI) is never
 * overridden by a developer's file. Returns true when a file was read.
 */
function loadEnvFile(file = ENV_FILE) {
  if (!fs.existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

class ConfigError extends Error {
  constructor(problems) {
    super(
      `Invalid configuration. Fix these keys in .env (see .env.example):\n${problems
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const positiveInt = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);

// Rate limits (SEC-2 AC-1; standard §3.2). The defaults are the standard's: 1,200 requests a minute per client key, and
// about 15 failed token checks in a 15-minute window. They are env values, so the pilot's measurement can retune them
// (PRD §7). The upper bounds only catch a typo (a missing zero); they are not a policy (DC-29).
const DEFAULT_RATE_LIMIT_PER_MIN = 1_200;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 15;
const DEFAULT_AUTH_RATE_LIMIT_WINDOW_MIN = 15;
const MAX_RATE_LIMIT_PER_MIN = 100_000;
const MAX_AUTH_RATE_LIMIT_MAX = 10_000;
const MAX_AUTH_RATE_LIMIT_WINDOW_MIN = 1_440; // one day
const MS_PER_MINUTE = 60_000;

/** The two file stores a deploy can choose (DEP-0 AC-3): a deploy-time choice, not a list a client could extend (rule 5). */
const FILE_STORE_KINDS = Object.freeze(['local', 'gcs']);

/** An instance connection name: <project>:<region>:<instance>, the project optionally domain-scoped (example.com:project). */
const CLOUD_SQL_INSTANCE_NAME = /^[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?:[a-z0-9-]+:[A-Za-z0-9_-]+$/;
/** MAX_JSON_BODY's units, as the body parser reads them (1 kb = 1024 bytes). */
const BODY_UNIT_BYTES = Object.freeze({ b: 1, kb: 1024, mb: 1024 * 1024 });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Database (required: the API cannot do anything without it). Two connection modes, exactly one (DEP-0 AC-13):
  //   host       PGHOST (+ PGPORT): this machine, the Cloud SQL Auth Proxy, or a /cloudsql/<instance> socket path (the socket
  //              is untested until DEP-1's spike)
  //   connector  CLOUD_SQL_INSTANCE: the instance connection name <project>:<region>:<instance> (E-29, public IP)
  // Both set, or neither, is a ConfigError (crossKeyProblems below). PGPASSWORD is read from the environment only.
  PGHOST: z.string().min(1).optional(),
  CLOUD_SQL_INSTANCE: z
    .string()
    .regex(CLOUD_SQL_INSTANCE_NAME, 'must look like <project>:<region>:<instance>')
    .optional(),
  PGPORT: positiveInt(5432, 65535),
  PGDATABASE: z.string().min(1),
  PGUSER: z.string().min(1),
  PGPASSWORD: z.string().min(1),
  PG_POOL_MAX: positiveInt(10, 100),
  PG_IDLE_TIMEOUT_MS: positiveInt(30_000, 3_600_000),
  PG_CONNECT_TIMEOUT_MS: positiveInt(5_000, 120_000),
  PG_STATEMENT_TIMEOUT_MS: positiveInt(60_000, 3_600_000),

  // HTTP.
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  MAX_JSON_BODY: z
    .string()
    .regex(/^\d+\s?(b|kb|mb)$/i, 'must look like 5mb or 512kb')
    .default('5mb'),

  // Rate limits (SEC-2): in memory, so valid only while the function runs one instance (maxInstances = 1, Blueprint 2.6).
  //   RATE_LIMIT_PER_MIN          requests per client key per 60 seconds, under /api
  //   AUTH_RATE_LIMIT_MAX         failed token checks (401s) per client key per window
  //   AUTH_RATE_LIMIT_WINDOW_MIN  that window, in minutes
  //   RATE_LIMIT                  'off' stops both limiters; refused outside development and test (see parseConfig)
  RATE_LIMIT_PER_MIN: positiveInt(DEFAULT_RATE_LIMIT_PER_MIN, MAX_RATE_LIMIT_PER_MIN),
  AUTH_RATE_LIMIT_MAX: positiveInt(DEFAULT_AUTH_RATE_LIMIT_MAX, MAX_AUTH_RATE_LIMIT_MAX),
  AUTH_RATE_LIMIT_WINDOW_MIN: positiveInt(
    DEFAULT_AUTH_RATE_LIMIT_WINDOW_MIN,
    MAX_AUTH_RATE_LIMIT_WINDOW_MIN,
  ),
  RATE_LIMIT: z.enum(['on', 'off']).default('on'),

  // Firebase Auth (E-08). Both optional: the health check and the Functions emulator run without them. Together they
  // choose the sign-in mode (SEC-1 AC-57; firebase.authMode below):
  //   emulator   FIREBASE_AUTH_EMULATOR_HOST set (development and tests only); the project is demo-gabay unless
  //              FIREBASE_PROJECT_ID says otherwise; the SDK accepts unsigned tokens
  //   project    FIREBASE_PROJECT_ID set and no emulator host: tokens of that real project, checked against Google's
  //              certificates, revocation through the Admin API (which needs GOOGLE_APPLICATION_CREDENTIALS, below)
  //   none       neither: the SDK finds the project itself (Cloud Functions), or every token is refused
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  // host:port of the Auth emulator, development and tests ONLY. The Admin SDK then accepts UNSIGNED tokens, so
  // production refuses to start with it set (see parseConfig).
  FIREBASE_AUTH_EMULATOR_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.-]+:\d{1,5}$/, 'must look like 127.0.0.1:9099')
    .optional(),
  // The service-account key file of the real project (project mode only), an ABSOLUTE path outside the repository.
  // Listed so the schema names every key the API depends on; this config never opens or returns it: the Admin SDK reads
  // the variable itself from the process environment (SEC-1 step 0 (a): google-auth-library's application default
  // credential; loadEnvFile puts the .env value there). Never committed, printed or logged; agents never hold one.
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),

  // The local file store (E-20; P0-03 D2, AC-50; OA-2): the folder that holds uploaded images and packages until the
  // deploy call swaps in Cloud Storage. A relative path is read from the repository root; the default is git-ignored.
  FILE_STORE_DIR: z.string().trim().min(1).default('.local-files'),
  // Which store holds the files (DEP-0 AC-3, DC-5): the local folder above, or a Cloud Storage bucket (E-09). An explicit
  // key, never inferred from NODE_ENV or from GCS_BUCKET being present. GCS_BUCKET is required with 'gcs' (checked below).
  FILE_STORE: z.enum(FILE_STORE_KINDS).default('local'),
  GCS_BUCKET: z.string().trim().min(1).optional(),

  // Set to 'true' by firebase-tools in the Functions emulator, never by hand (DEP-0 step 7, F3): the emulator listens on a
  // named pipe, so a request has no socket address and clientAddress.js fills in the loopback.
  FUNCTIONS_EMULATOR: z.enum(['true', 'false']).optional(),
});

/**
 * Every key the schema reads (the runbook's env table is checked against this list: DEP-0 AC-25). Frozen, in schema order.
 */
const CONFIG_KEYS = Object.freeze(Object.keys(schema.shape));

/**
 * The rules that cross two keys (DEP-0 AC-3, AC-13), read from the raw environment so they are reported together with zod's
 * own issues. Each line names every key it is about.
 * @param {Record<string, string>} present  the environment without empty values
 * @returns {string[]}
 */
function crossKeyProblems(present) {
  const problems = [];
  if (present.FILE_STORE === 'gcs' && (present.GCS_BUCKET ?? '').trim() === '') {
    problems.push('GCS_BUCKET: required when FILE_STORE=gcs (the bucket name)');
  }
  if (Boolean(present.PGHOST) === Boolean(present.CLOUD_SQL_INSTANCE)) {
    problems.push(
      present.PGHOST
        ? 'PGHOST and CLOUD_SQL_INSTANCE: set exactly one (host mode or connector mode), not both'
        : 'PGHOST and CLOUD_SQL_INSTANCE: set exactly one (host mode or connector mode); neither is set',
    );
  }
  return problems;
}

/** MAX_JSON_BODY as a number of bytes (the schema has checked its shape). */
function bodyLimitBytes(text) {
  const [, digits, unit] = /^(\d+)\s?(b|kb|mb)$/i.exec(text);
  return Number(digits) * BODY_UNIT_BYTES[unit.toLowerCase()];
}

/** The Auth emulator's project (CLAUDE.md: demo-gabay), used when an emulator host is set and no project ID is. */
const EMULATOR_PROJECT_ID = 'demo-gabay';
/**
 * The only NODE_ENV values, as written in the RAW environment, under which a dev-only feature is allowed: the Auth
 * emulator host (S1). The development stub (E-20, FF-0) asked it too until SEC-1 deleted the stub (AC-43: the guard is
 * otherwise exactly as it was).
 */
const DEV_ONLY_ENVS = Object.freeze(['development', 'test']);

/**
 * The sign-in mode (SEC-1 AC-57, AC-59), chosen by the environment alone: an emulator host wins (the emulator accepts
 * unsigned tokens, so app.js says so at start), else a project id means the real project, else none.
 * @returns {'emulator'|'project'|'none'}
 */
function authModeOf(e) {
  if (e.FIREBASE_AUTH_EMULATOR_HOST) return 'emulator';
  if (e.FIREBASE_PROJECT_ID) return 'project';
  return 'none';
}

/** Pure: validates an env-like object and returns the config, or throws ConfigError. */
function parseConfig(env) {
  // An empty value in .env means "not set": it takes the default, or fails if required.
  const present = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const result = schema.safeParse(present);
  const problems = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  problems.push(...crossKeyProblems(present));
  if (problems.length > 0) throw new ConfigError(problems);
  const e = result.data;
  // An emulator host makes the Admin SDK accept UNSIGNED tokens: one leaking into a deployed function would let anyone
  // forge a sign-in. So it is allowed only when the RAW environment says NODE_ENV=development or NODE_ENV=test
  // (owner's ruling, P2-S1 review I1). An unset NODE_ENV does not count: zod defaults it to development, and a
  // deployed function that forgot NODE_ENV must not be mistaken for a developer's machine.
  const devOnlyAllowed = DEV_ONLY_ENVS.includes(present.NODE_ENV);
  if (e.FIREBASE_AUTH_EMULATOR_HOST && !devOnlyAllowed) {
    throw new ConfigError([
      'FIREBASE_AUTH_EMULATOR_HOST: set only with NODE_ENV=development or NODE_ENV=test written explicitly in the environment (the emulator accepts unsigned tokens)',
    ]);
  }
  // The same rule for the kill switch (SEC-2 AC-5, DC-5): a deployed function must not run without its limits.
  if (e.RATE_LIMIT === 'off' && !devOnlyAllowed) {
    throw new ConfigError([
      'RATE_LIMIT: off is allowed only with NODE_ENV=development or NODE_ENV=test written explicitly in the environment (a deployed function keeps its rate limits)',
    ]);
  }
  return Object.freeze({
    env: e.NODE_ENV,
    isProduction: e.NODE_ENV === 'production',
    // True only when the RAW environment says development or test. An unset or empty NODE_ENV is false, although `env`
    // above then reads development. Every dev-only feature asks this, never `env`.
    devOnlyAllowed,
    logLevel: e.LOG_LEVEL,
    db: Object.freeze({
      // 'host' (PGHOST) or 'connector' (CLOUD_SQL_INSTANCE); host is null in connector mode and instance null in host mode.
      mode: e.CLOUD_SQL_INSTANCE ? 'connector' : 'host',
      host: e.PGHOST ?? null,
      instance: e.CLOUD_SQL_INSTANCE ?? null,
      port: e.PGPORT,
      database: e.PGDATABASE,
      user: e.PGUSER,
      password: e.PGPASSWORD,
      poolMax: e.PG_POOL_MAX,
      idleTimeoutMs: e.PG_IDLE_TIMEOUT_MS,
      connectTimeoutMs: e.PG_CONNECT_TIMEOUT_MS,
      statementTimeoutMs: e.PG_STATEMENT_TIMEOUT_MS,
    }),
    corsOrigins: Object.freeze(
      e.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
    trustProxyHops: e.TRUST_PROXY_HOPS,
    maxJsonBody: e.MAX_JSON_BODY,
    maxJsonBodyBytes: bodyLimitBytes(e.MAX_JSON_BODY),
    // True inside the Functions emulator (firebase-tools sets FUNCTIONS_EMULATOR=true); see clientAddress.js.
    functionsEmulator: e.FUNCTIONS_EMULATOR === 'true',
    rateLimit: Object.freeze({
      enabled: e.RATE_LIMIT === 'on',
      perMinute: e.RATE_LIMIT_PER_MIN,
      authMax: e.AUTH_RATE_LIMIT_MAX,
      authWindowMs: e.AUTH_RATE_LIMIT_WINDOW_MIN * MS_PER_MINUTE,
    }),
    firebase: Object.freeze({
      projectId:
        e.FIREBASE_PROJECT_ID ?? (e.FIREBASE_AUTH_EMULATOR_HOST ? EMULATOR_PROJECT_ID : null),
      authEmulatorHost: e.FIREBASE_AUTH_EMULATOR_HOST ?? null,
      authMode: authModeOf(e),
    }),
    fileStoreDir: path.resolve(REPO_ROOT, e.FILE_STORE_DIR),
    fileStore: Object.freeze({
      kind: e.FILE_STORE,
      // Only with the Cloud Storage store; null otherwise, so a leftover GCS_BUCKET cannot be mistaken for a choice.
      bucket: e.FILE_STORE === 'gcs' ? e.GCS_BUCKET : null,
    }),
  });
}

let cached = null;

/**
 * The process-wide config. Loads .env first. On a bad config it throws in tests (so a test can
 * assert it) and exits 1 everywhere else (fail fast, §3.16).
 */
function getConfig() {
  if (cached) return cached;
  loadEnvFile();
  try {
    cached = parseConfig(process.env);
  } catch (err) {
    if (!(err instanceof ConfigError) || process.env.NODE_ENV === 'test') throw err;
    console.error(err.message);
    process.exit(1);
  }
  return cached;
}

module.exports = {
  getConfig,
  parseConfig,
  loadEnvFile,
  ConfigError,
  CONFIG_KEYS,
  ENV_FILE,
  DEV_ONLY_ENVS,
  RATE_LIMIT_DEFAULTS: Object.freeze({
    perMinute: DEFAULT_RATE_LIMIT_PER_MIN,
    authMax: DEFAULT_AUTH_RATE_LIMIT_MAX,
    authWindowMin: DEFAULT_AUTH_RATE_LIMIT_WINDOW_MIN,
  }),
  RATE_LIMIT_BOUNDS: Object.freeze({
    perMinute: MAX_RATE_LIMIT_PER_MIN,
    authMax: MAX_AUTH_RATE_LIMIT_MAX,
    authWindowMin: MAX_AUTH_RATE_LIMIT_WINDOW_MIN,
  }),
};
