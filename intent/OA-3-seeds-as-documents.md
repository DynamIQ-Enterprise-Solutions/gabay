# Intent OA-3: The seeds as venue map documents, the re-keying, and export and import

> **Pipeline entry:** OA-3 (P0-02, seeds as documents) · **Slice:** OA-3 (`plan/PH4-feature-first.md` 1.2 §4; `plan/OFFICE-ADOPTION-replan.md` 1.1 §3.2 row 3) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 in the spec sitting (six questions ruled, all (a); L178), with its spec (L156) · **Sources:**
> - L170 and L171;
> - OA-2's records (L173);
> - the delivery-speed rulings (L174);
> - the admin-first ruling (L175);
> - FF-4's early stage and the owner's rulings of 2026-10-14 in it, Q18 among them (L176);
> - `spec/OA-1.md` r1 (merged);
> - `spec/OA-2.md` r1 §5, "Handed to OA-3": H-1 to H-9, which carry Q1 (b), Q8 (a) and Q10 (a), all ruled 2026-10-13;
> - `OFFICE_MAP_DESIGNER_SPEC.md` §8.7, §10.4 and §11 (kept out of git; cited by section).

## What the product owner wants

The demo venues load as **venue map documents** (L119, L170). After OA-3, the four Demo Malls venues (Aurora, Bayview Grand, Meridian Twin Malls, Skyline Spire) and the MEZZ office load in the admin page as drafts, ready for the editor (OA-4) and the publish engine (FF-3′).

OA-3 delivers:
- **The converters emit documents.** Stores become non-walkable rooms with walls and doors.
- **The ruled Demo Malls fix:**
  - door channels (office §11);
  - pin snapping to walkable floor within a named maximum (the office §10.4 idea; **O3**, proposed here for the owner's yes);
  - ADD_PATH corrections as the backup;
  - two-way escalators kept two-way (N6, never split);
  - a converter report.
- **The validator runs on every converted document** before it is written (office §10.4, "validate before returning").
- **The mall object types** (**O7**, proposed here) and the **mall size caps**, measured on the converted malls (Q15).
- **Migration 0002** (OA-2 H-1 to H-4, H-6): the twelve relational geometry tables and `Venue`'s spatial columns are dropped. Stores, status history, beacons, beacon plans, closures and analytics rows are re-keyed to the document's element keys, scoped by venue. `ConnectorType`'s costs move to seconds (Q4, OA-2 DC-16).
- **The key check on draft saves** (H-6) and **the key-status loader** (H-7).
- **Export and import** of a map file with its stores (H-8, H-9; Q11 (b)). Import also writes `Occupant` rows. Files are exported to this machine only and never committed (E-20 rule 3, as amended by L171).

**Why now:**
- OA-4 (the editor) needs maps to edit.
- FF-3′ (the publish engine) needs documents to read.
- Under the admin-first order (L175), the editor's client is built alongside this slice, against OA-2's contract.

**Dependencies:**
- OA-2 merged (storage, migration 0001, the routes).
- OA-1's validator (merged).

## Settled context

- **Rulings:**
  - L119: the test venues, local only; the penthouse internal only (L48, L123), so its data stays out of git.
  - L170: Q1, Q3 (the `review` flag on MEZZ), Q4 (seconds), Q11 (b), Q15, N6.
  - OA-2's spec rulings: Q1 (b) (the old tables stay until 0002), Q8 (a) (in 0002), Q10 (a) (export and import here).
- **Proposals OA-2 handed over** (its spec §5), each to be decided in this spec:
  - H-3: how existing rows migrate;
  - the open forms of H-2 and H-6.
- **Constraints:**
  - E-20: localhost, throwaway data, the development stub, retrofit-ledger rows for the export and import routes.
  - The seven rules, rule 4 in particular: migration 0002 plus `schema.sql`, every `CREATE TABLE` with its `DROP TABLE`.
  - The seed's own tests (FF-2).
  - The Evidence Standard.
- **Approval:** this intent and its spec are approved together by the product owner (L156).

**Note on record numbers.** The records writer assigns L-rows in merge order:
- L173 is OA-2;
- L174 is the delivery-speed rulings;
- L175 is the admin-first order;
- L176 is FF-4's early stage;
- L177 is the repository move.

**Q18 (L176):** the main building is the first entry of the document's `buildings` array, so the converters write it first.
