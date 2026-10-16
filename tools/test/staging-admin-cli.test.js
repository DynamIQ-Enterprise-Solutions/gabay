'use strict';

// DEP-0 AC-37, AC-41, AC-56, AC-57, EC-35 (plan/DEP-0.md 1.0 step 5, R2, DC-24): the command line of `npm run staging:admin` in both
// modes: what is refused before anything is written (the environment, the project, the credential, the database pairing), and that
// the Admin SDK is started with the project id and no credential argument. No network, no emulator and no real database: the
// SDK and the driver are fakes. The logic behind it (the rows, the Firebase user, the link) is functions/test/dep0.stagingAdmin.test.js.

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main, parseArgs, environmentProblems, USAGE } = require('../lib/stagingAdminCli');
const { isLocalDatabaseName } = require('../../db/tools/lib/localDatabases');

const ROOT = path.resolve(__dirname, '..', '..');
const GOOD_LOCAL = {
  STAGING_PROJECT_ID: 'gabay-staging',
  PGHOST: 'localhost',
  PGPORT: '5432',
  PGDATABASE: 'gabay_wt_api_coder',
  PGUSER: 'u',
  PGPASSWORD: 'pw-secret-1',
};
const GOOD_DEPLOYED = { ...GOOD_LOCAL, PGDATABASE: 'gabay', PGHOST: '127.0.0.1', PGPORT: '5433' };

function collect() {
  const lines = [];
  return { lines, out: (l) => lines.push(l), err: (l) => lines.push(`ERR ${l}`) };
}

const noSdk = () => assert.fail('the SDK is not loaded for a refused run');

// -------------------------------------------------------------------------------------------------------------- arguments

test('AC-37: the command takes an email, a role, an optional tenant and --local-db, and nothing else', () => {
  assert.deepEqual(parseArgs(['a@b.co', 'VIEWER', 'T1', '--local-db']), {
    email: 'a@b.co',
    role: 'VIEWER',
    tenant: 'T1',
    localDb: true,
  });
  assert.deepEqual(parseArgs(['a@b.co', 'SUPERADMIN']), {
    email: 'a@b.co',
    role: 'SUPERADMIN',
    tenant: null,
    localDb: false,
  });
  assert.deepEqual(
    parseArgs(['--local-db', 'a@b.co', 'SUPERADMIN']).localDb,
    true,
    'the flag may come first',
  );
  for (const argv of [
    [],
    ['a@b.co'],
    ['a', 'b', 'c', 'd'],
    ['a@b.co', 'VIEWER', '--force'],
    ['a', 'b', '--local-db', '--local-db'],
    ['--local-db'],
  ]) {
    const parsed = parseArgs(argv);
    assert.ok(parsed.error, JSON.stringify(argv));
    assert.match(parsed.error, /Usage|Unknown option|twice/);
  }
  assert.match(USAGE, /--local-db/);
});

// ------------------------------------------------------------------------------------------------------ the environment

test('AC-41: the project id is required, may not be an emulator (demo-) project, and must look like a project id', () => {
  const { STAGING_PROJECT_ID: _drop, ...without } = GOOD_LOCAL;
  void _drop;
  for (const [env, pattern] of [
    [without, /STAGING_PROJECT_ID is not set/],
    [{ ...GOOD_LOCAL, STAGING_PROJECT_ID: 'demo-gabay' }, /emulator project \(demo-\)/],
    [
      { ...GOOD_LOCAL, STAGING_PROJECT_ID: 'Gabay Staging' },
      /does not look like a Firebase project id/,
    ],
    [{ ...GOOD_LOCAL, STAGING_PROJECT_ID: 'x' }, /does not look like/],
  ]) {
    assert.match(environmentProblems(env, { localDb: true }).join('\n'), pattern);
  }
  assert.deepEqual(environmentProblems(GOOD_LOCAL, { localDb: true }), []);
  assert.deepEqual(
    environmentProblems(
      { ...GOOD_LOCAL, STAGING_PROJECT_ID: 'gabay-staging-dq' },
      { localDb: true },
    ),
    [],
  );
});

