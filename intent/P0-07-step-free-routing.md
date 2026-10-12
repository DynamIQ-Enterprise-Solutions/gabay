# Intent P0-07 — Step-free routing

> **Pipeline entry:** P0-07 · **Slice:** FF-5 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-07; PRD §6.7 · Blueprint §4.2

## What the product owner wants
Excludes stairs and escalators; uses elevators and ramps (1:20); avoids walkways and doors under 1.2 m (a setting), using the clearance publish computes (L88, closing RG4); prefers accessible CRs; says so when no step-free route exists and offers "Turn off wheelchair route". Never a shortcut through a store; a passage store is used (L92)

**Why this tier:** Seniors and PWD shoppers are core personas (BP 344)

**Dependencies (pipeline):** P0-06, because it is a filter on the same engine

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
