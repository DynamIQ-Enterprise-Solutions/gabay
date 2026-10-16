// SEC-2 step 4: the runtime proof that error responses leak no driver text (spec/SEC-2.md r2 AC-54; standard §6). The static
// half is the raw-error-text lint (tools/lint/test/raw-error-text.test.js). Extends errors.test.js's pattern through the real
// app: a statement of a real route throws a PostgreSQL-shaped error that names a table, a column and a constraint.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bodies } = require('./venueApp');
const { withMapApp } = require('./mapApp');

const DRIVER_WORDS =
  /violates|foreign key|duplicate key|unique constraint|FK_Venue_Level|uq_other|gabay\.|relation "|column "|Key \(|detail|\bat \w+ \(/i;

/** The error pg raises, as pg shapes it: SQLSTATE `code`, `severity`, and the names of the table and constraint. */
function pgError(code, constraint) {
  const err = new Error(
    `insert or update on table "venue" violates foreign key constraint "${constraint}" (column "levelid" of gabay.venue)`,
  );
  Object.assign(err, {
    code,
    severity: 'ERROR',
    detail: 'Key (levelid)=(7) is not present in table "level".',
    hint: 'check gabay.level',
    schema: 'gabay',
    table: 'venue',
    column: 'levelid',
    constraint,
    routine: 'ri_ReportViolation',
    where: 'SQL statement "INSERT ..."',
  });
  return err;
}

/** Makes the next INSERT of a venue throw `err`. */
function failVenueInsert(ctx, err) {
  ctx.hooks.onStatement = (text) => {
    if (/INSERT INTO gabay\.Venue\b/.test(text)) {
      ctx.hooks.onStatement = null;
      throw err;
    }
  };
}

test('AC-54: a PostgreSQL error naming a table and a constraint answers { "error": "Internal server error" } and nothing else', async () => {
  await withMapApp(async (ctx) => {
    failVenueInsert(ctx, pgError('23503', 'FK_Venue_Level'));
    const res = await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { 'x-request-id': 'sec2-leak-500' },
    });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'Internal server error' });
    assert.equal(res.text, '{"error":"Internal server error"}');
    assert.doesNotMatch(res.text, DRIVER_WORDS);
    // The cause is in the log, not in the response.
    const logged = ctx.logger.calls.error.filter((c) => c[0]?.err?.constraint === 'FK_Venue_Level');
    assert.equal(logged.length, 1, 'the driver error was logged once');
  });
});

test('AC-54: the audit row of that request holds no driver text', async () => {
  await withMapApp(async (ctx) => {
    failVenueInsert(ctx, pgError('23503', 'FK_Venue_Level'));
    await ctx.call('POST', '/api/venues', {
      body: bodies(ctx).venue(),
      headers: { 'x-request-id': 'sec2-leak-audit' },
    });
    const row = await ctx.sql.one(`SELECT * FROM gabay.AuditLog WHERE RequestId = $1`, [
      'sec2-leak-audit',
    ]);
    assert.equal(row.statuscode, 500);
    assert.doesNotMatch(row.payloaddiff, DRIVER_WORDS);
    assert.doesNotMatch(String(row.route), DRIVER_WORDS);
  });
});

test('AC-54: a unique violation answers "That record already exists." with no constraint name', async () => {
  await withMapApp(async (ctx) => {
    failVenueInsert(ctx, pgError('23505', 'uq_other'));
    const res = await ctx.post('/api/venues', bodies(ctx).venue());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'That record already exists.' });
    assert.doesNotMatch(res.text, DRIVER_WORDS);
  });
});

test("AC-54: the venue code's own unique violation is the sentence a person can act on, with no constraint name", async () => {
  await withMapApp(async (ctx) => {
    failVenueInsert(ctx, pgError('23505', 'uq_venue_tenant_code'));
    const res = await ctx.post('/api/venues', bodies(ctx).venue());
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'A venue with this code already exists' });
    assert.doesNotMatch(res.text, DRIVER_WORDS);
  });
});

test('AC-54: a plain Error with a stack and an unknown driver code on a read is the generic 500 too', async () => {
  await withMapApp(async (ctx) => {
    ctx.hooks.onStatement = (text) => {
      if (/FROM gabay\.Venue/.test(text)) {
        ctx.hooks.onStatement = null;
        throw new Error(
          'relation "gabay.venue" does not exist at Parser.parseErrorMessage (/node_modules/pg/x.js:1:1)',
        );
      }
    };
    const res = await ctx.get('/api/venues');
    assert.equal(res.status, 500);
    assert.equal(res.text, '{"error":"Internal server error"}');
  });
});
