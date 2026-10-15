// SEC-2 step 2: the audit trail through the real app (spec/SEC-2.md r2 AC-9 (the no-audit half), AC-17 to AC-25; EC-4, EC-11,
// EC-12, EC-13, EC-16, EC-17, EC-19, EC-19a, EC-20, EC-22, EC-25 to EC-27, EC-31). Real HTTP over the rolled-back savepoint
// connection; a row is found by the request id the test chose (X-Request-Id), and every response waits for the trail's
// settled() (venueApp.js), so a write never lands inside a later savepoint.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { testConfig, fakeLogger } = require('./helpers');
const { bodies } = require('./venueApp');
const { withMapApp, docs } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');
const { waitFor, abortAfterStall, abortAnonymous, VENUE_READ, MAP_READ } = require('./sec2Support');
const { createAuditTrail } = require('../src/middleware/auditTrail');
const { constant } = require('../src/config/venueMapSchema');

let counter = 0;
/** A request id the test chooses, so the request's row can be found. */
const rid = (tag) => {
  counter += 1;
  return `sec2-${tag}-${counter}-${crypto.randomBytes(3).toString('hex')}`;
};

/** The row of the request with this id (undefined when none), after the trail has settled. */
async function rowFor(ctx, id) {
  await ctx.auditTrail.settled();
  return ctx.sql.one(`SELECT * FROM gabay.AuditLog WHERE RequestId = $1`, [id.slice(0, 40)]);
}

const payloadOf = (row) => JSON.parse(row.payloaddiff);
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

test('AC-17: GET, HEAD and OPTIONS write no row; POST, PUT and DELETE each write one', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId);
    const none = [
      ['GET', rid('get')],
      ['HEAD', rid('head')],
    ];
    for (const [method, id] of none) {
      await ctx.call(method, '/api/venues', { headers: { 'x-request-id': id } });
      assert.equal(await rowFor(ctx, id), undefined, `${method} writes no row`);
    }
    const preflight = rid('options');
    const res = await ctx.call('OPTIONS', '/api/venues', {
      headers: {
        origin: 'http://localhost:5000',
        'access-control-request-method': 'POST',
        'x-request-id': preflight,
      },
    });
    assert.ok(res.status < 300);
    assert.equal(await rowFor(ctx, preflight), undefined, 'OPTIONS writes no row');

    const post = rid('post');
    assert.equal(
      (
        await ctx.call('POST', '/api/venues', {
          body: bodies(ctx).venue(),
          headers: { 'x-request-id': post },
        })
      ).status,
      201,
    );
    const current = (await ctx.get(`/api/venues/${venue}`)).body;
    const put = rid('put');
    assert.equal(
      (
        await ctx.call('PUT', `/api/venues/${venue}`, {
          body: {
            code: current.code,
            name: 'Renamed',
            isActive: true,
            updatedAt: current.updatedAt,
          },
          headers: { 'x-request-id': put },
        })
      ).status,
      200,
    );
    const del = rid('delete');
    assert.equal(
      (await ctx.call('DELETE', `/api/venues/${venue}`, { headers: { 'x-request-id': del } }))
        .status,
      404,
      'no route deletes a venue (B4); an authenticated 404 is audited (AC-23)',
    );
    for (const [method, id] of [
      ['POST', post],
      ['PUT', put],
      ['DELETE', del],
    ]) {
      const row = await rowFor(ctx, id);
      assert.ok(row, `${method} writes a row`);
      assert.equal(row.method, method);
    }
  });
});

test('AC-18, EC-12: the row of a signed-in write, column by column', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('cols');
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 201);
    const row = await rowFor(ctx, id);
    assert.equal(row.tenantid, ctx.tenantA.tenantId);
    assert.equal(row.userid, ctx.user.userId);
    assert.equal(row.actingastenantid, null);
    assert.equal(row.ipaddress, '127.0.0.1');
    assert.equal(row.method, 'POST');
    assert.equal(row.route, '/api/venues');
    assert.equal(row.statuscode, 201);
    assert.equal(row.requestid, res.headers.get('x-request-id'));
    assert.equal(row.entityname, null);
    assert.equal(row.entityid, null);
    assert.ok(row.createdat instanceof Date);
  });
});

