# Intent DEP-1: The private staging project and the deploy on every merge

> **Pipeline entry:** DEP-1 (new; `plan/DEPLOY-staging.md` 1.0 §3 "Owner steps", §4) · **Slice:** DEP-1, stage S, after DEP-0 and after the owner's console steps · **Date:** 2026-10-14 · **Status:** DRAFT for the owner's spec sitting; the design is approved in `plan/DEPLOY-staging.md` 1.0 (L184) with its owner rulings (Q1/Q2 free start, Q3 (a), Q5 (a)) · **Coder:** api-coder (Sonnet 5.5) for the workflow and tests; the owner performs every console step; **agents never run `firebase deploy` or hold cloud credentials** (L184) · **Sources:**
> - `plan/DEPLOY-staging.md` §3 (the owner's four steps; the project, region, Blaze, budget rows), §4 (trigger and gate, steps, identity, production), §5 (E-20 as amended), §7 (unknowns);
> - `.github/workflows/build.yml` and `e2e.yml` (the fork guard `if:`, the PR-only e2e trigger), `tools/test/workflows.test.js` (workflows pinned as whole-text snapshots, action SHAs, plain ASCII; L138);
> - L136 (protected `main`: lint and e2e required, no bypass), L177 (the repository is public: no secret in it, no `pull_request_target`);
> - `google-github-actions/auth` documentation (Workload Identity Federation recommended over keys; checked 2026-10-14 for the plan);
> - `docs/ops/DEPLOYMENT_RUNBOOK.md`; the standard Stage 5 ("production deploy requires a named release authorization").

## What the product owner wants

After each merge, the admin page and the API appear on a private staging site the owner alone can sign in to, with no hand step (L184: "merge updates one by one"). Production is never touched by this.

DEP-1 delivers:

1. **Owner steps, in the owner's hands** (the spec lists them as a checklist with what to read back): the billing account check; the budget alert at USD 5 before any resource; the project "Gabay Staging", ID `gabay-staging` (or a suffixed ID if taken), Analytics off; Blaze with a card; the Cloud SQL instance through Firebase SQL Connect in `asia-southeast1` (the hourly price read from the console before confirming); the private bucket; sign-up switched off in Authentication; the first SUPERADMIN account through `staging:admin`.
2. **The workflow** `.github/workflows/deploy-staging.yml`, modelled on `build.yml`: runs after a push to `main` of this repository (the same three-part fork guard), waits for **lint and e2e green on the same commit** (e2e gains a `push: main` trigger; a check-runs lookup before any credential step), builds the admin page with the staging `API_BASE`, runs `db:deploy`, then `firebase deploy --only functions,hosting --project gabay-staging`; `concurrency: deploy-staging` without cancelling a running deploy; a repository variable `STAGING_DEPLOY=off` pauses it; `workflow_dispatch` with a commit for a rollback redeploy. Pinned as a whole-text snapshot in `tools/test/workflows.test.js`.
3. **Identity.** Workload Identity Federation, no key: a pool with an attribute condition on this repository and `refs/heads/main`; `permissions: id-token: write, contents: read`; a GitHub environment `staging`; a deploy service account that exists only in the staging project, with only the roles `firebase deploy` and Cloud SQL need (the list read from the docs at the slice's start, pasted in the spec).
4. **The staging check** (DEPLOY-staging §1: standard §6 items 1 to 6, 8 to 10, 12, item 7 reviewed for the backdrop upload, item 11 N/A) shown once in the slice report, with the first deploy's log, `GET /api/health` 200 from the function URL, a sign-in on `gabay-staging.web.app` by the owner, and a publish from the deployed admin page.
5. **Records.** `plan.html` row, the runbook's staging section completed, WORKING_AGREEMENT's standing-call line, CLAUDE.md's "no deploy" sentences as L184 amended them, and E-20's register row cross-checked.

## Out of scope

- The shopper app (never points at staging, Q5 (a)); production (separate project, named authorization); backups (off; throwaway data); a custom domain; a paging service.

## Product questions for the sitting

1. The project ID fallback if `gabay-staging` is taken (the spec proposes `gabay-staging-dq`).
2. Whether the e2e `push: main` run also gates `build.yml`'s artefacts or only the deploy (the spec recommends: only the deploy).
