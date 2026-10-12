# FF-SK (server half): the development switcher's act-as header and account list: slice report

> **Plan**: `plan/FF-SK-dashboards.md` 1.0 (APPROVED, L157), §5 (the server), §7 (the switcher's server tests) | **Contract**: `phase-reports/feature-first/FF-SK-client.md` §2 on branch `ff-sk-client` (read only) | **Pipeline entry**: P0-16 | **Parent**: `plan/PH4-feature-first.md` 1.0 (E-20, L153) | **Built by**: api-coder (Opus 5.5), in `Gabay-wt\api-coder`, branch `ff-sk-server` from `origin/main` (828d333) | **Owner's ruling applied**: SUPERADMIN acts with no tenant without `X-Tenant-Id`, and in any existing tenant with it | **Reviewed by**: not yet (dod-reviewer)

## 1. What was built

| File | What |
|---|---|
| `functions/src/middleware/devStub.js` | Honours `X-Dev-Act-As: <email>` under its existing guard. Only an active `AppUser` whose email ends `@gabay.test` and that holds at least one `UserRole` of an active role may be named (and, unless it is a SUPERADMIN, at least one tenant); anything else is 403 and no handler runs. A blank header counts as absent, and the email matches in any letter case. The tenant rule is FF-0's for the acted account. **SUPERADMIN (the owner's ruling):** no `X-Tenant-Id` means no tenant (`req.tenantCompanyID` and the context tenant null); with one, any existing tenant (else 403). The same applies when SUPERADMIN is `DEV_STUB_USER_EMAIL`, where it used to be a 500. `tenantsOf` now uses the shared `inStubOrder` (platform rows first, then `Tenant.Code` in code-unit order) |
| `functions/src/middleware/requireTenant.js` | New. On every tenant route group, after the stub: a request with no tenant is 400 `{"error":"Choose a tenant: this works inside one tenant"}` before any handler or query |
| `functions/src/services/devAccounts.service.js`, `functions/src/routes/dev.js` | New. `GET /api/dev/accounts` to the client's contract. The service refuses to exist outside `NODE_ENV` development or test, as the stub does; `app.js` builds it only when `config.devOnlyAllowed`, and `routes/api.js` mounts `/dev` only then, with no stub, auth or tenant in front, so the headers are ignored. Only GET is routed |
| `functions/src/auth/permissionMerge.js` | `holdsSuperAdmin(roles)`, the one "is this a superuser" test (NULL tenant, platform role, code `SUPERADMIN`); `buildAccessProfile` uses it, so `GET /api/me` is unchanged |
| `functions/src/auth/accessStore.js` | `tenantExists(tenantId)`, for the SUPERADMIN override |
| `functions/src/auth/identityStore.js` | `listActiveAdminsByEmailSuffix(suffix)`, for the account list (R8 deletes it) |
| `functions/src/routes/api.js`, `functions/src/app.js` | The `/dev` mount; `requireTenant` after `devStub` on `/lookups`, `/venues`, `/buildings`, `/levels` |

Rule 2: the tenant still comes only from `req.tenantCompanyID`, which the stub sets from the account's `UserRole` rows or, for a SUPERADMIN, from an existing tenant. Rule 3: every value is a bound parameter. No `// tenant-scope:` or `// sql-identifiers:` annotation was added: the account list reuses the access store's existing `UserRole` query.

**What every FF-0 and FF-1 route does for a SUPERADMIN with no tenant:** 400, through `requireTenant`, before any query on a feature table (`superAdminNoTenant.test.js`, all 18 routes). I also checked this by hand on the seeded database: `GET /api/venues` with `X-Dev-Act-As: superadmin@gabay.test` gave `400 {"error":"Choose a tenant: this works inside one tenant"}`. `GET /api/me` keeps the real `auth` and is unaffected.

## 2. Evidence

**Tests first.** The three new files, run before any code:

```
# Error: Cannot find module '../src/services/devAccounts.service'
not ok 1 - test\\devAccounts.test.js
not ok 2 - act-as: X-Dev-Act-As names the account the request acts as: req.user, the actor and its first tenant by Code
ok 3 - act-as: with no header, or a blank one, the stub acts as DEV_STUB_USER_EMAIL as before
not ok 4 - act-as: the email matches in any letter case and with surrounding spaces
not ok 5 - act-as: X-Tenant-Id must be a tenant the acted account holds; a tenant only the default user holds is 403
not ok 6 - act-as: an account that is unknown, inactive, roleless, outside @gabay.test, a shopper or not an email is 403, and nothing runs
not ok 7 - act-as: the 403 says what to send and never echoes the header
not ok 8 - act-as, SUPERADMIN (owner ruling): with no X-Tenant-Id it acts with no tenant, never a 500
not ok 9 - act-as, SUPERADMIN (owner ruling): any existing tenant may be named, held or not; one that does not exist is 403
not ok 10 - SUPERADMIN as DEV_STUB_USER_EMAIL (no act-as header) also acts with no tenant, not the old 500
not ok 11 - SUPERADMIN with no tenant: every FF-0 and FF-1 route is a clean 400, before any query on its tables
not ok 12 - SUPERADMIN with X-Tenant-Id: the routes work in that tenant, one the account holds no row in
ok 13 - a MALL_ADMIN with no X-Tenant-Id still gets its first tenant: the tenant check refuses only a missing tenant
# tests 13
# pass 2
# fail 11
```

