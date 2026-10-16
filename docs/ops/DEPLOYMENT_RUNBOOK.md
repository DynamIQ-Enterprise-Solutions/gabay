# Gabay — Deployment Runbook

> **Version**: 0.2 | **Date**: 2026-10-16 | **Status**: Phase 0 stub (standard §2; plan.html L115), with DEP-0's staging section (spec/DEP-0.md r2, plan/DEP-0.md 1.0) | **Audience**: whoever deploys, on the product owner's call | **Scope**: reusable per environment; the per-release deploy plan is separate and dated

**⚠️ No deploy of any kind while EXCEPTIONS E-20 is open (L153), except staging, and no staging deploy before the owner's Blaze call.** E-20 as amended by L184 allows one private, admin-only staging project (`gabay-staging`, Singapore), deployed by CI from `main` once SEC-1 to SEC-3 and DEP-0 are merged and their staging check is shown. L186 sets the state today: the project is on the **Spark plan for Firebase Auth alone**; the API, the database and the admin page run on this machine; no function, database, bucket or Hosting deploy exists, and none is made before the owner calls Blaze. Production is a separate project and a separate, named call.

**⚠️ Nothing in this runbook that writes to a cloud resource is run until the product owner calls it (L109).** Until then everything is local (INSTALL.md). Every step that writes to a cloud resource carries a ⚠️ and needs the release approval named in the deploy plan. Agents never run `firebase deploy` and never hold cloud credentials.

The standard's runbook phases assume a VM; Gabay runs on Firebase (L98), so the phases map as below.

