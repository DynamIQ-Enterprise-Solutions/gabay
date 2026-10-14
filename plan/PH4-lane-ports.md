# Plan: each working copy gets its own emulator ports and its own verify lock

> **Version**: 1.0 | **Date**: 2026-10-14 | **Status**: APPROVED by Genesis Perez, 2026-10-14 (no cap on concurrent verifies, design choice C4) | **Decision rows**: none yet (the main session adds the plan.html row) | **Spec**: none (tooling, like `plan/PH1-worktrees.md` and `plan/PH1-verify-lock.md`) | **Source**: the owner's approved delivery-speed plan of 2026-10-14, change 1 ("per-copy ports and a per-copy lock"), rollout step 4, pulled forward ahead of step 3 | **Builds**: api-coder (Sonnet 5.5), tests first | **Review**: dod-reviewer (affected tests) | **Merge**: standing go (L156) once reviewer and CI are green

## Why (evidence)

- The owner's emulator listens now on 127.0.0.1: 5001 (functions), 4400 (hub), 4500 (logging), 9299 (eventarc), 9499 (tasks) (`Get-NetTCPConnection`, 2026-10-14). Every agent's `npm run verify` then fails `seed`, `functions-health` and `tools-tests`: `tools/verify.js:107-110` fixes the ports (`FUNCTIONS_PORTS = [5001, 4400, 4500]`, `SEED_PORTS = [9099, 4400, 4500]`), `withServers` refuses busy ports, and `tools/test/s5-review.test.js:277-302` itself listens on 4400.
- The one machine-wide lock (`tools/lib/verify-lock.js:50`, a file in `os.tmpdir()`) exists only because every copy shares those ports (`plan/PH1-verify-lock.md` VL-2, the 2026-10-08 overlap). Each copy already has its own database (`plan/PH1-worktrees.md` WT-3), so the ports are the only thing left that forces one verify at a time. WT-2 said per-copy ports "can be added later".

## Step 0: the doc check (before any build; the result is pasted into this plan)

| Claim | Status now |
|---|---|
| Ports are set by `emulators.<name>.port` in `firebase.json`; `ui` takes `enabled`/`port`; the hub default is 4400 | CHECKED: firebase.google.com/docs/emulator-suite/install_and_configure, fetched 2026-10-14. That page does not mention `logging`, `eventarc`, `tasks` or `--config`. |
| The function URL is `http://$HOST:$PORT/$PROJECT/$REGION/$NAME`, so a non-default port only changes `$PORT` | CHECKED: firebase.google.com/docs/emulator-suite/connect_functions, fetched 2026-10-14 |
| `-c, --config <path>`; the config schema has `hub`, `logging`, `eventarc`, `tasks` blocks with `host`/`port`; `FIND_AVAILABLE_PORT_BY_DEFAULT` is true for hub, logging, eventarc, tasks (they drift to another port when theirs is taken, so a race between two starting copies is possible unless pinned) | CHECKED in the installed firebase-tools 15.32.1 source (`lib/index.js:16`, `schema/firebase-config.json`, `lib/emulator/constants.js`), not in the docs |
| `emulators:exec` hands the child `FIREBASE_AUTH_EMULATOR_HOST` with the real port, so the seed finds a moved Auth emulator by itself (`db/seeds/lib/accounts.js:9` already reads it) | CHECKED in source (`lib/emulator/env.js`); confirmed in the live run below |
| The hub writes a locator file `hub-<projectId>.json` into `os.tmpdir()`; a second live instance of the same project id only warns "multiple instances ... unexpected behavior" and does not write its own (`lib/emulator/hub.js:158-163`) | CHECKED in source. **This is a risk this plan adds a step for** (see the TEMP choice below). |
| `--config <path>` resolves the project folder (and `functions.source`) the same way as the default `firebase.json` | **RECALLED**: `lib/config.js:23, 253` suggests it follows the config's own folder; the build proves it with a real run before anything else is written |
| The Functions emulator's workers use no further fixed TCP port; Windows excluded ranges leave the scheme's ports free | `netsh int ipv4 show excludedportrange protocol=tcp` shows only port 80 (checked); the worker question is **RECALLED**, proven by the live run |
| Flutter's own startup lock does not serialise `flutter analyze/test` across copies beyond a few seconds | **RECALLED**; measured in the live run |

## What