The two that passed check behaviour that must not change: no header means the default account, and a MALL_ADMIN gets its first tenant.

**After the code:** `npm --prefix functions test`: `# tests 360  # pass 360  # fail 0  # skipped 0` (341 existing, none changed, plus 19 new). `npm run lint:structural`: 10 linters, 0 violations, no annotation added. `npm run api:lint`: ESLint clean, "All matched files use Prettier code style!".

**`npm run verify`** (`GABAY_VERIFY_OWNER=api-coder`), exit code 0:

```
ok   node-version         (0.0 s)
ok   node-check           (3.3 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (3.2 s)
ok   tools-tests          (109.6 s)
ok   eslint               (2.9 s)
ok   prettier             (3.0 s)
ok   schema-run-1         (3.4 s)
ok   schema-run-2         (1.9 s)
ok   api-tests            (47.8 s)
ok   db-tools-tests       (1.0 s)
ok   seed                 (75.8 s)
ok   functions-health     (30.8 s)
ok   flutter-analyze      (44.4 s)
ok   flutter-test         (22.5 s)

ALL GREEN   (358.3 s)
```

**On the seeded local database** (after verify's seed; a read-only check through `createApp`):

```
200
editor@gabay.test false [["VENUE_EDITOR","Demo Malls"],["VENUE_EDITOR","Spike Venues"]]
malladmin.demo@gabay.test false [["MALL_ADMIN","Demo Malls"]]
malladmin@gabay.test true [["MALL_ADMIN","Demo Malls"],["MALL_ADMIN","Spike Venues"]]
superadmin@gabay.test false [["SUPERADMIN",null]]
viewer@gabay.test false [["VIEWER","Demo Malls"],["VIEWER","Spike Venues"]]
superadmin, no tenant: 400 {"error":"Choose a tenant: this works inside one tenant"}
```

## 3. Tests added (none changed)

| File | Tests | What it pins |
|---|---|---|
| `functions/test/devStub.actAs.test.js` | 9 | The acted account fills `req.user`, the actor and its first tenant by code. No header or a blank one gives the default. Letter case and spaces are accepted. `X-Tenant-Id` must be held by the acted account. These are refused with 403, and no handler runs: unknown, inactive, role-less, another domain, a lookalike domain, a shopper, not an email. The 403 names the header and `@gabay.test` and never echoes the value. SUPERADMIN: no tenant without the header; any existing tenant, held or not, with it; a tenant that does not exist (or 0, or malformed) is 403; SUPERADMIN as `DEV_STUB_USER_EMAIL` is no tenant, not a 500 |
| `functions/test/devAccounts.test.js` | 7 | The 200 JSON `{ items }` equals the same rule run in SQL; each item's keys and role keys; inactive, role-less, other-domain and shopper accounts are left out; `isDefault` is exactly the `DEV_STUB_USER_EMAIL` account (in any letter case); role order is platform first, then code-unit order (`T_A`, `T_B`, `T_b`); `X-Dev-Act-As` and `X-Tenant-Id` are ignored, even ones the stub would refuse; only GET (anything else under `/api/dev` is the plain 404); the service refuses NODE_ENV unset, empty or production and is built for development and test |
| `functions/test/superAdminNoTenant.test.js` | 3 | SUPERADMIN with no tenant: all 18 FF-0 and FF-1 routes are 400 with the message, no feature table is queried, and nothing is deleted. With `X-Tenant-Id` of a tenant it holds no row in, the routes work and a venue is stored there. A MALL_ADMIN with no header is unaffected |

Existing tests: none changed. `devStub.test.js`'s "a user with no tenant role is a 500 naming the fix" still passes: a `DEV_STUB_USER_EMAIL` user with no role at all is still a 500 whose message says "no tenant". Only the message's parenthesis changed, because a SUPERADMIN is no longer refused.

All database writes are inside always-rolled-back transactions (WORKING_AGREEMENT §5, L151).

## 4. DESIGN CHOICES (each with an alternative)

1. **A tenant route refuses a missing tenant with 400, in a middleware (`requireTenant`) mounted after the stub,** not inside each service. *Alternative:* turn the services' `assertTenantId` into a 400, which would leave the lookups and every later service each responsible for it, and a forgotten one a 500.
2. **400, not 403:** the request lacks something the client can supply (a tenant). *Alternative:* 403, as "not allowed without a tenant"; the client words both through `formatApiError`.
3. **"SUPERADMIN" is `holdsSuperAdmin`:** a NULL-tenant row of the platform role `SUPERADMIN`, the same test `GET /api/me` uses (moved into one function). *Alternative:* any platform role (`IsPlatformRole`), which would extend the override to roles that don't exist yet.
4. **An X-Dev-Act-As account must hold at least one role** (the accounts the list shows), and, unless it is a SUPERADMIN, a tenant. *Alternative:* any active `@gabay.test` admin, so a role-less account would reach the tenant rule and fail there.
5. **A bad `X-Dev-Act-As` is 403, a bad `DEV_STUB_USER_EMAIL` stays a 500:** a header is the request's fault, a setting is the developer's. *Alternative:* 403 for both.
6. **The account list makes one access-store read per account** (about five, development only), reusing its `UserRole` query and its annotated reason, so no new `// tenant-scope:` suppression. *Alternative:* one join of `AppUser`, `UserRole`, `Role` and `Tenant`, which needs that annotation.
7. **The SUPERADMIN override accepts inactive tenants,** as the stub already does for held tenants (L155: R1 rules inactive-tenant behaviour). *Alternative:* existing and active only.
8. **The accounts route is mounted only when built** (`devAccounts` null otherwise), and its service refuses to exist outside development or test, as the stub does. Outside those environments `createApp` already throws because of the stub, so this is a second, independent guard. *Alternative:* rely on the stub's guard alone.
9. **Role order is computed in JS in code-unit order** (`inStubOrder`), not by `ORDER BY Tenant.Code`, whose collation would put `T_b` next to `T_B`. *Alternative:* `ORDER BY Code COLLATE "C"` in SQL, which would have to be repeated in each query.

## 5. Waivers and the definition of done (FEATURE_PIPELINE §5), the server half

- `Waived: 3 (guard order) — the dev stub stands in; fitted in R1–R3 and checked by the route-guard-order lint, R7`
- `Waived: 4 (permission and menu rows) — R2`
- `Waived: 9 (automated e2e), the API manual cases SK.1 to SK.12 written now — R12`

| # | Status (server half) |
|---|---|
| 1, 2 | N/A: no schema or seed change (the accounts are the seeded ones) |
| 3, 4, 9 | Waived (above); ledger rows written |
| 5–8, 11, 13 | The client half's |
| 6 | N/A |
| 10 | API manual: SK.1 to SK.12. The frontend manual and smoke guide are the client half's |
| 12 | Walked below |
| 14 | N/A: no option list (the role codes are the `Role` table's) |
| 15 | N/A: no lookup referenced |
| G1 | §3's table |
| G2, G3 | N/A (no screen) |
| G4 | The SUPERADMIN behaviour is the owner's ruling for this slice; it still needs its `plan.html` row (§7) |

**The sync table:**

| When this changes | Done |
|---|---|
| `db/schema.sql` | Not changed |
| An API route | Tests (§3). API manual SK.1 to SK.12. Blueprint 0.31: 4.15 (act-as, the SUPERADMIN rule, `requireTenant`, `GET /api/dev/accounts`), §2.3 (the new files), and the stub trap. Permission and menu seed waived to R2. E2E waived to R12 |
| A screen or its wording | N/A for this half |
| A dependency | None |
| A setting, limit or option list | None new (`DEV_STUB_USER_EMAIL` is FF-0's) |
| A command or check | None |
| An owner ruling | The SUPERADMIN rule is in the ledger row, the Blueprint and this report; its `plan.html` row is the main session's (§7) |
| A pipeline entry's state | P0-16's state is the main session's once both halves merge |
| A deploy or an incident | None |

**Retrofit ledger** (`plan/PH4-feature-first.md` §7), two new rows. One is `GET /api/dev/accounts` (development only, n/a for each guard with its reason; R8 deletes it). The other is the `X-Dev-Act-As` header with `requireTenant`: stub; guard order open (R1); no permission or menu row; audit open (R3: the act-as and the SUPERADMIN override are not audited yet); validation open; e2e none. That row carries the owner's ruling.

## 6. The contract, as built

The client's §2 contract holds exactly: path, ignored headers, `items` with `email`, `displayName`, `isDefault` and `roles` of `{ code, tenantId, tenantName }`, the role order, 404 outside development (the API does not start there), and errors as `{ error }`. Items are ordered by email; the client does not depend on order. Its three open server points (§2, items 1 to 3) are settled:
1. SUPERADMIN without `X-Tenant-Id` acts with no tenant; the lookups and FF-1 routes answer 400, which `formatApiError` shows.
2. A header naming a non-`@gabay.test`, unknown, inactive or role-less account is 403; a tenant the account does not hold is 403.
3. A stale header between a re-seed and a reload is a 403 as stated; the accounts list itself always answers.

## 7. Suggestions and hand-offs

- **The owner's SUPERADMIN ruling needs its `plan.html` row** (this slice's row), recorded by the main session.
- **R3's audit:** the SUPERADMIN tenant override is the "audited override" of Blueprint 2.4; it is not audited until R3 (`AuditLog.ActingAsTenantId`). The ledger row says so.
- **R1:** `tenantContext` takes over `requireTenant` and the override; the stub's `chosenTenant` is the rule to port.
- **Manual SK.8** needs an account of another domain inserted by hand (the seed has none).
