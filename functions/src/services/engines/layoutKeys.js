// The layout's level and unit ids, read from any layout, valid or not (spec/P0-03.md r4 AC-115: "If the layout fails
// the validator, the analysis reports INVALID_DOCUMENT and the row-based findings and stops there"). The row checks
// (beacons, AC-109; stores and beacons left out, AC-114; store categories, AC-108) need only which levels and units
// the layout names, so they read them here, the same way for a valid and an invalid document (DC-B3): a level or unit
// that is not an object with a text id is not counted, and a repeated level id counts once, at its first place.
'use strict';

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @param {unknown} layout  the snapshot's layout, as given
 * @returns {{ levels: { index, id, name }[], levelById: Map<string, object>, unitLevel: Map<string, object> }}
 *   unitLevel: each unit id -> its level entry
 */
function layoutKeys(layout) {
  const levels = [];
  const levelById = new Map();
  const unitLevel = new Map();
  const list = isPlainObject(layout) && Array.isArray(layout.levels) ? layout.levels : [];
  list.forEach((level, index) => {
    if (!isPlainObject(level) || typeof level.id !== 'string' || levelById.has(level.id)) return;
    const entry = { index, id: level.id, name: typeof level.name === 'string' ? level.name : null };
    levels.push(entry);
    levelById.set(level.id, entry);
    for (const unit of Array.isArray(level.units) ? level.units : []) {
      if (isPlainObject(unit) && typeof unit.id === 'string' && !unitLevel.has(unit.id)) {
        unitLevel.set(unit.id, entry);
      }
    }
  });
  return { levels, levelById, unitLevel };
}

module.exports = { layoutKeys, isPlainObject };