test('AC-41: an Auth emulator host in the environment is refused in both modes', () => {
  for (const [env, localDb] of [
    [GOOD_LOCAL, true],
    [GOOD_DEPLOYED, false],
  ]) {
    const problems = environmentProblems(
      { ...env, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
      { localDb },
    );
    assert.match(problems.join('\n'), /FIREBASE_AUTH_EMULATOR_HOST is set/);
  }
});

test('R2, AC-56: GOOGLE_APPLICATION_CREDENTIALS is refused, and its path is never printed', () => {
  for (const [env, localDb] of [
    [GOOD_LOCAL, true],
    [GOOD_DEPLOYED, false],
  ]) {
    const problems = environmentProblems(
      { ...env, GOOGLE_APPLICATION_CREDENTIALS: 'C:\\keys\\secret-key.json' },
      { localDb },
    );
    const text = problems.join('\n');
    assert.match(text, /GOOGLE_APPLICATION_CREDENTIALS is set/);
    assert.match(text, /gcloud auth application-default login/);
    assert.ok(!text.includes('secret-key'));
  }
});

test('AC-41: a missing PG key is refused, naming it, and the repository .env is never read', () => {
  const { PGPASSWORD: _a, PGHOST: _b, ...short } = GOOD_LOCAL;
  void _a;
  void _b;
  const text = environmentProblems(short, { localDb: true }).join('\n');
  assert.match(text, /Missing PGHOST, PGPASSWORD/);
  assert.match(text, /never the repository's \.env/);
  const source = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'stagingAdminCli.js'), 'utf8');
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
  for (const word of [
    'loadEnv',
    'loadEnvFile',
    'dotenv',
    "'.env'",
    'credential:',
    'cert(',
    'readFileSync',
  ]) {
    assert.ok(!code.includes(word), `stagingAdminCli.js does not use ${word}`);
  }
});

test('AC-41, EC-35, DC-24: --local-db pairs the real Auth only with a local database, and the deployed mode refuses one', () => {
  for (const name of [
    'gabay_dev',
    'gabay_wt_api_coder',
    'gabay_wt_flutter_coder',
    'gabay_scratch_api_coder_1_2',
  ]) {
    assert.equal(isLocalDatabaseName(name), true, name);
    assert.deepEqual(
      environmentProblems({ ...GOOD_LOCAL, PGDATABASE: name }, { localDb: true }),
      [],
    );
    assert.match(
      environmentProblems({ ...GOOD_LOCAL, PGDATABASE: name }, { localDb: false }).join('\n'),
      /one of this machine's: add --local-db/,
      name,
    );
  }
  for (const name of [
    'gabay',
    'gabay_staging',
    'postgres',
    'gabay_dev2',
    'gabay_wt_',
    'GABAY_DEV',
    'gabay_wt_x-y',
  ]) {
    assert.equal(isLocalDatabaseName(name), false, name);
    assert.deepEqual(
      environmentProblems({ ...GOOD_DEPLOYED, PGDATABASE: name }, { localDb: false }),
      [],
    );
    assert.match(
      environmentProblems({ ...GOOD_DEPLOYED, PGDATABASE: name }, { localDb: true }).join('\n'),
      /not one of this machine's/,
      name,
    );
  }
  assert.equal(isLocalDatabaseName(undefined), false);
  assert.equal(isLocalDatabaseName(5), false);
});

