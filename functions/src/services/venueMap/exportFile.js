// validateExportFile(envelope, context) (spec/OA-1.md r1 AC-47; DC-23; L170 Q11 (b); section 10 Q5 ruled (a)): the
// export file { format, version, exportedAt, fromVenue: { code, name }, map, stores } as the schema file's exportFile
// defines it. Pure, like the validator.
//   - format and version exactly as the schema file says; exportedAt an ISO-8601 UTC time, by pattern only (no
//     clock: AC-23; plan DC-O18);
//   - map through validateMap, the one validator (AC-29), then publishable(): no backdrop. Its problems carry the
//     prefix "map." (the main session's ruling 2);
//   - each store is { unit, name, spokenName, category, keywords } and nothing else: a status or active flag is left
//     out, so an imported store starts Open (OA-2's rule); its unit key names a unit of the map, no two stores share
//     one (P0-11 G7), and its category resolves for the tenant (an inactive one is accepted, AC-20).
//
//   { ok: true, file } | { ok: false, problems, total }
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { rootLocation, keyOf, pathOf, DOCUMENT_LABEL } = require('./problems');
const { BAD, walkObject } = require('./fields');
const { newState, assertContext, fieldOf, infosOf } = require('./state');
const { validateMap } = require('./validateMap');
const { publishable } = require('./publishable');
const { elementIndex } = require('./elementIndex');
const { kindWords } = require('./references');

const FILE_LABEL = '(file)';
const STORE_KIND = 'store';
const UNIT_KIND = 'unit';

/** A map problem as a problem of the file: "levels[0]..." becomes "map.levels[0]...". */
function underMap(problem, mapPath) {
  const documentPrefix = `${DOCUMENT_LABEL}: `;
  return problem.startsWith(documentPrefix)
    ? `${mapPath}: ${problem.slice(documentPrefix.length)}`
    : `${mapPath}.${problem}`;
}

/** The stores' unit keys: a unit of the map (when the map validated), and one store per unit. */
function checkStores(st, map) {
  const index = map ? elementIndex(map) : null;
  const firstOf = new Map();
  for (const info of infosOf(st, STORE_KIND)) {
    const { unit } = info.effective;
    if (typeof unit !== 'string' || info.bad.has('unit')) continue;
    const at = fieldOf(info, 'unit');
    const entry = index?.byId.get(unit);
    if (index && !entry) st.problems.add(at, `${unit} is not ${kindWords(UNIT_KIND)} of the map`);
    else if (entry && entry.kind !== UNIT_KIND) {
      st.problems.add(at, `${unit} is ${kindWords(entry.kind)}, not ${kindWords(UNIT_KIND)}`);
    } else if (firstOf.has(unit)) {
      st.problems.add(at, `${unit} already has a store: ${pathOf(firstOf.get(unit).location)}`);
    } else firstOf.set(unit, info);
  }
}

function validateExportFile(envelope, context) {
  assertContext(context);
  const schema = context.schema ?? VENUE_MAP_SCHEMA;
  const { exportFile } = schema;
  const st = newState(schema, context, { ...schema.kinds, ...exportFile.kinds });
  let map = null;
  const mapRule = Object.values(exportFile.kinds[exportFile.root].fields).find(
    (rule) => rule.type === 'object' && rule.of === 'document',
  );
  st.hooks = new Map([
    [
      mapRule,
      (raw, location) => {
        const result = validateMap(raw, context);
        if (result.ok) {
          map = result.map;
          return publishable(result.map);
        }
        const key = keyOf(location);
        const mapPath = pathOf(location);
        result.problems.forEach((problem, i) =>
          st.problems.addKeyed([...key, i], underMap(problem, mapPath)),
        );
        st.problems.addUnlisted(result.total - result.problems.length);
        return BAD;
      },
    ],
  ]);
  const file = walkObject(envelope, exportFile.root, rootLocation(FILE_LABEL), { level: null }, st);
  if (file !== BAD) checkStores(st, map);
  if (st.problems.total > 0) {
    return { ok: false, problems: st.problems.list(), total: st.problems.total };
  }
  return { ok: true, file };
}

module.exports = { validateExportFile };
