// Test support for DEP-0 (plan/DEP-0.md 1.0 step 1, AC-9; not a test file): a fake Cloud Storage bucket, so GcsFileStore is
// tested with no credentials, no network and no emulator.
//
// It implements ONLY the four calls the store makes (gcsFileStore.js), and fails exactly where the real client does. Its
// fidelity to the real bucket is UNPROVEN until DEP-1's real-bucket run (tools/gcs-bucket-check.js); fakeBucket.test.js holds
// the table of each behaviour, with where it was read:
//
//   call                                       real @google-cloud/storage 8.2.0                       this fake
//   save + preconditionOpts.ifGenerationMatch  412 when the object exists (a create-only write)        throws code 412
//   save, no precondition                      overwrites                                              overwrites
//   download of a missing object               404                                                     throws code 404
//   delete of a missing object                 404, or resolves under { ignoreNotFound: true }         the same
//   exists                                     [true] or [false] (a 404 is false)                      the same
//   permission denied                          403                                                     failWith(403)
//   network failure                            an error whose code is a string such as ENOTFOUND       failWith(network error)
//
// Each call takes one turn of the event loop before it acts and then checks and writes in ONE synchronous step, so two
// writers started together on one key are decided exactly as the real bucket decides them: one wins, the other gets 412.
// An option the store never sends is refused, so the fake cannot quietly accept a call the real client treats differently.
'use strict';

const crypto = require('node:crypto');
const { createGcsFileStore } = require('../src/services/storage/gcsFileStore');

const SAVE_OPTIONS = new Set(['preconditionOpts']);
const DELETE_OPTIONS = new Set(['ignoreNotFound']);

/** An error shaped like the client's ApiError: the HTTP status is its numeric `code`. */
function apiError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** The permission failure a wrong role gives. */
const permissionDenied = () =>
  apiError(403, 'fake bucket: caller does not have storage.objects access');
/** A network failure: the code is a string, as Node's own errors give it. */
const networkFailure = () =>
  Object.assign(new Error('fake bucket: getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });

function refuseUnknown(options, allowed, call) {
  for (const key of Object.keys(options)) {
    if (!allowed.has(key))
      throw new Error(`fake bucket: ${call} does not support the option "${key}"`);
  }
}

/**
 * @param {{ name?: string }} [options]
 */
function createFakeBucket({ name = 'fake-gabay-bucket' } = {}) {
  /** object name -> Buffer */
  const objects = new Map();
  /** Every call in order: { op, name, ok }. */
  const log = [];
  let failure = null;

  /** Every call fails with this error from now on (null clears it). `ops` limits it to those calls. */
  function failWith(error, ops = null) {
    failure = error ? { error, ops } : null;
  }

  async function run(op, objectName, action) {
    await new Promise((resolve) => setImmediate(resolve));
    if (failure && (failure.ops === null || failure.ops.includes(op))) {
      log.push({ op, name: objectName, ok: false });
      throw failure.error;
    }
    try {
      const out = action();
      log.push({ op, name: objectName, ok: true });
      return out;
    } catch (err) {
      log.push({ op, name: objectName, ok: false });
      throw err;
    }
  }

  function file(objectName) {
    return {
      name: objectName,
      save(data, options = {}) {
        refuseUnknown(options, SAVE_OPTIONS, 'save');
        return run('save', objectName, () => {
          if (!(Buffer.isBuffer(data) || data instanceof Uint8Array || typeof data === 'string')) {
            throw new TypeError('fake bucket: save takes a Buffer, a Uint8Array or a string');
          }
          if (options.preconditionOpts?.ifGenerationMatch === 0 && objects.has(objectName)) {
            throw apiError(412, 'fake bucket: conditionNotMet');
          }
          objects.set(objectName, Buffer.from(data));
        });
      },
      download() {
        return run('download', objectName, () => {
          if (!objects.has(objectName)) throw apiError(404, 'fake bucket: No such object');
          return [Buffer.from(objects.get(objectName))];
        });
      },
      exists() {
        return run('exists', objectName, () => [objects.has(objectName)]);
      },
      delete(options = {}) {
        refuseUnknown(options, DELETE_OPTIONS, 'delete');
        return run('delete', objectName, () => {
          if (!objects.has(objectName)) {
            if (options.ignoreNotFound === true) return [{}];
            throw apiError(404, 'fake bucket: No such object');
          }
          objects.delete(objectName);
          return [{}];
        });
      },
    };
  }

  return { name, objects, log, file, failWith };
}

/**
 * A GcsFileStore over a fake bucket that also offers the inspection surface memoryFileStore.js has (files, puts, gets, removes,
 * keys, hashes), so a suite written against the in-memory store runs unchanged over it (DEP-0 AC-10, plan C1).
 * @param {ReturnType<typeof createFakeBucket>} [bucket]
 */
function fakeBucketFileStore(bucket = createFakeBucket()) {
  const store = createGcsFileStore({ bucket });
  const names = (op, okOnly) =>
    bucket.log.filter((l) => l.op === op && (!okOnly || l.ok)).map((l) => l.name);
  Object.defineProperties(store, {
    bucket: { value: bucket },
    files: { get: () => bucket.objects },
    puts: { get: () => names('save', true) },
    gets: { get: () => names('download', false) },
    removes: { get: () => names('delete', false) },
  });
  store.keys = (prefix = '') =>
    [...bucket.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  store.hashes = () =>
    Object.fromEntries(
      [...bucket.objects].map(([k, v]) => [k, crypto.createHash('sha256').update(v).digest('hex')]),
    );
  return store;
}

module.exports = {
  createFakeBucket,
  fakeBucketFileStore,
  apiError,
  permissionDenied,
  networkFailure,
};
