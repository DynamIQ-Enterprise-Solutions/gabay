// Test support for FF-1: the input rules of plan section 2.3 as tables, shared by the three record kinds' API tests and by
// fieldInput.test.js. Not a test file.
//
// Labels are matched loosely (the plan fixes only that "a validation message starts with the field's name as the form
// labels it"): `label` is a regular expression a person-facing message about that field would match.
'use strict';

/** Values no decimal field accepts, whatever its range: the shape rule (^-?\d+(\.\d+)?$), G3 and AC-38. */
const BAD_DECIMAL_SHAPES = [
  '.5',
  '5.',
  '-.5',
  '1,5',
  '1 000',
  ' 1',
  '1 ',
  '1e3',
  '1E3',
  'abc',
  '--1',
  '+1',
  '1.2.3',
  '0x10',
  '-',
  '.',
  '٣',
  5, // a JSON number
  1.5,
  0,
  true,
  false,
  [],
  {},
  ['1'],
];

/**
 * Per decimal column of plan section 2.3: accepted pairs [sent, stored as text], refused values (range, places,
 * integer digits), what blank means (`blank`: 'default' | 'null' | 'refused') and the stored text of the default.
 */
const DECIMALS = {
  venueMapUpDeg: {
    key: 'mapUpDeg',
    label: /angle|map up/i,
    accepted: [
      ['0', '0.00'],
      ['0.00', '0.00'],
      ['12', '12.00'],
      ['12.5', '12.50'],
      ['90.50', '90.50'],
      ['359.99', '359.99'],
    ],
    refused: [
      '360',
      '360.00',
      '360.0',
      '-0.01',
      '-1',
      '1000',
      '10000',
      '1.234',
      '359.999',
      '99999.99',
    ],
    blank: 'default',
    blankStored: '0.00',
  },
  buildingMapUpDeg: {
    key: 'mapUpDeg',
    label: /angle|map up/i,
    accepted: [
      ['0', '0.00'],
      ['12.5', '12.50'],
      ['359.99', '359.99'],
    ],
    refused: ['360', '360.00', '-0.01', '-1', '10000', '1.234', '359.999'],
    blank: 'null',
    blankStored: null,
  },
  elevationM: {
    key: 'elevationM',
    label: /elevation/i,
    accepted: [
      ['0', '0.000'],
      ['-4.5', '-4.500'],
      ['12', '12.000'],
      ['999999.999', '999999.999'],
      ['-999999.999', '-999999.999'],
    ],
    refused: ['1000000', '1000000.000', '-1000000', '0.0001', '1.2345', '-999999.9999'],
    blank: 'default',
    blankStored: '0.000',
  },
  widthM: {
    key: 'widthM',
    label: /width/i,
    accepted: [
      ['0.001', '0.001'],
      ['40', '40.000'],
      ['999999.999', '999999.999'],
    ],
    refused: ['0', '0.0', '0.000', '-1', '-0.001', '1000000', '0.0001'],
    blank: 'refused',
  },
  depthM: {
    key: 'depthM',
    label: /depth/i,
    accepted: [
      ['0.001', '0.001'],
      ['25', '25.000'],
      ['999999.999', '999999.999'],
    ],
    refused: ['0', '0.0', '0.000', '-1', '-0.001', '1000000', '0.0001'],
    blank: 'refused',
  },
  gridCellM: {
    key: 'gridCellM',
    label: /grid/i,
    accepted: [
      ['0.25', '0.25'],
      ['2.00', '2.00'],
      ['2', '2.00'],
      ['1.5', '1.50'],
    ],
    refused: ['0.24', '2.01', '0', '-1', '0.249', '1.999', '3', '1000', '12345.00'],
    blank: 'default',
    blankStored: '1.00',
  },
  ceilingHeightM: {
    key: 'ceilingHeightM',
    label: /ceiling/i,
    accepted: [
      ['0.01', '0.01'],
      ['3', '3.00'],
      ['3.2', '3.20'],
      ['999.99', '999.99'],
    ],
    refused: ['0', '0.00', '-1', '-0.01', '0.001', '1000', '1000.00', '3.205'],
    blank: 'null',
    blankStored: null,
  },
};

const astral = (n) => '\u{1F600}'.repeat(n); // each is two UTF-16 units and one character

/** Text columns: key, label, max length and whether a blank is refused. OA-2: the building and level rows retired with their routes. */
const TEXTS = {
  venueCode: { key: 'code', label: /code/i, max: 40, required: true },
  venueName: { key: 'name', label: /name/i, max: 200, required: true },

  levelSpokenName: { key: 'spokenName', label: /spoken/i, max: 100, required: false },
};

/** Values that are not text, or are blank text: refused for a required text field. */
const BLANK_OR_NOT_TEXT = ['', '   ', '\t\n ', 5, true, [], {}];

module.exports = { BAD_DECIMAL_SHAPES, DECIMALS, TEXTS, BLANK_OR_NOT_TEXT, astral };