test('EC-12: a tenantId in the body or the query changes nothing in the row (rule 2)', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('tenantbody');
    const res = await ctx.call('POST', `/api/venues?tenantId=${ctx.tenantB.tenantId}`, {
      body: { ...bodies(ctx).venue(), tenantId: ctx.tenantB.tenantId },
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 400, 'the venue service refuses a different echoed tenantId (AC-40)');
    const row = await rowFor(ctx, id);
    assert.equal(row.tenantid, ctx.tenantA.tenantId);
    assert.equal(
      payloadOf(row).body.tenantId,
      ctx.tenantB.tenantId,
      'it is only a value in the payload',
    );
  });
});

test("AC-18, EC-17: a VIEWER's refused publish is audited under the VIEWER's id, and a VENUE_EDITOR's refused publish too", async () => {
  await withMapApp(async (ctx) => {
    const { VIEWER, VENUE_EDITOR } = ctx.users;
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId, {
      grantTo: [VIEWER.userId, VENUE_EDITOR.userId],
    });
    for (const [role, who] of [
      ['VIEWER', VIEWER],
      ['VENUE_EDITOR', VENUE_EDITOR],
    ]) {
      const id = rid(`publish-${role}`);
      const res = await ctx.call('POST', `/api/venues/${venue}/map/publish`, {
        body: { baseVersion: 0 },
        headers: { ...ctx.as(role), 'x-request-id': id },
      });
      assert.equal(res.status, 403, role);
      const row = await rowFor(ctx, id);
      assert.equal(row.statuscode, 403, role);
      assert.equal(row.userid, who.userId, `${role}: the refused user's id`);
      assert.equal(row.tenantid, ctx.tenantA.tenantId, role);
      assert.equal(row.route, `/api/venues/${venue}/map/publish`);
    }
  });
});

test("AC-18, EC-17: a VENUE_EDITOR's clear is allowed and audited in full", async () => {
  await withMapApp(async (ctx) => {
    const { VENUE_EDITOR } = ctx.users;
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId, { grantTo: [VENUE_EDITOR.userId] });
    const id = rid('editor-clear');
    const res = await ctx.call('POST', `/api/venues/${venue}/map/clear`, {
      body: { baseVersion: 0 },
      headers: { ...ctx.as('VENUE_EDITOR'), 'x-request-id': id },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const row = await rowFor(ctx, id);
    assert.equal(row.userid, VENUE_EDITOR.userId);
    assert.equal(row.statuscode, 200);
    assert.deepEqual(payloadOf(row), {
      body: { baseVersion: 0 },
      query: {},
      params: { venueId: String(venue) },
      status: 200,
    });
  });
});

test('AC-18: an anonymous POST that fails the token check is audited with no user and no tenant', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('anon401');
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { authorization: null, 'x-request-id': id },
    });
    assert.equal(res.status, 401);
    const row = await rowFor(ctx, id);
    assert.equal(row.statuscode, 401);
    assert.equal(
      row.userid,
      null,
      'a failed check is never stamped with the identity it guessed at',
    );
    assert.equal(row.tenantid, null);
    // A bad token that names a real user's token is the same.
    const id2 = rid('badtoken');
    await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { authorization: 'Bearer nonsense', 'x-request-id': id2 },
    });
    const row2 = await rowFor(ctx, id2);
    assert.equal(row2.userid, null);
    assert.equal(row2.statuscode, 401);
  });
});

test('AC-18, EC-13: a SUPERADMIN acting as a tenant it holds no role in: TenantId is that tenant and ActingAsTenantId is set', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('act-as');
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { ...ctx.as('SUPERADMIN', ctx.tenantC), 'x-request-id': id },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const row = await rowFor(ctx, id);
    assert.equal(row.tenantid, ctx.tenantC.tenantId);
    assert.equal(row.actingastenantid, ctx.tenantC.tenantId);
    assert.equal(row.userid, ctx.users.SUPERADMIN.userId);
    // An ordinary admin in its own tenant has none.
    const own = rid('own-tenant');
    await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { 'x-request-id': own },
    });
    assert.equal((await rowFor(ctx, own)).actingastenantid, null);
  });
});

