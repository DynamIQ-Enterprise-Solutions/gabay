// Test support for FF-1: runs the tables of fieldCases.js against one field of one record kind, on create and on edit.
// Not a test file. The io object belongs to the calling test:
//   create(value)   sends a valid create body with this field set to `value` (undefined omits the key); returns { status, body }
//   update(value)   loads the record, sends a valid edit body (with the loaded updatedAt) with this field set; same return
//   count()         how many rows of this kind the setup holds (refused requests must not change it)
//   snapshot()      the record the update targets, as the API shows it (a refused edit must not change it)
'use strict';

const assert = require('node:assert/strict');
const { assertRefused } = require('./venueApp');
const { BAD_DECIMAL_SHAPES, BLANK_OR_NOT_TEXT, astral } = require('./fieldCases');

const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));

/** A refused create and a refused edit, for each value; nothing is written and nothing changes. */
async function assertRefusedEverywhere(io, rule, values, { create = true, update = true } = {}) {
  const rowsBefore = await io.count();
  const shownBefore = await io.snapshot();
  for (const value of values) {
    if (create) {
      assertRefused(await io.create(value), 400, rule.label, `create ${rule.key}=${show(value)}`);
    }
    if (update) {
      assertRefused(await io.update(value), 400, rule.label, `update ${rule.key}=${show(value)}`);
    }
  }
  assert.equal(await io.count(), rowsBefore, `${rule.key}: a refused create wrote a row`);
  assert.deepEqual(await io.snapshot(), shownBefore, `${rule.key}: a refused edit changed the row`);
}

/** One decimal column: accepted values stored exactly and never rounded, refused values, blank, and the bad shapes. */
async function assertDecimalRule(rule, io) {
  for (const [sent, stored] of rule.accepted) {
    const made = await io.create(sent);
    assert.equal(made.status, 201, `create ${rule.key}=${show(sent)} ${JSON.stringify(made.body)}`);
    assert.equal(made.body[rule.key], stored, `create ${rule.key}=${show(sent)}`);
    const edited = await io.update(sent);
    assert.equal(
      edited.status,
      200,
      `update ${rule.key}=${show(sent)} ${JSON.stringify(edited.body)}`,
    );
    assert.equal(edited.body[rule.key], stored, `update ${rule.key}=${show(sent)}`);
  }
  await assertRefusedEverywhere(io, rule, rule.refused);
  await assertRefusedEverywhere(io, rule, BAD_DECIMAL_SHAPES);
  for (const blank of [null, '']) {
    if (rule.blank === 'refused') {
      await assertRefusedEverywhere(io, rule, [blank]);
      continue;
    }
    const made = await io.create(blank);
    assert.equal(
      made.status,
      201,
      `create ${rule.key}=${show(blank)} ${JSON.stringify(made.body)}`,
    );
    assert.equal(made.body[rule.key], rule.blankStored, `create blank ${show(blank)}`);
    const edited = await io.update(blank);
    assert.equal(edited.status, 200, `update ${rule.key}=${show(blank)}`);
    assert.equal(edited.body[rule.key], rule.blankStored, `update blank ${show(blank)}`);
  }
  if (rule.blank === 'refused') await assertRefusedEverywhere(io, rule, [undefined]);
}

/** One text column: the exact maximum, one more, characters not bytes (DC-5), trimming, blanks. */
async function assertTextRule(rule, io) {
  const { max } = rule;
  const same = async (value, stored = value) => {
    const made = await io.create(value);
    assert.equal(
      made.status,
      201,
      `create ${rule.key} (${[...String(value)].length} chars) ${JSON.stringify(made.body)}`,
    );
    assert.equal(made.body[rule.key], stored, `create ${rule.key}`);
    const edited = await io.update(value);
    assert.equal(
      edited.status,
      200,
      `update ${rule.key} (${[...String(value)].length} chars) ${JSON.stringify(edited.body)}`,
    );
    assert.equal(edited.body[rule.key], stored, `update ${rule.key}`);
  };
  await same('a'.repeat(max));
  await same('Ñ'.repeat(max));
  await same(astral(max));
  await same(`  ${'b'.repeat(max)}  `, 'b'.repeat(max)); // trimmed first, then counted
  await same('  x  ', 'x');
  await assertRefusedEverywhere(io, rule, [
    'a'.repeat(max + 1),
    'Ñ'.repeat(max + 1),
    astral(max + 1),
  ]);
  if (rule.required) {
    await assertRefusedEverywhere(io, rule, [undefined, null, ...BLANK_OR_NOT_TEXT]);
  } else {
    for (const blank of [null, '', '   ']) {
      const made = await io.create(blank);
      assert.equal(made.status, 201, `create ${rule.key}=${show(blank)}`);
      assert.equal(made.body[rule.key], null, `blank ${show(blank)} stores NULL`);
      const edited = await io.update(blank);
      assert.equal(edited.status, 200, `update ${rule.key}=${show(blank)}`);
      assert.equal(edited.body[rule.key], null);
    }
    await assertRefusedEverywhere(io, rule, [5, true, [], {}]);
  }
}

module.exports = { assertDecimalRule, assertTextRule, assertRefusedEverywhere };
