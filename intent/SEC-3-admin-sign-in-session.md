# Intent SEC-3: Admin sign-in, the client session and the permission-driven menu; the dev switcher and banner removed

> **Pipeline entry:** SEC-3 (the retrofit's R8 client session and routing, pulled forward by L184) · **Slice:** SEC-3, stage S, screens lane, after slice 2b merges and SEC-1 is on `main` (`plan/DEPLOY-staging.md` 1.0 §1, §2, §7) · **Date:** 2026-10-14 · **Status:** DRAFT for the owner's spec sitting; the content was approved as `plan/PH2-identity.md` 1.1 slice P2-S10 (L149) and re-sequenced by L184 · **Coder:** flutter-coder (Sonnet 5.5), Opus 5.5 review of the session and guards (L184) · **Sources:**
> - `plan/PH2-identity.md` §3 (P2-S10), §7 rulings 4, 5, 9, 10, 11 (L149); §4.4 and §4.5 of the Blueprint (session, routing);
> - `plan/DEPLOY-staging.md` §1 (SEC-3 row), §3 ("Who signs in": sign-up switched off in Firebase; `auth.js` refuses a Firebase user with no `AppUser` row), §6 Q3 (a);
> - `plan/PH4-feature-first.md` §6 (R8), §7 (the ledger's screen rows: the banner, the dev switcher, AdminShell and AdminHomeScreen);
> - `plan/FF-SK-dashboards.md` (the dev switcher, `X-Dev-Act-As`, the menu from the app registry "until R8"); `app/lib/features/dev_switcher/`, `app/lib/shared/navigation/admin_routes.dart` ("the redirect guard arrives with sign-in (R8)"), `app/lib/core/api/api_client.dart` (the 401 handler);
> - L165 (the admin page is English by design; shopper sign-in lasts 30 days, admins 8 hours: `auth.idTokenMaxAgeS` 28800, L151).

## What the product owner wants

"A real working login" (L185): a staff member opens the admin page, signs in with email and password, and sees only the modules their role allows; nobody reaches an admin screen without signing in; the development switcher and the "Development build: no sign-in" banner are gone.

SEC-3 delivers, in `app/` (the admin page and the app's admin side):

1. **E-19.** `firebase_core` and `firebase_auth` requested at this slice's start, versions read from pub.dev then (PH2 Q10), pinned in Blueprint Part 1; the shopper's Google and Apple packages wait for R10.
2. **Sign-in.** Email and password only for admins (PH2 Q11); a sign-in screen as a `FieldSpec` form (rule 7), wording in ARB (English by design, L165); "Forgot password" through Firebase's reset link; no sign-up (DEPLOY-staging §3); a Firebase user without an `AppUser` row is told plainly and signed out (the API's 403).
3. **Session.** Restore before the first frame; the token and tenant providers; the 401 path; manual sign-out versus expiry (expiry keeps `?from=`; no logout timer, PH2 Q5); the dio `ApiClient` sends the bearer token and `X-Tenant-Id`.
4. **Routing.** One `go_router` `redirect` (sign-in, then CRUD from the URL tail, failing to `/unauthorized`), `refreshListenable`, the existing `ShellRoute`, a `RouteObserver`. The menu shows only what `GET /api/me`'s merged permissions allow (PH2 Q9; it replaces the app-registry menu of FF-SK). A tenant switcher for admins with roles in several tenants (L121 DC28) and a venue switcher where `UserVenueGrant` narrows the scope.
5. **Removed.** The dev switcher, `X-Dev-Act-As`, the "Development build" banner and their ARB keys, tests and ledger rows; a changelog entry (the admin page) in plain words.
6. **Its own tests and e2e cases:** sign-in, a wrong password, an inactive user, expiry with `?from=`, a VIEWER's menu, a cross-tenant URL refused; screenshots of the sign-in screen and a role's dashboard (light and dark, phone and tablet).

## Out of scope

- The maintenance screens (R9), shopper accounts (R10), password-setup links for new admins (the `staging:admin` tool, DEP-0; the admin API, R6).

## Product questions for the sitting

1. The sign-in screen's wording and the error texts (the spec proposes; the owner may edit).
2. Whether the tenant switcher shows on sign-in when a user holds roles in more than one tenant, or defaults to the first by `Tenant.Code` as the stub did (the spec recommends: ask once, remember on the device).
