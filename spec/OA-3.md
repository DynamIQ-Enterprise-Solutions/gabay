Spec OA-3. Revision: r1 (2026-10-14). Intent: intent/OA-3-seeds-as-documents.md

# OA-3: The seeds as venue map documents, the re-keying, and export and import

> **Pipeline entry:** P0-02 (seeds as documents), carrying the work OA-2 handed over · **Slice:** OA-3 (`plan/PH4-feature-first.md` 1.1 §4; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 3) · **Coder:** api-coder, the model named in the plan under L174's routing (the re-plan §3.5 says Sonnet 5.5; migration 0002 and the import transaction are the high-risk parts, and OA-2 §12 Q10 said the plan may give that step to Opus 5.5) · **Status:** r1, APPROVED by Genesis Perez, product owner, on 2026-10-14 in the spec sitting (six questions ruled, all (a); L178), together with its intent (L156, L174). The product owner ruled the three questions of §12 on 2026-10-14, all option (a): O3 (5 m), O7 (the four mall object types) and the one sizing rule for every measured cap. The rulings are written into r1 itself, because no plan cites r1 yet. No question is open.
>
> **Record numbers** (as the coordinator gave them): L173 is OA-2's records; L174 the delivery-speed rulings (model routing, two owner touchpoints per slice, technical choices decided by the main session and listed at sign-off); L175 the admin-first order (2026-10-14, the owner); **L176 the owner's Q18 ruling for this slice (2026-10-14): the main building is the first entry of the document's `buildings` array** (AC-21a). The coordinator's first brief also gave L176 to FF-4's early stage; the second brief gave it to Q18, and this spec follows the second. The intent's header and closing note still say "L174, renumbered from L173" for OA-2's records; that is stale against this list and is left for its owner to correct.
>
> **What r1 does.**
> - It carries OA-2 §5, "Handed to OA-3", H-1 to H-10, as acceptance criteria with OA-3's own numbers (the map is in §1).
> - It specifies the converters: stores become non-walkable rooms with walls and doors, and the ruled Demo Malls fix (door channels, pin snapping, the ADD_PATH backup, two-way escalators kept two-way, a converter report).
> - It applies the owner's rulings of 2026-10-14 on O3 (the snapping maximum, 5 m) and O7 (the mall object types) (§6, §12).
> - It measures the mall size caps (Q15).
> - It proposes four build sub-slices (DC-1), because the whole would run to about 50 criteria (AC-1 to AC-47, AC-7a, AC-21a and AC-41a).
> - It is the spec that `spec/P0-02.md` r3 points to: r3 withdraws, and does not delete, every seed criterion this spec supersedes (§5.2).
>
> **Sources read for r1:**
> - the intent;
> - `spec/OA-2.md` r1 (the version in the `api-coder` working copy, branch `oa2-map-storage`, unmerged): §1 to §2, §5 (H-1 to H-10), §9 (DC-1, DC-16, DC-20), §12 (Q1 to Q10 as ruled), and its criteria AC-5, AC-8, AC-15 to AC-18, AC-26 to AC-35, AC-42, AC-43;
> - OA-2 as built, read only: `plan/OA-2-map-storage.md` 1.0 (by reference), `phase-reports/feature-first/OA-2.md`, `db/schema.sql` 0.15, `db/migrations/0001_venue_map_storage.sql` and its README, `functions/src/routes/venueMaps.js`, `services/mapStorage/mapDraft.service.js`, `services/venueMap/{keyStatus,exportFile}.js`, `config/venue-map-schema.json`, `db/tools/setup-db.js` (its `EXPECTED` counts), and `functions/test/seed.visible.test.js`;
> - `spec/OA-1.md` r1 (§2 the document, AC-4 to AC-8, AC-24, AC-30 to AC-32, AC-35, AC-41 to AC-47, EC-9, EC-14, DC-8, DC-9, DC-25, DC-28, §6);
> - `spec/P0-02.md` r2 (the whole file) and `spec/P0-01.md` r4 (uncommitted, read only: the precedent for withdrawing criteria);
> - `plan/OFFICE-ADOPTION-replan.md` 1.0: §1, §1.2, §2 (Q1 to Q16 as ruled), §3.2 row 3, §3.4, §7 (O3, O7, N6); `plan/OFFICE-SPEC-adoption.md` 0.1 §4.1 (the ruled Demo Malls fix, with A1's measurements), O3 and O7 (superseded as a plan, read for its inputs);
> - `plan/PH4-feature-first.md` 1.1 §4, §5, §7;
> - `db/seeds/lib/{run,demo,spike,exports,geo,lookups}.js`, `db/seeds/seed.js`, `db/seeds/test/*.js` and `helpers.js`, and `db/seeds/sources/demo/spire.json`;
> - `phase-reports/feature-first/Spike-2.md` (for scale only);
> - `OFFICE_MAP_DESIGNER_SPEC.md` ("office §n"; kept out of git, cited by section, never copied): §8.7, §10.4, §11;
> - the `gabay-product-rulings` skill (L119, L123, L170, L171), CLAUDE.md, the standard's checklist line on migrations, FEATURE_PIPELINE §5, PRD §7.
>
> **Not readable by me:** `phase-reports/feature-first/FF-3-A1.md` (it exists only on the unmerged branch `ff3-engine-a1`, and I have no git access). A1's findings on the Demo Malls are used as the re-plan and `plan/OFFICE-SPEC-adoption.md` §4.1 quote them: Aurora has 64 connector ends off the walkways, 359 unreachable places and 16 orphans; 336 of its 340 store and entrance doors sit 1 m from the corridor; in all four malls the stair and lift pins sit off walkable floor (Bayview: 50 of 93 more than 5 m away); Skyline Spire's "Stairs north" sits on no walkable unit. I could not run the converter either, so no pin-distance histogram is available to me (§6, Q1).

## 1. What this delivers, in four sub-slices

OA-3 turns the seeds into venue map documents and finishes what OA-2 left for it. DESIGN CHOICE DC-1 proposes four sub-slices, each ending in something to see or run:

| Sub-slice | Delivers | Ends in | Criteria | Needs |
|---|---|---|---|---|
| **OA-3a** | Migration 0002 and schema 0.16: the twelve tables and `Venue`'s spatial columns dropped, element keys in place of element ids, costs in seconds; the key check on draft saves; the key-status loader | `npm run setup-db` prints 46 tables, 105 indexes, 2 triggers; a save that re-uses a held key as another kind of element answers 400 | AC-1 to AC-12 (with AC-7a, the `connector-types` lookup) | OA-2 merged |
| **OA-3b** | The converters (a pure library): stores as rooms, the Demo Malls fix, the report, the measured caps | The converter runs on the five committed sources and prints its report; every converted document validates under the new caps | AC-13 to AC-23 (with AC-21a) | OA-1; none of 3a, so it can be built beside 3a |
| **OA-3c** | The seeds as documents: the seed writes documents and the people rows; the seed's tests rewritten | `npm run seed`, then `GET /api/venues/:venueId/map` returns each seeded venue's draft | AC-24 to AC-32 | 3a and 3b |
| **OA-3d** | Export and import, with the stores | A file is written by `GET …/map/export` and read back by `POST …/map/import` | AC-33 to AC-47 (with AC-41a, the one store writer) | 3a and 3c |

Under L175 the editor's client (OA-4) is built beside OA-3 on OA-2's contract, and FF-3′ needs 3a to 3c (documents to read) but not 3d. So 3d can land after FF-3′ starts; OA-4's export and import buttons need 3d's contract (§3.4).

**How the H-items of OA-2 §5 land here**

| H-item | Where |
|---|---|
| H-1 the drop | AC-1, AC-2, AC-8 |
| H-2 the re-keying | AC-6 |
| H-3 existing rows in 0002 | AC-4, AC-5 (DC-2) |
| H-4 costs in seconds (and the seconds settings of P0-03 r4) | AC-7, AC-7a, AC-28 |
| H-5 the seeds as documents | AC-24 to AC-29 |
| H-6 the key check on save | AC-9, AC-10, AC-12 |
| H-7 the key-status loader | AC-11 |
| H-8 export | AC-33 to AC-36 |
| H-9 import | AC-37 to AC-46, AC-41a |
| H-10 records | §7, item 12 |

**Rulings in force** (not re-asked): L119 (the test venues, local only; the penthouse internal, L48, L123); L170 and L171 (Q1, Q3, Q4, Q11 (b), Q15, N6; E-20 rule 3 as amended: throwaway test maps, with their stores, may be exported from and imported to this machine, never committed); L176 (Q18: the main building first, AC-21a); OA-2's rulings (Q1 (b), Q4 (a), Q6 (a), Q7 (a), Q8 (a), Q10 (a)). The migrations README's "additive history" and the standard's "additive history, never edited after the fact" mean the history of files is additive; a new migration may drop (rule 4 asks for a new migration and `schema.sql`, every `CREATE TABLE` with its `DROP TABLE`).

## 2. Terms

- **"The tenant"** is `req.tenantCompanyID` and nothing else (rule 2). **"The venue"** is the `:venueId` in the path, read through `parseIdParam`. **"Refused"** is an HTTP 4xx in the standard shape `{ error }`, or `{ error, problems, total }` from OA-1's `mapProblemBody`, with nothing written. **"The validator"** is OA-1's `validateMap`; **"the context"** is what OA-2's `loadMapContext` reads for the tenant.
- **"A key"** is an element id of the document used by a relational row (OA-1 AC-41). **"The snapping maximum"** is the one named constant of §6.1 (O3), ruled 5 m on 2026-10-14.
- **"The five committed sources"** are `db/seeds/sources/demo/{aurora,bayview,meridian,spire}.json` and `spike/mezz.json`. The penthouse (`internal/`) and the owner's exports (`spike-exports/`) are never in git or in CI; tests use the five and invented fixtures.

## 3. Acceptance criteria

### 3.1 OA-3a: migration 0002, the re-keying, the key check

- AC-1: `db/schema.sql` is 0.16:
  - its header records this change and the count of 46 tables;
  - none of the twelve tables of OA-2 §5 H-1 is created;
  - `Venue` has no `BoundaryGeoJson`, `GeoreferenceJson` or `MapUpDeg`, and no `CK_Venue_MapUpDeg`;
  - the re-keyed tables are as AC-6 says and `ConnectorType` as AC-7;
  - each remaining `CREATE TABLE` has its `DROP TABLE`, in reverse dependency order;
  - it runs twice on PostgreSQL 18.6, and both runs exit 0.

  Verify: integration (`npm run verify`'s schema-twice check, plus a test that reads the catalog).
- AC-2: `setup-db` prints "Schema gabay now has 46 tables, 105 indexes, 2 trigger(s)." with no WARNING, on a fresh database and on a database left at 0.15 (schema, then migrations). Its `EXPECTED` constants become 46, 105 and 2. The 105 is 137 less the 32 indexes of the twelve dropped tables (Building 3, Level 3, Unit 4, Opening 3, FloorUnderlay 2, FloorObject 3, Amenity 2, TransitPoint 2, Anchor 2, NavConnector 4, NavConnectorStop 2, NavCorrection 2, each counting its primary key, unique constraints and `CREATE INDEX`), because 0002 replaces each re-keyed index one for one and adds none (DC-4). The two triggers are unchanged (no dropped table had one). If the build lands on other numbers, this spec gets a revision first. Verify: integration (`setup-db` on scratch databases).
- AC-3: **Migration 0002** is `db/migrations/0002_<name>.sql`: four digits, following `db/migrations/README.md`, never edited once committed (`migrations-immutable`). It is idempotent, runs in one transaction, holds no `BEGIN` or `COMMIT`, and ends with one `-- verify:` query. It is the first migration that drops; it changes nothing that OA-2's 0001 created. Verify: integration (the runner accepts it; the lint passes).
- AC-4: **Convergence.** On scratch databases, with a frozen copy of schema 0.15 as the fixture (as 0.14's is for 0001; the plan names it):
  1. a 0.15 database holding rows (a tenant, a venue, a store, a status change, a beacon, a beacon plan, a sentinel, a closure, an analytics row) becomes, after 0002, a database whose catalog fingerprint (columns, constraints, indexes, trigger definitions, function bodies) equals a fresh 0.16 one. Rows that have no key column are untouched, and every re-keyed column holds the decimal text of the old integer id (DC-2);
  2. running 0002 twice changes nothing;
  3. a fresh 0.16 database plus 0002 changes nothing;
  4. the half state: 0.16's `schema.sql` run over a 0.15 database (its preamble drops every foreign key, and it does not know the twelve tables), then the migrations, equals a fresh 0.16 (the twelve tables are gone);
  5. a 0.14 database takes 0001 and then 0002, in order, and equals a fresh 0.16.

  Verify: integration (`db/tools` tests over scratch databases).
- AC-5: **The stop (H-3).** On a 0.15 database holding a `PUBLISHED` `VenueVersion`, 0002 raises "Published versions exist; recreate this throwaway database with npm run setup-db (E-20)", and the database is as it was: nothing dropped, nothing re-keyed. `BUILDING` and `FAILED` rows do not stop it. Verify: integration.
- AC-6: **The re-keyed columns (H-2).** Each is `VARCHAR(40)` with a `CHECK` on the schema file's `ELEMENT_KEY` pattern, and no foreign key points at a dropped table:

  | Table | Becomes |
  |---|---|
  | `Occupant`, `StoreStatusChange` | `UnitKey` NOT NULL |
  | `Beacon`, `BeaconPlan`, `Sentinel` | `LevelKey` NOT NULL |
  | `Closure` | `LevelKey` and `ConnectorKey`, both NULL as before; `CK_Closure_Target` reads `ConnectorKey` |
  | `AnalyticsEvent`, `AnalyticsDailyUnit`, `Forecast` | `UnitKey` (NULL where it was NULL) |
  | `AnalyticsDailyCell` | `LevelKey` NOT NULL and `DestinationUnitKey` NULL |
  | `RouteTrace` | no column change; the `TracePoints` comment names keys |

  Every index that named an element id leads with its venue: `IX_SSC_Unit` becomes (TenantId, VenueId, UnitKey, ChangedAt) and `IX_ADU_Unit` (TenantId, VenueId, UnitKey, Day); `PK_AnalyticsDailyUnit`, `UX_ADC_*`, `UX_Forecast_Unit`, `IX_Beacon_Level` and `IX_BeaconPlan_Level` already carry `VenueId` and take the key column in place of the id. The column names of `X` and `Y` on `Beacon`, `BeaconPlanItem`, `Sentinel` stay, and their comments say `Y` is the document's `z` and the frame is the venue's (DC-3). A test reads each `CHECK`'s pattern text and the schema file's `ELEMENT_KEY` and asserts they are equal. Verify: integration (catalog queries) and unit (the pattern equality).
- AC-7: **Costs in seconds (H-4).** `ConnectorType.CostBaseM` and `CostPerRiseM` are replaced by `CostBaseS` and `CostPerRiseS` (the same column type), in `schema.sql`, in 0002 and in the seed's `lookups.js`. The four platform rows (`ELEVATOR`, `STAIRS`, `ESCALATOR`, `RAMP`) carry the pairs OA-2 §5 H-4 lists. `spec/P0-03.md` r4's cost section is the single source of the pairs and the formulas, which this spec does not restate; where r4 and H-4 differ, r4 wins and this criterion follows it (X1). A tenant-owned `ConnectorType` row, if one exists when 0002 runs, takes its `CostModel`'s platform pair (metre figures mean nothing in seconds; none exists in any seeded database). The columns stay `DECIMAL(9,3)`, which keeps a cost to 0.001 s, the precision P0-03 r4 requires of every edge cost. The settings follow the same source: `functions/src/config/settings.js` `DEFAULTS` replaces `routing.stairsSaveM` (144) with `routing.stairsSaveS` and gains every other seconds-routing setting P0-03 r4 names (the other-way margin included), each with the value and comment r4 states, and the `SettingKey` comment in `schema.sql` follows r4's key names. OA-3 states none of those values; the file seeds no rows, as before. Verify: integration (0.15 database with a tenant row, then 0002; the seeded rows), unit (the settings reader returns r4's defaults; `routing.stairsSaveM` is gone).
- AC-7a: **The `connector-types` lookup carries the cost fields (read-only).** OA-3a owns the cost columns, so it adds the entry `connector-types` to the allow-list of `GET /api/lookups/:name` and `GET /api/lookups/:name/:id` (`lookup.service.js` has no such entry today; its header comment already reserves the name for a later slice). A row is `{ id, code, label, isActive, costModel, costBaseS, costPerRiseS }`. The list and the single read follow the existing entries' rules:
  - the list holds the active rows of the tenant and the platform, filtered by a label search, ordered and paged as the other lookups are;
  - the single read returns one row, active or not, of the tenant or the platform, never another tenant's;
  - the tenant is `req.tenantCompanyID` and the predicate is `(TenantId = $1 OR TenantId IS NULL)` (the global-lookup trap; rules 2 and 3);
  - it is read-only: no write route exists, and this spec adds none;
  - the cost values come from the table as stored, in the representation the API already uses for `DECIMAL(9,3)` values (DC-27); this spec states no formula, which stay in P0-03 r4.

  The editor's connector panel (P0-11 r3) shows these fields. The FF-0 lookups ledger rows (`GET /api/lookups/:name` and `…/:id`) are unchanged apart from a note that `connector-types` is served, with the cost fields, from OA-3a. Verify: API test (the four platform rows with their `costModel` and seconds values; a tenant row with the same code beside a platform row; an inactive row missing from the list and present in the single read; another tenant's row answering 404; `X-Tenant-Id` 403; SUPERADMIN with no tenant 400; a name such as `constructor` still 404), and the `tenant-predicate` and `sql-interpolation` lints.
- AC-8: **The code that retires with the columns.** `functions/src/services/venueBoundary.js` and `ZERO_BOUNDARY` are deleted. `POST /api/venues` writes no boundary. Every other P0-01 r4 venue rule is unchanged. No code under `functions/src`, `db/tools` or `db/seeds/lib` reads or writes a dropped table, a dropped `Venue` column or a replaced key column; a scan test fails on a reappearance (migrations and the frozen fixtures are exempt). Verify: API test (the venue cases), unit (the scan).
- AC-9: **The key check on save (H-6).** On `PUT /api/venues/:venueId/map/draft`, after the document passes the validator and the backdrop-key check, and before the version check, the venue's relational rows are read and compared with the incoming draft:
  - `Occupant.UnitKey` and `StoreStatusChange.UnitKey` must not be held by the draft as an element of another kind than a unit;
  - `Beacon`, `BeaconPlan`, `Sentinel` and `Closure` `LevelKey` must not be held as another kind than a level;
  - `Closure.ConnectorKey` must not be held as another kind than a connector.

  A key the draft holds as another kind (OA-1's `wrongKind`) is refused with 400 `{ error, problems, total }`. Each problem is at the path of that element in the incoming draft, and names the kind that holds the key and the kind the draft gives it. Nothing is stored. The order of refusals of OA-2 AC-18 becomes: stub and tenant (403, 400), venue (404), body (400), document (400), backdrop keys (400), key check (400), version (409); so a stale save that also re-uses a key answers 400. Verify: API test (one case per row kind; one request per pair of neighbouring steps).
- AC-10: **What the key check accepts, and its scope.** A key the draft does not hold at all (a deleted element) is accepted. A key the draft holds as the same kind (how undo works, office §8.4) is accepted. A venue with no relational rows is never refused. Only the rows of this tenant's and this venue's are read: a key `U1` held by a store of another venue, even of the same tenant, never affects this venue's save (keys are unique only within a venue). Rows count whether or not they are active (DC-5). Verify: API test.
- AC-11: **The key-status loader (H-7).** One service function loads, for a venue, the element index of a draft and the element index of the published layout, for every writer of a keyed row. It takes an optional draft: when given (the save's incoming draft, the import's file map), that is the draft index; otherwise it is the stored draft's, or none. The published index is built from `LayoutJson` of `VenueMap.PublishedVersion` through `readMap`, never re-validated (OA-1 AC-36), or none when never published; a layout of an unknown `spec` refuses with OA-2 AC-31's 409 text. The save's key check (AC-9), the import (AC-42) and later writers (OA-4's stores, FF-11's beacons, P1-01's closures) use this one function and OA-1's `keyStatus`; there is no second reader of the indexes. Verify: integration (draft only: `pending`; in both: `live`; in neither: `removed`; another kind: `wrongKind`; no map row; an unreadable published layout), and review (one reader).
- AC-12: **The check runs under the venue lock.** The save repeats the key read inside its transaction, after it takes the venue lock (`lockVenue`) and before the version read, as it does the backdrop keys (OA-2 DC-A6). A store, beacon or closure row committed by a writer that held the lock first is seen; a writer that holds the lock makes the save wait. Verify: integration with two connections, in the style of `venueLock.test.js`.

### 3.2 OA-3b: the converters, the Demo Malls fix, the report, the caps

The converters are a pure library: a source file in, a document plus a report out. They read no database and no clock. Sources keep their frame (x east, y south, origin at the site's north-west corner), which is the document's frame (OA-1 §2).

- AC-13: **Stores become non-walkable rooms with walls and doors.**
  - Every source store, box, cinema and restroom becomes a unit with `walkable: false`. Its outline is the source rectangle, or the spike room's polygon. `passThrough` follows the old rule (a source box with more than one door).
  - Its walls run along its outline, one per edge. Where two outlines share an edge, no wall other than the one that holds a door crosses that door's span, so a door is never blocked by a duplicate wall under it (DC-10).
  - Each source door becomes an opening of kind `door`, listed in the unit's `doors`, sitting on a wall of the same level. `clearW` is the source's door width, `entrance` is true for the source's entrances, and `name` is kept.
  - A door whose room is not drawn (a mall entrance, MEZZ's doorway to an undrawn place) sits on a wall made from its own segment (`at` 0.5, `w` the segment's length) (DC-10).
  - Non-walkable units that hold no door (voids, back-of-house, structure, recreation, portal) have no walls.

  The number of openings of each venue equals the number of doors in its source, derived by a function that is independent of the converter. Verify: unit (a store with one door and with two; a door on a shared edge; an entrance; a door to an undrawn room), integration (the counts on the five committed sources).
- AC-14: **Door channels (office §11; the ruled fix).** For each store, restroom or entrance door whose gap does not touch walkable floor, the converter adds one walkable unit (category `walkway`, name "Door channel"): the door's width, from the door out along its outward normal to the nearest walkable floor of the level. A gap "touches walkable floor" when the point `DOOR_TOUCH_M` outside the door's midpoint lies in a walkable unit (a named constant; the plan sets its value). The channel is added only when its length is at most the snapping maximum and its strip crosses no other non-walkable unit and no blocking item. A door that touches walkable floor gets no channel. A door that fails either test gets AC-16's backup. Verify: unit (a 1 m gap; a touching door; a gap exactly at the maximum and one millimetre over; a strip blocked by another unit), integration (on the five committed sources, a check written independently of the converter finds every door touching walkable floor, or listed in the report as a backup or as unresolved).
- AC-15: **Pin snapping (O3, ruled 5 m on 2026-10-14).** The snapping maximum is one named constant, `SEED_SNAP_MAX_M`, with the value 5 m; the tests read the constant, not a literal.
  - Each connector stop (a lift's, a stair's, an escalator's, a ramp's) that is not on walkable floor of its own level, and is within the snapping maximum (5 m) of it, moves to the nearest point on that floor. The move and its distance are in the report. A stop on walkable floor (distance 0, the boundary included) does not move.
  - A stop beyond the maximum is not moved and gets AC-16's backup.
  - A stop on a level with no walkable floor is not moved and is listed as unresolved.
  - A stop never changes level. After a move, the stop lies inside its level's rectangle.

  Verify: unit (inside; on the boundary; 0.5 m off; exactly at the maximum and one millimetre over; no walkable floor; the nearest point of a concave polygon), integration (the report's moves, on the five committed sources).
- AC-16: **The ADD_PATH backup.** Where AC-14's channel cannot be drawn, or AC-15's pin is beyond the maximum, the converter writes one correction of kind `ADD_PATH` on that level: a line of two points, from the door's midpoint or the pin to the nearest walkable point of the level, inside the level, at least `LINE_MIN_LENGTH_M` long. It never writes `BLOCK_AREA` or `REMOVE_PATH`. On a level with no walkable floor it writes nothing, and the door or pin is unresolved. A path that crosses a wall is a publish warning (L170 Q2), never a refusal here. Each correction is in the report with the id of its door or connector. Verify: unit, integration.
- AC-17: **Connectors, and two-way escalators stay two-way (N6).**
  - One source lift is one connector of kind `elevator` with a stop for every floor it serves.
  - One source stairs, escalator or ramp hop is one connector between two levels.
  - Every source escalator hop is ONE connector with `twoWay: true`, never split into two.
  - Evacuation-only stairs have `evacuationOnly: true` and keep their name.
  - `type` is the `ConnectorType` code of the kind (`ELEVATOR`, `STAIRS`, `ESCALATOR`, `RAMP`), and each connector passes OA-1 AC-7. Its footprint is set by DC-13.
  - The four Demo Malls hold 163 connectors in all.

  Verify: unit, integration.
- AC-18: **The spike-shaped sources (MEZZ, the penthouse, the owner's exports).** The document has one building of type `MAIN` and one level (name "Floor 1", ordinal 0, short name "1"), as large as the source's extent. A room becomes a unit as the old converter made it (concourse: walkway; restroom: restroom; staff: nonpublic; otherwise room; `passThrough` kept). An obstacle becomes an item (`PILLAR`, `SHAFT` or `FURNITURE`) with its own `w` and `d` (G13). A restroom room adds a `CR` amenity with its `unit`, and an orphan restroom door adds one at the door. A door whose confidence is below "high", or that leads to a room the source never drew, has `review: true`; no other element has the flag (Q3). A source with no rooms, doors, obstacles or beacons gives the building and level and nothing else. Beacons are not in the document (AC-24). Verify: unit (invented fixtures), integration (MEZZ).
- AC-19: **Nothing is lost.** For the four Demo Malls, the converters produce 66 levels, 1,709 stores, 163 connectors and 2,320 units that are not door channels; these are L120's recorded totals (`spec/P0-02.md` AC-2) and each venue's counts equal an independent derivation from its source JSON. A difference fails the test and is reported to the product owner, never re-baselined silently. For a spike-shaped source, the units, openings and items equal the source's rooms, doors and obstacles. Verify: unit, integration.
- AC-20: **Deterministic.** Converting the same source twice gives byte-identical documents and reports. Every element id is a pure function of the source (never random, never time), matches `ELEMENT_KEY`, is at most 40 characters, and is unique within its document. Verify: unit.
- AC-21: **The site and the levels.**
  - Every Demo Malls document has `site.boundary` equal to the site rectangle, `site.georeference` null and `site.mapUp` 0.
  - Its buildings carry the type code (`MAIN`, or the tenant's own code for the demo's open-air, arena and station kinds), the name and the footprint.
  - Its levels are one per building level, plus the outdoor ground level (ordinal 0, `outdoor: true`, elevation 0); each level's rectangle is the site rectangle (DC-9); names, short names and elevations come from the source.
  - No document holds an `anchors` entry (P0-02 ruling C4), a colour, or a `review` flag on a Demo Malls element (DC-14).
  - A spike-shaped document has `site.georeference` null.

  Verify: unit.
- AC-21a: **The main building comes first (L176, Q18; no schema change).** In every converted document the venue's main building is `buildings[0]`, and the other buildings follow in the source's order (the editor's shortcuts follow the document's order). The converters choose the main building by a pure rule on the source (DC-25): the first building whose type code is `MAIN` (the source kinds `mall` and `tower`), else the first building. For the four Demo Malls that gives Aurora Mall (`M`), Bayview's "Main Mall", Meridian Twin Malls' "Building A" and Skyline Spire (`T`); a spike-shaped source has one building. A seed test reads the stored draft of every seeded venue (the five committed sources, and any penthouse or export fixture a case adds) and asserts that `buildings[0]` is that venue's main building and that the others keep the source's order. Verify: unit (the converter, with fixtures that list the main building second and third), integration (the seed test over every seeded venue).
- AC-22: **The converter report.** Each conversion returns a report, and the seed prints one summary line per venue and writes the full report to a git-ignored local folder (DC-18). The report lists, per venue:
  - the counts of every element kind;
  - every door channel (the door and its length);
  - every pin move (the connector, the level, the distance, the old and new point);
  - every ADD_PATH backup (its door or connector);
  - every unresolved door or pin, with the reason;
  - every source item skipped (a zero-size rectangle, as before);
  - the measured maxima of AC-23.

  The report holds no secret and no tenant or user data. It is a function of the source (AC-20). Verify: unit.
- AC-23: **The mall caps are measured and set (Q15).** The converters measure, on the five committed sources, for each document: the levels, buildings, connectors, the walls, openings, units, items, corrections and points per level, the longest polygon, the canonical document's UTF-8 bytes and the extent. They are in the report. Then:
  - each cap constant of `venue-map-schema.json` that has a measure becomes the larger of its current value and 2 × the largest measure, rounded up (DC-16, DC-17); a cap is only raised;
  - each raised constant's `source` text names OA-3 and the measured venue and number;
  - the extent and elevation constants follow the same rule, as the owner ruled on 2026-10-14 (Q3 (a)): the extent cap becomes 2,600 m (2 × Bayview's 1,300 m, already a multiple of 100), and the validator then accepts sites about 20 times PRD §7's "about 100,000 m² per site" (a 2,600 m square is about 6,760,000 m²). The elevation constants only rise under DC-16: the seeds run from −9 m to 66 m, so 2 × those measures stay inside the office range (−20 to 300 m) and neither moves;
  - `MAX_MAP_BYTES` stays below `MAX_JSON_BODY`, and if 2 × the largest document would not, the slice stops and asks (a body-limit ruling);
  - `npm run gen:venue-map-schema` regenerates the Dart copy, and the staleness test passes;
  - a guard test asserts, for every constant with a measure, that the cap is at least the rule's value of the measure taken from the converters' own output, so a re-baselined source fails it;
  - Blueprint Part 1 and Part 3 record the new values.

  The numbers are not written in this spec, because they come from the measurement. Verify: unit (the guard), integration (the five documents validate under the raised caps), review (Blueprint).

### 3.3 OA-3c: the seeds as documents

- AC-24: **The seed writes documents and the people rows.** After `npm run seed`:
  - each seeded venue has its `Venue` row (identity only) and exactly one `VenueMap` row with `DraftJson` equal to the validator's canonical copy, `DraftVersion` 1 and `PublishedVersion` NULL (DC-7); there is no `VenueVersion` and no `VenueMapBackdrop`;
  - each store has an `Occupant` with `UnitKey` naming a non-walkable unit of that venue's draft, its name (the IMAX rename of L119 kept), its category code through the existing map, its status as the source gives it (Demo Malls) or `OPEN` (spike), and its keywords from the spike room's `place`; no unit that is not a store has one; no two active occupants share a key;
  - each beacon has a `LevelKey` naming the level of its draft, and venue-frame `X` and `Y`;
  - every key the seed wrote resolves `pending` through AC-11's loader, never `removed` or `wrongKind`.

  P0-02 AC-1, AC-4, AC-10 and AC-11 (the venues, MEZZ's beacons, the six accounts and their grants) hold unchanged. Verify: integration.
- AC-25: **Validated before it is written (office §10.4).** Each converted document is validated with the one validator module (no copy; OA-1 AC-29) and the tenant's real context, read from the seeded lookup rows. The stored value is the validator's canonical copy. A document with problems stops the run: it rolls back, exits non-zero, and prints the venue code, up to `MAX_PROBLEMS` problems with their paths, and the total (DC-15). The penthouse and each export are the exception: a conversion the validator refuses is skipped with one fixed line naming the file and "its map did not pass the checks", plus the problem count and never the file's content, and the rest is seeded and committed (P0-02 AC-25's rule; DC-19). The five committed sources must validate with no problem. Verify: integration (an invalid fixture stops the run and writes nothing; an invalid export is skipped; the five sources validate).
- AC-26: **Seen through the API (H-5).** Through the development stub, for every seeded venue of both tenants: `GET /api/venues/:venueId/map` answers `draft` deep-equal to the stored copy, `draftVersion` 1, `publishedVersion` null and `versions` empty; `PUT …/map/draft` with that draft and `baseVersion` 1 answers 200 with `draftVersion` 2 and the draft unchanged (OA-1 AC-25). `functions/test/seed.visible.test.js` walks this, replacing the building and level walk OA-2 removed, and keeps the venue walk of P0-02 AC-12 to AC-14 (venues only). Verify: API test.
- AC-27: **The re-run, failure and re-seed properties still hold** on the new table set: P0-02 AC-17 (two runs both commit; per-tenant counts, codes and now each `DraftJson` equal), AC-18 (a hand-made venue, `VenueMap` row, store and tenant building type in a test tenant are removed by the next run; another tenant and the platform lookups untouched), AC-19 (a failed run rolls back and names the key, never the value), AC-20 (no secret value in any output) and AC-23 (a version in a test tenant stops the seed). The seed's delete list is the current tables, children before parents. Verify: integration.
- AC-28: **The lookup rows the seed writes.**
  - `ConnectorType`: AC-7's four rows, in seconds.
  - `ObjectType`: the four mall types of §6.2 (O7, ruled on 2026-10-14), `KIOSK`, `STALL`, `BENCH` and `PLANTER`, with the table's sizes and resize ranges, which are RECALLED starting values editable per mall; each passes the table's `CHECK`s, shows in `GET /api/venue-maps/catalog` with its resize, mount and round values, and moves each tenant's catalog version through the trigger (a tenant created after the seed's lookups starts at 1).
  - The existing rows and the demo's own building types (P0-02 AC-16) are unchanged.

  Verify: integration, API test (the catalog).
- AC-29: **The seed's tests (FF-2) are rewritten for documents.** `db/seeds/test/` keeps its files and gains converter tests (AC-13 to AC-23). What each existing case becomes is in §5.1. They run in `npm run verify` (`seed-tests`) against the real local database inside rolled-back transactions (L151), and no fixture holds the penthouse or the owner's exports (P0-02 AC-21). Verify: `npm run verify`.
- AC-30: **The penthouse and the owner's data stay out of git (L48, L123).**
  - `git check-ignore` reports `db/seeds/sources/internal/penthouse.json`, a `.json` in `db/seeds/sources/spike-exports/`, the report folder of AC-22, and a file named `x.gabay-venue-map.json` as ignored;
  - `git ls-files` lists none of them;
  - no committed file or fixture holds a converted penthouse document, its report or an export of it;
  - the converted penthouse draft lives only in the local database.

  Verify: integration (a tools test), and the `REVIEW.md` privacy pass.
- AC-31: **The P0-02 invariants reach the documents.** P0-02 AC-3 (no "IMAX" in any seeded name) also searches the text of every stored `DraftJson`; the scan's list of tables and columns is read from the catalog, not fixed. Verify: integration.
- AC-32: **Measured, not gated.** The run time of `npm run seed`, each document's byte size and the validator's total time on the five documents are recorded in the pull request. No target is stated (P0-02 ruling C5; `tools/verify.js`'s 10-minute cap on the `seed` check stands as a timeout, not a target). Verify: integration (measured).

### 3.4 OA-3d: export and import (H-8, H-9; Q11 (b))

The routes sit behind `devStub` and `requireTenant` (E-20), mounted with OA-2's map routes in `routes/venueMaps.js`.

- AC-33: **Boundaries, as OA-2 AC-8.** For `GET /api/venues/:venueId/map/export` and `POST …/map/import`: an `X-Tenant-Id` the stub's user does not hold answers 403; a SUPERADMIN with no tenant answers 400 "Choose a tenant: this works inside one tenant"; a venue of another tenant, or of no venue, answers 404 `{ error: "Not found" }` with nothing read from it and nothing written; a malformed `:venueId` answers `parseIdParam`'s 404. Every statement binds the tenant from `req.tenantCompanyID` and uses `(TenantId = $1 OR TenantId IS NULL)` for lookups (rules 2 and 3). Verify: API test (one case per route per rule; `superAdminNoTenant.test.js` gains both routes); the `tenant-predicate` and `sql-interpolation` lints.
- AC-34: **Export answers the file (H-8).** `GET …/map/export` answers 200 with OA-1 AC-47's file, `{ format: "gabay.venue-map", version: 1, exportedAt, fromVenue: { code, name }, map, stores }`:
  - `map` is `publishable(draft)`, with no backdrop;
  - `stores` holds the venue's **active** stores whose `UnitKey` names a unit of the draft, each as `{ unit, name, spokenName, category, keywords }` with `category` the code (tenant row first, then platform), and `spokenName` and `keywords` left out when empty; the status and the active flag are not exported;
  - `exportedAt` is UTC;
  - the file holds no tenant, venue id, user, audit, beacon, closure or status history;
  - the answer passes `validateExportFile` in the same tenant's context.

  Verify: API test.
- AC-35: **Export refusals.** None of these serves a file:
  - no draft: 409 "This venue has no draft to export";
  - a stored draft that no longer passes today's checks (a lookup code removed since the last save): 400 from `mapProblemBody`, "This map no longer passes today's checks, so it cannot be exported";
  - a file whose text, with the import's envelope, would be longer than `MAX_JSON_BODY`: 413 "This venue's map and stores are too large to export as one file", so no file is ever made that import would refuse (DC-20).

  Verify: API test.
- AC-36: **The file's name and where it may go (E-20 rule 3 as amended, L171).** `Content-Disposition` is an attachment named `<venue code>.gabay-venue-map.json`, with any character of the code outside letters, digits, `.`, `_` and `-` replaced by `_`. `.gitignore` holds `*.gabay-venue-map.json`. Verify: API test (a code with a space and a quote), integration (a tools test: `git check-ignore`).
- AC-37: **Import's input and the order of its refusals.** `POST …/map/import` takes `{ file, baseVersion }`. A body over `MAX_JSON_BODY` answers 413 and malformed JSON 400 (OA-2 AC-10). A missing or non-object `file`, and a missing, non-integer or negative `baseVersion`, answer 400 naming the field. The file is validated with `validateExportFile` in the tenant's context: any problem answers 400 `{ error, problems, total }` and nothing is written. The order is: stub and tenant, venue (404), body (400), file (400), key check (400, AC-42), version (409). A key in `file` the schema does not know is left out (OA-1 AC-24). Verify: API test.
- AC-38: **One transaction, under the venue lock (H-9).** In one transaction, after taking `lockVenue`, the import:
  1. repeats the key check;
  2. checks `baseVersion` against the stored `DraftVersion` (stale: OA-2 AC-16's 409 and body, never a merge);
  3. replaces the draft with the file's canonical map, `DraftVersion` = `baseVersion` + 1, `UpdatedBy` the actor;
  4. merges the stores (AC-39 to AC-41);
  5. re-attaches backdrops by level id, as a rollback does (OA-2 AC-34; DC-21).

  A failure anywhere, a store write included, changes nothing. A venue with no map row takes `baseVersion` 0 and gets `DraftVersion` 1. Published versions, `PublishedVersion`, packages and every store the file does not mention are unchanged. Verify: integration, with a fault injected at the store write.
- AC-39: **Stores already there are updated (Q6 (a)).** A file store on a unit that already has an active store updates that store's name, spoken name, category and keywords. Its status, active flag, logo and history are kept, and no `StoreStatusChange` row is written. Verify: API test, integration.
- AC-40: **New stores start Open (Q7 (a)).** Any other file store becomes a new active `Occupant` whose status is the `StoreStatus` that `stores.newStoreStatusCode` names (AC-46), resolved tenant row first, then platform, with no logo and `CreatedBy` the actor. No `StoreStatusChange` row is written (P0-11 R14). If the setting names a status the tenant cannot resolve, the import is refused with 409 and a message naming the setting, and nothing is written (DC-22). Verify: API test.
- AC-41: **One active store per unit, and the rest left alone (P0-11 G7).** After an import there is at most one active store on each unit of the venue. A unit whose only store is inactive gets a new active one, and the inactive one stays. Stores the file does not mention are untouched, including a store whose unit is no longer in the new draft (the loader reports it `removed` for later screens). The answer is 200 `{ draftVersion, stores: { added, updated } }`. Verify: API test.
- AC-41a: **One store writer.** OA-3d builds a single store-writing function, and every writer of an `Occupant` row calls it: import's merge (AC-39 to AC-41) now, and OA-4b-1's Stores panel routes later (P0-11 r3, AC-108 to AC-121). It owns three things, so no caller repeats them:
  - **the venue lock:** it takes `lockVenue` itself, or runs inside a transaction that already holds it, and never writes without it (so P0-11 G7 holds for every caller);
  - **the key status:** it reads the draft and published indexes through AC-11's loader and OA-1's `keyStatus`, and refuses a unit key that is not `pending` or `live`, or that is `wrongKind`, with the problem text of AC-9's family;
  - **the key check and the store rules:** the one-active-store-per-unit rule, the update-or-create decision by unit key, the new-store status from `stores.newStoreStatusCode`, and the rule that no `StoreStatusChange` row is written for a create or an update of name, spoken name, category and keywords.

  The import passes it the file's stores and the file's map as the draft to read the indexes from (AC-11's optional draft). The function writes through the caller's transaction and returns `{ added, updated }`. Import contains no store SQL of its own. Verify: unit and integration (the function called directly with a unit key that is `removed`, `wrongKind`, `pending` and `live`; without the lock it refuses; twice on one unit gives one active store), and review (one writer: a scan test fails if any other file under `functions/src` inserts into or updates `Occupant`).
- AC-42: **Import runs the key check (H-6).** The venue's existing rows are compared with the file's map through AC-11's loader. A key the file's map holds as another kind of element refuses the import with 400, with each problem at the file's path (`map.levels[i]…`), as AC-9 does for a save. Every store of the file names a unit of the file's map, which `validateExportFile` already checks. Verify: API test.
- AC-43: **Concurrency.** Two imports on the same `baseVersion` end with one 200 and one 409, and the winner's stores are merged once. An import racing a save, a clear or a rollback on the same base behaves as OA-2 EC-20: the first to take the lock wins and the other gets 409. A store writer that holds the venue lock (OA-4's, later) makes the import wait. Verify: API test, concurrent requests repeated 20 times.
- AC-44: **Round trips.**
  - An export imported back into the same venue (with its current `draftVersion`) leaves the draft deep-equal and answers `stores: { added: 0, updated: N }`, with every status untouched.
  - An export of a seeded Demo Malls venue imported into a new, empty venue of the same tenant gives the same draft and N new stores, all Open.
  - The same export imported into a venue of another tenant that lacks the demo's own building-type codes answers 400 with one problem per missing code (OA-1 EC-14).

  Verify: API test.
- AC-45: **The inactive-lookup case (FEATURE_PIPELINE §5 item 15).** On the real local database, inside a rolled-back transaction (L151): a store's `OccupantCategory` is deactivated; the venue is exported; the file is imported back. The import succeeds and the store's category survives. A file naming an inactive category for a new store is accepted too (OA-1 AC-20). The test is part of `npm run verify`. Verify: integration.
- AC-46: **The setting.** `stores.newStoreStatusCode` is in `settings.js` `DEFAULTS` as `OPEN` (no seed row, as `publish.buildingStaleS`), and a tenant's `GlobalSetting` row overrides it; it is read tenant first (Q7 (a)). Verify: unit (the settings reader), API test (the override).
- AC-47: **Waivers and the retrofit ledger.** `Waived: 3 — R1–R3` (guard order), `Waived: 4 — R2` (permission and menu rows), `Waived: 9 — R12` (automated e2e), each stated in the slice report. `plan/PH4-feature-first.md` §7 gains one row for each route, in OA-2's form: tenant context stub; guard order open (R1–R3); permission row `venue-maps` open (R2); menu n/a; audit open (R3; Q16: the import is a draft replacement plus store writes, so it is audited in full, the export is a read); validation by `validateExportFile` for the file and by hand for the envelope (zod in R5); E2E none (R12). The two FF-0 lookups rows (`GET /api/lookups/:name` and `…/:id`) change by a note only: `connector-types` is served read-only with `costModel`, `costBaseS` and `costPerRiseS` from OA-3a (AC-7a); no cell of theirs changes. Verify: review.

## 4. Edge cases

Each is covered by the criterion named, or has a one-line reason.

**Offline or stale package**
- EC-1: The migration and the seed write no package; a phone's old package is P0-04's case (P0-02 §5). A re-seed after a publish is P0-02 AC-23, unchanged (AC-27).
- EC-2: An export file is not a package. Importing never publishes, and the venue's published layout and live package are unchanged (AC-38).
- EC-3: An import onto a draft someone else saved since: 409 and the reload that OA-2 EC-3 describes (AC-38).

**Empty and maximum data**
- EC-4: A venue with no draft: export answers 409 (AC-35); import works as a first draft with `baseVersion` 0 (AC-38).
- EC-5: A file with `stores: []` replaces the draft only (AC-41); an export of a venue with no stores writes `stores: []` (AC-34).
- EC-6: Aurora (401 places), Bayview Grand (19 levels, 93 connector pins) and Skyline Spire (16 levels) convert, validate, round-trip and are measured against the caps (AC-19, AC-23, AC-26). Each document's and export file's size is recorded (AC-32).
- EC-7: A source with no rooms, doors or beacons converts to its building and level only (AC-18); this restates P0-02's edge case, now in document form.
- EC-8: An export file at the size limit is refused rather than served (AC-35). A document exactly at a cap is the validator's (OA-1 AC-31); the converters never need a cap, because each is at least twice the measure (AC-23).

**Tenant boundary**
- EC-9: Export and import of another tenant's venue answer 404 (AC-33).
- EC-10: Keys are unique only within a venue; a key `U1` in two venues of one tenant never crosses (AC-10).
- EC-11: A file from another database: codes that do not resolve here give problems (AC-44; OA-1 EC-14).
- EC-12: 0002 re-keys every row where it stands; no row moves between tenants or venues (AC-4).

**Each role**
- EC-13: Under E-20 no role is checked (`Waived: 3`, `Waived: 4`; AC-47). R2 decides who may export, import and save; nothing here presumes it.
- EC-14: A SUPERADMIN with no tenant gets 400 on both routes (AC-33).

**Permission denied**
- EC-15: An `X-Tenant-Id` the user does not hold answers 403 (AC-33).

**Concurrent edits**
- EC-16: Two imports, or an import and a save, on one base: one 200, one 409 (AC-43).
- EC-17: A beacon or store written while a save runs its key check: the venue lock orders them (AC-12).
- EC-18: Two seed runs at once, and the Auth emulator's shared ports: unchanged from P0-02 §5 (no test).
- EC-19: 0002 runs while the API serves: not supported on this machine. It takes its locks and runs as one transaction, so a failure leaves the database as it was; stop the API first (no test).

**Publish in progress**
- EC-20: An import, save or clear while a publish of the venue is `BUILDING` succeeds, and its change is not in the version being built (OA-2 AC-28, EC-24 to EC-25; AC-38).
- EC-21: 0002 with a `BUILDING` or `FAILED` row proceeds, and with a `PUBLISHED` row stops (AC-5).
- EC-22: A seed run with any version in a test tenant stops (P0-02 AC-23; AC-27).

**Frozen rows**
- EC-23: 0002 never updates a `PUBLISHED` row; it stops before any change (AC-5), and the frozen-row trigger is unchanged.
- EC-24: A key held by a row and held by the published layout as a unit, while the draft holds it as a wall, is refused, because the check reads the incoming draft only (AC-9, DC-5).
- EC-25: An import never writes a `VenueVersion` row (AC-38).

**Invalid input**
- EC-26: Import's `file` as `null`, an array or a string; a wrong `format` or `version`; a `stores` that is not an array; a store with no `name`; a store keyed to a wall or to a missing id; two stores on one unit; an unknown category code; `__proto__` keys: each gives problems or a 400 and never a 500 (AC-37, OA-1 AC-24, AC-28, AC-47).
- EC-27: `baseVersion` as `"3"`, `3.5`, `-1` or `null`: 400 naming the field (AC-37).
- EC-28: A venue code with a space, a quote or a line break in the download's file name: sanitised (AC-36).
- EC-29: A converter source with a zero-size store rectangle is skipped as before and listed in the report (AC-19, AC-22). A source door with a zero or negative width, a coordinate outside the site, a polygon with fewer than 3 distinct points, or a door wider than the wall it sits on: a source defect. The run stops with the validator's problems; nothing is clamped (AC-25, DC-15).
- EC-30: A pin or a door exactly at the snapping maximum is handled (moved, or channelled); one millimetre over gets the backup (AC-14, AC-15).
- EC-31: A level with no walkable floor: its pins and doors are listed unresolved, with no correction written (AC-15, AC-16).
- EC-32: A door whose outward strip would cross another store: no channel, an ADD_PATH instead (AC-14, AC-16).
- EC-33: Two doors of one store close together: two channels, which may overlap; both are walkable (AC-14).
- EC-34: A source connector with fewer than two stops is skipped as before; an escalator source with three stops gives two hops, each its own two-level connector (AC-17).
- EC-35: The `ELEMENT_KEY` pattern changing later: the `CHECK`s and the schema file would disagree, and AC-6's equality test fails; both move together by a new migration.
- EC-36: `npm run seed` against a database still at 0.15 (0002 not applied) fails on its first write and rolls back with the database's own message; `npm run migrate` or `npm run setup-db` is the way out (README line; no test; Suggestions).
- EC-37: The penthouse or an export whose conversion the validator refuses is skipped with one line (AC-25); on a clean clone neither exists (P0-02 §3).
- EC-38: A venue with several `MAIN`-type buildings (Meridian Twin Malls has three: A, B and the Fashion Hall) has the first of them as its main building, and the rest keep the source's order (AC-21a, DC-25). A source whose main building is listed second or third is reordered; one with only one building is untouched.

## 5. What retires or changes (C1), and what happens to P0-02's criteria

### 5.1 Files and tests

Each entry gives a one-line reason; the plan names each changed test case. The searches that found them are by table, column and function name, so the plan re-checks the list.

| File | Action | Why |
|---|---|---|
| `db/schema.sql`, `db/migrations/0002_<name>.sql`, `db/migrations/README.md`, `db/tools/setup-db.js` | change, new | AC-1 to AC-7 (the README lists 0002; `EXPECTED` becomes 46, 105, 2) |
| `functions/src/services/venueBoundary.js`, its test `venueBoundary.test.js` | delete | AC-8: `ZERO_BOUNDARY` is its last use |
| `functions/src/services/venue.service.js` | change | AC-8: no boundary written on create |
| `functions/src/services/mapStorage/mapDraft.service.js` and a new key-check module | change, new | AC-9 to AC-12 |
| `functions/src/routes/venueMaps.js`, a new export and import service, a new store-writer module | change, new | AC-33 to AC-46, AC-41a |
| `functions/src/services/lookup.service.js` and its lookups tests; `E2E_Test_Cases_Manual.md` FF0 lookups rows | change | AC-7a: the `connector-types` entry |
| `functions/src/config/settings.js` and its settings tests | change | AC-46 (`stores.newStoreStatusCode`); AC-7 (`routing.stairsSaveM` out, the seconds settings of P0-03 r4 in) |
| `functions/src/config/venue-map-schema.json` and its generated Dart copy | change | AC-23 |
| `db/seeds/lib/demo.js`, `spike.js` | rewrite | AC-13 to AC-25: they emit documents |
| `db/seeds/lib/run.js`, `lookups.js`, `exports.js`, `geo.js` | change | the delete list, seconds, the new skip reason, shared geometry (`geo.js` is reused) |
| new converter, report and measurement modules under `db/seeds/lib/` | new | AC-13 to AC-23 |
| `db/seeds/test/seed.content.test.js` | rewrite | AC-1 to AC-4, AC-9, AC-24 of P0-02 move to documents: its `L120_DEMO_TOTALS` table counts and the `columns.length >= 8` scan guard change (AC-19, AC-31); it gains the main-building-first test for every seeded venue (AC-21a) |
| `db/seeds/test/seed.reruns.test.js` | change | AC-18's hand-made building and level rows go; a hand-made `VenueMap` row and store come (AC-27); `addVersionTo` is unchanged |
| `db/seeds/test/seed.sources.test.js` | change | its "no rooms, doors or beacons" case reads the document, not `Building` and `Level` rows; the AC-25 cases gain the invalid-map reason |
| `db/seeds/test/helpers.js` | change | `snapshot()` counts the new table list and each draft |
| new converter tests, fixtures of invented data | new | AC-13 to AC-23 |
| `functions/test/seed.visible.test.js` | change | AC-26: the map walk replaces the building and level walk |
| `functions/test/venues.test.js`, `venues.retired.test.js`, `fieldInput.test.js`, `fieldCases.js`, `venueApp.js`, `venueMaps.clear.test.js`, `venueMaps.concurrency.test.js`, `mapSchema.test.js` | change | they mention `BoundaryGeoJson`, `GeoreferenceJson`, `MapUpDeg` or `ZERO_BOUNDARY`, or the cost columns; each case is named in the plan |
| `db/tools/test/migration0001.test.js` | change | its "fresh 0.15" baseline is `schema.sql`, which becomes 0.16; it moves to the frozen 0.15 fixture (AC-4) |
| `tools/lint/test/schema-drops.test.js`, `tenant-predicate.test.js`, `helper.js` | change | counts and fixture text name the dropped tables |
| `functions/test/venueLock.test.js`, `superAdminNoTenant.test.js` | change | the key check's lock order (AC-12); both new routes (AC-33) |
| new export and import API tests | new | AC-33 to AC-46 |
| `docs/testing/E2E_Test_Cases_Manual.md` | change | rows OA3.x for AC-9, AC-33 to AC-46; FF2.x seed rows that mention buildings and levels |
| `.gitignore`, `db/seeds/.gitignore` | change | AC-30, AC-36 |

### 5.2 P0-02 r2's criteria, one by one

`spec/P0-02.md` r3 tags each withdrawal in place, with r2's text kept. Anything not listed stays in force exactly as r2 wrote it.

| P0-02 r2 | In r3 | Now |
|---|---|---|
| AC-1 (four venues, no beacon) | in force | AC-24 |
| AC-2 (totals) | **partly withdrawn**: the `Level`, `Unit` and `NavConnector` counts; the 1,709 occupants stay | AC-19 |
| AC-3 (no "IMAX") | in force, extended | AC-31 |
| AC-4 to AC-7 | in force | AC-24, AC-30 |
| AC-8 (exports) | **partly withdrawn**: its last sentence, "doors are marked `NeedsReview`" | AC-18 (the `review` flag) |
| AC-9 (`NeedsReview` count) | **withdrawn** | AC-18 |
| AC-10 to AC-13 | in force | AC-24, AC-26 |
| AC-14 (round trip) | **partly withdrawn**: buildings and levels; the venue round trip stays | AC-26 |
| AC-15 (admin page) | **partly withdrawn**: "opening one shows its seeded buildings and levels" | AC-26 now; OA-4's editor shows them |
| AC-16 (building types) | in force | AC-21 (the tenant's own building-type rows are still seeded) |
| AC-17, AC-18 | in force; AC-18's buildings and levels are **withdrawn** | AC-27 |
| AC-19 to AC-23 | in force | AC-27, AC-30 |
| AC-24 (no georeference) | **withdrawn** (the column is dropped) | AC-21 |
| AC-25 | in force, plus one skip reason | AC-25 |

## 6. The owner's rulings on O3 and O7 (2026-10-14)

### 6.1 O3: the snapping maximum, and what happens beyond it. Ruled 2026-10-14 by the product owner: (a)

**The ruling: 5 m.** A pin within 5 m of walkable floor on its level moves to the nearest point of it. A pin farther away stays where it is and gets an ADD_PATH line. Every move and its distance go in the converter report, and the maximum is one named constant (AC-14, AC-15, AC-16, AC-22). The ruled fix (L170, the 2026-10-12 ruling) moves each stair, escalator and lift pin onto walkable floor within a named maximum, with the ADD_PATH backup beyond it; the maximum moves the pin the shopper's map draws, which is why it was the owner's to say. The two options not taken were 10 m and never moving a pin.

- The facts available (A1, as quoted in the re-plan): in all four malls the pins sit off walkable floor; Bayview has 50 of 93 more than 5 m away; Skyline Spire's "Stairs north" sits on no walkable unit; 336 of Aurora's 340 doors sit 1 m from a corridor.
- **One constant for pins and door channels** (DC-12), named `SEED_SNAP_MAX_M` in the converter, not a setting.
- Bayview has 50 of 93 pins beyond 5 m by A1's figure, so that mall is expected to get about 50 ADD_PATH lines. Each move and its distance is in the report, so the figure can be reviewed at sign-off and changed in one place.

### 6.2 O7: the mall object types. Ruled 2026-10-14 by the product owner: (a)

**The ruling:** add `KIOSK`, `STALL`, `BENCH` and `PLANTER` with the starting sizes and resize ranges below. **These values are RECALLED starting values, not sourced, and a mall can edit them** (R11's maintenance screen; rule 5). The options not taken were no default sizes and none now. `ObjectType` holds `PILLAR`, `SHAFT` and `FURNITURE`, with no default sizes. The schema comment names the L39 library as "PILLAR, KIOSK, STALL, BENCH, PLANTER, ...". The demo malls use no items at all (their obstacles come only from the spike sources), so the new types affect the editor's catalog, not the conversion. The sizes below are RECALLED typical sizes, with no source in the repository. They are platform rows, and a mall can change its own later.

| Code | Label | Default w × d × h (m) | Resize | Mount | Round | Blocks walk | Signal penalty |
|---|---|---|---|---|---|---|---|
| `KIOSK` | Kiosk | 2.0 × 2.0 × 2.4 | w and d 1 to 6; h fixed | floor | no | yes | none |
| `STALL` | Stall | 2.0 × 1.0 × 2.0 | w 1 to 4; d 0.6 to 2; h fixed | floor | no | yes | none |
| `BENCH` | Bench | 1.5 × 0.5 × 0.45 | w 1 to 3; d and h fixed | floor | no | yes | none |
| `PLANTER` | Planter | 1.0 × 1.0 × 0.8 | diameter 0.5 to 3; h fixed | floor | yes | yes | none |

"Column" is the existing `PILLAR`; an "escalator void" is a unit of category `opentobelow`, which the converters already write, so neither is a new type. The signal penalty is left empty, because no RF figure for these exists (the spike's model gives only pillar, shaft and furniture); FF-11 sets it.

## 7. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | Yes | Schema 0.16 and migration 0002, the first that drops (AC-1 to AC-7) |
| 2 Seed data updated | Yes | This entry is the seed: documents, the people rows, seconds, the mall object types (AC-24 to AC-29) |
| 3 Guard order | Waived | `Waived: 3 — R1–R3`: the export and import routes sit behind `devStub` and `requireTenant` (AC-47) |
| 4 Permission and menu rows | Waived | `Waived: 4 — R2`: the `venue-maps` permission rows, with ledger rows (AC-47) |
| 5 Scaffolds, `formatApiError`, four states | No | No screen; OA-4 adds the buttons |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | No | No colour is stored (OA-1 AC-22); no Dart code |
| 9 Automated e2e | Waived | `Waived: 9 — R12`; API and integration tests cover every criterion |
| 10 Manuals and smoke guide | Yes | `E2E_Test_Cases_Manual.md` rows for the key check, export, import and the seed's lines; the smoke guide gains `setup-db`'s 46, 105 and 2 and the seed's report lines; no frontend manual row |
| 11 Changelog | No | No app surface changes; the seed is development data |
| 12 Companion-file sync table | Yes | Rows: `db/schema.sql` (migration 0002, the seeds, Blueprint Part 3's table list and key columns, `SCHEMA_READING_GUIDE.md`, `INSTALL.md` and README counts); API routes (tests, the e2e manual, Blueprint Part 4 §4.1 and §4.6, Part 1's invariant 13 reworded to "keys inside the document are service-checked", invariant 15 with `CostBaseS` and `CostPerRiseS`); a limit (the caps in the schema file and its Dart copy, Blueprint Part 1 and 3); a setting (`stores.newStoreStatusCode`, and the seconds settings of P0-03 r4 in place of `routing.stairsSaveM`, in `DEFAULTS`; the Blueprint's settings list); the venue map schema row (regenerate the Dart copy); `db/seeds/README.md` (version bump, the documents, the report, the Demo Malls fix); `db/migrations/README.md`; FEATURE_PIPELINE's P0-02 row (spec r3, OA-3); the retrofit ledger (AC-47); no command is added (DC-24) |
| 13 Every field a `FieldSpec` | No | No form |
| 14 New enumerable sets | Narrowly | The mall object types are rows of an existing lookup (rule 5); the converters' source-to-code maps translate source files and are never offered to a client |
| 15 Inactive-lookup case | Yes | AC-45, on the real database |
| G1 Traceability | Yes | Every AC and EC maps to a test or a one-line reason |
| G2 Wording and accessibility | In part | Refusal texts are admin English by design (R34); no shopper phrase, no control |
| G3 Offline shopper, no position leaves the phone | No | No shopper feature; the converters store no shopper data |
| G4 Differences recorded | Yes | The slice's L-row records: the twelve tables dropped and the keys; seconds in `ConnectorType`; P0-02's withdrawn criteria (§5.2); O3 (5 m) and O7 (four mall object types) as ruled on 2026-10-14; the measured caps under one rule (extent 2,600 m); the Demo Malls fix; the main building first (L176, Q18); `stores.newStoreStatusCode` and the seconds settings; the export and import contract |

## 8. Scale targets

| Target | Source | How this spec meets it |
|---|---|---|
| The four Demo Malls: 66 levels, 2,320 units (not counting door channels), 1,709 occupants, 163 connectors | L120's recorded run (P0-02 AC-2) | AC-19 |
| Aurora about 400 places (401); Skyline Spire 16 levels | L119, L120 (P0-02 §7) | AC-19, AC-23 |
| Bayview Grand 19 levels, 93 connector pins | A1's report, as quoted by the re-plan §1.1 and OA-1 §6 | AC-23; the extent and level caps are raised from it |
| Seed sites: Aurora 510 × 720 m, Bayview 1,300 × 760 m, Meridian 680 × 360 m, Skyline Spire 300 × 300 m (16 levels, −9 to 66 m) | OA-1 §6 (from `siteRect` and `elev`) | AC-21, AC-23 (Q3 ruled (a): extent 2,600 m) |
| Caps: the largest seed × 2, rounded up, for levels, walls, openings, rooms, items and connectors; the owner extended it on 2026-10-14 to every measured cap, extent and elevation included | L170 Q15; Q3 (a) | AC-23 |
| Document ≤ `MAX_MAP_BYTES` (4 MiB), below the 5 MB request body | OA-1 AC-32; `MAX_JSON_BODY` | AC-23, AC-35 |
| Venues up to about 100,000 m² per site; routing graphs up to about 20,000 nodes; about 5 tenants at the pilot | PRD §7 | Bayview's site (about 988,000 m²) is far above the first figure; the owner ruled Q3 (a) knowing the validator then accepts sites about 20 times PRD §7's size (extent 2,600 m); no graph is built here, so the second does not apply; 2 test tenants |
| Seed run time | None stated (P0-02 ruling C5); `tools/verify.js`'s 10-minute cap is a timeout | AC-32 records it |
| Export and import time, store counts per venue | None stated | Not invented; AC-32 measures the file sizes only |

## 9. Design choices

Each is a DESIGN CHOICE, not a requirement, with an alternative that would also satisfy what is stated. They are listed for sign-off, not asked (L174).

- **DC-1 Four sub-slices (§1).** *Alternative:* one slice of about 48 criteria, which holds a transactional route, a destructive migration and a geometry fix in one review.
- **DC-2 H-3:** a re-keyed column keeps the old integer id as its key's text, and 0002 stops while a `PUBLISHED` row exists (AC-4, AC-5; OA-2's proposal). The text matches no document key, so such rows read `removed` until the next seed replaces them. *Alternative:* refuse while any re-keyed row exists, which forces `setup-db` for any seeded database.
- **DC-3** The coordinate columns keep their names, and the comment says `Y` is the document's `z` (OA-2's proposal). *Alternative:* rename `Y` to `Z` in four tables.
- **DC-4** 0002 adds no index and drops none beyond the twelve tables' (105). *Alternative:* a partial unique index "one active store per unit" in the database (106), which P0-11 G7 leaves to the service.
- **DC-5** The key check reads the incoming draft only and counts every row, active or not. *Alternatives:* also the published layout (which hides a re-used key behind a `live` status); active rows only (which lets an old history row point at a different kind).
- **DC-6** The seed calls the one validator and `loadMapContext`'s row shaping by requiring them from `functions/src`. *Alternative:* a copy in the seeds (a second validator, against OA-1 AC-29).
- **DC-7** The seed writes `VenueMap` directly, with `DraftVersion` 1, as a first autosave would. *Alternative:* go through the save service, which needs an actor and a tenant context the seed does not have.
- **DC-8** Element ids are a pure function of the source (for example the source's own identifiers, or the element's place in it), in a format the plan names. *Alternative:* a hash of the element's geometry, which changes an id whenever a coordinate is edited in the source.
- **DC-9** Every level's rectangle is the site rectangle, as the old `Level` rows' sizes were, because bridges and links between buildings at one height must lie inside the level they are put on. *Alternative:* a building's own rectangle, which loses the bridges.
- **DC-10** Walls only around non-walkable rooms that hold a door; a door with no such room sits on a wall made from its own segment; a door between a store and a walkable room opens the store's wall. *Alternative:* walls around every non-walkable unit, which adds walls under no door and duplicates shared edges.
- **DC-11** A door channel is one walkable unit per door, named "Door channel", so the editor shows what it is and tests can count it. *Alternative:* extend the corridor boxes by the gap, with fewer elements, closer to a real corridor, and better if every gap were the same (336 of 340 are).
- **DC-12** One snapping maximum for pins and door channels, the 5 m the owner ruled for O3 (§6.1). *Alternative:* two constants.
- **DC-13** A connector's footprint centre (`x`, `z`) is the stop on `levels[0]` as the source drew it (before any move), with `rot` 0 and the default size and shape for the kind. *Alternative:* the centroid of the stops. §10 asks whether the engine treats a footprint as a blocker.
- **DC-14** No `review` flag on a Demo Malls element; every machine change is in the report. *Alternative:* flag the channels, corrections and moved connectors, which would show hundreds of "not confirmed" checks on Aurora.
- **DC-15** A source defect stops the run and is never clamped (EC-29). *Alternative:* clamp into the level and list it in the report, which would hide a real data error.
- **DC-16** A cap with a measure becomes the larger of its current value and 2 × the largest measure, so a cap is only raised and never falls below the office's value. *Alternative:* set each to exactly 2 × the measure, which would lower, for example, the 2,000-wall cap for a seed far below it. The rule covers every measured cap, extent and elevation included (Q3 (a), ruled 2026-10-14).
- **DC-17** "Rounded up" means to the next multiple of 10 for counts, 100 for metres, and the next whole MiB for bytes. *Alternative:* the next power of two.
- **DC-18** The report is printed as a summary line per venue and written in full to a git-ignored local folder (`db/seeds/.reports/`), regenerated each run. *Alternative:* console only, which cannot be reviewed at sign-off for 163 connectors.
- **DC-19** A penthouse or export conversion the validator refuses is skipped with one line, like a bad export (P0-02 C2), so one owner file never blocks the seed. *Alternative:* stop the run, which hides every other venue behind one file.
- **DC-20** Export refuses with 413 when its file plus the import envelope would exceed `MAX_JSON_BODY`. *Alternative:* serve it, which makes a file import cannot read.
- **DC-21** Import re-attaches backdrops by level id, as a rollback does (OA-2 AC-34; one function). *Alternative:* the imported draft has none, which silently drops calibration work. This one is visible to admins, so it is named here for the owner's sign-off.
- **DC-22** A `stores.newStoreStatusCode` that resolves to no status refuses the import with 409. *Alternative:* fall back to `OPEN`, which hides a misconfigured setting.
- **DC-23** The seed's invalid-map reason for an export is a fixed line with the problem count and never a problem's text (P0-02 AC-25's rule that a skip line carries no file content). The paths go to the report. *Alternative:* print the first problem, which can quote content.
- **DC-24** No new npm command: the report comes with `npm run seed` and the measurement is a test. *Alternative:* `npm run seed:report`, a separate command (CLAUDE.md's Commands and README would then change).
- **DC-26 One store writer (AC-41a), decided by the main session under L174.** One function owns the venue lock, H-7's loader, the key check and the store rules, and import and OA-4b-1's Stores panel routes both call it, so G7 and the key rules have one implementation. *Alternative:* two writers (import's merge and the panel's routes) sharing a table of test cases, which lets each stay small but means two places to keep equal when a store rule changes.
- **DC-27 The `connector-types` lookup entry (AC-7a), decided by the main session under L174.** The allow-list in `lookup.service.js` already gives every entry its own literal SQL and select list, so the extra columns need no per-lookup column map: the new entry's `select` simply names `CostModel AS "costModel"`, `CostBaseS AS "costBaseS"` and `CostPerRiseS AS "costPerRiseS"` beside the common four. The cost values use the same representation as the catalog route's metre values (the plan names it after reading both). *Alternatives:* a generic per-lookup column list (more machinery than three entries need, and it would put column names in data); or serving the costs only through the catalog route (the connector panel would need a second call). The coordinator's brief said the entry is "extended"; it does not exist yet, so OA-3a adds it.
- **DC-25 The main building (AC-21a).** Main is the first building of the source whose type code is `MAIN`, else the first building; the others keep the source's order. In all four Demo Malls sources that building is already listed first, so the rule changes no source's order today. Meridian Twin Malls has three `MAIN`-type buildings, so "Building A" is its main building by this rule; the owner may prefer another, and the choice is one line of the converter. *Alternative:* the building with the largest footprint, which I could not compute without running code and which would need a tie rule.

## 10. Cross-spec dependencies (for the coordinator, not the owner)

Two other spec-writers are working now, and this spec depends on four of their open decisions.

- **X1 `spec/P0-03.md` r4: the cost pairs and the settings.** P0-03 r4 is the single source of the edge costs in seconds (every edge finite, at least 0, to at least 0.001 s), a real length in metres for every edge, `routing.stairsSaveS`, and the other-way margin (0.5 m of walking converted at the walking rate), as the coordinator stated. AC-7 seeds the four `ConnectorType` pairs of OA-2 §5 H-4 and the `DEFAULTS` entries by citing r4, without restating a formula or a value. Confirm that r4 states the same four pairs and the `CostModel` for each, that `ConnectorType`'s columns are `CostBaseS` and `CostPerRiseS` (`DECIMAL(9,3)` meets the 0.001 s precision), and the exact setting keys and defaults to put in `DEFAULTS`.
- **X2 P0-03 r4 / FF-3′: the connector footprint.** The document requires a footprint (`x`, `z`, size) and stops. If the engine treats a footprint as a blocker, a pin snapped onto walkable floor may lie inside its own connector's footprint. DC-13 sets the footprint at the unsnapped pin, with default size. If r4 wants something else (for example no footprint blocking, or a landing offset), this spec's AC-17 changes.
- **X3 FF-3′ (A1′), the door node for an ADD_PATH end (office-adoption O4).** The converter's ADD_PATH starts at a door's midpoint; r4 must join that end to the door's node. If r4 uses a different snapping distance than the converter's maximum, a backup path may not join.
- **X4 `spec/P0-11.md` r3 (OA-4).** OA-4b-1's Stores panel routes (r3 AC-108 to AC-121) call OA-3d's one store writer (AC-41a, DC-26), which takes the venue lock and uses AC-11's loader (OA-2 §11); r3 should cite AC-41a and not restate those rules. The connector panel reads the cost fields from AC-7a's `connector-types` lookup. The editor's export and import buttons depend on AC-34 to AC-38's messages and codes, and OA-4's autosave on AC-9's 400 body. Confirm P0-11 r3 cites these, and that it does not expect a different file name or a `file` field other than `{ file, baseVersion }`.

## 11. Not in scope

- **The publish engine and everything it does:** the package, the warnings, seconds costing, the check that a walkway crosses a wall, the snapshot read of `Occupant` and `Beacon` rows, the publish screen (FF-3′, `spec/P0-03.md` r4). What the `routing.*` and `perf.*` settings mean and how they are used (P0-03 r4, P0-06 r5); OA-3 only puts r4's seconds settings into `DEFAULTS` (AC-7).
- **The editor and its panels:** drawing, the Stores panel and its routes, export and import buttons, backdrops, history (OA-4); the 3D preview (OA-6); AI conversion (OA-5).
- **Store, beacon and closure routes and screens:** OA-4's stores, FF-11's beacons, P1-01's closures. OA-3 builds only their key check and loader.
- **The penthouse's own content, beyond seeding it locally,** and any export file in git. The penthouse in any release, package, cloud environment or public page (L48).
- **Roles and permissions (R2), audit rows (R3), zod (R5), automated e2e (R12),** and any maintenance screen for `stores.newStoreStatusCode` or the object types (R9, R11).
- **A georeference for any seeded venue** (none for Demo Malls, P0-02 G1); mall detection (P0-04).
- **Landmarks:** the converters write no `anchors` (P0-02 C4).
- **Backdrops in the export file** (office §8.7); formats other than `gabay.venue-map` version 1; a change to the `ELEMENT_KEY` pattern; writes to the L42-gated analytics tables.
- **Anything off this machine:** no cloud project, no deploy (E-20 rules 1 to 3). Exported files stay here and never enter git.
- **Merging OA-2, and `spec/P0-01.md` r4** (already written); **fixing verify's schema re-run**, which wipes hand-made data (P0-02 §5).

## 12. Questions, as ruled

The product owner (Genesis Perez) ruled all three on 2026-10-14 in the spec sitting, each option (a), as recommended. Each ruling is applied where it is named. The options offered stay below as the record. No question is open.

**Q1 [spec-writer] O3: the snapping maximum, and what happens beyond it (§6.1). Ruled 2026-10-14 by the product owner: (a).** Applied in AC-14 to AC-16, AC-22, DC-12 and §6.1. The maximum decides how far a stair, escalator or lift pin may move on the shopper's map, and how many pins fall to an ADD_PATH path instead. I could not read A1's distances or run the converter, so I do not have the histogram.
- **(a) (Ruled.) 5 m.** A pin within 5 m of walkable floor on its level moves to the nearest point; a farther one stays and gets an ADD_PATH line. 5 m is the figure A1 itself used for "far" (Bayview: 50 of 93 pins are beyond it, so that mall gets about 50 ADD_PATH lines). Every move and its distance is in the report, so the figure can be changed in one named constant at sign-off.
- (b) 10 m. Fewer ADD_PATH lines, bigger moves of the pin on the shopper's map; no figure of mine supports it.
- (c) Never move a pin: every off-floor pin gets an ADD_PATH line. The map keeps exactly the source's pins, and about every pin in all four malls is a correction.

**Q2 [spec-writer] O7: which mall object types the catalog gets, and their sizes (§6.2). Ruled 2026-10-14 by the product owner: (a).** Applied in AC-28 and §6.2; the sizes are marked RECALLED starting values.
- **(a) (Ruled.) Add `KIOSK`, `STALL`, `BENCH` and `PLANTER` with the starting sizes in §6.2.** They are the library names the schema's own comment lists (L39); the sizes are my RECALLED starting values and are editable per mall later.
- (b) Add the four with no default sizes and no resize ranges, as the three existing types are: nothing invented, but every placed item must carry its own size (OA-1 G13), so the editor's catalog has nothing to offer on placement.
- (c) None now ("later"): the catalog keeps `PILLAR`, `SHAFT` and `FURNITURE` only.

**Q3 [spec-writer] The sizing rule for extent and elevation (AC-23). Ruled 2026-10-14 by the product owner: (a).** Applied in AC-23, DC-16 and §8. Q15 ruled "the largest seed × 2, rounded up" for levels, walls, openings, rooms, items and connectors. It did not rule the site and level extent, the elevation range, buildings, corrections, points and polygon points. OA-1 DC-8 says OA-3 may raise them "only from a measured seed". Bayview's site (1,300 × 760 m, about 988,000 m²) is far above PRD §7's "about 100,000 m² per site".
- **(a) (Ruled.) The same rule for every measured cap, extent and elevation included.** Extent becomes 2,600 m (2 × 1,300, rounded up), a venue bigger than Bayview's site is still accepted, and one rule is easier to explain. The cost: the validator would accept sites about 20 times PRD §7's size.
- (b) The same rule for the counts (buildings, corrections, points, polygon points), and the largest seed, rounded up, with no doubling, for extent and elevation: extent 1,300 m. The validator then refuses anything larger than Bayview's site.
- (c) Keep extent at PRD §7's scale (about 320 m a side) and treat Bayview's seed site as an exception to be reduced. This changes a ruled seed (L119) and is not recommended.

## Suggestions

- Add to `npm run seed` a first check that the schema is 0.16 (for example that `Occupant.UnitKey` exists), and stop with one line naming `npm run migrate`, as P0-02 AC-23 stops on a version (EC-36).
- A partial unique index "one active store per unit" in the database (106 indexes), so P0-11 G7 holds even for a writer that skips the service (DC-4).
- `tools/lint/test/schema-drops.test.js` names "(56 tables, 56 drops)" in its title; it should name the count by computing it, so the next table change does not touch its text.
- Print the report's unresolved list as a non-zero count in `npm run seed`'s last line, so a regression in the fix is seen at once.

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-14 | First revision, from the intent, OA-2 r1 §5 as built (`oa2-map-storage`, unmerged), OA-1 r1, `spec/P0-02.md` r2, the re-plan 1.0 and the records L173 to L176. Carries H-1 to H-10 as AC-1 to AC-47 (with AC-7a, AC-21a and AC-41a), proposes O3 and O7, and measures Q15. Folds in the owner's Q18 ruling (L176: the main building first, AC-21a, DC-25) and the coordinator's note that P0-03 r4 is the single source of the seconds costs and settings (AC-7, X1). Adds, from the main session's cross-spec decisions (L174, technical, listed for sign-off): AC-7a (the `connector-types` lookup with the cost fields, DC-27) and AC-41a (one store writer shared with OA-4b-1, DC-26). The owner's sitting of 2026-10-14 ruled Q1 to Q3, all (a), and they are written into r1: O3 is 5 m (AC-15, §6.1); O7 adds `KIOSK`, `STALL`, `BENCH` and `PLANTER` with RECALLED starting sizes (AC-28, §6.2); one sizing rule covers every measured cap, so the extent cap becomes 2,600 m and the validator accepts sites about 20 times PRD §7's size (AC-23). No question is open. The design choices are listed for sign-off (§9). `spec/P0-02.md` r3 withdraws the criteria listed in §5.2 |
| r1 (owner's sitting) | 2026-10-14 | The product owner (Genesis Perez) ruled Q1 to Q3, all option (a), as recommended; written into r1 itself, because no plan cites it yet. Q1 (O3): the snapping maximum is 5 m (`SEED_SNAP_MAX_M`), a farther pin gets an ADD_PATH line, every move is in the report (AC-15, DC-12, §6.1). Q2 (O7): `KIOSK`, `STALL`, `BENCH` and `PLANTER` are added with the §6.2 sizes, marked RECALLED starting values, editable per mall (AC-28, §6.2). Q3: one rule, the largest seed × 2 rounded up, for every measured cap, extent and elevation included; the extent cap becomes 2,600 m and the validator accepts sites about 20 times PRD §7's size (AC-23, DC-16, §8). "Pending the owner" wording removed; §12 retitled "Questions, as ruled"; the status line says no question is open. No criterion added, removed or renumbered |
