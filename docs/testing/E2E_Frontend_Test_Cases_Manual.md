# Gabay — E2E Frontend Test Cases Manual (shopper app and admin web page)

> **Version**: 0.7 | **Date**: 2026-10-15 | **Status**: Phase 0 stub (standard §2, §7.3; plan.html L115); cases are written from Phase 1; FF-0 added the admin banner rows FF0-FE-01 to FF0-FE-05 and FF-SK the development switcher rows SK-FE-01 to SK-FE-04, SK-FE-06 to SK-FE-08, SK-FE-10, SK-FE-15 and SK-FE-16: SEC-3 removed all of them with the stand-in (numbers not reused) and adds the sign-in rows SEC3-FE-01 to SEC3-FE-17 (the Auth emulator) and SEC3-FE-20 to SEC3-FE-24 (the real project, owner-run); FF-SK keeps the role dashboards and the shopper tabs, rows SK-FE-05, SK-FE-09 and SK-FE-11 to SK-FE-14; FF-1 adds the venue screens, rows FF1-FE-01 to FF1-FE-08 and FF1-FE-17 to FF1-FE-20 (FF1-FE-09 to FF1-FE-16, the building and level screens, were retired in 2b and the numbers are not reused); FF-2 adds the seeded-venue rows FF2-FE-01 to FF2-FE-03 | **Audience**: the tester running a release gate | **Scope**: every screen of the shopper app (Android and iOS) and the admin web page

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

### FF-0: the admin development banner (removed by SEC-3)

The "Development build: no sign-in" banner is gone (SEC-3, AC-49). FF0-FE-01 to FF0-FE-05 are removed and the numbers are not reused; SEC3-FE-15 checks that nothing of it remains.

### FF-SK: role dashboards and the shopper tabs (`plan/FF-SK-dashboards.md`, PRD 6.26; the menu follows the account's permissions since SEC-3)

