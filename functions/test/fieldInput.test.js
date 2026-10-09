'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.1 and 2.3 "Body rules"): utils/fieldInput.js holds the body readers the three
// services share: readText, readOptionalText, readDecimal, readInteger, readFlag, readUpdatedAt, refuseIfDifferent.
//
// WHAT THIS FILE DOES NOT DO, AND WHY. The plan names the seven functions but not their parameters, so a unit test that
// called them would invent an interface the plan leaves open, and the two coders of the L117 trial could each read it
// differently. The behaviour the plan assigns to fieldInput is instead tested where it is observable and the same for any
// signature: through the real routes, with the tables of fieldCases.js and the checks of fieldChecks.js, for every field of
// every record kind, on create and on edit:
//   venues.test.js      Code, Name (required, trimmed, 40 / 200 characters, code points not bytes), MapUpDeg, isActive
//   buildings.test.js   Name, MapUpDeg, the type id, updatedAt, the read-only keys
//   levels.test.js      Name, ShortName, SpokenName, ElevationM, WidthM, DepthM, GridCellM, CeilingHeightM, Ordinal
// Those tables cover: ".5" and "5." (AC-38), a comma, spaces, "1e3", a JSON number, the decimal limits of the spec (999999.999,
// 0.001, 359.99 / 360.00, 0.25 / 2.00 / 0.24 / 2.01, 0.01 / 999.99), one place too many (never rounded), the INT limits of
// Ordinal, whitespace-only required text, a blank optional stored as NULL, "Paranañaque Annex" and astral characters counted
// as characters, updatedAt null or ISO, and a read-only key that differs (400) or equals (ignored).
//
// What is fixed here is the module's export surface: these seven names, as functions.

const test = require('node:test');
const assert = require('node:assert/strict');
const fieldInput = require('../src/utils/fieldInput');

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
