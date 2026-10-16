# Gabay — INSTALL.md

> **Version**: 0.3 | **Date**: 2026-10-15 | **Status**: Phase 1 (rails built, S0–S7; synced at the S8 gate); 0.3: SEC-1 (no stub; the two sign-in modes, A.6). First written as the Phase 0 stub (standard §2; plan.html L115) | **Audience**: developers bringing up a machine | **Scope**: development environment; deployment is in `docs/ops/DEPLOYMENT_RUNBOOK.md`

## Which path?

| You want to… | Go to |
|---|---|
| Develop on your own machine (the only supported setup today, L109) | **A. Local development** |
| Deploy to Firebase | `docs/ops/DEPLOYMENT_RUNBOOK.md`, and only on the product owner's call |
| Use Docker | Not supported. No Docker setup exists; local PostgreSQL is installed natively |
| Host for several mall operators | Not a separate install: one deployment serves every tenant (Blueprint §2.6) |

## A. Local development

Order: A.2 (tools and the repository), then A.1 (the database), A.1b (the seed), A.1c (the API), A.3 (the app), A.4 (the full check).

### A.1 The database

1. **PostgreSQL 18.6** (Blueprint Part 1 pin; Cloud SQL's default major, L115). On Windows:
   ```powershell
   winget install --id PostgreSQL.PostgreSQL.18 --exact --source winget
   ```
   Port 5432, user `postgres`. Put the password you choose in your own `.env` (`PGPASSWORD`), never in a committed file.
2. **Create the database and check the schema** (it must run twice with no errors):
   ```sh
   psql -U postgres -h localhost -c "CREATE DATABASE gabay_dev"
   psql -U postgres -h localhost -d gabay_dev -v ON_ERROR_STOP=1 -f db/schema.sql
   psql -U postgres -h localhost -d gabay_dev -v ON_ERROR_STOP=1 -f db/schema.sql
   ```
   Expected (schema 0.16, 2026-10-15): both exit 0; 58 tables, 136 indexes, 2 triggers in schema `gabay`.

### A.1b The local test seed (built early, L120)

```sh
cd db/seeds
npm ci               # pg 8.23.1 and firebase-tools 15.32.1 (exact versions, committed lockfile)
npm run seed         # starts the Auth emulator (Node, no Java needed); fill PG* and SEED_PW_* in .env first
```

It creates the two test tenants, their venues and the six `@gabay.test` accounts; see `db/seeds/README.md`. Put your spike exports in `db/seeds/sources/spike-exports/` and run it again. The exports are git-ignored (like `sources/internal/`) and copied into no working copy; an export the seed cannot use is skipped with one line naming it and why, and the rest is seeded. After a publish, `npm run seed` stops before writing anything and tells you the way out: `npm run setup-db`, then `npm run publish:dev -- <TENANT_CODE> --all` (FF-3).

### A.1c The API and the database tools (Phase 1, slice S2)

Node 22 is required (see A.2 for fnm). Fill `.env` from `.env.example` first (the `PG*` keys are required; the API stops at start-up and names any missing key).

```sh
cd functions && npm ci && cd ..      # the API's pinned packages (exact versions, committed lockfile)
cd db/tools && npm ci && cd ../..    # the database scripts' own packages (pg 8.23.1)

npm run api:test      # the API tests (node --test) against the local gabay_dev; they create only TEMP tables
npm run api:lint      # ESLint and Prettier check; both exit non-zero on a violation
npm run setup-db      # dev mode: db/schema.sql -> db/migrations -> the test seed (no Java needed). RESETS gabay_dev
npm run setup-db -- --bootstrap     # schema -> reference seed (platform lookups, roles) -> tenant provisioning (Phase 2)
npm run migrate       # apply db/migrations in order (none exist yet; it says so and exits 0)
```

`setup-db` options: `--stop-on-error`, `--skip-schema`, `--skip-migrations`, `--skip-seed`. It prints the schema's table, index and trigger counts (expected 58, 136, 2; schema 0.16), then each migration's verification row. The API tests need a schema in `gabay_dev`; `setup-db` creates it.

To run the API in the Functions emulator (no Firebase project, nothing is deployed):

```sh
db/seeds/node_modules/.bin/firebase emulators:start --only functions --project demo-gabay
curl http://127.0.0.1:5001/demo-gabay/asia-southeast1/api/api/health     # {"status":"ok","db":"ok"}
```

Those are the main folder's ports. A coder's working copy has its own (A.5): the same numbers plus its `EMULATOR_PORT_OFFSET`, for example 5011 for `api-coder`; to start it by hand, run this from the copy's root (PowerShell) after `npm run verify` or `npm run seed` has generated `firebase.lane.json` (git-ignored); the temp folder is the one the tooling gives the emulator, so the hub's locator file is not shared with the owner's emulator (the plan's C3: without it firebase prints the "multiple instances" warning):

