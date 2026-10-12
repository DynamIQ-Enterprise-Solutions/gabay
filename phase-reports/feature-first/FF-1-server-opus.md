# FF-1 (server half, Opus build) — venues, buildings and levels: slice report

> **Plan**: `plan/FF-1-venue-setup.md` 1.0 (APPROVED, L156), §2, §2.3, §2.4, §2.5 (with test-verifier's correction: `functions/test/savepointDb.js` checks out the pool's single client), §6, §8 | **Spec**: `spec/P0-01.md` r2 | **Parent**: `plan/PH4-feature-first.md` 1.0 (E-20, L153) | **Built by**: api-coder on Opus 5.5, the L117 coder-model trial (L159, B13), in `Gabay-wt\api-coder`, branch `ff1-server-opus` from `ff1-server-tests` (9e7e859) | **Reviewed by**: dod-reviewer (0 Critical, 1 Important, 6 Nits, all fixed in §9); the owner chose this build | **Client half**: flutter-coder, separate

## 1. What was built

Sixteen routes behind the E-20 development stub, in three route files and three services (DC-2). Each is a row of the retrofit ledger.

| File | Responsibility |
|---|---|
| `functions/src/routes/venues.js` | `GET`/`POST /api/venues`, `GET`/`PUT /api/venues/:venueId`, and the nested `buildings` and `outdoor-levels` collections. No venue delete route (B4) |
| `functions/src/routes/buildings.js` | `GET`/`PUT`/`DELETE /api/buildings/:buildingId`, and the nested `levels` collection |
| `functions/src/routes/levels.js` | `GET`/`PUT`/`DELETE /api/levels/:levelId` |
| `functions/src/services/venue.service.js` | venue list (search Code and Name, sort Name), read, create (zero boundary), edit (B5) |
| `functions/src/services/building.service.js` | building list (type label joined), read, create, edit, delete when it has no levels; the building-type rule (AC-6, AC-9, AC-10) |
| `functions/src/services/level.service.js` | both level lists (`Ordinal` highest first), read, indoor and outdoor create, edit, delete; distinct ordinals (AC-35) and one outdoor ground level (AC-12) under the venue lock; the boundary refresh after each write |
| `functions/src/services/venueLock.js` | `lockVenue(tx, tenantId, venueId)`: `SELECT … FOR NO KEY UPDATE`, 404 when the tenant has no such venue |
| `functions/src/services/venueBoundary.js` | `ZERO_BOUNDARY`, `refreshBoundary(tx, tenantId, venueId)`: the plan's §2.4 statement |
| `functions/src/utils/fieldInput.js` | the seven readers of §2.3, plus `readBody` and the audit-stamp helpers (`refuseStampsOnCreate`, `refuseStampsOnEdit`) built on `refuseIfDifferent` |
| `functions/src/utils/idParam.js` | `parseIdParam`: `^[1-9]\d{0,8}$`, else 404 before any query; `lookup.service.js` now uses it |
| `functions/src/utils/foreignKeyInUse.js` | `FK_NOUNS` (the 17 FKs into `Level` and `Building` in `schema.sql`) and `foreignKeyInUse(err)` with the fallback "other records" |
| `functions/src/routes/api.js`, `functions/src/app.js` | three mounts in the "admin features (E-20)" group, per path behind `devStub`; the three services built from `db` |
| `functions/src/utils/requestContext.js` | `assertTenantId`, moved from `lookup.service.js` on its second use (C2) |

Rule 2: every statement binds `TenantId = $1` from `req.tenantCompanyID`; lookups read `(TenantId = $1 OR TenantId IS NULL)`. Rule 3: every request value is a bound parameter; no `// sql-identifiers:` or `// tenant-scope:` annotation was added. Money: none here; the decimals are exact strings, compared with `Decimal` from `utils/money.js`. Never written: `VenueVersion`, `Unit`, any lookup row.

## 2. Evidence

