# Gabay — E2E Frontend Test Cases Manual (shopper app and admin web page)

> **Version**: 0.4 | **Date**: 2026-10-12 | **Status**: Phase 0 stub (standard §2, §7.3; plan.html L115); cases are written from Phase 1; FF-0 adds the admin banner rows FF0-FE-01 to FF0-FE-05; FF-SK adds the role dashboards, the development switcher and the shopper tabs, rows SK-FE-01 to SK-FE-16; FF-2 adds the seeded-venue rows FF2-FE-01 to FF2-FE-03 | **Audience**: the tester running a release gate | **Scope**: every screen of the shopper app (Android and iOS) and the admin web page

## How to use

- The release gate: **any ✘ blocks release; all ☐ → ✅ = SYSTEM PASS.**
- Admin web page: DevTools open for the full run; any red console error is an automatic ✘.
- Shopper app: run on one budget Android phone and one iPhone (L103); tablet cases also in landscape.

## Conventions (tags appended to any case)

| Tag | Obligation | Automatic fail when |
|---|---|---|
| `[R:<role>]` | Run as that role (L41) | Another role can do it |
| `[M]` | Repeat at phone width | Anything overflows or is cut off |
| `[T]` | Repeat on a tablet in landscape (L103) | The wide layout breaks |
| `[K]` | Keyboard only (admin) | Any step needs a mouse |
| `[S]` | Screen reader on (TalkBack or VoiceOver; L112) | A control has no name, or two voices speak |
| `[L]` | Repeat in Tagalog (L99) | Any everyday text is untranslated |
| `[O]` | Repeat offline, with the package already downloaded (D2) | A §6.5–§6.9 feature stops working |
| `[X]` | Text size Largest (×1.4) | Anything overflows |

## Test accounts and pre-flight

As the backend manual, plus: the shopper app installed from a debug build; Bluetooth and location allowed, then repeated denied (Apple 5.1.1(iv)).

## Phases

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| — | Written from Phase 1, one phase per pipeline entry | — | — | ☐ |

### FF-0: the admin development banner (E-20; `plan/FF0-dev-stub-lookups.md` section 4)

The lookups fetcher has no screen of its own. Its cases arrive with P0-01 (FF-1), the first form with a building-type picker.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF0-FE-01 | The admin banner shows on every admin page `[M]` `[X]` | `flutter run -d chrome -t lib/main_admin.dart`; open `/`, then About, then back | "Development build: no sign-in" is the first thing on the page, full width, above the app bar, on both pages. At phone width and text size Largest it wraps to more lines, is never cut off, and nothing overflows | ☐ |
| FF0-FE-02 | The banner is read by a screen reader `[S]` | With TalkBack, VoiceOver or the browser's accessibility tree on, open the admin page | The banner is announced as "Development build: no sign-in", once, before the page's own content | ☐ |
| FF0-FE-03 | The banner follows light and dark | Switch the system theme between light and dark | The banner stays readable in both: a tinted band, an icon and the words | ☐ |
| FF0-FE-04 | The shopper app has no banner | `flutter run -t lib/main_mobile.dart` | No "Development build" banner anywhere | ☐ |
| FF0-FE-05 | A release build shows the banner only when asked | `flutter build web -t lib/main_admin.dart --dart-define=API_BASE=<https url>` and serve it; repeat with `--dart-define=DEV_STUB=true` added | Without the define: no banner. With it: the banner shows | ☐ |

### FF-SK: role dashboards, the development switcher and the shopper tabs (E-20; `plan/FF-SK-dashboards.md`, PRD 6.26)