test("AC-18, EC-19: a write with no X-Tenant-Id is a 400 for every role: TenantId NULL, the user's id set", async () => {
  await withMapApp(async (ctx) => {
    for (const role of ['MALL_ADMIN', 'SUPERADMIN']) {
      const id = rid(`notenant-${role}`);
      const res = await ctx.call('POST', '/api/venues', {
        body: bodies(ctx).venue(),
        headers: {
          authorization: `Bearer ${ctx.users[role].token}`,
          'x-tenant-id': null,
          'x-request-id': id,
        },
      });
      assert.equal(res.status, 400, role);
      const row = await rowFor(ctx, id);
      assert.equal(row.tenantid, null, role);
      assert.equal(row.userid, ctx.users[role].userId, role);
      assert.equal(row.statuscode, 400);
    }
  });
});

test('AC-18, EC-19a: an inactive tenant is a 403 for a MALL_ADMIN (TenantId NULL); a SUPERADMIN proceeds, audited acting-as', async () => {
  await withMapApp(async (ctx) => {
    const inactive = await ctx.seed.tenant('OFF', { isActive: false });
    const mall = ctx.users.MALL_ADMIN;
    await ctx.seed.userRole(mall.userId, mall.roleId, inactive.tenantId);
    ctx.accessCache.invalidate(mall.userId);
    const refused = rid('inactive');
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { ...ctx.as('MALL_ADMIN', inactive), 'x-request-id': refused },
    });
    assert.equal(res.status, 403);
    const row = await rowFor(ctx, refused);
    assert.equal(row.tenantid, null, 'tenantContext refused it, so there is no tenant');
    assert.equal(row.userid, mall.userId);

    const proceeds = rid('inactive-super');
    const ok = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { ...ctx.as('SUPERADMIN', inactive), 'x-request-id': proceeds },
    });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const superRow = await rowFor(ctx, proceeds);
    assert.equal(superRow.tenantid, inactive.tenantId);
    assert.equal(superRow.actingastenantid, inactive.tenantId);
  });
});

test('AC-18, EC-31: a 60-character X-Request-Id is kept by the middleware and cut to 40 in the row', async () => {
  await withMapApp(async (ctx) => {
    const long = 'r'.repeat(60);
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { 'x-request-id': long },
    });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('x-request-id'), long);
    const row = await rowFor(ctx, long);
    assert.equal(row.requestid, 'r'.repeat(40));
  });
});

test("EC-16: every role's writes are audited with its own id, whatever the answer", async () => {
  await withMapApp(async (ctx) => {
    const expected = { SUPERADMIN: 201, MALL_ADMIN: 201, VENUE_EDITOR: 403, VIEWER: 403 };
    for (const [role, status] of Object.entries(expected)) {
      const id = rid(`role-${role}`);
      const res = await ctx.call('POST', '/api/venues', {
        body: bodies(ctx).venue(),
        headers: { ...ctx.as(role), 'x-request-id': id },
      });
      assert.equal(res.status, status, role);
      const row = await rowFor(ctx, id);
      assert.equal(row.userid, ctx.users[role].userId, role);
      assert.equal(row.statuscode, status, role);
    }
  });
});

test('AC-19: the payload is { body, query, params, status }; params are what the matched route saw', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId);
    const current = (await ctx.get(`/api/venues/${venue}`)).body;
    const id = rid('payload');
    const edit = {
      code: current.code,
      name: 'Payload venue',
      isActive: true,
      updatedAt: current.updatedAt,
    };
    const res = await ctx.call('PUT', `/api/venues/${venue}?note=1`, {
      body: edit,
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 200);
    const row = await rowFor(ctx, id);
    assert.equal(row.route, `/api/venues/${venue}`, 'no query string in Route');
    const payload = payloadOf(row);
    assert.deepEqual(Object.keys(payload), ['body', 'query', 'params', 'status']);
    assert.deepEqual(payload.body, edit);
    assert.deepEqual(payload.query, { note: '1' });
    assert.deepEqual(payload.params, { venueId: String(venue) });
    assert.equal(payload.status, 200);
  });
});

test('AC-19, EC-4: a request with no body has no body key', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('nobody');
    const res = await ctx.call('POST', '/api/venues', { headers: { 'x-request-id': id } });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'The request body must be a JSON object' });
    const payload = payloadOf(await rowFor(ctx, id));
    assert.deepEqual(Object.keys(payload), ['query', 'params', 'status']);
    assert.equal(payload.status, 400);
  });
});

