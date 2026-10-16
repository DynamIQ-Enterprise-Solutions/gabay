'use strict';

// OA-3a (spec/OA-3.md r2 AC-7a, DC-27, EC-14, EC-15; plan/OA-3a-migration-rekey.md 1.1 section 3): the `connector-types`
// lookup, read-only, with the cost fields. GET /api/lookups/connector-types and /connector-types/:id through the real app and
// the real chain (auth, requireAdminUser, tenantContext, the role and permission guards, validate), over a rolled-back
// transaction (lookupsApp.js; L151). Rows are written by the test with the run's tag in their labels, so a search for the tag
// returns this file's rows only (a seeded database's own ELEVATOR, STAIRS, ESCALATOR and RAMP rows never confuse it; the
// seeded pairs are db/seeds' seed.content.test.js). The cost values are P0-03 r5 AC-101's, answered as numbers (DC-27: the
// representation the map context gives every DECIMAL(9,3) value).

const test = require('node:test');
const assert = require('node:assert/strict');
const { withLookupsApp } = require('./lookupsApp');
const { asHeaders } = require('./adminAccess');

const URL = '/api/lookups/connector-types';
const ROW_KEYS = ['code', 'costBaseS', 'costModel', 'costPerRiseS', 'id', 'isActive', 'label'];
/** spec/P0-03.md r5 AC-101: CostModel, IsStepFree, CostBaseS, CostPerRiseS. */
const PAIRS = {
  ELEVATOR: ['ELEVATOR', true, '4.000', '0.400'],
  STAIRS: ['STAIRS', false, '1.500', '1.100'],
  ESCALATOR: ['ESCALATOR', false, '1.000', '0.800'],
  RAMP: ['RAMP', true, '1.000', '1.000'],
};

/** One connector type row; `pair` is a PAIRS entry. */
const connectorType = (row, tag, { tenantId = null, name, pair, isActive = true, code } = {}) =>
  row('connector-types', {
    tenantId,
    label: `${name} ${tag}`,
    code: code ?? `${name}_${tag}`.slice(0, 40),
    isActive,
    extra: { CostModel: pair[0], IsStepFree: pair[1], CostBaseS: pair[2], CostPerRiseS: pair[3] },
  });

test('AC-7a: four platform types answer { id, code, label, isActive, costModel, costBaseS, costPerRiseS } with the seconds as numbers, in the list and by id', async () => {
  await withLookupsApp(async ({ get, row, tag }) => {
    const ids = {};
    for (const [name, pair] of Object.entries(PAIRS))
      ids[name] = await connectorType(row, tag, { name, pair });
    const list = await get(`${URL}?search=${tag}&pageSize=100`);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.totalCount, 4);
    for (const item of list.body.items) assert.deepEqual(Object.keys(item).sort(), ROW_KEYS);
    const byLabel = Object.fromEntries(list.body.items.map((i) => [i.label.split(' ')[0], i]));
    for (const [name, [model, , base, rise]] of Object.entries(PAIRS)) {
      const item = byLabel[name];
      assert.equal(item.id, ids[name]);
      assert.equal(item.costModel, model);
      assert.equal(item.costBaseS, Number(base), `${name}'s base, a number`);
      assert.equal(item.costPerRiseS, Number(rise), `${name}'s per-metre cost, a number`);
      assert.equal(typeof item.costBaseS, 'number');
      const one = await get(`${URL}/${ids[name]}`);
      assert.equal(one.status, 200);
      assert.deepEqual(one.body, item, 'by id is the list row');
    }
  });
});

test("AC-7a: a tenant's row with a platform row's code is listed beside it, and another tenant's row is never served (the global-lookup trap)", async () => {
  await withLookupsApp(async ({ get, row, tag, tenantA, tenantB }) => {
    const code = `SHARED_${tag}`.slice(0, 40);
    const platform = await connectorType(row, tag, { name: 'Platform', pair: PAIRS.STAIRS, code });
    const own = await connectorType(row, tag, {
      tenantId: tenantA.tenantId,
      name: 'Own',
      pair: PAIRS.ESCALATOR,
      code,
    });
    const other = await connectorType(row, tag, {
      tenantId: tenantB.tenantId,
      name: 'Other',
      pair: PAIRS.RAMP,
    });
    const list = await get(`${URL}?search=${tag}&pageSize=100`);
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body.items.map((i) => i.id).sort((a, b) => a - b),
      [platform, own].sort((a, b) => a - b),
    );
    assert.ok(
      list.body.items.every((i) => i.code === code),
      'both carry the shared code',
    );
    assert.equal(
      (await get(`${URL}/${other}`)).status,
      404,
      "another tenant's row by id is 404 (EC-9's rule)",
    );
    assert.deepEqual((await get(`${URL}/${other}`)).body, { error: 'Not found' });
  });
});

test('AC-7a: an inactive row is left out of the list and returned by id', async () => {
  await withLookupsApp(async ({ get, row, tag, tenantA }) => {
    const off = await connectorType(row, tag, {
      tenantId: tenantA.tenantId,
      name: 'Off',
      pair: PAIRS.ELEVATOR,
      isActive: false,
    });
    const offPlatform = await connectorType(row, tag, {
      name: 'OffPlatform',
      pair: PAIRS.RAMP,
      isActive: false,
    });
    const list = await get(`${URL}?search=${tag}`);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.items, []);
    for (const id of [off, offPlatform]) {
      const one = await get(`${URL}/${id}`);
      assert.equal(one.status, 200);
      assert.equal(one.body.isActive, false);
      assert.equal(one.body.costBaseS, id === off ? 4 : 1);
    }
  });
});

test('AC-7a, EC-14, EC-15: X-Tenant-Id the user does not hold is 403; a SUPERADMIN with no tenant is 400; no token is 401', async () => {
  await withLookupsApp(async ({ get, tenantC, users }) => {
    const notHeld = await get(URL, { 'x-tenant-id': String(tenantC.tenantId) });
    assert.equal(notHeld.status, 403);
    assert.deepEqual(notHeld.body, { error: 'This account has no access to that tenant' });
    const superNoTenant = await get(URL, {
      ...asHeaders(users.SUPERADMIN.token, null),
      'x-tenant-id': null,
    });
    assert.equal(superNoTenant.status, 400);
    assert.deepEqual(superNoTenant.body, {
      error: 'Choose a tenant: this works inside one tenant',
    });
    assert.equal((await get(`${URL}/1`, { authorization: null })).status, 401);
  });
});

test('AC-7a: read-only (no write route), and a name such as constructor is still 404', async () => {
  await withLookupsApp(async ({ get, call }) => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await call(URL, { method })).status, 404, method);
      assert.equal((await call(`${URL}/1`, { method })).status, 404, method);
    }
    for (const name of ['constructor', 'ConnectorType', 'connector_types']) {
      assert.equal((await get(`/api/lookups/${name}`)).status, 404, name);
    }
  });
});
