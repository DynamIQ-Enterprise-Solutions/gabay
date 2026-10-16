// validate (R5; SEC-2, spec/SEC-2.md r2 section 3.4, AC-32 to AC-39; standard §3.7; plan DC-17, DC-34): the step before the
// handler in the Blueprint's order (requestId -> actorContext -> rateLimit -> auth -> tenantContext -> authorize -> VALIDATE ->
// handler). Every route has one, even a route with no input (`validate()`), so the route-guard-order lint can see it (DC-18).
//
//   validate({ params, query, body })   each a zod schema, each optional
//
// The handler reads the validated values through req.valid.params, req.valid.query and req.valid.body (Express 5's req.query
// is a read-only getter, so it cannot be replaced). For each source:
//   params   a failure is 404 "Not found" (OA-2 Q3 (a): a malformed id names no record)
//   query    the schemas are lenient (validation/query.js: what is not usable is dropped); a failure would be a 400
//   body     a failure is 400
// The message is the FIRST issue's, in the schema's key order, and only a schema's own message reaches a client: an issue
// with code `custom` (validation/fields.js raises nothing else). Any other issue (zod's own type error, an author's
// forgotten message) gives the fixed fallback and one `warn` naming the issue codes and paths, never the received value
// (AC-38: nothing of zod, no schema path and no value reaches a response).
'use strict';

const { httpError } = require('../utils/errors');

const NOT_FOUND = 'Not found';
/** What a client sees when a schema failed without a message of its own. */
const FALLBACK = 'The request is not valid';

/** The 400 of a failed parse: the first issue's message when it is a schema's own, else the fixed fallback. */
function badRequest(req, source, error) {
  const [first] = error.issues;
  if (first?.code === 'custom' && typeof first.message === 'string') {
    return httpError(400, first.message);
  }
  req.log?.warn(
    { source, issues: error.issues.slice(0, 5).map((i) => ({ code: i.code, path: i.path })) },
    'validation failed without a message of its own',
  );
  return httpError(400, FALLBACK);
}

/**
 * @param {{ params?: import('zod').ZodType, query?: import('zod').ZodType, body?: import('zod').ZodType }} [schemas]
 * @returns {import('express').RequestHandler}
 */
function validate({ params, query, body } = {}) {
  return function validateRequest(req, res, next) {
    const valid = {};
    if (params) {
      const result = params.safeParse(req.params);
      if (!result.success) return next(httpError(404, NOT_FOUND));
      valid.params = result.data;
    }
    if (query) {
      const result = query.safeParse(req.query);
      if (!result.success) return next(badRequest(req, 'query', result.error));
      valid.query = result.data;
    }
    if (body) {
      const result = body.safeParse(req.body);
      if (!result.success) return next(badRequest(req, 'body', result.error));
      valid.body = result.data;
    }
    req.valid = valid;
    return next();
  };
}

module.exports = { validate, FALLBACK };
