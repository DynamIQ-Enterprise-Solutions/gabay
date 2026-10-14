'use strict';

// OA-2 / spec/OA-2.md r1 AC-44, DC-19 (plan/OA-2-map-storage.md 1.0 section 8): under E-20 OA-2 writes no AuditLog row, as no FF
// route does yet: the audit middleware is R3's, and the ledger rows record Q16 for it (a body-free row for a draft save;
// publish, rollback and clear in full). The criterion is a review item; this test is the evidence the plan asks for: after one
// of each write route, the tenant's AuditLog count is unchanged. R3 will replace this test with its own (a row per write).

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, docs } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');

test("AC-44: after one of each write (save, publish, rollback, clear, upload) the tenant's AuditLog count is unchanged", async () => {
  await withMapApp(async (ctx) => {
    const { tenantA } = ctx;
    const venue = await ctx.mapVenue();
    const audits = async () => (await ctx.counts(venue, tenantA.tenantId)).audits;
    const total = async () =>
      Number(
        (
          await ctx.sql.one(
            `SELECT count(*) AS n FROM gabay.AuditLog WHERE TenantId = $1 OR ActingAsTenantId = $1`,
            [tenantA.tenantId],
          )
        ).n,
      );
    const before = [await audits(), await total()];

    assert.equal((await ctx.save(venue, docs.small(), 0)).status, 200);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    assert.equal((await ctx.save(venue, docs.twoLevel(), 1)).status, 200);
    assert.equal(
      (await ctx.post(ctx.mapUrl(venue, '/rollback'), { version: 1, baseVersion: 2 })).status,
      200,
    );
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/clear'), { baseVersion: 3 })).status, 200);
    assert.equal((await ctx.upload(venue, pngBytes(100, 100))).status, 201);

    assert.deepEqual(
      [await audits(), await total()],
      before,
      'no AuditLog row was written (R3 owns the audit middleware)',
    );
  });
});