test('AC-41: a refused run prints every problem, exits 1, and never loads the SDK or touches a database', async () => {
  const io = collect();
  const code = await main({
    env: {
      ...GOOD_LOCAL,
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      GOOGLE_APPLICATION_CREDENTIALS: '/k.json',
      STAGING_PROJECT_ID: 'demo-x',
    },
    argv: ['a@example.com', 'SUPERADMIN', '--local-db'],
    sdk: noSdk,
    ...io,
  });
  assert.equal(code, 1);
  const text = io.lines.join('\n');
  assert.match(text, /demo-/);
  assert.match(text, /FIREBASE_AUTH_EMULATOR_HOST/);
  assert.match(text, /GOOGLE_APPLICATION_CREDENTIALS/);
  assert.ok(!text.includes('/k.json') && !text.includes('pw-secret-1'));
  const bad = collect();
  assert.equal(await main({ env: GOOD_LOCAL, argv: ['only-one'], sdk: noSdk, ...bad }), 1);
  assert.match(bad.lines.join('\n'), /Usage/);
});

// ------------------------------------------------------------------------------------------------------ the SDK start

/** Fakes for the SDK and the driver: records how the app was started, and answers the few queries a SUPERADMIN needs. */
function fakeSdk({
  connectFails = false,
  roleRows = [{ id: 1, code: 'SUPERADMIN', platform: true }],
} = {}) {
  const record = { init: [], getAuth: [], deleted: 0, queries: [], ended: 0, clientConfig: null };
  const auth = {
    calls: [],
    async getUserByEmail(email) {
      auth.calls.push(['getUserByEmail', email]);
      throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
    },
    async createUser(props) {
      auth.calls.push(['createUser', props]);
      return { uid: 'fb-1', ...props };
    },
    async generatePasswordResetLink(email) {
      auth.calls.push(['generatePasswordResetLink', email]);
      return 'https://fake.example/reset?code=ONE-TIME';
    },
  };
  class Client {
    constructor(config) {
      record.clientConfig = config;
    }
    async connect() {
      if (connectFails) throw new Error('password authentication failed for user "u" pw-secret-1');
    }
    async query(text) {
      record.queries.push(text.replace(/\s+/g, ' ').trim());
      if (/FROM gabay\.Role/.test(text)) return { rows: roleRows };
      if (/FROM gabay\.AppUser/.test(text)) return { rows: [] };
      if (/INSERT INTO gabay\.AppUser/.test(text)) return { rows: [{ id: 7 }] };
      if (/INSERT INTO gabay\.UserRole/.test(text)) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    }
    async end() {
      record.ended += 1;
    }
  }
  const sdk = () => ({
    initializeApp: (options, ...rest) => {
      record.init.push([options, ...rest]);
      return { app: true };
    },
    deleteApp: async () => {
      record.deleted += 1;
    },
    getAuth: (app) => {
      record.getAuth.push(app);
      return auth;
    },
    Client,
  });
  return { sdk, record, auth };
}

test('AC-56: the Admin SDK is started with the project id and NO credential argument, and the app is deleted at the end', async () => {
  const { sdk, record, auth } = fakeSdk();
  const io = collect();
  const code = await main({
    env: GOOD_LOCAL,
    argv: ['Me@Example.com', 'SUPERADMIN', '--local-db'],
    sdk,
    ...io,
  });
  assert.equal(code, 0, io.lines.join('\n'));
  assert.deepEqual(
    record.init,
    [[{ projectId: 'gabay-staging' }]],
    'exactly { projectId }, nothing else, no second argument',
  );
  assert.equal(record.getAuth.length, 1);
  assert.equal(record.deleted, 1);
  assert.equal(record.ended, 1);
  assert.deepEqual(
    {
      host: record.clientConfig.host,
      port: record.clientConfig.port,
      database: record.clientConfig.database,
      user: record.clientConfig.user,
    },
    { host: 'localhost', port: 5432, database: 'gabay_wt_api_coder', user: 'u' },
    'the database client is built from the environment, explicitly',
  );
  assert.ok(
    !('password' in auth.calls.find((c) => c[0] === 'createUser')[1]),
    'no password is asked of the SDK',
  );
});

