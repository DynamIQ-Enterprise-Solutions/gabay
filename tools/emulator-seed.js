#!/usr/bin/env node
// `npm run seed` (db/seeds) and verify's seed check: the test seed inside the Firebase Auth emulator (L119, P0-02).
// It runs the same `firebase emulators:exec --only auth ... "node --env-file=../../.env seed.js"` as before, built by
// tools/lib/emulator-lane.js so that a working copy's seed uses its own lane (plan/PH4-lane-ports.md): the copy's Auth
// emulator is on 9099 + its offset and the seed finds it through FIREBASE_AUTH_EMULATOR_HOST, which emulators:exec sets.
// In the main folder (offset 0) the command is exactly the old one. Exit code: the seed's own.
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readOffset, firebaseBin, emulatorExec, laneSummary } = require('./lib/emulator-lane');

const ROOT = path.resolve(__dirname, '..');
const SEEDS = 'db/seeds';

function main() {
  const offset = readOffset(ROOT);
  const { commandLine, env } = emulatorExec({
    root: ROOT,
    offset,
    dir: SEEDS,
    bin: firebaseBin(ROOT),
    only: 'auth',
    script: 'node --env-file=../../.env seed.js',
    extraArgs: ['--import', './.emulator-data', '--export-on-exit', './.emulator-data'],
  });
  if (offset > 0) console.log(laneSummary(offset));
  // shell:true starts firebase.cmd on Windows; the command line is built from constants and the folder, never from input
  const r = spawnSync(commandLine, {
    cwd: path.join(ROOT, SEEDS),
    env,
    stdio: 'inherit',
    shell: true,
  });
  return r.status ?? 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
