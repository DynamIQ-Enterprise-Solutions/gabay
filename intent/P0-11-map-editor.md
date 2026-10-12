# Intent P0-11 — Map editor

> **Pipeline entry:** P0-11 · **Slice:** FF-10 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-11; PRD §6.2 · Blueprint §4.6

## What the product owner wants
Grid boxes with the object library, the polygon tool and the traced underlay (L39). Every shape can be resized, moved and rotated. Connector heights and elevator parameters. The store's walk-through mark (L29, L92). The derived walkable area and graph corrections. **L112:** an optional "spoken as" for stores and connectors (`Occupant.SpokenName`, `NavConnector.SpokenName`)

**Why this tier:** Admins must author and maintain their venues; the demo seed only covers the test site

**Dependencies (pipeline):** P0-01, the model it edits

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