test('AC-19: a 6 KB write is stored in at most 4,000 characters and ends with the marker', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('big');
    const res = await ctx.call('POST', '/api/venues', {
      body: { ...bodies(ctx).venue(), name: 'n'.repeat(6000) },
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 400);
    const row = await rowFor(ctx, id);
    assert.ok(row.payloaddiff.length <= 4000);
    assert.ok(row.payloaddiff.endsWith('...[TRUNCATED]'));
  });
});

test('AC-20: secrets and a ?token= value are redacted, flags and ordinary query values are not, and Route has no query', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('redact');
    const res = await ctx.call('POST', '/api/venues?token=abc&search=mall', {
      body: {
        ...bodies(ctx).venue(),
        password: 'hunter2',
        newPassword: 'hunter3',
        changePassword: true,
        creds: { apiKey: 'k-123' },
      },
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const row = await rowFor(ctx, id);
    assert.equal(row.route, '/api/venues');
    const payload = payloadOf(row);
    assert.equal(payload.body.password, '[REDACTED]');
    assert.equal(payload.body.newPassword, '[REDACTED]');
    assert.equal(payload.body.changePassword, true);
    assert.deepEqual(payload.body.creds, { apiKey: '[REDACTED]' });
    assert.deepEqual(payload.query, { token: '[REDACTED]', search: 'mall' });
    for (const leaked of ['hunter2', 'hunter3', 'k-123', 'abc']) {
      assert.equal(row.payloaddiff.includes(leaked), false, leaked);
    }
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-21

test('AC-21: a draft save is body-free: { venueId, baseVersion, draftVersion, bytes, sha256, status }', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const layout = {
      ...docs.small(),
      pad: 'RECOGNISABLE-NAME-XYZ',
      password: 'hunter2-in-a-layout',
    };
    const id = rid('save');
    const res = await ctx.save(venue, layout, 0, { 'x-request-id': id });
    assert.equal(res.status, 200, JSON.stringify(res.body)?.slice(0, 300));
    const row = await rowFor(ctx, id);
    const text = JSON.stringify(layout);
    assert.deepEqual(payloadOf(row), {
      venueId: venue,
      baseVersion: 0,
      draftVersion: res.body.draftVersion,
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: sha256(text),
      status: 200,
    });
    assert.deepEqual(Object.keys(payloadOf(row)), [
      'venueId',
      'baseVersion',
      'draftVersion',
      'bytes',
      'sha256',
      'status',
    ]);
    assert.equal(row.payloaddiff.includes('RECOGNISABLE-NAME-XYZ'), false);
    assert.equal(row.payloaddiff.includes('hunter2'), false);
    assert.equal(row.payloaddiff.includes('levels'), false, 'no part of the layout');
    assert.ok(row.payloaddiff.length < 400);
  });
});

test('AC-21: a refused save gets the same body-free row: 400 problems, 409 stale, 400 no layout', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const secret = { pad: 'RECOGNISABLE-NAME-XYZ', password: 'hunter2' };

    const bad = rid('problems');
    const problems = await ctx.save(venue, { ...secret, levels: 'not a document' }, 0, {
      'x-request-id': bad,
    });
    assert.equal(problems.status, 400);
    const badRow = await rowFor(ctx, bad);
    const badPayload = payloadOf(badRow);
    assert.deepEqual(Object.keys(badPayload), [
      'venueId',
      'baseVersion',
      'bytes',
      'sha256',
      'status',
    ]);
    assert.equal(badPayload.status, 400);
    assert.equal(badPayload.draftVersion, undefined, 'a refused save has no draftVersion');
    assert.equal(badRow.payloaddiff.includes('RECOGNISABLE'), false);

    assert.equal((await ctx.save(venue, docs.small(), 0)).status, 200);
    const stale = rid('stale');
    const res = await ctx.save(venue, { ...docs.small(), ...secret }, 0, { 'x-request-id': stale });
    assert.equal(res.status, 409);
    const staleRow = await rowFor(ctx, stale);
    assert.deepEqual(Object.keys(payloadOf(staleRow)), [
      'venueId',
      'baseVersion',
      'bytes',
      'sha256',
      'status',
    ]);
    assert.equal(payloadOf(staleRow).status, 409);
    assert.equal(staleRow.payloaddiff.includes('hunter2'), false);

    const none = rid('nolayout');
    const noLayout = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), {
      body: { baseVersion: 1 },
      headers: { 'x-request-id': none },
    });
    assert.equal(noLayout.status, 400);
    assert.deepEqual(Object.keys(payloadOf(await rowFor(ctx, none))), [
      'venueId',
      'baseVersion',
      'status',
    ]);
  });
});

