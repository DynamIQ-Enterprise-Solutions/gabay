# FF-SK (client half): role dashboards, the development switcher and the shopper tabs: slice report

> **Plan**: `plan/FF-SK-dashboards.md` 1.0 (APPROVED, L157), sections 2 to 7 and 9; parent `plan/PH4-feature-first.md` 1.0 | **Pipeline entry**: P0-16 (PRD 6.26) | **Built by**: flutter-coder (Sonnet 5.5), in its working copy `Gabay-wt\flutter-coder`, branch `ff-sk-client` from `origin/main` (b172bed, FF-0 complete) | **Server half**: api-coder's, not built when this was built; the client is built against the contract in section 2, with fakes in the tests | **Status**: built; the open questions are in section 8 | **Reviewed by**: not yet (dod-reviewer)

## 1. What was built

All of it is in `app/`.

- **The module registry** (`core/modules/module_registry.dart`, with `admin_role.dart` and `module_slice.dart`): 22 admin modules and the 4 shopper tabs, each with an id, an ARB name, an icon, its pipeline ID(s), the slice that delivers it, `built` (false for all: FF-0 has no module), and, for an admin module, its tier and the roles that get it with their access (full or read-only) and scope note. `ModuleRegistry.menuFor(roles)` is the one place that applies the plan's table: SUPERADMIN gets every module in full (Phase 2 Q8), VIEWER gets what MALL_ADMIN has in its tenant, read-only (ruling 1), no administration.
- **The admin shell** (`features/admin_shell/`, `shared/navigation/admin_routes.dart`): a go_router `ShellRoute` at `/admin`. A side menu from 840 px, a drawer below it. The menu is Home and then the role's modules grouped P0, P1, P2, P3, Administration. The home page lists the same modules with "Under development" or "Ready", the slice and any scope note, and no figures. `/admin/:moduleId` shows the module's own screen once built (`shared/navigation/built_screens.dart`) and the shared placeholder before. A module the role does not have, or an id that is no module, says "This role does not have this module." with a way back.
- **The placeholder page** (`shared/components/module_placeholder.dart`): status chip, name, "Pipeline ID: ...", the slice. No provider, no API call, no data, no controls.
- **The development switcher** (`features/dev_switcher/`, `core/config/dev_act_as_provider.dart`, `core/services/dev_act_as_store.dart`): a button in the shell header opens a dialog listing the accounts from `GET /api/dev/accounts`; picking an account acts as it at once, and an account holding two tenants shows the tenant as choice chips. The choice is kept in the browser's local storage (`shared_preferences`, every call guarded). `ApiClient` sends `X-Dev-Act-As: <email>` and, for a two-tenant account, `X-Tenant-Id`. A second banner line, under FF-0's, names the account, role and tenant. It, the button and the header exist only where FF-0's banner does (`devStubBannerVisibleProvider` for the widgets; `devStubBuildProvider`, surface-free, for the header).
- **The shopper shell** (`features/shopper_shell/`, `shared/navigation/shopper_routes.dart`): a `StatefulShellRoute` with the Gabay Demo app's four tabs (Places, Map, Parking, Me) as a bottom bar on a phone and a rail from 600 px, each the placeholder ("Map": "Delivered by FF-4"). No package, no API call.
- **The way in**: the build page (`/`) keeps everything it had and gains one button after the existing controls: "Open the dashboard" on the admin page, "Open the app" on the shopper app (section 8, Q1).
- **Router**: by surface. The admin page gets `/admin/*`, the shopper app the four tabs; both keep `/` and `/about`.
- **Wording**: 71 ARB keys, each with a description (`app_en.arb`); `flutter gen-l10n` regenerated the two Dart files. Tagalog waits for P0-14 (CLAUDE.md: "Tagalog with P0-14"; no `app_tl.arb` exists until then, `l10n.yaml`).
- **Changelog**: admin entry 3 and shopper entry 2 (`changelog.dart`, ARB bullets); both fallback versions set to 0.1.6 by hand, as FF-0 did, so `version_test.dart` holds before the commit.
- **Dependency**: `shared_preferences` 2.5.6 in `pubspec.yaml` (Blueprint Part 1's row updated from "2.5.x, verify at P1"; `EXCEPTIONS.md`'s "checked, not an exception" line extended).
- **Docs**: the retrofit ledger (`plan/PH4-feature-first.md` section 7) has five new rows (the shell, the home, the placeholder, the switcher, the shopper shell); the frontend manual has `SK-FE-01` to `SK-FE-14`; the smoke guide has an FF-SK section (2 cases); Blueprint 2.3 names the new folders; `INSTALL.md` has the new screenshot command.

