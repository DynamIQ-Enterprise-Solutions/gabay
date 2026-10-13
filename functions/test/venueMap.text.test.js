'use strict';

// Text (spec/OA-1.md r1 section 3.4; plan/OA-1-map-document.md 1.0 section 9): AC-18; EC-12. Written FIRST: every case
// fails until engine-coder builds the validator.

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { validate, assertOneProblemAt } = require('./fixtures/mapAsserts');

/** A document where `value` is a building's name (required, 200), a level's short name (required, 10) or an amenity's name (optional). */
const withName = (value) => {
  const doc = b.smallDoc();
  doc.buildings[0].name = value;
  return doc;
};
const withShortName = (value) => {
  const doc = b.smallDoc();
  doc.levels[0].shortName = value;
  return doc;
};
const withAmenityName = (value) => {
  const doc = b.smallDoc();
  doc.levels[0].amenities = [b.amenity('a1', { name: value })];
  return doc;
};

test('AC-18: text is trimmed of leading and trailing white space (spaces, tabs, line breaks)', () => {
  for (const [given, want] of [
    ['  Main  ', 'Main'],
    ['\tMain\n', 'Main'],
    ['\r\nMain Building \t', 'Main Building'],
  ]) {
    const res = validate(withName(given));
    assert.equal(res.ok, true, JSON.stringify([given, res.problems]));
    assert.equal(res.map.buildings[0].name, want);
  }
});

test('AC-18: a required text that is empty after trimming gives one problem at its path', () => {
  for (const empty of ['', '   ', '\t\n ', ' ']) {
    assertOneProblemAt(validate(withName(empty)), 'buildings[0].name', JSON.stringify(empty));
    assertOneProblemAt(
      validate(withShortName(empty)),
      'levels[0].shortName',
      JSON.stringify(empty),
    );
  }
});

test('AC-18: an optional text that is empty after trimming is left out of the canonical copy', () => {
  for (const empty of ['', '   ', '\t ']) {
    const res = validate(withAmenityName(empty));
    assert.equal(res.ok, true, JSON.stringify([empty, res.problems]));
    assert.equal('name' in res.map.levels[0].amenities[0], false, JSON.stringify(empty));
  }
});

test('AC-18: a control character U+0000 to U+001F or U+007F inside a text gives one problem at its path (DC-12)', () => {
  const controls = [...Array.from({ length: 32 }, (_, i) => i), 0x7f];
  for (const code of controls) {
    const text = `Ma${String.fromCharCode(code)}in`;
    assertOneProblemAt(
      validate(withName(text)),
      'buildings[0].name',
      `U+${code.toString(16).padStart(4, '0')} inside`,
    );
  }
});

test('AC-18: a control character at the start or end that is not white space is refused too', () => {
  for (const text of ['\u0001Main', 'Main\u0000', '\u007fMain', 'Main\u001f']) {
    assertOneProblemAt(validate(withName(text)), 'buildings[0].name', JSON.stringify(text));
  }
});

test('AC-18: a control character in an optional text is refused as well', () => {
  assertOneProblemAt(validate(withAmenityName('Rest\u0007room')), 'levels[0].amenities[0].name');
});

const MIXED_200 = 'ñ' + '\u{1F600}' + 'a'.repeat(198); // 200 code points, 201 UTF-16 units

test('AC-18 and EC-12: a 200-code-point name with "ñ" and an emoji is accepted and kept whole; 201 code points are refused', () => {
  assert.equal([...MIXED_200].length, 200);
  const ok = validate(withName(MIXED_200));
  assert.equal(ok.ok, true, JSON.stringify(ok.problems));
  assert.equal(ok.map.buildings[0].name, MIXED_200);
  assertOneProblemAt(validate(withName(MIXED_200 + 'b')), 'buildings[0].name');
});

test('AC-18: length is counted in code points on a short field too (ten emoji fit a 10-character short name, eleven do not)', () => {
  const ten = '\u{1F600}'.repeat(10);
  const ok = validate(withShortName(ten));
  assert.equal(ok.ok, true, JSON.stringify(ok.problems));
  assert.equal(ok.map.levels[0].shortName, ten);
  assertOneProblemAt(validate(withShortName(ten + '\u{1F600}')), 'levels[0].shortName');
});

test('AC-18: the other text limits are held (level name 100, item label 40, correction note 200)', () => {
  const lvl = b.smallDoc();
  lvl.levels[0].name = 'x'.repeat(101);
  assertOneProblemAt(validate(lvl), 'levels[0].name');
  lvl.levels[0].name = 'x'.repeat(100);
  assert.equal(validate(lvl).ok, true);

  const label = b.smallDoc();
  label.levels[0].items = [b.item('i1', { label: 'x'.repeat(41) })];
  assertOneProblemAt(validate(label), 'levels[0].items[0].label');
  label.levels[0].items[0].label = 'x'.repeat(40);
  assert.equal(validate(label).ok, true);

  const note = b.smallDoc();
  note.levels[0].corrections = [b.correction('c1', { note: 'x'.repeat(201) })];
  assertOneProblemAt(validate(note), 'levels[0].corrections[0].note');
});

test('AC-18: a text field holding a number, boolean, array or null gives one problem at its path', () => {
  for (const bad of [12, true, ['Main'], {}, null]) {
    assertOneProblemAt(validate(withName(bad)), 'buildings[0].name', JSON.stringify(bad));
  }
});

test('AC-18: a name is single-line: a line break inside is refused, outside is trimmed', () => {
  assertOneProblemAt(validate(withName('Main\nBuilding')), 'buildings[0].name');
  assert.equal(validate(withName('Main\n')).map.buildings[0].name, 'Main');
});
