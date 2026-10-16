#!/usr/bin/env node
// npm run staging:admin -- <email> <role> [<tenant code>] [--local-db]: makes one admin login for the real Firebase project and its
// rows in the database (spec/DEP-0.md r2 AC-37 to AC-41). Owner-run only. See tools/lib/stagingAdminCli.js.
// Exit code: 0 when it worked, 1 for a refusal or a failure (one plain line, nothing written unless the line says so).
'use strict';

const { main } = require('./lib/stagingAdminCli');

main().then((code) => {
  process.exitCode = code;
});
