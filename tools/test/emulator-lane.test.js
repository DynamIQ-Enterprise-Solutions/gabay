// plan/PH4-lane-ports.md: each working copy runs its emulators on its own ports (a lane = the copy's port offset).
// Written before tools/lib/emulator-lane.js existed: every test here failed on the code of origin/main.
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lane = require('../lib/emulator-lane');
const { AGENT_NAMES, PORT_OFFSETS } = require('../lib/worktree-names');
const { healthUrl } = require('../health-probe');

const REAL = path.resolve(__dirname, '..', '..');
const FAMILIES = ['functions', 'auth', 'hub', 'logging', 'eventarc', 'tasks'];

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-lane-'));
/** A temp root holding copies of the committed configs, as a clone has them. */
function rootWithConfigs() {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'db', 'seeds'), { recursive: true });
  fs.copyFileSync(path.join(REAL, 'firebase.json'), path.join(root, 'firebase.json'));
  fs.copyFileSync(
    path.join(REAL, 'db/seeds/firebase.json'),
    path.join(root, 'db/seeds/firebase.json'),
  );
  return root;
}
const clean = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// ---- the offset: .env, then the table, then 0 ------------------------------------------------------------

test('the offset table: one slot per agent name, none zero, one-to-one', () => {
  assert.deepEqual(Object.keys(PORT_OFFSETS).sort(), [...AGENT_NAMES].sort());
  assert.deepEqual(PORT_OFFSETS, {
    'api-coder': 10,
    'flutter-coder': 20,
    'engine-coder': 30,
    'native-ble': 40,
    'test-verifier': 50,
  });
  const values = Object.values(PORT_OFFSETS);
  assert.equal(new Set(values).size, values.length, 'two copies share an offset');
  assert.ok(
    values.every((v) => v > 0),
    'offset 0 is the main folder',
  );
});

test('the ports for offsets 0, 10 and 50 are exactly the planned numbers', () => {
  assert.deepEqual(lane.lanePorts(0), {
    functions: 5001,
    auth: 9099,
    hub: 4400,
    logging: 4500,
    eventarc: 9299,
    tasks: 9499,
  });
  assert.deepEqual(lane.lanePorts(10), {
    functions: 5011,
    auth: 9109,
    hub: 4410,
    logging: 4510,
    eventarc: 9309,
    tasks: 9509,
  });
  assert.deepEqual(lane.lanePorts(50), {
    functions: 5051,
    auth: 9149,
    hub: 4450,
    logging: 4550,
    eventarc: 9349,
    tasks: 9549,
  });
});

test('no two lanes (main and the five copies) share any port, in any family', () => {
  const owners = new Map();
  for (const offset of [0, ...Object.values(PORT_OFFSETS)]) {
    const ports = lane.lanePorts(offset);
    assert.deepEqual(Object.keys(ports), FAMILIES);
    for (const [family, port] of Object.entries(ports)) {
      assert.equal(
        owners.get(port),
        undefined,
        `port ${port} (${family}, offset ${offset}) is shared`,
      );
      owners.set(port, `${family} ${offset}`);
    }
  }
  assert.equal(owners.size, 36);
});

// Review 1 (Important 1): the cap was 500 while base ports sit only 100, 200 or 400 apart, so offsets 100 apart shared a
// port but held different lock files (gabay-verify-100.lock vs gabay-verify.lock), defeating design choice C2.
test('MAX_OFFSET is below every gap between two base ports, so two different offsets never share a port', () => {
  const ports = Object.values(lane.BASE_PORTS).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i < ports.length; i += 1) {
    for (let j = i + 1; j < ports.length; j += 1) gaps.push(ports[j] - ports[i]);
  }
  assert.ok(
    lane.MAX_OFFSET < Math.min(...gaps),
    `MAX_OFFSET ${lane.MAX_OFFSET} reaches the smallest gap between two base ports (${Math.min(...gaps)})`,
  );
  // and the consequence, checked directly over every pair of accepted offsets
  const owner = new Map();
  for (let offset = 0; offset <= lane.MAX_OFFSET; offset += 1) {
    for (const [family, port] of Object.entries(lane.lanePorts(offset))) {
      assert.equal(
        owner.get(port),
        undefined,
        `port ${port} (${family}, offset ${offset}) is shared`,
      );
      owner.set(port, offset);
    }
  }
  assert.equal(lane.parseOffset(lane.MAX_OFFSET), lane.MAX_OFFSET);
  assert.throws(() => lane.parseOffset(lane.MAX_OFFSET + 1), /EMULATOR_PORT_OFFSET/);
});

