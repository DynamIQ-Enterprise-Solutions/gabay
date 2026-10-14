'use strict';

// The owner's ruling L164 (dod-reviewer's FF-1 review): an edit (PUT) sends every field, as plan section 2.3 says ("all
// present"). A missing key, as distinct from null or "", is refused with 400 "<Field> is missing" on every PUT, and the
// stored record is unchanged. A POST keeps the plan's create rules: a missing required field is "is required".
//
// CHANGED BY OA-2 (plan/OA-2-map-storage.md 1.0 section 6.2; spec/OA-2.md r1 AC-42, AC-43): the building and level routes
// retired, and mapUpDeg left the venue body (a PUT without it is no longer refused: its premise, a required angle, is
// gone). Only the venue's own cases remain.

const test = require('node:test');
const assert = require('node:assert/strict');
const { withVenueApp, bodies, assertRefused } = require('./venueApp');

/** For each key of `full`: the PUT without it is a 400 "<Label> is missing" and changes nothing. */
async function assertEachMissingRefused(ctx, path, full, labels) {
  const before = (await ctx.get(path)).body;
  for (const [key, label] of Object.entries(labels)) {
    const { [key]: _dropped, ...without } = full;
    const res = await ctx.put(path, without);
    assertRefused(res, 400, null, `${path} without ${key}`);
    assert.equal(res.body.error, `${label} is missing`, key);
  }
  assert.deepEqual(
    (await ctx.get(path)).body,
    before,
    `${path}: a refused edit changed the record`,
  );
}

test('L164: every venue field is required on PUT', async () => {
  await withVenueApp(async (ctx) => {
    const made = (await ctx.post('/api/venues', bodies(ctx).venue())).body;
    const full = {
      code: made.code,
      name: made.name,
      isActive: true,
      updatedAt: null,
    };
    await assertEachMissingRefused(ctx, `/api/venues/${made.id}`, full, {
      code: 'Code',
      name: 'Name',
      isActive: 'Active',
      updatedAt: 'Updated at',
    });
  });
});

test('L164: a venue POST keeps the create rules: a missing required field is required', async () => {
  await withVenueApp(async (ctx) => {
    const { post } = ctx;
    const venue = await post('/api/venues', bodies(ctx).venue());
    assert.equal(venue.status, 201, JSON.stringify(venue.body));
    const { code: _code, ...noCode } = bodies(ctx).venue();
    const refusedCode = await post('/api/venues', noCode);
    assertRefused(refusedCode, 400, null);
    assert.equal(refusedCode.body.error, 'Code is required');
    const { name: _name, ...noName } = bodies(ctx).venue();
    const refusedName = await post('/api/venues', noName);
    assertRefused(refusedName, 400, null);
    assert.equal(refusedName.body.error, 'Name is required');
  });
});
