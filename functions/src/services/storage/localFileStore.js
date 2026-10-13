// The local FileStore (fileStore.js) under E-20 (P0-03 D2, AC-50): files in a git-ignored folder of this machine,
// config.fileStoreDir (FILE_STORE_DIR in .env), never Cloud Storage. Its ledger row closes at the deploy call.
//
// put writes the bytes to a temporary name in the key's own folder, then links that file to the key's name and removes
// the temporary one. A hard link fails when the name already exists (EEXIST), so a stored file is never replaced, and a
// reader never sees a half-written file under the key. Every method refuses a key isStorageKey() refuses, and checks
// that the resolved path stays under rootDir. Nothing is created on disk before the first put.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { isStorageKey } = require('./fileStore');

/**
 * @param {{ rootDir: string }} options  the store's folder (an absolute path)
 * @returns {import('./fileStore').FileStore}
 */
function createLocalFileStore({ rootDir } = {}) {
  if (typeof rootDir !== 'string' || rootDir === '') {
    throw new TypeError('localFileStore: rootDir must be a folder path');
  }
  const root = path.resolve(rootDir);

  /** The key's path under the root; throws for a key that is not a storage key or would leave the root. */
  function pathOf(key) {
    if (!isStorageKey(key)) throw new Error('localFileStore: not a storage key');
    const full = path.resolve(root, ...key.split('/'));
    if (!full.startsWith(root + path.sep))
      throw new Error('localFileStore: the key leaves the store');
    return full;
  }

  const missing = (err) => err?.code === 'ENOENT';

  return {
    async put(key, bytes) {
      const full = pathOf(key);
      if (!Buffer.isBuffer(bytes)) throw new TypeError('localFileStore: put takes a Buffer');
      await fs.mkdir(path.dirname(full), { recursive: true });
      const temp = `${full}.${crypto.randomBytes(8).toString('hex')}.tmp`;
      try {
        await fs.writeFile(temp, bytes, { flag: 'wx' });
        await fs.link(temp, full); // EEXIST when the key holds a file: never replaced
      } finally {
        await fs.rm(temp, { force: true });
      }
      return {
        sizeBytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      };
    },

    async get(key) {
      const full = pathOf(key);
      try {
        return await fs.readFile(full);
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },

    async exists(key) {
      const full = pathOf(key);
      try {
        return (await fs.stat(full)).isFile();
      } catch (err) {
        if (missing(err)) return false;
        throw err;
      }
    },

    async remove(key) {
      await fs.rm(pathOf(key), { force: true });
    },
  };
}

module.exports = { createLocalFileStore };
