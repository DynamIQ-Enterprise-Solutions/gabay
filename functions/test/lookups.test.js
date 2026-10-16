'use strict';

// FF-0 (E-20; plan/FF0-dev-stub-lookups.md section 3): GET /api/lookups/:name and GET /api/lookups/:name/:id through the
// real app (createApp), so the real chain (SEC-1: auth, tenantContext, the guards), the allow-list, the real SQL and the
// real tables are all in play. SEC-1 (plan/SEC-1.md 1.0 section 2, C1): there is no stub, so every request is signed in
// (adminAccess.js: a verifier double and one user per admin role) and names its tenant; by default MALL_ADMIN in A. The
// rows are written inside a transaction that is always rolled back (authHelpers.js; WORKING_AGREEMENT section 5, L151):
// nothing is kept and no seeded row is touched. Every row this file creates carries the run's tag in its label, so
// a search for the tag returns exactly this file's rows and the seeded platform rows never confuse an assertion.
//
// What is checked: the allow-list (rule 3), the global-lookup trap (the platform rows plus the tenant's own and no
// other tenant's), the tenant coming only from X-Tenant-Id (rule 2), the inactive rule, the paging cap, the
// order, and a literal search.

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_PAGE_SIZE } = require('../src/utils/pagination');
const { withLookupsApp: withApp } = require('./lookupsApp');

// OA-3a (C2): withApp moved to lookupsApp.js on its second use (lookups.connectorTypes.test.js), unchanged but for an
// `extra` option on row(). No case below changed.

/** table, id column and name of each lookup FF-0 serves. */
const LOOKUPS = {
  'building-types': { table: 'BuildingType', id: 'BuildingTypeId' },
  'amenity-types': { table: 'AmenityType', id: 'AmenityTypeId' },
  'transit-types': { table: 'TransitType', id: 'TransitTypeId' },
};

const labelsOf = (body) => body.items.map((i) => i.label);

test('lookups: an unknown name is 404 in the { error } shape, and so is a name that is not on the allow-list', async () => {
  await withApp(async ({ get }) => {
    for (const name of [
      'nope',
      'occupant-categories', // a real table, not yet on the allow-list
      'BuildingType', // the table name itself is not a lookup name
      'buildingtype',
      'constructor',
      '__proto__',
      'toString',
      'building-types%00',
      '..%2Fme',
    ]) {
      const list = await get(`/api/lookups/${name}`);
      assert.equal(list.status, 404, name);
      assert.deepEqual(list.body, { error: 'Not found' }, name);
      const one = await get(`/api/lookups/${name}/1`);
      assert.equal(one.status, 404, `${name}/1`);
    }
  });
});

test('lookups: only GET exists; any other method is 404 (read-only, no row is ever written)', async () => {
  await withApp(async ({ call }) => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await call('/api/lookups/building-types', { method })).status, 404, method);
      assert.equal((await call('/api/lookups/building-types/1', { method })).status, 404, method);
    }
  });
});

// CHANGED BY SEC-1 (plan section 2, C1): was "it answers with no token (the development stub stands in)". The stub is gone.
test('lookups: 401 with no token; 200 with MALL_ADMIN token and X-Tenant-Id; /api/me needs a token too', async () => {
  await withApp(async ({ get }) => {
    const none = await get('/api/lookups/building-types', { authorization: null });
    assert.equal(none.status, 401);
    assert.deepEqual(none.body, { error: 'Authentication required' });
    assert.equal((await get('/api/lookups/building-types')).status, 200, 'signed in, tenant A');
    const me = await get('/api/me', { authorization: null });
    assert.equal(me.status, 401);
    assert.deepEqual(me.body, { error: 'Authentication required' });
  });
});

test('lookups: the row is exactly { id, code, label, isActive } and the list is the standard envelope, for each of the three names', async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    for (const name of Object.keys(LOOKUPS)) {
      const id = await row(name, {
        tenantId: tenantA.tenantId,
        code: `X${tag}`,
        label: `Own ${tag}`,
      });
      const list = await get(`/api/lookups/${name}?search=${tag}`);
      assert.equal(list.status, 200, name);
      assert.deepEqual(
        Object.keys(list.body).sort(),
        ['items', 'page', 'pageSize', 'totalCount'],
        name,
      );
      assert.deepEqual(
        list.body,
        {
          items: [{ id, code: `X${tag}`, label: `Own ${tag}`, isActive: true }],
          totalCount: 1,
          page: 1,
          pageSize: 25,
        },
        name,
      );
      const one = await get(`/api/lookups/${name}/${id}`);
      assert.equal(one.status, 200, name);
      assert.deepEqual(
        one.body,
        { id, code: `X${tag}`, label: `Own ${tag}`, isActive: true },
        name,
      );
    }
  });
});

