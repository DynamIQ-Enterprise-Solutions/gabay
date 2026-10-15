'use strict';

// SEC-2 (spec/SEC-2.md r2 AC-34, AC-37; plan/SEC-2.md 1.0 section 2, C1): this file REPLACES fieldInput.test.js. The venue
// field readers of utils/fieldInput.js (readText, readFlag, readUpdatedAt, refuseMissing, readBody) became zod schemas in
// validation/fields.js and validation/venueBodies.js with their logic and their words; the same fieldCases.js tables drive
// them here. The decimal, integer and optional-text cases went with their readers (readDecimal, readInteger,
// readOptionalText), which no route has used since FF-1's building and level routes retired and which AC-37 deletes. What
// stays in utils/fieldInput.js (refuseIfDifferent and the two stamp checks) is still tested through the venue routes
// (venues.test.js, edits.missingFields.test.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { requiredText, flag, presence, updatedAt, jsonObject } = require('../src/validation/fields');
const { venueCreateBody, venueEditBody } = require('../src/validation/venueBodies');
const { TEXTS, BLANK_OR_NOT_TEXT, astral } = require('./fieldCases');

const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));

/** The first issue's message of a failed parse; asserts it is a schema's own (code custom) and never zod's text. */
function firstMessage(result, note) {
  assert.equal(result.success, false, note);
  const [issue] = result.error.issues;
  assert.equal(issue.code, 'custom', `${note}: a schema's own message`);
  assert.doesNotMatch(issue.message, /zod|Invalid input|expected|received/i, note);
  return issue.message;
}

for (const [name, rule] of Object.entries(TEXTS).filter(([, r]) => r.required)) {
  const label = rule.key === 'code' ? 'Code' : 'Name';
  const schema = requiredText(label, rule.max);

  test(`requiredText ${name}: trimmed, counted in characters, refused beyond ${rule.max}`, () => {
    for (const ok of [
      'a'.repeat(rule.max),
      'Ñ'.repeat(rule.max),
      astral(rule.max),
      `  ${'b'.repeat(rule.max)}  `,
    ]) {
      const read = schema.safeParse(ok);
      assert.equal(read.success, true, show(ok).slice(0, 30));
      assert.equal(read.data, ok.trim());
    }
    for (const tooLong of [
      'a'.repeat(rule.max + 1),
      'Ñ'.repeat(rule.max + 1),
      astral(rule.max + 1),
    ]) {
      assert.equal(
        firstMessage(schema.safeParse(tooLong), name),
        `${label} must be at most ${rule.max} characters`,
      );
    }
  });

  test(`requiredText ${name}: blank or missing is "is required"; anything but text is "must be text"; a control character is refused`, () => {
    for (const blank of [undefined, null, '', '   ', '\t\n ']) {
      assert.equal(firstMessage(schema.safeParse(blank), show(blank)), `${label} is required`);
    }
    for (const bad of BLANK_OR_NOT_TEXT.filter((v) => typeof v !== 'string')) {
      assert.equal(firstMessage(schema.safeParse(bad), show(bad)), `${label} must be text`);
    }
    assert.equal(
      firstMessage(schema.safeParse('a\u0000b'), 'NUL'),
      `${label} contains a character that cannot be stored`,
    );
    assert.equal(
      firstMessage(schema.safeParse('a\u007fb'), 'DEL'),
      `${label} contains a character that cannot be stored`,
    );
  });
}

test('flag: a JSON boolean, nothing else', () => {
  const schema = flag('Active');
  assert.equal(schema.parse(true), true);
  assert.equal(schema.parse(false), false);
  for (const bad of [undefined, null, 'true', 1, 0, [], {}]) {
    assert.equal(firstMessage(schema.safeParse(bad), show(bad)), 'Active must be true or false');
  }
});

test('presence: every missing key in the form order; null and "" are not missing', () => {
  const schema = presence([
    ['code', 'Code'],
    ['name', 'Name'],
  ]);
  assert.deepEqual(schema.parse({ code: null, name: '' }), { code: null, name: '' });
  const none = schema.safeParse({});
  assert.deepEqual(
    none.error.issues.map((i) => i.message),
    ['Code is missing', 'Name is missing'],
  );
  assert.equal(firstMessage(schema.safeParse({ name: 'x' }), 'code only'), 'Code is missing');
});