## 2. The accounts contract (api-coder builds to this text)

`GET /api/dev/accounts`, development only. It sits behind the same guard as the stand-in (`NODE_ENV` explicitly `development` or `test`) and is not mounted otherwise.

- **No auth, no tenant, and it ignores `X-Dev-Act-As` and `X-Tenant-Id` entirely.** The client sends those headers on every request once a choice is kept, this one included. If this route honoured them, an account that was later deactivated or removed would answer 403 here and the switcher could never be used to get out. So it is mounted before the stand-in's header handling.
- **200**, `Content-Type: application/json`:

```json
{
  "items": [
    {
      "email": "malladmin@gabay.test",
      "displayName": "Test Mall Admin (product owner)",
      "isDefault": true,
      "roles": [
        { "code": "MALL_ADMIN", "tenantId": 83, "tenantName": "Demo Malls" },
        { "code": "MALL_ADMIN", "tenantId": 84, "tenantName": "Spike Venues" }
      ]
    },
    {
      "email": "superadmin@gabay.test",
      "displayName": "Test SuperAdmin",
      "isDefault": false,
      "roles": [ { "code": "SUPERADMIN", "tenantId": null, "tenantName": null } ]
    }
  ]
}
```

- **`items`**: every active `AppUser` of the admin kind whose email ends `@gabay.test` and that has at least one `UserRole` row: the five seeded accounts (`superadmin@`, `malladmin@`, `editor@`, `viewer@`, `malladmin.demo@`), not `shopper@`. No pagination (five rows). **The client does not depend on the order** and shows it as given.
- **`email`** string, **`displayName`** string (`AppUser.DisplayName`).
- **`isDefault`** boolean: true for the one account whose email equals `DEV_STUB_USER_EMAIL`, the account the stand-in acts as when no `X-Dev-Act-As` is sent; false for the others. At most one is true. The client uses it to show the right menu before anything is chosen, When none is true, the client shows the first listed account and **sends `X-Dev-Act-As` for it** (plus `X-Tenant-Id` for its first tenant if it holds two), so the page and the server never disagree about who is acting.
- **`roles`**: one object per `UserRole` row: `code` (`Role.Code`: `SUPERADMIN`, `MALL_ADMIN`, `VENUE_EDITOR`, `VIEWER`; any other code is shown by the client as a role with no dashboard), `tenantId` (integer, or `null` for a platform role) and `tenantName` (string, or `null`). **Order the rows in the same order as `devStub.js`'s `tenantsOf`: code-unit order by `Tenant.Code` (platform roles, which have no tenant, first)**. The client treats the first tenant as the account's default, which is what the stand-in picks when `X-Tenant-Id` is absent.
- **Errors**: `{ "error": "..." }` with the status, as everywhere (`formatApiError` words them). Outside development and test the route does not exist (404).
- **Dropped from the proposed shape**: `isPlatform` (the client reads it from the `SUPERADMIN` code) and `tenantCode` (nothing needs it). Adding either is harmless: the client ignores unknown fields.

The headers the client sends, for the stand-in:

| Header | When | Value |
|---|---|---|
| `X-Dev-Act-As` | once an account has been chosen (and kept), or at once when the list has no `isDefault` account (the shown first account); otherwise never before, never in a release build made without `DEV_STUB=true`, never from the shopper app | the account's email |
| `X-Tenant-Id` | only for an account that holds **two or more** tenants, always the chosen one (the first by tenant code when the person has not picked) | the tenant's id as digits |

Things api-coder must settle, because the client cannot:

