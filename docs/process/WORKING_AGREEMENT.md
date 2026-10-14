# Gabay — Working Agreement

> **Version**: 1.19 | **Date**: 2026-10-14 | **Status**: in force (plan.html L121; §8 added by L122; §2 and §7 amended by L123, L124, L125; §6 amended by L129, L130; §1 amended by L131; §2 and §7 amended by L135, L136; §1 amended by L139; §6 amended by L140; §6 amended for coder working copies, plan/PH1-worktrees.md 1.1 and 1.2, L147, L148, L150; §5 amended by L151; §6 amended by L152; §3 amended by L153; §1 and §2 amended by L156; §5 clarified by L173: a throwaway database per test file for migration and concurrency tests; §1 and §8 amended by L174; §7 amended by L177) | **Audience**: Claude Code, every agent in `.claude/agents/`, and anyone working on Gabay | **Scope**: how work is decided, done, proven and recorded. What "done" means is `docs/product/FEATURE_PIPELINE.md` §5; the review passes are `REVIEW.md`; the engineering rules are the Dynamiq standard and `CLAUDE.md`.

The product owner set these rules so they never have to be repeated. When the product owner rules something new about *how we work*, it goes here (or in `CLAUDE.md` if it is an absolute rule) in the same turn, with its L-row.

## 1. Decisions: ask, never assume