1. **A lane = a working copy.** Its number is an **offset** added to every default emulator port. The main folder is offset 0 (the defaults; the owner's own commands do not change). Table, fixed in code beside `AGENT_NAMES` (`tools/lib/worktree-names.js`), one slot per agent name:

   | Copy | api-coder | flutter-coder | engine-coder | native-ble | test-verifier | main |
   |---|---|---|---|---|---|---|
   | Offset | 10 | 20 | 30 | 40 | 50 | 0 |

   Ports for offset `o`: functions `5001+o`, auth `9099+o`, hub `4400+o`, logging `4500+o`, eventarc `9299+o`, tasks `9499+o`. Largest used: 5051, 9149, 4450, 4550, 9349, 9549; no two families overlap, none meets a listener seen today (9100, 9102, 4444, 5037, 5040).
2. **Where it is recorded.** `worktree:new` writes `EMULATOR_PORT_OFFSET=<n>` into the copy's git-ignored `.env` (next to `PGDATABASE`; `tools/lib/worktree-env.js` gains `withOffset`, same line-by-line rule). Reading order: the `.env` value; else the table for a copy named after an agent (so the four copies that exist today work with no migration); else 0. `.env.example` gets the key, commented.
3. **Generated configs, git-ignored.** For offset > 0 a helper (`tools/lib/emulator-lane.js`, pure) writes `firebase.lane.json` at the repo root and `db/seeds/firebase.lane.json` (beside the committed ones, so relative paths such as `functions.source` resolve as today); both added to `.gitignore`. They are copies of the committed configs with the six ports shifted; `ui` stays disabled, `singleProjectMode` stays. For offset 0 nothing is generated and the committed configs are used, so the main folder and CI behave exactly as now.
4. **One place builds the firebase command.** The seed and the health check both call it, so the two cannot drift:
   - `tools/verify.js`: `FUNCTIONS_PORTS` / `SEED_PORTS` / `EXPORT_PORTS` come from the lane (all six ports go into the busy/orphan lists; today eventarc and tasks float unwatched); `functionsHealth` adds `--config`; the first line of a run prints `lane: offset 10, ports ...`.
   - `db/seeds/package.json` `seed` becomes `node ../../tools/emulator-seed.js` (a short wrapper that adds `--config` for offset > 0 and runs the same `emulators:exec` line as now). The owner's `npm run seed` in the main folder is unchanged in effect.
   - `tools/health-probe.js` reads its URL from the config the wrapper names in an env var (default: `firebase.json`, as now).
5. **The lock is per lane.** `lockFilePath(root)` returns `gabay-verify.lock` for offset 0 (unchanged name, so the main folder and any run still on old code keep one lock) and `gabay-verify-<offset>.lock` otherwise, in `os.tmpdir()`. The record gains the offset; `LOCK_VERSION` stays 1 (additive). Keyed by the **offset**, not the folder: two folders that ever end up with the same offset share a lock and wait, as today, instead of colliding on ports. That is the guard; two more back it: `worktree:new` refuses an offset another listed copy's `.env` already holds, and a test proves the table is one-to-one. `worktree:new`'s `setup-db` takes its own lane's lock.
6. **Hub locator isolation.** For offset > 0 the wrapper sets `TEMP`/`TMP` for the firebase child to `<copy>/.verify/tmp`, so every copy has its own hub locator and none sees the owner's. (DESIGN CHOICE; see C3.)
7. **Left shared:** PostgreSQL on 5432 (each copy has its own database), the machine's CPU and memory (12 cores, 15.7 GB; the delivery plan caps heavy lanes at 3), the npm and pub caches, and Flutter's SDK startup lock.
8. **The app.** `flutter analyze` and `flutter test` need no emulator and no API URL (`app/test/app_config_test.dart` asserts the default `127.0.0.1:5001/...` as a constant). Running the app against a copy's emulator is `--dart-define=API_BASE=http://127.0.0.1:<5001+o>/demo-gabay/asia-southeast1/api` (the form `INSTALL.md` already shows for 10.0.2.2); `worktree:new` and the verify header print that line. No app code changes.
9. **CI unchanged:** one copy, offset 0, no lock, committed configs.

## Limit worth stating

While the owner's emulator holds the default ports, `npm run verify` **in the main folder** still stops at "Cannot start: port 5001 ... in use" (correct: it is the owner's). Agents verify in their copies, which are unaffected. The main folder's `tools-tests` check stops failing because the tests no longer bind 4400 (below).

## Tests (tests first; each fails before its build)

