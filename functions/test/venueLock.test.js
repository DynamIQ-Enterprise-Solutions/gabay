'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.4 "The venue lock", DC-7, G4): lockVenue(tx, tenantId, venueId) is the one
// `FOR NO KEY UPDATE` lock on the venue row that every level write and both deletes take first, inside their transaction.
// Why NO KEY: an insert under the venue takes FOR KEY SHARE on it through the FK, and FOR UPDATE would block every such
// insert. Two NO KEY UPDATE locks on one row still exclude each other, so level writes serialise per venue.
//
// The plan proves the lock "by review and by api-coder's local check, not by a timing test" (section 2.5). This file adds
// the part a deterministic test can prove, with no concurrency: the statement lockVenue sends, and, through the real
// routes, that each write path sends it inside its transaction BEFORE it reads a rule's data or writes a row.

const test = require('node:test');
const assert = require('node:assert/strict');
const { lockVenue } = require('../src/services/venueLock');
const { withVenueApp, bodies } = require('./venueApp');

const LOCK = (s) => /gabay\.Venue\b/i.test(s.text) && /FOR\s+NO\s+KEY\s+UPDATE/i.test(s.text);
const WRITES_BELOW_VENUE = /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+gabay\.(Level|Building)\b/i;
const RULE_READS = /^\s*SELECT\s+1\b[\s\S]*\bFROM\s+gabay\.Level\b/i; // the duplicate and in-use checks

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
 * Runs `action` with statements recorded and checks the order: the lock is in a transaction, nothing below the venue is
 * written before it, no duplicate-rule read of Level comes before it, and FOR UPDATE is never used.
 */
async function assertLockedFirst(ctx, label, action) {
  const log = ctx.record();
  const res = await action();
  assert.ok(
    res.status >= 200 && res.status < 300,
    `${label}: ${res.status} ${JSON.stringify(res.body)}`,
  );
  const at = log.findIndex(LOCK);
  assert.ok(at >= 0, `${label}: no FOR NO KEY UPDATE on gabay.Venue was sent`);
  assert.equal(
    log[at].inTransaction,
    true,
    `${label}: the lock must be taken inside the transaction`,
  );
  const firstWrite = log.findIndex((s) => WRITES_BELOW_VENUE.test(s.text));
  assert.ok(firstWrite > at, `${label}: a Level or Building write came before the lock`);
  const firstRuleRead = log.findIndex((s) => RULE_READS.test(s.text) && !LOCK(s));
  if (firstRuleRead >= 0) {
    assert.ok(firstRuleRead > at, `${label}: a read of Level (a rule check) came before the lock`);
  }
  for (const s of log) {
    assert.doesNotMatch(
      s.text,
      /\bFOR\s+UPDATE\b/i,
      `${label}: FOR UPDATE blocks inserts under the venue`,
    );
  }
  ctx.hooks.onStatement = null;
}

test('venue lock: every level create, edit and delete and both deletes take it first, inside their transaction (DC-7)', async () => {
  await withVenueApp(async (ctx) => {
    const { sql, tenantA, get, post, put, del } = ctx;
    const b = bodies(ctx);
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    const emptyBuilding = await sql.building(tenantA.tenantId, venue, type);

    await assertLockedFirst(ctx, 'indoor level create', () =>
      post(`/api/buildings/${building}/levels`, b.level({ ordinal: 1 })),
    );
    await assertLockedFirst(ctx, 'outdoor level create', () =>
      post(`/api/venues/${venue}/outdoor-levels`, b.outdoor()),
    );
    const level = await sql.level(tenantA.tenantId, venue, building, { ordinal: 2 });
    const loaded = (await get(`/api/levels/${level}`)).body;
    await assertLockedFirst(ctx, 'level edit', () =>
      put(`/api/levels/${level}`, {
        ...b.level({ ordinal: 2, name: 'Renamed' }),
        updatedAt: loaded.updatedAt,
      }),
    );
    await assertLockedFirst(ctx, 'level delete', () => del(`/api/levels/${level}`));
    await assertLockedFirst(ctx, 'building delete', () => del(`/api/buildings/${emptyBuilding}`));
  });
});
