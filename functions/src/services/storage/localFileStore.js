// The local FileStore (fileStore.js) under E-20 (P0-03 D2, AC-50): files in a git-ignored folder of this machine,
// config.fileStoreDir (FILE_STORE_DIR in .env), never Cloud Storage. Its ledger row closes at the deploy call.
//
// CONTRACT ONLY (plan/OA-2-map-storage.md 1.0 section 13 step 3): the signatures the tests are written against.
// OA-2 step 5 builds it: put writes a temporary name in the same folder and renames it into place, refuses an
// existing key and any key that resolves outside rootDir; nothing is created on disk before the first put.
'use strict';

const NOT_BUILT = 'localFileStore: not built yet (OA-2 step 5)';

/**
 * @param {{ rootDir: string }} options  the store's folder (an absolute path)
 * @returns {import('./fileStore').FileStore}
 */
function createLocalFileStore({ rootDir }) {
  if (typeof rootDir !== 'string' || rootDir === '') {
    throw new TypeError('localFileStore: rootDir must be a folder path');
  }
  const notBuilt = async () => {
    throw new Error(NOT_BUILT);
  };
  return { put: notBuilt, get: notBuilt, exists: notBuilt, remove: notBuilt };
}

module.exports = { createLocalFileStore };
