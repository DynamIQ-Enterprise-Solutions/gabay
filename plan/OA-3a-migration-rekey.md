# OA-3a-migration-rekey: migration 0002, the re-keying, the key check, `connector-types` (slice 3a of OA-3; E-20)

> **Version**: 1.0 | **Date**: 2026-10-14 | **Status**: APPROVED 2026-10-14 under L179 (a plan delta that follows an approved spec); Q1 answered by L179 (Opus 5.5 for api-coder). **Precondition:** `spec/OA-3.md` **r2** (the gap lines this plan found: cost CHECKs, the five routing settings and their platform rows, counts after the migrations step, the interim seed shim); — written 2026-10-14, cited above | **Spec**: `spec/OA-3.md` **r2** (r1 APPROVED 2026-10-14, L178; r2 the main session's gap lines, L174/L179, no product change; **this plan covers AC-1 to AC-12, AC-7a and AC-12a**, EC and DC as §3 names them; AC-13 onward belong to 3b to 3d) | **Parent**: `plan/PH4-feature-first.md` §4, §5, §7; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 3; `plan/OA-2-map-storage.md` 1.0 (its §13 order is the model) | **Rulings**: L170, L171, L173 (OA-2 merged), L174 (delta plans, model routing, two touchpoints), L175 (admin-first), L178 | **Base**: `origin/main` 09b2788 | **Approver**: Genesis Perez, product owner (L115)
>
> **Re-sequenced by L184 (2026-10-14, `plan/DEPLOY-staging.md` 1.0, Q6 (a)).** OA-3a waits behind SEC-1 and SEC-2 in the one server lane and is **built behind real auth after SEC-1**: its routes and changes sit behind `auth → requireAdminUser → tenantContext → guard`, never the development stub (deleted in SEC-1), so E-20 waivers 3 and 4 no longer apply to it; waiver 9 ends too (each slice carries its own e2e, L184). **Migration number:** SEC-1 adds the permission and menu rows by migration (PH2 DC2) and merges first, so this plan's "migration 0002" becomes the next free number at its contract commit (likely 0003); the plan is re-checked against SEC-1 as built before step 1.
>
> A delta: behaviour is in the spec and is not restated. **Preconditions:** (1) the records writer's PR (spec OA-3 r1, `spec/P0-02.md` r3, `spec/P0-03.md` r4, intent) is on `main`; this plan cites all three. (2) Session gabay-05 has finished per-copy emulator ports, so the build can run `npm run verify` in `Gabay-wt\api-coder`. A spec that moves past the cited revision stops the slice.

## 1. The key decision: how verify stays green when 0002 drops the tables the seed writes

**Facts (checked in `origin/main`).** `db/seeds/lib/demo.js` and `spike.js` insert into 8 of the 12 dropped tables, into `Venue.BoundaryGeoJson` and `MapUpDeg`, and key `Occupant` and `Beacon` by `UnitId` and `LevelId`. `lookups.js` writes `CostBaseM`. After 0002 the first `Venue` insert fails, so the `seed` and `seed-tests` checks and `setup-db`'s seed step go red. The converters (3b) and the document seed (3c) are what replace this, and 3c needs 3a. Since OA-2, no route in `functions/src` reads the twelve tables, so nothing a person can see depends on them.

| Option | What it costs | Verdict |
|---|---|---|
| **A. Land 3a, 3b and 3c as one merge** | 3a sits unmerged behind the largest piece (the converters). Red commits in between, a long-lived branch with a migration, and no "ends in something to see" for 3a. Against L174's speed aim | No |
| **B. 3a carries an interim seed (recommended)** | About 40 lines edited in `demo.js`, `spike.js`, `run.js` and `lookups.js`; 3c rewrites `demo.js` and `spike.js` anyway, so the shim is deleted there. No in-force test is suspended | **Yes** |
| **C. 3a's seed writes venues only** (no stores, no beacons) | Smallest edit, but P0-02 AC-1, AC-2 (the 1,709 stores) and AC-4 (MEZZ's beacons) lose their assertions until 3c: suspended tests in a merged state | No |

