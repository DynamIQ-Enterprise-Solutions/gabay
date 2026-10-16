'use strict';

// DEP-0 AC-47, AC-48, AC-49 (plan/DEP-0.md 1.0 step 8): the Hosting block of firebase.json, read as data. It is written now and
// proven here by what a file can show; its proof on the real page is manual and recorded in plan/DEP-0-step0.md ("The page under the
// policy": the release build served from the Hosting emulator in a headless browser, no console violation) and again at DEP-1 on
// staging.
//
// Note recorded with that run: firebase-tools 15.32.1's Hosting emulator applies header rules written with `regex` and not rules
// written with a `source` glob (probed with five rules). The committed file keeps the documented glob (`source: "**"`, which Firebase
// Hosting applies, firebase.google.com/docs/hosting/full-config); the manual run converts it to `regex: ".*"` and nothing else.

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { apiOrigin, STAGING_PROJECT_ID } = require('../lib/staging');

const ROOT = path.resolve(__dirname, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const hosting = config.hosting;

/** The headers of the rule that applies to every path. */
const everyPath = hosting.headers.filter((rule) => rule.source === '**');
const headerOf = (key) =>
  everyPath.flatMap((r) => r.headers).find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

/** The policy as { directive: [sources] }. */
function parsePolicy(text) {
  const out = {};
  for (const part of text
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    assert.ok(!(name in out), `${name} appears once`);
    out[name] = sources;
  }
  return out;
}
const policy = parsePolicy(headerOf('Content-Security-Policy') ?? '');

test('AC-47: hosting serves the admin build folder, with the single-page rewrite and no rewrite to the function', () => {
  assert.equal(hosting.public, 'app/build/web');
  assert.deepEqual(hosting.rewrites, [{ source: '**', destination: '/index.html' }]);
  assert.ok(
    hosting.rewrites.every((r) => !('function' in r) && !('run' in r)),
    'nothing is rewritten to the API',
  );
  assert.ok(!('redirects' in hosting) || hosting.redirects.length === 0);
  assert.ok(hosting.ignore.includes('firebase.json'), 'the config itself is not served');
});

test('AC-47: on every path (**) the five headers are set, each exactly once', () => {
  const expected = {
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  assert.equal(everyPath.length, 1, 'one rule for **');
  const keys = everyPath[0].headers.map((h) => h.key);
  assert.equal(new Set(keys).size, keys.length, 'no header twice');
  assert.deepEqual([...keys].sort(), ['Content-Security-Policy', ...Object.keys(expected)].sort());
  for (const [key, value] of Object.entries(expected)) assert.equal(headerOf(key), value, key);
  assert.ok(
    typeof headerOf('Content-Security-Policy') === 'string' &&
      headerOf('Content-Security-Policy').length > 100,
  );
  assert.ok(
    hosting.headers.every((r) => r.source === '**'),
    'no other rule changes a header for a narrower path',
  );
});

test('AC-47: no Strict-Transport-Security is written (Hosting overwrites it on its own subdomains; the staging check reads it)', () => {
  assert.equal(headerOf('Strict-Transport-Security'), undefined);
});

test('AC-47: the Functions emulator health check still has what it needs: functions and auth emulators, and no hosting emulator entry', () => {
  assert.deepEqual(Object.keys(config.emulators).sort(), [
    'auth',
    'functions',
    'singleProjectMode',
    'ui',
  ]);
  assert.equal(config.emulators.functions.port, 5001);
  assert.equal(config.emulators.auth.port, 9099);
  assert.equal(config.functions.source, 'functions');
});

test('AC-48: the policy has the four anchors: default-src self, object-src none, base-uri self, frame-ancestors none', () => {
  assert.deepEqual(policy['default-src'], ["'self'"]);
  assert.deepEqual(policy['object-src'], ["'none'"]);
  assert.deepEqual(policy['base-uri'], ["'self'"]);
  assert.deepEqual(policy['frame-ancestors'], ["'none'"]);
  assert.deepEqual(policy['form-action'], ["'self'"]);
});

test('AC-48: scripts have no unsafe-eval and no unsafe-inline; WebAssembly is allowed by wasm-unsafe-eval, which CanvasKit needs', () => {
  const scripts = policy['script-src'];
  assert.ok(!scripts.includes("'unsafe-eval'"));
  assert.ok(!scripts.includes("'unsafe-inline'"));
  assert.ok(
    scripts.includes("'wasm-unsafe-eval'"),
    'the manual run without it fails: WebAssembly.compileStreaming is refused',
  );
  assert.ok(scripts.includes("'self'"));
  for (const directive of Object.keys(policy)) {
    assert.ok(
      !policy[directive].includes("'unsafe-eval'"),
      `${directive}: no unsafe-eval anywhere`,
    );
  }
});

test('AC-48: no source is a bare *, a scheme alone (https:), a wildcard host, or plain http', () => {
  for (const [directive, sources] of Object.entries(policy)) {
    for (const source of sources) {
      assert.notEqual(source, '*', `${directive}: no bare *`);
      assert.ok(
        !/^[a-z]+:$/.test(source) || ['data:', 'blob:'].includes(source),
        `${directive}: no scheme-only source ${source}`,
      );
      assert.ok(!source.includes('*'), `${directive}: no wildcard in ${source}`);
      assert.ok(!source.startsWith('http://'), `${directive}: no plain http: ${source}`);
    }
  }
});

test('AC-48: connect-src names self, the API origin and the Firebase Auth hosts exactly', () => {
  const connect = policy['connect-src'];
  assert.ok(connect.includes("'self'"));
  assert.ok(
    connect.includes(apiOrigin(STAGING_PROJECT_ID)),
    `the API origin ${apiOrigin(STAGING_PROJECT_ID)} (tools/lib/staging.js)`,
  );
  for (const host of [
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
  ]) {
    assert.ok(connect.includes(host), host);
  }
  // CanvasKit and the Roboto font are fetched from Google's static host by the Flutter release build.
  for (const host of ['https://www.gstatic.com', 'https://fonts.gstatic.com'])
    assert.ok(connect.includes(host), host);
  assert.ok(
    connect.every((s) => s === "'self'" || s.startsWith('https://')),
    'every named host is https',
  );
});

test('AC-48: the origins named in script, font and connect sources are the three the release build needs, and no more', () => {
  const hosts = (directive) =>
    (policy[directive] ?? []).filter((s) => s.startsWith('https://')).sort();
  assert.deepEqual(hosts('script-src'), ['https://www.gstatic.com']);
  assert.deepEqual(hosts('font-src'), ['https://fonts.gstatic.com']);
  assert.deepEqual(
    hosts('connect-src'),
    [
      apiOrigin(STAGING_PROJECT_ID),
      'https://fonts.gstatic.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://www.gstatic.com',
    ].sort(),
  );
  assert.deepEqual(policy['img-src'], ["'self'", 'data:', 'blob:']);
  assert.deepEqual(policy['worker-src'], ["'self'", 'blob:']);
});

test('AC-48: inline styles are allowed (the Flutter engine sets them; the manual run without it shows two violations), and only for styles', () => {
  assert.ok(policy['style-src'].includes("'unsafe-inline'"));
  for (const [directive, sources] of Object.entries(policy)) {
    if (directive !== 'style-src')
      assert.ok(!sources.includes("'unsafe-inline'"), `${directive}: no unsafe-inline`);
  }
});

test('AC-47: the admin build command the policy was found with is the documented one (AC-50: the release guard stays)', () => {
  const guard = fs.readFileSync(
    path.join(ROOT, 'app', 'lib', 'core', 'config', 'app_config.dart'),
    'utf8',
  );
  assert.match(guard, /A release build must be built with/);
  assert.match(guard, /points at this machine/);
});
