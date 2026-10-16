'use strict';

// REGRESSION: an impossible date in an edit's updatedAt was not refused (dod-reviewer's FF-1 review). The old check was a
// pattern plus Date.parse, so "2026-02-30T00:00:00.000Z" rolled over into 2 March and came back as a 409 ("someone else
// changed this"), and year 0000 or an offset like +24:00 could reach PostgreSQL's timestamptz cast as a 500. Now every
// part is range-checked, the calendar date is round-tripped against the input, the offset is at most 15:59 either way,
// and the instant lies in the years 0001 to 9999: anything else is 400, and nothing is written.

const test = require('node:test');
const assert = require('node:assert/strict');
const { updatedAt } = require('../src/validation/fields');

/**
 * SEC-2 (plan C1): readUpdatedAt became the updatedAt() schema (validation/fields.js). This adapter gives the two unit
 * cases below their old shape: the token, or a thrown 400 with the schema's own message.
 */
function readUpdatedAt(body) {
  const result = updatedAt().safeParse(body.updatedAt);
  if (result.success) return result.data;
  const err = new Error(result.error.issues[0].message);
  err.httpStatus = 400;
  throw err;
}
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

const BAD = 'Updated at must be null or a date and time such as 2026-10-09T01:02:03.456Z';

const IMPOSSIBLE = [
  '2026-02-30T00:00:00.000Z', // no 30 February
  '2026-02-29T00:00:00.000Z', // 2026 is not a leap year
  '2026-04-31T00:00:00.000Z',
  '2026-13-01T00:00:00.000Z',
  '2026-00-10T00:00:00.000Z',
  '2026-01-00T00:00:00.000Z',
  '0000-01-01T00:00:00.000Z', // there is no year 0000
  '0001-01-01T00:30:00.000+01:00', // before the year 0001 once the offset is applied
  '2026-01-01T24:00:00.000Z',
  '2026-01-01T23:60:00.000Z',
  '2026-01-01T23:59:60.000Z', // no leap seconds
  '2026-01-01T00:00:00.000+16:00', // past +15:59
  '2026-01-01T00:00:00.000-16:00',
  '2026-01-01T00:00:00.000+15:60',
  '2026-01-01T00:00:00.000+24:00',
  '2026-01-01T00:00:00.000+99:99',
  '2026-01-01T00:00:00.000', // no zone
  '2026-01-01 00:00:00.000Z',
  '2026-1-01T00:00:00.000Z',
  '+002026-01-01T00:00:00.000Z',
  'March 7, 2026',
];

test('readUpdatedAt: impossible dates and times are a 400, never a rollover', () => {
  for (const value of IMPOSSIBLE) {
    assert.throws(
      () => readUpdatedAt({ updatedAt: value }),
      (err) => err.httpStatus === 400 && err.message === BAD,
      value,
    );
  }
});

test('readUpdatedAt: real instants are accepted and given back as UTC ISO text with milliseconds', () => {
  for (const [value, expected] of [
    ['2024-02-29T12:00:00.000Z', '2024-02-29T12:00:00.000Z'], // a leap day
    ['2026-10-09T09:02:03.456+08:00', '2026-10-09T01:02:03.456Z'],
    ['2026-10-09T01:02:03.456-00:00', '2026-10-09T01:02:03.456Z'],
    ['2026-01-01T00:00:00.000+15:59', '2025-12-31T08:01:00.000Z'],
    ['2026-01-01T00:00:00.000-15:59', '2026-01-01T15:59:00.000Z'],
    ['0001-01-01T00:00:00.000Z', '0001-01-01T00:00:00.000Z'],
    ['0099-06-15T00:00:00Z', '0099-06-15T00:00:00.000Z'], // years 1 to 99 stay as written
    ['9999-12-31T23:59:59.999Z', '9999-12-31T23:59:59.999Z'],
    ['2026-10-09T01:02:03.5Z', '2026-10-09T01:02:03.500Z'],
    ['2026-10-09T01:02:03.123456Z', '2026-10-09T01:02:03.123Z'],
  ]) {
    assert.equal(readUpdatedAt({ updatedAt: value }), expected, value);
  }
  assert.equal(readUpdatedAt({ updatedAt: null }), null);
});

// OA-2 (plan 1.0 section 6.2): the building and level PUTs retired (AC-42) and mapUpDeg left the venue body (AC-43), so
// the venue PUT is the one route left.
test('updatedAt through the routes: an impossible date is a 400 on the venue PUT and writes nothing; the same instant in another zone is accepted', async () => {
  await withVenueApp(async (ctx) => {
    const { post, put, get } = ctx;
    const b = bodies(ctx);
    const venue = (await post('/api/venues', b.venue())).body;
    const targets = [[`/api/venues/${venue.id}`, { code: venue.code, name: 'x', isActive: true }]];
    for (const [path, body] of targets) {
      const before = (await get(path)).body;
      for (const updatedAt of [
        '2026-02-30T00:00:00.000Z',
        '0000-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000+16:00',
      ]) {
        const res = await put(path, { ...body, updatedAt });
        assertRefused(res, 400, /updated at/i, `${path} ${updatedAt}`);
        assert.equal(res.body.error, BAD);
      }
      assert.deepEqual((await get(path)).body, before, `${path}: nothing was written`);
    }

    // a real token, written in +08:00, names the same instant as the stored one
    const first = await put(targets[0][0], { ...targets[0][1], updatedAt: null });
    assert.equal(first.status, 200);
    const stored = new Date(first.body.updatedAt);
    const local = new Date(stored.getTime() + 8 * 3600000).toISOString().replace('Z', '+08:00');
    const again = await put(targets[0][0], { ...targets[0][1], name: 'y', updatedAt: local });
    assert.equal(again.status, 200, `${local} ${JSON.stringify(again.body)}`);
  });
});
