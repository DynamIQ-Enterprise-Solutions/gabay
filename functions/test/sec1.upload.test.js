'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-47, EC-25; plan/SEC-1.md 1.0 step 4): a floor-plan upload (route 9) is guarded before its
// body is read. The order is the guard chain, then the venue scope and venueFirst, then the multipart parser. A spy wraps
// multer's single-file middleware (this file's process only: node --test runs each file in its own process, and the
// wrap is installed before the app's modules load), so "no multipart byte parsed" is the parser never being called.
// The file store is the in-memory one (its `puts` list every write).

const multerPath = require.resolve('multer');
const realMulter = require('multer');
const parserCalls = [];
function spyMulter(options) {
  const instance = realMulter(options);
  const single = instance.single.bind(instance);
  instance.single = (field) => {
    const parse = single(field);
    return (req, res, next) => {
      parserCalls.push(req.originalUrl);
      return parse(req, res, next);
    };
  };
  return instance;
}
Object.assign(spyMulter, realMulter);
require.cache[multerPath].exports = spyMulter;

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, uploadForm } = require('./mapApp');
const { assertRefused } = require('./venueApp');
const { pngBytes } = require('./imageFixtures');
const { MSG } = require('../src/middleware/tenantContext');

test("AC-47, EC-25: an upload by a VIEWER (403), with no token (401), for an ungranted venue (404) or in a tenant not held (403) parses no byte and writes nothing; a VENUE_EDITOR's is 201", async () => {
  await withMapApp(async (ctx) => {
    const editor = ctx.users.VENUE_EDITOR.userId;
    const granted = await ctx.mapVenue(ctx.tenantA, { grantTo: [editor, ctx.users.VIEWER.userId] });
    const ungranted = await ctx.mapVenue(ctx.tenantA);
    const upload = (venueId, headers) =>
      ctx.call('POST', ctx.mapUrl(venueId, '/backdrops'), {
        form: uploadForm(pngBytes(120, 90)),
        headers,
      });
    const puts = ctx.fileStore.puts.length;
    const rows = async () =>
      await ctx.sql.one(
        `SELECT (SELECT count(*) FROM gabay.VenueMapBackdrop WHERE TenantId = $1)::int AS backdrops,
                  (SELECT count(*) FROM gabay.StoredFile WHERE TenantId = $1)::int AS files`,
        [ctx.tenantA.tenantId],
      );
    const before = await rows();
    for (const [label, venueId, headers, status, message] of [
      ['a VIEWER', granted, ctx.as('VIEWER'), 403, MSG.forbidden],
      ['no token', granted, { authorization: null }, 401, 'Authentication required'],
      ['an ungranted venue (VENUE_EDITOR)', ungranted, ctx.as('VENUE_EDITOR'), 404, 'Not found'],
      ['a tenant not held', granted, ctx.as('VENUE_EDITOR', ctx.tenantC), 403, MSG.notHeld],
    ]) {
      const res = await upload(venueId, headers);
      assertRefused(res, status, null, label);
      assert.equal(res.body.error, message, label);
      assert.deepEqual(parserCalls, [], `${label}: the multipart parser never ran`);
    }
    assert.equal(ctx.fileStore.puts.length, puts, 'the file store is untouched');
    assert.deepEqual(await rows(), before, 'no backdrop or StoredFile row');

    const ok = await upload(granted, ctx.as('VENUE_EDITOR'));
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(parserCalls.length, 1, 'the parser ran once, for the allowed upload');
    assert.equal(ctx.fileStore.puts.length, puts + 1);
  });
});
