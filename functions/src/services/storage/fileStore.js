// The one storage interface (spec/OA-2.md r1 DC-17; P0-03 AC-50, AC-51; plan/OA-2-map-storage.md 1.0 section 4.5):
// every stored file of the API (backdrop images now, publish packages from FF-3') goes through an object of this
// shape, so the deploy call swaps the local folder (localFileStore.js, E-20) for Cloud Storage in one place.
//
// A key is a storage key, never a disk path: `backdrops/<tenantId>/<venueId>/<key>` or
// `packages/<tenantId>/<venueId>/v<versionNo>-<sha256>.<extension>`. It is what StoredFile.StoragePath holds.
'use strict';

/**
 * @typedef {object} FileStore
 * @property {(key: string, bytes: Buffer) => Promise<{ sizeBytes: number, sha256: string }>} put
 *   writes a new file whole (a reader never sees part of it) and answers its size and the SHA-256 (64 lowercase hex
 *   characters) of exactly the bytes stored. Refuses a key that already holds a file: a stored file never changes
 *   (office section 6.2), so a write never replaces one.
 * @property {(key: string) => Promise<Buffer|null>} get  the bytes, or null when the key holds no file
 * @property {(key: string) => Promise<boolean>} exists  whether the key holds a file
 * @property {(key: string) => Promise<void>} remove  removes the file; resolves when there was none, so a cleanup after
 *   a failure can always run
 * Every method refuses (throws) a key that isStorageKey() refuses.
 */

/** The key's shape: a known top folder, then one or more segments of letters, digits, dot, underscore and dash. */
const STORAGE_KEY = /^(backdrops|packages)(\/[A-Za-z0-9._-]+)+$/;

/** True for a key a FileStore accepts: the pattern above, and no segment that is "." or "..". */
function isStorageKey(key) {
  return (
    typeof key === 'string' &&
    STORAGE_KEY.test(key) &&
    key.split('/').every((segment) => segment !== '.' && segment !== '..')
  );
}

module.exports = { STORAGE_KEY, isStorageKey };