test('the offset is read from the .env value first, then the table by the folder name, then 0', () => {
  const env = (value) => `PGDATABASE=x\nEMULATOR_PORT_OFFSET=${value}\n`;
  assert.equal(lane.resolveOffset({ envText: env('70'), folderName: 'api-coder' }), 70);
  assert.equal(lane.resolveOffset({ envText: 'PGDATABASE=x\n', folderName: 'api-coder' }), 10);
  assert.equal(lane.resolveOffset({ envText: 'PGDATABASE=x\n', folderName: 'native-ble' }), 40);
  assert.equal(lane.resolveOffset({ envText: null, folderName: 'test-verifier' }), 50);
  assert.equal(lane.resolveOffset({ envText: null, folderName: 'Gabay' }), 0);
  assert.equal(
    lane.resolveOffset({ envText: env('0'), folderName: 'api-coder' }),
    0,
    'an explicit 0 wins',
  );
  // an empty value counts as "not set", as everywhere else in .env
  assert.equal(lane.resolveOffset({ envText: env(''), folderName: 'flutter-coder' }), 20);
  // quotes and spaces as .env files have them
  assert.equal(
    lane.resolveOffset({ envText: 'EMULATOR_PORT_OFFSET = "60"\n', folderName: 'x' }),
    60,
  );
});

test('a bad offset is an error that names the key and the value rules', () => {
  for (const bad of ['abc', '-10', '1.5', '10 20', '99999', '501', '100', '0x10']) {
    assert.throws(
      () => lane.resolveOffset({ envText: `EMULATOR_PORT_OFFSET=${bad}\n`, folderName: 'x' }),
      (err) => err.message.includes('EMULATOR_PORT_OFFSET') && err.message.includes(`"${bad}"`),
      `"${bad}" must be refused`,
    );
  }
});

test('readOffset reads the .env of a folder; a folder without one uses the table', () => {
  const root = tempRoot();
  try {
    const named = path.join(root, 'engine-coder');
    fs.mkdirSync(named);
    assert.equal(lane.readOffset(named), 30, 'no .env: the table');
    fs.writeFileSync(path.join(named, '.env'), 'EMULATOR_PORT_OFFSET=90\n');
    assert.equal(lane.readOffset(named), 90, '.env wins over the table');
    const other = path.join(root, 'Gabay');
    fs.mkdirSync(other);
    assert.equal(lane.readOffset(other), 0, 'main');
  } finally {
    clean(root);
  }
});

// ---- the generated configs -------------------------------------------------------------------------------

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(REAL, rel), 'utf8'));
const PORT_KEYS = ['functions', 'auth', 'hub', 'logging', 'eventarc', 'tasks'];

/** A committed config with every emulator's port and host removed: what must be identical in a lane config. */
function withoutPorts(config) {
  const copy = structuredClone(config);
  for (const key of PORT_KEYS) delete copy.emulators?.[key];
  return copy;
}

