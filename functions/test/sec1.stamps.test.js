'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-45, AC-46; plan/SEC-1.md 1.0 step 4): writes are stamped with the verified user, never a
// stub's user and never null; and the request context carries the actor, the tenant and the acting-as tenant into the
// services, after the multipart parser too. The rows are read back from the real tables (rolled back, L151).
// The context is observed where a service really is: inside the file store's put (the upload and publish services call
// it from inside their request), through a wrapper over the in-memory store.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, docs, fakeBuilder } = require('./mapApp');
const { memoryFileStore } = require('./memoryFileStore');
const { pngBytes } = require('./imageFixtures');
const { getActorId, getTenantId, getActingAsTenantId } = require('../src/utils/requestContext');

/** The in-memory store, recording the request context at every put. */
function contextRecordingStore() {
  const store = memoryFileStore();
  const seen = [];
  const put = store.put.bind(store);
  store.put = async (key, bytes) => {
    seen.push({ key, actor: getActorId(), tenant: getTenantId(), actingAs: getActingAsTenantId() });
    return put(key, bytes);
  };
  return { store, seen };
}

test('AC-46: Venue.CreatedBy and UpdatedBy, VenueMap.UpdatedBy, VenueMapBackdrop.CreatedBy, StoredFile.CreatedBy and VenueVersion.CreatedBy are the signed-in user', async () => {
  const { store } = contextRecordingStore();
  await withMapApp(
    async (ctx) => {
      const mall = ctx.users.MALL_ADMIN.userId;
      const editor = ctx.users.VENUE_EDITOR.userId;
      // route 4 (MALL_ADMIN) and route 6 (MALL_ADMIN)
      const made = await ctx.post('/api/venues', {
        code: `S${ctx.tag}`,
        name: 'Stamped',
        isActive: true,
      });
      assert.equal(made.status, 201);
      const edited = await ctx.put(`/api/venues/${made.body.id}`, {
        code: made.body.code,
        name: 'Stamped again',
        isActive: true,
        updatedAt: made.body.updatedAt,
      });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      const venueRow = await ctx.sql.one(
        'SELECT CreatedBy, UpdatedBy FROM gabay.Venue WHERE VenueId = $1',
        [made.body.id],
      );
      assert.deepEqual([venueRow.createdby, venueRow.updatedby], [mall, mall], 'routes 4 and 6');

      // routes 8 and 9 by a VENUE_EDITOR with a grant
      const venue = await ctx.mapVenue(ctx.tenantA, { grantTo: [editor] });
      const saved = await ctx.saveOk(venue, docs.small(), 0, ctx.as('VENUE_EDITOR'));
      assert.equal((await ctx.mapRow(venue)).updatedby, editor, 'route 8: VenueMap.UpdatedBy');
      const up = await ctx.upload(venue, pngBytes(100, 80), { headers: ctx.as('VENUE_EDITOR') });
      assert.equal(up.status, 201, JSON.stringify(up.body));
      const backdrop = await ctx.sql.one(
        `SELECT b.CreatedBy AS b, f.CreatedBy AS f FROM gabay.VenueMapBackdrop b JOIN gabay.StoredFile f ON f.FileId = b.FileId
          WHERE b.VenueId = $1`,
        [venue],
      );
      assert.deepEqual(
        [backdrop.b, backdrop.f],
        [editor, editor],
        'route 9: the backdrop and its file',
      );

      // route 12 by MALL_ADMIN, through the fake builder
      const published = await ctx.post(ctx.mapUrl(venue, '/publish'), {
        baseVersion: saved.draftVersion,
      });
      assert.equal(published.status, 200, JSON.stringify(published.body));
      const version = (await ctx.versions(venue)).at(-1);
      assert.equal(version.createdby, mall, 'route 12: VenueVersion.CreatedBy');
      assert.equal(version.publishedby, mall);
      for (const value of [venueRow.createdby, venueRow.updatedby, version.createdby]) {
        assert.notEqual(value, null, 'never null');
      }
    },
    { fileStore: store, mapBuilder: fakeBuilder() },
  );
});

test('AC-45, AC-10: a SUPERADMIN acting as tenant C uploads through route 9: the parser keeps the actor, the tenant and the acting-as tenant, and the rows carry the SUPERADMIN', async () => {
  const { store, seen } = contextRecordingStore();
  await withMapApp(
    async (ctx) => {
      const sa = ctx.users.SUPERADMIN.userId;
      const venueC = await ctx.mapVenue(ctx.tenantC);
      const up = await ctx.upload(venueC, pngBytes(100, 80), {
        headers: ctx.as('SUPERADMIN', ctx.tenantC),
      });
      assert.equal(up.status, 201, JSON.stringify(up.body));
      const atPut = seen.find((s) => s.key.startsWith(`backdrops/${ctx.tenantC.tenantId}/`));
      assert.deepEqual(
        { actor: atPut.actor, tenant: atPut.tenant, actingAs: atPut.actingAs },
        { actor: sa, tenant: ctx.tenantC.tenantId, actingAs: ctx.tenantC.tenantId },
        'after multer, inside the service: all three values',
      );
      const row = await ctx.sql.one(
        'SELECT CreatedBy, TenantId FROM gabay.VenueMapBackdrop WHERE VenueId = $1',
        [venueC],
      );
      assert.deepEqual([row.createdby, row.tenantid], [sa, ctx.tenantC.tenantId]);

      // an upload by a MALL_ADMIN in a tenant it holds is not an act-as
      const venueA = await ctx.mapVenue(ctx.tenantA);
      seen.length = 0;
      assert.equal((await ctx.upload(venueA, pngBytes(80, 60))).status, 201);
      assert.equal(seen[0].actingAs, null, 'MALL_ADMIN in its own tenant: no act-as');
      assert.equal(seen[0].actor, ctx.users.MALL_ADMIN.userId);
    },
    { fileStore: store },
  );
});