test('AC-41, AC-38: it states its mode, project and database first, and prints the link once, last, and never the database password', async () => {
  const { sdk } = fakeSdk();
  const io = collect();
  assert.equal(
    await main({
      env: GOOD_LOCAL,
      argv: ['me@example.com', 'SUPERADMIN', '--local-db'],
      sdk,
      ...io,
    }),
    0,
  );
  assert.match(io.lines[0], /mode: local database \(--local-db\)/);
  assert.match(io.lines[1], /Firebase project: gabay-staging/);
  assert.match(io.lines[2], /Database: localhost:5432\/gabay_wt_api_coder as u/);
  assert.match(io.lines[3], /Account: me@example\.com as SUPERADMIN/);
  const withLink = io.lines.filter((l) => l.includes('ONE-TIME'));
  assert.equal(withLink.length, 1, 'the link is printed once');
  assert.equal(io.lines.at(-1), withLink[0], 'and last');
  assert.ok(!io.lines.join('\n').includes('pw-secret-1'));
  const deployed = collect();
  await main({
    env: GOOD_DEPLOYED,
    argv: ['me@example.com', 'SUPERADMIN'],
    sdk: fakeSdk().sdk,
    ...deployed,
  });
  assert.match(deployed.lines[0], /mode: deployed database/);
});

test('AC-37: an unknown role is refused after the SDK starts but before anything is created; one plain line, exit 1', async () => {
  const { sdk, auth } = fakeSdk({ roleRows: [] });
  const io = collect();
  const code = await main({
    env: GOOD_LOCAL,
    argv: ['me@example.com', 'NOPE', '--local-db'],
    sdk,
    ...io,
  });
  assert.equal(code, 1);
  assert.match(io.lines.at(-1), /^ERR "NOPE" is not an active role/);
  assert.deepEqual(auth.calls, []);
});

test('AC-35-style: a database that cannot be reached is one plain line without the password, and no SDK app is made', async () => {
  const { sdk, record } = fakeSdk({ connectFails: true });
  const io = collect();
  const code = await main({
    env: GOOD_LOCAL,
    argv: ['me@example.com', 'SUPERADMIN', '--local-db'],
    sdk,
    ...io,
  });
  assert.equal(code, 1);
  const text = io.lines.join('\n');
  assert.match(text, /Could not connect to the database named above\. Nothing was written\./);
  assert.ok(!text.includes('pw-secret-1') && !text.includes('password authentication'));
  assert.deepEqual(record.init, []);
});

test('AC-57: an Admin SDK failure inside the command is one plain line with the fix, and no raw text', async () => {
  const { sdk, auth } = fakeSdk();
  auth.getUserByEmail = async () => {
    throw Object.assign(new Error('Could not load the default credentials. raw C:\\x\\key.json'), {
      code: 'app/invalid-credential',
    });
  };
  const io = collect();
  const code = await main({
    env: GOOD_LOCAL,
    argv: ['me@example.com', 'SUPERADMIN', '--local-db'],
    sdk,
    ...io,
  });
  assert.equal(code, 1);
  assert.match(
    io.lines.at(-1),
    /^ERR No Google login was found on this machine\. Sign in with `gcloud auth application-default login`/,
  );
  assert.ok(!io.lines.join('\n').includes('key.json'));
});

// ------------------------------------------------------------------------------------------------------ the scripts

test('the staging and deploy scripts never load the repository .env (no --env-file)', () => {
  const root = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  const seeds = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db', 'seeds', 'package.json'), 'utf8'),
  ).scripts;
  const tools = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'db', 'tools', 'package.json'), 'utf8'),
  ).scripts;
  for (const script of [
    root['staging:admin'],
    root['staging:seed'],
    root['db:deploy'],
    seeds['staging:seed'],
    tools.deploy,
    root['gcs:check'],
  ]) {
    assert.ok(script, 'the script exists');
    assert.ok(!/env-file/.test(script), script);
  }
  assert.equal(root['staging:admin'], 'node tools/staging-admin.js');
  assert.equal(root['db:deploy'], 'npm --prefix db/tools run deploy --');
  assert.equal(root['staging:seed'], 'npm --prefix db/seeds run staging:seed');
});
