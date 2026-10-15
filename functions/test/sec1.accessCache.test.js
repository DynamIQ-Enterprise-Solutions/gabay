'use strict';

// SEC-1 (spec/SEC-1.md r2 AC-24 (a) to (g), AC-29, EC-2, EC-28, EC-30; DC-3, DC-13, DC-17; plan/SEC-1.md 1.0 step 3):
// auth/accessCache.js against a counting store double and an injected clock. No database.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAccessCache, ACCESS_CACHE_TTL_MS } = require('../src/auth/accessCache');

/** A store double: counts loads, can fail the next load, and returns fresh plain rows each time. */
function countingStore() {
  const store = {
    loads: [],
    grantLoads: [],
    failNext: null,
    version: 1,
    async loadForUser(userId) {
      store.loads.push(userId);
      if (store.failNext) {
        const err = store.failNext;
        store.failNext = null;
        throw err;
      }
      return {
        roles: [{ roleId: 1, roleCode: 'VIEWER', tenantId: 3, v: store.version }],
        rolePermissions: [],
        userPermissions: [],
      };
    },
    async venueGrantsFor(userId, tenantId) {
      store.grantLoads.push([userId, tenantId]);
      if (store.failNext) {
        const err = store.failNext;
        store.failNext = null;
        throw err;
      }
      return [tenantId * 100 + store.version];
    },
  };
  return store;
}

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('AC-24 (a): the TTL is a named constant of 30,000 ms, citing standard 3.4 and PH2 S3, and the header says maxInstances = 1', () => {
  assert.equal(ACCESS_CACHE_TTL_MS, 30_000);
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'auth', 'accessCache.js'),
    'utf8',
  );
  assert.match(source, /Standard §3\.4[^\n]*P2-S3[^\n]*\n\s*const ACCESS_CACHE_TTL_MS = 30_000;/);
  assert.match(source, /VALID ONLY WHILE maxInstances = 1/);
});

test('AC-24 (a), (b), (c): keyed by user id; within the TTL no load, at the TTL a reload', async () => {
  const store = countingStore();
  const c = clock();
  const cache = createAccessCache({ accessStore: store, now: c.now });
  const first = await cache.get(7);
  assert.deepEqual(store.loads, [7]);
  c.advance(ACCESS_CACHE_TTL_MS - 1);
  assert.equal(await cache.get(7), first, 'within the TTL: the same snapshot, no query (b)');
  assert.deepEqual(store.loads, [7]);
  await cache.get(8);
  assert.deepEqual(store.loads, [7, 8], 'another user has their own entry (a)');
  c.advance(1); // exactly 30,000 ms after the load
  store.version = 2;
  const reloaded = await cache.get(7);
  assert.deepEqual(store.loads, [7, 8, 7], 'after the TTL it reloads (c)');
  assert.equal(
    reloaded.roles[0].v,
    2,
    'and serves the new rows (f: a grant changed by SQL is seen within 30 s)',
  );
});

test('AC-24 (d), DC-17: a rejected load is not cached, and an expired entry is never served when its reload fails', async () => {
  const store = countingStore();
  const c = clock();
  const cache = createAccessCache({ accessStore: store, now: c.now });
  store.failNext = Object.assign(new Error('connect ECONNREFUSED'), { dbUnavailable: true });
  await assert.rejects(() => cache.get(5), /ECONNREFUSED/);
  await cache.get(5);
  assert.deepEqual(store.loads, [5, 5], 'the failure was not cached: the next request loads again');

  c.advance(ACCESS_CACHE_TTL_MS);
  store.failNext = new Error('relation "gabay.userrole" does not exist');
  await assert.rejects(
    () => cache.get(5),
    /does not exist/,
    'no stale-on-error: the old snapshot is not served',
  );
  store.failNext = new Error('still down');
  await assert.rejects(() => cache.get(5), /still down/, 'and still not on the next try');
  await cache.get(5);
  assert.equal(store.loads.length, 5);
});