| # | Standard phase | Gabay | State |
|---|---|---|---|
| 1 | Prerequisites | A Google Cloud / Firebase project in `asia-southeast1`; `firebase-tools` 15.x; Node 22; two named Owners (L93) | **Staging (L184, L186):** `plan/DEPLOY-staging.md` §3. Project `gabay-staging` (fallback `gabay-staging-dq`) under the owner's Dynamiq account, created 2026-10-15 **on Spark** with Email/Password on and sign-up off. The Blaze plan, with a card and a budget alert at USD 5, comes at the owner's call; a second Owner may be added later. Production: decided at the deploy call (L117) |
| 2 | Layout | Firebase Hosting (admin web page), one Cloud Function (`api`, Express, `maxInstances = 1`), Cloud SQL for PostgreSQL 18 via SQL Connect, one private Cloud Storage bucket, Firebase Auth | Decided (L98) |
| 3 | Build | `flutter build web -t lib/main_admin.dart --release --dart-define=API_BASE=<function URL>/api` for the admin (the release guard in `app_config.dart` refuses a missing or local address); the function bundle | Phase 1; DEP-0 documents the command (AC-50) |
| 4 | Database + least-privilege login | Two logins: `gabay_migrate` (CI; owns the schema) and `gabay_api` (the function; the grants below). `npm run db:deploy` applies schema (empty database only), migrations, reference data, grants; `-- --init-roles` makes the logins | **Built and proven on a throwaway local database (DEP-0).** The instance and the first run on it are DEP-1's |
| 5 | Environment | `functions/.env.<projectId>` with the non-secret values (the env table below); the one secret (`PGPASSWORD`) in Secret Manager; `CORS_ORIGINS` lists the two Hosting origins (E-05) | **Written and tested locally (DEP-0)**; the deployed load is DEP-1's first deploy |
| 6 | Reverse proxy | None: Hosting rewrites serve the admin page; the API is called at its own address (E-05; the 60 s Hosting rewrite limit) | Decided |
| 7 | TLS | Managed by Firebase and Google Cloud. Firebase Hosting overwrites `Strict-Transport-Security` on its own subdomains (`*.web.app`; firebase.google.com/docs/hosting/full-config, read 2026-10-16), so Gabay writes none; the staging check reads the header (item 1). The connector to Cloud SQL adds its own TLS (E-29) | Decided; confirmed at DEP-1 |
| 8 | Service supervisor, log rotation | Managed by Cloud Functions and Cloud Logging | — |
| 9 | Firewall | Cloud SQL: public IP, no authorised networks; reached through the connector (its TLS and IAM, E-29) or the Auth Proxy (the owner's tools). The function's ingress is the default | Written (DEP-0); proven at DEP-1 |
| 10 | Verify | `GET /api/health`, then `docs/testing/Smoke_Test_Guide.md`; staging: `docs/ops/STAGING_CHECK_TEMPLATE.md` | Phase 1; the template is DEP-0's, filled at DEP-1 |
| 11 | Operations | Cloud SQL backups (off on staging by ruling); canary by deploying to a preview first | Phase 1 |

## Staging (`<projectId>`)

### Current state, 2026-10-16 (L186: Spark first)

- **The project** (`gabay-staging`, or the fallback `gabay-staging-dq` if that was taken, L186) is on the **Spark** plan, used for **real Firebase Auth only**. Everything else runs on this machine: the API (INSTALL.md A.6), the database, the admin page. **No function, database, bucket or Hosting deploy exists.** Spark does not list Cloud Functions (firebase.google.com/pricing, read 2026-10-16: invocations "Not applicable"), and the SQL Connect trial instance is **archived if the project is not upgraded** by the end of its 3-month trial (and deleted 90 days later; same page).
- **What DEP-0 built, locally, with no cloud resource:** the Cloud Storage file store over a fake bucket, the two connection modes (the connector with a fake), the two logins and their grants on a throwaway database, `db:deploy`, `staging:admin` (with `--local-db`), `staging:seed`, the secret and environment, the Functions-path fixes, the Hosting block and its tests. **What needs a real resource moves to DEP-1's first deploy under Blaze:** the socket-versus-connector spike, the real-bucket run (`npm run gcs:check`), the instance, the secret's creation, the deployed environment load, the 15 MB upload, the cold-start time, the Hosting headers on the real page, the staging check.
- **The one real-Firebase proof now** is the owner's: `npm run staging:admin -- <email> SUPERADMIN --local-db` (and a tenant-scoped role) against the Spark project's Auth and the **local** seeded database (INSTALL.md A.7; AC-58).

### The project and region

Project `<projectId>` (L184, L186), region `asia-southeast1` (Singapore) for the function, the instance and the bucket. Two origins are the admin page's: `https://<projectId>.web.app` and `https://<projectId>.firebaseapp.com` (E-05). They, the function's address in the Hosting policy, the file name `functions/.env.<projectId>` and the instance connection name all follow the project id; the tests take the first three from one constant (`tools/lib/staging.js`), so a fallback id changes them together (EC-27).

### The instance (filled at DEP-1)

| What | Value |
|---|---|
| Name, size, public IP | to fill: the smallest shared-core size, no SLA (`plan/DEPLOY-staging.md` §3) |
| Where it came from | Firebase SQL Connect's trial instance (Q4 (b)); Gabay still talks to it with raw `pg` (E-06, E-07) |
| Trial start and end | to fill; the owner decides to keep, downsize or stop it **before** the trial ends |
| Admin login and its rights, the stop control | to confirm at DEP-1 (the docs read 2026-10-16 cover the trial terms only: plan/DEP-0-step0.md row 4) |

### The two logins and their grants

Created once by the owner, with the instance's admin login, through the Auth Proxy: `npm run db:deploy -- --init-roles`, with `GABAY_MIGRATE_PASSWORD` and `GABAY_API_PASSWORD` in the environment (never an argument, never printed). Safe to run again: it sets both passwords again, so it is also how one is rotated. **Keep the server's `log_statement` off (`none` or `mod`) while it runs:** under `ddl` or `all` the server writes `ALTER ROLE ... PASSWORD` to its own log (PostgreSQL 18 docs, runtime-config-logging, read 2026-10-16).

| Login | Used by | Attributes | Rights |
|---|---|---|---|
| `gabay_migrate` | CI (`db:deploy`), through its federated identity (DEP-1); never bound to the function | login only: no superuser, no CREATEDB, no CREATEROLE | `CONNECT` and `CREATE` on the database; it creates and **owns** schema `gabay` and everything `schema.sql` and the migrations make |
| `gabay_api` | the function; its password is the secret `PGPASSWORD` | login only | `CONNECT` on the database; `USAGE` on schema `gabay`; `SELECT`, `INSERT`, `UPDATE`, `DELETE` on every table in `gabay` **except `AuditLog`: `SELECT` and `INSERT` only**; default privileges for tables a later migration makes; **nothing else** (no `TRUNCATE`, `REFERENCES`, `TRIGGER`, no `CREATE` on the database, `gabay` or `public`, no sequence privilege: an `INSERT` into an identity column needs none) |

The grants are `db:deploy`'s last step, idempotent, and are not in `schema.sql` or a migration (the logins exist only on a deployed instance). The Frozen Package trigger still refuses an `UPDATE` of a `PUBLISHED` version for `gabay_api` (`db/tools/test/dep0.roles.test.js` shows each row of this table by connecting as each login).

### `db:deploy`, `staging:admin`, `staging:seed`

Run by the owner (CI runs only `db:deploy`), with the **process environment** only: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. None of them reads the repository's `.env`.

- **Now, on this machine:** `npm run staging:admin -- <email> <role> [<tenant code>] --local-db`, with `STAGING_PROJECT_ID=<projectId>`, the local `PG*` and your own Google login (`gcloud auth application-default login`; no key file, `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_AUTH_EMULATOR_HOST` unset). INSTALL.md A.7 has the steps. It creates the Firebase user with **no password** and prints a one-time password-setup link, once; the link is never written anywhere, and a re-run prints a fresh one.
- **At DEP-1, through the Auth Proxy** (`cloud-sql-proxy` v2.26.2 at the time read, with your own login and `roles/cloudsql.client`; docs.cloud.google.com/sql/docs/postgres/sql-proxy): `npm run db:deploy -- --init-roles` once; `npm run db:deploy` (CI does this on every merge); `npm run staging:admin -- <email> <role> [<tenant code>]` (no flag: the deployed database; a local database name is refused); `npm run staging:seed` once (create-only: it makes the tenant `DEMO_MALLS` and its four invented venues and refuses if it exists; it writes no account). **Venue grants:** a VENUE_EDITOR or VIEWER gets a grant for every venue the tenant has at that moment; run `staging:admin` again after a venue is added (MALL_ADMIN and SUPERADMIN see every venue and need none).
- **`db:deploy` on a database that fails its first run** (a migration error after the schema was applied) leaves tables with no reference data, and the next run, seeing tables, does not seed. Staging is forward-only: fix the migration forward, or drop and re-create the database and run again.
- **Never against staging:** `npm run setup-db` (it drops every table), `npm run seed` and `seed:db-only` (they delete and re-create tenants and accounts). `setup-db` and the dev seed refuse any database that is not `gabay_dev` or `gabay_wt_<name>` and print the one line naming `db:deploy`; a CI deploy workflow that runs `setup-db`, a seed or a `staging:` script fails `tools:test` (AC-45).

### The secret

One secret, `PGPASSWORD`, bound to the function with `defineSecret` (`functions/index.js`): `gabay_api`'s password, created by the owner in Secret Manager at DEP-1. The function's service account needs `roles/secretmanager.secretAccessor` on that secret (docs.cloud.google.com/iam/docs/roles-permissions/secretmanager, read 2026-10-16). `gabay_migrate`'s password is **never** bound to the function. The Functions emulator is not given the secret (a declared secret makes firebase-tools ask Secret Manager for it): locally the password comes from `.env`. **A rotated secret reaches the function only when an instance starts again, which is a redeploy** (firebase.google.com/docs/functions/config-env, read 2026-10-16). **Rotation order:** (1) `npm run db:deploy -- --init-roles` with the new `GABAY_API_PASSWORD`, (2) the new secret version, (3) redeploy promptly; the old instance fails to log in until the new one starts (a few failed requests on staging are accepted, EC-19).

### The environment table

`functions/.env.<projectId>` (git-ignored; the pre-commit and CI secret guards refuse any tracked `.env.<name>`) holds **non-secret values only**. It lists **no password** and **no key that starts with `FIREBASE_`** (Firebase reserves that prefix, with `X_GOOGLE_`, `EXT_` and a list of runtime names: firebase.google.com/docs/functions/config-env, read 2026-10-16). `NODE_ENV` is written explicitly (the docs do not say what the runtime sets): there is **no boot refusal** for a wrong or missing value (Q7 (b), L151). `tools/test/dep0.envTable.test.js` reads the block below and checks that every key is one the config reads, that none is reserved, that none is a password, that the block parses as a valid staging config, and that `functions/.env.gabay-staging` and `.env.gabay-staging-dq` are git-ignored.

```env-table
NODE_ENV=production  # written explicitly: the runtime's own value is not documented; the emulator-host and rate-limit guards read it
LOG_LEVEL=info  # the default, written so a deploy shows it
CORS_ORIGINS=https://gabay-staging.web.app,https://gabay-staging.firebaseapp.com  # the two Hosting origins of the project id (E-05)
TRUST_PROXY_HOPS=1  # Google's front end is one hop; confirmed by the staging check's address line (F3)
MAX_JSON_BODY=5mb  # the API's own limit; the platform reads a whole body up to 32 MB before any guard runs
PG_POOL_MAX=1  # Google's advice for a function with one instance; a long statement then blocks other requests (EC-9)
PG_IDLE_TIMEOUT_MS=30000  # the default
PG_CONNECT_TIMEOUT_MS=10000  # PROVISIONAL: room for the connector's handshake on a cold start (AC-18); raised here, never in the code, if the cold start is longer
PG_STATEMENT_TIMEOUT_MS=60000  # the default: publishes run long
PGDATABASE=gabay  # PROPOSED name; DEP-1 confirms the SQL Connect database name
PGUSER=gabay_api  # the function's login, not the admin
CLOUD_SQL_INSTANCE=gabay-staging:asia-southeast1:gabay-db  # PROPOSED instance name; connector mode (E-29). Under the socket, PGHOST=/cloudsql/<instance> replaces it
FILE_STORE=gcs  # left at local, a deploy starts but its uploads go to the function's disk and are lost: read the start-up line
GCS_BUCKET=gabay-staging-files  # PROPOSED bucket name; DEP-1 creates it private, uniform access, asia-southeast1
```

Never in the table: `PGPASSWORD` (the secret), `FIREBASE_PROJECT_ID` and `FIREBASE_AUTH_EMULATOR_HOST` (local only; on the deployed function both are unset and the Admin SDK takes the project from the runtime), `GOOGLE_APPLICATION_CREDENTIALS`, `FUNCTIONS_EMULATOR` (set by the emulator, never by hand: a deploy that set it would lose its secret binding), `RATE_LIMIT` (`off` is refused outside development and test). The rate limits keep their defaults.

### The bucket

One private Cloud Storage bucket in `asia-southeast1`, **uniform bucket-level access, public access prevention enforced** (docs.cloud.google.com/storage/docs/public-access-prevention, read 2026-10-16), created at DEP-1 (a bucket needs Blaze). The store never makes an object public and never signs a URL; every read goes through an API route that checks the tenant. The function's service account holds **`roles/storage.objectUser` on this bucket only** (create, read, update and delete objects: the narrowest role that covers the store's four calls; `objectCreator` cannot read or delete: docs.cloud.google.com/iam/docs/roles-permissions/storage, read 2026-10-16). It also needs `roles/cloudsql.client` (docs.cloud.google.com/iam/docs/roles-permissions/cloudsql, read 2026-10-16). Keys are `backdrops/<tenantId>/<venueId>/<key>` and `packages/<tenantId>/<venueId>/v<n>-<sha256>.<ext>`. The real-bucket run is `GCS_BUCKET=<bucket> npm run gcs:check` (the owner, with their own login, at DEP-1); the fake bucket's fidelity is unproven until then.

