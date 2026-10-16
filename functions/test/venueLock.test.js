'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.4 "The venue lock", DC-7, G4): lockVenue(tenantId, venueId) is the one
// `FOR NO KEY UPDATE` lock on the venue row that every write below the venue takes first, inside its transaction.
// Why NO KEY: an insert under the venue takes FOR KEY SHARE on it through the FK, and FOR UPDATE would block every such
// insert. Two NO KEY UPDATE locks on one row still exclude each other, so writes serialise per venue.
//
// The plan proves the lock "by review and by api-coder's local check, not by a timing test" (section 2.5). This file adds
// the part a deterministic test can prove, with no concurrency: the statement lockVenue sends, and, through the real
// routes, that each write path sends it inside its transaction BEFORE it reads a rule's data or writes a row.
//
// CHANGED BY OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-17, AC-41, EC-20, EC-22): the level and
// building writes retired, so the second test now proves the order for every MAP write: a draft save (also a stale one),
// a clear, a publish claim and its finalize, a rollback claim and its finalize, and a backdrop upload. The first test is
// unchanged. (venueMaps.concurrency.test.js proves the same lock under two real connections.)

const test = require('node:test');
const assert = require('node:assert/strict');
const { lockVenue } = require('../src/services/venueLock');
const { withMapApp, docs } = require('./mapApp');
const { pngBytes } = require('./imageFixtures');

const LOCK = (s) => /gabay\.Venue\b/i.test(s.text) && /FOR\s+NO\s+KEY\s+UPDATE/i.test(s.text);
/** Any statement that reads or writes the map row or the version rows (the DraftVersion read included). */
const TOUCHES_MAP = /\bgabay\.(VenueMap|VenueVersion)\b/i;
/** A write to the backdrop rows or the file rows (the upload's insert, the prune's deletes). */
const WRITES_FILES =
  /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+gabay\.(VenueMapBackdrop|StoredFile)\b/i;

test('lockVenue: one SELECT ... FOR NO KEY UPDATE on the venue row, bound by tenant ($1) and venue ($2)', async () => {
  const sent = [];
  const tx = {
    query: async (text, params) => {
      sent.push({ text, params });
      return { rows: [{ venueid: 9 }], rowCount: 1 };
    },
  };
  await lockVenue(tx, 5, 9);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /^\s*SELECT\b/i);
  assert.match(sent[0].text, /\bFROM\s+gabay\.Venue\b/i);
  assert.match(sent[0].text, /TenantId\s*=\s*\$1/i);
  assert.match(sent[0].text, /VenueId\s*=\s*\$2/i);
  assert.match(sent[0].text, /FOR\s+NO\s+KEY\s+UPDATE\s*;?\s*$/i);
  assert.doesNotMatch(
    sent[0].text,
    /\bFOR\s+UPDATE\b/i,
    'FOR UPDATE would block every insert under the venue',
  );
  assert.deepEqual(sent[0].params, [5, 9]);
});

/**
 * Runs `action` with statements recorded and checks the order (AC-17): the lock is in a transaction, nothing that reads
 * or writes the map row, the version rows or the backdrop and file rows comes before it, and FOR UPDATE is never used.
 * `minLocks`: publish and rollback take the lock twice (the claim, then the finalize; plan section 5.2).
 */
async function assertLockedFirst(ctx, label, action, { status = 200, minLocks = 1 } = {}) {
  const log = ctx.record();
  const res = await action();
  ctx.hooks.onStatement = null;
  assert.equal(
    res.status,
    status,
    `${label}: ${res.status} ${JSON.stringify(res.body)?.slice(0, 400)}`,
  );
  const at = log.findIndex(LOCK);
  assert.ok(at >= 0, `${label}: no FOR NO KEY UPDATE on gabay.Venue was sent`);
  assert.equal(
    log[at].inTransaction,
    true,
    `${label}: the lock must be taken inside the transaction`,
  );
  const firstTouch = log.findIndex((s) => TOUCHES_MAP.test(s.text) || WRITES_FILES.test(s.text));
  assert.ok(firstTouch >= 0, `${label}: the write touched no map, version or file row`);
  assert.ok(
    firstTouch > at,
    `${label}: a statement on the map, version or file rows came before the lock: ${log[firstTouch].text.slice(0, 120)}`,
  );
  assert.ok(
    log.filter(LOCK).length >= minLocks,
    `${label}: expected at least ${minLocks} lock(s), saw ${log.filter(LOCK).length}`,
  );
  for (const s of log) {
    assert.doesNotMatch(
      s.text,
      /\bFOR\s+UPDATE\b/i,
      `${label}: FOR UPDATE blocks inserts under the venue`,
    );
  }
}