**B in detail.** After 3a, `npm run seed` writes: the platform lookups (`ConnectorType` already in seconds, final form), the two tenants, each venue as identity only (Code, Name), every store as an `Occupant` with an **interim** `UnitKey` (`U1`, `U2`, ... per venue, valid under `ELEMENT_KEY`), MEZZ's beacons with `LevelKey` `L1`, the six accounts and their grants. It writes **no** twelve-table row and **no** `VenueMap` row, so `GET /api/venues/:id/map` answers the empty shape and every seeded key reads `removed` through AC-11's loader. That is the stated interim state until 3c, written in a line of `db/seeds/README.md`. `run.js`'s `TENANT_TABLES` loses the twelve (final form). The tests it needs are the ones `spec/P0-02.md` r3 already withdraws (§5.2 of the spec: the `Level`, `Unit`, `NavConnector` counts, NeedsReview, georeference, building/level round trips); §4 lists each case. 3c's AC-19 and AC-24 take the counts back from the converters. **If you prefer A or C, say so before the contract commit.**

## 2. Scope, and what it is not

In: schema 0.16 and migration 0002 (AC-1 to AC-7); `ConnectorType` in seconds, the `routing.*` settings (AC-7); the `connector-types` lookup (AC-7a); the retired venue-boundary code and a scan (AC-8); the key check, the loader and the lock order (AC-9 to AC-12); the interim seed (§1); records (§7). Not in: converters, the caps (3b); document seed, `VenueMap` rows (3c); export, import, the store writer, `stores.newStoreStatusCode` (3d); any Dart (`LookupName` gets its `connector-types` line from OA-4's connector panel, P0-11 r3); roles, audit, zod (R2, R3, R5).

## 3. Criteria to tests (new files unless marked; the test-verifier writes them, failing first where they can)

| Criterion | Test | Notes |
|---|---|---|
| AC-1, AC-6 (catalog, pattern equality), EC-35 | `db/tools/test/schema016.test.js` [scratch] | 46 tables, none of the twelve, `Venue` has none of the three columns, every `CREATE` has its `DROP` (the lint also runs); each of the 12 key `CHECK`s read from the catalog equals the schema file's `ELEMENT_KEY` |
| AC-2 | `db/tools/test/setupDb.test.js` [scratch] | spawns `setup-db --skip-seed` with `PGDATABASE` set (real env vars win over `.env`, checked in `connect.js`): fresh, and left at 0.15; prints 46/105/2, no WARNING; `EXPECTED` becomes 46, 105, 2 |
| AC-3, AC-4 (1 to 5), AC-5, AC-7 (migration half), EC-1, EC-12, EC-21, EC-23 | `db/tools/test/migration0002.test.js` [scratch], on the frozen `fixtures/schema-0.15.sql` | the five states of AC-4; the stop with a `PUBLISHED` row, and `BUILDING`/`FAILED` rows proceeding; row text, no row moved, no `VenueVersion` or `StoredFile` written; the platform pair equals `lookups.js`'s (one source for the numbers) |
| AC-7 (settings) | `functions/test/settings.test.js` (changed) | `DEFAULTS` holds P0-03 r4 AC-120's `routing.*` keys; `routing.stairsSaveM` is gone |
| AC-7a | `functions/test/lookups.connectorTypes.test.js` | the spec's list: four platform rows, tenant row beside platform row, inactive in the single read only, other tenant 404, `X-Tenant-Id` 403, SUPERADMIN 400, `constructor` 404; `tenant-predicate`, `sql-interpolation` lints |
| AC-8 | `venues.test.js` (changed); `functions/test/retiredSchema.scan.test.js` | create writes no boundary; scan of `functions/src`, `db/tools/lib`, `db/tools/setup-db.js`, `db/seeds/lib` for the twelve tables, the three columns, `CostBaseM`/`CostPerRiseM`, `\bUnitId\b`/`\bLevelId\b`/`\bNavConnectorId\b` (case-sensitive, comments stripped); it must also fail on a planted example |
| AC-9, AC-10, EC-10, EC-24 | `functions/test/venueMaps.keycheck.test.js` | one case per row kind and per kind-pair (7 columns); deleted key and same-kind accepted; no rows never refused; another venue's and another tenant's `U1` ignored; inactive rows count; a key held as a wall while the published layout has a unit is refused; one request per pair of neighbouring steps (body, document, backdrop keys, key check, version) |
| AC-11 | `functions/test/keyIndexes.test.js` | the five states of the spec, no map row, unreadable published layout (409 text of OA-2 AC-31); a scan that only one module builds the indexes |
| AC-12, EC-17 | `venueLock.test.js` (changed); `venueMaps.concurrency.test.js` (changed) [scratch] | statement order: lock, then keyed-row reads, then the `VenueMap` read; two connections, 20 rounds: a row committed by a holder of the lock is seen, a held lock makes the save wait |
| EC-13, EC-15, EC-20, EC-36 | no new test | EC-13: `Waived: 3`, `Waived: 4`. EC-15 and EC-14 for the lookup are in the AC-7a file. EC-20: unchanged by this slice, OA-2's tests stay green. EC-36 is the seed's (3c); 3a writes its README line. EC-19: no test (spec) |

## 4. Existing tests that change or go (C1; each with its reason)

| File | Change | Reason |
|---|---|---|
| `db/tools/test/migration0001.test.js`, `scratchDb.js` | baseline is the frozen 0.15 fixture (`applySchema015`); `migrate` runs a temp folder holding 0001 only (`runMigrations(c, dir)` exists) | `schema.sql` becomes 0.16; 0001's own claim is 0.14 to 0.15 |
| `functions/test/venueApp.js`, `mapSchema.test.js`, `venueMaps.concurrency.test.js` | `Venue` inserts without `BoundaryGeoJson`, `MapUpDeg`; `sql.building` and `sql.level` removed | the columns and tables are gone |
| `venues.test.js` (AC-1/AC-43 boundary cases, the two "sent and ignored" cases) | assert the columns do not exist; the API still ignores a sent key | AC-8 |
| `venues.retired.test.js`, `venueMaps.clear.test.js` | "nothing else changed" snapshots read `Occupant`, `Beacon`, `StoreStatusChange` instead of `Building`, `Level`; the `ZERO_BOUNDARY` assertion becomes "file absent" | AC-8 |
| `venueBoundary.test.js` | deleted | its subject is deleted (AC-8) |
| `settings.test.js` | `routing.stairsSaveM` cases move to `routing.stairsSaveS` (default 120) | AC-7 |
| `venueLock.test.js` | adds the key-read order | AC-12 |
| `db/seeds/test/seed.content.test.js` | AC-2 keeps the 1,709 stores and venues, drops the `Level`/`Unit`/`NavConnector` entries; AC-9 and AC-24 removed; AC-3's `columns.length >= 8` becomes 7 (counted with the lint's parser on the 0.15 text minus the twelve: Tenant, Venue, Occupant x2, Sentinel, Holiday, MallEvent) | P0-02 r3 withdraws the three (spec §5.2); 3c's AC-19, AC-21, AC-31 re-cover |
| `seed.reruns.test.js`, `seed.sources.test.js` | hand-made `Building`/`Level` rows and counts go; `Venue` inserts lose the boundary; the "no rooms" case asserts the venue only; NeedsReview lines removed; the zero-count loop reads `Beacon`, `Occupant` | P0-02 r3 (AC-9, AC-18 withdrawn in part) |
| `db/seeds/test/helpers.js`, `functions/test/seed.visible.test.js`, `fieldCases.js`, `fieldInput.test.js`, the lint tests | **unchanged** (checked: `snapshot` reads `TENANT_TABLES`; `seed.visible` names the columns in a comment only; the field files are pure readers; the lint tests build their own schema text, and the real-schema case still passes) | the spec §5.1 rows for them are not needed in 3a |

