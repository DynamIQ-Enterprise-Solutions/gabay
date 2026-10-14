// The state of one validation run, shared by the walker (fields.js) and the cross-field passes (references.js,
// levelRules.js, elementRules.js, connectorRules.js). It lives for one call: the validator keeps nothing between
// calls (AC-23, EC-19).
//
// Every object the walker reads gets an `info`: { kind, location, plan, effective, bad, disc, level }:
//   effective  each field's canonical value, a default filled in (what the cross-field passes read)
//   bad        the fields that had a problem (a pass that needs one of them is skipped: DC-E18)
//   level      the level scope it sits on: { info, rect } (a level's own scope for a level; null above the levels)
'use strict';

const { createCollector, fieldLocation } = require('./problems');
const { rectangleMm } = require('./geometry');

const LEVEL_KIND = 'level';

/** A fresh run. `kinds` is the table of kinds the walk may meet (the document's, plus the export file's). */
function newState(schema, context, kinds) {
  return {
    schema,
    context,
    kinds,
    problems: createCollector(schema.constants.MAX_PROBLEMS),
    ids: new Map(),
    uncertain: new Set(),
    references: [],
    byKind: new Map(),
    hooks: null,
    containedCache: new Map(),
  };
}

/** Throws unless `context` is a shapeMapContext result: a programming error, never a document fault. */
function assertContext(context) {
  if (
    !context ||
    typeof context !== 'object' ||
    typeof context.catalogVersion !== 'number' ||
    !context.lookups ||
    typeof context.lookups !== 'object'
  ) {
    throw new TypeError('venue map: the context must come from shapeMapContext');
  }
}

/** The location of `info`'s field `name`. */
const fieldOf = (info, name) => fieldLocation(info.location, name, info.plan.positionOf.get(name));

/** Every object of `kind` the walk met, in document order. */
const infosOf = (st, kind) => st.byKind.get(kind) ?? [];

function addInfo(st, info) {
  if (!st.byKind.has(info.kind)) st.byKind.set(info.kind, []);
  st.byKind.get(info.kind).push(info);
}

/**
 * The level's rectangle in millimetres, or null while its origin or size is missing or had a problem. Cached once
 * the level's walk has finished (`complete`).
 */
function levelRect(scope) {
  if (!scope) return null;
  if (scope.rect !== undefined) return scope.rect;
  const { origin, size } = scope.info.effective;
  const rect = Array.isArray(origin) && Array.isArray(size) ? rectangleMm(origin, size) : null;
  if (scope.complete) scope.rect = rect;
  return rect;
}

module.exports = { LEVEL_KIND, newState, assertContext, fieldOf, infosOf, addInfo, levelRect };
