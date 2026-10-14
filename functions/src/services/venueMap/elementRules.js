// Wall, opening and item rules (spec/OA-1.md r1 AC-8; section 2.5.4, G13; EC-31). The ranges a constant can say are
// the schema file's; these are the dynamic ones (plan section 5):
//   - a wall is at least WALL_MIN_LENGTH_M long;
//   - an opening is no wider than its wall (its span may run past the wall's end: EC-31), and clearW is no more
//     than w;
//   - an item's w, d and h follow its catalog type: a size only where the type gives that dimension a resize range,
//     and inside it; a type with no default for a dimension needs it on the item, above 0 and no larger than the
//     level's larger side (G13); a round type's d follows w and is never sent.
'use strict';

const { toMm, squaredLengthMm2, MM_PER_M } = require('./geometry');
const { fieldOf, infosOf, levelRect } = require('./state');

/** The dimension that follows w on a round type (office section 5: "d follows w"). */
const ROUND_FOLLOWER = 'd';

function checkWalls(st) {
  const minimum = st.schema.constants.WALL_MIN_LENGTH_M;
  const minimumMm = toMm(minimum);
  for (const info of infosOf(st, 'wall')) {
    const { a, b } = info.effective;
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const squared = squaredLengthMm2(a, b);
    if (squared < minimumMm * minimumMm) {
      st.problems.add(
        info.location,
        `is ${Math.sqrt(squared) / MM_PER_M} m long; a wall must be at least ${minimum} m`,
      );
    }
  }
}

function checkOpenings(st) {
  for (const info of infosOf(st, 'opening')) {
    const { w, wall, clearW } = info.effective;
    if (typeof w !== 'number') continue;
    const target = typeof wall === 'string' ? st.ids.get(wall) : undefined;
    if (target && target.kind === 'wall' && target.level === info.level) {
      const { a, b } = target.info.effective;
      if (Array.isArray(a) && Array.isArray(b)) {
        const squared = squaredLengthMm2(a, b);
        if (toMm(w) * toMm(w) > squared) {
          st.problems.add(
            fieldOf(info, 'w'),
            `is wider than its wall, which is ${Math.round(Math.sqrt(squared)) / MM_PER_M} m long`,
          );
        }
      }
    }
    if (typeof clearW === 'number' && toMm(clearW) > toMm(w)) {
      st.problems.add(fieldOf(info, 'clearW'), `must be no more than w (${w})`);
    }
  }
}

/** The larger side of a level, in metres, or null when its rectangle is not known. */
function largerSide(scope) {
  const rect = levelRect(scope);
  return rect ? Math.max(rect.x1 - rect.x0, rect.z1 - rect.z0) / MM_PER_M : null;
}

/** One item dimension against its catalog type; returns the problem or null. */
function sizeProblem(type, dim, given, scope) {
  const range = type.resize?.[dim] ?? null;
  const fallback = type.size?.[dim] ?? null;
  if (type.round && dim === ROUND_FOLLOWER) {
    return given === undefined
      ? null
      : `${type.code} is round: ${dim} follows w, so leave ${dim} out`;
  }
  if (given === undefined) {
    return fallback === null ? `is required: ${type.code} has no default ${dim}` : null;
  }
  if (range) {
    return given < range[0] || given > range[1] ? `must be from ${range[0]} to ${range[1]}` : null;
  }
  if (fallback === null) {
    const side = largerSide(scope);
    if (!(given > 0) || (side !== null && toMm(given) > toMm(side))) {
      return side === null
        ? 'must be above 0'
        : `must be above 0 and at most ${side} (the level's larger side)`;
    }
    return null;
  }
  return `${type.code} has a fixed ${dim}; leave ${dim} out`;
}

function checkItems(st) {
  for (const info of infosOf(st, 'item')) {
    const { type: code } = info.effective;
    const type = typeof code === 'string' ? st.context.lookups.ObjectType.get(code) : undefined;
    if (!type) continue;
    for (const field of info.plan.fields) {
      const dim = field.rule.catalogSize;
      if (!dim || info.bad.has(field.name)) continue;
      const problem = sizeProblem(type, dim, info.effective[field.name], info.level);
      if (problem) st.problems.add(fieldOf(info, field.name), problem);
    }
  }
}

function checkElements(st) {
  checkWalls(st);
  checkOpenings(st);
  checkItems(st);
}

module.exports = { checkElements };
