# OFFICE-ADOPTION-replan: Gabay's map storage, editor, publish and routing re-planned on the office map designer spec

> **Version**: 1.3 | **Date**: 2026-10-14 | **Status**: APPROVED by Genesis Perez, 2026-10-12 (L170, L171). Every question in §2 is ruled (each marked "Ruled 2026-10-12"); all as recommended except Q11, ruled (b) (geometry plus stores). N1 and N6 are answered (§7); O3 and O7 are proposed in OA-3 for your yes. The exceptions in §4 are signed (L171). Each slice still needs its own approved spec revision and plan before it is built (OA-0) | **Audience**: the product owner (Genesis Perez), the main session, spec-writer and every coder | **Scope**: what full adoption of `OFFICE_MAP_DESIGNER_SPEC.md` v1.0 (the iqpeople HRIS "Virtual Office" designer spec; untracked, kept out of git, cited by section as "office §n", never copied) means for Gabay. Covers the sub-decisions it leaves open, the new slice order, the specs to revise, the new EXCEPTIONS entries, the rework, what continues and what pauses, and the records to write once you approve.
>
> **The ruling this plan carries out (2026-10-12, confirmed twice):** **full adoption, as an override.** You chose override over "fit around rulings", in these words: "Gabay's map storage, editor, publish and routing follow the office spec where they clash: one JSON document per venue, autosave, AI plan conversion, warnings-only publish, costs in seconds, three.js 3D preview, export/import. Rewrites merged FF-1 level work, FF-2's seed writers and FF-3's snapshot reader; reverses L86, L108, the Save rule, AC-13, E-20 rule 3; needs new exceptions (three.js, an AI provider) and your DPO review of sending floor plans to an AI. I'd write the re-plan for your approval first." An earlier ruling stands: the Demo Malls fix is that the converter cuts door channels (office §11), pins are snapped (the idea in office §10.4), and ADD_PATH corrections are the backup. The office file stays out of git.
>
> **The owner's answers (2026-10-12, recorded as L170 and L171):** Q1–Q10 and Q12–Q16 (a), as recommended; **Q11 (b)**: export and import carry the geometry **plus the stores** (names, categories, keywords), and import also writes `Occupant` rows (not the recommendation; §2 Q11, §1.1 and §4 are rewritten to it). **N1:** the office spec is Dynamiq's own design; Gabay may follow it. **N6:** two-way escalators stay two-way, a Gabay-only exception to office §4.2 (a two-way flag on escalators; the converter does not split them). **O3 and O7:** proposed in OA-3 for your yes. **Signed (L171):** E-25 to E-28, and the E-20 and E-13 amendments, each as §4 states.
>
> **Supersedes:** the recommendation in `plan/OFFICE-SPEC-adoption.md` 0.1 ("fit, don't transplant"). That file's §2 table, Q1–Q16 and O1–O14 are the inputs here. Each Q is now resolved toward the office side (§1.3); each O is answered or carried forward (§7).
>
> **Read for this plan:**
> - The office spec, all of it.
> - `plan/OFFICE-SPEC-adoption.md` 0.1.
> - CLAUDE.md: the seven rules, the stack, E-20, the Evidence Standard, and L115's delegation.
> - The `gabay-product-rulings` skill.
> - `plan/PH4-feature-first.md` 1.0.
> - `db/schema.sql` 0.14: the venue, navigation, version, beacon, closure and analytics tables.
> - Blueprint Part 1 (invariants 1–16, `<known_traps>`, the pins) and Part 3 §3.1–§3.5.
> - Specs: P0-01 r3, P0-02 r2, P0-03 r3 (§3 in full), P0-04 r3, P0-06 r4, P0-07 r2, P0-11 r2 and P0-12 r2.
> - Plans: FF-3 1.0, FF-4 1.0 and FF-10 1.0.
> - plan.html rows L29, L30, L32, L34, L37, L39, L48, L86, L88, L91, L92, L102, L108, L116, L119, L123, L153, L164 and L166.
> - `docs/process/EXCEPTIONS.md`.
> - The standard's §1, §3.6, §3.15, §4.10, §7.2 and §8.2.
> - Branch state: `origin/main` e6a53f9 holds FF-0, FF-SK, FF-1's server and FF-2 (L169). `ff1-client` and `ff3-engine-a1` are unmerged.
> - `phase-reports/feature-first/FF-3-A1.md` and `Spike-2.md`; `db/seeds/lib/{demo,geo}.js` on `origin/main`.
>
> **Checked this session (evidence, not memory):**
> - **three.js:** `registry.npmjs.org/three/latest` reads version **0.186.1**, licence **MIT**, no runtime dependencies (read 2026-10-12).
> - **Claude models:** the bundled `claude-api` skill (its model table cached 2026-09-25) lists `claude-sonnet-5-5` ($2 / $10 per million input / output tokens) and `claude-opus-5-5` ($4 / $20). It shows image input as base64 `image` content blocks, and structured JSON output through `output_config.format`. The prices match L164's read of platform.claude.com on 2026-10-09.
> - **The seeds' frame:** `db/seeds/lib/geo.js` states "x east, y south, origin at the site's north-west corner". That is the office frame (office §3).
>
> Everything else about outside libraries and services is tagged **RECALLED**.

---

## 0. Recommendation (read this first)

**Approve this re-plan. It adopts the office spec as Gabay's map model and keeps only what the office spec does not cover, or what a ruling you did not reverse still requires.**

What the plan does:

1. **Pause FF-3 (A2 onward), FF-10 and FF-11 now.** Do not merge `ff3-engine-a1` as it stands. Then build three new foundation slices before FF-3 resumes:
   - **OA-1:** the venue map document and its validator;
   - **OA-2:** storage and lifecycle;
   - **OA-3:** the seeds as documents, carrying the ruled Demo Malls fix.
