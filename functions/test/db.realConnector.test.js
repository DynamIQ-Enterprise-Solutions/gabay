'use strict';

// DEP-0 AC-14, AC-2 (E-29 signed 2026-10-16): the REAL connector package, @google-cloud/cloud-sql-connector 1.12.1, is installed
// pinned, and connector.js's default factory builds it lazily. No network: constructing a Connector and closing it opens nothing; a
// real connection through it is DEP-1's first deploy. The fake-connector tests (db.test.js, db.connection-errors.test.js) stay.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadConnector } = require('../src/db/connector');

test('the package is pinned exactly in functions/package.json (no range)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@google-cloud/cloud-sql-connector'], '1.12.1');
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/@google-cloud/cloud-sql-connector'].version, '1.12.1');
});

test('the default factory builds the real Connector, which has the two calls connector.js makes', () => {
  const connector = loadConnector();
  try {
    assert.equal(typeof connector.getOptions, 'function');
    assert.equal(typeof connector.close, 'function');
  } finally {
    connector.close();
  }
});
