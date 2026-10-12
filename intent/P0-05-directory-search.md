# Intent P0-05 — Directory & search

> **Pipeline entry:** P0-05 · **Slice:** FF-5 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-05; PRD §6.5 · Blueprint §4.7

## What the product owner wants
FTS5 search over occupants, amenities (with synonyms such as "comfort room") and transit points, including nested sections; "Nearest X" by shortest metres, using Dijkstra with a binary heap that honours one-way edges and step-free mode (L79 RG1, L86). **L103, the demo's method:** one whole-graph sweep from the RG3-snapped origin, cached until the origin node, a routing setting or the overlay changes, feeds every distance: the chips, search results closest first (unreachable last), "About N m to walk" on every place, parking zones and the Places list. The map's "nearest" chips (Restroom, ATM, Food, Lift, Exit, EV charging, Parking, My car) and the Places tab's floor listing come from the demo (L85); the Stairs chip, favourites and recents, voice search (`speech_to_text`, E-10) and "describe where you are" from its 2026-10-06 build (L99). **L112:** "nearest ⟨type⟩" said into the microphone starts the route straight away; Gabay stops speaking while the microphone listens; the reply speaks with route voice off, not when muted. **L116:** recognition on the phone first (`onDevice`); where it fails, the first tap asks "Your phone sends this to Google/Apple to understand it. Use it?" (Yes · Type instead), remembered on the phone

**Why this tier:** Finding a destination is the first thing every shopper does

**Dependencies (pipeline):** P0-04, because it queries the downloaded package

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
