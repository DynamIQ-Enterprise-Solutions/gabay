'use strict';

// DEP-0 AC-5, AC-6, AC-8 (plan/DEP-0.md 1.0 step 1): the FileStore interface has ONE contract suite (fileStoreContract.js),
// and every store runs it: the local folder (a temporary folder), the in-memory double the API tests use (so it cannot drift
// from the interface), and GcsFileStore over the fake bucket (fakeBucket.js, whose fidelity to a real bucket is unproven until
// DEP-1's real-bucket run). The cases that belong to one store alone stay in that store's own test file.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocalFileStore } = require('../src/services/storage/localFileStore');
const { memoryFileStore } = require('./memoryFileStore');
const { fakeBucketFileStore } = require('./fakeBucket');
const { defineFileStoreContract } = require('./fileStoreContract');

defineFileStoreContract('local folder', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'gabay-contract-'));
  return {
    store: createLocalFileStore({ rootDir: path.join(parent, 'store') }),
    cleanup: () => fs.rmSync(parent, { recursive: true, force: true }),
  };
});

defineFileStoreContract('memory double', () => ({ store: memoryFileStore() }), {
  lenientAboutBytes: true, // a known deviation of the test double: see fileStoreContract.js
});

defineFileStoreContract('gcs over the fake bucket', () => ({ store: fakeBucketFileStore() }));
