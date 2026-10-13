// The level rules (spec/OA-1.md r1 AC-5, P0-01 B7; AC-6; EC-32). An indoor level's building, required, and the
// outdoor level's, refused, are the schema file's (level.building applies only when outdoor is false). Here:
//   - at most one outdoor level, and its ordinal is 0;
//   - ordinals are distinct among the levels of one building (the same ordinal in two buildings is fine);
//   - a level's rectangle (origin + size) lies inside the venue frame, [VENUE_EXTENT_MIN_M, VENUE_EXTENT_MAX_M].
'use strict';

const { pathOf } = require('./problems');
const { toMm, rectangleMm, MM_PER_M } = require('./geometry');
const { fieldOf, infosOf } = require('./state');

function checkLevels(st) {
  const max = st.schema.constants.VENUE_EXTENT_MAX_M;
  let outdoor = null;
  const ordinals = new Map();
  for (const info of infosOf(st, 'level')) {
    const { outdoor: isOutdoor, building, ordinal, origin, size } = info.effective;
    if (isOutdoor === true) {
      if (outdoor) {
        st.problems.add(
          fieldOf(info, 'outdoor'),
          `only one level may be outdoor; ${pathOf(outdoor.location)} already is`,
        );
      } else outdoor = info;
      if (typeof ordinal === 'number' && ordinal !== 0) {
        st.problems.add(fieldOf(info, 'ordinal'), "an outdoor level's ordinal must be 0");
      }
    } else if (isOutdoor === false && typeof building === 'string' && typeof ordinal === 'number') {
      if (!ordinals.has(building)) ordinals.set(building, new Map());
      const taken = ordinals.get(building);
      if (taken.has(ordinal)) {
        st.problems.add(
          fieldOf(info, 'ordinal'),
          `${pathOf(taken.get(ordinal).location)} of building ${building} already has ordinal ${ordinal}`,
        );
      } else taken.set(ordinal, info);
    }
    if (Array.isArray(origin) && Array.isArray(size)) {
      const rect = rectangleMm(origin, size);
      const limit = toMm(max);
      if (rect.x1 > limit || rect.z1 > limit) {
        const axis = rect.x1 > limit ? `x ${rect.x1 / MM_PER_M}` : `z ${rect.z1 / MM_PER_M}`;
        st.problems.add(
          fieldOf(info, 'size'),
          `the level reaches ${axis}; the venue frame ends at ${max}`,
        );
      }
    }
  }
}

module.exports = { checkLevels };
