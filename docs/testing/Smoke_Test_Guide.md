# Gabay — Smoke Test Guide

> **Version**: 0.8 | **Date**: 2026-10-16 | **Status**: Phase 1 (synced at the S8 gate), plus SEC-3's sign-in cases (which replace FF-0's admin banner and FF-SK's development switcher) and FF-SK's role dashboards and FF-2's seed rows and FF-1's venue case (trimmed to the venue record in 2b) and OA-4a-1's map editor case; the module phases are written as each P0 entry lands (standard §2, §7.4; plan.html L115). Revised in place, never forked to `_v2` | **Audience**: whoever checks a fresh build end to end | **Estimated time**: about 2 hours once written

**Run the automated suite first:** `npm run verify` from the repository root must end `ALL GREEN` (exit 0; INSTALL.md A.4). This guide is the human pass from a fresh database to every module.

## Phase 1 — Database bootstrap

Verification today (schema 0.16, 2026-10-15; first run 2026-10-07, L115):

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'gabay';   -- expected 58 (schema 0.16)
SELECT count(*) FROM pg_indexes WHERE schemaname = 'gabay';                     -- expected 136 (schema 0.16)
SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal;                         -- expected 2 (frozen package; catalog version)
```

Seed (`npm run seed`; `db/seeds/README.md`). It prints one line per venue with its row counts, one `Account ·` line per account, and ends `Seed committed.`:

- [ ] Two tenants: Demo Malls (Aurora Mall, Bayview Grand, Meridian Twin Malls, Skyline Spire) and Spike Venues (the penthouse and MEZZ office, plus any spike exports; an internal source that is not in git is reported as skipped).
- [ ] Six accounts, all `@gabay.test`: `superadmin`, `malladmin`, `editor`, `viewer`, `malladmin.demo`, `shopper`.

Per-table seed counts: see FF-2 below (P0-02).

## FF-2 — The test seed, finished (6 cases; P0-02)

1. [ ] **Demo Malls and Spike Venues in the admin page (AC-15).** With the API running (on the Auth emulator) and `flutter run -d chrome -t lib/main_admin.dart`, sign in as `malladmin@gabay.test` (passwords are your `SEED_PW_*`): choose Demo Malls in the tenant step: the venue list shows Aurora Mall, Bayview Grand, Meridian Twin Malls and Skyline Spire; switch to Spike Venues in the header: it shows MEZZ office (and the penthouse where its file is present). `malladmin.demo@gabay.test` is offered Demo Malls only.
2. [ ] **The penthouse, on your machine only (AC-6).** With `db/seeds/sources/internal/penthouse.json` present (the main folder, or a copy made by `worktree:new`), `npm run seed` prints `Spike Venues · Dynamiq penthouse (Major 1): …` and MEZZ office on Major 2. Without the file it prints the skip line naming it and L123, and still ends `Seed committed.`.
3. [ ] **Spike exports (AC-7, AC-8, AC-25).** With no `.json` in `db/seeds/sources/spike-exports/` the seed prints one `no spike exports found` line. Put one of your spike exports there and run the seed: it prints `Spike Venues · <name> (Major 3): …`. Put a broken file there (not JSON): one `skipped spike-exports/<file>: not valid JSON; …` line, and everything else is seeded. `git status` shows none of these files.
4. [ ] **The real Auth emulator (AC-10).** `npm run seed` ends with six `Account ·` lines and `Seed committed.` (the seed starts the real emulator itself, project `demo-gabay`). To see the users: from `db/seeds`, start the emulator with its saved data (`node_modules/.bin/firebase emulators:start --only auth --project demo-gabay --import ./.emulator-data`; RECALLED, the same flags as the `emulators:exec` in `tools/emulator-seed.js`, which `npm run seed` runs), then `POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x` with an account's email and its `SEED_PW_*` password: the `localId` returned equals that account's `AppUser.FirebaseUid`. (The emulator's own UI is switched off in `db/seeds/firebase.json`. The seed's tests use a fake emulator; this row is the check against the real one.)
5. [ ] **Two seeds at once.** Start `npm run seed` in two terminals together: the second fails to start the Auth emulator on the lane's shared ports (9099, 4400, 4500 in the main folder; the copy's offset added in a working copy), and the database holds one complete seed. Nothing is half written.
6. [ ] **After a publish: the way out (AC-23; from FF-3).** After FF-3's `publish:dev` has published a seeded venue, `npm run seed` (and `seed:db-only`) stops at once with exit 1 and one `Seed stopped: …` line naming the tenant codes, before writing anything. Then `npm run setup-db` and `npm run publish:dev -- DEMO_MALLS --all` bring it back. This row waits for FF-3's command.

## Phase 1b — The API and the two app shells (3 cases)

1. [ ] **API health.** Start the Functions emulator (INSTALL.md A.1c), then `curl http://127.0.0.1:5001/demo-gabay/asia-southeast1/api/api/health`. Expected: `{"status":"ok","db":"ok"}`. With PostgreSQL stopped: HTTP 503 and `{"error":"Database unavailable"}`.
2. [ ] **Shopper shell.** `flutter run -t lib/main_mobile.dart` (in `app/`): the app opens in the terracotta theme, with its About page and build stamp. No feature exists yet.
3. [ ] **Admin shell.** `flutter run -d chrome -t lib/main_admin.dart`: the admin page opens on its sign-in screen with path URLs (no `#`); after signing in (SEC-3 below) About opens from the account menu.