2. **Then FF-3 resumes as FF-3′.** It is the same engine, adapted to read the document. It reuses most of A1's code (§5), costs routes in seconds, and publishes with warnings only.
3. **The editor (OA-4) replaces FF-10.** It is built as office §8 and §9 describe, and I recommend moving it earlier, ahead of FF-4's screens (Q14). The 3D preview (OA-6) and AI conversion (OA-5) follow it. AI conversion waits on your DPO assessment and an amendment to E-20.
4. **Keep the parts of Gabay no ruling of yours reversed.** These are:
   - the walkway graph generated at publish (L32);
   - one router (invariant 6) and the 3.2 ms routing target (L166);
   - shortcuts through stores only when marked and allowed (L92);
   - one venue spanning buildings and the outdoor ground (L29, L30);
   - frozen published versions (invariant 3);
   - sealed packages (invariant 8);
   - tenant binding (rule 2);
   - stores, beacons and closures as relational rows (the office's "geometry and people stored apart", office §1 property 3).
5. **Ask for four new EXCEPTIONS entries and two amendments** (§4): three.js; the AI provider's SDK; the `schema-forms` lint reading the map document's schema instead of `schema.sql`; a PNG decoder for the plan measurement (if Q9 is answered (a)); E-20 rules 1 and 3 amended; E-13 widened.

**Why this shape.** Your confirmation names seven things the office spec decides (§1). The office spec is silent on several things a mall needs:
- multiple buildings and the outdoor ground;
- stores and their status;
- step-free routing and store shortcuts;
- beacons;
- the shopper package;
- a phone-side router with a latency target.

For those, this plan keeps Gabay's rulings and fits them into the document. It does not invent replacements (Evidence Standard item 1). Where the override reaches further than the five reversals you listed, I name it and ask (Q2), and I do not assume. One example: "warnings-only publish" also reverses L92's "publish refuses a walkway that crosses a wall" and AC-11's review gate.

**What you will see, and when.** Nothing new on screen during OA-1 to OA-3 (about three slices). After OA-3, the four Demo Malls venues and MEZZ load as documents. After FF-3′, they publish with warnings only. After OA-4, the office-style editor with autosave runs in your browser.

**Finish date:** unknown. FEATURE_PIPELINE forbids dates and percentages ("No dates, no percentages, no estimates-as-commitments"), and there is no measured pace (PH4 §8). The cost is stated as slices instead (§5).

---

## 1. What "full adoption" means for Gabay, area by area

Notation:
- "Follows" names the office section that now governs.
- "Reverses / changes" names the Gabay ruling, rule or criterion it overrides.
- "Kept or adapted" covers what the office spec does not decide.

Every adaptation that fills a gap is a **DESIGN CHOICE** with an alternative.

### 1.1 The areas

| Area | Follows | Reverses or changes in Gabay | How it lands in Gabay (kept or adapted) |
|---|---|---|---|
| **Storage** | Office §1 (properties 1 and 4), §4.1, §6.1, §12 items 1 and 3 | Rule 7's column projection (bent, E-26); invariant 13's composite FKs on element rows; Blueprint Part 3 §3.3–§3.4; DC22 (NeedsReview columns); FF-1's building and level tables; FF-10's schema 0.15 (`BoundaryIsDrawn`, superseded) | **One JSON document per venue** in a new `VenueMap` row: tenant-bound with a composite FK to `Venue`, holding `DraftJson`, `DraftVersion` and `PublishedVersion`. Ids are stable strings generated by the editor (office §3). See Q1 and the element tables in §3.4 |
| **Editor** | Office §8.1–§8.7: 2D editing; tools with one-letter keys; snapping (10 cm, screen-pixel end snap, 15° steps, Shift and Alt); snapshot undo to 100 steps; save states; floor tabs; panels; Checks; History; export and import | P0-11 r2 rewritten (r3); FF-10 1.0 retired; "copy and paste, multi-select" now in scope (office §8.3) | `flutter_map` with `CrsSimple` stays the canvas (E-04). The panels stay `FieldSpec`s (rule 7, through E-26). The People panel becomes a **Stores** panel (§1.2). The desk-block tool becomes a **row of stores** tool: DESIGN CHOICE, N stores of a given width along a line; *alternative:* no block tool |
| **Draft, publish, rollback** | Office §6.2: `baseVersion` on every save; a stale save is a 409 and the only recovery is reload; publish re-validates and strips backdrops in one locked transaction; rollback republishes an old version as a new version and makes it the draft again; layouts cached by (map, version) | **The Batched Save named rule** (P0-11 §2.4, AC-27, AC-29; G1): **reversed** to autosave. FF-1 DC-6's per-element tokens and P0-11 AC-28: replaced by one `baseVersion` per venue | Each published version stores its layout document and its package (DESIGN CHOICE: `VenueVersion` gains a frozen `LayoutJson`; *alternative:* a separate `VenueMapVersion` table as office §6.1). That makes office-style rollback possible, which the analysis's Q5(b) could not do from a package alone. Frozen rows stay frozen (invariant 3, trigger unchanged). Deleting a map: Q12 |
| **Validation versus checks** | Office §4.3: a pure validator that canonicalises, reports problems by path, caps at 20 and runs at save and at publish. Office §8.6: checks that warn and never block, each selecting its elements | **AC-13 reversed (your ruling).** By the same logic, AC-11 (the L108 review gate), AC-12 (L92 "publish refuses a walkway that crosses a wall"), AC-14, AC-15, AC-16, AC-18 and AC-20 become warnings, **unless Q2 keeps some blocking**. PRD §6.3 "every store reachable" changes | The validator is the only gate on save. Publish adds only what Q2 rules. A1's validation checks are kept as **check code** with severity "warning" (§5). Error shape: the standard's `{ error, problems[] }` (standard §3.8 wins over office §7's codes, by the Evidence Standard's precedence note) |
| **Navigation and graph** | Office §11: doors cut a channel after blockers are marked; an unreachable goal ends at the nearest reachable point, never with a straight-line fallback; the entrance fallback; one level shown at a time in the runtime | P0-06 gains "nearest reachable point" (office §11). P0-03 AC-24 is amended: the walkable area follows office semantics (§1.2) | **Kept: the publish-time graph** (L32, not reversed), 1.5 m and 16 neighbours (FF-3 DC-P3), sized for the 3.2 ms target (L166, not reversed). Office §11's 0.25 m grid is used **only** as the clearance and body-margin rule inside graph generation (Q6) |
| **Routing costs** | Office §11: seconds. `stairs = 1.5 + 1.1·Δelevation`, `escalator = 1 + 0.8·Δ`, `elevator = 4 + 0.4·Δ`; `preferred` × 0.7; `walkable: false` never used; escalators one-way, **except that Gabay keeps a two-way escalator two-way** (a two-way flag on the escalator; N6, ruled 2026-10-12, a Gabay-only exception to office §4.2) | **L86 and L91 reversed** (metres, the demo's height-based metre costs); invariant 15 rewritten; P0-06 AC-10 ("metre cost ÷ 1.2 m/s"); `routing.stairsSaveM`; ConnectorType's `CostBaseM` and `CostPerRiseM` | The walking speed, the ramp and walkway formulas (the office has no ramp), what the shopper sees, and whether malls may tune the formulas: Q4. The heuristic trap stays satisfied, because P0-06 AC-36 derives A*'s estimate from the package's own edges, so a × 0.7 edge lowers the derived coefficient instead of breaking it (`<known_traps>`, heuristic) |
| **AI conversion** | Office §10: off by default; a proposal only, applied as one undo step; a gridded crop to the model; measured raster walls (§10.2); tidy-up (§10.4); validate before returning | **L108 reversed** ("no AI, no OCR", in the browser, at P1-03). Plans now go to a server route | Provider, model, place, cost, gate and timing: Q8 and Q9. Needs the E-20 amendment (§4) and your DPO assessment (L116). The penthouse drawings are internal only (L48), so they are excluded until Raphael Mendoza agrees (Q8) |
| **3D preview** | Office §8.1: docked, resizable, preview only (editing stays 2D) | P0-11's "no 3D". The analysis's Q4(a) (reuse FF-4's 2.5D renderer) is not taken | three.js 0.186.1 (MIT, checked) in the admin web page only, through JS interop. E-25. Its look differs from the shopper's 2.5D map (L83), accepted by your ruling. Q10 |
| **Export and import** | Office §8.7: a file `{ format, version, exportedAt, fromLocation, map }`; backdrops stripped; no personal data; import replaces the drawing only | **E-20 hard rule 3 ("Nothing is exported or kept") amended** | Format `gabay.venue-map` version 1. **The file carries the geometry plus the venue's stores** (names, categories, keywords), and import also writes the `Occupant` rows (Q11, ruled (b)). Beacons, status history and backdrops stay out. Exported files never enter git (a `.gitignore` pattern), because penthouse data is internal (L48, L123) |
| **Catalog** | Office §5: one server-owned catalog served to the editor, copied nowhere; the map stores the catalog version it was drawn with; resize ranges, mount (floor or wall), round; unknown types drawn as boxes | Office §5's "frozen in code" clashes with **rule 5** and invariant 14, which this plan does not override without an exception | **DESIGN CHOICE:** `ObjectType` stays the lookup (tenant-extensible) and gains resize-range, mount and round columns. One `GET` serves the whole catalog with a version (the max `UpdatedAt` or a counter). *Alternative:* a frozen in-code catalog under a new EXCEPTIONS entry against rule 5. Q13. The office's item types are office furniture; the mall library is L39's (Pillar, Shaft, Furniture, kiosk and so on; the analysis's O7) |
| **Coordinates** | Office §3: metres, rounded to the millimetre; `x` across, `z` down the plan, top-left origin; `rot` in degrees clockwise, where 0 faces up the plan (−z); ids matching `^[A-Za-z0-9_-]{1,40}$`; `mpp` kept to 7 decimals | Invariant 2 restated. `MapUpDeg`'s definition ("clockwise from the plan's +Y axis", DC24) restated as "clockwise from up the plan (−z)". The analysis's O1 is answered for the seeds | **Already true of the seeds:** `geo.js` uses x east, y south, origin at the north-west corner. **Adapted:** one frame per venue (E10 kept, for same-height joins and the package). Each level is a rectangle given by `origin` and `size` in that frame (DESIGN CHOICE; *alternative:* the office's per-level origin at (0,0), which breaks D6's same-height joins across buildings). Q5 |
| **Backdrops and uploads** | Office §9: magic bytes; size read from the header without decoding; 15 MB; 50–10,000 px a side; ≤ 50 MP; ≤ 20 per venue; PNG, JPEG and WebP; stored outside the web root; calibrate first; draft only; pruned after 24 h; PDF rasterised in the browser with a self-hosted engine and `eval` off | N4 and A21 (10 MB, PNG and JPG, one per level), changed. E-13 widened (pdf.js in P0, for backdrops) | The calibration lives in the document (`backdrop.mpp`, 7 decimals), replacing `FloorUnderlay`'s raw two points. Files are `StoredFile` with purpose `UNDERLAY` and a 32-hex key. Venue scope replaces "location" |
| **Limits** | Office known limits: 10 levels, 2,000 walls, 2,000 openings, 300 rooms, 5,000 items, 40 connectors, 4 MB | PRD §7 (sites up to about 100,000 m²) | **The office caps would refuse the seeds.** Bayview Grand has 19 levels (the A1 report: 19 "No beacons" warnings) and 93 connector pins. So the caps become mall-sized named constants, measured in OA-3. Q15 |

### 1.2 What the office spec does not cover, and how Gabay keeps or adapts it

| Mall need | Kept or adapted | Why (trace) |
|---|---|---|
| **Several buildings and the outdoor ground in one venue** | The document holds `buildings[]` (name, building type code, footprint, `mapUp`) and `levels[]`. Each level has a `building` key or is marked `outdoor`. One document per venue, so cross-building, same-height joins (D6, P0-03 AC-28) keep working | L29, L30, D6; your "one JSON document per venue". The office's "one map per location, no campus" limit is not adopted for this reason |
| **Walkable area** | **DESIGN CHOICE (the office's semantics plus Gabay's non-walkable rooms):** walkable area = the level rectangle, minus walls (with the body margin), minus blocking items, minus **non-walkable rooms**. Non-walkable rooms are stores, voids (`opentobelow`), back-of-house and structure, chosen by IMDF category through FF-10's DC-8 category-to-walkable map. On the outdoor ground, every building footprint at its elevation is also left out. Doors are gaps in walls and in room outlines. *Alternative:* the office's semantics alone (rectangle minus walls and items). That would route every shopper through every two-door store, against L92, and would make upper floors walkable outside their building | Office §11 (blockers, door channels); L92 (store crossings only when marked); L30 |
| **Stores (occupants)** | Office §1 property 3 and §6.3, applied to stores. A store is a relational `Occupant` row keyed on the room's id inside the document (`UnitKey`, VARCHAR(40)), as the office keys desk assignments on desk ids. The office's statuses carry over: a store on a room that exists only in the draft is "pending"; one whose room is gone from both is "removed". Status history (`StoreStatusChange`) and the live overlay (L102) stay relational. A store change saves at once, outside the drawing's undo (office §6.3) | Office §1 property 3 and §6.3; L83, L102, L104 |
| **Opening hours and door rules** | Not adopted now (L29, L33: P2-02). When they come, they go on `Occupant` (relational), never into the document | L33 |
| **BLE beacons** | Relational `Beacon` rows stay, re-keyed to `LevelKey`, with x and y in the venue frame. Uniqueness and the namespace stay enforced by the database (invariant 9). A beacon on a level that no longer exists is shown as "removed" (office §6.3's statuses) and is a check | Invariants 7–9; P0-12; L114 |
| **Shopper package** | Built at publish from the published layout document plus `Occupant`, `Beacon` and settings rows. The allow-list (invariant 8, P0-03 §3.7) is unchanged in what it carries; ids become strings. `PackageFormatVersion` stays 1, because no reader exists yet (FF-4 not started; R31) | Invariants 3 and 8; L102; D6 confirmed by Spike 2 |
| **Step-free routing (P0-07)** | Openings carry `clearW` (from `ClearWidthM`, L88). Connector kinds add `ramp` (step-free, two-way) and keep the step-free flag from `ConnectorType.IsStepFree`. Clearance per edge stays (P0-03 AC-30) | L88, P0-07 |
| **Store shortcuts (L92)** | Rooms carry `passThrough`. Crossings cost length × `routing.storeCrossingFactor` (1.25), now in seconds. Passages stay (D10) | L92 |
| **Evacuation-only connectors (L87)** | An `evacuationOnly` flag on the connector, separate from the office's `walkable: false` (scenery) | L87 |
| **Spoken names, `MapUpDeg`** | `spokenName` on levels and connectors (stores keep theirs on `Occupant`); `mapUp` on the venue and buildings | L111, L112 |
| **Graph corrections (L32)** | A `corrections[]` list per level (`BLOCK_AREA`, `ADD_PATH`, `REMOVE_PATH`), kept as a Gabay extension | L32, the ruled ADD_PATH backup |
| **Amenities, transit points, landmarks** | Point lists per level, each with a lookup **code** (DESIGN CHOICE: codes, so that an exported map moves between databases, office §8.7; *alternative:* lookup ids, which are exact within one database but break export after `setup-db`). The codes resolve tenant first, then platform (the global-lookup trap). AC-19's tenant check becomes "the code resolves for this tenant" | Rule 5, the global-lookup trap; office §8.7 portability |
| **Office-only fields** | Desks, hot desks, monitors, seating, departments, and the comfort-room sign, capacity and minutes are **left out** (DESIGN CHOICE; *alternative:* carry them through the validator unused). Nothing in Gabay reads them, and a sign set would be an option list under rule 5 | Office §4.2, §6.3 are about seating |
| **Colours** | Floor and item **finishes as keys only**. The office's floor `color` hex is not stored; the renderer maps keys to `gabay_tokens.dart` | Rule 6 (office §5 already keeps colours in the renderer) |

### 1.3 The analysis's Q1–Q16, as now resolved

| Q | Resolved toward the office as | Where in this plan |
|---|---|---|
| Q1 Storage | (c) one document per venue, levels and buildings included | §1.1, Q1 |
| Q2 Walls | Explicit walls (office §4.2), **plus** non-walkable rooms (§1.2). D4's derived walls survive only as room outlines | §1.2, Q3 |
| Q3 AI | (b) office §10, now and on a server route | Q8, Q9 |
| Q4 3D | (b) three.js | Q10 |
| Q5 Rollback | (b) with draft restore, now possible from the stored layout; delete is Q12 | §1.1, Q12 |
| Q6 Autosave | (b) 1.5 s, 409 stops saving | Q7 |
| Q7 Catalog | Office §5 served once; resize, mount and round as `ObjectType` columns (rule 5 kept) | Q13 |
| Q8 Frame | (b) office frame, one per venue | Q5 |
| Q9 Grid and channels | Channels in the engine (office §11) **and** in the converter (as ruled); the graph stays | Q6 |
| Q10 Seconds | (b) seconds, `preferred` × 0.7 | Q4 |
| Q11 Unreachable | (b) nearest reachable point; the entrance fallback for checks | Q2, Q4 |
| Q12 Checks | (c) non-blocking, plus office-style client checks and server checks on the autosaved draft | Q2, §3 OA-4 |
| Q13 Limits | Office-style caps, sized for malls | Q15 |
| Q14 Export | (b) now | Q11 |
| Q15 Editor scope | All of office §8.3, including multi-select, duplicate, group rotate, "make the floor this size" and history | §3 OA-4 |
| Q16 Uploads | (b) and (c): WebP, 15 MB, the office pixel checks, PDF rasterised in the browser | §1.1 |

---

## 2. The sub-decisions full adoption still leaves open (owner questions)

Each question gives 2–3 options with the recommended one first, and what each costs. They are repeated briefly in the question sheet (§8).

**Q1. One document per venue: are buildings and levels inside it?** (Office §2 "Map = one building"; your "one JSON document per venue"; L29, L30.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: yes.** The document holds the venue's site (boundary, georeference, `mapUp`), `buildings[]`, `levels[]` and connectors. The `Venue` table keeps only identity (code, name, active, audit). FF-1's building and level routes and screens retire; the editor's floor tabs and "Add floor" (office §8.1) replace them. *Cost:* FF-1's building, level and boundary code retires (§5). It matches your "rewrites merged FF-1 level work".
- (b) Buildings stay a table; levels go into the document. *Cost:* two places for structure, and a building delete must check the document.
- (c) One document per building, the office's literal unit. *Cost:* breaks same-height joins across buildings and the outdoor ground (D6, AC-28, L30). Not recommended.

**Q2. "Warnings only": does anything still block publish?** (Office §8.6 "only server validation blocks"; P0-03 §3.2; L92, L108.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: block only on what makes a package impossible or unsafe to build.** That is:
  - the document fails the validator (office §4.3, re-run at publish);
  - nothing walkable on any level (AC-20, "an empty map");
  - a lookup code that resolves to another tenant's row (AC-19, tenancy);
  - a beacon identity collision or a mixed `Major` (AC-17, AC-87: positioning safety).

  Everything else becomes a warning: unreachable places, orphans, unpaired connectors, outside the boundary, unreadable shapes (the validator catches most), and an ADD_PATH through a wall. *Cost:* L92's "publish refuses a walkway that crosses a wall" and L108's review gate become warnings; PRD §6.3 changes; the shopper app needs Q4's unreachable behaviour.
- (b) Literal office: only the validator blocks. *Cost:* as (a), plus a package with no walkable floor or a beacon collision can publish.
- (c) Also keep "every store reachable from an entrance" blocking. *Cost:* keeps part of AC-13, which your ruling reverses by name.

**Q3. What happens to `NeedsReview` (L108)?** (Office §10.5: proposals are reviewed when accepted.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: an optional per-element `review: true` flag, set on AI-accepted elements, shown as a check ("N elements from the plan conversion not yet confirmed") and a filter.** It never blocks. MEZZ's seeded doors keep the flag, so the check is visible. *Cost:* small. AC-67's refusal becomes a warning test.
- (b) Drop it entirely; the accept step is the review. *Cost:* none, but you lose the "what came from the AI" marker after accept.
- (c) Keep it blocking. *Cost:* contradicts "warnings-only publish".

**Q4. Costs in seconds: the formulas, the speed, and what the shopper sees.** (Office §11; L86 and L91 reversed; PRD §6.6.) **Ruled 2026-10-12: (a).**
- **(a) Recommended:**
  - Walking costs length ÷ `routing.walkSpeedMps` (1.2, PRD §6.6's figure).
  - Connectors cost the office formulas.
  - Ramp: `1 + 1.0·Δ` and level walkway `0` (DESIGN CHOICE, because the office has no ramp; *alternative:* treat ramps as stairs, which wrongly makes them non-step-free in cost terms).
  - `preferred` × 0.7.
  - Formulas held as `ConnectorType` columns `CostBaseS` and `CostPerRiseS` (a lookup each mall can tune, rule 5), seeded with the office values.
  - The stairs rule becomes `routing.stairsSaveS` = 120 (L99's 144 m ÷ 1.2).
  - The shopper sees **"About N min"** from seconds (Walking pace still divides, PRD §6.23), and **metres from the edges' real lengths** (P0-03 AC-42 already stores them), so "About N m to walk" (PRD §6.5) stays true.

  *Cost:* P0-03 AC-33, P0-06 (AC-10, the vectors), P0-07, PRD §6.6 and invariant 15 revised.

  **Know this before you rule:** the office numbers make floor changes nearly free. At a 4.5 m rise, stairs cost about 6.5 s under the office formula against 34 + 3 × 4.5 = 47.5 m (about 40 s) today, and a lift has no waiting time. Routes will change floors far more readily than the demo's.
- (b) Office formulas fixed in code, not tunable. *Cost:* rule 5 (an option a mall could tune), so it needs an EXCEPTIONS entry.
- (c) Seconds, but with the demo's values converted (metres ÷ 1.2). *Cost:* keeps today's routing behaviour in seconds; departs from the office numbers.

**Q5. Coordinates: one venue frame with level rectangles, or the office's per-level frames?** (Office §3; E10; invariant 2.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: one venue frame in the office's orientation** (x across, z down, top-left origin, `rot` clockwise, 0 facing up the plan). Each level is `origin` + `size` within it, and everything is clamped inside its level rectangle. `MapUpDeg` is re-stated against "up the plan". *Cost:* wording plus the validator; the seeds already use this orientation (`geo.js`).
- (b) Office literal: every level's own origin at (0, 0). *Cost:* breaks same-height joins and the package's one frame (E10, P0-06 AC-36).

**Q6. The navigation representation in the shopper package.** (Office §11's 0.25 m grid against L32, FF-3 DC-P3, L166.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: keep the publish-time graph at 1.5 m with 16 neighbours,** and apply office §11 inside it:
  - blockers grown by the body margin (0.24 m, a `publish.*` setting);
  - doors cut channels through that margin;
  - an unreachable goal routes to the nearest reachable node (P0-06), never a straight line.

  *Cost:* engine changes in FF-3′ (§5). The size and latency evidence: Aurora already has 33,842 nodes at 1.5 m (A1), and Spike 2's 3.2 ms target was set on 20,015 nodes.
- (b) A 0.25 m grid in the editor's checks only (office check 7), with the graph in the package. *Cost:* two derivations, against P0-11 AC-22's "one derivation".
- (c) A 0.25 m grid in the package. *Cost:* about 36 times the nodes (1.5² ÷ 0.25²): roughly 1.2 million for Aurora. Not viable on the 3.2 ms target.

**Q7. Autosave and conflicts: confirm the office behaviour as-is?** (Office §6.2, §8.4.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: yes.**
  - Autosave 1.5 s after the last change, at once for structural actions.
  - States: none, dirty, saving, saved, error, conflict.
  - A 409 goes to "conflict" and stops all saving until Reload; never a merge.
  - A best-effort save on leaving the page.
  - One editor per venue at a time (office known limit); two admins on different levels of one venue will conflict.

  *Cost:* R3 must decide how draft autosaves are audited (Q16).
- (b) Autosave with a per-level `baseVersion`. *Cost:* departs from office §6.2, and a cross-level change (a connector) needs two versions.

**Q8. Which AI provider and model, and the DPO assessment.** (Office §10; L116; L48.) **Ruled 2026-10-12: (a).**
- **(a) Recommended:**
  - A provider-neutral port on the server, with **Claude through `@anthropic-ai/sdk`** as the first adapter.
  - Checked this session: image input as base64 blocks, and structured JSON output through `output_config.format`.
  - Model `claude-sonnet-5-5` ($2 / $10 per million tokens), with `claude-opus-5-5` ($4 / $20) as a setting.
  - The office's quality figures were measured on a "gemini-class" model, so no Claude figure exists. OA-5 measures it on invented plans and MEZZ before you rule it in.
  - Off by default (a fail-closed module flag `ai.planConversion`, invariant 16), plus a configured key in `.env`, never committed (standard §3.16).
  - **Penthouse drawings never sent** until Raphael Mendoza agrees (L48 "internally only").
  - Your DPO assessment, as Gabay's DPO (L116), recorded before the first call: cross-border processing; the provider's retention and training terms (RECALLED, unchecked); a notice to the mall that uploads.

  *Cost:* E-27 (or none under (c)), E-20 rule 1 amended, and a per-plan cost that is unknown until measured. The image-token price rule is RECALLED.
- (b) Google Gemini (the office's reference model class). *Cost:* every capability and price RECALLED; a Google SDK needs its own EXCEPTIONS entry.
- (c) Claude through Node 22's built-in `fetch` (raw HTTP), no SDK. *Cost:* no EXCEPTIONS entry for a library, but you hand-write retries and typed errors that the SDK provides.

**Q9. Where the plan is measured (office §10.2's raster walls), and when AI conversion is built.** **Ruled 2026-10-12: (a).**
- (a) **Recommended: on the server, as the office does.** It needs a PNG decoder library (`pngjs`, MIT: RECALLED) and its EXCEPTIONS entry (E-28). Built in OA-5, **after** the editor's backdrop and calibration (OA-4), and only once Q8's DPO record and the E-20 amendment exist. *Cost:* one library and its pin.
- (b) In the browser (Flutter Web canvas pixels through `package:web`, E-23), sending measured walls to the server. *Cost:* no new library; Dart pixel loops over a 3,200 px image in the browser are unmeasured (RECALLED as feasible).
- (c) Keep AI conversion at P1-03's timing (after the retrofit). *Cost:* none now, but it delays what you ruled in.

**Q10. three.js: version, place and look.** **Ruled 2026-10-12: (a).**
- (a) **Recommended:** three.js 0.186.1 (MIT, checked on npm 2026-10-12), in the admin web page only, as a self-hosted module file served from the admin build, never from a CDN (office §9's self-host principle; the page's CSP in `firebase.json`, E-05). It is embedded through a platform view and `dart:js_interop` with `package:web` (E-23); that embedding is RECALLED and checked in OA-6's step 0. It shows the saved draft, one level or the whole stack, from catalog primitives (office §5 design note). *Cost:* E-25, a Blueprint pin, interop code, and a second renderer whose look differs from the shopper map.
- (b) The same, but loaded from a CDN. *Cost:* simpler build; an outside host at runtime, against the self-hosting rule above.

**Q11. Export and import: what goes in the file?** (Office §8.7; E-20 rule 3 amended.) **Ruled 2026-10-12: (b)** (not the recommendation; rewritten below).
- **(b) Ruled: geometry plus stores.** The file is the venue map document with backdrops stripped, **plus the venue's stores** (each store's name, category and keywords, keyed on its room's id in the document), as `{ format: "gabay.venue-map", version: 1, exportedAt, fromVenue: { code, name }, map, stores }`. Beacons and status history stay out. Import replaces the draft as one undo step with an immediate save, **and also writes the `Occupant` rows** for the imported stores. Stores are not personal data. *Cost:* the import route writes two things (the draft and the `Occupant` rows), so OA-2's spec must say how they stay consistent (DESIGN CHOICE for OA-2, e.g. one transaction; *alternative:* the draft first, the stores as a separate confirmed step); what happens to the venue's existing `Occupant` rows on import (replaced, merged by room id, or refused when present) is an **OPEN QUESTION** for OA-2's spec, not assumed here. E-20 rule 3 amended to "throwaway test maps, with their stores, may be exported to and imported from this machine; never committed" (L171).
- (a) Not taken: geometry only (stores, beacons and status history out; import replaces the draft only). It was the recommendation, because import would then write only the draft.

**Q12. Deleting a map.** (Office §6.2 "delete map removes the map, its versions … images", against invariant 3 and `TR_VenueVersion_Frozen`.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: "Clear the draft" only** (a blank draft, saved as a new draft version). Published versions are never deleted (invariant 3 is not in your reversal list); venues stay deactivate-only (P0-01 B4). *Cost:* none.
- (b) Office literal. *Cost:* deleting `PUBLISHED` rows means disabling the trigger and reversing invariant 3; the analytics rows that point at versions are lost.

**Q13. The catalog: lookup table or frozen in code?** **Ruled 2026-10-12: (a).** (Office §5 against rule 5.) Recommended (a): `ObjectType` with new resize-range, mount and round columns, served whole as the office's catalog route. (b): frozen in code under an EXCEPTIONS entry against rule 5. (§1.1.)

**Q14. Slice order: the editor before or after the shopper map?** (PH4 §4 puts FF-10 at step 10. Your earlier words were "especially for the map specs and creation on the admin side more importantly".) **Ruled 2026-10-12: (a).**
- (a) **Recommended: OA-4 (the editor) right after FF-3′, beside FF-4's engine half.** flutter-coder takes OA-4 first and FF-4's Map tab second (the PH4 capacity note: flutter-coder sets the pace).
- (b) Keep the editor at step 10, after FF-9.

**Q15. Size limits.** (Office known limits against PRD §7 and the seeds.) **Ruled 2026-10-12: (a).**
- (a) **Recommended: the office's caps as named constants, with mall values measured in OA-3** (the largest seed × 2, rounded up) for levels, walls, openings, rooms, items and connectors. The document size cap stays below `MAX_JSON_BODY` (5 MB) until measured.
- (b) The office's numbers as they are. *Cost:* Bayview Grand is refused.

**Q16. Autosave and the audit trail (for R3, asked now so the storage slice is shaped right).** Standard §3.6 audits every PUT. An autosave every 1.5 s writes many rows, each capped at about 4 KB, so the document itself is truncated. **Ruled 2026-10-12: (a).**
- (a) **Recommended: audit every draft save with a body-free summary** (venue, draft version, size, a hash of the document), and audit every publish and rollback in full. *Cost:* an R3 design note; the redaction utility gets a "summarise" path.
- (b) Audit publishes only. *Cost:* deviates from §3.6, so it needs an EXCEPTIONS entry.

---

## 3. Re-sequenced slices

### 3.1 What happens to each existing slice and spec

| Slice or spec | Status under this plan | Why |
|---|---|---|
| FF-0, FF-SK (merged) | **Kept unchanged** | No map storage |
| FF-1 server (merged) | **Partly retired.** Venue routes, `venue.service.js`, `fieldInput.js`, `idParam.js`, `foreignKeyInUse.js` and `venueLock.js` are kept. Building and level routes and services, and `venueBoundary.js`, retire (Q1) | Levels and buildings move into the document |
| FF-1 client (`ff1-client`, unmerged) | **Trimmed, then merged.** Venue list and form, and the shared machinery (`record_form`, decimal field, paged list, `refresh_on_return`, the forms changes), are kept. Building and level screens and their tests are dropped before merge (DESIGN CHOICE; *alternative:* merge whole and retire later, which merges code already known to be dead) | As above |
| FF-2 seeds (merged) | **Writers rewritten** (`demo.js`, `spike.js` emit documents); `geo.js`, `exports.js` and `run.js` kept and adapted. This is OA-3 | Your confirmation |
| FF-3 A1 (`ff3-engine-a1`, unmerged) | **Adapted as FF-3′ A1′,** not merged as is (§5) | The engine reads the document; checks become warnings; seconds |
| FF-3 A2, A3, B1–B3 (not built) | **Re-planned as FF-3′** | The snapshot reader becomes a document read; refusal becomes warnings |
| FF-4 | **Kept;** spec revisions for seconds, string ids and the nearest reachable point | Q4, Q6 |
| FF-5 to FF-9 | **Kept;** small spec revisions where they read map data (P0-05: element ids in the FTS rows; P0-07: ramp and clearance; P0-13 and P0-15: none expected; P0-09: the boundary from the document) | Read paths change, behaviour does not |
| FF-10 (P0-11 r2, plan 1.0) | **Superseded by OA-4** (P0-11 r3, a rewrite; FF-10 plan retired) | Office §8 |
| FF-11 (P0-12 r2) | **Kept, revised** (P0-12 r3): walls come from the document (with kinds: solid, glass, partition, which may feed the signal model, the analysis's O13); beacons re-keyed | Reads draft walls |
| Retrofit R1–R13 | **Unchanged in order (after FF-11, PH4 §9 Q4),** with design notes: R2 permission routes `venue-maps`; R3 audit as Q16; R5 the validator is the boundary check (zod: §3.3 item 1); R11 `ObjectType` maintenance with the catalog columns; R12 e2e; R13 recreates databases | — |

### 3.2 New and changed slices, in order

| # | Slice | Coders (model, L164) | Delivers | Depends on |
|---|---|---|---|---|
| 0 | **OA-0: records and specs** | main session; spec-writer | §9's records; the spec revisions in §3.3; the EXCEPTIONS entries (§4) for your signature; this plan promoted | Your approval of this plan and §8's answers |
| 1 | **OA-1: the venue map document and validator** | engine-coder (**Opus 5.5**: a new core contract) | The `gabay.venue-map` spec 1 shape (office §4 plus §1.2's extensions), written as one machine-readable layout schema file. A pure validator that canonicalises, rounds to millimetres (7 decimals for `mpp`) and reports problems by path, capped at a named constant (office §4.3). `publishable()` (strips backdrops). The catalog read. A generated Dart copy of the schema for the panels and `schema-forms` (E-26). Document versioning: a spec-version upconverter on read, so frozen versions are never rewritten (DESIGN CHOICE; *alternative:* rewrite stored drafts in a migration, which cannot touch frozen versions anyway) | OA-0 |
| 2 | **OA-2: storage and lifecycle** | api-coder (**Opus 5.5**: high-risk, transactions and concurrency, L164) | Schema 0.15 and **migration 0001** (§3.4); the routes `GET /api/venues/:venueId/map`, `PUT …/map/draft` (`{ layout, baseVersion }`, 409 stale), `POST …/map/publish` (wired to FF-3′), `POST …/map/rollback`, `POST …/map/clear` (Q12), export and import moved to OA-3 (OA-2 Q10 (a), L173), backdrop upload, serve and prune (office §9); FF-1's building and level routes retired; ledger rows | OA-1 |
| 2b | **FF-1 client, trimmed** | flutter-coder (Sonnet 5.5) | §3.1's trim and merge | Your go; can run beside OA-1 and OA-2 |
| 3 | **OA-3: seeds as documents and the Demo Malls fix** | api-coder (Sonnet 5.5) | The converters emit documents. Stores become non-walkable rooms with walls and doors. The ruled fix: door channels (office §11), pin snapping to walkable floor within a named maximum (office §10.4 idea), ADD_PATH corrections as the backup, and a converter report. Two-way escalators are kept two-way with the two-way flag, never split (N6). O3 (the pin-snapping maximum) and O7 (the mall object types) are proposed here for your yes. The validator runs on every converted document before writing (office §10.4 "validate before returning"). Mall caps measured (Q15). Seed tests | OA-2 |
| 4 | **FF-3′: the publish engine on the document** | engine-coder (Opus 5.5) A1′; api-coder (Sonnet) A2′; flutter-coder (Sonnet) A3′; then B1–B3 as FF-3 1.0 §2 | A1′: A1 adapted (§5): the document parser replaces `draft.js`; walls and the walkable area per §1.2; the body margin and door channels; seconds costing; checks as warnings; Q2's blocking set; the nearest-reachable data the router needs. A2′: the snapshot reads the published-to-be document plus `Occupant` and `Beacon` rows in one `REPEATABLE READ` transaction. A3′: the publish screen lists warnings. B: the package writer and the seed publishes (all Demo Malls with warnings only) | OA-3 |
| 5 | **OA-4: the editor (replaces FF-10)** | flutter-coder (Sonnet 5.5); api-coder (Sonnet) for the Stores panel routes; engine-coder (Opus) for the server checks route | Office §8.1–§8.7 and §9 (calibration, backdrop mode, PDF rasterise in the browser, E-13 widened): tools and keys, snapping, snapshot undo, autosave with its states, the conflict stop, the Checks panel (cheap checks client-side, debounced 400 ms; graph checks through one server route on the autosaved draft, the same code as publish, so there is no copy in Dart, P0-11 AC-22's principle), export and import, history and rollback, the Stores panel, "make the floor this size", multi-select, duplicate, group rotate, the row-of-stores tool | OA-2 (the client can start against the contract); FF-3′ A1′ for the server checks. **L175:** runs beside OA-3, after the Venues trim (slice 2b); OA-4 and OA-3 must put the main building first in `buildings` (L176, Q18) |
| 6 | **FF-4** (as approved, on revised specs) | as FF-4 1.0 | — | FF-3′ B |
| 7 | **OA-6: the 3D preview** | flutter-coder (Sonnet 5.5) | three.js docked preview (Q10) | OA-4 canvas; E-25 signed |
| 8 | **OA-5: AI plan conversion** | engine-coder (Opus 5.5) for measurement, tidy-up and the proposal validator; api-coder (Sonnet) for the route; flutter-coder (Sonnet) for crop, grid and the proposal view | Office §10.1–§10.5: the gridded and clean crops, the server guards (aspect ratio within 2 %, decompression limits, a long timeout), measured walls and desk-free rooms, the model call for names, types, glass and thin partitions, and doors, the tidy-up, validation before returning, the proposal shown and accepted as one undo step with the `review` flag (Q3) | OA-4 backdrop; Q8's DPO record; E-20 amended; E-27 and E-28 signed |
| 9 | FF-5, FF-6, FF-7, FF-8, FF-9, FF-11 | as planned | On their revised specs | As PH4 |
| 10 | Retrofit R1–R13 | as PH4 §6 | With §3.1's notes | **L175:** R1 to R9 and R11 after FF-11, OA-6 and OA-5 and before FF-4 to FF-9; R10, R12 and R13 after FF-9 |

**Order under L175 (2026-10-14).** The rows are numbered as approved; they are *built* in this order: 1 to 3 (done or in progress), 4 and 5 (OA-3 with OA-4's client beside it, then FF-3′ A1′ for OA-4's server checks), 7 (OA-6), 8 (OA-5), 9's FF-11, row 10's R1 to R9 and R11, then 6 (FF-4's Stage F; its engine and location channel are built early, L176), 9's FF-5 to FF-9, and row 10's R10, R12 and R13.

### 3.3 Spec, PRD and Blueprint revisions (listed, not written)

| Document | Revision | What changes |
|---|---|---|
| **P0-01** r4 | Rewrite of the building and level parts | Venue record only; buildings and levels in the document (Q1); B4 for the map (Q12) |
| **P0-02** r3 | Seeds as documents | Documents instead of rows; the Demo Malls fix; MEZZ `review` flags (Q3); AC-66 "warnings only" kept, AC-67 reworded |
| **P0-03** r4 | Major | §3.2 to warnings (Q2); AC-24 walkable semantics (§1.2); body margin and door channels; AC-33–AC-35 seconds (Q4); AC-11 review as a check (Q3); the snapshot (document plus rows); ids as strings in the package; AC-83 preview and the new server checks route; layout stored with the version |
| **P0-04** r4 | Minor | String element ids; "About N min" wording |
| **P0-06** r5 | Moderate | Seconds (AC-10, the vectors, the stairs rule in seconds); nearest reachable point; `preferred` and its effect on AC-36's derived estimate |
| **P0-07** r3 | Minor | `ramp` kind; clearance from the walkable area with the body margin |
| **P0-11** r3 | Rewrite | Office §8 and §9 as Gabay's editor (OA-4) |
| **P0-12** r3 | Minor | Walls from the document with kinds; beacons keyed by `LevelKey` |
| **New entry** (pipeline ID: DESIGN CHOICE "P0-17 Plan conversion"; *alternative:* pull P1-03 forward and widen it) | New intent and spec | Office §10 (OA-5) |
| **New entry** "P0-18 3D preview" (or folded into P0-11 r3) | New intent and spec, or a section | OA-6 |
| **PRD** | §6.1, §6.2, §6.3, §6.5, §6.6, §7 | Document storage, autosave, warnings-only publish, seconds, export and import, AI conversion |
| **Blueprint** | Part 1 | Invariants 2, 3 (layout frozen with the version), 13 (the document row keeps the composite FK; keys inside are service-checked), 15 (seconds), 16 (`ai.planConversion`); pins for three.js, the AI SDK and `pngjs` |
| **Blueprint** | Part 3 | §3.3–§3.5 rewritten; §3.10's DC7, DC21 and DC22 updated |
| **Blueprint** | Part 4 | §4.1, §4.6; §2.5 external integrations (the AI provider) |
| **FEATURE_PIPELINE** | — | P0-11's row; the new entries; P0-03's dependency on OA-1 to OA-3 |
| **PH4-feature-first** | 1.1 | §4's table with the OA slices; §7's ledger rows retired and added |

### 3.4 Schema 0.15 in outline (OA-2; rule 4, the first migration)

- **New:** `VenueMap` (one per venue: `TenantId`, `VenueId`, `DraftJson JSONB`, `DraftVersion`, `PublishedVersion`, audit columns; composite FK to `Venue`). `VenueVersion` gains `LayoutJson JSONB`, NOT NULL when `PUBLISHED`, so the frozen trigger covers it. `StoredFile` gains a 32-hex backdrop key, or a small backdrop table (OA-2's DESIGN CHOICE).
- **Dropped (12 tables):** `Building`, `Level`, `Unit`, `Opening`, `FloorUnderlay`, `FloorObject`, `Amenity`, `TransitPoint`, `Anchor`, `NavConnector`, `NavConnectorStop`, `NavCorrection`.
- **Re-keyed to string keys** (composite FKs to element rows become service checks against the document):
  - `Occupant.UnitId` → `UnitKey`;
  - `StoreStatusChange.UnitId`;
  - `Beacon.LevelId`;
  - `BeaconPlan.LevelId`;
  - `Closure.LevelId` and `NavConnectorId`;
  - `AnalyticsDailyUnit.UnitId`;
  - `AnalyticsDailyCell.LevelId` and `DestinationUnitId`.
- **Lookups:** `ObjectType` gains resize ranges, mount and round (Q13); `ConnectorType`'s cost columns move to seconds (Q4).
- **Venue:** keeps code, name and active; its boundary, georeference and `MapUpDeg` move into the document (DESIGN CHOICE; *alternative:* keep them as columns).
- **Count:** 56 tables become about 45. Re-run twice as before.
- FF-10's planned `BoundaryIsDrawn` migration is not written.

### 3.5 Models per coder (L164: Sonnet 5.5 the default coder; Opus 5.5 for engine and high-risk work)

- **Opus 5.5:** OA-1, OA-2, FF-3′ A1′, OA-4's server checks, OA-5's measurement and tidy-up.
- **Sonnet 5.5:** OA-3, FF-3′ A2′ and A3′, OA-4's client and routes, OA-6, OA-5's route and client, FF-1's client trim.
- **test-verifier:** writes the tests first on each slice, as in FF-1 and FF-10.

---

## 4. New EXCEPTIONS entries and amendments (each signed 2026-10-12 by the product owner under Raphael Mendoza's delegation, L115, L171; expiries as below)

| Proposed ID | Rule deviated from (standard section) | What is used instead | Sign-off needed | Expiry (proposed) |
|---|---|---|---|---|
| **E-25** (signed, L171) | §1 stack table (a library §1 does not name) | `three` 0.186.1 (MIT; npm registry read 2026-10-12), admin web page only, self-hosted, through JS interop; never in the shopper app | You, under Raphael Mendoza's delegation (L115) | 2027-04-02 (the quarterly sweep, as the others) |
| **E-26** (signed, L171) | §4.10 ("derived from the column it writes to") and §7.2's `schema-forms` lint ("parse `CREATE TABLE` blocks in `schema.sql`") | Map-document fields project from the layout schema file (OA-1), and the lint gains a mode that checks each editor `FieldSpec` against that file (type, nullability, length, scale). Every field is still a `FieldSpec` (rule 7's no-bare-`TextField` part is kept) | You, under delegation. I also recommend sending it to Allan Young as a proposal for the standard (as H5 was) | 2027-04-02 |
| **E-27** (signed, L171; Q8 (a)) | §1 stack table | `@anthropic-ai/sdk` (version read from npm at OA-5's start; RECALLED until then), server only, in one module that imports no `decrypt()` (standard §7.2's suggested lint, adopted as a structural linter) | You, under delegation, **after** your DPO assessment (L116) | 2027-04-02 |
| **E-28** (signed, L171; Q9 (a)) | §1 stack table | `pngjs` (RECALLED: MIT, pure JavaScript; checked at OA-5's start), server only, to decode the clean plan crop for office §10.2's measurement | You, under delegation | 2027-04-02 |
| **E-20 amendment** (signed, L171) | E-20's hard rules 1 ("Localhost only") and 3 ("Nothing is exported or kept") | Rule 1: plan crops of throwaway or invented test plans may be sent to the approved AI provider from this machine, never the penthouse drawings without Raphael Mendoza's permission (L48). Rule 3: venue map files of throwaway test maps, **with their stores** (Q11 (b)), may be exported to and imported from this machine, never committed (a `.gitignore` pattern) | You, under delegation (E-20's own approver) | Unchanged (E-20's expiry) |
| **E-13 amendment** (signed, L171) | E-13's scope ("to read vector PDF floor plans … for draft generation", P1) | `pdfjs-dist` also rasterises a chosen PDF page in the browser for the backdrop (office §9), from OA-4, with `eval` disabled (the `isEvalSupported` option and the CVE-2024-4367 class are RECALLED, checked at OA-4's step 0). Self-hosted | You, under delegation | Unchanged |

**Not needed** (checked against the standard's text and the rules):
- three.js colours: rule 6 is kept, because finishes are keys.
- The catalog: rule 5 is kept if Q13 is (a).
- Seconds: rule 1 does not apply, because costs are not money.
- Migrations (rule 4): kept.
- The document's own shape versioning: a new practice inside the standard's §8.2, not a deviation.
- Q16(b) would need its own entry against §3.6, which is why (a) is recommended.

---

## 5. Rework cost and risk, per built component

| Component | Kept | Rewritten | Discarded | Risk |
|---|---|---|---|---|
| **FF-1 server** (merged; about 111 tests in its venue, building, level and boundary files) | Venue routes and service (`venues.test.js` 28, `schemaMirror` 7, `tenantBoundary` 5); `fieldInput.js`, `idParam.js`, `foreignKeyInUse.js`, `venueLock.js` and their tests | — | Building and level routes and services, `venueBoundary.js`, and about 69 tests (`buildings*` 30, `levels` 30, `venueBoundary` 9), with their manual cases and ledger rows | Low: deletions plus a schema change; the venue lock pattern is reused by OA-2 |
| **FF-1 client** (`ff1-client`, unmerged) | Venue screens, the shared form and list machinery (`decimal_text`, `refresh_on_return`, `routed_form_scaffold`, the `field_spec` changes), and their tests | — | Building and level models, `FieldSpec`s, view models, screens and tests (about 3,200 lines of tests) | Low; the trim before merge needs care around shared files |
| **FF-2 seeds** (merged) | `geo.js`, `exports.js`, `run.js` (adapted), the source JSON, the privacy and rerun tests | `demo.js` (184 lines), `spike.js` (105), the content tests, `seed.visible.test.js` | Row writers | Moderate: the converter now also emits walls around stores; the Demo Malls fix rides on it |
| **FF-3 A1** (`ff3-engine-a1`, unmerged; 7,669 lines, 107 tests) | Geometry (`planar`, `shapes`, `bucketIndex`); `graphSearch`, `passages`, `storeCrossings`; `graphKinds`, `issues`, `closedSets` and the generator; the graph generator's lattice, joins, corrections and determinism; `packageAllowList`'s principle; most validation files as check code | `draft.js` (becomes the document parser); `walls.js` (explicit walls plus room outlines); `walkable.js` (§1.2 semantics, body margin, door channels); `connectorCosting.js` (seconds, `preferred`); `packageModel.js` (string ids, the layout); `reviewGate.js` (a check, Q3); `publishEngine.service.js` (severity per Q2); the test fixture builder (documents, not rows) | Nothing outright | Moderate. Many tests change because their fixtures change; each changed test is listed with its reason (C1). My unmeasured estimate is that most of A1's logic survives, since the walkable-area and costing files are the heart of the change |
| **Specs and plans** | P0-04 to P0-09, P0-13 to P0-16 almost untouched | P0-01, P0-02, P0-03, P0-06, P0-11 and P0-12 revised or rewritten (§3.3) | FF-10 plan 1.0 | Spec-writer time; every approved plan citing the old revisions must move (CLAUDE.md "the spec moved past the revision the plan cites") |

**Risks, plainly:**
- **Autosave plus warnings-only publish.** A half-drawn floor saved by one admin can be published by another. The office accepts this; Gabay's shopper app keeps the old version until a new one verifies (PRD §6.3), which limits but does not remove it.
- **Routing changes character with seconds** (Q4): more floor changes, and lifts look cheaper. The vectors and the demo comparison no longer match the demo app (L86 was "this follows the demo").
- **AI conversion leaves the machine.** It is the first data that leaves localhost under E-20. The DPO record, the provider's terms (RECALLED) and the penthouse exclusion are hard preconditions.
- **The Functions emulator's request timeout** for a 2–3 minute conversion (office §10.1) is RECALLED, about 60 s for an HTTP function per FF-3's risk note, and unchecked. It is measured at OA-5's step 0; a background job is the fallback, and that comes to you.
- **Document size at mall scale is unmeasured.** OA-3 measures Aurora's and Bayview's documents against the 5 MB request body.
- **Rework is now a second wave on top of the retrofit's** (PH4 §8's HIGH). This plan reopens three built components and adds six slices.

**Timeline.** Measured in slices, because FEATURE_PIPELINE forbids dates and percentages:
- three new foundation slices before FF-3 resumes (OA-1, OA-2, OA-3);
- one trim (FF-1 client);
- FF-3 re-planned;
- FF-10 replaced by a larger OA-4;
- two new slices (OA-5, OA-6);
- ten spec documents revised.

The first screen of the new model (the editor) comes after OA-2 and OA-3; the first phone route after FF-3′ and FF-4, later than in PH4 1.0 by OA-1 to OA-3. If the modules page (the artifact named in CLAUDE.md's sync table) shows a progress figure, the main session updates it from these slice counts. Whether it shows a percentage is an open question (§7), and I did not assume one.

---

## 6. What continues meanwhile, and what pauses

**Continues (unaffected):**
- FF-0 and FF-SK (merged), the development stub, the lookups route and the switcher.
- The CI follow-up and the verify tooling.
- Spike 2's results and L166's target.
- FF-1 client's venue screens (merge after the trim).
- FF-9's native BLE scanning work (native-ble), which reads no map storage.
- Spec-writing for FF-5 to FF-8 parts that do not read the map.
- The retrofit R1–R13's designs (still scheduled after FF-11; only the notes in §3.1 change).
- FF-7 (voice) needs only "About N min" wording from Q4. Its build order is unchanged (after FF-6).

**Pauses until OA-0 records your answers:**
- FF-3 (A2, A3, B; no merge of A1);
- FF-10 (replaced);
- FF-11 (walls change);
- FF-4 (waits on FF-3′ anyway);
- the FF-2 converter fix in its old form (it moves into OA-3);
- the building and level half of FF-1's client.

---

## 7. Design choices, open questions and RECALLED claims

**Design choices in this plan, each with its alternative:**
1. Layout stored with `VenueVersion` (§1.1). *Alternative:* a separate version table, as office §6.1.
2. One venue frame with level rectangles (Q5). *Alternative:* per-level frames.
3. Walkable semantics: the office's plus non-walkable rooms and building footprints (§1.2). *Alternative:* the office's alone.
4. Lookup codes in the document (§1.2). *Alternative:* ids.
5. Office-only fields left out (§1.2). *Alternative:* carried unused.
6. Ramp and walkway formulas (Q4). *Alternative:* ramps as stairs.
7. Trim FF-1's client before merge (§3.1). *Alternative:* merge and retire later.
8. Upconvert old document versions on read (OA-1). *Alternative:* rewrite drafts by migration.
9. The new pipeline IDs P0-17 and P0-18 (§3.3). *Alternative:* widen P1-03 and P0-11.
10. Venue spatial fields moved into the document (§3.4). *Alternative:* keep them as columns.
11. The row-of-stores tool (§1.1). *Alternative:* none.
12. Connector landings: each connector carries the office's footprint (`x`, `z`, `rot`, `w`, `len`, `shape`) **and** explicit per-level landing points, defaulted from the footprint, so the seeds' From and To pins convert exactly. *Alternative:* landings derived only, which forces the converter to invent footprints.
13. The validator's problem cap as a named constant, default 20 per office §4.3, with the total reported. *Alternative:* no cap (P0-03 DC-1's "none dropped").
14. JSONB for the document (Blueprint naming: "JSON is JSONB", L98). *Alternative:* TEXT, as office §6.1 stores it. JSONB's key reordering is RECALLED, and harmless because nothing keys on position (office §1 property 4).
15. The office file kept out of git through the local `.git/info/exclude`, not `.gitignore`, so its name is not committed. *Alternative:* a `.gitignore` line.

**Open questions (not assumed):**
- **The analysis's O-list, now:**
  - **O1** is answered for the seeds (`geo.js`), and Q5 is ruled (a): one venue frame in the office orientation, `rot` clockwise with 0 facing up the plan, `MapUpDeg` re-stated against "up the plan".
  - **O2** (channel category) mostly falls away under §1.2's semantics. The converter report counts the channels it still needs.
  - **O3** (the pin-snapping maximum, and whether a move of several metres is acceptable on the shopper map): **ruled 2026-10-12: OA-3 proposes it for your yes. Closed 2026-10-14 (L178, OA-3 Q1 (a)): 5 m; a farther pin gets an ADD_PATH line.**
  - **O4** (the door node for an ADD_PATH end) is engine-coder's check in FF-3′ A1′.
  - **O5** is resolved: FF-2 is on `main`, so OA-3 branches from `main`.
  - **O6** (graph size against 20,000 nodes) stays; it is measured in FF-3′ B2.
  - **O7** (the mall object types and sizes): **ruled 2026-10-12: OA-3 proposes it for your yes. Closed 2026-10-14 (L178, OA-3 Q2 (a)): KIOSK, STALL, BENCH and PLANTER with starting sizes (RECALLED), editable per mall later.**
  - **O9** (editor speed at mall scale) is measured in OA-4.
  - **O10** is checked: three.js 0.186.1, MIT.
  - **O11** (pdf.js `eval`) is RECALLED and checked at OA-4.
  - **O12** becomes E-26.
  - **O13** (wall kinds in the planner) goes to P0-12 r3.
  - **O14** falls away with autosave.
- **N1.** Is the iqpeople HRIS spec Dynamiq's own design, free for Gabay to follow? The file's origin and rights are not stated in it. **Answered 2026-10-12 (L170):** it is Dynamiq's own design; Gabay may follow it. The file still stays out of git (the earlier ruling).
- **N2.** The AI provider's data retention and training terms, and whether Philippine mall plans may go to it (Q8; DPO).
- **N3.** The per-plan AI cost: image-token pricing is RECALLED, so it is measured in OA-5.
- **N4.** The Functions emulator's and Cloud Functions' maximum request time for OA-5 (RECALLED).
- **N5.** Does the modules page show a progress percentage that needs updating? I did not open the artifact.
- **N6.** Do the Demo Malls escalators drawn two-way stay two-way? Under office §4.2 an escalator is always one-way (levels[0] to levels[1]), so the converter splits each two-way escalator into two. That is a visible change to L86's "as the real mall is". **Answered 2026-10-12 (L170): two-way escalators stay two-way.** This is a Gabay-only exception to office §4.2: escalators carry a two-way flag, and the converter does not split them (OA-3, FF-3′).

**RECALLED (checked before each carries weight):**
- three.js embedding in Flutter Web through a platform view and `dart:js_interop`.
- WebGL availability in the admin browsers.
- `pngjs`'s licence and API.
- zod's JSON Schema export, if OA-1 builds the layout schema on zod (named by standard §3.7).
- pdf.js `isEvalSupported`.
- Gemini's capabilities and prices.
- The image-token cost rule.
- The emulator's and Cloud Functions' timeouts.
- PostgreSQL's JSONB size limits and key ordering.

---

## 8. Owner question sheet

1. **Approve this re-plan** as the way to carry out the full-adoption ruling? (Yes / changes.) **Approved 2026-10-12 (L170).** Items 2 to 17 not marked otherwise below were ruled as recommended; item 18 was signed (L171).
2. **Q1 Storage:** buildings and levels inside the venue document, with FF-1's building and level routes and screens retired? Recommended (a).
3. **Q2 What still blocks publish:** only an invalid document, nothing walkable, a cross-tenant lookup and a beacon collision? Recommended (a). Note: this also makes L92's wall refusal and L108's review gate warnings.
4. **Q3 `NeedsReview`:** a non-blocking `review` flag and check? Recommended (a).
5. **Q4 Seconds:** the office formulas, walking at 1.2 m/s, ramps `1 + 1.0·Δ`, tunable per mall in `ConnectorType`, the stairs rule at 120 s, and the shopper seeing "About N min" plus metres from real lengths? Recommended (a). Note: floor changes become much cheaper than today.
6. **Q5 Frame:** one venue frame in the office's orientation, levels as rectangles in it? Recommended (a).
7. **Q6 Graph:** keep the 1.5 m publish-time graph, with office §11's body margin, door channels and nearest-reachable rule? Recommended (a).
8. **Q7 Autosave:** the office behaviour as-is, one editor per venue at a time? Recommended (a).
9. **Q8 AI provider:** Claude through `@anthropic-ai/sdk` behind a neutral port, Sonnet 5.5 by default, off by default, no penthouse drawings without Raphael Mendoza's permission, and your DPO record first? Recommended (a).
10. **Q9 Measurement and timing:** server-side measurement with `pngjs`, built after the editor (OA-5)? Recommended (a).
11. **Q10 three.js:** 0.186.1, self-hosted, admin page only? Recommended (a).
12. **Q11 Export:** geometry only; stores stay out? Recommended (a). **Ruled (b): geometry plus stores; import also writes `Occupant` rows.**
13. **Q12 Delete:** "Clear the draft" only; published versions never deleted? Recommended (a).
14. **Q13 Catalog:** `ObjectType` with resize, mount and round columns (rule 5 kept)? Recommended (a).
15. **Q14 Order:** the editor (OA-4) right after FF-3′, before FF-4's Map tab? Recommended (a).
16. **Q15 Limits:** office-style caps with mall values measured in OA-3? Recommended (a).
17. **Q16 Audit of autosave (R3):** a summary row per draft save, publishes in full? Recommended (a).
18. **Sign:** E-25 (three.js), E-26 (`schema-forms` from the layout schema), E-27 (the AI SDK, after your DPO record), E-28 (`pngjs`, if Q9 (a)), the E-20 amendment (rules 1 and 3) and the E-13 amendment?
19. **N1:** may Gabay follow the iqpeople spec's design (whose is it)? **Answered: Dynamiq's own design; Gabay may follow it.**
20. **N6:** may the converter split Demo Malls two-way escalators into one-way pairs? **Answered: no; two-way escalators stay two-way (a Gabay-only exception to office §4.2).**
21. **O3 and O7:** the pin-snapping maximum, and the mall object types you want in the catalog (or "later")? **Answered: proposed in OA-3 for your yes; ruled 2026-10-14 (L178): O3 5 m, O7 four mall object types.**

---

## 9. Records to write on approval (main session, same turn)

**Written 2026-10-12** on branch `office-adoption-records` (this file 1.0; `plan.html` 0.99, L170 and L171; EXCEPTIONS; PH4 1.1; the FF-10, FF-3 and OFFICE-SPEC-adoption headers; FEATURE_PIPELINE; the PRD and Blueprint header notes; the product-rulings skill; CLAUDE.md), adjusted for Q11 (b), N1 and N6. Left for the main session: the G4 rows, the modules page, and the memory. The office file is already in `.git/info/exclude`.

- **`plan.html`** (version bump and changelog row; re-read the version first, the next row is L170):
  - **L170:** the full-adoption ruling and this re-plan approved. It names the reversals: L86 and L91 (metres to seconds), L108 (AI conversion, proposal-only), the Batched Save named rule (autosave), P0-03 AC-13 and the other refusals per Q2 (L92's wall refusal included), and E-20 rule 3 (export and import). It also names §8's answers.
  - **L171:** the EXCEPTIONS approvals (E-25 to E-28, E-20 and E-13 amendments).
  - **G4 rows:** the office-only fields left out; office caps resized; a frozen catalog not taken (if Q13 (a)).
- **The `gabay-product-rulings` skill:** the "Settled" lines for L86 (seconds), L92 (its publish-refusal clause), L108 (AI conversion) and L119 ("stored as the schema specifies", now as documents), and a new L170 line.
- **CLAUDE.md:** the E-entries in the stack paragraph; a sync-table row "the layout schema file → the generated Dart copy, the `schema-forms` lint's document mode, Blueprint Part 3"; the AI SDK module lint under Commands if added.
- **`docs/process/EXCEPTIONS.md`:** E-25 to E-28 and the two amendments, with the changelog.
- **`plan/PH4-feature-first.md` 1.1:** §4's slice table with the OA slices; §7's ledger: FF-1's building and level rows closed as retired, new rows for OA-2's routes.
- **`plan/FF-10-map-editor.md`:** marked superseded by OA-4.
- **`plan/FF-3-publish-engine.md`:** marked superseded by FF-3′.
- **`plan/OFFICE-SPEC-adoption.md`:** marked "superseded by `plan/OFFICE-ADOPTION-replan.md`".
- **FEATURE_PIPELINE:** P0-11's row, the new entries, P0-03's dependency.
- **PRD and Blueprint:** a header note now, the full text in OA-0.
- **The modules page** (the artifact named in CLAUDE.md's sync table).
- **Locally, not committed:** `OFFICE_MAP_DESIGNER_SPEC.md` added to `.git/info/exclude`, so it stays out of git (your ruling).

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.3 | 2026-10-14 | A record only (L178): O3 and O7 closed (the open-question lists) by the 2026-10-14 spec sitting; nothing else changes |
| 1.2 | 2026-10-14 | A record only (L175, L176): §3.2's rows 5 and 10 and a note on the order they are built in (the admin-first order: OA-4 beside OA-3, the retrofit's admin half before FF-4 to FF-9); the rows' content is unchanged |
| 1.1 | 2026-10-13 | A record only (L173): §3.2 row 2 says export and import moved to OA-3 (OA-2's spec Q10 (a), ruled 2026-10-13); nothing else changes |
| 1.0 | 2026-10-12 | Approved by Genesis Perez (L170, L171). Every Q marked "Ruled 2026-10-12": Q1–Q10 and Q12–Q16 (a); Q11 (b), geometry plus stores, with §1.1, §2 Q11, §3.2 OA-2 and §4's E-20 amendment rewritten to it and the existing-`Occupant`-rows behaviour left open for OA-2's spec. N1 answered (Dynamiq's own design). N6 answered (two-way escalators stay two-way, a Gabay-only exception to office §4.2; §1.1, §3.2 OA-3). O3 and O7 proposed in OA-3. §4's exceptions signed. §9 marked written |
| 0.1 | 2026-10-12 | Draft for the product owner's approval |

## Suggestions (not in scope)

- A two-metre bucket index for the editor's overlap check (office §8.6 item 5) if OA-4's measurement shows it is needed.
- A "start from the seed source" button in the editor for the Demo Malls venues (office §8.7's "from the automatic layout", adapted).

### Critical Files for Implementation
- `C:\Users\User\FlutterProjects\Gabay\db\schema.sql` (0.14 → 0.15: `VenueMap`, `VenueVersion.LayoutJson`, the 12 tables dropped, the re-keyed tables)
- `C:\Users\User\FlutterProjects\Gabay\spec\P0-03.md` (r4: warnings-only publish, walkable semantics, seconds, the snapshot from the document)
- `C:\Users\User\FlutterProjects\Gabay\spec\P0-11.md` (r3 rewrite as office §8–§9)
- `C:\Users\User\FlutterProjects\Gabay\plan\PH4-feature-first.md` (1.1: OA slices, ledger)
- `C:\Users\User\FlutterProjects\Gabay\docs\process\EXCEPTIONS.md` (E-25 to E-28, the E-20 and E-13 amendments)
- Also central: `functions/src/services/engines/` on branch `ff3-engine-a1` (A1′ adaptation), and `db/seeds/lib/demo.js` and `spike.js` on `origin/main` (OA-3 rewrite).