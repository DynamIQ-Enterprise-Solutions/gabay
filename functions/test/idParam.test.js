'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.1, G4): parseIdParam(text) turns an id in a URL into an integer, or throws a 404
// before any query. The pattern is ^[1-9]\d{0,8}$: a positive integer of at most nine digits, so 0, a leading zero, a sign,
// a point, an exponent, spaces and anything longer are all 404 (never a 500 from a 32-bit column).

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseIdParam } = require('../src/utils/idParam');

const is404 = (err) => err.httpStatus === 404;

test('parseIdParam: a positive integer of one to nine digits is returned as a number', () => {
  assert.equal(parseIdParam('1'), 1);
  assert.equal(parseIdParam('12'), 12);
  assert.equal(parseIdParam('40'), 40);
  assert.equal(parseIdParam('100'), 100);
  assert.equal(parseIdParam('999999999'), 999999999);
  assert.equal(typeof parseIdParam('7'), 'number');
});

test('parseIdParam: 0 is refused up front, with a 404 and not a 500 (G4)', () => {
  assert.throws(() => parseIdParam('0'), is404);
  assert.throws(() => parseIdParam('00'), is404);
});

test('parseIdParam: anything that is not a plain positive integer is a 404', () => {
  for (const text of [
    '',
    ' ',
    ' 1',
    '1 ',
    '1\n',
    '01',
    '-1',
    '+1',
    '1.0',
    '1.5',
    '1e3',
    '0x1',
    'abc',
    '1a',
    'a1',
    '1,000',
    '1_000',
    '١',
    '1000000000', // ten digits: past what a lookup or a row id can be
    '2147483648',
    '99999999999999999999',
    'null',
    'undefined',
    '__proto__',
    '%00',
    '../1',
  ]) {
    assert.throws(() => parseIdParam(text), is404, JSON.stringify(text));
  }
});

test('parseIdParam: a value that is not text at all is a 404 too', () => {
  for (const value of [undefined, null, {}, [], true]) {
    assert.throws(() => parseIdParam(value), is404, String(value));
  }
});