- **Anything not settled by the spec, the plan, the PRD, the Blueprint or a decision-log row is asked, not assumed** (L121). This covers behaviour, data, wording, screens and scope.
- **Purely internal choices** (names, a helper's shape) inside an approved spec and plan are listed as **DESIGN CHOICES** in the plan or PR, each with an alternative, for the product owner to approve or overrule.
- **How to ask:** with AskUserQuestion, the recommended option first and marked, each option with its evidence and tradeoff. Research first and show what was found; tag anything unchecked **RECALLED**, and check it before it carries weight (CLAUDE.md evidence standard).
- **Where documents, references or rulings disagree,** stop and ask, quoting both.
- **Record every ruling** as a `plan.html` decision-log row (append-only, with a version bump and a changelog row), and update the PRD, Blueprint, pipeline, schema, CLAUDE.md, this file and, for a product ruling, the `gabay-product-rulings` skill (`.claude/skills/`; every product agent preloads it, L131) as the ruling touches them, in the same turn. No document is edited before the product owner's go-ahead.
- **Deploys and outward actions** (creating a repository, pushing, publishing a store build, deploying to Firebase) happen only on the product owner's call (L109). **Exception (L184):** the private staging project `gabay-staging` deploys from `main` by CI under the owner's standing call, once SEC-1 to SEC-3 and DEP-0 are merged; production is always a separate, named call. Agents never run `firebase deploy` and never hold cloud credentials.
- **Every action is asked first (L139):** before any action (editing a file, starting an agent, a branch, a push, a pull request, a merge, a GitHub setting, publishing a page) the main session asks the product owner with AskUserQuestion, the recommended option first; read-only checks to prepare the question are allowed. A go covers only the actions it names; every merge needs its own go. **Exception (L174):** the standing delegation of technical choices below.
- **The fast lane while E-20 is in force (L156; amends L139 for that period):**
  1. **Standing go for routine steps.** Once dod-reviewer says "ready" and CI (lint + e2e) is green, the main session pushes, opens the pull request and merges without asking. Review findings (Important and nits) are fixed without asking, as long as no ruling of the product owner's is needed. Still asked: plans, rulings, anything failing or blocked, anything outside the approved plan, deletions or anything hard to undo.
  2. **Two owner touchpoints per slice (L174; replaces "one consult per slice").** (a) **One spec sitting:** the product questions of the intent, the spec and the plan, from the main session, the coders and the reviewers, collected into one question sheet, with the plan where possible, not one at a time. (b) **One sign-off:** the finished slice, with the list of technical choices the main session made under the standing delegation below. Anything that comes up between the two and has a product effect is asked in the same way, but a technical choice is not.
  3. **Coders in parallel**, each in its own working copy, on approved plans only.
  4. **Plans in batches.** Several slices' intents, specs and plans are drafted together and approved in one sitting, so each slice starts as soon as the one before it merges.
  5. **Lighter reviewer verify.** dod-reviewer runs the affected tests instead of a full `npm run verify`; the full verify still runs for the coder, at the pre-push hook and in CI.
  6. **One `plan.html` row per slice,** holding all of that slice's rulings.
  7. **A short status after each merge:** what merged, what the product owner can now see or use, what runs next.

  Unchanged: tests first, dod-reviewer on every slice, CI's lint and e2e, the seven rules and every linter, E-20's hard rules, and the product owner's approval of every plan and every real decision.

- **Standing delegation of technical choices (L174).** The main session decides, without asking, a technical choice that changes **no product behaviour, wording, cost or ruling** (a test's size, a helper's shape, a regular expression, a file layout inside an approved plan). It records each as a DESIGN CHOICE with its alternative, and **lists them all at the slice's sign-off**, where the product owner may pull any back. Anything with a product effect, anything outside the approved spec and plan, a deploy or an outward action (L109), and every ruling still goes to the product owner. This is how OA-1's ten points were accepted in practice.
- **The slice's workflow (L174):** (1) the spec sitting, product questions only; (2) a plan delta of one to two pages, approved with the spec, its technical choices listed for sign-off; (3) the contract commit, then tests first, then the build, in the slice's own lane (its working copy, database and, from rollout step 4, its own emulator ports, lock and file area); (4) one full `npm run verify` at the end of the build, with the affected tests for reviews and fixes; (5) one dod-reviewer pass, on Opus, its findings fixed under the fast lane; (6) the sign-off; (7) the pull request, with the slice's records, then merge. **In force now:** the two touchpoints, the delegation and §8's routing. **Not yet, and not amended here:** item 5 above (the lighter reviewer verify, and the full verify at the pre-push hook) and CLAUDE.md's "run it before reporting any task complete" stay as written until rollout step 3 (tiered verification, with a matching green full run satisfying the pre-push and Stop hooks) is built and recorded; the records generator and records inside each slice's pull request wait for rollout step 5; the per-copy ports and lock, which replace PH1-worktrees WT-2's shared ports, wait for step 4. The order of the rollout is 1, 2, 4, 3, 5 (the product owner, 2026-10-14).

## 2. Approvals (L121)

| Step | Artifact | Who approves |
|---|---|---|
| Intent and spec | `intent/<id>-<slug>.md`, `spec/<id>.md` (spec-writer) | The product owner approves both together: scope, and anything the spec flags (schema changes above all) |
| Plan | `plan/<id>.md` (names the spec revision, the §5 items it triggers, its DESIGN CHOICES) | The product owner |
| Code and tests | the diff (coders), the tests (test-verifier) | Nobody yet: the agent that wrote it can never approve it (standard §14.2) |
| Review | dod-reviewer: runs `npm run verify` in a fresh context (while E-20 is in force, the affected tests only: L156), then `REVIEW.md` and §5 | An AI self-check, never a sign-off |
| PR | with the evidence of §5.3; lint and e2e green on GitHub (required checks, L136) | The product owner approves the merge; nothing reaches `main` except through a pull request, for anyone (L136). While E-20 is in force, the main session merges once dod-reviewer says ready and lint and e2e are green (L156) |

**Phase setup work the standard itself defines** (Phase 1's rails, Appendix C) has no intent or spec: it runs as one plan, approved once, built in slices, each closed with pasted proof (L123). Product features always take the full chain above.

The product owner holds both the product-owner role and, under Raphael Mendoza's delegation (L115), the lead's approvals.

## 3. Cadence: features and phase gates, no sprints (L121)

- **Per feature:** one pipeline entry at a time through the chain above, with the full §5 list at its end.
- **Per phase:** phases end on conditions, not dates (standard C.1). At each phase end:
  1. a fresh-context verifier agent runs every check;
  2. a gate report, `phase-reports/phase-<N>.md`, lists each gate condition with its evidence (pasted outputs, the DONE entries, screenshots);
  3. the documents are synced and the modules page republished;
  4. the product owner, who did not write the code, reads and signs it. A gate signed by whoever did the work is not a gate.
- **Phase order:** the standard's order (Appendix C.1) changes only through an `EXCEPTIONS.md` entry with an expiry date and the product owner's sign-off, as E-20 does for feature-first (L153). Its gates still pass in full, later, on the system with its features.
- **Quarterly** (standard Phase 6): the audit, the `EXCEPTIONS.md` expiry sweep (current entries expire 2027-04-02) and the version-floor review.

## 4. Evidence: no claim without proof (L121)

A claim that something works carries:
- **pasted command output with its exit code**: `npm run verify` (it ends `ALL GREEN`), and any test, query or script relied on. Never "should work", "looks fine" or "probably";
- **screenshots rendered by a test** for any screen change: light and dark, phone and tablet;
- **a traceability table** for a feature: acceptance criterion → test → result.

If something was not run, say so. If a step was skipped, say so. A partial result is reported as partial.

## 5. Tests (standard §7, §8.4; L121)

- **If a test fails, fix the code, not the test.**
- An existing test changes only when `plan/<id>.md` names it and the spec change behind it (C1); list each changed test with a reason.
- A flaky test is a failure: no retry until green, no skip.
- A fixed bug gets a regression test where possible, and its header names the bug.
- No coverage percentage: coverage is criterion-to-test traceability.
- API tests may write real tables only inside a transaction that is always rolled back (real keys and constraints apply; nothing is kept; L151). Otherwise tests use TEMP tables, and no test leaves a row behind.
  - **Clarified by L173 (OA-2, plan/OA-2-map-storage.md 1.0 §18a Q1 (a)):** a test that cannot run inside one rolled-back transaction, a migration test (it needs several schema versions and a failed migration) or a true-concurrency test (it needs two connections that both see committed rows), may use a **throwaway database for its test file**: created for that file, used, and dropped `WITH (FORCE)` in a `finally`, with nothing kept (`db/tools/test/scratchDb.js`). The working copy's own database is still written only inside rolled-back transactions.

## 6. Hooks: what enforces this (L121; built in Phase 1)

| Hook | Runs | Blocks |
|---|---|---|
| `.githooks/pre-commit` | every commit | a staged `.env` (except `.example`); a duplicate changelog entry; a failing linter for the changed files. Raises the patch version of each surface the commit touches (L129; minor and major by hand) and stamps the top changelog entry's version and date. |
| `npm run verify` (`tools/lib/verify-lock.js`) | every run, a partial one too (not `--list`, not CI) | a second run in the same lane at the same time: it waits for the first (a lock file per lane in the system temp folder, `gabay-verify.lock` for the main folder and `gabay-verify-<offset>.lock` for a working copy; it names the holder, gives up with exit 2 after `GABAY_VERIFY_LOCK_WAIT_MS`, default 15 minutes), because runs of one lane share emulator ports. Each working copy is its own lane, with its own database `gabay_wt_<name>` (plan/PH1-worktrees.md) and its own ports (the defaults plus its `EMULATOR_PORT_OFFSET`, plan/PH4-lane-ports.md), so copies verify at the same time. Name your run with `GABAY_VERIFY_OWNER` |
| `.githooks/pre-push` | every push | the push, when `npm run verify` fails; when code files have uncommitted or untracked changes (verify checks the working tree, so it must equal what is pushed); when a pushed ref, peeled to its commit, is not the checked-out commit (deletions pass; S5 review). Verify runs with git's per-repository variables unset (`git rev-parse --local-env-vars`), so its tests cannot reach the repository from a linked worktree (INC-001, L152) |
| GitHub Actions | every push and PR; the e2e suite on a schedule | the merge, when the lint fails; uploads the server log on failure |
| `.claude/settings.json` Stop hook | when the main session finishes (L129; coders hand back to it) | finishing until `npm run verify` has run on the current code of the main folder, and also of the working copy the shell is in when that is a different folder (L150); a failed run lets the session stop with a "verify FAILED" notice to the product owner (and, when `.verify/logs/` holds logs, says the full output of each failing check is there), so an agent can still stop to ask a question |
| `.claude/settings.json` Stop hook | when the main session finishes (L130) | finishing when user-facing screens changed with no changelog entry, in the main folder or in the working copy the shell is in (L150), unless the final message states "Changelog waived: <reason>" (the waiver is in front of the product owner) |
| `.claude/settings.json` after Flutter edits | after any Flutter file edit | a schema-to-form drift |

One-time, after cloning: `git config core.hooksPath .githooks` (README).

## 7. Repository (L121)

A **public** GitHub repository, `DynamIQ-Enterprise-Solutions/gabay` (L177; transferred from `dev42025pwd/gabay`, whose links redirect; public since L135, private before), with GitHub Actions for CI. `dev42025pwd` pushes, opens pull requests and merges there. It is created, and anything pushed, only on the product owner's go, after they sign in to the GitHub CLI as that account (L123). Commits carry `dev42025pwd`'s GitHub noreply address, never a work email (L135). **Branch flow (L136):** work happens on a branch; a pull request into `main` merges only when lint and e2e pass and the product owner approves; branch protection has no bypass, the product owner included.

**Never in git (L123):** `Gabay Demo.apk` (too large for a repository), `db/seeds/sources/internal/` (the penthouse, internal only, L48) and `db/seeds/sources/spike-exports/*.json` (the product owner's own spike venues, C3), besides `.env` and generated output. A clean clone seeds without the penthouse.

**Where documents live (L125):** README.md, CLAUDE.md, REVIEW.md (standard §8.6) and INSTALL.md at the root; every other project document under `docs/`, by purpose: `product/` (PRD, Blueprint, pipeline), `process/` (this file, EXCEPTIONS), `testing/` (E2E manuals, smoke guide), `ops/` (runbook, incidents, and later the per-release deploy plans), `reference/` (background only). Pipeline artifacts stay in `intent/`, `spec/` and `plan/`; `plan.html`, the standard and the reference HTML stay at the root. A new document goes in the folder that matches its purpose; a new folder is a ruling.

**Node:** Node 22 for Gabay (the Cloud Functions runtime), through fnm, which reads `.nvmrc` per folder; the machine's Node 24 stays the default elsewhere (L123, amended by L124: nvm-windows switches every terminal at once).

## 8. Models: who does what (L62, L122)

The product owner: "use sonnet 5.5 for well defined coding but if it requires in depth analysis and decisions, use either opus or fable depending the weight but consult to me first for every important scenario".

- **Well-defined coding** (an approved spec and plan, nothing left to decide): Claude Sonnet 5.5, `claude-sonnet-5-5`. These are the coder agents and test-verifier.
- **In-depth analysis and decisions:** Claude Opus 5.5 (`claude-opus-5-5`) or, for the heaviest, Claude Fable 5.1 (`claude-fable-5-1`). These are spec-writer, dod-reviewer and native-ble (L62), and the main session.
- **Consult first:** every important scenario goes to the product owner before work starts on it. That includes moving a task off Sonnet onto Opus or Fable, and any use of Fable at all. Ask with AskUserQuestion (§1), with the recommendation and the reason for the weight.
- The pins sit in each agent's `model:` line. They change only by a ruling recorded here and in `plan.html`.

**Routing and budget (L174).** The product owner approved this routing on 2026-10-14, after the weekly Opus limit stopped a slice mid-fix. It is the default per job and, where it differs from the bullets above, it wins. The agents' `model:` pins follow it (L174, 2026-10-14): spec-writer is on `claude-sonnet-5-5` and engine-coder on `claude-opus-5-5`; api-coder, flutter-coder and test-verifier stay on Sonnet, dod-reviewer and native-ble on Opus. The bullets above read with that.

| Job | Model |
|---|---|
| Specs, plans, tests, records, and well-defined code | **Sonnet** 5.5 |
| The engine and other high-risk code, and the final review of a slice (dod-reviewer, one pass) | **Opus** 5.5 (Fable 5.1 by weight, with the consult above) |
| An Opus review of every spec a Sonnet wrote | **Opus** 5.5 |
| Mechanical edits (renames, reformatting, a bulk change that decides nothing) | **Haiku**; its model ID is read from the docs when it is first pinned (L121), never from memory |

- **Per-slice token budget and a usage check:** each slice has a token budget set in its plan, and a usage check warns before the weekly limit is reached, so a limit does not stall a slice. A slice that would pass its budget, or a task that needs a heavier model than this table gives it, goes to the product owner first (the consult above). The budget's figure is set in the first plan that uses it.
- **Why:** Opus costs about 2.2 times Sonnet for similar work (L164), and most Opus work was drafting and records.
