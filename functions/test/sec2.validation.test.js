// SEC-2 step 3: zod at every route boundary, over HTTP (spec/SEC-2.md r2 AC-32 to AC-39; EC-4, EC-15, EC-18, EC-19b, EC-28
// to EC-30, EC-32). The sweep of AC-38 for each body route; the allow-list cases of AC-35; the order of refusals of AC-39 for
// each pair of neighbouring steps. The existing suites (venues, edits.missingFields, venueMaps.*, lookups, pagination) are
// the acceptance test for "nothing a client sees changes" (AC-34) and run unchanged.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bodies } = require('./venueApp');
const { withMapApp, docs } = require('./mapApp');
const { FALLBACK } = require('../src/middleware/validate');

/** What no answer of a failed validation may contain (AC-38). */
const LEAKS =
  /zod|ZodError|Invalid input|expected\b.*\breceived|\bissues\b|\b(body|params|query)\.[a-z]|\[object|undefined/i;
/** The refusals a body route may answer: a schema's own words, or the body parser's. */
const ALLOWED =
  /^(The request body must be a JSON object|Malformed JSON body|Code |Name |Active |Updated at |baseVersion |version |layout )/;

function assertSafeRefusal(res, note) {
  assert.ok(
    [400, 404].includes(res.status),
    `${note}: status ${res.status} ${res.text.slice(0, 200)}`,
  );
  assert.deepEqual(Object.keys(res.body), ['error'], note);
  const text = res.body.error;
  assert.equal(typeof text, 'string', note);
  assert.notEqual(text, FALLBACK, `${note}: a schema without a message of its own`);
  assert.doesNotMatch(text, LEAKS, note);
  if (res.status === 400) assert.match(text, ALLOWED, note);
}

/** The malformed shapes of a JSON body: [label, raw JSON text]. Express's parser refuses a top-level string, null or number. */
function shapes() {
  const bigObject = {};
  for (let i = 0; i < 10_000; i += 1) bigObject[`key${i}`] = i;
  return [
    ['an array', '[]'],
    ['an array of objects', '[{"baseVersion":1}]'],
    ['a string', '"text"'],
    ['null', 'null'],
    ['a number', '5'],
    ['an empty object', '{}'],
    ['10,000 unknown keys', JSON.stringify(bigObject)],
  ];
}

/** Wrong types for a field, as JSON values. */
const WRONG_TYPES = [[], {}, 'text', 5, 1.5, true, null, -1, 2147483648];

test('AC-38: a body that is an array, a string, null, a number, empty or 10,000 keys is a plain refusal on every body route', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const current = (await ctx.get(`/api/venues/${venue}`)).body;
    const routes = [
      ['POST', '/api/venues'],
      ['PUT', `/api/venues/${venue}`],
      ['PUT', ctx.mapUrl(venue, '/draft')],
      ['POST', ctx.mapUrl(venue, '/publish')],
      ['POST', ctx.mapUrl(venue, '/clear')],
      ['POST', ctx.mapUrl(venue, '/rollback')],
    ];
    for (const [method, path] of routes) {
      for (const [label, rawBody] of shapes()) {
        const res = await ctx.call(method, path, { rawBody });
        assertSafeRefusal(res, `${method} ${path} with ${label}`);
      }
      // no body at all, and a body that is not JSON
      assertSafeRefusal(await ctx.call(method, path, {}), `${method} ${path} with no body`);
    }
    assert.ok(current.updatedAt === null || typeof current.updatedAt === 'string');
  });
});

test('AC-38: the wrong type for each field is a plain refusal naming the field, on every body route', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const venueBody = (over) => ({ ...bodies(ctx).venue(), ...over });
    const cases = [
      ['POST', '/api/venues', (over) => venueBody(over), ['code', 'name', 'isActive']],
      [
        'PUT',
        `/api/venues/${venue}`,
        (over) => ({ ...venueBody(), updatedAt: null, ...over }),
        ['code', 'name', 'isActive', 'updatedAt'],
      ],
      [
        'PUT',
        ctx.mapUrl(venue, '/draft'),
        (over) => ({ layout: docs.small(), baseVersion: 0, ...over }),
        ['baseVersion'],
      ],
      [
        'POST',
        ctx.mapUrl(venue, '/publish'),
        (over) => ({ baseVersion: 0, ...over }),
        ['baseVersion'],
      ],
      [
        'POST',
        ctx.mapUrl(venue, '/clear'),
        (over) => ({ baseVersion: 0, ...over }),
        ['baseVersion'],
      ],
      [
        'POST',
        ctx.mapUrl(venue, '/rollback'),
        (over) => ({ version: 1, baseVersion: 0, ...over }),
        ['version', 'baseVersion'],
      ],
    ];
    for (const [method, path, make, keys] of cases) {
      for (const key of keys) {
        for (const wrong of WRONG_TYPES) {
          // some wrong values are valid for some keys (null for updatedAt, 5 for a version): only refusals are checked
          const res = await ctx.call(method, path, { body: make({ [key]: wrong }) });
          if (res.status >= 400 && res.status !== 404 && res.status !== 409) {
            assertSafeRefusal(res, `${method} ${path} ${key}=${JSON.stringify(wrong)}`);
          }
        }
      }
    }
  });
});

