# Intent DEP-0: Deploy hardening: the boot guard, the Cloud Storage file store, the Cloud SQL connection, the operator tools

> **Pipeline entry:** DEP-0 (new; `plan/DEPLOY-staging.md` 1.0 §1 "Not in the R list but required", §3) · **Slice:** DEP-0, stage S, server lane, after SEC-2 · **Date:** 2026-10-14 · **Status:** DRAFT for the owner's spec sitting; the design is approved in `plan/DEPLOY-staging.md` 1.0 (L184) with its owner rulings · **Coder:** api-coder (Sonnet 5.5); Opus 5.5 review · **Sources:**
> - `plan/DEPLOY-staging.md` §3 (every row of the choices table and its alternatives), §5 (E-20 as amended), §6 and "Owner rulings" (Q4 (b) SQL Connect; Q7 (b) keep L151);
> - `functions/src/services/storage/localFileStore.js` (the `FileStore` interface; "a Cloud Function cannot keep" disk), `functions/src/config/index.js` (`config.db`, the emulator-host guard), `functions/index.js` (`onRequest`, `maxInstances = 1`, `asia-southeast1`);
> - EXCEPTIONS E-05 (Hosting, security headers in `firebase.json`), E-06 to E-09 (Firebase, SQL Connect, `pg`, `firebase-admin`), E-20 as amended; the Blueprint Part 1 pins (`firebase-admin` 14.x, `firebase-tools` 15.x);
> - `docs/ops/DEPLOYMENT_RUNBOOK.md` rows 1, 4, 7, 9; the standard §6 item 12 (least-privilege database login) and Stage 5.

## What the product owner wants

The admin side and the database on a private Firebase staging project, with merges deployed one by one (L184). Before CI can deploy, the code must be able to run on Cloud Functions at all: files on a function's disk are lost, the database needs a connection path and least-privilege logins, secrets must not live in the repository, and someone has to be able to create the owner's accounts without R6's admin API.

DEP-0 delivers, on the server and in the tooling:

1. **A `GcsFileStore`** behind the existing `FileStore` interface (`firebase-admin` Cloud Storage, E-09), one private bucket in `asia-southeast1`, keys already carrying the tenant (OA-2); chosen by configuration; the local store stays for development and tests. Closes PH4 §7's storage row.
2. **The Cloud SQL connection.** `config.db` can connect through the Cloud SQL Node.js connector (`@google-cloud/cloud-sql-connector`; a Blueprint pin and **E-29**, the version read from npm at the slice's start) with pool size 1 per instance, or through the `/cloudsql/...` socket if the one-day spike shows it survives a redeploy (DEPLOY-staging §3, the Function-to-database row). Two logins: `gabay_migrate` (DDL, used by CI) and `gabay_api` (rows only), with the grants listed in the spec. The database is created through Firebase SQL Connect (Q4 (b)); Gabay still talks to it with `pg`.
3. **Secrets and environment.** Passwords in Secret Manager bound with `defineSecret`; config values in `.env.<projectId>` kept out of git; `NODE_ENV=production` written explicitly; `FIREBASE_`-prefixed names avoided in `.env` files; the project ID from the runtime. **No boot guard that refuses to start** (Q7 (b), L151 kept): a runbook line instead; the emulator-host guard stays.
4. **Operator tools.** `npm run staging:admin -- <email> <role> <tenant>`: the Admin SDK creates the Firebase user with no password and prints a password-setup link once (PH2 Q4), then inserts `AppUser` and `UserRole`; run from the owner's machine through the Cloud SQL proxy with their own Google login. `npm run db:deploy`: applies `schema.sql` only when the schema is absent (never `setup-db`), then `npm run migrate`, before the function deploys. Both in CLAUDE.md's Commands, README and INSTALL.
5. **Hosting block** in `firebase.json`: CSP, `X-Frame-Options`, `noindex`; CORS lists exactly `https://gabay-staging.web.app` and `.firebaseapp.com` (E-05). The admin build command with `--dart-define=API_BASE=<function URL>/api` documented.
6. **Seed policy as code.** The reference seed (lookups, roles, permission rows) is migration or bootstrap data; the Demo Malls test venues load only by an explicit command, never by CI; the six `@gabay.test` accounts and the penthouse and spike data never reach staging.
7. **The staging section of the runbook** (project, instance, logins, secrets, rollback, pause switch `STAGING_DEPLOY=off`, uptime check and 5xx alert, budget alert) and the §6 item 12 line; the staging check list (standard §6 items 1 to 6, 8 to 10, 12) as a report template.
8. **Tests:** the file store contract tests run against both stores (the GCS one against an emulator or a fake, as the spec decides); `db:deploy` and `staging:admin` have tests on a throwaway database; nothing in `npm run verify` needs cloud credentials.

## Out of scope

- The project, billing and the CI workflow (DEP-1, after the owner's console steps); production (a separate, named call).

## Product questions for the sitting

Expected none beyond those the plan already ruled. The unknowns the plan names (the socket versus the connector, the Singapore price, `K_SERVICE`, the sign-up switch's name) are settled by the spike and the step 0 doc checks, not by the owner.
