// SEC-2 step 2: redactSecrets and summariseDocument (spec/SEC-2.md r2 AC-12 to AC-16; EC-7, EC-29, EC-33). Unit tests.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  redactSecrets,
  summariseDocument,
  EXACT,
  STEMS,
  NEVER_SECRET,
  MAX_REDACT_DEPTH,
  REDACT_NODE_BUDGET,
  MARKERS,
} = require('../src/utils/redactSecrets');
const { payloadText, AUDIT_COLUMNS } = require('../src/middleware/auditTrail');

const REDACTED = '[REDACTED]';

test("AC-12: the lists are frozen, named exports that start from the standard's A.4 (DC-16 adds three keys)", () => {
  for (const list of [EXACT, STEMS, NEVER_SECRET]) assert.ok(Object.isFrozen(list));
  assert.deepEqual(
    [...EXACT].sort(),
    [
      'accesstoken',
      'authorization',
      'idtoken',
      'otp',
      'password',
      'pin',
      'refreshtoken',
      'secret',
      'signature',
      'token',
    ].sort(),
  );
  assert.deepEqual([...STEMS].sort(), ['apikey', 'password', 'secret']);
  assert.deepEqual([...NEVER_SECRET].sort(), ['changepassword', 'haspasswordexpiration']);
});

test('AC-12: the classification table', () => {
  const redacted = [
    'password',
    'Password',
    'new_password',
    'newPassword',
    'confirm-password',
    'PasswordHash',
    'clientSecret',
    'apiKey',
    'API_KEY',
    'Authorization',
    'signature',
    'token',
    'idToken',
    'refreshToken',
    'pin',
    'otp',
    'accessToken',
  ];
  const kept = [
    'changePassword',
    'ChangePassword',
    'change_password',
    'hasPasswordExpiration',
    'shipping',
    'adoption',
    'pinCode',
    'venueName',
    'tokenCount',
  ];
  const input = Object.fromEntries([...redacted, ...kept].map((key) => [key, `value of ${key}`]));
  input.changePassword = true;
  const out = redactSecrets(input);
  for (const key of redacted) assert.equal(out[key], REDACTED, `${key} is redacted`);
  for (const key of kept) {
    assert.equal(out[key], input[key], `${key} is kept`);
  }
  assert.equal(out.changePassword, true, 'a true survives');
});

test('AC-13: a redacted key loses its whole value, of any type or size; the rest keeps shape and order', () => {
  const out = redactSecrets({
    a: 1,
    password: { deep: ['x', { y: 1 }] },
    pin: 123456,
    secret: ['x'.repeat(10_000)],
    list: [3, { token: 'abc', keep: 'me' }, [1, 2]],
    nested: { z: null, b: true, c: 'text' },
  });
  assert.deepEqual(out, {
    a: 1,
    password: REDACTED,
    pin: REDACTED,
    secret: REDACTED,
    list: [3, { token: REDACTED, keep: 'me' }, [1, 2]],
    nested: { z: null, b: true, c: 'text' },
  });
  assert.deepEqual(Object.keys(out), ['a', 'password', 'pin', 'secret', 'list', 'nested']);
});

test('AC-13: the input is never mutated', () => {
  const input = Object.freeze({
    password: 'p',
    inner: Object.freeze({ token: 't', list: Object.freeze([1, 2]) }),
  });
  const before = JSON.stringify(input);
  redactSecrets(input);
  assert.equal(JSON.stringify(input), before);
});

/** A chain of objects `levels` deep: { next: { next: ... { leaf: 1 } } }. */
function nest(levels) {
  let value = { leaf: 1 };
  for (let i = 1; i < levels; i += 1) value = { next: value };
  return value;
}

