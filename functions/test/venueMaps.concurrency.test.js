'use strict';

// OA-2 / spec/OA-2.md r1 AC-16 (and AC-17's proof under real concurrency), EC-19, EC-20 (plan/OA-2-map-storage.md 1.0 section 8,
// and the owner's ruling 18a Q1 (a)): two requests that really run at the same moment, over two database connections that both
// see a committed venue. One rolled-back transaction (L151) cannot give that, so this file builds a THROWAWAY DATABASE
// (db/tools/test/scratchDb.js: created for this file, dropped in a finally; nothing is kept, and the working copy's own
// database is never written) with the current schema and its migrations (SEC-1: migration 0002's roles and grants, which
// the guards read), a committed tenant, user, venue and lookup row, and mounts the real app on it. The user signs in as a
// MALL_ADMIN of the tenant through a verifier double and names the tenant in X-Tenant-Id (SEC-1, C1: harness calls only).
//
//   AC-16 / EC-19  two saves on one base: exactly one 200 and one 409 each round, 20 rounds; the stored draft is the winner's.
//                  Two FIRST saves (base 0) behave the same way, never a unique-key 500.
//   EC-20          a save racing a clear on one base, and a save racing a rollback, on one base: exactly one 200.
//
// The race itself cannot be forced from a test; what is forced is the contention: both requests are released in one tick, the
// second must wait on the first's venue lock (lockVenue, FOR NO KEY UPDATE), and 20 rounds make a missing lock show.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');
const { testConfig, fakeLogger, listen } = require('./helpers');
const { createSeeder } = require('./authHelpers');
const { tokenVerifier, asHeaders } = require('./adminAccess');
const { runMigrations } = require('../../db/tools/lib/migrations');
const { withScratchDatabase } = require('../../db/tools/test/scratchDb');
const { memoryFileStore } = require('./memoryFileStore');
const { fakeBuilder, STALE_TEXT } = require('./mapApp');
const b = require('./fixtures/mapBuilder');

const ROUNDS = 20;

