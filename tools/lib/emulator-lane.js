// Emulator lanes (plan/PH4-lane-ports.md): each working copy runs its Firebase emulators on its own ports, so two
// copies' `npm run verify` (and the owner's emulator in the main folder) never meet. A lane is a working copy; its
// number is an OFFSET added to every default emulator port. The main folder is offset 0 (the defaults, the committed
// firebase.json files, no generated file), so the owner's own commands and CI behave as they always did.
//
// The offset is read from EMULATOR_PORT_OFFSET in the copy's git-ignored .env; without it, from the table in
// worktree-names.js for a copy named after an agent; without that, 0. For an offset above 0, firebase.lane.json (root)
// and db/seeds/firebase.lane.json are generated (git-ignored): the committed configs with the ports moved and the four
// ports that would otherwise float (hub, logging, eventarc, tasks) pinned, so two copies starting together cannot
// drift onto each other. The firebase command is built here, once, for the seed and the health check (C6): a
// moved lane adds `--config`, and gives the child its own temp folder so the hub's locator file
// (hub-demo-gabay.json in the temp folder) is not shared with another copy's emulator (C3).
//
// Plain CommonJS, no dependencies beyond tools/lib, any Node >= 22.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { PORT_OFFSETS } = require('./worktree-names');
const { childEnv } = require('./proc');

/** The .env key that holds a copy's offset. */
const OFFSET_KEY = 'EMULATOR_PORT_OFFSET';
/**
 * The largest offset accepted. It must stay BELOW the smallest gap between two base ports (hub 4400 and logging 4500
 * are 100 apart), or two different offsets could share a port while holding different lock files (design choice C2).
 * tools/test/emulator-lane.test.js derives the gaps and fails if this reaches any of them.
 */
const MAX_OFFSET = 99;
/** The emulators' default ports (the main folder's lane). */
const BASE_PORTS = Object.freeze({
  functions: 5001,
  auth: 9099,
  hub: 4400,
  logging: 4500,
  eventarc: 9299,
  tasks: 9499,
});
/** The emulator host in every config. */
const HOST = '127.0.0.1';
/** Emulators that float to another port when theirs is taken (firebase-tools 15.32.1, constants.js): pinned in a lane config. */
const PINNED = ['hub', 'logging', 'eventarc', 'tasks'];
/** The two committed configs (repo-relative, forward slashes) a lane config is made from. */
const COMMITTED_CONFIGS = ['firebase.json', 'db/seeds/firebase.json'];
/**
 * How long (seconds) the Functions emulator may take to discover the function's code (FUNCTIONS_DISCOVERY_TIMEOUT, read
 * by firebase-tools 15.32.1 in discovery/index.js; its default is 10 s). Several verifies on one machine pushed the load
 * past 10 s once (2026-10-14), so a Functions run gets this much (the default of emulatorExec's `discoveryTimeoutS`;
 * a caller passes a value already in the environment instead, so that one wins).
 */
const FUNCTIONS_DISCOVERY_TIMEOUT_S = 60;
/** The project id of every emulator run. */
const PROJECT = 'demo-gabay';
/** The Functions region and function name the API is served under in the emulator (see tools/health-probe.js). */
const API_PATH = 'demo-gabay/asia-southeast1/api';

/** The offset as a whole number from 0 to MAX_OFFSET; an error naming the key for anything else. */
function parseOffset(raw) {
  const text = String(raw).trim();
  if (!/^(0|[1-9]\d?)$/.test(text) || Number(text) > MAX_OFFSET) {
    throw new Error(`${OFFSET_KEY} must be a whole number from 0 to ${MAX_OFFSET}, got "${raw}"`);
  }
  return Number(text);
}

/**
 * The offset of a copy: the .env value (an empty one counts as not set), else the table for a folder named after an
 * agent, else 0.
 * @param {{ envText?: string|null, folderName?: string }} source
 */
function resolveOffset({ envText = null, folderName = '' }) {
  const fromEnv = envText ? parseEnv(envText)[OFFSET_KEY] : undefined;
  if (fromEnv !== undefined && fromEnv !== '') return parseOffset(fromEnv);
  return Object.hasOwn(PORT_OFFSETS, folderName) ? PORT_OFFSETS[folderName] : 0;
}

