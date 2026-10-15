// The publish engine's named constants (spec/P0-03.md r4 DC-22; plan/FF-3-prime-A1.md 1.0 section 4 steps 5 and 8),
// each with its source. Not settings: the neighbour count changes the graph's structure, so it is code (DC-22's
// alternative, settings, was passed over). A1′b adds PREFERRED_CONNECTOR_FACTOR here.
'use strict';

/**
 * How many lattice neighbours a walk node is joined to: its 8 neighbours and its 8 knight's-move neighbours (L32
 * "16 neighbours", kept by L170 Q6; P0-03 r4 AC-93). A test or the measurement may pass 8 instead (A1's review round,
 * Q4 "measure first"; DC-A5); the owner rules on 8 or 16 after AC-137's figures.
 */
const GRAPH_NEIGHBOUR_MOVES = 16;

/**
 * Each neighbour count's moves, as the half that comes after a node in row order (di across, dj down); the other
 * half joins it from their side. 8: the king's moves. 16: those and the knight's moves.
 */
const FORWARD_MOVES = Object.freeze({
  8: Object.freeze([
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]),
  16: Object.freeze([
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [-2, 1],
    [-1, 2],
    [1, 2],
    [2, 1],
  ]),
});

module.exports = { GRAPH_NEIGHBOUR_MOVES, FORWARD_MOVES };
