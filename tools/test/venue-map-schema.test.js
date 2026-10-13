// The app's Dart copy of the venue map document's schema file (spec/OA-1.md r1 AC-38, AC-39; E-26; plan/OA-1-map-document.md
// 1.0 sections 3.4 and 9): app/lib/core/config/venue_map_schema.dart is generated from
// functions/src/config/venue-map-schema.json by `npm run gen:venue-map-schema` (tools/gen-venue-map-schema.js), in the same
// way as the constants file. This test is what keeps it current. Written FIRST: every case fails until engine-coder builds
// the generator and writes the Dart file.
//
// The Dart file's internal layout is the generator's (plan section 3.4 names its parts, not its text), so these cases check
// what the plan fixes: the check mode, staleness, that no catalog type or lookup row is copied, that the closed sets are
// referenced and not copied, and that the four properties the lint needs are stated.
'use strict';

const test = require('./timeout');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GENERATOR = 'tools/gen-venue-map-schema.js';
const DART_FILE = 'app/lib/core/config/venue_map_schema.dart';
const SCHEMA_FILE = 'functions/src/config/venue-map-schema.json';

const run = (root, ...args) =>
  spawnSync(process.execPath, [path.join(root, GENERATOR), ...args], {
    cwd: root,
    encoding: 'utf8',
  });

/** A throwaway repo root holding only what the generator reads and writes, so a stale copy can be made safely. */
function scratchRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-venue-map-schema-'));
  const copy = (rel) => {
    const to = path.join(root, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(path.join(ROOT, rel), to, { recursive: true });
  };
  copy('tools/gen-venue-map-schema.js');
  copy('tools/lib');
  for (const f of [
    'venueMapSchema.js',
    'venue-map-schema.json',
    'closedSets.js',
    'closed-sets.json',
    'venue-map-rounding-vectors.json',
  ]) {
    copy(`functions/src/config/${f}`);
  }
  copy('app/lib/core/config/closed_sets.dart');
  copy(DART_FILE);
  return root;
}

test('venue map schema Dart copy: the generator exists, and --check exits 0 on the live files', () => {
  assert.ok(fs.existsSync(path.join(ROOT, GENERATOR)), `${GENERATOR} exists`);
  const r = run(ROOT, '--check');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /up to date/);
});

test('venue map schema Dart copy: the committed file is generated (header) and sits where AC-38 says', () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  assert.match(dart, /^\/\/ GENERATED FILE: do not edit\./);
  assert.match(dart, /venue-map-schema\.json/, 'names its source');
});