test('a lane config equals the committed one with only the ports changed (functions and seed configs)', () => {
  for (const rel of ['firebase.json', 'db/seeds/firebase.json']) {
    const committed = readJson(rel);
    const generated = lane.laneConfig(committed, 10);
    assert.deepEqual(
      withoutPorts(generated),
      withoutPorts(committed),
      `${rel}: more than ports changed`,
    );
    // ui stays disabled; singleProjectMode stays as it was
    assert.deepEqual(generated.emulators.ui, committed.emulators.ui);
    assert.equal(generated.emulators.singleProjectMode, committed.emulators.singleProjectMode);
    // every family present is on its lane port, bound to 127.0.0.1, and the four that float are pinned
    const ports = lane.lanePorts(10);
    for (const family of ['hub', 'logging', 'eventarc', 'tasks']) {
      assert.deepEqual(
        generated.emulators[family],
        { host: '127.0.0.1', port: ports[family] },
        `${rel} ${family}`,
      );
    }
    for (const family of ['functions', 'auth']) {
      if (committed.emulators[family]) {
        assert.deepEqual(
          generated.emulators[family],
          { host: '127.0.0.1', port: ports[family] },
          `${rel} ${family}`,
        );
      } else {
        assert.equal(generated.emulators[family], undefined, `${rel} must not gain ${family}`);
      }
    }
  }
});

test('laneConfig does not change what it is given', () => {
  const committed = readJson('firebase.json');
  const before = JSON.stringify(committed);
  lane.laneConfig(committed, 30);
  assert.equal(JSON.stringify(committed), before);
});

test('offset 0 generates nothing and names the committed configs; an offset above 0 writes both lane files', () => {
  const root = tempRoot();
  try {
    fs.mkdirSync(path.join(root, 'db', 'seeds'), { recursive: true });
    fs.copyFileSync(path.join(REAL, 'firebase.json'), path.join(root, 'firebase.json'));
    fs.copyFileSync(
      path.join(REAL, 'db/seeds/firebase.json'),
      path.join(root, 'db/seeds/firebase.json'),
    );

    assert.deepEqual(lane.writeLaneConfigs(root, 0), []);
    assert.equal(fs.existsSync(path.join(root, 'firebase.lane.json')), false);
    assert.equal(fs.existsSync(path.join(root, 'db/seeds/firebase.lane.json')), false);
    assert.equal(lane.configName(0), 'firebase.json');

    const written = lane.writeLaneConfigs(root, 20);
    assert.deepEqual(written.sort(), ['db/seeds/firebase.lane.json', 'firebase.lane.json']);
    assert.equal(lane.configName(20), 'firebase.lane.json');
    const top = JSON.parse(fs.readFileSync(path.join(root, 'firebase.lane.json'), 'utf8'));
    assert.equal(top.emulators.functions.port, 5021);
    assert.equal(top.functions.source, 'functions', 'relative paths stay as they are');
    const seed = JSON.parse(
      fs.readFileSync(path.join(root, 'db/seeds/firebase.lane.json'), 'utf8'),
    );
    assert.equal(seed.emulators.auth.port, 9119);
    // the committed files are untouched
    assert.equal(
      fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'),
      fs.readFileSync(path.join(REAL, 'firebase.json'), 'utf8'),
    );
    // a second call with the same offset leaves the files byte for byte (and says nothing was rewritten)
    const mtime = fs.statSync(path.join(root, 'firebase.lane.json')).mtimeMs;
    lane.writeLaneConfigs(root, 20);
    assert.equal(fs.statSync(path.join(root, 'firebase.lane.json')).mtimeMs, mtime);
    // and a different offset rewrites them
    lane.writeLaneConfigs(root, 30);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(root, 'firebase.lane.json'), 'utf8')).emulators.functions
        .port,
      5031,
    );
  } finally {
    clean(root);
  }
});

test('the generated files are git-ignored (any folder)', () => {
  const ignore = fs.readFileSync(path.join(REAL, '.gitignore'), 'utf8');
  assert.match(ignore, /^firebase\.lane\.json$/m);
});

// ---- the servers a check starts, the firebase command, the summary ----------------------------------------

