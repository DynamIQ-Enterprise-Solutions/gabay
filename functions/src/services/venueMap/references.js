// References (spec/OA-1.md r1 AC-4, EC-28). Every idRef and idRefs value the walk read must name an element of the
// rule's kind; with sameLevel, one on the same level; with refWhere, one with that field value (a unit's doors are
// doors). A reference to a kind that is uncertain (identifiers.js) and does not resolve is not reported (DC-E18).
// A reference to an element of its own kind (a unit's parent) must not loop: a unit is never its own ancestor.
'use strict';

const { keyOf } = require('./problems');

/** How a kind is named in a problem. */
const KIND_WORDS = {
  building: 'a building',
  level: 'a level',
  wall: 'a wall',
  opening: 'an opening',
  unit: 'a unit',
  item: 'an item',
  correction: 'a correction',
  amenity: 'an amenity',
  transitPoint: 'a transit point',
  anchor: 'a landmark',
  connector: 'a connector',
};
const kindWords = (kind) => KIND_WORDS[kind] ?? `a ${kind}`;

const levelIdOf = (scope) => scope?.info.effective.id ?? 'another level';

/** Resolves one reference; reports and returns null when it does not resolve as its rule asks. */
function resolveOne(st, ref) {
  const { rule, id, info, location } = ref;
  const target = st.ids.get(id);
  if (!target) {
    if (!st.uncertain.has(rule.refKind)) {
      st.problems.add(location, `${id} is not ${kindWords(rule.refKind)} of this map`);
    }
    return null;
  }
  if (target.kind !== rule.refKind) {
    st.problems.add(location, `${id} is ${kindWords(target.kind)}, not ${kindWords(rule.refKind)}`);
    return null;
  }
  if (rule.sameLevel && target.level !== info.level) {
    st.problems.add(location, `${id} is on level ${levelIdOf(target.level)}, not on this level`);
    return null;
  }
  for (const [field, wanted] of Object.entries(rule.refWhere ?? {})) {
    const got = target.info.effective[field];
    if (got !== undefined && got !== wanted) {
      st.problems.add(location, `${id} is a ${got}, not a ${wanted}`);
      return null;
    }
  }
  return target;
}

/** Reports each loop of references to the own kind once, at its first member in document order. */
function checkLoops(st, parents) {
  const done = new Set();
  for (const start of parents.keys()) {
    if (done.has(start)) continue;
    const path = [];
    const onPath = new Set();
    let at = start;
    while (at && !done.has(at) && !onPath.has(at)) {
      onPath.add(at);
      path.push(at);
      at = parents.get(at)?.target.info;
    }
    if (at && onPath.has(at)) {
      const loop = path.slice(path.indexOf(at));
      const first = loop.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
      const { location } = parents.get(first);
      const kind = kindWords(first.kind).replace(/^an? /, '');
      st.problems.add(
        location,
        loop.length === 1
          ? `${kindWords(first.kind)} cannot be its own parent`
          : `is in a loop of parents (${loop.map((i) => i.effective.id).join(', ')}): a ${kind} cannot be its own ancestor`,
      );
    }
    for (const info of path) done.add(info);
  }
}

function compare(a, b) {
  const ka = keyOf(a.location);
  const kb = keyOf(b.location);
  for (let i = 0; i < Math.min(ka.length, kb.length); i += 1)
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return ka.length - kb.length;
}

/** Resolves every reference the walk recorded (the export file's store keys are its own: exportFile.js). */
function checkReferences(st) {
  const parents = new Map();
  for (const ref of st.references) {
    const target = resolveOne(st, ref);
    if (target && ref.rule.refKind === ref.info.kind) {
      parents.set(ref.info, { target, location: ref.location });
    }
  }
  checkLoops(st, parents);
}

module.exports = { checkReferences, kindWords };
