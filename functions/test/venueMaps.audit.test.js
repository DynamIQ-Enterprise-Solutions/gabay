'use strict';

// SEC-2 / spec/SEC-2.md r2 AC-30 (plan/SEC-2.md 1.0 section 2, C1): this file replaces OA-2's AC-44 test (spec/OA-2.md r1
// AC-44, DC-19), which asserted that no write route left an AuditLog row because the audit middleware was R3's. R3 is
// SEC-2: after one save, publish, rollback, clear and upload the tenant's AuditLog holds exactly five new rows, each
// attributed to the signed-in user (SEC-1 deleted the stub) with the right method, status and, for the save, the Q16
// shape (body-free). The audit's own cases are in sec2.audit.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, docs } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');
const { auditRows } = require('./sec2Support');

test('AC-30: one save, publish, rollback, clear and upload write exactly five rows, each attributed to the signed-in user', async () => {
  await withMapApp(async (ctx) => {
    const tenant = ctx.tenantA.tenantId;
    const venue = await ctx.mapVenue();
    const before = (await auditRows(ctx, tenant)).length;

    assert.equal((await ctx.save(venue, docs.small(), 0)).status, 200);
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/publish'), { baseVersion: 1 })).status, 200);
    assert.equal(
      (await ctx.post(ctx.mapUrl(venue, '/rollback'), { version: 1, baseVersion: 1 })).status,
      200,
    );
    assert.equal((await ctx.post(ctx.mapUrl(venue, '/clear'), { baseVersion: 2 })).status, 200);
    assert.equal((await ctx.upload(venue, pngBytes(100, 100))).status, 201);

    const rows = (await auditRows(ctx, tenant)).slice(before);
    assert.equal(rows.length, 5, 'five new rows');
    assert.deepEqual(
      rows.map((r) => [r.method, r.route.replace(`/api/venues/${venue}/map`, ''), r.statuscode]),
      [
        ['PUT', '/draft', 200],
        ['POST', '/publish', 200],
        ['POST', '/rollback', 200],
        ['POST', '/clear', 200],
        ['POST', '/backdrops', 201],
      ],
    );
    for (const row of rows) {
      assert.equal(row.userid, ctx.user.userId, `${row.route}: the signed-in user`);
    }
    const payloads = rows.map((r) => JSON.parse(r.payloaddiff));
    assert.deepEqual(Object.keys(payloads[0]), [
      'venueId',
      'baseVersion',
      'draftVersion',
      'bytes',
      'sha256',
      'status',
    ]);
    assert.deepEqual(payloads[1].body, { baseVersion: 1 });
    assert.deepEqual(payloads[2].body, { version: 1, baseVersion: 1 });
    assert.deepEqual(payloads[3].body, { baseVersion: 2 });
    assert.deepEqual(
      Object.keys(payloads[4]),
      ['query', 'params', 'status'],
      'an upload has no body key',
    );
    for (const payload of payloads.slice(1)) {
      assert.deepEqual(payload.params, { venueId: String(venue) });
    }
  });
});