test('the busy/orphan lists name the ports each check starts, on the lane', () => {
  assert.deepEqual(lane.serverPorts(0).functions, [5001, 9099, 4400, 4500, 9299, 9499]);
  assert.deepEqual(lane.serverPorts(0).seed, [9099, 4400, 4500]);
  assert.deepEqual(lane.serverPorts(0).export, [4400, 9099]);
  assert.deepEqual(lane.serverPorts(10).functions, [5011, 9109, 4410, 4510, 9309, 9509]);
  assert.deepEqual(lane.serverPorts(10).seed, [9109, 4410, 4510]);
  assert.deepEqual(lane.serverPorts(10).export, [4410, 9109]);
});

test('emulatorExec: offset 0 adds nothing (the main folder and CI behave as before)', () => {
  const root = rootWithConfigs();
  try {
    const x = lane.emulatorExec({
      root,
      offset: 0,
      bin: 'C:\\x\\firebase.cmd',
      only: 'functions',
      script: 'node tools/health-probe.js',
    });
    assert.equal(
      x.commandLine,
      '"C:\\x\\firebase.cmd" emulators:exec --only functions --project demo-gabay "node tools/health-probe.js"',
    );
    assert.equal(x.env.GABAY_FIREBASE_CONFIG, 'firebase.json');
    assert.equal(x.env.TEMP, process.env.TEMP, 'the temp folder is not moved');
  } finally {
    clean(root);
  }
});

test('emulatorExec: offset 10 adds --config firebase.lane.json and gives the child its own temp folder (hub locator)', () => {
  const root = rootWithConfigs();
  try {
    const x = lane.emulatorExec({
      root,
      offset: 10,
      bin: 'C:\\x\\firebase.cmd',
      only: 'functions',
      script: 'node tools/health-probe.js',
    });
    assert.equal(
      x.commandLine,
      '"C:\\x\\firebase.cmd" emulators:exec --config firebase.lane.json --only functions --project demo-gabay "node tools/health-probe.js"',
    );
    const own = path.join(root, '.verify', 'tmp');
    for (const key of ['TEMP', 'TMP', 'TMPDIR']) assert.equal(x.env[key], own, key);
    assert.ok(fs.statSync(own).isDirectory(), 'the temp folder exists');
    assert.equal(x.env.GABAY_FIREBASE_CONFIG, 'firebase.lane.json');
  } finally {
    clean(root);
  }
});

test("emulatorExec: extra emulators:exec arguments (the seed's import and export) come after --project", () => {
  const root = rootWithConfigs();
  try {
    const x = lane.emulatorExec({
      root,
      offset: 10,
      dir: 'db/seeds',
      bin: 'fb',
      only: 'auth',
      script: 'node seed.js',
      extraArgs: ['--import', './.emulator-data', '--export-on-exit', './.emulator-data'],
    });
    assert.equal(
      x.commandLine,
      '"fb" emulators:exec --config firebase.lane.json --only auth --project demo-gabay --import ./.emulator-data --export-on-exit ./.emulator-data "node seed.js"',
    );
  } finally {
    clean(root);
  }
});

test("the summary line names the offset, every port and the app's API_BASE", () => {
  assert.equal(
    lane.laneSummary(10),
    'lane: offset 10, functions 5011, auth 9109, hub 4410, logging 4510, eventarc 9309, tasks 9509',
  );
  assert.equal(lane.apiBase(10), 'http://127.0.0.1:5011/demo-gabay/asia-southeast1/api');
  assert.equal(lane.apiBase(0), 'http://127.0.0.1:5001/demo-gabay/asia-southeast1/api');
});

// ---- the health probe finds the lane's function ------------------------------------------------------------

test('healthUrl reads the port from the config named in GABAY_FIREBASE_CONFIG (default firebase.json)', () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(
      path.join(root, 'firebase.json'),
      JSON.stringify({ emulators: { functions: { host: '127.0.0.1', port: 5001 } } }),
    );
    fs.writeFileSync(
      path.join(root, 'firebase.lane.json'),
      JSON.stringify({ emulators: { functions: { host: '127.0.0.1', port: 5011 } } }),
    );
    const base = 'demo-gabay/asia-southeast1/api/api/health';
    assert.equal(healthUrl(root, {}), `http://127.0.0.1:5001/${base}`);
    assert.equal(
      healthUrl(root, { GABAY_FIREBASE_CONFIG: 'firebase.lane.json' }),
      `http://127.0.0.1:5011/${base}`,
    );
  } finally {
    clean(root);
  }
});

