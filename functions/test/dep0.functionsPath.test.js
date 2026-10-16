'use strict';

// DEP-0 step 7, P-1 to P-6, F1 to F4 (plan/DEP-0.md 1.0 section 0.1; spec/DEP-0.md r2): the FUNCTIONS PATH of a request. On Cloud
// Functions and in the Functions emulator the platform reads the body before the function runs (json, text, urlencoded and raw
// parsers at 32 MB, the bytes kept as req.rawBody) and, in the emulator, gives the function no socket address. The same app is
// mounted in-process and behind a platform-shaped host (functionsHost.js, DC-28), and each request is sent down both paths, which
// must answer alike. The real emulator is the probe's (tools/functions-path-probe.js, inside verify's functions-health).
//
//   P-1  a backdrop upload answers as it does in-process: 201, 413 or 400          (F1)
//   P-2  a JSON body over MAX_JSON_BODY is the 413 { error } on both paths          (F2a)
//   P-3  AuditLog.IPAddress is the client address, the loopback in the emulator, never NULL there; a deployed function with no
//        address warns once about TRUST_PROXY_HOPS                                  (F3)
//   P-4  no audit row holds a body that express.json would not have produced        (F4)
//   P-5  separate forwarded clients get separate rate-limit keys                    (F3)
//   P-6  the function never sends X-Powered-By                                      (F3)
//   R1   JSON the platform cannot parse is answered by the platform, as a known difference

const test = require('node:test');
const assert = require('node:assert/strict');
const { withMapApp, uploadForm } = require('./mapApp');
const { testConfig } = require('./helpers');
const { pngBytes } = require('./imageFixtures');
const { createPlatformBody, createJsonParser } = require('../src/middleware/platformBody');
const { installClientAddress } = require('../src/middleware/clientAddress');

const MB = 1024 * 1024;
const BACKDROP_LIMIT = 15 * MB;
const TOO_LARGE = { error: 'Request body too large' };
const ONE_IMAGE = { error: 'Choose one PNG, JPEG or WebP image to upload' };

const lastAudit = async (ctx, where = '') =>
  (
    await ctx.sql.rows(
      `SELECT IPAddress AS ip, PayloadDiff AS payload, Route AS route, StatusCode AS status FROM gabay.AuditLog ${where} ORDER BY AuditLogId DESC LIMIT 1`,
    )
  )[0];

/** A write the audit trail records for the signed-in user: a venue create the validation refuses. */
const refusedCreate = (call, headers) => call('POST', '/api/venues', { body: {}, headers });

/** Sends one request down both paths and returns both answers. */
async function bothPaths(ctx, method, path, options) {
  const inProcess = await ctx.call(method, path, options);
  const viaHost = await ctx.hostCall(method, path, options);
  return { inProcess, viaHost };
}

function assertAlike({ inProcess, viaHost }, label) {
  assert.equal(viaHost.status, inProcess.status, `${label}: the same status`);
  assert.deepEqual(viaHost.body, inProcess.body, `${label}: the same body`);
}

// ----------------------------------------------------------------------------------------------------------------- P-1

test('P-1: a backdrop upload is 201 on both paths, and the bytes are in the store each time (F1)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const bytes = pngBytes(640, 480);
    const url = ctx.mapUrl(venue, '/backdrops');
    const a = await ctx.call('POST', url, { form: uploadForm(bytes) });
    const b = await ctx.hostCall('POST', url, { form: uploadForm(bytes) });
    for (const [label, res] of [
      ['in-process', a],
      ['through the host', b],
    ]) {
      assert.equal(res.status, 201, `${label}: ${res.text}`);
      assert.deepEqual(Object.keys(res.body).sort(), ['height', 'id', 'width'], label);
      assert.equal(res.body.width, 640);
      const key = `backdrops/${ctx.tenantA.tenantId}/${venue}/${res.body.id}`;
      assert.deepEqual(ctx.fileStore.files.get(key), bytes, `${label}: the bytes are in the store`);
    }
    assert.equal(ctx.fileStore.keys('backdrops/').length, 2);
    // And the image reads back through the host as it does in-process.
    const read = await ctx.hostCall('GET', ctx.mapUrl(venue, `/backdrops/${b.body.id}`));
    assert.equal(read.status, 200);
    assert.deepEqual(read.bytes, bytes);
  });
});