Needs the API running (SEC-1) and the Auth emulator with the seeded accounts of `db/seeds/lib/accounts.js`; sign in as SEC3-FE-01 says. The old rows for the development switcher (SK-FE-01 to SK-FE-04, SK-FE-06 to SK-FE-08, SK-FE-10, SK-FE-15, SK-FE-16) were removed by SEC-3 and the numbers are not reused; SEC3-FE covers sign-in, the menu per role and the tenant choice. Every module is a placeholder until its slice: a row for a module's own screen arrives with that slice.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| SK-FE-05 | A module opens its placeholder `[M]` | Sign in as `superadmin@gabay.test` (the one account whose menu lists modules that are not built yet, Q6 (a)); open any menu entry. For a tenant module, first choose a tenant in the header switcher | "Under development", the module's name, "Pipeline ID: ..." and the slice ("Delivered by FF-1", "After the retrofit (P1)", ...). No data, no spinner, no network call to a module route | ☐ |
| SK-FE-09 | Wide and narrow `[M]` | Resize the browser from 1280 px to 390 px | Wide: a side menu. Narrow: a menu button opens a drawer, and choosing an entry closes it | ☐ |
| SK-FE-11 | Large text `[M]` | Set the browser text size to 140 percent at 320 px width; open the home page, the drawer, the account menu and a module | Nothing is cut off or overflows | ☐ |
| SK-FE-12 | The shopper app's tabs `[M]` | `flutter run -t lib/main_mobile.dart`; on the build page press "Open the app" | Four tabs: Places, Map, Parking, Me. Each opens its placeholder; Map says "Delivered by FF-4", Places "FF-5", Parking "After the retrofit (P1)", Me "FF-7 and the retrofit (R10)" | ☐ |
| SK-FE-13 | The shopper tabs on a tablet `[M]` | Run on a tablet or a window 1024 px wide | A rail at the side instead of the bottom bar | ☐ |
| SK-FE-14 | The shopper app has no account menu and no sign-in `[M]` | Look at every tab | No account control, no tenant switcher and no sign-in screen (the shopper's sign-in is R10) | ☐ |

### SEC3-FE: admin sign-in, the session and the permission-driven menu (SEC-3; `spec/SEC-3.md` r2, `plan/SEC-3.md`)

**Setup (emulator rows, SEC3-FE-01 to SEC3-FE-17).** The API on the Auth emulator (`FIREBASE_AUTH_EMULATOR_HOST` set, the default `.env`); `npm run seed` (the six `@gabay.test` accounts, whose passwords are your `.env` `SEED_PW_*`, are then in the emulator); `flutter run -d chrome -t lib/main_admin.dart` in `app/` with no Firebase values, so the page uses the emulator and the demo project. A working copy passes its emulator port: `--dart-define=AUTH_EMULATOR=127.0.0.1:<9099 + its offset>` (INSTALL A.5). DevTools open for the full run. The admin page is English by design (L165).

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| SEC3-FE-01 | Sign in as each role `[R:SUPERADMIN]` `[R:MALL_ADMIN]` `[R:VENUE_EDITOR]` `[R:VIEWER]` `[M]` `[X]` | Open the page signed out; sign in as `superadmin@`, `malladmin.demo@`, `editor@` and `viewer@gabay.test` in turn (sign out between) | A signed-out visit shows only the sign-in screen. Each lands on the dashboard. SuperAdmin's menu lists all 22 modules (the unbuilt ones "Under development"); the others list Venues only (the one built module with a permission key); Viewer and Editor show "Read-only for this role". The account menu names the person, the email, the role and the tenant. Nothing overflows at phone width and text size Largest | ☐ |
| SEC3-FE-02 | A wrong password and an unknown email | Sign in as `viewer@gabay.test` with a wrong password; then as `nobody@gabay.test` | The same plain message both times ("That email and password do not match. Check them and try again."); no code, no status number; the email stays, the password clears, focus returns to the password field | ☐ |
| SEC3-FE-03 | Forgot your password, with a reset link from the emulator `[K]` | Type `viewer@gabay.test`, press "Forgot your password?"; then `GET http://127.0.0.1:9099/emulator/v1/projects/demo-gabay/oobCodes` and open the link of the reset code; set a new password; sign in with it | One neutral confirmation ("If that email has a Gabay account, we have sent a link..."), the same text for an unknown email; no sign-in happens by itself; the emulator's page sets the new password and the sign-in works. Restore the seeded password afterwards (`npm run seed`) | ☐ |
| SEC3-FE-04 | An inactive account | `UPDATE gabay.AppUser SET IsActive = FALSE WHERE Email = 'viewer@gabay.test'`; sign in as it | "This account cannot sign in right now. Ask your administrator." on /login (not "Your session has ended"); signed out. Set IsActive back | ☐ |
| SEC3-FE-05 | A Firebase user with no admin account | Create a user in the emulator only (`POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x` with an email and a password); sign in as it | "This account has no access to the Gabay admin page. Ask your administrator to add you."; signed out; nothing kept | ☐ |
| SEC3-FE-06 | Expiry keeps the page asked for | Sign in as `malladmin.demo@`, open `/admin/venues?search=a`; set `auth.idTokenMaxAgeS` to 5 in the settings table; wait; reload | The page goes to `/login?from=%2Fadmin%2Fvenues%3Fsearch%3Da` with "Your session has ended. Sign in again."; signing in returns to `/admin/venues?search=a`. Restore the setting to 28800 | ☐ |
| SEC3-FE-07 | Two tabs | Sign in in tab A and tab B; sign out in A; then sign in again in A while B is on /login | B takes the expiry path (/login with the page as from, and the message); after A signs in, B follows to its page | ☐ |
| SEC3-FE-08 | Several tenants: the step, the switcher and the memory `[M]` | Sign in as `malladmin@gabay.test` (Mall Admin of Demo Malls and of Spike Venues) | The "Choose a tenant" step lists both and no module opens before it; after choosing, the dashboard opens and the header has the tenant switcher; switching goes to the dashboard and the Venues list shows the other tenant's venues; reload: no step again; sign out and sign in as `viewer@` on the same browser: it is not influenced by that choice | ☐ |
| SEC3-FE-09 | A typed forbidden address `[R:VIEWER]` | As `viewer@gabay.test` type `/admin/venues/new`, then `/admin/users`, then `/admin/not-a-module` | The first two go to /unauthorized ("You do not have access to this page." and a button to the dashboard); the third shows "This role does not have this module." | ☐ |
| SEC3-FE-10 | Screen reader `[S]` | Sign-in screen, a failed sign-in, the dashboard, the account menu, the tenant step and the switcher | Every control has a name; the error is announced when it appears; the typed password is never read out; the account control reads the name and the email; the tenant switcher reads "Tenant (mall operator)" and the current tenant | ☐ |
| SEC3-FE-11 | Large text `[X]` `[M]` | At 320 px and 140 percent text: sign-in with each error, the tenant step with five tenants, the account menu, the empty dashboard, /unauthorized | Nothing overflows; a long name and email truncate in the account menu | ☐ |
| SEC3-FE-12 | The server stops after sign-in | Sign in; stop the API; reload | "You are signed in, but the server did not answer." with "Try again" and "Sign out"; never the sign-in screen; start the API and press "Try again": the dashboard loads | ☐ |
| SEC3-FE-13 | Sign out | Account menu, "Sign out" | /login with no `from` and no message; the browser's Back button shows no data of the last user; the network tab shows no call after the sign-out | ☐ |
| SEC3-FE-14 | A SuperAdmin with no tenant `[R:SUPERADMIN]` | As `superadmin@gabay.test` open Venues; then choose Demo Malls in the switcher | With no tenant: "Choose a tenant in the switcher to open this" and no `X-Tenant-Id` on any call (network tab); after choosing: the list loads and every call carries `X-Tenant-Id`; "No tenant" drops the header again | ☐ |
| SEC3-FE-15 | Nothing of the development stand-in remains | Look at every admin page, and the network tab | No "Development build" banner, no account switcher, no `X-Dev-Act-As` header, no call to `/api/dev/accounts` | ☐ |
| SEC3-FE-16 | A release build with no Firebase values refuses to start | `flutter build web -t lib/main_admin.dart --release --dart-define=API_BASE=https://example.test/api` (no Firebase values) and serve it; then add only `--dart-define=FIREBASE_API_KEY=x` | Both pages stay blank and the console names the missing keys (never a value); with all five values the page starts | ☐ |
| SEC3-FE-18 | The shopper app still starts with the two Firebase plugins in its build (AC-3, EC-49) `[M]` | `flutter build apk --debug -t lib/main_mobile.dart`, install on an Android phone or emulator, open the app | The shopper app opens on its four tabs exactly as before; no Firebase call is made (no sign-in screen, no Firebase initialisation) | ☐ |
| SEC3-FE-17 | The API and the page on different pairs (EC-51) | Run the API with `FIREBASE_PROJECT_ID` set to the real project and the emulator host empty, and the page on the emulator (or the reverse); sign in | Every call answers 401 and a fresh sign-in shows "This account cannot sign in right now" (the page cannot tell the cause); the runbook line says which API mode goes with which page build | ☐ |

**Owner-run rows against the real Firebase project (AC-61; the owner holds the values file and the accounts; agents never see them).** Setup: INSTALL A.6 (the service-account key outside the repository, the API on `FIREBASE_PROJECT_ID=<id>` with the emulator host empty, `app/config/firebase.local.json` written by the owner, the page started with `--dart-define-from-file=config/firebase.local.json`). The `AppUser` and `UserRole` rows are the parameterised statements of INSTALL A.6, with no password in them.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| SEC3-FE-20 | Sign in as your SUPERADMIN and MALL_ADMIN | The two accounts you created in the console and inserted by SQL | Each signs in and sees its menu; the SuperAdmin's tenant switcher lists every tenant of the local database | ☐ |
| SEC3-FE-21 | A wrong password | Sign in with a wrong password | The same plain message as on the emulator; if Firebase throttles, "Too many tries..." | ☐ |
| SEC3-FE-22 | A reset email that arrives | "Forgot your password?" with your own email | The neutral confirmation, then an email from Firebase; its link opens Firebase's page (not Gabay's); the new password works | ☐ |
| SEC3-FE-23 | A user with no `AppUser` row | Add a user in the console and do not insert the row; sign in as it | "This account has no access to the Gabay admin page..."; signed out (EC-50: the same happens to your own account after a reseed removed its rows, until you repeat the SQL) | ☐ |
| SEC3-FE-24 | A sign-up request is refused | After switching off "Enable create (sign-up)" in the console: `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=<web API key>` with an email and a password | The project refuses it (RECALLED: an error saying sign-up is disabled); the page has no sign-up control either | ☐ |

