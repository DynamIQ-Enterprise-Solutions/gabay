# OFFICE-SPEC-adoption: what "adopt everything" from the office map designer spec means for Gabay

> **Superseded by `plan/OFFICE-ADOPTION-replan.md` 1.0 (L170).** The product owner ruled full adoption as an override on 2026-10-12, against this file's "fit, don't transplant" recommendation. This file is kept as the input to the re-plan (its §2 table, Q1–Q16 and O1–O14) and is not a plan of record.
>
> **Version**: 0.1 (draft for the product owner's rulings) | **Date**: 2026-10-12 | **Status**: SUPERSEDED (L170); it was a draft, never approved | **Audience**: the product owner (Genesis Perez), the main session | **Scope**: an impact analysis of the owner's ruling of 2026-10-12 on `OFFICE_MAP_DESIGNER_SPEC.md` (the iqpeople HRIS "Virtual Office" designer spec, v1.0, untracked, kept out of git by the same ruling). It is cited by section number only and is not copied here.
>
> **The ruling analysed (2026-10-12):** asked how the Demo Malls map fix should use the office spec, the owner answered: "adopt everything especially for the map specs and creation on the admin side more importantly". Also ruled: ADD_PATH path corrections as a backup where a door channel can't be drawn, and the office spec file stays out of git. An earlier ruling for the Demo Malls fix: fix FF-2's map converter so that doors get channels to the corridor (office §11, "doors cut a channel") and connector pins are snapped onto walkable floor (the idea in office §10.4), with ADD_PATH corrections as the backup.
>
> **Read for this analysis:** the whole office spec (§1–§12 and its known limits); CLAUDE.md (the seven rules, the stack, E-20, the Evidence Standard); the `gabay-product-rulings` skill (L32, L86, L92, L108, L119 and the rest); Blueprint Part 1 (pins, invariants 2, 3, 6, 13, 14, 15, `<known_traps>`), Part 3 (§3.2–§3.5, §3.10 DC2, DC7, DC8, DC21, DC22, DC24) and Part 4 (§4.1, §4.6); `db/schema.sql` 0.14 (`ConnectorType`, `ObjectType`, `Venue` to `NavCorrection`, `VenueVersion`); `docs/process/EXCEPTIONS.md` (E-04, E-13, E-14, E-20, E-23); `spec/P0-11.md` r2; `spec/P0-03.md` r3 (§3.1 to §3.7, §3.11); `spec/P0-06.md` (E10, RG3); PRD §7; `plan/FF-10-map-editor.md` 1.0; `plan/FF-3-publish-engine.md` 1.0; `plan/PH4-feature-first.md` 1.0; `phase-reports/feature-first/FF-3-A1.md` on `ff3-engine-a1` (the seeded venues run through the engine); the branch state (FF-0, FF-SK and FF-1's server are on `main`; FF-1's client is on `ff1-client`, FF-2 on `ff2-seeds`, FF-3 A1 on `ff3-engine-a1`, none of those three merged); the standard's text, searched for JSON storage guidance (none found beyond "`NVARCHAR(MAX)`: multiline text, with an explicit soft cap").

---

## 0. Recommendation (read this first)

**My recommendation is to adopt the office spec's editor behaviour, drawing rules and lessons, and fit them onto Gabay's existing tables. Do not transplant its storage model, its AI step, its time-based costs or its never-blocking publish.**

In practice:

1. **Do now (the Demo Malls fix, already ruled):** fix FF-2's converter. Each store door gets a walkable channel to the corridor. Each stair, escalator and lift pin moves onto walkable floor. An `ADD_PATH` correction is the backup where a channel can't be drawn. This lands with FF-3's stage B2, because P0-03 AC-66 already says the fix "goes into the seed's data (FF-2's files), never into a looser check". No spec or schema changes, and no ruling is reversed (§4.1).
2. **FF-10 (the admin map editor) is re-planned** as P0-11 r3 and FF-10 plan 1.1. It takes the office editor's tools, keys, snapping, drag-is-one-undo, save states, the conflict stop, backdrop calibration, upload checks and a Checks panel (§4.2). All of this fits the rules already in force.
3. **Keep Gabay's relational tables.** The office spec's "one JSON document per building" clashes with rule 7 (forms are schema projections, enforced by the `schema-forms` lint), with invariant 13's composite foreign keys, and with L108's per-element review flag. It would also re-open three slices that are built or nearly built (Q1).
4. **Keep L108 (no AI, no OCR) and P1-03's timing.** The office spec's measured-raster wall finding and geometry tidy-up (§10.2, §10.4) are rule-based and go into P1-03 as inputs. Its AI model step (§10.3) does not (Q3).
5. **Keep metres, the publish-time graph and blocking publish** (L86, L32, L92, L108, PRD §6.3). The office spec's runtime rules (§11) were written for an office scene with a few hundred desks, not for a 100,000 m² mall package (Q9 to Q12).
6. **3D preview: defer it.** When FF-4's 2.5D renderer exists, reuse it in the admin page. That needs no new package and no exception. three.js would need a new EXCEPTIONS entry (Q4).

**Why not adopt everything literally.** Read word for word, "adopt everything" would reverse at least six standing rulings or rules:
- L108: no AI;
- L86 and invariant 15: metres;
- the Batched Save named rule: no autosave;
- PRD §6.3 and P0-03 AC-13: publish refuses an unreachable place;
- E-20 hard rule 3: nothing is exported;
- rule 7 together with invariant 13: relational forms and composite keys.

Your ruling does not say it reverses them. The Evidence Standard (item 3, flag unknowns) and WORKING_AGREEMENT ("ask, never assume") therefore send each one back to you as a question, in §3. Everything that fits without a reversal is listed in §4 and can start once you approve.

**DESIGN CHOICE (how I read "adopt everything"):** "adopt everything that fits a mall, and bring every conflict back for a ruling". *Alternative:* "adopt everything, overriding earlier rulings where they conflict". That reading is §5's full-adoption route. It would be the right one if you meant the office spec to replace the Gabay specs for the map.

---

## 1. Terms

- **Office spec**: `OFFICE_MAP_DESIGNER_SPEC.md` v1.0, cited as "office §n".
- **Fits as-is**: Gabay already does it, or can do it without changing any spec, plan, ruling or schema.
- **Fits with adaptation**: it can be done without reversing a ruling, but a spec or plan text changes (named).
- **Conflicts**: it contradicts a named ruling, acceptance criterion, rule, invariant or EXCEPTIONS entry. Each conflict is a question in §3.
- **Not applicable**: it serves an office (people, desks, seating, presence), not a mall.

---

## 2. Section-by-section table

| Office § | What it says (one line) | Where it maps in Gabay | Verdict |
|---|---|---|---|
| §1 (property 1) | The whole building is one JSON document, validated, stored and versioned as text | Relational venue tables (Blueprint Part 3 §3.3–§3.4; `schema.sql` 0.14: `Unit`, `Opening`, `FloorObject`, `NavConnector`, …) | **Conflicts**: rule 7 (`schema-forms` checks every `FieldSpec` against a `schema.sql` column); invariant 13 and DC7 (composite tenant FKs); DC22 (`NeedsReview` columns and partial indexes, L108); P0-11 AC-27/AC-28 (per-element batch and tokens). **Q1** |
| §1 (property 2) | Draft and published are separate; the live building changes only at a publish | Draft rows versus immutable `VenueVersion` packages (invariant 3; P0-03 AC-5, AC-8) | **Fits as-is** (the same principle, already specified) |
| §1 (property 3) | Geometry and people are stored apart, joined by desk id | `Unit` (geometry) and `Occupant` (the store in it) are already separate tables; shoppers are never stored with the map (invariant 4) | **Fits as-is**. The people half is **not applicable** |
| §1 (property 4) | Ids are stable and generated by the editor | INT identity ids from the database. FF-10 DC-F8 gives new elements client ids (`new-1`) that the Save maps to real ids | **Fits with adaptation** (already planned: temporary client ids, permanent server ids) |
| §2 | Glossary: map, level, draft, version, item, desk, connector, backdrop, proposal, check | Map → **Venue**: one venue spans buildings and the outdoor ground (L29, L30), not one building. Level → `Level`; draft → draft rows; version → `VenueVersion`; item → `FloorObject`; connector → `NavConnector` (+ `NavConnectorStop`); backdrop → `FloorUnderlay`; proposal → a P1-03 draft with `NeedsReview` (L108); check → P0-03 warnings plus the new editor checks (Q12) | **Fits with adaptation**. Desk and hot desk are **not applicable** |
| §3 units | Metres, rounded to the millimetre | `DECIMAL(9,3)` metres (invariant 2); FF-10 DC-4 rounds to the column scale | **Fits as-is** |
| §3 origin | One frame per level; top-left origin; `z` runs down the plan; everything clamped inside the level | One frame per **venue** (E10); the level rectangle is (0,0)–(`WidthM`, `DepthM`) (P0-11 AC-2). A shape beyond the rectangle is saved and flagged, not clamped (P0-11 edge cases). Which way +Y runs is **not written** anywhere I read | **Fits with adaptation** (write the convention down). **Q8**, open question O1 |
| §3 rotation | `rot` in degrees clockwise on the plan; 0 faces up the plan; write it into the editor, validator and renderer | `RotationDeg` 0 to under 360 (`Unit`, `FloorObject`, `FloorUnderlay`); `MapUpDeg` is "clockwise from the plan's +Y axis" (DC24). The direction and the zero for `RotationDeg` are not written | **Fits with adaptation** (the advice to write the convention into every layer is adopted). O1 |
| §3 ids | Id pattern, unique across the document, with type prefixes | INT ids, unique per table | **Not applicable** (the client-id part is in §1, property 4) |
| §3 mpp lesson | Store a plan's metres-per-pixel to 7 decimals; rounding it to 3 caused a 6% scale error | `FloorUnderlay` stores the raw calibration (pixels A and B, `RealDistanceM`) and never a derived scale, so the bug cannot happen if it stays that way | **Fits as-is**; adopt the lesson as a written rule (§4.2) |
| §4.1 level fields | Name, elevation, height, size, floor finish and colour | `Level.Name`, `ElevationM`, `CeilingHeightM`, `WidthM`/`DepthM` (FF-1, built) | **Fits as-is**. A floor colour stored as hex **conflicts** with rule 6 (colours only in `gabay_tokens.dart`); finishes are **not applicable** to wayfinding (left out) |
| §4.2 walls | Walls are lines with thickness and a kind (solid, glass, partition) | No wall entity. A wall is each edge of a non-walkable unit (away from its doors) and the outline of a `BlocksWalk` object (P0-03 §3, ruled D4) | **Conflicts** with D4 and with the schema (no `Wall` table). **Q2** |
| §4.2 openings | A door sits on a named wall, at a fraction along it, with a width | `Opening` as a `LineString` on a unit's edge (P0-11 AC-11, DC-7), with `ClearWidthM` (L88) | **Fits with adaptation**: the office door tool's behaviour (click an edge → a door at that point with a width) produces Gabay's line (§4.2) |
| §4.2 rooms | Typed polygons; a comfort room has a sign, a capacity and a time limit | `Unit` with an IMDF category and `IsWalkable`; restrooms are amenity types with synonyms ("comfort room", `AmenityType.SearchSynonyms`) | **Fits with adaptation** for typed polygons. The comfort-room sign, capacity and minutes are **not applicable** (nothing reads them; they would need lookups under rule 5) |
| §4.2 items | Catalog type, position, rotation, sizes within the type's resize range; desk flags | `FloorObject` plus the `ObjectType` lookup (default sizes, `BlocksWalk`, `SignalPenaltyDb`). There are no resize-range or mount columns | **Fits with adaptation**; resize ranges are **Q7**. Desks, hot desks and monitors are **not applicable** |
| §4.2 connectors | Stairs, escalator (one-way, levels[0] → levels[1]), elevator; `preferred`; `walkable: false` | `NavConnector` with a `ConnectorType` lookup (ramps too), `IsBidirectional` (one-way runs From → To, L86), `RiseM`, `IsEvacuationOnly`, `NavConnectorStop` per lift floor | **Fits as-is** for kinds and direction. A stair's shape and length have no columns: **fits with adaptation** (its footprint as a `FloorObject`, its ends at the landings, §4.2). `preferred` ×0.7 **conflicts** with the heuristic trap (**Q10**). `walkable: false` scenery is **not applicable** (draw an object instead) |
| §4.2 backdrop | Draft only; centre, scale, rotation, opacity, lock | `FloorUnderlay`; never in a package (P0-03 D11, P0-11 AC-8) | **Fits as-is**; opacity and lock as screen-only state (§4.2) |
| §4.3 | A pure validator returns a canonical copy, collects up to 20 problems by path, and runs at both save and publish | FF-10's Save collects every refusal (AC-32, AC-33) and checks structure only at save (DC-5). Publish runs full validation and lists every problem, none dropped (P0-03 AC-21, DC-1). The engine is pure functions (FF-3 DC-P2) | **Fits as-is**. Gabay's is stricter: no 20-problem cap, and errors in the standard's `{ error }` shape, not codes |
| §5 | A frozen, server-owned catalog served to the editor, copied nowhere; the map keeps the catalog version it was drawn with | The `ObjectType` lookup, served by `GET /api/lookups/object-types` and FF-10's type-details route (DC-F4); an inactive type is still published (P0-03 AC-36) | **Fits as-is** in principle (rule 5 is stricter: tenants can extend it). A frozen catalog **in code** **conflicts** with rule 5 and invariant 14. The office types are **not applicable**; the mall library (L39) is Pillar, Shaft and Furniture (G13). Item finishes **conflict** with rule 6. **Q7** |
| §6.1 | Tables: map with `DraftJson`, versions, desk assignments, backdrops (MSSQL) | Relational tables; `VenueVersion`; `StoredFile` + `FloorUnderlay`; PostgreSQL `JSONB` where JSON is used (L98) | Storage: **Q1**. Assignments: **not applicable**. Backdrops: **fits as-is** |
| §6.2 save | Each save quotes a `baseVersion`; a mismatch is 409 with "reload", never a merge | Per-element `UpdatedAt` tokens (FF-1 DC-6), all clashes listed in one 409 (P0-11 AC-28), under the venue lock (FF-10 DC-F2) | **Fits as-is** (Gabay's is finer-grained) |
| §6.2 publish | Re-validate, strip backdrops, write a new version, in one locked transaction | P0-03 AC-1, the claim and lock (FF-3 DC-P5), the snapshot transaction (DC-P6), the underlay never packaged | **Fits as-is** |
| §6.2 rollback | Republish an old version as a new version, and make it the draft again | No rollback in any Gabay spec (searched P0-03, P0-11, the PRD, the pipeline) | **Fits with adaptation** as new scope (republish only). Restoring the draft is not possible from a package. **Q5** |
| §6.2 delete map | Deleting a map removes its versions and files | No venue delete: `IsActive` (P0-01 B4); levels are refused while referenced | **Conflicts** with P0-01 B4; keep Gabay's (inside **Q5**) |
| §6.2 caching | Version layouts cached; immutable versioned URLs | Package ETag and refresh (P0-04; L102) | **Fits as-is** |
| §6.3 | Desk assignments, statuses, batch seating | Nothing; shopper positions never leave the phone (invariant 4) | **Not applicable** |
| §7 | Tenant from the request's tenant header; one permission gate; error codes; layout fetched once per version | Rule 2 (`req.tenantCompanyID`, the stub's `X-Tenant-Id`); R2's `PermissionRoute` rows; the `{ error }` shape; P0-04's ETag. The convert route is **Q3**; the presence route is **not applicable** | **Fits as-is**, with paths adapted to FF-10 §4.2 |
| §8.1 | Screen: picker, save state, undo/redo, export/import, history, Publish; tool rail; floor tabs; panels; docked 3D preview; edit in 2D, preview in 3D | FF-10: level chips, `FieldSpec` panels (the Panel rule), review list, element list (DC-14), Publish (DC-12) | **Fits with adaptation** (save-state indicator, history as a read-only version list). The People panel is **not applicable**. Checks: **Q12**. 3D: **Q4**. Export/import: **Q14** |
| §8.2 | Tools with one-letter keys; the desk-block tool | FF-10 §5.2: box, polygon, door, point, connector end, lift stop, correction, boundary, footprint | **Fits with adaptation** (keys adopted, §4.2). A wall tool is **Q2**. Desk tools are **not applicable**; a mall "row of stores" analogue is in **Q15** |
| §8.3 | Pan, zoom at the pointer, a 10 cm grid, screen-pixel end snap, 15° steps, modifier keys, nudge, duplicate, select all, group rotation, delete cascades | P0-11 DC-2 (snap to `GridCellM`, 0.25–2.00 by `CK_Level_GridCell`; free rotation by the handle); DC-15 (desktop first); G12 deletes; "multi-select, copy and paste" are out of FF-10 (§1) | **Fits with adaptation**: pointer, screen-pixel snap, angle steps, modifiers, nudge and the Esc ladder (§4.2). The 10 cm grid is **Q8**; duplicate, select all, marquee and group rotation are **Q15**. A level delete that drops connectors **conflicts** with P0-01 r3 B4 ("deleting a level never deletes elements"); keep Gabay's |
| §8.4 | Snapshot undo (100 deep; a drag is one step); autosave 1.5 s after the last change; checks re-run 400 ms after the last change; a save on leaving; a 409 stops saving | G2: undo and redo over the unsaved change log (DC-17); the Batched Save rule ("saves on explicit Save or Publish"), G1, AC-27; AC-29 asks before leaving | Undo: **fits with adaptation** (drag = one step). Autosave and save-on-leave **conflict** with the Batched Save rule, G1 and AC-29: **Q6**. The 409 stop **fits as-is**. The checks' timing: **Q12** |
| §8.5 | Contextual property panels | `FieldSpec` panels per element kind (rule 7, the Panel rule) | **Fits as-is** (fields per Gabay column). People and "Seat dept here" are **not applicable** |
| §8.6 | Ten non-blocking client-side checks, each selecting its elements | Publish refusals (AC-11 to AC-21) and warnings (AC-22, AC-23); the review list (L108). Office #1 entrance → AC-13/AC-14; #3 floors reachable both ways → AC-13 "a way leads back"; #7 can't walk to it → AC-13 and AC-15(c), **exactly the Demo Malls fault**; #4, #5, #6 → hygiene checks Gabay lacks; #2 and #8 to #10 are **not applicable** | **Fits with adaptation** as advice in the editor. **Conflicts** if it means a non-blocking publish (L92, L108, PRD §6.3). A client-side flood fill **conflicts** with P0-11 AC-22 (one derivation, never a copy in Dart). **Q12** |
| §8.7 | Start blank; start from the automatic layout; export/import a map file | FF-1 creates sized levels; FF-2's converter is the "automatic layout" analogue (L119) | Blank: **fits as-is**. Automatic layout: **not applicable**. Export/import **conflicts** with E-20 hard rule 3: **Q14** |
| §9.1 | Upload checks: magic bytes; pixel size read from the header; 15 MB; 50–10,000 px a side; ≤ 50 MP; ≤ 20 per location; stored outside the web root | FF-10 DC-F10 (magic bytes); N4 and A21 (PNG/JPG, 10 MB, one per level); no static mount (FF-10 §4.5) | Magic bytes and storage **fit as-is**. Pixel-size and megapixel checks **fit with adaptation** (new constants in the upload config, §4.2). 15 MB and WebP change N4/A21: **Q16** |
| §9.2–§9.4 | Calibrate straight after upload; the first clicked point stays put; reject an absurd scale; move, rotate, opacity, lock; "make the floor this size" only while the floor is empty | P0-11 AC-8 (two points and a typed distance; move and rotate) | **Fits with adaptation** (§4.2). "Make the floor this size" writes `Level` (FF-1's table, not in FF-10's batch): **Q15** |
| §9.5–§9.6 | Stripped at publish; unused images pruned after 24 h | D11 (never packaged); the image is sent only with a Save, and a replaced file is removed (R15) | **Fits as-is**; pruning is **not needed** |
| §9 PDF | Rasterise PDFs in the browser; self-host the PDF engine with `eval` off | P1-03 (L108), `pdfjs-dist` (E-13); FF-10 takes PNG and JPG only (A21) | **Fits with adaptation** as a P1-03 note (RECALLED, O11). A PDF underlay in FF-10: **Q16** |
| §10.1, §10.3 | Send a gridded crop to a vision model; prompt and schema for walls, doors, rooms, desks | L108: "no AI, no OCR", rules in the admin's browser, at P1-03 | **Conflicts** with L108 (and possibly L48 and L116 for plan confidentiality). **Q3** |
| §10.2 | Measure walls from the raster without a model (paired ink lines 6–28 cm apart); rooms by flood fill, with the L-gap and seed-matching lessons | Blueprint §4.6's scan rules: "walls as thick strokes, straightened and merged … rooms as regions closed by walls" (L108; E-14 OpenCV in the browser) | **Fits with adaptation**, into P1-03's rules: in the browser, not on the server; thresholds as settings (C8). The desk rules are **not applicable** |
| §10.4 | Tidy-up: straighten within 4°, close corners within 0.25 m, merge; doors onto the nearest wall within 0.6 m; collinear gaps of 0.6–2.6 m are doors; validate the proposal before returning it | P1-03's rules (door gaps 0.7–1.5 m as `import.doorGap*` settings, confirmed by a swing arc); the snapping idea is ruled for FF-2's converter | **Fits with adaptation**: P1-03 inputs (its settings stay Gabay's), and pin snapping now (§4.1) |
| §10.5 | A proposal in a distinct colour, added in one undo step, never applied automatically | L108: each generated element starts `NeedsReview`, and publish refuses until each is confirmed | **Fits with adaptation**: adopt both. "Add to floor" writes elements with `NeedsReview = TRUE` |
| §11 grid | A 0.25 m navigation grid per level; blockers grown by a 0.24 m body margin | The publish-time graph (L32; FF-3 DC-P3: 1.5 m spacing, 16 neighbours; AC-32, about 20,000 nodes); per-edge clearance instead of a margin (AC-30, L88) | **Conflicts** with L32, AC-32 and PRD §7's scale. **Q9** |
| §11 doors | Doors must cut a channel after blockers are marked, or the margin closes them | Gabay's walkable area keeps a door's gap open already (A1 design choice 5). The Demo Malls fault is different: undrawn floor between the shopfront and the corridor | **Fits with adaptation** (ruled: in the converter, §4.1). Engine-side channels: **Q9** |
| §11 unreachable | An unreachable goal ends at the nearest reachable cell, never with a straight-line fallback | P0-03 AC-13: publish refuses an unreachable place, so the app never needs a fallback; no straight-line fallback exists (P0-06 AC-8, RG3) | "Never straight-line": **fits as-is**. "Nearest reachable cell" **conflicts** with AC-13: **Q11** |
| §11 entrance | The entrance item on the lowest floor, else the middle of the bottom edge | `Opening.IsVenueEntrance`; reachability is measured from real entrances (AC-13, AC-14) | **Conflicts** with AC-13 (no invented entrance). Inside **Q11** |
| §11 routing | Dijkstra over connectors, A* within levels; transit costs in seconds; `preferred` ×0.7 | One A* over one CSR graph (invariant 6); metre costs (L86, invariant 15; `CostBaseM` + `CostPerRiseM` × rise) | **Conflicts** with L86, invariant 15 and the heuristic trap (a factor below 1). **Q10** |
| §11 seats, privacy | Seat placement and the hot-desk privacy rule | Invariant 4 (stricter) | **Not applicable** |
| §11 one level | One level shown at a time | The editor: one level at a time (P0-11). The shopper app has all-levels views by design (L85) | **Fits as-is** for the editor |
| §12 | The porting checklist (12 items) | 1 → Q1; 2 → fits; 3 → fits (per element); 4 → fits (`Unit`/`Occupant`); 5 → fits (lookups); 6 → O1 and Q8; 7 → Q4; 8 → undo fits, autosave Q6; 9 → Q12; 10 → fits (§4.2); 11 → P1-03 without a model (Q3); 12 → fits with L108 | As each row |
| Known limits | 10 levels; 300 m a side; 2,000 walls; 300 rooms; 5,000 items; 40 connectors; 4 MB; one map per location, no campus; no curves; rooms without holes | PRD §7 (sites up to about 100,000 m²; about 20,000 graph nodes). Bayview Grand gets 19 "No beacons" warnings, one per level, and Bayview has 93 connector pins (FF-3 A1 report); Aurora has 340 store and entrance doors. A venue is a whole site with buildings (L29, L30). The 5 MB request body (`MAX_JSON_BODY`) | **Conflicts** with PRD §7 and the seeds: **Q13**. "No campus" conflicts with L30 (inside Q1). "No curves" and "levels as rectangles" **fit as-is** |

---

## 3. Questions for the owner (the conflicts)

Each has 2 or 3 options, the recommended one first, and what each would cost. "Built" means code already on `main` or on a branch. FF-1's server is on `main`. FF-1's client (`ff1-client`), FF-2 (`ff2-seeds`) and FF-3 A1 (`ff3-engine-a1`) are on branches, not merged. FF-10 is not started.

**Q1. Storage: one JSON document, or Gabay's tables?** (Office §1, §4, §6.1, §12 item 1, against rule 7, invariant 13, DC7, DC22 and L108.)
- (a) **Recommended: keep the tables.** Take the document's benefits that Gabay already has or has planned: one load per level (FF-10 DC-6), one all-or-nothing Save (G1), every problem reported together (P0-03 DC-1), and draft separate from published (invariant 3). *Cost:* none.
- (b) Hybrid: keep `Venue`, `Building` and `Level` as tables (FF-1 untouched), and store each level's drawing as one `JSONB` document with a draft version. *Cost:*
  - A rewrite of schema 0.15: a new draft-document table, nine element tables retired, and the first migration (rule 4).
  - The composite FKs from `Occupant`, `StoreStatusChange` (L104), `Beacon`, `Closure` and `AnalyticsDailyUnit` to element ids are lost (invariant 13; DC7, DC9).
  - `NeedsReview` moves into JSON, and the publish check scans documents (DC22).
  - The `schema-forms` lint needs a JSON-schema mode, or an exception (rule 7; O12).
  - FF-2's writers (`demo.js`, `spike.js`) are rewritten.
  - FF-3 A2's snapshot reader is rewritten to build the `VenueDraft`. A1's engine survives unchanged, because it reads the `VenueDraft` (FF-3 DC-P2).
  - FF-10's Save becomes one PUT with a `baseVersion`. That part is simpler.
  - Specs change: P0-02, P0-03 (the snapshot), P0-11 (§2.4 and most ACs) and P0-12. Blueprint Part 3 changes.
- (c) Full: one document per venue, levels included. A per-building document would break same-height joins across buildings (P0-03 AC-28, D6) and the outdoor ground (L30). *Cost:* everything in (b), plus a rework of FF-1's level routes and screens (`level.service.js`, `venueBoundary.js`, `foreignKeyInUse.js` and their tests, merged; the `ff1-client` screens), and P0-01.

**Q2. Walls as their own elements?** (Office §4.2, against P0-03 ruling D4.)
- (a) **Recommended: keep D4.** A wall is an edge of a non-walkable unit or the outline of a blocking object. The office door-on-a-wall behaviour is applied to unit edges. *Cost:* none.
- (b) Add a `Wall` table (a line, a thickness and a kind, the kind a closed set under invariant 14) as a second source of walls beside D4. *Cost:*
  - a migration and schema change;
  - the A1 engine's `walls.js` and walkable area (P0-03 AC-12, AC-24, AC-71 amended; P0-03 r4);
  - the package's wall index;
  - a wall tool in P0-11 r3.
  - Benefit: wall kinds (glass, solid) could feed the BLE planner's signal model (L40; O13).
- (c) Replace D4 with explicit walls only. *Cost:* (b), plus every seed rewritten (the sources have rooms, not walls) and P0-06's origin snap (RG3) re-checked.

**Q3. AI floor-plan conversion?** (Office §10, against L108 "rules in the admin's browser: no AI, no OCR", at P1-03.)
- (a) **Recommended: keep L108 and P1-03's timing.** Put office §10.2's measured-raster rules and §10.4's tidy-up rules into P1-03's spec, as settings, run in the browser with E-14. Pair §10.5's one-step preview with L108's `NeedsReview`. *Cost:* none now; inputs for P1-03's spec.
- (b) An optional, off-by-default AI step at P1-03 for names and types only, as the office does. *Cost:* reverses L108; a provider and a new external integration; your assessment as DPO (L116), since floor plans may be confidential (L48); a server route, where L108 says the browser; possibly an EXCEPTIONS entry (RECALLED, unchecked); a per-call cost (unknown).
- (c) Pull rule-based plan conversion into the feature-first period. *Cost:* a P1 entry inside E-20 (PH4 §4 order changes), E-13 and E-14 libraries installed now, and P1-03's intent, spec and plan written now.

**Q4. A 3D preview?** (Office §8.1 "edit in 2D, preview in 3D", against the Flutter-only stack and E-04's scope.)
- (a) **Recommended: defer, then reuse FF-4's own 2.5D renderer** (L83: `CustomPainter`, no package) in the admin page to preview the saved draft. No exception is needed, and the preview shows what shoppers will see. *Cost:* a later slice after FF-4, and an adapter so the renderer can read a draft, not only a package.
- (b) three.js through JavaScript interop in the admin page. *Cost:* a new EXCEPTIONS entry with your lead sign-off under delegation (§1 does not name it), a Blueprint Part 1 pin, interop code, and a second renderer whose look differs from the shopper map. Its licence and version are RECALLED (O10).
- (c) No preview.

**Q5. Rollback, and deleting a map?** (Office §6.2. No Gabay spec has a rollback. P0-01 B4 has no venue delete.)
- (a) **Recommended: "Republish an earlier version"** as a new version that reuses that version's package bytes, so the frozen rule holds (invariant 3). The draft is left as it is. Venues are never deleted (B4 stays). *Cost:* a P0-03 r4 criterion, a route and a button on the publish screen. Whether two versions may share one `StoredFile` row or the file is copied is a stage-B detail (RECALLED).
- (b) Office-style: also restore the draft. *Cost:* not possible from a package, which holds allow-listed fields only: no `NeedsReview`, and corrections are already baked into the graph (P0-03 AC-46). It needs a draft snapshot stored with every version (a migration).
- (c) No rollback in P0 (as now).

**Q6. Autosave?** (Office §8.4, against the Batched Save named rule, G1, P0-11 AC-27 and AC-29.)
- (a) **Recommended: keep explicit Save** (one transaction; one audit row per Save from R3). Add office-style crash safety in the browser: the unsaved change log is kept in browser storage and offered back on return (DC-17's alternative). Add the save-state indicator (none, unsaved, saving, saved, error, conflict). *Cost:* P0-11 r3 (DC-17, AC-29); client only; every storage call guarded (O14).
- (b) Server autosave 1.5 s after the last change. *Cost:* reverses the Batched Save rule and G1. A half-drawn store could be published by someone else, because publish reads the saved draft (P0-03 AC-8). There are many more audit rows (R3) and token clashes. P0-11 §2.4 and FF-10 §4.4 are rewritten, and plan.html's named rule changes.
- (c) Both.

**Q7. The object catalog?** (Office §5, against rule 5 and invariant 14.)
- (a) **Recommended: keep `ObjectType` as the lookup.** It is already "served by the server, copied nowhere". Add mall types to the seed when you name them (G13's open offer; O7). *Cost:* seed rows only.
- (b) Add the office's per-type fields as columns: resize ranges (minimum and maximum width, depth and height), mount (floor or wall, a closed set) and round. *Cost:* a migration, `FieldSpec`s, a larger R11 maintenance screen, and FF-10 panels that enforce the ranges.
- (c) A frozen catalog in code, as the office spec does. *Cost:* conflicts with rule 5, so it needs an EXCEPTIONS entry. Not recommended.

**Q8. Coordinates and the snap step?** (Office §3, §8.3, against E10, DC-2 and `CK_Level_GridCell` 0.25–2.00.)
- (a) **Recommended: keep the venue frame** (E10, metres to 3 decimals). Write the conventions down once in Blueprint invariant 2, for the editor, the engine, the shopper renderer and the seeds: which way +Y runs, rotation direction and zero (O1). Adopt a 0.10 m snap step as a named constant, separate from the displayed `GridCellM` grid (DC-2 amended), with 15° drawing steps, Shift for a free angle and Alt for no snap. *Cost:* P0-11 r3 (DC-2), Blueprint text, and AC-3's projection tests.
- (b) Adopt the office frame (x/z, top-left origin, z down, clockwise). *Cost:* wording only if Gabay already runs that way. Otherwise the FF-2 seeds, the A1 engine, the P0-06 vectors and the P0-04 renderer all change.
- (c) Let `GridCellM` go down to 0.10. *Cost:* a CHECK change (a migration). Not needed under (a).

**Q9. The navigation grid and door channels?** (Office §11, against L32, FF-3 DC-P3 and P0-03 AC-24, AC-30, AC-32.)
- (a) **Recommended: keep the publish-time graph** (1.5 m spacing, 16 neighbours, per-edge clearance). Make "doors cut a channel" a data rule in FF-2's converter, as you ruled, with `ADD_PATH` as the backup. The editor's door tool warns when a door's gap does not touch walkable floor. *Cost:* the converter work only (§4.1).
- (b) The engine cuts door channels itself: the walkable-area step adds a strip from each store door to the nearest walkable floor within a set distance. *Cost:* P0-03 AC-24 amended (r4) and a change to the A1 engine. Risk: it silently passes a door drawn facing a wall, a real mistake that publish should catch.
- (c) A 0.25 m grid with a 0.24 m body margin. *Cost:* about 36 times the nodes of a 1.5 m grid (1.5² ÷ 0.25² = 36). Aurora already has 33,842 nodes at 1.5 m (A1 report), far beyond PRD §7's about 20,000 and the 3.2 ms routing target (L166). Not viable for the package; it could only ever be an editor check.

**Q10. Transit costs in seconds, and "preferred" connectors?** (Office §11, against L86, invariant 15 and the heuristic trap of L162.)
- (a) **Recommended: keep metres** (`CostBaseM` + `CostPerRiseM` × rise). Do not adopt "preferred ×0.7": a factor below 1 makes the A* estimate overshoot (`<known_traps>`). *Cost:* none.
- (b) Costs in seconds. *Cost:* reverses L86 back to L37's time ranking; changes `ConnectorType`, P0-03 AC-33, P0-06's vectors and PRD §6.6's "About N m".
- (c) A per-connector "preferred" flag, built as a penalty of at least 1 on the others. *Cost:* a migration, P0-03 and P0-06 changes, and your ruling on what "preferred" means to a shopper.

**Q11. An unreachable place, and an invented entrance?** (Office §11, against P0-03 AC-13 and AC-14, PRD §6.3 "every store reachable" and D5.)
- (a) **Recommended: keep the refusal at publish.** The app never needs a fallback; there is still never a straight-line fallback (P0-06 AC-8), and entrances must be real. *Cost:* none.
- (b) Publish anyway, and route to the nearest reachable point. *Cost:* reverses PRD §6.3 and D5; AC-13 becomes a warning; P0-06 gains a behaviour and wording (ARB, P0-14).

**Q12. Checks: advice in the editor, and blocking at publish?** (Office §8.6, against L92, L108, AC-13 and P0-11 AC-22's one derivation.)
- (a) **Recommended: keep publish blocking, and add a Checks panel to the editor with two layers.**
  - Cheap client checks while drawing: a store with no name, overlapping units, a blocking object across a wall, a door off its unit's edge, a connector with one end, a one-way escalator with no way back.
  - A "Run publish checks" button that runs the engine's own validation on the saved draft without writing anything (a dry-run route; the same code as publish, so there is no copy in Dart).
  - Each row selects its element.
  - *Cost:* P0-03 r4 (one criterion for the dry-run route), P0-11 r3, and a small engine-coder part. A1 measured a full Aurora validation at 1.8–7.4 s, so the button runs on demand, not every 400 ms.
- (b) Client-side checks only, as the office does. *Cost:* engine rules duplicated in Dart (against AC-22's principle), with drift.
- (c) A non-blocking publish. *Cost:* reverses L92, L108 and PRD §6.3.

**Q13. Size limits?** (Office known limits, against PRD §7 and the seeds.)
- (a) **Recommended: take no office caps.** Gabay's limits stay those of PRD §7 (warnings, never refusals; D14) and the 5 MB Save body. FF-10 already measures load and Save on Aurora and the synthetic venue. *Cost:* none.
- (b) Mall-sized caps as named constants (C8) in the Save checks. *Cost:* values unknown until measured.
- (c) The office caps as they are. *Cost:* the seeds are refused (Bayview Grand alone has 19 levels and 93 connector pins).

**Q14. Export and import of a map file?** (Office §8.7, against E-20 hard rule 3, "Nothing is exported or kept", and L48 and L123: the penthouse stays out of git.)
- (a) **Recommended: not now.** Revisit after the retrofit, as an IMDF export (the outside standard Gabay already uses for categories) or as Gabay's own JSON. *Cost:* none.
- (b) Build it now. *Cost:* your amendment of E-20, new routes, and retrofit-ledger rows.
- (c) IMDF export now. *Cost:* P1-03 territory, pulled into E-20.

**Q15. Editor features outside FF-10's approved scope?** These are:
- multi-select (a marquee and select all);
- group move and rotate about the centre;
- duplicate;
- a "row of stores" tool (the office desk-block tool's mall equivalent: N stores of a given width along a line; a DESIGN CHOICE);
- "make the level this size" from the calibrated plan;
- a read-only version history panel.

P0-11 r2 and FF-10 §1 put "copy and paste, multi-select" out of scope.
- (a) **Recommended: take multi-select, duplicate, group move and rotate, and the history panel into FF-10** (P0-11 r3, FF-10 1.1). Leave "row of stores" and "level size from plan" for a follow-up (FF-10b), because the second writes `Level`, FF-1's table, which FF-10's batch does not hold. *Cost:* spec and plan revisions, and more of flutter-coder's time on an already large slice (FF-10 §11).
- (b) All of them into FF-10.
- (c) FF-10 as approved; everything new in FF-10b.

**Q16. Underlay files?** (Office §9, against N4 and A21: PNG and JPG, 10 MB, one per level.)
- (a) **Recommended: keep N4 and A21,** and add the office's pixel checks: read the size from the header without decoding; 50 to 10,000 px a side; at most 50 megapixels. These are named constants in the upload config. *Cost:* FF-10 1.1 and tests; no ruling changes.
- (b) The office's WebP and 15 MB. *Cost:* changes N4 and A21, the upload config and the tests.
- (c) PDF underlays in FF-10, rasterised in the browser. *Cost:* pulls `pdfjs-dist` (E-13) into P0 and widens E-13's scope.

---

## 4. What can be adopted now without reversing anything

### 4.1 FF-2's converter: the Demo Malls fix (ruled; lands with FF-3 B2)

The fault, measured by A1 on the seeded venues at 1.5 m spacing:
- Aurora: 64 connector ends off the walkways, 359 unreachable places, 16 orphans.
- The other three malls fail the same way.
- 336 of Aurora's 340 store and entrance doors sit 1 m from the corridor, whose boxes stop 1 m short of the shopfronts.
- In all four malls, stair and lift pins sit off walkable floor (Bayview: 50 of 93 more than 5 m away).
- (`phase-reports/feature-first/FF-3-A1.md`, "The seeded venues".)

P0-03 AC-66 already puts the fix in the seed data, so this changes no spec.

1. **Door channels (office §11; your ruling).** For each store or entrance door whose gap does not touch walkable floor, the converter adds a walkable channel: the door's width, out along the door's outward direction to the nearest walkable floor, up to a named maximum. A channel that would cross another unit is not drawn; that door gets the backup in item 3.
   - DESIGN CHOICE: one channel per door. *Alternative:* extend Aurora's corridor boxes by the 1 m gap to meet the shopfronts. That means fewer elements and is closer to a real corridor, and it would win if every gap is the same uniform 1 m (true for 336 of 340 doors in Aurora).
2. **Pin snapping (the office §10.4 idea; your ruling).** Each connector end and lift stop moves to the nearest point on walkable floor of its own level, within a named maximum. Every move and its distance is logged. A pin beyond the maximum is not moved, and it gets item 3 or is reported (O3).
3. **`ADD_PATH` backup (your ruling).** Where a channel can't be drawn or a pin is beyond the maximum, the converter writes a `NavCorrection` of kind `ADD_PATH` from the door or pin to the nearest walkable floor. Publish still checks it for walls (AC-12) and orphans (AC-14). It depends on the door getting a node (O4).
4. **A converter report** listing every channel, move and correction, for your review, plus a seed test: each Demo Malls venue publishes with warnings only (AC-66).
5. **Validate before writing** (office §10.4's "validate the proposal before returning it"). The seed test runs the engine's own validation on the converted venue.

### 4.2 FF-10's editor (fits the approved spec, or needs only a P0-11 r3 wording change)

- **Pointer and keys** (office §8.2, §8.3; DC-15 desktop first):
  - one-letter tool keys, mapped to FF-10's tools;
  - wheel zoom at the pointer, with a minimum and maximum set from the level's size;
  - right or middle drag to pan;
  - Esc steps back (cancel calibration, then the chain, then the tool, then the selection);
  - Delete; arrows nudge 0.1 m, Shift+arrow 1 m;
  - Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y.
- **Snapping** (office §8.3): end-point snap within a radius in screen pixels, so it tightens as you zoom in; drawn edges in 15° steps with Shift for a free angle; Alt for no snap. The 0.1 m step itself is Q8.
- **Undo** (office §8.4, G2): a drag is one undo step, and adding a batch of elements is one undo step.
- **Save state and conflicts** (office §8.4, P0-11 AC-28): a visible save state. On a 409 the editor goes to "conflict", stops sending, and offers Reload. A stale write is never retried.
- **The door tool** (office §8.2, P0-11 DC-7): click a unit's edge, and the door lands there with a default width, snapped to the outline.
- **Connectors** (office §4.2): a stair's footprint can be placed as a blocking object (the Shaft type), with its ends at the landings outside the footprint. This avoids the Demo Malls pin fault by construction.
- **Backdrop** (office §9, P0-11 AC-8):
  - calibration starts as soon as an image is chosen;
  - the first clicked point stays put;
  - an absurd scale is refused with a plain message (the range is a named constant);
  - opacity and lock are screen-only state;
  - **the 7-decimal lesson as a written rule:** never store or round a derived scale; keep the raw pixels A and B and `RealDistanceM`.
- **Upload checks** (office §9.1): magic bytes (FF-10 DC-F10, already); read the pixel size from the header without decoding; refuse a decompression bomb above the megapixel cap. The cap's values are Q16.
- **Checks panel, client layer** (office §8.6): the cheap hygiene checks of Q12(a), each selecting its element. No engine rule is copied into Dart.
- **Deletes**: G12 already matches the office's cascade (a unit takes its own doors with it); P0-01 B4's level rule stays.
- **Conventions written into every layer** (office §3), once O1 is answered.

---

## 5. The overall approach, its alternative, and where each lands

**Recommended: fit, don't transplant.** Adopt §4's editor behaviour and drawing rules on Gabay's existing schema. Keep the relational tables, L108, metres, the publish-time graph and blocking publish. Defer the 3D preview to FF-4's renderer.

- **Rework:**
  - FF-1: none.
  - FF-3 A1's engine: none (unless Q9 is answered (b)).
  - FF-2: the converter (§4.1).
  - FF-10 is re-planned before it starts: P0-11 r3 and FF-10 plan 1.1, folding in §4.2 and the answers to Q6, Q8, Q12, Q15 and Q16.
  - P0-03 r4 only if Q5(a) or Q12(a) is chosen: the republish route and the dry-run checks route.
  - Schema: 0.15 as planned (`BoundaryIsDrawn`), and nothing more unless Q2(b) or Q7(b) is chosen.
- **Slice order (PH4 §4 unchanged):**
  1. FF-3 B2 takes the converter fix before its seeded publishes (AC-66). FF-2 is still on `ff2-seeds`, so the branch is O5.
  2. FF-10 is re-planned now, ahead of its start (it runs beside FF-9).
  3. The preview follows FF-4.
  4. P1-03 later inherits office §10.2 and §10.4.

**Alternative: full adoption.** One `JSONB` document per venue with autosave, rollback with draft restore, a frozen catalog, a three.js preview, an AI conversion step, costs in seconds and non-blocking checks.

- **Rework:**
  - a schema rewrite with the first migration;
  - FF-1's level routes and screens (merged server, `ff1-client`);
  - FF-2's writers;
  - FF-3 A2's snapshot reader (A1's engine survives through an adapter);
  - P0-11 and FF-10 re-specified from scratch;
  - P0-01, P0-02, P0-03, P0-06 and P0-12 revised;
  - every reversal in each question's (b) option: L108, L86, the Batched Save rule, AC-13, E-20 rule 3, rule 5, rule 7's lint, and two new EXCEPTIONS entries (three.js, possibly the AI provider).
- **Slice order:** a "storage rework" slice before FF-3 B2, because B2 publishes the seeds from the tables, and FF-4 onwards waits for B2's packages.
- **When it would be the better choice:** if you want the office designer's model as Gabay's map model in its own right, and accept the reversals listed.

**Finish date:** unknown either way. There is no measured pace (PH4 §8). The recommended route adds work only inside FF-10 and B2; the alternative re-opens three slices.

**Records once you rule** (the main session, same turn):
- a `plan.html` row (version bump, changelog row);
- the `gabay-product-rulings` skill, for the product rulings;
- P0-11 r3, FF-10 1.1 and FF-3's B2 note;
- the modules page;
- this file promoted or retired.

---

## 6. Open questions (unknowns, not assumed)

- **O1.** Which way does +Y run in Gabay's frame (up or down the screen), and which way and from what zero does `RotationDeg` turn? Neither is written in `schema.sql`, the Blueprint or the specs I read; only `MapUpDeg` is ("clockwise from the plan's +Y axis"). engine-coder can read the seeds' `geo.js` and A1 to answer; you confirm. Needed for Q8.
- **O2.** The converter's channels: which IMDF unit category (a walkway category is RECALLED until FF-10's step 0 checks the IMDF list)? Should they carry `NeedsReview`? L108 covers plan import, not seeds. Marking them would make every Demo Malls publish refuse (AC-11), against AC-66, so I lean to "not marked", but that is your call.
- **O3.** The pin-snapping maximum, and what happens beyond it. Bayview has 50 of 93 pins more than 5 m from walkable floor; Skyline Spire's "Stairs north" sits on no walkable unit. Options: move the pin, add a landing channel at the pin, write an `ADD_PATH`, or report it. Is a move of several metres acceptable for how the shopper map looks?
- **O4.** The `ADD_PATH` backup needs the door to have a node. A1's design choice 8 says "a door that joins nothing … gets no node", while store doors get nodes. Does a store door whose straight join fails still get a node that an `ADD_PATH` end can snap to (within `publish.addPathSnapM`, 1.5 m)? engine-coder should confirm on `ff3-engine-a1` before B2 relies on it.
- **O5.** Which branch takes the converter fix? FF-2 is unmerged on `ff2-seeds` in api-coder's copy; FF-3 plan §4.7 says the main session asks you which branch takes FF-2 file changes in B2.
- **O6.** The seeded malls already exceed PRD §7's about 20,000 nodes at 1.5 m (Aurora 33,842; Bayview 76,150; A1 report). That is AC-75's warning only (D14), but it bears on any grid change and on the 3.2 ms routing target (L166). It is measured in B2 and FF-4.
- **O7.** Which object types do malls need (for example kiosk, bench, planter, column, escalator void), and their sizes? G13 left the offer open.
- **O8.** Did "adopt everything" mean to override the earlier rulings (L86, L108, the Batched Save rule, AC-13, E-20 rule 3), or to fit around them? This file assumes the second and asks each in §3.
- **O9.** Editor speed at mall scale (thousands of elements on a level, `flutter_map` hit-testing, which FF-10 §12 marks RECALLED) is unmeasured. The office's 2 m bucketing for overlap checks may be needed.
- **O10.** If Q4(b): three.js's licence and current version are RECALLED and unchecked.
- **O11.** The pdf.js `eval` advice (office §9; the CVE-2024-4367 class; the `isEvalSupported` option and the fixed version) is RECALLED. Check it at P1-03, or at FF-10 if Q16(c) is chosen.
- **O12.** If Q1(b) or (c): does the standard accept domain records held in one JSON column under rule 7's `schema-forms` lint, or is an EXCEPTIONS entry needed? The standard's text, searched this session, says nothing on it beyond the `NVARCHAR(MAX)` soft-cap line.
- **O13.** If Q2(b): would wall kinds improve the BLE planner's signal model (L40, FF-11)? The value is unknown.
- **O14.** If Q6(a): is a browser-stored draft acceptable for the penthouse's internal-only data (L48) on this machine? Under E-20 it never leaves localhost.

## Suggestions (not in scope)

- A "row of stores" tool, the mall form of the office's most-used desk-block tool (Q15).
- A two-metre bucket index for the editor's overlap check, as the office uses, if O9 shows it is needed.
