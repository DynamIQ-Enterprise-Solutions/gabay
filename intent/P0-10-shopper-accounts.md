# Intent P0-10 — Shopper accounts

> **Pipeline entry:** P0-10 · **Slice:** R10 (`plan/PH4-feature-first.md`) · **Date:** 2026-10-12 · **Status:** draft, for the product owner's approval with its spec (L156) · **Sources:** FEATURE_PIPELINE P0-10; PRD §6.13 · Blueprint §4.8

## What the product owner wants
Visible, never-forced sign-in through Firebase Auth (L98, E-08); sign-up, sign-out, and deletion in the app and on the web, deleting the Firebase user and the `ShopperAccount` row together. **D1b (L109):** email and password, Google, and Sign in with Apple (Apple 4.8); no SMS or Facebook

**Why this tier:** D1 ruled the login into the MVP; account deletion is a store requirement once accounts exist

**Dependencies (pipeline):** Phase 2 shopper identity · P0-04. **Under E-20 (L153):** built in the retrofit (R10), after the client sign-in (R8) and E-19

## Settled context
- **Order and constraints:** feature-first under EXCEPTIONS E-20 (plan.html L153; `plan/PH4-feature-first.md` 1.0): localhost only (L109), no deploy, throwaway test data only, nothing live until the retrofit (R1–R13) is signed. Admin routes sit behind the development stub (L154, L155, L157); definition-of-done items 3, 4 and 9 are waived only as `Waived: <item> — R<n>` with a retrofit-ledger row. The seven rules and every linter apply in full. Built on what FF-0, FF-SK and FF-1 to FF-4 deliver (`plan/FF-1-4-decisions.md`, L157–L164).
- **Positioning on the test maps (L160 §G1):** the Demo Malls test maps have no beacons and run on the fallback (pick the mall, a hand-set start, "Where are you?", the guided walk); real venues (the penthouse with its five H2s, MEZZ office) keep BLE positioning and detection by location.
- **Product rulings:** the `gabay-product-rulings` skill governs behaviour (the Gabay Demo app is the main reference for the shopper side, L85, L99; the spike for the live dot, L106).
- **Approval:** this intent and its spec are approved together by the product owner, in one sitting with the rest of the batch (L156).