test('P-1: a file over the limit is the 413 on both paths and nothing is stored (F1)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const big = Buffer.concat([pngBytes(100, 80), Buffer.alloc(BACKDROP_LIMIT + 1)]);
    const url = ctx.mapUrl(venue, '/backdrops');
    const both = {
      inProcess: await ctx.call('POST', url, { form: uploadForm(big) }),
      viaHost: await ctx.hostCall('POST', url, { form: uploadForm(big) }),
    };
    assertAlike(both, 'too large');
    assert.equal(both.viaHost.status, 413);
    assert.deepEqual(both.viaHost.body, TOO_LARGE);
    assert.deepEqual(ctx.fileStore.keys('backdrops/'), []);
  });
});

test('P-1: a malformed form, no file, two files and another field are the 400 "Choose one image" on both paths (F1)', async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const url = ctx.mapUrl(venue, '/backdrops');
    const platform = await ctx.getHost();
    const sendRaw = async (headers, bytes) => {
      const withAuth = { ...ctx.defaultHeaders, ...headers };
      const inProcess = await fetch(`${ctx.server.url}${url}`, {
        method: 'POST',
        headers: withAuth,
        body: bytes,
      });
      await ctx.auditTrail.settled(); // every write is audited after its response: one connection, one request at a time
      const viaHost = await platform.request('POST', url, {
        headers: withAuth,
        bytes: Buffer.from(bytes),
      });
      await ctx.auditTrail.settled();
      return {
        inProcess: { status: inProcess.status, body: await inProcess.json() },
        viaHost: { status: viaHost.status, body: JSON.parse(viaHost.text) },
      };
    };
    const garbage = await sendRaw(
      { 'content-type': 'multipart/form-data; boundary=zzz' },
      'not a form at all',
    );
    assertAlike(garbage, 'garbage');
    assert.equal(garbage.viaHost.status, 400);
    assert.deepEqual(garbage.viaHost.body, ONE_IMAGE);
    // No file part (one text field), and two files.
    const textOnly = new FormData();
    textOnly.append('note', 'hello');
    const two = new FormData();
    two.append('file', new Blob([pngBytes(100, 80)]), 'a.png');
    two.append('file', new Blob([pngBytes(100, 80)]), 'b.png');
    for (const [label, form] of [
      ['a text field only', textOnly],
      ['two files', two],
    ]) {
      assertAlike(await bothPaths(ctx, 'POST', url, { form }), label);
      assert.equal((await ctx.hostCall('POST', url, { form })).status, 400, label);
    }
    assert.deepEqual(ctx.fileStore.keys('backdrops/'), []);
  });
});

// ----------------------------------------------------------------------------------------------------------------- P-4

test("P-4: an upload's audit row has no body key, on either path (F4)", async () => {
  await withMapApp(async (ctx) => {
    const venue = await ctx.mapVenue();
    const url = ctx.mapUrl(venue, '/backdrops');
    await ctx.call('POST', url, { form: uploadForm(pngBytes(100, 80)) });
    const inProcess = await lastAudit(ctx, `WHERE Method = 'POST'`);
    await ctx.hostCall('POST', url, { form: uploadForm(pngBytes(100, 80)) });
    const viaHost = await lastAudit(ctx, `WHERE Method = 'POST'`);
    for (const [label, row] of [
      ['in-process', inProcess],
      ['through the host', viaHost],
    ]) {
      assert.ok(row.route.endsWith('/backdrops'), label);
      assert.ok(!row.payload.includes('"body"'), `${label}: no body key in ${row.payload}`);
      assert.ok(!row.payload.includes('"type":"Buffer"'), label);
    }
  });
});