```powershell
New-Item -ItemType Directory -Force .verify\tmp | Out-Null
$env:TEMP = $env:TMP = "$PWD\.verify\tmp"      # this terminal only; open a fresh one afterwards
db\seeds\node_modules\.bin\firebase.cmd emulators:start --config firebase.lane.json --only functions --project demo-gabay
```

### A.2 Tools and the repository (do these first)

1. **Node.js 22** (Blueprint Part 1; the Cloud Functions runtime). On Windows, install fnm (`winget install Schniz.fnm`), run `fnm install 22`, and add `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression` to your PowerShell profile. The repository's `.nvmrc` then selects Node 22 inside it and leaves your default Node elsewhere (L124). In Git Bash, call fnm by its full path and use `npm.cmd`:
   ```sh
   "$LOCALAPPDATA/Microsoft/WinGet/Links/fnm.exe" exec --using=22 -- npm.cmd run verify
   ```
2. **Flutter 3.47.5** (Dart 3.13; the patch CI installs) with the Android SDK (API 24–37). Xcode on the team's Mac for iOS (P1-05).
3. **Enable the git hooks**, once per clone (pre-commit: the secret guard, the changelog-duplicate guard and the structural linters on the staged files, then the app's version bump and changelog stamp when a commit touches the shopper app or the admin page, L129; pre-push: the full `npm run verify`, except for a docs-only push, L187):
   ```sh
   git config core.hooksPath .githooks
   ```
4. **The environment file:** copy `.env.example` to `.env` and fill it in: the `PG*` keys for your local PostgreSQL and every `SEED_PW_*` for the six test accounts. Keep `NODE_ENV=development` as `.env.example` has it: the Auth-emulator guard refuses `FIREBASE_AUTH_EMULATOR_HOST` unless `NODE_ENV` is written explicitly as `development` or `test`. There is no development stub (SEC-1): every admin request signs in with a Firebase ID token and names its tenant in `X-Tenant-Id`. By default the API checks tokens against the Auth emulator (the seeded `@gabay.test` accounts); A.6 is the owner's switch to the real Firebase project. `.env` is never committed (the pre-commit hook refuses it).
5. **The Firebase Emulator Suite** comes with `firebase-tools` 15.32.1 in `db/seeds` (A.1b); there is no global install. Projects are local only (`demo-gabay`). RECALLED: how far the emulators cover SQL Connect and scheduled functions; checked when a feature first needs them (Blueprint §2.6).

### A.3 The Flutter app (`app/`, slice S3)

One Flutter project, two entry points (Blueprint §2.3). Run everything from `app/`; there is no Node step.

```sh
cd app
flutter pub get
flutter analyze                       # must print "No issues found!"
flutter test                          # every unit and widget test

# Shopper app (phone or emulator). Debug builds call the local Functions emulator.
flutter run -t lib/main_mobile.dart
#   Android emulator: reach the host as 10.0.2.2, not 127.0.0.1:
#   flutter run -t lib/main_mobile.dart --dart-define=API_BASE=http://10.0.2.2:5001/demo-gabay/asia-southeast1/api
#   Against a working copy's emulator, use its port (5001 + its EMULATOR_PORT_OFFSET; `npm run verify` prints the line).

# Admin web page (path URLs, no #). The page signs in (SEC-3): with none of the Firebase values below, a debug or
# profile build uses the Auth emulator and the demo project `demo-gabay` (the seeded @gabay.test accounts; the emulator
# runs during `npm run seed` and `npm run verify`, or start it yourself). A working copy names its own emulator port:
flutter run -d chrome -t lib/main_admin.dart
#   a working copy (Auth emulator on 9099 + its EMULATOR_PORT_OFFSET, A.5):
#   flutter run -d chrome -t lib/main_admin.dart --dart-define=AUTH_EMULATOR=127.0.0.1:9119
#   against the real Firebase project (the product owner only, A.6): the five web config values, from a file that is
#   never committed (app/config/*.local.json is git-ignored; copy app/config/firebase.example.json):
#   flutter run -d chrome -t lib/main_admin.dart --dart-define-from-file=config/firebase.local.json
#   Some of the five values and not all is refused at start, naming the missing keys; a release build with none is
#   refused too and never connects to an emulator.

# Test-rendered screenshots: the shopper shell, light and dark, phone and tablet, plus the About page and the message banners (10 PNGs)
flutter test test/screenshot_test.dart --dart-define=SHOTS_OUT=<an existing folder outside the repo>

# Test-rendered screenshots of the admin page and the shopper tabs (FF-SK, SEC-3): the sign-in screen (empty, wrong password), the no-access and account-error screens, each account's dashboard, the account menu, /unauthorized, the empty dashboard, a placeholder, the drawer and the shopper tabs, light and dark, phone and tablet (58 PNGs)
flutter test test/dashboard_screenshot_test.dart --dart-define=SHOTS_OUT=<an existing folder outside the repo>

# Test-rendered screenshots of the venue screens (FF-1, trimmed in 2b): the venue list and the venue form, light and dark, phone and tablet (8 PNGs)
flutter test test/venues_screenshot_test.dart --dart-define=SHOTS_OUT=<an existing folder outside the repo>

# Builds. A release build REQUIRES --dart-define=API_BASE=<https url>; without it the app refuses to start.
# The admin page's release build also REQUIRES all five Firebase values (--dart-define-from-file=<file>), SEC-3.
flutter build web -t lib/main_admin.dart --dart-define=API_BASE=<https url> --dart-define-from-file=<file>
flutter build apk --debug -t lib/main_mobile.dart
```

Build stamps come from `--dart-define` (`APP_VERSION`, `BUILD_NUMBER`, `GIT_COMMIT`, `BUILD_TIME`); a plain `flutter run` shows the committed fallbacks. Android: `minSdk 24`, applicationId `com.dynamiqes.gabay`. iOS: deployment target 15.0 (Xcode project and `ios/Podfile`); iOS builds need the team's Mac.

### A.4 The full check

Run from the repository root before reporting any work done (CLAUDE.md, WORKING_AGREEMENT). It runs every check in order and ends `ALL GREEN`; the exit code is the number of failures. A failing check's whole output is kept in `.verify/logs/<check>.log`. One run at a time per lane (each working copy has its own emulator ports and database, A.5; the main folder is lane 0, the default ports): a second run in the same lane waits (up to 15 minutes, `GABAY_VERIFY_LOCK_WAIT_MS`) and names who holds it. The first line of a run names the lane.

```sh
npm run verify              # everything: linters and their tests, ESLint, Prettier, the API and tool tests,
                            # db/schema.sql twice, the seed's tests, the seed, the Functions emulator health, flutter analyze, flutter test
npm run lint:structural     # the twelve structural linters (rules 2, 3, 4, 6, 7 and more)
npm run lint:test           # the linters' own tests
npm run tools:test          # tests for verify, the hooks and the CI guards
npm run test:schema-forms   # the schema-to-form drift linter alone
npm run ci:guards           # CI's secret and changelog-duplicate guards
npm run api:test            # the API tests (A.1c)
npm run api:lint            # ESLint and Prettier on functions/ (A.1c)
npm run setup-db            # schema -> migrations -> seed; RESETS gabay_dev (A.1c)
npm run migrate             # apply db/migrations (A.1c)
npm run seed                # the test seed (A.1b)
npm run seed:test           # the seed's own tests: what it writes, in rolled-back transactions (A.1b; needs the schema)
npm run worktree:new -- <name>      # a coder's working copy and database (A.5)
npm run worktree:remove -- <name>   # remove it and drop its database (A.5)
```

The pre-push hook runs `npm run verify`, so a push takes two to five minutes (108 s to 261 s measured in S7 and S8). A push whose every changed path is a document (`*.md`, `plan.html`, `docs/`, `plan/`, `spec/`, `intent/`, `phase-reports/`) skips it and prints "pre-push: docs-only push (N files), verify skipped"; CI lint and e2e still gate every merge (L187).

### A.5 Coder working copies

Each coder agent (`api-coder`, `flutter-coder`, `engine-coder`, `native-ble`, `test-verifier`) works in its own copy of the repository, so branches, files and the database never collide with the main folder or another coder (plan/PH1-worktrees.md). Run these in the **main folder** (not inside a copy), with Node 22, PostgreSQL running and the main `.env` filled in:

```sh
npm run worktree:new -- api-coder              # branch wt/api-coder/<date> from the fetched origin/main
npm run worktree:new -- api-coder my-branch    # or on a named branch (an existing one is checked out as it is)
npm run worktree:remove -- api-coder           # refuses a copy with uncommitted changes
npm run worktree:remove -- api-coder --force   # removes it anyway
```

`worktree:new` fetches `origin`, adds a git worktree in `..\Gabay-wt\<name>` (a sibling of the main folder), writes that copy's own `.env` (the main one with `PGDATABASE` changed to `gabay_wt_<name>`, hyphens turned into underscores, and two lines set after it: `EMULATOR_PORT_OFFSET` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:<9099 + offset>`, the copy's own Auth emulator; no value of the main `.env` is printed), creates the database if it is missing, copies `db/seeds/sources/internal/` from the main folder when it is there (it stays git-ignored and is never committed), runs `npm ci` in `functions/`, `db/tools/` and `db/seeds/` and `flutter pub get` in `app/`, then `npm run setup-db` (under the copy's lane lock, because the seed starts the Auth emulator on the lane's ports). `worktree:remove` removes the worktree and drops the database; the branch and its commits stay. Each copy holds its own `node_modules` and build folders, so allow disk for each one. The default branch `wt/<name>/<date>` is reused when it already exists (a second copy of the same name on the same day picks up the kept branch). `test-verifier` works in the coder's copy of the work it tests by default, and has a copy of its own only when the task says so. The Claude Code Stop hooks always check the main folder and also the working copy the shell is in. The git hooks run in every copy (`core.hooksPath` is shared); `npm run verify` in a copy runs against that copy's database and its own emulator ports, and waits only for another run in the same lane.

