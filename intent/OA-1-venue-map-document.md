# Intent OA-1 — The venue map document and its validator

> **Pipeline entry:** OA-1 · **Slice:** OA-1 (`plan/PH4-feature-first.md` 1.1; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** L170, L171; `OFFICE_MAP_DESIGNER_SPEC.md` §3, §4, §5 (kept out of git; cited by section); the re-plan's §1–§2 and the owner's answers Q1–Q16, N1, N6

## What the product owner wants
Gabay's map model follows the office map designer spec (full adoption, L170): each venue is drawn as **one JSON document** — the site, its buildings, levels, walls, openings, rooms (units), items (floor objects) and connectors — validated as a whole by a **pure validator** that returns a canonical copy and reports every problem by path (office §4.3). OA-1 delivers the document's schema and that validator, shared by the API (Node) and the admin page (Dart, generated), so that OA-2 (storage and lifecycle), OA-3 (the seeds as documents) and FF-3′ (the publish engine reading the document) build on one definition.

**Why now:** every later map slice (OA-2, OA-3, FF-3′, OA-4's editor, OA-5, OA-6) reads or writes this document; nothing else can start until its shape and rules are fixed (re-plan §3.2).

**Dependencies:** none built; the re-plan's rulings (L170) and exceptions (L171, E-26 for the `schema-forms` lint's document mode).

## Settled context
- **The owner's answers that shape the document (L170):** Q1 buildings and levels inside the venue document (the `Venue` table keeps identity only); Q5 one venue frame in the office orientation (x across, z down, top-left origin, `rot` clockwise, 0 facing up the plan), each level a rectangle (origin + size) in it; Q3 an optional per-element `review` flag, never blocking; Q4 connector costs in seconds, tunable per mall through `ConnectorType`; Q13 the catalog is the `ObjectType` lookup (resize, mount, round), served by the server, never copied; Q15 office-style caps as named constants, mall values measured in OA-3; **N6 an escalator may be marked two-way** (a Gabay-only field; the office spec makes every escalator one-way).
- **What the office spec does not cover and Gabay keeps (re-plan §1.2):** several buildings and the outdoor ground in one venue (L29, L30); stores and their status, beacons and closures stay relational rows keyed to element ids in the document ("geometry and people stored apart", office §1 property 3); store shortcuts only when marked and allowed (L92); step-free routing (P0-07).
- **Constraints:** E-20 (localhost only, throwaway data, development stub); the seven rules (rule 2 tenant binding; rule 4 migrations — OA-1 has none, OA-2 does; rule 7 through E-26's document mode); the Evidence Standard.
- **Product rulings:** the `gabay-product-rulings` skill as amended by L170.
- **Approval:** this intent and its spec are approved together by the product owner (L156).
