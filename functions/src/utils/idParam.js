// An id in a URL path (plan/FF-1-venue-setup.md section 2.1, G4): a positive integer of at most nine digits, so it always
// fits a 32-bit INT column. Anything else, 0 and a leading zero included, is a 404 before any query is sent: a
// malformed id names no record, and it must never reach PostgreSQL as an out-of-range value (a 500).
// Extracted from lookup.service.js on its second use (C2).
'use strict';

const { httpError } = require('./errors');

const ID_PATTERN = /^[1-9]\d{0,8}$/;
const NOT_FOUND = 'Not found';

/**
 * @param {unknown} text  req.params.<name>
 * @returns {number} the id
 * @throws {Error} 404 for anything that is not a plain positive integer of one to nine digits
 */
function parseIdParam(text) {
  if (typeof text !== 'string' || !ID_PATTERN.test(text)) throw httpError(404, NOT_FOUND);
  return Number(text);
}

module.exports = { parseIdParam, ID_PATTERN };
