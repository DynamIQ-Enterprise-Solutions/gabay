# Gabay — Deployment Runbook

> **Version**: 0.1 stub | **Date**: 2026-10-07 | **Status**: Phase 0 stub (standard §2; plan.html L115) | **Audience**: whoever deploys, on the product owner's call | **Scope**: reusable per environment; the per-release deploy plan is separate and dated

**⚠️ No deploy of any kind while EXCEPTIONS E-20 is open (L153), except as its amendments allow (L184's staging project once SEC-1 to SEC-3 and DEP-0 merge; until the owner calls Blaze, L186, only a Spark-plan project used for Firebase Auth alone):** the development stub is deleted (SEC-1: every admin route signs in, names its tenant and is permission-checked); audit, rate limits and validation are SEC-2's.

**⚠️ Nothing in this runbook is run until the product owner calls the first deploy (L109).** Until then everything is local (INSTALL.md). Every step that writes to a cloud resource carries a ⚠️ and needs the release approval named in the deploy plan.

The standard's runbook phases assume a VM; Gabay runs on Firebase (L98), so the phases map as below.

| # | Standard phase | Gabay | State |
|---|---|---|---|
| 1 | Prerequisites | A Google Cloud / Firebase project in `asia-southeast1` on the Blaze plan; `firebase-tools` 15.x; Node 22; two named Owners (L93) | Decided at the deploy call (L117). **Staging (L184):** settled by `plan/DEPLOY-staging.md` §3: project `gabay-staging` under the owner's Dynamiq account, Blaze with a card, a budget alert at USD 5, a second Owner may be added later; the staging section of this runbook is written with DEP-0 and DEP-1 |
| 2 | Layout | Firebase Hosting (admin web page), one Cloud Function (`api`, Express, `maxInstances = 1`), Cloud SQL for PostgreSQL 18 via SQL Connect, Cloud Storage, Firebase Auth | Decided (L98) |
| 3 | Build | `flutter build web` for the admin; the function bundle | Phase 1 |
| 4 | Database + least-privilege login | Cloud SQL instance; an API login with only the grants it needs; migrations in order | Phase 1; the connection path (Cloud SQL connector or authorised networks) at the deploy call |
| 5 | Environment | Function secrets and config; `CORS_ORIGINS` lists the Hosting address (E-05) | Phase 1 |
| 6 | Reverse proxy | None: Hosting rewrites serve the admin page; the API is called at its own address (E-05; the 60 s Hosting rewrite limit) | Decided |
| 7 | TLS | Managed by Firebase and Google Cloud; a custom domain's certificate is automatic (RECALLED; check at the deploy call) | — |
| 8 | Service supervisor, log rotation | Managed by Cloud Functions and Cloud Logging | — |
| 9 | Firewall | Cloud SQL network access; the function's ingress | At the deploy call |
| 10 | Verify | `GET /api/health`, then `docs/testing/Smoke_Test_Guide.md` | Phase 1 |
| 11 | Operations | Cloud SQL backups; canary by deploying to a preview first | Phase 1 |

## Gotchas (known before the first deploy)

- **OQ9:** `better-sqlite3` (the package builder) is a native module; whether it builds and fits the in-memory `/tmp` in the Functions runtime is checked at the first deploy. Fallback: a Cloud Run job for the build.
- Firebase Auth processes sign-in data in the US; everything else stays in Singapore (accepted, L116).
- **Which API mode goes with which admin page build (SEC-3, EC-51):** the page built with the five Firebase web config values (`--dart-define-from-file=<file>`) signs in against the real project and goes with the API running `FIREBASE_PROJECT_ID=<id>` with an empty `FIREBASE_AUTH_EMULATOR_HOST` (and the service-account key, INSTALL A.6); the page built with none of them (debug and profile only) uses the Auth emulator and goes with the API on the emulator host. A mixed pair makes every request answer 401, and a fresh sign-in then shows "This account cannot sign in right now": the page cannot tell the cause. A release build with no values refuses to start, and one with only some refuses too.
- **Access changes made outside the API (SEC-1):** a role, grant, permission override or venue grant changed by SQL, by an operator tool or by `npm run migrate` is seen by the running function within 30 s (the in-memory access cache, `functions/src/auth/accessCache.js`; valid only while `maxInstances = 1`). R6's admin API clears the cache at once on its own writes. A new instance starts with an empty cache. The real project's revocation check needs a credential (locally, `GOOGLE_APPLICATION_CREDENTIALS`, INSTALL.md A.6, checked at SEC-1's step 0; on Cloud Functions, the runtime's own service account, RECALLED, checked at DEP-1): without a working credential every admin request is 503 "Authentication service unavailable".

## SEC-2: limits and the audit trail

These four statements are SEC-2's (spec/SEC-2.md r2 AC-59). DEP-0 moves them into the staging and security sections it builds.

- **The rate limiters are in memory, like the permission cache, and valid only while `maxInstances = 1`.** A move to more than one instance needs a shared store first (Blueprint 2.6; release-blocking). The start-up log says so in the one `rate limits:` line.
- **`RATE_LIMIT=off` is refused at start-up outside development and test.** The API stops with a `ConfigError` naming `RATE_LIMIT` unless the raw `NODE_ENV` is written explicitly as `development` or `test` (the same rule as the Auth emulator host, L151), so a deployed function cannot run without its limits.
- **The three limits and their defaults**, set in `.env` (a function secret or config on Cloud Functions) and applied by a restart or a redeploy: `RATE_LIMIT_PER_MIN` (1,200 requests a minute per client address under `/api`), `AUTH_RATE_LIMIT_MAX` (15 failed token checks, 401s only, per client address per window) and `AUTH_RATE_LIMIT_WINDOW_MIN` (15 minutes). Each is a whole number of at least 1; a typo (0, 1.5, a word, or above 100,000, 10,000 and 1,440 respectively) stops start-up and names the key. `TRUST_PROXY_HOPS` decides which address is the client's: it must match the real number of proxies (Cloud Functions: 1), or every client shares one bucket.
- **The staging check (DEP-1) must show an audit row after a real write.** The audit insert is fire-and-forget, written after the response is sent; on Cloud Functions the instance may stop or throttle its CPU after the response, so a row can be late or lost (EC-39; RECALLED, not checked until a real deploy). DEP-1's check: make one write through the deployed API as a signed-in admin, then read `gabay.AuditLog` for its request id (the `X-Request-Id` of the response). If rows are missing, the write must be awaited (a spec change), not retried.

## Hard limits

- `maxInstances = 1` for the pilot: no shared in-memory state across instances (Blueprint §2.6).
- Nothing deploys without the product owner's call (L109). No Firestore or Realtime Database (L98).