test('jsonObject: only a plain object passes; the message is the one given', () => {
  const schema = jsonObject('Send an object');
  assert.deepEqual(schema.parse({ a: 1 }), { a: 1 });
  for (const bad of [undefined, null, [], 'x', 5, true]) {
    assert.equal(firstMessage(schema.safeParse(bad), show(bad)), 'Send an object');
  }
});

test('updatedAt: missing, null, impossible and real values (the date rules are in updatedAtDates.test.js)', () => {
  const schema = updatedAt();
  assert.equal(firstMessage(schema.safeParse(undefined), 'missing'), 'Updated at is missing');
  assert.equal(schema.parse(null), null);
  assert.equal(schema.parse('2026-10-09T09:02:03.456+08:00'), '2026-10-09T01:02:03.456Z');
  for (const bad of [5, true, [], {}, '2026-02-30T00:00:00.000Z', 'yesterday']) {
    assert.match(
      firstMessage(schema.safeParse(bad), show(bad)),
      /^Updated at must be null or a date/,
    );
  }
});

const GOOD = { code: 'C1', name: 'Name 1', isActive: true };

test('venueCreateBody: valid input gives the trimmed fields; unknown keys are stripped; echo keys pass through untouched', () => {
  const out = venueCreateBody.parse({
    code: ' C1 ',
    name: ' N ',
    isActive: false,
    mapUpDeg: '90',
    boundary: { type: 'Polygon' },
    other: 1,
    id: null,
    tenantId: 7,
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  });
  assert.deepEqual(out, {
    code: 'C1',
    name: 'N',
    isActive: false,
    id: null,
    tenantId: 7,
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  });
  const bare = venueCreateBody.parse(GOOD);
  for (const key of ['id', 'tenantId', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']) {
    assert.equal(Object.hasOwn(bare, key), false, `an absent ${key} stays absent`);
  }
});

test('venueCreateBody: a body that is not an object is "The request body must be a JSON object"', () => {
  for (const bad of [undefined, null, [], 'x', 5]) {
    assert.equal(
      firstMessage(venueCreateBody.safeParse(bad), show(bad)),
      'The request body must be a JSON object',
    );
  }
});

const EDIT = { ...GOOD, updatedAt: null };

test("AC-34: the first message is today's order: missing keys, then each field in form order, then updatedAt", () => {
  const message = (body) => firstMessage(venueEditBody.safeParse(body), show(body));
  // every missing key first, in the form's order, even when a present field is also wrong
  assert.equal(message({ code: 5 }), 'Name is missing');
  assert.equal(message({ name: 5, isActive: true }), 'Code is missing');
  assert.equal(message({}), 'Code is missing');
  // then each field's own check in the form's order
  assert.equal(message({ code: 5, name: 5, isActive: 5, updatedAt: 'x' }), 'Code must be text');
  assert.equal(message({ code: 'ok', name: 5, isActive: 5, updatedAt: 'x' }), 'Name must be text');
  assert.equal(
    message({ code: 'ok', name: 'ok', isActive: 5, updatedAt: 'x' }),
    'Active must be true or false',
  );
  // then updatedAt: missing, then malformed
  assert.equal(message({ ...GOOD }), 'Updated at is missing');
  assert.match(message({ ...GOOD, updatedAt: 'x' }), /^Updated at must be null or a date/);
  assert.equal(venueEditBody.safeParse(EDIT).success, true);
});

test('venueEditBody: echo keys pass through untouched, an absent one stays absent, updatedAt is the token', () => {
  const out = venueEditBody.parse({
    ...EDIT,
    updatedAt: '2026-10-09T09:02:03.456+08:00',
    id: 3,
    createdBy: 9,
  });
  assert.equal(out.updatedAt, '2026-10-09T01:02:03.456Z');
  assert.equal(out.id, 3);
  assert.equal(out.createdBy, 9);
  assert.equal(Object.hasOwn(out, 'tenantId'), false);
});