### FF-1: venues (P0-01; E-20; `plan/FF-1-venue-setup.md` section 4, trimmed in 2b by `plan/FF-1-client-trim.md`; spec `P0-01` r4)

Needs the API (SEC-1) and the Auth emulator, the seed loaded, signed in as the SEC3-FE rows say, and `flutter run -d chrome -t lib/main_admin.dart`. The admin page is English only by design (A3, R34). The API cases are FF1.1 to FF1.12 and FF1.28 to FF1.34 in `E2E_Test_Cases_Manual.md` (OA-2 retired the building and level routes and their cases; the manual cases FF1-FE-09 to FF1-FE-16 for the building and level screens went with them in 2b, and their numbers are not reused). Screenshots (light and dark, phone and tablet) are in `phase-reports/feature-first/shots/FF-1/`.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF1-FE-01 | The menu opens the real venue list `[M]` | `flutter run -d chrome -t lib/main_admin.dart` with the API on; sign in as `malladmin.demo@gabay.test` (Mall Admin of Demo Malls); open "Venues" | The list of Demo Malls' venues opens, not an "Under development" page; the menu entry has no construction icon and is marked as the current one, also on a page deeper in the module. The seed shows its four venues sorted by Name (Aurora Mall, Bayview Grand, Meridian Twin Malls, Skyline Spire). Screenshots: `phase-reports/feature-first/shots/FF-1/admin_venue_list_*` | ☐ |
| FF1-FE-02 | The four states of a list `[M]` `[X]` | On the venue list: reload with the API stopped; start it and press "Try again"; with a tenant that has no venue (create a tenant in `psql`, or use a fresh database) look at the empty state; type a search that matches nothing | Loading shows a spinner named "Loading". An error shows a plain sentence ("Cannot reach the server...") and "Try again", never raw text. An empty list says "No venues yet." with "New venue" under it. A search with no match says "No venue matches your search.". Nothing overflows | ☐ |
| FF1-FE-03 | Create a venue; the list shows it with no reload `[M]` | "New venue"; type Code FF1A and Name FF1 Test Mall; Active stays on; Save | The form has Code, Name and Active (on), and no angle and no boundary field. After Save: "Venue saved.", the list opens and shows FF1 Test Mall at once | ☐ |
| FF1-FE-04 | Venue field checks `[X]` | On "New venue" press Save empty; then Code of 41 characters; Name of 201 | Each refusal names the field and nothing is sent (network tab): "Code is required.", "Name is required.", "Code must be at most 40 characters.", "Name must be at most 200 characters.". Exactly 40 and 200 characters save, and an "Ñ" counts as one | ☐ |
| FF1-FE-05 | A duplicate code `[M]` | Create a venue with the Code FF1A again; then with ff1a | The first is refused with the server's sentence ("A venue with this code already exists") in the message banner, the form keeps everything typed, and the list is not shown; ff1a is accepted (codes are as typed) | ☐ |
| FF1-FE-06 | Edit a venue; reopen it `[M]` | Open FF1 Test Mall, change its name, Save; open it again | The list shows the new name; the form shows the saved values. The edit sent the `updatedAt` it loaded (network tab, `PUT` body, which has `code`, `name`, `isActive` and `updatedAt` only) | ☐ |
| FF1-FE-07 | Active, never delete `[M]` | Switch Active off and Save | The venue stays in the list, marked "(inactive)"; it still opens and can be edited. There is no delete button on a venue | ☐ |
| FF1-FE-08 | Search and Load more | Create 26 venues (a `curl` loop on `POST /api/venues`); open the list; search for FF1; press "Load more" | 25 rows and a "Load more" button; the next press adds the rest and the button disappears. The search box keeps its text and focus while the list reloads; a failed "Load more" (stop the API) keeps the rows and offers "Try again" | ☐ |
| FF1-FE-17 | Refresh on return, the venue list `[M]` | On the venue list: create a venue and save; edit one and save; then open a form and use the browser's Back button | The list shows the change at once with no manual reload, every time | ☐ |
| FF1-FE-18 | Two admins, one record `[M]` | Open the same venue in two browser tabs; change and save in the first; change and save in the second | The second shows "Someone else changed this venue. Reload to see their change" in the message banner, keeps everything typed, and the stored values are the first tab's. Reloading the page shows them | ☐ |
| FF1-FE-19 | The API stops mid-save `[M]` | Fill the venue form; stop the API; Save; start the API; Save again | The first Save shows "Cannot reach the server..." and every value is still in the form; the second saves one venue (never two) | ☐ |
| FF1-FE-20 | Controls per role; the tenant `[R:VIEWER]` `[R:VENUE_EDITOR]` `[R:MALL_ADMIN]` `[R:SUPERADMIN]` `[S]` `[X]` | Sign in as `viewer@`, `editor@`, `malladmin.demo@` and `superadmin@gabay.test` in turn (choose Demo Malls for the SuperAdmin first). On the venue list and the venue form look for New and Save. Then, as `malladmin@` (two tenants) or `superadmin@`, switch the tenant to Spike Venues in the header | Viewer and Venue Editor: no New or Save, the form read-only (no text boxes; the Active switch greyed) with "You can look at this, but not change it."; the dashboard says "Read-only for this role" on Venues. Mall Admin and SuperAdmin: New and Save. The controls follow the permission flags of the tenant in effect, so a user who is Mall Admin in one tenant and Viewer in the other loses New and Save on switching. Every request carries `X-Tenant-Id` and the bearer token (network tab). The server enforces the same rows (the API cases FF1.x) | ☐ |
### FF-2: the seeded venues in the admin lists (P0-02, AC-15; E-20)