// ---- one place builds the firebase command ------------------------------------------------------------------

test('the seed script is the wrapper, and neither verify.js nor the health probe fixes an emulator port any more', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REAL, 'db/seeds/package.json'), 'utf8'));
  assert.equal(pkg.scripts.seed, 'node ../../tools/emulator-seed.js');
  assert.ok(fs.existsSync(path.join(REAL, 'tools/emulator-seed.js')));
  for (const rel of ['tools/verify.js']) {
    const text = fs.readFileSync(path.join(REAL, rel), 'utf8').replace(/\/\/.*$/gm, '');
    for (const port of ['5001', '9099', '4400', '4500', '9299', '9499']) {
      assert.equal(new RegExp(`\b${port}\b`).test(text), false, `${rel} still holds port ${port}`);
    }
  }
});

// ---- the Functions run on a busy machine ----------------------------------------------------------------------

// Seen in the first concurrent run (2026-10-14): with several verifies on the machine the emulator's discovery of the
// function's code took over firebase-tools' 10 s default and functions-health failed ("Cannot determine backend
// specification. Timeout after 10000"). FUNCTIONS_DISCOVERY_TIMEOUT (seconds; discovery/index.js in firebase-tools
// 15.32.1) lifts it for the Functions run only.
test('a Functions run gets a longer code-discovery timeout (a busy machine), an argument with the default 60; an Auth run gets none', () => {
  const root = rootWithConfigs();
  const saved = process.env.FUNCTIONS_DISCOVERY_TIMEOUT;
  try {
    delete process.env.FUNCTIONS_DISCOVERY_TIMEOUT;
    const run = (only, offset = 0, extra = {}) =>
      lane.emulatorExec({ root, offset, bin: 'fb', only, script: 'node x.js', ...extra }).env;
    assert.equal(run('functions').FUNCTIONS_DISCOVERY_TIMEOUT, '60');
    assert.equal(run('functions', 10).FUNCTIONS_DISCOVERY_TIMEOUT, '60');
    assert.equal(run('auth').FUNCTIONS_DISCOVERY_TIMEOUT, undefined);
    // Regression (DEP-0): functions-health started `--only functions,auth` and lost the timeout, so the Functions emulator's 10 s
    // default made 'Cannot determine backend specification. Timeout after 10000' fail a push under load.
    assert.equal(run('functions,auth').FUNCTIONS_DISCOVERY_TIMEOUT, '60');
    assert.equal(run('auth,functions', 10).FUNCTIONS_DISCOVERY_TIMEOUT, '60');
    assert.equal(
      run('functions', 0, { discoveryTimeoutS: 120 }).FUNCTIONS_DISCOVERY_TIMEOUT,
      '120',
    );
    assert.equal(
      run('functions', 0, { discoveryTimeoutS: undefined }).FUNCTIONS_DISCOVERY_TIMEOUT,
      '60',
    );
    // the function reads no environment of its own: a value in the process environment is not consulted here
    process.env.FUNCTIONS_DISCOVERY_TIMEOUT = '999';
    assert.equal(run('functions').FUNCTIONS_DISCOVERY_TIMEOUT, '60');
  } finally {
    if (saved === undefined) delete process.env.FUNCTIONS_DISCOVERY_TIMEOUT;
    else process.env.FUNCTIONS_DISCOVERY_TIMEOUT = saved;
    clean(root);
  }
});

test("tools/verify.js passes the user's own FUNCTIONS_DISCOVERY_TIMEOUT to the Functions run (it wins over the default)", () => {
  const text = fs.readFileSync(path.join(REAL, 'tools/verify.js'), 'utf8');
  assert.match(text, /discoveryTimeoutS: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || undefined/);
});
