'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
  runWithActor,
  getActorId,
  getTenantId,
  getActingAsTenantId,
  inRequestContext,
} = require('../src/utils/requestContext');
const { actorContext } = require('../src/middleware/actorContext');
const { listen } = require('./helpers');

test('actor context: null outside a request, the actor inside, null again after', async () => {
  assert.equal(getActorId(), null);
  assert.equal(getTenantId(), null);
  const inside = await runWithActor(42, async () => {
    await new Promise((resolve) => setImmediate(resolve)); // survives an async hop
    return [getActorId(), getTenantId()];
  });
  assert.deepEqual(inside, [42, null]);
  assert.equal(getActorId(), null);
});

test('actor context: the tenant slot is carried when a caller sets it', () => {
  runWithActor(1, () => assert.equal(getTenantId(), 7), { tenantId: 7 });
});

test('SEC-1 AC-45: the acting-as tenant is the third value; all three survive awaits, timers and a microtask chain', async () => {
  assert.equal(getActingAsTenantId(), null, 'null outside a request');
  const seen = await runWithActor(
    5,
    async () => {
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setTimeout(resolve, 1));
      const deep = async (n) =>
        n === 0 ? [getActorId(), getTenantId(), getActingAsTenantId()] : deep(n - 1);
      return deep(20);
    },
    { tenantId: 7, actingAsTenantId: 7 },
  );
  assert.deepEqual(seen, [5, 7, 7]);
  runWithActor(5, () => assert.equal(getActingAsTenantId(), null, 'null when not set'), {
    tenantId: 7,
  });
  assert.equal(getActingAsTenantId(), null, 'null again after');
});

test('SEC-1 AC-45 (step 0 (c)): a nested run gives the inner chain its own store, and the outer store returns after it', async () => {
  await runWithActor(1, async () => {
    assert.deepEqual([getActorId(), getTenantId(), getActingAsTenantId()], [1, null, null]);
    const inner = runWithActor(
      1,
      async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return [getActorId(), getTenantId(), getActingAsTenantId()];
      },
      { tenantId: 9, actingAsTenantId: 9 },
    );
    // synchronously after the inner run returns, the outer store is back
    assert.deepEqual([getActorId(), getTenantId(), getActingAsTenantId()], [1, null, null]);
    assert.deepEqual(await inner, [1, 9, 9], 'the inner chain kept its own store across an await');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      [getActorId(), getTenantId(), getActingAsTenantId()],
      [1, null, null],
      'the outer chain after an await',
    );
  });
});

test('actor context: concurrent requests never see each other', async () => {
  const app = express();
  app.use((req, res, next) => runWithActor(Number(req.query.u), next));
  app.get('/who', async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 20 - Number(req.query.u))); // finish out of order
    res.json({ actor: getActorId() });
  });
  const s = await listen(app);
  try {
    const answers = await Promise.all(
      [1, 2, 3, 4, 5].map((u) => fetch(`${s.url}/who?u=${u}`).then((r) => r.json())),
    );
    assert.deepEqual(
      answers.map((a) => a.actor),
      [1, 2, 3, 4, 5],
    );
  } finally {
    await s.close();
  }
});

test('actorContext slot: runs the rest of the request inside a context with no actor yet (Phase 2 fills it)', async () => {
  const app = express();
  app.use(actorContext);
  app.get('/ctx', async (req, res) => {
    await new Promise((resolve) => setImmediate(resolve));
    res.json({ inContext: inRequestContext(), actor: getActorId(), tenant: getTenantId() });
  });
  const s = await listen(app);
  try {
    assert.equal(inRequestContext(), false, 'not in a context outside a request');
    const body = await fetch(`${s.url}/ctx`).then((r) => r.json());
    assert.deepEqual(body, { inContext: true, actor: null, tenant: null });
  } finally {
    await s.close();
  }
});