Setup: `npm run seed`, the API on the Auth emulator, `flutter run -d chrome -t lib/main_admin.dart`, signed in. FF-1 owns the widget tests of its screens and SEC-3 those of the session and the tenant; these rows check the seeded data on screen.

| TC# | Test Case | API or Steps | Expected | Pass |
|---|---|---|---|---|
| FF2-FE-01 | Demo Malls in the venue list | Sign in as `malladmin@gabay.test`, choose Demo Malls, and open the venue list | The four venues Aurora Mall, Bayview Grand, Meridian Twin Malls and Skyline Spire; opening one shows its seeded buildings, and opening a building shows its levels (Skyline Spire has many) | ☐ |
| FF2-FE-02 | Spike Venues through the tenant choice | Sign in as `malladmin@`, `editor@` or `viewer@gabay.test` and choose Spike Venues (in the "Choose a tenant" step, or in the header switcher) | The venue list shows MEZZ office (and the penthouse on a machine that has it, and one venue per spike export you added); none of the Demo Malls venues | ☐ |
| FF2-FE-03 | A Demo Malls account is not offered Spike Venues | Sign in as `malladmin.demo@gabay.test` | There is no tenant step and no tenant switcher (it holds one tenant); the venue list is Demo Malls'. Spike Venues cannot be chosen | ☐ |

Planned closing sweeps: RBAC (admin), negative and boundary input, permissions denied, and the foreground rule (no guidance with the screen locked, invariant 5).