test('venue map schema Dart copy: --check exits 1 and writes nothing while the Dart file is stale', () => {
  const root = scratchRoot();
  try {
    const dartPath = path.join(root, DART_FILE);
    fs.appendFileSync(dartPath, '\n// a hand edit\n');
    const stale = fs.readFileSync(dartPath, 'utf8');
    const r = run(root, '--check');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /stale|out of date|npm run gen:venue-map-schema/i);
    assert.equal(fs.readFileSync(dartPath, 'utf8'), stale, '--check writes nothing');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('venue map schema Dart copy: a changed cap in the schema file makes the Dart copy stale, and regenerating brings the new value across', () => {
  const root = scratchRoot();
  try {
    const schemaPath = path.join(root, SCHEMA_FILE);
    const json = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.equal(json.constants.MAX_WALLS_PER_LEVEL.value, 2000);
    json.constants.MAX_WALLS_PER_LEVEL.value = 2345;
    fs.writeFileSync(schemaPath, JSON.stringify(json, null, 2));
    assert.equal(run(root, '--check').status, 1, 'stale after the change');
    const written = run(root);
    assert.equal(written.status, 0, written.stdout + written.stderr);
    assert.match(fs.readFileSync(path.join(root, DART_FILE), 'utf8'), /\b2345\b/);
    assert.equal(run(root, '--check').status, 0, 'current after regenerating');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('venue map schema Dart copy: the generator refuses a broken schema file (it reads it through the API loader)', () => {
  const root = scratchRoot();
  try {
    const schemaPath = path.join(root, SCHEMA_FILE);
    const json = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    delete json.constants.MAX_LEVELS.source;
    fs.writeFileSync(schemaPath, JSON.stringify(json, null, 2));
    const r = run(root, '--check');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /MAX_LEVELS needs a source/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('venue map schema Dart copy: it holds no catalog type and no lookup row (AC-38: the catalog is served, never copied)', () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const lookups = fs.readFileSync(path.join(ROOT, 'db/seeds/lib/lookups.js'), 'utf8');
  const closed = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'functions/src/config/closed-sets.json'), 'utf8'),
  );
  const closedValues = new Set(Object.values(closed.sets).flatMap((s) => s.values));
  const seeded = [...lookups.matchAll(/\bCode:\s*'([A-Za-z0-9_]+)'/g)]
    .map((m) => m[1])
    .filter((c) => !closedValues.has(c));
  assert.ok(seeded.length > 20, `read ${seeded.length} seeded lookup codes`);
  for (const code of seeded) {
    assert.doesNotMatch(
      dart,
      new RegExp(`['"]${code}['"]`),
      `the Dart copy holds the lookup code ${code}`,
    );
  }
  for (const label of ['Main building', 'Restroom', 'Pillar', 'Fashion', 'Taxi bay']) {
    assert.ok(!dart.includes(label), `the Dart copy holds the lookup label ${label}`);
  }
});

test('venue map schema Dart copy: the closed sets are referenced from closed_sets.dart, never copied (no enum, no category list)', () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  assert.doesNotMatch(dart, /^\s*enum\s/m, 'no enum of its own');
  assert.ok(!dart.includes('restroom.female.wheelchair'), 'the IMDF list is not copied');
  assert.match(dart, /closed_sets\.dart/, 'it imports the generated sets');
});

test("venue map schema Dart copy: it carries the schema file's caps and ranges (every integer constant appears), so the app's panels state the same limits", () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const { constants } = JSON.parse(fs.readFileSync(path.join(ROOT, SCHEMA_FILE), 'utf8'));
  const { VENUE_MAP_SCHEMA } = require('../../functions/src/config/venueMapSchema');
  for (const name of Object.keys(constants)) {
    const value = VENUE_MAP_SCHEMA.constants[name];
    if (Number.isInteger(value) && Math.abs(value) >= 10) {
      assert.match(
        dart,
        new RegExp(`(?<![\\d.])${Math.abs(value)}(?![\\d.])`),
        `${name} = ${value} is in the Dart copy`,
      );
    }
  }
});

test('venue map schema Dart copy: for each field it states the four properties the lint checks (kind, nullability, maximum length, scale)', () => {
  const dart = fs.readFileSync(path.join(ROOT, DART_FILE), 'utf8');
  const { VENUE_MAP_SCHEMA: S } = require('../../functions/src/config/venueMapSchema');
  for (const word of [/required/i, /maxLength/i, /decimals|scale/i, /type|kind/i]) {
    assert.match(dart, word, `the Dart copy names ${word}`);
  }
  for (const [kind, def] of Object.entries(S.kinds)) {
    assert.ok(dart.includes(kind), `the element kind ${kind} is in the Dart copy`);
    for (const [name, rule] of Object.entries(def.fields)) {
      assert.ok(
        dart.includes(`'${name}'`) || dart.includes(`"${name}"`),
        `${kind}.${name} is a named field in the Dart copy`,
      );
      if (rule.type === 'text' && rule.maxLength !== undefined) {
        assert.match(
          dart,
          new RegExp(`(?<![\\d.])${rule.maxLength}(?![\\d.])`),
          `${kind}.${name} maxLength ${rule.maxLength}`,
        );
      }
    }
  }
});

test('venue map schema Dart copy: the package.json command exists, and both generators share tools/lib/dart-gen.js (C2)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['gen:venue-map-schema'] ?? '', /gen-venue-map-schema\.js/);
  assert.match(pkg.scripts['gen:closed-sets'] ?? '', /gen-closed-sets\.js/);
  assert.ok(fs.existsSync(path.join(ROOT, 'tools/lib/dart-gen.js')), 'tools/lib/dart-gen.js');
  for (const g of ['tools/gen-venue-map-schema.js', 'tools/gen-closed-sets.js']) {
    assert.match(
      fs.readFileSync(path.join(ROOT, g), 'utf8'),
      /require\(['"]\.\/lib\/dart-gen['"]\)/,
      `${g} uses the shared part`,
    );
  }
});
