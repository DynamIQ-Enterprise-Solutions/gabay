// validateMap(doc, context) (spec/OA-1.md r1 section 3.6; office section 4.3): the one validator of the venue map
// document, run at every draft save (OA-2) and again at publish (FF-3 prime) (AC-29). Pure (AC-23): it reads only
// its two arguments, opens no connection, reads no clock, makes no network call and reads no environment value.
// It never throws on a document (AC-28); a context that is not a shapeMapContext result is a programming error and
// throws.
//
//   { ok: true, map }                          the canonical copy (AC-24): a new object, the input untouched
//   { ok: false, problems: string[], total }   the first MAX_PROBLEMS in document position, and the total (AC-26)
//
// Order: the size cap on the input first, alone (AC-32); the field walk (fields.js); the passes after it
// (references, levels, elements, connectors); the size cap on the canonical copy. The schema file is the loaded
// one, or a fixture copy passed as context.schema (DC-E16, tests only).
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { isPlainObject } = require('../../utils/objects');
const { rootLocation, DOCUMENT_LABEL } = require('./problems');
const { BAD, walkObject } = require('./fields');
const { newState, assertContext } = require('./state');
const { checkReferences } = require('./references');
const { checkLevels } = require('./levelRules');
const { checkElements } = require('./elementRules');
const { checkConnectors } = require('./connectorRules');
const { jsonBytes } = require('./jsonBytes');

const refusal = (problem) => ({ ok: false, problems: [`${DOCUMENT_LABEL}: ${problem}`], total: 1 });
const sizeRefusal = (bytes, cap) => refusal(`is ${bytes} bytes; the limit is ${cap}`);

function validateMap(doc, context) {
  assertContext(context);
  const schema = context.schema ?? VENUE_MAP_SCHEMA;
  const cap = schema.constants.MAX_MAP_BYTES;
  // Counted without recursion (jsonBytes.js), so no depth of nesting can skip the cap (review 1). An object with no
  // JSON text (a cycle, a BigInt) cannot be measured, so it is refused; anything else that is not an object is the
  // walk's "must be an object".
  const inputBytes = jsonBytes(doc);
  if (inputBytes === null && isPlainObject(doc)) {
    return refusal('has no JSON text: it holds a cycle or a value JSON cannot write');
  }
  if (inputBytes !== null && inputBytes > cap) return sizeRefusal(inputBytes, cap);

  const st = newState(schema, context, schema.kinds);
  const map = walkObject(doc, 'document', rootLocation(), { level: null }, st);
  if (map !== BAD) {
    checkReferences(st);
    checkLevels(st);
    checkElements(st);
    checkConnectors(st);
  }
  if (st.problems.total > 0) {
    return { ok: false, problems: st.problems.list(), total: st.problems.total };
  }
  const outputBytes = jsonBytes(map);
  if (outputBytes > cap) return sizeRefusal(outputBytes, cap);
  return { ok: true, map };
}

module.exports = { validateMap };
