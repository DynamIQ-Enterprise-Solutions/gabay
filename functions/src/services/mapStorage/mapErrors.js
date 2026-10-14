// The venue map routes' refusals that more than one service gives (spec/OA-2.md r1 AC-8, AC-16, AC-24, AC-30; plan/OA-2-
// map-storage.md 1.0 section 5). Messages are written for a person (standard 3.8); a 4xx may carry named keys after
// `error` (utils/errors.js, DC-A4).
'use strict';

const { httpError } = require('../../utils/errors');
const { mapProblemBody } = require('../venueMap');

const NOT_FOUND = 'Not found';
const STALE = 'Someone else changed this map. Reload to see their change';
const PUBLISH_RUNNING = 'A publish is already running for this venue';
const NO_ENGINE = 'Publishing comes with the publish engine (FF-3′)';

/** 404: no such venue for this tenant (AC-8), or nothing at that key. */
const notFound = () => httpError(404, NOT_FOUND);

/** AC-16's 409: the base the request names is not the stored DraftVersion. */
const staleDraft = (draftVersion) => httpError(409, STALE, { extra: { draftVersion } });

/** AC-24's 409: a publish of the venue is BUILDING and not stale. */
const publishRunning = () => httpError(409, PUBLISH_RUNNING);

/** AC-30's 501: no publish engine yet. The checks before it have all passed. */
const noEngine = () => httpError(501, NO_ENGINE, { expose: true });

/** A 400 in OA-1's problem shape { error, problems, total } (AC-14); `error` may be replaced (AC-32). */
function mapProblems({ problems, total }, error) {
  const body = mapProblemBody({ problems, total });
  return httpError(400, error ?? body.error, { extra: { problems: body.problems, total } });
}

module.exports = { notFound, staleDraft, publishRunning, noEngine, mapProblems, STALE };