test("lookups: the list has the platform rows plus the tenant's own, and never another tenant's (the global-lookup trap)", async () => {
  await withApp(async ({ get, row, tag, tenantA, tenantB }) => {
    await row('building-types', { tenantId: null, label: `Platform ${tag}` });
    await row('building-types', { tenantId: tenantA.tenantId, label: `Alpha ${tag}` });
    await row('building-types', { tenantId: tenantB.tenantId, label: `Beta ${tag}` });
    // No header: the default tenant, A (first by code).
    const asA = await get(`/api/lookups/building-types?search=${tag}`);
    assert.deepEqual(labelsOf(asA.body).sort(), [`Alpha ${tag}`, `Platform ${tag}`]);
    const asB = await get(`/api/lookups/building-types?search=${tag}`, {
      'X-Tenant-Id': String(tenantB.tenantId),
    });
    assert.deepEqual(labelsOf(asB.body).sort(), [`Beta ${tag}`, `Platform ${tag}`]);
  });
});

test("lookups: the tenant is X-Tenant-Id's, never the query string's: a tenantId in the query string, or a tenant the user does not hold, shows nothing of it", async () => {
  await withApp(async ({ get, row, tag, tenantA, tenantB, tenantC }) => {
    await row('amenity-types', { tenantId: tenantB.tenantId, label: `Beta ${tag}` });
    await row('amenity-types', { tenantId: tenantC.tenantId, label: `Gamma ${tag}` });
    const asked = await get(
      `/api/lookups/amenity-types?search=${tag}&tenantId=${tenantB.tenantId}&tenantCompanyID=${tenantC.tenantId}`,
    );
    assert.equal(asked.status, 200);
    assert.deepEqual(asked.body.items, [], 'the named tenant A has none of them');
    const denied = await get(`/api/lookups/amenity-types?search=${tag}`, {
      'X-Tenant-Id': String(tenantC.tenantId),
    });
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.body, { error: 'This account has no access to that tenant' });
    assert.ok(tenantA);
  });
});

test("lookups: inactive rows are left out of the list but returned by id, for the tenant's own and for the platform", async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    const own = await row('transit-types', {
      tenantId: tenantA.tenantId,
      label: `Own off ${tag}`,
      isActive: false,
    });
    const platform = await row('transit-types', {
      tenantId: null,
      label: `Platform off ${tag}`,
      isActive: false,
    });
    await row('transit-types', { tenantId: tenantA.tenantId, label: `Own on ${tag}` });
    const list = await get(`/api/lookups/transit-types?search=${tag}`);
    assert.deepEqual(labelsOf(list.body), [`Own on ${tag}`]);
    assert.equal(list.body.totalCount, 1);
    for (const [id, label] of [
      [own, `Own off ${tag}`],
      [platform, `Platform off ${tag}`],
    ]) {
      const one = await get(`/api/lookups/transit-types/${id}`);
      assert.equal(one.status, 200);
      assert.deepEqual(one.body, { id, code: one.body.code, label, isActive: false });
    }
  });
});

test("lookups: by id never returns another tenant's row (404), and a bad, unknown or oversized id is 404 too", async () => {
  await withApp(async ({ get, row, tag, tenantA, tenantB }) => {
    const theirs = await row('building-types', {
      tenantId: tenantB.tenantId,
      label: `Beta ${tag}`,
    });
    const mine = await row('building-types', { tenantId: tenantA.tenantId, label: `Alpha ${tag}` });
    assert.equal((await get(`/api/lookups/building-types/${mine}`)).status, 200);
    const other = await get(`/api/lookups/building-types/${theirs}`);
    assert.equal(other.status, 404);
    assert.deepEqual(other.body, { error: 'Not found' });
    // ...but it is theirs when they ask as that tenant.
    const asB = await get(`/api/lookups/building-types/${theirs}`, {
      'X-Tenant-Id': String(tenantB.tenantId),
    });
    assert.equal(asB.status, 200);
    for (const id of [
      '0',
      '999999999',
      '99999999999999999999',
      'abc',
      '1.5',
      '-1',
      "1'",
      '1%20OR%201=1',
    ]) {
      const res = await get(`/api/lookups/building-types/${id}`);
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { error: 'Not found' }, id);
    }
  });
});

