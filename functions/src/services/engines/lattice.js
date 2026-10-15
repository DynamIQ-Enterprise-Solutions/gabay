// The walk lattice's indexes (spec/P0-03.md r4 AC-93, DC-19): lattice point (i, j) sits at (i x spacing, j x spacing)
// in the venue frame, anchored at its origin, so levels at one elevation share node positions (AC-28).
'use strict';

/** A lattice index is rounded inward by this much, so a point a hair outside a rectangle's edge is not taken. */
const LATTICE_EPS = 1e-9;

// Lattice keys: (j + OFFSET) * SPAN + (i + OFFSET), exact for |i|, |j| below 2^20 node spacings (A1's).
const LATTICE_OFFSET = 2 ** 20;
const LATTICE_SPAN = 2 ** 21;

/** One number per lattice point, for a Map from point to node. */
const latticeKey = (i, j) => (j + LATTICE_OFFSET) * LATTICE_SPAN + (i + LATTICE_OFFSET);

/** The first and last lattice index between lo and hi metres (+ 0: never a -0 index, so never a -0 coordinate). */
const firstIndex = (lo, spacing) => Math.ceil(lo / spacing - LATTICE_EPS) + 0;
const lastIndex = (hi, spacing) => Math.floor(hi / spacing + LATTICE_EPS) + 0;

/** Calls visit(id, i, j) for every node of `lattice` (a Map from latticeKey) within `reach` metres' box of (x, z). */
function forEachNear(lattice, spacing, x, z, reach, visit) {
  for (let j = firstIndex(z - reach, spacing); j <= lastIndex(z + reach, spacing); j += 1) {
    for (let i = firstIndex(x - reach, spacing); i <= lastIndex(x + reach, spacing); i += 1) {
      const id = lattice.get(latticeKey(i, j));
      if (id !== undefined) visit(id, i, j);
    }
  }
}

module.exports = { LATTICE_EPS, latticeKey, firstIndex, lastIndex, forEachNear };
