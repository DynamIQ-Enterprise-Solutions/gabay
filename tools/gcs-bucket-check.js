#!/usr/bin/env node
// npm run gcs:check: the real-bucket run of DEP-0 (spec/DEP-0.md r2 AC-8). Owner-run at DEP-1; see tools/lib/gcs-bucket-check.js.
// Exit code: the number of failed checks (1 for a refused invocation).
'use strict';

const { main } = require('./lib/gcs-bucket-check');

main().then((code) => {
  process.exitCode = code;
});
