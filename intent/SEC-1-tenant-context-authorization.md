# Intent SEC-1: Real tenant context and authorization on every admin route; the development stub deleted

> **Pipeline entry:** SEC-1 (the retrofit's R1 tenant context + R2 authorization, pulled forward by L184) · **Slice:** SEC-1, stage S (`plan/DEPLOY-staging.md` 1.0 §1, §2; `plan/PH4-feature-first.md` 1.4 §4 "Order under L184 and L185") · **Date:** 2026-10-14 · **Status:** DRAFT for the owner's spec sitting (product questions only, L174); the content was approved as `plan/PH2-identity.md` 1.1 slices P2-S2 and P2-S3 (L149) and re-sequenced by L184 · **Coder:** api-coder on **Opus 5.5** (auth and tenancy, high risk; L184) · **Sources:**
> - `plan/PH2-identity.md` §3 (P2-S2, P2-S3), §7 rulings 1, 6, 8, 12, 13 and §7a (L149, L151);
> - `plan/DEPLOY-staging.md` §1 (SEC-1 row), §5 (E-20 as amended), §6 Q6 and Q7;
> - `plan/PH4-feature-first.md` §6 (R1, R2) and §7 (the retrofit ledger: every open "guard order" and "permission and menu rows" cell);
> - Blueprint Part 1 (invariant 13, `req.tenantCompanyID`; the `<known_traps>` on global lookups), Part 3 §3.1 (`PermissionRoute`, `RolePermission`, `UserPermission`, `UserRole`, `UserVenueGrant`), Part 4 §4.14;
> - `functions/src/routes/api.js` (the comment "R1 swaps the one `devStub` for `auth, requireAdminUser, tenantContext` here and deletes devStub.js"), `functions/src/middleware/devStub.js`, `auth.js`, `requireTenant.js`; `functions/src/auth/accessStore.js`, `permissionMerge.js` (S1, merged);
> - the standard §3.4 (route × CRUD), §3.5 (tenant), §6 items 1, 5 and 6.

## What the product owner wants

A real working login on the admin side (the MVP, L185) and a build that can run outside development (L184): no request reaches an admin route without a verified Firebase user who holds a role in the tenant it names, and no role may do what its grants do not allow. "Without R2, a VIEWER signs in and publishes" (DEPLOY-staging §1) ends here.

SEC-1 delivers, on the server only:

1. **Tenant context (R1).** `tenantContext` after `auth` and `requireAdminUser` on every admin route (`/lookups`, `/venues`, `/venue-maps`, and every later route). `X-Tenant-Id` is accepted only when the user holds a `UserRole` in that tenant (PH2 Q1; L121 DC28); SUPERADMIN may name any existing tenant, audited as `ActingAsTenantId`; a missing or foreign tenant is refused (the exact codes are the spec's); `req.tenantCompanyID` is the only tenant source (rule 2). Venue scope comes from `UserVenueGrant`.
2. **The stub deleted.** `functions/src/middleware/devStub.js`, `routes/dev.js` (`GET /api/dev/accounts`), the `X-Dev-Act-As` header and `DEV_STUB_USER_EMAIL` are removed; `createApp()` no longer builds the stub, so the API boots with `NODE_ENV=production` (DEPLOY-staging §0). The emulator-host guard (L151) stays as it is (Q7 (b)).
3. **Authorization (R2).** A role guard, then `requirePermission(routes[], action)`: route × CRUD; role rows OR-ed; a `UserPermission` row replaces the merged role row; SUPERADMIN bypasses (PH2 Q8); a 30 s cache cleared on every grant write; a three-valued verdict; fail-closed 503 when the database is down. Guard order `auth → tenantContext → role guard → permission guard → validate → handler` (PH2 Q6); the lint that enforces it is SEC-2's.
4. **Permission and menu rows by migration** (PH2 DC2, L184): the next free migration (`0002_…`; OA-3a's "0002" moves to the next number, as its plan says) seeds `PermissionRoute` rows and the default `RolePermission` grants for every route built so far (the L41 matrix: MALL_ADMIN and SUPERADMIN publish, rollback and clear; VENUE_EDITOR saves but does not publish; VIEWER reads), and the ledger's "permission and menu rows" cells close.
5. **`GET /api/me`** keeps returning the user, their tenants and merged permissions (S1); the client (SEC-3) builds its menu from it (PH2 Q9).
6. **Its own e2e cases** for auth, tenant isolation and RBAC on the routes it guards (waiver 9 ends for new work, L184): a cross-tenant read and write refused for every role; a VIEWER's publish 403; a VENUE_EDITOR's draft save allowed and publish refused.

## Out of scope (named so the spec does not drift)

- Rate limits, audit, validation, the two lints (SEC-2); the sign-in screen, the dev switcher's removal on the client and the banner (SEC-3); the admin API and the maintenance screens (R6, R9); shopper routes (R10).
- The lockout and single-session items (dropped, PH2 Q2); any new sign-in method (admins: email and password only, PH2 Q11).

## Product questions for the sitting

Expected none: every product choice above is already ruled (L149, L151, L184). Technical choices are DESIGN CHOICEs in the spec with an alternative each (L174).
