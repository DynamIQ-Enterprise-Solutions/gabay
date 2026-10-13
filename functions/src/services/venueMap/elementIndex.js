// elementIndex(map) (spec/OA-1.md r1 AC-35; the analogue of office section 4.3's deskIndex): for every id of a
// canonical map, its kind and its level, and each level's rectangle. Maps, not plain objects, so an id such as
// "constructor" is an id like any other (DC-O17).
//   byId:   Map(id -> { kind, level }): `level` is the level's id for an element on a level, the level's own id for
//           a level, and null for a building or a connector (the main session's ruling 3)
//   levels: Map(level id -> { origin, size }), copied
// The kinds with ids, and where they sit, are read from the schema file. The input is not changed.
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');

const LEVEL_KIND = 'level';
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasId = (kind) => VENUE_MAP_SCHEMA.kinds[kind]?.fields.id?.type === 'id';

function visit(value, kindName, levelId, index) {
  if (!isPlainObject(value)) return;
  const id =
    hasId(kindName) && Object.hasOwn(value, 'id') && typeof value.id === 'string' ? value.id : null;
  const here = kindName === LEVEL_KIND ? id : levelId;
  if (id !== null && !index.byId.has(id)) index.byId.set(id, { kind: kindName, level: here });
  if (kindName === LEVEL_KIND && id !== null && !index.levels.has(id)) {
    const origin = Array.isArray(value.origin) ? [...value.origin] : null;
    const size = Array.isArray(value.size) ? [...value.size] : null;
    index.levels.set(id, { origin, size });
  }
  for (const [name, rule] of Object.entries(VENUE_MAP_SCHEMA.kinds[kindName].fields)) {
    if (!rule.of || !Object.hasOwn(value, name)) continue;
    const inner = value[name];
    if (rule.type === 'array' && Array.isArray(inner)) {
      for (const entry of inner) visit(entry, rule.of, here, index);
    } else if (rule.type === 'object') visit(inner, rule.of, here, index);
  }
}

function elementIndex(map) {
  const index = { byId: new Map(), levels: new Map() };
  visit(map, 'document', null, index);
  return index;
}

module.exports = { elementIndex };
