// A uniform bucket index (plan/FF-3-publish-engine.md 1.0 §3, DC-P4): each item (a small non-negative integer the
// caller assigns) is listed in every square cell its bounding box touches, so a query looks only at the cells its
// own box touches. Sized for one level of one venue (PRD §7: about 100,000 m² and 20,000 nodes per venue).
'use strict';

// Cell indexes are offset so negative coordinates key cleanly: (i + OFFSET) * SPAN + (j + OFFSET) stays an exact
// integer for |i|, |j| below 2^25 cells (thousands of kilometres at any cell size used here).
const OFFSET = 2 ** 25;
const SPAN = 2 ** 26;

/**
 * @param {number} cellSize  the cell's side in metres
 */
function createBucketIndex(cellSize) {
  const cells = new Map();
  let seen = new Int32Array(64);
  let stamp = 0;
  const cell = (v) => Math.floor(v / cellSize);
  const key = (i, j) => (i + OFFSET) * SPAN + (j + OFFSET);

  function insert(item, minX, minY, maxX, maxY) {
    if (item >= seen.length) {
      const grown = new Int32Array(Math.max(item + 1, seen.length * 2));
      grown.set(seen);
      seen = grown;
    }
    for (let i = cell(minX); i <= cell(maxX); i += 1) {
      for (let j = cell(minY); j <= cell(maxY); j += 1) {
        const k = key(i, j);
        const list = cells.get(k);
        if (list) list.push(item);
        else cells.set(k, [item]);
      }
    }
  }

  /**
   * Calls visit(item) once for each item whose cells meet the box. A visit that returns true stops the query.
   * Items come cell by cell, in insertion order within a cell.
   */
  function query(minX, minY, maxX, maxY, visit) {
    stamp += 1;
    if (stamp === 2 ** 31 - 1) {
      seen.fill(0);
      stamp = 1;
    }
    for (let i = cell(minX); i <= cell(maxX); i += 1) {
      for (let j = cell(minY); j <= cell(maxY); j += 1) {
        const list = cells.get(key(i, j));
        if (!list) continue;
        for (const item of list) {
          if (seen[item] === stamp) continue;
          seen[item] = stamp;
          if (visit(item) === true) return;
        }
      }
    }
  }

  return { insert, query };
}

module.exports = { createBucketIndex };
