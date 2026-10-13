# Intent OA-2 — Storage and lifecycle of the venue map document

> **Pipeline entry:** OA-2 · **Slice:** OA-2 (`plan/PH4-feature-first.md` 1.1; `plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2) · **Date:** 2026-10-13 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** L170, L171, L172; `spec/OA-1.md` r1 (the document and validator, merged in PR #26) and its §9 notes for OA-2; `OFFICE_MAP_DESIGNER_SPEC.md` §6, §7, §8.4, §8.7 (kept out of git; cited by section)

## What the product owner wants
Each venue's map lives as **one JSON document** with a **draft** that the editor autosaves and **published versions** that are frozen (L170, office §6). OA-2 delivers the storage and its routes: load and autosave the draft with an optimistic `baseVersion` (409 stale, never a merge; office §6.2, §8.4), publish (validate again, strip backdrops, freeze a new version — the package build itself is FF-3′), "republish an earlier version" as a new version (rollback, office §6.2, adapted: invariant 3 stays — published versions are never deleted, Q12), "Clear the draft", the catalog route OA-1 specified (Q13, AC-44/45), export and import of a map file with its stores (Q11 (b)), and the audit of each draft save as a body-free summary row (Q16). It retires FF-1's building, level and boundary routes and screens (Q1: buildings and levels live inside the document).

**Why now:** OA-3 (the seeds as documents), FF-3′ (the engine reading the document) and OA-4 (the editor) all read or write stored documents.

**Dependencies:** OA-1 (merged). The first migration in the repository (rule 4).

## Settled context
- **The owner's answers (L170):** Q1 buildings and levels inside the document; FF-1's building and level routes retire; Q7 autosave as office §8.4, one editor per venue at a time; Q11 (b) export geometry plus stores (name, spoken name, category, keywords; status not exported, imported stores start Open — OA-1 Q5); Q12 "Clear the draft" only; Q13 the catalog is the `ObjectType` lookup with resize, mount and round; Q16 a summary audit row per draft save, publishes and rollbacks in full; OA-1 Q2 a per-tenant catalog version counter (a column here).
- **Open items OA-1 handed to OA-2 (spec/OA-1.md §9):** how a platform `ObjectType` change reaches every tenant's catalog counter; a record of ids already used so a deleted element's id is never reused while stores or beacons point at it; whether a rollback re-validates the old layout; beacon coordinates in the venue frame; what import does with a venue's existing stores (replace, merge by unit key, or refuse); `lookups.js` requires `tenantId` on every row the repository reads.
- **Constraints:** E-20 (localhost, throwaway data, the development stub; export/import on this machine only, never committed — E-20 rule 3 as amended, L171); the seven rules (rule 2 tenant from `req.tenantCompanyID`; rule 3; rule 4 — migration 0001 plus `schema.sql`); retrofit-ledger rows for every route; the Evidence Standard.
- **Approval:** this intent and its spec are approved together by the product owner (L156).
