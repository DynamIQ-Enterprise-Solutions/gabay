# Intent P0-13 — Live position engine

> **Pipeline entry:** P0-13 · **Slice:** FF-9 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-13; PRD §6.9 · Blueprint §4.3, Part 1 invariants 4, 5, 7 and 10

## What the product owner wants
BLE plus accelerometer steps plus walkway matching (D4b #1–#11) in the worker isolate; GNSS outdoors with an entrance handoff (L31); a confidence-gated dot and the default route origin. The per-device RSSI offset (D4b #7: RSSI heard against the model's expected value, clamped, averaged, saved on the phone, never sent) now comes from a place the shopper picks after describing it (L107, replacing L101's QR scan). **L106, the spike's dot:** jump gate (2.5 m, 3 fixes), smoothing (0.5 s walking, 4 s still), 1.8 m/s cap, D4b #4 freeze, the walkway line lock, a 2 m route snap with off-route on the unsnapped position, a ~500 ms glide along the matched graph path, a solid halo (dashed ring only for approximate), unsure above 4 m ("Near X"), grey at 6 m with the offer, the demo-look cone along the walking direction, "You are in X", the in-transit pill, a faded dot on other floors, and a floor recovery check (15 s away from connectors, "Are you on ⟨level⟩?"). Every value a `dot.*` setting, tuned in Spike 1. **L113:** after a ride, the ride's floor question (P0-14) stands in for the 15 s recovery check, which stays for floor changes without a ride (Blueprint DC25)

**Why this tier:** The product owner's core vision ("live location the moment they enter")

**Dependencies (pipeline):** P0-08, the fallback it supersedes · P0-09 · D4c (ruled in-house, L114) · D4d (ruled P0, L114) · D9 (ruled static iBeacon, L114) · D8 (held; the engine does not depend on who buys)

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
