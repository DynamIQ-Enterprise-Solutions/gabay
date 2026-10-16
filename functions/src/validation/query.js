// Query strings as zod schemas (R5; SEC-2, spec/SEC-2.md r2 AC-32, AC-35, EC-28; plan DC-33). Lenient, as the code always
// was (standard §3.7: a malformed filter is ignored, never a 500): a value that is not a single string (a repeated key
// arrives as an array, `a[b]=c` as an object) is dropped, so the default applies.
//
// pagingQuery only reduces `page`, `pageSize` and `search` to a string or nothing. utils/pagination.js parsePaging stays the
// one place that clamps, defaults and refuses a search with a control character (its 400 is the service's, with today's
// message). `sortBy` and `sortOrder` are stripped: both lists have a fixed order (venue.service.js, lookup.service.js),
// so a client never picks a column (rule 3).
'use strict';

const { z } = require('zod');

// .optional(): zod 4 refuses an absent key whose schema is not optional, even when the transform would return nothing.
const text = z
  .unknown()
  .transform((value) => (typeof value === 'string' ? value : undefined))
  .optional();

const pagingQuery = z.object({ page: text, pageSize: text, search: text });

module.exports = { pagingQuery };
