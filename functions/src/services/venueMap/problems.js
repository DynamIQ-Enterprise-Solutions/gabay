// Problems (spec/OA-1.md r1 AC-26, AC-27; office section 4.3). A problem is one "<path>: <message>" string; the path
// uses the field names of the document and zero-based indexes (`levels[0].items[7].w`), and a problem about the whole
// document reads "(document): ...". The collector keeps the first MAX_PROBLEMS in document position (DC-E17: the
// array index first, then the schema file's field order, so a fault found by a later pass still lands in its place)
// and counts every problem, so the caller can say how many there are in total.
'use strict';

const DOCUMENT_LABEL = '(document)';

/** The root of a document or a file. Its own problems read "<label>: ...". */
function rootLocation(label = DOCUMENT_LABEL) {
  return { parent: null, name: label, position: 0, index: false };
}

/** A field of an object; `position` is the field's place in the schema file's order. */
function fieldLocation(parent, name, position) {
  return { parent, name, position, index: false };
}

/** An entry of an array. */
function indexLocation(parent, index) {
  return { parent, name: index, position: index, index: true };
}

/** "levels[0].items[7].w", or the root's label. Built only when a problem is kept. */
function pathOf(location) {
  if (!location.parent) return location.name;
  const parts = [];
  for (let at = location; at.parent; at = at.parent) parts.push(at);
  let path = '';
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part.index) path += `[${part.name}]`;
    else path += path ? `.${part.name}` : part.name;
  }
  return path;
}

/** The location's document position: the positions from the root down. */
function keyOf(location) {
  const key = [];
  for (let at = location; at.parent; at = at.parent) key.push(at.position);
  return key.reverse();
}

/** Orders two positions: element by element, and a position before anything inside it. */
function compareKeys(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Collects problems. `limit` is MAX_PROBLEMS. Problems at the same position keep the order they were found in.
 * add(location, message); addKeyed(key, text) for a problem already written (the export file's map problems);
 * addUnlisted(n) for problems counted elsewhere and not listed; total; list().
 */
function createCollector(limit) {
  const kept = [];
  let total = 0;

  function insert(key, makeText) {
    total += 1;
    if (kept.length >= limit && compareKeys(key, kept[kept.length - 1].key) >= 0) return;
    let i = kept.length;
    while (i > 0 && compareKeys(kept[i - 1].key, key) > 0) i -= 1;
    kept.splice(i, 0, { key, text: makeText() });
    if (kept.length > limit) kept.pop();
  }

  return {
    add(location, message) {
      insert(keyOf(location), () => `${pathOf(location)}: ${message}`);
    },
    addKeyed(key, text) {
      insert(key, () => text);
    },
    addUnlisted(count) {
      total += count;
    },
    get total() {
      return total;
    },
    list() {
      return kept.map((entry) => entry.text);
    },
  };
}

/**
 * The error body the routes serve with HTTP 400 (AC-27; the standard's section 3.8 shape plus the problems):
 * { error: "This map has <total> problems.", problems, total }; one problem reads "This map has 1 problem.".
 */
function mapProblemBody({ problems, total }) {
  const noun = total === 1 ? 'problem' : 'problems';
  return { error: `This map has ${total} ${noun}.`, problems, total };
}

module.exports = {
  DOCUMENT_LABEL,
  rootLocation,
  fieldLocation,
  indexLocation,
  pathOf,
  keyOf,
  createCollector,
  mapProblemBody,
};