## FF-0 — The admin development banner (removed by SEC-3)

The banner and the account switcher no longer exist; the SEC-3 section below checks that nothing of them remains.

## FF-SK — Role dashboards and the shopper tabs (3 cases)

1. [ ] **Admin dashboards.** Signed in (SEC-3 below), the dashboard lists the modules the account can open: as `superadmin@gabay.test` all 22 (the unbuilt ones "Under development", naming their pipeline ID and slice); as `malladmin.demo@`, `editor@` and `viewer@` Venues and the Map editor, the last two "Read-only for this role" on Venues (the Venue Editor draws in the Map editor; the Viewer only looks).
2. [ ] **Shopper tabs.** `flutter run -t lib/main_mobile.dart`, press "Open the app": the four tabs Places, Map, Parking and Me each open a placeholder naming the slice that delivers it. There is no sign-in on the shopper app.
3. [ ] **SUPERADMIN and a tenant.** As `superadmin@gabay.test`: with no tenant chosen, Venues says "Choose a tenant in the switcher to open this"; choose Demo Malls in the header switcher and it opens.

## FF-1 — Venues (1 case; E-20; trimmed to the venue record in 2b)

1. [ ] **Set up a venue.** With the API running and the seed loaded, `flutter run -d chrome -t lib/main_admin.dart`, signed in as `malladmin.demo@gabay.test`, open the dashboard and "Venues" (no longer "Under development"). Create a venue (Code and Name): it appears in the list at once; open it, change the name and Save: the list shows the new name. Switch Active off: the venue stays listed, marked inactive (a venue is never deleted). Buildings and levels are drawn in the map editor from OA-4; this module no longer has screens for them.

## OA-4a-1 — The map editor, first piece (1 case; P0-11 r3)

Full cases: `E2E_Frontend_Test_Cases_Manual.md` OA4-FE-01 to OA4-FE-12.

1. [ ] **Start a map, draw a floor, watch it save.** With the API on the Auth emulator and `flutter run -d chrome -t lib/main_admin.dart`, signed in as `malladmin.demo@gabay.test`, open "Map editor" and choose a venue with no map (or create one in Venues): press "Start a blank map", fill the form (60 by 40 m) and create. Draw a wall chain (W), a rectangle unit (M) and a door (O); the top bar goes from waiting to "Saving..." to "Saved at ..." without a button. Reload the page: the same drawing is there. Stop the API, draw once more: the bar says "Not saved" with "Try again"; start the API and press it.

## SEC-3 — Admin sign-in, the session and the menu (6 cases; spec/SEC-3.md r2)

Full cases: `E2E_Frontend_Test_Cases_Manual.md` SEC3-FE-01 to SEC3-FE-24.

1. [ ] **Sign in and out.** The page opens on the sign-in screen only. Sign in as `malladmin.demo@gabay.test`: the dashboard; the account menu names the person, the role and the tenant; "Sign out" returns to the sign-in screen with no message. A wrong password shows one plain message and keeps the email.
2. [ ] **The menu follows the role.** Sign in as `viewer@gabay.test`: Venues is read-only; typing `/admin/venues/new` or `/admin/users` shows "You do not have access to this page.".
3. [ ] **Several tenants.** Sign in as `malladmin@gabay.test`: the "Choose a tenant" step appears once; the header switcher changes the tenant and the venue list with it; a reload remembers the choice.
4. [ ] **The session ends politely.** With `auth.idTokenMaxAgeS` set to a few seconds, wait and reload: the sign-in screen says "Your session has ended. Sign in again." and signing in returns to the page you were on.
5. [ ] **The shopper app still starts.** `flutter build apk --debug -t lib/main_mobile.dart`, install and open it on an Android phone or emulator: the four tabs open as before (the admin's Firebase plugins are in its build but never started; SEC3-FE-18).
6. [ ] **The real project (owner only).** INSTALL A.6: sign in as your own SuperAdmin and Mall Admin against the Firebase project; a reset email arrives; a user with no admin account is told so and signed out.

## Phases 2+ — one per module

Written as each P0 entry lands: seeds (P0-02), publish (P0-03), shopper shell (P0-04), search (P0-05), routing (P0-06), and on through P0-14. Each has 1–8 cases with the count in its heading.

## Summary

| Phase | Cases | Pass |
|---|---|---|
| 1 Database bootstrap | 3 + seed | ☐ |
| 1b API and app shells | 3 | ☐ |
| FF-2 Test seed | 6 | ☐ |
| FF-SK Role dashboards and shopper tabs | 3 | ☐ |
| SEC-3 Admin sign-in and the menu | 6 | ☐ |
| FF-1 Venues | 1 | ☐ |
| OA-4a-1 Map editor, first piece | 1 | ☐ |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "does not exist, skipping" on the first schema run | The teardown drops tables that aren't there yet | None: not an error |