1. **`X-Dev-Act-As` for SUPERADMIN.** The client sends it with no `X-Tenant-Id` (the account holds no tenant). Today's `devStub.js` answers 500 "has no tenant role" for such an account (`MSG.noTenant`). The switcher must be able to act as `superadmin@`, so the stub needs a rule: for a SUPERADMIN with no `X-Tenant-Id`, act with no tenant (`req.tenantCompanyID` unset) or with the first tenant by code. Whichever it is, FF-0's lookups route has to answer for it. **Section 8, Q3.**
2. A header naming an account that is not `@gabay.test`, not found or inactive: 403 (plan section 5). A tenant the acted account does not hold: 403 (already the stub's rule).
3. The client corrects a kept choice once it has the account list (an account that is gone is cleared; a tenant id the account does not hold is replaced by its first, so a re-seeded database cannot leave a stale `X-Tenant-Id`), so a 403 for a stale header is only possible between a re-seed and the first reload of `/admin`.

## 3. Tests, failing first

**New files** (no existing test file was changed; the existing suite is untouched, 284 tests at the start of this work):

| File | Tests | What it proves |
|---|---|---|
| `test/modules/module_registry_test.dart` | 25 | the four role menus typed out from the plan's table (not derived from the registry): MALL_ADMIN 20 modules, VENUE_EDITOR 4, VIEWER the 16 tenant modules, SUPERADMIN all 22; no module for a role the table does not give it; unknown roles get nothing; two roles get the union with the stronger access; VIEWER is read-only everywhere and the others are full; the three scope notes; ids unique and URL-safe; every module has a distinct ARB name, an icon, a pipeline ID and a slice; tier order; tier agrees with the pipeline ID; nothing is built and the `built` flag and `built_screens.dart` agree; the tabs are Places, Map, Parking, Me with the plan's slices; **every feature ID is a heading in `docs/product/FEATURE_PIPELINE.md`, every Phase 2 slice ID a row in `plan/PH2-identity.md`, every FF-n and R-n slice a row in `plan/PH4-feature-first.md`** (the tests read the files); the slice wording module by module |
| `test/modules/module_placeholder_test.dart` | 8 | every module (22 and 4) shows the status, name, pipeline line and slice, **and the transport saw no request**; the Phase 2 line; no list, table, field or button; the read-only note; the name is a heading and each line has a screen-reader name; colour scheme in light and dark; no overflow at x1.4 on 320 px for every module |
| `test/dev_accounts_service_test.dart` | 13 | the request (GET, path, no body); the five accounts read; tenants and `rolesIn`; an empty list; five malformed replies refused as `FormatException`; errors reach `formatApiError` |
| `test/dev_act_as_test.dart` | 19 | the Notifier (restore, choose, a choice before the kept one arrives wins, throwing storage, a release build without `DEV_STUB`); **the headers** (none with no choice; Act-As only for a one-tenant account; both for two tenants; a later choice changes the next request with the same client; none in a release build; a blank account not sent); the local-storage store (round trip, removal, wrong-typed values, a blank email, storage that cannot be opened) |
| `test/dashboards/admin_shell_test.dart` | 47 | the way in; the default account; **the menu for each of the five accounts**; a viewer sees no administration and read-only; scope notes; the tenant offered only for a two-tenant account; the tenant chosen is sent; superadmin sends no tenant; the choice kept, restored, written, and corrected (an account gone, a stale tenant, a tenant kept for a one-tenant account); throwing storage; the home page (state, slice, no figures; a tile opens the page; an account with no known role; the "Ready" chip); module pages (all 22 as superadmin with **no call but the accounts list**; the current entry marked; a module the role lacks; switching role on a page the new role lacks; an unknown id); loading, error with retry, error worded by status, empty; wide and narrow layout; screen-reader names for the menu, the entries, the switcher, the account line and the dialog; colour scheme in light and dark; no overflow at x1.4 on 320 px through the home, the drawer, the switcher and a module |
| `test/dashboards/shopper_shell_test.dart` | 16 | the way in; the four tabs in order and no banner; each tab's placeholder with its name, pipeline line and slice and **no request**; "Delivered by FF-4"; tab switching and the selected tab; no admin routes on the shopper app; bottom bar on a phone, rail on a tablet; screen-reader names and heading; the bar sets no colour of its own; no overflow at x1.4 on 320 px on every tab |
| `test/dashboard_screenshot_test.dart` | 30 | the screenshots of section 5 (each also asserts what it shows) |
| `test/support/dev_harness.dart`, `test/support/screenshots.dart` | n/a | the fake transport serving the contract, the root builders, `pingApi`; the font loader and PNG writer. Support files, no test |

**Failing before the code**, `flutter test` on the new files with the library files absent:

```
Failed to load ".../test/modules/module_placeholder_test.dart": Error when reading 'lib/core/modules/module_registry.dart'
Failed to load ".../test/modules/module_registry_test.dart":  Error when reading 'lib/core/modules/admin_role.dart'
Failed to load ".../test/dashboards/admin_shell_test.dart":   Error when reading 'lib/core/config/dev_act_as_provider.dart'
(and the same for the others)                                  exit=1
```

That red is a compile failure, as in FF-0: the new names did not exist yet. After the code, the failures that were real, and what each changed:

1. **A hang in the first admin-shell run.** A test made a request through the fake transport and awaited it inside the test's fake clock; it never completed. Fix in the test support: `pingApi` runs the call in `tester.runAsync`.
2. **An existing test broke** (`api_client_test.dart`, "apiClientProvider wires the three callbacks"): the new act-as callback read the banner provider, which reads the surface provider, which that test does not override and which throws by design. Not a defect in the test. Fix in the code: the act-as state asks a surface-free provider (`devStubBuildProvider`: not a release build, or `DEV_STUB=true`); the widgets still use the surface-aware `devStubBannerVisibleProvider`. The shopper app has no switcher and an in-memory store, so it can never hold a choice.
3. **An existing test broke** (`shell_test.dart`, "admin shell nothing overflows at text size x1.4 on a small phone"): the entry button, put first on the build page, pushed "About this app" to the very edge of the 320 px viewport, below what `scrollUntilVisible` brings into view. Not a defect. Fix in the code: the button now follows the existing controls, so they keep their places (section 8, Q1). No existing test was changed.
4. **The placeholder sat off-centre in the shopper app.** Seen in the first screenshots: a `SingleChildScrollView` is as wide as its child, and the shopper shell's tab stack gives it loose constraints. Fix: the page's column fills the width.

## 4. Verification

`flutter analyze`: `No issues found!`

`flutter test`: `+442: All tests passed!` (284 existing, none changed, plus 158 new: 25 + 8 + 13 + 19 + 47 + 16 for the six test files and 30 screenshot scenarios).

`npm run verify` (`GABAY_VERIFY_OWNER=flutter-coder`), on the working tree the review-fix commit holds (the first run, before the review fixes, was also ALL GREEN with 437 tests; this one waited behind api-coder's run for the lock):

```
ok   node-version         (0.0 s)
ok   node-check           (2.5 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (3.8 s)
ok   tools-tests          (103.3 s)
ok   eslint               (18.6 s)
ok   prettier             (3.0 s)
ok   schema-run-1         (2.6 s)
ok   schema-run-2         (1.9 s)
ok   api-tests            (16.1 s)
ok   db-tools-tests       (1.2 s)
ok   seed                 (63.9 s)
ok   functions-health     (17.9 s)
ok   flutter-analyze      (7.8 s)
ok   flutter-test         (35.5 s)
ALL GREEN   (280.6 s)
exit=0
```

All 15 checks `ok`, exit code 0. The test run went green on the first full run after the two fixes of section 3 (items 2 and 3).

### Review fixes (dod-reviewer, 2026-10-12; owner rulings: `/` stays the build page, `shared_preferences` kept, administration modules keep their Phase 2 slice IDs, SUPERADMIN acts with no tenant unless one is chosen)

- **I1**: with `devStubBuildProvider` false, `adminViewProvider` returns "nobody" without reading the accounts provider, and the shell shows only "Sign-in arrives with the retrofit (R8)..." (ARB `adminSignInPending`): no menu, switcher, account line or banner. Tests: `/admin` and `/admin/venues` make zero requests and show that page. These two tests and the N1 tests were written together with the code, not shown failing first.
- **I2**: waivers of section 7 are in the reviewer's exact form; the ledger rows' e2e cells name R12.
- **N1**: contract text says roles follow `devStub.js`'s `tenantsOf` order; with no `isDefault` account the client chooses the first listed account (and its first tenant if it holds two) so the header names the account the page shows. Tests: no default sends `X-Dev-Act-As` for the first account, with and without a tenant; a flagged default sends nothing.
- **N2**: the kept-choice correction now runs in the view-model layer (`adminViewProvider` listens to the accounts and the choice), not in `AdminShell`.
- **N3**: `DevActAs` is in `core/config/dev_act_as.dart`.
- **N4**: the shopper changelog bullet ends "Each names the step that delivers it."
- **N5**: the registry tests now assert the "Phase 3 baseline" phrase and its source, and the slice-wording test covers all 22 modules.
- **N6**: lists of role names and pipeline IDs are joined with ARB `listSeparator`.
- **N7**: `app/lib/features/README.md` describes what is there.
- **N8**: Tagalog is cited as CLAUDE.md's "Tagalog with P0-14".

## 5. Screenshots

Test-rendered (Roboto and the Material icons loaded from the SDK, no private data), 30 PNGs in `phase-reports/feature-first/shots/FF-SK/` (the command is in `INSTALL.md`): each admin role's dashboard (`admin_dashboard_{superadmin,malladmin,editor,viewer}_{light,dark}_{phone,tablet}`), an admin placeholder (`admin_placeholder_publish_viewer_*`, four), the open switcher (`admin_dev_switcher_{light,dark}_phone`), the drawer (`admin_drawer_light_phone`), and the shopper tabs (`shopper_tab_map_*` in four variants and `shopper_tab_{places,parking,me}_light_phone`). I looked at the mall admin on a tablet (light), the viewer on a phone (dark), the editor on a phone (light), the switcher (light phone), the drawer, the viewer's placeholder (dark tablet) and the map tab (light phone, dark tablet): the two banner lines sit above the app bar, the menu is grouped by tier, the read-only note shows for the viewer, nothing is cut off.

## 6. DESIGN CHOICES (flutter-coder; each with its alternative)

1. **`/` keeps the build page, with a new entry button after the existing controls.** Four existing tests pin `/` as that page (`shell_test`, `entrypoints_test`, `dev_stub_banner_test`, the screenshot scenarios) and the lead said not to change one. *Alternative:* make `/` the dashboard (a redirect, or the build page moved to `/about`), which is a better first screen for the product owner and needs those tests changed (Q1).
2. **`shared_preferences` 2.5.6 for the kept choice.** It is the package the standard's section 4 names, Blueprint Part 1 already listed it (to be verified at P1), and it is what the shopper app needs anyway. *Alternative:* keep nothing (the choice resets on reload), or write `window.localStorage` through `package:web`, which is a dependency too and web-only (Q2).
3. **The accounts contract has `isDefault`.** Without it the client cannot know whose menu to show before anything is chosen. *Alternative:* the client always sends `X-Dev-Act-As`, for the first listed account, so the server's default never matters.
4. **The contract is minimal:** `isPlatform` and `tenantCode` dropped. *Alternative:* keep them as the lead's example had; harmless.
5. **Admin modules with no pipeline entry** (users, roles, audit, settings, tenants and platform lookups) name their Phase 2 slices (`P2-S7`, `P2-S11`, ...), which a test finds in `plan/PH2-identity.md`, and "Phase 3 baseline", which a test finds in the pipeline's prerequisites text. *Alternative:* add pipeline entries for them (Q4), or show no ID.
6. **Scope notes on three table cells** ("Buildings and levels only", "Confirm or fix only", "Local days only"), from the L41 table's remarks. *Alternative:* drop them; the placeholder would not say what the editor's slice of a module is.
7. **One route `/admin/:moduleId`**, not one route per module; a built module's screen is a map entry (`built_screens.dart`). *Alternative:* a `GoRoute` per module, which a slice would add to a list in the router.
8. **The router is built by surface**: `/admin/*` is not in the shopper binary's router and the tabs are not in the admin's. *Alternative:* all routes on both, as Phase 1 had.
9. **The second banner line lives in the shell, not in the global banner frame.** It needs the account list, and the frame is above every admin route (the build page, About), where it would fetch the accounts on routes that have no use for them and break the existing tests' no-request assumption. The line therefore shows on `/admin/*`, not on `/` or About. *Alternative:* in `DevStubBannerFrame`, fetching on every admin route.
10. **`adminViewProvider` sits between the shell and the switcher** (account, tenant, roles, menu). R8 builds the same view from the session and nothing above it changes. *Alternative:* the shell reads the switcher's providers directly; R8 then edits every view.
11. **The kept choice is corrected once the accounts are known** (`reconciledChoice`). *Alternative:* trust the stored value, and let a re-seed make every request 403 until the person re-picks.
12. **`retry: null` on the accounts provider.** Riverpod 3 retries a failing provider by default; a dead API should show its error and a Try again at once. *Alternative:* the default back-off, with a spinner that long.
13. **The shopper app's "Open the app" lands on the Map tab,** the app's centre. *Alternative:* Places, the first tab.
14. **Breakpoints:** 840 px for the admin side menu (Material's expanded window class), 600 px for the shopper rail (a tablet gets the wide layout, L103). Named constants.
15. **Tier headings read "P0" to "P3" and "Administration"**; the product owner already speaks in those terms. *Alternative:* names ("First release", ...), which I did not invent.
16. **`apiAdapterProvider`** (null in the app) is a seam so a test can plug the fake transport into the real `apiClientProvider`, where the header injection lives. *Alternative:* build the client in the test, which would not exercise the wiring.
17. **The new screenshot test is its own file with its own support,** not new scenarios in `screenshot_test.dart` (FF-0 added to it). *Alternative:* extend the old file, which edits an existing test file; the old file's font loader is now duplicated in `test/support/screenshots.dart` (Suggestions).
18. **Role names are in ARB; the role codes are not options a client extends** (rule 5): the four codes map to a ruled table in the registry until R8, and an unknown code is shown as itself.

## 7. Definition of done (FEATURE_PIPELINE section 5), for the client half

| Item | Status |
|---|---|
| 1, 2 (schema, seeds) | N/A: no table or seed change; the accounts are the seeded ones |
| 3 | `N/A (no route; the server half is api-coder's)` |
| 4 | `Waived: 4 (permission and menu rows) — R8`. The menu comes from the registry until R8 (the ledger rows say so) |
| 5 Four states, `formatApiError` | Met: the account list has loading, error with Try again, empty and data (tests); errors go through `formatApiError` |
| 6, 7 (notifications, refresh on return) | N/A: no write; the module pages hold no data |
| 8 Rule 6 | Met: `colour-literals` passes; every colour is `colorScheme` |
| 9 | `Waived: 9 (automated e2e) — R12`; the frontend manual cases `SK-FE-01` to `SK-FE-14` are written now |
| 10 Manuals and smoke guide | Met: frontend manual 0.3, smoke guide 0.4 |
| 11 Changelog | Met: admin entry 3 and shopper entry 2, ARB bullets |
| 12 Sync table | Walked below |
| 13 FieldSpecs | N/A: no field |
| 14 Enumerable sets | Met: no option list is hardcoded for a client to extend. The role-to-module table is the ruled one (ruling 2) and R8 replaces it; the accounts come from the API |
| 15 Inactive lookup value | N/A: no lookup used |
| G1 Traceability | Section 9 |
| G2 | Screen-reader names for the menu, the entries, the switcher, the account line, the dialog and the tabs; no overflow at x1.4 on 320 px (tests). Tagalog waits for P0-14 (CLAUDE.md: "Tagalog with P0-14") |
| G3 | The shopper tabs have no map, no routing and no position, so the 2.5D and offline rules are for FF-4 |
| G4 | Differences from the plan: none beyond the DESIGN CHOICES |

**Companion-file sync table:**

| Row | Done |
|---|---|
| `db/schema.sql` | N/A |
| An API route | The server half is api-coder's (the route, its tests, the API manual, Blueprint 4.15 and Part 1's conventions). The contract is section 2 |
| A screen or its wording | ARB with descriptions; changelog on both surfaces; 30 screenshots; frontend manual `SK-FE-01..14`; smoke guide. Tagalog waived to P0-14 |
| A dependency | `shared_preferences` 2.5.6: Blueprint Part 1 pin; `EXCEPTIONS.md` "checked, not an exception" line (named by the standard's section 4) |
| A setting, limit or option list | No setting. The kept-choice keys and the two breakpoints are named constants |
| A command or check | `INSTALL.md` has the new screenshot command; `CLAUDE.md` is not mine to edit (Suggestions) |
| An owner ruling | None new |
| A pipeline entry's state | P0-16 stays `PLANNED`: the server half and the review remain. No marker |
| A deploy or an incident | None |

## 8. Questions for the owner (flutter-coder)

**Q1. [flutter-coder] The dashboards are one click from `/`. Should `/` be the dashboard?** Today `/` is still the Phase 1 build page (version, About, the sample messages) with an "Open the dashboard" or "Open the app" button below its controls. Four existing tests pin that page. Options:
 1. **Keep the build page at `/` and the button (built; recommended for now).** No existing test changes; one extra click for the owner. The page can be retired when a later slice replaces it.
 2. Make `/` the dashboard on both surfaces (the build page moves to `/about`). Better first screen, and it changes existing tests: `shell_test.dart` (the five tests of each surface), `entrypoints_test.dart` (both), `dev_stub_banner_test.dart` (the About-page and button tests), and the `screenshot_test.dart` scenarios that tap "About this app". The assertions would need rewriting, not just a scroll.
 3. Redirect `/` to the dashboard only when a development switcher choice is kept (a hybrid). More code for little gain.

**Q2. [flutter-coder] `shared_preferences` 2.5.6 is a new dependency here.** The standard's section 4 names it and Blueprint Part 1 listed it ("verify at P1"); I resolved it from pub.dev today and recorded the pin. Options: 1. **Keep it (recommended)**: the shopper app needs it anyway. 2. Drop the persistence: the switcher forgets the choice on reload and the package arrives with FF-4/FF-7.

**Q3. [flutter-coder] For api-coder: acting as SUPERADMIN.** `devStub.js` refuses an account with no tenant role (500). The switcher must act as `superadmin@gabay.test`. Options: 1. **The stub acts with no tenant for a SUPERADMIN that sends no `X-Tenant-Id`, and accepts any tenant id for one that does (recommended: the platform account sees every tenant; the client sends none today).** 2. The stub acts with the first tenant by code for a SUPERADMIN. 3. Drop `superadmin@` from the switcher's list until R1. Needs the owner's call because it changes what the stand-in does (and FF-0's lookups for that account).

**Q4. [flutter-coder] Pipeline IDs for the administration modules.** Users, roles, audit, settings and the platform data have no entry in `FEATURE_PIPELINE.md`; the registry names their Phase 2 slices and "Phase 3 baseline". Options: 1. **Leave as built (recommended)**: a test finds each in `plan/PH2-identity.md` or the pipeline's prerequisites. 2. Add pipeline entries (P2-A1...) for them; more paperwork for modules the retrofit delivers.

## 9. Traceability (plan section 7; criterion to test)

| Criterion | Test |
|---|---|
| Every module has a name, a pipeline ID that exists in FEATURE_PIPELINE, a slice | `module_registry_test.dart`: "every module has a distinct name from ARB...", "pipeline IDs and slices exist in the documents" (3 tests) |
| Every role's menu matches section 2's table exactly; SUPERADMIN gets every module; no module to a role the table does not give it | `module_registry_test.dart`: "the role menus match the plan's table exactly" (6 tests); `admin_shell_test.dart`: "the menu follows the account" (5 accounts) |
| VIEWER is read-only, no administration | `module_registry_test.dart` ("VIEWER..." and "access"); `admin_shell_test.dart`: "a VIEWER sees no administration and every module read-only" |
| Placeholders show name, ID and slice and make no API call | `module_placeholder_test.dart` (all 26 modules, `requests` empty); `admin_shell_test.dart`: "every module a role has opens its placeholder ... and calls nothing"; `shopper_shell_test.dart` per tab |
| A screenshot of an admin placeholder and a shopper tab | `dashboard_screenshot_test.dart`: `admin_placeholder_publish_viewer_*`, `shopper_tab_*` |
| The menu changes with the account | `admin_shell_test.dart`: "the menu follows the account..." |
| The header is sent | `dev_act_as_test.dart` "the headers"; `admin_shell_test.dart`: "choosing the other tenant ... sends its id" |
| The server refuses a non-seeded account (403), the header outside development, `GET /api/dev/accounts` lists exactly the seeded accounts | api-coder's server half (section 2 is the contract) |
| Screen-reader names on the menu, the switcher and the tabs; no overflow at x1.4 on 320 px | `admin_shell_test.dart` and `shopper_shell_test.dart`: "accessibility"; `module_placeholder_test.dart` |
| Existing tests: none change | `git diff --stat` shows no existing test file touched |

## 10. Suggestions (outside the slice)

- `test/screenshot_test.dart` could use `test/support/screenshots.dart` (the font loader, the PNG writer and the device sizes now exist twice).
- `CLAUDE.md`'s Commands list the one screenshot command; a second one (`test/dashboard_screenshot_test.dart`) is in `INSTALL.md` only. It is not mine to edit.
- `lib/features/README.md` still says "Phase 1 ships this folder empty"; it is out of date since FF-SK (and `core/services/README.md` since FF-SK's store).
- The FF-0 banner row of the ledger says the client sends no `X-Tenant-Id` until R8's switcher; the switcher now exists (the FF-SK switcher row says so).
- FEATURE_PIPELINE P0-16 and plan.html's FF-SK row are the main session's to move when the slice is reviewed.
