# Intent P0-17: AI floor-plan conversion in the admin map editor

> **Pipeline entry:** P0-17 (the new entry the re-plan's §3.3 foresaw, "P0-17 Plan conversion"; the ID was chosen by the main session) · **Slice:** OA-5 (`plan/OFFICE-ADOPTION-replan.md` 1.0 §3.2 row 8) · **Date:** 2026-10-14 · **Status:** APPROVED by Genesis Perez, product owner, on 2026-10-14 (P0 sitting; Q1 (a), Q2 (b), Q3 (a)), with its spec (L156) · **Sources:**
> - L170 and L171 (adoption and exceptions: the amended L108, Q3, Q8, Q9; E-27, E-28, and E-20's rules 1 and 3 as amended);
> - the DPO record of 2026-10-14 (the owner as Gabay's DPO, L116), recorded in the next L-row with the owner's standing approvals;
> - L174 (delivery speed), L175 (admin-first), L178 (the sitting);
> - `OFFICE_MAP_DESIGNER_SPEC.md` §10.1 to §10.5, §9 and §11 (kept out of git; cited by section);
> - `spec/P0-11.md` r3 (the editor's hooks for OA-5, the backdrop and its calibration, the `review` flag, undo); `spec/OA-1.md` r1 (the document and its validator); `spec/OA-2.md` r1 (the backdrop store); `spec/OA-3.md` r1 (the caps);
> - FEATURE_PIPELINE §5 and P1-03 (CAD and IMDF import, which overlaps).

## What the product owner wants

In the admin map editor, an admin who has laid a floor-plan image under a level and calibrated it can ask for a **proposal**: the walls, doors and named rooms the plan appears to hold, drawn over the floor in a distinct colour. The admin adds the proposal to the floor as **one undo step**, or throws it away. It never writes the map by itself. It is **off by default** (`ai.planConversion`, a module gate that fails closed). It follows office §10: a gridded crop for the model, a clean crop that the server measures for walls, the model asked only for what cannot be measured, a tidy-up, and validation against the full map spec before anything is returned.

Claude is the first provider, through `@anthropic-ai/sdk` behind a provider-neutral port, model `claude-sonnet-5-5` with `claude-opus-5-5` as a setting (L170).

**What the owner approved (the DPO record, 2026-10-14):** "I approve sending invented or throwaway test floor plans to Claude; never the penthouse drawings." So the precondition for the first call (L116, L171) is met for test plans. The penthouse drawings stay excluded until Raphael Mendoza agrees (L48). Counsel's review is still owed before analytics ships, which is L42 and does not touch this slice.

**Extended by the owner as DPO, the same day (P0 sitting, Q2 (b)):** MEZZ is a throwaway test plan. A picture rendered by our own code from the committed MEZZ source may be sent to Claude from this machine, to measure the conversion. The ruling names MEZZ only: the penthouse drawings stay excluded (L48), and the owner's spike exports are not covered.

**Why now:** the editor (OA-4) is built; the backdrop and its calibration exist (OA-4a-4); the admin-first order (L175) puts OA-5 after OA-4's backdrop. A mall with a scanned or PDF plan gets a first draft in minutes instead of tracing every wall by hand.

**What the owner needs to see:**
- the estimated cost before a conversion starts, and the actual cost after it;
- what was sent, said in plain words, and a confirmation that the plan is a test plan;
- a proposal that cannot corrupt the draft, and a failure that costs the admin nothing but the provider's fee.

## Settled context

- **Rulings:**
  - L170 and L171: AI conversion is allowed as a proposal only, accepted as one undo step, off by default; Q3 (a non-blocking `review` flag on every accepted element); Q8 (a provider-neutral port, Claude first, Sonnet 5.5 by default, off by default, the penthouse never); Q9 (the plan measured on the server with `pngjs`, built after the editor's backdrop); E-27 (the SDK, server only, in one module that imports no `decrypt()`); E-28 (`pngjs`, server only); E-20 amended (rule 1: a crop of a throwaway or invented test plan may leave this machine for the approved provider; rule 3: test maps may be exported and imported here).
  - L119, L48, L123: the penthouse is internal only; its data stays out of git.
  - L166: the admin page is English by design.
- **Facts checked (the re-plan's header, 2026-10-12, through the `claude-api` skill):** the model IDs and prices of the two models, image input as base64 `image` blocks, structured JSON output through `output_config.format`. Everything else about the SDK, `pngjs`, the provider's retention terms and the request time limit is RECALLED and is re-checked at OA-5's step 0 (L121).
- **Constraints:**
  - E-20: localhost, throwaway test data, the development stub, retrofit-ledger rows for every route.
  - The seven rules. Rule 1 applies to the cost (money is `decimal.js`, never a float). Rule 5 applies to the model list (a constants entry with its authority).
  - Invariant 16: a flag is listed in the registry with its fail direction before it is used.
  - The Evidence Standard.
- **Ruled by the owner on 2026-10-14** (the spec's §12): Dynamiq pays for now, a per-tenant allowance the owner sets comes in a later slice, and the admin always sees the cost first (Q1 (a)); MEZZ is a throwaway test plan and may be sent, as above (Q2 (b)); only MALL_ADMIN and SUPERADMIN may run a conversion, the same pair as Restore (Q3 (a)).
- **Approval:** this intent and its spec are approved together by the product owner (L156).

**Note on record numbers.** The records writer assigns L-rows in merge order. The DPO record and the owner's standing approvals are the next row after L178.
