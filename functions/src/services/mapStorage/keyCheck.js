// The key check of a draft save (spec/OA-3.md r2 AC-9, AC-10, AC-12, H-6; plan/OA-3a-migration-rekey.md 1.1 section 6):
// the venue's relational rows that name an element by key (keyedRows.repository.js) are compared with the INCOMING draft,
// and a key the draft holds as another kind of element (OA-1's keyStatus `wrongKind`) refuses the save with 400
// { error, problems, total }. Nothing else refuses:
//   - a key the draft does not hold at all (a deleted element; `removed`) is accepted;
//   - a key the draft holds as the same kind (`pending`; how undo brings an element back, office section 8.4) is accepted;
//   - a venue with no keyed row is never refused.
// Only the draft index is read (DC-5): the published layout is not consulted, so a re-used key cannot hide behind a `live`
// status (EC-24), and the indexes come from the one loader (keyIndexes.js, AC-11).
//
// Each problem sits at the path of the element in the incoming draft ("levels[0].walls[3]: ...") and names the kind the
// row expects and the kind the draft gives the key. Problems are kept in document position, the first MAX_PROBLEMS, with
// the total (OA-1's collector). The path walk runs only when a key is refused.
//
//   checkKeys(q, tenantId, venueId, draft)   throws the 400, or returns; `draft` is the validator's canonical copy
'use strict';

const { keyStatus } = require('../venueMap');
const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const {
  rootLocation,
  fieldLocation,
  indexLocation,
  createCollector,
} = require('../venueMap/problems');
const { isPlainObject } = require('../../utils/objects');
const { readKeyedRows } = require('./keyedRows.repository');
const { loadKeyIndexes } = require('./keyIndexes');
const { mapProblems } = require('./mapErrors');

/** Every element id of the map with its location, walked as elementIndex walks it (the schema file's kinds). */
function locationsOf(map) {
  const found = new Map();
  const visit = (value, kindName, location) => {
    if (!isPlainObject(value)) return;
    const kind = VENUE_MAP_SCHEMA.kinds[kindName];
    if (kind.fields.id?.type === 'id' && typeof value.id === 'string' && !found.has(value.id)) {
      found.set(value.id, location);
    }
    Object.entries(kind.fields).forEach(([name, rule], position) => {
      if (!rule.of || !Object.hasOwn(value, name)) return;
      const at = fieldLocation(location, name, position);
      const inner = value[name];
      if (rule.type === 'array' && Array.isArray(inner)) {
        inner.forEach((entry, i) => visit(entry, rule.of, indexLocation(at, i)));
      } else if (rule.type === 'object') visit(inner, rule.of, at);
    });
  };
  visit(map, 'document', rootLocation());
  return found;
}

/**
 * The rows whose key the draft holds as another kind, one per key (the first row that names it).
 * @returns {{ key: string, kind: string, holder: string, actual: string }[]}
 */
function refusedKeys(rows, draftIndex) {
  const refused = new Map();
  for (const row of rows) {
    if (refused.has(row.key)) continue;
    if (keyStatus(row.key, row.kind, draftIndex, null) === 'wrongKind') {
      refused.set(row.key, { ...row, actual: draftIndex.byId.get(row.key).kind });
    }
  }
  return [...refused.values()];
}

/**
 * AC-9: refuses the save when the incoming draft gives a key held by a relational row of this venue to another kind.
 * @param {{ query: Function }} q  the db (before the lock) or the transaction (under it, AC-12)
 * @param {number} tenantId  req.tenantCompanyID
 * @param {number} venueId
 * @param {object} draft  the canonical incoming draft
 */
async function checkKeys(q, tenantId, venueId, draft) {
  const rows = await readKeyedRows(q, tenantId, venueId);
  if (rows.length === 0) return;
  const { draftIndex } = await loadKeyIndexes(q, tenantId, venueId, { draft, published: false });
  const refused = refusedKeys(rows, draftIndex);
  if (refused.length === 0) return;
  const locations = locationsOf(draft);
  const collector = createCollector(VENUE_MAP_SCHEMA.constants.MAX_PROBLEMS);
  for (const { key, kind, holder, actual } of refused) {
    collector.add(
      locations.get(key),
      `the key ${key} is the ${kind} of ${holder} in this venue, so it cannot be a ${actual}; give this ${actual} another id`,
    );
  }
  throw mapProblems({ problems: collector.list(), total: collector.total });
}

module.exports = { checkKeys };