test('P-4: a text body, a form body and an empty POST leave no body key either; a JSON body does (the positive control)', async () => {
  await withMapApp(async (ctx) => {
    const platform = await ctx.getHost();
    // The audited write goes down each path with a body type express.json does not read.
    const sends = [
      [
        'in-process',
        async (type, text) => {
          const res = await fetch(`${ctx.server.url}/api/venues`, {
            method: 'POST',
            headers: { ...ctx.defaultHeaders, 'content-type': type },
            body: text,
          });
          await res.arrayBuffer();
        },
      ],
      [
        'through the host',
        async (type, text) => {
          await platform.request('POST', '/api/venues', {
            headers: { ...ctx.defaultHeaders, 'content-type': type },
            bytes: Buffer.from(text),
          });
        },
      ],
    ];
    for (const [label, send] of sends) {
      for (const [type, text] of [
        ['text/plain', 'hello there'],
        ['application/x-www-form-urlencoded', 'code=a&name=b'],
        ['application/octet-stream', 'some bytes'],
      ]) {
        await send(type, text);
        await ctx.auditTrail.settled();
        const row = await lastAudit(ctx, `WHERE Method = 'POST'`);
        assert.ok(!row.payload.includes('"body"'), `${label} ${type}: ${row.payload}`);
      }
    }
    // An empty POST, both paths.
    await ctx.call('POST', '/api/venues');
    assert.ok(
      !(await lastAudit(ctx, `WHERE Method = 'POST'`)).payload.includes('"body"'),
      'in-process, empty',
    );
    await ctx.hostCall('POST', '/api/venues');
    assert.ok(
      !(await lastAudit(ctx, `WHERE Method = 'POST'`)).payload.includes('"body"'),
      'through the host, empty',
    );
    // The control: a JSON body IS recorded, on both paths.
    for (const send of [ctx.call, ctx.hostCall]) {
      await send('POST', '/api/venues', { body: { code: '', name: 'Control' } });
      const row = await lastAudit(ctx, `WHERE Method = 'POST'`);
      assert.ok(row.payload.includes('"body"') && row.payload.includes('Control'), row.payload);
    }
  });
});

test('F4: text, form and empty bodies get the in-process answer through the host (no Buffer, no {} leaks into validation)', async () => {
  await withMapApp(async (ctx) => {
    const platform = await ctx.getHost();
    for (const [type, text] of [
      ['text/plain', 'hello'],
      ['application/x-www-form-urlencoded', 'code=a&name=b'],
      ['application/octet-stream', 'binary-ish'],
    ]) {
      const inProcess = await fetch(`${ctx.server.url}/api/venues`, {
        method: 'POST',
        headers: { ...ctx.defaultHeaders, 'content-type': type },
        body: text,
      });
      const inBody = await inProcess.json();
      await ctx.auditTrail.settled();
      const viaHost = await platform.request('POST', '/api/venues', {
        headers: { ...ctx.defaultHeaders, 'content-type': type },
        bytes: Buffer.from(text),
      });
      await ctx.auditTrail.settled();
      assert.equal(viaHost.status, inProcess.status, type);
      assert.deepEqual(JSON.parse(viaHost.text), inBody, type);
    }
    assertAlike(await bothPaths(ctx, 'POST', '/api/venues'), 'an empty POST');
  });
});

// ----------------------------------------------------------------------------------------------------------------- P-2

test('P-2: a JSON body over MAX_JSON_BODY is 413 { error } on both paths, and one within it is answered the same (F2a)', async () => {
  await withMapApp(
    async (ctx) => {
      const huge = { code: 'x', name: 'y'.repeat(2048) };
      const big = await bothPaths(ctx, 'POST', '/api/venues', { body: huge });
      assertAlike(big, 'too large');
      assert.equal(big.viaHost.status, 413);
      assert.deepEqual(big.viaHost.body, TOO_LARGE);
      // Over the limit even with no sign-in: the body limit comes before auth, as it always did.
      const unsigned = await bothPaths(ctx, 'POST', '/api/venues', {
        body: huge,
        headers: { authorization: null },
      });
      assertAlike(unsigned, 'too large, unsigned');
      assert.equal(unsigned.viaHost.status, 413);
      const small = await bothPaths(ctx, 'POST', '/api/venues', {
        body: { code: 'ok1', name: 'Small', isActive: true },
      });
      assert.equal(small.inProcess.status, 201);
      assert.equal(
        small.viaHost.status,
        409,
        'the second create of the same code is the same refusal on a repeat, not a body error',
      );
    },
    { config: testConfig({ MAX_JSON_BODY: '1kb' }) },
  );
});

test("P-2: the limit is the one in the config for both units, and the platform's own 32 MB is not the API's limit", async () => {
  const { parseConfig } = require('../src/config');
  const base = { PGHOST: 'h', PGDATABASE: 'd', PGUSER: 'u', PGPASSWORD: 'p' };
  assert.equal(parseConfig({ ...base, MAX_JSON_BODY: '1kb' }).maxJsonBodyBytes, 1024);
  assert.equal(
    parseConfig(base).maxJsonBodyBytes,
    5 * MB,
    "the default is 5 MB, far under the platform's 32 MB",
  );
});

// ----------------------------------------------------------------------------------------------------------------- R1

