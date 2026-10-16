# Gabay — Staging check (template)

> **Version**: 0.1 | **Date**: 2026-10-16 | **Status**: written in DEP-0 (spec/DEP-0.md r2 AC-52, DC-23), **filled in at DEP-1's first deploy under Blaze** (L186) | **Audience**: the product owner and whoever runs the check | **Scope**: staging only. This is a staging check, not R13's gate: production still needs R13 and a named release authorization (standard Stage 5)

How to use: copy this file to `docs/ops/STAGING_CHECK_<date>.md`, run each line against the deployed staging project, paste the evidence under it (a command's output, a header, a row), and tick it. Any ☐ left open blocks "staging is checked". Never paste a password, a token, a one-time link or a key: replace each with `<redacted>`.

Project: `<projectId>` · Function URL: `<url>` · Date: `<date>` · Run by: `<name>` · Commit deployed: `<sha>`

## A. The standard's §6 items (numbering of `plan/DEPLOY-staging.md` §1)

Items 1 to 6, 8 to 10 and 12 are shown here; item 7 is reviewed and item 11 does not apply.

| # | Standard §6 item | What to show on staging | Evidence |
|---|---|---|---|
| 1 | TLS fails fast; HSTS; `trust proxy` hop count right for the real topology | `curl -sI https://<projectId>.web.app/` shows the headers Hosting sends (it sets `Strict-Transport-Security` itself on `*.web.app`; read it, record the value). **The address line (F3):** from your own network make one write through the deployed API as a signed-in admin, then read the audit row's `IPAddress`: it is **your public address**; repeat with a forged leading `X-Forwarded-For: 1.1.1.1` and show the row still holds your public address. `TRUST_PROXY_HOPS=1` is right only if both hold | ☐ |
| 2 | Both rate limiters active and tested | Send 1,201 requests to `GET /api/health` in a minute from one address: the next is 429 with `Retry-After`. Send 16 requests with a bad token: the 16th and later are 429 (valid token or not) until the window ends. Show that two different addresses do not share a key (the address line in item 1 also shows this) | ☐ |
| 3 | Secret guard active; no real `.env` ever committed; keys present and non-default | `git ls-files` shows no `.env*` but `.env.example`; CI's `ci:guards` step is green on the deployed commit; `gcloud secrets versions list PGPASSWORD` (names only) shows the secret exists; the function's `startup configuration` line shows `nodeEnv: production` | ☐ |
| 4 | Audit attributes correctly; redaction verified | One write as a named admin: `SELECT UserId, TenantId, IPAddress, StatusCode, RequestId FROM gabay.AuditLog ORDER BY AuditLogId DESC LIMIT 3` shows the admin's real `UserId`, the tenant, the status, the `X-Request-Id` of the response. A write whose body holds `password`, `newPassword` and `changePassword` shows each redacted in `PayloadDiff` and the flag intact. **If a row is missing the insert must be awaited (a spec change), not retried** (runbook, SEC-2) | ☐ |
| 5 | Permission guard fail-closed | With the instance **stopped** (or the proxy and connector unreachable) a guarded route answers **503**, not an open door, and `GET /api/health` answers 503 within `PG_CONNECT_TIMEOUT_MS` (the stop control is confirmed at DEP-1: plan/DEP-0-step0.md row 4) | ☐ |
| 6 | Privilege-escalation guards | Until R6 no route writes grants: show that `POST/PUT/DELETE` on a grant-like path answers 404, and that a VIEWER's and a VENUE_EDITOR's **publish are refused** (403) while a MALL_ADMIN's is accepted (SEC-1's rule, shown on staging) | ☐ |
| 7 | Upload posture reviewed | Reviewed, not new: OA-2's backdrop upload takes one image (MIME by magic bytes, generated names only, 15 MB limit). **The bucket is private:** `curl -sI https://storage.googleapis.com/<bucket>/<an object key>` answers 401, 403 or 404, never 200; `gcloud storage buckets describe gs://<bucket>` shows uniform bucket-level access on, public access prevention `enforced`, location `ASIA-SOUTHEAST1`; the function's account holds `roles/storage.objectUser` on this bucket only | ☐ |
| 8 | SQL graded by reachability | `npm run lint:structural` (`sql-interpolation`) is green on the deployed commit; no request-derived value reaches query text (the CI `lint` job is the evidence: paste its run URL) | ☐ |
| 9 | Error responses leak no driver text, stack or schema names | A malformed JSON POST answers **400 with no stack and no path** (the platform's page under `NODE_ENV=production`; R1's known difference: a plain `Bad Request`, never a stack); an unknown route answers `{ "error": "Not found" }`; a refused database statement answers the generic 500; `curl -sI` shows **no `X-Powered-By`** | ☐ |
| 10 | Every gate actually gates | The deploy workflow stops when `db:deploy` fails (show a run where a deliberately broken migration in a scratch branch stops before the function deploy, or the workflow's `needs:` chain); `lint` and `e2e` are required checks on `main` (the branch protection page) | ☐ |
| 11 | Webhooks | **Not applicable**: Gabay has no webhook | n/a |
| 12 | Production database access rules written down | The runbook's "Standard §6, item 12" section: for production, SELECT-only without explicit per-request permission and the e2e suite and seed scripts banned for ever; for staging, `gabay_api` is the function's login, `gabay_migrate` is CI's, the owner reaches the database through the proxy. Show the two logins' attributes and grants: `\du gabay_*` and the grants table in the runbook against `information_schema.role_table_grants` | ☐ |

## B. DEP-0's own lines

| Line | What to show | Evidence |
|---|---|---|
| **The start-up line (AC-28)** | The `startup configuration` log line of the first cold start: `nodeEnv` is `production`, `fileStore` is `gcs` with the bucket, `database` is `connector` (or `host` under the socket) with `poolMax: 1`, `corsOrigins: 2`, `authEmulatorHost: false`. No secret in it. A missing `NODE_ENV` reads `unset` (the deploy starts anyway: Q7 (b)) | ☐ |
| **The cold-start time (AC-18)** | The time of the first `GET /api/health` after the function has been idle. Not gated. If it is longer than `PG_CONNECT_TIMEOUT_MS`, raise that value in the env table and redeploy | ☐ |
| **The 15 MB upload (AC-12)** | Upload a 15 MB backdrop through the **deployed function**; read it back and show it is byte-identical (SHA-256 of both); show the object in the bucket under `backdrops/<tenantId>/<venueId>/<key>`. The function's default memory carries it (the store holds a file whole) | ☐ |
| **The real-bucket run (AC-8, AC-9, AC-11)** | `GCS_BUCKET=<bucket> npm run gcs:check` ends `ALL CHECKS PASSED`; each `table:` line is the fake bucket's claim (numeric 412 and 404) confirmed or the fake is corrected | ☐ |
| **No test data of the wrong kind (AC-37, AC-44)** | `SELECT count(*) FROM gabay.AppUser WHERE Email LIKE '%@gabay.test'` is **0**; `SELECT count(*) FROM gabay.Tenant WHERE Code = 'SPIKE_VENUES'` is **0**; no penthouse venue | ☐ |
| **Roles and venue grants (AC-39)** | One account per role made with `staging:admin`; a VENUE_EDITOR and a VIEWER hold a grant for each venue (`SELECT count(*) FROM gabay.UserVenueGrant WHERE UserId = ...`); the MALL_ADMIN and SUPERADMIN hold none | ☐ |
| **Unsigned token refused (AC-26)** | A request with an unsigned (`alg: none`) token answers **401 "Invalid session"**; a real sign-in token of this project is accepted. `FIREBASE_*` names are absent from the function's environment | ☐ |
| **Secret and logins (AC-19, AC-24)** | The function runs as `gabay_api` (`SELECT current_user` through a diagnostic, or the connection's user in the log); `gabay_api` is refused `CREATE TABLE`, `TRUNCATE` and an `AuditLog` update (`db/tools/test/dep0.roles.test.js` shows the same on a throwaway database; here, on the instance) | ☐ |
| **Connector or socket (EC-32)** | The spike's outcome (`plan/DEP-0.md` §0 deferred; spec §2.1): the first call after each of three redeploys answers over the socket with no manual step, **or** the connector stays and E-29 is kept. Paste the three first-call results | ☐ |
| **The Hosting policy on the real page (AC-48)** | The release build served from `https://<projectId>.web.app` loads, signs in and lists venues with **no policy violation in the browser console** (paste the console output); the function's real address is the one in `connect-src` (correct `firebase.json` if it differs) | ☐ |
| **Optional dependency (EC-28)** | The first deploy's build log shows `@google-cloud/storage` installed; the first upload works. If not, pin it directly (Blueprint pin and an EXCEPTIONS entry) | ☐ |

## C. Result

- [ ] Every ☐ above is ticked or marked n/a with a reason.
- Result: PASS / FAIL (circle one) · Signed: `<owner>` · Date: `<date>`