test('EC-30: a code that is an array or a number is "Code must be text"; a control character is refused with today\'s words', async () => {
  await withMapApp(async (ctx) => {
    for (const code of [[], 5, {}, true]) {
      const res = await ctx.post('/api/venues', { ...bodies(ctx).venue(), code });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'Code must be text' });
    }
    const res = await ctx.post('/api/venues', { ...bodies(ctx).venue(), code: 'a\u0000b' });
    assert.deepEqual(res.body, { error: 'Code contains a character that cannot be stored' });
  });
});

test('EC-32: Content-Type text/plain on a JSON route leaves the body unparsed: the same refusal as no body', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const plain = await ctx.call('POST', '/api/venues', {
      rawBody: '{"code":"x"}',
      headers: { 'content-type': 'text/plain' },
    });
    // rawBody sets application/json in the harness; send it directly with text/plain
    const direct = await fetch(`${ctx.server.url}/api/venues`, {
      method: 'POST',
      headers: { ...ctx.as('MALL_ADMIN'), 'content-type': 'text/plain' },
      body: '{"code":"x"}',
    });
    assert.equal(direct.status, 400);
    assert.deepEqual(await direct.json(), { error: 'The request body must be a JSON object' });
    const draft = await fetch(`${ctx.server.url}${ctx.mapUrl(venue, '/draft')}`, {
      method: 'PUT',
      headers: { ...ctx.as('MALL_ADMIN'), 'content-type': 'text/plain' },
      body: 'layout',
    });
    assert.equal(draft.status, 400);
    assert.deepEqual(await draft.json(), {
      error: 'baseVersion must be a whole number from 0 to 2147483647',
    });
    assert.ok(plain.status === 400 || plain.status === 201);
  });
});

