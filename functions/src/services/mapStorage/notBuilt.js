// CONTRACT SCAFFOLD (plan/OA-2-map-storage.md 1.0 section 13 step 3): the answer of every OA-2 service method until
// step 5 builds it, so the routes exist and the tests written first fail on their assertions, never on a missing
// route. This file is deleted in step 5.
'use strict';

const { httpError } = require('../../utils/errors');

const NOT_BUILT = 'This route is being built (OA-2)';

/** A method that always answers 501 with NOT_BUILT. */
const notBuilt = () => async () => {
  throw httpError(501, NOT_BUILT, { expose: true });
};

module.exports = { notBuilt, NOT_BUILT };