In `tools/test/` (the `tools-tests` check):
- `emulator-lane.test.js`: offsets resolve in the order `.env`, table, 0; a bad value is an error naming the key; ports for 0, 10 and 50 are exactly the numbers above; the table is one-to-one and no two copies share any of the six ports; generated configs equal the committed ones with only ports changed (and offset 0 generates nothing).
- `verify-lock.test.js` (extended): offset 0 keeps `gabay-verify.lock`; offset 10 and 20 use different files and **both are taken at once**; the same offset waits and prints who holds it; the record carries the offset and old-format records are still read.
- `worktree.test.js` (extended): `worktree:new` writes `EMULATOR_PORT_OFFSET` and nothing else in `.env` changes; it refuses a duplicate offset; `withOffset` keeps every other byte.
- `s5-review.test.js` and any other test that listens on 4400/9099: use a free port from a test helper (listen on 0) and a test seam to tell verify which port to treat as foreign, so no test depends on, or collides with, a real emulator. One-line reason per changed test, named in the report (C1).
- **Integration check, on this machine, output pasted:** with the owner's emulator up, start `npm run verify` in `Gabay-wt\api-coder` and `Gabay-wt\flutter-coder` at the same time (`GABAY_VERIFY_OWNER` set): both reach `seed` and `functions-health` on their own ports and end ALL GREEN, neither prints "busy", the owner's emulator is untouched (its five listeners still there). A third start in the same copy as the first shows the "held by" wait.

## Records (sync table)