test("lookups: a name's id is read from its own table (an amenity id is not a building type)", async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    const amenity = await row('amenity-types', {
      tenantId: tenantA.tenantId,
      label: `Amenity ${tag}`,
    });
    const building = await row('building-types', {
      tenantId: tenantA.tenantId,
      label: `Building ${tag}`,
    });
    const viaBuilding = await get(`/api/lookups/building-types/${amenity}`);
    // Ids are per table: the same number may exist in the other table, but it must be THAT table's row.
    assert.ok([200, 404].includes(viaBuilding.status), String(viaBuilding.status));
    if (viaBuilding.status === 200) assert.notEqual(viaBuilding.body.label, `Amenity ${tag}`);
    else assert.deepEqual(viaBuilding.body, { error: 'Not found' });
    assert.equal((await get(`/api/lookups/amenity-types/${amenity}`)).body.label, `Amenity ${tag}`);
    assert.equal(
      (await get(`/api/lookups/building-types/${building}`)).body.label,
      `Building ${tag}`,
    );
  });
});

test('lookups: search is a case-insensitive contains on the label, and a quote, a percent and an underscore match literally', async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    const t = tenantA.tenantId;
    await row('building-types', { tenantId: t, label: `Rock 'n' Roll ${tag}` });
    await row('building-types', { tenantId: t, label: `100% Cotton ${tag}` });
    await row('building-types', { tenantId: t, label: `A_B ${tag}` });
    await row('building-types', { tenantId: t, label: `AxB ${tag}` });
    await row('building-types', { tenantId: t, label: `Back\\slash ${tag}` });
    const found = async (term) =>
      labelsOf(
        (await get(`/api/lookups/building-types?search=${encodeURIComponent(term)}`)).body,
      ).sort();

    assert.deepEqual(await found(`cotton ${tag}`), [`100% Cotton ${tag}`], 'case-insensitive');
    assert.deepEqual(
      await found(`'n' roll ${tag}`),
      [`Rock 'n' Roll ${tag}`],
      'a quote is a quote',
    );
    assert.deepEqual(
      await found(`% Cotton ${tag}`),
      [`100% Cotton ${tag}`],
      'a percent is a percent',
    );
    assert.deepEqual(
      await found(`A_B ${tag}`),
      [`A_B ${tag}`],
      'an underscore is not "any one character"',
    );
    assert.deepEqual(
      await found(`\\slash ${tag}`),
      [`Back\\slash ${tag}`],
      'a backslash is a backslash',
    );
    assert.deepEqual(
      await found('%'),
      [`100% Cotton ${tag}`],
      'a lone percent is not "everything"',
    );
    assert.deepEqual(await found('_'), [`A_B ${tag}`], 'a lone underscore is not "everything"');
    assert.deepEqual(await found(`x'; DROP TABLE gabay.BuildingType; -- ${tag}`), []);
    const still = await get('/api/lookups/building-types?pageSize=200');
    assert.ok(still.body.totalCount >= 5, 'the table is still there');
  });
});

test('lookups: an empty or blank search is no search', async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    await row('building-types', { tenantId: tenantA.tenantId, label: `Alpha ${tag}` });
    const plain = await get('/api/lookups/building-types');
    assert.equal(plain.status, 200);
    assert.ok(plain.body.totalCount >= 1, "the plain list holds this test's row");
    for (const search of ['', '%20%20']) {
      const res = await get(`/api/lookups/building-types?search=${search}`);
      assert.equal(res.status, 200, JSON.stringify(search));
      assert.ok(res.body.totalCount >= 1, JSON.stringify(search));
      assert.equal(res.body.totalCount, plain.body.totalCount, JSON.stringify(search));
    }
  });
});

