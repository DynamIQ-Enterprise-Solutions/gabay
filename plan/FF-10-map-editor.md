# FF-10-map-editor — P0-11: the map editor on the admin page (E-20)

> **Version**: 1.0 | **Date**: 2026-10-12 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (the plan batch, `plan/FF-4-11-plan-batch.md`; recorded in plan.html with the batch) | **Spec**: `spec/P0-11.md` r2 (AC-1 to AC-57, the edge cases of §3, DC-1 to DC-21; Q1 to Q21 ruled); `spec/P0-01.md` r3, the parts tagged [FF-10] (AC-34's drawn boundary, AC-39, AC-41, B4 as amended by G12); `spec/P0-03.md` r3, the parts tagged [FF-10] (AC-83 to AC-86, EC-51 to EC-58, DC-14, DC-15) | **Intent**: `intent/P0-11-map-editor.md` | **Parent**: `plan/PH4-feature-first.md` 1.0 §4, row FF-10 (L153, EXCEPTIONS E-20); runs beside FF-9 (decision sheet F1) | **Builds on**: FF-0 (`plan/FF0-dev-stub-lookups.md` 1.2), FF-SK (`plan/FF-SK-dashboards.md` 1.0), FF-1 (`plan/FF-1-venue-setup.md` 1.0), FF-2 (`plan/FF-2-test-seeds.md`), FF-3 (`plan/FF-3-publish-engine.md` 1.0, as amended by R32) | **Pipeline entry**: P0-11 | **Approver**: Genesis Perez, product owner
>
> **Rulings this plan applies, never re-asks:** `plan/FF-5-11-decisions.md` (APPROVED 2026-10-12, L165): A3, A5, A7, A21, A23, A25, A26, F1, G1 to G13, §L, §M 1 and 4 (N4 = 10 MB, N9's fallback); `plan/FF-5-11-residual.md` (APPROVED 2026-10-12): R13, R14, R15, R32, R33, R34, R35; `plan/FF-1-4-decisions.md` (APPROVED 2026-10-09): B1, B4, B5, B10, B14, D2, D11, D12, D13, D16, §G3, §G4; L164 (every PUT sends every field; Sonnet 5.5 is the default coder, Opus 5.5 takes engine and high-risk work).
>
> **Read for this plan:** CLAUDE.md; WORKING_AGREEMENT 1.16; the `gabay-product-rulings` skill; PH4 1.0 (§1, §4, §5, §6, §7); the three specs above; the three decision sheets; `db/schema.sql` 0.14 (`Venue`, `Level`, `Unit`, `Opening`, `FloorUnderlay`, `FloorObject`, `Occupant`, `Amenity`, `TransitPoint`, `Anchor`, `NavConnector`, `NavConnectorStop`, `NavCorrection`, `StoredFile`, `StoreStatusChange`, the lookups); `db/SCHEMA_READING_GUIDE.md`; `db/migrations/README.md`; Blueprint Part 1 (pins), Part 3, §4.6, §4.15; EXCEPTIONS (E-04 as widened, E-20); `Engineering Standards.html` §1 (read this session: it does not name `package:web`); FF-1 1.0 and FF-3 1.0; `functions/src/services/lookup.service.js`; `app/lib/shared/forms/*`; `app/test/forms/lookup_service_test.dart`; FF-SK's registry and its test on `ff-sk-client`; `db/seeds/lib/demo.js` line 26 and `spike.js` line 30 (where the seeds write `BoundaryGeoJson`).

## 0. Where FF-10 sits

- **Under E-20 (L153).** Localhost only, no deploy, throwaway data. The routes sit in FF-0's "admin features (E-20)" group behind `devStub.js`; the tenant comes only from `req.tenantCompanyID` (rule 2).
- **Order.** FF-10 is map step 10. It runs beside FF-9 (F1): FF-9 needs FF-10's confirmed penthouse doors for its on-site run (N11), and FF-10 needs nothing from FF-9.
- **What it unblocks.** MEZZ office and the penthouse can publish once their `NeedsReview` doors are confirmed (P0-03 AC-67, D13); FF-11 plans on the levels the editor draws (FEATURE_PIPELINE P0-12 dependency).
- **The spec revision moved past nothing:** P0-11 is at r2, P0-01 at r3 and P0-03 at r3 on this branch; this plan cites exactly those.

## 1. What FF-10 delivers

On localhost, in the admin page, the "Map editor" module (FF-SK's registry entry flips to built) opens a venue and shows one level at a time on a `flutter_map` canvas with `CrsSimple` in the venue's one planar frame (E-04 as widened, D12; E10):

- the three P0 modes on one canvas, every tool on every level (G5): grid boxes with the object library, free polygons, and tracing over a floor-plan image;
- move, resize and rotate for every shape; doors with clear width and entrance mark; stores with "spoken as", status and walk-through mark; amenities, transit points and landmarks; nested sections; stairs, escalators, ramps and lifts with their stops, "spoken as", direction, rise and "Evacuation only"; connector costs shown read-only (A23);
- graph corrections, the derived walkable area and a preview of the walkways (G3), from one server derivation (P0-03 AC-83);
- the venue boundary and building footprints drawn as polygons, with `Venue.BoundaryIsDrawn` (G4; schema 0.15; R35), the seeds starting drawn (R13);
- the review list and Confirm (L108), so MEZZ and the penthouse can publish;
- one all-or-nothing Save (G1), with Undo, Redo and Discard (G2), and the floor-plan image sent inside it (A21);
- "Open in editor" on FF-3's publish problem rows (P0-03 AC-86) and Publish from the editor (DC-12);
- pieces of R11 built early to R11's definition and recorded in FF-10's slice row (A23): §3.15 uploads, whole, for the `UNDERLAY` purpose; the `memo` form kind; the `fk` with `upload:` form kind.

**Not in FF-10** (spec §7): CAD/IMDF import and drafts (P1-03); assisted tools (P3-04); beacon editing (FF-9, FF-11); the georeference; evacuation mode and `EvacEscalatorsAllowed` (P3-02); door rules and hours (P2-02); closures and live status (P1-01); lookup maintenance screens and tenant lookup values (R11); store logos (A21); any other upload purpose; moving elements between levels, copy and paste, multi-select; server role guards, audit rows, zod, rate limits, automated e2e (R1 to R12); Tagalog (A3: English by design); any deploy.

## 2. Dependencies

| Needs | Why | State on 2026-10-12 |
|---|---|---|
| FF-0 (server and client) | The stub, the lookups route, `lookupFetcher` | Merged |
| FF-SK | The admin shell, the module registry and its read-only marker (AC-46), the switcher (`X-Dev-Act-As`, `X-Tenant-Id`) | In flight (`ff-sk-server`, `ff-sk-client`) |
| FF-1 | `lockVenue` (`FOR NO KEY UPDATE`), `fieldInput.js`, `idParam.js`, `foreignKeyInUse.js`, `venueBoundary.js`, `ColKind.decimal`, refresh on return, the delete confirmation, the venue screens | In flight (`ff1-server*`) |
| FF-2 | Demo Malls and Spike Venues seeded, MEZZ's `NeedsReview` doors | Planned |
| FF-3 | The engine's walkable-area derivation and graph generator (reused by the preview, AC-83); the storage interface (`functions/src/services/storage/`, reused for underlays, DC-16); the drawing route (AC-73); the publish screen (AC-86); **the constants file in A26's shape (R32)** | Planned |
| FF-5 | Adds the refuge and assembly-area set (P0-03 AC-88) to the constants file. FF-10 needs no FF-5 code: the editor places those as ordinary amenity types (G9) | Planned |

**Entry condition:** each coder starts only when the slices their part reads have merged: the server half needs FF-1's server, FF-2 and FF-3; the client half needs FF-SK and FF-1's client and FF-3's publish screen. As in FF-1 (B15), a half whose inputs are missing waits; the other half starts.

## 3. The schema change: 0.14 → 0.15 (api-coder; G4, R35; rule 4)

- **New migration** `db/migrations/NNNN_venue_boundary_is_drawn.sql`, NNNN the next zero-padded number at build time (none exist today, so likely `0001`; see §11 for R2's `0001` assumption):

  ```sql
  ALTER TABLE gabay.Venue ADD COLUMN IF NOT EXISTS BoundaryIsDrawn BOOLEAN NOT NULL DEFAULT FALSE;

  -- verify:
  -- SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
  --  WHERE table_schema = 'gabay' AND table_name = 'venue' AND column_name = 'boundaryisdrawn';
  ```

  Idempotent, one transaction, a verify query (`db/migrations/README.md` rules 1 to 6). No other database object changes.
- **`db/schema.sql`** goes to **DRAFT 0.15**: the column in `Venue` after `BoundaryGeoJson`, with its comment ("G4: TRUE once the admin draws the boundary in the map editor; while FALSE, P0-01 AC-34 derives it from the levels; set only by the editor's save and Reset, and by the seed"), and a header line for 0.15 citing G4 and R35. Still 56 tables; no index added, so `setup-db`'s index count is unchanged.
- **Same change:** Blueprint Part 3 (§3.3 `Venue`), `db/SCHEMA_READING_GUIDE.md` (§3: the flag, one line), and the `FieldSpec`s: none changes, because the flag is never a form input (P0-01 AC-19); `schema-forms-real.test.js` stays green.
- **Seeds (R13):** `db/seeds/lib/demo.js` and `spike.js` write `BoundaryIsDrawn: true` on every seeded venue. No P0-02 revision (§L). The penthouse converter (internal, not in git) follows the same `spike.js` path.
- **FF-1's boundary refresh honours the flag:** `venueBoundary.refreshBoundary` returns without writing while `BoundaryIsDrawn` is TRUE (P0-01 AC-34 r3). It already runs under `lockVenue`, so a level write and an editor boundary save on one venue serialise (P0-01 r3's concurrent-edit edge case).

## 4. The server part

### 4.1 Files (api-coder unless marked)

| File | Responsibility |
|---|---|
| `functions/src/routes/editor.js` | The editor routes of §4.2, mounted in `routes/api.js`'s "admin features (E-20)" group behind `devStub` |
| `functions/src/services/editor/editorLoad.service.js` | The venue header and the level load (AC-1, AC-2, DC-6); active beacons read-only |
| `functions/src/services/editor/editorSave.service.js` | The batch Save (§4.4): one transaction under `lockVenue`, token checks, references, writes, history, confirms |
| `functions/src/services/editor/editorElements.js` | Per-table field readers and writers (one entry per element table: its columns, its required fields, its references), so the save service has one loop, not eleven copies (C2) |
| `functions/src/services/editor/editorGeometry.js` | Box → polygon (DC-3), the structure check (DC-5), rounding to the column scale (DC-4); shared with FF-11's position check |
| `functions/src/services/editor/editorDeletes.js` | G12: a unit with its own doors; refusals naming what a unit still holds; a store with history deactivated; a lift with its stops; an underlay with its file (R15) |
| `functions/src/services/editor/editorReview.service.js` | The review list (AC-37) over the four `IX_*_NeedsReview` partial indexes |
| `functions/src/services/editor/boundaryToken.js` | DC-21's separate token for the boundary and footprints (DC-F3) |
| `functions/src/services/uploads/underlayUpload.js` | §3.15 for `UNDERLAY`: the `multer` instance (memory storage, `limits.fileSize` and `limits.files` from the upload config), type sniffing, SHA-256, the storage key, compensation on a refused Save (§4.5) |
| `functions/src/services/storage/fileStore.js` | FF-3's storage interface (`put`, `get`, `exists`, `remove`) generalised to any `StoredFile.Purpose` by key prefix; the package store becomes its first user (second use, C2; DC-F5) |
| `functions/src/services/engines/previewLevel.js` (**engine-coder**) | P0-03 AC-83: the level's walkable area by AC-24's own code, and on request the walkways by the publish generator's own code, for the saved draft in one snapshot; nothing stored |
| `functions/src/routes/preview.js` (**engine-coder**, route shell by api-coder) | `GET /api/venues/:venueId/levels/:levelId/preview` (P0-03 DC-14) |
| The constants file (path as FF-3's plan amended by R32 names it) | FF-10's sets with their authority comments: IMDF unit categories and opening categories ("IMDF 1.0.0", RECALLED until checked, §12 step 0), `ShapeKind`, `CorrectionKind`, DC-8's category → walkable map |
| The shared upload config (beside the constants file, A21, A26) | `UNDERLAY`: MIME set `image/png`, `image/jpeg`; cap 10,485,760 bytes (N4, 10 MB, read as 10 × 1024 × 1024: DC-F7); `maxFilesPerSave` (DC-F6). Read by the API and, through the same generated Dart file, by the app |
| `functions/src/services/lookup.service.js` | Four allow-list entries: `occupant-categories`, `store-statuses`, `connector-types`, `object-types` (AC-43; L154 ruling 3), each with its literal SQL and the global-lookup trap |
| `functions/src/services/editor/typeDetails.service.js` | One read for a chosen type's extra columns: `object-types` (default sizes, `BlocksWalk`) and `connector-types` (`CostModel`, `IsStepFree`, `CostBaseM`, `CostPerRiseM`), from an allow-list (rule 3; DC-F4) |

FEATURE_PIPELINE names `routes/editor/*` and `services/editor.service.js`; the split above is DC-F1.

### 4.2 Routes (behind `devStub`; tenant = `req.tenantCompanyID` only; ids through `parseIdParam`)

| Method and path | Does | Success | Spec |
|---|---|---|---|
| `GET /api/venues/:venueId/editor` | The venue header: name, boundary, `boundaryIsDrawn`, `boundaryToken`; buildings with footprint and `footprintToken`; levels (chips: id, building, name, short name, ordinal, outdoor, width, depth, grid cell, elevation, ceiling height) in AC-1's order | 200 | AC-1, AC-24, AC-25, DC-18, DC-21 |
| `GET /api/venues/:venueId/levels/:levelId/editor` | One level whole (DC-6): units, doors, floor objects, underlay (calibration only; the image through the next route), stores, amenities, transit points, landmarks, connector ends and lift stops on that level, corrections, active beacons (read-only); each element with id, properties, geometry in level metres and `updatedAt`; lookup labels joined with their `isActive` | 200 | AC-2, AC-44 |
| `GET /api/venues/:venueId/levels/:levelId/underlay/file` | Streams the level's underlay image from the file store (no static mount, §3.15); 404 when there is none or the stored file is missing | 200 bytes | AC-8, §3 "underlay file missing" |
| `GET /api/venues/:venueId/editor/review?page=&pageSize=` | The review list: every `Unit`, `Opening`, `FloorObject` and `NavConnector` of the venue with `NeedsReview`, with kind, name, level and `DraftConfidence`, paged through `runPaged` over one `UNION ALL` (one where clause for the count and the page, A.8) | 200 envelope | AC-37 |
| `POST /api/venues/:venueId/editor/save` | The batch Save (§4.4), `multipart/form-data`: a `batch` JSON field and zero or more image parts | 200 `{ idMap, elements }` | AC-27 to AC-36, AC-38, AC-8, AC-24, AC-25 |
| `GET /api/venues/:venueId/levels/:levelId/preview[?walkways=true]` | P0-03 AC-83: walkable area, and walkways on request, for the saved draft; nothing stored; runs during `BUILDING` | 200 | P0-11 AC-22, AC-23; P0-03 AC-83, AC-84 |
| `GET /api/editor/types/:name/:id` | The extra columns of one `object-types` or `connector-types` row, of the tenant or the platform, active or not | 200 | AC-6, AC-18, AC-19 |
| `GET /api/lookups/:name` and `/:name/:id` (existing) | Four new names (above) | 200 | AC-43 |

No route writes `VenueVersion` or a package (AC-4). Every route answers 404 for another tenant's venue, level, element or file, and for a level not in the named venue (AC-48); `X-Tenant-Id` naming a tenant the acting user lacks answers 403 (FF-0).

### 4.3 JSON contract (the parallel-build contract for flutter-coder)

As FF-1 §2.3: camelCase; **decimals travel as strings both ways** (`"12.500"`); timestamps ISO 8601 with milliseconds; errors `{ "error": "<message for a person>" }`, a 400 naming the element and the field ("Store 12 on Level 2: Name is required"); geometry is GeoJSON in level metres (`Polygon` for units, polygon objects, `BLOCK_AREA`, the boundary and footprints; `LineString` for doors, `ADD_PATH` and `REMOVE_PATH`; points as `x`, `y` strings).

```jsonc
// The batch (the "batch" field of the multipart Save)
{
  "boundary": { "action": "draw", "geometry": { "type": "Polygon", "coordinates": [...] }, "token": "<sha256>" }
           // or { "action": "reset", "token": "<sha256>" }; absent = unchanged
  "footprints": [ { "buildingId": 40, "geometry": {...} | null, "token": "<sha256>" } ],
  "creates":  [ { "table": "unit", "clientId": "new-1", "levelId": 77, "fields": { ...every field... } },
                { "table": "opening", "clientId": "new-2", "levelId": 77, "fields": { "unitRef": "new-1", ... } },
                { "table": "floorUnderlay", "clientId": "new-3", "levelId": 77, "fields": { "filePart": "img-1", "pxAx": "12.00", ... } } ],
  "updates":  [ { "table": "occupant", "id": 501, "updatedAt": "2026-10-12T01:02:03.456Z" | null, "fields": { ...every field... } } ],
  "deletes":  [ { "table": "unit", "id": 88, "updatedAt": "..." | null } ],
  "confirms": [ { "table": "opening", "id": 12, "updatedAt": "..." | null } ]
}
// Success: { "idMap": { "new-1": 9001, "new-2": 9002, ... }, "elements": [ ...each changed element, reloaded, with its new updatedAt ... ] }
// A reference to an element created in the same batch uses its clientId (unitRef, parentRef, connectorRef, filePart);
// a reference to a saved element uses its id. An update sends every field of the element (L164).
```

- **Tables** (a closed set in the save service): `unit`, `opening`, `floorObject`, `floorUnderlay`, `occupant`, `amenity`, `transitPoint`, `anchor`, `navConnector`, `navConnectorStop`, `navCorrection`.
- **Server-set keys** (`tenantId`, `venueId`, the audit stamps, a box's `geometry`, a lift's From end, `boundaryIsDrawn`, a file's MIME, size, hash and key, `needsReview`, `draftConfidence`, `logoFileId`, connector-type costs): ignored, never written (AC-36, AC-13, AC-18).
- **Unknown keys** are ignored until R5's zod (spec §3 invalid input).

### 4.4 The Save (one transaction; G1)

1. **Parse.** `multer` reads the parts (memory storage; `limits.fileSize` = the underlay cap; `limits.files` = `maxFilesPerSave`; `limits.fieldSize` = `MAX_JSON_BODY`, 5 MB). A cap exceeded answers **413** in the standard shape, naming the file or "the changes" (AC-31). Each image part's type is decided from its first bytes (PNG and JPEG signatures), never from its name or its declared type; anything else, or an empty part, is 400 naming the file (AC-8).
2. **Store the new images first** (§4.5): `fileStore.put` under a generated key; on any later failure they are removed (compensation).
3. **Lock.** `db.withTransaction`; first statement `lockVenue(tx, tenantId, venueId)` (FF-1's `FOR NO KEY UPDATE`). Every editor Save, and every FF-1 level write and delete, takes this one lock first, so two Saves on one venue, or a Save and a level write, never interleave. This is how the one-active-store-per-unit rule (G7), the one-underlay-per-level rule (AC-8) and the boundary flag (P0-01 r3) hold against two requests at the same moment: there is no unique index for any of them, and none is added (DC-F2).
4. **Check every token before any write.** Each update, delete and confirm carries the `updatedAt` it loaded (empty for a row never edited); each boundary or footprint change carries its token (DC-F3). All clashes are collected, then the whole Save is refused with **409** naming each element ("Someone else changed Store 12 on Level 2. Reload to see their change"; a deleted row: "Store 12 on Level 2 was removed by someone else"). Nothing is written (AC-28).
5. **Check every value and reference** (AC-32, AC-33): lengths in characters (FF-1 DC-5), FF-1's decimal pattern and scales, the box CHECK shapes, rotation 0 to under 360, a lift with To fields or a non-lift with stops, the structure rules (DC-5), closed-set values against the constants file, every level, unit, connector, building and file of the request's tenant and this venue, same-level rules for units, doors, objects, amenities, landmarks, stores and sections, a lift stop's level in the connector's venue (through the connector, `NavConnectorStop` has no `VenueId`), lookup ids of the platform or the tenant and active for a new reference (P0-01 B10). All refusals are collected and returned together as 400 (404 for another tenant's id). Never a 500 from a constraint the service could check (standard §3.8).
6. **Write** in a fixed order: deletes (G12, §4.6), then creates (parents before children, resolving `clientId`s), then updates, then confirms; then the boundary and footprints. Updates use FF-1's conditional `UPDATE … WHERE UpdatedAt IS NOT DISTINCT FROM $token`, setting `UpdatedAt = GREATEST(clock_timestamp(), previous + 1 ms)` (FF-1 DC-6). Editing any field or the geometry of an unreviewed element, or confirming it, sets `NeedsReview = FALSE`; `DraftConfidence` is kept (AC-38, DC-11).
7. **Store rules** (AC-13): a new store starts at the platform `OPEN` status (looked up by code from the seed, never by label) and writes **no** history row (R14); a status change on an existing store writes one `StoreStatusChange` (store, its unit at the time, old and new status, the actor); a second active store on a unit is refused with 409 naming the first (G7).
8. **Box geometry and lift ends** are derived on the server (DC-3, DC-20).
9. **Commit**, then remove the files of replaced or deleted underlays (R15); a failed removal is logged and the Save still answers success.
10. **Answer** with the `idMap` and the changed elements reloaded.

A publish of the venue in `BUILDING` does not block a Save: publish reads its own snapshot (P0-03 AC-8, DC-2), so the Save lands in the next version (AC-35).

### 4.5 Uploads: §3.15 built whole for `UNDERLAY` (A21; PH3 §9)

- A per-feature `multer` instance in the route file, with the limits above; the user's file name never reaches a path or a key (AC-8).
- **Storage** through FF-3's interface, generalised (DC-F5): key `underlays/<tenantId>/<venueId>/<levelId>/<sha256>.<png|jpg>`, never a disk path; written to a temporary name and renamed (FF-3 DC-P7); the git-ignored local folder; the move to Cloud Storage is P0-03's storage ledger row, extended to name underlays.
- **The row:** `StoredFile` with `Purpose = 'UNDERLAY'`, the request's tenant, `MimeType` from the sniffed type, `SizeBytes`, `Sha256`, `StoragePath` = the key; `FloorUnderlay.FileId` points at it through the composite FK.
- **A refused Save keeps nothing:** the transaction rolls back the rows, and the images stored in step 2 are removed (a failed removal is logged; tested by injecting a refusal after the store).
- **Replace and delete (R15):** a new image for a level that has one deletes the old `FloorUnderlay` and `StoredFile` rows in the transaction and removes the old file after the commit.
- **Serving:** only `GET …/underlay/file`, streamed, with the stored MIME type, under the request's tenant.
- The underlay never enters a package (P0-03 §3.7, D11).

### 4.6 Deletes (G12; P0-01 B4 as amended in r3)

- A unit is deleted with its own doors in one action. It is refused with 409 naming what it still holds: sections, a store (active or not), floor objects, amenities, and landmarks per Q2 (§13).
- A store with status history is deactivated, never deleted; a store never changed has no history (R14) and is deleted.
- A connector is deleted with its lift stops.
- An underlay is deleted with its file (R15).
- Venues, buildings and levels keep FF-1's rule: a level still referenced by any element is refused with FF-1's 409 naming it; deleting a level never deletes elements (P0-01 r3).

### 4.7 The derived walkable area and the walkway preview (engine-coder; G3, A25)

- `previewLevel(snapshot, levelId, { walkways })` calls the engine's own walkable-area function (P0-03 AC-24) and its own graph generator (AC-31), with the settings in force, on a draft snapshot read in one consistent transaction as publish reads it (DC-2). There is one derivation and no copy in Dart (AC-22).
- The walkways are the edge kinds AC-73 returns for a published version, same-height joins included, each with kind and end points.
- No validation runs: a draft publish would refuse still previews (EC-51); an unreadable shape is left out and listed (DC-15).
- Nothing is stored: no `VenueVersion`, `StoredFile`, package or graph row (AC-23).
- The time and peak memory on Aurora's largest level and one level of the synthetic 100,000 m² venue are measured and pasted in the PR, with no gate (AC-85, A5).

## 5. The client part (flutter-coder)

### 5.1 Shared machinery built to R11's definition (A23; recorded in FF-10's slice row)

- **`ColKind.memo`** (PH3 §4.2): multiline text capped at the column's VARCHAR width; first use `Occupant.SearchKeywords` (VARCHAR(400), AC-13).
- **`fk` with `upload:`** (PH3 §4.1, DC10): `upload: UploadPurpose.underlay`, a file chooser, the file's name and size, Remove; the accepted types and the cap from the shared upload config through the generated Dart file; the client refuses a wrong type or an oversized file before sending (AC-8).
- **The file chooser** through `package:web`'s file input (A21). `Engineering Standards.html` §1 (read this session) does not name it, so it needs **EXCEPTIONS E-23** and a Blueprint Part 1 pin, its version read from pub.dev at FF-10's start (C8). Its API is RECALLED until checked (§12 step 0).
- **The schema-forms linter** learns `memo` and `upload:` rows only as far as R11 §5 defines them (`upload:` only on an FK to `StoredFile`, its purpose in the CHECK), with fixture tests, if R11-2's rows are not yet built; otherwise unchanged.

### 5.2 Feature files: `app/lib/features/editor/`

| Part | Responsibility |
|---|---|
| `editor_service.dart` | The routes of §4.2 through the one `ApiClient`; the multipart Save |
| `editor_view_model.dart` (Riverpod) | The loaded venue and levels, the unsaved change log (DC-17), Undo and Redo over it (G2), the count of unsaved changes, the in-flight Save (Save disabled while one runs, AC-27) |
| `canvas/editor_canvas.dart` | `FlutterMap` with `CrsSimple` (E-04), the level rectangle and grid, layers for each element kind, the underlay as a rotated image layer, the overlays, the selection and highlight; colours only from `colorScheme` (rule 6) |
| `canvas/tools/` | Box, polygon, door, point (amenity, transit point, landmark), connector end and lift stop, correction, boundary and footprint tools; snapping (DC-2); handles for move, resize and rotate (DC-4 rounding) |
| `canvas/projection.dart` | Metres ↔ screen, tested on its own (AC-3) |
| `panels/` | One `FieldSpec` form per element kind (the Panel rule; rule 7), in sync with the canvas both ways (AC-10) |
| `review/review_list.dart` | The review list on S9's scaffold (AC-37) |
| `elements/element_list.dart` | DC-14's searchable list per level with a "needs review" filter, the keyboard and screen-reader way to select (AC-51) |
| `underlay/calibration.dart` | Two points and a typed distance (AC-8) |
| `overlays/` | The walkable area and the walkway preview, labelled "Preview of the saved draft" (AC-23) |

**Also touched:** FF-SK's registry (the "Map editor" entry built, its route `/venues/:venueId/editor`); FF-1's venue screen ("Map editor" entry; the venue form's boundary note in its two states, P0-01 AC-34 r3); FF-3's publish screen ("Open in editor" on every problem row with a level, P0-03 AC-86); `lookup_names.dart` (four names).

**Wording:** every string in `app_en.arb` with a description, on the English-by-design list (A3: "not applicable", not a waiver). Proposed: venue form note "The site outline covers the largest level until you draw it in the map editor." / "The site outline was drawn in the map editor."; changelog "You can now draw your floors, doors and connectors, and confirm a draft before publishing" (AC-54).

## 6. Who and order

0. **Step 0 (each coder, before code; evidence pasted):** the RECALLED checks of §12.
1. **test-verifier first** (Sonnet 5.5), in `Gabay-wt\api-coder` on `ff10-server-tests` from `main`: every server test of §7, failing, committed for the builders. flutter-coder writes its own widget tests first where it can.
2. **In parallel, each in its own working copy (L156 item 3):**
   - **api-coder** (Sonnet 5.5; A25, L164) on `ff10-server` from `ff10-server-tests`: §3, §4.1 to §4.6, the upload config, the four lookup names, the type-details route, the API manual.
   - **engine-coder** (Opus 5.5; A25, L164) in `Gabay-wt\engine-coder` on `ff10-preview` from `ff10-server-tests`: §4.7 and the preview route; merged into `ff10-server` before review.
   - **flutter-coder** (Sonnet 5.5) in `Gabay-wt\flutter-coder` on `ff10-client`: §5 against §4.3's contract with a fake `ApiClient`; the live API only after the server PR merges (manual cases, screenshots of real data).
3. **test-verifier** completes §7's table with results, in each copy, and pastes `npm run verify`.
4. **dod-reviewer** on each branch (affected tests, L156 item 5).
5. **Two pull requests, server first** (as FF-1), merged on the fast lane (L156 item 1) once ready and green.
6. **The product owner:** AC-50's demonstration and AC-39's penthouse confirm by hand; sign-off.

## 7. Tests first, and traceability

**Server tests** (`functions/test/`, real tables inside the rolled-back savepoint wrapper, L151): `editor.load`, `editor.save`, `editor.save.tokens`, `editor.stores`, `editor.delete`, `editor.boundary`, `editor.underlay`, `editor.review`, `editor.publishFixes`, `editor.inactiveLookups`, `editor.tenantBoundary`, `editor.typeDetails`, `editor.geometry` (unit), `lookups.editorNames`, `uploadConfig` (unit), `preview.api`, `engine.preview` (engine-coder), `preview.scale` (measured); `db/seeds/test/boundaryIsDrawn.test.js`. **Client tests** (`app/test/features/editor/`): `editor_projection_test`, `editor_transforms_test`, `editor_canvas_test`, `editor_tools_test`, `editor_panels_test`, `editor_batch_test`, `editor_underlay_test`, `editor_review_list_test`, `editor_overlays_test`, `editor_roles_test`, `editor_accessibility_test`, `editor_element_list_test`, `editor_inactive_type_test`, `editor_publish_entry_test`, `editor_registry_test`; `app/test/forms/memo_field_test.dart`, `upload_field_test.dart`; `app/test/features/admin/publish/publish_open_in_editor_test.dart`; `app/test/features/admin/venues/venue_form_boundary_note_test.dart`; scenarios in `screenshot_test.dart`. **Lint:** `tools/lint/test/schema-forms-editor.test.js`. Owner: test-verifier writes the server tests; flutter-coder the client tests; engine-coder `engine.preview`.

| AC / edge case | Test file(s) | Kind |
|---|---|---|
| P0-11 AC-1 chips, order, entry from the module and FF-1's venue screen | `editor.load`; `editor_canvas_test`, `editor_registry_test` | API; widget |
| AC-2 one load, every kind with id, geometry, `updatedAt`; beacons read-only | `editor.load`; `editor_canvas_test` | API; widget |
| AC-3 real scale at every zoom; 9.000 × 9.000 | `editor_projection_test`; `editor_canvas_test` | unit; widget |
| AC-4 never reads or writes `VenueVersion` | `editor.publishFixes` (a Save leaves every `VenueVersion` row unchanged); review | integration; review |
| AC-5 boxes, snapping, server-derived polygon with rotation | `editor.save`, `editor.geometry`; `editor_tools_test` | API; unit; widget |
| AC-6 object library: seeded types open empty and required; a fixture type prefills; `BlocksWalk` copied and overridable | `editor.save`, `editor.typeDetails`; `editor_panels_test` | API; widget |
| AC-7 free polygons; three points minimum | `editor.save`, `editor.geometry`; `editor_tools_test` | API; unit; widget |
| AC-8 underlay: PNG and JPG; wrong type, empty, exactly 10 MB, one byte over; path-like name; another tenant's file 404 and refused in a batch; missing 404; refused Save keeps no row or file; replace removes the old (R15); refused replace keeps the old; failed removal logged, Save succeeds; calibration metres; client refuses oversize | `editor.underlay`, `uploadConfig`; `editor_underlay_test`, `upload_field_test`; manual "trace a store" | API; unit; widget; manual |
| AC-9 every tool on every level, mixed | `editor_tools_test` | widget |
| AC-10 move, resize, rotate; panel and canvas in step | `editor_transforms_test`; `editor_panels_test` | unit; widget |
| AC-11 doors on a unit's edge, `LineString`, fields | `editor.save`; `editor_tools_test`, `editor_panels_test` | API; widget |
| AC-12 unit properties; walkable default (DC-8) | `editor.save`; `editor_panels_test` | API; widget |
| AC-13 stores: second active 409 (G7); status change writes one history row; no change writes none; create writes none and the store can then be deleted (R14); `SpokenName` in the package | `editor.stores`; `editor_panels_test`; `editor.publishFixes` (package carries `SpokenName`) | API; widget; integration |
| AC-14 walk-through on non-walkable units only | `editor.save`; `editor_panels_test` | API; widget |
| AC-15 amenities, unit proposed; refuge and assembly as types | `editor.save`; `editor_tools_test` | API; widget |
| AC-16 transit points | `editor.save`; `editor_panels_test` | API; widget |
| AC-17 landmarks | `editor.save`; `editor_tools_test` | API; widget |
| AC-18 connectors; costs read-only; one-way publishes From → To only | `editor.save`, `editor.typeDetails`; `editor_panels_test`; `editor.publishFixes` | API; widget; integration |
| AC-19 lifts: second stop on one level 409; To fields 400; From kept equal to a stop | `editor.save`; `editor_panels_test` | API; widget |
| AC-20 incomplete connectors save | `editor.save` | API |
| AC-21 corrections; `BLOCK_AREA` removes walkways at the next publish | `editor.save`; `editor_tools_test`; `editor.publishFixes` | API; widget; integration |
| AC-22 walkable area equals the generator's; nothing written | `preview.api`, `engine.preview`; `editor_overlays_test` | API; unit; widget |
| AC-23 walkway preview equals a publish of the same fixture for that level; no row in any table | `preview.api`, `engine.preview`; `editor_overlays_test` | API; unit; widget |
| AC-24 drawn boundary kept across a level create, edit, delete; Reset; zero-size or unclosed refused; seeds TRUE; migration and schema twice | `editor.boundary`; `db/seeds/test/boundaryIsDrawn.test.js`; `npm run verify`; the migration run (§8); `editor_tools_test` | API; seed; verify; widget |
| AC-25 footprints; building `UpdatedAt` unchanged | `editor.boundary`; `editor_tools_test` | API; widget |
| AC-26 sections: each refusal; three-deep accepted; outside the parent accepted | `editor.save`; `editor_tools_test` | API; widget |
| AC-27 one batch, all or nothing (underlay included); counter; double press saves once | `editor.save`, `editor.underlay`; `editor_batch_test` | API; widget |
| AC-28 stale element 409 naming each; never-edited token once, then stale | `editor.save.tokens`; `editor_batch_test` | API; widget |
| AC-29 leaving asks; level switch does not | `editor_batch_test`; manual (browser leave warning) | widget; manual |
| AC-30 Undo, Redo, Discard (default Cancel); an image is one change | `editor_batch_test` | widget |
| AC-31 errors through `formatApiError`; changes kept; 413 over 5 MB | `editor_batch_test`; `editor.save` | widget; API |
| AC-32 each value refusal | `editor.save`; `editor_panels_test` | API; widget |
| AC-33 each reference refusal, another tenant's `ConnectorTypeId`, another venue's level as a To end | `editor.save`, `editor.tenantBoundary` | API |
| AC-34 deletes allowed and refused; deleted underlay leaves no row or file | `editor.delete`, `editor.underlay`; `editor_tools_test` | API; widget |
| AC-35 Save during `BUILDING` lands in the next version | `editor.publishFixes` (P0-03 AC-8's test hook) | integration |
| AC-36 server-derived values ignored in a body | `editor.save` | API |
| AC-37 review list count equals MEZZ's seeded count; tap opens the level | `editor.review`; `editor_review_list_test` | API; widget |
| AC-38 Confirm and edit clear `NeedsReview`; `DraftConfidence` kept | `editor.review`, `editor.save`; `editor_review_list_test` | API; widget |
| AC-39 MEZZ: confirm every door through the save route, then `publish:dev` reports no "unreviewed" problem; the penthouse by hand | `editor.review` (integration); manual (product owner) | integration; manual |
| AC-40 one fixture per P0-03 refusal (AC-17's excepted), fixed through the save route, then publishes | `editor.publishFixes` | integration |
| AC-41 / P0-03 AC-86 "Open in editor" | `publish_open_in_editor_test` | widget |
| AC-42 Publish saves first; a refused save publishes nothing | `editor_publish_entry_test` | widget |
| AC-43 four new names: platform and own rows, active only, never another tenant's | `lookups.editorNames`; `editor_panels_test` | API; widget |
| AC-44 inactive type, one case per lookup (six) | `editor.inactiveLookups` (real route, service, database, rolled back); `editor_inactive_type_test`; manual cases in both manuals | integration; widget; manual |
| AC-45 panels are `FieldSpec`s; `memo`; `upload:`; read-only columns never inputs | `schema-forms-editor.test.js`, `schema-forms-real.test.js`; `memo_field_test`, `upload_field_test`; `npm run verify` | lint; widget; verify |
| AC-46 client hiding per role (four) | `editor_roles_test` | widget |
| AC-47 server roles | Waived to R1/R2 (§9); no FF-10 test, no role check exists before R2 | — |
| AC-48 tenant boundary on load, save, delete, file; 403 header | `editor.tenantBoundary`; `npm run verify` (`tenant-predicate`, `sql-interpolation`); manual | API; lint; manual |
| AC-49 package byte-identical before and after a Save | `editor.publishFixes` | integration |
| AC-50 the demonstration on Aurora and the phone | manual in `Smoke_Test_Guide.md`; screenshots in the slice report | manual |
| AC-51 screen-reader names; element list; ×1.4 at 320 px; panels in a sheet | `editor_accessibility_test`, `editor_element_list_test` | widget |
| AC-52 ARB, English-by-design list, colours | `npm run verify` (`colour-literals`, `flutter analyze`); review | lint; review |
| AC-53 screenshots | `screenshot_test.dart` scenarios | screenshot |
| AC-54 changelog | Stop hook and pre-commit pair | hook |
| AC-55 routes through the stub; stamps from the actor | every API file | API |
| AC-56 permission and menu rows | Waived to R2 | — |
| AC-57 automated e2e | Waived to R12; manual cases written now | manual |
| P0-01 r3 AC-34 (drawn boundary), AC-39 (no clash with FF-1's forms), AC-41 (flag FALSE on a new venue), B4 r3 (a level with only a lift stop refused naming lift stops) | `editor.boundary`, `editor.delete`; `venue_form_boundary_note_test` | API; widget |
| P0-03 AC-84 boundaries; AC-85 measured; EC-51 to EC-58 | `preview.api` (each case), `preview.scale` (measured, pasted) | API; integration |
| Edge: API lost mid-save, mid-load, mid-overlay | `editor_batch_test`, `editor_canvas_test`, `editor_overlays_test` | widget |
| Edge: stale level; reload with unsaved changes asks | `editor.save.tokens`; `editor_batch_test` | API; widget |
| Edge: preview of the saved draft labelled; refreshes after Save | `editor_overlays_test` | widget |
| Edge: tab closed | Manual only: a widget test cannot close a browser tab (spec) | manual |
| Edge: underlay file missing; failed removal | `editor.underlay`; `editor_underlay_test` | API; widget |
| Edge: a seeded venue's level edited keeps its boundary | `db/seeds/test/boundaryIsDrawn.test.js` | seed |
| Edge: no levels, empty level, outdoor only, Reset with no levels | `editor.boundary`, `editor.load`; `editor_canvas_test`, `editor_review_list_test` | API; widget |
| Edge: Aurora's busiest level and the synthetic venue | `preview.scale` and a measured load and save in the PR; no pass or fail (A5) | measured |
| Edge: lengths at maximum and one more, non-ASCII; decimal limits; rotation 359.99 and 360.00; dragged values rounded | `editor.save`, `editor.geometry`; `editor_panels_test` | API; unit; widget |
| Edge: batch over 5 MB; 10 MB and one byte over; empty file | `editor.save`, `editor.underlay` | API |
| Edge: hundreds of unreviewed elements page | `editor.review` (pageSize 2 over 3) | API |
| Edge: thousands of elements in one level load | measured in the PR (DC-6); no gate | measured |
| Edge: tenant boundary (each kind) | `editor.tenantBoundary` | API |
| Edge: each role's hiding; a VIEWER's save sent directly succeeds until R2 | `editor_roles_test`; not tested now (no role check before R2), on the ledger | widget; — |
| Edge: a 403 shown through `formatApiError` | `editor_batch_test` | widget |
| Edge: two admins, same element; different elements; delete versus edit; delete versus status change of a never-changed store; two stores on one unit; two underlays for one level | `editor.save.tokens`, `editor.stores`, `editor.underlay` (each in sequence, as FF-1's G4 ruling requires; the serialisation is the venue lock, §4.4, checked in review) | API; review |
| Edge: a level deleted or resized in FF-1 while open | `editor.save` (404 naming the level); `editor_canvas_test` (shapes outside with a note) | API; widget |
| Edge: a type deactivated while a panel is open | AC-44 | integration |
| Edge: boundary drawn while another admin creates a level | `editor.boundary` (in sequence) | API |
| Edge: Publish pressed while another publish runs | `editor_publish_entry_test` (FF-3's message shown) | widget |
| Edge: self-crossing polygon saved, publish refuses, marked; door off its outline saved; section outside its parent; shape beyond the rectangle; incomplete stairs; blank `RiseM` | `editor.save`, `editor.publishFixes`; `editor_canvas_test` | API; integration; widget |
| Edge: id not a positive integer; malformed JSON; unknown fields ignored | `editor.save` | API |
| Edge: looping section chain refused | `editor.save` | API |
| Edge: no active object types; tenant and platform types with one label | `editor_panels_test`; `lookups.editorNames` | widget; API |

### 7.1 Existing tests that change (C1)

| Test | Change | Spec change behind it |
|---|---|---|
| `app/test/forms/lookup_service_test.dart`, "are the three FF-0 lookups, spelled as the route allow-list" | The expected list gains `occupant-categories`, `store-statuses`, `connector-types`, `object-types`, and the test's name stops saying "three" | P0-11 r2 AC-43 (each slice adds its own names, L154 ruling 3). If FF-3 or another slice added `connector-types` first, only the remaining names are added |

Expected unchanged, and the coder stops and asks if any must change: FF-1's `venueBoundary.test.js` and `levels.test.js` (the flag defaults FALSE, so derivation is as before); `lookups.test.js` (its own map of the three FF-0 names); FF-3's publish and drawing tests (the preview is a new route); FF-SK's `module_registry_test.dart` (if flipping "Map editor" to built changes an assertion, as FF-1 §4 anticipated for P0-01); the screenshot test gains scenarios only.

## 8. Records

**Retrofit ledger** (`plan/PH4-feature-first.md` §7), one row per route and screen. Route rows: tenant context "stub (`devStub`)"; guard order "open"; permission row "none"; menu row "none"; audit "open (R3)" for the Save, "n/a (read-only)" for the reads; validation "open (hand-written readers; zod in R5)"; e2e "none (manual FF10.x)"; Forms (R11) "n/a" for routes.
- **Routes:** the seven new routes of §4.2. The Save row also notes "any role may save until R2; the client hides controls (AC-46)" and "the store's status by role (G8) is R2's check".
- **Screens:** the editor canvas with its panels; the review list; the element list. Each: menu row "registry (FF-SK) → R8"; "client-side role hiding → R2/R8"; Forms (R11): "panels on S9's machinery plus `decimal`, `memo`, `upload:` built to R11's definition (A23); R11-M10 moves them".
- **Item 14 (A23):** one row "`ObjectType`, `ConnectorType`, `OccupantCategory`, `StoreStatus` maintenance screens: `Waived: 14 — R11`".
- **Storage:** P0-03's Cloud Storage swap row extended to the `underlays/` keys (closed at the deploy call).
- **FF-0's lookups rows** note the four new names.

**E-20 waivers** (FF-10's report):
- `Waived: 3 (guard order) — the dev stub stands in; fitted in R1–R3 (R3 adds the audit rows), checked by the route-guard-order lint (R7)`
- `Waived: 4 (permission and menu rows) — R2`
- `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now`
- `Waived: 14 (maintenance screens of ObjectType, ConnectorType, OccupantCategory, StoreStatus) — R11`

**Migration evidence:** `npm run migrate` on a database built from main's 0.14 `schema.sql`, run twice (idempotent), with the verify query's rows pasted; `npm run verify` runs 0.15's `schema.sql` twice.

**Companion-file sync table:**

| Row | What FF-10 does |
|---|---|
| `db/schema.sql` | 0.15 (§3); the migration; the seeds (R13); Blueprint Part 3; `SCHEMA_READING_GUIDE.md`; no `FieldSpec` input changes |
| An API route | Tests (§7); e2e waived to R12; permission and menu rows waived to R2; Blueprint §4.6 "as built (FF-10)" and §4.1 (the preview route); `E2E_Test_Cases_Manual.md` phase FF10 (each route: success, 400 per field, 404 cross-tenant and id 0, 409 per clash, 413, the upload cases, AC-44's steps) |
| A screen or its wording | `app_en.arb` (English by design); the admin changelog entry; screenshots (AC-53); `E2E_Frontend_Test_Cases_Manual.md` and `Smoke_Test_Guide.md` (AC-50's demonstration, the penthouse confirm) |
| A dependency | `package:web`: Blueprint Part 1 pin and **EXCEPTIONS E-23** (§1 does not name it, checked this session; version from pub.dev at start; approved 2026-10-12, plan batch X6, lead sign-off as delegated, L115) |
| A setting, limit or option list | The underlay cap and types in the shared upload config (A21), Blueprint §4.6; no `GlobalSetting`; the closed sets in the constants file |
| A command or check | None (the lint rows extend `schema-forms`) |
| An owner ruling | FF-10's `plan.html` row (L156): G1 to G13, A21, A23, R13 to R15, R35, and this plan's rulings; G4 rows: no store logo (A21, against PRD §6.2), connector costs read-only until R11 (A23), the venue's evacuation escalator rule waits for P3-02 (G9), the drawn boundary (G4) and editor deletes (G12) in P0-01 r3; the modules page |
| A pipeline entry's state | FEATURE_PIPELINE P0-11: Intent, Spec, Plan, IN PROGRESS, then DONE |
| Retrofit ledger | As above |

## 9. Definition of done (FEATURE_PIPELINE §5) for FF-10

| # | Status |
|---|---|
| 1 | Met by design: the migration, `schema.sql` 0.15, Blueprint Part 3, the schema guide (§3) |
| 2 | Met by design: four allow-list entries; the seeded venues' flag TRUE (R13); no new setting or object type; the seed's delete list gains `StoredFile` rows of purpose `UNDERLAY` if it lacks them |
| 3 | `Waived: 3 (guard order) — the dev stub stands in; fitted in R1–R3 (R3 adds the audit rows), checked by the route-guard-order lint (R7)` |
| 4 | `Waived: 4 (permission and menu rows) — R2` |
| 5 | Met by design: the review list on the scaffold; `formatApiError`; the four states on the level load, the review list and both overlays |
| 6 | N/A: nobody is notified of a draft edit |
| 7 | Met by design: returning refreshes FF-1's venue screen and FF-3's publish screen; the review list and preview refresh after a Save |
| 8 | Met by design: every overlay and highlight from `colorScheme`; screenshots light and dark |
| 9 | `Waived: 9 (automated e2e) — R12; the API and frontend manual cases are written now` |
| 10 | Met by design (§8) |
| 11 | Met by design (AC-54) |
| 12 | Walked in §8 |
| 13 | Met by design: every panel field a `FieldSpec`, `memo` and `upload:` included |
| 14 | Sets in the constants file with authority comments; `Waived: 14 (maintenance screens of ObjectType, ConnectorType, OccupantCategory, StoreStatus) — R11` |
| 15 | Met by design, in full: AC-44, six lookups |
| G1 | §7's table, with results, in the PR |
| G2 | Screen-reader names and ×1.4 (AC-51); Tagalog not applicable (A3) |
| G3 | N/A: admin side only |
| G4 | In FF-10's L-row (§8) |

## 10. DESIGN CHOICES (each with an alternative; accepted 2026-10-12, plan batch X3)

- **DC-F1. Routes and services split by job** (load, save, deletes, review, geometry, uploads), one route file. *Alternative:* the pipeline's single `editor.service.js`: one file of well over a thousand lines.
- **DC-F2. Every Save takes FF-1's venue lock first** (`FOR NO KEY UPDATE`), which holds G7's one-active-store rule, the one-underlay-per-level rule and the boundary flag against concurrent requests with no new index. *Alternative:* partial unique indexes on `Occupant (UnitId) WHERE IsActive` and `FloorUnderlay (LevelId)`: a second migration beyond G4's, and G7 ruled a service check.
- **DC-F3. DC-21's separate token is the SHA-256 of the stored geometry** (`BoundaryGeoJson` with `BoundaryIsDrawn`; `FootprintGeoJson`), computed by the server on load and compared under the lock on Save. *Alternative:* a `BoundaryEditedAt` column: a second migration, and the footprint would need one too.
- **DC-F4. Type details through one small read route** (`GET /api/editor/types/:name/:id`, two allow-listed names). *Alternative:* extra keys on the lookups row: changes FF-0's `{ id, code, label, isActive }` contract that R11 keeps for pickers (PH3 §3.1).
- **DC-F5. FF-3's storage interface generalised by key prefix** (`packages/…`, `underlays/…`) in `fileStore.js`, the package store becoming its first user. *Alternative:* a second, underlay-only store: two copies of put, rename and remove.
- **DC-F6. The Save is always `multipart/form-data`,** images in memory, at most `maxFilesPerSave` = 5 images per Save (a named constant in the upload config; more answers 413 "Save the plan images in smaller batches"). *Alternative:* disk storage with no per-Save count (no memory ceiling to state, more temporary-file handling); or a separate upload request before Save, which breaks AC-8's "only with the next Save, all or nothing".
- **DC-F7. 10 MB means 10 × 1024 × 1024 bytes** (10,485,760), the size the boundary tests use. *Alternative:* 10,000,000 bytes.
- **DC-F8. New elements carry client ids** (`new-1`) that later items in the same batch reference; the answer maps them to real ids. *Alternative:* one request per new parent: breaks the one-transaction Save.
- **DC-F9. A store's opening status is found by the code `OPEN`** of the platform row, never by label. *Alternative:* the lowest `SortOrder` routable status: indirect, and a tenant row could take its place.
- **DC-F10. Image type decided from the file's first bytes,** not from its name or declared type. *Alternative:* trust `Content-Type`: a renamed file passes.
- **DC-F11. Reset is a change in the batch, applied at Save** (ruled Q3, plan batch P13).
- **DC-F12. Route paths** as §4.2: the editor under `/api/venues/:venueId/editor…` and the level under `/api/venues/:venueId/levels/:levelId/…`, as FF-3's drawing and preview routes are. *Alternative:* `/api/editor/venues/:venueId/…`: a second URL family for the same records.

## 11. Risks

- **Size.** FF-10 is an L entry; flutter-coder's canvas work sets the pace. Unmeasured: no stated pace.
- **`flutter_map` as an editing surface.** Its drawing and hit-testing API is RECALLED (§12). If it cannot carry drag handles and polygon editing cleanly, the fallback is a `CustomPainter` layer inside the `FlutterMap` widget for handles only; the map stays `flutter_map` (E-04).
- **The Save is the high-risk server part** (all or nothing across eleven tables, files with compensation, concurrency). A25 puts it on Sonnet 5.5 as api-coder's; mitigations: test-verifier's tests first, the single venue lock, the fixed write order, dod-reviewer's check that every write path takes the lock.
- **Memory on a Save with images:** up to 5 × 10 MB in memory on one instance (`maxInstances = 1`). Bounded by DC-F6; acceptable on localhost under E-20, re-measured at the pilot.
- **Migration numbering.** FF-10's migration is the first; PH3 §3.4 assumed R2's permission migration would be `0001`. R2 takes the next number; no file is renamed (rule 4).
- **A drawn boundary that is wrong** is no longer replaced by level edits; Reset restores derivation (G4). The seeded venues start drawn (R13).
- **The constants file's Dart side.** If FF-3 lands the file in JavaScript only (its 1.0 text, before R32's amendment), FF-10 cannot read the IMDF sets in Dart. FF-10 depends on R32's shape (Q1, ruled X1).
- **The preview's cost** on the largest level is unknown until AC-85's measurement.

## 12. RECALLED claims (each checked in step 0, with the doc fetched and cited in the slice report, before it carries weight)

- `flutter_map` 8.x (pinned 8.3.2): `CrsSimple`, polygon, polyline and marker layers, hit testing, a rotated image overlay from memory bytes.
- `package:web`'s file input in Flutter Web: reading a chosen file's bytes, name and size. Its current version from pub.dev.
- IMDF 1.0.0's unit and opening category lists (the OGC IMDF specification), for the constants file.
- `multer` 2.x (pinned 2.4.0): `memoryStorage`, `limits.fileSize`, `limits.files`, `limits.fieldSize`, and the error codes it raises for each.
- The PNG and JPEG file signatures used by DC-F10.

## 13. Questions for the owner

Only what no ruling settles. Each has the recommended option first.

**Q1. Which slice creates the constants file that FF-10 adds its sets to: the spec and an approved ruling disagree.** **Ruled 2026-10-12 (plan batch X1): (a) (recommended).**
- `spec/P0-11.md` r2, §4 item 14: "the one constants file that FF-5 creates (A26)"; and §8: "The constants file is created by FF-5 … If FF-5 has not merged when FF-10's plan is written, the plan stops and asks."
- `plan/FF-5-11-residual.md` R32 (APPROVED): "Which slice creates the one constants file — **FF-3 creates it in the shared shape (A26); FF-3's plan is amended**"; `spec/P0-03.md` r3 EC-36: "FF-3 creates that file in A26's shared shape".
- FF-5 has not merged (no plan exists yet).
- (a) **Recommended:** R32 holds. FF-10 adds its sets and the upload config to the file FF-3 creates in A26's shape (JSON read by the API, a generated Dart file for the app), and needs FF-3 merged, not FF-5. P0-11's wording is corrected at its next revision; no criterion changes. *Evidence:* R32 is the later, explicit ruling, and P0-03 r3 already carries it.
- (b) FF-10 waits for FF-5 as the spec's §8 says. Adds a dependency no criterion needs.

**Q2. A landmark inside a unit that is deleted.** **Ruled 2026-10-12 (plan batch P12): (a) (recommended).** G12 lists what blocks a unit's delete: "sections, a store, objects or amenities". `Anchor.UnitId` has no foreign key (`db/schema.sql`, `Anchor`), so the database would not stop the delete, and the landmark would keep the id of a unit that no longer exists.
- (a) **Recommended:** refused like an amenity, with 409 naming the landmark. Same rule as the other placed points; nothing is left pointing at a missing unit.
- (b) The landmark stays and its unit is cleared in the same Save. Fewer refusals; the landmark silently loses its unit.

**Q3. "Reset to cover the levels": at Save, or at once?** **Ruled 2026-10-12 (plan batch P13): (a) (recommended).** `spec/P0-01.md` r3 AC-34: Reset "sets `BoundaryIsDrawn` to FALSE and stores the derived boundary at once". The named Batched Save rule: "the editor saves on explicit Save or Publish" (P0-11 §1, AC-27).
- (a) **Recommended:** Reset is a change in the batch, shown at once on the canvas and written at the next Save, with Undo like any other change; "at once" read as "the derived rectangle is stored when Reset is saved, not at the next level change". Keeps one write path and the Batched Save rule.
- (b) Reset is its own immediate request outside the batch. Matches "at once" literally; a second write path that Undo cannot reverse.

## Suggestions (not in scope)

- Copy and paste, multi-select and moving an element to another level (spec Suggestions).
- A browser-storage draft so a closed tab does not lose work (DC-17's alternative).

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.9 | 2026-10-12 | First draft for the batch approval |
| 1.0 | 2026-10-12 | Approved in the plan batch; questions ruled |
