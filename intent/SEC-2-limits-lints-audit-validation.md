# Intent SEC-2: Rate limits, the two guard lints, the audit trail and zod validation on every feature route

> **Pipeline entry:** SEC-2 (the retrofit's R4 rate limiting, R7 the two lints, R3 audit and redaction, R5 validation, pulled forward by L184) · **Slice:** SEC-2, stage S, after SEC-1 (`plan/DEPLOY-staging.md` 1.0 §1, §2) · **Date:** 2026-10-14 · **Status:** DRAFT for the owner's spec sitting; the content was approved as `plan/PH2-identity.md` 1.1 slices P2-S4, P2-S5, P2-S6 and P2-S8 (L149) and re-sequenced by L184 · **Coder:** api-coder (Sonnet 5.5), Opus 5.5 review of the slice (L174, L184) · **Sources:**
> - `plan/PH2-identity.md` §3 (P2-S4, S5, S6, S8), §7 rulings 3 and 6 (L149); L128 (the two lints named);
> - `plan/DEPLOY-staging.md` §1 (SEC-2 row: "R4, R7 yes; R3, R5 recommended"), §3 (the public URL bills per call; `maxInstances = 1` keeps the in-memory limiter valid, Blueprint §2.6);
> - `plan/PH4-feature-first.md` §6 (R3, R4, R5, R7), §7 (the ledger's open validation cells; OA-2's audit rows under L170 Q16: a body-free audit row per draft save, publishes and rollbacks in full);
> - Blueprint Part 1 §3.2 (rate limits), §3.6 (audit), §3.7 (validation); the standard §6 items 2, 4, 5 and 9;
> - `functions/src/app.js` (`auditLoggerSlot`, `rateLimiterSlot`: "SLOT, filled in Phase 2"); `functions/package.json` (`express-rate-limit` 8.7.1 installed, unused; `zod` 4.6.5).

## What the product owner wants

A staging URL that is safe to expose (L184): a public function that bills per call needs limits; the proof that no route was left open and that no driver text leaks is the two lints; every write by a signed-in admin is attributed; every route boundary is checked once, the same way.

SEC-2 delivers, on the server only:

1. **Rate limiting (R4).** A global limiter on `/api` (`RATE_LIMIT_PER_MIN`, default 1,200), an auth limiter that counts failed token checks (401s per IP over 15 minutes, failures only; PH2 Q3), and a `RATE_LIMIT=off` kill switch. In memory, valid only while `maxInstances = 1`; the limit values are settings or env values, never literals (C8).
2. **The two lints (R7, L128).** `route-guard-order` (the Q6 order `auth → tenantContext → role guard → permission guard → validate → handler` on every mounted route; the one source of truth is the router) and `raw-error-text` (no driver message, stack or schema name reaches a response). Both join `npm run verify`'s structural linters and the Stop hook; both have their own tests (`lint:test`).
3. **Audit and redaction (R3).** One shared `redactSecrets` module (EXACT, STEMS, `NEVER_SECRET` wins). The audit middleware snapshots before handlers and writes on `res.on('finish')`, fire-and-forget; POST, PUT and DELETE; anonymous 404s dropped; IPs normalised; the payload capped at 4,000 characters with a marker. OA-2's rule holds: a body-free row per draft save, publishes and rollbacks in full (L170 Q16). Every mutation the features built so far is covered, the publish included (§6 R3).
4. **Validation (R5).** zod on every feature route boundary (the ledger's open cells), with allow-list maps for sort keys, filters and lookups (rule 3). The venue map document keeps OA-1's validator as its boundary check (re-plan §3.1). **The escalation guards wait for R6** (no route writes grants yet; DEPLOY-staging §1).
5. **Its own e2e cases:** a burst beyond the limit answers 429; a failed-token burst is limited; an audit row appears for a draft save and a publish; a malformed body answers 400 with no driver text.

## Out of scope

- The admin API's escalation guards (R6); the client (SEC-3); the boot guard and the storage backend (DEP-0).

## Product questions for the sitting

Expected none (all ruled in L149). The spec lists its DESIGN CHOICEs with an alternative each (L174).
