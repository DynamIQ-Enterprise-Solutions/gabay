'use strict';

// DEP-0 AC-53, AC-14 (plan/DEP-0.md 1.0 step 6): nothing in `npm run verify` needs a cloud SDK. In host mode with the local store,
// loading and running the API never loads @google-cloud/cloud-sql-connector or @google-cloud/storage and never makes a Storage
// client. Checked in a fresh process, by the module cache, after the app has served a request. The connector package is not even
// installed until E-29 is signed; the check holds either way.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FUNCTIONS = path.resolve(__dirname, '..');

test('AC-53: a local run in host mode with the local store loads no connector and no Storage client, after serving /api/health', () => {
  const script = `
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    const { loadEnvFile } = require(${JSON.stringify(path.join(FUNCTIONS, 'src', 'config'))});
    loadEnvFile();
    process.env.FILE_STORE = 'local';
    delete process.env.CLOUD_SQL_INSTANCE;
    const { createApp } = require(${JSON.stringify(path.join(FUNCTIONS, 'src', 'app'))});
    const { getDb } = require(${JSON.stringify(path.join(FUNCTIONS, 'src', 'db'))});
    const http = require('node:http');
    (async () => {
      const server = http.createServer(createApp());
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/health');
      const status = res.status;
      await new Promise((resolve) => server.close(resolve));
      await getDb().close();
      const loaded = Object.keys(require.cache).filter((f) =>
        /cloud-sql-connector|[\\\\/]@google-cloud[\\\\/]storage[\\\\/]|firebase-admin[\\\\/]lib[\\\\/]storage/.test(f),
      );
      console.log(JSON.stringify({ status, loaded }));
    })();
  `;
  const run = spawnSync(process.execPath, ['-e', script], {
    cwd: FUNCTIONS,
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(run.status, 0, `exit ${run.status}\n${run.stdout}\n${run.stderr}`);
  const result = JSON.parse(run.stdout.trim().split('\n').at(-1));
  assert.equal(result.status, 200);
  assert.deepEqual(result.loaded, [], 'no cloud SDK module was loaded');
});

test('AC-53: building the store for gcs does not open a bucket until the first file operation', () => {
  const { createFileStore } = require('../src/services/storage/createFileStore');
  let opened = 0;
  createFileStore(
    { fileStoreDir: '/unused', fileStore: { kind: 'gcs', bucket: 'b' } },
    {
      openBucket: () => {
        opened += 1;
        return { file: () => ({}) };
      },
    },
  );
  assert.equal(opened, 0);
});
