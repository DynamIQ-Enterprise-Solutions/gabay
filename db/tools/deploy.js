// npm run db:deploy: see lib/deploy.js. It reads the process environment only (never the repository's .env) and exits 0 only
// when every step succeeded.
'use strict';

const { runDeploy } = require('./lib/deploy');

runDeploy({ argv: process.argv.slice(2) }).then((code) => {
  process.exitCode = code;
});