**Emulator lanes (plan/PH4-lane-ports.md).** Each copy's emulators use the default ports plus an offset, so copies run side by side and the owner's own emulator in the main folder (offset 0, the defaults) is never touched:

| Copy | main | api-coder | flutter-coder | engine-coder | native-ble | test-verifier |
|---|---|---|---|---|---|---|
| `EMULATOR_PORT_OFFSET` | 0 | 10 | 20 | 30 | 40 | 50 |
| functions / auth | 5001 / 9099 | 5011 / 9109 | 5021 / 9119 | 5031 / 9129 | 5041 / 9139 | 5051 / 9149 |

The hub (4400), logging (4500), eventarc (9299) and tasks (9499) ports shift by the same offset (a whole number from 0 to 99: the base ports are at least 100 apart). `worktree:new` writes the offset into the copy's `.env` (it refuses an offset another copy already holds); a copy made earlier without the line uses the table above by its folder name. `npm run verify` and `npm run seed` generate `firebase.lane.json` and `db/seeds/firebase.lane.json` (git-ignored) for an offset above 0 and give the firebase command its own temp folder (`.verify/tmp`) so the hub's locator file is not shared. To run the app against a copy's emulator: `--dart-define=API_BASE=http://127.0.0.1:<5001+offset>/demo-gabay/asia-southeast1/api`; the copy's `.env` already names its Auth emulator (`FIREBASE_AUTH_EMULATOR_HOST`, set by `worktree:new`); a copy made earlier needs that line changed by hand to `127.0.0.1:<9099+offset>`. Still shared: PostgreSQL (one database per copy), the CPU and memory, the package caches.

