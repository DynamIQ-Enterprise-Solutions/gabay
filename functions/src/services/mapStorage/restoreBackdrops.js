// restoreBackdrops (spec/OA-2.md r1 AC-34; office section 6.2; plan/OA-2-map-storage.md 1.0 section 4.2): a rollback
// republishes a layout that has no backdrops (publishable() removed them), and makes it the draft again with the
// backdrops put back. Pure: for each level of the restored layout whose `id` names a level of the current draft that
// has a `backdrop`, that backdrop is copied onto it; every other level gets none. Neither input is changed, and the
// result shares no object with them.
//
// CONTRACT ONLY (plan section 13 step 3): built in OA-2 step 5.
'use strict';

/**
 * @param {object} _restoredLayout  the published layout being restored (a canonical map without backdrops)
 * @param {object|null} _currentDraft  the draft as it is now (null when it was cleared)
 * @returns {object} a new layout: the restored one with the current draft's backdrops on the levels that kept their id
 */
function restoreBackdrops(_restoredLayout, _currentDraft) {
  throw new Error('restoreBackdrops: not built yet (OA-2 step 5)');
}

module.exports = { restoreBackdrops };
