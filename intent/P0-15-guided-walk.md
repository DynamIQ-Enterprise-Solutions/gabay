# Intent P0-15 — Guided walk and route preview

> **Pipeline entry:** P0-15 · **Slice:** FF-8 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-15; PRD §6.6, §6.8, §6.9, §6.23 · Blueprint §4.3, §4.4

## What the product owner wants
**L118:** the fallback when BLE fails. "Guide me step by step" on the route sheet (by hand only) moves a guided dot along the route at the shopper's pace (Walking pace; slower and faster on the card; Pause) and waits at every turn and landmark for "Are you at ⟨landmark⟩?" (Yes: on to the next; No: "Where are you?" and a new route). A one-time tip, and a hint while the live dot is unsure or grey. Suggestive wording, ride checks and arrival by tap (not live-confident); off-route off (DC26); never recorded (DC27); a returning live fix is offered, not taken. Plus Preview the route: a ghost dot plays the route at 3× with the turning map and no voice, never touching the position

**Why this tier:** The pilot must not depend on beacons alone; the product owner ruled it P0 (L118)

**Dependencies (pipeline):** P0-06, for the route and its turns and landmarks · P0-08, for "Where are you?" · P0-14, for the wording, checks and voice

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
