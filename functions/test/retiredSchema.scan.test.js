'use strict';

// OA-3a (spec/OA-3.md r2 AC-8; plan/OA-3a-migration-rekey.md 1.1 section 3): no code under functions/src, db/tools/lib,
// db/tools/setup-db.js, db/tools/migrate.js or db/seeds/lib reads or writes a table, a Venue column or a key column that schema 0.17 dropped or
// replaced. A scan of the code with its comments stripped (comments may name history), case-sensitive, so a reappearance
// fails here. The migrations and the frozen fixtures are exempt (they are history), and so are the tests (they assert the
// absence). A planted example proves each pattern actually matches.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const ROOTS = [
  'functions/src',
  'db/tools/lib',
  'db/tools/setup-db.js',
  'db/tools/migrate.js',
  'db/seeds/lib',
];
const TABLES = [
  'Building',
  'Level',
  'Unit',
  'Opening',
  'FloorUnderlay',
  'FloorObject',
  'Amenity',
  'TransitPoint',
  'Anchor',
  'NavConnector',
  'NavConnectorStop',
  'NavCorrection',
];
/** Each retired name, as code would write it: a schema-qualified table, a quoted table name (the seed's insert helper), a
 * dropped Venue column, a metre cost column, or an element id column. */
const PATTERNS = [
  ...TABLES.map((t) => [`table ${t}`, new RegExp(`\\bgabay\\.${t}\\b`)]),
  ...TABLES.map((t) => [`table name '${t}'`, new RegExp(`['"\`]${t}['"\`]`)]),
  ['Venue.BoundaryGeoJson', /\bBoundaryGeoJson\b/],
  ['Venue.GeoreferenceJson', /\bGeoreferenceJson\b/],
  ['Venue.MapUpDeg', /\bMapUpDeg\b/],
  ['ConnectorType.CostBaseM', /\bCostBaseM\b/],
  ['ConnectorType.CostPerRiseM', /\bCostPerRiseM\b/],
  ['an element id column UnitId', /\bUnitId\b/],
  ['an element id column LevelId', /\bLevelId\b/],
  ['an element id column NavConnectorId', /\bNavConnectorId\b/],
  ['ZERO_BOUNDARY', /\bZERO_BOUNDARY\b/],
];

/** The code without its comments: block comments, then line comments (a "//" inside a string is kept by the lookbehind). */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

function filesUnder(rel) {
  const full = path.join(REPO, rel);
  if (fs.statSync(full).isFile()) return [full];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const child = path.join(full, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path.relative(REPO, child)));
    else if (entry.name.endsWith('.js')) out.push(child);
  }
  return out;
}

/** Every [file, label] where a retired name appears in code. */
function findRetired(files, read = (f) => fs.readFileSync(f, 'utf8')) {
  const hits = [];
  for (const file of files) {
    const code = stripComments(read(file));
    for (const [label, re] of PATTERNS) {
      if (re.test(code))
        hits.push(`${path.relative(REPO, file).split(path.sep).join('/')}: ${label}`);
    }
  }
  return hits;
}

test('AC-8: no code under functions/src, db/tools/lib, db/tools/setup-db.js, db/tools/migrate.js or db/seeds/lib names a retired table, Venue column, metre cost or element id column', () => {
  const files = ROOTS.flatMap(filesUnder);
  assert.ok(files.length > 50, `the scan reads the code (${files.length} files)`);
  assert.deepEqual(findRetired(files), []);
});

test('AC-8: the scan fails on a planted example of each kind, and ignores the names in a comment', () => {
  const planted = {
    'a.js': "await q.query('SELECT * FROM gabay.Level WHERE TenantId = $1', [t]);",
    'b.js': "await insert(client, 'Unit', row, 'UnitId');",
    'c.js':
      'const sql = `INSERT INTO gabay.Venue (TenantId, Code, Name, BoundaryGeoJson) VALUES ($1, $2, $3, $4)`;',
    'd.js':
      'const cost = row.CostBaseM + row.CostPerRiseM * rise; const id = r.NavConnectorId; obj.MapUpDeg = 0;',
    'e.js':
      '// gabay.Building, UnitId and MapUpDeg in a comment are history\n/* gabay.Level, CostBaseM */ const ok = 1;',
    'f.js':
      "const k = 'LevelKey'; const u = row.UnitKey; q('SELECT ConnectorKey FROM gabay.Closure');",
  };
  const hits = findRetired(
    Object.keys(planted).map((f) => path.join(REPO, f)),
    (f) => planted[path.basename(f)],
  );
  for (const expected of [
    'a.js: table Level',
    "b.js: table name 'Unit'",
    'b.js: an element id column UnitId',
    'c.js: Venue.BoundaryGeoJson',
    'd.js: ConnectorType.CostBaseM',
    'd.js: ConnectorType.CostPerRiseM',
    'd.js: an element id column NavConnectorId',
    'd.js: Venue.MapUpDeg',
  ]) {
    assert.ok(hits.includes(expected), `${expected} is found (${JSON.stringify(hits)})`);
  }
  assert.ok(!hits.some((h) => h.startsWith('e.js')), 'a comment is not code');
  assert.ok(!hits.some((h) => h.startsWith('f.js')), 'the 0.17 key names are not retired names');
});
