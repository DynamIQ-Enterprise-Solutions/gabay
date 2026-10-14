// publishable(map) (spec/OA-1.md r1 AC-34; office section 4.3): a copy of a canonical map with every draft-only
// field removed (a level's backdrop) and nothing else changed: the review flags stay (DC-17). The input is not
// changed and the result shares nothing with it. The draft-only fields are the schema file's (draftOnly).
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { isPlainObject, setOwn, copyJson } = require('../../utils/objects');

/** `value` as an object of `kindName`, copied, its draft-only fields left out at every depth. */
function copyKind(value, kindName, kinds) {
  if (!isPlainObject(value)) return copyJson(value);
  const fields = kinds[kindName]?.fields ?? {};
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const rule = Object.hasOwn(fields, key) ? fields[key] : undefined;
    if (rule?.draftOnly) continue;
    if (rule?.of && rule.type === 'object') setOwn(out, key, copyKind(inner, rule.of, kinds));
    else if (rule?.of && rule.type === 'array' && Array.isArray(inner)) {
      setOwn(
        out,
        key,
        inner.map((entry) => copyKind(entry, rule.of, kinds)),
      );
    } else setOwn(out, key, copyJson(inner));
  }
  return out;
}

function publishable(map) {
  return copyKind(map, 'document', VENUE_MAP_SCHEMA.kinds);
}

module.exports = { publishable };
