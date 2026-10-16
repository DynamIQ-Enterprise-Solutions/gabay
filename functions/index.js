// Cloud Functions entry point (Blueprint Part 1): the whole API is ONE function, `api`, in
// Singapore, held to one instance (L98). The Express app lives in src/app.js.
//
// Loading this file must be inert: Firebase's deploy-time analysis requires it with no database
// settings present, and a config error at that point would abort the deploy. So nothing here reads
// the config or opens a pool; the app is built on the first request and reused after.
//
// The function holds ONE secret (DEP-0 AC-24): the password of the database login gabay_api, bound with defineSecret, so it
// reaches the process as the environment variable PGPASSWORD at runtime only (firebase.google.com/docs/functions/config-env,
// plan/DEP-0-step0.md row 5) and config is unchanged. Declaring it reads nothing, so loading stays inert. gabay_migrate's
// password is never bound here: CI reads it through its federated identity (DEP-1). A changed secret version reaches the function
// only when an instance starts again, which is a redeploy (the runbook's rotation order).
//
// In the Functions EMULATOR (firebase-tools sets FUNCTIONS_EMULATOR=true) the secret is NOT declared: a declared secret makes the
// emulator ask Google Cloud Secret Manager for it (firebase-tools functionsEmulator.js resolveSecretEnvs; plan/DEP-0.md 1.0 step 7),
// which is a cloud call from `npm run verify` that DEP-0 AC-53 forbids and, on a logged-in machine, a real one. There the password
// comes from the repository's .env, as it always did. A deploy never sets FUNCTIONS_EMULATOR (the runbook's env table lists it
// nowhere, and dep0.envTable.test.js refuses it there).
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const pgPassword = defineSecret('PGPASSWORD');

let app = null;
const getApp = () => {
  app ??= require('./src/app').createApp();
  return app;
};

const inEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

exports.api = onRequest(
  { region: 'asia-southeast1', maxInstances: 1, secrets: inEmulator ? [] : [pgPassword] },
  (req, res) => getApp()(req, res),
);