**The API tests** (test-verifier's, written first on `ff1-server-tests`; not one changed). `npm --prefix functions test` on this branch:

```
1..327
# tests 327
# suites 0
# pass 327
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

The FF-1 files alone (13 files: `venues`, `buildings`, `buildings.deleteRace`, `buildings.inactiveType`, `levels`, `venues.tenantBoundary`, `venueBoundary`, `venues.schemaMirror`, `foreignKeyInUse`, `savepointDb`, `idParam`, `fieldInput`, `venueLock`): `# tests 133  # pass 133  # fail 0`. The brief said 308; the suite has 327 (the count was 327 before the merge of `main` too), so 308 looks like a miscount; no test is skipped.

**`npm run lint:structural`:** 10 linters, 0 violations (`sql-interpolation` 35 files, `tenant-predicate` 36 files), no suppression added. `npm run api:lint`: ESLint clean, Prettier clean.

**`npm run verify`** (in `Gabay-wt\api-coder`, `GABAY_VERIFY_OWNER=api-coder-opus`), the first and only full run, exit code 0:

```
> verify
> node tools/verify.js

ok   node-version         (0.0 s)
ok   node-check           (2.8 s)
ok   structural-linters   (0.6 s)
ok   linter-tests         (3.0 s)
ok   tools-tests          (105.7 s)
ok   eslint               (11.1 s)
ok   prettier             (2.3 s)
ok   schema-run-1         (2.7 s)
ok   schema-run-2         (1.3 s)
ok   api-tests            (28.8 s)
ok   db-tools-tests       (0.8 s)
ok   seed                 (67.0 s)
ok   functions-health     (32.2 s)
ok   flutter-analyze      (49.0 s)
ok   flutter-test         (26.2 s)

ALL GREEN   (344.8 s)
```

**The lock mode on the local database** (DC-7; the plan says the lock is proved by review and a local check, not a timing test). Two sessions, `lock_timeout` 500 ms, every row removed afterwards:

```
holder FOR NO KEY UPDATE -> an insert under the venue: ran
holder FOR NO KEY UPDATE -> a second FOR NO KEY UPDATE: blocked (55P03)
holder FOR UPDATE        -> an insert under the venue: blocked (55P03)
```

**Mutation checks** (each reverted; `git status` clean afterwards):

| Mutation | Result |
|---|---|
| level delete without `lockVenue` | `venueLock.test.js`: pass 1, fail 1 |
| indoor create without the duplicate-ordinal check | `levels.test.js`: pass 32, fail 2 |
| an unchanged inactive type refused too (`typeId !== currentTypeId` dropped) | `buildings.inactiveType.test.js`: pass 0, fail 7 |
| level delete without the boundary refresh | `levels.test.js`: pass 33, fail 1 |

## 3. Tests added or changed

None by this build: the trial's rule forbids editing anything under `functions/test/`, and nothing needed it. The 13 files above are test-verifier's (commit 9e7e859); every AC and edge case they cover is in plan §4's table. Existing tests: none changed. `lookups.test.js` passes unchanged after `lookup.service.js` moved to `parseIdParam` (see §8).

## 4. DESIGN CHOICES (each with an alternative)

1. **Audit stamps on an edit:** `createdAt` and `createdBy` must equal the stored ones; `updatedBy` is compared only when the edit's `updatedAt` is the stored one, because with a stale token the record has moved on and the conditional `UPDATE` answers 409, which is the more useful answer than a 400. On a create, all four stamps and `id` may only be absent or null (the route implies none yet). *Alternative:* ignore the stamps entirely (they are server-set); or compare all of them always, which turns a stale echo into a 400.
2. **`isActive` is required on create and edit** (a JSON boolean, as §2.3 says), with no server default. *Alternative:* default it to the column's `TRUE` when absent on a create; the form always sends it (AC-1 "on by default" is the form's).
3. **A missing optional decimal key is blank on a create** (the column default or NULL); a missing required one (`widthM`, `depthM`) is 400. **Superseded for edits by the owner's ruling L164** (§9): a `PUT` must send every field, and a missing key is 400 "<Field> is missing". *Alternative (the one L164 took for edits):* refuse a missing key on `PUT`, since §2.3 says the edit body has every field.
4. **Writes answer by re-reading the record** with the one `SELECT` per kind, inside the transaction, so a building's answer carries the joined type label and the venue's angle. *Alternative:* `RETURNING` the columns, with a second query for the building's join.
5. **The zero-row `UPDATE` shape per kind.** Venue: read first (404, stamps), and since a venue is never deleted, no row back is 409. Building: the plan's `FOR NO KEY UPDATE` read locks the row, so no row back is 409. Level: the plan's `SELECT 1` decides 409 or 404 (a level can be deleted between its first read and the lock). *Alternative:* the `SELECT 1` existence check after every zero-row update, uniformly.
6. **A level edit validates its body after reading the level,** because the ordinal rule depends on whether it is the outdoor level; so a bad body on a missing level is 404. *Alternative:* validate everything but the ordinal first, then read.
7. **The outdoor check runs on the outdoor create only, the ordinal check on indoor writes only:** an edit cannot change `IsOutdoor` or `BuildingId`, and the plan's ordinal query binds `BuildingId = $3`, which never matches the outdoor level's NULL. *Alternative:* run both queries on every level write, as the plan's numbered list reads.
8. **`lockVenue` throws 404 when the tenant has no such venue,** which is the outdoor create's parent check (one statement instead of two). *Alternative:* a parent read, then the lock.
9. **A decimal is bound as the client's validated text,** and PostgreSQL scales it; with at most `scale` places nothing is rounded. *Alternative:* `Decimal#toFixed(scale)` in JS before binding.
10. **The `updatedAt` token is parsed part by part** (corrected after review, §9): ISO 8601 with `Z` or an offset; every part range-checked; the calendar date round-tripped against the input, so 30 February is refused instead of rolling over into March; the offset at most 15:59 either way; the instant within the years 0001 to 9999. The server then binds its own ISO text of the instant. So an impossible date is a 400, never a 409 from a rollover and never a 500 from the cast. (The first version said this but only checked a pattern and `Date.parse`, which rolls 2026-02-30 over to 2 March.) *Alternative:* bind the client's text and map PostgreSQL's cast error to 400; that still lets a rollover through wherever PostgreSQL itself accepts the text.
11. **The route handlers are `async` with no `try/catch`:** Express 5 passes a rejected promise to the error handler (checked in `functions/node_modules/router` 2.2.0, `lib/layer.js` lines 119–124). *Alternative:* `try/catch` with `next(err)` in each handler, as `routes/lookups.js` does.
12. **`assertTenantId` moved to `utils/requestContext.js`** (second use, C2), and `lookup.service.js` uses it and `parseIdParam`. *Alternative:* a private copy in each service.
13. **Field labels in messages** ("Map up angle", "Elevation", "Width", "Depth", "Grid cell size", "Ceiling height", "Ordinal", "Short name", "Spoken name", "Building type", "Active"): the form's ARB labels are not written yet, so flutter-coder should use these or the messages should follow theirs. *Alternative:* wait for the client's labels.
14. **The FK nouns** for constraints the plan does not name: openings, floor plan underlays, floor objects, amenities, transit points, anchors, connectors (both `fk_navconnector_from` and `_to`), connector stops, walkway corrections, beacon plans, beacons, sentinels, closures, analytics totals. *Alternative:* the table names as plain words.
15. **The branch merges `main` (56dadc8) before the records are written,** so the ledger, the Blueprint and the manual are edited against their current versions (main had moved: Blueprint 0.29, the PH4 ledger's FF-0 client row, PR #18). *Alternative:* write the records on the 9e7e859 base and resolve the conflicts at PR time.

## 5. Waivers and the definition of done (FEATURE_PIPELINE §5), the server half

- `Waived: 3 (guard order) — the dev stub stands in; R3 adds the audit rows; fitted in R1–R3 and checked by the route-guard-order lint, R7`
- `Waived: 4 (permission and menu rows) — R2`
- `Waived: 9 (automated e2e), the feature's API and frontend manual cases written now — R12`

| # | Status (server half) |
|---|---|
| 1 | N/A: no column, CHECK or index added (B1, B4, B6, B7); `db/schema.sql` untouched |
| 2 | N/A: the seeds already write these tables; FF-2 finishes them |
| 3 | Waived (above); the 16 ledger rows written |
| 4 | Waived (above) |
| 5, 7, 8, 13 | The client half's (flutter-coder) |
| 6 | N/A: nobody is notified |
| 9 | Waived (above); the API manual cases FF1.1 to FF1.30 written |
| 10 | API manual: FF1.1 to FF1.30. The frontend manual and the smoke guide are the client half's |
| 11 | The client half's (the admin changelog entry) |
| 12 | Walked below |
| 14 | N/A: no new enumerable set (`BuildingType` exists; its screen is R11) |
| 15 | Server side met: `buildings.inactiveType.test.js` (7 tests, all pass) runs §5's steps 1 to 8 through `createApp`; the widget half and the manual FF1.16 (API) are written, the frontend manual case is the client half's |
| G1 | Plan §4's table; test-verifier adds the results |
| G2, G3 | N/A for the server half |
| G4 | Blueprint 4.6 "as built" (0.30). The PRD notes for B2 and B8, and the invariant 10 note, are left to the main session (§10, Suggestions) |

**The sync table, row by row:**

| When this changes | Done |
|---|---|
| `db/schema.sql` | Not changed |
| An API route | Tests: test-verifier's 13 files, all pass. E2E: waived to R12. Permission and menu seed: waived to R2. Blueprint 0.30, Part 4 anchor 4.6 "as built"; Part 1's API conventions did not move. `E2E_Test_Cases_Manual.md`: FF1.1 to FF1.30 |
| A screen or its wording | N/A for this half |
| A dependency | None added (`decimal.js` was already pinned) |
| A setting, limit or option list | None new. The defaults and ranges are service constants mirroring `schema.sql` (DC-8, `venues.schemaMirror.test.js`); building types stay in their table (rule 5) |
| A command or check | None |
| An owner ruling | None made here; the trial's result goes in a `plan.html` row by the main session (plan §6) |
| A pipeline entry's state | `FEATURE_PIPELINE.md` P0-01 is already `IN PROGRESS`; unchanged until sign-off |
| A deploy or an incident | None (E-20) |

The retrofit ledger (`plan/PH4-feature-first.md` §7) has 16 new rows, one per route: stub, guard order open, no permission or menu row, audit "open (R3)" for each write and "n/a (read-only)" for each GET, validation open (hand-written; zod in R5), e2e none with the manual case numbers; each write row says "Any role may write until R2; the client hides writes (AC-36)".

## 6. The contract for the client half

As plan §2.3, unchanged. The refusal messages a form will show are in `E2E_Test_Cases_Manual.md` FF1.5, FF1.8, FF1.9, FF1.15 to FF1.17, FF1.19, FF1.21, FF1.23, FF1.24, FF1.26 and FF1.27; each starts with the field's label (DESIGN CHOICE 13).

## 7. Trial measures (L117, B13)

| Measure | This build |
|---|---|
| Wall-clock, start to ALL GREEN | 16:36:52 to 17:00:05 (+08:00): 23 min 13 s, with the records written in between; the report followed |
| Full `npm run verify` runs | 1. The first run was green (exit 0) |
| API suite runs before verify | 1 full run, green first time (327 of 327); no code fix was needed after it |
| Commits | 3: `6f04cee` (the code), `56dadc8` (the merge of `main`, DESIGN CHOICE 15), and the records commit |
| Questions asked | None |
| Tokens and cost | Read by the main session |

## 8. Notes for review

- **`parseIdParam` in the lookups is a small behaviour change** the plan calls none: an id with a leading zero (`/api/lookups/building-types/07`) was 200 for row 7 and is now 404. `0`, signs, decimals and long ids were 404 before and still are; `lookups.test.js` passes unchanged.
- **The audit-stamp rule** (DESIGN CHOICE 1) goes slightly beyond what the tests pin: the tests echo whole records, which this accepts, and never send a differing stamp.
- **Scratch files:** this build wrote its own lock-check script and its verify output to the session scratchpad and read only those; nothing else there was opened.

## 9. Review fixes (dod-reviewer: 0 Critical, 1 Important, 6 Nits; the owner's ruling L164)

The owner chose this build. After the trial new tests may be added; none of test-verifier's tests was edited, and no ruling below needed one changed.

| Finding | Fix | Regression test |
|---|---|---|
| **Important: a NUL is a 500.** PostgreSQL text cannot hold U+0000, so a NUL in any text field, or in `?search=` on every list route (FF-0's lookups included), reached the driver | New `functions/src/utils/text.js` (`hasControlCharacter`). Refused: the C0 control characters U+0000 to U+001F and DEL (U+007F). Every text a client sends is a one-line code, name or search, so none needs one; leading and trailing tabs and line breaks are still trimmed away first. `fieldInput` gives 400 "<Field> contains a character that cannot be stored"; `parsePaging` gives 400 "Search contains a character that cannot be searched for" | `functions/test/controlCharacters.test.js`: the helper, `parsePaging`, every FF-1 text field on create and edit (6 fields × 9 values, nothing written), the outdoor level, and a search with `%00`, `a%00b`, `%01`, `a%7F` on the venue, building and level lists and the three lookups |
| **L164: an edit sends every field.** A `PUT` without `mapUpDeg` used to reset 45.00 to 0 | `fieldInput.refuseMissing`. Each service's `readFields(body, { edit })` refuses a missing key on `PUT` with 400 "<Field> is missing"; the outdoor ground level's body has no ordinal. `null` and `""` keep their create meaning. A `POST` keeps the plan's create rules. The missing token's message is now "Updated at is missing" | `functions/test/edits.missingFields.test.js`: each field of each kind missing on `PUT` (record unchanged); the 45.00 case; null still the default; the `POST` rules |
| **Impossible `updatedAt` dates** rolled over (409) or could reach the cast (500) | `parseInstant` in `fieldInput.js` (DESIGN CHOICE 10, corrected) | `functions/test/updatedAtDates.test.js`: 21 impossible texts refused, 10 real ones accepted and normalised, and through all three `PUT` routes (400, nothing written; the same instant in `+08:00` is 200) |
| Nit: missing building type said "must be a whole number" | `readInteger` says "<Field> is required" for a missing or null value | `edits.missingFields.test.js` (the `POST` case) |
| Nit: Blueprint cited L156 | Lines 5 and 643 cite L159. The Decisions line now follows `plan.html` 0.93 (L1–L163). 4.6 and 4.15 record the fixes | — |
| Nit: the lookups' leading-zero change was unrecorded | API manual FF0.13 and §8 above | — |
| Nit: the manual lacked the building Name and angle refusals | API manual FF1.15 and FF1.17. New cases FF1.31 to FF1.34 cover the fixes; the ledger rows cite them | — |
| Nit: no Suggestions section | §10 below | — |

All 14 new tests fail on the source before the fixes (`git stash` of `functions/src`, then run): `# tests 14  # pass 2  # fail 12`. The two that passed are the helper's own test (its file was new, so the stash left it in place) and the accepted-dates test, which the old code also passed.

**After the fixes:** `npm --prefix functions test`: `# tests 341  # pass 341  # fail 0  # skipped 0` (327 + the 14 new). `lint:structural`: 10 linters, 0 violations, no suppression. `api:lint`: ESLint and Prettier clean. `npm run verify` (`GABAY_VERIFY_OWNER=api-coder`), exit code 0:

```
ok   node-version         (0.0 s)
ok   node-check           (4.6 s)
ok   structural-linters   (0.8 s)
ok   linter-tests         (4.2 s)
ok   tools-tests          (101.8 s)
ok   eslint               (17.4 s)
ok   prettier             (4.5 s)
ok   schema-run-1         (8.1 s)
ok   schema-run-2         (5.6 s)
ok   api-tests            (55.3 s)
ok   db-tools-tests       (1.5 s)
ok   seed                 (64.0 s)
ok   functions-health     (28.4 s)
ok   flutter-analyze      (47.9 s)
ok   flutter-test         (27.6 s)

ALL GREEN   (380.6 s)
```

## 10. Suggestions (hand-offs for the main session)

- **PRD G4 notes for B2 and B8** (plan §6, "Product documents"): B2, the boundary as a derived rectangle until FF-10 draws one; B8, nested interiors in FF-10.
- **Blueprint Part 1, invariant 10** (plan §6): a note that a venue's boundary is a placeholder rectangle until the editor draws it, and that FF-3's publish must refuse a zero-size one.
- **dod-reviewer:** check that every level write and both deletes call `lockVenue` (plan risk 2). `venueLock.test.js` covers the five paths.