test('AC-13: a level deeper than 8 is replaced by a marker (the root is level 1)', () => {
  assert.equal(MAX_REDACT_DEPTH, 8);
  const eight = redactSecrets(nest(8));
  assert.equal(JSON.stringify(eight).includes('"leaf":1'), true, 'level 8 is kept');
  const nine = redactSecrets(nest(9));
  assert.equal(JSON.stringify(nine).includes('"leaf"'), false);
  assert.equal(JSON.stringify(nine).includes(MARKERS.depth), true);
});

test('AC-13: a Buffer or a typed array becomes [BUFFER:<byteLength>]', () => {
  const out = redactSecrets({
    buffer: Buffer.alloc(12),
    typed: new Float64Array(4),
    view: new DataView(new ArrayBuffer(7)),
    raw: new ArrayBuffer(5),
  });
  assert.deepEqual(out, {
    buffer: '[BUFFER:12]',
    typed: '[BUFFER:32]',
    view: '[BUFFER:7]',
    raw: '[BUFFER:5]',
  });
});

test('AC-13, EC-33: it never throws: a cycle, a throwing getter, a Proxy, a BigInt, a symbol and a function', () => {
  const cyclic = { name: 'x' };
  cyclic.self = cyclic;
  cyclic.list = [cyclic];
  assert.deepEqual(redactSecrets(cyclic), {
    name: 'x',
    self: MARKERS.cyclic,
    list: [MARKERS.cyclic],
  });

  const throwing = {
    ok: 1,
    get boom() {
      throw new Error('getter exploded');
    },
  };
  assert.deepEqual(redactSecrets(throwing), { ok: 1, boom: MARKERS.unreadable });

  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('trap exploded');
      },
    },
  );
  assert.deepEqual(redactSecrets({ proxy, after: 2 }), { proxy: MARKERS.unreadable, after: 2 });
  assert.equal(redactSecrets(proxy), MARKERS.unreadable);

  const sym = Symbol('hidden');
  const exotic = { [sym]: 'never copied', big: 10n, s: Symbol('v'), f: () => 1, fine: 'yes' };
  assert.deepEqual(redactSecrets(exotic), {
    big: MARKERS.bigint,
    s: MARKERS.symbol,
    f: MARKERS.function,
    fine: 'yes',
  });
  assert.equal(redactSecrets(10n), MARKERS.bigint);
  assert.equal(redactSecrets(undefined), undefined);
  // The result is always JSON-serialisable.
  assert.doesNotThrow(() => JSON.stringify(redactSecrets(exotic)));
});

test('AC-13, EC-29: a __proto__ or constructor key is a plain key: Object.prototype and the output prototype are untouched', () => {
  const body = JSON.parse(
    '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},"prototype":1,"password":"p"}',
  );
  const out = redactSecrets(body);
  assert.equal({}.polluted, undefined);
  assert.equal({}.polluted2, undefined);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
  assert.deepEqual(Object.keys(out), ['__proto__', 'constructor', 'prototype', 'password']);
  assert.deepEqual(Object.getOwnPropertyDescriptor(out, '__proto__').value, { polluted: 'yes' });
  assert.equal(out.password, REDACTED);
  // Nested too.
  const inner = redactSecrets({ list: [JSON.parse('{"__proto__":{"x":1}}')] });
  assert.equal(Object.getPrototypeOf(inner.list[0]), Object.prototype);
  assert.equal({}.x, undefined);
});

test('AC-14, EC-7: the walk stops at its node budget and leaves a marker; a secret past it is never copied', () => {
  const wide = {};
  for (let i = 0; i < REDACT_NODE_BUDGET + 50; i += 1) wide[`k${i}`] = i;
  wide.password = 'hunter2-after-the-budget';
  wide.late = 'LATE-VALUE';
  const out = redactSecrets(wide);
  const text = JSON.stringify(out);
  assert.equal(text.includes('hunter2'), false, 'a secret past the budget is not copied');
  assert.equal(text.includes('LATE-VALUE'), false, 'nothing past the budget is copied');
  assert.equal(text.includes('REDACTED'), false, 'it was never reached');
  assert.equal(text.includes(MARKERS.truncated), true, 'the marker is left where it stopped');
  assert.ok(Object.keys(out).length <= REDACT_NODE_BUDGET + 1);

  const list = redactSecrets(Array.from({ length: REDACT_NODE_BUDGET * 2 }, (_, i) => i));
  assert.equal(list.at(-1), MARKERS.truncated);
  assert.ok(list.length <= REDACT_NODE_BUDGET + 1);
});

