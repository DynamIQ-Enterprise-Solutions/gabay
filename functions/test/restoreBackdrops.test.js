'use strict';

// OA-2 / spec/OA-2.md r1 AC-34 (office section 6.2; plan/OA-2-map-storage.md 1.0 section 4.2): restoreBackdrops(restoredLayout,
// currentDraft). A rollback republishes a layout that has no backdrops (publishable() removed them) and makes it the draft
// again with the backdrops put back: for each level of the restored layout whose id names a level of the current draft that
// has a backdrop, that backdrop is copied onto the restored level. Levels that no longer exist lose theirs. Pure: neither
// input is changed and the result shares no object with them. (The route-level case is in venueMaps.rollback.test.js.)

const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./fixtures/mapBuilder');
const { restoreBackdrops } = require('../src/services/mapStorage/restoreBackdrops');

const KEY_1 = '0123456789abcdef0123456789abcdef';
const KEY_2 = 'fedcba9876543210fedcba9876543210';
const backdrop = (id, over = {}) => ({
  id,
  cx: 50,
  cz: 40,
  mpp: 0.01,
  rot: 0,
  opacity: 1,
  locked: false,
  ...over,
});

/** A restored layout of levels l1, l2, l3 (no backdrops) and a draft of l1, l2 and l4 with backdrops on l1 and l4. */
function scenario() {
  const restored = b.twoLevelDoc();
  restored.levels.push(b.level('l3', { building: 'b1', ordinal: 3 }));
  const draft = b.twoLevelDoc();
  draft.levels.push(b.level('l4', { building: 'b1', ordinal: 4 }));
  draft.levels[0].backdrop = backdrop(KEY_1, { cx: 70, rot: 15 });
  draft.levels[2].backdrop = backdrop(KEY_2);
  return { restored, draft };
}

test('AC-34: a level of the restored layout whose id names a draft level with a backdrop gets that backdrop', () => {
  const { restored, draft } = scenario();
  const out = restoreBackdrops(restored, draft);
  assert.deepEqual(out.levels[0].backdrop, backdrop(KEY_1, { cx: 70, rot: 15 }));
  assert.equal(out.levels[0].id, 'l1');
});

test('AC-34: a restored level whose draft level has no backdrop stays without one', () => {
  const { restored, draft } = scenario();
  const out = restoreBackdrops(restored, draft);
  assert.equal(out.levels.find((l) => l.id === 'l2').backdrop, undefined);
  assert.equal('backdrop' in out.levels.find((l) => l.id === 'l2'), false);
});

test('AC-34: a restored level that is no longer in the draft gets none, and a draft level that is not in the restored layout is not added', () => {
  const { restored, draft } = scenario();
  const out = restoreBackdrops(restored, draft);
  assert.deepEqual(
    out.levels.map((l) => l.id),
    ['l1', 'l2', 'l3'],
    "the restored layout's levels, in its order",
  );
  assert.equal(out.levels.find((l) => l.id === 'l3').backdrop, undefined, 'l3 is not in the draft');
  assert.equal(
    JSON.stringify(out).includes(KEY_2),
    false,
    "l4's backdrop (a level the layout does not have) is gone",
  );
});

test('AC-34: everything but the backdrops is the restored layout, unchanged', () => {
  const { restored, draft } = scenario();
  const out = restoreBackdrops(restored, draft);
  const without = structuredClone(out);
  delete without.levels[0].backdrop;
  assert.deepEqual(without, restored);
});

test('AC-34: with no draft (cleared) the result is the restored layout, with no backdrop anywhere', () => {
  const { restored } = scenario();
  const out = restoreBackdrops(restored, null);
  assert.deepEqual(out, restored);
  assert.notStrictEqual(out, restored, 'a new object');
});

test('AC-34: neither input is changed, and the result shares no object with them', () => {
  const { restored, draft } = scenario();
  const restoredBefore = structuredClone(restored);
  const draftBefore = structuredClone(draft);
  b.deepFreeze(restored);
  b.deepFreeze(draft);
  const out = restoreBackdrops(restored, draft); // a frozen input makes any write to it throw
  assert.deepEqual(restored, restoredBefore);
  assert.deepEqual(draft, draftBefore);
  assert.notStrictEqual(out, restored);
  assert.notStrictEqual(out.levels, restored.levels);
  assert.notStrictEqual(
    out.levels[0].backdrop,
    draft.levels[0].backdrop,
    'the backdrop is copied, not shared',
  );
  out.levels[0].backdrop.cx = 999;
  out.levels[0].name = 'changed';
  assert.equal(draft.levels[0].backdrop.cx, 70);
  assert.equal(restored.levels[0].name, restoredBefore.levels[0].name);
});