### A.6 Signing in against the real Firebase project (the product owner only; SEC-1, L186)

The Firebase project exists on the free Spark plan for real sign-in only: the API and the database stay on this machine and nothing is deployed (L186). The emulator stays the path every automated test uses; agents never create, hold or read the project's credentials. To point the local API at the real project (the manual case SEC1.20):

1. **The key.** In the Firebase console, Project settings → Service accounts → Generate new private key. Save the file **outside the repository** (for example `C:\Users\<you>\.gabay-keys\gabay-staging.json`); never commit, print or share it. The revocation check the API makes on every request is an Admin API call that needs it (SEC-1 step 0 (a)); without it every request answers 503 "Authentication service unavailable".
2. **The `.env`.** Set `FIREBASE_PROJECT_ID=<the project's id>`, set `FIREBASE_AUTH_EMULATOR_HOST=` to **empty** (with both set, the emulator wins), and set `GOOGLE_APPLICATION_CREDENTIALS=<the absolute path of the key>` (a relative path would be read from whatever folder the API starts in). At start the API logs `auth: Firebase project <id>`.
3. **A user.** Create the person in the console (Authentication → Users → Add user, email and password; sign-up stays off). The six seeded accounts exist only in the emulator.
4. **Their Gabay account, by SQL** on the local database (until DEP-0's operator tool and R6's admin API exist): an `AppUser` row whose `FirebaseUid` is the console user's UID, then `UserRole` rows for their tenants (`SUPERADMIN` with `TenantId` NULL for the platform admin). A Firebase user with no `AppUser` row is refused 403 "This account has no access".
   ```sql
   INSERT INTO gabay.AppUser (FirebaseUid, Email, DisplayName) VALUES ('<uid from the console>', '<email>', '<name>') RETURNING UserId;
   INSERT INTO gabay.UserRole (UserId, RoleId, TenantId)
     SELECT <UserId>, RoleId, <TenantId> FROM gabay.Role WHERE Code = 'MALL_ADMIN';
   ```
   A VENUE_EDITOR or VIEWER also needs a `gabay.UserVenueGrant` row per venue it may see (MALL_ADMIN and SUPERADMIN are tenant-wide). A reseed (`npm run seed`, `npm run seed:db-only`) rebuilds the tables and removes these rows: repeat this step afterwards (EC-50).
