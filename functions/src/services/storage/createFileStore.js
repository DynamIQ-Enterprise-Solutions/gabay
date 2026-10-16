// The one file that names a store class (DEP-0 AC-4): the config chooses the FileStore (config.fileStore.kind, FILE_STORE),
// and createApp calls this. A test still hands createApp its own `fileStore`, so nothing else changes.
//
// 'local'  the git-ignored folder of this machine (localFileStore.js; development and the tests).
// 'gcs'    one Cloud Storage bucket (gcsFileStore.js). firebase-admin's Storage is loaded only here and only in this mode, so
//          a local run, a test and the deploy-time load of index.js never load it or build a Storage client (AC-53).
//          The bucket is resolved on the first call, not at start: a missing @google-cloud/storage (an optional dependency of
//          firebase-admin, EC-28) then fails the first file operation, not the start of the whole API.
'use strict';

const { createLocalFileStore } = require('./localFileStore');
const { createGcsFileStore } = require('./gcsFileStore');

/** The Admin SDK app that owns the Storage client: named, so it never clashes with the sign-in verifier's apps. */
const STORAGE_APP_NAME = 'gabay-storage';

/**
 * The real bucket, through firebase-admin 14.5.0's Storage (E-09): the SDK finds the project and the credential itself
 * (the runtime's service account on a deployed function, Application Default Credentials on a machine).
 * @param {string} bucketName
 */
function adminBucket(bucketName) {
  const { getApps, getApp, initializeApp } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const app = getApps().some((a) => a.name === STORAGE_APP_NAME)
    ? getApp(STORAGE_APP_NAME)
    : initializeApp({ storageBucket: bucketName }, STORAGE_APP_NAME);
  return getStorage(app).bucket(bucketName);
}

/**
 * @param {{ fileStoreDir: string, fileStore: { kind: 'local'|'gcs', bucket: string|null } }} config
 * @param {{ openBucket?: (name: string) => { file: Function } }} [options]  tests give a fake bucket here
 * @returns {import('./fileStore').FileStore}
 */
function createFileStore(config, { openBucket = adminBucket } = {}) {
  const { kind, bucket: bucketName } = config.fileStore;
  if (kind === 'gcs') {
    let opened = null;
    const bucket = {
      file: (name) => {
        opened ??= openBucket(bucketName);
        return opened.file(name);
      },
    };
    return createGcsFileStore({ bucket });
  }
  if (kind === 'local') return createLocalFileStore({ rootDir: config.fileStoreDir });
  throw new Error(`createFileStore: unknown store kind "${kind}"`);
}

module.exports = { createFileStore, adminBucket, STORAGE_APP_NAME };
