// Numbers (spec/OA-1.md r1 AC-13, AC-15, AC-16, AC-17; DC-10; plan DC-O4). Every metre, degree and ratio value is
// rounded to 3 decimals, mpp and lat/lon to 7 (the schema file's number kinds), half away from zero on the number's
// decimal text as JSON writes it (decimal.js ROUND_HALF_UP on String(x)); -0 is written 0. A degree value is rounded
// first, then normalised to [0, 360) in decimal arithmetic, because binary floating point drifts (3600.001 % 360 is
// 0.0010000000002037268). Ranges are checked on the rounded value (AC-16). The rounding vectors are in
// functions/src/config/venue-map-rounding-vectors.json.
'use strict';

const Decimal = require('decimal.js');

const noNegativeZero = (n) => (n === 0 ? 0 : n);

/** `x` rounded to `decimals` places, half away from zero on its decimal text; never -0. */
function roundTo(x, decimals) {
  if (Number.isInteger(x)) return noNegativeZero(x);
  const text = String(x);
  if (!text.includes('e')) {
    const dot = text.indexOf('.');
    if (text.length - dot - 1 <= decimals) return x; // already that short: rounding changes nothing
  }
  const rounded = new Decimal(text).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
  return noNegativeZero(rounded);
}

/** An already rounded angle brought into [0, turn); 360 is 0, -90 is 270. */
function normaliseAngle(x, turn) {
  if (x >= 0 && x < turn) return x;
  let d = new Decimal(String(x)).mod(turn);
  if (d.isNegative()) d = d.plus(turn);
  if (d.gte(turn)) d = d.minus(turn);
  return noNegativeZero(d.toNumber());
}

/** Why `value` is not a usable number, or null when it is one. */
function numberProblem(value) {
  if (typeof value !== 'number') return 'must be a number';
  if (!Number.isFinite(value)) return 'is not a finite number';
  return null;
}

/** Why `value` is not a whole number, or null when it is one. */
function integerProblem(value) {
  if (typeof value !== 'number') return 'must be a whole number';
  if (!Number.isFinite(value)) return 'is not a finite number';
  if (!Number.isInteger(value)) return 'must be a whole number';
  return null;
}

/** "from 0.05 to 1", "above 0", "at least 1", ...: the range in words, with its numbers. */
function describeRange({ min, max, minExclusive }) {
  if (min !== undefined && max !== undefined) return `from ${min} to ${max}`;
  if (minExclusive !== undefined && max !== undefined) {
    return `above ${minExclusive} and at most ${max}`;
  }
  if (min !== undefined) return `at least ${min}`;
  if (minExclusive !== undefined) return `above ${minExclusive}`;
  return `at most ${max}`;
}

/** "must be from 0.05 to 1" when `v` is outside the range, otherwise null. */
function rangeProblem(v, range) {
  const { min, max, minExclusive } = range;
  const below =
    (min !== undefined && v < min) || (minExclusive !== undefined && !(v > minExclusive));
  const above = max !== undefined && v > max;
  if (!below && !above) return null;
  return `must be ${describeRange(range)}`;
}

module.exports = {
  roundTo,
  normaliseAngle,
  numberProblem,
  integerProblem,
  describeRange,
  rangeProblem,
};
