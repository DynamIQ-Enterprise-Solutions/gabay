'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.1 and 2.3 "Body rules"): utils/fieldInput.js holds the body readers the
// services share: readText, readOptionalText, readDecimal, readInteger, readFlag, readUpdatedAt, refuseIfDifferent.
//
// CHANGED BY OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2 and the owner's ruling 18a Q4 (a), 2026-10-13): the building
// and level routes retired (AC-42) and the venue lost its map "up" angle (AC-43), so three readers (readDecimal,
// readInteger, readOptionalText) lost every caller and every route test that exercised them (buildings.test.js,
// levels.test.js and the angle cases of venues.test.js, all deleted or changed). fieldInput.js is kept (OA-4's store
// routes and R11's maintenance forms are their likely next callers), so their behaviour moves here as DIRECT UNIT
// CASES over the existing tables of fieldCases.js. readText, readFlag, readUpdatedAt and refuseIfDifferent are still
// tested through the venue routes (venues.test.js, updatedAtDates.test.js, edits.missingFields.test.js).
//
// The column objects below are the constants the retired services passed to readDecimal (venue.service.js and
// level.service.js at their last commit before OA-2), written out here because no service holds them any more.

const test = require('node:test');
const assert = require('node:assert/strict');
const { Decimal } = require('../src/utils/money');
const fieldInput = require('../src/utils/fieldInput');
const { BAD_DECIMAL_SHAPES, DECIMALS, TEXTS, astral } = require('./fieldCases');

const { readDecimal, readInteger, readOptionalText, INT_MIN, INT_MAX } = fieldInput;

test('fieldInput: exports the seven readers of the plan as functions', () => {
  for (const name of [
    'readText',
    'readOptionalText',
    'readDecimal',
    'readInteger',
    'readFlag',
    'readUpdatedAt',
    'refuseIfDifferent',
  ]) {
    assert.equal(typeof fieldInput[name], 'function', name);
  }
});

/** The readDecimal column of each row of DECIMALS (db/schema.sql's precision and scale; the plan's ranges). */
const COLUMNS = {
  venueMapUpDeg: {
    label: 'Map up angle',
    precision: 6,
    scale: 2,
    example: '90.50',
    blank: '0',
    min: '0',
    max: '360',
    maxExclusive: true,
  },
  buildingMapUpDeg: {
    label: 'Map up angle',
    precision: 6,
    scale: 2,
    example: '90.50',
    blank: null,
    min: '0',
    max: '360',
    maxExclusive: true,
  },
  elevationM: { label: 'Elevation', precision: 9, scale: 3, example: '-4.500', blank: '0' },
  widthM: {
    label: 'Width',
    precision: 9,
    scale: 3,
    example: '40.000',
    required: true,
    min: '0',
    minExclusive: true,
  },
  depthM: {
    label: 'Depth',
    precision: 9,
    scale: 3,
    example: '25.000',
    required: true,
    min: '0',
    minExclusive: true,
  },
  gridCellM: {
    label: 'Grid cell size',
    precision: 5,
    scale: 2,
    example: '0.50',
    blank: '1.00',
    min: '0.25',
    max: '2.00',
  },
  ceilingHeightM: {
    label: 'Ceiling height',
    precision: 5,
    scale: 2,
    example: '3.20',
    blank: null,
    min: '0',
    minExclusive: true,
  },
};

const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));

/** Asserts `fn` throws a 400 whose message matches `pattern` and never echoes a driver or constraint name. */
function assertRefused400(fn, pattern, note) {
  assert.throws(
    fn,
    (err) => {
      assert.equal(err.httpStatus, 400, note);
      assert.match(err.message, pattern, note);
      assert.doesNotMatch(err.message, /violates|constraint|gabay\./i, note);
      return true;
    },
    note,
  );
}

for (const [name, rule] of Object.entries(DECIMALS)) {
  const column = COLUMNS[name];

  test(`readDecimal ${name}: accepted values pass as sent, refused values and bad shapes are a 400 naming the field`, () => {
    assert.ok(column, `a column object for ${name}`);
    for (const [sent, stored] of rule.accepted) {
      const read = readDecimal({ [rule.key]: sent }, rule.key, column);
      assert.equal(read, sent, `${show(sent)} travels on as text, never rounded`);
      assert.ok(new Decimal(read).eq(new Decimal(stored)), `${show(sent)} equals ${stored}`);
    }
    for (const bad of [...rule.refused, ...BAD_DECIMAL_SHAPES]) {
      assertRefused400(
        () => readDecimal({ [rule.key]: bad }, rule.key, column),
        rule.label,
        `${name}=${show(bad)}`,
      );
    }
  });

  test(`readDecimal ${name}: blank means ${rule.blank}`, () => {
    for (const blank of [null, '']) {
      if (rule.blank === 'refused') {
        assertRefused400(
          () => readDecimal({ [rule.key]: blank }, rule.key, column),
          rule.label,
          `${name}=${show(blank)}`,
        );
      } else if (rule.blank === 'null') {
        assert.equal(readDecimal({ [rule.key]: blank }, rule.key, column), null);
      } else {
        const read = readDecimal({ [rule.key]: blank }, rule.key, column);
        assert.ok(new Decimal(read).eq(new Decimal(rule.blankStored)), `blank ${show(blank)}`);
      }
    }
    if (rule.blank === 'refused') {
      assertRefused400(() => readDecimal({}, rule.key, column), rule.label, 'missing key');
    }
  });
}

