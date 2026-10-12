'use strict';

// FF-1 (plan/FF-1-venue-setup.md section 2.3 "The decimal columns", DC-8; spec AC-11, AC-16, AC-17): the services keep the
// schema's defaults and the CHECK ranges as constants, and this file fails when they drift from db/schema.sql.
// The services' constants have no name in the plan, so the mirror is proved by behaviour, with every expectation derived
// FROM schema.sql at run time:
//   - the columns the plan's table names have the type, scale, nullability and default the plan says (a changed schema
//     fails here first, before the services silently disagree with it);
//   - a blank decimal stores the column default, formatted at the column scale;
//   - a value at each CHECK bound is accepted and one step beyond it is refused with a 400, never a 500 from the CHECK.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Decimal = require('decimal.js');
const { parseSchema } = require('../../tools/lint/lib/schema');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

const SCHEMA_TEXT = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
const SCHEMA = parseSchema(SCHEMA_TEXT);
const NO_COMMENTS = SCHEMA_TEXT.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

const column = (table, name) =>
  SCHEMA.tables.get(table.toLowerCase()).columns.get(name.toLowerCase());

/** The text of one CREATE TABLE gabay.<table> ( ... ); block. */
function tableText(table) {
  const m = new RegExp(`CREATE\\s+TABLE\\s+gabay\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i').exec(
    NO_COMMENTS,
  );
  assert.ok(m, `${table} is in schema.sql`);
  return m[1];
}

/** The DEFAULT of a column as written in schema.sql, or null. */
function defaultOf(table, name) {
  const m = new RegExp(
    `\\b${name}\\s+\\w+(?:\\([^)]*\\))?\\s+(?:NOT\\s+NULL\\s+|NULL\\s+)?DEFAULT\\s+([^\\s,]+)`,
    'i',
  ).exec(tableText(table));
  return m ? m[1] : null;
}

/** The numeric range of a named CHECK: { min, max, maxInclusive }. */
function checkRange(constraint) {
  const m = new RegExp(`CONSTRAINT\\s+${constraint}\\s+CHECK\\s*\\(([^)]*)\\)`, 'i').exec(
    NO_COMMENTS,
  );
  const inline = new RegExp(`${constraint}\\s+CHECK\\s*\\(([^)]*)\\)`, 'i').exec(NO_COMMENTS);
  const expr = (m ?? inline)?.[1];
  assert.ok(expr, `${constraint} is in schema.sql`);
  const between = /BETWEEN\s+([\d.]+)\s+AND\s+([\d.]+)/i.exec(expr);
  if (between) return { min: between[1], max: between[2], maxInclusive: true };
  const bounds = />=\s*([\d.]+)\s+AND\s+\w+\s*<\s*([\d.]+)/i.exec(expr);
  assert.ok(bounds, `the range of ${constraint} is readable: ${expr}`);
  return { min: bounds[1], max: bounds[2], maxInclusive: false };
}

const COLUMNS = [
  // table, column, precision, scale, nullable, default
  ['Venue', 'MapUpDeg', 6, 2, false, '0'],
  ['Building', 'MapUpDeg', 6, 2, true, null],
  ['Level', 'ElevationM', 9, 3, false, '0'],
  ['Level', 'WidthM', 9, 3, false, null],
  ['Level', 'DepthM', 9, 3, false, null],
  ['Level', 'GridCellM', 5, 2, false, '1.00'],
  ['Level', 'CeilingHeightM', 5, 2, true, null],
];

test('schema mirror: the decimal columns of the plan table have the precision, scale, nullability and default it states (DC-8)', () => {
  for (const [table, name, precision, scale, nullable, def] of COLUMNS) {
    const col = column(table, name);
    assert.ok(col, `${table}.${name}`);
    assert.equal(col.type, 'DECIMAL', `${table}.${name}`);
    assert.equal(col.precision, precision, `${table}.${name} precision`);
    assert.equal(col.scale, scale, `${table}.${name} scale`);
    assert.equal(col.nullable, nullable, `${table}.${name} nullable`);
    assert.equal(defaultOf(table, name), def, `${table}.${name} default`);
  }
});

test('schema mirror: the text and integer columns have the lengths the spec states', () => {
  for (const [table, name, length, nullable] of [
    ['Venue', 'Code', 40, false],
    ['Venue', 'Name', 200, false],
    ['Building', 'Name', 200, false],
    ['Level', 'Name', 100, false],
    ['Level', 'ShortName', 10, false],
    ['Level', 'SpokenName', 100, true],
  ]) {
    const col = column(table, name);
    assert.equal(col.type, 'VARCHAR', `${table}.${name}`);
    assert.equal(col.length, length, `${table}.${name} length`);
    assert.equal(col.nullable, nullable, `${table}.${name} nullable`);
  }
  assert.equal(column('Level', 'Ordinal').type, 'INT');
  assert.equal(column('Level', 'Ordinal').nullable, false);
});

test('schema mirror: the CHECK ranges are the ones the spec and the plan table state', () => {
  assert.deepEqual(checkRange('CK_Venue_MapUpDeg'), { min: '0', max: '360', maxInclusive: false });
  assert.deepEqual(checkRange('CK_Building_MapUpDeg'), {
    min: '0',
    max: '360',
    maxInclusive: false,
  });
  assert.deepEqual(checkRange('CK_Level_GridCell'), {
    min: '0.25',
    max: '2.00',
    maxInclusive: true,
  });
});

/** The values one step inside and outside a CHECK range, at the column scale, from the schema. */
function boundaryValues(constraint, scale) {
  const { min, max, maxInclusive } = checkRange(constraint);
  const step = new Decimal(10).pow(-scale);
  const at = (d) => d.toFixed(scale);
  return {
    accepted: [
      at(new Decimal(min)),
      at(maxInclusive ? new Decimal(max) : new Decimal(max).minus(step)),
    ],
    refused: [
      at(new Decimal(min).minus(step)),
      at(maxInclusive ? new Decimal(max).plus(step) : new Decimal(max)),
    ],
  };
}

test('schema mirror: a venue angle at each CHECK bound is accepted, one step beyond is a 400, and blank is the schema default', async () => {
  await withVenueApp(async (ctx) => {
    const { post } = ctx;
    const { accepted, refused } = boundaryValues(
      'CK_Venue_MapUpDeg',
      column('Venue', 'MapUpDeg').scale,
    );
    for (const value of accepted) {
      const res = await post('/api/venues', bodies(ctx).venue({ mapUpDeg: value }));
      assert.equal(res.status, 201, `${value} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.mapUpDeg, value);
    }
    for (const value of refused) {
      assertRefused(
        await post('/api/venues', bodies(ctx).venue({ mapUpDeg: value })),
        400,
        /angle|map up/i,
        value,
      );
    }
    const blank = await post('/api/venues', bodies(ctx).venue({ mapUpDeg: null }));
    assert.equal(
      blank.body.mapUpDeg,
      new Decimal(defaultOf('Venue', 'MapUpDeg')).toFixed(column('Venue', 'MapUpDeg').scale),
    );
  });
});