test('EC-15: a tenantId, venueId or createdBy in a body never picks the tenant or the venue', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const res = await ctx.save(venue, docs.small(), 0);
    assert.equal(res.status, 200);
    const other = await ctx.sql.venue(ctx.tenantB.tenantId);
    const sneaky = await ctx.put(ctx.mapUrl(venue, '/draft'), {
      layout: docs.small(),
      baseVersion: 1,
      tenantId: ctx.tenantB.tenantId,
      venueId: other,
    });
    assert.equal(sneaky.status, 200);
    assert.equal((await ctx.mapRow(venue)).draftversion, 2, 'the path venue was saved');
    assert.equal(await ctx.mapRow(other), null, 'the body venue was not touched');
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-35

test('AC-35: sortBy and sortOrder never pick a column: an injected key, __proto__, constructor and a bad order give the default order and a 200', async () => {
  await withMapApp(async (ctx) => {
    await ctx.sql.venue(ctx.tenantA.tenantId, { name: 'Bravo' });
    await ctx.sql.venue(ctx.tenantA.tenantId, { name: 'Alpha' });
    const plain = (await ctx.get('/api/venues')).body.items.map((v) => v.name);
    assert.deepEqual([...plain].sort(), plain, 'the default order is by name');
    for (const query of [
      'sortBy=Name;DROP TABLE gabay.Venue',
      'sortBy=__proto__',
      'sortBy=constructor',
      'sortBy=toString&sortOrder=sideways',
      'sortOrder=desc',
      'sortBy[]=x',
      'sortBy=name&sortOrder=DESC',
    ]) {
      const res = await ctx.get(`/api/venues?${encodeURI(query)}`);
      assert.equal(res.status, 200, query);
      assert.deepEqual(
        res.body.items.map((v) => v.name),
        plain,
        `the order does not change: ${query}`,
      );
    }
    assert.equal(
      (
        await ctx.sql.one('SELECT count(*)::int AS n FROM gabay.Venue WHERE TenantId = $1', [
          ctx.tenantA.tenantId,
        ])
      ).n,
      plain.length,
      'nothing was dropped',
    );
  });
});

test('AC-35: /api/lookups/__proto__ and /constructor are 404; a lookup name selects only a key of LOOKUPS', async () => {
  await withMapApp(async (ctx) => {
    for (const name of [
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      'valueOf',
      'nope',
    ]) {
      const list = await ctx.get(`/api/lookups/${name}`);
      assert.equal(list.status, 404, name);
      assert.deepEqual(list.body, { error: 'Not found' });
      assert.equal((await ctx.get(`/api/lookups/${name}/1`)).status, 404, `${name}/1`);
    }
    assert.equal((await ctx.get('/api/lookups/building-types?sortBy=Label;DROP')).status, 200);
    assert.equal((await ctx.get('/api/lookups/building-types/0')).status, 404);
    assert.equal((await ctx.get('/api/lookups/building-types/abc')).status, 404);
  });
});

test('EC-28: ?page=2&page=3, ?sortBy[]=x and ?search[a]=b are a 200 with the defaults, never a 500', async () => {
  await withMapApp(async (ctx) => {
    for (const path of ['/api/venues', '/api/lookups/building-types']) {
      for (const query of [
        'page=2&page=3',
        'sortBy[]=x',
        'search[a]=b',
        'pageSize[]=1&pageSize[]=2',
      ]) {
        const res = await ctx.get(`${path}?${encodeURI(query)}`);
        assert.equal(res.status, 200, `${path}?${query}`);
        assert.equal(res.body.page, 1);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------------------ AC-39

const MALFORMED = { baseVersion: 'x' };
/** The routes with a body whose venue is looked up by the handler: [method, tail, a well-formed body]. */
const MAP_WRITES = [
  ['PUT', '/draft', () => ({ layout: docs.small(), baseVersion: 0 })],
  ['POST', '/publish', () => ({ baseVersion: 0 })],
  ['POST', '/clear', () => ({ baseVersion: 0 })],
  ['POST', '/rollback', () => ({ version: 1, baseVersion: 0 })],
];

test("AC-39, EC-19b: a MALL_ADMIN's malformed body to an unknown venue is 400 and a well-formed one is 404", async () => {
  await withMapApp(async (ctx) => {
    for (const [method, tail, good] of MAP_WRITES) {
      const url = ctx.mapUrl(999999999, tail);
      const bad = await ctx.call(method, url, { body: MALFORMED });
      assert.equal(bad.status, 400, `${method} ${tail}: ${bad.text}`);
      assertSafeRefusal(bad, `${method} ${tail}`);
      const ok = await ctx.call(method, url, { body: good() });
      assert.equal(ok.status, 404, `${method} ${tail}`);
      assert.deepEqual(ok.body, { error: 'Not found' });
    }
    // The same for another tenant's venue: the 400 is the same for a venue that exists and one that does not.
    const foreign = await ctx.mapVenue(ctx.tenantB);
    for (const [method, tail] of MAP_WRITES) {
      const bad = await ctx.call(method, ctx.mapUrl(foreign, tail), { body: MALFORMED });
      assert.equal(bad.status, 400, `${method} ${tail}`);
    }
  });
});

test("AC-39, EC-18: a VENUE_EDITOR's malformed body to an ungranted venue is 404 (the venue scope comes first); a VIEWER's is 403", async () => {
  await withMapApp(async (ctx) => {
    const ungranted = await ctx.sql.venue(ctx.tenantA.tenantId);
    for (const [method, tail] of MAP_WRITES.filter(([, t]) => t === '/draft' || t === '/clear')) {
      const res = await ctx.call(method, ctx.mapUrl(ungranted, tail), {
        body: MALFORMED,
        headers: ctx.as('VENUE_EDITOR'),
      });
      assert.equal(res.status, 404, `${method} ${tail}`);
      assert.deepEqual(res.body, { error: 'Not found' });
    }
    ctx.accessCache.invalidate(ctx.users.VENUE_EDITOR.userId); // its grants were read (and cached) above
    ctx.accessCache.invalidate(ctx.users.VIEWER.userId);
    const granted = await ctx.sql.venue(ctx.tenantA.tenantId, {
      grantTo: [ctx.users.VIEWER.userId, ctx.users.VENUE_EDITOR.userId],
    });
    for (const [method, tail] of MAP_WRITES) {
      const res = await ctx.call(method, ctx.mapUrl(granted, tail), {
        body: MALFORMED,
        headers: ctx.as('VIEWER'),
      });
      assert.equal(res.status, 403, `${method} ${tail}: a role guard answers before validate`);
    }
    // A granted VENUE_EDITOR's malformed body reaches validate: 400.
    const own = await ctx.call('PUT', ctx.mapUrl(granted, '/draft'), {
      body: MALFORMED,
      headers: ctx.as('VENUE_EDITOR'),
    });
    assert.equal(own.status, 400);
  });
});

test('AC-39: no tenant (400) and an unheld tenant (403) come before validate, and a malformed :venueId is 404 before the body', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const noTenant = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), {
      body: MALFORMED,
      headers: { 'x-tenant-id': null },
    });
    assert.equal(noTenant.status, 400);
    assert.match(noTenant.body.error, /^Choose a tenant/);
    const unheld = await ctx.call('PUT', ctx.mapUrl(venue, '/draft'), {
      body: MALFORMED,
      headers: ctx.asC,
    });
    assert.equal(unheld.status, 403);
    for (const id of ['abc', '0', '1.5']) {
      const res = await ctx.call('PUT', ctx.mapUrl(id, '/draft'), { body: MALFORMED });
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { error: 'Not found' });
    }
  });
});

test('AC-39, DC-24: the upload checks its venue before its body is read: an unknown venue is 404, a malformed id is 404', async () => {
  await withMapApp(async (ctx) => {
    const unknown = await ctx.upload(999999999, Buffer.from('not an image'));
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, { error: 'Not found' });
    const bad = await ctx.upload('abc', Buffer.from('not an image'));
    assert.equal(bad.status, 404);
  });
});
