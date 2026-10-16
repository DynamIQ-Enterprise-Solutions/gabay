# Gabay — local test seed (P0-02, plan.html L119)

> **Version**: 0.3 | **Date**: 2026-10-16 | **Status**: built before the Phase 1 declaration (0.1, on the product owner's explicit permission for this task); finished by FF-2 (0.2; `plan/FF-2-test-seeds.md`, `spec/P0-02.md` r2); the interim seed of OA-3a (0.3; `spec/OA-3.md` r2 AC-12a, below) | **Audience**: developers | **Scope**: the local database and Firebase Auth emulator only. Never run against a cloud project.

## Run

```sh
cd db/seeds
npm install            # pg 8.23.1, firebase-tools 15.32.1 (Blueprint Part 1 pins)
npm run seed           # venues + the six accounts (starts the Auth emulator, project demo-gabay)
npm run seed:db-only   # venues only
```

Needs `../../.env` with `PG*` and every `SEED_PW_*` filled (see `.env.example`). Re-runnable: it first removes its own two tenants and six accounts, unless a test tenant holds a venue version (see "After a publish" below). Emulator users persist in `.emulator-data/` (git-ignored).

firebase-tools exports into a temporary `firebase-export-*/` folder and then moves it to `.emulator-data/`. When that move fails (seen once on Windows) the folder stays behind and `.emulator-data/` is gone; both are git-ignored. After the seed check, `npm run verify` puts the newest folder with a valid `firebase-export-metadata.json` and an `auth_export/` folder back as `.emulator-data/`, deletes any other `firebase-export-*/` folder, and prints one line saying what it did. It never touches an export that may be live: nothing happens while the lane's hub or Auth port has a listener (4400 or 9099 in the main folder; the copy's offset added in a working copy, plan/PH4-lane-ports.md), or while anything in a `firebase-export-*/` folder was modified less than 2 minutes ago (the line then says it left them alone). So a leftover from the seed check that has just run is restored by the next verify at least 2 minutes later, not straight away; until then the seed recreates its six accounts.

## What it creates