test('schema mirror: a building angle at each CHECK bound is accepted, one step beyond is a 400, and blank is NULL', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const { accepted, refused } = boundaryValues(
      'CK_Building_MapUpDeg',
      column('Building', 'MapUpDeg').scale,
    );
    for (const value of accepted) {
      const res = await post(
        `/api/venues/${venue}/buildings`,
        bodies(ctx).building(type, { mapUpDeg: value }),
      );
      assert.equal(res.status, 201, `${value} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.mapUpDeg, value);
    }
    for (const value of refused) {
      assertRefused(
        await post(
          `/api/venues/${venue}/buildings`,
          bodies(ctx).building(type, { mapUpDeg: value }),
        ),
        400,
        /angle|map up/i,
        value,
      );
    }
    assert.equal(
      defaultOf('Building', 'MapUpDeg'),
      null,
      'the schema has no default, so blank is NULL',
    );
    const blank = await post(
      `/api/venues/${venue}/buildings`,
      bodies(ctx).building(type, { mapUpDeg: null }),
    );
    assert.equal(blank.body.mapUpDeg, null);
  });
});

test('schema mirror: a level grid cell at each CHECK bound is accepted, one step beyond is a 400; blank elevation and grid are the schema defaults', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    const { accepted, refused } = boundaryValues(
      'CK_Level_GridCell',
      column('Level', 'GridCellM').scale,
    );
    for (const value of accepted) {
      const res = await post(
        `/api/buildings/${building}/levels`,
        bodies(ctx).level({ gridCellM: value }),
      );
      assert.equal(res.status, 201, `${value} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.gridCellM, value);
    }
    for (const value of refused) {
      assertRefused(
        await post(`/api/buildings/${building}/levels`, bodies(ctx).level({ gridCellM: value })),
        400,
        /grid/i,
        value,
      );
    }
    const blank = await post(
      `/api/buildings/${building}/levels`,
      bodies(ctx).level({ elevationM: '', gridCellM: '' }),
    );
    assert.equal(blank.status, 201, JSON.stringify(blank.body));
    assert.equal(
      blank.body.elevationM,
      new Decimal(defaultOf('Level', 'ElevationM')).toFixed(column('Level', 'ElevationM').scale),
    );
    assert.equal(
      blank.body.gridCellM,
      new Decimal(defaultOf('Level', 'GridCellM')).toFixed(column('Level', 'GridCellM').scale),
    );
    assert.equal(defaultOf('Level', 'CeilingHeightM'), null);
    assert.equal(blank.body.ceilingHeightM, null);
  });
});

test('schema mirror: each decimal column accepts its largest value and refuses one more integer digit, from precision and scale', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    for (const key of ['elevationM', 'widthM', 'depthM']) {
      const { precision, scale } = column('Level', key);
      const largest = `${'9'.repeat(precision - scale)}.${'9'.repeat(scale)}`;
      const tooBig = `1${'0'.repeat(precision - scale)}`;
      const ok = await post(
        `/api/buildings/${building}/levels`,
        bodies(ctx).level({ [key]: largest }),
      );
      assert.equal(ok.status, 201, `${key} ${largest} ${JSON.stringify(ok.body)}`);
      assert.equal(ok.body[key], largest);
      assertRefused(
        await post(`/api/buildings/${building}/levels`, bodies(ctx).level({ [key]: tooBig })),
        400,
        null,
        `${key} ${tooBig}`,
      );
    }
    const { precision, scale } = column('Level', 'CeilingHeightM');
    const largest = `${'9'.repeat(precision - scale)}.${'9'.repeat(scale)}`;
    const ok = await post(
      `/api/buildings/${building}/levels`,
      bodies(ctx).level({ ceilingHeightM: largest }),
    );
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.ceilingHeightM, largest);
    assertRefused(
      await post(
        `/api/buildings/${building}/levels`,
        bodies(ctx).level({ ceilingHeightM: `1${'0'.repeat(precision - scale)}` }),
      ),
      400,
      /ceiling/i,
    );
  });
});