/** The real app over a scratch database holding committed rows; `fn` gets { c, call, venue(), tenantId, userId, ... }. */
async function withConcurrentApp(fn) {
  await withScratchDatabase(async (scratch) => {
    const c = await scratch.client();
    await scratch.reset(c);
    await scratch.applyCurrentSchema(c);
    const { log, table } = console; // runMigrations prints its progress; this file keeps the console for its failures
    console.log = () => {};
    console.table = () => {};
    try {
      await runMigrations(c);
    } finally {
      console.log = log;
      console.table = table;
    }
    const seed = createSeeder(c);
    const role = await seed.role('MALL_ADMIN');
    const tenant = await seed.tenant('A');
    const user = await seed.user();
    await seed.userRole(user.userId, role, tenant.tenantId);
    await c.query(
      `INSERT INTO gabay.BuildingType (TenantId, Code, Label) VALUES (NULL, 'MAIN', 'Main building')`,
    );
    const logger = fakeLogger();
    const config = testConfig({ ...scratch.env, PG_POOL_MAX: '8' });
    const verifier = tokenVerifier();
    const signedIn = asHeaders(verifier.add(`tok-${seed.tag}`, user.uid), tenant);
    const db = createDb(config, logger);
    const builder = fakeBuilder();
    const app = createApp({
      config,
      db,
      logger,
      tokenVerifier: verifier,
      fileStore: memoryFileStore(),
      mapBuilder: builder,
    });
    const server = await listen(app);
    let counter = 0;
    const call = async (method, path, body) => {
      const res = await fetch(`${server.url}${path}`, {
        method,
        headers:
          body === undefined ? signedIn : { ...signedIn, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    const venue = async () => {
      counter += 1;
      const row = await c.query(
        `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, $2, $2, '{"type":"Polygon","coordinates":[]}'::jsonb) RETURNING VenueId`,
        [tenant.tenantId, `CV${counter}`],
      );
      return row.rows[0].venueid;
    };
    const mapRow = async (venueId) =>
      (await c.query(`SELECT * FROM gabay.VenueMap WHERE VenueId = $1`, [venueId])).rows[0];
    try {
      await fn({
        c,
        call,
        venue,
        mapRow,
        tenantId: tenant.tenantId,
        userId: user.userId,
        builder,
        logger,
      });
    } finally {
      await server.close();
      await db.close();
    }
  });
}

/** A valid document whose one level is named `name`, so a stored draft says which request wrote it. */
function named(name) {
  const doc = b.smallDoc();
  doc.levels[0].name = name;
  return doc;
}

const statuses = (results) => results.map((r) => r.status).sort((x, y) => x - y);

test("AC-16, EC-19: two saves on one base at the same moment: exactly one 200 and one 409 each round (20 rounds); the stored draft is the winner's", async () => {
  await withConcurrentApp(async ({ call, venue, mapRow }) => {
    const id = await venue();
    const url = `/api/venues/${id}/map/draft`;
    assert.equal((await call('PUT', url, { layout: named('first'), baseVersion: 0 })).status, 200);
    for (let round = 1; round <= ROUNDS; round += 1) {
      const results = await Promise.all([
        call('PUT', url, { layout: named(`A${round}`), baseVersion: round }),
        call('PUT', url, { layout: named(`B${round}`), baseVersion: round }),
      ]);
      assert.deepEqual(statuses(results), [200, 409], `round ${round}: ${JSON.stringify(results)}`);
      const winner = results[0].status === 200 ? 'A' : 'B';
      const loser = results.find((r) => r.status === 409);
      assert.deepEqual(
        loser.body,
        { error: STALE_TEXT, draftVersion: round + 1 },
        `round ${round}: the 409 carries the stored version`,
      );
      const ok = results.find((r) => r.status === 200);
      assert.equal(ok.body.draftVersion, round + 1);
      const row = await mapRow(id);
      assert.equal(row.draftversion, round + 1, `round ${round}: one save landed`);
      assert.equal(
        row.draftjson.levels[0].name,
        `${winner}${round}`,
        `round ${round}: the stored draft is the winner's`,
      );
    }
  });
});

test('AC-16, EC-19: two FIRST saves (base 0) at the same moment: exactly one 200 and one 409, never a unique-key 500 (20 rounds)', async () => {
  await withConcurrentApp(async ({ call, venue, mapRow, c }) => {
    for (let round = 1; round <= ROUNDS; round += 1) {
      const id = await venue();
      const url = `/api/venues/${id}/map/draft`;
      const results = await Promise.all([
        call('PUT', url, { layout: named(`A${round}`), baseVersion: 0 }),
        call('PUT', url, { layout: named(`B${round}`), baseVersion: 0 }),
      ]);
      assert.deepEqual(statuses(results), [200, 409], `round ${round}: ${JSON.stringify(results)}`);
      const loser = results.find((r) => r.status === 409);
      assert.deepEqual(loser.body, { error: STALE_TEXT, draftVersion: 1 });
      const winner = results[0].status === 200 ? 'A' : 'B';
      const row = await mapRow(id);
      assert.equal(row.draftversion, 1);
      assert.equal(row.draftjson.levels[0].name, `${winner}${round}`);
      const n = await c.query(`SELECT count(*)::int AS n FROM gabay.VenueMap WHERE VenueId = $1`, [
        id,
      ]);
      assert.equal(n.rows[0].n, 1, 'one row per venue');
    }
  });
});

test('AC-16: more than two saves on one base: exactly one wins', async () => {
  await withConcurrentApp(async ({ call, venue, mapRow }) => {
    const id = await venue();
    const url = `/api/venues/${id}/map/draft`;
    for (let round = 0; round < 5; round += 1) {
      const results = await Promise.all(
        [0, 1, 2, 3, 4].map((i) =>
          call('PUT', url, { layout: named(`W${round}-${i}`), baseVersion: round }),
        ),
      );
      assert.deepEqual(
        statuses(results),
        [200, 409, 409, 409, 409],
        `round ${round}: ${JSON.stringify(results.map((r) => r.status))}`,
      );
      assert.equal((await mapRow(id)).draftversion, round + 1);
    }
  });
});

test('EC-20: a save racing a clear on the same base: exactly one 200, the other a 409; the draft is whole either way (10 rounds)', async () => {
  await withConcurrentApp(async ({ call, venue, mapRow }) => {
    const id = await venue();
    const base = `/api/venues/${id}/map`;
    let version = 0;
    for (let round = 1; round <= 10; round += 1) {
      // put a draft in place (the clear in the previous round may have emptied it)
      assert.equal(
        (
          await call('PUT', `${base}/draft`, {
            layout: named(`seed${round}`),
            baseVersion: version,
          })
        ).status,
        200,
      );
      version += 1;
      const results = await Promise.all([
        call('PUT', `${base}/draft`, { layout: named(`R${round}`), baseVersion: version }),
        call('POST', `${base}/clear`, { baseVersion: version }),
      ]);
      assert.deepEqual(statuses(results), [200, 409], `round ${round}: ${JSON.stringify(results)}`);
      const row = await mapRow(id);
      assert.equal(row.draftversion, version + 1, `round ${round}: exactly one change landed`);
      const saveWon = results[0].status === 200;
      if (saveWon) assert.equal(row.draftjson.levels[0].name, `R${round}`);
      else assert.equal(row.draftjson, null, 'the clear won: the draft is empty, not half-written');
      version += 1;
    }
  });
});

test('EC-20: a save racing a rollback on the same base: exactly one 200, the other a 409; no 5xx (10 rounds)', async () => {
  await withConcurrentApp(async ({ call, venue, mapRow, c, builder }) => {
    const id = await venue();
    const base = `/api/venues/${id}/map`;
    // a published version to roll back to, made through the real publish route (the fake builder)
    assert.equal(
      (await call('PUT', `${base}/draft`, { layout: named('v1'), baseVersion: 0 })).status,
      200,
      'the first draft',
    );
    assert.equal((await call('POST', `${base}/publish`, { baseVersion: 1 })).status, 200);
    let version = 1;
    for (let round = 1; round <= 10; round += 1) {
      const results = await Promise.all([
        call('PUT', `${base}/draft`, { layout: named(`S${round}`), baseVersion: version }),
        call('POST', `${base}/rollback`, { version: 1, baseVersion: version }),
      ]);
      assert.ok(
        results.every((r) => r.status < 500),
        `round ${round}: no 5xx: ${JSON.stringify(results)}`,
      );
      assert.deepEqual(statuses(results), [200, 409], `round ${round}: ${JSON.stringify(results)}`);
      const row = await mapRow(id);
      assert.ok(
        row.draftjson !== null && typeof row.draftjson === 'object',
        `round ${round}: the draft is whole`,
      );
      version = row.draftversion;
    }
    const stuck = await c.query(
      `SELECT count(*)::int AS n FROM gabay.VenueVersion WHERE VenueId = $1 AND Status = 'BUILDING'`,
      [id],
    );
    assert.equal(stuck.rows[0].n, 0, 'no publish is left BUILDING');
    assert.ok(builder.calls.length >= 1);
  });
});
