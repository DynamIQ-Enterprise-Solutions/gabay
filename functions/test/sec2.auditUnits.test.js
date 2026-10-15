// SEC-2 step 2: the audit trail's units (spec/SEC-2.md r2 AC-19, AC-26, AC-27, AC-28, EC-6, EC-34): the payload cap, IP
// normalisation, settled(), and the column widths mirrored from db/schema.sql. The middleware is driven with fake
// requests and responses here; sec2.audit.test.js drives the real app.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { parseSchema } = require('../../tools/lint/lib/schema');
const {
  createAuditTrail,
  payloadText,
  AUDIT_COLUMNS,
  PAYLOAD_TRUNCATION_MARKER,
  PAYLOAD_UNAVAILABLE,
} = require('../src/middleware/auditTrail');
const { normaliseIp } = require('../src/utils/clientIp');
const { cutAtCodeUnits } = require('../src/utils/text');
const { fakeLogger } = require('./helpers');

const CAP = AUDIT_COLUMNS.payloadDiff;

/** A payload whose JSON text is exactly `length` code units: {"s":"xxx"} */
function payloadOfLength(length) {
  const frame = JSON.stringify({ s: '' }).length;
  return { s: 'x'.repeat(length - frame) };
}

test('AC-19, EC-6: a payload of exactly 4,000 characters is not cut; 4,001 is, and ends with the marker', () => {
  const exact = payloadText(payloadOfLength(CAP));
  assert.equal(exact.length, CAP);
  assert.equal(exact.endsWith(PAYLOAD_TRUNCATION_MARKER), false);
  assert.deepEqual(JSON.parse(exact).s.length, CAP - JSON.stringify({ s: '' }).length);

  const over = payloadText(payloadOfLength(CAP + 1));
  assert.ok(over.length <= CAP);
  assert.equal(over.length, CAP, 'it fills the column and no more');
  assert.ok(over.endsWith(PAYLOAD_TRUNCATION_MARKER));
});

test('AC-19, EC-6: a surrogate pair at the cut is not split', () => {
  const end = CAP - PAYLOAD_TRUNCATION_MARKER.length;
  const prefix = '{"s":"'.length;
  // The high half of 😀 is the last character kept at the cut, and its low half the first one cut.
  const high = end - 1 - prefix;
  const text = payloadText({ s: `${'x'.repeat(high)}😀${'y'.repeat(200)}` });
  assert.ok(text.length <= CAP);
  assert.ok(text.endsWith(PAYLOAD_TRUNCATION_MARKER));
  assert.equal(/[\ud800-\udbff](?![\udc00-\udfff])/.test(text), false, 'no lone high surrogate');
  assert.equal(
    text.length,
    end - 1 + PAYLOAD_TRUNCATION_MARKER.length,
    'the half pair was dropped',
  );
  // A pair that ends exactly at the cut is kept whole.
  const whole = payloadText({ s: `${'x'.repeat(high - 1)}😀${'y'.repeat(200)}` });
  assert.ok(whole.includes('😀'));
  assert.equal(/[\ud800-\udbff](?![\udc00-\udfff])/.test(whole), false);
});

test('AC-19: cutAtCodeUnits never returns more than the width, and returns a short text unchanged', () => {
  assert.equal(cutAtCodeUnits('short', 10, '...'), 'short');
  assert.equal(cutAtCodeUnits('0123456789', 10, '...'), '0123456789');
  assert.equal(cutAtCodeUnits('0123456789A', 10, '...'), '0123456...');
  assert.equal(cutAtCodeUnits('abc😀def', 6, '~'), 'abc😀~', 'a whole pair at the cut is kept');
  assert.equal(cutAtCodeUnits('abc😀def', 5, '~'), 'abc~', 'half a pair at the cut is dropped');
});

test('AC-19: a serialisation failure writes a short fixed text and never throws', () => {
  assert.equal(payloadText({ n: 10n }), PAYLOAD_UNAVAILABLE);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(payloadText(cyclic), PAYLOAD_UNAVAILABLE);
  assert.equal(
    payloadText({
      toJSON() {
        throw new Error('no');
      },
    }),
    PAYLOAD_UNAVAILABLE,
  );
  assert.equal(payloadText(undefined), PAYLOAD_UNAVAILABLE);
  assert.ok(PAYLOAD_UNAVAILABLE.length < 100);
});

test('AC-27, EC-34: IP normalisation', () => {
  const table = [
    ['::ffff:10.0.0.5', '10.0.0.5'],
    ['::FFFF:10.0.0.5', '10.0.0.5'],
    ['::Ffff:192.168.1.20', '192.168.1.20'],
    ['10.0.0.5', '10.0.0.5'],
    ['2001:db8::1', '2001:db8::1'],
    ['::1', '::1'],
    ['::ffff:a00:5', '::ffff:a00:5'], // the hex form is kept as it is (documented)
    [undefined, null],
    [null, null],
    ['', null],
    [42, null],
  ];
  for (const [input, expected] of table) assert.equal(normaliseIp(input), expected, String(input));
  const longest = '0000:0000:0000:0000:0000:ffff:255.255.255.255';
  assert.equal(longest.length, 45);
  assert.equal(normaliseIp(longest), longest, 'the longest IPv6 text form fits');
  assert.equal(normaliseIp('x'.repeat(200)).length, 45, 'an absurd value is cut to the column');
});