test('lookups: paging uses the standard envelope and its cap, and the pages join up without overlap', async () => {
  await withApp(async ({ get, db, tag, tenantA }) => {
    // 210 rows in one statement: more than the cap, so the cap is what limits the page.
    await db.query(
      `INSERT INTO gabay.BuildingType (TenantId, Code, Label, SortOrder)
       SELECT $1, 'P' || $2 || n, 'Paged ' || $2 || ' ' || lpad(n::text, 4, '0'), 0
         FROM generate_series(1, 210) AS n`,
      [tenantA.tenantId, tag],
    );
    const big = await get(`/api/lookups/building-types?search=Paged%20${tag}&pageSize=100000`);
    assert.equal(big.body.pageSize, MAX_PAGE_SIZE);
    assert.equal(big.body.items.length, MAX_PAGE_SIZE);
    assert.equal(big.body.totalCount, 210);
    assert.equal(big.body.page, 1);

    const first = await get(
      `/api/lookups/building-types?search=Paged%20${tag}&pageSize=100&page=1`,
    );
    const second = await get(
      `/api/lookups/building-types?search=Paged%20${tag}&pageSize=100&page=2`,
    );
    const third = await get(
      `/api/lookups/building-types?search=Paged%20${tag}&pageSize=100&page=3`,
    );
    assert.deepEqual(
      [first.body.items.length, second.body.items.length, third.body.items.length],
      [100, 100, 10],
    );
    const ids = [...first.body.items, ...second.body.items, ...third.body.items].map((i) => i.id);
    assert.equal(new Set(ids).size, 210, 'no row twice, none missing');
    assert.equal(second.body.page, 2);

    const defaults = await get(`/api/lookups/building-types?search=Paged%20${tag}`);
    assert.equal(defaults.body.pageSize, 25);
    assert.equal(defaults.body.items.length, 25);
  });
});

test('lookups: the order is SortOrder, then Label, whatever sortBy or sortOrder the client sends', async () => {
  await withApp(async ({ get, row, tag, tenantA }) => {
    const t = tenantA.tenantId;
    await row('amenity-types', { tenantId: t, label: `Zeta ${tag}`, sortOrder: -5 });
    await row('amenity-types', { tenantId: t, label: `Alpha ${tag}`, sortOrder: -5 });
    await row('amenity-types', { tenantId: t, label: `Mid ${tag}`, sortOrder: -10 });
    await row('amenity-types', { tenantId: t, label: `Last ${tag}`, sortOrder: 7 });
    const want = [`Mid ${tag}`, `Alpha ${tag}`, `Zeta ${tag}`, `Last ${tag}`];
    for (const extra of [
      '',
      '&sortOrder=DESC',
      '&sortBy=label&sortOrder=desc',
      '&sortBy=Label;DROP',
    ]) {
      const res = await get(`/api/lookups/amenity-types?search=${tag}${extra}`);
      assert.deepEqual(labelsOf(res.body), want, extra);
    }
    // And across the whole list (platform rows included) the order is non-decreasing in (SortOrder, Label).
    const all = await get('/api/lookups/amenity-types?pageSize=200');
    const at = (label) => all.body.items.findIndex((i) => i.label === label);
    assert.ok(at(`Mid ${tag}`) < at(`Alpha ${tag}`));
    assert.ok(at(`Alpha ${tag}`) < at(`Last ${tag}`));
    assert.equal(at(`Mid ${tag}`), 0, 'the lowest SortOrder is first');
  });
});

test('lookups: a platform row (TenantId NULL) is served for each of the three names, with no tenant row needed (the P0-01 dropdowns)', async () => {
  // Written here, rolled back, never by the route: the verify order runs the API tests before the seed, so no test
  // may rely on seeded rows. The localhost check of the seeded values is in the e2e manual.
  await withApp(async ({ get, row, tag }) => {
    for (const name of Object.keys(LOOKUPS)) {
      const id = await row(name, { tenantId: null, label: `Platform ${tag}` });
      const list = await get(`/api/lookups/${name}?search=${tag}`);
      assert.deepEqual(
        list.body.items.map((i) => i.id),
        [id],
        name,
      );
    }
  });
});

test('lookups: the tenant chain runs first, so a not-held X-Tenant-Id is 403 even for an unknown name or a non-GET method', async () => {
  await withApp(async ({ call, tenantC }) => {
    const headers = { 'X-Tenant-Id': String(tenantC.tenantId) };
    for (const [path, method] of [
      ['/api/lookups/nope', 'GET'],
      ['/api/lookups/building-types/abc', 'GET'],
      ['/api/lookups/building-types', 'POST'],
      ['/api/lookups', 'GET'],
    ]) {
      const res = await call(path, { headers, method });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
  });
});