### Read the start-up line after every deploy (the no-refusal line)

**A deploy with `NODE_ENV` missing or wrong starts anyway** (Q7 (b), L151): nothing in `functions/src` reads `NODE_ENV` except the emulator-host and rate-limit guards. So **after every deploy, read the start-up line** (`startup configuration`, one `info` line per cold start) and the staging check: it shows the raw `NODE_ENV` (or `unset`), the store kind and bucket, the database mode (`host` or `connector`) and the pool size, the number of CORS origins, and whether an Auth emulator host is set. It carries no secret. A store left at `local` shows `local`; the check's upload test shows the object missing from the bucket.

### Known differences and limits

- **JSON the platform cannot parse** gets the platform's own answer, not the API's `{ error }`: on the Functions emulator an HTML 400 page (Express's final handler), and on Cloud the same Functions Framework behaviour (its source has no error handler between the parsers and the function: github.com/GoogleCloudPlatform/functions-framework-nodejs `src/server.ts`, read 2026-10-16; the version Cloud installs is unconfirmed). The function never runs for it. With `NODE_ENV=production` Express shows no stack or path (RECALLED; a staging-check line). Locally the emulator's page is the known difference (INSTALL.md).
- **The platform reads a whole body before any guard runs** (32 MB on the emulator; the framework's own parser limit is 1024 MB under Cloud's own 32 MB, RECALLED for Cloud). The API then applies its own limits: `MAX_JSON_BODY` (413) and the backdrop limit (413); so a flood of large bodies costs memory before it is refused.
- **Address:** under the Functions emulator there is no socket address and no `X-Forwarded-For`, so the API uses `127.0.0.1` (`FUNCTIONS_EMULATOR=true`); on a deployed function the address comes from `X-Forwarded-For` with `TRUST_PROXY_HOPS=1`, and a missing address logs one warning naming `TRUST_PROXY_HOPS`. A wrong hop count puts every client under one rate-limit key and the auth limiter would refuse everyone after 15 failed checks: the staging check records the owner's public address and shows a forged leading `X-Forwarded-For` does not change it.
- **Pool of one (EC-9):** a long statement (a publish; the timeout is 60 s) holds the only connection, so `GET /api/health` and every other request wait up to `PG_CONNECT_TIMEOUT_MS` and then answer 503, which can fire the 5xx alert. No route holds its own connection while another query waits for one (`functions/test/dep0.poolOfOne.test.js`).
- **Cold start (AC-18):** the first `GET /api/health` after idle includes the connector's handshake; DEP-1 records the time and raises `PG_CONNECT_TIMEOUT_MS` here if needed.
- **Deploys during a publish (EC-3):** a deploy that replaces the instance while a publish is `BUILDING` leaves the row `BUILDING`; OA-2's recovery marks it `FAILED` at the next publish.
- **A migration runs before the new function is deployed (EC-2):** the old function runs for a moment on the new schema. Migrations are additive and default privileges give both versions the same access to new tables. A migration blocked behind a long transaction fails at `lock_timeout` (30 s, provisional) and the deploy stops.

### The Hosting block (`firebase.json`)

`hosting` serves `app/build/web` (the admin release build; INSTALL.md A.3) with the single-page rewrite and, **on every path (`**`)**, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. No `Strict-Transport-Security` is written (Hosting sets it on its own subdomains). The policy is the strictest that lets the real page work: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; **no `unsafe-eval`**; `'wasm-unsafe-eval'` for CanvasKit; inline **styles** allowed (the Flutter engine sets them) and inline **scripts only by hash**: the two the FlutterFire packages inject (`firebase_core` 4.15.0 and `firebase_auth` 6.7.0). `connect-src` names `'self'`, the function's origin (`https://asia-southeast1-<projectId>.cloudfunctions.net`, the pattern in firebase.google.com/docs/functions/http-events, **confirmed at DEP-1's first deploy**), the two Firebase Auth hosts (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`) and Google's static hosts (`www.gstatic.com` for CanvasKit and the Firebase SDK, `fonts.gstatic.com` for the font). **When `firebase_core` or `firebase_auth` is upgraded**, the page's console names the new hash in the "Executing inline script violates ..." message: put it in `firebase.json` and `tools/test/dep0.hosting.test.js`. The page was run under this policy in Edge and Chrome, served by the Hosting emulator, with no violation (plan/DEP-0-step0.md, "The page under the policy"); firebase-tools 15.32.1's Hosting emulator applies `regex` header rules and not `source` globs, so that run used the same rule written as `regex: ".*"`. A Flutter build with `--no-web-resources-cdn` would bundle CanvasKit and the fonts and remove both `gstatic` hosts (not done: the documented build command is unchanged).

### Rollback

- **Code:** revert on `main` and let CI redeploy, or run the deploy workflow by hand (`workflow_dispatch`) with an earlier commit.
- **Hosting:** the previous release, in the Firebase console.
- **Database:** forward-only. Fix forward with a new migration, or rebuild staging (it holds throwaway data).
- **Pause switch:** the repository variable `STAGING_DEPLOY=off` stops CI's deploys (DEP-1 reads it).

### Monitoring (DEP-1 creates these)

An uptime check on `GET /api/health`, an alert on 5xx responses, and a USD 5 budget alert on the billing account (RECALLED console paths; plan/DEP-0-step0.md, deferred rows).

### Standard §6, item 12

For **production**, the database is read-only without explicit per-request permission, and the e2e suite and the seed scripts are banned from it for ever. For **staging**, `gabay_api` is the function's login, `gabay_migrate` is CI's, and the owner reaches the database through the proxy.

### The check

`docs/ops/STAGING_CHECK_TEMPLATE.md` is the form filled in at DEP-1: the standard §6 items, each with the evidence to paste, and DEP-0's own lines.

## Gotchas (known before the first deploy)

- **OQ9:** `better-sqlite3` (the package builder) is a native module; whether it builds and fits the in-memory `/tmp` in the Functions runtime is checked at the first deploy. Fallback: a Cloud Run job for the build.
- **EC-28 (DEP-1):** `@google-cloud/storage` is an **optional** dependency of `firebase-admin` 14.5.0 (resolved to 8.2.0). If the deployed function's install leaves it out, the first upload fails; the build log of the first deploy shows it, and the fix is to pin `@google-cloud/storage` directly (a Blueprint pin and an EXCEPTIONS entry).
- **DEP-1's deploy job installs `db/seeds` too:** `db:deploy`'s reference seed uses `db/seeds/lib/lookups.js`, which needs `pg` from `db/seeds/node_modules`.
- Firebase Auth processes sign-in data in the US; everything else stays in Singapore (accepted, L116).
- **Which API mode goes with which admin page build (SEC-3, EC-51):** the page built with the five Firebase web config values (`--dart-define-from-file=<file>`) signs in against the real project and goes with the API running `FIREBASE_PROJECT_ID=<id>` with an empty `FIREBASE_AUTH_EMULATOR_HOST` (and a credential for the revocation check: your own login or a key file, INSTALL A.6); the page built with none of them (debug and profile only) uses the Auth emulator and goes with the API on the emulator host. A mixed pair makes every request answer 401, and a fresh sign-in then shows "This account cannot sign in right now": the page cannot tell the cause. A release build with no values refuses to start, and one with only some refuses too.
- **Access changes made outside the API (SEC-1):** a role, grant, permission override or venue grant changed by SQL, by an operator tool or by `npm run migrate` is seen by the running function within 30 s (the in-memory access cache, `functions/src/auth/accessCache.js`; valid only while `maxInstances = 1`). R6's admin API clears the cache at once on its own writes. A new instance starts with an empty cache. The real project's revocation check needs a credential: **locally, your own login (`gcloud auth application-default login`, no key file) or `GOOGLE_APPLICATION_CREDENTIALS`** (INSTALL.md A.6; `verifyIdToken(token)` alone needs only the project id, but `checkRevoked` is an authenticated Admin API call: firebase.google.com/docs/auth/admin/verify-id-tokens, read 2026-10-16); on Cloud Functions, the runtime's own service account (RECALLED, checked at DEP-1): without a working credential every admin request is 503 "Authentication service unavailable".

## SEC-2: limits and the audit trail

These four statements are SEC-2's (spec/SEC-2.md r2 AC-59).

- **The rate limiters are in memory, like the permission cache, and valid only while `maxInstances = 1`.** A move to more than one instance needs a shared store first (Blueprint 2.6; release-blocking). The start-up log says so in the one `rate limits:` line.
- **`RATE_LIMIT=off` is refused at start-up outside development and test.** The API stops with a `ConfigError` naming `RATE_LIMIT` unless the raw `NODE_ENV` is written explicitly as `development` or `test` (the same rule as the Auth emulator host, L151), so a deployed function cannot run without its limits.
- **The three limits and their defaults**, set in `.env` (a function secret or config on Cloud Functions) and applied by a restart or a redeploy: `RATE_LIMIT_PER_MIN` (1,200 requests a minute per client address under `/api`), `AUTH_RATE_LIMIT_MAX` (15 failed token checks, 401s only, per client address per window) and `AUTH_RATE_LIMIT_WINDOW_MIN` (15 minutes). Each is a whole number of at least 1; a typo (0, 1.5, a word, or above 100,000, 10,000 and 1,440 respectively) stops start-up and names the key. `TRUST_PROXY_HOPS` decides which address is the client's: it must match the real number of proxies (Cloud Functions: 1), or every client shares one bucket.
- **The staging check (DEP-1) must show an audit row after a real write.** The audit insert is fire-and-forget, written after the response is sent; on Cloud Functions the instance may stop or throttle its CPU after the response, so a row can be late or lost (EC-39; RECALLED, not checked until a real deploy). DEP-1's check: make one write through the deployed API as a signed-in admin, then read `gabay.AuditLog` for its request id (the `X-Request-Id` of the response). If rows are missing, the write must be awaited (a spec change), not retried.

## Hard limits

- `maxInstances = 1` for the pilot: no shared in-memory state across instances (Blueprint §2.6).
- Nothing deploys without the product owner's call (L109). No Firestore or Realtime Database (L98).