test("AC-21: a VIEWER's 403 and an anonymous 401 on the draft route are body-free too (matched at the slot)", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.sql.venue(ctx.tenantA.tenantId, { grantTo: [ctx.users.VIEWER.userId] });
    const layout = { ...docs.small(), pad: 'RECOGNISABLE-NAME-XYZ', password: 'hunter2' };
    const viewer = rid('viewer-save');
    const res = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), {
      body: { layout, baseVersion: 0 },
      headers: { ...ctx.as('VIEWER'), 'x-request-id': viewer },
    });
    assert.equal(res.status, 403);
    const row = await rowFor(ctx, viewer);
    assert.equal(row.userid, ctx.users.VIEWER.userId);
    assert.equal(row.payloaddiff.includes('RECOGNISABLE'), false);
    assert.equal(payloadOf(row).status, 403);
    assert.equal(payloadOf(row).bytes, Buffer.byteLength(JSON.stringify(layout)));

    const anon = rid('anon-save');
    const refused = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), {
      body: { layout, baseVersion: 0 },
      headers: { authorization: null, 'x-request-id': anon },
    });
    assert.equal(refused.status, 401);
    const anonRow = await rowFor(ctx, anon);
    assert.equal(anonRow.userid, null);
    assert.equal(anonRow.payloaddiff.includes('RECOGNISABLE'), false);
    assert.equal(payloadOf(anonRow).sha256, sha256(JSON.stringify(layout)));
  });
});

test('AC-21: the path is matched as Express matches it: a trailing slash and another letter case are body-free too', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const layout = { ...docs.small(), pad: 'RECOGNISABLE-NAME-XYZ' };
    for (const tail of ['/draft/', '/DRAFT']) {
      const id = rid('variant');
      const res = await ctx.call('PUT', `/api/venues/${venue}/map${tail}`, {
        body: { layout, baseVersion: 0 },
        headers: { 'x-request-id': id },
      });
      const row = await rowFor(ctx, id);
      assert.ok(row, tail);
      assert.equal(row.payloaddiff.includes('RECOGNISABLE'), false, `${tail}: ${res.status}`);
    }
  });
});

test('AC-21: a layout of MAX_MAP_BYTES gives a row that is small', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const layout = docs.padTo(docs.small(), constant('MAX_MAP_BYTES'));
    const id = rid('max');
    const res = await ctx.save(venue, layout, 0, { 'x-request-id': id });
    assert.ok(res.status === 200 || res.status === 400, `status ${res.status}`);
    const row = await rowFor(ctx, id);
    assert.ok(row.payloaddiff.length < 400, `row ${row.payloaddiff.length} characters`);
    assert.equal(payloadOf(row).bytes, constant('MAX_MAP_BYTES'));
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-22

test('AC-22, EC-27: a publish answering 501 (no builder yet) is audited with 501', async () => {
  await withMapApp(
    async (ctx) => {
      const venue = await ctx.mapVenue();
      assert.equal((await ctx.save(venue, docs.small(), 0)).status, 200);
      const id = rid('publish501');
      const res = await ctx.call('POST', ctx.mapUrl(venue, '/publish'), {
        body: { baseVersion: 1 },
        headers: { 'x-request-id': id },
      });
      assert.equal(res.status, 501);
      const row = await rowFor(ctx, id);
      assert.equal(row.statuscode, 501);
      assert.deepEqual(payloadOf(row), {
        body: { baseVersion: 1 },
        query: {},
        params: { venueId: String(venue) },
        status: 501,
      });
    },
    { mapBuilder: null },
  );
});

test("AC-22, EC-4: an upload's row holds no bytes, no file name and no multipart text", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const id = rid('upload');
    const res = await ctx.upload(venue, pngBytes(100, 100), {
      name: 'RECOGNISABLE-FILE-NAME.png',
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 201);
    const row = await rowFor(ctx, id);
    const payload = payloadOf(row);
    assert.deepEqual(Object.keys(payload), ['query', 'params', 'status']);
    assert.deepEqual(payload.params, { venueId: String(venue) });
    assert.equal(row.payloaddiff.includes('RECOGNISABLE'), false);
    assert.equal(row.payloaddiff.includes('PNG'), false);
    assert.equal(row.statuscode, 201);
  });
});

