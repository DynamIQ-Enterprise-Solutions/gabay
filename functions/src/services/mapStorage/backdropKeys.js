// The backdrop keys a map's levels name (spec/OA-1.md r1 section 2.5.9; spec/OA-2.md r1 AC-19, AC-41): read by the draft
// save's key check and by the upload's prune (which never removes a backdrop the draft names). Pure.
'use strict';

const { isPlainObject } = require('../../utils/objects');

/**
 * @param {unknown} map  a canonical map, a stored draft, or null
 * @returns {{ index: number, key: string }[]} each level's backdrop key, by level index
 */
function backdropKeysOf(map) {
  const levels = isPlainObject(map) && Array.isArray(map.levels) ? map.levels : [];
  const out = [];
  levels.forEach((level, index) => {
    const key = isPlainObject(level) && isPlainObject(level.backdrop) ? level.backdrop.id : null;
    if (typeof key === 'string') out.push({ index, key });
  });
  return out;
}

/** The problem for a key the venue has no image for (AC-19). */
const unknownKeyProblem = ({ index, key }) =>
  `levels[${index}].backdrop.id: ${key} is not an image uploaded for this venue`;

module.exports = { backdropKeysOf, unknownKeyProblem };
