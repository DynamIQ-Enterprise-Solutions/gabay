// INVALID_DOCUMENT (spec/P0-03.md r4 AC-108; L170 Q2; blocking): the layout fails OA-1's validator with today's
// context (the snapshot's own). One finding per validator problem, in the validator's own order (document position,
// OA-1 DC-E17), each with its path and the validator's words, up to OA-1's cap, with the total in `params`. Where the
// path names a level (`levels[i]...`) the finding carries that level, and where it names an element of a level, a
// building or a connector, that element, so the screen can open it (AC-127); a path that names none has neither.
// OA-2's publish has run this check already (OA-2 AC-25); the checks route has not, so the engine always runs it
// (AC-121). A valid layout comes back as its canonical, publishable copy (backdrops stripped, OA-1 AC-34), which
// every later step reads.
'use strict';

const { validateMap, publishable } = require('../../venueMap');
const { KIND } = require('../findings');
const { isPlainObject } = require('../layoutKeys');

/** The element kind of each of a level's arrays (OA-1 section 2.5). */
const LEVEL_ARRAYS = Object.freeze({
  walls: 'wall',
  openings: 'opening',
  units: 'unit',
  items: 'item',
  corrections: 'correction',
  amenities: 'amenity',
  transitPoints: 'transitPoint',
  anchors: 'anchor',
});
const LEVEL_PATH = /^levels\[(\d+)\](?:\.(\w+)\[(\d+)\])?/;
const TOP_PATH = /^(buildings|connectors)\[(\d+)\]/;
const TOP_KINDS = Object.freeze({ buildings: 'building', connectors: 'connector' });
/** A validator problem reads "<path>: <message>" (OA-1 AC-26). */
const PATH_END = ': ';

/** The element at `list[index]` as a finding's { kind, id, name }, when it is an object with a text id. */
function elementOf(kind, list, index) {
  const element = Array.isArray(list) ? list[index] : undefined;
  if (!isPlainObject(element) || typeof element.id !== 'string') return null;
  return { kind, id: element.id, name: typeof element.name === 'string' ? element.name : null };
}

/** The level and the element a validator path names, or nulls. */
function locate(layout, path, keys) {
  const inLevel = LEVEL_PATH.exec(path);
  if (inLevel) {
    const index = Number(inLevel[1]);
    const level = keys.levels.find((l) => l.index === index) ?? null;
    const kind =
      inLevel[2] && Object.hasOwn(LEVEL_ARRAYS, inLevel[2]) ? LEVEL_ARRAYS[inLevel[2]] : null;
    const levelValue =
      isPlainObject(layout) && Array.isArray(layout.levels) ? layout.levels[index] : undefined;
    const element =
      kind === null || !isPlainObject(levelValue)
        ? null
        : elementOf(kind, levelValue[inLevel[2]], Number(inLevel[3]));
    return { level, element };
  }
  const top = TOP_PATH.exec(path);
  if (top && isPlainObject(layout)) {
    return { level: null, element: elementOf(TOP_KINDS[top[1]], layout[top[1]], Number(top[2])) };
  }
  return { level: null, element: null };
}

/**
 * @param {object} findings  createFindings()'s collector
 * @param {unknown} layout  the snapshot's layout, as given
 * @param {object} context  the snapshot's context (the validator's)
 * @param {object} keys  layoutKeys(layout)
 * @returns {object | null}  the canonical, publishable layout, or null when it is not valid
 */
function checkDocument(findings, layout, context, keys) {
  const result = validateMap(layout, context);
  if (result.ok) return publishable(result.map);
  result.problems.forEach((problem, i) => {
    const cut = problem.indexOf(PATH_END);
    const path = cut < 0 ? null : problem.slice(0, cut);
    const words = cut < 0 ? problem : problem.slice(cut + PATH_END.length);
    const { level, element } =
      path === null ? { level: null, element: null } : locate(layout, path, keys);
    findings.add(KIND.INVALID_DOCUMENT, {
      level,
      element,
      path,
      params: { problem: words, total: result.total },
      sortKey: [i],
    });
  });
  return null;
}

module.exports = { checkDocument };