test('venue lock: every map write (save, clear, publish claim and finalize, rollback claim and finalize, upload) takes it first, before it reads DraftVersion, and FOR UPDATE is never used (AC-17, AC-41)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const url = (tail) => ctx.mapUrl(venue, tail);

    await assertLockedFirst(ctx, 'first save', () => ctx.save(venue, docs.small(), 0));
    await assertLockedFirst(ctx, 'second save', () => ctx.save(venue, docs.twoLevel(), 1));
    await assertLockedFirst(
      ctx,
      'a stale save still takes the lock before it reads the version',
      () => ctx.save(venue, docs.small(), 0),
      {
        status: 409,
      },
    );
    await assertLockedFirst(ctx, 'publish', () => ctx.post(url('/publish'), { baseVersion: 2 }), {
      minLocks: 2,
    });
    await assertLockedFirst(ctx, 'clear', () => ctx.post(url('/clear'), { baseVersion: 2 }));
    await assertLockedFirst(ctx, 'save after a clear', () => ctx.save(venue, docs.small(), 3));
    await assertLockedFirst(
      ctx,
      'rollback',
      () => ctx.post(url('/rollback'), { version: 1, baseVersion: 4 }),
      { minLocks: 2 },
    );
    await assertLockedFirst(ctx, 'upload', () => ctx.upload(venue, pngBytes(100, 80)), {
      status: 201,
    });
  });
});

// OA-3a (spec/OA-3.md r2 AC-12, EC-17; plan/OA-3a-migration-rekey.md 1.1 section 3): the save's key check reads the keyed
// rows twice: once before the transaction (so most refusals cost no lock), and again inside it, after lockVenue and before
// the VenueMap read (the version), as it does the backdrop keys (OA-2 DC-A6). A new case; the cases above are unchanged.
const KEYED_READ =
  /\bFROM\s+gabay\.(Occupant|StoreStatusChange|Beacon|BeaconPlan|Sentinel|Closure)\b/i;

test('venue lock (OA-3a AC-12): a draft save reads every keyed row again after the lock and before the VenueMap read', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    await ctx.sql.store(ctx.tenantA.tenantId, venue, 'some-unit');
    for (const [label, base] of [
      ['first save', 0],
      ['second save', 1],
    ]) {
      const log = ctx.record();
      const res = await ctx.save(venue, docs.small(), base);
      ctx.hooks.onStatement = null;
      assert.equal(res.status, 200, `${label}: ${JSON.stringify(res.body)?.slice(0, 300)}`);
      const lock = log.findIndex(LOCK);
      const before = log.slice(0, lock).filter((s) => KEYED_READ.test(s.text));
      assert.equal(before.length, 7, `${label}: the seven keyed reads before the lock`);
      assert.ok(
        before.every((s) => !s.inTransaction),
        `${label}: and outside the transaction`,
      );
      const mapRead = log.findIndex((s, i) => i > lock && /\bgabay\.VenueMap\b/i.test(s.text));
      const under = log.slice(lock + 1, mapRead).filter((s) => KEYED_READ.test(s.text));
      assert.equal(
        under.length,
        7,
        `${label}: the seven keyed reads between the lock and the VenueMap read`,
      );
      assert.ok(
        under.every((s) => s.inTransaction),
        `${label}: inside the transaction`,
      );
      for (const s of [...before, ...under]) {
        assert.match(s.text, /TenantId\s*=\s*\$1\s+AND\s+VenueId\s*=\s*\$2/i);
        assert.deepEqual(s.params, [ctx.tenantA.tenantId, venue]);
      }
    }
  });
});
