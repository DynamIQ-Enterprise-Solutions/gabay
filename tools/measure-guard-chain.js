#!/usr/bin/env node
// SEC-1's measurement (spec/SEC-1.md r2 AC-56: recorded, not gated; plan/SEC-1.md 1.0 step 7): what the guard chain
// costs. A VIEWER (venue-scoped, so every step runs: auth, tenantContext, the role guard, the permission guard, the venue
// scope) sends GET /api/venues through createApp on this machine, 20 times with a cold access cache (invalidated before
// each request) and 20 times with a warm one. It prints the median and p95 of the whole request (fetch to body), and the
// number of SQL statements sent before the handler's first statement on gabay.Venue, cold and warm. No target exists
// (PRD section 7 leaves peak load to the pilot), so nothing passes or fails; the figures are pasted into the PR.
//
//   npm run measure:guard-chain        on this working copy's database
//
// Nothing is kept: the real app runs over the API tests' rolled-back connection (functions/test/venueApp.js; L151), with
// invented tenants, users and venues. One unmeasured request comes first, so the first measured one is not paying for
// code loading.
'use strict';

const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');

const ROOT = path.resolve(__dirname, '..');
// The API tests' helpers set NODE_ENV=test and load the root .env.
const { withVenueApp } = require(path.join(ROOT, 'functions', 'test', 'venueApp.js'));

const RUNS = 20;
const VENUES = 10; // the VIEWER is granted half of them

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
const median = (sorted) =>
  sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

/** One request, timed, with the statements it sent before the handler's first venue statement. */
async function once(ctx, headers) {
  const log = ctx.record();
  const started = performance.now();
  const res = await ctx.get('/api/venues', headers);
  const ms = performance.now() - started;
  ctx.hooks.onStatement = null;
  if (res.status !== 200)
    throw new Error(`GET /api/venues answered ${res.status}: ${JSON.stringify(res.body)}`);
  const handlerAt = log.findIndex((s) => /\bgabay\.Venue\b/i.test(s.text));
  return { ms, before: handlerAt === -1 ? log.length : handlerAt };
}

function summary(label, runs) {
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
  const before = [...new Set(runs.map((r) => r.before))].join(', ');
  return `${label.padEnd(5)}  median ${median(ms).toFixed(2)} ms  p95 ${percentile(ms, 0.95).toFixed(2)} ms  statements before the handler: ${before}`;
}

async function main() {
  await withVenueApp(async (ctx) => {
    const viewer = ctx.users.VIEWER.userId;
    for (let i = 0; i < VENUES; i += 1) {
      await ctx.sql.venue(ctx.tenantA.tenantId, { grantTo: i % 2 === 0 ? [viewer] : [] });
    }
    const headers = ctx.as('VIEWER');
    await once(ctx, headers); // warm-up, not measured

    const cold = [];
    for (let i = 0; i < RUNS; i += 1) {
      ctx.accessCache.invalidateAll();
      cold.push(await once(ctx, headers));
    }
    const warm = [];
    await once(ctx, headers); // fills the cache
    for (let i = 0; i < RUNS; i += 1) warm.push(await once(ctx, headers));

    console.log(
      `SEC-1 AC-56: GET /api/venues as a VIEWER (venue-scoped), ${RUNS} runs each, ${VENUES} venues (half granted)`,
    );
    console.log(
      `Node ${process.versions.node}, ${os.cpus()[0]?.model ?? 'unknown CPU'}, ${os.platform()}`,
    );
    console.log(summary('cold', cold));
    console.log(summary('warm', warm));
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