/** The offset of the copy at `root`: its .env (if any) and its folder name. */
function readOffset(root) {
  let envText = null;
  try {
    envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return resolveOffset({ envText, folderName: path.basename(path.resolve(root)) });
}

/** The six emulator ports of a lane. */
function lanePorts(offset) {
  return Object.fromEntries(
    Object.entries(BASE_PORTS).map(([name, port]) => [name, port + offset]),
  );
}

/**
 * The ports each check that starts servers must find free, and must leave free: the Functions run starts functions, hub,
 * logging, eventarc and tasks; the seed's Auth run starts auth, hub and logging; `export` are the two whose listeners
 * mean an export may be running (hub and Auth).
 */
function serverPorts(offset) {
  const p = lanePorts(offset);
  return {
    functions: [p.functions, p.hub, p.logging, p.eventarc, p.tasks],
    seed: [p.auth, p.hub, p.logging],
    export: [p.hub, p.auth],
  };
}

/** The firebase config a lane uses, relative to the folder that holds it. */
const configName = (offset) => (offset > 0 ? 'firebase.lane.json' : 'firebase.json');

/** A committed config with the lane's ports: only ports change; hub, logging, eventarc and tasks are pinned. Pure. */
function laneConfig(committed, offset) {
  const ports = lanePorts(offset);
  const config = structuredClone(committed);
  const emulators = (config.emulators ??= {});
  for (const name of ['functions', 'auth']) {
    if (emulators[name])
      emulators[name] = { host: emulators[name].host ?? HOST, port: ports[name] };
  }
  for (const name of PINNED) emulators[name] = { host: HOST, port: ports[name] };
  return config;
}

/**
 * Writes the lane configs of `root` for an offset above 0 (nothing for 0) from the committed ones that exist; a file
 * already holding the right text is left alone. Returns the repo-relative paths it wrote.
 */
function writeLaneConfigs(root, offset) {
  const written = [];
  if (offset === 0) return written;
  for (const rel of COMMITTED_CONFIGS) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    const lanePath = rel.replace(/firebase\.json$/, 'firebase.lane.json');
    const text = `${JSON.stringify(laneConfig(JSON.parse(fs.readFileSync(from, 'utf8')), offset), null, 2)}\n`;
    const to = path.join(root, lanePath);
    if (fs.existsSync(to) && fs.readFileSync(to, 'utf8') === text) continue;
    fs.writeFileSync(to, text);
    written.push(lanePath);
  }
  return written;
}

/** The firebase CLI of the seed project (db/seeds/node_modules/.bin), as a path. */
function firebaseBin(root) {
  const dir = path.join(root, 'db', 'seeds', 'node_modules', '.bin');
  return path.join(dir, process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
}

/**
 * The `firebase emulators:exec` command line and its environment for a lane. `dir` is the repo-relative folder that
 * holds the config the command runs in (the command's cwd): '' for the root's, 'db/seeds' for the seed's. For offset 0
 * nothing is added to the plain command (the committed config, the process's own temp folder). Above 0: the generated
 * config is named with --config, and TEMP, TMP and TMPDIR point at <root>/.verify/tmp (C3).
 * GABAY_FIREBASE_CONFIG tells tools/health-probe.js which config holds the port. A Functions run also gets
 * FUNCTIONS_DISCOVERY_TIMEOUT (C7), at every offset including 0. The timeout is an argument, so this function reads no
 * environment of its own: a caller that honours the user's own value passes it (tools/verify.js does).
 * It writes files (the lane configs, the temp folder), unlike the port maths above it.
 * @param {{ root: string, offset: number, dir?: string, bin: string, only: string, script: string, extraArgs?: string[], discoveryTimeoutS?: number|string }} o
 * @returns {{ commandLine: string, env: object }}
 */
function emulatorExec({
  root,
  offset,
  dir = '',
  bin,
  only,
  script,
  extraArgs = [],
  discoveryTimeoutS = FUNCTIONS_DISCOVERY_TIMEOUT_S,
}) {
  const config = configName(offset);
  const extra = { GABAY_FIREBASE_CONFIG: config };
  if (only === 'functions') extra.FUNCTIONS_DISCOVERY_TIMEOUT = String(discoveryTimeoutS);
  if (offset > 0) {
    writeLaneConfigs(root, offset);
    if (!fs.existsSync(path.join(root, dir, config))) {
      throw new Error(
        `There is no firebase.json in ${path.join(root, dir)} to make ${config} from.`,
      );
    }
    const own = path.join(root, '.verify', 'tmp');
    fs.mkdirSync(own, { recursive: true });
    Object.assign(extra, { TEMP: own, TMP: own, TMPDIR: own });
  }
  const parts = [
    `"${bin}" emulators:exec`,
    ...(offset > 0 ? ['--config', config] : []),
    '--only',
    only,
    '--project',
    PROJECT,
    ...extraArgs,
    `"${script}"`,
  ];
  return { commandLine: parts.join(' '), env: childEnv(extra) };
}

/** The first line of a verify run: the lane and its ports. */
const laneSummary = (offset) =>
  `lane: offset ${offset}, ${Object.entries(lanePorts(offset))
    .map(([name, port]) => `${name} ${port}`)
    .join(', ')}`;

/** The API address the app is pointed at for this lane (the emulator serves the function under it). */
const apiBase = (offset) => `http://${HOST}:${lanePorts(offset).functions}/${API_PATH}`;

module.exports = {
  OFFSET_KEY,
  MAX_OFFSET,
  BASE_PORTS,
  parseOffset,
  resolveOffset,
  readOffset,
  lanePorts,
  serverPorts,
  configName,
  laneConfig,
  writeLaneConfigs,
  firebaseBin,
  emulatorExec,
  laneSummary,
  apiBase,
};
