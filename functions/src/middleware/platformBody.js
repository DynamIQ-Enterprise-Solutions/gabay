// The Functions path of the request body (DEP-0 step 7, F1, F2a, F4; spec/DEP-0.md r2, plan/DEP-0.md 1.0 §0.1).
//
// On Cloud Functions, and in the Functions emulator, the PLATFORM reads the body before the function runs: it runs body-parser's
// json, text, urlencoded and raw ("*/*") parsers with a 32 MB limit, keeps the bytes as `req.rawBody`, and sets `req.body` to
// whatever parser matched (functions-framework-nodejs src/server.ts, firebase-tools functionsEmulatorRuntime.js; plan/DEP-0-step0.md).
// Everything the API does with a body was written for the in-process request (a test, a plain Node server), where nothing has been
// read yet. Three things differ, and this file makes the platform path behave like the in-process one. It acts ONLY when the
// platform has already read the body (`Buffer.isBuffer(req.rawBody)`, DC-26: no mode flag to forget); in-process it does nothing.
//
//   F2a  the API's own `express.json({ limit: MAX_JSON_BODY })` never runs, because body-parser skips a request that was already read, so
//        the platform's 32 MB would apply, not our 5 MB. A JSON body over the limit gets the SAME 413 here.
//   F4   the audit trail stores `req.body` whenever it is defined (middleware/auditTrail.js). In-process only `express.json` sets it. On
//        the platform path an upload's Buffer, a form, a text body or `{}` (no body at all) would reach AuditLog. So a body that
//        `express.json` would not have produced is removed: a non-JSON type, and an empty body.
//   F1   multer reads a multipart upload by piping the request into busboy, and the request has already been consumed, so nothing
//        arrives. multer 2.4.0's documented `streamHandler` (README "streamHandler") feeds busboy the bytes the platform kept.
//
// What this does NOT do: JSON the platform cannot parse. The platform answers that itself (Express's final handler, an HTML page) and
// the function never runs (R1): that is a known difference, said in the runbook, and not patched here.
'use strict';

const express = require('express');

/** True when the platform has read the body already and kept its bytes. */
const preRead = (req) => Buffer.isBuffer(req.rawBody);

/**
 * @param {{ maxJsonBodyBytes: number }} config
 * @returns {import('express').RequestHandler}
 */
function createPlatformBody({ maxJsonBodyBytes }) {
  return function platformBody(req, res, next) {
    if (!preRead(req)) return next();
    const isJson = Boolean(req.is('application/json'));
    if (isJson && req.rawBody.length > maxJsonBodyBytes) {
      // The error express.json's parser gives, so the one error handler answers it as it answers the in-process 413.
      return next(
        Object.assign(new Error('request entity too large'), {
          type: 'entity.too.large',
          status: 413,
        }),
      );
    }
    // A JSON body within the limit stays as the platform parsed it (the same object express.json would have made). Anything else is
    // not express.json's: multipart is multer's own, a form or text body is not read by this API, an empty body is no body.
    if (!isJson || req.rawBody.length === 0) req.body = undefined;
    return next();
  };
}

/**
 * The API's one body-parsing layer, at the slot of the standard's JSON body limit: the platform path made as in-process
 * (createPlatformBody), then `express.json` with MAX_JSON_BODY. It is ONE layer, still named `jsonParser`, so the order of the
 * middleware stack (app.test.js, standard §3.1) is the one it always was: DEP-0 adds a step to a stage, not a stage.
 * @param {{ maxJsonBody: string, maxJsonBodyBytes: number }} config
 * @returns {import('express').RequestHandler}
 */
function createJsonParser({ maxJsonBody, maxJsonBodyBytes }) {
  const platformBody = createPlatformBody({ maxJsonBodyBytes });
  const parseJson = express.json({ limit: maxJsonBody }); // never a blanket 50 MB; big files go through multer
  return function jsonParser(req, res, next) {
    platformBody(req, res, (err) => (err ? next(err) : parseJson(req, res, next)));
  };
}

/**
 * multer's streamHandler (README "streamHandler"; DC-27): where the platform has already read the body, busboy is fed those
 * bytes; in-process, the request is piped in as multer does by default.
 * @param {import('express').Request} req
 * @param {import('stream').Writable} busboy
 */
function feedBusboy(req, busboy) {
  if (preRead(req)) busboy.end(req.rawBody);
  else req.pipe(busboy);
}

module.exports = { createJsonParser, createPlatformBody, feedBusboy };
