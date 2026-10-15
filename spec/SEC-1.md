Spec SEC-1. Revision: r2 (2026-10-14). Intent: intent/SEC-1-tenant-context-authorization.md

# SEC-1: Real tenant context and authorization on every admin route; the development stub deleted

> **Pipeline entry:** SEC-1 (the retrofit's R1 tenant context and R2 authorization, pulled forward by L184) · **Slice:** SEC-1, stage S (`plan/DEPLOY-staging.md` 1.0 §1, §2; `plan/PH4-feature-first.md` 1.4 §4 "Order under L184 and L185") · **Coder:** api-coder on **Opus 5.5** (auth and tenancy, high risk; L184) · **Status:** r2 (r1's five questions ruled at the owner's sitting of 2026-10-14, recorded as L186; one new ruling folded in: the real Firebase Auth project); nothing is open · **Record numbers:** L186 (this sitting's rulings); L184 and L185 (plan.html 1.04: sign-in first, the MVP cut); L149 (`plan/PH2-identity.md` §7 rulings 1, 6, 8, 12, 13 and L151's §7a, the content of P2-S2 and P2-S3); L121 and DC28 (an admin may hold several tenants); L41 (the role matrix); L153 and L175 (E-20 and its amendments); L155 (inactive tenants left to R1); L174 (lanes; technical choices as DESIGN CHOICEs); L165 (the admin page is English by design).
>
> **Rulings carried, not reopened.** Every request names its tenant in `X-Tenant-Id`, accepted only with a `UserRole` there; SUPERADMIN may name any tenant (PH2 Q1). The guard order is `auth → tenantContext → role guard → permission guard → validate → handler` (PH2 Q6). Only SUPERADMIN bypasses permission rows (PH2 Q8). The verifier resolves either identity, and admin routes accept only an `AppUser` (PH2 Q12; built in S1). The redundant `UserRole` index is dropped in the first migration this slice owns (PH2 Q13, ruled L149). Per-user overrides apply in every tenant the user belongs to (L151 §7a). The emulator-host guard stays as it is: no production-mode refusal at start-up (DEPLOY-staging §6 Q7 (b); L151 ruling 1).
>
> **r2: rulings of 2026-10-14 (L186), each as recommended in r1.** Every changed AC below is marked `[r2]`.
> - **Q1 (a):** a VENUE_EDITOR may clear a draft; P0-11 AC-137 stands. T2's cell changes to `venue-maps` Delete allowed for VENUE_EDITOR.
> - **Q2 (a):** MALL_ADMIN and SUPERADMIN are tenant-wide; only VENUE_EDITOR and VIEWER need `UserVenueGrant` rows. P0-03 AC-54's "with a venue grant" and P0-01 AC-31's "remove venues" are recorded as G4 differences this spec settles.
> - **Q3 (a):** an inactive tenant answers 403 `This tenant is not active` for everyone except SUPERADMIN, whose act-as is logged.
> - **Q4 (a):** `GET /api/me` adds a top-level `actAsTenants` list (id, code, name, active) for a SUPERADMIN only (the same answer as SEC-3's Q4).
> - **Q5 (a):** the e2e evidence is the real-HTTP API tests plus the manual cases SEC1.1 to SEC1.19 on the Auth emulator. The report records `Waived: 9 (the declarative sub-suite) — R12` (the main session's technical ruling under L174).
> - **New owner ruling (touches SEC-1):** the Firebase project is created on the Spark plan now and used for the REAL Firebase Auth (sign-in), while the API and the database stay on this machine. No deploy until Blaze. So the local API must verify tokens from the real project as well as from the emulator (AC-57, §3.10). The emulator stays the test path.
>
> **Sources read for r1** (the code was read from the main folder's working tree on branch `records-l174-l177`. The coordinator named `origin/main` 09b2788; I could not run `git` in this session, so a difference between the two is unchecked):
> - the intent; `plan/PH2-identity.md` (§2, §3 P2-S2 and P2-S3, §4 DC2, §7, §7a, §8); `plan/DEPLOY-staging.md` (§0, §1, §3, §5, §6 and the owner's rulings); `plan/PH4-feature-first.md` (§1 rule 5, §5, §6 R1 and R2, §7 the whole ledger); `intent/SEC-2-limits-lints-audit-validation.md` and `intent/SEC-3-admin-sign-in-session.md` (to keep the three slices' edges clean);
> - `functions/src/routes/api.js`, `venues.js`, `venueMaps.js`, `venueMapCatalog.js`, `lookups.js`, `me.js`, `dev.js`; `middleware/devStub.js`, `auth.js`, `requireTenant.js`; `auth/accessStore.js`, `permissionMerge.js`, `identityStore.js`, `firebaseVerifier.js`; `app.js`, `config/index.js`, `config/settings.js`; `utils/errors.js`, `requestContext.js`; `db/connectionError.js`; `services/venue.service.js` (its list and its stamps);
> - `db/schema.sql` 0.15 (`Tenant`, `AppUser`, `Role`, `PermissionRoute`, `RolePermission`, `UserPermission`, `UserRole`, `UserVenueGrant`, `AuditLog`, the header), `db/migrations/0001_venue_map_storage.sql` and its README, `db/tools/setup-db.js`, `db/tools/test/migration0001.test.js`; `db/seeds/lib/accounts.js` and `lookups.js` (the five admin accounts and the shopper; the four roles);
> - the test harnesses in `functions/test/` (`venueApp.js`, `authHelpers.js`, `helpers.js`, `config.devOnly.test.js`) and the list of test files that name the stub; `tools/verify.js` (its schema checks run `setup-db`, so migrations run before the API tests) and `.github/workflows/e2e.yml`;
> - Blueprint Part 1 (routing and auth constraints, invariants 13, 14 and 16, `<known_traps>`), §2.4, §2.6, Part 3 §3.1, Part 4 §4.6, §4.14, §4.15; PRD §6.2, §7; `plan.html` L41's role table; the standard's §3.4, §3.5, §6 and Appendix A.2 (read in `Engineering Standards.html`); FEATURE_PIPELINE §5;
> - the approved specs that already state who may do what: `spec/P0-01.md` (AC-31), `spec/P0-03.md` (AC-54, EC-83), `spec/P0-11.md` r3 (AC-137, AC-143), `spec/OA-2.md` r1 (the eight routes), `spec/OA-3.md` (its permission waiver).

## 1. What this delivers

On the server only:

1. **Tenant context (R1).** `tenantContext` after `auth` and `requireAdminUser` on every admin route. `req.tenantCompanyID` is set only from `X-Tenant-Id`, checked against the user's `UserRole` rows. SUPERADMIN may name any existing tenant, and the request then carries `actingAsTenantId`. Venue scope comes from `UserVenueGrant`.
2. **Authorization (R2).** A role guard, then `requirePermission(routes[], action)`: route × create, read, update, delete; role rows OR-ed; a `UserPermission` row replaces the merged row; SUPERADMIN bypasses; a 30 s cache with a bust hook; a three-valued verdict; fail-closed 503 when the lookup fails.
3. **The development stub deleted:** `devStub.js`, `requireTenant.js`, `routes/dev.js` (`GET /api/dev/accounts`), the `X-Dev-Act-As` header and `DEV_STUB_USER_EMAIL`. `createApp()` no longer builds a stub, so the API boots with `NODE_ENV=production`.
4. **Migration 0002** (the next free number; OA-3a's "0002" moves up, as its plan says): the four `Role` rows if absent, the `PermissionRoute` rows and the default `RolePermission` grants for the 14 routes built so far (§2.4), and the drop of the redundant `UserRole` index (PH2 Q13).
5. **`GET /api/me`** keeps returning the user, their tenants and merged permissions (S1). The permission maps are now filled from the migration's rows.
6. **Its own e2e cases** for auth, tenant isolation and RBAC on the routes it guards (§3.9): real-HTTP API tests plus manual cases on the Auth emulator `[r2]`.
7. **Token verification against the real Firebase project as well as the emulator `[r2]`.** The local API verifies ID tokens from the owner's real (Spark-plan) project when configured for it, with no code change between the two modes (§3.10, AC-57).

SEC-1 ends E-20's waivers 3 and 4 for the 14 routes of §2.3. Their ledger rows close as AC-53 lists.

**A consequence to know before merging.** After SEC-1 is on `main`, the admin page in `app/` still sends no bearer token and (for most users) no `X-Tenant-Id`, so its calls answer 401 until SEC-3 merges. SEC-3 is the next slice of stage S in the screens lane (DEPLOY-staging §2). The Flutter tests do not call the server (not checked), so they stay green. EC-51 records this.

## 2. Terms, the chain, and the two tables

### 2.1 Terms

- **"The tenant"** is `req.tenantCompanyID` and nothing else (rule 2). It comes only from `X-Tenant-Id`, validated against the database.
- **"Own roles"** are the user's active `UserRole` rows in the named tenant, plus their active platform rows (a NULL-tenant row of a role flagged `IsPlatformRole`). `accessStore.loadForUser` already ignores inactive roles.
- **"Refused"** is an HTTP 4xx or 503 in the standard shape `{ error }` and nothing else (standard §3.8; a 4xx may carry the named extra keys `utils/errors.js` allows, none are used here), with nothing written.
- **Messages** (admin English by design, L165). The first two are the stub's own words, kept so existing client strings and manual cases keep their meaning:
  - `M-NO-TENANT` (400): `Choose a tenant: this works inside one tenant`.
  - `M-NOT-HELD` (403): `This account has no access to that tenant`.
  - `M-INACTIVE-TENANT` (403, ruled Q3 (a)): `This tenant is not active`.
  - `M-FORBIDDEN` (403): `You do not have permission to do this`. The role guard and the permission guard use this one text, so a refusal does not say which layer refused.
  - `M-UNAVAILABLE` (503): `Permission check unavailable`.
- **A "tenant-wide" role** sees every venue of its tenant: SUPERADMIN and MALL_ADMIN (ruled Q2 (a)). The others are "venue-scoped" and see only venues with a `UserVenueGrant` row.
- **"The access snapshot"** is the cached result of `accessStore.loadForUser(userId)`: roles, role permissions and user permissions (AC-24).

### 2.2 The chain

Every route of §2.3 runs, in this order:

`auth` → `requireAdminUser` → `tenantContext` → role guard → permission guard → venue scope (only where the route names a venue or lists venues) → the handler. Validation stays inside the handler and its service until SEC-2's zod boundary (R5) takes its place in the order. `GET /api/me` runs `auth, requireAdminUser` only (no tenant is chosen yet; it lists the tenants). `GET /api/health` stays public. The groups are mounted per path, as today, so an unknown path with no token still hits the group's `auth` first (EC-43).

### 2.3 T1: the 14 guarded routes

| # | Route | Permission key | Action | Venue scope |
|---|---|---|---|---|
| 1 | `GET /api/lookups/:name` | `lookups` | read | no |
| 2 | `GET /api/lookups/:name/:id` | `lookups` | read | no |
| 3 | `GET /api/venues` | `venues` | read | the list is filtered |
| 4 | `POST /api/venues` | `venues` | create | no (the venue is new) |
| 5 | `GET /api/venues/:venueId` | `venues` | read | yes |
| 6 | `PUT /api/venues/:venueId` | `venues` | update | yes |
| 7 | `GET /api/venues/:venueId/map` | `venue-maps` | read | yes |
| 8 | `PUT /api/venues/:venueId/map/draft` | `venue-maps` | update | yes |
| 9 | `POST /api/venues/:venueId/map/backdrops` | `venue-maps` | create | yes |
| 10 | `GET /api/venues/:venueId/map/backdrops/:key` | `venue-maps` | read | yes |
| 11 | `POST /api/venues/:venueId/map/clear` | `venue-maps` | delete | yes |
| 12 | `POST /api/venues/:venueId/map/publish` | `venue-versions` | create | yes |
| 13 | `POST /api/venues/:venueId/map/rollback` | `venue-versions` | create | yes |
| 14 | `GET /api/venue-maps/catalog` | `venue-maps` | read | no (the catalog is the tenant's) |

Publishing is Create on `venue-versions` (Blueprint §2.4, P0-03 AC-54). A rollback is a publish, so it takes the same key and action (P0-11 AC-137: "a restore is a publish"). The map's own writes sit on `venue-maps` (P0-03 EC-83, OA-2's ledger rows). Where the three documents differ in the key's name, the keys above follow P0-03 EC-83 and OA-2's ledger (DC-6).

### 2.4 T2: the default grants (what migration 0002 seeds)

C, R, U, D are CanCreate, CanRead, CanUpdate, CanDelete. `✓` is true, `-` is false. Every cell below is a seeded row, including the all-false ones (DC-8).

| Permission key | MALL_ADMIN | VENUE_EDITOR | VIEWER |
|---|---|---|---|
| `lookups` | C- R✓ U- D- | C- R✓ U- D- | C- R✓ U- D- |
| `venues` | C✓ R✓ U✓ D- | C- R✓ U- D- | C- R✓ U- D- |
| `venue-maps` | C✓ R✓ U✓ D✓ | C✓ R✓ U✓ D✓ `[r2]` (Q1 (a)) | C- R✓ U- D- |
| `venue-versions` | C✓ R- U- D- | all false | all false |

- **SUPERADMIN has no rows** and bypasses (PH2 Q8, DC-7). Its publish, rollback and clear come from the bypass.
- In words: MALL_ADMIN and SUPERADMIN create and update venues, save drafts, upload floor plans, publish, roll back and clear. VENUE_EDITOR reads, saves drafts, uploads floor plans and may clear a draft (Q1 (a), ruled `[r2]`; a clear empties the draft and deletes no published version), and may not create or edit a venue, publish or roll back. VIEWER reads only. `/lookups` is read-only for every role.
- `venues` Delete is false for everyone because no route deletes a venue (P0-01 B4; a venue is switched off with `IsActive`). P0-01 AC-31's "remove venues" has no route to guard.

## 3. Acceptance criteria

Format: `AC-n: <observable outcome>. Verify: <how>. E2E: <SEC1.n, or none with a reason>`. The E2E ids are the manual cases of §3.9. The automated counterpart of each is an API test through real HTTP over real tables (§3.9, ruled Q5 (a)). In r2 no question is open; an AC changed by a ruling or by the real-project verification is marked `[r2]`.

### 3.1 Authentication, through the real routes

- AC-1: **The chain.** Each of the 14 routes of §2.3 runs the steps of §2.2 in that order. A request that fails step k never reaches step k+1: nothing is read or written, no service function runs, and (for the upload) no body byte is parsed. `GET /api/me` runs `auth, requireAdminUser` only. `GET /api/health` needs no token. Verify: API test, one request per route per step, with the service layer and the SQL log (`record()`) showing nothing ran after the refusing step. E2E: SEC1.14.
- AC-2: **Token refusals, kept from S1, now proved on every route.** On each of the 14:
  - no `Authorization` header, a malformed one, a bad, expired or revoked token: 401, `Authentication required`, `Invalid session` or `Session expired` as S1 says;
  - a sign-in older than `auth.idTokenMaxAgeS`, or a token with no `auth_time`: 401 (`Session expired`, `Invalid session`);
  - an inactive `AppUser`: 401 `Account is not active`;
  - a verified Firebase identity with no `AppUser`, and a shopper's token: 403 `This account has no access`;
  - Firebase or the database unreachable inside `auth`: 503.

  Verify: API test. At least one case goes through the real token-verification code path (an unsigned emulator-mode token and the fake Identity Toolkit of `authHelpers.js`), not only the injected verifier. E2E: SEC1.2.

### 3.2 Tenant context (R1)

- AC-3: **A request must name its tenant.** On each route of §2.3, `X-Tenant-Id` missing, empty or blank answers 400 `M-NO-TENANT`, before any role, permission or handler step. This holds for every role, SUPERADMIN included. There is no default tenant: the stub's "first tenant by `Tenant.Code`" is gone (DC-4). Verify: API test, every route, every role. E2E: SEC1.3.
- AC-4: **A tenant the user does not hold is 403, always the same body.** A value that is malformed, one the user holds no `UserRole` in, and one that is no tenant at all each answer 403 `M-NOT-HELD`, with the same status and the same body, so a request cannot tell "exists" from "does not exist". The check is made with the strict pattern `^[1-9][0-9]{0,8}$` (the `parseIdParam` rule, after trimming surrounding blanks), before any query. These each answer 403: `0`, `007`, `-1`, `1.5`, `1e3`, `0x10`, `abc`, `1,2`, `1 OR 1=1`, `١٢٣` (Arabic-Indic digits), ten or more digits, and a value that is a real tenant id with an inner space. A repeated header reads as one comma-joined value in Node (RECALLED), so it is refused the same way. Verify: API test (a table of those values; the SQL log shows no statement ran for a malformed one). E2E: SEC1.3.
- AC-5: **A held tenant proceeds.** With a tenant the user holds a `UserRole` in (an active role of an active tenant, AC-11), `req.tenantCompanyID` equals it and the request goes on. The data read and written is that tenant's: a venue created through `POST /api/venues` is stored with that `TenantId`. Verify: API test (a row-level check of `Venue.TenantId`). E2E: SEC1.3.
- AC-6: **Rule 2: nothing but the header and the database picks the tenant.** The verified token's extra claims (`tenantId`, `companyId`, `tenant`, `firebase.tenant`), the query string (`?tenantId=`), the JSON body (`tenantId`), and `req.user` never change `req.tenantCompanyID`. A token that claims tenant B while the header names tenant A acts in A; the same token with a header naming B, which the user does not hold, is 403. Verify: API test (the fake verifier returns extra claims). E2E: SEC1.3.
- AC-7: **A cross-tenant read and a cross-tenant write are refused for every role.** For each of SUPERADMIN, MALL_ADMIN, VENUE_EDITOR and VIEWER, in two parts:
  - **(a) A tenant not held.** Naming it answers AC-4's 403 on all 14 routes. SUPERADMIN is the one role this part does not apply to, because it may name any existing tenant.
  - **(b) A held tenant, another tenant's data.** With tenant A named, a venue id of tenant B answers 404 `Not found` on every route of §2.3 that names a venue (the three reads, routes 5, 7 and 10, and the six writes, routes 6, 8, 9, 11, 12 and 13), and a lookup row of tenant B answers 404 on `GET /api/lookups/:name/:id`. SUPERADMIN is included here. Nothing is read from, or written to, the other tenant: its `Venue`, `VenueMap`, `VenueVersion`, `VenueMapBackdrop` and `StoredFile` counts are unchanged, and the file store holds no new key.

  Verify: API test, a table of roles × routes × the two parts. E2E: SEC1.4.
- AC-8: **One user, two tenants, two sets of rights.** A user who is MALL_ADMIN in tenant A and VIEWER in tenant B, with one token, can publish when the header names A, and is refused (403 `M-FORBIDDEN`) when it names B. Their `/api/me` lists both. Platform roles apply in every tenant. Verify: API test. E2E: SEC1.18.
- AC-9: **SUPERADMIN.** A user who holds SUPERADMIN as a platform role (a NULL-tenant `UserRole` row of a role flagged `IsPlatformRole` with the code `SUPERADMIN`; `holdsSuperAdmin`):
  - naming any existing tenant proceeds, held or not;
  - naming none is AC-3's 400;
  - naming a tenant that does not exist is AC-4's 403.

  A NULL-tenant row of any other role, or of a role not flagged as a platform role, grants nothing (S1's rule, kept: it is ignored and logged by ids). Verify: API test. E2E: SEC1.5.
- AC-10: **Acting as another tenant is carried and logged.** A request is an act-as when a SUPERADMIN names a tenant in which it holds no tenant-role row of its own (DC-10). Then:
  - `req.actingAsTenantId` is that tenant's id, and otherwise it is null;
  - the request context returns the same value from a new getter, in any service, after any `await`, and after the multipart parser (AC-45);
  - one structured `info` log line `acting as another tenant` is written with the user id and the tenant id only;
  - **no `AuditLog` row is written**: the audit middleware is SEC-2's (R3), which writes `AuditLog.ActingAsTenantId` from the field this slice provides (AC-55 records the contract).

  Verify: API test and a unit test of the context. E2E: SEC1.5.
- AC-11: **An inactive tenant `[r2]` (Q3 (a), ruled).** A request naming a tenant whose `IsActive` is false answers 403 `M-INACTIVE-TENANT` for every role except SUPERADMIN, which proceeds (its act-as is logged, AC-10). `GET /api/me` still lists the tenant, marked `isActive: false` (S1). Verify: API test (a tenant created inactive inside the rolled-back transaction). E2E: SEC1.15.
- AC-12: **Inactive roles and users, and users with no role.**
  - A user whose only role in the named tenant is an inactive `Role` gets AC-4's 403: the role is not counted.
  - An `AppUser` with no `UserRole` row at all signs in (it is a valid Gabay account), receives an empty `tenants` list from `/api/me`, and gets 403 `M-NOT-HELD` on every tenant route.
  - An `AppUser` set inactive after sign-in answers 401 on its next request (no cache stands between `auth` and `AppUser.IsActive`).

  Verify: API test. E2E: SEC1.15.

### 3.3 Role guard and permission guard (R2)

- AC-13: **The role guard.** `requireRole(codes)` passes when the user's own roles (§2.1) include at least one listed code, and otherwise answers 403 `M-FORBIDDEN`. On all 14 routes the list is the four admin roles of L41 (SUPERADMIN, MALL_ADMIN, VENUE_EDITOR, VIEWER). The role guard is therefore the closed-role-set floor (standard §3.4 layer 1), and the permission rows make the distinctions between the four (DC-1). The guard is a group-level mount, so it also runs on a path no route answers (EC-43). Verify: unit test (the guard against plain role data, including a role that is not listed, no roles, and a platform role) and API test. E2E: none of its own; every refusal in SEC1.6 to SEC1.8 passes through it.
- AC-14: **A guard cannot be built wrong.** `requireRole` throws when the app's routes are built if its list is empty, not an array, or holds a non-string. `requirePermission` throws at build time if `routes` is empty, not an array or holds a non-string, or if `action` is not one of `create`, `read`, `update`, `delete`. A typo in a route table therefore stops the API from starting and never ships as an open or closed route. There is no `strict` argument: every guard is strict (DC-2). Verify: unit test. E2E: none; it is a construction-time error that no request can reach.
- AC-15: **A three-valued verdict, always strict.** For the listed routes and the action, over the user's merged permissions for the named tenant (AC-17):
  - **ALLOWED:** at least one listed route has a merged row whose bit for the action is true. The request goes on.
  - **DENIED:** at least one listed route has a merged row, and none grants the action. 403 `M-FORBIDDEN`.
  - **UNCONFIGURED:** none of the listed routes has a merged row (no role row and no override). 403 `M-FORBIDDEN`, and one `warn` log line naming the route keys (keys only, no user data). Standard A.2 would let such a request through unless `strict` is set; Gabay sets it everywhere (DC-2).

  With several routes listed, any one granting the action is enough (DC-2). Verify: unit test (the three verdicts, several routes, a key with no row) and an API test with a route key that has no row. E2E: none; "unconfigured" needs a route key with no migrated row, which no real route has once AC-38 holds.
- AC-16: **SUPERADMIN bypasses permission rows and nothing else.** A user who passes `holdsSuperAdmin` is ALLOWED without a verdict, whatever rows or overrides exist, including an all-false `UserPermission` row for the route. The bypass is on the permission guard only: the chain, the tenant rule (AC-3, AC-4, AC-9), the venue lookup and the handler's checks still apply. MALL_ADMIN gets no bypass and goes through its rows (PH2 Q8). Verify: unit test and API test. E2E: SEC1.5.
- AC-17: **One merge, shared with `/api/me`.**
  - The role rows of every role the user holds in the named tenant, platform roles included, are OR-ed per route.
  - A `UserPermission` row replaces the merged row for its route. It may take rights away (all false), and it applies in every tenant the user belongs to (L151 §7a).
  - A route with no row is absent, which is UNCONFIGURED.
  - The guard and `/api/me` call the same function (`mergeRoutePermissions` through one per-tenant derivation that `buildAccessProfile` and the guard share). The merge has no second copy.

  Verify: unit test (the existing `permissionMerge` cases stay green) and API test: a VENUE_EDITOR given a `UserPermission` row that grants `venue-versions` Create can publish (the request reaches the builder port); a MALL_ADMIN given an all-false row for `venue-maps` is refused on read (403) while the role guard passes. E2E: SEC1.9.
- AC-18: **The matrix of §2.4, role by role and route by route.** For each of the 14 routes and each of SUPERADMIN, MALL_ADMIN, VENUE_EDITOR and VIEWER, the answer is what T1 and T2 give: a role the matrix allows reaches the handler and gets the route's normal answer (publish and rollback answer 501 with no builder, OA-2 AC-30, or 200 with the fake builder); a role it does not allow gets 403 `M-FORBIDDEN`. The expected answer is computed from T1 and T2 by the test, so a change to a grant fails it. Verify: API test, table-driven, 14 × 4. E2E: SEC1.6, SEC1.7, SEC1.8.
- AC-19: **VIEWER reads only.** Routes 1, 2, 3, 5, 7, 10 and 14 answer normally. Routes 4, 6, 8, 9, 11, 12 and 13 answer 403 `M-FORBIDDEN`, and nothing is written: the `Venue`, `VenueMap`, `VenueVersion`, `VenueMapBackdrop` and `StoredFile` counts are unchanged, and the file store holds no new key. Verify: API test. E2E: SEC1.6.
- AC-20: **VENUE_EDITOR saves and may clear, and does not publish `[r2]`.**
  - Reads (routes 1, 2, 3, 5, 7, 10, 14) answer normally.
  - A draft save (route 8) answers 200 and a floor-plan upload (route 9) answers 201.
  - Venue create and update (4, 6), publish (12) and rollback (13) answer 403 with nothing written.
  - Clear (11) answers 200 and empties the draft; published versions and `PublishedVersion` are unchanged (Q1 (a), ruled).

  Verify: API test. E2E: SEC1.7.
- AC-21: **MALL_ADMIN and SUPERADMIN do everything on the 14 routes.** In a tenant each holds or may name: create (201) and update (200) a venue, save a draft, upload a floor plan, clear, and publish and roll back (501 with no builder, after OA-2's own checks; 200 with the fake builder). A publish by a VIEWER or VENUE_EDITOR answers 403 and not 501, so the guard comes before the handler's "no engine" answer. Verify: API test. E2E: SEC1.8.
- AC-22: **The order of refusals.** The first check that fails gives the answer:
  1. `auth`: 401, 403 (no account, a shopper), 503;
  2. `tenantContext`: 400 (no header), 403 (not held, or inactive for a non-SUPERADMIN, AC-11), 503;
  3. the role guard: 403;
  4. the permission guard: 403, or 503 if the lookup failed;
  5. the venue scope: 404;
  6. the handler's own order (OA-2: the venue 404, the body 400, the version 409, and so on).

  So a VIEWER publishing in a tenant it does not hold gets the tenant's 403 and not a permission refusal; a VIEWER publishing to a venue id that does not exist gets 403 and never 404, so a role without the right learns nothing about venue ids. Verify: API test, one request per pair of neighbouring steps. E2E: SEC1.14.
- AC-23: **Fail closed (standard §6 item 5).** When the access snapshot cannot be loaded, whether inside `tenantContext` or the guard, the answer is 503 `M-UNAVAILABLE`. It is never 200, never 403, and the handler never runs. This holds for a connection-level error, a non-connection `pg` error (a missing table, SQLSTATE 42P01) and a plain thrown `Error`. The driver's text is logged and never shown. A failed load is not cached. Separately, a database failure inside `auth` keeps S1's behaviour (503 `Database unavailable` for a connection failure). Verify: API test with a fault-injecting database double, the three kinds; a manual stop of PostgreSQL mid-session. E2E: SEC1.11.
- AC-24: **The access cache.**
  - **(a)** It holds the access snapshot per verified user id (never per token or per header) for 30,000 ms, a named constant citing standard §3.4 and PH2 S3. The clock is injected.
  - **(b)** Within the TTL a request issues no query for it.
  - **(c)** After the TTL it reloads.
  - **(d)** A rejected load is not cached, and no stale entry is served when a reload fails (DC-17).
  - **(e)** `invalidate(userId)` and `invalidateAll()` exist and are tested. No route writes a grant until R6, so nothing calls them yet. R6's every grant write, role write and user write must (AC-55 records it).
  - **(f)** Until then, a grant changed by SQL (an operator, or `npm run migrate` run outside the process) is seen within 30 s. The module's header comment says the cache is valid only while `maxInstances = 1` (Blueprint §2.6).
  - **(g)** The snapshot holds plain rows and never a token.

  Venue grants are cached under the key (user id, tenant id) (AC-29) and are cleared by the same two calls. Verify: unit test with the injected clock. E2E: SEC1.9 (a `UserPermission` row added by SQL is honoured after about 30 s).
- AC-25: **One load per request at most.** Across `tenantContext`, the role guard, the permission guard and the venue scope, a request issues at most one access-snapshot load (none when the cache is warm), and at most one grants read (none for a tenant-wide role). The guards read what `tenantContext` stored on the request (DC-5). Verify: API test (the SQL log counts the statements on `UserRole`, `RolePermission`, `UserPermission` and `UserVenueGrant`, cold and warm). E2E: none; a statement count is not visible to a client.

### 3.4 Venue scope (Layer 3) `[r2]`: Q2 (a) is ruled; MALL_ADMIN and SUPERADMIN are tenant-wide, only VENUE_EDITOR and VIEWER need grants

- AC-26: **Who is scoped.** SUPERADMIN and MALL_ADMIN are tenant-wide: every venue of the named tenant. VENUE_EDITOR and VIEWER see only venues with a `UserVenueGrant` row for them in the named tenant. A user holding several roles in the named tenant is tenant-wide if any one is. The tenant-wide set is one named constant with L41 as its authority (DC-14). Verify: unit test and API test. E2E: SEC1.10.
- AC-27: **The list.** `GET /api/venues` for a venue-scoped user lists only granted venues, and `totalCount`, `page`, `pageSize` and `search` work within them. A scoped user with no grant gets 200 with `items: []` and `totalCount: 0`, never an error. A tenant-wide user lists every venue of the tenant. The granted ids go in as one bound array parameter (rule 3). Verify: API test. E2E: SEC1.10.
- AC-28: **A venue by id.** For routes 5 to 13, an ungranted venue of the named tenant answers 404 `Not found`, the same body as a venue that does not exist, before the handler reads or writes the venue. A malformed `:venueId` is 404 as today (`parseIdParam`). Verify: API test (the SQL log shows no statement on the venue). E2E: SEC1.10.
- AC-29: **Grants are read with the tenant bound (rule 2).** A scoped user's grants are read with `TenantId` bound from `req.tenantCompanyID`, only when a scoped role is in play, and not loaded for every tenant and filtered afterwards. A grant the user holds in tenant B gives nothing in tenant A. The composite foreign key `FK_UserVenueGrant_Venue` makes a grant to a venue of another tenant impossible, and a test shows it. Verify: API test; integration (the FK). E2E: SEC1.10.
- AC-30: **Creating a venue creates no grant.** A MALL_ADMIN who creates a venue sees it at once (it is tenant-wide). A VENUE_EDITOR or VIEWER of the tenant does not see it until a grant exists (R6's grant API, R9's screen). Verify: API test. E2E: SEC1.10.

### 3.5 `GET /api/me`

- AC-31: **The S1 shape, with real permissions.** The answer is `{ user, isSuperAdmin, platformRoles, tenants: [{ tenantId, code, name, isActive, roles, permissions }] }` as in S1. With migration 0002's rows, a MALL_ADMIN's `permissions` are the MALL_ADMIN column of T2 and a VIEWER's are the VIEWER column. The per-tenant `permissions` come from the same derivation the guard uses (AC-17), and from the same cached snapshot. For every user, tenant, route key and action, "the guard allows" equals "the `/api/me` flag is true", or the user is SUPERADMIN. Verify: API test (the consistency sweep). E2E: SEC1.1.
- AC-32: **A SUPERADMIN's tenants `[r2]` (Q4 (a), ruled; the same answer as SEC-3's Q4).** `/api/me` for a SUPERADMIN adds a top-level `actAsTenants: [{ tenantId, code, name, isActive }]` listing every tenant, by `Tenant.Code` in code-unit order. For anyone else it is absent or `[]`, and `tenants` is unchanged. This is what SEC-3's tenant picker needs, now that `/api/dev/accounts` is gone. Verify: API test. E2E: SEC1.1.
- AC-33: **Unchanged S1 behaviour.** A shopper token gets 403, no token gets 401, and a role with no tenant gives a platform-only list, all as `me.test.js` pins them. Verify: API test (the existing cases, changed only where C1 names them). E2E: SEC1.1.

### 3.6 The migration and the schema

- AC-34: **Migration `0002_<name>.sql`** is `db/migrations/0002_<snake_case_name>.sql`: four digits, following `db/migrations/README.md`, PascalCase identifiers never quoted, no `BEGIN` or `COMMIT`, one transaction by the runner, ending with a `-- verify:` query holding one `SELECT`. It never edits a committed migration (rule 4). In this order:
  - (i) inserts the four `Role` rows if a role with that `Code` is absent: `SUPERADMIN` (`IsPlatformRole` true), `MALL_ADMIN`, `VENUE_EDITOR`, `VIEWER`, with the labels and flags `db/seeds/lib/lookups.js` uses (DC-9);
  - (ii) inserts the four `PermissionRoute` rows `lookups`, `venues`, `venue-maps`, `venue-versions` with their labels;
  - (iii) inserts the twelve `RolePermission` rows of T2, each row joined by `Role.Code` and `PermissionRoute.RouteKey`;
  - (iv) drops the index `UX_UserRole` (AC-36).

  Every insert does nothing on a conflict, so **a re-run never overwrites a role label or a grant an admin has since changed**. This matters because the runner re-applies every file every time. The file writes `CreatedBy` and `UpdatedBy` as NULL. Verify: integration (the file's text and its effect). E2E: SEC1.13.
- AC-35: **The migration on each state of a database** (scratch databases, as `migration0001.test.js` builds them):
  - **(a)** a fresh database from `schema.sql` and the migrations: 4 roles, 4 route rows, 12 grant rows, the index absent;
  - **(b)** a 0.15 database that has migration 0001 and no 0002: the same result, and existing rows untouched;
  - **(c)** run twice: no change;
  - **(d)** after an admin's `UPDATE` of a grant and of a role label: a re-run keeps both edits;
  - **(e)** after `npm run seed` has already created the roles: no duplicate role, 4 in all;
  - **(f)** after a grant row was deleted by hand: a re-run restores it (EC-48);
  - **(g)** a role of the same code but a different `IsPlatformRole` (bad data): the migration keeps it, and `holdsSuperAdmin` then refuses the bypass (S1's rule).

  Verify: integration, in `db/tools/test/`. E2E: SEC1.13 (a, c, d).
- AC-36: **The redundant index goes (PH2 Q13, ruled L149).** `UX_UserRole` (a plain unique index on `(UserId, RoleId, TenantId)`) is dropped from `schema.sql` and by the migration. `UQ_UserRole` (`UNIQUE NULLS NOT DISTINCT` on the same columns) still refuses a duplicate row, a NULL-tenant one included (SQLSTATE 23505). The premise of Q13 has moved since L149: 0.14 made `UQ_UserRole` stricter, so the two are no longer identical, but the dropped index is wholly covered by the kept one (EC-49 and Suggestions). Then:
  - `schema.sql` carries version 0.16 with its header note;
  - the table count stays 58, the trigger count stays 2, and the index count goes from 137 to 136 (the plan re-counts at the merge, because OA-3a's migration also changes the counts, and merge order decides);
  - `db/tools/setup-db.js`'s `EXPECTED.indexes` matches;
  - `schema.sql` runs twice on PostgreSQL 18.6.

  Verify: `npm run verify` (the schema checks run `setup-db`, which warns when the counts differ) and an integration test of `UQ_UserRole`. E2E: none; a schema count has no request to send.
- AC-37: **The seed is untouched and still green.** `npm run seed` and `npm run seed:test` pass with no change under `db/seeds/`: the seed finds each role by `Code` and inserts none (its `seedPlatform`). After `setup-db` and the seed there are exactly four `Role` rows. Verify: `npm run verify` (the seed checks); `git diff` shows no change under `db/seeds/`. E2E: none; the seed's own tests carry it.
- AC-38: **One source for the route keys.** The four keys are named in one module that the guards import (DC-12), and a test compares that module with the migrated `PermissionRoute` rows in both directions: every key a guard uses has a row, and every row has a key. SEC-2's `route-guard-order` lint checks the order and not the keys, so this test is what proves "no route names a key that has no row". Verify: integration. E2E: none; it compares code with rows.
- AC-39: **The schema's companion files.** Blueprint Part 3 §3.1 (the permission tables are now seeded; the role rows by migration), `db/SCHEMA_READING_GUIDE.md`, `INSTALL.md` (two lines of counts), `docs/testing/Smoke_Test_Guide.md` (its index count), and `db/migrations/README.md` (the second migration, and that a later migration may drop). Verify: review (the sync-table pass by dod-reviewer). E2E: none; documents.

### 3.7 The development stub deleted

- AC-40: **The files and names are gone.** Deleted: `middleware/devStub.js`, `middleware/requireTenant.js`, `routes/dev.js`, `services/devAccounts.service.js`, `identityStore.findAdminByEmail` and `listActiveAdminsByEmailSuffix` (their only callers were the stub and the switcher's route), `accessStore.listTenants` (except that Q4 (a), ruled, re-uses it for `actAsTenants`: it stays, its annotation re-worded) `[r2]` and `config.devStub`. A search of `functions/src`, `.env.example`, `INSTALL.md`, `README.md`, `tools/` and `.github/` for `devStub`, `createDevStub`, `requireTenant`, `X-Dev-Act-As`, `DEV_STUB_USER_EMAIL`, `canBeActedAs` and `/api/dev` finds nothing. The deletions are earlier than the ledger's "R8 deletes" wording because they have no caller left (DC-11); SEC-3 deletes the client side. Verify: review plus the search output pasted into the PR. E2E: SEC1.12.
- AC-41: **The old header and route do nothing.** A request carrying `X-Dev-Act-As` is judged as the token's own user: a VIEWER's token with `X-Dev-Act-As: superadmin@gabay.test` gains nothing. `GET /api/dev/accounts` answers the ordinary 404 under every `NODE_ENV`, development and test included. Verify: API test. E2E: SEC1.12.
- AC-42: **The API boots outside development.** With `NODE_ENV=production` written explicitly, no emulator host, and the real verifier, `createApp()` builds with no error and no stub log line. `GET /api/health` answers 200, a guarded route with no token answers 401, and a guarded route with a valid token and `X-Tenant-Id` works. The Functions-emulator health check of `npm run verify` stays green. Verify: API test (a config of `NODE_ENV=production`). E2E: SEC1.12.
- AC-43: **The emulator guard is exactly as it was.** `FIREBASE_AUTH_EMULATOR_HOST` is refused unless the raw environment says `NODE_ENV=development` or `test` (`config.devOnlyAllowed`, `DEV_ONLY_ENVS`). No new refusal is added at start-up: a production-mode check is DEPLOY-staging Q7, ruled (b). Verify: unit test (the emulator cases of `config.devOnly.test.js` stay unchanged; only its stub-user cases go). E2E: none; start-up configuration.
- AC-44: **Configuration and docs lose the stub `[r2]`, and gain the two sign-in modes.** `.env.example` and `INSTALL.md` also document the two modes of §3.10 (`FIREBASE_AUTH_EMULATOR_HOST` for the emulator; `FIREBASE_PROJECT_ID` and the credential variable for the real project), with the credential left empty. `.env.example`, `INSTALL.md` and `.github/workflows/e2e.yml`'s comment on the stub (the comment only; `NODE_ENV=development` stays in the job's `.env` because the emulator guard needs it) no longer mention it. Blueprint's `<known_traps>` "development stub trap", §4.15 and the places in §4.6 that say "behind the development stub" are rewritten (AC-55). Verify: review. E2E: none; documents.

### 3.8 Request context, stamps, upload order, logs, errors

- AC-45: **The context carries three values to every service.** After `tenantContext`, `getActorId()`, `getTenantId()` and a new `getActingAsTenantId()` return the verified user's `AppUser` id, `req.tenantCompanyID` and `req.actingAsTenantId`, at any `await` depth. The upload route's parser wrapper re-binds all three after multer, because multer calls `next()` from stream events that do not carry the async context (the comment in `routes/venueMaps.js`; today it re-binds two). A nested `AsyncLocalStorage.run` gives the inner chain its own store (RECALLED); the tests prove the values. Verify: unit test of the context; API test through route 9 as a SUPERADMIN acting as another tenant. E2E: SEC1.19.
- AC-46: **Writes are stamped with the verified user.** `Venue.CreatedBy` (route 4), `Venue.UpdatedBy` (6), `VenueMap.UpdatedBy` (8), `VenueMapBackdrop.CreatedBy` and `StoredFile.CreatedBy` (9) and `VenueVersion.CreatedBy` (12, through the fake builder) equal the `UserId` of the user who sent the request. They are never the stub's user, never null. Verify: API test (rows read back). E2E: SEC1.19.
- AC-47: **The upload is guarded before its body is read.** A floor-plan upload (route 9) by a VIEWER answers 403, one with no token 401, one for an ungranted venue 404, and one naming a tenant the user does not hold 403, each with the file store untouched and no multipart byte parsed. The guard chain comes first, then the venue check, then the parser. A valid upload by a VENUE_EDITOR answers 201. Verify: API test (a valid PNG fixture; a spy on the parser and the file store). E2E: SEC1.17.
- AC-48: **No secret in the logs.** The `Authorization` value and the token never reach a log line or an error body: after a refusal and a success the fake logger's captured text holds no substring of the token. `req.log` carries `userId`, `tenantId` and (when set) `actingAsTenantId`, ids only. Verify: API test (the `loggedText` helper). E2E: none; it needs the server's log, which the manual run does not capture.
- AC-49: **One error shape.** Every refusal of this slice is `{ error }` with no other key, in the messages of §2.1 or S1's, and no driver, table or constraint text (`assertRefused`'s pattern). The role guard and the permission guard answer the same text. Verify: API test, in every case above. E2E: SEC1.2, SEC1.3, SEC1.6.
- AC-50: **Browser preflight still works.** An `OPTIONS` request with an allowed `Origin`, `Access-Control-Request-Method: PUT` and `Access-Control-Request-Headers: authorization,x-tenant-id,content-type` on a guarded path answers 2xx with no token, and its allowed headers include `authorization` and `x-tenant-id`. The app-level `cors` middleware answers a preflight before the per-path guards (the `cors` package's default behaviour, RECALLED; this AC is the check). Verify: API test. E2E: SEC1.16.

### 3.9 Tests, manuals, ledger, records, measurement

- AC-51: **Automated e2e coverage `[r2]` (Q5 (a), ruled).** The slice's automated e2e is a set of API tests through real HTTP (`createApp` on a port, real tables inside an always-rolled-back transaction, L151), with a verifier double for the matrix and the real token-verification path for the sign-in cases. It runs in `api-tests` inside the CI job named "e2e". It has at least these cases:
  - the matrix of AC-18 (14 × 4);
  - a cross-tenant read and a cross-tenant write refused for every role (AC-7);
  - a VIEWER's publish is 403 (AC-19);
  - a VENUE_EDITOR's draft save is allowed and its publish refused (AC-20);
  - a MALL_ADMIN's publish reaches the builder port (AC-21);
  - an override (AC-17);
  - a fault-injected 503 (AC-23);
  - the stub's absence (AC-41);
  - a production-mode boot (AC-42);
  - the real-project verifier mode as far as a test can show it with no credentials (AC-57).

  The emulator stays the test path: no automated test needs a real Firebase project or a key. PR description: the traceability table (G1) maps every AC and EC to its test. Verify: `npm run verify`, ending `ALL GREEN`, pasted. E2E: this AC is the e2e.
- AC-52: **The manual cases `[r2]`.** `docs/testing/E2E_Test_Cases_Manual.md` gains section "SEC-1" with the cases SEC1.1 to SEC1.19 of §6, run against the Auth emulator, and SEC1.20, the owner-run check against the real project (AC-60): sign in through the Identity Toolkit REST call (`accounts:signInWithPassword`, as `db/seeds/lib/accounts.js` does), then call the API with the returned ID token and `X-Tenant-Id`. The stale cases are rewritten or removed in the same change: FF0.16 to FF0.18 (the stub's own cases), SK.1 to SK.12 (the switcher's server side), every FF1 and OA2 case that sends no token, `X-Dev-Act-As`, or no tenant header, and the "Test accounts" and "Pre-flight" text that names `DEV_STUB_USER_EMAIL`. FF0.3's `abc` case stays as it is (403, AC-4). Verify: review. E2E: this AC is the manual.
- AC-53: **The retrofit ledger** (`plan/PH4-feature-first.md` §7). These 16 rows are updated:
  - **The 14 route rows** (`GET /api/lookups/:name`, `GET /api/lookups/:name/:id`, the four venue routes, the eight OA-2 map and catalog rows): the tenant-context cell reads `real (SEC-1)`; the guard-order cell reads `closed (SEC-1); proved by SEC-2's route-guard-order lint`; the permission-row cell reads the key and action of §2.3; the menu-row cell reads `n/a (no menu table, PH2 Q9: SEC-3 builds the menu from /api/me and names this key)`; the E2E cell adds `auth, tenant and RBAC: SEC1.n and the SEC-1 API tests; this route's own CRUD e2e stays R12`. The old "Any role may write until R2" and "the stub does not filter inactive tenants" notes go.
  - **The two stub rows** (`GET /api/dev/accounts` and the `X-Dev-Act-As` header): closed, marked "deleted by SEC-1".

  Left open for their slices: the Audit and Validation cells (SEC-2), the screen rows (the banner, the shell, the home, the placeholder, the switcher, the shopper shell: SEC-3), and the storage row (DEP-0). Verify: review. E2E: none; a document.
- AC-54: **The waivers `[r2]`.** The slice's report records that items 3 and 4 are not waived for the 14 routes, and records item 9 as `Waived: 9 (the declarative sub-suite) — R12` (Q5 (a), the main session's technical ruling under L174). dod-reviewer checks that no route of §2.3 is still waived. Verify: review. E2E: none; a document.
- AC-55: **Records, in the same change `[r2]`** (sync table). The L-row for L186 and the amendments it makes are the records lane's; this spec lists what they touch:
  - **E-20** and `plan/PH4-feature-first.md` §1 rules 1 and 2, `plan/DEPLOY-staging.md` and CLAUDE.md's opening paragraph and "Phase gate" sentence: the local API now talks to the real Firebase Auth of a Spark-plan project (sign-in only; no deploy, no Hosting, no Function, no Cloud SQL), as L186 words it;
  - Blueprint Part 1 (routing and auth constraints: the two sign-in modes) and §4.14;
  - Blueprint Part 1 (`<known_traps>`: the stub trap is rewritten to "the stub is gone"; routing and auth constraints), Part 3 §3.1 and Part 4 §4.14 (the chain, the tenant rule, the keys and the matrix), §4.15 (the stub paragraphs go), §4.6 (the "behind the development stub" lines);
  - CLAUDE.md ("Things agents get wrong": the stub bullet; the opening description of the admin side);
  - `plan/PH4-feature-first.md` §1 rule 5 and §3 (the stub text);
  - `plan.html`: an L-row at merge, per G4;
  - `docs/ops/DEPLOYMENT_RUNBOOK.md`: one line that a grant changed outside the process is seen within 30 s;
  - **the contract for SEC-2:** the fields `req.user`, `req.tenantCompanyID` and `req.actingAsTenantId`, the context getters, the venue-scope step's place in the order (after the permission guard, before validation, which `route-guard-order` must allow), and the cache's two invalidation calls;
  - **the contract for R6:** every grant, role or user write calls them.

  Verify: review (dod-reviewer's sync-table pass). E2E: none; documents.
- AC-56: **Measured, not gated.** For a VIEWER on `GET /api/venues` through `createApp` on this machine, 20 requests with a cold cache and 20 with a warm one: the median and p95 of the whole request, and the number of SQL statements issued before the handler (cold and warm). The figures are pasted into the PR. No target is stated (PRD §7 leaves peak load to the pilot), so there is no gate. Verify: integration (measured). E2E: none; a measurement.

### 3.10 Verifying tokens from the real Firebase project as well as the emulator `[r2]`

The new owner ruling: the real Firebase Auth (a Spark-plan project) signs the admins in, while the API and the database stay on this machine and nothing is deployed. The emulator remains the test path (`db/seeds/firebase.json`, the `@gabay.test` accounts).

- AC-57: **Two modes, one code path, chosen by the environment alone `[r2]`.**
  - **Emulator mode (development and test):** `FIREBASE_AUTH_EMULATOR_HOST` is set. The project is `demo-gabay` unless `FIREBASE_PROJECT_ID` says otherwise. Unsigned tokens are accepted by the SDK in this mode (S1; `config/index.js`).
  - **Real-project mode:** `FIREBASE_PROJECT_ID` is the real project's id, and `FIREBASE_AUTH_EMULATOR_HOST` is **unset** (an empty value counts as unset, as `parseConfig` already treats it). The verifier then does not set the process-wide emulator variable (`firebaseVerifier.js` sets it only when a host is configured). Tokens are checked with `verifyIdToken(token, true)`, the same call as today, so revocation is checked in both modes (S1's ruling is unchanged).
  - **A token from one mode is refused in the other:** an emulator token (unsigned, project `demo-gabay`) presented to a real-project API answers 401 `Invalid session`; a real token presented to an emulator-mode API answers 401. Nothing is accepted by default.
  - No route, guard or table differs between the modes: the user is still found by `AppUser.FirebaseUid`, and everything after `auth` is as in AC-1 to AC-56.

  Verify: unit test of `parseConfig` (project id set and no host gives `firebase.projectId` equal to it and `authEmulatorHost` null; an emulator host still needs an explicit development or test `NODE_ENV`, AC-43) and of the verifier (the emulator variable is not set in real mode); API test for the emulator-token-to-real-mode refusal, with the SDK's own header check refusing an `alg: none` token before any network call (RECALLED: the plan confirms it at step 0, and if the SDK needs the network the case moves to SEC1.20). E2E: SEC1.20.
- AC-58: **Credentials for the revocation check, and what happens without them `[r2]`.** `verifyIdToken(token, true)` makes the revocation call (`accounts:lookup`, per the header of `firebaseVerifier.js`). Against the real project that call is an Admin API call, so **RECALLED: the Admin SDK needs credentials for it**, normally a service-account key found through `GOOGLE_APPLICATION_CREDENTIALS` (the SDK's default credential), while the signature check alone needs only Google's public certificates. **Step 0 of the plan** reads the firebase-admin documentation (set up the Admin SDK; verify ID tokens, including "check revoked") and the installed 14.5.0 sources, and settles in writing: whether credentials are required, where the default credential is read, whether a relative path is read from the working directory, and that a Spark-plan project may use the Admin Auth API. Then:
  - **If a key is needed,** the owner creates a service-account key for the real project and keeps the file outside the repository, naming its absolute path in the local `.env` as `GOOGLE_APPLICATION_CREDENTIALS`. It is never committed (the secret guard and the pre-commit hook stay in force), never printed or logged, and **agents never create, hold or read cloud credentials**. The plan lists the owner's steps; `.env.example` carries the name with an empty value.
  - **With the credential absent, unreadable or wrong,** every request answers 503 `Authentication service unavailable` (`classifyVerifyError`'s rule that an unrecognised failure is 503). The token is never accepted, and the API still starts (the verifier is built lazily).
  - The emulator path needs no key and is the only path the automated tests use.

  Verify: unit test (a verifier whose SDK throws a credential-type error answers 503 and the token is not accepted, through a double); manual, owner-run (SEC1.20). E2E: SEC1.20.
- AC-59: **The server says which mode it is in `[r2]`.** At start one `info` line states `auth: emulator` or `auth: Firebase project <id>` (a project id is not a secret; no credential, path or token is named), so an `.env` that holds both a real project id and an emulator host in development is plain to read: the emulator wins and accepts unsigned tokens (S1), which would otherwise look like a real sign-in. Verify: unit test with the fake logger. E2E: none; a start-up line.
- AC-60: **Real users reach the API through `AppUser` rows, made by the owner `[r2]`.** The six seeded accounts exist only in the emulator and are never created in the real project. A real admin is a user the owner creates in the project's console, plus an `AppUser` row (`FirebaseUid` equal to that user's UID) and `UserRole` rows inserted by SQL on the local database, until DEP-0's operator tool and R6's admin API exist. A Firebase user with no `AppUser` row is refused 403 `This account has no access` (AC-2). Sign-in itself stays on the client (SEC-3) or the REST call; SEC-1 builds no sign-in. Verify: manual, owner-run (SEC1.20). E2E: SEC1.20.

## 4. What changes in existing code and tests (C1)

Each entry gives a reason. The plan names each changed test case.

**Source (`functions/src`).** Names of new files are the plan's.

| File | Action | Why |
|---|---|---|
| `middleware/devStub.js`, `middleware/requireTenant.js`, `routes/dev.js`, `services/devAccounts.service.js` | delete | AC-40 |
| `middleware/tenantContext.js`, the role guard, the permission guard, the venue-scope step, the access cache, the route-key module | new | AC-3 to AC-30, AC-38 |
| `routes/api.js` | change | mounts the chain per group; no stub, no dev mount; `apiRoutes` loses `devStub` and `devAccounts` |
| `routes/lookups.js`, `venues.js`, `venueMaps.js`, `venueMapCatalog.js` | change | a permission guard (and the venue-scope step) on each of the 14 routes; the upload wrapper re-binds the acting-as tenant (AC-45) |
| `routes/me.js` | change | the cached snapshot; `actAsTenants` for a SUPERADMIN (Q4 (a), ruled) `[r2]` |
| `app.js` | change | builds no stub or dev accounts service; builds the cache and the guards; the `devOnlyAllowed` use for the dev service goes |
| `config/index.js` | change | `DEV_STUB_USER_EMAIL` and `config.devStub` go; `devOnlyAllowed` and `DEV_ONLY_ENVS` stay; the sign-in mode is derived from the two Firebase variables (AC-57, AC-59) `[r2]` |
| `auth/firebaseVerifier.js` | change, small | no new SDK call; a credential failure is a 503, never an accept (AC-58); the file's header gains the RECALLED credential claim `[r2]` |
| `auth/accessStore.js` | change | a per-tenant grants read (AC-29); `listTenants` stays, re-annotated, for `actAsTenants` (Q4 (a)); a tenant's active flag for SUPERADMIN (Q3 (a)) `[r2]` |
| `auth/permissionMerge.js` | change | one per-tenant derivation that `buildAccessProfile` and the guard share (AC-17) |
| `auth/identityStore.js` | change | two stub-only methods go (AC-40) |
| `utils/requestContext.js` | change | `actingAsTenantId` and its getter (AC-45) |
| `services/venue.service.js` | change | `list` takes a venue scope (AC-27); the other methods unchanged |
| `db/migrations/0002_<name>.sql`, `db/schema.sql`, `db/tools/setup-db.js` | new, change, change | AC-34 to AC-36 |

**Tests.** Every API test that sends a request through `createApp` now sends a bearer token and `X-Tenant-Id`: there is no stub and no default tenant. The harness `venueApp.js` (and `mapApp.js` on it) replaces the stub's user with one user per role and a token for each (a verifier double), with helpers to call as a role in a tenant.

| File | Action | Why |
|---|---|---|
| `functions/test/devStub.test.js`, `devStub.actAs.test.js`, `devAccounts.test.js`, `auth.identityStore.byEmail.test.js` | delete | they test deleted code |
| `functions/test/superAdminNoTenant.test.js` | change | its rows become AC-3 and AC-9 on the real chain (no header is 400, same text) |
| `functions/test/config.devOnly.test.js`, `helpers.js` (`testConfig`) | change | the stub-user cases and `DEV_STUB_USER_EMAIL` go; the emulator cases stay (AC-43) |
| `functions/test/venueApp.js`, `mapApp.js`, `lookups.test.js`, `venues.test.js`, `venues.tenantBoundary.test.js`, `venues.retired.test.js`, `venues.schemaMirror.test.js` (if it builds the app), `venueMaps.*.test.js`, `venueMap.contract.test.js`, `seed.visible.test.js`, `mapContext.repository.test.js` (stub mentions) | change | the stub's header-less default tenant goes; each request carries a token and a tenant header. Their expected answers do not change, except as AC-3, AC-4 and AC-7 say |
| `functions/test/me.test.js` | change | seeded permission rows exist (its header says "No PermissionRoute rows are seeded yet"); `actAsTenants` (Q4 (a)) `[r2]` |
| `functions/test/venueLock.test.js`, `venueMaps.concurrency.test.js` | change (harness calls only) | they build their own app |
| `db/tools/test/migration0001.test.js` | change, named by the plan | its "fresh 0.15" side reads the current `schema.sql`, which this slice changes (an index is dropped). OA-3a's plan already plans a frozen 0.15 fixture for the same reason; the plan decides which one (freeze it now, or run both sides through every migration) |
| `docs/testing/E2E_Test_Cases_Manual.md` | change | AC-52 |

Not touched: `db/seeds/**` and its tests (AC-37), `auth.middleware.test.js` (S1's `auth`), `permissionMerge.test.js` (its cases stay green), the OA-1 and OA-2 tests apart from the harness change above.

## 5. Edge cases

Each is covered by the criterion named, or has a one-line reason.

**Offline or stale package**
- EC-1: A token older than the session limit (8 h, `auth.idTokenMaxAgeS` 28,800 s) answers 401 `Session expired` on the next request, and SEC-3's client signs out (AC-2).
- EC-2: A stale permission cache: a role or grant changed by SQL is honoured within 30 s, and R6's writes clear it at once (AC-24).
- EC-3: Shopper packages: no public route is guarded or changed, so a shopper's offline package and the ETag delivery are untouched. Not tested: nothing in this slice reads or writes a package.
- EC-4: An admin who goes offline mid-request: the server either gets the whole request or none of it. The retry and the banner are SEC-3's. Not tested here.

**Empty and maximum data**
- EC-5: A user with no `UserRole` row: signs in, `/api/me` is empty, every tenant route is 403 (AC-12).
- EC-6: A user in about 5 tenants (the pilot's, PRD §7): `/api/me` lists all, and the header picks one (AC-8). No cap is coded.
- EC-7: A scoped user with no grant: an empty list and 404 on every venue id (AC-27, AC-28).
- EC-8: A scoped user with very many grants: the ids go in as one array parameter (AC-27). No count is stated (§7), so none is tested.
- EC-9: An empty or malformed guard definition fails at build time (AC-14).
- EC-10: A role with no row for a route (a future role, or a hand-deleted row): UNCONFIGURED, 403 (AC-15).

**Tenant boundary**
- EC-11: A header naming another tenant: 403 (AC-4, AC-7 a).
- EC-12: Another tenant's venue or lookup row under a held tenant: 404 (AC-7 b).
- EC-13: A token claim, query or body naming a tenant: ignored (AC-6).
- EC-14: A grant in another tenant: gives nothing here, and cannot exist for another tenant's venue (AC-29).
- EC-15: SUPERADMIN naming a tenant: allowed, logged as an act-as (AC-9, AC-10).
- EC-16: The lookups' platform rows (TenantId NULL) are readable and a tenant's own rows are not shared (the global-lookup trap; FF-0's cases stay) (AC-7 b).
- EC-17: A `UserPermission` row has no tenant, so an override applies in every tenant the user holds (L151). A MALL_ADMIN of tenant A with an override also has it in tenant B (AC-17). Writing overrides is limited by R6, not here.

**Each role**
- EC-18: VIEWER: AC-19. EC-19: VENUE_EDITOR: AC-20. EC-20: MALL_ADMIN of one tenant, and of two: AC-8, AC-21. EC-21: SUPERADMIN: AC-9, AC-16, AC-21.
- EC-22: A shopper's token on an admin route: 403 (AC-2).
- EC-23: A user holding SUPERADMIN and a tenant role: naming that tenant is not an act-as; naming another is (AC-10).

**Permission denied**
- EC-24: The 403 text is the same from the role guard and the permission guard (AC-49).
- EC-25: A refused write leaves no row, no file and no `VenueVersion` (AC-19).
- EC-26: A method no route answers (`DELETE /api/venues/:id`, P0-01 B4) is 404 for every authenticated role, VIEWER included, never 403: a guard is attached to a route that exists. Not separately tested: OA-2's retired-route cases already pin the 404, with a token now.
- EC-27: A venue-scoped role on an ungranted venue gets 404 and not 403 (AC-28).

**Concurrent edits**
- EC-28: Two requests of one user at the moment the cache expires: both may load, both succeed, neither caches a failure (AC-24). No single-flight is required.
- EC-29: A role revoked while a request runs: the request finishes under the decision made at its start. Not tested: the guards run once per request by design.
- EC-30: A grant removed by SQL mid-session: seen within 30 s (AC-24).
- EC-31: A SUPERADMIN and a MALL_ADMIN saving one venue's draft: OA-2's 409 on the stale `baseVersion` (unchanged).
- EC-32: A user switching tenant between two requests (one browser, two tabs): no server session exists, so each request is judged alone (AC-8).

**Publish in progress**
- EC-33: A VENUE_EDITOR's draft save during a MALL_ADMIN's publish: allowed, and OA-2's AC-28 still holds (the layout was captured under the lock).
- EC-34: The publisher's role is revoked mid-build: the build completes, because the guard ran at the start, and `PublishedBy` is that user. Not tested.
- EC-35: A VIEWER's publish answers 403, not 501 or 409 (AC-21, AC-22).

**Invalid input**
- EC-36: `X-Tenant-Id`: every malformed, padded, repeated or injected value is 403 before any query (AC-4).
- EC-37: `Authorization` forms: S1's cases (AC-2).
- EC-38: `X-Dev-Act-As` with any value: ignored (AC-41).
- EC-39: A header larger than Node's header limit is refused by the HTTP parser before Express (RECALLED). Not tested.

**Inactive things**
- EC-40: An inactive tenant (AC-11; SUPERADMIN proceeds, logged). EC-41: An inactive role, and an inactive user (AC-12).
- EC-42: An inactive venue stays editable and is listed to a scoped user who holds a grant (OA-2 DC-20; AC-27).

**Transport and routing**
- EC-43: An unknown path under a guarded group: with no token, 401 (the group's `auth`); with a valid token and tenant, 404. Under a tenant the user does not hold, 403. Verify: API test in AC-1's table.
- EC-44: A browser preflight needs no token (AC-50).
- EC-45: A `HEAD` request runs the matching GET route's guards (Express maps it to the GET route, RECALLED). Not tested.

**Migration**
- EC-46: The roles exist before the migration (the seed ran first): no duplicate (AC-35 e).
- EC-47: A grant or label edited by an admin: kept on re-run (AC-35 d).
- EC-48: A grant row deleted by hand comes back on the next `migrate` (AC-35 f). The role-grants grid (R9) must set flags to false instead of deleting rows.
- EC-49: A bad-data role of the same code: kept, and the SUPERADMIN bypass is refused (AC-35 g).
- EC-50: The index drop on a database whose `UX_UserRole` is already gone: no error (idempotent, AC-35 c).

**Sequence**
- EC-51: Between SEC-1's merge and SEC-3's, the admin page answers 401 on every call (§1). Expected. Not a defect, and not tested.

**Real project `[r2]`**
- EC-52: An emulator token sent to a real-project API, or a real one to an emulator API: 401 (AC-57).
- EC-53: A real-project API with no credential, or a wrong one: 503 on every request, the token never accepted, the API still up (AC-58).
- EC-54: An `.env` with both a real project id and an emulator host: the emulator wins in development and test, and the start-up line says so (AC-59). In production the host is refused at start (AC-43).
- EC-55: A Firebase user with no `AppUser` row: 403 (AC-60). A real user's UID that matches a seeded emulator account's UID is not a concern: seeded UIDs come from the emulator and the real project issues its own.
- EC-56: The real project's user disabled in the console, or their tokens revoked: 401 on the next request, through the revocation check (needs the credential, AC-58).

## 6. The e2e cases

The manual cases of AC-52, each with the ACs it covers. They run against the real Auth emulator (`npm run seed` first) and `psql` where a row is edited.

| Id | What the case shows | ACs |
|---|---|---|
| SEC1.1 | Sign in as each of the five admin accounts; `GET /api/me` shows roles and T2's permissions (and, for superadmin@, every tenant in `actAsTenants`) | AC-2, AC-31, AC-32, AC-33 |
| SEC1.2 | No token, a garbage token, a shopper's token (shopper@), and a token for a deactivated user on every route group | AC-1, AC-2, AC-49 |
| SEC1.3 | `X-Tenant-Id` missing, malformed, not held, held; and a token claim, query or body naming a tenant | AC-3 to AC-6, AC-49 |
| SEC1.4 | With one tenant named, the other tenant's venue and lookup row by id: read and write, every role | AC-7 |
| SEC1.5 | superadmin@: no header 400, any tenant 200, a nonexistent tenant 403; the act-as log line | AC-9, AC-10, AC-16 |
| SEC1.6 | viewer@: every read 200, every write 403, row counts unchanged | AC-18, AC-19, AC-49 |
| SEC1.7 | editor@: draft save 200, upload 201, clear 200 `[r2]` (published versions untouched); venue create or edit, publish and rollback 403 | AC-18, AC-20 |
| SEC1.8 | malladmin@: venue create and edit, save, upload, clear, publish and rollback (501 until FF-3′) | AC-18, AC-21 |
| SEC1.9 | A `UserPermission` row added by SQL: honoured after about 30 s; removed again | AC-17, AC-24 |
| SEC1.10 | Delete one `UserVenueGrant` row by SQL: the editor's list omits that venue and its id routes are 404; a new venue by a MALL_ADMIN is not seen by the editor | AC-26 to AC-30 |
| SEC1.11 | Stop PostgreSQL mid-session: 503, never 200 or 403; start it again and the next request works | AC-23 |
| SEC1.12 | `X-Dev-Act-As` ignored; `GET /api/dev/accounts` 404; the API starts with `NODE_ENV=production` | AC-40 to AC-42 |
| SEC1.13 | `UPDATE RolePermission` then `npm run migrate`: the edit is kept; run twice: no change | AC-34, AC-35 |
| SEC1.14 | One request per adjacent pair of refusals | AC-1, AC-22 |
| SEC1.15 | An inactive tenant, an inactive role, a user set inactive (401 on the next call) and a revoked token | AC-11, AC-12 |
| SEC1.16 | A preflight `OPTIONS` with `Origin` and the request headers | AC-50 |
| SEC1.17 | An upload by viewer@ (403), with no token (401), for an ungranted venue (404), by editor@ (201) | AC-47 |
| SEC1.18 | A user who is MALL_ADMIN in one tenant and VIEWER in the other (SQL fixture) | AC-8 |
| SEC1.19 | The rows a save, an upload and a venue create wrote carry the signed-in user's id | AC-45, AC-46 |
| SEC1.20 `[r2]` | **Owner-run, real project.** With `FIREBASE_PROJECT_ID` set to the real project and the emulator host unset: a user made in the project's console and mapped by SQL signs in, and one role's SEC1.3, SEC1.6 and SEC1.8 calls answer as they do on the emulator; an emulator token is refused (401); with the credential removed, 503. Agents do not run it (they hold no cloud credentials) | AC-57, AC-58, AC-60 |

## 7. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | Yes | Migration 0002 and schema 0.16 (AC-34 to AC-36) |
| 2 Seed | No change | Roles and permission rows come by migration (staging has no seed, DEPLOY-staging §3); the seed finds the roles by code (AC-37) |
| 3 Guard order | **Closed** for the 14 routes | AC-1, AC-22; no waiver (AC-54); SEC-2's lint proves it |
| 4 Permission and menu rows | **Closed** for the 14 routes | The `PermissionRoute` rows and default grants by migration (AC-34); there is no menu table (PH2 Q9), so the menu half is SEC-3's, which names these keys |
| 5 Scaffolds, `formatApiError`, four states | No | No screen |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | No | No colour |
| 9 Automated e2e | Waived in part `[r2]` | AC-51 is the slice's e2e (real-HTTP API tests plus manual cases). `Waived: 9 (the declarative sub-suite) — R12`, because the harness does not exist (Q5 (a), ruled) |
| 10 Manuals and smoke guide | Yes | `E2E_Test_Cases_Manual.md` (AC-52); the smoke guide's index count (AC-39) |
| 11 Changelog | No | No screen or wording changes in the app. The visible change (sign-in) is SEC-3's entry |
| 12 Companion-file sync table | Yes | Rows: `schema.sql` (migration, seed with reason, Blueprint Part 3, the reading guide); API route (tests, e2e manual, permission rows, Blueprint Part 4); a limit (the cache TTL, a named constant); a command or check (`.env.example`, INSTALL); the ledger (AC-53) |
| 13 Every field a `FieldSpec` | No | No form |
| 14 New enumerable sets | Yes, reasoned | The route keys are table rows (rule 5); the role codes are the existing `Role` table. The one new list is the tenant-wide role set, a server policy and not a client option list: one named constant with L41's authority (DC-14) |
| 15 Inactive-lookup case | No | No lookup value is saved. The nearest analogue, an inactive `Role` or `Tenant`, is AC-11 and AC-12 |
| G1 Traceability | Yes | The table in the PR (AC-51) |
| G2 Wording and accessibility | In part | Admin English by design (L165); the five messages of §2.1, proposed for the owner's edit; no shopper phrase |
| G3 Offline and position privacy | No | No shopper feature |
| G4 Differences recorded | Yes | An L-row at merge records: the stub deleted; no default tenant (header required); the guard's messages and codes; Q13's drop with its changed premise; the migration inserting the roles; the rulings of L186 (Q1 to Q5); the real Firebase Auth project verified by the local API; and the documents it settles `[r2]`: **P0-03 AC-54's "with a venue grant"** (a MALL_ADMIN is tenant-wide and needs none), **P0-01 AC-31's "remove venues"** (no venue-delete route exists, B4; `venues` Delete is false for every role) and **P0-11 AC-137's Clear** (a VENUE_EDITOR may clear, which the intent's matrix had refused) |

## 8. Scale targets

| Target | Source | How this spec meets it |
|---|---|---|
| One function instance, `maxInstances = 1`; the in-memory permission cache is valid only while it is 1; several instances is release-blocking | Blueprint §2.6; `plan/PH2-identity.md` §8 | AC-24 (f): the cache is in process and says so; no shared store is built |
| Pilot: up to about 5 mall-operator tenants | PRD §7 | `actAsTenants` lists at most about 5 rows, unpaged (AC-32); `/api/me` lists a user's tenants unpaged |
| A handful of admins per operator | `plan/PH2-identity.md` §8 (the PRD personas) | The cache holds one entry per admin who made a request in the last 30 s; no bound is needed or coded. This is a design note, not a target |
| Permission cache: 30 s TTL, bust on write | standard §3.4 (P0 item); PH2 P2-S3 | AC-24 (a), as a named constant |
| Admin session: 8 h | `auth.idTokenMaxAgeS` 28,800 (L151) | Unchanged (EC-1) |
| Peak concurrent users and peak requests per hour: measured at the pilot | PRD §7 (L109, Blueprint OQ1) | No latency or throughput target for the guard chain exists. AC-56 records the cost, with no gate |
| Venues per tenant, users per tenant, grants per user | **not stated anywhere** | None invented. The design reads grants as an id array per user and tenant (AC-27, AC-29). See Suggestions |

## 9. Design choices

Each is a DESIGN CHOICE, not a requirement, with an alternative that also meets what is stated.

- **DC-1 The role guard is coarse: all four admin roles on every route; the permission rows decide.** The standard puts a role guard in front of the permission guard (§3.4 layer 1, A.2). If each route listed only the roles its default grants allow, a `UserPermission` override (PH2 Q8, L151) could never widen a role's rights, and the guard would contradict the row. *Alternative:* a narrow role list per route (VIEWER blocked from every write by role). Simpler to read, but overrides become powerless and each new grant needs a code change.
- **DC-2 Every permission guard is strict, and several routes mean "any".** UNCONFIGURED is refused, because a route with no row is absent from the merge and means "not granted" (the `permissionMerge.js` header; S1). Staging is exposed, and an open door for an unconfigured route is what the standard warns against. For `routes[]`, any listed route granting the action is enough, matching "role rows OR-ed". *Alternative:* standard A.2's non-strict observe mode for a rollout. Useful when locking out existing users is a risk. Here no user exists yet who depends on the old behaviour.
- **DC-3 The cache holds one snapshot per user, and the per-tenant answer is derived on each request.** One load serves every tenant the user names. *Alternative:* a cache entry per (user, tenant). More entries for the same rows. (Grants are the exception, DC-13.)
- **DC-4 No default tenant: a missing header is 400, a malformed or unheld one is 403.** This follows PH2 Q1 ("every request names its tenant"). The stub's "first tenant" fallback is removed because a real client always sends the header (Blueprint §2.4: the admin page sends it with every request). Malformed and nonexistent values share the 403 body so a caller cannot probe which tenant ids exist. *Alternative:* default to the user's only tenant when they hold exactly one. Kinder to `curl`, but a second tenant added later changes what an unchanged client does.
- **DC-5 `tenantContext` stores the user's derived access on the request, and the guards read it.** The role guard, the permission guard and the venue scope make no second read. *Alternative:* each guard loads from the cache itself. Looser coupling, but the same derivation three times.
- **DC-6 Route keys and actions.** `lookups`, `venues`, `venue-maps` and `venue-versions`, with publish and rollback as `venue-versions` Create, clear as `venue-maps` Delete (the draft is what is deleted), a floor-plan upload as `venue-maps` Create and a draft save as `venue-maps` Update. The Blueprint says "publishing is Create on `venue-versions`"; P0-03 EC-83 and OA-2's ledger name `venue-maps`. This choice follows both. *Alternative:* a single `venue-maps` key with publish as a fourth action. That cannot separate publishing from saving in the existing four-bit table. *Alternative for clear:* Update on `venue-maps`. Then a role that may save could also clear, with no separate bit. Passed over: Delete keeps clear grantable on its own (R9's grid), even though Q1 (a), ruled, gives VENUE_EDITOR both `[r2]`.
- **DC-7 SUPERADMIN has no `RolePermission` rows.** The bypass is in code (PH2 Q8). Rows would be dead data that can drift, and R9's grid would show an editable grant that does nothing. *Alternative:* seed all-true rows for SUPERADMIN so `/api/me`'s merged map is complete. Then a client could ignore `isSuperAdmin`; but a row someone sets to false would look effective and would not be.
- **DC-8 Twelve explicit rows, all-false cells included.** The separation of duties (a VENUE_EDITOR cannot publish) is then visible data that R9's grid shows, and a missing row means "not configured" and not "no". *Alternative:* seed only the true cells. Fewer rows, but the matrix is only readable from what is absent.
- **DC-9 The migration inserts the four `Role` rows if absent.** A grant row needs a role to attach to, and a staging database has no seed (DEPLOY-staging §3: roles and permission rows are bootstrap data). The seed already finds each role by code, so nothing breaks. *Alternative:* the migration attaches grants to roles that exist and skips the others, with the seed adding the roles. That leaves a deployed database with a table of grants for no role, and no way to sign in.
- **DC-10 What an act-as is, and what is recorded now.** A SUPERADMIN naming a tenant in which it holds no tenant-role row of its own. The field and a log line exist now. The `AuditLog` row is SEC-2's (R3). *Alternative:* every SUPERADMIN request counts as an act-as. Simpler, and it over-reports the rare account that also holds a tenant role. *Alternative:* write the row in this slice. That builds half of R3's middleware here.
- **DC-11 The stub's dead helpers are deleted with it,** earlier than the ledger's "R8 deletes" words (`findAdminByEmail`, `listActiveAdminsByEmailSuffix`, `devAccounts.service.js`). Their only callers go with the route and the stub. *Alternative:* leave them for SEC-3. Dead code that names a deleted feature.
- **DC-12 The four route keys live in one module, and a test ties them to the migrated rows.** SEC-2's lint checks the order of the guards and not the names of their keys. *Alternative:* string literals in each guard call. A typo then needs a request to find it.
- **DC-13 Venue grants are read per (user, tenant), with the tenant bound from the request.** That keeps rule 2 literal and loads nothing for tenant-wide roles. *Alternative:* load every grant of the user with the snapshot and filter in code. One read, but a tenant-scoped table queried with no tenant binding.
- **DC-14 The tenant-wide role set is one named constant** (SUPERADMIN and MALL_ADMIN; authority L41). *Alternative:* a `Role` column (`IsTenantWide`), table-driven as rule 5 prefers and ready for next release's MERCHANT, UNIT and MAINTENANCE roles. It needs a schema change and a seed decision this slice does not otherwise make. The constant is replaced when those roles are specified.
- **DC-15 One refusal text for both guards.** `M-FORBIDDEN` does not say whether the role or the permission refused. *Alternative:* a message per layer. More useful to a developer, and more to a prober.
- **DC-16 The slice's e2e is real-HTTP API tests plus manual cases** (Q5 (a), ruled). *Alternative:* the standard's declarative sub-suite now.
- **DC-17 No stale-on-error.** An expired entry is never served when its reload fails. *Alternative:* serve the last good snapshot for a while. It keeps the admin page working through a database blip, and it breaks the standard's "a lookup that fails must not become an open door" (§3.4; gate item 5): a role revoked during the blip would still be honoured.
- **DC-18 Venue scope: an ungranted venue is 404, and sits after the permission guard.** It reads as "not there" and tells a scoped user nothing about other venues. *Alternative:* 403. More honest to the user, and it confirms the venue exists.
- **DC-19 The two existing messages and the 400 and 403 split are kept** (`M-NO-TENANT`, `M-NOT-HELD`), so the client's strings, `FF0.3`'s `abc` case and the stub-era tests keep their meaning. *Alternative:* new wording. Nothing gained.
- **DC-20 Q13's index drop is applied although its premise has changed** (AC-36). *Alternative:* leave `UX_UserRole` and note it in the guide. Then PH2's ruling stays unmet and the index count stays at 137.

## 10. Not in scope

- Rate limits, audit rows and redaction, validation (zod), and the two lints: **SEC-2**. The `AuditLog` row for an act-as is SEC-2's.
- The sign-in screen, the dev switcher's removal on the client, the banner, the `ApiClient`'s token and header, the tenant and venue switchers, the permission-driven menu: **SEC-3**.
- The admin API: users, roles, grants, overrides and their escalation guards, the audit viewer, settings (**R6**, **R9**); the single call that writes a grant and clears the cache (R6).
- Shopper routes and the public API (**R10**, **FF-4**'s package routes); the shopper's sign-in.
- The lockout and single-session items (dropped, PH2 Q2); any sign-in method but email and password for admins (PH2 Q11).
- The boot guard and the Cloud SQL, Cloud Storage and deploy work (**DEP-0**, **DEP-1**); a production-mode refusal at start-up (DEPLOY-staging Q7 (b)). Blaze, and any deploy, until the owner calls it (the real Firebase project is used for sign-in only, on the Spark plan).
- Creating the real project, its console users and its service-account key: the owner's steps. SEC-1 adds no tool for them (DEP-0's `staging:admin` is later).
- Platform routes that work with no tenant (tenants, global lookups): none exists yet, so `tenantContext` has no "tenant optional" mode.
- The venue scope of the Stores and checks routes of OA-4: they inherit the same guards when they are built (their slices add their keys by migration).

## 11. Notes for the plan and later slices

- **For SEC-2:** AC-55 lists the fields and getters its audit middleware reads. Its `route-guard-order` lint must accept the venue-scope step between the permission guard and validation. SEC-2's rate limiter sits before the chain, and a refusal by the chain (401 first) is what its auth limiter counts.
- **For SEC-3:** `actAsTenants` (Q4 (a), ruled), `isActive` per tenant, and the four permission keys are what the picker and the menu need.
- **For DEP-0:** a grant written by the operator tool or SQL is seen by the running function within 30 s (AC-24 f). CI runs migrations before the function deploys, and a new instance starts with an empty cache.
- **For OA-3a:** its migration takes the next number after SEC-1's (0003) and its schema version the next after 0.16, as its plan already says it will move; both migrations' index counts need re-counting at merge.
- **For OA-4 and FF-3′:** each new route adds its `PermissionRoute` row and default grants by its own migration, and mounts the same chain.
- **For R9:** the role-grants grid sets flags and never deletes rows (EC-48).
- **For the plan `[r2]`:** step 0 is the firebase-admin credential check (AC-58). The owner's key, if one is needed, is the only secret this slice touches; no agent holds it. SEC-3's client signs in against the real project with the project's public web configuration, which is SEC-3's to specify.

**RECALLED, not checked this session.** The plan checks each with a doc fetch or a test before it carries weight:
- Node joins a repeated custom request header into one comma-separated value (AC-4).
- The `cors` package, mounted at app level before the routes, answers an `OPTIONS` preflight itself and reflects the requested headers by default (AC-50).
- Express maps a `HEAD` request to the matching GET route and runs its middleware (EC-45).
- Node's HTTP parser refuses a request header above its size limit before Express sees it (EC-39).
- A nested `AsyncLocalStorage.run` gives the inner chain its own store (AC-45).
- Express 5 passes a rejected async middleware to the error handler (the comments in `venueMaps.js` say so; the guards rely on it, and AC-23 proves it).
- **The credential claims of AC-57 and AC-58 `[r2]`:** that `verifyIdToken(token, true)` needs Admin SDK credentials against the real project; that the default credential is `GOOGLE_APPLICATION_CREDENTIALS`; that a relative path is read from the working directory; that the SDK refuses an `alg: none` token before any network call; that a Spark-plan project may use the Admin Auth API. The check is step 0 of the plan, against the firebase-admin documentation and the installed 14.5.0 sources, with the findings pasted.
- `INSERT … ON CONFLICT DO NOTHING` and `DROP INDEX IF EXISTS` on a plain (non-constraint) unique index behave idempotently in PostgreSQL 18 (`authHelpers.js` already uses `ON CONFLICT`; `UX_UserRole` is a plain `CREATE UNIQUE INDEX` in `schema.sql`).

No claim about `firebase-admin` is new here: what 14.5.0 does is recorded in `firebaseVerifier.js`'s header, read from the installed package in S1.

## 12. Questions: all five ruled at the owner's sitting of 2026-10-14 (L186); none is open in r2

Each ruling is first below; the text after it is r1's question, kept as the record. The options not taken stay listed. The recommended option (a) was ruled in every case.

**Q1 [spec-writer] May a VENUE_EDITOR clear a venue's draft?** **Ruled (a): yes; P0-11 AC-137 stands. Applied in T2, AC-20, SEC1.7 and G4.** The intent says MALL_ADMIN and SUPERADMIN "publish, rollback and clear". `spec/P0-11.md` r3 AC-137, approved L178, lists Clear among a VENUE_EDITOR's controls (no Publish, no Restore). These two cannot both be right. The ACs above follow the intent (VENUE_EDITOR is refused `POST …/map/clear`) until you rule; the answer is one cell of T2 (`venue-maps` Delete for VENUE_EDITOR).
- (a) **Recommended:** yes, a VENUE_EDITOR may clear (P0-11 AC-137 stands). *Evidence:* a VENUE_EDITOR can already save any valid document over the draft, a blank one included, so refusing Clear protects nothing. Clear only empties the draft and deletes no published version (OA-2 AC-35).
- (b) No: MALL_ADMIN and SUPERADMIN only, as the intent says. OA-4's client then hides Clear from a VENUE_EDITOR, and P0-11 AC-137 is edited.

**Q2 [spec-writer] Does a MALL_ADMIN need a venue grant, or is it tenant-wide?** **Ruled (a): tenant-wide; P0-03 AC-54's "with a venue grant" and P0-01 AC-31's "remove venues" are G4 differences this spec settles. Applied in §2.1, §3.4 and G4.** The intent says "venue scope comes from `UserVenueGrant`". L41's table gives MALL_ADMIN the scope "one tenant" and VENUE_EDITOR and VIEWER "venues granted to them". `spec/P0-03.md` AC-54 says a MALL_ADMIN publishes "(with a venue grant)". §3.4 is written for (a).
- (a) **Recommended:** MALL_ADMIN and SUPERADMIN are tenant-wide; only VENUE_EDITOR and VIEWER need grants. A new venue is visible at once to its tenant's MALL_ADMINs. There is no grant screen until R9, so (b) would make every new venue invisible to everyone but its creator until an operator inserts rows.
- (b) Every role except SUPERADMIN needs a grant per venue (P0-03 AC-54's wording). Creating a venue then needs an automatic grant for its creator.
- (c) Enforce no venue scope in SEC-1: read the grants and ignore them until R6, so SEC-3's venue switcher has nothing to narrow.

**Q3 [spec-writer] What does a request naming an inactive tenant do?** **Ruled (a). Applied in AC-11.** L155 and the ledger leave this to R1.
- (a) **Recommended:** refused with 403 `This tenant is not active` for every role except SUPERADMIN, which may still act there (to look, or to switch it back on, with its act-as logged).
- (b) Refused for everyone, SUPERADMIN included; reactivating a tenant is then done by SQL until a platform route exists.
- (c) Nothing changes: an inactive tenant works like an active one (the stub's behaviour).

**Q4 [spec-writer] How does a SUPERADMIN learn the tenant ids it may name?** **Ruled (a), the same answer as SEC-3's Q4. Applied in AC-32.** SUPERADMIN's own `UserRole` row has no tenant, so `/api/me` lists none for it, and `/api/dev/accounts` (which listed them) is deleted here. SEC-3's picker needs the list.
- (a) **Recommended:** `/api/me` adds a top-level `actAsTenants` list for a SUPERADMIN only (AC-32). It is additive, reuses the existing whole-table reader, and keeps SEC-3 unblocked.
- (b) A new `GET /api/tenants` route in R6, with its own permission key. A SUPERADMIN cannot pick a tenant in the UI until then.
- (c) Leave it to SEC-3's spec; SEC-1 adds nothing.

**Q5 [spec-writer] What counts as SEC-1's automated e2e (definition-of-done item 9)?** **Ruled (a), as the main session's technical ruling under L174. Applied in AC-51, AC-54 and §7.** Item 9 reads "an automated e2e phase awaited from `main()`; CRUD spec added to the declarative sub-suite". This repository has no such harness: its "e2e" is the database half of `npm run verify` (the API tests over real tables), plus manual cases. DEPLOY-staging §1 says waiver 9 ends for new work in SEC-1 and SEC-2.
- (a) **Recommended:** the slice's e2e is AC-51's API tests through real HTTP over real tables, plus the manual cases SEC1.1 to SEC1.19 against the real Auth emulator. The report records `Waived: 9 (the declarative sub-suite) — R12`, because the harness does not exist and R12 builds it. Nothing new to build now.
- (b) Build the declarative e2e sub-suite now, in this slice. That pulls R12's harness forward and makes SEC-1 larger.
- (c) Manual cases only, with the API tests counted as unit tests. Weakest: nothing automated shows a VIEWER's publish refused.

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-14 | First revision, from the intent, PH2 §3 and §7, DEPLOY-staging, PH4's ledger and the code on the main folder's working tree. Five questions raised (Q1 to Q5). ACs for Q1 follow the intent, for Q2 to Q4 follow the recommendation, as marked |
| r2 | 2026-10-14 | The owner's rulings of the sitting (L186) folded in, all as recommended: Q1 (a) a VENUE_EDITOR may clear (T2, AC-20, SEC1.7, G4); Q2 (a) tenant-wide MALL_ADMIN, with P0-03 AC-54 and P0-01 AC-31 recorded as G4 differences (§3.4, G4); Q3 (a) (AC-11); Q4 (a) (AC-32, `me.js`, `accessStore.js`); Q5 (a) (AC-51, AC-54, §7 item 9). New owner ruling: the real Firebase Auth project on the Spark plan, API and database local: new §3.10 (AC-57 to AC-60: the two modes, credentials for the revocation check tagged RECALLED with a step-0 doc check, a start-up mode line, the owner-run real-project check), SEC1.20, EC-52 to EC-56, the verifier and config rows of §4, the records of AC-55 (E-20 rules 1 and 2), the RECALLED list. Every changed AC carries `[r2]`. No question is open |
