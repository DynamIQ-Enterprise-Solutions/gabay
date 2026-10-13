// Ids (spec/OA-1.md r1 AC-10, AC-11, office section 3): an id matches the schema file's ID pattern and is unique
// across the whole document. A repeated id is a problem at the later path, naming the earlier one; the earlier
// element keeps the id (the index is first come, first served). The validator never makes or changes an id (AC-12).
//
// An element whose id is unreadable, or a list or level that cannot be read at all, makes its kind "uncertain": a
// reference to that kind that does not resolve is not reported, because it may name the element the problem is
// already about (DC-E18). The kinds inside it (a level's walls, units, ...) become uncertain with it.
'use strict';

const { pathOf } = require('./problems');

/**
 * Records `id` for `entry` ({ kind, info, level, location }); a repeat is a problem at `idLocation`. Returns
 * whether the id was new.
 */
function registerId(st, id, entry, idLocation) {
  const earlier = st.ids.get(id);
  if (earlier) {
    st.problems.add(idLocation, `${id} is already the id of ${pathOf(earlier.location)}`);
    return false;
  }
  st.ids.set(id, entry);
  return true;
}

/** `kindName` and every kind an object of it can hold, through object and array fields. */
function containedKinds(st, kindName) {
  let found = st.containedCache.get(kindName);
  if (found) return found;
  found = new Set();
  const visit = (name) => {
    if (found.has(name) || !st.kinds[name]) return;
    found.add(name);
    for (const rule of Object.values(st.kinds[name].fields)) if (rule.of) visit(rule.of);
  };
  visit(kindName);
  st.containedCache.set(kindName, found);
  return found;
}

function markUncertain(st, kindName) {
  for (const kind of containedKinds(st, kindName)) st.uncertain.add(kind);
}

module.exports = { registerId, markUncertain };