## 5. Schema 0.16 and migration 0002 (the plan fixes this; the spec says what, not how)

**Contract commit first** (`db/tools/test/fixtures/schema-0.15.sql` is `origin/main`'s `schema.sql` byte for byte, committed before `schema.sql` changes).

**`db/migrations/0002_retire_geometry_rekey_keys.sql`**, in this order, each step guarded so it re-runs and works on a half state:
1. **The stop.** `DO` block: only where `gabay.Occupant.UnitId` exists (the 0.15 marker) and a `PUBLISHED` `VenueVersion` exists, `RAISE EXCEPTION 'Published versions exist; recreate this throwaway database with npm run setup-db (E-20)'`. Without the marker guard, a later database with published versions would be refused on every run.
2. **The drops:** the twelve `DROP TABLE IF EXISTS ... CASCADE`, children first (`NavCorrection`, `NavConnectorStop`, `NavConnector`, `Anchor`, `TransitPoint`, `Amenity`, `FloorObject`, `FloorUnderlay`, `Opening`, `Unit`, `Level`, `Building`). This also drops every foreign key to them.
3. **The re-keys, in place** (a `DO` loop over a `VALUES` list of the 12 columns, each only while it is still `integer`): `ALTER COLUMN ... TYPE VARCHAR(40) USING col::text`, then `RENAME COLUMN` (UnitId to UnitKey, LevelId to LevelKey, NavConnectorId to ConnectorKey, DestinationUnitId to DestinationUnitKey). Then, for the 7 NOT NULL columns, `RENAME CONSTRAINT <t>_<old>_not_null TO <t>_<new>_not_null`. Then the 12 named `CHECK`s on the schema file's `ELEMENT_KEY` text, by the 0001 name-guard pattern.
4. **Two indexes:** `IX_SSC_Unit` and `IX_ADU_Unit` replaced by the venue-leading definitions of AC-6, only while their definition lacks `venueid`.
5. **`Venue`:** `DROP COLUMN IF EXISTS` for the three columns (`CK_Venue_MapUpDeg` goes with its column).
6. **`ConnectorType`:** while `CostBaseM` exists: rename both columns to `CostBaseS`, `CostPerRiseS`, and set every row (platform and tenant) to its `CostModel`'s pair from `spec/P0-03.md` r4 AC-101 (the four literals are copied into 0002 as history; `LEVEL` gets 0, 0); add `CK_ConnectorType_CostBaseS` and `..._CostPerRiseS` (`>= 0`, P0-03 AC-101's request).
7. **`-- verify:`** one `SELECT`: table count, index count, the 12 key columns present, `costbases` present, none of the twelve tables.

