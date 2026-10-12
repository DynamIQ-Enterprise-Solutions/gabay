'use strict';

// FF-3 A1, draft.js (plan/FF-3-publish-engine.md 1.0 §3): the VenueDraft's database-shaped rows are parsed once.
// DECIMAL(9,3) strings become numbers and are never compared as text (EC-34); every list is ordered by id (DC-3);
// rows of another venue or tenant never enter (AC-49, invariant 13); a referenced lookup row the snapshot did not
// supply is a contract fault, not a silent gap.

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDraft } = require('../src/services/engines/draft');
const { corridorWithStore, draftBuilder, TENANT_ID } = require('./fixtures/draftBuilder');

test('engine.draft EC-34: decimal strings become numbers, and "10.000" > "9.500" numerically', () => {
  const b = draftBuilder();
  const L0 = b.level({ elevationM: 0 });
  b.walkway(L0, [0, 0, 20, 4]);
  const near = b.amenity(L0, 9.5, 2);
  const far = b.amenity(L0, 10, 2);
  const venue = parseDraft(b.build());
  const byId = new Map(venue.amenities.map((a) => [a.id, a]));
  assert.equal(byId.get(near).x, 9.5);
  assert.equal(byId.get(far).x, 10);
  assert.ok(byId.get(far).x > byId.get(near).x, 'as text, "10.000" sorts before "9.500"');
  assert.equal(typeof venue.levels[0].elevationM, 'number');
  assert.equal(venue.lookups.connectorTypes.get(3).costBaseM, 14);
  assert.equal(venue.lookups.connectorTypes.get(3).costPerRiseM, 1);
  assert.equal(venue.settings.nodeSpacingM, 1);
});

test('engine.draft DC-3: every list is ordered by id, whatever order the rows arrive in', () => {
  const { b } = corridorWithStore();
  const L0 = b.rows.levels[0].levelid;
  for (let i = 0; i < 5; i += 1) b.amenity(L0, 2 + i, 2);
  const draft = b.build();
  draft.amenities.reverse();
  draft.units.reverse();
  const venue = parseDraft(draft);
  const ids = (list) => list.map((r) => r.id);
  const sorted = (list) => [...ids(list)].sort((p, q) => p - q);
  assert.deepEqual(ids(venue.amenities), sorted(venue.amenities));
  assert.deepEqual(ids(venue.units), sorted(venue.units));
});

test('engine.draft AC-49: rows of another venue or another tenant are left out', () => {
  const { b, L0 } = corridorWithStore();
  b.beacon(L0, 2, 2);
  const draft = b.build();
  const stray = {
    ...draft.units[0],
    unitid: 99999,
    venueid: draft.venue.venueid + 1,
    name: 'Other venue unit',
  };
  const foreign = {
    ...draft.units[0],
    unitid: 99998,
    tenantid: TENANT_ID + 1,
    name: 'Other tenant unit',
  };
  draft.units.push(stray, foreign);
  draft.beacons[0].venueid += 1;
  const venue = parseDraft(draft);
  assert.equal(
    venue.units.find((u) => u.id === 99999),
    undefined,
  );
  assert.equal(
    venue.units.find((u) => u.id === 99998),
    undefined,
  );
  assert.equal(venue.beacons.length, 0);
});

test('engine.draft: a referenced lookup row missing from the snapshot is a contract fault', () => {
  const { b, L0 } = corridorWithStore();
  b.connector('ESCALATOR', [L0, 2, 2], [L0, 3, 2]);
  const draft = b.build();
  draft.lookups.connectorTypes = draft.lookups.connectorTypes.filter((t) => t.code !== 'ESCALATOR');
  assert.throws(() => parseDraft(draft), /VenueDraft: ConnectorType 3 .* is not in the snapshot/);
});

test('engine.draft: a missing or bad setting is a contract fault, never a silent default (C8)', () => {
  const draft = corridorWithStore().b.build();
  delete draft.settings.publish['publish.nodeSpacingM'];
  assert.throws(() => parseDraft(draft), /publish\.nodeSpacingM/);
  const bad = corridorWithStore().b.build();
  bad.settings.routing['routing.storeCrossingFactor'] = 0;
  assert.throws(() => parseDraft(bad), /routing\.storeCrossingFactor/);
});
