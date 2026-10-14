Spec DEP-0. Revision: r2 (2026-10-14). Intent: intent/DEP-0-deploy-hardening.md

# DEP-0: Deploy hardening: the Cloud Storage file store, the Cloud SQL connection, two database logins, secrets and environment, the operator tools

> **Pipeline entry:** DEP-0 (`plan/DEPLOY-staging.md` 1.0 §1 "Not in the R list but required", §3) · **Slice:** DEP-0, stage S, server lane, merges after SEC-1, SEC-2 and SEC-3 and before DEP-1 · **Coder:** api-coder (Sonnet 5.5), Opus 5.5 review (intent; L174, L184) · **Status:** r2, for the product owner's approval. **No question is open** (§12): Q1 and Q2 of r1 are settled by L186, and the changes are marked **[r2]**.
>
> **What r2 changes, in one paragraph.** Today's rulings (L186, relayed by the coordinator on 2026-10-14; plan.html 1.04, which I read, holds L184 and L185 only) say the owner has no Firebase project yet and chose the **Spark (free) plan for now, with real Firebase Auth only**. The API and the database stay on this machine, and there is **no function, database, bucket or Hosting deploy until the owner moves to Blaze** (checked on 2026-10-14 by the coordinator: firebase.google.com/pricing lists Cloud Functions as "not available" on Spark; docs/functions/get-started says "to deploy functions, your project must be on the Blaze pricing plan"; the SQL Connect trial is archived if the project is not upgraded). So **everything in DEP-0 is built and proven locally, with no cloud resource**: the store over a fake bucket, the connection modes behind config, the two logins and grants on a throwaway database, `db:deploy` and `staging:admin` on a throwaway database with a fake Admin auth object. **What needs a cloud resource moves to DEP-1's first deploy under Blaze** (§3.12 lists each one). The socket-versus-connector spike (r1's Q2) cannot run without Blaze, so r2 builds the connector mode behind config as a design choice (DC-8), tags the socket as untested, and moves the spike to DEP-1. `staging:admin` gains a mode that targets the real Spark project's Auth and the **local** database, so the owner can create their own admin logins now (AC-56 to AC-58). Q1 is settled by SEC-1's ruling (AC-39).
>
> **Rulings already in force (not reopened here).** L184: sign-in first, then a private staging deploy; `plan/DEPLOY-staging.md` 1.0 approved. **Q4 (b):** the database is created through Firebase SQL Connect for its trial, and Gabay still talks to it with raw `pg` (E-06 and E-07 stand); the trial is archived if the project is not upgraded (L186). **Q7 (b):** L151 ruling 1 is kept, so there is **no boot guard that refuses to start**; a runbook line replaces it. Q3 (a): only the owner has logins, one for every role. Q5 (a): the shopper app never points at staging. E-20 as amended by L184 (one project, one Function with `maxInstances = 1`, one Cloud SQL instance, one private bucket, invented data only, no backups kept). **L186:** Spark first, real Auth only, API and database local; the project id is `gabay-staging`, or the fallback `gabay-staging-dq` if that is taken. WORKING_AGREEMENT line 14: **agents never run `firebase deploy` and never hold cloud credentials**, so every step in this spec that touches a cloud resource is run by the product owner or by CI (DEP-1), and its evidence is pasted by them.
>
> **Sources read** (r1 at `main` 7338a94, 2026-10-14; r2 adds the coordinator's L186 message):
> - the intent; `plan/DEPLOY-staging.md` §0, §3 (every row of the choices table and its alternatives), §4, §5, §6 and §7 (the unknowns), and "Owner rulings" (Q4 (b), Q7 (b));
> - `functions/src/services/storage/fileStore.js` (the interface and `isStorageKey`) and `localFileStore.js`; `functions/test/memoryFileStore.js`, `storage.localFileStore.test.js`; the callers found by grep (`app.js`, `mapStorage/mapBackdrop.service.js`, `mapPublish.service.js`, `backdrop.repository.js`);
> - `functions/src/config/index.js` (the zod schema, the emulator-host guard, `devOnlyAllowed`, `FILE_STORE_DIR`), `functions/index.js` (inert load, `onRequest`, `maxInstances: 1`, `asia-southeast1`), `functions/src/db/index.js` (the pool, `withTransaction`, `tagUnavailable`), `routes/health.js`, `auth/firebaseVerifier.js` (`verifyIdToken(token, true)`, revocation always checked), `app.js` (CORS, store default);
> - `db/tools/setup-db.js`, `migrate.js`, `lib/connect.js`, `lib/migrations.js`, `db/tools/test/scratchDb.js`; `db/schema.sql` (the `gabay` schema, `AppUser`, `Role`, `UserRole`, `UserVenueGrant`, `StoredFile`, `AuditLog`; no `CREATE EXTENSION`, no role or grant statements); `db/migrations/` (0001 only);
> - `db/seeds/package.json`, `README.md`, `seed.js`, `lib/run.js`, `lib/lookups.js`, `lib/accounts.js` (what the seed deletes and writes);
> - `docs/ops/DEPLOYMENT_RUNBOOK.md` (the Phase 0 stub); `docs/process/EXCEPTIONS.md` (E-05 to E-09, E-20 as amended by L184, E-25 to E-28); `docs/process/WORKING_AGREEMENT.md` line 14; Blueprint Part 1 pins (`firebase-admin` 14.5.0, `firebase-functions` 7.4.0, `pg` 8.23.1, `firebase-tools` 15.32.1) and the invariants on `req.tenantCompanyID`;
> - `.env.example`, `.gitignore` (`.env`, `.env.*`, `!.env.example`), `firebase.json` (functions and emulators only, no Hosting block), root `package.json`, `.github/workflows/build.yml`; `tools/test/` and `db/tools/test/` file names;
> - the intents of SEC-1 and SEC-3 (SEC-1's spec is not written yet; its venue-scope ruling reaches this spec through the coordinator, AC-39); `plan/PH2-identity.md` §3 and §7 Q4 (a password-setup link; Gabay never holds a password);
> - installed packages, read locally: `firebase-admin` 14.5.0 has `lib/storage/` and lists `@google-cloud/storage ^8.1.0` under **optionalDependencies**; `firebase-functions` 7.4.0 exports `defineSecret`; `@google-cloud/storage`'s `file.d.ts` mentions `ifGenerationMatch`;
> - FEATURE_PIPELINE §5; the standard's §6 (the security release gate, 14 bullets), §3.16, Stage 5; PRD §7.
>
> **The shape of the work.** Everything below runs on this machine. The manual checks that need a real Firebase project are marked, and those that need Blaze are marked "DEP-1". Every claim about Firebase, Cloud SQL, Secret Manager, Cloud Storage, the Admin SDK or the connector that the code above does not show is tagged **RECALLED**, and §11 names the document to read.

## 1. What this delivers

1. **Step 0** (§2): the doc checks, and the connector's version read from npm, pasted into `plan/DEP-0.md` before any build. **[r2]** The socket-versus-connector spike moves to DEP-1.
2. **`GcsFileStore`** behind the existing `FileStore` interface, chosen by configuration, with the local store kept for development and tests, and one contract suite run against every store, the GCS one over a fake bucket (§3.2).
3. **The Cloud SQL connection [r2]:** host mode (local, proxy, or the untested socket path) and connector mode (E-29, pool of 1) behind configuration, the connector proven with a fake until DEP-1 (§3.3).
4. **Two logins, `gabay_migrate` and `gabay_api`,** with their grants listed and tested on a throwaway database (§3.4).
5. **Secrets and environment:** Secret Manager through `defineSecret`, `.env.<projectId>` out of git, `NODE_ENV=production` written, no `FIREBASE_` names in it, no boot refusal (§3.5).
6. **Operator tools [r2]:** `npm run db:deploy`, `npm run staging:admin` (with a mode for the real Spark project's Auth plus the local database), and the explicit `staging:seed` command the seed policy needs (§3.6 to §3.8).
7. **The Hosting block and the CORS list**, written now and proven by static tests and the local Hosting emulator; the staging proof is DEP-1's (§3.9).
8. **The runbook's staging section and the staging check template**, written now, filled in at DEP-1 (§3.10).
9. **Nothing in `npm run verify` needs cloud credentials** (§3.11).

No table, column or route is added or changed. DEP-0 adds no route, so it adds no guard, permission or menu row.

## 2. Step 0: before any build

### 2.1 The spike moves to DEP-1 [r2]

**Question (unchanged):** does the `/cloudsql/<instance connection name>` socket, once attached to a Firebase 2nd-generation function, survive a redeploy by `firebase deploy`? (DEPLOY-staging §3: "a later `firebase deploy` may reset it", RECALLED and untested.)

It cannot run until the project is on Blaze (a function and the instance are needed). DEP-0 therefore **does not wait for it**: it builds the connector mode behind configuration (DC-8) and leaves the socket as host mode with a socket path, **untested**. The spike is DEP-1's, run by the owner at the first deploy after Blaze, and its procedure and pass condition are recorded here so that DEP-1 inherits them:
- **Setup:** a throwaway function named `spike`, never `api`, `maxInstances = 1`, `asia-southeast1`, opening one `pg` connection over the socket and answering `SELECT 1`.
- **Procedure:** three redeploys with the command CI will use (`firebase deploy --only functions --project <projectId>`): unchanged source; a changed source file; a changed value in `.env.<projectId>`. After each, with no console step between, the first call is made. (The count of three is this spec's own choice, DC-9.)
- **Pass:** after every redeploy the first call answers over the socket with no manual step (a one-time manual attach is allowed and goes into the runbook). **Pass means the socket is used**, the connector mode is removed again and E-29 is withdrawn (this spec moves to r3). **Fail means the connector stays.** The outcome and its evidence go into DEP-1's plan either way.

### 2.2 The doc checks

§11 lists every RECALLED claim with the document to read and when it is checked. A document can be read now with no project, so every row marked "before build" is pasted into the plan before the code it feeds is written. A row that needs a real resource is marked "DEP-1" or "owner, first real use".

## 3. Acceptance criteria

Numbers keep r1's order. **[r2]** marks a criterion that r2 changed, and the additions of r2 take the next free numbers (AC-56 and after, placed in §3.7 and §3.12).

### 3.1 Step 0 and the dependency

- AC-1 [r2]: **Step 0 is pasted into `plan/DEP-0.md` before any build starts:**
  - (a) for each row of §11 marked "before build", the excerpt or command output that confirms, corrects or replaces the RECALLED claim, with its URL and the date read;
  - (b) read from npm now, not from memory: the connector's current version, its licence and its Node support, and the version of `@google-cloud/storage` that `firebase-admin` 14.5.0 resolves to;
  - (c) the rows marked "DEP-1" or "owner, first real use" are listed as deferred, each with the criterion it feeds and where it is proven (§3.12).

  A "before build" row left unconfirmed is marked "unconfirmed", and the criteria it feeds are not built until the product owner rules. Verify: review (dod-reviewer reads the plan's Step 0 section first).
- AC-2 [r2]: **E-29 is requested when the connector is installed.**
  - Before `@google-cloud/cloud-sql-connector` is added to `functions/package.json`, `docs/process/EXCEPTIONS.md` holds an E-29 row for it: the exact version read in AC-1(b), server only, loaded only in connector mode, the reason, an expiry (the proposal is 2027-04-02, the sweep date of E-02 to E-28), and the product owner's signature.
  - Blueprint Part 1 gets the pin in the same change (the version, the date and the source), and `functions/package.json` pins the same exact version, as its other dependencies are pinned.
  - If DEP-1's spike later chooses the socket, a follow-up removes the connector mode and withdraws E-29 (this spec's r3).

  Verify: review; the `tools:test` checks pass.

### 3.2 The file store

- AC-3: **Choosing the store is configuration.**
  - `functions/src/config` reads a new key `FILE_STORE`, `local` or `gcs`. The default is `local`.
  - With `gcs`, a bucket name key `GCS_BUCKET` is required.
  - A missing bucket with `gcs`, or any other `FILE_STORE` value, is a `ConfigError` naming the key.
  - With `local`, nothing changes: `FILE_STORE_DIR` still names the folder.

  Verify: unit (`parseConfig`).
- AC-4: **One factory builds the store from the config** (`createApp` calls it). `deps.fileStore` injection stays, so every existing API test is unchanged. No other file names a store class. Verify: unit on the factory (each value yields the right kind); review.
- AC-5: **`GcsFileStore` honours every line of the `FileStore` interface** (`fileStore.js`). With a bucket-like client behind it:
  - **Key rule:** every method refuses a key `isStorageKey()` refuses, by throwing before anything is sent to the bucket.
  - **`put`:** takes a Buffer (anything else is a `TypeError`). It writes the object whole, under the object name equal to the key, and answers `{ sizeBytes, sha256 }` of exactly the bytes stored (computed locally, 64 lowercase hex). It **refuses a key that already holds an object**, and the stored bytes are unchanged. The refusal uses a create-only write precondition (`ifGenerationMatch: 0`; RECALLED, §11 row 7), never a check-then-write.
  - **`get`:** the bytes, or `null` when the object does not exist. Any other failure (permission denied, network) is thrown and never turned into `null`.
  - **`exists`:** a boolean, with the same rule for other failures.
  - **`remove`:** resolves when there was no object, and throws on any other failure.

  Verify: the contract suite (AC-8).
- AC-6: **Two writers on one key:** of two `put`s started together on one key, exactly one resolves and the other rejects, and the stored bytes are the winner's. This holds for every store in the contract suite. Verify: the contract suite.
- AC-7: **A storage failure never leaks.** With the fake bucket made to fail with a permission error, a backdrop upload through the API answers the standard 500 `{ error }` with no bucket name, project, key or driver text, and leaves no `StoredFile` or `VenueMapBackdrop` row (OA-2 AC-39's no-leftover rule). Verify: API test with the store over the fake.
- AC-8 [r2]: **One contract suite, run against every store.**
  - The suite takes a store factory. It covers the interface: AC-5, AC-6, an empty Buffer, a Buffer at the largest stored size (15 MB, OA-2 AC-38), a key at the longest the services make, and "nothing is created before the first `put`" where that applies.
  - It runs against: the local folder store (a temporary folder), `memoryFileStore` (the test double, so it cannot drift from the interface), and `GcsFileStore` over the fake bucket (AC-9).
  - A separate **real-bucket run** exists as a script outside the `*.test.js` glob, so it never runs in `npm run verify` and is never reported as a skipped test. It takes a bucket name from the environment and the owner's own Google login. It is **written and unit-checked for its argument handling in DEP-0, and run by the owner at DEP-1** once Blaze gives a bucket (a Cloud Storage bucket needs Blaze, RECALLED, §11 row 17).

  Verify: `npm run api:test` for the three stores; manual (owner, DEP-1) for the real bucket, output pasted.
- AC-9 [r2]: **The fake bucket is faithful where the store depends on it.** It implements only the calls the store makes. It fails exactly where the real client does: a create-only write on an existing object, a download or delete of a missing object, a permission error and a network error, with the error shapes (codes) the store reads. Each of those behaviours is listed in a table in the plan, and **the table's confirmation against the real bucket is DEP-1's** (the owner's run in AC-8). Until then the fake's fidelity is unproven, and the plan says so. Verify: unit on the fake; manual (owner, DEP-1) for the confirmation.
- AC-10: **The API behaves the same over `GcsFileStore`.** OA-2's backdrop routes (upload, read, prune) and the publish and rollback paths that write packages through the store pass with the store swapped for `GcsFileStore` over the fake, with no change to their assertions. That includes a tenant that cannot read another tenant's backdrop (OA-2 AC-40). Verify: API tests, parameterised by store (C1, §4).
- AC-11 [r2]: **The bucket is private and the store keeps it so.** The store never makes an object public, never creates a signed URL, and never logs bytes. Every read goes through an API route that checks the tenant. The runbook records the bucket's settings (private, uniform bucket-level access, region `asia-southeast1`; RECALLED, §11 row 9) and the function's service account holds only an object-level role on this one bucket (the role's name read before build). Verify: unit (the store makes no public or signed-URL call); review of the runbook; manual (owner, DEP-1: a request for the object's public URL is refused).
- AC-12 [r2]: **On staging, a 15 MB backdrop uploads, reads back byte-identical, and its object is in the bucket under `backdrops/<tenantId>/<venueId>/<key>`.** The store holds a file whole in memory, and the largest stored file is 15 MB (OA-2 AC-38); the staging check shows that the function's default memory carries it (RECALLED, §11 row 13). Locally, the 15 MB case runs in the contract suite (AC-8). Verify: manual (staging check, DEP-1), output pasted.

### 3.3 The database connection

- AC-13 [r2]: **Two connection modes, exactly one.**
  - **Host mode:** `PGHOST` and `PGPORT` (local, the Cloud SQL proxy, or the socket path `/cloudsql/<instance connection name>` as the host). **The socket path is untested** until DEP-1's spike (RECALLED, §11 row 3); host mode with a local or proxy host is what this machine proves.
  - **Connector mode:** a new key, `CLOUD_SQL_INSTANCE`, the instance connection name (`<project>:<region>:<instance>`).

  Both set, or neither, is a `ConfigError` naming the keys. `PGHOST` is no longer required when `CLOUD_SQL_INSTANCE` is set. The other `PG*` keys keep their rules, and `PGPASSWORD` stays required. The password is read from the environment only. Verify: unit (`parseConfig`); every existing config test passes unchanged.
- AC-14 [r2]: **Connector mode, behind configuration, proven with a fake until DEP-1** (DC-8):
  - `createDb` gives the pool the connector's stream, for a public IP (the plan's choice: public IP, no private network).
  - The connector object is created on the first connection, not at load, and one is kept for the process's life.
  - `db.close()` closes the pool and then the connector, once.
  - The connector package is `require`d only in this mode, so a local run or a test in host mode never loads it (AC-53).
  - A real connection through it is **not** shown in DEP-0. DEP-1's first deploy shows it, and if the spike then chooses the socket, this mode is removed (AC-2).

  Verify: unit with a fake connector (no network): lazy creation, one instance, the options it was given, one close; manual (owner, DEP-1) for the real connection.
- AC-15: **Pool size 1 is an env value, not a code default.** The staging env table sets `PG_POOL_MAX=1` (Google's advice, checked in DEPLOY-staging §3). The code default stays 10, so local runs and tests are unchanged. With `PG_POOL_MAX=1`, no route or service runs a pool query while its own transaction holds the connection, because with one connection it would wait for itself until `PG_CONNECT_TIMEOUT_MS` and then fail. Verify: the whole API suite run once with `PG_POOL_MAX=1` on the local database, output pasted (a lasting form of this check is DC-7's choice for the plan).
- AC-16: **A connector or socket failure is the existing 503.** Any failure raised while obtaining a connection (an unreachable instance, a refused permission, a connector error with no `pg` error code) is tagged `dbUnavailable`, so every route answers the existing 503 `{ error: "Database unavailable" }` and `GET /api/health` answers 503. No driver or connector text, instance name or password reaches a response. The process does not crash. Verify: unit and API test with a fake connector that rejects.
- AC-17: **Logs never carry the password or a connection string.** The boot line (`database pool created`) names the host and port, or the instance connection name, with the database and user, and never the password. Verify: unit (a captured logger).
- AC-18 [r2]: **A cold start is recorded.** At DEP-1's staging check, the time of the first `GET /api/health` after the function has been idle is recorded (it includes the connector's handshake). It is not gated, because no target is stated (§7). If it exceeds `PG_CONNECT_TIMEOUT_MS`, the env value is raised in the env table; the code is not changed. Verify: manual (staging check, DEP-1), pasted.

### 3.4 The two logins and their grants

Names are constants: `gabay_migrate` and `gabay_api`.

- AC-19 [r2]: **Creating them is a tested, owner-run mode of `db:deploy`** (DC-10): `npm run db:deploy -- --init-roles`, run once by the owner with the instance's admin login (through the proxy, at DEP-1). It does nothing else: it refuses to combine with any other step. It creates both logins as `LOGIN` with the passwords the owner supplies in the process environment (never on the command line, never printed), and it is safe to run again (it updates the passwords, so it is also how a password is rotated). It sets:
  - **`gabay_migrate`:** no superuser, no `CREATEDB`, no `CREATEROLE`. `CONNECT` and `CREATE` on the database, so it can create the `gabay` schema, and it then owns the schema and everything `schema.sql` and the migrations create.
  - **`gabay_api`:** no superuser, no `CREATEDB`, no `CREATEROLE`. `CONNECT` on the database. It owns nothing, and holds no `CREATE` on the database, the schema or `public`.

  Role names and passwords reach the statements only through the driver's identifier and literal escaping (RECALLED, §11 row 14), never by concatenation, and the statement text is never logged. Verify: integration on a throwaway local database, with throwaway role names (the whole of this criterion is proven locally; running it on the instance is DEP-1's).
- AC-20: **Grants, listed.** Every `db:deploy` run ends with a grants step that gives `gabay_api` exactly this, and it is idempotent:
  - `USAGE` on schema `gabay`;
  - `SELECT`, `INSERT`, `UPDATE` and `DELETE` on every table in `gabay`, **except `AuditLog`, which gets `SELECT` and `INSERT` only** (DC-12);
  - nothing else: no `TRUNCATE`, `REFERENCES` or `TRIGGER` on any table, no `CREATE` anywhere;
  - sequence privileges only if the integration test shows an `INSERT` into an identity column needs them (RECALLED, §11 row 14);
  - **default privileges** for objects `gabay_migrate` creates later in `gabay`, so a table made by a later migration is usable by the API the moment it exists, with `AuditLog`'s exception re-applied by the grants step.

  Running the grants step twice leaves every table's ACL identical. Verify: integration (compare `pg_class.relacl` before and after a second run).
- AC-21: **What each login can and cannot do**, shown by connecting as each one on a throwaway database:
  - **As `gabay_api`:**
    - it can `SELECT`, `INSERT` (including into an identity column), `UPDATE` and `DELETE` on a table made by `schema.sql`, and on a table made by a later migration, with no new grant;
    - it cannot `CREATE TABLE` in `gabay` or in `public`, and cannot `DROP`, `ALTER` or `TRUNCATE` a table (SQLSTATE 42501);
    - it cannot `UPDATE` or `DELETE` an `AuditLog` row;
    - an `UPDATE` of a `PUBLISHED` `VenueVersion` is still refused by `TR_VenueVersion_Frozen` (invariant 3: the grants do not replace the trigger).
  - **As `gabay_migrate`:** `schema.sql` and every migration apply on an empty database; it cannot `CREATE ROLE` or `CREATE DATABASE`.

  Verify: integration.
- AC-22: **`gabay_api` suffices for the tools that write rows.** The database half of `staging:admin` (both modes) and of the staging seed command (§3.7, §3.8) runs as `gabay_api` in the same integration test. Verify: integration.
- AC-23: **The test leaves nothing behind.** The throwaway roles are cluster-wide, so their names carry the working copy's name and the process id (as `scratchDb.js` names its databases), and they are dropped in a `finally`. Each run first drops the leftovers of its own working copy whose process no longer exists. Verify: integration (after a run, `pg_roles` holds no throwaway role).

### 3.5 Secrets and environment

- AC-24 [r2]: **The password is a Secret Manager secret bound with `defineSecret`.**
  - `functions/index.js` declares exactly one secret and binds it in the function's options, so `gabay_api`'s password reaches the function as the `PGPASSWORD` environment variable (RECALLED, §11 row 5) and `config` is unchanged.
  - The function holds no other secret. The `gabay_migrate` password is never bound to the function; CI reads it through its federated identity (DEP-1).
  - Loading `functions/index.js` stays inert: `functions/test/index.test.js` passes unchanged.
  - The binding is proven **by a unit test locally**; that the deployed function receives the secret is DEP-1's first deploy.

  Verify: unit (the declared secret list is exactly one; a load with an empty environment neither throws nor reads the config); manual (DEP-1).
- AC-25 [r2]: **`.env.<projectId>` holds non-secret values only and is never committed.**
  - The file is `functions/.env.<projectId>`, for the project id the owner created (`gabay-staging`, or the fallback `gabay-staging-dq`, L186). `.gitignore` already ignores `.env.*`, and `git check-ignore` reports that exact path as ignored.
  - Neither the pre-commit secret guard nor `ci:guards` lets a file named `.env.<anything>` other than `.env.example` through.
  - The runbook holds the **env table**: every key of the file, with its staging value and its reason. It lists `NODE_ENV=production`, `LOG_LEVEL`, `CORS_ORIGINS` (AC-49), `TRUST_PROXY_HOPS=1`, `MAX_JSON_BODY`, `PG_POOL_MAX=1`, `PG_*` timeouts, `PGDATABASE`, `PGUSER=gabay_api`, `CLOUD_SQL_INSTANCE` (or `PGHOST` under the socket), `FILE_STORE=gcs`, `GCS_BUCKET`. It lists **no** password and no key beginning with `FIREBASE_`.
  - A test reads the env table and checks that every key in it is a key the config schema reads, and that none begins with a prefix the runtime reserves (the list is read before build, RECALLED, §11 row 6; `FIREBASE_` is on it regardless).
  - That the deploy actually loads the file is DEP-1's first deploy.

  Verify: `git check-ignore` test; `tools:test` for the guards' name pattern; unit for the env-table check; manual (DEP-1).
- AC-26 [r2]: **No `FIREBASE_` names reach the deployed environment.** `FIREBASE_PROJECT_ID` and `FIREBASE_AUTH_EMULATOR_HOST` stay config keys for local use only, and `.env.example`'s comments say so. On the deployed function both are unset, and the verifier starts the Admin SDK with no explicit project, taking it from the runtime (RECALLED, §11 row 6). **Locally,** under L186's real Auth, the API running on this machine takes the Spark project's id from `FIREBASE_PROJECT_ID` (allowed locally) and no emulator host (§10). Verify: unit (`parseConfig`, `firebaseVerifier`: `projectId` is null and the app is initialised with none when the key is empty); manual (staging check, DEP-1: a sign-in token of the staging project verifies, and an unsigned token is refused with 401).
- AC-27: **`NODE_ENV=production` is written explicitly, and there is no boot refusal (Q7 (b), L151).**
  - `parseConfig` gains no new refusal about `NODE_ENV` or the platform. The emulator-host guard stays as it is, and `config.devOnly.test.js` passes unchanged.
  - Nothing in `functions/src` reads `config.env` or `isProduction` outside the config module (grep, 2026-10-14), so a missing `NODE_ENV` changes only that guard's allowance. The runbook says so, and the staging check reads the startup line (AC-28).

  Verify: unit (unchanged tests); review of the diff for any new throw.
- AC-28: **One startup line makes a deploy mistake visible** (DC-20). On each cold start the app logs one `info` line with:
  - the raw `NODE_ENV` (or `unset`);
  - the store kind (`local` or `gcs`) and, for `gcs`, the bucket;
  - the database mode (`host` or `connector`) and `poolMax`;
  - the number of CORS origins;
  - whether an Auth emulator host is set.

  It carries no secret, no password and no key value. The runbook's no-refusal line says: after every deploy, read this line. Verify: unit (a captured logger, one case per field).
- AC-29: **A rotated secret needs a new instance.** The runbook says that a changed secret version reaches the function only when it starts again (a redeploy; RECALLED, §11 row 5), and gives the order for a password rotation: `db:deploy -- --init-roles`, then the new secret version, then the deploy. Verify: review.

### 3.6 `npm run db:deploy`

A root script that runs `db/tools/deploy.js`. It is the only thing CI will run against the database, and the only thing the owner runs for it. **[r2]** Under Spark there is no deployed database, so every criterion below is proven on a throwaway local database; DEP-1 runs it on the instance.

- AC-30: **It reads the environment only.** It connects with `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` and `PGPASSWORD` from the process environment, and it never loads the repository's `.env` (unlike `migrate` and `setup-db`), so a developer's local `.env` cannot point it at the wrong database (DC-16). Before any write it prints the target (host, port, database, user) and never the password. A missing key is refused, naming it. Verify: unit (a run with a `.env` present and the environment empty is refused).
- AC-31: **The first run on an empty database,** in this order (DC-15):
  1. apply `db/schema.sql`;
  2. apply every migration;
  3. seed the reference data (the platform lookups and the four roles, `seedPlatform`);
  4. run the grants step (AC-20).

  A database built this way holds the same reference rows (Roles, platform lookups, `PermissionRoute`, `RolePermission`) as one built by `setup-db` in dev mode with its test seed removed. The permission and menu rows come from SEC-1's migration, not from DEP-0. Verify: integration (two throwaway databases compared, row by row, over those four tables).
- AC-32: **A later run on a database that has the schema** applies the migrations and the grants step only. It never runs `schema.sql` and never seeds. "Has the schema" means the `gabay` schema holds at least one base table. A `gabay` schema with no tables (an earlier failed run) counts as absent. Verify: integration (a database with data in `Tenant` keeps every row; `schema.sql` is not executed).
- AC-33: **It is never destructive.** `db:deploy` runs no `DROP`, `TRUNCATE` or `DELETE` of its own, and it never starts `setup-db`. The only text of `schema.sql` it can run is on a database with no tables. Verify: integration (row counts and a content hash of several tables before and after a run on a populated database); review.
- AC-34: **One run at a time, and no queue pile-up** (DC-13, DC-14).
  - It takes a session advisory lock with a constant key first. A second concurrent run waits up to a named constant and then exits 1 with "another db:deploy is running".
  - It sets a `lock_timeout` for its session (a named constant, so a migration blocked behind a long transaction fails and rolls back instead of queueing behind it and stalling every request that waits behind its lock; RECALLED, §11 row 14).

  Verify: integration (two concurrent runs, one waits and then proceeds or exits 1; a migration blocked by an open transaction fails within the timeout, with the test's small override).
- AC-35: **Failures stop the run.** A failing migration rolls back that file (the existing runner), stops the run, skips the grants step and the reference seed, and exits non-zero naming the step and the file, so CI does not go on to deploy the function. The exit code is 0 only when every step succeeded. Verify: integration (a deliberately failing migration file in a scratch folder).
- AC-36: **It is repeatable.** A second run with nothing new exits 0 and changes nothing: the ACLs are identical (AC-20) and every migration is applied again without effect (the runner's existing idempotence). Verify: integration.

### 3.7 `npm run staging:admin -- <email> <role> [<tenant>] [--local-db]`

**[r2]** It is run from the owner's machine only, never by CI and never by an agent. It has **two modes**, always chosen on the command line:
- **Local-database mode (`--local-db`, available now under Spark):** the real Spark project's Firebase Auth, and the **local** database. It lets the owner create their own admin logins for the API running on this machine.
- **Deployed-database mode (no flag, DEP-1 under Blaze):** the real project's Auth and the staging database through the Cloud SQL proxy.

Both write the same rows and share AC-37 to AC-40.

- AC-37 [r2]: **Input is checked before anything is written.**
  - The email is valid, at most 254 characters (`AppUser.Email`), and is lower-cased before it is used anywhere (Firebase lower-cases emails; RECALLED, §11 row 10; DC-18).
  - The role must be an **active row of the `Role` table**, read from the database, not a list in the tool (rule 5).
  - The tenant, when one is needed, must be an active existing tenant, named by its `Code`.
  - A platform role (`IsPlatformRole`, SUPERADMIN) takes **no** tenant, and a tenant given for it is refused (confirmed by L186). Any other role requires one, and a missing tenant is refused.
  - An email ending `@gabay.test` is refused (the six test accounts have known passwords and never reach a real Firebase project).
  - Anything else on the command line is refused.

  Each refusal is one plain line, exit 1, and nothing is written to the database or to Firebase. Verify: unit and integration, one case per refusal.
- AC-38 [r2]: **The order of work.**
  1. Validate (AC-37), reading `Role` and `Tenant`.
  2. Make sure the Firebase user exists. The Admin SDK creates it **with no password** if it does not (reuse it if it does; RECALLED, §11 row 10).
  3. In **one database transaction**, insert the `AppUser` row if absent (`FirebaseUid`, `Email`, `DisplayName`, `IsActive` true, audit columns NULL, as outside a request, standard §3.18), the `UserRole` row if absent, and the venue grants of AC-39.
  4. Last, generate the password-setup link and print it once to stdout.

  The link is never written to a file, a log or a table. Gabay never holds a password (PH2 Q4). Every run, including a re-run for the same email and role, prints a fresh link, because a link expires (RECALLED, §11 row 10), so a re-run is how the owner gets another. A re-run adds no duplicate rows. Verify: integration with a fake Admin auth object.
- AC-39 [r2]: **Venue scope (settled by SEC-1's ruling, relayed in L186).** MALL_ADMIN and SUPERADMIN are tenant-wide: the tool writes **no** `UserVenueGrant` for them. For **VENUE_EDITOR and VIEWER** it writes, in the same transaction, a `UserVenueGrant` for **every venue the tenant has at that moment** (`UQ (UserId, VenueId)` makes a repeat harmless), and it never removes one.
  - A venue drawn afterwards is not covered, so the owner **re-runs the tool after adding venues**; the run's output line says how many grants it added, and, for a tenant with no venues yet, says so and tells the owner to re-run.
  - A user who is VIEWER in one tenant and MALL_ADMIN in another gets grants only for the first.

  Verify: integration (each role; a re-run after a new venue adds exactly the missing grant; no grant for MALL_ADMIN or SUPERADMIN).
- AC-40: **Failure and conflict.**
  - If the Firebase call fails, nothing is written to the database.
  - If the transaction fails after the Firebase user was created, the Firebase user stays. The tool says so in one line, and a re-run reuses it.
  - An `AppUser` row with this email and a **different** `FirebaseUid` is refused, and the UID is never overwritten.
  - A unique violation from two runs at once is read as "already there": a clean line, never a stack.
  - A user who already holds a role in another tenant gets the new `UserRole` row added.

  Verify: integration.
- AC-41 [r2]: **It cannot be pointed at the wrong world.** Common to both modes:
  - It reads the **process environment only**, never the repository's `.env`: `PG*` for the database, and a new key `STAGING_PROJECT_ID` for the Firebase project (not `FIREBASE_`-prefixed). It requires `STAGING_PROJECT_ID`.
  - It refuses when `FIREBASE_AUTH_EMULATOR_HOST` is set and when the project id starts with `demo-`, so it can never create a user in the emulator by mistake, nor a real user from an emulator-configured shell.
  - It states which mode it is in. **Local-database mode refuses unless `PGDATABASE` matches the local allow-list of AC-46. Deployed-database mode refuses when it does.** So a real Auth project is paired with a local database only by the explicit `--local-db` flag, never by accident, and the deployed database is never reached with the flag.
  - Before writing, it prints the mode, the project, the database and host, and the user.
  - It never prints a token, a password or the database password.

  The refusals above are not reachable from the library entry that the tests use, which takes the database client and the auth object as arguments. Verify: unit (each refusal, both modes); review.
- AC-42: **Tests use no cloud and no emulator.** The tool's logic is a library function over an injected database client and an injected Admin auth object. The tests run it on a throwaway database with a fake auth object (create, get by email, generate link), with no network and no Auth emulator. Verify: `npm run api:test` or `tools:test` (the plan says which).
- AC-56 [r2]: **The credential, stated.** The tool's Google credentials are the owner's **own login**, as Application Default Credentials created on their machine (`gcloud auth application-default login`; RECALLED, §11 row 10), for an account that may create users and generate email-action links in the project (the project's Owner has this; the narrower role's name is read before build, RECALLED). The tool reads **no key file**, takes none from the repository, and accepts no service-account key as an argument. The Admin SDK is initialised with the explicit `STAGING_PROJECT_ID`. The Firebase Authentication service must be set up on the project with the email-and-password provider on (an owner step in the console; RECALLED, §11 row 10). Verify: unit (the tool initialises the SDK with the project id and no credential file); review; manual (owner, first real use, below).
- AC-57 [r2]: **A missing credential or project is a plain line.** With no Application Default Credentials, an expired login, a project that does not exist, a project without Auth set up, or an account without the permission, the tool prints one plain line that names the cause and the fix (for example, "sign in again with `gcloud auth application-default login`"; RECALLED), exits 1, and has written nothing to the database. It never prints the SDK's raw error text, a token or a key path (the text can name project details). Verify: unit (a fake auth object that fails in each way).
- AC-58 [r2]: **The owner's first real use (local-database mode) is the real-Auth proof under Spark.** The owner runs `npm run staging:admin -- <email> SUPERADMIN --local-db` and then a tenant-scoped role for their own address, against the Spark project and the local seeded database, and pastes the output (link redacted). It shows that the Admin SDK creates a password-less user, generates a link, and that sign-in with the link-set password reaches the local API. This is the only real-Firebase proof DEP-0 needs, and no cloud resource other than Auth is used. Verify: manual (owner, first real use), output pasted.

### 3.8 The seed policy as code

- AC-43: **Reference data** is `seedPlatform`'s rows, written by `db:deploy`'s first run (AC-31) and afterwards only by migrations. The permission rows are SEC-1's migration. DEP-0 changes neither. Verify: AC-31's test.
- AC-44 [r2]: **Test data is loaded only by an explicit command,** `npm run staging:seed` (DC-19). It is **built and proven on a throwaway local database in DEP-0; running it on the staging database is DEP-1's.** It creates the tenant `DEMO_MALLS` and its four invented venues, reading only `db/seeds/sources/demo/*.json`. It writes **no** `AppUser`, `UserRole` or `ShopperAccount`, creates no `SPIKE_VENUES` tenant, reads no `internal/` or `spike*` source, and starts no Auth emulator. It uses the process environment only (as AC-41), prints its target first, and, like the deployed-database mode of `staging:admin`, refuses a database whose name matches the local allow-list (the local seed is `seed`).
  - It is **create-only**: if the tenant `DEMO_MALLS` exists, it refuses with one line, deletes nothing and writes nothing. The existing seed deletes the tenant's `UserRole` rows before it re-creates the tenant (`TENANT_TABLES` in `lib/run.js`), which on staging would remove the owner's logins; so the staging command never uses that path.
  - A sources folder holding a penthouse file and spike exports is never read.

  Verify: integration on a throwaway database (a run creates exactly the tenant and four venues and no account; a second run refuses and changes nothing; a sources folder with `internal/penthouse.json` and a spike export leaves `SPIKE_VENUES` absent).
- AC-45: **CI never seeds.** A test in the style of `tools/test/workflows.test.js` fails if any workflow file whose name starts `deploy` runs `setup-db`, any `seed` script or any `staging:` script. The existing `lint` and `e2e` workflows may run `setup-db` and the seed on their own throwaway CI database, and are not covered. Verify: `tools:test`.
- AC-46: **The destructive tools refuse a deployed database.** `setup-db` and the dev seed (`seed`, `seed:db-only`) refuse to run unless `PGDATABASE` matches the local allow-list: `gabay_dev`, `gabay_wt_<name>` (CLAUDE.md), and the scratch names the tests make. The allow-list is one constant in one place, and AC-41 and AC-44 read the same one. The refusal is one line naming `db:deploy` and exits 1 before any statement. A host check would not do, because the Cloud SQL proxy listens on 127.0.0.1 (DC-17). Verify: unit (each name class); the existing seed and setup-db tests pass unchanged.

### 3.9 The Hosting block and CORS

**[r2]** The block is written and tested now, but nothing is deployed to Hosting before Blaze. Its proof is static tests and the local Hosting emulator; the check on the real page is DEP-1's.

- AC-47: **`firebase.json` gains a `hosting` block** (E-05) with:
  - `public` set to the admin build folder (`app/build/web`);
  - the single-page rewrite, `**` to `/index.html`, and no rewrite to the function;
  - on every path, these headers: a `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff` and a `Referrer-Policy` (DC-21; the header syntax is RECALLED, §11 row 11).

  The Functions emulator health check in `npm run verify` still passes. Verify: `tools:test` (the parsed `firebase.json` has each header on `**` and the rewrite); `npm run verify`.
- AC-48 [r2]: **The policy is the strictest that lets the real page work** (DC-22).
  - It has `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`.
  - It has no `unsafe-eval` for scripts. WebAssembly may be allowed if the build needs it (RECALLED, §11 row 12).
  - Its `connect-src` names `'self'`, the API's own origin and the Firebase Auth endpoints that SEC-3's sign-in uses, as exact hosts and never a wildcard scheme.
  - The API's origin is the function's URL for the project, which **exists only after the first deploy under Blaze**. Until then the policy carries the URL pattern read before build (RECALLED, §11 row 13), and DEP-1's first deploy confirms it and corrects the line if it differs (a `firebase.json` edit that DEP-1 owns). The page can also be tried locally with the API at `http://localhost`, so local runs use a build-time local origin that is not in the committed policy.

  The page loads, signs in and lists venues under this policy with no policy violation in the browser's console. Verify: `tools:test` (static: each directive above; no `unsafe-eval`; no bare `*`; an API origin in `connect-src`); manual (owner or test-verifier, in a browser, with the Hosting emulator serving the build against the local API and the Spark project's Auth); manual (DEP-1, on staging at the check). Console output pasted both times.
- AC-49 [r2]: **CORS lists exactly the two staging origins** for the project id: `https://<projectId>.web.app` and `https://<projectId>.firebaseapp.com` (for `gabay-staging`, `https://gabay-staging.web.app` and `https://gabay-staging.firebaseapp.com`; E-05), the project id coming from one constant. Each is allowed. A third origin is refused. A request with no `Origin` passes (as today). The empty-list loud warning stays. The env table carries the value (AC-25). Verify: API test with that value.
- AC-50: **The admin build command is documented** in the runbook and in INSTALL: `flutter build web -t lib/main_admin.dart --release --dart-define=API_BASE=<function URL>/api`. The existing release guard in `app_config.dart` (a missing or local address refused) is unchanged. Verify: review.

### 3.10 The runbook's staging section and the staging check template

- AC-51 [r2]: **`docs/ops/DEPLOYMENT_RUNBOOK.md` gains a "Staging (`<projectId>`)" section.** It opens with the **current state under L186**: Spark plan, real Firebase Auth only, API and database on this machine, no function or database deploy until Blaze, and the SQL Connect trial archived if the project is not upgraded. The sections that need a real resource are written as **the plan for DEP-1**, and are marked so. The section holds:
  - the project and region (L184, L186); the instance (its name, size, public IP, that it came from SQL Connect, and the trial's start and end dates, with the owner's keep, downsize or stop decision before it ends), to be filled at DEP-1;
  - the two logins and the grants table (AC-19, AC-20); the secret's name and who can read it (AC-24); the env table (AC-25); the bucket (AC-11);
  - how to run `staging:admin --local-db` now (the Application Default Credentials login of AC-56, the `PG*` and `STAGING_PROJECT_ID` variables), and, for DEP-1, `db:deploy`, `db:deploy -- --init-roles`, `staging:admin` and `staging:seed` through the Cloud SQL proxy with the owner's own Google login (RECALLED, §11 row 15); and the command that is never run against staging (`setup-db`);
  - **the no-refusal line** (Q7 (b), L151): "a deploy with `NODE_ENV` missing or wrong starts anyway; after every deploy, read the startup line (AC-28) and the staging check";
  - rollback (code by a revert on `main` and a CI redeploy, or `workflow_dispatch` with an earlier commit; Hosting by the previous release; the database forward-only, fixed forward or rebuilt; the pause switch `STAGING_DEPLOY=off`, a repository variable that DEP-1 reads);
  - monitoring (the uptime check on `GET /api/health`, the 5xx alert, the USD 5 budget alert), to be created at DEP-1;
  - the standard §6 item 12 line: for **production**, the database is read-only without explicit per-request permission, and the e2e suite and the seed scripts are banned from it for ever; for **staging**, `gabay_api` is the function's login, `gabay_migrate` is CI's, and the owner reaches the database through the proxy;
  - the pool-of-one note (EC-9);
  - rows 1, 4, 5, 7 and 9 of the phase table updated for staging, and the E-20 warning lines at the top revised to the L184 amendment and L186's Spark state (no deploy while E-20 is open, except staging, and no staging deploy before Blaze).

  Verify: review.
- AC-52 [r2]: **The staging check template** is `docs/ops/STAGING_CHECK_TEMPLATE.md` (DC-23). It is **written in DEP-0 and filled in at DEP-1**. It lists the standard §6 items 1 to 6, 8 to 10 and 12 (the numbering of DEPLOY-staging §1), each with the evidence to paste, and notes item 7 (uploads: the bucket is private, OA-2's posture reviewed) and item 11 (webhooks: not applicable). It adds the DEP-0 lines:
  - the startup line (AC-28);
  - the cold-start time (AC-18);
  - the 15 MB upload (AC-12);
  - a count of `AppUser` rows ending `@gabay.test` equal to 0 and no `SPIKE_VENUES` tenant (AC-37, AC-44);
  - a VIEWER's publish refused and a VENUE_EDITOR's refused (SEC-1's rule shown on staging);
  - a guarded route answering 503 while the instance is stopped, not an open door (standard §6, fail-closed; the stop control is RECALLED, §11 row 4);
  - a sign-in with an unsigned token refused (AC-26).

  Verify: review.

### 3.11 What `npm run verify` needs, and the companion files

- AC-53 [r2]: **Nothing in `npm run verify` needs cloud credentials, a cloud network call or a cloud SDK.** With no Google credentials on the machine, `npm run verify` ends `ALL GREEN`. In host mode with the local store, loading `functions/src` never loads `@google-cloud/cloud-sql-connector` or constructs a Storage client (the test checks the module cache). The real-bucket script (AC-8), the spike and every `staging:*` command run against a real project are outside it. Verify: unit (module cache); `npm run verify` output pasted with `GOOGLE_APPLICATION_CREDENTIALS` unset.
- AC-54 [r2]: **The companion files follow in the same change:**
  - CLAUDE.md's Commands (`db:deploy`, `staging:admin` with `--local-db`, `staging:seed`), README, INSTALL (the Application Default Credentials login and the variables for `staging:admin --local-db` now, and the proxy steps for DEP-1);
  - `.env.example` (`FILE_STORE`, `GCS_BUCKET`, `CLOUD_SQL_INSTANCE`; the `FIREBASE_` comments, including that `FIREBASE_PROJECT_ID` is the way to run the local API against the Spark project's Auth);
  - Blueprint Part 1 (E-29's pin) and Part 4's config notes;
  - EXCEPTIONS (E-29);
  - `plan/PH4-feature-first.md` §7: the storage row ("closed at the deploy call") is updated, and closed at DEP-1's first deploy, not at DEP-0's merge;
  - the runbook and the check template (AC-51, AC-52);
  - the Smoke_Test_Guide gains a staging phase that points to the template.

  Verify: review (the sync-table pass by dod-reviewer).
- AC-55: **Every RECALLED claim in this spec is replaced** in the plan by a pasted doc excerpt or a command's output, before the criterion it feeds is built; those that need a real resource are replaced at the point named in §11 (AC-1). Verify: review.

### 3.12 Where each proof happens [r2]

- **Proven in DEP-0, locally, with no cloud resource:** AC-3 to AC-8 and AC-10 (the contract suite and the API over the fake bucket), AC-13 to AC-17 (config modes, the connector with a fake, the pool of one, failures, logs), AC-19 to AC-23 (the logins and grants on a throwaway database), AC-24 to AC-29 (as unit tests and review), AC-30 to AC-36 (`db:deploy`), AC-37 to AC-42 and AC-56, AC-57 (`staging:admin` with a fake auth object), AC-43 to AC-46 (the seed policy), AC-47 to AC-49 (static tests and the Hosting emulator), AC-50 to AC-55.
- **Owner-run on this machine with the real Spark project's Auth, no deploy:** AC-58 (first real use of `staging:admin --local-db`).
- **Deferred to DEP-1's first deploy under Blaze, run by the owner or CI:** the socket-versus-connector spike (§2.1) and AC-14's real connection; AC-9's and AC-8's real-bucket confirmation, AC-11's public-URL refusal, AC-12 (the 15 MB upload); AC-18 (cold start); AC-24, AC-25 and AC-26's deployed parts; AC-19 and AC-44 run on the instance; AC-48's check on staging; AC-51's and AC-52's filled sections.

## 4. What changes (C1)

An existing test changes only when `plan/DEP-0.md` names it and this spec's reason. The plan names each case.

| File | Action | Why |
|---|---|---|
| `functions/src/services/storage/gcsFileStore.js`, `createFileStore.js` | new | AC-3 to AC-5 |
| `functions/src/config/index.js` | change | `FILE_STORE`, `GCS_BUCKET`, `CLOUD_SQL_INSTANCE` and `PGHOST` becoming conditional (AC-3, AC-13) |
| `functions/src/db/index.js` | change | the connector mode, `close()` (AC-14, AC-16, AC-17) |
| `functions/src/app.js` | change | the store from the factory, the startup line (AC-4, AC-28) |
| `functions/index.js` | change | the one secret (AC-24); stays inert |
| `db/tools/deploy.js` and its lib files | new | AC-19 to AC-20, AC-30 to AC-36 |
| `db/tools/setup-db.js`, `db/seeds/seed.js` | change | the local-name guard (AC-46) |
| `db/seeds/` (the staging seed command and its library entry) | new | AC-44 |
| `tools/staging-admin.js` (or `db/tools/`; the plan names it) | new | AC-37 to AC-42, AC-56 to AC-58 |
| `firebase.json`, root `package.json`, `.env.example` | change | AC-47, AC-54 |
| `functions/test/storage.localFileStore.test.js` | change | the interface cases move into the shared contract suite (AC-8); the local-only cases (temporary name, nothing on disk before the first `put`, path escape) stay |
| `functions/test/venueApp.js`, `venueMaps.backdrops.test.js` (and the publish tests that write packages) | change (helpers) | the store becomes a parameter, so the same assertions run over `GcsFileStore` and the fake (AC-10) |
| `functions/test/config.test.js`, `config.firebase.test.js` | change (added cases only) | the new keys and modes (AC-3, AC-13, AC-26) |
| `functions/test/db.test.js`, `db.connection-errors.test.js` | change (added cases only) | the connector mode and its failures (AC-14, AC-16) |

Not touched: `functions/test/index.test.js`, `config.devOnly.test.js`, every OA-1 and OA-2 assertion, `db/seeds/test/**`, and `memoryFileStore.js` (it joins the contract suite as it is).

## 5. Edge cases

Each is covered by the criterion named, or has a one-line reason. **[r2]** marks a changed or new one.

**Offline, stale and the gap between deploys**
- EC-1: The shopper app never points at staging (Q5 (a)), so no shopper package is stale there. Not applicable; the package files are still stored through the same interface (AC-10).
- EC-2: The migrations run before the new function is deployed, so the old function runs for a moment on the new schema. Migrations are additive (rule 4), and default privileges give the old and new code the same access to new tables (AC-20, AC-21). Proven locally on a throwaway database; the gap itself exists only at DEP-1.
- EC-3: A deploy replaces the instance while a publish is `BUILDING`. OA-2's stale-build recovery marks the row `FAILED` at the next publish (OA-2 AC-27). DEP-0 adds no behaviour; the runbook says to expect it. (The drain time of a replaced instance is RECALLED, §11 row 13.)
- EC-4: A migration blocked behind a long transaction fails at `lock_timeout` and rolls back, and the deploy stops (AC-34, AC-35).

**Empty and maximum data**
- EC-5: An empty Buffer is stored and read back (AC-8). A 15 MB Buffer is stored whole (AC-8, AC-12).
- EC-6: A key longer than `StoredFile.StoragePath` (400) cannot arise: the services build keys of about 70 characters (OA-2 AC-38), and a bucket's object-name limit is far above that (RECALLED, §11 row 7). The contract suite uses the longest key the services make.
- EC-7: A bucket with no objects, or a first run on an empty bucket: `get` and `exists` answer `null` and `false` (AC-5).
- EC-8: An empty database: `db:deploy` builds it (AC-31). A `gabay` schema with no tables counts as empty (AC-32).
- EC-9: **A pool of one has two consequences.** (a) A transaction that holds the connection while another query waits for a connection would wait for itself, so AC-15 proves none does. (b) A long statement (a publish; the statement timeout is 60 s) holds the only connection, so `GET /api/health` and every other request wait up to `PG_CONNECT_TIMEOUT_MS` and then answer 503, which can fire the 5xx alert. This is the plan's pool size (Google's advice, DEPLOY-staging §3). The runbook says so, and the code is not changed (see Suggestions).

**Tenant boundary**
- EC-10: Keys carry the tenant (OA-2), and the store itself is tenant-blind. The tenant check lives in the services, and AC-10 re-proves it over `GcsFileStore`.
- EC-11: `staging:admin` takes a tenant by `Code` and refuses an unknown or inactive one (AC-37). A user may hold roles in two tenants (AC-40, AC-39).
- EC-12: The staging seed creates only `DEMO_MALLS` and never touches another tenant's rows (AC-44).

**Each role**
- EC-13 [r2]: `staging:admin` creates each of the four roles: SUPERADMIN with no tenant and no grants; MALL_ADMIN with a tenant and no grants; VENUE_EDITOR and VIEWER with a tenant and a grant for each existing venue (AC-37, AC-39). The role guards themselves are SEC-1's, and the staging check shows a VIEWER's and a VENUE_EDITOR's publish refused (AC-52, DEP-1).
- EC-14: A role code that is inactive or not in the `Role` table is refused, never created (AC-37; FEATURE_PIPELINE item 15, §6).
- EC-33 [r2]: A VENUE_EDITOR or VIEWER whose tenant has no venues yet gets the role and no grants, and the run's output says to re-run after a venue is added (AC-39).

**Permission denied**
- EC-15: The bucket refuses the function (a wrong role): the upload answers 500 with no leak and leaves no row (AC-7).
- EC-16: `gabay_api` is refused a DDL statement or an `AuditLog` update (AC-21), and that refusal never reaches a response as driver text (the existing error handler; SEC-2's `raw-error-text` lint).
- EC-17: The Secret Manager secret is unreadable by the function's account: the function cannot get its password and the first query fails as 503 (AC-16). The runbook names the one role needed (RECALLED, §11 row 2).
- EC-34 [r2]: The owner's Google login lacks the permission, has expired, or the project has no Auth set up: `staging:admin` prints one plain line and writes nothing (AC-57).

**Concurrent edits**
- EC-18: Two `put`s on one key (AC-6). Two `db:deploy` runs (AC-34). Two `staging:admin` runs for one email (AC-40).
- EC-19: A rotated password: the old instance keeps the old secret until it restarts, and the new login password is already set, so it fails until the new instance starts (AC-29: the runbook's order avoids a gap by setting the database password first and deploying promptly; a few failed requests on staging are accepted).

**Publish in progress**
- EC-20: See EC-3. A `db:deploy` during a publish waits for `lock_timeout` at worst (AC-34).

**Invalid input**
- EC-21: `staging:admin` with a bad email, an unknown role, an unknown tenant, a tenant on SUPERADMIN, no tenant on the others, a `@gabay.test` email, extra arguments, and a differently cased email for an existing user (AC-37, AC-40).
- EC-22: `db:deploy` with a missing `PG*` key, with a `.env` and an empty environment, and with `--init-roles` combined with another step (AC-19, AC-30).
- EC-23: A `FILE_STORE` value that is neither `local` nor `gcs`, `gcs` with no bucket, both connection modes, neither (AC-3, AC-13).
- EC-24: A store key such as `../x` or `/abs` is refused before anything reaches the bucket (AC-5).
- EC-35 [r2]: `staging:admin --local-db` against a database whose name is not on the local allow-list, and the deployed-database mode against one that is, are both refused; so are an emulator host in the environment and a `demo-` project id (AC-41).

**The deployed environment and the Spark state**
- EC-25: `NODE_ENV` missing on a deployed function: it starts (Q7 (b)). Nothing but the emulator-host guard depends on it (AC-27), and the startup line shows it (AC-28).
- EC-26: `FILE_STORE` left at `local` on a deployed function: it starts, and uploads go to the function's disk, which is lost. The startup line shows `local` (AC-28), the check's upload test shows the object missing from the bucket (AC-12), and the runbook names it. A refusal is a boot refusal, which Q7 (b) declined (see Suggestions).
- EC-27 [r2]: The project id `gabay-staging` is taken and the fallback `gabay-staging-dq` is used (L186): the two CORS origins, the function URL, the `.env.<projectId>` file name and the instance connection name all change. The runbook's tables use `<projectId>`, and the CORS test takes its two origins from one constant (AC-49).
- EC-28: `@google-cloud/storage` is an **optional** dependency of `firebase-admin` (read locally). If the deployed function's install leaves it out, `getStorage()` fails at the first upload. This is checked at DEP-1's first deploy (RECALLED, §11 row 8). If it is absent, the plan pins `@google-cloud/storage` directly, with a Blueprint pin and an E-entry (DC-1).
- EC-29 [r2]: The SQL Connect trial is archived if the project is not upgraded (L186). If the owner upgrades later, the trial's terms and dates are read then (RECALLED, §11 row 4), and the runbook records them.
- EC-30: The instance is stopped or unreachable: `GET /api/health` answers 503 within `PG_CONNECT_TIMEOUT_MS`, and guarded routes answer 503 (AC-16, AC-52).
- EC-31: A first request after a long idle (a cold start with the connector's handshake) can be slow (AC-18, DEP-1).
- EC-32 [r2]: The socket is untested until DEP-1's spike. If it is chosen then, AC-13's host mode already covers it with `PGHOST=/cloudsql/<instance>`, and the connector mode and E-29 are removed (AC-2).
- EC-36 [r2]: Re-seeding the local database (`npm run seed` or `setup-db`) removes the owner's `UserRole` and `UserVenueGrant` rows for the seeded tenants (`TENANT_TABLES` in `lib/run.js`; `setup-db` drops every table), and `seed` removes only the six `@gabay.test` accounts' `AppUser` rows, not the owner's. So after a re-seed the owner **re-runs `staging:admin --local-db`**, which reuses the Firebase user and prints a fresh link (AC-38, AC-40). The runbook and INSTALL say so.
- EC-37 [r2]: The API on this machine verifying a **real** Spark token asks the Admin SDK to check revocation (`verifyIdToken(token, true)` in `firebaseVerifier.js`), which may need credentials on this machine too (RECALLED, §11 row 18). Whether it works with Application Default Credentials or needs more is read before build and noted for SEC-1 and SEC-3 (§10). Not a DEP-0 criterion.

## 6. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | No | No table or column changes. The grants are a separate idempotent step of `db:deploy`, not in `schema.sql`, because the two roles exist only on a deployed instance |
| 2 Seed | Yes | The seed policy as code: the reference seed through `db:deploy`, the create-only `staging:seed`, the local-name guard (AC-43 to AC-46) |
| 3 Guard order | No | DEP-0 adds no route |
| 4 Permission and menu rows | No | DEP-0 adds no route; SEC-1's migration holds the rows |
| 5 Scaffolds, `formatApiError`, four states | No | No screen |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | No | No colour |
| 9 Automated e2e | No | No new route or screen. Stage S ends the waiver for new routes (L184), and there is none here. The staging check template is the end-to-end evidence, filled at DEP-1 (AC-52) |
| 10 Manuals and smoke guide | Yes, in part | The Smoke_Test_Guide gains a staging phase (AC-54). The two E2E manuals do not change: no route and no screen |
| 11 Changelog | No | Nothing visible in either app changes |
| 12 Companion-file sync table | Yes | Rows: a command (`db:deploy`, `staging:admin`, `staging:seed`: CLAUDE.md, README, INSTALL), a setting (`.env.example`, the Blueprint), a dependency (E-29, Blueprint pin), the retrofit ledger's storage row (AC-54) |
| 13 Every field a `FieldSpec` | No | No form |
| 14 New enumerable sets | No new set | `FILE_STORE`'s two values and the two connection modes are a deploy-time configuration choice, not a list a client could extend (rule 5). The role codes `staging:admin` accepts are read from the `Role` table (AC-37) |
| 15 Inactive-lookup case | No | No historical record is saved. An inactive role or tenant is refused as a new assignment (EC-14) |
| G1 Traceability | Yes | Every AC and EC maps to a test or a one-line reason; the manual ones name who runs them, and §3.12 says when |
| G2 Wording and accessibility | No | No screen and no shopper phrase. The tools' messages are English, as the admin page is (L165) |
| G3 Offline and position privacy | No | No shopper feature |
| G4 Differences recorded | Yes | A new L-row at merge records: the configuration modes, the two logins and their grants, the Hosting headers, the `staging:*` commands, E-29, and that proof of the cloud parts moves to DEP-1 under Blaze |

## 7. Scale targets

| Target | Source | How this spec meets it |
|---|---|---|
| One Function instance, `maxInstances = 1`, `asia-southeast1` | L98; `functions/index.js`; E-09 | AC-15 (pool of one), EC-9 |
| About 5 mall-operator tenants at the pilot; peak concurrent users and requests per hour measured at the pilot | PRD §7 | No throughput or latency target is stated for staging, and none is invented. Staging has one user (Q3 (a)). The cold-start time and the 15 MB upload are recorded at DEP-1 and not gated (AC-12, AC-18) |
| Backdrop images up to 15 MB; venue map documents up to 4 MiB (stored in the database, not the bucket) | OA-2 AC-38, AC-23 | The store holds a file whole in memory; AC-8 and AC-12 use the 15 MB size |
| Map packages 0.3 to 3 MB gzipped, unverified until measured | PRD §7 | Far below the backdrop size, so the whole-buffer interface needs no change (DC-3) |
| Cloud SQL: the smallest shared-core size, no SLA (plan §3) | `plan/DEPLOY-staging.md` §3 | Accepted for staging; the pool and the health behaviour are EC-9 |

## 8. Design choices

Each is a DESIGN CHOICE, not a requirement, and names an alternative that also meets what is stated.

- **DC-1** `GcsFileStore` uses `firebase-admin`'s Storage (E-09 names it) and adds no direct dependency. *Alternative:* pin `@google-cloud/storage` directly, with a Blueprint pin and an E-entry. It becomes the better choice if DEP-1 shows the optional dependency is absent from the deployed install (EC-28).
- **DC-2** `put` refuses an existing key with a create-only write precondition. *Alternative:* `exists` and then write, which two writers can race. Rejected: the interface says a stored file never changes.
- **DC-3** The interface stays whole-buffer. *Alternative:* streams. They need a change to the interface and to every caller, and no file here is larger than 15 MB.
- **DC-4** The GCS store is tested without credentials against an injected **fake bucket**, plus an owner-run real-bucket script at DEP-1. *Alternatives:* (a) the Firebase Storage emulator, which needs Java (source check 2026-10-08, recorded in `setup-db.js`: `firebase-tools` 15.32.1 needs Java for the Firestore, Realtime Database and Storage emulators) and would add a second tool to every run of `npm run verify`; (b) a `fake-gcs-server` container, which needs Docker; (c) a real bucket in CI, which needs cloud credentials, against AC-53. The fake can drift from the real service, which is why AC-9 requires a confirmation, now deferred to DEP-1.
- **DC-5** The store is chosen by an explicit `FILE_STORE` key. *Alternatives:* choosing it from `NODE_ENV=production` (an implicit coupling, and a mistaken `NODE_ENV` would silently change where files go); choosing it from the presence of `GCS_BUCKET`.
- **DC-6** The connector package is loaded only in connector mode, and the connector is created on the first connection. *Alternative:* load it always. That slows every cold start and every test for a mode they do not use, and loading must stay inert (`index.test.js`).
- **DC-7** `PG_POOL_MAX=1` is an env value, and the code default stays 10. *Alternatives:* a default of 1 in code, which would slow the local suite; a pool of 2, which keeps `GET /api/health` from waiting behind a long statement (EC-9) but departs from the checked advice. For AC-15 the plan chooses between a lasting guard (the API suite run a second time at pool 1 as one more `verify` check, at the cost of one more suite run) and a one-off run at the slice's review (no lasting guard).
- **DC-8 [r2]** The connector mode is **built now behind configuration**, proven only with a fake, and the socket is left untested; the spike runs at DEP-1's first deploy under Blaze. *Alternative:* wait for Blaze and run the spike first. That has no risk of rework (if the socket wins, no connector code and no E-29 are ever written), but it blocks DEP-0's connection work until the owner upgrades. It would be the better choice if the owner's upgrade is near or the connector's cost (an E-entry and a dependency) is unwelcome.
- **DC-9** The spike's three redeploys (unchanged, changed source, changed env value) are this spec's own procedure, because no number is stated. *Alternative:* one redeploy, quicker but weaker evidence.
- **DC-10** The two logins are created by a tested mode of `db:deploy` (`--init-roles`), run once by the owner with the admin login. *Alternative:* a block of SQL that the owner pastes into the console's SQL editor (RECALLED, §11 row 4). That is simpler, but it cannot be tested and cannot also rotate a password.
- **DC-11** The grants are an idempotent step of `db:deploy`, with default privileges. *Alternative:* grants inside migrations. They would fail on every local database, where the roles do not exist.
- **DC-12** `gabay_api` gets `SELECT` and `INSERT` only on `AuditLog`. *Alternative:* the same four privileges on every table. Simpler, but the audit trail could then be edited by the login the function runs as (standard §6, the audit item).
- **DC-13** `db:deploy` takes an advisory lock. *Alternative:* rely on CI's `concurrency` group alone, which does not cover a manual run by the owner.
- **DC-14** `db:deploy` sets a `lock_timeout`. *Alternative:* none. A blocked migration would then queue behind a long transaction and stall every request that waits behind its lock (RECALLED, §11 row 14). Its value is a named constant that the plan proposes as provisional, because none is stated.
- **DC-15** The order is schema, migrations, reference seed, grants: the same as `setup-db`'s dev mode, so the two paths build the same database (AC-31). *Alternative:* the reference seed before the migrations. That would make a migration able to read `Role` rows on a first run, but the dev path would then differ.
- **DC-16** `db:deploy`, `staging:admin` and `staging:seed` read the process environment only. *Alternative:* load the repository `.env` as `migrate` does. A developer's local `.env` could then aim a deploy-time tool at the wrong database, and its `FIREBASE_AUTH_EMULATOR_HOST` would point the Admin SDK at the emulator.
- **DC-17** The destructive tools refuse by **database-name allow-list**. *Alternatives:* a host check, which the proxy defeats (it listens on 127.0.0.1); a marker row that `db:deploy` writes into a deployed database and the destructive tools look for, which does not depend on the name, and could be added beside the allow-list later.
- **DC-18** `staging:admin` lower-cases the email, takes the `DisplayName` from the email's local part, prints a fresh link on every run, and refuses `@gabay.test`. *Alternatives:* a fourth argument for the display name; printing a link only for a new user, which leaves no way to get a new one after expiry.
- **DC-19** The Demo Malls test data is loaded by a new, create-only `npm run staging:seed`. *Alternatives:* a flag on the existing `seed` (it deletes and re-creates tenants, and with them `UserRole` rows, which on staging would remove the owner's logins); a flag on `db:deploy` (CI runs it, and CI must never carry test data).
- **DC-20** The app logs one startup line (AC-28). *Alternative:* the runbook line alone, which asks the owner to know the values without seeing them.
- **DC-21** The Hosting headers include `nosniff` and a referrer policy beside the three the intent names. *Alternative:* only the three named.
- **DC-22** The CSP is written to match what the real build needs, found by running it, and then checked by a static test. *Alternative:* a policy copied from a template, which would either break the page or be too loose to mean anything.
- **DC-23** The staging check template is its own file. *Alternative:* a section of the runbook, which would mix a procedure with a form that is filled in each time.
- **DC-24 [r2]** `staging:admin`'s local-database mode is chosen by an explicit `--local-db` flag, and each mode refuses the other's database (AC-41). *Alternatives:* a separate command for the local case (a fourth script to learn, with the same code); deciding the mode from the database name alone, which would let a mistyped or renamed database silently cross over.
- **DC-25 [r2]** Venue grants for VENUE_EDITOR and VIEWER are written for every existing venue at run time, and the owner re-runs the tool after adding venues (SEC-1's ruling, relayed in L186). *Alternative:* a fourth argument naming venues (r1's Q1 (c)): more to remember, and no better coverage of venues added later.

## 9. Not in scope

- **Any deploy of a function, a database, a bucket or Hosting, and the move to Blaze** (L186): DEP-1 and the owner. The spike (§2.1) and every item in §3.12's last list.
- The project's creation, its billing, the budget, the instance, the bucket, the service accounts and Workload Identity Federation, and `.github/workflows/deploy-staging.yml` with its `push: main` e2e trigger and the check-runs gate: **DEP-1** and the owner's console steps. The one console step DEP-0's tool needs is a project with Authentication set up and the email-and-password provider on (AC-56); that is the owner's.
- Production: a separate project and a named release authorization (standard Stage 5; L109).
- The admin API and user screens (R6, R9): accounts on staging, and now the owner's own local logins, are made by `staging:admin`.
- Any route, table, column or guard change; SEC-1, SEC-2 and SEC-3's content, including how the local API on this machine is wired to verify real Spark tokens (§10).
- The shopper app pointing at staging (Q5 (a)); shopper sign-in (R10).
- Backups (off, by ruling); Cloud Scheduler or a scheduled prune; a sweep of orphaned objects.
- Cache headers for the admin page; HSTS if Hosting already sends it (the staging check reads it, item 1); custom domains.
- Rewriting the seeds as venue map documents (OA-3, H-5).
- An `AuditLog` row for `staging:admin` (the tool's own stdout is its record; see Suggestions).
- OA-5's AI key (none on staging; E-20 amended).

## 10. Notes for the plan and later slices

- **For the plan:** the order of work is step 0 (the doc reads, the connector's version from npm, E-29 requested before the install), then the store and its contract suite, then the config and the connection, then the logins and `db:deploy`, then the tools and the seed policy, then `firebase.json`, then the runbook and the template. Name the exact test cases changed in §4. Give the owner the first-use steps for AC-58.
- **For DEP-1:** it inherits the spike (§2.1), the real-bucket run, the first deploy's confirmations (the function's URL for the CSP, the optional dependency, the env file and the secret loading), the creation of the secret named `PGPASSWORD`, CI's migrate secret, the uptime check and the alerts, and the `push: main` e2e trigger. AC-45's test already constrains its workflow. It also fills the staging check template and closes the PH4 §7 storage row.
- **For SEC-1's spec:** `staging:admin` writes `AppUser` and `UserRole`, and grants for VENUE_EDITOR and VIEWER only (AC-39). Its migration must run correctly on a database built in AC-31's order (schema, migrations, then the reference seed).
- **For SEC-1 and SEC-3, under L186:** the API on this machine will verify **real** Spark ID tokens, not the emulator's. `firebaseVerifier.js` checks revocation on every token, which may need Application Default Credentials on this machine (RECALLED, §11 row 18); the owner's `FIREBASE_PROJECT_ID` is set locally and the emulator host is left empty. The two specs decide how the local run is configured; DEP-0 only documents it in `.env.example` and INSTALL.
- **For OA-3:** the staging seed command (AC-44) reads the relational demo sources until OA-3 rewrites them (H-5), and is then rewritten with them.

## 11. RECALLED, to be checked and pasted into the plan (AC-1)

None of these was checked this session unless it says "read locally". "Before build" means a public document that can be read now, with no project. "DEP-1" and "owner, first real use" mean a check that needs a real resource, so it waits.

| # | Claim (tagged RECALLED where it appears) | Document to read | When |
|---|---|---|---|
| 1 | The connector package name, current version, licence and Node support; its `pg` usage (the options it returns for a `pg` pool, the public-IP setting, closing it) | `npm view` of `@google-cloud/cloud-sql-connector`; the connector's README (github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector); cloud.google.com/sql/docs/postgres/connect-connectors | before build (needed for E-29) |
| 2 | The IAM roles: the function's account for Cloud SQL, Secret Manager and the bucket; the names and the least-privilege choice | cloud.google.com/iam/docs/understanding-roles (Cloud SQL Client, Secret Manager Secret Accessor, the Storage object roles) | before build (runbook text); proven at DEP-1 |
| 3 | The `/cloudsql/<instance>` socket on a Firebase 2nd-generation function: how it is attached, whether a later `firebase deploy` resets it; `pg` takes a socket directory as the host | the spike (§2.1); firebase.google.com/docs/functions; Cloud Run's Cloud SQL page; node-postgres docs | DEP-1 (the spike) |
| 4 | The SQL Connect instance: how it is created, its database name, its admin user and what that user may do (create roles, grant on the database), the public IP, the stop control, the SQL editor in the console, database flags, the trial's terms and its archiving without an upgrade | firebase.google.com/docs/data-connect (the pages on the Cloud SQL instance); firebase.google.com/pricing; cloud.google.com/sql/docs/postgres | docs before build; the instance itself at DEP-1 |
| 5 | `defineSecret`: the `secrets` option, the secret appearing as an environment variable of the same name at runtime only, inert at deploy-time analysis, the secret version fixed when an instance starts (`defineSecret` itself: read locally in `firebase-functions` 7.4.0) | firebase.google.com/docs/functions/config-env | before build; the deployed behaviour at DEP-1 |
| 6 | `.env.<projectId>` read from the functions folder at deploy; the reserved key prefixes and names; how the runtime sets `NODE_ENV`; `K_SERVICE` and the project id variable (`GCLOUD_PROJECT`); the Admin SDK taking the project from the runtime | firebase.google.com/docs/functions/config-env; cloud.google.com/run/docs/container-contract | before build (the reserved list); the deployed behaviour at DEP-1 |
| 7 | Cloud Storage from Node: `getStorage().bucket(name)` (the module exists, read locally), a save with `ifGenerationMatch: 0` (mentioned in the installed `file.d.ts`, read locally), the 412 on an existing object, the 404 on a missing one, the delete-missing behaviour, an upload becoming visible whole, the object-name length limit | cloud.google.com/nodejs/docs/reference/storage; firebase.google.com/docs/storage/admin/start | before build (the fake's table); the real-bucket run at DEP-1 |
| 8 | `@google-cloud/storage` is an optional dependency of `firebase-admin` (read locally) and whether the Functions deploy installs optional dependencies | firebase-admin's `package.json` (read locally); firebase.google.com/docs/functions (the deploy build); a first deploy's build log | DEP-1 |
| 9 | Bucket posture and creation: public access prevention, uniform bucket-level access, location `asia-southeast1`, and whether the Firebase default bucket or a plain Cloud Storage bucket is used | cloud.google.com/storage/docs/public-access-prevention; firebase.google.com/docs/storage | before build (runbook text); proven at DEP-1 |
| 10 | Admin SDK: `createUser` with no password, `generatePasswordResetLink`, how long a link lives, whether both work with sign-up switched off, the email's case, Application Default Credentials from `gcloud auth application-default login` on a developer machine and whether user credentials suffice for these two calls, the role a Google account needs (Firebase Authentication Admin or Owner), the Identity Toolkit API being on once Authentication is set up, the email-and-password provider setting, and the sign-up switch's name | firebase.google.com/docs/admin/setup; firebase.google.com/docs/auth/admin/manage-users; firebase.google.com/docs/auth/admin/email-action-links; the Auth settings page | docs before build; the owner's first real use (AC-58) |
| 11 | Hosting: the `headers` and `rewrites` syntax, `X-Robots-Tag`, whether Hosting sends `Strict-Transport-Security`, the Hosting emulator serving these headers | firebase.google.com/docs/hosting/full-config | before build; the real headers at DEP-1 |
| 12 | Flutter web under a CSP (WebAssembly, where CanvasKit is loaded from, inline styles) and the Firebase Auth web endpoints that `connect-src` needs | docs.flutter.dev (web renderers and deployment); firebase.google.com/docs/auth/web | before build (the Hosting emulator run) |
| 13 | The Functions v2 defaults: memory, request concurrency, request timeout, the function URL pattern, how a replaced instance drains in-flight requests | firebase.google.com/docs/functions (the function options page); cloud.google.com/run/docs | docs before build; real behaviour at DEP-1 |
| 14 | PostgreSQL 18: a multi-statement simple query runs as one implicit transaction; `ALTER DEFAULT PRIVILEGES`; privileges on an identity column's sequence; `CREATE` on `public` no longer granted to everyone; `escapeIdentifier` and `escapeLiteral` in `pg`; `log_statement` writing a `CREATE ROLE ... PASSWORD` into the server log; session advisory locks; `lock_timeout` and the lock queue | postgresql.org/docs/18; node-postgres docs; the local database proves several of these by the integration tests | before build (the local tests settle most) |
| 15 | The Cloud SQL Auth Proxy: how the owner runs it with their own login, the IAM role it needs, its local address | cloud.google.com/sql/docs/postgres/sql-proxy | before build (runbook text); used at DEP-1 |
| 16 | The uptime check, the 5xx alert and the budget alert: console paths (runbook text only) | cloud.google.com/monitoring/uptime-checks; cloud.google.com/billing/docs/how-to/budgets | DEP-1 |
| 17 | **[r2]** Spark-plan facts: Authentication, and its password-reset links, available on Spark; Hosting available on Spark; a Cloud Storage bucket for Firebase needing Blaze; Functions and the SQL Connect instance needing Blaze (the last checked 2026-10-14 by the coordinator: firebase.google.com/pricing, docs/functions/get-started) | firebase.google.com/pricing; firebase.google.com/docs/storage | before build (docs); the upgrade itself is the owner's |
| 18 | **[r2]** The API on this machine verifying a real ID token with revocation checking: whether Application Default Credentials are needed locally, and whether `FIREBASE_PROJECT_ID` alone suffices for the signature check | firebase.google.com/docs/auth/admin/verify-id-tokens | before build (the note for SEC-1 and SEC-3, §10) |

## 12. Questions for the user

None open. **[r2]** r1's two questions are settled:
- **Q1** (what `staging:admin` writes for venue scope) is settled by SEC-1's ruling as relayed in L186: MALL_ADMIN and SUPERADMIN are tenant-wide and need no `UserVenueGrant`; VENUE_EDITOR and VIEWER get a grant for every existing venue of the tenant at run time, and the owner re-runs the tool after new venues. Applied in AC-39 and DC-25. `<tenant>` is optional for SUPERADMIN (confirmed), applied in AC-37.
- **Q2** (where the spike runs) is settled by L186's Spark ruling: it cannot run without Blaze, so r2 builds the connector mode behind configuration (DC-8) and moves the spike to DEP-1's first deploy (§2.1).

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-14 | First revision, from the intent, `plan/DEPLOY-staging.md` 1.0 (with Q4 (b) and Q7 (b)), the code at `main` 7338a94, and the E-20 text as amended by L184. Raised Q1 (venue scope for `staging:admin`) and Q2 (the spike's precondition) |
| r2 | 2026-10-14 | L186's rulings: the owner has no project yet and chose **Spark with real Auth only**; API and database stay local; no function, database, bucket or Hosting deploy until Blaze. **Changed ACs:** AC-1, AC-2 (step 0 without the spike; E-29 requested when the connector is installed), AC-8, AC-9, AC-11, AC-12, AC-13, AC-14, AC-18, AC-19, AC-24, AC-25, AC-26 (cloud proofs move to DEP-1), AC-37 to AC-39, AC-41 (`staging:admin` modes; venue scope settled), AC-44, AC-48, AC-49, AC-51, AC-52, AC-53, AC-54. **New:** AC-56 to AC-58 (the credential, plain failure lines, the owner's first real use), §3.12 (where each proof happens), EC-33 to EC-37, DC-24, DC-25, §11 rows 17 and 18 and a "when" column. **Moved:** the spike (§2.1) to DEP-1, with DC-8 (connector built behind config, alternative: wait for Blaze). **Settled:** r1's Q1 (SEC-1's ruling) and Q2 (L186); no question is open |