test('AC-22: an upload with no bytes is refused 400 and audited with 400', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const id = rid('upload-empty');
    const res = await ctx.call('POST', ctx.mapUrl(venue, '/backdrops'), {
      form: new FormData(),
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 400);
    const row = await rowFor(ctx, id);
    assert.equal(row.statuscode, 400);
  });
});

test('EC-22: two saves on one base: one 200 and one 409, each audited with its own status', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const first = rid('race-a');
    const second = rid('race-b');
    assert.equal((await ctx.save(venue, docs.small(), 0, { 'x-request-id': first })).status, 200);
    assert.equal(
      (await ctx.save(venue, docs.twoLevel(), 0, { 'x-request-id': second })).status,
      409,
    );
    assert.equal((await rowFor(ctx, first)).statuscode, 200);
    assert.equal((await rowFor(ctx, second)).statuscode, 409);
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-23

test('AC-23: an anonymous 404 writes no row; an authenticated 404 does', async () => {
  await withMapApp(async (ctx) => {
    const anon = rid('anon404');
    const res = await ctx.call('POST', '/api/does-not-exist', {
      body: {},
      headers: { authorization: null, 'x-tenant-id': null, 'x-request-id': anon },
    });
    assert.equal(res.status, 404);
    assert.equal(await rowFor(ctx, anon), undefined);

    const known = rid('auth404');
    const refused = await ctx.call('POST', '/api/venues/1/nothing-here', {
      body: {},
      headers: { 'x-request-id': known },
    });
    assert.equal(refused.status, 404);
    const row = await rowFor(ctx, known);
    assert.equal(row.statuscode, 404);
    assert.equal(row.userid, ctx.user.userId);
  });
});

test('EC-11: a route path over 400 characters is cut in Route', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('longpath');
    const res = await ctx.call('POST', `/api/venues/1/${'a'.repeat(800)}`, {
      body: {},
      headers: { 'x-request-id': id },
    });
    assert.equal(res.status, 404);
    const row = await rowFor(ctx, id);
    assert.equal(row.route.length, 400);
    assert.ok(row.route.startsWith('/api/venues/1/aaaa'));
  });
});

test('AC-23, AC-9: a request answered 429 writes no row (and the ones before it did)', async () => {
  await withMapApp(
    async (ctx) => {
      const ids = [rid('lim-1'), rid('lim-2'), rid('lim-3')];
      const statuses = [];
      for (const id of ids) {
        const res = await ctx.call('POST', '/api/venues', {
          body: bodies(ctx).venue(),
          headers: { 'x-request-id': id },
        });
        statuses.push(res.status);
      }
      assert.deepEqual(statuses, [201, 201, 429]);
      assert.ok(await rowFor(ctx, ids[0]));
      assert.ok(await rowFor(ctx, ids[1]));
      assert.equal(await rowFor(ctx, ids[2]), undefined, 'the limited request left no row');
    },
    { config: testConfig({ RATE_LIMIT_PER_MIN: '2' }) },
  );
});

test('AC-23, EC-5: malformed JSON and a body over the limit never reach the audit slot: no row', async () => {
  await withMapApp(
    async (ctx) => {
      const bad = rid('malformed');
      const res = await ctx.call('POST', '/api/venues', {
        rawBody: '{"code": ',
        headers: { 'x-request-id': bad },
      });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'Malformed JSON body' });
      assert.equal(await rowFor(ctx, bad), undefined);

      const big = rid('toolarge');
      const large = await ctx.call('POST', '/api/venues', {
        body: { name: 'x'.repeat(4096) },
        headers: { 'x-request-id': big },
      });
      assert.equal(large.status, 413);
      assert.equal(await rowFor(ctx, big), undefined);
    },
    { config: testConfig({ MAX_JSON_BODY: '1kb' }) },
  );
});

// ------------------------------------------------------------------------------------------------------------ AC-24