test('AC-14, EC-7: a 5 MB body of 100,000 small objects ends within the budget and fits the row cap', () => {
  const body = {
    items: Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `item ${i}` })),
  };
  assert.ok(JSON.stringify(body).length > 2_000_000);
  const out = redactSecrets(body);
  const text = payloadText({ body: out, query: {}, params: {}, status: 200 });
  assert.ok(text.length <= AUDIT_COLUMNS.payloadDiff);
  assert.ok(JSON.stringify(out).length < 100_000, 'the copy is small, not the body');
});

test('AC-14, EC-7: one 5 MB string is cut to the row width with the marker', () => {
  const out = redactSecrets({ blob: 'x'.repeat(5 * 1024 * 1024) });
  assert.ok(out.blob.length <= 4000);
  assert.ok(out.blob.endsWith(MARKERS.textCut));
});

test('AC-15: summariseDocument gives the UTF-8 byte length and the SHA-256 of the JSON text, and nothing of the value', () => {
  const layout = { name: 'Café Ñandú 🙂', levels: [1, 2, 3], password: 'hunter2-in-a-layout' };
  const text = JSON.stringify(layout);
  const expected = {
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
  };
  assert.notEqual(expected.bytes, text.length, 'the multi-byte characters count as bytes');
  const summary = summariseDocument(layout);
  assert.deepEqual(summary, expected);
  assert.deepEqual(
    summariseDocument(structuredClone(layout)),
    expected,
    'the same value, the same pair',
  );
  assert.match(summary.sha256, /^[0-9a-f]{64}$/);
  const shown = JSON.stringify(summary);
  assert.equal(shown.includes('Café'), false);
  assert.equal(shown.includes('hunter2'), false);
  assert.deepEqual(Object.keys(summary), ['bytes', 'sha256']);
});

test('AC-15: a value with no JSON text, or one that cannot be serialised, has no hash and does not throw', () => {
  assert.deepEqual(summariseDocument(undefined), { bytes: 0, sha256: null });
  assert.deepEqual(summariseDocument(10n), { bytes: 0, sha256: null });
  const cyclic = {};
  cyclic.self = cyclic;
  assert.deepEqual(summariseDocument(cyclic), { bytes: 0, sha256: null });
  assert.deepEqual(summariseDocument(null).bytes, 4);
});

/** Every .js file under dir. */
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

test('AC-16: one source: NEVER_SECRET, EXACT and STEMS are defined in one file only', () => {
  const root = path.join(__dirname, '..', 'src');
  const definition = /^\s*(?:const|let|var)\s+(NEVER_SECRET|EXACT|STEMS)\b/m;
  const holders = sourceFiles(root).filter((file) =>
    definition.test(fs.readFileSync(file, 'utf8')),
  );
  assert.deepEqual(
    holders.map((f) => path.relative(root, f).replaceAll(path.sep, '/')),
    ['utils/redactSecrets.js'],
  );
  // And no second copy of a list's contents: the never-secret keys appear as strings in that file alone.
  for (const key of ['haspasswordexpiration', 'refreshtoken']) {
    const copies = sourceFiles(root).filter((file) =>
      new RegExp(`['"]${key}['"]`, 'i').test(fs.readFileSync(file, 'utf8')),
    );
    assert.deepEqual(
      copies.map((f) => path.basename(f)),
      ['redactSecrets.js'],
      key,
    );
  }
});