Needs the API running with the development stand-in and the server half of FF-SK (`GET /api/dev/accounts`, the `X-Dev-Act-As` header). The five seeded accounts are in `db/seeds/lib/accounts.js`. Every module is a placeholder until its slice: a row for a module's own screen arrives with that slice.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| SK-FE-01 | The build page opens the dashboard `[M]` | `flutter run -d chrome -t lib/main_admin.dart`; on `/` press "Open the dashboard" | The dashboard opens at `/admin`, under the "Development build: no sign-in" line, with a second line "Viewing as ... · Mall admin · Demo Malls" | ☐ |
| SK-FE-02 | The menu follows the account `[M]` `[X]` | Press the switcher button (top right) and pick each account in turn: SuperAdmin, Mall Admin, Venue Editor, Viewer, Mall Admin (Demo Malls only) | The menu holds 22, 20, 4, 16 and 20 modules; the home page lists the same; the second banner line names the account and role each time | ☐ |
| SK-FE-03 | A Viewer is read-only `[M]` | Switch to Test Viewer | Every module says "Read-only for this role"; the menu has no Users, Roles and permissions, Audit log, Settings, Tenants or National holidays | ☐ |
| SK-FE-04 | Two tenants `[M]` | Switch to Test Mall Admin, then choose "Spike Venues" under "Tenant (mall operator)" | The banner line names Spike Venues; switching to Test Mall Admin (Demo Malls only) offers no tenant choice | ☐ |
| SK-FE-05 | A module opens its placeholder `[M]` | Open any menu entry | "Under development", the module's name, "Pipeline ID: ..." and the slice ("Delivered by FF-1", "After the retrofit (P1)", ...). No data, no spinner, no network call to a module route | ☐ |
| SK-FE-06 | A module the role does not have `[M]` | As Test Viewer, type `/admin/users` in the address bar | "This role does not have this module." and a button back to the dashboard | ☐ |
| SK-FE-07 | The choice is kept `[M]` | Choose Test Viewer, reload the page | The page reopens as Test Viewer | ☐ |
| SK-FE-08 | The accounts cannot be listed `[M]` | Stop the API, reload `/admin` | An error with the reason and "Try again"; starting the API and pressing it loads the dashboard | ☐ |
| SK-FE-09 | Wide and narrow `[M]` | Resize the browser from 1280 px to 390 px | Wide: a side menu. Narrow: a menu button opens a drawer, and choosing an entry closes it | ☐ |
| SK-FE-10 | The admin dashboard is read by a screen reader `[S]` | With the browser's accessibility tree or a screen reader on | The menu is named "Modules menu"; each entry reads its name and "Under development"; the switcher button reads "Switch account (development)"; the second banner line is read once | ☐ |
| SK-FE-11 | Large text `[M]` | Set the browser text size to 140 percent at 320 px width; open the home page, the drawer, the switcher and a module | Nothing is cut off or overflows | ☐ |
| SK-FE-12 | The shopper app's tabs `[M]` | `flutter run -t lib/main_mobile.dart`; on the build page press "Open the app" | Four tabs: Places, Map, Parking, Me. Each opens its placeholder; Map says "Delivered by FF-4", Places "FF-5", Parking "After the retrofit (P1)", Me "FF-7 and the retrofit (R10)" | ☐ |
| SK-FE-13 | The shopper tabs on a tablet `[M]` | Run on a tablet or a window 1024 px wide | A rail at the side instead of the bottom bar | ☐ |
| SK-FE-14 | The shopper app has no switcher and no banner `[M]` | Look at every tab | No "Development build" banner, no account line, no switcher | ☐ |
| SK-FE-15 | The admin page in a release build `[M]` | Build the admin page for release without `DEV_STUB=true` (`flutter build web -t lib/main_admin.dart --dart-define=API_BASE=<https url>`, serve it) and open `/admin` and `/admin/venues` | A title bar "Dashboard" and one centred note, "Sign-in arrives with the retrofit (R8). Until then this page has nothing to show outside a development build." No menu, no switcher button, no "Development build" banner, and the browser's network tab shows no request to `/api/dev/accounts` or any module route. Screenshot: `phase-reports/feature-first/shots/FF-SK/admin_release_sign_in_pending_*` | ☐ |
| SK-FE-16 | SUPERADMIN chooses a tenant `[M]` `[X]` | Switch to Test SuperAdmin; the switcher shows "Tenant (mall operator)" with "No tenant" selected, then "Demo Malls" and "Spike Venues". Open Venues, buildings and levels. Then choose "Spike Venues" in the switcher | With no tenant: the banner line has no tenant, and Venues (and every other tenant module) says "Choose a tenant in the switcher to open this"; Tenants and National holidays still open their placeholder. After choosing a tenant: the banner line names it, the page opens its placeholder, and every request carries `X-Tenant-Id` for it (network tab). Choosing "No tenant" again drops the header. Screenshots: `admin_dev_switcher_superadmin_*`, `admin_needs_tenant_venues_superadmin_*` | ☐ |

### FF-2: the seeded venues in the admin lists (P0-02, AC-15; E-20)

Setup: `npm run seed`, the API on the development stub, `flutter run -d chrome -t lib/main_admin.dart`. FF-1 owns the widget tests of its screens and FF-SK those of the switcher; these rows check the seeded data on screen.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF2-FE-01 | Demo Malls in the venue list | Open the venue list with the default account (`malladmin@`) | The four venues Aurora Mall, Bayview Grand, Meridian Twin Malls and Skyline Spire; opening one shows its seeded buildings, and opening a building shows its levels (Skyline Spire has many) | ☐ |
| FF2-FE-02 | Spike Venues through the switcher | In the development switcher choose `malladmin@` (or `editor@`, `viewer@`) and the Spike Venues tenant | The venue list shows MEZZ office (and the penthouse on a machine that has it, and one venue per spike export you added); none of the Demo Malls venues | ☐ |
| FF2-FE-03 | A Demo Malls account cannot pick Spike Venues | Choose `malladmin.demo@` in the switcher | Spike Venues cannot be chosen for it; the venue list is Demo Malls' | ☐ |

Planned closing sweeps: RBAC (admin), negative and boundary input, permissions denied, and the foreground rule (no guidance with the screen locked, invariant 5).
