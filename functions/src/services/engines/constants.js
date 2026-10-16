// The publish engine's named constants (spec/P0-03.md r4 DC-22; plan/FF-3-prime-A1.md 1.0 section 4 steps 5 and 8),
// each with its source. Not settings: the neighbour count changes the graph's structure, and the preferred factor is
// fixed by office section 11, so both are code (DC-22's alternative, settings, was passed over: L170 Q4 makes only a
// connector type's base and per-rise times tunable).
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

/**
 * A connector with `preferred` true costs this times the cost of AC-101, once, on the whole cost (office section 11;
 * P0-03 r4 AC-102, DC-22, V-C-6). The only formula number the engine holds: the walking speed and the store-crossing
 * factor are routing.* settings, and the connector types' base and per-rise times are lookup columns (AC-106).
 */
const PREFERRED_CONNECTOR_FACTOR = 0.7;

/**
 * The bits of an edge's `flags` byte in the model (plan/FF-3-prime-A1.md 1.0 section 2, "flags (Uint8: evacuation)").
 * EVACUATION: an edge of an `evacuationOnly` connector (L87; P0-03 r4 AC-103, DC-38), which everyday routing skips
 * until P3-02.
 */
const EDGE_FLAG = Object.freeze({ EVACUATION: 1 });

/**
 * A connector edge's clearance: none (DC-B5; AC-30 measures walkways, and a connector's step-free flag is its type's).
 * The model's clearance array is Float32, so "none" is this sentinel, which no measured clearance can be (each is at
 * least 0) and which serialises cleanly in JSON and in a SQLite REAL column, where NaN does not; stage B's writer
 * writes it as NULL, and P0-06's width test skips connector edges (A1′b review, nit 1).
 */
const NO_CLEARANCE_M = -1;

module.exports = {
  GRAPH_NEIGHBOUR_MOVES,
  FORWARD_MOVES,
  PREFERRED_CONNECTOR_FACTOR,
  EDGE_FLAG,
  NO_CLEARANCE_M,
};
