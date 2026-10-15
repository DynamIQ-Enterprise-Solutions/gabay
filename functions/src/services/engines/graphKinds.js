// The graph generator's own labels: what made each node and each edge. Internal to the engine (never stored, never
// sent to the app, never in the package), so they are not a constants-file set (invariant 14 covers values a client
// or the database sees); they live here once so no file spells them out. The edge KIND the package carries
// (walk, connector, store crossing) is the constants file's GraphEdgeKind.
'use strict';

/** What a node stands for. The order is the order of the groups within a level (AC-31). */
const NODE = Object.freeze({
  GRID: 'GRID',
  DOOR: 'DOOR',
  CONNECTOR: 'CONNECTOR',
  PLACE: 'PLACE',
  STORE_INSIDE: 'STORE_INSIDE',
  ADD_PATH: 'ADD_PATH',
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

module.exports = { NODE, ORIGIN };