**Why in place** (checked 2026-10-14 on PostgreSQL 18.6 in a scratch database, dropped): `ALTER TYPE ... USING` then `RENAME` keeps the column's position, and the primary key, partial index and `CK_Closure_Target` text follow the rename. Two things the 0001 fingerprint would otherwise trip on, both seen in that probe: **(1)** PostgreSQL 18 keeps NOT NULL as named constraints, and a renamed column keeps the old name (`a_unitid_not_null`) unless step 3 renames it; **(2)** dropped columns leave gaps in `ordinal_position`, so 0002's fingerprint ranks columns densely per table instead of using the raw number. Dropped and re-keyed column positions are otherwise unchanged, so `schema.sql` 0.16 simply renames in place (no "end of table" convention).

**Counts (AC-2).** 58 tables less 12 is 46. The 105 is 137 less 32: confirmed here by counting `PRIMARY KEY`, `UNIQUE` and `CREATE INDEX` per table in the 0.15 text (the 12 tables give 32; the whole file gives 137, equal to `setup-db`'s `EXPECTED`). Triggers stay 2. The build confirms it by `setup-db` on a fresh scratch database, on one left at 0.15, and by `verify`'s two schema runs; a different number stops the slice and gets a spec revision.

## 6. The key check, the loader, `connector-types`, settings

- **Order of refusals (H-6).** `mapDraft.service.save`: body, document, backdrop keys (`db`, before the lock), key check (`db`), then in the transaction `lockVenue`, backdrop keys, **key check (`tx`)**, then `readMapRow` and the version. The 400 therefore beats a 409. New `mapStorage/keyedRows.repository.js` (seven literal statements, each `WHERE TenantId = $1 AND VenueId = $2`, no interpolation: the `tenant-predicate` lint reads each) and `mapStorage/keyCheck.js` (compares with OA-1's `keyStatus`, draft index only, no published index: DC-5). A problem's path comes from a walk of the incoming draft, done only when a key is refused; it uses `MAX_PROBLEMS` through `mapProblems`.
- **Loader (H-7, AC-11).** `mapStorage/keyIndexes.js`: `loadKeyIndexes(q, tenantId, venueId, { draft, published = true })` returns `{ draftIndex, publishedIndex }` (published through `readMap`, never re-validated). The save passes `published: false`, so a save never reads a layout of up to 4 MiB and an unreadable published layout cannot refuse a save (DC-B below).
- **`connector-types`.** One more entry in `lookup.service.js` `LOOKUPS`, with its own literal SQL and `CostModel AS "costModel"`, `CostBaseS AS "costBaseS"`, `CostPerRiseS AS "costPerRiseS"`. The `DECIMAL(9,3)` values reach JavaScript as text, so the entry maps them with `Number()` as `mapContext.repository.js` does for metres (DC-27's "same representation"). The Dart `LookupName` enum is not touched.
- **Settings.** `DEFAULTS` replaces `routing.stairsSaveM` with the keys and values of P0-03 r4 AC-120 (see §9 gap 2 for which).
- **Venue.** `venue.service.js` stops writing the boundary; `venueBoundary.js` goes.

## 7. E-20 waivers, ledger, records

**Waived, in the slice report's words:** `Waived: 3 (guard order) — R1–R3` (the changed save route and the lookups sit behind `devStub`), `Waived: 4 (permission and menu rows) — R2` (no new route; `connector-types` is one more name on the existing two), `Waived: 9 (automated e2e) — R12`. Items 5 to 8, 11, 13: no screen (spec §7). Item 15's inactive case is in the AC-7a test.

**Ledger (`PH4` §7), main session writes on your go:** the two lookups rows gain "`connector-types` served read-only with the cost fields from OA-3a"; the `PUT .../map/draft` row's validation cell gains "key check by `keyCheck.js` (by hand; zod in R5)". No row opens or closes.

**Records (sync table, every row walked):** Blueprint Part 3 (table list 46, the twelve retired, the key columns, seconds) and Part 1 invariants 13 and 15 reworded; `db/SCHEMA_READING_GUIDE.md` (1.2); `INSTALL.md` lines 31 and 58, `README.md` line 74, `Smoke_Test_Guide.md` lines 9 to 13 (46, 105, 2; schema 0.16); `db/migrations/README.md` (0002 listed, "the first that drops"); `db/seeds/README.md` (the interim state, §1); `E2E_Test_Cases_Manual.md` rows OA3.1 (key check), OA3.2 (`connector-types`) and the FF0 lookups rows' note; the schema file header (0.16, counts); `tools/` and CLAUDE.md need no change (no command added, DC-24). Left to later slices: Part 4 route text (3d), `FEATURE_PIPELINE` P0-02 row (3c), changelog (none: no app surface).

## 8. Order (one PR, `oa3a-migration-rekey`; the model is OA-2's §13)

1. You approve this plan and answer Q1. The main session records it.
2. **api-coder (Opus 5.5, §9 DC-A):** step 0, pasted: the PostgreSQL `ALTER TABLE` page re-read for §5's RECALLED claims. Then the **contract commit**: frozen fixture, `schema.sql` 0.16, migration 0002, `setup-db`, `scratchDb.applySchema015`. A checkpoint, not behaviour; verify may be red on the seed here.
3. **test-verifier (Sonnet 5.5):** §3's tests and §4's changes, run and pasted. The migration tests can pass at once (the migration is in the contract); the key check, loader, lookup, settings and scan tests must fail first.
4. **api-coder:** §6, §1's interim seed, the retirements and §7's records, until green; then one full `npm run verify` with `GABAY_VERIFY_OWNER=api-coder`, Node 22, pasted, ending `ALL GREEN`; then OA-2's save measurement (`tools/measure-venue-map-save.js`, name from the file listing) re-run, pasted, with no target (the spec states none).
5. test-verifier fills the traceability results. 6. **dod-reviewer (Opus 5.5)** against r1 (AC-1 to AC-12, AC-7a), `REVIEW.md` and §5 of the pipeline, reading 0002 line by line. 7. Fast lane (L156): push, PR and merge once it says ready and lint and e2e are green. Your sign-off (touchpoint 2), with §9 listed.

## 9. Design choices (for sign-off, L174) and spec gaps

- **DC-A Model:** Opus 5.5 for api-coder (see Q1). *Alternative:* Sonnet 5.5 with the Opus review of step 6, better if you want the cheaper pass and accept that the migration is first read at review.
- **DC-B The save builds only the draft index** (`published: false`). *Alternative:* load both on every save: one rule, one code path, but a parse of the published layout per autosave and a possible 409 on a save.
- **DC-C The key check runs before the lock (`db`) and again under it (`tx`),** as OA-2 does for backdrop keys (AC-12 says "repeats"). *Alternative:* under the lock only: seven fewer reads per save, same safety, but the refusal happens after the lock is taken.
- **DC-D Seven literal statements** for the keyed rows. *Alternative:* one `UNION ALL`: one round trip, but the `tenant-predicate` lint then accepts a branch with no tenant binding.
- **DC-E In-place re-key** (§5). *Alternative:* add the new column, copy, drop the old: no type rewrite, but the column moves to the table's end and every index and `CHECK` is redefined.
- **DC-F A `LEVEL`-model `ConnectorType` row converts to 0, 0** (no pair exists for it). *Alternative:* refuse 0002 on such a row; none exists in any seeded database.
- **DC-G The interim keys are `U<n>` and `L1`** (§1). *Alternative:* the source's own ids, which 3b's DC-8 has not fixed yet.
- **DC-H `setup-db` prints its counts after the migrations step** in dev mode. The spec's AC-2 (no WARNING on a database left at 0.15) and AC-4.4 (0.16's `schema.sql` does not know the twelve tables) cannot both hold if the counts are read straight after the schema step: that database still holds 58 tables at that moment. *Alternative:* `schema.sql` 0.16 carries `DROP TABLE IF EXISTS` lines for the twelve retired tables: no `setup-db` change, but AC-4.4's half state then cannot occur.

**Spec gaps found while planning (the main session settles them before the contract commit; none is a product question):**
1. **`CHECK (... >= 0)` on the two cost columns:** `spec/P0-03.md` r4 AC-101 asks OA-3's 0002 for it; `spec/OA-3.md` AC-7 does not say so. The plan includes it (§5 step 6). Needs an OA-3 r2 line.
2. **Settings and rows:** AC-7 asks for "every seconds-routing setting", while `spec/P0-03.md` AC-120 says the whole table is OA-3's and that its five `routing.*` keys are also seeded as platform `GlobalSetting` rows (`TenantId` NULL) for P0-06's test; no OA-3 criterion seeds them. **Recommended:** 3a puts the five `routing.*` keys in `DEFAULTS` (stairsSaveS 120, walkSpeedMps 1.2, storeCrossingFactor 1.25, otherWayMarginS 0.417, stepFreeMinWidthM 1.2) and `seedPlatform` writes their five rows (it is edited in 3a anyway; `ensure`-style, so a re-run adds none); the `publish.*` keys stay with FF-3′. Needs an OA-3 r2 line.
3. **AC-2 and AC-4.4 clash** (DC-H).
4. **Spec §5.1** lists the lint tests and `fieldCases`/`fieldInput` as changing; they do not (§4).

## 10. Risks

- **0002 is the repository's second migration and its first to drop.** Mitigation: guarded steps, the five states of AC-4 on scratch databases, a fingerprint control that proves the comparison sees a renamed constraint, and Opus on the build and the review. It never runs against `gabay_dev` outside `setup-db`/`migrate`; a failure rolls back (one transaction, 0001's runner).
- **The seed shim is thrown away in 3c.** About 40 lines, listed in §1; the risk is that 3c's rewrite meets a different shape. Mitigation: 3c's plan reads this section.
- **FF-1's trimmed client is not yet on `main`.** `plan/FF-1-client-trim.md` removes the `MapUpDeg` field; if the trim lands after 0002, no `FieldSpec` names a dropped column (checked: `main` has none). No ordering constraint.
- **RECALLED:** the `ALTER TABLE` documentation text behind §5 (the behaviour itself is probed); that `ALTER ... TYPE ... USING` rebuilds the primary key of `AnalyticsDailyUnit` (probed on a model table, to be proved by the AC-4 fingerprint on the real one).

## Suggestions (not in scope)

1. `schema-drops.test.js` titles "56 tables, 56 drops" (already stale at 58); compute the count (spec suggestion, 3 lines).
2. A partial unique index "one active store per unit" (spec DC-4) belongs to 3d's decision.

## Questions for the owner

**Q1 [main session] Which model builds 3a?** **Answered 2026-10-14 by the product owner (L179): Opus 5.5.** The migration drops twelve tables and re-keys twelve columns, and the key check runs under a lock. WORKING_AGREEMENT §8 asks you before any move to Opus.
- **(a) Recommended: Opus 5.5 for api-coder,** as for OA-2 (L174: high-risk code). dod-reviewer is Opus either way.
- (b) Sonnet 5.5 for api-coder, Opus review only: cheaper, and the migration is first read hard at review.