test('R1: JSON the platform cannot parse is answered by the platform (an HTML 400) and the function never runs: a known difference', async () => {
  await withMapApp(async (ctx) => {
    const inProcess = await ctx.call('POST', '/api/venues', { rawBody: '{"code": ' });
    assert.equal(inProcess.status, 400);
    assert.deepEqual(
      inProcess.body,
      { error: 'Malformed JSON body' },
      'in-process the API shapes it',
    );
    const platform = await ctx.getHost();
    const before = platform.calls;
    const viaHost = await ctx.hostCall('POST', '/api/venues', { rawBody: '{"code": ' });
    assert.equal(viaHost.status, 400);
    assert.match(
      viaHost.headers.get('content-type') ?? '',
      /html/i,
      "the platform's own page, not the API's { error }",
    );
    assert.equal(platform.calls, before, 'the function was not called');
  });
});

// ----------------------------------------------------------------------------------------------------------------- P-3

test('P-3: in the emulator the audit row holds 127.0.0.1, and a forwarded address wins (F3)', async () => {
  await withMapApp(
    async (ctx) => {
      await refusedCreate(ctx.hostCall);
      assert.equal(
        (await lastAudit(ctx, `WHERE Method = 'POST'`)).ip,
        '127.0.0.1',
        'no header: the loopback, never NULL',
      );
      await refusedCreate(ctx.hostCall, { 'x-forwarded-for': '203.0.113.7' });
      assert.equal((await lastAudit(ctx, `WHERE Method = 'POST'`)).ip, '203.0.113.7');
      await refusedCreate(ctx.hostCall, { 'x-forwarded-for': '1.1.1.1, 203.0.113.7' });
      assert.equal(
        (await lastAudit(ctx, `WHERE Method = 'POST'`)).ip,
        '203.0.113.7',
        'a forged leading entry changes nothing: with one trusted hop the last entry is the client',
      );
    },
    { config: testConfig({ FUNCTIONS_EMULATOR: 'true' }) },
  );
});

test('P-3: outside the emulator, with no socket address and no header, the address is NULL and ONE warning names TRUST_PROXY_HOPS', async () => {
  await withMapApp(async (ctx) => {
    await refusedCreate(ctx.hostCall);
    await refusedCreate(ctx.hostCall);
    assert.equal((await lastAudit(ctx, `WHERE Method = 'POST'`)).ip, null);
    const warnings = ctx.logger.calls.warn.filter((w) => String(w[0]).includes('TRUST_PROXY_HOPS'));
    assert.equal(warnings.length, 1, 'once per app, not once per request');
    await refusedCreate(ctx.hostCall, { 'x-forwarded-for': '198.51.100.9' });
    assert.equal(
      (await lastAudit(ctx, `WHERE Method = 'POST'`)).ip,
      '198.51.100.9',
      'a forwarded address is used where there is one',
    );
  });
});

test('P-3: in-process, where there is a socket address, nothing changes: the audit row holds it, and no warning is logged', async () => {
  await withMapApp(async (ctx) => {
    await refusedCreate(ctx.call);
    assert.match((await lastAudit(ctx, `WHERE Method = 'POST'`)).ip, /^(127\.0\.0\.1|::1)$/);
    assert.equal(
      ctx.logger.calls.warn.filter((w) => String(w[0]).includes('TRUST_PROXY_HOPS')).length,
      0,
    );
  });
});

// ----------------------------------------------------------------------------------------------------------------- P-5

test('P-5: two forwarded clients get separate rate-limit keys on the Functions path (F3)', async () => {
  await withMapApp(
    async (ctx) => {
      const as = (address) => ({ 'x-forwarded-for': address });
      const health = (address) => ctx.hostCall('GET', '/api/health', { headers: as(address) });
      assert.equal((await health('198.51.100.1')).status, 200);
      assert.equal((await health('198.51.100.1')).status, 200);
      const limited = await health('198.51.100.1');
      assert.equal(limited.status, 429, 'the first client is over its two a minute');
      assert.equal((await health('198.51.100.2')).status, 200, 'the second client has its own key');
      assert.equal((await health('198.51.100.1')).status, 429);
    },
    { config: testConfig({ RATE_LIMIT_PER_MIN: '2', RATE_LIMIT: 'on' }) },
  );
});

test('P-5: in the emulator two callers without a header share the loopback key, and the limiter logs no undefined-address error', async () => {
  await withMapApp(
    async (ctx) => {
      for (let i = 0; i < 3; i += 1) await ctx.hostCall('GET', '/api/health');
      assert.equal((await ctx.hostCall('GET', '/api/health')).status, 429);
      const logged = JSON.stringify([ctx.logger.calls.error, ctx.logger.calls.warn]);
      assert.ok(
        !logged.includes('ERR_ERL_UNDEFINED_IP_ADDRESS'),
        'the key is the loopback, not undefined',
      );
    },
    { config: testConfig({ RATE_LIMIT_PER_MIN: '3', FUNCTIONS_EMULATOR: 'true' }) },
  );
});

