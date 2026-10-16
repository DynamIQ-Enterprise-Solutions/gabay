// Path parameters as zod schemas (R5; SEC-2, spec/SEC-2.md r2 AC-32, AC-33, AC-35; plan DC-35). A failure is a 404 "Not
// found" (validate.js: the owner's ruling OA-2 Q3 (a): a malformed id names no record), so these schemas need no message.
//
//   venueIdParam       :venueId, a positive integer of one to nine digits (the ID_PATTERN of utils/idParam.js, which
//                      the venue-scope guard shares), as a number
//   lookupNameParam    :name, an OWN key of LOOKUPS (rule 3: the allow-list is the map itself, never a second list; the
//                      keys "constructor" and "__proto__" are not lookups)
//   lookupItemParams   :name and :id
//   backdropKeyParam   :venueId and :key, the schema file's BACKDROP_KEY pattern (32 lowercase hexadecimal characters)
'use strict';

const { z } = require('zod');
const { ID_PATTERN } = require('../utils/idParam');
const { VENUE_MAP_SCHEMA } = require('../config/venueMapSchema');
const { LOOKUPS } = require('../services/lookup.service');

const id = z.string().regex(ID_PATTERN).transform(Number);
const lookupName = z.string().refine((name) => Object.hasOwn(LOOKUPS, name));

const venueIdParam = z.object({ venueId: id });
const lookupNameParam = z.object({ name: lookupName });
const lookupItemParams = z.object({ name: lookupName, id });
const backdropKeyParam = z.object({
  venueId: id,
  // refine, not regex(): the schema file's pattern is a frozen RegExp, and zod's regex check writes its lastIndex.
  key: z.string().refine((key) => VENUE_MAP_SCHEMA.patterns.BACKDROP_KEY.test(key)),
});

module.exports = { venueIdParam, lookupNameParam, lookupItemParams, backdropKeyParam };
