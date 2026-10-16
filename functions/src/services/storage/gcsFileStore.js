// The Cloud Storage FileStore (fileStore.js; DEP-0 AC-5, AC-11): the same interface as the local folder, over one bucket.
// The object name is the storage key, so StoredFile.StoragePath is the object's name in either store.
//
// put refuses a key that already holds an object with a create-only write (`ifGenerationMatch: 0`: the bucket answers 412
// when the object exists), never a check followed by a write, so two writers on one key cannot both win. The size and the
// SHA-256 are computed here from the bytes given, not read back from the bucket. get and exists turn only a 404 into
// null and false, and remove turns only a 404 into "already gone": any other failure (permission denied, network) is thrown
// as it is and is never mistaken for an empty bucket.
//
// The bucket stays private (AC-11): this file never makes an object public, never signs a URL, and logs nothing, so no
// bytes and no key reach a log from here. Every read goes through an API route that checks the tenant.
//
// What the bucket client must offer (a duck type, so a fake stands in for it in the tests; the real @google-cloud/storage
// 8.2.0 Bucket has all of it): bucket.file(name) giving an object with
//   save(bytes, { preconditionOpts: { ifGenerationMatch: 0 } })   resolves, or throws with a numeric `code` (412 exists)
//   download()                                                    resolves [Buffer], or throws code 404
//   exists()                                                      resolves [boolean]
//   delete({ ignoreNotFound: true })                              resolves, also when the object is missing
'use strict';

const crypto = require('node:crypto');
const { isStorageKey } = require('./fileStore');

const HTTP_NOT_FOUND = 404;
const HTTP_PRECONDITION_FAILED = 412;

/** The HTTP status a storage client error carries (the library puts it in `code`; a gaxios error in `status`). */
function statusOf(err) {
  const raw = err?.code ?? err?.status ?? err?.response?.status;
  return typeof raw === 'number' || /^\d+$/.test(String(raw)) ? Number(raw) : undefined;
}

/**
 * @param {{ bucket: { file: (name: string) => object } }} options
 * @returns {import('./fileStore').FileStore}
 */
function createGcsFileStore({ bucket } = {}) {
  if (typeof bucket?.file !== 'function') {
    throw new TypeError(
      'gcsFileStore: bucket must be a Cloud Storage bucket (it needs file(name))',
    );
  }

  /** The key's object; throws before anything is sent when the key is not a storage key. */
  function objectOf(key) {
    if (!isStorageKey(key)) throw new Error('gcsFileStore: not a storage key');
    return bucket.file(key);
  }

  return {
    async put(key, bytes) {
      const object = objectOf(key);
      if (!Buffer.isBuffer(bytes)) throw new TypeError('gcsFileStore: put takes a Buffer');
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      try {
        await object.save(bytes, { preconditionOpts: { ifGenerationMatch: 0 } });
      } catch (err) {
        if (statusOf(err) === HTTP_PRECONDITION_FAILED) {
          throw new Error('gcsFileStore: the key already holds a file', { cause: err });
        }
        throw err;
      }
      return { sizeBytes: bytes.length, sha256 };
    },

    async get(key) {
      const object = objectOf(key);
      try {
        const [contents] = await object.download();
        return contents;
      } catch (err) {
        if (statusOf(err) === HTTP_NOT_FOUND) return null;
        throw err;
      }
    },

    async exists(key) {
      const object = objectOf(key);
      const [found] = await object.exists();
      return found === true;
    },

    async remove(key) {
      const object = objectOf(key);
      try {
        await object.delete({ ignoreNotFound: true });
      } catch (err) {
        if (statusOf(err) === HTTP_NOT_FOUND) return;
        throw err;
      }
    },
  };
}

module.exports = { createGcsFileStore, statusOf };