test('readDecimal: precision and scale come from the column: the largest value is accepted, one more integer digit or place is not', () => {
  for (const column of Object.values(COLUMNS)) {
    const integerDigits = column.precision - column.scale;
    const largest = `${'9'.repeat(integerDigits)}.${'9'.repeat(column.scale)}`;
    const loose = { ...column, min: undefined, max: undefined, minExclusive: false };
    assert.equal(readDecimal({ v: largest }, 'v', loose), largest, column.label);
    assertRefused400(
      () => readDecimal({ v: `1${'0'.repeat(integerDigits)}` }, 'v', loose),
      new RegExp(column.label),
      `${column.label} one more integer digit`,
    );
    assertRefused400(
      () => readDecimal({ v: `0.${'1'.repeat(column.scale + 1)}` }, 'v', loose),
      new RegExp(column.label),
      `${column.label} one more place`,
    );
  }
});

test('readInteger: a JSON integer inside the range; the INT limits by default; null and missing are "is required"', () => {
  for (const value of [0, 1, -1, 7, INT_MAX, INT_MIN]) {
    assert.equal(readInteger({ ordinal: value }, 'ordinal', 'Ordinal'), value);
  }
  assert.equal(INT_MAX, 2147483647);
  assert.equal(INT_MIN, -2147483648);
  for (const bad of [
    INT_MAX + 1,
    INT_MIN - 1,
    1.5,
    '1',
    '',
    true,
    false,
    [],
    {},
    NaN,
    Infinity,
    1e21,
  ]) {
    assertRefused400(
      () => readInteger({ ordinal: bad }, 'ordinal', 'Ordinal'),
      /^Ordinal must be a whole number/,
      show(bad),
    );
  }
  for (const body of [{}, { ordinal: null }, { ordinal: undefined }]) {
    assertRefused400(
      () => readInteger(body, 'ordinal', 'Ordinal'),
      /^Ordinal is required$/,
      show(body),
    );
  }
  assert.equal(readInteger({ n: 5 }, 'n', 'N', { min: 5, max: 5 }), 5);
  assertRefused400(
    () => readInteger({ n: 6 }, 'n', 'N', { min: 0, max: 5 }),
    /^N must be/,
    '6 is above 5',
  );
  assertRefused400(
    () => readInteger({ n: -1 }, 'n', 'N', { min: 0, max: 5 }),
    /^N must be/,
    '-1 is below 0',
  );
});

test('readOptionalText: trimmed, counted in characters not bytes, blank is NULL, anything but text is refused, a control character is refused', () => {
  const { key, max } = TEXTS.levelSpokenName;
  const read = (value) => readOptionalText({ [key]: value }, key, 'Spoken name', max);
  assert.equal(read('a'.repeat(max)), 'a'.repeat(max));
  assert.equal(read('Ñ'.repeat(max)), 'Ñ'.repeat(max));
  assert.equal(read(astral(max)), astral(max), 'astral characters count once each');
  assert.equal(read(`  ${'b'.repeat(max)}  `), 'b'.repeat(max), 'trimmed first, then counted');
  assert.equal(read('  x  '), 'x');
  for (const tooLong of ['a'.repeat(max + 1), 'Ñ'.repeat(max + 1), astral(max + 1)]) {
    assertRefused400(
      () => read(tooLong),
      /^Spoken name must be at most 100 characters$/,
      'too long',
    );
  }
  for (const blank of [null, '', '   ', '\t\n ']) assert.equal(read(blank), null, show(blank));
  assert.equal(readOptionalText({}, key, 'Spoken name', max), null, 'a missing key is NULL');
  for (const bad of [5, true, [], {}]) {
    assertRefused400(() => read(bad), /^Spoken name must be text$/, show(bad));
  }
  assertRefused400(() => read('a\u0000b'), /cannot be stored/, 'control character');
});
