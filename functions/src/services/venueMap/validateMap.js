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
const { rootLocation, DOCUMENT_LABEL } = require('./problems');
const { BAD, walkObject } = require('./fields');
const { newState, assertContext } = require('./state');
const { checkReferences } = require('./references');
const { checkLevels } = require('./levelRules');
const { checkElements } = require('./elementRules');
const { checkConnectors } = require('./connectorRules');

/** The UTF-8 byte length of the value's JSON text (DC-21, DC-O22), or null when it has none. */
function jsonBytes(value) {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : Buffer.byteLength(text, 'utf8');
  } catch {
    return null;
  }
}

const sizeRefusal = (bytes, cap) => ({
  ok: false,
  problems: [`${DOCUMENT_LABEL}: is ${bytes} bytes; the limit is ${cap}`],
  total: 1,
});

function validateMap(doc, context) {
  assertContext(context);
  const schema = context.schema ?? VENUE_MAP_SCHEMA;
  const cap = schema.constants.MAX_MAP_BYTES;
  const inputBytes = jsonBytes(doc);
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