| Tenant | Venues | Beacons |
|---|---|---|
| `DEMO_MALLS` "Demo Malls" | Aurora Mall, Bayview Grand, Meridian Twin Malls, Skyline Spire (the Gabay Demo app's invented venues) | none |
| `SPIKE_VENUES` "Spike Venues" | Dynamiq penthouse (Major 1), MEZZ office (Major 2), and every file in `sources/spike-exports/` (Major 3, 4, …) | UUID `87872435-…` (the penthouse H2s) |

Accounts (`@gabay.test`): `superadmin` (SuperAdmin), `malladmin` (Mall admin of both tenants; the product owner), `editor` (Venue editor, both), `viewer` (Viewer, both), `malladmin.demo` (Mall admin of Demo Malls only), `shopper` (a signed-in shopper).

## Sources (JSON only; no demo or spike code is used, L34)

- `sources/demo/*.json`: a one-off dump of the Gabay Demo app's own generator, run in a scratch copy of `demo_app` on 2026-10-07. Aurora's 401 places match the demo's own `test/golden/venue.json`.
- `sources/spike/mezz.json`: the spike's bundled MEZZ office.
- `sources/internal/penthouse.json`: **Modernbrands-derived (sheet ID-01). Internal use only (L48): never in a release build, a cloud environment or a public page.**
- `sources/spike-exports/`: put the product owner's own spike venues here, exported from the spike's share sheet; the next run picks them up (see "Spike exports" below). The `.json` files are git-ignored, like `internal/`.

## Spike exports (FF-2, P0-02 AC-7, AC-8, AC-25)

- **None** (the folder is missing, empty, or holds no `.json`): one line, `Spike Venues · no spike exports found: put the spike app's .json exports in db/seeds/sources/spike-exports/ and run npm run seed again.`, then the seed commits as usual.
- **Each `.json` file** becomes one Spike Venues venue with code `SPIKE_<NAME>` (the file name upper-cased, any run of other characters turned into `_`, cut to 40 characters). Its beacons take Major 3, 4, … by the file's **slot in name order** among all the `.json` files (code-unit order; a skipped file keeps its slot), and the seed prints each venue's Major. A file that sorts earlier than an existing one moves the Majors of the files after it. This is accepted until FF-9 (ruling C1); re-check it then.
- **A file the seed cannot use is skipped** with one line, `Spike Venues · skipped spike-exports/<file>: <reason>; fix or remove it and run npm run seed again.`, and the rest is seeded (exit 0). The checks run before anything is written, in this order: *could not be read*; *not valid JSON*; *not a spike venue export* (no `extent.width` or `extent.height` above 0, no name, or `rooms`, `doors`, `obstacles` or `beacons` present but not an array; a missing one counts as empty); *name longer than 200 characters*; *same venue code as <earlier file>* (the later file by name is the one skipped); *duplicate beacon Minor*; *beacon UUID is not Spike Venues'*. A refusal the checks did not foresee (a Minor above 65535, for one) rolls back only that file, with the reason *the database refused it (<constraint>)*. The line never quotes the file's content.
- **Not copied into coder working copies** (`worktree:new` leaves them out, ruling C9): they live in the main folder. The seed's tests use invented fixtures (`test/fixtures/exports/`), never your exports.

## After a publish (FF-2, AC-23)

A published venue version is frozen and is never deleted, so a test tenant that holds any `VenueVersion` cannot be re-seeded. Both `npm run seed` and `npm run seed:db-only` check this first, before any write or Auth emulator call, and stop with exit 1 and one line that names the tenant codes that hold versions, for example:

`Seed stopped: DEMO_MALLS holds venue versions, which the seed never deletes. Run npm run setup-db (it recreates every table and re-seeds), then npm run publish:dev -- DEMO_MALLS --all to publish again.`

The way out is `npm run setup-db` (it recreates every table and re-seeds), then `npm run publish:dev -- <TENANT_CODE> --all` (FF-3 builds that command). The seed never touches a version or the frozen-version rule. A version in any other tenant does not stop it.

## The interim state (OA-3a, schema 0.17, until OA-3c)

Schema 0.17 (migration 0003) has no geometry tables, so until OA-3c writes each venue as a venue map document the seed writes **only**: the platform lookups (`ConnectorType` in seconds) and the five `routing.*` platform `GlobalSetting` rows; the two tenants; each venue as **identity only** (code and name), with no `VenueMap` row, so `GET /api/venues/:venueId/map` answers the empty shape; every store as an `Occupant` whose `UnitKey` is an **interim key** `U1`, `U2`, ... per venue in the source's order; MEZZ's beacons (and any penthouse or export's) on the interim level key `L1`; the six accounts and their grants. No interim key names an element of a document yet, so every seeded key reads `removed` (spec/OA-3.md AC-11). The mapping below is what the seed wrote before 0.17 and what OA-3c's converters carry into the documents. `npm run seed` against a database still at 0.16 fails on its first write and rolls back with the database's own message: run `npm run migrate` or `npm run setup-db` first (EC-36). `lib/geo.js` keeps its helpers that the interim seed no longer calls (the polygon, segment and door builders): OA-3c's converters use them.

## How the data maps (design choices; the product owner can overrule)

- **Coordinates:** each source's own frame, x east, y south, in metres; every level of a venue shares its venue's site frame, so a level's `WidthM`/`DepthM` is the site's size (invariant 2 allows per-level frames).
- **Levels:** one `Level` per building per demo level it has (L30), `Ordinal` = position from the ground floor (Spire's mezzanines count as levels); plus an outdoor ground level per venue. Spike venues: one level, "Floor 1".
- **Walkways:** the demo's corridor centre-lines (with their widths) and bridges become walkable `Unit`s; the walkway graph itself is generated by publish (P0-03, L32) and corrected in the editor. The spike's hand-made graphs are not imported (L119).
- **Stores:** each demo store or anchor is a `Unit` (`room`, or `movietheater`) with its doors as `Opening`s and an `Occupant`; an anchor with two or more doors is walk-through (`PassThrough`). Restrooms are `restroom` units with a CR `Amenity`; ATMs, info desks and EV chargers are amenities; exits are venue-entrance openings; parking zones are `parking` units. "IMAX" is renamed "Vista Max".
- **Connectors:** a lift is one `NavConnector` with a `NavConnectorStop` per floor; stairs, escalators and ramps are one row per hop, two-way as in the demo; Aurora's evacuation-only stairs are marked `IsEvacuationOnly`.
- **Building types** the platform lacks (open-air, arena, station) are added as Demo Malls' own lookup rows (rule 5).
- **Spike doors** below the spike's "high" confidence, and doorways to places the spike never drew (MEZZ "Brew Corner", "Restroom"), start `NeedsReview` (L108, L117): publish refuses until each is confirmed in the editor.
- **Georeference:** none on the Demo Malls venues (`Venue.GeoreferenceJson` stays NULL, ruling G1, AC-24): the test malls run on the shopper app's fallback (pick the mall, a hand-set start, "Where are you?", the guided walk). Real venues keep BLE positioning and detection by location.
- **Landmarks:** none (no `Anchor` rows, ruling C4).
- **Beacons:** `MeasuredPower` = the spike model's −55 dBm at 1 m (the H2's −30 dBm is its *transmit power*, which has no column, ruling C6); mount height from the spike (0.75 m tables, 2.7 m ceiling); model MOKO H2 (IP65, 50 months, L117). Minors stay as numbered; more beacons are added in the editor.
- **Accounts:** a user's tenants are their `UserRole` rows (schema 0.14, L121), so `malladmin@`, `editor@` and `viewer@` belong to both tenants in their own right. Every tenant-scoped account gets a `UserVenueGrant` for each of its tenants' venues.

## Seeing it (localhost)

After `npm run seed`, the admin page's venue list shows the four Demo Malls venues. Sign in to the admin page on the Auth emulator (SEC-3) as `malladmin@`, `editor@` or `viewer@gabay.test` (the passwords are your `SEED_PW_*`), choose Spike Venues in the tenant step or the header switcher, and open Venues to see MEZZ office, plus the penthouse on a machine that has it and your exports once you add them. `malladmin.demo@` is not offered Spike Venues (it holds no role there; asking the API for it anyway is a 403).

## Tests (FF-2)

`npm run seed:test` (from the root; `npm test` in `db/seeds`; verify's `seed-tests` check) runs `test/*.test.js` with Node's own runner, one file at a time. They need the schema (run `npm run setup-db` first on a fresh database) and the `PG*` and `SEED_PW_*` keys in `.env`. **They never commit:** every case runs in a transaction that is always rolled back (WORKING_AGREEMENT §5, L151), through a nesting adapter (`test/helpers.js`) that turns the seed command's BEGIN, COMMIT and ROLLBACK into savepoints, so `main()`'s real commit, rollback and stop paths run. The Auth emulator is a small fake Identity Toolkit server (the real one is still covered by verify's `seed` check and a smoke row); the sources folder is a temporary copy, never `sources/`. The tests read `.env` for the six passwords but never print them. A database that already holds a version in a test tenant makes the tests stop at the AC-23 line: run `npm run setup-db` first. The API-side half (`functions/test/seed.visible.test.js`) seeds into its own rolled-back transaction and reads the data through the real routes.

`lib/run.js` is the seed as a library: `runSeed(client, { sourcesDir, withAccounts, log })` does the work inside the caller's transaction and never begins or commits one; `seed.js` is the thin command that wraps it.

## What FF-2 finished (0.2)

The seed as a library with tests of what it writes (AC-1 to AC-4, AC-9, AC-17 to AC-20, AC-24), its fit to P0-01's lists and validation (AC-12 to AC-16, with AC-14's round trip), the exports behaviour (AC-7, AC-8, AC-25), the stop after a publish (AC-23), no georeference on Demo Malls (AC-24), and the git-ignored exports (AC-22). Publishing the seeded venues is FF-3 (P0-02 stays IN PROGRESS until then); confirming the spike doors is FF-10.

## Not done here

Publishing (P0-03, not built yet), parking availability, the demo's camera views, outdoor labels and transit points, and any spike RF model values beyond those above.