test('AC-24: a rejected audit insert is logged once through req.log with the request id, and changes nothing the client saw', async () => {
  const logger = fakeLogger();
  const failing = createAuditTrail({
    db: {
      query: async () => {
        throw new Error('value too long for type character varying(40)');
      },
    },
    logger,
  });
  await withMapApp(
    async (ctx) => {
      const id = rid('rejected');
      const res = await ctx.call('POST', '/api/venues', {
        body: bodies(ctx).venue(),
        headers: { 'x-request-id': id },
      });
      assert.equal(res.status, 201, 'the client saw the write succeed');
      assert.equal(JSON.stringify(res.body).includes('too long'), false);
      const logged = ctx.logger.calls.error.filter((c) =>
        /audit log insert failed/.test(String(c[1])),
      );
      assert.equal(logged.length, 1, 'logged once');
      assert.equal(logged[0][0].reqId, id, 'with the request id');
      // A later request is unaffected.
      assert.equal((await ctx.get('/api/venues')).status, 200);
      assert.equal(
        (await ctx.post('/api/venues', bodies(ctx).venue())).status,
        201,
        'a later write is unaffected',
      );
    },
    { auditTrail: failing },
  );
});

test('AC-24: an audit insert that never settles delays neither its response nor any later request', async () => {
  const real = createAuditTrail({
    db: { query: () => new Promise(() => {}) },
    logger: fakeLogger(),
  });
  // The harness waits on settled() after each response; this trail's never resolves by design, so it gets none.
  const hung = {
    middleware: real.middleware,
    declareBodyFree: real.declareBodyFree,
    settled: async () => {},
  };
  await withMapApp(
    async (ctx) => {
      for (let i = 0; i < 3; i += 1) {
        const res = await ctx.post('/api/venues', bodies(ctx).venue());
        assert.equal(res.status, 201, `request ${i}`);
      }
      assert.equal((await ctx.get('/api/venues')).status, 200);
    },
    { auditTrail: hung },
  );
});

// ------------------------------------------------------------------------------------------------------------ AC-25

test('AC-25, EC-26: an aborted signed-in write writes one row on close with status 499, once', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const id = rid('abort');
    await abortAfterStall(ctx, {
      method: 'POST',
      path: ctx.mapUrl(venue, '/clear'),
      body: { baseVersion: 0 },
      headers: { 'x-request-id': id },
      stall: VENUE_READ,
      tail: MAP_READ,
    });
    await waitFor(async () => (await rowFor(ctx, id)) !== undefined, { what: 'the 499 row' });
    const rows = await ctx.sql.rows(`SELECT * FROM gabay.AuditLog WHERE RequestId = $1`, [
      id.slice(0, 40),
    ]);
    assert.equal(rows.length, 1, 'one row, never both finish and close');
    const row = rows[0];
    assert.equal(row.statuscode, 499);
    assert.equal(row.userid, ctx.user.userId);
    assert.equal(row.tenantid, ctx.tenantA.tenantId);
    assert.equal(row.method, 'POST');
    assert.deepEqual(payloadOf(row), {
      body: { baseVersion: 0 },
      query: {},
      params: { venueId: String(venue) },
      status: 499,
    });
  });
});

test('AC-25: an aborted request that never signed in writes no row', async () => {
  await withMapApp(async (ctx) => {
    const id = await abortAnonymous(ctx);
    assert.ok(
      ctx.verifier.seen.includes('slow-anonymous'),
      'the abort happened inside the token check',
    );
    assert.equal(await rowFor(ctx, id), undefined);
  });
});

test('EC-29: a __proto__ or constructor key in a venue body is a plain key in the row and pollutes nothing', async () => {
  await withMapApp(async (ctx) => {
    const id = rid('proto');
    const valid = bodies(ctx).venue();
    const rawBody = JSON.stringify(valid).replace(
      '{',
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},',
    );
    const res = await ctx.call('POST', '/api/venues', { rawBody, headers: { 'x-request-id': id } });
    assert.equal(res.status, 201, res.text);
    assert.equal({}.polluted, undefined);
    assert.equal({}.polluted2, undefined);
    const row = await rowFor(ctx, id);
    const payload = JSON.parse(row.payloaddiff);
    assert.deepEqual(Object.keys(payload.body).slice(0, 2), ['__proto__', 'constructor']);
    assert.equal(row.statuscode, 201);
  });
});