/** A response and a request enough for the middleware. */
function fakeExchange({
  method = 'POST',
  status = 201,
  user = { userId: 7, kind: 'admin' },
  body,
  tenant = 3,
} = {}) {
  const res = new EventEmitter();
  res.statusCode = status;
  res.writableFinished = false;
  res.locals = {};
  const req = {
    method,
    originalUrl: '/api/venues?x=1',
    ip: '::ffff:127.0.0.1',
    id: 'req-1',
    query: { x: '1' },
    params: {},
    body,
    user,
    tenantCompanyID: tenant,
    log: fakeLogger(),
  };
  return { req, res };
}

test('AC-17, AC-29: the insert binds nine $n values, never an interpolated one', async () => {
  const queries = [];
  const trail = createAuditTrail({
    db: { query: async (text, params) => queries.push({ text, params }) },
    logger: fakeLogger(),
  });
  const { req, res } = fakeExchange({ body: { name: 'N' } });
  trail.middleware(req, res, () => {});
  res.writableFinished = true;
  res.emit('finish');
  res.emit('close');
  await trail.settled();
  assert.equal(queries.length, 1, 'written once, on finish only');
  assert.match(queries[0].text, /^INSERT INTO gabay\.AuditLog/);
  assert.equal(queries[0].params.length, 9);
  for (let n = 1; n <= 9; n += 1) assert.ok(queries[0].text.includes(`$${n}`), `$${n}`);
  assert.deepEqual(queries[0].params.slice(0, 6), [3, 7, null, '127.0.0.1', 'POST', '/api/venues']);
  assert.equal(queries[0].params[7], 201);
  assert.equal(queries[0].params[8], 'req-1');
});

test('AC-24, AC-26: settled() resolves after every write, including one that rejects, and the rejection is logged once', async () => {
  let attempts = 0;
  const trail = createAuditTrail({
    db: {
      query: async () => {
        attempts += 1;
        throw new Error('value too long for type character varying(40)');
      },
    },
    logger: fakeLogger(),
  });
  const { req, res } = fakeExchange();
  trail.middleware(req, res, () => {});
  res.emit('finish');
  await trail.settled();
  assert.equal(attempts, 1);
  assert.equal(req.log.calls.error.length, 1);
  assert.match(String(req.log.calls.error[0][1]), /audit log insert failed/);
  assert.equal(
    req.log.calls.error[0][0].err.message.includes('varying'),
    true,
    'the cause is in the log, not the response',
  );
});

test('AC-24: a db that throws before returning a promise is a logged rejection, not an exception in the response path', async () => {
  const trail = createAuditTrail({
    db: {
      query: () => {
        throw new Error('synchronous');
      },
    },
    logger: fakeLogger(),
  });
  const { req, res } = fakeExchange();
  trail.middleware(req, res, () => {});
  assert.doesNotThrow(() => res.emit('finish'));
  await trail.settled();
  assert.equal(req.log.calls.error.length, 1);
});

test('AC-24: finish starts the insert without awaiting it: a write that never settles does not block the emit', () => {
  const trail = createAuditTrail({
    db: { query: () => new Promise(() => {}) },
    logger: fakeLogger(),
  });
  const { req, res } = fakeExchange();
  trail.middleware(req, res, () => {});
  const started = Date.now();
  res.emit('finish');
  assert.ok(Date.now() - started < 100);
});

test('AC-17: GET, HEAD and OPTIONS are not audited', async () => {
  const queries = [];
  const trail = createAuditTrail({
    db: { query: async (text) => queries.push(text) },
    logger: fakeLogger(),
  });
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const { req, res } = fakeExchange({ method });
    let called = false;
    trail.middleware(req, res, () => (called = true));
    assert.equal(called, true, `${method} passes through`);
    res.emit('finish');
  }
  await trail.settled();
  assert.deepEqual(queries, []);
});

test('AC-28: the AuditLog column widths in the middleware are the ones in db/schema.sql', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  const table = parseSchema(text).tables.get('auditlog');
  const width = (name) => {
    const col = table.columns.get(name.toLowerCase());
    assert.equal(col.type, 'VARCHAR', name);
    return col.length;
  };
  assert.deepEqual(
    {
      route: width('Route'),
      ipAddress: width('IPAddress'),
      method: width('Method'),
      requestId: width('RequestId'),
      payloadDiff: width('PayloadDiff'),
      entityName: width('EntityName'),
      entityId: width('EntityId'),
    },
    { ...AUDIT_COLUMNS },
  );
  assert.ok(Object.isFrozen(AUDIT_COLUMNS));
});
