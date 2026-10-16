// The staging project's names, in ONE place (DEP-0 AC-49, EC-27; plan/DEP-0.md 1.0 step 8). `gabay-staging` is the project the owner
// created on the Spark plan (L186); if it is taken, the fallback `gabay-staging-dq` is used. Changing the project changes four
// things together: the two origins the API's CORS list allows, the function's address in the Hosting policy's connect-src, the
// name of `functions/.env.<projectId>`, and the instance connection name. The runbook's tables say <projectId>; the tests take
// every one of them from here, so a renamed project fails the tests that name it instead of passing with a stale origin.
'use strict';

const STAGING_PROJECT_ID = 'gabay-staging';
const STAGING_PROJECT_ID_FALLBACK = 'gabay-staging-dq';
/** The Functions region (L98: Singapore): part of the function's address. */
const FUNCTIONS_REGION = 'asia-southeast1';

/**
 * The two addresses of the admin page on Firebase Hosting (E-05): the CORS list the API answers.
 * @param {string} [projectId]
 * @returns {string[]}
 */
function hostingOrigins(projectId = STAGING_PROJECT_ID) {
  return [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`];
}

/** CORS_ORIGINS exactly as the env table writes it: the two origins, comma separated. */
const corsOriginsValue = (projectId = STAGING_PROJECT_ID) => hostingOrigins(projectId).join(',');

/**
 * The origin of the deployed API as the page calls it: the pattern firebase.google.com/docs/functions/http-events gives
 * (https://<region>-<project-id>.cloudfunctions.net/<function>). DEP-1's first deploy prints the real address and confirms it.
 */
const apiOrigin = (projectId = STAGING_PROJECT_ID) =>
  `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;

module.exports = {
  STAGING_PROJECT_ID,
  STAGING_PROJECT_ID_FALLBACK,
  FUNCTIONS_REGION,
  hostingOrigins,
  corsOriginsValue,
  apiOrigin,
};
