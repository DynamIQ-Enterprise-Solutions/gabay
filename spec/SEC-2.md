Spec SEC-2. Revision: r2 (2026-10-14). Intent: intent/SEC-2-limits-lints-audit-validation.md

# SEC-2: Rate limits, the two guard lints, the audit trail and zod validation on every feature route

> **Pipeline entry:** SEC-2 (the retrofit's R4 rate limiting, R7 the two lints, R3 audit and redaction, R5 validation, pulled forward by L184) · **Slice:** SEC-2, stage S, after SEC-1 (`plan/DEPLOY-staging.md` 1.0 §1, §2) · **Coder:** api-coder (Sonnet 5.5), Opus 5.5 review of the slice (L174, L184) · **Status:** r2, for sign-off. **No question is open.** The four questions r1 raised are ruled (below). The plan cites r2.
>
> **Rulings folded into r2 (the main session's technical rulings under L174, listed as DESIGN CHOICEs at sign-off; the owner's sitting is recorded as L186).** Each is marked **[r2]** where it changed a criterion.
> - **Q1 (a):** `validate` runs before the venue lookup. OA-2's AC-18 step order is amended (AC-39, §4), and the order-of-refusal tests are named for the plan (C1). The upload route keeps its pre-body venue check (DC-24).
> - **Q2 (a):** the e2e evidence is the HTTP-level API tests in `functions/test` plus the manual cases SEC2.1 to SEC2.12. Item 9's "automated e2e phase" wording is left to R12, and the slice's report records `Waived: 9 (the declarative sub-suite) — R12` (§3.8, §6, DC-25).
> - **Q3 (a):** act-as auditing covers writes only. The read gap is written down (AC-23, EC-13, §9, DC-26).
> - **Q4 (c):** the lint is server-only in SEC-2. The Dart half becomes one criterion in SEC-3's spec (DC-27, §9). The main session chose (c) over (a), "its own entry in the screens lane", to avoid an orphan pipeline entry.
> - **SEC-1's names, folded in where r1 assumed them** (`spec/SEC-1.md`, §2): `req.actingAsTenantId` and `getActingAsTenantId()`; `GET /api/me` gains `actAsTenants` for a SUPERADMIN; MALL_ADMIN and SUPERADMIN are tenant-wide, VENUE_EDITOR and VIEWER use `UserVenueGrant`; a VENUE_EDITOR may clear a draft; an inactive tenant is 403 except for a SUPERADMIN.
> - **The runbook line** the DEP-0 suggestion asked for is now its own criterion (AC-59).
>
> **Sources read for r1 (unchanged) and r2:** r2 adds `spec/SEC-1.md` (read in full) and the coordinator's rulings above.
> - the intent; `plan/PH2-identity.md` 1.3 §3 (P2-S4, S5, S6, S8), §5, §7 rulings 3 and 6, §7a, §8; `plan/DEPLOY-staging.md` 1.0 §1 (SEC-2 row), §3, §6 and its owner rulings (L184); `plan/PH4-feature-first.md` 1.4 §5, §6 (R3, R4, R5, R7) and §7 (the ledger); `plan/OFFICE-ADOPTION-replan.md` 1.0 §2 Q7 and Q16 (ruled 2026-10-12: a body-free audit row per draft save, publishes and rollbacks in full, "the redaction utility gets a summarise path"); `spec/OA-2.md` r1 (format; AC-8, AC-18, AC-44, DC-19); `intent/SEC-1-…md` and `intent/SEC-3-…md`;
> - plan.html L128 (S4 review ruling 3: "a route-guard-order lint, a 'no raw error text to users' lint": built in Phase 2) and L184, L185; the `gabay-product-rulings` skill;
> - the standard (`Engineering Standards.html`): §3.1, §3.2, §3.4, §3.5, §3.6, §3.7, §3.8, §6, §7.2, §9, Appendix A.3 and A.4; FEATURE_PIPELINE §5; CLAUDE.md's seven rules; PRD §7; Blueprint Part 1 (`routing_and_auth_constraints`, `cross_cutting_invariants`, Part 2.6) and Part 3 (`AuditLog`, line 515);
> - the code: `functions/src/app.js` (`auditLoggerSlot`, `rateLimiterSlot`), `routes/api.js`, `venues.js`, `venueMaps.js`, `venueMapCatalog.js`, `lookups.js`, `me.js`, `health.js`; `middleware/auth.js`, `devStub.js`, `requireTenant.js`, `requestId.js`, `actorContext.js`; `utils/errors.js`, `fieldInput.js`, `idParam.js`, `pagination.js`, `requestContext.js`, `logger.js`; `services/venue.service.js`, `lookup.service.js`, `mapStorage/mapEnvelope.js`; `config/index.js`, `settings.js`; `db/schema.sql` (`AuditLog`, line 1360); `functions/package.json`; `tools/verify.js`; `tools/lint/run.js`, `README.md`, `lib/context.js`, `lib/scan.js`, `sql-interpolation.js`, `tenant-predicate.js`, `test/helper.js`, `test/tenant-predicate.test.js`, `test/run.test.js`; `.claude/hooks/stop-verify.js`; `.github/workflows/e2e.yml`; `functions/test/app.test.js`, `venueMaps.audit.test.js`, `venueMaps.draft.test.js`, `mapApp.js`, `helpers.js`;
> - the installed packages, as a source check (their versions are `functions/package.json`'s pins): `express-rate-limit` 8.7.1 (`dist/index.d.ts`, `dist/index.cjs`), Express 5.2.1 (`lib/request.js`), `router` (`index.js`), `zod` 4.6.5 (`v4/core/*.d.ts`). What was checked is listed in §10.
>
> **Limits of this reading.** Bash and git were not available to this run. The code was read from the working tree of the main folder (branch `records-l174-l177`). `.git/refs/remotes/origin/main` reads 09b2788, and the tree holds OA-2's merged files (`services/mapStorage/`, `routes/venueMaps.js`), so it is taken to be that commit's code. A `git diff origin/main` was not run. SEC-1's spec now exists (`spec/SEC-1.md`), and §2 is written against it. The tree still has the E-20 stub (`devStub.js`, `requireTenant.js`) that SEC-1 deletes.

## 1. What this delivers

On the server only (`functions/`, `tools/`), with no schema change:

1. **Rate limiting (R4).** A global limiter on `/api`, an auth limiter that counts failed token checks, and a `RATE_LIMIT=off` kill switch. Values are env values with named defaults. In memory, valid only while `maxInstances = 1` (Blueprint 2.6).
2. **One shared `redactSecrets`** (EXACT, STEMS, `NEVER_SECRET` wins) and its "summarise" path (R3).
3. **The audit middleware** (R3): POST, PUT and DELETE, written on `res.on('finish')`, fire-and-forget, with the Q16 rule for draft saves.
4. **Validation (R5):** zod on every feature route boundary, allow-list maps for every client value that selects an SQL identifier, OA-1's validator unchanged as the document's check.
5. **Two structural lints (R7, L128):** `route-guard-order` and `raw-error-text`, each with its own test file under `tools/lint/test/`, both registered in `tools/lint/run.js`, which `npm run verify` runs.
6. **Its own e2e cases** (§3.8): API tests over real HTTP plus manual cases SEC2.1 to SEC2.12.

The escalation guards are R6's, not here.

## 2. What SEC-2 assumes from SEC-1 [r2]

SEC-1 (R1 tenant context, R2 authorization; `spec/SEC-1.md`) merges first. Where its merged code differs from a line below, the plan stops and asks (a spec that has moved past the plan's revision).

| # | SEC-2 relies on | Used by |
|---|---|---|
| S-1 | On every admin route, `req.user` (`userId`, `kind`) and `req.tenantCompanyID` (an integer) are set by `auth` and `tenantContext` before any handler. On a request that never authenticated, neither exists. A request with no `X-Tenant-Id` is a 400 for every role, SUPERADMIN included (SEC-1 AC-3) | audit row fields (AC-18) |
| S-2 | SEC-1's acting-as value is **`req.actingAsTenantId`**: the tenant's id when a SUPERADMIN names a tenant in which it holds no tenant-role row of its own, else null (SEC-1 AC-10, DC-10). The context getter is `getActingAsTenantId()` (SEC-1 AC-45). SEC-1 writes no audit row for it. SEC-2 does | `ActingAsTenantId` (AC-18) |
| S-3 | `auth.js` keeps its meaning of 401: only a failed token check (missing or malformed header, bad, expired or revoked token, a token older than `auth.idTokenMaxAgeS`, an inactive user), and `requireAdminUser` a 401 only when `auth` was not mounted. A valid identity with no account is 403. A failed permission or access load is 503 (fail-closed, SEC-1 AC-23). The role, permission and tenant guards answer 403, and an inactive tenant is 403 for every role except SUPERADMIN (SEC-1 AC-11) | the auth limiter's definition of failure (AC-7) |
| S-4 | The chain, in SEC-1's order (SEC-1 §2.2): `auth` → `requireAdminUser` → `tenantContext` → `requireRole(codes)` → `requirePermission(routes[], action)` → **the venue-scope step** (only where a route names or lists venues; ungranted is 404) → the handler. SEC-2 inserts `validate` between the venue-scope step and the handler. The `route-guard-order` rank table (AC-41) is written from SEC-1's merged exports, one table in one place. The venue-scope step's exported name is SEC-1's | AC-41 |
| S-5 | The dev stub, `requireTenant`, `routes/dev.js`, `X-Dev-Act-As` and `DEV_STUB_USER_EMAIL` are deleted, so the app builds with `NODE_ENV=production` | AC-5, AC-41 |
| S-6 | `/api/health` is public and `/api/me` runs `auth, requireAdminUser` only (self-service: no tenant, no permission row). Both carry a `// guard-exempt:` reason (AC-43). `GET /api/me` also gains `actAsTenants` for a SUPERADMIN (SEC-1 AC-32); that is SEC-3's, not audited or limited differently | AC-43 |
| S-7 | SEC-1 adds no migration that touches `AuditLog`. SEC-2 adds none | §6 item 1 |
| S-8 | Who may do what (SEC-1 §2.4 and AC-26): MALL_ADMIN and SUPERADMIN are tenant-wide; VENUE_EDITOR and VIEWER see only granted venues (`UserVenueGrant`). A VENUE_EDITOR may save a draft, upload and **clear**; it may not publish, roll back or create or edit a venue. A VIEWER reads only | the audit and test cases (AC-18, EC-16 to EC-19) |

## 3. Acceptance criteria

Terms used throughout:
- **"The client key"** is `req.ip` as Express computes it from `TRUST_PROXY_HOPS`. The limiters use the library's default key generator, which folds an IPv4-mapped IPv6 address onto its IPv4 form and groups IPv6 addresses by their /56 prefix (source-checked, §10).
- **"Refused"** means an HTTP 4xx or 5xx in the standard shape `{ error }` (standard §3.8), with nothing written.
- **"The slot"** is where `app.js` mounts `auditLoggerSlot` and `rateLimiterSlot` today, in the standard's order: audit logger, `/api` no-store, rate limiters, routes.
- **"Admin English"**: every new message is English by design (L165) and says what to do, with no value echoed.

### 3.1 Rate limits (R4)

- AC-1: **Settings.** `config/index.js` reads four env values through its zod schema, each with a named default constant and each in `.env.example` with a comment:
  - `RATE_LIMIT_PER_MIN`: the global ceiling per client key per 60 seconds. Default **1,200** (standard §3.2).
  - `AUTH_RATE_LIMIT_MAX`: failed token checks allowed per client key per window. Default **15** (standard §3.2: "about 15 attempts"; DC-2).
  - `AUTH_RATE_LIMIT_WINDOW_MIN`: the auth window in minutes. Default **15** (PH2 Q3, standard §3.2).
  - `RATE_LIMIT`: `on` or `off`. Default `on`.

  A number that is not a whole number of at least 1 (0, -1, 1.5, `abc`), or above a typo bound named in the same module, stops start-up with a `ConfigError` naming the key. An empty value takes the default (the existing rule). No literal 1200, 15 or 60 appears in code outside those named constants (C8). Verify: unit (`config` tests, in the style of `config.test.js`); review (grep for literals).
- AC-2: **The global limiter.** It counts every request under `/api` against its client key in a 60-second window. The first `RATE_LIMIT_PER_MIN` requests in a window pass. The next answers 429 until the window ends. The window starts at the key's first hit (source-checked, §10). Verify: API test with `RATE_LIMIT_PER_MIN=5` (a burst of 7 gives five 200s and two 429s); e2e SEC2.1.
- AC-3: **The 429 answer.**
  - Status 429 and the body `{ "error": "<English message that says to wait>" }` and nothing else, through the error handler (DC-4).
  - A `Retry-After` header holding a whole number of seconds from 1 up to the window.
  - The `RateLimit-*` standard headers are sent and the `X-RateLimit-*` legacy ones are not (DC-4). `Retry-After` is only set by the library when one of the two header families is on (source-checked), so the criterion fixes it.
  - `X-Request-Id` is present, and the CORS headers are present for an allowed `Origin`, because the limiter sits after `cors` and `requestId`.
  - `Access-Control-Expose-Headers` lists `Retry-After` beside `X-Request-Id`, so the admin page can read it (RECALLED, §10: the Fetch standard's list of readable response headers).

  Verify: API test. e2e SEC2.1.
- AC-4: **The window ends.** After the window passes, the same client key is counted from zero. The window lengths are named constants (60 s; the auth window from AC-1), and the limiter factory takes them as arguments, so a test uses a 1-second window and does not sleep for a minute (DC-6). Verify: API test.
- AC-5: **The kill switch.** With `RATE_LIMIT=off`, neither limiter counts or blocks: a burst of three times the ceiling all answers as it would without a limiter, and no `RateLimit-*` header appears. With `RATE_LIMIT=off` and a raw `NODE_ENV` that is not `development` or `test` (the same rule as `config.devOnlyAllowed`, L151), start-up stops with a `ConfigError` naming `RATE_LIMIT` (DC-5). Verify: API test; unit (config). e2e SEC2.2.
- AC-6: **The client key.** With `TRUST_PROXY_HOPS=1` and a request carrying `X-Forwarded-For: <a>, <b>`, the key is `<b>`, the address the one trusted hop appended. A client that changes `<a>` on each request stays in one bucket, and a different `<b>` is a different bucket. `::ffff:1.2.3.4` and `1.2.3.4` share one bucket. Verify: API test (the test client is the trusted proxy at 127.0.0.1); e2e SEC2.3. The Express behaviour behind it is RECALLED (§10); the test settles it.
- AC-7: **The auth limiter counts failed token checks only.**
  - Only a request whose final status is **401** consumes budget (PH2 Q3: "401s per IP, 15 minutes, failures only"). A request answered 2xx, 400, 403, 404, 409, 413, 500 or 503 does not.
  - The first `AUTH_RATE_LIMIT_MAX` failed checks of a client key within its window answer 401. From the next request on, that key answers 429 (AC-3's shape), whether the token is valid or not, until its window ends.
  - It sits after the global limiter at the slot.

  The library's default counts any status of 400 or more as a failure (source-checked), which would let a stale-save 409 or a validation 400 lock an editor out, so the plan sets the success test to "not 401" (DC-3). Verify: API test (N bad tokens, then a valid one; and N 409s and 400s that leave the budget untouched); e2e SEC2.4.
- AC-8: **An aborted request is not a failure.** A request whose client closes the connection before the response finishes does not consume auth budget. The library only gives a request's hit back when the response **finishes** (source-checked), so without this criterion every aborted valid request would count against the key for the rest of the window. Verify: API test with a test-only slow route and an aborted request (EC-3).
- AC-9: **A limited request reaches nothing.** A request answered 429 by either limiter runs no `auth`, no guard, no handler, no query and writes no audit row (AC-23). Verify: API test (a db double that fails on any query).
- AC-10: **Start-up.** With limiters on, start-up logs one `info` line with the three effective values. (`app.test.js` counts `warn` lines at a normal start, so the line is not a warning.) With `RATE_LIMIT=off` (development or test only, AC-5) it logs one `warn` line. The limiters are given the app's logger, so the library's own diagnostics (for example a wrong `trust proxy` value) go to the pino log and not to the console. Verify: unit (a recording logger).
- AC-11: **The stack order test is updated** (`app.test.js`; §4). The audit middleware, `apiNoStore`, the global limiter and the auth limiter appear in that order after `actorContext` and before the router. The order is the standard's (§3.1) and Blueprint Part 1's. Verify: API test.

### 3.2 `redactSecrets` (R3)

The module is `functions/src/utils/redactSecrets.js`. There is one module and no second copy of its lists (AC-16).

- AC-12: **Classification.** A key is normalised (lower case, `-` and `_` removed). Then, in this order:
  1. a key in `NEVER_SECRET` is kept, and this wins over everything else;
  2. a key that equals an `EXACT` entry, or contains a `STEMS` entry, is redacted;
  3. anything else is kept.

  The three lists are frozen, named, exported constants. They start from the standard's A.4 (EXACT: `password`, `token`, `pin`, `otp`, `secret`, `authorization`, `signature`; STEMS: `password`, `secret`, `apikey`; NEVER_SECRET: `changepassword`, `haspasswordexpiration`) and add the exact keys `idtoken`, `refreshtoken` and `accesstoken` (DC-16). Verify: unit, one table. Redacted: `password`, `Password`, `new_password`, `newPassword`, `confirm-password`, `PasswordHash`, `clientSecret`, `apiKey`, `API_KEY`, `Authorization`, `signature`, `token`, `idToken`, `refreshToken`, `pin`, `otp`. Kept: `changePassword` (a `true` survives), `hasPasswordExpiration`, `shipping`, `adoption`, `pinCode`, `venueName`.
- AC-13: **Shape and safety.**
  - A redacted key's whole value, of any type or size, becomes `[REDACTED]`. Every other key, nesting level, array and array order is kept.
  - A level deeper than 8 is replaced by a marker.
  - A Buffer or typed array becomes `[BUFFER:<byteLength>]`.
  - The input is never mutated.
  - The function never throws: a cyclic structure, a throwing getter, a Proxy, a `BigInt`, a symbol key and a function all give a result.
  - The output is built from own properties only, so a body with a `__proto__` or `constructor` key does not change `Object.prototype` and does not change the output's prototype.

  Verify: unit.
- AC-14: **Bounded work.** The walk spends a named node budget (the plan sets the value, DC-13) and, when it runs out, stops descending and leaves a truncation marker where it stopped. Nothing past the budget is copied, so a secret there never appears. A 5 MB body of 100,000 small objects ends within the budget and gives a result whose serialised form fits AC-19's cap. Verify: unit (the cut, the marker, a secret placed after the budget).
- AC-15: **The summarise path (Q16).** `summariseDocument(value)` returns `{ bytes, sha256 }`: the UTF-8 byte length of `JSON.stringify(value)` and its hex SHA-256. It never returns or logs any part of the value. The same value gives the same pair. Verify: unit.
- AC-16: **One source.** A source-scan test fails if `NEVER_SECRET` (or `EXACT` or `STEMS`) is defined in more than one file under `functions/src`, so the live middleware and any later historical scrubber cannot drift (standard §3.6). Verify: unit.

### 3.3 The audit trail (R3)

- AC-17: **Which requests.** The middleware is mounted at the slot, before the routes, and acts only on POST, PUT and DELETE. It takes its snapshot of the request (`body`, `query`) **before** any handler runs, and writes on `res.on('finish')`, when `req.user` and `req.tenantCompanyID` exist. Verify: API test (a GET, HEAD and OPTIONS write no row; a POST, PUT and DELETE each write one).
- AC-18 [r2]: **The row.** One `AuditLog` row for each audited request:

  | Column | Value |
  |---|---|
  | `TenantId` | `req.tenantCompanyID`, or NULL when the request has none. Never read from the body, query or token (rule 2) |
  | `UserId` | `req.user.userId` when `req.user.kind` is `admin`, else NULL. A failed token check is NULL: a guess is never stamped with the identity it guessed at (standard §3.3) |
  | `ActingAsTenantId` | `req.actingAsTenantId` (S-2), else NULL |
  | `IPAddress` | the client IP normalised (AC-27), NULL when there is none |
  | `Method` | the HTTP method |
  | `Route` | the request **path**, without the query string, capped at 400 characters (DC-10) |
  | `PayloadDiff` | AC-19 to AC-22 |
  | `StatusCode` | the response's final status |
  | `RequestId` | `req.id`, capped at 40 characters (DC-11) |
  | `EntityName`, `EntityId` | NULL (DC-12) |
  | `CreatedAt` | the column default: the time the response finished |

  Verify: API test per column. Cases: a signed-in write; a VIEWER's refused publish (403, with the VIEWER's `UserId`); a VENUE_EDITOR's clear (200, audited in full) and its refused publish (403); an anonymous POST that fails the token check (401, `UserId` NULL); a SUPERADMIN acting as a tenant (`TenantId` the acted tenant, `ActingAsTenantId` set); a write with no `X-Tenant-Id` (400 for every role, SUPERADMIN included: `TenantId` NULL, `UserId` set); a write naming an inactive tenant as a non-SUPERADMIN (403, `TenantId` NULL, since `tenantContext` refused it); a request with a 60-character `X-Request-Id` (the row holds its first 40 characters). e2e SEC2.5, SEC2.9.
- AC-19: **`PayloadDiff`.** JSON text `{ "body", "query", "params", "status" }`:
  - `body` and `query` come from the pre-handler snapshot, redacted by AC-12 to AC-14. A request with no body has no `body` key.
  - `params` are what the matched route saw. (At the slot `req.params` is `{}`: Express sets it per layer, source-checked.) So `params` are read at finish.
  - The whole text is at most **4,000 characters**. A longer text is cut to leave room for a fixed marker (a named constant) at its end. The cut never splits a surrogate pair. A text of exactly 4,000 characters is not cut, and one of 4,001 is.
  - A serialisation failure writes a short fixed text and never throws.

  Verify: unit (the cap, the boundary, a pair at the cut); API test (a 6 KB write: the stored length is at most 4,000 and the text ends with the marker). e2e SEC2.5.
- AC-20: **Redaction through a route, and the URL.** A `POST /api/venues` whose body also holds `password`, `newPassword`, `changePassword: true` and `{ "apiKey": "k" }` (the service ignores the extra keys, the audit sees the raw body) and whose URL carries `?token=abc&search=mall` gives a row where: the three secrets and the `token` query value are `[REDACTED]`, `changePassword: true` and `search=mall` are visible, and `Route` holds no query string. Verify: API test. e2e SEC2.6.
- AC-21: **A draft save is body-free (Q16, ruled L170).** For `PUT /api/venues/:venueId/map/draft` the row's `PayloadDiff` holds no part of the layout. It holds `{ venueId, baseVersion, draftVersion, bytes, sha256, status }`, where:
  - `venueId` is the path's;
  - `baseVersion` is the sent one;
  - `draftVersion` is the version the save produced, and is absent unless the save succeeded;
  - `bytes` and `sha256` are AC-15's summary of the layout **as received** (DC-15).

  A refused save (400 problems, 409 stale, 403) gets the same body-free row. The row never reaches the cap, even for a layout of `MAX_MAP_BYTES`. The route declares this itself (DC-14). Verify: API test, with a layout holding a recognisable name and a `password`-like key: neither appears in the row, and the row's `bytes` and `sha256` equal the test's own. e2e SEC2.7.
- AC-22: **Everything else is audited in full.** Publish, rollback and clear (`{ baseVersion }`, `{ version, baseVersion }`), the venue create and edit (`POST` and `PUT /api/venues`), and the backdrop upload each get a row through the generic path of AC-19, with the venue in `params`. The upload's row holds no bytes, no file name and no multipart text: the body is not parsed at the slot. A publish that answers 501 before FF-3′ is audited with 501. Verify: API test per route. e2e SEC2.8.
- AC-23 [r2]: **What writes no row.**
  - Any method other than POST, PUT or DELETE. **This includes the GET requests a SUPERADMIN makes while acting as another tenant (Q3 (a), DC-26).** Every audited write carries `ActingAsTenantId` (AC-18), but a read-only act-as leaves no row. This is a known gap, written down here, in EC-13 and in the slice's L-row (G4).
  - A request with no `req.user` whose final status is **404** (standard §3.6: scanner noise is not an unauthenticated write path). An authenticated 404 (another tenant's venue) **is** audited.
  - A request answered **429** (DC-8). No handler ran for it, and auditing it would make the flood the limiter exists to stop into a stream of database writes.
  - A request that never reaches the middleware: a body that fails to parse (413 "Request body too large", 400 "Malformed JSON body"), because the body parser sits before the slot in the standard's order (EC-5).

  An anonymous 401 or 403 **is** audited (`UserId` NULL). Verify: API test. e2e SEC2.9.
- AC-24: **Fire-and-forget.** The insert starts after the response has finished and is never awaited by the request. A rejected insert (a driver error, a value too long) is logged once at `error` through `req.log` with the request id, and changes nothing the client saw or any later request. An insert that never settles does not delay the response, or any later request. Verify: API test with a db double for the audit insert only. e2e: none, because a failing audit insert can only be injected in a test (the manual case would need a broken database, which fails the request itself with 503).
- AC-25: **An aborted request.** When the client closes the connection before the response finishes, and `req.user` exists, one row is written on `close` with `StatusCode` **499** (DC-9). It is written once, never on both `finish` and `close`. An aborted request with no `req.user` writes no row. Verify: API test (an abort against a test-only slow route). e2e: none, because a client abort cannot be driven by hand reliably.
- AC-26: **A test seam.** The audit module exposes `settled()`, a promise that resolves when every write started so far has finished, successfully or not. The test helpers (`venueApp.js`, `mapApp.js`) wait on it where a test reads `AuditLog` or sends the next request, because every API test runs over one rolled-back connection (`venueApp.js`) and a write still in flight would land inside a later savepoint. Verify: unit; the helpers' changes are listed in §4.
- AC-27: **IP normalisation.** `::ffff:10.0.0.5` (any letter case in the prefix) gives `10.0.0.5`. An IPv4 address and an IPv6 address are kept as they are. The IPv4-mapped hex form (`::ffff:a00:5`) is kept as is (documented). A missing address is NULL. The longest IPv6 text form (45 characters) fits. Verify: unit.
- AC-28: **The column widths are mirrored.** The constants for `Route` (400), `IPAddress` (45), `Method` (10), `RequestId` (40), `PayloadDiff` (4,000) and `EntityName` (80) and `EntityId` (40) are named in one place. A test reads `db/schema.sql`'s `AuditLog` and fails if one differs (the pattern of `venues.schemaMirror.test.js`). Verify: unit.
- AC-29: **Rules 2 and 3.** The insert binds every value as a `$n` parameter, and its tenant comes from `req.tenantCompanyID`. It passes `tenant-predicate` (an `INSERT` binds `TenantId` in its values) and `sql-interpolation` with no annotation. Verify: the two lints.
- AC-30 [r2]: **OA-2's "no audit row" test is replaced** (OA-2 AC-44, DC-19; `venueMaps.audit.test.js`). After one save, publish, rollback, clear and upload, the tenant's `AuditLog` holds exactly five new rows, each attributed to the signed-in user (SEC-1 has deleted the stub) with the right method, status and the Q16 shape for the save. Verify: API test. e2e SEC2.7, SEC2.8.
- AC-31: **Measurement (recorded, not gated).** The 4,192,206-byte measurement document of OA-1 is saved through the real app 20 times on this machine. The median and p95 of (a) request time and (b) the time from the response's end to the audit row being written are pasted in the pull request beside OA-2's AC-46 figures. There is no gate, because no target is stated (§7). Verify: integration (measured).

### 3.4 Validation (R5)

- AC-32: **The `validate` step.** `validate({ params, query, body })` takes zod schemas, each optional, and is the step before the handler. A handler reads validated values through `req.valid.params`, `req.valid.query` and `req.valid.body` (DC-17). For each source:
  - **params:** a failure answers **404** `{ "error": "Not found" }`, as `parseIdParam` and the lookup name check do today (the owner's ruling, OA-2 Q3 (a)).
  - **query:** lenient where the code is lenient today (standard §3.7: a malformed filter is ignored, never a 500): a bad `page`, `pageSize`, `sortBy` or `sortOrder` takes its default. A `search` with a control character is a 400, with today's message.
  - **body:** a failure answers **400**.

  Every message is written in the schema, in admin English. A message is the **first** issue's, in the order of AC-34. The answer is `{ error }`. Unknown body keys are ignored (OA-2 DC-14 and the venue service's existing rule). Verify: unit; API test.
- AC-33: **Every feature route has its schema.** The ledger's open validation cells close for these routes (`plan/PH4-feature-first.md` §7):

  | Route | Schemas |
  |---|---|
  | `GET /api/lookups/:name` | params (`name` from `LOOKUPS`'s keys), query (paging, search) |
  | `GET /api/lookups/:name/:id` | params |
  | `GET /api/venues` | query |
  | `POST /api/venues` | body (`code`, `name`, `isActive`; read-only echo keys passed through for the service, AC-40) |
  | `GET /api/venues/:venueId` | params |
  | `PUT /api/venues/:venueId` | params, body (`code`, `name`, `isActive`, `updatedAt`; echo keys) |
  | `GET /api/venues/:venueId/map` | params |
  | `PUT …/map/draft` | params, body (`baseVersion`, `layout` present) |
  | `POST …/map/publish`, `…/clear` | params, body (`baseVersion`) |
  | `POST …/map/rollback` | params, body (`version`, `baseVersion`) |
  | `POST …/map/backdrops` | params only. **The body stays multer's and `imageHeader.js`'s** (one file, magic bytes, header size): there is no JSON to validate. The ledger cell closes with that note |
  | `GET …/map/backdrops/:key` | params (`venueId`; `key` by the schema file's `BACKDROP_KEY` pattern, a failure is 404) |
  | `GET /api/venue-maps/catalog` | none: `validate()` with no schema, which is still a step the lint can see (DC-18) |

  Any route SEC-1 or later adds takes a `validate` step in the same way. Verify: the lint (AC-45) for presence; the API tests below for behaviour.
- AC-34: **Nothing a client sees changes, except what AC-39 rules.** For every request that the existing suites send today, the status and the message are identical. Where several things are wrong at once, the first message follows today's order for a venue edit: every missing key (in the form's order), then each field's own check (in the form's order), then `updatedAt`, then the read-only echo checks (AC-40). Verify: the existing suites run **unchanged** (§4 names the exceptions): `fieldCases.js`-based cases, `venues.test.js`, `edits.missingFields.test.js`, `updatedAtDates.test.js`, `controlCharacters.test.js`, `pagination.test.js`, `lookups.test.js`, `idParam.test.js` and the `venueMaps.*` envelope cases (OA-2 AC-13, AC-31, EC-33). They become the acceptance suite for the swap (DC-17).
- AC-35: **Allow-list maps (rule 3).** A client value selects an SQL identifier only through an allow-list map that exists today: a paging `sortMap` for a sort key (`sortBy`), and `LOOKUPS` for a lookup `:name`. A schema that names the allowed values builds them from the map's own keys, never from a second list. `sortBy=Name;DROP`, `sortBy=__proto__`, `sortBy=constructor` and `sortOrder=sideways` give the default order with a 200; `/api/lookups/__proto__` and `/api/lookups/constructor` give 404. Verify: API test; the `sql-interpolation` lint.
- AC-36: **The map envelope.** `baseVersion` is a whole number from 0 to `MAX_VERSION` (2,147,483,647), `version` a whole number, and `layout` present (any type: OA-1's validator refuses what is not a document, with problems, never a 500). The three readers of `mapEnvelope.js` become schemas. The messages are byte-identical (`baseVersion must be a whole number from 0 to 2147483647`, `version must be a whole number`, `layout is required: send the map document as layout`), and the 404 for a version that cannot be stored stays in the service. The document itself stays OA-1's `validateMap` (re-plan §3.1). Verify: API test (OA-2's AC-13, AC-31, EC-33 cases, unchanged).
- AC-37: **No hand-reading is left.** After the swap, no route handler or service reads `req.body`, `req.query` or `req.params` directly: only the `validate` step and the audit module do (and the upload route, whose body is multer's). `fieldInput.js`'s and `mapEnvelope.js`'s readers that no schema uses any more are deleted with their own tests (the plan names each, with a reason, §4). No second implementation of a rule stays beside its schema (C2). Verify: unit (a source scan of `functions/src/routes` and `services`); review.
- AC-38: **A 400 or 404 from validation leaks nothing.** For each route in AC-33, a body that is an array, a string, `null`, the wrong type for each field, or a 10,000-key object answers `{ error }` where the text is one of the schemas' own messages. It never contains `zod`, `ZodError`, `Invalid input`, `expected … received`, `issues`, a schema path such as `body.code`, or the received value (intent item 5: "no driver text"). Verify: API test across the routes. e2e SEC2.10.
- AC-39 [r2]: **The order of refusals on the map routes (Q1 (a)): `validate` runs before the venue lookup.** The first check that fails gives the answer:
  1. `auth`: 401, 403, 503;
  2. `tenantContext`: 400 (no header), 403 (not held, or an inactive tenant for a non-SUPERADMIN), 503;
  3. the role guard and the permission guard: 403, or 503;
  4. the venue-scope step: 404 for a **venue-scoped user** (VENUE_EDITOR, VIEWER) on an ungranted venue. It is SEC-1's, and it still comes before `validate`, so a role without a grant learns nothing about a venue and a malformed body to an ungranted venue is 404;
  5. `validate`: 404 for a malformed `:venueId` or `:key`, 400 for the body's shape;
  6. the handler, in OA-2's own order: the venue's existence (404; for a tenant-wide user a malformed body to an unknown venue is therefore 400 and a well-formed one 404), then the document (400 with problems), then the version (409).

  This **amends OA-2's AC-18**, whose order was: the stub and tenant, the venue (404), the body's shape (400), the document (400 with problems), the version (409). The body's shape now comes before the venue's existence. OA-2's AC-8 stands for a well-formed request: another tenant's venue, or none, is 404 with nothing read or written. The upload route keeps its pre-body venue check (`venueFirst` before multer, DC-24), because it protects a 15 MB read: its chain is `…, validate(params), venueFirst, multer, handler`. Verify: API test, one request per pair of neighbouring steps (the amended `venueMaps.draft.test.js` AC-18 case, §4). e2e SEC2.10.
- AC-40: **What stays in the services.** The semantic checks that need the request's tenant or the stored record stay in the services (standard §3.7: semantic and privilege guards live in the controller). They are: a venue's read-only echo keys (`id`, `tenantId`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`: `refuseIfDifferent`, `refuseStampsOnCreate`, `refuseStampsOnEdit`) and the optimistic-concurrency check. Their messages and order are unchanged. The schema lets those keys through untouched so the service can compare them. Verify: the existing venue suites, unchanged.

### 3.5 `route-guard-order` (R7, L128)

Pattern: `tools/lint/tenant-predicate.js` (fails on what it cannot read; annotation with a required reason; `--files` widening) and `tools/lint/sql-interpolation.js` (a scan of `functions/src/**/*.js` with `lib/scan.js`, so comments and strings never count; the `violation(file, line, rule, message)` shape). Tests follow `tools/lint/test/tenant-predicate.test.js` (the `lint()` and `at()` helpers of `tools/lint/test/helper.js`, throwaway trees, a bad sample and a good sample for every rule). The linter is `tools/lint/route-guard-order.js`, its test `tools/lint/test/route-guard-order.test.js`.

- AC-41 [r2]: **The rule.** The router is the one source of truth: no second list of routes. For every mounted route, the effective chain is the middleware of every enclosing mount (outermost first) followed by the route's own, and the last argument is the handler. The steps must come in this rank order (PH2 §7 ruling 6, standard §3.4, SEC-1 §2.2):

  | Rank | Step | Names |
  |---|---|---|
  | 1 | auth | SEC-1's `auth`, `requireAdminUser` |
  | 2 | tenant context | SEC-1's `tenantContext` |
  | 3 | role guard | SEC-1's `requireRole(…)` |
  | 4 | permission guard | `requirePermission(…)` |
  | 4b | venue scope | SEC-1's venue-scope step (its exported name is SEC-1's) |
  | 5 | validate | `validate(…)` |
  | 6 | handler | the last argument |

  The names live in one exported constant of the linter, written from SEC-1's merged middleware (S-4). Any middleware not in the table counts as part of the handler stage: it must come after every ranked step, so nothing unranked runs before `auth` (the upload's `validate(params)`, `venueFirst`, multer chain is valid: `venueFirst` and the parser are handler-stage). A rank that appears after a higher rank is a violation, and so is a missing required step. Required on every non-exempt route: 1, 2, 4 and 5. Rank 3 is also required on `post`, `put` and `delete` (standard §3.4: a role guard in front of the permission guard on every mutating route). Rank 4b is required on a route whose full path holds `:venueId` (SEC-1's routes 5 to 13) and is allowed, never required, elsewhere (the venue list, which SEC-1 filters). A violation prints `path:line: route-guard-order: <METHOD> <full path>: <what is wrong>`. Verify: unit (the lint's test: each missing step, each swapped pair, the venue-scope step before and after `validate`, a good chain).
- AC-42: **Nested routers across files.** A mount such as `router.use('/venues', auth, …, venueRoutes({…}))` resolves `venueRoutes` through the file's `require` to its file, and from there through the same kind of mount (`router.use('/:venueId/map', venueMapRoutes(…))`) one level deeper. A route's chain is inherited down the whole way. Verify: unit (a three-file tree).
- AC-43: **Exemptions have a reason.** A comment on the line directly above a mount or route, `// guard-exempt: <reason>`, skips the rule for it. The reason is required, and an empty one is itself a violation. This is for the public and the self-service routes (S-6): `/health` and `/me`. Verify: unit.
- AC-44: **It fails closed.** A registration the linter cannot read is a violation naming the line, never a pass:
  - `router.route('/x')…` chains and `router.all(…)`;
  - registrations in a loop, from a spread or from a variable path;
  - a mounted router held in a variable or returned by a call it cannot resolve to a file;
  - a route file under `functions/src/routes` that no mount reaches.

  Route methods are **`get`, `post`, `put` and `delete`** only. A `patch` registration is a violation: the audit covers POST, PUT and DELETE (AC-17), so a mutating method outside them would escape the audit (DC-19). Verify: unit.
- AC-45: **Validate on every route.** A non-exempt route with no `validate(…)` step is a violation, including a no-input route, which uses `validate()` with no schema (DC-18). Verify: unit.
- AC-46: **It gates.** The real repository, once SEC-1 and SEC-2 are merged, gives 0 violations. A test spawns `tools/lint/run.js` over a throwaway tree with a bad route and asserts a non-zero exit code and the message (standard §6 "every gate gates", as `run.test.js` does for the other linters). Verify: unit.
- AC-47: **`--files` mode (pre-commit).** The linters get only the staged files, but the rule needs the mount in another file. So the lint always reads the whole `functions/src` tree (`ctx.repo`) and, in `--files` mode, reports violations for the staged files and for any route reached through a mount in a staged file; a staged change to the lint's rank table widens it to every route. Verify: unit (a staged sub-router with a missing guard, its mount unstaged).
- AC-48: **Registration, in `npm run verify` and the Stop hook.** The linter is added to `LINTERS` in `tools/lint/run.js` (where each linter registers). `npm run verify`'s `structural-linters` check runs `run.js` over the whole repo, so it runs both new lints with no change to `tools/verify.js`. The `linter-tests` check runs `node --test "tools/lint/test/**/*.test.js"`, so it picks up both new test files. The Stop hook (`.claude/hooks/stop-verify.js`) does not run linters; it blocks until a green `npm run verify` exists for the current code, so it covers them through those two checks. `tools/lint/test/run.test.js`'s "all ten linters are registered" case is updated to twelve (§4). `tools/lint/README.md` gains both rules, their accepted limits and "all twelve". Verify: unit; `npm run verify`'s output.

### 3.6 `raw-error-text` (R7, L128) [r2]

Pattern as §3.5. The linter is `tools/lint/raw-error-text.js`, its test `tools/lint/test/raw-error-text.test.js`. It reads `functions/src/**/*.js` and `db/schema.sql` (through `lib/schema.js`, as `tenant-predicate` does). **Its reach is the server only (Q4 (c) [r2], DC-27).** The criteria below are the server half, which the intent and PH2 P2-S8 name. The Flutter half (an exception's text interpolated into a screen instead of going through `formatApiError`) becomes one criterion in SEC-3's spec; it is not built here.

- AC-49: **What it refuses.** In a response-writing call (`res.json`, `res.send`, `res.end`, `res.write`, `res.status(…).json`/`.send`/`.end`), in an `httpError(…)` message, and in the body the error handler builds, an argument that carries text or data from an error variable. "An error variable" is a name bound by a `catch (x)` clause, a `.catch((x) =>` callback or an Express error handler's first parameter. The refused forms:
  - its `.message`, `.stack`, `.detail`, `.hint`, `.constraint`, `.table`, `.column`, `.schema`, `.where`, `.routine`, `.issues` or `.errors`;
  - `String(x)`, `${x}`, `JSON.stringify(x)` and `x + ''`;
  - the bare variable;
  - a call to zod's `prettifyError`, `treeifyError` or `flattenError` on it.

  Passing the error on (`next(err)`) is fine. Reading `.message` off a constant (the existing `UPLOAD_ONE_IMAGE.message`) is fine, because it is not an error variable. Verify: unit (a bad sample for each refused form, a good sample for each allowed one).
- AC-50: **Schema names in text.** A string literal in those same calls that holds `gabay.<name>` or a constraint-style name (`PK_`, `FK_`, `UQ_`, `UX_`, `IX_`, `CK_`, `TR_` followed by word characters) is a violation. Table names alone are not checked, because a person-facing message may say "Level". Verify: unit.
- AC-51: **Sanctioned sites have a reason.** A comment on the line directly above, `// raw-error: <reason>`, skips the line. The reason is required, and an empty one is a violation. The one known site is `utils/errors.js`'s `describeError`, which shows `err.message` only for an error made by `httpError` (status below 500, or `expose: true`). It carries a reason. Verify: unit; review reads every annotation (as REVIEW.md does for `// sql-identifiers:` and `// tenant-scope:`).
- AC-52: **It gates and is registered.** As AC-46 and AC-48, for this linter. The real repository gives 0 violations after SEC-2, with no rule loosened to get there. Verify: unit.
- AC-53: **The accepted limits are written** in `tools/lint/README.md`, as for the other linters. Known limits: a helper function that builds text from an error and returns it is not seen; text copied into a variable first and sent later is not seen; the review pass covers both. Verify: review.
- AC-54: **The runtime proof (standard §6, "error responses leak no driver text").** A route's db double throws a PostgreSQL-shaped error whose message names a table and a constraint. The answer is `{ "error": "Internal server error" }` and nothing else, and the audit row (if any) holds no driver text. A unique violation answers `That record already exists.` with no constraint name. Verify: API test (extends `errors.test.js`'s pattern). e2e SEC2.11.

### 3.7 Wiring and records

- AC-55: **The ledger** (`plan/PH4-feature-first.md` §7): for every row it applies to, the Audit (R3), Validation (R5) and, once SEC-1 has closed theirs, Guard order (R7's lint) cells close with a one-line evidence (the test or lint that shows it). Rows that read "n/a" keep their reason. The two header notes about "any role may write until R2" are SEC-1's. The R3, R4, R5 and R7 lines of §6 are marked done. Verify: review.
- AC-56: **The companion files follow in the same change** (CLAUDE.md's sync table):
  - `.env.example` (the four values, AC-1);
  - Blueprint Part 1 (the middleware order with the real names; the 429 and the audit rows in the error and API conventions; the new env values; `redactSecrets`), and Part 4's API conventions if they move;
  - `docs/testing/E2E_Test_Cases_Manual.md` (the SEC2 rows, §3.8);
  - `tools/lint/README.md` (AC-48, AC-53);
  - `docs/ops/DEPLOYMENT_RUNBOOK.md` (AC-59).

  Verify: review (the sync-table pass by dod-reviewer).
- AC-57: **The tests, helpers and manual list in §4 are the only ones changed**, each with its one-line reason. Verify: review.
- AC-58: **`npm run verify` ends `ALL GREEN`** with both new lints, their tests and the new API tests in it. Verify: `npm run verify`.
- AC-59 [r2]: **The runbook lines** (the DEP-0 suggestion). `docs/ops/DEPLOYMENT_RUNBOOK.md` gains, in the staging and security sections DEP-0 builds (or, if they are not yet there, in a "SEC-2" note it moves), these statements:
  - the rate limiters, like the permission cache, are in memory and valid **only while `maxInstances = 1`**; a move to more than one instance needs a shared store first (Blueprint 2.6, release-blocking);
  - `RATE_LIMIT=off` is **refused at start-up outside development and test** (AC-5), so a deployed function cannot run without its limits;
  - the three limit values and their defaults (AC-1) and where to change them (`.env`, then a redeploy);
  - the staging check (DEP-1) must show an audit row after a real write, because a fire-and-forget write may be late or lost on Cloud Functions (EC-39).

  Verify: review (the sync-table pass). e2e: none; a document.

### 3.8 The e2e cases (Q2 (a), ruled [r2])

An "e2e case" for this slice is, by ruling: **an HTTP-level API test** (the real app mounted on an ephemeral port over the real local database in a rolled-back transaction, run by `npm run api:test`, which is what the CI job named `e2e` runs) **plus a numbered manual case** in `docs/testing/E2E_Test_Cases_Manual.md`, SEC2.1 to SEC2.12. FEATURE_PIPELINE item 9's "automated e2e phase awaited from `main()`" and its declarative sub-suite are left to R12, which builds the harness; the slice's report records `Waived: 9 (the declarative sub-suite) — R12`. Each AC has one case, or a one-line reason:

| Case | What the manual case does | ACs |
|---|---|---|
| SEC2.1 | Set `RATE_LIMIT_PER_MIN=5`, restart. Seven `curl` calls to `/api/health` answer 200 five times, then 429 `{"error":…}` with `Retry-After` and `X-Request-Id` | AC-2, AC-3, AC-4 |
| SEC2.2 | `RATE_LIMIT=off`: the same seven calls all answer 200. Then `NODE_ENV=production` with `RATE_LIMIT=off`: start-up stops naming `RATE_LIMIT` | AC-5, AC-10 |
| SEC2.3 | `X-Forwarded-For: <a>, <b>` with `<a>` changed each time stays in one bucket; a new `<b>` starts a new one | AC-6 |
| SEC2.4 | 15 calls with `Authorization: Bearer bad` answer 401; the 16th answers 429 even with a valid token. A call that answers 404 or 409 does not count | AC-7, AC-9 |
| SEC2.5 | A venue edit; in `psql`, the newest `AuditLog` row holds the user, tenant, `PUT`, the path, 200, the IP and the response's `X-Request-Id`; a 6 KB body gives a row of at most 4,000 characters ending in the marker | AC-17, AC-18, AC-19 |
| SEC2.6 | `POST /api/venues?token=abc` with `password`, `newPassword` and `changePassword: true`: redacted, the flag visible, `Route` without the query | AC-12, AC-20 |
| SEC2.7 | Save a draft with a recognisable name: the row holds `venueId`, `baseVersion`, `draftVersion`, `bytes`, `sha256` and no name | AC-21, AC-30 |
| SEC2.8 | Publish, rollback, clear and an upload: four rows in full, none with bytes | AC-22, AC-30 |
| SEC2.9 | A VIEWER's publish (403) is audited under the VIEWER's id; an anonymous POST that fails the token check is audited with no user; an anonymous POST to an unknown path writes nothing | AC-23, AC-18 |
| SEC2.10 | A malformed body (array, string, wrong types) to each route answers 400 with an English message, no `zod`, no path, no value. Then the order of AC-39: as a MALL_ADMIN, a malformed body to an unknown venue is 400 and a well-formed one 404; as a VENUE_EDITOR, a malformed body to an ungranted venue is 404 | AC-32 to AC-39 |
| SEC2.11 | With PostgreSQL stopped: 503 `{"error":"Database unavailable"}`; a forced unique violation: a message with no constraint name | AC-54 |
| SEC2.12 | In a scratch copy, add a route with no guard and a `res.json({ error: err.message })`; `npm run lint:structural` fails naming file and line for each lint. Revert | AC-41 to AC-52 |

ACs with no manual case, each with its reason:
- AC-1, AC-12 to AC-16, AC-26 to AC-29, AC-31: unit-level, or a measurement; there is no behaviour to drive by hand.
- AC-8, AC-24, AC-25: need an injected fault or a client abort; the API test is the only reliable driver.
- AC-11, AC-37: structure, asserted by a test and a source scan.
- AC-40: unchanged behaviour, covered by FF-1's cases (FF1.x).
- AC-55 to AC-59: records, the runbook lines and the verify run.

## 4. What changes in existing tests and helpers (C1)

Each entry has a one-line reason. The plan names each changed test case.

| File | Action | Why |
|---|---|---|
| `functions/test/app.test.js` | change the "middleware stack is in the standard order" case | the two slots become real middleware with new layer names (AC-11) |
| `functions/test/venueMaps.audit.test.js` | replace | it asserted no audit row for any write (OA-2 AC-44, DC-19); AC-30 asserts the opposite, as its header says R3 would |
| `tools/lint/test/run.test.js` | change the "all ten linters" case | two linters are registered (AC-48) |
| `functions/test/venueApp.js`, `mapApp.js` | change (helpers) | wait on the audit module's `settled()` (AC-26) |
| `functions/test/venueMaps.draft.test.js`, the case "AC-18: the order of refusals: stub, venue, body shape, document, version (one request per pair of neighbours)" [r2] | change | Q1 (a): the body shape (400) now comes before the venue's existence (404), and SEC-1's venue-scope 404 comes before both for a scoped user (AC-39) |
| any other `venueMaps.*.test.js` or `venues.*` case that sends a malformed body to an unknown or another tenant's venue and expects 404 [r2] | change, each named by the plan | same reason. Found by running the suite after the swap. A well-formed request to such a venue stays 404 (OA-2 AC-8, `venueMaps.tenancy.test.js`), so those cases stay unchanged |
| `functions/test/fieldInput.test.js` and the tests of any reader deleted under AC-37 | delete or change, each named | the reader goes with its schema (C2) |
| any test that compares `AuditLog` counts across a request | change | a write, a refusal and an anonymous 401 now write a row. The known ones are above; `venueMaps.draft.test.js`'s "malformed JSON" case (`audits: 0`) still holds, because a body-parse failure never reaches the middleware (EC-5). The rest is found by running the suite |
| `docs/testing/E2E_Test_Cases_Manual.md` | add the SEC2 rows | §3.8 |

These stay unchanged and must pass: `fieldCases.js`/`fieldChecks.js`-based suites, `venues.test.js`, `edits.missingFields.test.js`, `updatedAtDates.test.js`, `controlCharacters.test.js`, `pagination.test.js`, `lookups.test.js`, `idParam.test.js`, `errors.test.js`, `venueMaps.draft/publish/rollback/clear/backdrops/catalog/tenancy` (AC-34).

## 5. Edge cases

Each is covered by the criterion named, or has a one-line reason.

**Offline or stale package**
- EC-1: A shopper phone holding an old package is unaffected. SEC-2 changes no published row or package and adds no shopper route; staging is admin-only (L184, Q5). Reason, no test.
- EC-2: An editor that goes offline mid-autosave and retries in a burst: at OA-2's 1.5-second cadence that is about 40 requests a minute against 1,200, so a 429 is unlikely. A 429 carries `Retry-After` (AC-3), and the client must treat 429 as "wait and retry" (a client concern: OA-4 and SEC-3). The 409 on a stale retry is audited with its status (AC-21).
- EC-3: A client that aborts valid requests (a flaky link) is not locked out of the auth budget by its own aborts (AC-8).

**Empty and maximum data**
- EC-4: A write with no body (no `Content-Type`): `req.body` is undefined. Venue routes answer 400 "The request body must be a JSON object" and map routes the field messages (AC-34, AC-36). The row has no `body` key (AC-19).
- EC-5: The body parser sits before the audit and the limiters in the standard's order. A 413 or "Malformed JSON body" ends there: it consumes no limiter budget and writes no audit row (AC-23). A 5 MB body is parsed before any limit applies. That is inherited from §3.1, and the cost is bounded by `MAX_JSON_BODY` and `maxInstances = 1`.
- EC-6: A redacted payload of exactly 4,000 characters is not cut, 4,001 is, and a surrogate pair at the cut is not split (AC-19).
- EC-7: A body deeper than 8 levels, an array of 100,000 elements, or one 5 MB string: the walk stops at its budget and leaves the marker (AC-14). A 4 MiB layout gives a body-free row (AC-21).
- EC-8: `RATE_LIMIT_PER_MIN=1`: the first request passes, the second is 429 (AC-2). `0` is refused at start (AC-1).
- EC-9: Many distinct client keys (a botnet): the in-memory store holds one entry per key and drops it one window after its last use (source-checked, §10). Memory is bounded by the window, not by a count. No target is stated (§7). Reason, no test.
- EC-10: A fixed window lets a client send up to twice the ceiling across a window boundary. That is the library's behaviour and is accepted at these limits. Reason, no test.
- EC-11: A route path over 400 characters (an authenticated 404) is cut in `Route` (AC-18, AC-28).

**Tenant boundary**
- EC-12: The audit row's `TenantId` is `req.tenantCompanyID`. A body or query `tenantId` for another tenant changes nothing in the row (AC-18, AC-29), and the venue service still refuses a different echoed `tenantId` (AC-40).
- EC-13 [r2]: A SUPERADMIN acting as a tenant: `TenantId` is the acted tenant and `ActingAsTenantId` (`req.actingAsTenantId`) is set on every audited write (AC-18). A SUPERADMIN's act-as **read** writes no row: a known gap by ruling (Q3 (a), AC-23, DC-26).
- EC-14: The limiters key on the client IP, not on a tenant or a user. One office behind one address shares one budget across tenants. That is the standard's own warning (§3.2) and is accepted. Reason, no test.
- EC-15: A schema never lets a client choose the tenant. The tenant is not a schema field on any route (AC-33).

**Each role**
- EC-16: The limiters and the audit are role-blind. SUPERADMIN, MALL_ADMIN, VENUE_EDITOR and VIEWER are limited the same, and each one's writes are audited (AC-18).
- EC-17 [r2]: A VIEWER's refused publish (403) and a VENUE_EDITOR's refused publish are audited with the refusing status and the refused user's id (AC-18, SEC2.9). A VENUE_EDITOR's draft save is audited with the body-free row (AC-21), and its clear is audited in full (it is allowed, S-8; AC-22).
- EC-18 [r2]: A role or permission guard answers 403 before `validate`, so a VIEWER's malformed body is 403, not 400 (the ranked order, AC-41). A venue-scoped user's malformed body to an ungranted venue is 404, before `validate` (AC-39).
- EC-19 [r2]: A request with no `X-Tenant-Id` gets SEC-1's 400 before `validate`, for every role, SUPERADMIN included. The row has `TenantId` NULL and the user's id (AC-18).
- EC-19a [r2]: A request naming an inactive tenant gets SEC-1's 403 for every role except SUPERADMIN, before the guards and `validate`; it is audited with `TenantId` NULL. A SUPERADMIN proceeds and its write is audited with `ActingAsTenantId` (AC-18). Verify: API test.
- EC-19b [r2]: For a tenant-wide user (MALL_ADMIN, SUPERADMIN), a malformed body to an unknown venue is 400 and a well-formed one 404 (AC-39). The 400 reveals nothing about the venue (it is the same for a venue that exists and one that does not), and the 404 for a well-formed request is the answer OA-2's AC-8 already gives.

**Permission denied**
- EC-20: A 401 or 403 is audited if the request is POST, PUT or DELETE (AC-23). A 429 is not (AC-23). A failed permission lookup (503, fail-closed) does not consume auth budget (AC-7).
- EC-21: A key that has used its auth budget gets 429 on **every** request, including valid ones, until its window ends (AC-7). With the client's 401 handler freezing further calls (PH2 §2), a signed-out admin page does not keep sending. Accepted; the limit is the ruling (PH2 Q3). A one-off lock-out on staging clears at the window's end (at most `AUTH_RATE_LIMIT_WINDOW_MIN` minutes).

**Concurrent edits**
- EC-22: Two saves on one base: one answers 200, the other 409, and each is audited with its own status (AC-17, AC-21). Rows have no ordering guarantee other than `CreatedAt`.
- EC-23: Requests in flight count against the auth budget until they finish, because the library gives a hit back only when the response finishes (source-checked). More than `AUTH_RATE_LIMIT_MAX` concurrent requests from one key can therefore be limited even if all are valid. With one admin page that makes a handful of parallel calls, and the default 15, that is not reached. Accepted; noted for the staging check.
- EC-24: Twenty concurrent requests against a ceiling of ten: exactly ten pass. The in-memory counter increments inside one event-loop turn (AC-2). Verify: API test.

**Publish in progress**
- EC-25: A publish is audited when its response finishes, so `CreatedAt` is the end of the build, not its start (AC-18). A 409 "publish already running" is audited with 409.
- EC-26: A client that disconnects during a long publish gets one row with 499 when it is signed in (AC-25). The publish itself carries on.
- EC-27: A publish that answers 501 (no builder, before FF-3′) is audited with 501 (AC-22).

**Invalid input**
- EC-28: A `?page=2&page=3` (an array), `?sortBy[]=x` or `?search[a]=b`: the query schema is lenient and takes the defaults, with no 500 (AC-32).
- EC-29: A body key `__proto__`, `constructor` or `prototype`, in a venue body or inside `layout`: the audit's output is built from own properties (AC-13) and the schemas strip unknown keys. OA-1's validator already refuses them in the document.
- EC-30: A `code` that is an array, or a number: "Code must be text" (AC-34). A control character: today's message (AC-34).
- EC-31: A malformed `X-Request-Id` is replaced by the request id middleware. A valid one of 41 to 64 characters is kept by it, so the audit row holds its first 40 characters (AC-18).
- EC-32: `Content-Type: text/plain` on a JSON route: the body is not parsed, so it is empty (EC-4).
- EC-33: A throwing getter or a cyclic structure in a body cannot come from JSON, but the redaction never throws if one reaches it (AC-13).
- EC-34: An IP that is unparsable or missing: `IPAddress` is NULL (AC-27).

**Lints**
- EC-35: A guard name inside a comment or string is not a guard (`lib/scan.js`; AC-41). A local variable named like a guard but defined in the route file is not resolved as SEC-1's guard: the rank table matches the imported names (AC-41). Verify: unit.
- EC-36: An inline handler containing commas, strings and template literals does not confuse the argument split (AC-41). Verify: unit.
- EC-37: A new route file that nothing mounts is a violation (AC-44), so a route cannot sit unguarded and unreached.
- EC-38: In `raw-error-text`, `err.code === '23505'` and `err.constraint === UNIQUE_CODE` as comparisons (not in a response) pass (`venue.service.js`) (AC-49).

**Hosting**
- EC-39: On Cloud Functions the instance may stop or throttle CPU after the response, so a fire-and-forget audit insert can be late or lost (RECALLED, §10). Locally the row is written. A staging check must show an audit row after a real write (AC-59).

## 6. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | No | `AuditLog` is in 0.15 and no column is added; AC-28 stops the constants drifting from it |
| 2 Seed | No | The seed writes with SQL, not through the API, so no audit row is seeded and no seed row is needed |
| 3 Guard order | Yes | The `route-guard-order` lint is its enforcer (AC-41 to AC-48); SEC-1 builds the order. With SEC-1 and SEC-2 merged, no feature route waives it (PH4 §5 waiver 3 ends) |
| 4 Permission and menu rows | No | SEC-1's (a migration). SEC-2 adds no route |
| 5 Scaffolds, `formatApiError`, four states | No | No screen. The server lint of AC-49 is `raw-error-text` as PH2 defines it. The client's raw-exception interpolation lint is one criterion in SEC-3's spec (Q4 (c), DC-27) |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | No | No colour |
| 9 Automated e2e | Yes, in part [r2] | Met by the HTTP-level API tests in `functions/test` plus SEC2.1 to SEC2.12 (Q2 (a), DC-25). The report records `Waived: 9 (the declarative sub-suite) — R12`, because the standard §7.1 harness does not exist |
| 10 Manuals and smoke guide | Yes, in part | `E2E_Test_Cases_Manual.md` SEC2 rows. No frontend manual change. The smoke guide's staging lines are DEP-1's |
| 11 Changelog | No | Nothing an admin or a shopper sees changes in the app; the 429 text is API-only until a client shows it |
| 12 Companion-file sync table | Yes | Rows: API behaviour (tests, manual, Blueprint Part 1), a limit or setting (`.env.example`, Blueprint), a command or check (lint README, `run.js`), the ledger, the runbook line (AC-55, AC-56) |
| 13 Every field a `FieldSpec` | No | No form |
| 14 New enumerable sets | No new client-facing set | The redaction key lists and the guard rank table are code constants with their authority in a comment (standard A.4; PH2 §7 ruling 6), not option lists a client could extend (rule 5) |
| 15 Inactive-lookup case | No | SEC-2 touches no record that references a lookup. The lookups routes stay read-only |
| G1 Traceability | Yes | Every AC and EC maps to a test or a one-line reason (§3.8, §5) |
| G2 Wording and accessibility | Yes, in part | New messages (the 429, the validation texts) are admin English by design (L165); no shopper phrase, no screen |
| G3 Offline and position privacy | No | No shopper feature; no position is audited (no route carries one) |
| G4 Differences recorded | Yes | A new L-row at merge records: the validate-before-venue-lookup order amending OA-2 AC-18 (Q1 (a)); act-as auditing for writes only, with the read gap (Q3 (a)); the 429 and the anonymous-404 rules for the audit (DC-8); the 499 row (DC-9); `RATE_LIMIT=off` refused outside development and test (DC-5); the `patch` refusal (DC-19); Blueprint Part 1 updated |

## 7. Scale targets

No load, latency or volume target is stated for SEC-2's mechanisms, so none is invented. What is stated:

| Target | Source | How this spec meets it |
|---|---|---|
| One function instance, `maxInstances = 1`; the in-memory limiter and permission cache are valid only while the cap is 1; several instances are release-blocking | Blueprint Part 1 (instance count row) and Part 2.6; PH2 §8; DEPLOY-staging §3 | AC-10 states it at start-up; AC-56 writes it into the runbook; AC-5's guard keeps the kill switch off a deployed function |
| Global ceiling 1,200 per minute per client key; auth limiter about 15 failures in 15 minutes | standard §3.2 | AC-1 (defaults, env-tunable) |
| Audit row about 4 KB, `PayloadDiff` at most 4,000 characters; row shape of §3.6 | standard §3.6; `db/schema.sql` §9; Blueprint Part 3 | AC-19, AC-28 |
| JSON body at most 5 MB (`MAX_JSON_BODY`); a map document at most 4 MiB (`MAX_MAP_BYTES`) | standard §3.1; OA-1 AC-32; OA-2 §8 | AC-14 and AC-21 keep the audit's cost bounded at the largest body; AC-31 measures it, with no gate |
| Autosave 1.5 s after the last change; one editor per venue | OA-2 §8 (re-plan Q7 (a)) | Derived, not a target: up to 40 audit rows a minute per editing admin, each about 200 bytes with Q16's body-free row (AC-21) instead of up to 4 KB |
| Pilot up to about 5 tenants; peak concurrent users and requests per hour **measured at the pilot** | PRD §7 (L109; Blueprint OQ1) | No request-rate target exists, so the limits are the standard's defaults and are env values that the pilot's measurement can retune (AC-1). That is an open item for the pilot, not a SEC-2 decision |
| Staging: the owner only, one login per role | DEPLOY-staging §6 Q3 (a) | A handful of requests; the limits are not tuned for load |
| Audit retention: a proposal of 24 months online, then archived | `db/schema.sql` (a comment); Blueprint Part 3 | Not built here (§9) |

## 8. Design choices

Each is a DESIGN CHOICE, not a requirement, and names an alternative that also meets what is stated.

- **DC-1 The limit values are env values read at start-up.** The intent allows "settings or env values". The limiter factory takes plain numbers, and with one instance a restart is a cheap change. *Alternative:* `GlobalSetting` keys read per request through `limit: (req) => …`. That retunes without a restart but adds an async read to every request.
- **DC-2 Names and defaults of the auth limiter's values.** `AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_MIN`; 15 and 15, from the standard's "about 15 attempts" and "15-min window" and PH2 Q3's "15 minutes". The count is the standard's, not a Gabay ruling. *Alternative:* another count (for example 10 or 30), which the owner can set in `.env`.
- **DC-3 The auth limiter counts only 401.** Its success test is "status is not 401", and an aborted request is given back with a `close` listener, because the library only returns a hit on `finish`. *Alternatives:* the library's default (any status of 400 or more counts), which a stale-save 409 or a 400 would exhaust; or a check-then-count design on the store directly, which avoids in-flight counting (EC-23) but replaces the library's middleware.
- **DC-4 The 429 goes through the error handler** (`{ error }`, standard §3.8), with the `RateLimit-*` headers on and the `X-RateLimit-*` ones off. `Retry-After` needs one of the two families on. *Alternative:* the library's default body (a plain string) and legacy headers, which breaks the one error shape.
- **DC-5 `RATE_LIMIT=off` is refused outside development and test.** It uses the same raw-`NODE_ENV` rule as the Auth emulator host (L151), so a deployed function cannot start with its limits off. L184 Q7 (b) kept "no production-mode refusal at start-up" for `NODE_ENV` in general; this is a refusal of one dangerous flag, in the shape L151 already uses. *Alternative:* honour it everywhere with a loud `warn` and a runbook line.
- **DC-6 The windows are named constants and the limiter factory takes them as arguments**, so a test uses a short window. *Alternative:* a module-level override read from an env value, which would make a window configurable in production without a reason.
- **DC-7 No route is skipped by the global limiter today.** Standard §3.2 asks for a `skip` for machine-cadence and held-open routes (webhooks, SSE); none exists yet. The factory accepts a `skip` function, and the first such route (P1's sentinel ingest) supplies it. *Alternative:* build an empty allow-list now.
- **DC-8 A 429 is not audited** (an anonymous 404 is not either, as ruled). The limiter sits after the audit in the standard's order, so without this each blocked request would write a row and the limiter would protect nothing for the database. *Alternative:* audit them. The write rate would then be the flood's.
- **DC-9 An aborted signed-in request writes one row with status 499.** The standard's `finish` hook never fires when the client disconnects, though the handler may still commit a write; 499 is the common convention for "client closed the request" (RECALLED, not a standard). *Alternative:* `finish` only, as the standard shows, which leaves such a write unattributed.
- **DC-10 `Route` is the path without the query.** The query is in `PayloadDiff`, redacted. The standard's snippet stores `req.originalUrl`, which would keep a `?token=` value unredacted. *Alternative:* `originalUrl` capped at 400.
- **DC-11 `RequestId` is cut to the column's 40 characters.** `requestId.js` accepts a client id of up to 64, and the insert would fail on a longer one (the row lost). *Alternatives:* lower the middleware's limit to 40 (a change to `requestId.test.js`), or widen the column by a migration (rule 4).
- **DC-12 `EntityName` and `EntityId` stay NULL.** The standard's row shape does not include them, and the viewer is R9's. *Alternative:* fill them from a route table (for example `VenueMap`, the venue id), which is more to maintain.
- **DC-13 The body snapshot is bounded by a node budget** (the plan sets the value). The standard's A.4 walk is unbounded, and a 4 MiB layout arriving every 1.5 seconds would be walked in full for a row that keeps 4,000 characters. *Alternative:* an unbounded walk, with the draft route skipping it by name.
- **DC-14 A route declares that its row is body-free** (for the draft save, by a route-level declaration that names a summary function). The audit module reads it at finish and writes the summary in place of the body. *Alternative:* an allow-list inside the audit module keyed by route template, which drifts when a route is renamed and then falls back to a truncated body.
- **DC-15 `sha256` is of the layout as received** (`JSON.stringify` of `req.body.layout`), not of the canonical copy OA-1 stores. It needs nothing from the service and is the same for a refused save. *Alternative:* the canonical copy's hash, which matches `DraftJson` but exists only for a successful save.
- **DC-16 The redaction lists add `idtoken`, `refreshtoken` and `accesstoken` as exact keys** to the standard's A.4 lists, because a whole-key `token` does not catch them and the shopper sign-in routes (R10) will carry them. Exact keys have no false positives. *Alternative:* A.4 verbatim, or a `token` stem, which would also redact keys such as `tokenCount`.
- **DC-17 `validate` hands validated values to the handler as `req.valid.*`, with messages written in the schemas.** Express 5's `req.query` is a read-only getter (source-checked), so it cannot be replaced. Writing each message in its schema keeps every existing answer identical (AC-34), so the existing suites are the acceptance test. *Alternative:* zod's default messages through a mapping layer, which changes the text of every 400 and so every field test.
- **DC-18 Every guarded route has a `validate` step, including a no-input route (`validate()`).** The lint can see a step; it cannot see whether a handler reads input. *Alternative:* require it only on routes with a body method or a path parameter, which would let a list route's query go unchecked.
- **DC-19 The lint refuses `patch`, `all` and `route()`.** The audit covers POST, PUT and DELETE, so a mutating method outside them would be a write that escapes the trail. *Alternative:* audit PATCH too, which departs from the ruled list.
- **DC-20 The lint resolves mounts through the router's own `require`s.** The intent says the router is the one source of truth. *Alternative:* a manifest of routes and their guards, which is a second source that drifts.
- **DC-21 Two annotations with a required reason** (`// guard-exempt:`, `// raw-error:`), the pattern of `// tenant-scope:` and `// sql-identifiers:`. REVIEW.md reads every one. *Alternative:* a list of exempt routes in the linter, which hides the reason from the line.
- **DC-22 The auth limiter sits after the global one, both at the slot.** *Alternative:* the auth limiter only on route groups that call `auth`, which duplicates mounts and would miss an unguarded route.
- **DC-23 `validate` replaces the hand-written readers instead of wrapping them.** The old readers' messages move into the schemas, and the readers that nothing calls are deleted (AC-37). *Alternative:* call the old readers from inside zod `refine` steps, which keeps two implementations.
- **DC-24 [r2] `validate` runs before the venue lookup (Q1 (a)); the upload keeps its pre-body venue check.** This is the order ruled in PH2 Q6, and the lint can see it. A malformed body to an unknown venue is 400, which reveals nothing about the venue. SEC-1's venue-scope step still comes first for a scoped user (AC-39). The upload's `venueFirst` stays before multer because it protects a 15 MB read. *Alternatives:* (b) keep OA-2's order by adding a ranked "data scope" step that checks the venue before `validate`: the order of OA-2's AC-18 is kept, the lint's table gains a rank Q6's text does not list, and each map route reads the venue twice (SEC-1's venue-scope step, which exists already for scoped users, is a narrower form of it); (c) run zod inside the service after the venue lookup: no order change, but the lint cannot see it.
- **DC-25 [r2] What an "e2e case" is for SEC-2 (Q2 (a)).** The HTTP-level API tests in `functions/test` (the real app on an ephemeral port over the real database in a rolled-back transaction, run by the CI job named `e2e`) plus the manual cases SEC2.1 to SEC2.12. *Alternatives:* (b) build the standard §7.1 harness now (`tests/e2e/`, an npm script, a CI step) and put SEC-1's and SEC-2's cases in it, which pulls R12 forward; (c) manual cases only, which contradicts DEPLOY-staging §1. SEC-1 r1's Q5 (a) is the same ruling.
- **DC-26 [r2] Act-as auditing covers writes only (Q3 (a)).** `ActingAsTenantId` is recorded on every audited write, and a read-only act-as leaves no row. The gap is stated in AC-23 and EC-13. *Alternative:* (b) also write a row for every request that carries an act-as, GET included, which extends the standard's method list and adds a row for every page a SUPERADMIN opens.
- **DC-27 [r2] The lint is server-only in SEC-2 (Q4 (c)).** The Flutter half of "no raw error text to users" becomes one criterion in SEC-3's spec, so the screens lane's coder builds it with the screens it guards. The main session chose this over (a), *an entry of its own in the screens lane*, to avoid an orphan pipeline entry that no slice owns. *Alternative:* (b) both halves in SEC-2, a Dart scan in the same linter, which would put `app/` in SEC-2's diff and cross the server and screens lanes (L174).

## 9. Not in scope

- The escalation guards: only SUPERADMIN grants SUPERADMIN, and a delegated grant cannot raise its own rights. No route writes grants until R6 (DEPLOY-staging §1).
- The client: handling of 429 and `Retry-After`, the sign-in screen and session (SEC-3, OA-4). The Flutter lint for raw exception text: one criterion in SEC-3's spec (Q4 (c), DC-27).
- The boot guard, Cloud Storage, the Cloud SQL connection and the operator tool (DEP-0), and the staging project and CI deploy (DEP-1).
- A shared (multi-instance) rate-limit or permission store: the cap of one instance is release-blocking until then (Blueprint 2.6).
- Limits for the public package routes of P0-04's server half. The Blueprint's Public-Read rule asks for a limit chosen "with carrier-grade NAT in mind", which one per-IP ceiling cannot be, so that slice decides it (the `skip` of DC-7 is its seam).
- The audit viewer, an audit retention job and a "historical scrubber" (R6, R9; the module is shared so one can be added).
- A `pino` `redact` configuration for the logs, and any change to what the logs hold.
- Auditing reads, including a SUPERADMIN's act-as reads (Q3 (a); a known gap, AC-23).
- A new migration or any schema change.
- OA-1's validator and OA-2's services, except the envelope readers and the order Q1 decides.

## 10. Notes for the plan; what was checked and what was not

**Source-checked in the installed packages** (versions are `functions/package.json`'s pins):
- `express-rate-limit` 8.7.1:
  - the options (`dist/index.d.ts` 362 to 521);
  - the hit is counted on entry and given back only on the response's `finish` when `skipSuccessfulRequests` is set, and the default success test is status below 400 (`dist/index.cjs` 829 to 831, 912 to 916, 1039 to 1050);
  - `Retry-After` is set only when `legacyHeaders` or `standardHeaders` is on (1052 to 1059);
  - the default 429 sends the configured `message` (848 to 855);
  - the default key is `req.ip`, with an IPv4-mapped IPv6 address folded to IPv4 and IPv6 grouped by /56 (44 to 62, 833 to 846);
  - the `MemoryStore` window starts at the key's first hit, entries are dropped a window after last use, and its timer is `unref`'d (65 to 129; 95 to 98);
  - it validates `trust proxy` (381 to 406).
- Express 5.2.1: `req.query` is a getter (`lib/request.js` 217). The `router` package sets `req.params` per matched layer (`index.js` 285 to 287).
- `zod` 4.6.5: `strictObject`, `looseObject`, `flattenError`, `treeifyError` and `prettifyError` exist (`v4/classic/schemas.d.ts`, `v4/core/errors.d.ts`).

**RECALLED, not checked this session.** The plan checks each with a doc fetch or a test before it carries weight:
- zod (zod.dev, "Defining schemas" and "Customizing errors"): `z.object` strips unknown keys by default; a custom message is set with the `error` parameter; the order of issues follows the schema's key order. The tests of AC-32 to AC-34 settle all three.
- Node (nodejs.org, `http.ServerResponse`): `finish` does not fire when the connection closes first, and `close` does. AC-25 and AC-8's tests settle it.
- Express (expressjs.com, "behind proxies"): with `trust proxy` set to a hop count, `req.ip` is the address the trusted proxy appended. AC-6's test settles it.
- The Fetch standard's list of CORS-safelisted response headers: `Retry-After` is not on it, so it must be exposed (AC-3).
- Cloud Functions on Cloud Run (the "Tips and tricks" page on background activity, and Cloud Run's "CPU allocation"): CPU may be throttled or the instance stopped after the response, so a fire-and-forget write can be lost (EC-39).
- PostgreSQL (character types): `VARCHAR(n)` counts characters, not bytes; the 4,000 cap is in characters.
- 499 as "client closed request" (DC-9) is a convention, not a standard.
- pino: `req.log.error({ err }, …)` writes the error's stack to the log (pino's default `err` serializer). Logs are not responses, so `raw-error-text` does not apply to them.

**For the plan:**
- Order the work so that `redactSecrets` and the audit module come before the limiters' tests need them, and the lints come last, because `route-guard-order` needs every route to have its `validate` step (AC-45) and SEC-1's names (S-4).
- `functions/test/venueApp.js` runs every request over one rolled-back connection; the audit insert must go through the same `db`, and `settled()` (AC-26) is how a test waits.
- The known sites for the lints today: `utils/errors.js:69` (`err.message`, sanctioned, AC-51), `mapBackdrop.service.js:47` and `venueMaps.js:47` (`UPLOAD_ONE_IMAGE.message`, a constant: not flagged by AC-49).
- No new dependency: `express-rate-limit`, `zod` and `pino` are pinned; `crypto` is Node's.
- **Handed to SEC-3's spec [r2]:** one criterion for the Flutter half of "no raw error text to users" (an exception's text never interpolated into a screen; errors go through `formatApiError`), with its own lint in the screens lane's tooling. SEC-2 does not write it.
- **Handed to SEC-1 (a check, not a change) [r2]:** SEC-2's rank table needs the venue-scope step's exported name and SEC-1's statement that it sits after the permission guard and before validation (SEC-1 AC-55). AC-41's rank 4b depends on it.
- **Handed to OA-2's records [r2]:** OA-2's AC-18 order is amended by AC-39; the plan adds the note to the ledger and the G4 L-row, not a new OA-2 revision.

## 11. Questions

**No question is open.** r1 raised Q1 to Q4. They were ruled as below (the main session's technical rulings under L174; the owner's sitting is L186), and each ruling is folded into r2. The options stay as the record. Q1 to Q3 took the recommended option (a). Q4 took (c), not the recommended (a).

**Q1 [spec-writer] Ruled (a) [r2]. Where does body validation sit relative to the venue lookup on the map routes?** Applied in AC-39, §4, DC-24. Q6 (L149) ranks `validate` before the handler. OA-2's AC-18 and AC-8 put the venue's 404 before the body's 400, and `venueMaps.*` tests assert it.
- (a) **Recommended:** `validate` first, as ruled. A malformed body sent to another tenant's or an unknown venue answers 400, a well-formed one 404, so nothing about a venue's existence leaks. OA-2's AC-18 step order is amended (the body shape moves above the venue), and the plan names the few order-of-refusal tests that change. The venue lookup stays in the service. The upload route keeps its pre-body venue check (it protects a 15 MB read).
- (b) Keep OA-2's order by adding a ranked step **between permission and validate** that checks the venue belongs to the tenant (standard §3.4's Layer 3, data scope). The lint's rank table gains a rank the owner's Q6 text does not list, and each map route reads the venue twice.
- (c) Run zod inside the service after the venue lookup. No order change, but it is not a route boundary step, so `route-guard-order` cannot see it.

**Q2 [spec-writer] Ruled (a) [r2]. What is "an e2e case" for SEC-2, given that the standard §7.1 e2e harness does not exist yet?** Applied in §3.8, §6, DC-25. CI's job named `e2e` is `npm run verify`'s database half (its `api-tests` check among them). The intent and DEPLOY-staging §1 ("the 'waived 9' ends for new work") want SEC-1 and SEC-2 to carry their own cases, and R12 builds the suite. SEC-1's spec needs the same ruling.
- (a) **Recommended:** HTTP-level API tests in `functions/test` (the real app on an ephemeral port, the real database in a rolled-back transaction), which the `e2e` job already runs, plus the numbered manual cases SEC2.1 to SEC2.12. FEATURE_PIPELINE item 9 is met in this form and its automated-phase wording is left to R12.
- (b) Build the standard §7.1 harness now (a `tests/e2e/` suite with its assert, phase and api helpers, exit code = failures, an npm script and a CI step) and put SEC-1's and SEC-2's cases in it. This is R12's work, pulled forward, and it touches CI and the plan's size.
- (c) Manual cases only, with item 9 waived to R12 as before. This contradicts DEPLOY-staging §1.

**Q3 [spec-writer] Ruled (a) [r2]. Does "every act-as is audited" (PH2 S2, L121) include the GET requests a SUPERADMIN makes while acting as a tenant?** Applied in AC-23, EC-13, DC-26. The audit covers POST, PUT and DELETE only (standard §3.6, the intent).
- (a) **Recommended:** writes only. Every audited write carries `ActingAsTenantId`; a read-only act-as leaves no row. This is written down as a known gap.
- (b) Also write a row for every request that carries an act-as, GET included. The standard's method list is extended, and the row count rises with each page a SUPERADMIN opens.

**Q4 [spec-writer] Ruled (c), not the recommended (a) [r2]. Does `raw-error-text` cover the Flutter client as well as the server?** Applied in §3.6, §9, DC-27. The main session chose (c) over (a) to avoid an orphan pipeline entry. The intent and PH2 P2-S8 define it for the server ("no driver text, stack or schema names reach a response"). L128 and FEATURE_PIPELINE §5 item 5 word it as "no raw error text to users" and "raw exception interpolation", which reads as the client lint (an exception's text shown in a screen instead of going through `formatApiError`).
- (a) The recommendation: the server only, as the intent says. The Dart half becomes its own entry in the screens lane, with SEC-3, because SEC-2 is the server lane (L174) and `app/` is another coder's.
- (b) Both in SEC-2: a Dart scan in the same linter. SEC-2 then touches `app/` and the screens lane, and AC-49 to AC-54 grow.
- (c) **(Ruled.)** The server now, and the Dart half added to SEC-3's spec as one criterion.

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-14 | First revision, from the intent, PH2 §3 and §7, DEPLOY-staging, PH4 §6 and §7, the standard, and the code in the main folder's working tree (OA-2 merged; origin/main read as 09b2788). Written against SEC-1's intent (no SEC-1 spec yet). Raises Q1 to Q4 |
| r2 | 2026-10-14 | Folds in the rulings (the main session's technical rulings under L174; the owner's sitting is L186). **Q1 (a):** `validate` runs before the venue lookup; OA-2's AC-18 is amended; the order-of-refusal tests are named (AC-39, §4, DC-24); the upload keeps its pre-body venue check. **Q2 (a):** e2e evidence is API tests plus SEC2.1 to SEC2.12, with `Waived: 9 (the declarative sub-suite) — R12` (§3.8, §6, DC-25). **Q3 (a):** act-as auditing covers writes only, the read gap written down (AC-23, EC-13, DC-26). **Q4 (c):** the lint is server-only, the Dart half goes to one criterion in SEC-3's spec (§3.6, §9, DC-27). **SEC-1's names folded in:** `req.actingAsTenantId`, `getActingAsTenantId()`, `actAsTenants`, `requireRole`, `requirePermission`, the venue-scope step between the permission guard and `validate`, tenant-wide and venue-scoped roles, a VENUE_EDITOR may clear, an inactive tenant is 403 except for a SUPERADMIN (§2, S-1 to S-8; AC-18, AC-41 with a rank 4b, EC-17 to EC-19b). **New:** AC-59 (the runbook lines). **Changed ACs, marked [r2]:** AC-18, AC-23, AC-30, AC-39, AC-41, AC-56, AC-59 (new); the §3.6 and §3.8 introductions. Q1 to Q4 are closed; no question is open |
