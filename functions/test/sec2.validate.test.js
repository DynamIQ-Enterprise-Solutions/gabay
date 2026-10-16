// SEC-2 step 3: the validate step (spec/SEC-2.md r2 AC-32, AC-35, AC-38; EC-28; plan DC-33, DC-34). Unit tests with fake
// requests; sec2.validation.test.js drives every route over HTTP.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const qs = require('node:querystring');
const { validate, FALLBACK } = require('../src/middleware/validate');
const {
  venueIdParam,
  lookupNameParam,
  lookupItemParams,
  backdropKeyParam,
} = require('../src/validation/params');
const { pagingQuery } = require('../src/validation/query');
const { fakeLogger } = require('./helpers');

/** Runs the step on a fake request; returns { err, req, nextCalled }. */
function run(schemas, req) {
  let outcome = { nextCalled: false, err: undefined };
  req.log ??= fakeLogger();
  validate(schemas)(req, {}, (err) => {
    outcome = { nextCalled: true, err };
  });
  return { ...outcome, log: undefined };
}

const custom = (message) =>
  z.unknown().transform((value, ctx) => {
    if (typeof value === 'string') return value;
    ctx.issues.push({ code: 'custom', message, input: value });
    return z.NEVER;
  });

test('validate: with no schema it is a step that passes and sets req.valid to {}', () => {
  const req = {};
  const { nextCalled, err } = run(undefined, req);
  assert.equal(nextCalled, true);
  assert.equal(err, undefined);
  const ok = { params: {}, query: {}, body: {} };
  validate()(ok, {}, () => {});
  assert.deepEqual(ok.valid, {});
});

test('validate: a params failure is 404 "Not found", whatever the schema says', () => {
  for (const params of [{ venueId: 'abc' }, { venueId: '0' }, { venueId: '12345678901' }, {}]) {
    const { err } = run({ params: venueIdParam }, { params });
    assert.equal(err.httpStatus, 404, JSON.stringify(params));
    assert.equal(err.message, 'Not found');
  }
});

test('validate: params that pass are given as numbers in req.valid.params; other params are stripped', () => {
  const req = { params: { venueId: '42', extra: 'x' } };
  const { err } = run({ params: venueIdParam }, req);
  assert.equal(err, undefined);
  assert.deepEqual(req.valid.params, { venueId: 42 });
});

test('AC-35: lookup names are the keys of LOOKUPS and nothing else; __proto__ and constructor are 404', () => {
  assert.equal(
    run({ params: lookupNameParam }, { params: { name: 'building-types' } }).err,
    undefined,
  );
  for (const name of [
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    'nope',
    '',
    'BUILDING-TYPES',
  ]) {
    assert.equal(run({ params: lookupNameParam }, { params: { name } }).err?.httpStatus, 404, name);
  }
  const item = { params: { name: 'amenity-types', id: '7' } };
  assert.equal(run({ params: lookupItemParams }, item).err, undefined);
  assert.deepEqual(item.valid.params, { name: 'amenity-types', id: 7 });
  assert.equal(
    run({ params: lookupItemParams }, { params: { name: 'amenity-types', id: '07' } }).err
      .httpStatus,
    404,
  );
});

test("AC-33: a backdrop key is the schema file's pattern; a failure is 404", () => {
  const key = '0123456789abcdef0123456789abcdef';
  const req = { params: { venueId: '5', key } };
  assert.equal(run({ params: backdropKeyParam }, req).err, undefined);
  assert.deepEqual(req.valid.params, { venueId: 5, key });
  for (const bad of ['', key.toUpperCase(), key.slice(1), `${key}0`, 'g'.repeat(32)]) {
    assert.equal(
      run({ params: backdropKeyParam }, { params: { venueId: '5', key: bad } }).err?.httpStatus,
      404,
    );
  }
});

test('EC-28: the paging query is lenient: ?page=2&page=3, ?sortBy[]=x and ?search[a]=b take the defaults, with no error', () => {
  for (const raw of ['page=2&page=3', 'sortBy[]=x', 'search[a]=b', 'pageSize[]=1&pageSize[]=2']) {
    const query = qs.parse(raw);
    const req = { query };
    const { err } = run({ query: pagingQuery }, req);
    assert.equal(err, undefined, raw);
    assert.equal(req.valid.query.page, undefined, raw);
    assert.equal(req.valid.query.search, undefined, raw);
  }
  const req = {
    query: { page: '2', pageSize: '10', search: 'mall', sortBy: 'x;DROP', sortOrder: 'sideways' },
  };
  run({ query: pagingQuery }, req);
  assert.deepEqual(
    { ...req.valid.query },
    { page: '2', pageSize: '10', search: 'mall' },
    'sortBy and sortOrder are stripped',
  );
});

test("validate: a body failure is a 400 with the FIRST issue's message, in the schema's key order", () => {
  const body = z.object({ a: custom('A must be text'), b: custom('B must be text') });
  const { err } = run({ body }, { body: { a: 1, b: 2 } });
  assert.equal(err.httpStatus, 400);
  assert.equal(err.message, 'A must be text');
  assert.equal(run({ body }, { body: { b: 2, a: 'ok' } }).err.message, 'B must be text');
});

test("AC-38, DC-34: an issue that is not a schema's own never reaches a client: the fallback, and one warn without the value", () => {
  const log = fakeLogger();
  const body = z.object({ code: z.string() }); // a forgotten message: zod's own invalid_type
  let err;
  validate({ body })({ log, body: { code: 'SECRET-VALUE-9' } }, {}, () => {});
  validate({ body })({ log, body: { code: 12345 } }, {}, (e) => (err = e));
  assert.equal(err.httpStatus, 400);
  assert.equal(err.message, FALLBACK);
  assert.equal(FALLBACK, 'The request is not valid');
  assert.doesNotMatch(err.message, /zod|Invalid input|expected|received|code/i);
  assert.equal(log.calls.warn.length, 1);
  const logged = JSON.stringify(log.calls.warn[0]);
  assert.match(logged, /invalid_type/);
  assert.equal(logged.includes('12345'), false, 'the received value is not logged either');
});

test('validate: it sets req.valid with the parsed values of every source it was given', () => {
  const req = { params: { venueId: '3' }, query: { page: '2' }, body: 'text' };
  const { err } = run(
    { params: venueIdParam, query: pagingQuery, body: custom('Body must be text') },
    req,
  );
  assert.equal(err, undefined);
  assert.deepEqual({ ...req.valid.params }, { venueId: 3 });
  assert.equal(req.valid.query.page, '2');
  assert.equal(req.valid.body, 'text');
});

test('validate: the order of the sources is params, query, body: a bad id is 404 even when the body is bad too', () => {
  const body = custom('Body must be text');
  const { err } = run({ params: venueIdParam, body }, { params: { venueId: 'x' }, body: 5 });
  assert.equal(err.httpStatus, 404);
});
