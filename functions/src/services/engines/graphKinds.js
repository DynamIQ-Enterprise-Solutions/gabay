// The graph generator's own labels: what made each node and each edge. Internal to the engine (never stored, never
// sent to the app, never in the package), so they are not a constants-file set (invariant 14 covers values a client
// or the database sees); they live here once so no file spells them out. The edge KIND the package carries (walk,
// connector, store crossing) is the constants file's GraphEdgeKind, which each origin maps onto below.
'use strict';

const { codesOf } = require('../../config/closedSets');

const EDGE_KIND = codesOf('GraphEdgeKind');

/**
 * What a node stands for. The order is the order of the groups within a level (AC-31; plan/FF-3-prime-A1.md 1.0
 * DC-A10: the lattice row-major, then doors, place points, connector landings and ADD_PATH vertices, each in
 * document order). The store crossing points come last.
 */
const NODE = Object.freeze({
  GRID: 'GRID',
  DOOR: 'DOOR',
  PLACE: 'PLACE',
  CONNECTOR: 'CONNECTOR',
  ADD_PATH: 'ADD_PATH',
  STORE_INSIDE: 'STORE_INSIDE',
});

/** Which step made an edge (tests read it; REMOVE_PATH leaves ADD_PATH edges alone). */
const ORIGIN = Object.freeze({
  GRID: 'GRID',
  JOIN: 'JOIN',
  SAME_HEIGHT: 'SAME_HEIGHT',
  CONNECTOR: 'CONNECTOR',
  STORE: 'STORE',
  ADD_PATH: 'ADD_PATH',
});

/**
 * Each origin's GraphEdgeKind (AC-105): every walkway, door join, same-height join and ADD_PATH edge is a WALK; a
 * connector ride is a CONNECTOR; a crossing of a walk-through store is a STORE_CROSSING.
 */
const EDGE_KIND_OF_ORIGIN = Object.freeze({
  [ORIGIN.GRID]: EDGE_KIND.WALK,
  [ORIGIN.JOIN]: EDGE_KIND.WALK,
  [ORIGIN.SAME_HEIGHT]: EDGE_KIND.WALK,
  [ORIGIN.ADD_PATH]: EDGE_KIND.WALK,
  [ORIGIN.CONNECTOR]: EDGE_KIND.CONNECTOR,
  [ORIGIN.STORE]: EDGE_KIND.STORE_CROSSING,
});

module.exports = { NODE, ORIGIN, EDGE_KIND_OF_ORIGIN };
