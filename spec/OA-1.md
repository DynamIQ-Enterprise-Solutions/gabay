Spec OA-1. Revision: r1 (2026-10-12). Intent: intent/OA-1-venue-map-document.md

# OA-1: The venue map document and its validator

> **Pipeline entry:** OA-1 · **Slice:** OA-1 (`plan/OFFICE-ADOPTION-replan.md` §3.2 row 1; `plan/PH4-feature-first.md` 1.1) · **Coder:** engine-coder, Opus 5.5 (re-plan §3.5) · **Status:** r1, for the product owner's approval with its intent (L156). r1 raised five questions (§10). The product owner ruled all five on 2026-10-12, and the rulings are written into r1 itself, because no plan had cited r1 yet (as P0-03 r3 did). No question is open and no criterion is pending.
>
> **Sources read for r1:**
> - the intent;
> - `plan/OFFICE-ADOPTION-replan.md` (the 0.1 text on disk, §0–§3 and §7–§9), with the product owner's answers recorded in L170 (the re-plan's Q1–Q16 below are the re-plan's questions; this spec's own questions are "§10 Q1" to "§10 Q5"): Q1 (a), Q2 (a), Q3 (a), Q4 (a), Q5 (a), Q6 (a), Q7 (a), Q8 (a), Q9 (a), Q10 (a), **Q11 (b)**, Q12 (a), Q13 (a), Q14 (a), Q15 (a), Q16 (a); N1 (the office spec is Dynamiq's own design, free for Gabay to follow); **N6 (escalators drawn two-way stay two-way, a Gabay-only field)**;
> - `OFFICE_MAP_DESIGNER_SPEC.md` v1.0 §1–§8.7 and §11–§12 ("office §n"). It stays out of git and is cited by section, never copied;
> - CLAUDE.md (the seven rules, E-20, the Evidence Standard); the `gabay-product-rulings` skill;
> - Blueprint Part 1 (invariants 2, 3, 8, 10, 13, 14, `<known_traps>`) and Part 3 (§3.2–§3.6, §3.10 DC8, DC22, DC24);
> - `db/schema.sql` 0.14: `Venue`, `Building`, `Level`, `Unit`, `Opening`, `FloorUnderlay`, `FloorObject`, `Occupant`, `Amenity`, `TransitPoint`, `Anchor`, `NavConnector`, `NavConnectorStop`, `NavCorrection`, `Beacon`, `BeaconPlan`, `Closure`, and the lookups `BuildingType`, `AmenityType`, `TransitType`, `ConnectorType`, `ObjectType`;
> - `spec/P0-01.md` (AC-12, AC-13, AC-35: B7); `spec/P0-02.md` r2 (AC-2, AC-24); `spec/P0-03.md` r3 (§3, §3.7, DC-6, DC-12); `spec/P0-11.md` r2 (§2.2–§2.3, DC-5, DC-7, DC-8, DC-9);
> - the FF-3 A1 engine on `ff3-engine-a1`: `functions/src/services/engines/draft.js` (the `VenueDraft` it parses) and `functions/src/config/closed-sets.json`; `phase-reports/feature-first/FF-3-A1.md`;
> - `db/seeds/lib/{demo,spike,geo,lookups}.js`; the four `db/seeds/sources/demo/*.json` site rectangles;
> - `functions/src/config/index.js` (`MAX_JSON_BODY`, default `5mb`); `tools/lint/schema-forms.js`;
> - PRD §7; FEATURE_PIPELINE §5; the standard's §3.7, §3.8, §4.10, §7.2, §8.2, §9.
>
> - the records on `main` (PR #25): `plan.html` L170 (full adoption and the re-plan's answers) and L171 (the EXCEPTIONS approvals); `docs/process/EXCEPTIONS.md` E-25 to E-28 (E-26: the `schema-forms` lint's document mode).

## 1. What this delivers

Each venue's map becomes **one JSON document**: the site, its buildings, its levels, and on each level the walls, openings, units, items, corrections, amenities, transit points and landmarks, plus the venue's connectors (L170, Q1 (a); office §1, §4). OA-1 delivers four things:

1. **The document's definition:** one machine-readable schema file (§2, DC-1).
2. **A pure validator.** It returns either a canonical copy of the document or every problem by path, capped at a named constant and with the total reported (office §4.3).
3. **Helpers from the same module:**
   - `publishable()`, which strips backdrops;
   - an element index;
   - key-status resolution for relational rows (§3.10);
   - a spec-version reader (re-plan DC 8).
4. **A generated Dart copy of the schema** for the admin page's panels and the `schema-forms` lint (E-26).

OA-2 (storage, routes, lifecycle), OA-3 (the seeds as documents), FF-3′ (publish reads the document) and OA-4 (the editor) all build on this one definition. Nothing changes on screen in OA-1.

**Which wall model (asked by the brief, settled by the re-plan).** Gabay's document has **explicit walls**, following office §4.2. The re-plan's sources say so in three places:
- §1.3 Q2: "Explicit walls (office §4.2), **plus** non-walkable rooms. D4's derived walls survive only as room outlines";
- §1.2: "walkable area = the level rectangle, minus walls …, minus blocking items, minus non-walkable rooms … Doors are gaps in walls and in room outlines";
- §3.2 OA-3: "Stores become non-walkable rooms with walls and doors".

So openings sit on walls (office §4.2), not on unit edges. P0-03's D4 rule ("each non-walkable unit's edge is a wall") survives only as "a non-walkable unit's outline is subtracted from the walkable area", and that is FF-3′'s concern.

## 2. The document (spec 1)

The document's coordinates, ids, units and rounding follow office §3, adapted to **one frame per venue** (Q5 (a)):
- **Units:** metres.
- **Axes:** `x` runs across the plan and `z` runs down it.
- **Origin:** the top-left corner of the venue frame. This is already the seeds' frame: `geo.js` uses "x east, y south, origin at the site's north-west corner".
- **Angles:** degrees clockwise as seen on the plan, normalised to [0, 360). At 0 a thing faces up the plan (−z).
- **No negative coordinates:** every coordinate lies in [0, `VENUE_EXTENT_MAX_M`].
- **Level rectangles:** each level is a rectangle in the frame, `origin` + `size`.
- **Element coordinates:** every element's coordinates are **venue-frame** coordinates and must lie inside its level's rectangle, edges included (DC-3).

Notation for the tables below:
- **"point"** is `[x, z]`.
- **"polygon"** is an array of points, stored open (DC-16).
- **"id"** matches `^[A-Za-z0-9_-]{1,40}$` and is unique across the whole document (§3.2).
- **"code"** is a lookup `Code` that resolves for the request's tenant (§3.5).
- **"text ≤ n"** is trimmed single-line text of at most n Unicode code points (DC-12).
- **"flag"** is a JSON boolean.
- **"metres"** is a finite JSON number rounded to 0.001.
- **"degrees"** is a finite number normalised to [0, 360) and rounded to 0.001.
- **Caps and ranges:** every one is a named constant in the schema file (§3.7, DC-8). The tables give each constant's **starting value**, which is office §4.2's or §12's value where office has one.
- **"Omitted when default":** the canonical copy leaves the field out when its value equals the stated default (DC-11).

### 2.1 Top level

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `spec` | integer; must be 1 (§3.8 for other values) | required | office §4.2 |
| `units` | absent or `"m"` | written as `"m"` | office §3 |
| `catalog` | integer ≥ 1: the request tenant's catalog version the map was drawn with (§3.11). It must be at most the context's current version; a higher value gives a problem. A lower value is accepted, because older types stay valid (AC-20) | the context's current version | office §5; Q13; **§10 Q2, ruled (b)** |
| `site` | object (§2.2) | required | Q1 (a); re-plan §3.4 (the boundary, georeference and `MapUpDeg` move off `Venue`) |
| `buildings` | array of building (§2.3), 0 … `MAX_BUILDINGS` (10) | `[]` | L29, L30; Q1 (a) |
| `levels` | array of level (§2.4), 1 … `MAX_LEVELS` (10) | required, at least one | office §4.2; Q1 (a) |
| `connectors` | array of connector (§2.6), 0 … `MAX_CONNECTORS` (40) | `[]` | office §4.2 |

The document carries no tenant id, venue id, venue code or venue name. Those stay on the `Venue` row and the future `VenueMap` row (OA-2), and the export envelope carries `fromVenue` (§3.12) (DC-24). `Venue.EvacEscalatorsAllowed` stays a `Venue` column (DC-20).

### 2.2 `site`

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `boundary` | polygon, 3 … `MAX_POLY_POINTS` (64) points, area ≥ 0.1 m²; the whole property | required | invariant 10; L30; `Venue.BoundaryGeoJson NOT NULL` |
| `georeference` | `null`, or `{ origin: { lat, lon }, bearingDeg }`:<br>- `origin` is the WGS84 position of the frame's (0, 0): `lat` −90 … 90 and `lon` −180 … 180, decimal degrees rounded to 7 decimals;<br>- `bearingDeg` is the true bearing of "up the plan" (−z), clockwise from north, in degrees;<br>- one frame metre is one ground metre | `null` | L31; `Venue.GeoreferenceJson`; P0-02 AC-24 (no seeded venue has one); P0-04 AC-14; **§10 Q4, ruled (a)**; 7 decimals is DC-31 |
| `mapUp` | degrees; the map's "up" when not turning, clockwise from up the plan (−z) | 0 | L111, DC24, restated by Q5 (a) |

### 2.3 Building

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `id` | id | required | office §3 |
| `name` | text ≤ 200 | required | `Building.Name` |
| `type` | code of a `BuildingType` row | required | `Building.BuildingTypeId`; re-plan §1.2 (codes) |
| `footprint` | polygon (as `site.boundary`) | absent | `Building.FootprintGeoJson` |
| `mapUp` | degrees; absent means the site's | absent | DC24 |
| `review` | flag | omitted when false | Q3 (a) |

### 2.4 Level

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `id` | id | required | office §3 |
| `name` | text ≤ 100 | required | `Level.Name` |
| `shortName` | text ≤ 10 | required | `Level.ShortName` (the shopper's level chips) |
| `spokenName` | text ≤ 100 | absent | L112 |
| `building` | id of a building in `buildings`. Required unless `outdoor` is true, and refused when it is | — | P0-01 AC-13; `CK_Level_OutdoorBuilding` |
| `outdoor` | flag. At most one outdoor level per document; its `ordinal` must be 0 | omitted when false | L30; P0-01 AC-12 (B7) |
| `ordinal` | integer in −`MAX_LEVELS` … `MAX_LEVELS`; distinct among the levels of one building | required | `Level.Ordinal`; P0-01 AC-35 (B7) |
| `elevation` | metres, `ELEVATION_MIN_M` … `ELEVATION_MAX_M` (−20 … 300) | 0 | office §4.2 |
| `height` | metres, floor to ceiling, `LEVEL_HEIGHT_MIN_M` … `LEVEL_HEIGHT_MAX_M` (2 … 10) | 3 | office §4.2; replaces `Level.CeilingHeightM` (L40) |
| `origin` | point; with `size`, inside [0, `VENUE_EXTENT_MAX_M`] | required | Q5 (a) |
| `size` | `[w, d]`, each `LEVEL_SIZE_MIN_M` … `VENUE_EXTENT_MAX_M` (2 … 300) | required | office §4.2; Q5 (a) |
| `floor` | `{ finish }`, a floor-finish key (§3.5) | omitted when `default` | office §4.2, §5; rule 6 (no colour stored, re-plan §1.2) |
| `walls`, `openings`, `units`, `items`, `corrections`, `amenities`, `transitPoints`, `anchors` | arrays (§2.5), each within its cap | `[]` | office §4.2; re-plan §1.2 |
| `backdrop` | object (§2.5.9). **Draft only** | absent | office §4.2, §9 |

`Level.GridCellM` is not carried, because the editor snaps to office §8.3's 10 cm grid (DC-19).

### 2.5 Elements on a level

**2.5.1 Wall** (office §4.2). Cap: `MAX_WALLS_PER_LEVEL` (2,000).

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `a`, `b` | points inside the level; length ≥ `WALL_MIN_LENGTH_M` (0.05) | required |
| `t` | metres, `WALL_THICKNESS_MIN_M` … `WALL_THICKNESS_MAX_M` (0.05 … 1) | 0.15 |
| `kind` | `solid`, `glass` or `partition` (closed set, §3.5) | `solid` |
| `review` | flag | omitted when false |

**2.5.2 Opening** (office §4.2, adapted). Cap: `MAX_OPENINGS_PER_LEVEL` (2,000).

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `id` | id | required | |
| `wall` | id of a wall **on the same level** | required | office |
| `at` | 0 … 1 along the wall from `a` to `b`, rounded to 0.001 | required | office |
| `w` | metres, `OPENING_WIDTH_MIN_M` … `OPENING_WIDTH_MAX_M` (0.4 … 6), and no longer than the wall | required | office |
| `kind` | `door` or `window` (closed set) | `door` | office |
| `name` | text ≤ 200 | absent | `Opening.Name`; P0-03 AC-77, AC-79 |
| `clearW` | metres, above 0 and no more than `w`; absent means "not measured" | absent | L88; `Opening.ClearWidthM` (P0-03 AC-23, AC-30) |
| `entrance` | flag; doors only | omitted when false | `Opening.IsVenueEntrance` (L31, L40; P0-03 AC-25, AC-77) |
| `review` | flag | omitted when false | Q3 (a) |

The opening's IMDF category is not carried: office's `kind` replaces it, and P0-03 §3.7's package never carried it (DC-28).

**2.5.3 Unit** (office "room", adapted; the array is named `units`, DC-2). Cap: `MAX_UNITS_PER_LEVEL` (300).

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `id` | id. Stores are keyed on it (§3.10) | required | office §1 property 3 |
| `name` | text ≤ 200 | absent (DC-13) | `Unit.Name` |
| `category` | an IMDF 1.0.0 unit category (closed set, §3.5) | required | `Unit.ImdfCategory`; invariant 14 |
| `walkable` | flag. When absent it is filled from the category through P0-11 DC-8's map (walkway, parking, footbridge are walkable). It is always written in the canonical copy | from DC-8's map | P0-03 AC-24 (D4); re-plan §1.2 |
| `passThrough` | flag; only on a unit whose `walkable` is false | omitted when false | L29, L92; P0-11 DC-9 |
| `parent` | id of a unit on the same level; no unit may be its own ancestor | absent | L29; P0-01 B8; P0-11 AC-26 |
| `doors` | ids of openings of kind `door` on the same level, no repeats, at most `MAX_OPENINGS_PER_LEVEL` | `[]` | office's room `door`, widened to a list (DC-4); P0-03 AC-13, AC-37 |
| `poly` | polygon inside the level, 3 … `MAX_POLY_POINTS` points, area ≥ `POLY_MIN_AREA_M2` (0.1) | required | office §4.2 |
| `floor` | `{ finish }` overriding the level's | absent | office §4.2 |
| `review` | flag | omitted when false | Q3 (a) |

**2.5.4 Item** (office "item"; `FloorObject`). Cap: `MAX_ITEMS_PER_LEVEL` (5,000).

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `type` | code of an `ObjectType` in the catalog (§3.11) | required |
| `x`, `z` | the centre, inside the level | required |
| `rot` | degrees | 0 |
| `w`, `d`, `h` | metres. Each is accepted only where the type gives that dimension a resize range, and then only inside it (office §4.2). One exception, for G13: a type with **no default** for a dimension needs that dimension on the item, above 0 and no larger than the level's larger side. For a `round` type, `d` follows `w` and is never sent (office §5) | the type's default |
| `finish` | an item-finish key (§3.5) | omitted when `default` |
| `label` | text ≤ 40 | absent |
| `review` | flag | omitted when false |

Items are boxes only. They have no per-item walk-blocking override and no link to a unit, which follows office §4.2 and §5 (DC-14).

**2.5.5 Correction** (L32; P0-03 DC-6; a Gabay extension, re-plan §1.2). Cap: `MAX_CORRECTIONS_PER_LEVEL` (2,000, DC-9).

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `kind` | `BLOCK_AREA`, `ADD_PATH` or `REMOVE_PATH` (closed set) | required |
| `poly` | `BLOCK_AREA` only: a polygon inside the level | required for `BLOCK_AREA` |
| `line` | `ADD_PATH` and `REMOVE_PATH` only: 2 … `MAX_POLY_POINTS` points inside the level, total length ≥ 0.05 | required for those kinds |
| `note` | text ≤ 200 | absent |
| `review` | flag | omitted when false |

**2.5.6 Amenity** (`Amenity`). Cap: `MAX_POINTS_PER_LEVEL` (5,000, DC-9), shared by amenities, transit points and anchors, each counted on its own.

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `type` | code of an `AmenityType` row | required |
| `name` | text ≤ 200 | absent |
| `at` | point inside the level | required |
| `unit` | id of a unit on the same level | absent |
| `review` | flag | omitted when false |

**2.5.7 Transit point** (`TransitPoint`; L30).

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `type` | code of a `TransitType` row | required |
| `name` | text ≤ 200 | required |
| `note` | text ≤ 200 | absent |
| `at` | point inside the level | required |
| `review` | flag | omitted when false |

**2.5.8 Anchor (landmark)** (`Anchor`; P0-11 G10).

| Field | Type and rule | Default |
|---|---|---|
| `id` | id | required |
| `name` | text ≤ 200 | required |
| `at` | point inside the level | required |
| `unit` | id of a unit on the same level | absent |
| `review` | flag | omitted when false |

**2.5.9 Backdrop** (office §4.2, §9; **draft only**). At most one per level. It replaces `FloorUnderlay`'s two-point calibration (re-plan §1.1).

| Field | Type and rule | Default |
|---|---|---|
| `id` | 32 lowercase hexadecimal characters (the upload key; that the file exists is OA-2's check) | required |
| `cx`, `cz` | metres in −2 × `VENUE_EXTENT_MAX_M` … 3 × `VENUE_EXTENT_MAX_M`. That is office's −600 … 900 written against its 300 m cap: the image may hang over the level | required |
| `mpp` | metres per image pixel, `BACKDROP_MPP_MIN` … `BACKDROP_MPP_MAX` (0.0001 … 1), rounded to **7 decimals** | required |
| `rot` | degrees | 0 |
| `opacity` | 0.05 … 1 | 0.5 |
| `locked` | flag | omitted when false |

### 2.6 Connector (venue level; office §4.2, adapted)

| Field | Type and rule | Default | Source |
|---|---|---|---|
| `id` | id | required | office §3 |
| `name` | text ≤ 200 | required | `NavConnector.Name`; P0-03 A9, AC-70, AC-78 |
| `spokenName` | text ≤ 200 | absent | L112 |
| `kind` | `stairs`, `escalator`, `elevator` or `ramp` (closed set) | required | office §4.2; `ramp` added (re-plan §1.2; P0-07) |
| `type` | code of a `ConnectorType` row whose `CostModel` matches `kind` (ELEVATOR, STAIRS, ESCALATOR, RAMP). Costs, step-free and the label come from that row by code; the document holds no cost | required | Q4 (a); Q13's codes; DC-6 |
| `levels` | ids of at least 2 distinct levels of this document. An escalator has **exactly 2** and runs `levels[0]` → `levels[1]` | required | office §4.2 |
| `stops` | one point per entry of `levels`, in the same order: the landing on that level, inside that level's rectangle | required | re-plan DC 12; `NavConnector` From and To; `NavConnectorStop` (DC-5) |
| `x`, `z` | the footprint's centre, inside **every** served level | required | office §4.2 (DC-25) |
| `rot` | degrees | 0 | office |
| `w` | metres. Stairs 0.8 … 4 (default 1.2); escalator 0.8 … 2 (default 1); elevator 1 … 4 (default 2); ramp above 0 and no larger than the smallest served level's larger side (DC-7) | per kind | office §4.2 |
| `len` | stairs, escalator, ramp: metres. Stairs 1 … 20 (default 4); escalator 1 … 20 (default 7.5); ramp as its `w` rule (DC-7) | per kind | office |
| `d`, `cars` | elevator only: `d` metres 1 … 4 (default 2); `cars` integer 1 … 4 (default 1) | per kind | office |
| `shape` | stairs and ramp only: `straight`, `L` or `U` (closed set) | `straight` | office |
| `twoWay` | flag, **escalator only**. True means the escalator runs both ways. Stairs, ramps and elevators are always two-way | omitted when false | **N6** (a Gabay-only field; office §4.2 makes every escalator one-way); L86 |
| `preferred` | flag | omitted when false | office §4.2, §11 |
| `walkable` | flag; false means scenery, never used | true, omitted when true | office §4.2 |
| `evacuationOnly` | flag; not allowed together with `walkable: false` | omitted when false | L87 (DC-18) |
| `review` | flag | omitted when false | Q3 (a) |

Every range and default in the tables above is a named constant in the schema file. A field that the schema knows, set on an element kind it does not apply to, is a problem. Examples: `twoWay` on stairs, `cars` on an escalator, `line` on a `BLOCK_AREA`, `h` on an item whose type has neither a resize range nor a missing default for `h`. This applies office §4.2's rule "Setting `hot` on a non-desk is an error" to every such field. A key the schema does not know is silently left out of the canonical copy (office §4.3).

## 3. Acceptance criteria

"The validator" is the pure function of §3.6. "Context" is what its caller passes in besides the document: the catalog and the lookup codes for the request's tenant (§3.5). "Problem" is one `"<path>: <message>"` string (office §4.3).

### 3.1 The document's shape

- AC-1: A document built exactly to §2 (every element kind, every optional field, a two-way escalator, a lift serving three levels, an outdoor level, a backdrop) validates. Its canonical copy holds every §2 field it was given, and no other key. Verify: unit.
- AC-2: Each "required" field of §2, removed in turn from an otherwise valid document, gives exactly one problem naming that field's path. Verify: unit (one case per required field, generated from the schema file).
- AC-3: Each range in §2, set one step below its minimum and one step above its maximum in turn, gives a problem naming the path and the allowed range. The step is 1 for an integer, 0.0000001 for `mpp`, and 0.001 for every other number. The minimum and the maximum themselves are accepted. Verify: unit (generated from the schema file).
- AC-4: References resolve inside the document, or each gives a problem naming the path and the missing or wrong id:
  - a level's `building`;
  - an opening's `wall`, which must be on the same level;
  - a unit's `parent`, which must be on the same level, with no cycle;
  - a unit's `doors`, which must be openings of kind `door` on the same level, with no repeats;
  - an amenity's or anchor's `unit`, which must be on the same level;
  - a connector's `levels`, which must be distinct levels of this document.

  Verify: unit (one case per reference, plus a three-unit parent cycle and a unit naming itself as its parent).
- AC-5: The level rules of P0-01 B7 hold:
  - at most one `outdoor` level;
  - an outdoor level has ordinal 0 and no `building`;
  - an indoor level has a `building`;
  - ordinals are distinct within one building;
  - the same ordinal in two buildings is accepted.

  Verify: unit.
- AC-6: Every element's coordinates lie inside its level's rectangle, edges included: wall ends, unit and correction points, item centres, the points of amenities, transit points and anchors, and connector stops. A connector's footprint centre (`x`, `z`) lies inside every level it serves. Each level's rectangle, the site boundary and building footprints lie inside [0, `VENUE_EXTENT_MAX_M`]. A point 0.001 m outside gives a problem naming its path. Verify: unit.
- AC-7: Connector rules hold. Each failure gives one problem at its path:
  - an escalator has exactly two levels;
  - `stops` has exactly one point per entry of `levels`;
  - `twoWay` is set only on an escalator (N6);
  - `d` and `cars` are set only on an elevator;
  - `shape` is set only on stairs or a ramp;
  - `evacuationOnly: true` is not combined with `walkable: false`;
  - the `type` code's `CostModel` matches `kind`.

  A two-way escalator validates and keeps `twoWay: true` in the canonical copy. A one-way escalator keeps its `levels` order. Verify: unit.
- AC-8: Opening, unit and item rules hold. Each failure gives one problem at its path:
  - an opening's `w` is no longer than its wall;
  - `clearW` is above 0 and no more than `w`;
  - `entrance` is set only on a door;
  - `passThrough` is set only on a unit that is not walkable;
  - a wall is at least `WALL_MIN_LENGTH_M` long;
  - a polygon has at least 3 distinct points and an area of at least `POLY_MIN_AREA_M2` after rounding;
  - an item's `w`, `d` and `h` follow §2.5.4: a size outside the resize range, a size on a fixed dimension, `d` on a round type, or a missing size where the type has no default.

  Verify: unit (including G13's case: a seeded type with no default size needs `w` and `d` on the item).
- AC-9: When `walkable` is absent from a unit, the canonical copy fills it from P0-11 DC-8's category map: `walkway`, `parking` and `footbridge` become true and every other category false. A given `walkable` is kept as given. Verify: unit.

### 3.2 Ids

- AC-10: Every `id` matches `^[A-Za-z0-9_-]{1,40}$` (office §3). An id of 41 characters, an empty id, or one with a space, a dot or a non-ASCII letter gives a problem. Verify: unit.
- AC-11: Ids are unique across the **whole document**: buildings, levels, every element on every level, and connectors (office §3). A repeated id gives one problem at the later path, naming the earlier path. Verify: unit (the same id on a wall of level 1 and an item of level 2).
- AC-12: The validator never creates, changes or reorders an id or an array. The canonical copy keeps every id exactly as given and every array in the order given (office §1 property 4). Verify: unit (property test: ids and their order in equal ids and order out).

### 3.3 Numbers, units and rounding

- AC-13: Every metre, degree and opacity value is rounded to 3 decimals, and `mpp` to **7 decimals** (office §3). Rounding is half away from zero on the number's decimal text, as JSON writes it (DC-10). Each of these vectors holds:

  | In | Out |
  |---|---|
  | 1.23456 | 1.235 |
  | 1.0005 | 1.001 |
  | −0.0005 | −0.001 |
  | 0.0004 | 0 |
  | −0.0004 | 0 (never −0) |
  | `mpp` 0.00833333 | 0.0083333 |
  | `mpp` 0.00025 | 0.00025 |

  Verify: unit (a shared vector file, kept beside the schema file). The georeference's `lat` and `lon` are also rounded to 7 decimals (DC-31): 14.55474561 becomes 14.5547456.
- AC-13a: **The georeference (§10 Q4, ruled (a)).** `site.georeference` is accepted as `null` or as `{ origin: { lat, lon }, bearingDeg }`. Each of these gives a problem at its path:
  - `lat` outside −90 … 90 or `lon` outside −180 … 180;
  - a missing `origin`, `lat`, `lon` or `bearingDeg`;
  - any other shape, such as a GeoJSON object or an array of control points.

  `bearingDeg` is normalised as an angle (AC-15), so −10 becomes 350. Unknown keys inside it are left out (AC-24). Verify: unit.
- AC-14: **The `mpp` lesson (office §3).** A backdrop with `mpp` 0.0083333 on a 4,000-pixel image measures 33.333 m across, within 0.001 m of the uncalibrated value. A copy of the validator that rounded `mpp` to 3 decimals would make it 32 m. The test asserts the 7-decimal result and that 0.008 is not what is stored. Verify: unit.
- AC-15: Angles (`rot`, `mapUp`) are normalised to [0, 360): 360 becomes 0, −90 becomes 270, 725 becomes 5, and 359.9996 rounds to 0. Verify: unit.
- AC-16: Rounding comes first, and range and geometry checks run on the rounded values. So 300.0004 passes a 300 maximum, and a polygon whose points merge on rounding is judged on the merged points. Verify: unit.
- AC-17: A number field holding a string (`"1.5"`), a boolean, `null` where a number is required, or an array gives a problem naming the expected type. An integer field (`spec`, `ordinal`, `cars`) holding 1.5 gives a problem. A flag holding `"true"` or 1 gives a problem. A point that is not exactly two numbers gives a problem. Verify: unit.

### 3.4 Text

- AC-18: Text is trimmed of leading and trailing white space.
  - A required text that is empty after trimming gives a problem.
  - An optional text that is empty after trimming is left out of the canonical copy.
  - Text containing a control character (U+0000 to U+001F, or U+007F) gives a problem (DC-12).
  - Length is counted in Unicode code points. A 200-code-point name with "ñ" and an emoji is accepted, and 201 code points give a problem.

  Verify: unit.

### 3.5 Lookup codes and closed sets

- AC-19: These fields name a lookup `Code`: building `type`, amenity `type`, transit point `type`, connector `type` and item `type`. Each must be in the context's set for that lookup. The set holds the tenant's own rows first, then the platform rows, for codes the tenant does not have (the global-lookup trap; re-plan §1.2). A code that is not in the set gives a problem naming the path and the code. The tenant check (P0-03 AC-19) therefore becomes "the code resolves for this tenant": another tenant's code never resolves (rule 2). Verify: unit (a code only another tenant has; a tenant row and a platform row with the same code resolve to the tenant's).
- AC-20: **Inactive lookup values (FEATURE_PIPELINE §5 item 15).** A code whose row is in the context but inactive is accepted, and the canonical copy keeps it. So an element drawn before a type was deactivated survives every later save (DC-15). Verify: unit; and an integration test that reads the context from the real local database, deactivates a referenced `AmenityType` inside a rolled-back transaction, and validates (L151). This is the case `npm run verify` runs.
- AC-21: The closed sets are in the ONE constants file, each with its authority and why it is closed (invariant 14; FEATURE_PIPELINE §5 item 14; A26's shape, R32):
  - IMDF unit categories (**RECALLED**: the list is checked against the IMDF 1.0.0 specification by a doc fetch in the plan, and must include every category the seeds use: `walkway`, `parking`, `footbridge`, `opentobelow`, `unenclosedarea`, `nonpublic`, `recreation`, `unspecified`, `structure`, `room`, `movietheater`, `restroom`);
  - DC-8's walkable map;
  - wall kinds; opening kinds; connector kinds; stair and ramp shapes;
  - correction kinds (already `NavCorrectionKind`);
  - item finishes and floor finishes (office §5; closed because each value has its own colour token, rule 6);
  - item mounts (`floor`, `wall`).

  The validator reads them from that file, and a value outside a set gives a problem. If the constants file is not yet on `main` (it exists only on `ff3-engine-a1`), OA-1 brings it there in A26's shape, with its generator and staleness test. Verify: unit; `tools/test/closed-sets.test.js`.
- AC-22: The document stores **no colour**: no `color` key survives (office's floor `color` included), and finishes are keys only (rule 6; re-plan §1.2). Verify: unit.

### 3.6 The validator's contract

- AC-23: **Pure (office §4.3).** The validator reads only its two arguments: the document and the context. It opens no database connection, reads no clock, makes no network call and reads no environment value. The same inputs always give the same output. Verify: unit (run with the database, network and clock stubbed to throw; repeated runs compared byte for byte).
- AC-24: **Canonical copy.** On success the validator returns a new object built only from §2's fields. It never returns or mutates the input object. Unknown keys are left out, `__proto__`, `constructor` and `prototype` keys included, and none reaches the copy or any prototype. Verify: unit (a frozen input; a document with `__proto__` keys; `Object.prototype` unchanged afterwards).
- AC-25: **Idempotent.** Validating a canonical copy returns a deep-equal copy, and serialising both gives identical text. Verify: unit (property test over generated documents).
- AC-26: **All problems, capped, with the total (office §4.3; re-plan DC 13).**
  - On failure the validator returns every problem, up to `MAX_PROBLEMS` (20), in document order.
  - It also returns the total number found.
  - Each problem reads `"<path>: <message>"`, for example `levels[0].items[7].w: must be from 1 to 2.4`. The path uses the field names of §2 and zero-based indexes. Messages are plain English for admins (the admin page is English by design, R34).

  Verify: unit (a document with 25 faults gives 20 problems and a total of 25, in document order).
- AC-27: **The error body for the routes that call it** is the standard's shape plus the problems (standard §3.8; re-plan §1.1): `{ error: "This map has <total> problems.", problems: [...], total: <n> }`. It is served with HTTP 400 by OA-2's routes. OA-1 provides the function that builds the body; it has no route of its own (§3.11 aside). Verify: unit.
- AC-28: **Never throws on input.** Any JSON value as the document gives problems, never an exception. Examples: `null`, a number, a string, an array, `{}`, a document 30 levels deep, arrays where objects belong and objects where arrays belong. Missing parent fields stop only their own branch, and the rest of the document is still checked. Verify: unit (a fuzz test of at least 10,000 generated malformed documents; no throw, and every result is a valid problem list).
- AC-29: **Runs at save and at publish (office §4.3).** The module exports one validator that OA-2's draft save and FF-3′'s publish both call, so there is no second copy in Node or in Dart (P0-11 AC-22's principle). Verify: review, plus a unit test that the module has one exported validator.

### 3.7 Caps and size (Q15 (a))

- AC-30: Every cap and range of §2 is a named constant in the schema file. This includes `MAX_LEVELS`, `MAX_BUILDINGS`, `MAX_CONNECTORS`, the per-level caps, `MAX_POLY_POINTS`, `VENUE_EXTENT_MAX_M`, `MAX_MAP_BYTES` and `MAX_PROBLEMS`. Each starts at the value §2 gives (office's where office has one) and carries a comment naming its source. **OA-3 sets the mall values** by measuring the seed documents (the largest seed × 2, rounded up; Q15 (a)), and records each change in the schema file and the Blueprint. No literal of a cap appears elsewhere in code (C8). Verify: unit (each constant is read from the schema file); review.
- AC-31: A level with one element more than its cap, or a document with one level or connector more than its cap, gives one problem naming the array's path, the count and the cap. That many exactly is accepted. Verify: unit.
- AC-32: **Size cap (office §4.3).** A document whose UTF-8 JSON text is longer than `MAX_MAP_BYTES` (starting at 4 × 1,048,576 bytes) is refused with the single problem `"(document): is <n> bytes; the limit is <cap>"`, before any other check. A canonical copy over the cap is refused the same way. The cap stays below `MAX_JSON_BODY` (5 MB, `functions/src/config/index.js`), so a save body has room for its envelope (`{ layout, baseVersion }`, OA-2). A test asserts that `MAX_MAP_BYTES` is below the configured body limit. OA-3 measures the seed documents against it (re-plan §5 risks). Verify: unit (exactly the cap accepted, one byte over refused; the body-limit comparison).
- AC-33: **Measured, not gated.** No time or memory target is stated for the validator: none is in PRD §7, the intent or the re-plan. Where nothing states a number, it is measured and recorded only, as A5 rules. On a synthetic document just under `MAX_MAP_BYTES`, the validator's time (median and p95 of 20 runs) and peak heap are measured on this machine and pasted in the pull request. Verify: integration (measured).

### 3.8 Helpers from the same module

- AC-34: **`publishable(map)` (office §4.3).** It returns a copy with every level's `backdrop` removed and nothing else changed (`review` flags kept, DC-17). The input is not mutated. Verify: unit.
- AC-35: **The element index.** `elementIndex(map)` returns, for every id in the document, its kind (building, level, wall, opening, unit, item, correction, amenity, transit point, anchor, connector) and its level (or none), plus each level's rectangle. It is the analogue of office §4.3's `deskIndex`. Verify: unit.
- AC-36: **Reading a stored document (re-plan DC 8).** `readMap(stored)` returns a spec-1 document unchanged. A stored document with a `spec` this code does not know (2 or more, 0, or missing) is refused with "made by a newer or unknown version of Gabay". Reading never re-validates, so a frozen published layout that today's caps or catalog would refuse still reads (invariant 3; DC-22). Verify: unit.

### 3.9 The schema file and its Dart copy (E-26)

- AC-37: **One schema file** defines the document of §2 (DC-1). For each element kind and field it gives:
  - the type kind (text, integer, metres, degrees, flag, code, closed-set key, id reference, point, polygon, line);
  - required or optional;
  - the default;
  - minimum and maximum;
  - decimals;
  - maximum length;
  - the lookup or closed set it draws from;
  - the kinds it applies to;
  - its caps.

  The Node validator reads its field rules from this file: no range, length or default is written twice. Verify: unit (a field's range changed in a fixture copy of the file changes the validator's verdict).
- AC-38: **A generated Dart copy.** A command generates the Dart copy of the schema file into `app/lib/core/config/` in the same way as the constants file. Its name is chosen in the plan and added to CLAUDE.md's Commands and README. A tools test fails while the Dart copy is stale. The Dart copy holds no catalog types and no lookup rows: the catalog is served, never copied (office §5; Q13). `flutter analyze` passes on it. Verify: tools test; `npm run verify`.
- AC-39: **What the lint needs.** For every field that a panel may edit, the schema file and its Dart copy state the four properties that `schema-forms` checks: kind, nullability, maximum length and scale (decimals). A text field states its maximum length, and a metre field states 3 decimals (7 for `mpp`). So an editor `FieldSpec` can be checked against it (E-26). Verify: unit.
- AC-40: **The lint's document mode (E-26; §10 Q3, ruled (a): built and proven in OA-1).** `tools/lint/schema-forms.js` checks a `FieldSpec` that names a document field (form chosen in the plan, for example `table: 'map.unit'`) against the schema file instead of `db/schema.sql`. It reports a kind, nullability, length or scale mismatch with the element kind, field and Dart file. `no-bare-textfield` is unchanged. Verify: `npm run lint:test` (fixture specs: one right and one wrong per property).

### 3.10 Relational rows keyed to element ids (the contract OA-2 builds to)

- AC-41: Geometry and people are stored apart (office §1 property 3; re-plan §1.2). Rows that point into the map hold the element's id as a key: `VARCHAR(40)`, matching the id pattern, never a number. These are the keys re-plan §3.4 names:
  - `Occupant` and `StoreStatusChange`, `AnalyticsDailyUnit` and `AnalyticsDailyCell`'s destination: a **unit** key;
  - `Beacon`, `BeaconPlan`, `Closure` and `AnalyticsDailyCell`: a **level** key;
  - `Closure`: a **connector** key.

  OA-2 writes the columns and the migration; OA-1 only fixes the key's format and its resolution (AC-42). Verify: unit (the key pattern constant is the id pattern constant).
- AC-42: **Key status (office §6.3).** `keyStatus(key, expectedKind, draftIndex, publishedIndex)` returns one of these:
  - `live`: the key names an element of the expected kind in the published layout;
  - `pending`: it names one in the draft only;
  - `removed`: it names one in neither;
  - `wrongKind`: it names an element of another kind, for example a store keyed to a wall.

  With no published version, every key found in the draft is `pending`. Verify: unit (each status; a unit present in both draft and published is `live`).
- AC-43: **Stores keep their own data.** No store name, category, status, keywords or spoken name is in the map document. They stay on `Occupant`, keyed by the unit's id (re-plan §1.2). One store per unit (P0-11 G7) stays a check for OA-2's routes. Verify: unit (the schema file has no store fields on a unit).

### 3.11 The catalog (Q13 (a))

**Which slice builds what (§10 Q1, ruled (a)).** OA-1 writes the route's contract (AC-44, AC-45) and builds the parts that need no database: the pure functions that shape rows into the catalog (AC-44) and into the validator's context (AC-46), tested on fixture rows. **OA-2 builds the route** together with migration 0001, which adds `ObjectType`'s resize, mount and round columns and the catalog version column (§10 Q2). AC-45's API test runs in OA-2.

- AC-44: **The catalog's shape.** One read returns the whole catalog for the request's tenant. It is the platform's `ObjectType` rows plus the tenant's own, and a tenant row overrides a platform row with the same code (the global-lookup trap). The response is `{ version, finishes, floorFinishes, types: [...] }`, where each type is `{ code, label, sortOrder, active, size: { w, d, h }, resize, blocks, mount, round }`:
  - each size value is metres or `null`;
  - `resize` is per dimension `[min, max]`, or `null`, which means fixed;
  - `blocks` comes from `BlocksWalk`;
  - `mount` is `floor` or `wall`;
  - `version` is the request tenant's **catalog version counter**, an integer starting at 1 and incremented on each change to the tenant's catalog (§10 Q2, ruled (b)). The pure shaper takes it as an input. OA-2 adds the column that holds it and increments it on every write. A new map's `catalog` field is set from it, and the validator refuses a `catalog` above it (§2.1).

  Office's `category`, `desk` and `spots` are not served (re-plan §1.2, office-only fields; DC-30). Inactive types are served, marked inactive, so the editor can show one already placed but not offer it (DC-15). Verify: unit (the pure function that shapes rows and a version into the catalog). The route's API test is OA-2's.
- AC-45: **The route's boundaries (the contract OA-2 builds to and tests).** The path is `GET /api/venue-maps/catalog` (DC-30), in FF-0's "admin features (E-20)" group behind the development stub, with a retrofit-ledger row:
  - the tenant comes only from `req.tenantCompanyID` (rule 2), with a `(TenantId = $1 OR TenantId IS NULL)` predicate that the `tenant-predicate` lint accepts;
  - no request value reaches SQL (rule 3);
  - under the stub, an `X-Tenant-Id` that the stub's user does not hold answers 403 (FF-0's behaviour);
  - another tenant's types never appear;
  - a SUPERADMIN with no tenant answers 400 (`requireTenant.js`).

  Verify: API test, in OA-2 (§10 Q1, ruled (a)). In OA-1: review that the contract is written into OA-2's plan.
- AC-46: **The context the validator takes** is built from the same rows (AC-19, AC-20): the catalog by code with its version counter (§10 Q2); the codes of `BuildingType`, `AmenityType`, `TransitType` and `ConnectorType` (with `CostModel`); and, for the export envelope, `OccupantCategory` (AC-47). Each code comes with its active flag, tenant first and then platform. The function that shapes rows into the context is pure and tested with fixture rows. Verify: unit.

### 3.12 The export envelope (Q11 (b); store fields §10 Q5, ruled (a))

- AC-47: The schema file also defines the export file (office §8.7, adapted; DC-23):
  - `{ format: "gabay.venue-map", version: 1, exportedAt, fromVenue: { code, name }, map, stores }`;
  - `map` is a canonical document passed through `publishable()`, so it has no backdrop (office §8.7);
  - `stores` is the list Q11 (b) adds. Each store is `{ unit, name, spokenName, category, keywords }` and nothing else:
    - `unit`: the unit key;
    - `name`: text ≤ 200, required;
    - `spokenName`: text ≤ 200, optional;
    - `category`: an `OccupantCategory` **code**;
    - `keywords`: text ≤ 400, optional.

    These are `Occupant`'s column lengths. **The status and the active flag are not exported** (§10 Q5, ruled (a));
  - the file holds no tenant id, venue id, user, audit stamp, beacon, closure, store status or status history.

  One pure function validates an envelope:
  - `format` and `version` exactly as above;
  - `exportedAt` an ISO-8601 UTC timestamp;
  - `map` valid under §3.6;
  - every store's unit key names a unit of `map`;
  - no two stores share a unit key (P0-11 G7);
  - every store's `category` resolves in the context (tenant first, then platform; AC-19). An inactive category is accepted (AC-20);
  - a `status`, `active` or any other key on a store is left out of the canonical envelope.

  **Import rule, for OA-2 to build:** an imported store starts **Open** (§10 Q5, ruled (a); P0-11 G8, "a new store starts Open"). The routes that write and read the file are OA-2's. Verify: unit (a store with `status: "CLOSED"` validates and its status is not in the canonical envelope; a store keyed to a wall's id or to a missing id gives a problem; two stores on one unit give a problem; an unknown category code gives a problem).

## 4. Edge cases

Each edge case is covered by the criterion named, or has a one-line reason.

**Offline or stale package**
- EC-1: There is no package in OA-1. The package is built at publish by FF-3′ from `publishable()`'s output (AC-34). The shopper's offline behaviour is unchanged (P0-04).
- EC-2: A stored document from an older spec version. Only spec 1 exists. `readMap` returns it unchanged, and an unknown version is refused (AC-36).
- EC-3: A frozen published layout that today's caps or catalog would refuse. It is read and never re-validated (AC-36, DC-22). Whether a rollback re-validates it is OA-2's question (§9).
- EC-4: A stale catalog: a type is deactivated after an item was drawn. The item stays valid (AC-20). A map drawn at catalog version 3 while the tenant's counter is now 5 is accepted and keeps `catalog: 3` (§2.1). A map claiming version 6 is refused, for example one imported from a database whose counter ran further (AC-47).
- EC-4a: An export re-imported after a store was closed. The store comes back Open, because status is not exported (§10 Q5, ruled (a); AC-47). The admin sets it again.
- EC-4b: A venue with no georeference (every Demo Malls venue) keeps `georeference: null`. A georeference whose origin is at lat 90 or lon −180, the boundaries, is accepted (AC-13a).
- EC-5: The editor offline mid-autosave. This is OA-4's (office §8.4 states). The validator has no network side.

**Empty and maximum data**
- EC-6: The smallest valid document is a site boundary and one empty level, with no connectors. Either the level is outdoor and there are no buildings, or there is one building and the level is that building's (AC-1, AC-5, DC-26). A level with every array empty is valid.
- EC-7: No levels (`levels: []`) gives a problem at `levels` (AC-2, AC-31).
- EC-8: Exactly at every cap is accepted, and one over gives a problem (AC-31). Exactly `MAX_MAP_BYTES` is accepted, and one byte over is refused before other checks (AC-32).
- EC-9: Bayview Grand (19 levels) and Aurora's 510 × 720 m site exceed the office starting values `MAX_LEVELS` 10 and `VENUE_EXTENT_MAX_M` 300. So the seeds cannot validate until OA-3 sets the mall values (AC-30). OA-1's tests use fixtures, not the seeds.
- EC-10: Hundreds of faults (a whole bad import) give 20 problems and the total (AC-26).
- EC-11: A 64-point polygon is accepted and 65 points give a problem (AC-31). Real outlines with more points are OA-3's measurement.
- EC-12: Very long text: 200 code points with ñ and an emoji is accepted, and 201 is refused (AC-18).

**Tenant boundary**
- EC-13: A code only another tenant has does not resolve and gives a problem (AC-19). The document itself holds no tenant id, so a document cannot name a tenant (AC-24, DC-24).
- EC-14: An imported document from another database or tenant whose codes do not exist here gives problems naming each code (AC-19). The import route is OA-2's.
- EC-15: A tenant row and a platform row share a code. The tenant's row wins, and its active flag is the one that counts (AC-19).
- EC-16: The catalog route never returns another tenant's types (AC-45, tested in OA-2), and its version is the request tenant's own counter (AC-44).

**Each role**
- EC-17: The validator is role-blind: it is a pure function, and which roles may save is OA-2's and R2's. The catalog read is open to all four L41 roles of the tenant, because a VIEWER opens the editor read-only (P0-11 AC-46). Under E-20 no role check runs; the role rule is deferred to R2 with a ledger row (AC-45; FEATURE_PIPELINE §5 item 4).

**Permission denied**
- EC-18: The stub with a tenant the user does not hold answers 403, and a SUPERADMIN with no tenant answers 400 (AC-45, tested in OA-2 with the route).

**Concurrent edits**
- EC-19: Two admins saving one venue is OA-2's `baseVersion` 409 (office §6.2). The validator holds no state, and the same input always gives the same output (AC-23).
- EC-20: An id generated twice by two editors in one document is caught as a duplicate (AC-11). An id reused after its element was deleted cannot be seen by a pure validator, which has no history. Office's random 6-character suffix is the mitigation, and OA-2 may keep the ids it has seen (§9).

**Publish in progress**
- EC-21: A save while a publish runs. The validator runs on each independently, and the draft read for the publish is validated as it stands at that moment (AC-29). How the two interleave is OA-2's and FF-3′'s concern.
- EC-22: The catalog changes between a save and a publish. Publish re-validates (office §4.3; AC-29). A type deactivated in between still passes (AC-20). A code deleted in between fails at publish. Lookup rows are never hard-deleted while referenced (Blueprint §3.2), but the document's references are invisible to foreign keys, so R11's maintenance screens must check the documents (§9).

**Invalid input**
- EC-23: A non-object, `null`, an array or a string as the document gives problems and never throws (AC-28).
- EC-24: `spec` 2, 0 or missing gives a problem at `spec` (AC-2, AC-36).
- EC-25: Numbers as strings, `NaN` (not valid JSON, so it never arrives), floats in integer fields, and `"true"` as a flag each give a problem (AC-17).
- EC-26: Prototype keys (`__proto__`, `constructor`) never reach the copy (AC-24).
- EC-27: A polygon whose closing point repeats its first point is stored open. Fewer than 3 distinct points after rounding, or an area under 0.1 m², gives a problem (AC-8, AC-16, DC-16). A self-crossing polygon is accepted here and flagged by FF-3′'s check (DC-16).
- EC-28: A dangling reference gives a problem at its path:
  - an opening on a wall of another level;
  - a unit door that names a window;
  - a parent cycle;
  - an amenity's unit on another level;
  - a connector naming a removed level.

  (AC-4.)
- EC-29: Connector misuse gives a problem at its path: an escalator with three levels; `twoWay` on stairs; `cars` on a ramp; the same level twice in `levels`; a stop outside its level; a `type` whose `CostModel` is another kind (including `LEVEL`, which no `kind` matches). (AC-7.)
- EC-30: Two levels at the same elevation joined by stairs are accepted, because office §4.2 does not forbid it. The near-zero cost is FF-3′'s check, not a validation problem.
- EC-31: An opening's span runs past its wall's end (`at` near 0 with a wide door) but `w` is no longer than the wall. It is accepted, as office §4.2 states the rule, and is left to a check.
- EC-32: An outdoor level with a building, a second outdoor level, an outdoor ordinal other than 0, an indoor level with no building, or two levels of one building sharing an ordinal: each gives a problem (AC-5).
- EC-33: A known field on a kind it does not apply to gives a problem. An unknown key is dropped silently (§2.6, AC-24).
- EC-34: −0 and values that round to 0 are written as 0 (AC-13). An angle of exactly 360 is written as 0 (AC-15).

## 5. FEATURE_PIPELINE §5 items that apply

| Item | Applies? | Why, in one line |
|---|---|---|
| 1 Schema and migration | No | OA-1 has no migration (intent). Migration 0001 is OA-2's, including the catalog version column (§10 Q1, Q2) |
| 2 Seed | No | The seeds become documents in OA-3. The new `ObjectType` columns' seed values and the starting catalog version are OA-2's and OA-3's |
| 3 Guard order | Not applicable | OA-1 builds no route (§10 Q1, ruled (a)); the catalog route's waiver is OA-2's |
| 4 Permission and menu rows | Not applicable | No route in OA-1; the `venue-maps` read row is OA-2's waiver to R2 |
| 5 Scaffolds, `formatApiError`, four states | No | No screen |
| 6 Notifications or SSE | No | Nobody is notified |
| 7 Refresh on return | No | No screen |
| 8 Dark mode | Yes, in part | The document stores no colour; finishes are keys that the renderer maps to `gabay_tokens.dart` (AC-22) |
| 9 Automated e2e | Not applicable | A pure library and a lint mode have no e2e phase; the route's is OA-2's |
| 10 Manuals and smoke guide | No | No screen and no route; the validator's cases are unit tests |
| 11 Changelog | No | Nothing visible to a user changes |
| 12 Companion-file sync table | Yes | Rows: a command (the Dart generator) in CLAUDE.md's Commands and README; CLAUDE.md's row "The venue map document's schema file → its generated Dart copy; the `schema-forms` lint's document mode; Blueprint Part 3" (on `main`), walked; a limit (the caps as named constants, Blueprint Part 1 and 3); the constants file's new sets; a check (the `schema-forms` document mode, E-26) in CLAUDE.md's Commands only if its command changes, and in README |
| 13 Every field a `FieldSpec` | Yes, through E-26 | The schema file carries the lint's four properties (AC-39); the lint's document mode is built and proven here (AC-40; §10 Q3, ruled (a)) |
| 14 New enumerable sets | Yes | Constants-file entries with authority comments: IMDF unit categories, the walkable map, wall, opening and connector kinds, shapes, finishes, mounts (AC-21). Lookups referenced by code already exist as tables |
| 15 Inactive-lookup case | Yes | AC-20 |
| G1 Traceability | Yes | Every AC and EC maps to a test or a one-line reason |
| G2 Wording and accessibility | Yes, in part | Problem messages are admin English by design (R34); no shopper wording; no control |
| G3 Offline and position privacy | No | No shopper feature; the document holds no shopper position |
| G4 Differences recorded | Yes | Each difference from P0-01, P0-03, P0-11, PRD §6.2 or Blueprint Part 3 is recorded under L170 or in a new L-row: codes not ids, `GridCellM`, the item's unit link and walk-blocking override, polygon floor objects, `DraftConfidence` and the opening's IMDF category all dropped; units' names optional; the caps; the wall model; `EvacEscalatorsAllowed` kept on `Venue` |

## 6. Scale targets

| Target | Source | How this spec meets it |
|---|---|---|
| Venues up to about 100,000 m² per site | PRD §7 | `VENUE_EXTENT_MAX_M` starts at 300 m (90,000 m² square), so OA-3 raises it from the seeds (AC-30) |
| The seeded Demo Malls: 4 venues, 66 levels, 2,320 units, 1,709 occupants, 163 connectors | L120's recorded run (P0-02 AC-2). 2,320 is the four Demo Malls venues' total, not Aurora's; P0-03 r3 EC-37's "Aurora has 2,320 units" carries the same slip | Per-level and per-document caps measured by OA-3 (AC-30); OA-1 tests use fixtures (EC-9) |
| Bayview Grand: 19 levels | A1 report (19 "No beacons" warnings); re-plan §1.1 Limits | Above office's 10, so `MAX_LEVELS` is set from it in OA-3 (EC-9) |
| Seed site sizes: Aurora 510 × 720 m, Bayview 1,300 × 760 m, Meridian 680 × 360 m, Spire 300 × 300 m (16 levels, −9 to 66 m) | `db/seeds/sources/demo/*.json` `siteRect` and `elev`. Bayview's site, about 988,000 m², is far above PRD §7's 100,000 m² | `VENUE_EXTENT_MAX_M` and the elevation range checked against them in OA-3 |
| Document size below the 5 MB request body | `MAX_JSON_BODY` 5 MB (Blueprint Part 1 middleware order; `config/index.js`); Q15 (a) | `MAX_MAP_BYTES` 4 MiB until OA-3 measures (AC-32) |
| Validator time and memory | **None stated** (PRD §7, intent and re-plan are silent) | Measured and recorded, no gate (AC-33). See §9 |
| Pilot: about 5 tenants | PRD §7 | No load effect; tenant isolation by code resolution (AC-19) |

## 7. Design choices

Each is a DESIGN CHOICE, not a requirement, and names an alternative that also meets what is stated.

- **DC-1** The schema is a Gabay-own declarative JSON file, in the pattern of the constants file (`closed-sets.json` → generated Dart, with a staleness test; A26). *Alternatives:*
  - zod schemas in code, exported to JSON Schema with zod 4's `toJSONSchema` (**RECALLED**, unchecked). One library for routes and maps, but cross-field rules (unique ids, references, inside-level) are code either way, and the Dart side would parse JSON Schema;
  - standard JSON Schema with a validator library (needs an EXCEPTIONS entry).
- **DC-2** The array is named `units` (IMDF's and Gabay's term, matching `UnitKey` and P0-03's package). *Alternative:* office's `rooms`.
- **DC-3** Element coordinates are venue-frame coordinates inside their level's rectangle (a reading of Q5 (a): "everything is clamped inside its level rectangle"). *Alternative:* level-local coordinates offset by `origin`. That moves contents when a level is moved, but needs a translation in every reader.
- **DC-4** A unit lists its doors (`doors: [...]`), office's single `door` widened, because malls' stores have several doors (P0-03 AC-13, AC-37). *Alternative:* each opening names its unit (`Opening.UnitId`, A1's `unitId`). That gives one owner per door, but a door between a store and its section belongs to two units.
- **DC-5** `stops[i]` is the landing on `levels[i]`: compact, with no repeated level ids. *Alternative:* `stops: [{ level, at }]`, which repeats the ids and invites disagreement.
- **DC-6** A connector carries both office's `kind` (its geometry rules, portable in exports) and a `ConnectorType` code (costs, step-free, label; Q4), and they must agree. *Alternative:* the code alone, with the kind derived from `CostModel`. That is smaller, but the document is then unreadable without the lookup.
- **DC-7** A ramp's `w` and `len` are bounded only by the level size, because office has no ramp and no ruling gives ramp sizes. BP 344's 1:20 makes a 4.5 m rise a 90 m ramp. *Alternative:* fixed ramp ranges from the product owner.
- **DC-8** Every numeric range of office §4.2, not only Q15's counts, is a named constant starting at office's value, and OA-3 may raise it only from a measured seed. That covers the level size, extent and elevation ranges, because Aurora and Bayview already exceed office's 300 m. *Alternative:* keep office's ranges fixed. That fails, because the seeds' sites are wider than 300 m.
- **DC-9** The Gabay-only kinds' caps start at the nearest office cap:
  - buildings at the level cap (10);
  - corrections at the wall cap (2,000);
  - amenities, transit points and anchors at the item cap (5,000) each;
  - polygons and lines at office's room-polygon cap (64 points).

  *Alternative:* no cap until OA-3 measures. That leaves the size cap as the only guard.
- **DC-10** Rounding is half away from zero on the decimal text JSON writes, so binary representation never flips a millimetre (1.0005 → 1.001). *Alternative:* `Math.round(x × 1000) / 1000`, which rounds 1.0005 to 1.0 in binary floating point (**RECALLED**: the vector test settles it).
- **DC-11** The canonical copy omits fields equal to their constant default, and absent optionals, which keeps Aurora-sized documents small. `walkable` is always written, because its default depends on the category. *Alternative:* write every field. That is self-describing but larger.
- **DC-12** Text is trimmed and single-line (control characters refused), and its length is counted in code points. The lengths are those of the 0.14 columns the document replaces (200 for names; 100 and 10 for level names), not office's 60, so existing names and the package's text fit. *Alternatives:* office's 60; UTF-16 units, as Dart's `String.length` counts them (**RECALLED**).
- **DC-13** A unit's name is optional (corridors are unnamed; `Unit.Name` is nullable). *Alternative:* office's required name. Office itself warns about unnamed rooms in check 4.
- **DC-14** Items are boxes only, with no per-item walk-blocking override and no unit link (office §4.2, §5). A polygon obstacle is drawn as a non-walkable unit or a `BLOCK_AREA`. *Alternative:* keep `FloorObject`'s overridable `BlocksWalk`, polygon shape and `UnitId`. P0-11 AC-6 had those, and P0-11 r3 is rewritten anyway.
- **DC-15** The validator accepts inactive codes (DoD item 15). Refusing a **new** reference to an inactive row is left to the editor's picker (active rows only) and, if wanted, OA-2's save comparing against the stored draft. *Alternative:* the validator takes the previous draft and refuses new inactive references. That is no longer a single-argument check.
- **DC-16** Polygons are one ring, without holes, stored open (a repeated closing point is dropped), with ≥ 3 distinct points and area ≥ 0.1 m². Self-crossing is not checked here; FF-3′'s checks flag it. *Alternative:* refuse self-crossing at save. That is stricter, but under autosave a mid-edit shape would put the editor into "error".
- **DC-17** `review` is allowed on every building, level element and connector, and is kept in the published layout (so a rollback restores it). The package leaves it out (P0-03 AC-46). *Alternative:* `publishable()` strips it.
- **DC-18** Cross-field contradictions are problems: `passThrough` on a walkable unit, an entrance window, a window as a unit's door, `clearW` above `w`, and `evacuationOnly` with `walkable: false`. *Alternative:* accept them and let FF-3′ ignore or warn.
- **DC-19** `GridCellM` is dropped (office §8.3's fixed 10 cm snap), and `CeilingHeightM` becomes office's `height`. *Alternative:* keep a per-level grid for the editor.
- **DC-20** `EvacEscalatorsAllowed` stays on `Venue`: it is the mall's safety rule, not geometry (L87). *Alternative:* `site.evacEscalatorsAllowed`, which would travel in exports.
- **DC-21** `MAX_MAP_BYTES` is counted as UTF-8 bytes of the JSON text, starts at 4 × 1,048,576, and applies to the input and to the canonical copy. *Alternative:* 4,000,000 bytes. Express's `5mb` is 5 × 1,048,576 bytes (**RECALLED**: the `bytes` library's units; AC-32's test compares the two numbers either way).
- **DC-22** Reading a stored document upconverts and never re-validates. *Alternative:* re-validate on read. That would make an old frozen version unreadable when a rule tightens.
- **DC-23** The export envelope is defined in OA-1's schema file, so OA-2 builds routes, not formats. *Alternative:* OA-2 defines it.
- **DC-24** The document holds no tenant or venue identity (office §1 property 3: portable). *Alternative:* embed the venue code. That would make import across venues awkward.
- **DC-25** A connector has both a required footprint (office's `x`, `z`, with `rot`, `w`, `len` defaulting) and required landing `stops` (re-plan DC 12). The editor proposes stops from the footprint (OA-4), and the converter writes the seeds' pins exactly (OA-3). *Alternative:* the validator derives missing stops from the footprint, which needs a per-shape landing rule that no source gives.
- **DC-26** A document may have no buildings (a site that is only outdoor ground). *Alternative:* at least one building.
- **DC-27** Geometry is stored as office-style arrays of points, not GeoJSON objects. *Alternative:* GeoJSON, as the 0.14 columns hold it.
- **DC-28** The opening's IMDF category is not carried; office's `kind` (door, window) replaces it. *Alternative:* carry `category` for a future IMDF export.
- **DC-29** `DraftConfidence` is not carried, because Q3 (a) rules a flag only. *Alternative:* an optional `confidence` beside `review` for OA-5's proposals.
- **DC-30** The catalog route path is `GET /api/venue-maps/catalog` (re-plan §3.1: R2's `venue-maps`), and it serves no office palette `category`, `desk` or `spots`. *Alternative:* the lookups route `GET /api/lookups/object-types` with the new columns. That reuses FF-0's route, but serves no `version`, finishes or override rule.
- **DC-31** The georeference's `lat` and `lon` are rounded to 7 decimals, about 1.1 cm at the equator (§10 Q4 rules the shape, not the precision; office §3's 7-decimal `mpp` lesson applies, since 3 decimals of a degree is about 110 m). `bearingDeg` is an angle like `rot`: 3 decimals, normalised. *Alternative:* 6 decimals (about 11 cm), the common GNSS display precision.

## 8. Not in scope

- `VenueMap` storage, schema 0.15 and migration 0001, the draft, publish, rollback and clear routes, `baseVersion` and 409, autosave auditing, the export and import routes, backdrop upload, serving and pruning, re-keying `Occupant`, `Beacon`, `BeaconPlan`, `Closure`, `StoreStatusChange` and the analytics tables, the `ObjectType` and `ConnectorType` column changes, **the catalog route itself, and the per-tenant catalog version column with its increment on every catalog change** (§10 Q1, Q2): **OA-2**.
- Converting the seeds to documents, the Demo Malls fix (door channels, pin snapping, ADD_PATH backup), the converter report, and the measured mall caps: **OA-3**.
- The publish engine reading the document: walls and the walkable area, the body margin, door channels, costs in seconds, warnings-only publish (Q2), the package with string ids, and every non-blocking check (unreachable, overlaps, self-crossing, near-zero rises): **FF-3′**.
- The editor: tools, snapping, undo, autosave states, panels as `FieldSpec`s, the client-side checks, default stops from a footprint, the Dart rounding helper, export and import buttons: **OA-4**.
- AI plan conversion (OA-5) and the 3D preview (OA-6).
- Office-only fields: desks, hot desks, monitors, seating, departments, capacity, comfort-room signs and minutes, `spots`, colours (re-plan §1.2).
- Opening hours and door rules (L33, P2-02), which go on `Occupant`, never in the document.
- Beacon identity, positions and the planner (P0-12), and live status and closures (P1-01). OA-1 fixes only the key format they will use (AC-41).
- Deleting a map (Q12 (a): "Clear the draft" only, OA-2).
- Any change to `PackageFormatVersion` (FF-3′).

## 9. Notes for the plan and later slices

**For later slices (outside OA-1; raised here so they are not lost):**
- **OA-2: the catalog version column (§10 Q2, ruled (b)).** OA-2's migration 0001 adds a per-tenant catalog version counter. It starts at 1 and is incremented on each catalog change, in the same transaction as the change. The catalog route (AC-44, AC-45) serves it, and the context loader (AC-46) passes it to the validator. One point is left for OA-2's spec, because no ruling settles it: how a change to a **platform** `ObjectType` row, which every tenant's catalog includes, reaches each tenant's counter.
- OA-2: an imported store starts Open (§10 Q5, ruled (a); AC-47).
- OA-2: whether a rollback re-validates the old version's layout before republishing it (EC-3). Office §6.2 does not say.
- OA-2: whether to keep the ids a venue has used, so a deleted element's id is never reused by a new one while relational rows still hold it (EC-20).
- R11: the `ObjectType`, `AmenityType`, `TransitType`, `ConnectorType` and `BuildingType` maintenance screens must check the venue documents before a hard delete, because foreign keys no longer see the references (EC-22).
- After AC-33's measurement, the product owner may set a validator time target, since autosave runs it every 1.5 s (Q7 (a)).
- OA-2: `Beacon.X`/`Y` become venue-frame `x`/`z` (z down the plan), checked inside the level's rectangle from `elementIndex` (AC-35).
- OA-3: an entrance must sit on a wall (§2.5.2), so a building's entrances need exterior walls along its footprint.

**RECALLED, not checked this session:**
- The IMDF 1.0.0 unit category list (AC-21): a doc fetch in the plan.
- ECMAScript's shortest round-trip `Number.prototype.toString` (DC-10) and Dart's `String.length` in UTF-16 units (DC-12).
- PostgreSQL `JSONB` reorders object keys (re-plan DC 14). This is harmless here, because nothing keys on position (AC-12), and it matters to OA-2.
- Express `json({ limit: '5mb' })` counts 5 × 1,048,576 bytes (DC-21).
- zod 4's `toJSONSchema` (DC-1's alternative only).

## 10. Questions ruled (2026-10-12)

The product owner ruled all five questions on 2026-10-12. The ruling comes first under each question, and the options that were offered are kept below it as the record. No question is open.

**Q1 [spec-writer] Which slice builds the catalog route (Q13)?** **Ruled 2026-10-12: (a).** OA-1 writes the route's contract and the parts that need no database; OA-2 builds the route. Applied in §3.11, §5, §8. The intent says "OA-1 has none" (no migration), and re-plan §3.4 puts `ObjectType`'s new resize, mount and round columns in OA-2's migration 0001. The re-plan's OA-1 row, though, lists "the catalog read".
- (a) **Recommended (ruled):** OA-1 specifies the route's contract (AC-44, AC-45) and builds the pure functions that shape rows into the catalog and into the validator's context (AC-44, AC-46), tested on fixture rows. OA-2 builds the route with migration 0001. *Cost:* the first served catalog comes with OA-2, and AC-45's API test moves there.
- (b) OA-1 builds the route now on today's columns (code, label, default sizes, `BlocksWalk`), with `resize`, `mount` and `round` served as `null`, `floor` and `false` until OA-2. *Cost:* a route whose shape changes in the next slice, with its ledger row, manual case and waivers now.
- (c) OA-1 carries the `ObjectType` part of the migration. *Cost:* contradicts the intent's "OA-1 has none" and splits migration 0001.

**Q2 [spec-writer] What is the document's `catalog` version in Gabay (office §5; Q13)?** **Ruled 2026-10-12: (b), not the recommended (a).** It is a per-tenant catalog version counter, incremented on each catalog change, and needs a column in OA-2. Applied in §2.1, AC-44, AC-46, EC-4 and §9. Office stores an integer catalog version, so a map drawn with a later-retired type still loads. Gabay's catalog is a tenant-extensible lookup whose rows are deactivated, never deleted while referenced, so the version's job is mostly done by AC-20. Re-plan §1.1 leaves it as "the max `UpdatedAt` or a counter".
- (a) **Recommended:** an opaque string. The catalog route computes it as a short content hash of the catalog it serves, the document records the one it was drawn with, and the validator checks only its format. It is informational and lets the editor say "the catalog changed since this map was drawn". *Cost:* no schema change; the hash changes on any edit to any type.
- (b) **(Ruled.)** An integer counter per tenant, bumped on every `ObjectType` write. *Cost:* a column or table in OA-2 and a write path in R11's maintenance screen.
- (c) Drop the field. *Cost:* departs from office §5's "the map stores the catalog version", which the re-plan lists as followed.

**Q3 [spec-writer] Is the `schema-forms` lint's document mode (E-26) built in OA-1 or OA-4?** **Ruled 2026-10-12: (a).** It is built and proven in OA-1. Applied in AC-40 and §5. The intent names E-26's document mode as a dependency, but OA-1 adds no `FieldSpec`.
- (a) **Recommended (ruled):** OA-1 builds the mode and proves it on fixture `FieldSpec`s (AC-40), so OA-4's first panel is checked from its first line. *Cost:* a lint change before any real spec uses it.
- (b) OA-4 builds it with the first panels, and OA-1 only guarantees that the schema carries what the lint needs (AC-39). *Cost:* OA-4 grows, and E-26 is unproved until then.

**Q4 [spec-writer] What shape does `site.georeference` take (L31)?** **Ruled 2026-10-12: (a).** The georeference is the latitude and longitude of the frame's origin plus the bearing of "up the plan". Applied in §2.2, AC-13, AC-13a, EC-4b and DC-31. `Venue.GeoreferenceJson` has no defined shape anywhere: schema 0.14, P0-02, P0-04 and P0-09 name it but do not define it. No seeded venue has one (P0-02 AC-24), but P0-04 AC-14 tests mall detection through it with fixtures.
- (a) **Recommended (ruled):** `{ origin: { lat, lon }, bearingDeg }`. It gives the WGS84 position of the frame's (0, 0) and the true bearing of "up the plan" (−z), clockwise from north, with 1 frame metre = 1 ground metre. It is the smallest exact form for a local planar frame, and the editor can compute it from two points picked on a map. *Cost:* the phone uses a local tangent-plane approximation (RECALLED as adequate at mall scale).
- (b) Two control-point pairs `[{ x, z, lat, lon }, { x, z, lat, lon }]`, from which readers derive scale, rotation and offset. *Cost:* every reader repeats the derivation, and a scale other than 1 becomes possible.
- (c) Only `null` in spec 1; the first spec that reads it (P0-04 or P0-13) defines it as spec 2 with an upconverter. *Cost:* FF-4's fixtures wait on that spec.

**Q5 [spec-writer] Which store fields travel in the export file (Q11 (b))?** **Ruled 2026-10-12: (a).** The fields are the unit key, name, spoken name, category code and keywords. Status is not exported, and imported stores start Open. Applied in AC-46, AC-47, EC-4a and §9. Your ruling lists "names, categories, keywords". A store also has a spoken name (L112), a status (L83) and an active flag.
- (a) **Recommended (ruled):** the unit key, name, spoken name (as part of its names), category **code** and keywords. Status and active are not exported, and an imported store starts Open (P0-11 G8: "a new store starts Open"). *Cost:* a re-imported closed store reopens until an admin sets it again.
- (b) As (a), plus the status code and the active flag. *Cost:* the status history (`StoreStatusChange`) then misses the import's change unless OA-2 writes a row for it.
- (c) Exactly the ruling's words: name, category code and keywords, with the unit key. *Cost:* spoken names are lost on a move between databases.

## Revision history

| Revision | Date | Change |
|---|---|---|
| r1 | 2026-10-12 | First revision, from the intent and the re-plan with the product owner's answers Q1–Q16, N1 and N6 (L170). It raised five questions (§10 Q1–Q5). The product owner ruled them the same day: Q1 (a), Q2 (b), Q3 (a), Q4 (a), Q5 (a). The rulings are folded into r1, because no plan had cited it yet. L170, L171 and E-25 to E-28 are cited from `main` (PR #25) |
