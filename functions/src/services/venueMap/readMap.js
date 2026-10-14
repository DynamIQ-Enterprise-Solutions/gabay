// readMap(stored) (spec/OA-1.md r1 AC-36, EC-2, EC-3; re-plan DC 8; DC-22): reads a stored document. A document of a
// spec this code knows is brought up to the current spec by its upconverter and returned; today only spec 1 exists,
// and it passes through unchanged. Reading never re-validates, so a frozen published layout that today's caps or
// catalog would refuse still reads (invariant 3). Any other spec (newer, 0, missing, not a whole number) is refused.
'use strict';

const { VENUE_MAP_SCHEMA } = require('../../config/venueMapSchema');
const { isPlainObject } = require('../../utils/objects');

const UNKNOWN_SPEC = 'spec: made by a newer or unknown version of Gabay';

/** One upconverter per spec this code reads, each returning the current spec's document. */
const UPCONVERTERS = new Map([[VENUE_MAP_SCHEMA.spec, (map) => map]]);

function readMap(stored) {
  const spec = isPlainObject(stored) && Object.hasOwn(stored, 'spec') ? stored.spec : undefined;
  const upconvert = Number.isInteger(spec) ? UPCONVERTERS.get(spec) : undefined;
  if (!upconvert) return { ok: false, problems: [UNKNOWN_SPEC] };
  return { ok: true, map: upconvert(stored) };
}

module.exports = { readMap };