test('AC-24 (e): invalidate(userId) drops that user only; invalidateAll() drops everyone; grants go with them', async () => {
  const store = countingStore();
  const cache = createAccessCache({ accessStore: store, now: clock().now });
  await cache.get(1);
  await cache.get(2);
  await cache.grantsFor(1, 10);
  await cache.grantsFor(2, 10);
  cache.invalidate(1);
  await cache.get(1);
  await cache.get(2);
  await cache.grantsFor(1, 10);
  await cache.grantsFor(2, 10);
  assert.deepEqual(store.loads, [1, 2, 1], 'only user 1 reloaded');
  assert.deepEqual(store.grantLoads, [
    [1, 10],
    [2, 10],
    [1, 10],
  ]);
  cache.invalidateAll();
  await cache.get(1);
  await cache.get(2);
  await cache.grantsFor(2, 10);
  assert.deepEqual(store.loads, [1, 2, 1, 1, 2], 'everyone reloaded');
  assert.equal(store.grantLoads.length, 4);
});

test('AC-24 (e): an invalidation during a load wins: that load is not cached', async () => {
  const store = countingStore();
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const slow = {
    ...store,
    async loadForUser(userId) {
      store.loads.push(userId);
      await gate;
      return { roles: [], rolePermissions: [], userPermissions: [], stale: true };
    },
  };
  const cache = createAccessCache({ accessStore: slow, now: clock().now });
  const pending = cache.get(4);
  cache.invalidate(4); // a grant write lands while the load is in flight
  release();
  assert.equal((await pending).stale, true, 'the caller gets what it loaded');
  await cache.get(4);
  assert.deepEqual(store.loads, [4, 4], 'but it was not cached: the next request loads again');
});

test('AC-29, DC-13: grants are keyed by (user, tenant): another tenant is a separate read with its own tenant bound', async () => {
  const store = countingStore();
  const c = clock();
  const cache = createAccessCache({ accessStore: store, now: c.now });
  assert.deepEqual(await cache.grantsFor(1, 10), [1001]);
  assert.deepEqual(await cache.grantsFor(1, 20), [2001]);
  assert.deepEqual(await cache.grantsFor(1, 10), [1001]);
  assert.deepEqual(store.grantLoads, [
    [1, 10],
    [1, 20],
  ]);
  c.advance(ACCESS_CACHE_TTL_MS);
  await cache.grantsFor(1, 10);
  assert.deepEqual(store.grantLoads.at(-1), [1, 10], 'a grant list expires like a snapshot');
  store.failNext = new Error('down');
  c.advance(ACCESS_CACHE_TTL_MS);
  await assert.rejects(() => cache.grantsFor(1, 20), /down/);
  await cache.grantsFor(1, 20);
  assert.deepEqual(
    store.grantLoads.slice(-2),
    [
      [1, 20],
      [1, 20],
    ],
    'a failed grants read is not cached',
  );
});

test('EC-28: two requests that miss at once both load and both succeed; neither caches a failure', async () => {
  const store = countingStore();
  const cache = createAccessCache({ accessStore: store, now: clock().now });
  const [a, b] = await Promise.all([cache.get(9), cache.get(9)]);
  assert.equal(store.loads.length, 2);
  assert.deepEqual(a, b);
});

test('AC-24 (g): an entry holds what the store returned (plain rows) and nothing else; no token is ever passed in', async () => {
  const store = countingStore();
  const cache = createAccessCache({ accessStore: store, now: clock().now });
  const snapshot = await cache.get(3);
  assert.deepEqual(Object.keys(snapshot).sort(), ['rolePermissions', 'roles', 'userPermissions']);
  assert.equal(cache.get.length, 1, 'get takes the user id only');
  assert.equal(cache.grantsFor.length, 2, 'grantsFor takes the user id and the tenant id only');
});
