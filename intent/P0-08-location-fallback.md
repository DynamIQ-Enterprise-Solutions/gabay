# Intent P0-08 — Location fallback

> **Pipeline entry:** P0-08 · **Slice:** FF-6 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-08; PRD §6.8 · Blueprint §4.3, §4.7

## What the product owner wants
"Where are you?" on entering a venue and from the pin button: shop, entrance or lift search (FTS5), placing the shopper at the door; or pick a floor for an approximate dot that a tap refines (L85); "describe where you are" (any word naming a place or facility, this floor first), typed or spoken. A new position recalculates an active route. **L107:** no QR codes or scanner (anchor and place codes removed; `mobile_scanner` and E-11 withdrawn); a place picked after describing it hands P0-13 the calibration sample, weighted by the place's size (DC18). **L106:** the first live-confident fix takes over from a hand-set position. The source's confidence state (live-confident, live-unsure, hand-set, approximate) is exposed for P0-14's hedging (L99)

**Why this tier:** Every route needs an origin even when the live dot can't provide one. It is also the Apple 5.1.1(iv) alternative when permissions are denied

**Dependencies (pipeline):** P0-06, since the origin feeds routing · P0-05, since the picker uses search

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
