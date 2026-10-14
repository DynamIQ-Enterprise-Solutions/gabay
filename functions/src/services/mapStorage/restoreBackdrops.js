// restoreBackdrops (spec/OA-2.md r1 AC-34; office section 6.2; plan/OA-2-map-storage.md 1.0 section 4.2): a rollback
// republishes a layout that has no backdrops (publishable() removed them), and makes it the draft again with the
// backdrops put back. Pure: for each level of the restored layout whose `id` names a level of the current draft that
// has a `backdrop`, that backdrop is copied onto it; every other level gets none. Neither input is changed, and the
// result shares no object with them.
'use strict';

const { isPlainObject } = require('../../utils/objects');

/** The current draft's backdrops by level id. */
function backdropsByLevel(draft) {
  const byId = new Map();
  const levels = isPlainObject(draft) && Array.isArray(draft.levels) ? draft.levels : [];
  for (const level of levels) {
    if (isPlainObject(level) && isPlainObject(level.backdrop)) byId.set(level.id, level.backdrop);
  }
  return byId;
}

/**
 * @param {object} restoredLayout  the published layout being restored (a canonical map without backdrops)
 * @param {object|null} currentDraft  the draft as it is now (null when it was cleared)
 * @returns {object} a new layout: the restored one with the current draft's backdrops on the levels that kept their id
 */
function restoreBackdrops(restoredLayout, currentDraft) {
  const out = structuredClone(restoredLayout);
  const backdrops = backdropsByLevel(currentDraft);
  for (const level of Array.isArray(out.levels) ? out.levels : []) {
    if (!isPlainObject(level)) continue;
    delete level.backdrop;
    if (backdrops.has(level.id)) level.backdrop = structuredClone(backdrops.get(level.id));
  }
  return out;
}

module.exports = { restoreBackdrops };
