'use strict';

// REGRESSION: a NUL (U+0000) in a text field or in ?search= was a 500 (dod-reviewer's FF-1 review, Important 1).
// PostgreSQL text cannot hold U+0000, so the driver's error reached the error handler. Now every text field refuses the
// C0 control characters U+0000 to U+001F and DEL (U+007F) with 400 "<Field> contains a character that cannot be
// stored", and a list search holding one is 400 "Search contains a character that cannot be searched for", on every
// list route that reads a search (FF-1's and FF-0's lookups). Leading and trailing tabs and line breaks are still
// trimmed away first, so only one inside the text is refused.

const test = require('node:test');
const assert = require('node:assert/strict');
const { hasControlCharacter } = require('../src/utils/text');
const { parsePaging } = require('../src/utils/pagination');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');
const { assertRefusedEverywhere } = require('./fieldChecks');

const CONTROL_VALUES = [
  '\u0000',
  'a\u0000b',
  '  \u0000  ',
  'a\u0001b',
  'a\tb',
  'a\nb',
  'a\rb',
  'a\u001Fb',
  'a\u007Fb',
];
const SEARCH_REFUSED = 'Search contains a character that cannot be searched for';
const cannotBeStored = (label) =>
  new RegExp(`^${label} contains a character that cannot be stored$`);

test('text: hasControlCharacter is true for U+0000 to U+001F and U+007F, and false for printable text', () => {
  for (let code = 0; code < 0x20; code += 1) {
    assert.equal(hasControlCharacter(`a${String.fromCharCode(code)}b`), true, code.toString(16));
  }
  assert.equal(hasControlCharacter('a\u007Fb'), true);
  for (const text of [
    '',
    'Aurora Mall',
    'Parañaque Annex',
    '\u{1F600}',
    'a b',
    '\u0080',
    ' ',
    '~',
  ]) {
    assert.equal(hasControlCharacter(text), false, JSON.stringify(text));
  }
});

test('pagination: a search holding a control character is a 400; one trimmed away is not', () => {
  const opts = { sortMap: { name: 'Name' }, defaultSort: 'name' };
  for (const search of ['\u0000', 'a\u0000b', 'a\u0001', 'x\u007F']) {
    assert.throws(
      () => parsePaging({ search }, opts),
      (err) => err.httpStatus === 400 && err.message === SEARCH_REFUSED,
      JSON.stringify(search),
    );
  }
  assert.equal(parsePaging({ search: '\tmall\n' }, opts).search, 'mall');
  assert.equal(parsePaging({ search: '\t\n' }, opts).search, null);
});

/** Every text field of every record kind, on create and on edit; nothing is written, nothing changes. */
test('control characters: every FF-1 text field refuses them on create and edit with a 400 naming the field', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get, sql, tenantA } = ctx;
    const b = bodies(ctx);
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = (await post('/api/venues', b.venue())).body;
    const building = (await post(`/api/venues/${venue.id}/buildings`, b.building(type))).body;
    const level = (await post(`/api/buildings/${building.id}/levels`, b.level())).body;
    const count = async () =>
      Number(
        (
          await sql.one(
            `SELECT (SELECT COUNT(*) FROM gabay.Venue WHERE TenantId = $1)
                  + (SELECT COUNT(*) FROM gabay.Building WHERE TenantId = $1)
                  + (SELECT COUNT(*) FROM gabay.Level WHERE TenantId = $1) AS n`,
            [tenantA.tenantId],
          )
        ).n,
      );

    const venueIo = (key) => ({
      create: (value) => post('/api/venues', b.venue({ [key]: value })),
      update: async (value) => {
        const { code, name, mapUpDeg, isActive, updatedAt } = (await get(`/api/venues/${venue.id}`))
          .body;
        return put(`/api/venues/${venue.id}`, {
          code,
          name,
          mapUpDeg,
          isActive,
          updatedAt,
          [key]: value,
        });
      },
      count,
      snapshot: async () => (await get(`/api/venues/${venue.id}`)).body,
    });
    const buildingIo = (key) => ({
      create: (value) =>
        post(`/api/venues/${venue.id}/buildings`, b.building(type, { [key]: value })),
      update: async (value) => {
        const loaded = (await get(`/api/buildings/${building.id}`)).body;
        return put(`/api/buildings/${building.id}`, {
          name: loaded.name,
          buildingTypeId: loaded.buildingTypeId,
          mapUpDeg: loaded.mapUpDeg,
          updatedAt: loaded.updatedAt,
          [key]: value,
        });
      },
      count,
      snapshot: async () => (await get(`/api/buildings/${building.id}`)).body,
    });
    const levelIo = (key) => ({
      create: (value) => post(`/api/buildings/${building.id}/levels`, b.level({ [key]: value })),
      update: async (value) => {
        const l = (await get(`/api/levels/${level.id}`)).body;
        return put(`/api/levels/${level.id}`, {
          ordinal: l.ordinal,
          name: l.name,
          shortName: l.shortName,
          spokenName: l.spokenName,
          elevationM: l.elevationM,
          widthM: l.widthM,
          depthM: l.depthM,
          gridCellM: l.gridCellM,
          ceilingHeightM: l.ceilingHeightM,
          updatedAt: l.updatedAt,
          [key]: value,
        });
      },
      count,
      snapshot: async () => (await get(`/api/levels/${level.id}`)).body,
    });

    for (const [io, key, label] of [
      [venueIo, 'code', 'Code'],
      [venueIo, 'name', 'Name'],
      [buildingIo, 'name', 'Name'],
      [levelIo, 'name', 'Name'],
      [levelIo, 'shortName', 'Short name'],
      [levelIo, 'spokenName', 'Spoken name'],
    ]) {
      await assertRefusedEverywhere(io(key), { key, label: cannotBeStored(label) }, CONTROL_VALUES);
    }
  });
});

test('control characters: the outdoor ground level refuses them too', async () => {
  await withVenueApp(async (ctx) => {
    const { post, sql, tenantA } = ctx;
    const venue = await sql.venue(tenantA.tenantId);
    for (const key of ['name', 'shortName', 'spokenName']) {
      assertRefused(
        await post(
          `/api/venues/${venue}/outdoor-levels`,
          bodies(ctx).outdoor({ [key]: 'a\u0000b' }),
        ),
        400,
        /contains a character that cannot be stored/,
        key,
      );
    }
  });
});

test('control characters: a search holding one is a 400 on every list route that searches, never a 500', async () => {
  await withVenueApp(async (ctx) => {
    const { get, sql, tenantA } = ctx;
    const type = await sql.buildingType(tenantA.tenantId);
    const venue = await sql.venue(tenantA.tenantId);
    const building = await sql.building(tenantA.tenantId, venue, type);
    for (const path of [
      '/api/venues',
      `/api/venues/${venue}/buildings`,
      `/api/buildings/${building}/levels`,
      '/api/lookups/building-types',
      '/api/lookups/amenity-types',
      '/api/lookups/transit-types',
    ]) {
      for (const search of ['%00', 'a%00b', '%01', 'a%7F']) {
        const res = await get(`${path}?search=${search}`);
        assertRefused(res, 400, null, `${path}?search=${search}`);
        assert.equal(res.body.error, SEARCH_REFUSED);
      }
      assert.equal(
        (await get(`${path}?search=%09mall%0A`)).status,
        200,
        `${path}: a trimmed tab is fine`,
      );
    }
  });
});