5. **The admin page (SEC-3).** In the Firebase console, open the project's "Gabay admin" web app and copy its five config values into `app/config/firebase.local.json`, **on your own machine** (copy `app/config/firebase.example.json`; the file is git-ignored, and no agent opens it). Then run the page against the real project:
   ```sh
   cd app
   flutter run -d chrome -t lib/main_admin.dart --dart-define-from-file=config/firebase.local.json
   ```
   The page and the API must be on the same pair: the page with the real project's values goes with the API running `FIREBASE_PROJECT_ID=<id>` and an empty `FIREBASE_AUTH_EMULATOR_HOST` (step 2); the page with no values (the emulator) goes with the API on the emulator host. A mixed pair makes every request answer 401, and a fresh sign-in then shows "This account cannot sign in right now" (EC-51). In the console (Authentication → Settings → User actions) switch off "Enable create (sign-up)": the page has no sign-up, and this stops one being made from outside.
   Without the page, `accounts:signInWithPassword` with the project's web API key (as `db/seeds/lib/accounts.js` does against the emulator) gives an ID token for a direct API call with `Authorization: Bearer <idToken>` and `X-Tenant-Id: <TenantId>`. A grant or role changed by SQL is seen within 30 s (the access cache).

To go back to the emulator, restore `FIREBASE_AUTH_EMULATOR_HOST`, empty the other two, and run the page without `--dart-define-from-file`.

## Gotchas

- The schema's first teardown run prints "does not exist, skipping" notices; they are not errors.
- Only the product owner points a local setup at the real Firebase project, for sign-in only (A.6, L186); nothing is deployed until the owner's Blaze call, and agents and the automated tests use the emulator.