CLAUDE.md Commands (verify: per-copy lock and ports, the `EMULATOR_PORT_OFFSET` key, "the emulator ports stay shared" removed) and "Things agents get wrong here" (one line: a copy's emulator uses its own ports; the main folder keeps the defaults, so verify in main stops while the owner's emulator is up); `INSTALL.md` A.5 (ports per copy, the API_BASE line) and A.4 if it names the ports; README; `docs/process/WORKING_AGREEMENT.md` §6 (the verify row: "per lane" instead of "for the machine"; no hook changes, so no other §6 edit); `.env.example`; `.gitignore`; comments in `tools/verify.js:38-49`, `tools/lib/verify-lock.js:1-3`; superseded notes at the top of `plan/PH1-worktrees.md` (WT-2 and point 4) and `plan/PH1-verify-lock.md` (VL-2, the "one lock for the machine" row); the plan.html row (the main session's); `docs/testing` only if it quotes the ports for a copy (the default ports stay true for main).

## Order and who

1. Step 0 (api-coder): the RECALLED rows above with a real `--config` run; results pasted here.
2. Tests (api-coder), all failing.
3. Build `tools/lib/emulator-lane.js`, the wrapper, the `verify.js`/lock/`worktree:new` changes (api-coder; well-defined tooling, Sonnet).
4. Integration check, then records, then dod-reviewer.
5. **Switch while no verify is running**: no `gabay-verify.lock` in `%TEMP%` and no `node tools/verify.js` process. The main session says so in the task prompt; agents mid-run keep the old code until their next rebase, and the old code still uses the legacy lock file and the default ports, so an old-code run plus a new-code run can still collide on 5001 once; the switch time is chosen to avoid that.

## Risks

- **Stale locks.** The legacy file name stays for offset 0, so no old lock is orphaned; new per-offset files are cleared by the existing dead-pid rule. A hub locator `hub-demo-gabay.json` left by a killed emulator is read as dead by firebase (pid check); the owner's live one is not touched.
- **Windows port reuse / TIME_WAIT.** Each lane reuses the same six ports run after run, as the main lane does today; `waitPortsFree` already waits up to 30 s. Excluded ranges: none near the scheme (checked). A new live check: two quick back-to-back runs in one copy.
- **Memory and CPU.** Three verifies plus the owner's emulator on 15.7 GB gave flaky `functions-health` before (delivery plan). The timeouts in `TIMEOUT_MS` stay; no hard cap is added (C4).
- **Eventarc/tasks drift** is removed by pinning, but only if the schema keys are honoured (step 0 proves it).
- **Hub locator warning** if TEMP isolation fails: the live run reads the firebase output for "multiple instances".

## Design choices (each with an alternative)

| # | Choice | Alternative, and when it would be better |
|---|---|---|
| C1 | Fixed offsets by agent name (+10 per copy), `.env` can override | A free-port search per run: no table, but ports change each run, so URLs and the printed `API_BASE` cannot be stable. Better with dozens of copies. |
| C2 | Lock keyed by the port offset | Keyed by folder, as the owner's note suggested: simpler to explain, but two folders sharing an offset would then collide on ports with no wait. Folder keying is better only if offsets can never repeat; the table plus the `worktree:new` check make that true, so the offset key is the safe superset. |
| C3 | Per-copy `TEMP` for the firebase child, to isolate the hub locator | A different `--project` id per copy (`demo-gabay-<name>`): isolates the locator too, but changes every function URL, the Auth emulator's accounts and its export, and the app default. Or leave it and accept the warning, if the live run shows no harm. |
| C4 | No machine-wide cap on concurrent verifies | A counting semaphore of 3 beside the lane locks: protects a 12-core machine, costs a new shared file and more waiting. Better if the live run shows load failures with three copies. |
| C5 | Generated, git-ignored `firebase.lane.json` files | Ports on the command line: I found no per-port flag in the installed CLI (RECALLED, not exhaustively checked). A generated config under `.verify/` is cleaner but depends on the RECALLED path-resolution row. |
| C6 | One wrapper builds the command for seed and health | Duplicate the line in `verify.js`: fewer files, but the owner's `npm run seed` and verify's seed would drift. |

## Questions for the owner

None are product or cost decisions. One thing to know: while your emulator holds the default ports, the **main folder's** own verify will still refuse to start; the agents' copies are what run in parallel.

## Step 0 results (api-coder, 2026-10-14; a real run on lane 10 with the owner's emulator up on the defaults)

Run: `firebase emulators:exec --config firebase.lane.json --only functions --project demo-gabay "node <probe>"` from the repository root, with `TEMP` and `TMP` set to `<copy>\.verify\tmp`, `firebase.lane.json` = `firebase.json` plus `hub` 4410, `logging` 4510, `eventarc` 9309, `tasks` 9509 and `functions` 5011, firebase-tools 15.32.1.

| Row that was RECALLED or checked in source only | Result |
|---|---|
| `--config <path>` resolves `functions.source` and the project folder like the default file | **PROVEN.** The log says `Watching ...\Gabay-wt\api-coder\functions`, `Loaded functions definitions from source: api`, `http function initialized (http://127.0.0.1:5011/demo-gabay/asia-southeast1/api)`; `GET .../api/api/health` answered `200 {"status":"ok","db":"ok"}` with an `X-Request-Id`. |
| `hub`, `logging`, `eventarc`, `tasks` keys pin their ports | **PROVEN.** `Get-NetTCPConnection` during the run: listeners on 4410, 4510, 5011, 9309, 9509 (all one pid, the new emulator) next to the owner's 4400, 4500, 5001, 9299, 9499 (pid 35376), none shared, nothing drifted. |
| The Functions emulator uses no further fixed TCP port | **PROVEN for this run:** the listener list for 4400 to 9600 held only the two lanes' ports plus unrelated programs (4444, 5037, 5040, 9100, 9102). |
| Per-copy `TEMP` isolates the hub locator | **PROVEN.** Two runs and a cold-folder run printed no "multiple instances" warning; `hub-demo-gabay.json` in the real temp folder kept pid 35376 (the owner's) throughout; the copy's `.verify\tmp` held only `node-compile-cache` after the run (the locator is removed on exit). `TEMP in child` printed the copy's folder. |
| `emulators:exec` gives the child the real Auth port | Not exercised by this probe (functions only); **proven in the full verify below**: the `seed` check passed on Auth 9109. |
| Flutter's startup lock does not serialise `flutter analyze/test` across copies beyond seconds | Not measured separately; in the concurrent runs of 2026-10-14 `flutter-analyze` took 34 to 86 s and `flutter-test` 52 to 71 s while other copies ran their own. |

One finding the plan did not foresee: the first run of the probe, and one full verify under heavy load (CPU at 97 per cent, three verifies and Flutter tests on the machine), failed with `Failed to load function definition from source: ... Cannot determine backend specification. Timeout after 10000`. A second run with the same config and a cold temp folder loaded in about 1 s, so it is load, not the lane. firebase-tools reads `FUNCTIONS_DISCOVERY_TIMEOUT` (seconds) to lift that limit (`lib/deploy/functions/runtimes/discovery/index.js:15-17, 53`, and `lib/deploy/functions/runtimes/node/index.js:194` for the emulator). Design choice C7: a Functions run gets 60 s of it (`FUNCTIONS_DISCOVERY_TIMEOUT_S` in `tools/lib/emulator-lane.js`; a value already in the environment wins). Alternative: leave the default and rerun on failure, which the working agreement forbids for a flaky check.

## Changes after the first build (2026-10-14, owner-approved through the main session)

- **Existing test changed (C1): `tools/test/fingerprint.test.js`, "speed: ..."**: its limit goes from 1000 ms to 5000 ms. Reason: with several verifies on one machine (the lanes this plan allows) it failed at 1.4 s and 2.7 s under load; 5 s still catches a real slowdown of what the Stop hook calls. The test passed in isolation. Its title now says "within a few seconds even under load".
- **`worktree:new` sets `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:<9099 + offset>`** in the copy's `.env` (replacing the main `.env`'s 9099 when that has the key, else a line after `EMULATOR_PORT_OFFSET`), so the API in a copy finds its own Auth emulator. Tests: `worktree.test.js` (the writer, CRLF, replace-not-duplicate, a comment is not a setting, and `worktree:new` for api-coder and test-verifier). A copy made before this needs the line changed by hand (INSTALL.md A.5).