// ----------------------------------------------------------------------------------------------------------------- P-6

test('P-6: the function never sends X-Powered-By, on an answer, a refusal or a 404', async () => {
  await withMapApp(async (ctx) => {
    for (const [label, res] of [
      ['health', await ctx.hostCall('GET', '/api/health')],
      ['a refusal', await ctx.hostCall('GET', '/api/venues', { headers: { authorization: null } })],
      ['a 404', await ctx.hostCall('GET', '/api/nothing-here')],
    ]) {
      assert.equal(res.headers.get('x-powered-by'), null, label);
    }
  });
});

// ------------------------------------------------------------------------------------------------------- the two units

function fakeRequest({ rawBody, type, body = { parsed: true } }) {
  return {
    rawBody,
    body,
    is: (wanted) => (type && type.startsWith(wanted) ? type : false),
  };
}

test('platformBody: it does nothing in-process (no rawBody), and on the platform path keeps JSON within the limit as parsed', () => {
  const run = (req, bytes = 1024) => {
    let outcome;
    createPlatformBody({ maxJsonBodyBytes: bytes })(req, {}, (err) => {
      outcome = err ?? 'next';
    });
    return outcome;
  };
  const inProcess = fakeRequest({
    rawBody: undefined,
    type: 'multipart/form-data',
    body: 'untouched',
  });
  assert.equal(run(inProcess), 'next');
  assert.equal(inProcess.body, 'untouched', 'in-process nothing is touched');

  const json = fakeRequest({
    rawBody: Buffer.from('{"a":1}'),
    type: 'application/json',
    body: { a: 1 },
  });
  assert.equal(run(json), 'next');
  assert.deepEqual(json.body, { a: 1 });

  for (const type of [
    'multipart/form-data',
    'text/plain',
    'application/x-www-form-urlencoded',
    undefined,
  ]) {
    const other = fakeRequest({ rawBody: Buffer.from('x'), type });
    assert.equal(run(other), 'next');
    assert.equal(other.body, undefined, `${type}: not express.json's, so removed`);
  }
  const empty = fakeRequest({ rawBody: Buffer.alloc(0), type: 'application/json', body: {} });
  run(empty);
  assert.equal(empty.body, undefined, 'an empty body is no body');

  const over = fakeRequest({ rawBody: Buffer.alloc(2048), type: 'application/json' });
  const refusal = run(over, 1024);
  assert.equal(refusal.type, 'entity.too.large');
  assert.equal(refusal.status, 413);
  const exact = fakeRequest({ rawBody: Buffer.alloc(1024, 0x20), type: 'application/json' });
  assert.equal(run(exact, 1024), 'next', 'a body exactly at the limit passes');
});

test('createJsonParser is one layer named jsonParser, so the stack order of the standard is unchanged', () => {
  const layer = createJsonParser({ maxJsonBody: '5mb', maxJsonBodyBytes: 5 * MB });
  assert.equal(layer.name, 'jsonParser');
});

test("installClientAddress: it asks Express first, then the loopback in the emulator, and the app's own prototype only", () => {
  const express = require('express');
  const warnings = [];
  const make = (functionsEmulator) => {
    const app = express();
    installClientAddress(app, {
      config: { functionsEmulator },
      logger: { warn: (m) => warnings.push(m) },
    });
    return app;
  };
  const noSocket = (app) =>
    Object.create(app.request, {
      socket: { value: {} },
      connection: { value: {} },
      headers: { value: {} },
    });
  const emulator = make(true);
  const plain = make(false);
  assert.equal(noSocket(emulator).ip, '127.0.0.1');
  assert.equal(noSocket(plain).ip, undefined);
  assert.equal(noSocket(plain).ip, undefined);
  assert.equal(warnings.length, 1, 'one warning per app');
  // An address Express can read is never replaced.
  const withSocket = Object.create(emulator.request, {
    socket: { value: { remoteAddress: '10.1.2.3' } },
    connection: { value: { remoteAddress: '10.1.2.3' } },
    headers: { value: {} },
  });
  assert.equal(withSocket.ip, '10.1.2.3');
  assert.equal(
    express.request === Object.getPrototypeOf(emulator.request),
    true,
    'the shared express.request is untouched',
  );
  assert.equal(Object.hasOwn(express.request, 'ip'), true);
});
