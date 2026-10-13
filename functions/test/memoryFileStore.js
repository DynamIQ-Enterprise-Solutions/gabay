// Test support for OA-2 (plan/OA-2-map-storage.md 1.0 sections 4.5 and 4.6). Not a test file.
//
// memoryFileStore()   an in-memory FileStore (services/storage/fileStore.js): the same interface as the local folder, so an
//                     API test sees every file the services write or remove (`files`, a Map of key -> Buffer) and no
//                     test writes to the disk. It enforces the interface's own rules, so a service that breaks one fails
//                     here: a key must pass isStorageKey, put never replaces a stored file, remove of a missing key is fine.
//                     `puts`, `gets` and `removes` list every call in order (a cleanup after a failure is then visible, and
//                     "no bytes were read" is checkable).
'use strict';

const crypto = require('node:crypto');
const { isStorageKey } = require('../src/services/storage/fileStore');

function memoryFileStore() {
  const files = new Map();
  const puts = [];
  const removes = [];
  const gets = [];
  const checked = (key) => {
    if (!isStorageKey(key)) throw new Error(`memoryFileStore: "${key}" is not a storage key`);
    return key;
  };
  return {
    files,
    puts,
    gets,
    removes,
    async put(key, bytes) {
      checked(key);
      if (files.has(key)) throw new Error(`memoryFileStore: "${key}" already holds a file`);
      const copy = Buffer.from(bytes);
      files.set(key, copy);
      puts.push(key);
      return {
        sizeBytes: copy.length,
        sha256: crypto.createHash('sha256').update(copy).digest('hex'),
      };
    },
    async get(key) {
      checked(key);
      gets.push(key);
      return files.has(key) ? Buffer.from(files.get(key)) : null;
    },
    async exists(key) {
      checked(key);
      return files.has(key);
    },
    async remove(key) {
      checked(key);
      files.delete(key);
      removes.push(key);
    },
    /** The keys under a prefix, sorted. */
    keys(prefix = '') {
      return [...files.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
    /** SHA-256 of every stored file, by key (AC-29's before and after). */
    hashes() {
      return Object.fromEntries(
        [...files].map(([k, v]) => [k, crypto.createHash('sha256').update(v).digest('hex')]),
      );
    },
  };
}

module.exports = { memoryFileStore };
